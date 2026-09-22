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

  // 1. BACKUP DE SEGURIDAD DE DESPACHOS
  console.log("\n📦 Creando respaldo previo de despachos...");
  const [backupDespachos] = await conn.query("SELECT * FROM despachos");
  const [backupDetalles] = await conn.query("SELECT * FROM despacho_detalles");

  const backupData = {
    fecha: new Date().toISOString(),
    despachos: backupDespachos,
    despacho_detalles: backupDetalles,
  };

  const backupFileName = `backup_prod_despachos_${Date.now()}.json`;
  const backupFilePath = path.join(__dirname, '..', backupFileName);
  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));
  console.log(`💾 Respaldo guardado en: ${backupFileName}`);
  console.log(`   - despachos: ${backupDespachos.length} registros`);
  console.log(`   - despacho_detalles: ${backupDetalles.length} registros`);

  // 2. LIMPIEZA DE DESPACHOS Y SUS DETALLES
  console.log("\n🧹 Limpiando historial oficial de despachos en Producción...");
  await conn.beginTransaction();

  try {
    const [resDetalles] = await conn.query("DELETE FROM despacho_detalles");
    console.log(`✅ Eliminados ${resDetalles.affectedRows} detalles de despacho.`);

    const [resDespachos] = await conn.query("DELETE FROM despachos");
    console.log(`✅ Eliminados ${resDespachos.affectedRows} registros de despachos.`);

    // Reiniciar AUTO_INCREMENT para que empiece desde 1 si se crean nuevos
    await conn.query("ALTER TABLE despacho_detalles AUTO_INCREMENT = 1");
    await conn.query("ALTER TABLE despachos AUTO_INCREMENT = 1");

    await conn.commit();
    console.log("\n🎉 ¡HISTORIAL DE DESPACHOS RESETEADO A 0 CON ÉXITO EN PRODUCCIÓN!");
  } catch (err) {
    await conn.rollback();
    console.error("❌ Error durante la limpieza, rollback aplicado:", err.message);
    throw err;
  }

  // 3. VERIFICACIÓN FINAL
  const [checkD] = await conn.query("SELECT COUNT(*) as c FROM despachos");
  const [checkDD] = await conn.query("SELECT COUNT(*) as c FROM despacho_detalles");

  console.log("\n📊 Verificación final en Producción:");
  console.log(` - Despachos totales: ${checkD[0].c}`);
  console.log(` - Despacho detalles totales: ${checkDD[0].c}`);

  await conn.end();
}

execute().catch(console.error);
