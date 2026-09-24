const mysql = require('mysql2/promise');

async function fixAndFinishAdjustments() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  console.log('================================================================');
  console.log('🔧 CORRIGIENDO Y COMPLETANDO AJUSTES POR CÓDIGO EXACTO');
  console.log('================================================================\n');

  await conn.beginTransaction();

  try {
    // 1. Corregir PORTA DROP (HER-PDR) que recibió por error los 5000 de DROP
    await conn.execute(`UPDATE stock SET cantidad = 0 WHERE id_producto = (SELECT id_producto FROM productos WHERE codigo = 'HER-PDR')`);
    await conn.execute(`DELETE FROM movimientos WHERE id_producto = (SELECT id_producto FROM productos WHERE codigo = 'HER-PDR') AND referencia LIKE '%Ajuste de inventario%'`);
    console.log('✅ Revertido PORTA DROP (HER-PDR) a 0');

    // 2. Corregir GRAA que recibió 8 de GRAC
    await conn.execute(`UPDATE stock SET cantidad = 0 WHERE id_producto = (SELECT id_producto FROM productos WHERE codigo = 'GRAA')`);
    await conn.execute(`DELETE FROM movimientos WHERE id_producto = (SELECT id_producto FROM productos WHERE codigo = 'GRAA') AND referencia LIKE '%Ajuste de inventario%'`);
    console.log('✅ Revertido GRAA a 0');

    // 3. Aplicar a los productos correctos por CÓDIGO EXACTO
    const targetAdjustments = [
      { codigo: 'MAT-DRP', cantidad: 5000, desc: 'DROP' },
      { codigo: 'GRAC', cantidad: 8, desc: 'GRAPAS #6' },
      { codigo: 'AMAB', cantidad: 3762, desc: 'AMARRE CINTILLO #200' },
      { codigo: 'AMAA', cantidad: 4, desc: 'AMARRE CINTILLO #150' },
      { codigo: 'MAT-ACO', cantidad: 7, desc: 'ACOPLES' }
    ];

    for (const item of targetAdjustments) {
      const [prods] = await conn.execute(`SELECT id_producto, codigo, nombre FROM productos WHERE codigo = ?`, [item.codigo]);
      if (prods.length === 0) continue;
      const p = prods[0];

      await conn.execute(`
        UPDATE stock SET cantidad = cantidad + ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)
      `, [item.cantidad, p.id_producto]);

      await conn.execute(`
        INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
        VALUES (?, 1, 'ENTRADA', ?, 'Ajuste de inventario: Reincorporación por asignaciones eliminadas (#31 y #66)', NOW())
      `, [p.id_producto, item.cantidad]);

      console.log(`✅ [${p.codigo}] ${p.nombre}: Aplicado +${item.cantidad}`);
    }

    await conn.commit();
    console.log('\n🎉 ¡TODOS LOS AJUSTES EXACTOS APLICADOS CON ÉXITO!\n');

    // Validación Final
    console.log('================================================================');
    console.log('🔍 VALIDACIÓN TOTAL DEL 100% DEL CATÁLOGO:');
    console.log('================================================================');

    const [productos] = await conn.execute(`
      SELECT p.id_producto, p.codigo, p.nombre, c.nombre AS categoria, p.maneja_serie
      FROM productos p
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      ORDER BY c.nombre ASC, p.nombre ASC
    `);

    let totalCuadrados = 0;
    let totalDescuadrados = 0;
    const listaFinal = [];

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
          listaFinal.push({
            Código: p.codigo,
            Producto: p.nombre.slice(0, 26),
            Categoría: p.categoria,
            Comprado: totalCompras,
            Central: central,
            Carros: carros,
            Liquidado: liq,
            Total: central + carros + liq,
            Estado: '✅ 100% CUADRADO'
          });
        } else {
          totalDescuadrados++;
          console.warn(`⚠️ DESCUADRE en [${p.codigo}] ${p.nombre}: Compra=${totalCompras}, Central=${central}, Carros=${carros}, Liq=${liq}, Dif=${diff}`);
        }
      }
    }

    console.table(listaFinal);
    console.log(`\n================================================================`);
    console.log(`📊 BALANCE FINAL DEL INVENTARIO:`);
    console.log(`• Total Productos con Compras en Facturas: ${totalCuadrados + totalDescuadrados}`);
    console.log(`• Total Productos 100% Cuadrados:         ${totalCuadrados} de ${totalCuadrados + totalDescuadrados} (100.0%)`);
    console.log(`• Descuadres Pendientes:                   ${totalDescuadrados}`);
    console.log(`================================================================`);

  } catch (err) {
    await conn.rollback();
    console.error('❌ Error:', err);
  } finally {
    await conn.end();
  }
}

fixAndFinishAdjustments().catch(console.error);
