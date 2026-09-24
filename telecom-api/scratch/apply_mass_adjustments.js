const mysql = require('mysql2/promise');

async function applyMassAdjustments() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  console.log('================================================================');
  console.log('🚀 APLICANDO AJUSTES MASIVOS PARA CUADRAR TODO EL INVENTARIO');
  console.log('================================================================\n');

  const adjustments = [
    { codigo: 'AMAC', nombre: 'AMARRE CINTILLO #300', cantidad: 3465 },
    { codigo: 'MAT-ROT', nombre: 'ROTULADOR', cantidad: 4358 },
    { codigo: 'MAT-DRP', nombre: 'DROP', cantidad: 5000 },
    { codigo: 'MAT-HEB', nombre: 'HEBILLAS 1/2', cantidad: 60 },
    { codigo: 'CONA', nombre: 'CONECTOR WIN', cantidad: 45 },
    { codigo: 'MAT-CLE', nombre: 'CLEVIS', cantidad: 30 },
    { codigo: 'MAT-ANC', nombre: 'ANCLAJE T/P', cantidad: 30 },
    { codigo: 'MAT-BAN', nombre: 'C. BANDIX', cantidad: 30 },
    { codigo: 'MAT-PCO', nombre: 'PATCH COR', cantidad: 14 },
    { codigo: 'GRAC', nombre: 'GRAPAS #6', cantidad: 8 },
    { codigo: 'MAT-ROS', nombre: 'ROSETAS', cantidad: 7 },
    { codigo: 'MAT-DCO', nombre: 'C. DOBLE CONTACTO', cantidad: 5 },
    { codigo: 'MAT-PCA', nombre: 'PATCH COR AZUL VERDE', cantidad: 1 }
  ];

  await conn.beginTransaction();

  try {
    for (const adj of adjustments) {
      // 1. Obtener producto
      const [prods] = await conn.execute(`
        SELECT id_producto, codigo, nombre FROM productos WHERE codigo = ? OR nombre LIKE ? LIMIT 1
      `, [adj.codigo, `%${adj.nombre}%`]);

      if (prods.length === 0) {
        console.warn(`⚠️ Producto no encontrado: ${adj.codigo} - ${adj.nombre}`);
        continue;
      }

      const prod = prods[0];
      const idProd = prod.id_producto;

      // 2. Ver stock antes
      const [stockRows] = await conn.execute(`
        SELECT id_stock, cantidad FROM stock WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)
      `, [idProd]);

      let stockAntes = 0;
      if (stockRows.length > 0) {
        stockAntes = Number(stockRows[0].cantidad);
        await conn.execute(`
          UPDATE stock SET cantidad = cantidad + ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)
        `, [adj.cantidad, idProd]);
      } else {
        await conn.execute(`
          INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso)
          VALUES (?, 1, ?, 0)
        `, [idProd, adj.cantidad]);
      }

      const stockDespues = stockAntes + adj.cantidad;

      // 3. Registrar movimiento en Kardex
      await conn.execute(`
        INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
        VALUES (?, 1, 'ENTRADA', ?, 'Ajuste de inventario: Reincorporación por asignaciones eliminadas (#31 y #66)', NOW())
      `, [idProd, adj.cantidad]);

      console.log(`✅ [${prod.codigo}] ${prod.nombre}: Stock Central ${stockAntes} -> ${stockDespues} (+${adj.cantidad})`);
    }

    await conn.commit();
    console.log('\n🎉 ¡TODOS LOS AJUSTES FUERON APLICADOS CON ÉXITO EN LA BASE DE DATOS!\n');

    // Validación final
    console.log('================================================================');
    console.log('🔍 VALIDACIÓN FINAL DE TODO EL CATÁLOGO TRAS EL AJUSTE:');
    console.log('================================================================');

    const [productos] = await conn.execute(`
      SELECT p.id_producto, p.codigo, p.nombre, c.nombre AS categoria, p.maneja_serie
      FROM productos p
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      ORDER BY c.nombre ASC, p.nombre ASC
    `);

    let totalCuadrados = 0;
    let totalDescuadrados = 0;

    for (const p of productos) {
      const id = p.id_producto;

      // Compras
      const [compras] = await conn.execute(`SELECT COALESCE(SUM(cantidad), 0) AS total FROM detalle_compras WHERE id_producto = ?`, [id]);
      const totalCompras = Number(compras[0].total);

      // Stock Central
      let central = 0;
      if (p.maneja_serie === 1) {
        const [s] = await conn.execute(`SELECT COUNT(*) AS total FROM producto_series WHERE id_producto = ? AND estado = 'DISPONIBLE'`, [id]);
        central = Number(s[0].total);
      } else {
        const [s] = await conn.execute(`SELECT COALESCE(SUM(cantidad), 0) AS total FROM stock WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)`, [id]);
        central = Number(s[0].total);
      }

      // Stock Carros
      let carros = 0;
      if (p.maneja_serie === 1) {
        const [s] = await conn.execute(`SELECT COUNT(*) AS total FROM trabajador_series WHERE id_producto = ? AND estado = 'Asignada'`, [id]);
        carros = Number(s[0].total);
      } else {
        const [s] = await conn.execute(`SELECT COALESCE(SUM(stock), 0) AS total FROM trabajador_productos WHERE id_producto = ?`, [id]);
        carros = Number(s[0].total);
      }

      // Liquidado
      let liq = 0;
      if (p.maneja_serie === 1) {
        const [s] = await conn.execute(`SELECT COUNT(*) AS total FROM trabajador_series WHERE id_producto = ? AND estado IN ('Usada', 'Liquidada')`, [id]);
        liq = Number(s[0].total);
      } else {
        const [s] = await conn.execute(`SELECT COALESCE(SUM(cantidad), 0) AS total FROM orden_liquidacion_detalle WHERE id_producto = ?`, [id]);
        liq = Number(s[0].total);
      }

      if (totalCompras > 0) {
        const diff = totalCompras - (central + carros + liq);
        if (diff === 0) {
          totalCuadrados++;
        } else {
          totalDescuadrados++;
          console.warn(`⚠️ DESCUADRE en [${p.codigo}] ${p.nombre}: Compra=${totalCompras}, Central=${central}, Carros=${carros}, Liq=${liq}, Dif=${diff}`);
        }
      }
    }

    console.log(`\n📊 RESULTADO FINAL:`);
    console.log(`• Total Productos con Compras Registradas: ${totalCuadrados + totalDescuadrados}`);
    console.log(`• Productos 100% Cuadrados (Factura = Central + Carros + Liquidados): ${totalCuadrados}`);
    console.log(`• Productos con Descuadre: ${totalDescuadrados}`);

  } catch (err) {
    await conn.rollback();
    console.error('❌ Error al aplicar ajustes:', err);
  } finally {
    await conn.end();
  }
}

applyMassAdjustments().catch(console.error);
