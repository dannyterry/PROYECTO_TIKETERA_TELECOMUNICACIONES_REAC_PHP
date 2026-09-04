const pool = require('../db');
const { obtenerOrdeVisiId, obtenerTareasOrden, obtenerDetalleTarea } = require('./fenixScraper');

// ============================================================================
// 🛡️ PROTECCIÓN ANTI-BAN, ANTI-ZOMBIE Y CIRCUIT BREAKER (RESILIENCIA TOTAL)
// ============================================================================

// 1. Circuit Breaker: Si Fénix falla consecutivamente 3 veces (timeout / 500 / caído),
//    se abre el circuito por 15 minutos para NO saturar el servidor ni generar procesos zombies.
let consecutiveFailures = 0;
let circuitBreakerOpenUntil = 0;
const MAX_CONSECUTIVE_FAILURES = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutos

// 2. Control de tiempo por orden individual (evita ráfagas y bucles)
const lastSyncTime = new Map(); // numeroOrden -> timestamp (ms)
const MIN_SYNC_INTERVAL_MS = 2 * 60 * 1000; // Mínimo 2 minutos entre consultas a Fénix por orden

// 3. Cola secuencial con delay de seguridad entre peticiones a Fénix
let queuePromise = Promise.resolve();
let isSyncingActiveOrders = false;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Envoltorio con timeout estricto de 15 segundos para cualquier llamada a Fénix
 */
function withTimeout(promise, ms = 15000, errMsg = 'Timeout de seguridad: Fénix tardó más de 15s') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(errMsg)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

// ============================================================================
// 💾 GESTIÓN DE BASE DE DATOS (TABLA DINÁMICA orden_tareas_cache)
// ============================================================================

/**
 * ⚡ Obtener tareas directamente desde la Base de Datos (0ms)
 * Lee primero de `orden_tareas_cache` (JSON) y si no existe busca en `orden_tareas`.
 */
async function getTareasDeBD(numeroOrden) {
  const cleanNum = String(numeroOrden || '').trim();
  if (!cleanNum) return { total: 0, finalizadas: 0, pct: 0, tareas: [] };

  try {
    // 1. Intentar leer desde orden_tareas_cache (Ultra rápido, 1 fila con JSON)
    const [cacheRows] = await pool.query(`
      SELECT 
        numero_orden, id_orden, cliente, cuadrilla, estado_orden,
        total_tareas, tareas_finalizadas, progreso_porcentaje,
        tareas_json, fecha_sincronizacion
      FROM orden_tareas_cache
      WHERE numero_orden = ?
      LIMIT 1
    `, [cleanNum]);

    if (cacheRows.length > 0 && cacheRows[0].tareas_json) {
      let parsed = [];
      try {
        parsed = JSON.parse(cacheRows[0].tareas_json);
      } catch {
        parsed = [];
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        return {
          total: cacheRows[0].total_tareas || parsed.length,
          finalizadas: cacheRows[0].tareas_finalizadas || 0,
          pct: cacheRows[0].progreso_porcentaje || 0,
          estado_orden: cacheRows[0].estado_orden,
          fecha_sincronizacion: cacheRows[0].fecha_sincronizacion,
          tareas: parsed
        };
      }
    }

    // 2. Fallback: Leer desde la tabla relacional `orden_tareas`
    const [rows] = await pool.query(`
      SELECT 
        id, id_orden, numero_orden, id_tarea_fenix AS id, index_tarea AS \`index\`,
        titulo, estado, es_obligatorio, tiene_foto, valor_texto, metraje,
        observacion, fecha_inicio, fecha_fin, duracion, fecha_actualizacion
      FROM orden_tareas
      WHERE numero_orden = ?
      ORDER BY index_tarea ASC
    `, [cleanNum]);

    const total = rows.length;
    const finalizadas = rows.filter(t => {
      const e = (t.estado || '').toLowerCase();
      return !e.includes('pend');
    }).length;
    const pct = total > 0 ? Math.round((finalizadas / total) * 100) : 0;

    return {
      total,
      finalizadas,
      pct,
      tareas: rows
    };
  } catch (err) {
    console.error(`❌ [TaskSync] Error al consultar tareas de BD para #${cleanNum}:`, err.message);
    return { total: 0, finalizadas: 0, pct: 0, tareas: [] };
  }
}

