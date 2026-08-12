import React, { useState, useEffect } from 'react'
import { db, initializeDB, getResumen } from './db'
import './App.css'

export default function App() {
  const [vista, setVista] = useState('ventas')
  const [inventario, setInventario] = useState([])
  const [productos, setProductos] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [ventas, setVentas] = useState([])
  const [cierres, setCierres] = useState([])
  const [resumen, setResumen] = useState({})

  const [nuevaVenta, setNuevaVenta] = useState({
    productoId: 1,
    cantidad: 1,
    empleadoId: 1,
    metodo_pago: 'efectivo'
  })

  const [nuevoEmpleado, setNuevoEmpleado] = useState({
    nombre: '',
    turno: 'Mañana'
  })

  // Cargar datos al iniciar
  useEffect(() => {
    const cargarDatos = async () => {
      await initializeDB()
      
      const inv = await db.inventario.toArray()
      const prod = await db.productos.toArray()
      const emp = await db.empleados.toArray()
      const vtas = await db.ventas.where('fecha').equals(new Date().toLocaleDateString()).toArray()
      const crs = await db.cierres.toArray()

      setInventario(inv)
      setProductos(prod)
      setEmpleados(emp)
      setVentas(vtas)
      setCierres(crs)

      const res = await getResumen()
      setResumen(res)
    }

    cargarDatos()
  }, [])

  const calcularCostoProducto = (productoId) => {
    const producto = productos.find(p => p.id === productoId)
    if (!producto) return 0
    return producto.ingredientes.reduce((total, ing) => {
      const ingrediente = inventario.find(i => i.id === ing.ingrediente_id)
      return total + (ingrediente ? ingrediente.costo_unitario * ing.cantidad : 0)
    }, 0)
  }

  const calcularPrecio = (costo, margen) => {
    if (costo && margen) return Math.round(costo / (1 - margen / 100))
    return 0
  }

  const agregarVenta = async () => {
    if (nuevaVenta.cantidad <= 0) return

    const costo = calcularCostoProducto(nuevaVenta.productoId)
    const producto = productos.find(p => p.id === nuevaVenta.productoId)
    const precioVenta = calcularPrecio(costo, producto.margen)

    const venta = {
      productoId: nuevaVenta.productoId,
      cantidad: nuevaVenta.cantidad,
      costo_unitario: costo,
      precio_venta: precioVenta,
      empleadoId: nuevaVenta.empleadoId,
      metodo_pago: nuevaVenta.metodo_pago,
      timestamp: new Date().toLocaleTimeString(),
      fecha: new Date().toLocaleDateString()
    }

    await db.ventas.add(venta)
    setVentas([...ventas, venta])

    // Actualizar inventario
    let nuevoInventario = [...inventario]
    producto.ingredientes.forEach(ing => {
      const idx = nuevoInventario.findIndex(i => i.id === ing.ingrediente_id)
      if (idx >= 0) {
        nuevoInventario[idx].cantidad -= ing.cantidad * nuevaVenta.cantidad
        db.inventario.update(nuevoInventario[idx].id, { cantidad: nuevoInventario[idx].cantidad })
      }
    })
    setInventario(nuevoInventario)

    const res = await getResumen()
    setResumen(res)

    setNuevaVenta({ productoId: 1, cantidad: 1, empleadoId: 1, metodo_pago: 'efectivo' })
  }

  const agregarEmpleado = async () => {
    if (!nuevoEmpleado.nombre.trim()) return

    const empleado = {
      nombre: nuevoEmpleado.nombre,
      turno: nuevoEmpleado.turno,
      estado: 'activo'
    }

    const id = await db.empleados.add(empleado)
    setEmpleados([...empleados, { ...empleado, id }])
    setNuevoEmpleado({ nombre: '', turno: 'Mañana' })
  }

  const cerrarCaja = async () => {
    if (ventas.length === 0) return

    let totalVentas = 0, totalCostos = 0
    const pagos = { efectivo: 0, tarjeta: 0, transferencia: 0 }

    ventas.forEach(venta => {
      const costoTotal = venta.costo_unitario * venta.cantidad
      const ventaTotal = venta.precio_venta * venta.cantidad
      totalCostos += costoTotal
      totalVentas += ventaTotal
      if (pagos.hasOwnProperty(venta.metodo_pago)) {
        pagos[venta.metodo_pago] += ventaTotal
      }
    })

    const cierre = {
      fecha: new Date().toLocaleDateString('es-MX'),
      hora: new Date().toLocaleTimeString('es-MX'),
      cantidad_ventas: ventas.length,
      total_ventas: Math.round(totalVentas),
      total_costos: Math.round(totalCostos),
      utilidad: Math.round(totalVentas - totalCostos),
      margen: Math.round((totalVentas - totalCostos) / totalVentas * 100),
      pagos
    }

    await db.cierres.add(cierre)
    setCierres([...cierres, cierre])

    // Limpiar ventas del día
    await db.ventas.where('fecha').equals(new Date().toLocaleDateString()).delete()
    setVentas([])
    setResumen({ cantidad_ventas: 0, total_ventas: 0, total_costos: 0, utilidad: 0, margen: 0 })
  }

  const descargarReporte = () => {
    let contenido = `PIZZERÍA PRO - REPORTE DEL DÍA\n${new Date().toLocaleDateString('es-MX')}\n\n`
    contenido += `VENTAS REGISTRADAS:\n`

    ventas.forEach(v => {
      const prod = productos.find(p => p.id === v.productoId)
      const emp = empleados.find(e => e.id === v.empleadoId)
      const total = v.precio_venta * v.cantidad
      contenido += `${prod.nombre} x${v.cantidad} - $${total} (${emp.nombre} - ${v.metodo_pago})\n`
    })

    contenido += `\nRESUMEN:\n`
    contenido += `Ventas totales: $${resumen.total_ventas}\n`
    contenido += `Costos: $${resumen.total_costos}\n`
    contenido += `Utilidad: $${resumen.utilidad}\n`
    contenido += `Margen: ${resumen.margen}%\n`

    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `reporte-${Date.now()}.txt`
    link.click()
  }

  const obtenerVentasPorProducto = () => {
    const map = {}
    ventas.forEach(v => {
      if (!map[v.productoId]) {
        map[v.productoId] = { cantidad: 0, ventas: 0 }
      }
      map[v.productoId].cantidad += v.cantidad
      map[v.productoId].ventas += v.precio_venta * v.cantidad
    })
    return Object.keys(map).map(pId => {
      const prod = productos.find(p => p.id === parseInt(pId))
      return { nombre: prod.nombre, cantidad: map[pId].cantidad, ventas: map[pId].ventas }
    })
  }

  const obtenerVentasPorMetodo = () => {
    const map = { efectivo: 0, tarjeta: 0, transferencia: 0 }
    ventas.forEach(v => {
      if (map.hasOwnProperty(v.metodo_pago)) {
        map[v.metodo_pago] += v.precio_venta * v.cantidad
      }
    })
    return map
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🍕 Pizzería Pro</h1>
        <p>Sistema profesional de POS</p>
      </header>

      <nav className="nav">
        {['ventas', 'empleados', 'inventario', 'reportes', 'cierres'].map(tab => (
          <button
            key={tab}
            className={`nav-btn ${vista === tab ? 'active' : ''}`}
            onClick={() => setVista(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      <main className="main">
        {vista === 'ventas' && (
          <div className="container">
            <div className="card">
              <h2>Registrar venta</h2>
              <div className="form-grid">
                <div>
                  <label>Producto</label>
                  <select
                    value={nuevaVenta.productoId}
                    onChange={e => setNuevaVenta({ ...nuevaVenta, productoId: parseInt(e.target.value) })}
                  >
                    {productos.map(p => {
                      const precio = calcularPrecio(calcularCostoProducto(p.id), p.margen)
                      return <option key={p.id} value={p.id}>{p.nombre} - ${precio}</option>
                    })}
                  </select>
                </div>
                <div>
                  <label>Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={nuevaVenta.cantidad}
                    onChange={e => setNuevaVenta({ ...nuevaVenta, cantidad: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <label>Empleado</label>
                  <select
                    value={nuevaVenta.empleadoId}
                    onChange={e => setNuevaVenta({ ...nuevaVenta, empleadoId: parseInt(e.target.value) })}
                  >
                    {empleados.map(e => (
                      <option key={e.id} value={e.id}>{e.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Método de pago</label>
                  <select
                    value={nuevaVenta.metodo_pago}
                    onChange={e => setNuevaVenta({ ...nuevaVenta, metodo_pago: e.target.value })}
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                </div>
              </div>
              <button className="btn-primary" onClick={agregarVenta}>Registrar venta</button>
            </div>

            <div className="card">
              <h2>Ventas del día ({ventas.length})</h2>
              <div className="ventas-list">
                {ventas.length === 0 ? (
                  <p className="empty">Sin ventas registradas</p>
                ) : (
                  ventas.map((v, i) => {
                    const prod = productos.find(p => p.id === v.productoId)
                    const emp = empleados.find(e => e.id === v.empleadoId)
                    const total = v.precio_venta * v.cantidad
                    return (
                      <div key={i} className="venta-item">
                        <div>
                          <strong>{prod.nombre}</strong> x{v.cantidad}
                          <p className="small">{emp.nombre} • {v.metodo_pago}</p>
                        </div>
                        <span className="precio">${total}</span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {ventas.length > 0 && (
              <div className="actions">
                <button className="btn-success" onClick={cerrarCaja}>Cerrar caja del día</button>
                <button className="btn-warning" onClick={descargarReporte}>Descargar reporte</button>
              </div>
            )}
          </div>
        )}

        {vista === 'empleados' && (
          <div className="container">
            <div className="card">
              <h2>Agregar empleado</h2>
              <div className="form-grid">
                <input
                  type="text"
                  placeholder="Nombre"
                  value={nuevoEmpleado.nombre}
                  onChange={e => setNuevoEmpleado({ ...nuevoEmpleado, nombre: e.target.value })}
                />
                <select
                  value={nuevoEmpleado.turno}
                  onChange={e => setNuevoEmpleado({ ...nuevoEmpleado, turno: e.target.value })}
                >
                  <option>Mañana</option>
                  <option>Tarde</option>
                  <option>Noche</option>
                </select>
              </div>
              <button className="btn-primary" onClick={agregarEmpleado}>Agregar</button>
            </div>

            <div className="card">
              <h2>Equipo ({empleados.length})</h2>
              <div className="list">
                {empleados.map(e => (
                  <div key={e.id} className="list-item">
                    <div>
                      <strong>{e.nombre}</strong>
                      <p className="small">Turno: {e.turno}</p>
                    </div>
                    <span className="badge">{e.estado}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {vista === 'inventario' && (
          <div className="container">
            <div className="card">
              <h2>Inventario ({inventario.length})</h2>
              <div className="list">
                {inventario.map(ing => (
                  <div key={ing.id} className="list-item">
                    <div>
                      <strong>{ing.nombre}</strong>
                      <p className="small">{ing.cantidad} {ing.unidad}</p>
                    </div>
                    <span className={ing.cantidad < 5 ? 'badge danger' : 'badge'}>
                      ${ing.costo_unitario}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {vista === 'reportes' && (
          <div className="container">
            <div className="kpi-grid">
              <div className="kpi">
                <label>Ventas totales</label>
                <strong>${resumen.total_ventas || 0}</strong>
              </div>
              <div className="kpi">
                <label>Costos</label>
                <strong>${resumen.total_costos || 0}</strong>
              </div>
              <div className="kpi">
                <label>Utilidad</label>
                <strong>${resumen.utilidad || 0}</strong>
              </div>
              <div className="kpi">
                <label>Margen</label>
                <strong>{resumen.margen || 0}%</strong>
              </div>
            </div>

            <div className="card">
              <h2>Ventas por producto</h2>
              <div className="list">
                {obtenerVentasPorProducto().map((vp, i) => (
                  <div key={i} className="list-item">
                    <div>
                      <strong>{vp.nombre}</strong>
                      <p className="small">{vp.cantidad} unidades</p>
                    </div>
                    <span>${vp.ventas}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2>Métodos de pago</h2>
              <div className="list">
                {Object.entries(obtenerVentasPorMetodo()).map(([metodo, monto]) => (
                  <div key={metodo} className="list-item">
                    <strong className="capitalize">{metodo}</strong>
                    <span>${monto}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {vista === 'cierres' && (
          <div className="container">
            <div className="card">
              <h2>Historial de cierres ({cierres.length})</h2>
              <div className="list">
                {cierres.length === 0 ? (
                  <p className="empty">Sin cierres registrados</p>
                ) : (
                  [...cierres].reverse().map((c, i) => (
                    <div key={i} className="list-item column">
                      <div>
                        <strong>{c.fecha}</strong>
                        <p className="small">{c.hora}</p>
                      </div>
                      <div className="cierre-info">
                        <span>${c.total_ventas} ventas</span>
                        <span className="badge success">+${c.utilidad}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Pizzería Pro © 2024 - Sistema de POS</p>
      </footer>
    </div>
  )
}
