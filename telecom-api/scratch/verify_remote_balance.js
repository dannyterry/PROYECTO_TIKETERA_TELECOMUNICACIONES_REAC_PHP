const mysql = require('mysql2/promise');

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  dateStrings: true,
  connectTimeout: 60000
};

async function verifyRemoteBalance() {
  const conn = await mysql.createConnection(REMOTE_CONFIG);

  console.log('================================================================');
  console.log('🔍 VALIDACIÓN EN VIVO DE BASE DE DATOS DE PRODUCCIÓN:');
  console.log('================================================================\n');

  const targetCodes = [
    'MAT-TEM', 'MAT-DRP', 'MAT-HEB', 'CONA', 'MAT-ANC', 'MAT-BAN',
    'MAT-CLE', 'MAT-PCO', 'MAT-ACO', 'MAT-ROS', 'MAT-DCO', 'AMAA',
    'MAT-ROT', 'GRAC', 'MAT-PCA'
  ];

  const report = [];

  for (const code of targetCodes) {
    const [prods] = await conn.execute(`
      SELECT p.id_producto, p.codigo, p.nombre,
        (SELECT COALESCE(SUM(dc.cantidad),0) FROM detalle_compras dc JOIN compras c ON dc.id_compra = c.id_compra WHERE dc.id_producto = p.id_producto AND c.estado != 'ANULADA') as compras_activas,
        (SELECT COALESCE(SUM(cantidad),0) FROM stock WHERE id_producto = p.id_producto AND (id_almacen = 1 OR id_almacen IS NULL)) as central,
        (SELECT COALESCE(SUM(stock),0) FROM trabajador_productos WHERE id_producto = p.id_producto) as carros,
        (SELECT COALESCE(SUM(cantidad),0) FROM orden_liquidacion_detalle WHERE id_producto = p.id_producto) as liquidado
      FROM productos p
      WHERE p.codigo = ?
    `, [code]);

    if (prods.length > 0) {
      const p = prods[0];
      const compras = Number(p.compras_activas);
      const central = Number(p.central);
      const carros = Number(p.carros);
      const liq = Number(p.liquidado);
      const totalContabilizado = central + carros + liq;
      const diff = compras - totalContabilizado;

      report.push({
        Código: p.codigo,
        Producto: p.nombre,
        'Compras Activas': compras,
        'Stock Central': central,
        'En Carros': carros,
        'Liquidado': liq,
        'Total Empresa + Liq': totalContabilizado,
        'Diferencia': diff,
        'Estado': diff === 0 ? '✅ 100% CUADRADO' : `⚠️ DIF (${diff})`
      });
    }
  }

  console.table(report);

  await conn.end();
}

verifyRemoteBalance().catch(console.error);
