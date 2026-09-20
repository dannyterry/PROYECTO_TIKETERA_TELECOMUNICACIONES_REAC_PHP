const mysql = require('mysql2/promise');

const prodConfig = {
  host: 'corporacioncespedes.com',
  port: 3306,
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  connectTimeout: 30000
};

async function verify() {
  try {
    const conn = await mysql.createConnection(prodConfig);
    console.log('✅ Conectado a Producción (corporacioncespedes.com)');
    
    const [desal] = await conn.query('SELECT COUNT(*) as c FROM trabajadores WHERE id_trabajador != id_usuario');
    console.log('Trabajadores desalineados en Producción:', desal[0].c);

    const [totalT] = await conn.query('SELECT COUNT(*) as c FROM trabajadores');
    console.log('Total trabajadores en Producción:', totalT[0].c);

    const [desp] = await conn.query('SELECT d.id_despacho, d.codigo_despacho, d.id_trabajador, d.fecha_despacho, u.nombres, u.primer_apellido FROM despachos d JOIN trabajadores t ON d.id_trabajador = t.id_trabajador JOIN usuarios u ON t.id_usuario = u.id_usuario ORDER BY d.id_despacho ASC');
    console.log('Despachos en Producción actualmente:');
    console.table(desp);

    await conn.end();
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit();
  }
}

verify();
