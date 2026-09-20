const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const prodConfig = {
  host: 'corporacioncespedes.com',
  port: 3306,
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  multipleStatements: true,
  connectTimeout: 30000
};

async function applyMigrationToProduction() {
  console.log('===============================================================');
  console.log('🚀 APLICANDO MIGRACIÓN Y ALINEACIÓN DIRECTO EN PRODUCCIÓN');
  console.log('===============================================================');

  const sqlFilePath = path.join(__dirname, '..', '..', 'PAQUETES_SUBIR_HOSTING', '3_BASE_DE_DATOS_migracion_alinear_prod.sql');
  if (!fs.existsSync(sqlFilePath)) {
    throw new Error(`No se encontró el archivo SQL en ${sqlFilePath}`);
  }

  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
  console.log(`📄 Archivo SQL cargado (${(sqlContent.length / 1024).toFixed(2)} KB).`);

  let conn;
  try {
    console.log('\n📡 Conectando al servidor MySQL de Producción (corporacioncespedes.com)...');
    conn = await mysql.createConnection(prodConfig);
    console.log('✅ Conexión establecida con éxito.');

    console.log('\n⏳ Ejecutando script de migración transaccional en Producción...');
    await conn.query(sqlContent);
    console.log('✅ Sentencias ejecutadas exitosamente.');

    // Verificaciones finales en producción
    console.log('\n🔍 Verificando estado en Producción tras la migración:');
    const [desal] = await conn.query('SELECT COUNT(*) as c FROM trabajadores WHERE id_trabajador != id_usuario');
    console.log(`  - Trabajadores desalineados (debe ser 0): ${desal[0].c}`);

    const [totalT] = await conn.query('SELECT COUNT(*) as c FROM trabajadores');
    console.log(`  - Total trabajadores registrados: ${totalT[0].c}`);

    const [totalDesp] = await conn.query('SELECT COUNT(*) as c FROM despachos');
    console.log(`  - Total despachos en historial: ${totalDesp[0].c}`);

    const [totalDet] = await conn.query('SELECT COUNT(*) as c FROM despacho_detalles');
    console.log(`  - Total detalles de materiales despachados: ${totalDet[0].c}`);

    const [asist] = await conn.query('SELECT COUNT(*) as c FROM asistencias a JOIN trabajadores t ON a.id_trabajador = t.id_trabajador');
    console.log(`  - Total asistencias verificadas y vinculadas: ${asist[0].c}`);

    console.log('\n===============================================================');
    console.log('🎉 ¡MIGRACIÓN DE BASE DE DATOS EN PRODUCCIÓN APLICADA CON ÉXITO!');
    console.log('===============================================================');

  } catch (error) {
    console.error('\n❌ ERROR AL APLICAR MIGRACIÓN EN PRODUCCIÓN:', error);
  } finally {
    if (conn) await conn.end();
  }
}

applyMigrationToProduction();