/**
 * 💾 Guardar y actualizar tareas en orden_tareas_cache y orden_tareas
 */
async function guardarTareasEnBD(idOrden, numeroOrden, tareasFenix, estadoOrdenOpt = null) {
  if (!Array.isArray(tareasFenix) || tareasFenix.length === 0) return;

  const cleanNum = String(numeroOrden).trim();

  // Calcular métricas de avance
  const total = tareasFenix.length;
  const finalizadas = tareasFenix.filter(t => {
    const e = (t.estado || '').toLowerCase().trim();
    return e.includes('finaliz') || e.includes('realiz') || e.includes('complet') || (!e.includes('pend') && e !== '');
  }).length;
  const pct = total > 0 ? Math.round((finalizadas / total) * 100) : 0;

  // 0. Recuperar campos y detalles previos de la BD para no sobreescribir observaciones ya guardadas
  let existingTasksMap = new Map();
  try {
    const [existingRows] = await pool.query(
      "SELECT tareas_json FROM orden_tareas_cache WHERE numero_orden = ? LIMIT 1",
      [cleanNum]
    );
    if (existingRows.length > 0 && existingRows[0].tareas_json) {
      const prevTasks = JSON.parse(existingRows[0].tareas_json);
      if (Array.isArray(prevTasks)) {
        prevTasks.forEach(pt => {
          if (pt.id) existingTasksMap.set(String(pt.id), pt);
        });
      }
    }
  } catch (e) {
    // Silencioso
  }

  // Sanitizar tareas para JSON limpio preservando campos y observaciones existentes
  const tareasLimpias = tareasFenix.map((t, idx) => {
    const idStr = String(t.id || `t_${t.index ?? idx}`);
    const prev = existingTasksMap.get(idStr);
    return {
      id: idStr,
      index: Number(t.index ?? idx),
      titulo: String(t.titulo || 'Tarea').trim(),
      estado: String(t.estado || 'Pendiente').trim(),
      es_obligatorio: t.es_obligatorio ? 1 : (String(t.titulo || '').includes('*') ? 1 : 0),
      tiene_foto: (t.tiene_foto || t.imagen_base64 || t.tieneFoto) ? 1 : 0,
      valor_texto: t.valor_texto || t.valor || (prev ? prev.valor_texto : null),
      metraje: t.metraje ? Number(t.metraje) : (prev ? prev.metraje : null),
      observacion: t.observacion || (prev ? prev.observacion : null),
      fecha_inicio: t.fecha_inicio || (prev ? prev.fecha_inicio : null),
      fecha_fin: t.fecha_fin || (prev ? prev.fecha_fin : null),
      duracion: t.duracion || (prev ? prev.duracion : null),
      campos: t.campos || (prev ? prev.campos : null),
      descripcion: t.descripcion || (prev ? prev.descripcion : null),
      detalle: t.detalle || (prev ? prev.detalle : null),
      tiempos: t.tiempos || (prev ? prev.tiempos : null),
      coordenadas_inicio: t.coordenadas_inicio || (prev ? prev.coordenadas_inicio : null),
      coordenadas_fin: t.coordenadas_fin || (prev ? prev.coordenadas_fin : null)
    };
  });

  // Obtener info adicional de la orden
  let cliente = null;
  let cuadrilla = null;
  let estado = estadoOrdenOpt;

  try {
    const [ordRows] = await pool.query(
      "SELECT cliente, cuadrilla, estado FROM ordenes WHERE numero = ? LIMIT 1",
      [cleanNum]
    );
    if (ordRows.length > 0) {
      cliente = ordRows[0].cliente;
      cuadrilla = ordRows[0].cuadrilla;
      if (!estado) estado = ordRows[0].estado;
    }
  } catch (e) {
    // Silencioso
  }

  // 1. Guardar en orden_tareas_cache (JSON Dinámico de alta velocidad)
  try {
    await pool.query(`
      INSERT INTO orden_tareas_cache (
        numero_orden, id_orden, cliente, cuadrilla, estado_orden,
        total_tareas, tareas_finalizadas, progreso_porcentaje,
        tareas_json, fecha_sincronizacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        id_orden = COALESCE(VALUES(id_orden), id_orden),
        cliente = COALESCE(VALUES(cliente), cliente),
        cuadrilla = COALESCE(VALUES(cuadrilla), cuadrilla),
        estado_orden = COALESCE(VALUES(estado_orden), estado_orden),
        total_tareas = VALUES(total_tareas),
        tareas_finalizadas = VALUES(tareas_finalizadas),
        progreso_porcentaje = VALUES(progreso_porcentaje),
        tareas_json = VALUES(tareas_json),
        fecha_sincronizacion = NOW()
    `, [
      cleanNum, idOrden || 0, cliente, cuadrilla, estado,
      total, finalizadas, pct,
      JSON.stringify(tareasLimpias)
    ]);
  } catch (errCache) {
    console.error(`⚠️ [TaskSync] Error al actualizar orden_tareas_cache para #${cleanNum}:`, errCache.message);
  }

  // 2. Guardar / actualizar en la tabla relacional orden_tareas (compatibilidad)
  try {
    const connection = await pool.getConnection();
    try {
      for (const t of tareasLimpias) {
        await connection.query(`
          INSERT INTO orden_tareas (
            id_orden, numero_orden, id_tarea_fenix, index_tarea,
            titulo, estado, es_obligatorio, tiene_foto,
            valor_texto, metraje, observacion,
            fecha_inicio, fecha_fin, duracion
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            estado = VALUES(estado),
            tiene_foto = GREATEST(tiene_foto, VALUES(tiene_foto)),
            valor_texto = COALESCE(VALUES(valor_texto), valor_texto),
            metraje = COALESCE(VALUES(metraje), metraje),
            observacion = COALESCE(VALUES(observacion), observacion),
            fecha_actualizacion = NOW()
        `, [
          idOrden || 0, cleanNum, t.id, t.index,
          t.titulo, t.estado, t.es_obligatorio, t.tiene_foto,
          t.valor_texto, t.metraje, t.observacion,
          t.fecha_inicio, t.fecha_fin, t.duracion
        ]);
      }
    } finally {
      connection.release();
    }
  } catch (errRel) {
    console.error(`⚠️ [TaskSync] Error al actualizar orden_tareas para #${cleanNum}:`, errRel.message);
  }
}

