const mysql = require('d:/proyectofinal/telecom-api/node_modules/mysql2/promise');

const prodConfig = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
};

async function fixProductionDiscrepancies() {
  const conn = await mysql.createConnection(prodConfig);
  try {
    console.log("Corrigiendo las 3 órdenes en Producción...");

    // 1. OT 3416734 (Silvia Estrada) -> KLINDER WALTER PANIURA RAMIREZ (id 75)
    await conn.query(`
      UPDATE ordenes 
      SET 
        estado = 'Finalizada',
        tecnico_asignado = 'KLINDER WALTER PANIURA RAMIREZ',
        id_tecnico = 75,
        usuario_ejecutor_fenix = 'KLINDER WALTER PANIURA RAMIREZ'
      WHERE numero = '3416734'
    `);
    console.log("✅ OT 3416734 actualizada a KLINDER WALTER PANIURA RAMIREZ");

    // 2. OT 3416446 (Armando Pena) -> SAITH ABRAHAM ILIZARBE BERROCAL (id 106)
    await conn.query(`
      UPDATE ordenes 
      SET 
        estado = 'Finalizada',
        tecnico_asignado = 'SAITH ABRAHAM ILIZARBE BERROCAL',
        id_tecnico = 106,
        usuario_ejecutor_fenix = 'SAITH ABRAHAM ILIZARBE BERROCAL'
      WHERE numero = '3416446'
    `);
    console.log("✅ OT 3416446 actualizada a SAITH ABRAHAM ILIZARBE BERROCAL");

    // 3. OT 3417904 (Carlos Alberto Bruno) -> BRAYAN JESUS CANELON GONZALES (id 67)
    await conn.query(`
      UPDATE ordenes 
      SET 
        estado = 'Finalizada',
        tecnico_asignado = 'BRAYAN JESUS CANELON GONZALES',
        id_tecnico = 67,
        usuario_ejecutor_fenix = 'BRAYAN JESUS CANELON GONZALES'
      WHERE numero = '3417904'
    `);
    console.log("✅ OT 3417904 actualizada a BRAYAN JESUS CANELON GONZALES");

    // Verificar en Producción
    const [rows] = await conn.query(`
      SELECT numero, cliente, tecnico_asignado, id_tecnico, estado, usuario_ejecutor_fenix 
      FROM ordenes 
      WHERE numero IN ('3416734', '3416446', '3417904')
    `);
    console.log("\nEstado final en Producción:");
    console.table(rows);

  } catch(e) {
    console.error(e);
  } finally {
    await conn.end();
  }
}

fixProductionDiscrepancies();
