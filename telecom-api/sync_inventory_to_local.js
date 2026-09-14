const mysql = require('mysql2/promise');

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  dateStrings: true,
  connectTimeout: 30000
};

const LOCAL_CONFIG = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'corporacioncespe_cespedes',
  dateStrings: true
};

const INVENTORY_TABLES = [
  'categorias',
  'almacenes',
  'proveedores',
  'productos',
  'producto_series',
  'compras',
  'detalle_compras',
  'inventario_almacen',
  'movimientos_inventario',
  'tecnico_materiales',
  'tecnico_series',
  'actas_tecnicos',
  'actas_series',
  'equipos_retirados',
  'devoluciones_dotacion',
  'devolucion_series',
  'motivos'
];

async function syncInventory() {
  console.log('================================================================');
  console.log('📦 SINCRONIZANDO MÓDULO DE INVENTARIO: PRODUCCIÓN ➔ LOCAL');
  console.log('================================================================\n');

  const remotePool = mysql.createPool(REMOTE_CONFIG);
  const localPool = mysql.createPool(LOCAL_CONFIG);

  try {
    await localPool.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of INVENTORY_TABLES) {
      try {
        const [remCheck] = await remotePool.query("SHOW TABLES LIKE ?", [table]);
        if (remCheck.length === 0) {
          console.log(`- ${table}: no existe en producción, omitida.`);
          continue;
        }

        const [rows] = await remotePool.query(`SELECT * FROM \`${table}\``);
        console.log(`📦 ${table.padEnd(24)}: ${String(rows.length).padStart(5)} registros en producción`);

        await localPool.query(`TRUNCATE TABLE \`${table}\``);

        if (rows.length > 0) {
          const keys = Object.keys(rows[0]);
          const cols = keys.map(k => `\`${k}\``).join(', ');
          const placeholders = keys.map(() => '?').join(', ');
          const insertSql = `INSERT INTO \`${table}\` (${cols}) VALUES (${placeholders})`;

          for (const r of rows) {
            const vals = keys.map(k => r[k]);
            await localPool.query(insertSql, vals);
          }
        }
        console.log(`   ✅ Sincronizado en local.`);
      } catch (err) {
        console.warn(`   ⚠️ Error en ${table}: ${err.message}`);
      }
    }

    await localPool.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\n================================================================');
    console.log('🎉 ¡MÓDULO DE INVENTARIO COMPLETAMENTE SINCRONIZADO EN LOCAL!');
    console.log('================================================================');
  } catch (err) {
    console.error('Error general:', err.message);
  } finally {
    await remotePool.end();
    await localPool.end();
  }
}

syncInventory();