/**
 * 💾 Guardar detalle enriquecido de una tarea específica en orden_tareas_cache
 */
async function guardarDetalleTareaEnBD(numeroOrden, idTarea, detalle) {
  if (!numeroOrden || !idTarea || !detalle) return;
  const cleanNum = String(numeroOrden).trim();

  try {
    const [rows] = await pool.query(
      "SELECT tareas_json FROM orden_tareas_cache WHERE numero_orden = ? LIMIT 1",
      [cleanNum]
    );
    if (rows.length === 0 || !rows[0].tareas_json) return;

    let tasks = JSON.parse(rows[0].tareas_json);
    let updated = false;

    for (const t of tasks) {
      if (String(t.id) === String(idTarea)) {
        t.detalle = detalle;
        t.campos = detalle.campos || null;
        t.descripcion = detalle.descripcion || null;
        t.tiempos = detalle.tiempos || null;
        t.coordenadas_inicio = detalle.coordenadas_inicio || null;
        t.coordenadas_fin = detalle.coordenadas_fin || null;

        if (detalle.campos) {
          const keys = Object.keys(detalle.campos).filter(k => !k.includes('GD:') && !k.includes('GMS:'));
          if (keys.length > 0) {
            t.observacion = keys.map(k => `${k}: ${detalle.campos[k]}`).join(' | ');
            t.valor_texto = detalle.campos[keys[0]];
          }
        }
        updated = true;
        break;
      }
    }

    if (updated) {
      await pool.query(
        "UPDATE orden_tareas_cache SET tareas_json = ?, fecha_actualizacion = NOW() WHERE numero_orden = ?",
        [JSON.stringify(tasks), cleanNum]
      );
    }
  } catch (err) {
    console.error(`⚠️ Error al guardar detalle de tarea #${idTarea} en BD:`, err.message);
  }
}

