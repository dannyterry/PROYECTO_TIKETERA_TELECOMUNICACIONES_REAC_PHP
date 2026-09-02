const pool = require('./db.js');

async function checkForeignKeys() {
  const [stock] = await pool.query("SELECT COUNT(*) as c FROM stock");
  const [tp] = await pool.query("SELECT COUNT(*) as c FROM trabajador_productos");
  const [ts] = await pool.query("SELECT COUNT(*) as c FROM trabajador_series");
  const [ps] = await pool.query("SELECT COUNT(*) as c FROM producto_series");
  const [dc] = await pool.query("SELECT COUNT(*) as c FROM detalle_compras");
  const [mov] = await pool.query("SELECT COUNT(*) as c FROM movimientos");
  const [oer] = await pool.query("SELECT COUNT(*) as c FROM orden_equipos_retirados");

  console.log({
    stock: stock[0].c,
    trabajador_productos: tp[0].c,
    trabajador_series: ts[0].c,
    producto_series: ps[0].c,
    detalle_compras: dc[0].c,
    movimientos: mov[0].c,
    orden_equipos_retirados: oer[0].c
  });

  process.exit(0);
}

checkForeignKeys().catch(console.error);
