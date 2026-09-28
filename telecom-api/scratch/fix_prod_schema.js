const mysql = require('mysql2/promise');

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  dateStrings: true,
  connectTimeout: 60000
};

async function fixProdSchema() {
  const conn = await mysql.createConnection(REMOTE_CONFIG);
  try {
    const [cols] = await conn.query('DESCRIBE supervision_campo');
    const fields = cols.map(c => c.Field);
    console.log('Columnas actuales en Producción:', fields.join(', '));

    if (!fields.includes('estado_operativo')) {
      console.log('+ Agregando columna estado_operativo con enum completo...');
      await conn.query("ALTER TABLE supervision_campo ADD COLUMN estado_operativo enum('EN_CAMINO','INICIADA','FINALIZADA','CANCELADA') DEFAULT 'INICIADA'");
      console.log('✅ Columna estado_operativo creada exitosamente.');
    } else {
      console.log('⚙️ Modificando columna estado_operativo...');
      await conn.query("ALTER TABLE supervision_campo MODIFY COLUMN estado_operativo enum('EN_CAMINO','INICIADA','FINALIZADA','CANCELADA') DEFAULT 'INICIADA'");
      console.log('✅ Columna estado_operativo modificada exitosamente.');
    }

    try {
      await conn.query("ALTER TABLE supervision_campo ADD INDEX idx_sup_estado_fecha (supervisor, estado_operativo, fecha)");
      console.log('✅ Índice idx_sup_estado_fecha creado.');
    } catch (e) {
      console.log('✓ Índice idx_sup_estado_fecha ya existía o OK.');
    }

    console.log('🎉 ¡PRODUCCIÓN TOTALMENTE SINCRONIZADA Y LISTA!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await conn.end();
    process.exit(0);
  }
}

fixProdSchema();