// ============================================================================
// 🔍 DETECCIÓN Y ENRIQUECIMIENTO AUTOMÁTICO DE OBSERVACIONES EN TAREAS
// ============================================================================

const OBSERVATION_KEYWORDS = /motivo|diagn[oó]stico|observac|problema|metraje|disponible|resumen|justif|causa|soluci[oó]n|estado del servicio/i;

function esTareaCandidataObservacion(titulo) {
  if (!titulo) return false;
  return OBSERVATION_KEYWORDS.test(String(titulo));
}

/**
 * 🔍 Enriquecer automáticamente tareas candidatas a observación
 * Solo consulta Fénix para las 1-3 tareas de cuestionarios/observaciones de la orden
 * que ya están finalizadas y no tienen campos guardados en BD.
 */
async function enriquecerObservacionesOrden(numeroOrden, tareas) {
  if (!numeroOrden || !Array.isArray(tareas) || tareas.length === 0) return tareas;

  const cleanNum = String(numeroOrden).trim();

  // Filtrar tareas candidatas que estén finalizadas y no tengan campos aún
  const candidatas = tareas.filter(t => {
    const isFinalizada = !String(t.estado || '').toLowerCase().includes('pend');
    const yaTieneCampos = t.campos && Object.keys(t.campos).filter(k => !k.includes('GD:') && !k.includes('GMS:')).length > 0;
    return isFinalizada && !yaTieneCampos && esTareaCandidataObservacion(t.titulo);
  });

  if (candidatas.length === 0) return tareas;

  console.log(`🔍 [TaskSync] Enriqueciendo observaciones para ${candidatas.length} tarea(s) en orden #${cleanNum}...`);

  let huboActualizacion = false;
  for (const t of candidatas) {
    try {
      const detalle = await withTimeout(
        obtenerDetalleTarea(t.id, t.index),
        8000,
        `Timeout enriqueciendo tarea ${t.id} de orden #${cleanNum}`
      );

      if (detalle) {
        t.detalle = detalle;
        t.campos = detalle.campos || null;
        t.descripcion = detalle.descripcion || null;
        t.tiempos = detalle.tiempos || null;
        t.coordenadas_inicio = detalle.coordenadas_inicio || null;
        t.coordenadas_fin = detalle.coordenadas_fin || null;

        if (detalle.campos) {
          const keys = Object.keys(detalle.campos).filter(k => !k.includes('GD:') && !k.includes('GMS:'));
          if (keys.length > 0) {
            t.observacion = keys.map(k => `${k}: ${detalle.campos[k]}`).join(' | ');
            t.valor_texto = detalle.campos[keys[0]];
          }
        }
        huboActualizacion = true;
      }
      await delay(400); // Pausa de cortesía
    } catch (errDet) {
      console.warn(`⚠️ No se pudo enriquecer tarea ${t.id} (${t.titulo}):`, errDet.message);
    }
  }

  if (huboActualizacion) {
    try {
      await pool.query(
        "UPDATE orden_tareas_cache SET tareas_json = ?, fecha_actualizacion = NOW() WHERE numero_orden = ?",
        [JSON.stringify(tareas), cleanNum]
      );
      console.log(`💾 [TaskSync] Observaciones guardadas en BD local para orden #${cleanNum}`);
    } catch (e) {
      console.error(`⚠️ Error al actualizar tareas_json enriquecidas en BD:`, e.message);
    }
  }

  return tareas;
}

