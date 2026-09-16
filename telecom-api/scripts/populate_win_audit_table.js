const pool = require('../db');
const { clasificarOrdenWin } = require('../services/winAuditEngine');

async function populateWinAuditTable() {
  try {
    console.log("==========================================================");
    console.log("   🚀 CREANDO Y POBLANDO TABLA: ordenes_auditadas_win");
    console.log("==========================================================\n");

    // 1. Crear tabla si no existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ordenes_auditadas_win (
        id_auditoria INT AUTO_INCREMENT PRIMARY KEY,
        id_orden INT NOT NULL UNIQUE,
        numero VARCHAR(50),
        codigo_seguimiento VARCHAR(100),
        cliente VARCHAR(255),
        fecha_visita DATETIME,
        anio INT,
        mes INT,
        cuadrilla VARCHAR(100),
        tipo_trabajo_original VARCHAR(150),
        tipo_trabajo_asignado VARCHAR(150),
        motivo_finalizacion VARCHAR(150),
        producto VARCHAR(150),
        estado_original VARCHAR(100),
        categoria_win ENUM('AVERIAS', 'POSTVENTA', 'PEXT_EXCLUIDO', 'ORDENAMIENTO_EXCLUIDO', 'ANULADA_EXCLUIDA', 'REGESTION_EXCLUIDA') NOT NULL,
        es_asignada_win TINYINT DEFAULT 0,
        es_finalizada_win TINYINT DEFAULT 0,
        regla_aplicada VARCHAR(100),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_anio_mes (anio, mes),
        INDEX idx_categoria (categoria_win),
        INDEX idx_numero (numero)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Tabla 'ordenes_auditadas_win' lista con índices.");

    // 2. Obtener todas las órdenes de la BD
    const [ordenes] = await pool.query(`
      SELECT 
        id_orden,
        numero,
        codigo_seguimiento,
        cliente,
        fecha_visita,
        YEAR(fecha_visita) as anio,
        MONTH(fecha_visita) as mes,
        cuadrilla,
        tipo_trabajo,
        tipo_trabajo_asignado,
        motivo_finalizacion,
        producto,
        estado
      FROM ordenes
      WHERE fecha_visita IS NOT NULL
      ORDER BY id_orden ASC
    `);

    console.log(`📦 Procesando ${ordenes.length} órdenes para la capa auditada...`);

    let procesadas = 0;
    const batchSize = 500;

    for (let i = 0; i < ordenes.length; i += batchSize) {
      const batch = ordenes.slice(i, i + batchSize);
      const values = [];

      for (const ord of batch) {
        const audit = clasificarOrdenWin(ord);
        values.push([
          ord.id_orden,
          ord.numero,
          ord.codigo_seguimiento,
          ord.cliente,
          ord.fecha_visita,
          ord.anio,
          ord.mes,
          ord.cuadrilla,
          ord.tipo_trabajo,
          ord.tipo_trabajo_asignado,
          ord.motivo_finalizacion,
          ord.producto,
          ord.estado,
          audit.categoria,
          audit.esAsignada,
          audit.esFinalizada,
          audit.regla,
        ]);
      }

      await pool.query(`
        INSERT INTO ordenes_auditadas_win (
          id_orden,
          numero,
          codigo_seguimiento,
          cliente,
          fecha_visita,
          anio,
          mes,
          cuadrilla,
          tipo_trabajo_original,
          tipo_trabajo_asignado,
          motivo_finalizacion,
          producto,
          estado_original,
          categoria_win,
          es_asignada_win,
          es_finalizada_win,
          regla_aplicada
        ) VALUES ?
        ON DUPLICATE KEY UPDATE
          numero = VALUES(numero),
          codigo_seguimiento = VALUES(codigo_seguimiento),
          cliente = VALUES(cliente),
          fecha_visita = VALUES(fecha_visita),
          anio = VALUES(anio),
          mes = VALUES(mes),
          cuadrilla = VALUES(cuadrilla),
          tipo_trabajo_original = VALUES(tipo_trabajo_original),
          tipo_trabajo_asignado = VALUES(tipo_trabajo_asignado),
          motivo_finalizacion = VALUES(motivo_finalizacion),
          producto = VALUES(producto),
          estado_original = VALUES(estado_original),
          categoria_win = VALUES(categoria_win),
          es_asignada_win = VALUES(es_asignada_win),
          es_finalizada_win = VALUES(es_finalizada_win),
          regla_aplicada = VALUES(regla_aplicada),
          updated_at = NOW()
      `, [values]);

      procesadas += batch.length;
      if (procesadas % 2500 === 0 || procesadas === ordenes.length) {
        console.log(`⏳ Procesadas: ${procesadas} / ${ordenes.length}...`);
      }
    }

    console.log(`\n🎉 ¡Proceso completado! Se han auditado y clasificado ${procesadas} órdenes.`);

    // 3. Resumen por categoría en 2026
    const [resumen2026] = await pool.query(`
      SELECT 
        categoria_win,
        COUNT(*) as total_ordenes,
        SUM(es_asignada_win) as asignadas,
        SUM(es_finalizada_win) as finalizadas,
        ROUND((SUM(es_finalizada_win) / NULLIF(SUM(es_asignada_win), 0)) * 100, 2) as efectividad
      FROM ordenes_auditadas_win
      WHERE anio = 2026
      GROUP BY categoria_win
    `);

    console.log("\n📊 Resumen Global Año 2026 en 'ordenes_auditadas_win':");
    console.table(resumen2026);

    // 4. Verificación mes a mes 2026
    const [meses2026] = await pool.query(`
      SELECT 
        mes,
        SUM(CASE WHEN categoria_win = 'AVERIAS' THEN es_asignada_win ELSE 0 END) as av_asig,
        SUM(CASE WHEN categoria_win = 'AVERIAS' THEN es_finalizada_win ELSE 0 END) as av_fin,
        ROUND(SUM(CASE WHEN categoria_win = 'AVERIAS' THEN es_finalizada_win ELSE 0 END) / NULLIF(SUM(CASE WHEN categoria_win = 'AVERIAS' THEN es_asignada_win ELSE 0 END), 0) * 100, 2) as av_ef,
        SUM(CASE WHEN categoria_win = 'POSTVENTA' THEN es_asignada_win ELSE 0 END) as pv_asig,
        SUM(CASE WHEN categoria_win = 'POSTVENTA' THEN es_finalizada_win ELSE 0 END) as pv_fin,
        ROUND(SUM(CASE WHEN categoria_win = 'POSTVENTA' THEN es_finalizada_win ELSE 0 END) / NULLIF(SUM(CASE WHEN categoria_win = 'POSTVENTA' THEN es_asignada_win ELSE 0 END), 0) * 100, 2) as pv_ef
      FROM ordenes_auditadas_win
      WHERE anio = 2026
      GROUP BY mes
      ORDER BY mes ASC
    `);

    console.log("\n📅 Detalle Mensual 2026 (Consumo directo de la tabla auditada):");
    console.table(meses2026);

    process.exit(0);
  } catch (err) {
    console.error("Error al poblar tabla de auditoría:", err);
    process.exit(1);
  }
}

populateWinAuditTable();
