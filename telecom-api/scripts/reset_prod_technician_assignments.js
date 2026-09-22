const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const prodConfig = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
};

async function execute() {
  const conn = await mysql.createConnection(prodConfig);
  console.log("✅ Conectado a BD de Producción (corporacioncespedes.com)");

  // 1. BACKUP DE SEGURIDAD PREVIO
  console.log("\n📦 Creando respaldo de seguridad previo...");
  const [backupTP] = await conn.query("SELECT * FROM trabajador_productos");
  const [backupTS] = await conn.query("SELECT * FROM trabajador_series");
  const [backupPS] = await conn.query("SELECT * FROM producto_series");
  const [backupStock] = await conn.query("SELECT * FROM stock");

  const backupData = {
    fecha: new Date().toISOString(),
    trabajador_productos: backupTP,
    trabajador_series: backupTS,
    producto_series: backupPS,
    stock: backupStock,
  };

  const backupFileName = `backup_prod_asignaciones_${Date.now()}.json`;
  const backupFilePath = path.join(__dirname, '..', backupFileName);
  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));
  console.log(`💾 Respaldo guardado con éxito en: ${backupFileName}`);
  console.log(`   - trabajador_productos: ${backupTP.length} registros`);
  console.log(`   - trabajador_series: ${backupTS.length} registros`);
  console.log(`   - producto_series: ${backupPS.length} registros`);

  // 2. EJECUTAR LIMPIEZA TOTAL EN PRODUCCIÓN
  console.log("\n🧹 Iniciando reseteo total de asignaciones a técnicos...");
  await conn.beginTransaction();

  try {
    // A. Vaciar todas las asignaciones de materiales en técnicos
    const [resDelTP] = await conn.query("DELETE FROM trabajador_productos");
    console.log(`✅ [1/3] Eliminadas ${resDelTP.affectedRows} asignaciones de materiales (trabajador_productos limpiado).`);

    // B. Vaciar todas las asignaciones de series en técnicos
    const [resDelTS] = await conn.query("DELETE FROM trabajador_series");
    console.log(`✅ [2/3] Eliminadas ${resDelTS.affectedRows} asignaciones de series/equipos a técnicos (trabajador_series limpiado).`);

    // C. Restaurar todas las series de equipos para que queden disponibles en almacén central (id_almacen = 1)
    const [resUpdPS] = await conn.query(`
      UPDATE producto_series 
      SET estado = 'DISPONIBLE', id_almacen = 1 
      WHERE estado NOT IN ('BAJA', 'DEFECTUOSO', 'INSTALADO')
    `);
    console.log(`✅ [3/3] Actualizadas ${resUpdPS.affectedRows} series en almacén central como 'DISPONIBLE' (id_almacen = 1).`);

    await conn.commit();
    console.log("\n🎉 ¡TRANSACCIÓN COMPLETADA CON ÉXITO EN PRODUCCIÓN!");

  } catch (err) {
    await conn.rollback();
    console.error("❌ Error durante la ejecución, se aplicó ROLLBACK:", err.message);
    throw err;
  }

  // 3. VERIFICACIÓN POST-LIMPIEZA
  console.log("\n🔍 Verificando estado final en Producción...");
  const [checkTP] = await conn.query("SELECT COUNT(*) as c FROM trabajador_productos");
  const [checkTS] = await conn.query("SELECT COUNT(*) as c FROM trabajador_series");
  const [checkPS] = await conn.query("SELECT estado, COUNT(*) as c FROM producto_series GROUP BY estado");

  console.log("📊 Estado final:");
  console.log(` - Materiales asignados a técnicos: ${checkTP[0].c}`);
  console.log(` - Series asignadas a técnicos: ${checkTS[0].c}`);
  console.log(" - Distribución de series por estado:", checkPS);

  await conn.end();
}

execute().catch(console.error);
