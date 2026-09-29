const pool = require('../db');
const { obtenerHistorialEstados, extraerTiemposDeHistorial } = require('../services/fenixScraper');

async function rescanClean() {
  console.log("🧹 Re-escaneando y limpiando órdenes con las REGLAS ESTRICTAS DE CAMPO...");

  const [techUsers] = await pool.query(
    "SELECT id_usuario, nombres, apellidos, primer_apellido, segundo_apellido, cuadrilla FROM usuarios"
  );

  // Buscar órdenes que tengan EXTERNO o que sean del 24 al 27 de sep
  const [ordenes] = await pool.query(
    `SELECT id_orden, numero, fecha_visita, estado, cuadrilla, cuadrilla_origen_fenix, tecnico_asignado, id_tecnico, asignacion_manual
     FROM ordenes
     WHERE (tecnico_asignado LIKE '%EXTERNO%' OR DATE(fecha_visita) BETWEEN '2026-09-24' AND '2026-09-27')
       AND (asignacion_manual = 0 OR asignacion_manual IS NULL)
     ORDER BY fecha_visita DESC`
  );

  console.log(`📦 Analizando ${ordenes.length} órdenes...`);

  let externosReales = [];
  let restauradosInternos = [];

  const findTechMatch = (cuadStr) => {
    if (!cuadStr || cuadStr === '-' || !techUsers.length) return null;
    let str = String(cuadStr).trim();
    const sgaMatch = str.match(/\bSGA[\s-_:•|/\\]+(.+)$/i);
    if (sgaMatch && sgaMatch[1] && sgaMatch[1].trim().length > 2) {
      str = sgaMatch[1].trim();
    }
    const rawName = str
      .replace(/^(?:[A-Z]\s*\d+\s*(?:MOTOWIN|CESPEDES|TRASLADO|SGA|WIN)?|CESPEDES|SGA|MOTOWIN|WIN|CONTRATISTA|MIGRACION|TRASLADO|INSTALACION)[\s-_:•|/\\]+/gi, '')
      .replace(/^(?:CESPEDES|SGA|MOTOWIN|WIN|CONTRATISTA|MIGRACION|TRASLADO|INSTALACION)[\s-_:•|/\\]+/gi, '')
      .replace(/^[-_:•|/\\.\s]+/, '')
      .replace(/[-_:•|/\\.\s]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!rawName || rawName.length < 3) return null;
    const normRaw = rawName.toUpperCase();

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

    return found ? { id: found.id_usuario, nombre: `${found.nombres} ${found.apellidos || found.primer_apellido || ''}`.trim() } : null;
  };

  for (let i = 0; i < ordenes.length; i++) {
    const o = ordenes[i];
    try {
      const historial = await obtenerHistorialEstados(o.numero);
      if (!historial || historial.length === 0) continue;

      const tiempos = extraerTiemposDeHistorial(historial);

      // Si NO hubo trabajo de campo (usuarioEjecutor es null porque solo hubo Pendiente/Agendada/Anulada por central)
      if (!tiempos.usuarioEjecutor) {
        // Restaurar técnico de la cuadrilla original si estaba erróneamente puesto como EXTERNO
        const origCuad = o.cuadrilla_origen_fenix || o.cuadrilla;
        const matchedOrig = findTechMatch(origCuad);
        const autoId = matchedOrig?.id || null;
        const autoNombre = matchedOrig?.nombre || null;

        await pool.query(
          `UPDATE ordenes 
           SET 
             id_tecnico = ?,
             tecnico_asignado = ?,
             usuario_ejecutor_fenix = NULL,
             hora_en_camino = COALESCE(hora_en_camino, ?),
             inicio_visita = COALESCE(inicio_visita, ?),
             fin_visita = COALESCE(fin_visita, ?)
           WHERE id_orden = ?`,
          [autoId, autoNombre, tiempos.horaEnCamino, tiempos.inicioVisita, tiempos.finVisita, o.id_orden]
        );

        if (o.tecnico_asignado && o.tecnico_asignado.includes('EXTERNO')) {
          restauradosInternos.push({
            numero: o.numero,
            motivo: 'Solo estados de central (sin campo)',
            restauradoA: autoNombre || origCuad
          });
        }
      } else {
        // SÍ HUBO TRABAJO DE CAMPO REAL
        // Verificar si alguna fila de campo fue de Céspedes
        const filasCampo = historial.filter((h) => {
          const st = (h.estado || '').toUpperCase();
          const u = (h.usuario || '').trim();
          if (!u || /^(administrador|admin|sistema|central)$/i.test(u)) return false;
          return st.includes('CAMINO') || st.includes('INICIA') || st.includes('PROCESO') || st.includes('REVISI');
        });

        let foundTech = null;
        for (const h of filasCampo) {
          const norm = String(h.usuario).toUpperCase().trim();
          foundTech = techUsers.find((u) => {
            const full1 = `${u.nombres || ''} ${u.apellidos || ''}`.toUpperCase().trim();
            const full2 = `${u.nombres || ''} ${u.primer_apellido || ''} ${u.segundo_apellido || ''}`.toUpperCase().trim();
            if (full1 && (norm === full1 || norm.includes(full1) || full1.includes(norm))) return true;
            if (full2 && (norm === full2 || norm.includes(full2) || full2.includes(norm))) return true;

            const nameParts = (u.nombres || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
            const apeParts = (u.apellidos || u.primer_apellido || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
            return nameParts.some(p => norm.includes(p)) && apeParts.some(p => norm.includes(p));
          });
          if (foundTech) break;
        }

        if (foundTech) {
          // Es un técnico de Céspedes (ej. Delia Vara)
          await pool.query(
            `UPDATE ordenes 
             SET 
               id_tecnico = ?,
               tecnico_asignado = ?,
               usuario_ejecutor_fenix = ?,
               hora_en_camino = COALESCE(hora_en_camino, ?),
               inicio_visita = COALESCE(inicio_visita, ?),
               fin_visita = COALESCE(fin_visita, ?)
             WHERE id_orden = ?`,
            [
              foundTech.id_usuario,
              `${foundTech.nombres} ${foundTech.apellidos || foundTech.primer_apellido || ''}`.trim(),
              tiempos.usuarioEjecutor,
              tiempos.horaEnCamino,
              tiempos.inicioVisita,
              tiempos.finVisita,
              o.id_orden
            ]
          );

          if (o.tecnico_asignado && o.tecnico_asignado.includes('EXTERNO')) {
            restauradosInternos.push({
              numero: o.numero,
              motivo: 'Técnico de campo real de Céspedes',
              restauradoA: `${foundTech.nombres} ${foundTech.apellidos || ''}`.trim()
            });
          }
        } else {
          // ES UN TÉCNICO EXTERNO REAL (ej. Erick Gallardo)
          const nuevoNombre = 'EXTERNO: ' + tiempos.usuarioEjecutor;
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

          externosReales.push({
            numero: o.numero,
            ejecutorCampo: tiempos.usuarioEjecutor,
            cuadrillaFenix: o.cuadrilla
          });
        }
      }
    } catch (err) {}
  }

  console.log("\n==================================================");
  console.log(`✅ Órdenes restauradas a su técnico legítimo de Céspedes (no eran externos): ${restauradosInternos.length}`);
  console.table(restauradosInternos);

  console.log(`\n🏷️ Órdenes de Técnicos EXTERNOS REALES DE CAMPO: ${externosReales.length}`);
  console.table(externosReales);

  process.exit(0);
}

rescanClean();