// ============================================================================
// 🔄 SINCRONIZACIÓN INTELIGENTE Y SEGURA CON FÉNIX
// ============================================================================

/**
 * 🛡️ Sincronizar tareas de forma segura
 * - Si Fénix está caído o en cooldown (Circuit Breaker) -> Devuelve BD inmediatamente (0ms).
 * - Si la orden está Finalizada/Cancelada -> Congelada, devuelve BD inmediatamente.
 * - Si ya se consultó hace menos de 2 minutos -> Devuelve BD inmediatamente.
 * - Si consulta a Fénix -> Aplica timeout estricto de 15 segundos.
 */
async function sincronizarTareasOrdenSeguro(numeroOrden, idOrdenOpt = null, forzar = false) {
  const cleanNum = String(numeroOrden || '').trim();
  if (!cleanNum) return { fuente: 'VACIO', total: 0, finalizadas: 0, pct: 0, tareas: [] };

  // 1. Obtener datos actuales de la Base de Datos
  const datosBD = await getTareasDeBD(cleanNum);

  // 2. Comprobar si la orden ya está finalizada o completada en la BD (CONGELADA)
  let estadoOrden = datosBD.estado_orden;
  let finalIdOrden = idOrdenOpt;
  try {
    const [ordInfo] = await pool.query("SELECT id_orden, estado FROM ordenes WHERE numero = ? LIMIT 1", [cleanNum]);
    if (ordInfo.length > 0) {
      estadoOrden = ordInfo[0].estado || estadoOrden;
      if (!finalIdOrden) finalIdOrden = ordInfo[0].id_orden;
    }
  } catch (e) {
    // Silencioso
  }

  const esOrdenTerminada = datosBD.pct === 100 ||
    ['Finalizada', 'Finalizados', 'Cancelada', 'Cancelado', 'Anulada', 'Anulado', 'Regestion'].includes(estadoOrden);

  // Si la orden está terminada y ya tiene tareas en BD: Jamás volver a consultar Fénix (0ms)
  if (esOrdenTerminada && datosBD.tareas.length > 0 && !forzar) {
    enriquecerObservacionesOrden(cleanNum, datosBD.tareas).catch(() => {});
    return {
      fuente: 'BD_LOCAL_CONGELADA',
      total: datosBD.total,
      finalizadas: datosBD.finalizadas,
      pct: datosBD.pct,
      tareas: datosBD.tareas
    };
  }

  // 3. Comprobar estado del CIRCUIT BREAKER
  const now = Date.now();
  if (now < circuitBreakerOpenUntil) {
    const minsRestantes = Math.ceil((circuitBreakerOpenUntil - now) / 60000);
    console.warn(`⏸️ [Circuit Breaker Activo] Fénix en pausa (${minsRestantes} min restantes). Sirviendo orden #${cleanNum} desde BD local.`);
    return {
      fuente: 'BD_LOCAL_CIRCUIT_BREAKER',
      total: datosBD.total,
      finalizadas: datosBD.finalizadas,
      pct: datosBD.pct,
      tareas: datosBD.tareas
    };
  }

  // 4. Control de intervalo mínimo (Anti-Ban / Anti-Ráfaga)
  const lastTime = lastSyncTime.get(cleanNum) || 0;
  const yaPasoIntervalo = (now - lastTime) >= MIN_SYNC_INTERVAL_MS;

  // Si ya tenemos tareas y no ha pasado el intervalo de 2 minutos (y no es forzado): Respuesta instantánea
  if (datosBD.tareas.length > 0 && !forzar && !yaPasoIntervalo) {
    enriquecerObservacionesOrden(cleanNum, datosBD.tareas).catch(() => {});
    return {
      fuente: 'BD_LOCAL',
      total: datosBD.total,
      finalizadas: datosBD.finalizadas,
      pct: datosBD.pct,
      tareas: datosBD.tareas
    };
  }

  // 5. Ejecutar consulta protegida a Fénix en cola secuencial
  return new Promise((resolve) => {
    queuePromise = queuePromise.then(async () => {
      try {
        lastSyncTime.set(cleanNum, Date.now());
        console.log(`📡 [TaskSync] Consultando Fénix para orden #${cleanNum}...`);

        // Llamada con timeout de 15 segundos
        const ordeVisiId = await withTimeout(
          obtenerOrdeVisiId(cleanNum),
          15000,
          `Timeout Fénix obteniendo OrdeVisiId para #${cleanNum}`
        );

        if (!ordeVisiId) {
          return resolve({
            fuente: 'BD_LOCAL',
            total: datosBD.total,
            finalizadas: datosBD.finalizadas,
            pct: datosBD.pct,
            tareas: datosBD.tareas
          });
        }

        await delay(800); // Pausa de cortesía para Fénix

        // Obtener tareas con timeout de 15 segundos
        const tareasFenix = await withTimeout(
          obtenerTareasOrden(ordeVisiId),
          15000,
          `Timeout Fénix obteniendo tareas para #${cleanNum}`
        );

        if (Array.isArray(tareasFenix) && tareasFenix.length > 0) {
          // Éxito: restablecer fallos consecutivos
          consecutiveFailures = 0;

          // Resolver id_orden si no vino
          let finalIdOrden = idOrdenOpt;
          if (!finalIdOrden) {
            const [ordRow] = await pool.query("SELECT id_orden, estado FROM ordenes WHERE numero = ? LIMIT 1", [cleanNum]);
            if (ordRow.length > 0) {
              finalIdOrden = ordRow[0].id_orden;
            }
          }

          // Guardar y actualizar estados en la BD
          await guardarTareasEnBD(finalIdOrden, cleanNum, tareasFenix);

          // Enriquecer observaciones automáticamente en segundo plano (fire & forget)
          enriquecerObservacionesOrden(cleanNum, tareasFenix).catch(() => {});

          // Leer datos actualizados de BD
          const actualizadas = await getTareasDeBD(cleanNum);

          return resolve({
            fuente: 'FENIX_SINCRONIZADO',
            total: actualizadas.total,
            finalizadas: actualizadas.finalizadas,
            pct: actualizadas.pct,
            tareas: actualizadas.tareas
          });
        }

        // Si datosBD tiene tareas con candidatas pendientes de enriquecer, enriquecer en segundo plano
        if (datosBD.tareas && datosBD.tareas.length > 0) {
          enriquecerObservacionesOrden(cleanNum, datosBD.tareas).catch(() => {});
        }

        return resolve({
          fuente: 'BD_LOCAL',
          total: datosBD.total,
          finalizadas: datosBD.finalizadas,
          pct: datosBD.pct,
          tareas: datosBD.tareas
        });
      } catch (err) {
        consecutiveFailures++;
        console.error(`❌ [TaskSync] Error al sincronizar orden #${cleanNum} (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES} fallos):`, err.message);

        // Si se alcanzan 3 fallos consecutivos, abrir el Circuit Breaker por 15 minutos
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          circuitBreakerOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
          console.warn(`🚨 [CIRCUIT BREAKER ABIERTO] Fénix inaccesible o caído. Todas las peticiones se responderán desde la BD local durante los próximos 15 minutos para proteger el servidor.`);
        }

        return resolve({
          fuente: 'BD_LOCAL_ERROR_FENIX',
          total: datosBD.total,
          finalizadas: datosBD.finalizadas,
          pct: datosBD.pct,
          tareas: datosBD.tareas
        });
      } finally {
        await delay(1200); // Espaciado entre consultas secuenciales
      }
    });
  });
}

