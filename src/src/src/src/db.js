import Dexie from 'dexie'

export const db = new Dexie('PizzeriaPro')

db.version(1).stores({
  inventario: '++id',
  productos: '++id',
  empleados: '++id',
  ventas: '++id, fecha',
  cierres: '++id, fecha',
  clientes: '++id'
})

// Inicializar datos por defecto
export async function initializeDB() {
  const hasData = await db.inventario.count()
  
  if (hasData === 0) {
    // Inventario inicial
    await db.inventario.bulkAdd([
      { nombre: 'Masa', cantidad: 50, costo_unitario: 5, unidad: 'porción' },
      { nombre: 'Salsa', cantidad: 20, costo_unitario: 2, unidad: 'L' },
      { nombre: 'Queso', cantidad: 15, costo_unitario: 20, unidad: 'kg' },
      { nombre: 'Pepperoni', cantidad: 10, costo_unitario: 15, unidad: 'kg' },
      { nombre: 'Jamón', cantidad: 8, costo_unitario: 18, unidad: 'kg' },
      { nombre: 'Champiñones', cantidad: 12, costo_unitario: 8, unidad: 'kg' }
    ])

    // Productos
    await db.productos.bulkAdd([
      {
        nombre: 'Pizza Margarita',
        ingredientes: [
          { ingrediente_id: 1, cantidad: 1 },
          { ingrediente_id: 2, cantidad: 0.3 },
          { ingrediente_id: 3, cantidad: 0.25 }
        ],
        margen: 60,
        color: '#3266ad'
      },
      {
        nombre: 'Pizza Pepperoni',
        ingredientes: [
          { ingrediente_id: 1, cantidad: 1 },
          { ingrediente_id: 2, cantidad: 0.3 },
          { ingrediente_id: 3, cantidad: 0.25 },
          { ingrediente_id: 4, cantidad: 0.2 }
        ],
        margen: 60,
        color: '#eb6834'
      },
      {
        nombre: 'Pizza Jamón',
        ingredientes: [
          { ingrediente_id: 1, cantidad: 1 },
          { ingrediente_id: 2, cantidad: 0.3 },
          { ingrediente_id: 3, cantidad: 0.25 },
          { ingrediente_id: 5, cantidad: 0.2 }
        ],
        margen: 60,
        color: '#f59e0b'
      }
    ])

    // Empleados
    await db.empleados.bulkAdd([
      { nombre: 'Carlos', turno: 'Mañana', estado: 'activo' },
      { nombre: 'María', turno: 'Tarde', estado: 'activo' }
    ])
  }
}

// Funciones de utilidad
export async function getResumen() {
  const ventasHoy = await db.ventas.where('fecha').equals(new Date().toLocaleDateString()).toArray()
  
  let totalVentas = 0
  let totalCostos = 0

  ventasHoy.forEach(venta => {
    totalCostos += venta.costo_unitario * venta.cantidad
    totalVentas += venta.precio_venta * venta.cantidad
  })

  return {
    cantidad_ventas: ventasHoy.length,
    total_ventas: Math.round(totalVentas),
    total_costos: Math.round(totalCostos),
    utilidad: Math.round(totalVentas - totalCostos),
    margen: totalVentas > 0 ? Math.round((totalVentas - totalCostos) / totalVentas * 100) : 0
  }
}
