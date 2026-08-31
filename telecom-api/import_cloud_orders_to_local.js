const fs = require('fs');
const readline = require('readline');
const db = require('./db');

async function importCloudOrders() {
  console.log('🔄 Limpiando tabla ordenes local para sincronizar con la nube...');
  await db.query("SET FOREIGN_KEY_CHECKS = 0");
  await db.query("TRUNCATE TABLE ordenes");
  await db.query("SET FOREIGN_KEY_CHECKS = 1");

  console.log('📥 Leyendo e insertando órdenes desde base_de_nube_28_08_2026.sql...');

  const fileStream = fs.createReadStream('d:/proyecrh/base_de_nube_28_08_2026.sql');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let inOrdenes = false;
  let sqlBuffer = '';
  let count = 0;

  for await (const line of rl) {
    if (line.startsWith('INSERT INTO `ordenes`')) {
      inOrdenes = true;
      sqlBuffer = line;
      if (line.trim().endsWith(';')) {
        await db.query(sqlBuffer);
        count++;
        inOrdenes = false;
        sqlBuffer = '';
      }
    } else if (inOrdenes) {
      sqlBuffer += '\n' + line;
      if (line.trim().endsWith(';')) {
        await db.query(sqlBuffer);
        count++;
        inOrdenes = false;
        sqlBuffer = '';
      }
    }
  }

  const [totalRes] = await db.query("SELECT COUNT(*) as total FROM ordenes");
  const [obsCount] = await db.query("SELECT COUNT(*) as total FROM ordenes WHERE observacion_llamada IS NOT NULL AND observacion_llamada != ''");
  const [inconcertCount] = await db.query("SELECT COUNT(*) as total FROM ordenes WHERE llamada_inconcert = 'Si'");

  console.log(`✅ ¡Sincronización completada! ${count} bloques de INSERT ejecutados.`);
  console.log(`📊 Total de órdenes en base local: ${totalRes[0].total}`);
  console.log(`📞 Órdenes con llamada Inconcert 'Si': ${inconcertCount[0].total}`);
  console.log(`📝 Órdenes con observaciones de llamada llenadas por gestión: ${obsCount[0].total}`);
  process.exit(0);
}

importCloudOrders().catch(err => {
  console.error('Error importando órdenes de la nube:', err);
  process.exit(1);
});