/**
 * 🤖 Sincronización automática de tareas para órdenes activas de HOY
 * Diseñado para ser invocado por el cron cada 5 minutos de forma 100% segura.
 * - Solo consulta órdenes de HOY que estén en estado 'Iniciada' o 'En camino' (máximo 15 órdenes).
 * - Si el Circuit Breaker se activa, se detiene inmediatamente.
 * - Candado atómico: Si ya hay un barrido corriendo, omite para evitar acumulación de procesos.
 */
async function sincronizarTareasOrdenesActivas() {
  if (isSyncingActiveOrders) {
    console.log('⏳ [TaskSync Cron] Ya hay un barrido de tareas en curso. Omitiendo.');
    return { success: true, message: 'Barrido en curso' };
  }

  // Comprobar si Fénix está en cooldown
  if (Date.now() < circuitBreakerOpenUntil) {
    console.log('⏸️ [TaskSync Cron] Fénix en pausa por Circuit Breaker. Omitiendo barrido.');
    return { success: true, message: 'Circuit breaker activo' };
  }

  try {
    isSyncingActiveOrders = true;

    // Buscar órdenes activas de hoy (Iniciada o En camino)
    const [activas] = await pool.query(`
      SELECT id_orden, numero, cliente, cuadrilla, estado
      FROM ordenes
      WHERE estado IN ('Iniciada', 'En camino')
        AND (DATE(COALESCE(fecha_solicitud, fecha_visita, fecha_creacion, NOW())) = CURDATE())
      ORDER BY id_orden DESC
      LIMIT 15
    `);

    if (activas.length === 0) {
      console.log('✨ [TaskSync Cron] No hay órdenes activas de hoy pendientes de actualización.');
      return { success: true, procesadas: 0 };
    }

    console.log(`🚀 [TaskSync Cron] Iniciando actualización segura de tareas para ${activas.length} órdenes activas...`);

    let procesadas = 0;
    for (const ord of activas) {
      // Si en mitad del bucle el Circuit Breaker se abrió por fallo de Fénix, cortar de inmediato
      if (Date.now() < circuitBreakerOpenUntil) {
        console.warn('🚨 [TaskSync Cron] Deteniendo barrido porque se activó el Circuit Breaker.');
        break;
      }

      await sincronizarTareasOrdenSeguro(ord.numero, ord.id_orden, false);
      procesadas++;
      await delay(1000);
    }

    console.log(`✅ [TaskSync Cron] Barrido completado: ${procesadas} órdenes procesadas.`);
    return { success: true, procesadas };
  } catch (err) {
    console.error('❌ [TaskSync Cron] Error en barrido de tareas activas:', err.message);
    return { success: false, error: err.message };
  } finally {
    isSyncingActiveOrders = false;
  }
}

