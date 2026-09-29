const pool = require('../db');
const { obtenerHistorialEstados, extraerTiemposDeHistorial } = require('../services/fenixScraper');

/**
 * Escaner masivo para auditar órdenes de fechas pasadas
 * @param {string} fechaDesde YYYY-MM-DD
 * @param {string} fechaHasta YYYY-MM-DD
 */
async function auditarFechasPasadas(fechaDesde = '2026-09-20', fechaHasta = '2026-09-27') {
  console.log(`\n🔎 [Auditor Historial] Buscando órdenes entre ${fechaDesde} y ${fechaHasta}...`);

  const [techUsers] = await pool.query(
    "SELECT id_usuario, nombres, apellidos, primer_apellido, segundo_apellido FROM usuarios"
  );

  // Buscar órdenes sin usuario_ejecutor_fenix o finalizadas sin acta y sin asignacion manual
  const [ordenes] = await pool.query(
    `SELECT id_orden, numero, fecha_visita, estado, cuadrilla, tecnico_asignado, id_tecnico, asignacion_manual
     FROM ordenes
     WHERE DATE(fecha_visita) BETWEEN ? AND ?
       AND asignacion_manual = 0
       AND (usuario_ejecutor_fenix IS NULL OR tecnico_asignado LIKE '%EXTERNO%')
     ORDER BY fecha_visita DESC`,
    [fechaDesde, fechaHasta]
  );

  console.log(`📦 Se encontraron ${ordenes.length} órdenes para verificar en Fénix.`);

  let encontradosExternos = [];
  let confirmadosInternos = [];

  for (let i = 0; i < ordenes.length; i++) {
    const o = ordenes[i];
    process.stdout.write(`\r[${i + 1}/${ordenes.length}] Verificando orden #${o.numero}...`);

    try {
      const historial = await obtenerHistorialEstados(o.numero);
      if (!historial || historial.length === 0) continue;

      const tiempos = extraerTiemposDeHistorial(historial);
      if (!tiempos.usuarioEjecutor) continue;

      const normRaw = String(tiempos.usuarioEjecutor).toUpperCase().trim();
      const found = techUsers.find((u) => {
        const full1 = `${u.nombres || ''} ${u.apellidos || ''}`.toUpperCase().trim();
        const full2 = `${u.nombres || ''} ${u.primer_apellido || ''} ${u.segundo_apellido || ''}`.toUpperCase().trim();
        if (full1 && normRaw === full1) return true;
        if (full2 && normRaw === full2) return true;
        if (full1 && (normRaw.includes(full1) || full1.includes(normRaw))) return true;

        const nameParts = (u.nombres || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
        const apeParts = (u.apellidos || u.primer_apellido || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
        return nameParts.some(p => normRaw.includes(p)) && apeParts.some(p => normRaw.includes(p));
      });

      if (!found) {
        // ES TÉCNICO EXTERNO
        const nuevoNombre = 'EXTERNO: ' + tiempos.usuarioEjecutor;
        encontradosExternos.push({
          numero: o.numero,
          fecha: o.fecha_visita,
          cuadrillaOriginal: o.cuadrilla,
          tecnicoAnterior: o.tecnico_asignado,
          ejecutorFenix: tiempos.usuarioEjecutor
        });

        await pool.query(
          `UPDATE ordenes 
           SET 
             id_tecnico = NULL,
             tecnico_asignado = ?,
             usuario_ejecutor_fenix = ?,
             hora_en_camino = COALESCE(hora_en_camino, ?),
             inicio_visita = COALESCE(inicio_visita, ?),
             fin_visita = COALESCE(fin_visita, ?)
           WHERE id_orden = ?`,
          [nuevoNombre, tiempos.usuarioEjecutor, tiempos.horaEnCamino, tiempos.inicioVisita, tiempos.finVisita, o.id_orden]
        );
      } else {
        // ES TÉCNICO CÉSPEDES
        confirmadosInternos.push({
          numero: o.numero,
          ejecutor: `${found.nombres} ${found.apellidos || ''}`.trim()
        });

        await pool.query(
          `UPDATE ordenes 
           SET 
             usuario_ejecutor_fenix = ?,
             hora_en_camino = COALESCE(hora_en_camino, ?),
             inicio_visita = COALESCE(inicio_visita, ?),
             fin_visita = COALESCE(fin_visita, ?)
           WHERE id_orden = ?`,
          [tiempos.usuarioEjecutor, tiempos.horaEnCamino, tiempos.inicioVisita, tiempos.finVisita, o.id_orden]
        );
      }
    } catch (e) {
      // Ignorar errores individuales
    }
  }

  console.log(`\n\n🎯 ¡Auditoría Finalizada!`);
  console.log(`✅ Órdenes de Técnicos Externos detectadas y corregidas: ${encontradosExternos.length}`);
  if (encontradosExternos.length > 0) {
    console.table(encontradosExternos);
  }
  process.exit(0);
}

// Ejecutar para los últimos 7 días como demostración
auditarFechasPasadas('2026-09-24', '2026-09-27');
