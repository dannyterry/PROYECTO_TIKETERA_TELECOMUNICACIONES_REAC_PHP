const mysql = require('mysql2/promise');

const localConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'corporacioncespe_cespedes',
  connectTimeout: 10000
};

const remoteConfig = {
  host: 'corporacioncespedes.com',
  port: 3306,
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  connectTimeout: 15000
};

async function checkSchemaDetailed() {
  const localPool = mysql.createPool(localConfig);
  const remotePool = mysql.createPool(remoteConfig);

  const [localTables] = await localPool.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const [remoteTables] = await remotePool.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");

  const localTableNames = localTables.map(t => Object.values(t)[0]);
  const remoteTableNames = remoteTables.map(t => Object.values(t)[0]);

  console.log("=== 1. TABLAS FALTANTES EN HOSTING ===");
  const missingTables = localTableNames.filter(t => !remoteTableNames.includes(t));
  console.log(missingTables.length === 0 ? "✅ Ninguna tabla falta en Hosting." : missingTables);

  console.log("\n=== 2. COLUMNAS FALTANTES EN HOSTING ===");
  let missingColsCount = 0;
  for (const table of localTableNames) {
    if (!remoteTableNames.includes(table)) continue;
    const [lCols] = await localPool.query(`SHOW COLUMNS FROM \`${table}\``);
    const [rCols] = await remotePool.query(`SHOW COLUMNS FROM \`${table}\``);
    const rColNames = new Set(rCols.map(c => c.Field.toLowerCase()));

    for (const lCol of lCols) {
      if (!rColNames.has(lCol.Field.toLowerCase())) {
        console.log(`⚠️ Tabla [${table}] -> Falta columna en hosting: ${lCol.Field} (${lCol.Type})`);
        missingColsCount++;
      }
    }
  }
  if (missingColsCount === 0) {
    console.log("✅ Ninguna columna falta en ninguna tabla de Hosting.");
  }

  console.log("\n=== 3. COMPARAR TABLA MOTIVOS (Local vs Hosting) ===");
  const [lMotivos] = await localPool.query("SELECT COUNT(*) as count FROM motivos");
  const [rMotivos] = await remotePool.query("SELECT COUNT(*) as count FROM motivos");
  console.log(`Local motivos: ${lMotivos[0].count} | Hosting motivos: ${rMotivos[0].count}`);

  // Revisar si hay motivos con tipo_trabajo en local que difieren en hosting
  const [diffMotivos] = await localPool.query(`
    SELECT m.nombre, m.tipo_trabajo as local_tipo, r.tipo_trabajo as remote_tipo
    FROM motivos m
    LEFT JOIN (SELECT * FROM motivos) r ON m.id_motivo = r.id_motivo
  `);

  console.log("\n=== 4. REVISAR DISCREPANCIAS DE 'tipo_trabajo' EN ORDENES DE HOSTING ===");
  // Revisar si en hosting alguna orden tiene un tipo_trabajo que no cuadra con la tabla motivos
  const { getMotivosCatalogo, resolverTipoTrabajoConCatalogo } = require('../services/tipoTrabajoHelper');
  const catalogoMotivos = await getMotivosCatalogo(remotePool);
  console.log(`Motivos cargados en Hosting: ${catalogoMotivos.length}`);

  const [remoteOrders] = await remotePool.query(
    "SELECT id_orden, numero, motivo_finalizacion, motivo_trabajo, tipo_trabajo, estado FROM ordenes WHERE estado LIKE '%finaliz%' OR estado LIKE '%liquid%' OR estado LIKE '%termin%' OR estado LIKE '%cerrad%'"
  );

  let discrepancies = 0;
  const sampleDiscrepancies = [];
  for (const ord of remoteOrders) {
    const expectedTipo = resolverTipoTrabajoConCatalogo(ord.motivo_finalizacion, ord.motivo_trabajo || ord.tipo_trabajo, ord.estado, catalogoMotivos);
    if (expectedTipo && ord.tipo_trabajo !== expectedTipo) {
      discrepancies++;
      if (sampleDiscrepancies.length < 10) {
        sampleDiscrepancies.push({
          id_orden: ord.id_orden,
          numero: ord.numero,
          motivo_finalizacion: ord.motivo_finalizacion,
          motivo_trabajo: ord.motivo_trabajo,
          tipo_actual_en_hosting: ord.tipo_trabajo,
          tipo_esperado_por_catalogo: expectedTipo
        });
      }
    }
  }

  console.log(`Total órdenes finalizadas analizadas en Hosting: ${remoteOrders.length}`);
  console.log(`Órdenes con discrepancia en tipo_trabajo: ${discrepancies}`);
  if (sampleDiscrepancies.length > 0) {
    console.log("Muestra de discrepancias encontradas en Hosting:");
    console.table(sampleDiscrepancies);
  } else {
    console.log("✅ Todas las órdenes finalizadas en Hosting tienen exactamente el tipo_trabajo correcto según el catálogo oficial.");
  }

  await localPool.end();
  await remotePool.end();
}

checkSchemaDetailed().catch(console.error);