/**
 * 📏 Obtener metraje sugerido declarado en Fénix (tarea METRAJE TOTAL UTILIZADO)
 */
async function getMetrajeDeclaradoFenix(numeroOrden) {
  const cleanNum = String(numeroOrden || '').trim();
  if (!cleanNum) return null;

  try {
    let [rows] = await pool.query(`
      SELECT metraje, valor_texto, observacion, titulo, estado
      FROM orden_tareas
      WHERE numero_orden = ? AND (titulo LIKE '%METRAJE%' OR titulo LIKE '%CABLE%' OR titulo LIKE '%DROP%')
      ORDER BY (metraje IS NOT NULL) DESC, id ASC
    `, [cleanNum]);

    for (const r of rows) {
      if (r.metraje !== null && Number(r.metraje) > 0) {
        return Number(r.metraje);
      }
      const texto = `${r.valor_texto || ''} ${r.observacion || ''}`;
      const m = texto.match(/(\d+(?:\.\d+)?)\s*(?:m|metros)?/i);
      if (m && parseFloat(m[1]) > 0) {
        return parseFloat(m[1]);
      }
    }
    return null;
  } catch {
    return null;
  }
}

module.exports = {
  guardarTareasEnBD,
  guardarDetalleTareaEnBD,
  getTareasDeBD,
  sincronizarTareasOrdenSeguro,
  sincronizarTareasOrdenesActivas,
  getMetrajeDeclaradoFenix,
  enriquecerObservacionesOrden,
  esTareaCandidataObservacion
};
