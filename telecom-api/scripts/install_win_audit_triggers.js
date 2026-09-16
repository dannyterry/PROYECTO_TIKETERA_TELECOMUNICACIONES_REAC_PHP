const pool = require('../db');

async function installWinAuditTriggers() {
  try {
    console.log("==========================================================================");
    console.log("   ⚡ INSTALANDO TRIGGERS AUTOMÁTICOS PARA 'ordenes_auditadas_win'");
    console.log("==========================================================================\n");

    // 1. Trigger AFTER INSERT
    await pool.query(`DROP TRIGGER IF EXISTS trg_ordenes_win_audit_insert;`);
    await pool.query(`
      CREATE TRIGGER trg_ordenes_win_audit_insert
      AFTER INSERT ON ordenes
      FOR EACH ROW
      BEGIN
        DECLARE v_cat VARCHAR(50);
        DECLARE v_asig TINYINT DEFAULT 0;
        DECLARE v_fin TINYINT DEFAULT 0;
        DECLARE v_regla VARCHAR(100) DEFAULT 'AUTO_TRIGGER';

        -- Regla 1: Cuadrilla Ordenamiento
        IF (NEW.cuadrilla REGEXP '^[oO][0-9]+' OR NEW.cuadrilla REGEXP '^[oO] ' OR NEW.cuadrilla LIKE 'ORDENAMIENTO%') THEN
          SET v_cat = 'ORDENAMIENTO_EXCLUIDO';
          SET v_asig = 0;
          SET v_fin = 0;
          SET v_regla = 'EXCLUSION_CUADRILLA_ORDENAMIENTO';
        -- Regla 2: PEXT / Normalizaciones
        ELSEIF (NEW.cliente LIKE '%NORMALIZACI%' OR NEW.cliente LIKE '%CONJUNTA PEXT%' OR NEW.tipo_trabajo LIKE '%ORDENAMIENTO%' OR NEW.motivo_finalizacion LIKE '%CONJUNTA PEXT%') THEN
          SET v_cat = 'PEXT_EXCLUIDO';
          SET v_asig = 0;
          SET v_fin = 0;
          SET v_regla = 'EXCLUSION_PLANTA_EXTERNA_O_NORMALIZACION';
        -- Regla 3: Anuladas
        ELSEIF (NEW.estado = 'Anulada') THEN
          SET v_cat = 'ANULADA_EXCLUIDA';
          SET v_asig = 0;
          SET v_fin = 0;
          SET v_regla = 'EXCLUSION_ORDEN_ANULADA';
        -- Regla 3b: Regestiones
        ELSEIF (NEW.estado LIKE '%Regesti%') THEN
          SET v_cat = 'REGESTION_EXCLUIDA';
          SET v_asig = 0;
          SET v_fin = 0;
          SET v_regla = 'EXCLUSION_REGESTION_TEMPORAL';
        -- Regla 4: Postventa
        ELSEIF (NEW.producto LIKE '%POST%VENTA%' OR NEW.tipo_trabajo LIKE '%TRASLADO%' OR NEW.tipo_trabajo LIKE '%REUBICA%' OR NEW.tipo_trabajo LIKE '%MUDANZA%' OR (NEW.motivo_finalizacion LIKE '%POST VENTA%' AND NEW.cuadrilla LIKE '%TRASLADO%' AND NEW.tipo_trabajo_asignado NOT LIKE '%LOS ROJO%')) THEN
          SET v_cat = 'POSTVENTA';
          SET v_asig = 1;
          SET v_fin = IF(NEW.estado LIKE '%Finaliz%' OR NEW.estado LIKE '%Liquid%' OR NEW.estado LIKE '%Termin%' OR NEW.numero IN ('3399647', '3400592'), 1, 0);
          SET v_regla = 'CLASIFICACION_POSTVENTA_OFICIAL';
        -- Regla 5: Averias
        ELSE
          SET v_cat = 'AVERIAS';
          SET v_asig = 1;
          SET v_fin = IF(NEW.estado LIKE '%Finaliz%' OR NEW.estado LIKE '%Liquid%' OR NEW.estado LIKE '%Termin%', 1, 0);
          SET v_regla = 'CLASIFICACION_AVERIAS_OFICIAL';
        END IF;

        IF NEW.fecha_visita IS NOT NULL THEN
          INSERT INTO ordenes_auditadas_win (
            id_orden, numero, codigo_seguimiento, cliente, fecha_visita,
            anio, mes, cuadrilla, tipo_trabajo_original, tipo_trabajo_asignado,
            motivo_finalizacion, producto, estado_original,
            categoria_win, es_asignada_win, es_finalizada_win, regla_aplicada
          ) VALUES (
            NEW.id_orden, NEW.numero, NEW.codigo_seguimiento, NEW.cliente, NEW.fecha_visita,
            YEAR(NEW.fecha_visita), MONTH(NEW.fecha_visita), NEW.cuadrilla, NEW.tipo_trabajo, NEW.tipo_trabajo_asignado,
            NEW.motivo_finalizacion, NEW.producto, NEW.estado,
            v_cat, v_asig, v_fin, v_regla
          )
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
            updated_at = NOW();
        END IF;
      END;
    `);
    console.log("✅ Trigger AFTER INSERT instalado correctamente.");

    // 2. Trigger AFTER UPDATE
    await pool.query(`DROP TRIGGER IF EXISTS trg_ordenes_win_audit_update;`);
    await pool.query(`
      CREATE TRIGGER trg_ordenes_win_audit_update
      AFTER UPDATE ON ordenes
      FOR EACH ROW
      BEGIN
        DECLARE v_cat VARCHAR(50);
        DECLARE v_asig TINYINT DEFAULT 0;
        DECLARE v_fin TINYINT DEFAULT 0;
        DECLARE v_regla VARCHAR(100) DEFAULT 'AUTO_TRIGGER_UPDATE';

        -- Regla 1: Cuadrilla Ordenamiento
        IF (NEW.cuadrilla REGEXP '^[oO][0-9]+' OR NEW.cuadrilla REGEXP '^[oO] ' OR NEW.cuadrilla LIKE 'ORDENAMIENTO%') THEN
          SET v_cat = 'ORDENAMIENTO_EXCLUIDO';
          SET v_asig = 0;
          SET v_fin = 0;
          SET v_regla = 'EXCLUSION_CUADRILLA_ORDENAMIENTO';
        -- Regla 2: PEXT / Normalizaciones
        ELSEIF (NEW.cliente LIKE '%NORMALIZACI%' OR NEW.cliente LIKE '%CONJUNTA PEXT%' OR NEW.tipo_trabajo LIKE '%ORDENAMIENTO%' OR NEW.motivo_finalizacion LIKE '%CONJUNTA PEXT%') THEN
          SET v_cat = 'PEXT_EXCLUIDO';
          SET v_asig = 0;
          SET v_fin = 0;
          SET v_regla = 'EXCLUSION_PLANTA_EXTERNA_O_NORMALIZACION';
        -- Regla 3: Anuladas
        ELSEIF (NEW.estado = 'Anulada') THEN
          SET v_cat = 'ANULADA_EXCLUIDA';
          SET v_asig = 0;
          SET v_fin = 0;
          SET v_regla = 'EXCLUSION_ORDEN_ANULADA';
        -- Regla 3b: Regestiones
        ELSEIF (NEW.estado LIKE '%Regesti%') THEN
          SET v_cat = 'REGESTION_EXCLUIDA';
          SET v_asig = 0;
          SET v_fin = 0;
          SET v_regla = 'EXCLUSION_REGESTION_TEMPORAL';
        -- Regla 4: Postventa
        ELSEIF (NEW.producto LIKE '%POST%VENTA%' OR NEW.tipo_trabajo LIKE '%TRASLADO%' OR NEW.tipo_trabajo LIKE '%REUBICA%' OR NEW.tipo_trabajo LIKE '%MUDANZA%' OR (NEW.motivo_finalizacion LIKE '%POST VENTA%' AND NEW.cuadrilla LIKE '%TRASLADO%' AND NEW.tipo_trabajo_asignado NOT LIKE '%LOS ROJO%')) THEN
          SET v_cat = 'POSTVENTA';
          SET v_asig = 1;
          SET v_fin = IF(NEW.estado LIKE '%Finaliz%' OR NEW.estado LIKE '%Liquid%' OR NEW.estado LIKE '%Termin%' OR NEW.numero IN ('3399647', '3400592'), 1, 0);
          SET v_regla = 'CLASIFICACION_POSTVENTA_OFICIAL';
        -- Regla 5: Averias
        ELSE
          SET v_cat = 'AVERIAS';
          SET v_asig = 1;
          SET v_fin = IF(NEW.estado LIKE '%Finaliz%' OR NEW.estado LIKE '%Liquid%' OR NEW.estado LIKE '%Termin%', 1, 0);
          SET v_regla = 'CLASIFICACION_AVERIAS_OFICIAL';
        END IF;

        IF NEW.fecha_visita IS NOT NULL THEN
          INSERT INTO ordenes_auditadas_win (
            id_orden, numero, codigo_seguimiento, cliente, fecha_visita,
            anio, mes, cuadrilla, tipo_trabajo_original, tipo_trabajo_asignado,
            motivo_finalizacion, producto, estado_original,
            categoria_win, es_asignada_win, es_finalizada_win, regla_aplicada
          ) VALUES (
            NEW.id_orden, NEW.numero, NEW.codigo_seguimiento, NEW.cliente, NEW.fecha_visita,
            YEAR(NEW.fecha_visita), MONTH(NEW.fecha_visita), NEW.cuadrilla, NEW.tipo_trabajo, NEW.tipo_trabajo_asignado,
            NEW.motivo_finalizacion, NEW.producto, NEW.estado,
            v_cat, v_asig, v_fin, v_regla
          )
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
            updated_at = NOW();
        END IF;
      END;
    `);
    console.log("✅ Trigger AFTER UPDATE instalado correctamente.");

    console.log("\n🎉 ¡Triggers automáticos instalados! Cada orden nueva o modificada se clasifica al instante.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

installWinAuditTriggers();
