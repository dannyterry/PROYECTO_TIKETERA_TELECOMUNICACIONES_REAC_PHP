const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [prods] = await conn.execute(`
    SELECT p.id_producto, p.codigo, p.nombre, p.maneja_serie, c.nombre as categoria
    FROM productos p
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
    ORDER BY c.nombre, p.nombre
  `);

  const diffs = [];
  for (const p of prods) {
    const [c] = await conn.execute('SELECT COALESCE(SUM(cantidad),0) as val FROM detalle_compras WHERE id_producto = ?', [p.id_producto]);
    const compras = Number(c[0].val);

    let central = 0;
    if (p.maneja_serie) {
      const [s] = await conn.execute("SELECT COUNT(*) as val FROM producto_series WHERE id_producto = ? AND estado = 'DISPONIBLE'", [p.id_producto]);
      central = Number(s[0].val);
    } else {
      const [s] = await conn.execute('SELECT COALESCE(SUM(cantidad),0) as val FROM stock WHERE id_producto = ?', [p.id_producto]);
      central = Number(s[0].val);
    }

    let carros = 0;
    if (p.maneja_serie) {
      const [s] = await conn.execute("SELECT COUNT(*) as val FROM trabajador_series WHERE id_producto = ? AND estado = 'Asignada'", [p.id_producto]);
      carros = Number(s[0].val);
    } else {
      const [s] = await conn.execute('SELECT COALESCE(SUM(stock),0) as val FROM trabajador_productos WHERE id_producto = ?', [p.id_producto]);
      carros = Number(s[0].val);
    }

    let liq = 0;
    if (p.maneja_serie) {
      const [s] = await conn.execute("SELECT COUNT(*) as val FROM trabajador_series WHERE id_producto = ? AND estado IN ('Usada','Liquidada')", [p.id_producto]);
      liq = Number(s[0].val);
    } else {
      const [s] = await conn.execute('SELECT COALESCE(SUM(cantidad),0) as val FROM orden_liquidacion_detalle WHERE id_producto = ?', [p.id_producto]);
      liq = Number(s[0].val);
    }

    const totalEmpresa = central + carros;
    const diff = compras - (totalEmpresa + liq);
    if (diff !== 0 && (compras > 0 || totalEmpresa > 0 || liq > 0)) {
      diffs.push({
        id: p.id_producto,
        codigo: p.codigo,
        nombre: p.nombre,
        categoria: p.categoria,
        serial: p.maneja_serie ? 'SÍ' : 'NO',
        compras,
        central,
        carros,
        liquidado: liq,
        total_empresa: totalEmpresa,
        diferencia: diff
      });
    }
  }

  console.log(`\n=== LISTA DE PRODUCTOS CON DIFERENCIA (Compras vs Empresa+Liquidado) [Total: ${diffs.length}] ===`);
  console.table(diffs.map(d => ({
    Código: d.codigo,
    Producto: d.nombre,
    Categoría: d.categoria,
    Serial: d.serial,
    'Compras Factura': d.compras,
    'Stock Central': d.central,
    'En Carros': d.carros,
    'Liquidado Clientes': d.liquidado,
    'Diferencia (En el aire)': d.diferencia
  })));

  await conn.end();
}

main().catch(console.error);
