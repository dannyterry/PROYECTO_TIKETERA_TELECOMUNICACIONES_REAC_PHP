const mysql = require('mysql2/promise');

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  dateStrings: true,
};

(async () => {
  try {
    const conn = await mysql.createConnection(REMOTE_CONFIG);
    console.log("Conectado a BD Producción...");

    // 1. Corregir inspección 9 (2026-09-29): Asignar el fin real del día de ayer
    await conn.query(`
      UPDATE vehiculo_inspecciones
      SET km_fin = 113363,
          hora_fin = '19:15:17',
          foto_tablero_fin = '1790727317744.jpg',
          km_recorridos = (113363 - km_inicio),
          diferencia_km = 0,
          estado_auditoria = 'Pendiente'
      WHERE id_inspeccion = 9
    `);
    console.log("✅ Inspección ID 9 (2026-09-29) actualizada con su cierre y foto correcta.");

    // 2. Limpiar inspección 10 (2026-09-30): Dejar solo el inicio de hoy
    await conn.query(`
      UPDATE vehiculo_inspecciones
      SET km_fin = NULL,
          hora_fin = NULL,
          foto_tablero_fin = NULL,
          km_recorridos = NULL,
          diferencia_km = 0,
          estado_auditoria = 'Pendiente'
      WHERE id_inspeccion = 10
    `);
    console.log("✅ Inspección ID 10 (2026-09-30) limpiada (pendiente de cierre de hoy).");

    // Verificar resultado
    const [rows] = await conn.query(`
      SELECT id_inspeccion, fecha, km_inicio, km_fin, hora_inicio, hora_fin, 
             foto_tablero_inicio, foto_tablero_fin, km_recorridos, estado_auditoria
      FROM vehiculo_inspecciones 
      WHERE id_inspeccion IN (9, 10)
      ORDER BY id_inspeccion ASC
    `);
    console.log("\nESTADO FINAL:", JSON.stringify(rows, null, 2));

    await conn.end();
  } catch (err) {
    console.error("Error al actualizar:", err);
  }
})();
