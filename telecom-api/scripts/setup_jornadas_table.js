const db = require('../db');

async function setupJornadaTable() {
  console.log("🛠️ Creando tabla 'control_jornadas_personal' si no existe...");
  await db.query(`
    CREATE TABLE IF NOT EXISTS control_jornadas_personal (
      id_jornada INT AUTO_INCREMENT PRIMARY KEY,
      id_usuario INT NOT NULL,
      fecha DATE NOT NULL,
      hora_primer_ingreso TIME NOT NULL,
      hora_ultimo_acceso TIME NOT NULL,
      minutos_totales INT DEFAULT 1,
      intervalos_actividad JSON NULL,
      ultima_accion VARCHAR(255) NULL,
      ip_address VARCHAR(50) NULL,
      dispositivo VARCHAR(255) NULL,
      fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_usuario_fecha (id_usuario, fecha),
      KEY idx_fecha (fecha),
      KEY idx_usuario (id_usuario)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log("✅ Tabla 'control_jornadas_personal' lista.");

  // Backfill desde auditoria_actividad para poblar historial existente
  console.log("🔄 Verificando e importando datos históricos desde auditoria_actividad...");
  const [logs] = await db.query(`
    SELECT 
      id_usuario,
      DATE(fecha_creacion) as fecha,
      TIME(MIN(fecha_creacion)) as primer_ingreso,
      TIME(MAX(fecha_creacion)) as ultimo_acceso,
      TIMESTAMPDIFF(MINUTE, MIN(fecha_creacion), MAX(fecha_creacion)) as diff_minutos,
      COUNT(*) as total_acciones,
      SUBSTRING_INDEX(GROUP_CONCAT(descripcion ORDER BY fecha_creacion DESC SEPARATOR '||'), '||', 1) as ultima_accion
    FROM auditoria_actividad
    WHERE id_usuario IS NOT NULL AND id_usuario > 0
    GROUP BY id_usuario, DATE(fecha_creacion)
  `);

  console.log(`📊 Encontrados ${logs.length} registros agrupados en auditoria_actividad.`);

  for (const l of logs) {
    const minutos = Math.max(15, l.diff_minutos || 15);
    const horaIniStr = l.primer_ingreso ? l.primer_ingreso.substring(0, 5) : '08:00';
    const horaFinStr = l.ultimo_acceso ? l.ultimo_acceso.substring(0, 5) : '08:15';

    const intervaloInicial = JSON.stringify([
      { inicio: horaIniStr, fin: horaFinStr, minutos }
    ]);

    await db.query(`
      INSERT INTO control_jornadas_personal (
        id_usuario, fecha, hora_primer_ingreso, hora_ultimo_acceso, minutos_totales, intervalos_actividad, ultima_accion
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        hora_primer_ingreso = LEAST(hora_primer_ingreso, VALUES(hora_primer_ingreso)),
        hora_ultimo_acceso = GREATEST(hora_ultimo_acceso, VALUES(hora_ultimo_acceso)),
        minutos_totales = GREATEST(minutos_totales, VALUES(minutos_totales)),
        ultima_accion = COALESCE(VALUES(ultima_accion), ultima_accion)
    `, [
      l.id_usuario,
      l.fecha,
      l.primer_ingreso,
      l.ultimo_acceso,
      minutos,
      intervaloInicial,
      l.ultima_accion ? l.ultima_accion.slice(0, 250) : 'Actividad registrada'
    ]);
  }

  // También sincronizar los usuarios que tienen ultimo_acceso hoy
  console.log("🔄 Sincronizando usuarios con último acceso registrado...");
  const [activeUsers] = await db.query(`
    SELECT id_usuario, DATE(ultimo_acceso) as fecha, TIME(ultimo_acceso) as hora, ultima_accion, ip_conexion
    FROM usuarios
    WHERE ultimo_acceso IS NOT NULL AND (id_rol != 2 OR id_rol IS NULL)
  `);

  for (const u of activeUsers) {
    if (!u.fecha || !u.hora) continue;
    const horaStr = u.hora.substring(0, 5);
    const intervalo = JSON.stringify([{ inicio: horaStr, fin: horaStr, minutos: 10 }]);

    await db.query(`
      INSERT INTO control_jornadas_personal (
        id_usuario, fecha, hora_primer_ingreso, hora_ultimo_acceso, minutos_totales, intervalos_actividad, ultima_accion, ip_address
      ) VALUES (?, ?, ?, ?, 10, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        hora_primer_ingreso = LEAST(hora_primer_ingreso, VALUES(hora_primer_ingreso)),
        hora_ultimo_acceso = GREATEST(hora_ultimo_acceso, VALUES(hora_ultimo_acceso)),
        ultima_accion = COALESCE(VALUES(ultima_accion), ultima_accion),
        ip_address = COALESCE(VALUES(ip_address), ip_address)
    `, [
      u.id_usuario,
      u.fecha,
      u.hora,
      u.hora,
      intervalo,
      u.ultima_accion || 'Acceso al sistema',
      u.ip_conexion || null
    ]);
  }

  console.log("✨ Proceso completado con éxito.");
  process.exit(0);
}

setupJornadaTable().catch((err) => {
  console.error("❌ Error configurando tabla de jornada:", err);
  process.exit(1);
});
