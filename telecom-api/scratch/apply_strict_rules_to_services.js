const fs = require('fs');
const path = require('path');

const normalize = str => str.replace(/\r\n/g, '\n');

// 1. UPDATE fenixScraper.js
const fenixPath = path.join(__dirname, '..', 'services', 'fenixScraper.js');
let fenixContent = fs.readFileSync(fenixPath, 'utf-8');

const newExtractFn = `/**
 * 10. Extrae los hitos de tiempo y el usuario ejecutor real a partir del historial de estados
 * REGLA ESTRICTA: Solo se extrae ejecutor si hubo estados de CAMPO REALES (En camino, Iniciada, Revisión).
 * Estados administrativos (Pendiente, Agendada, Asignada, Anulada, Cancelada) NO generan ejecutor externo.
 */
function extraerTiemposDeHistorial(historial) {
  let horaAsignacion = null;
  let horaEnCamino = null;
  let inicioVisita = null;
  let finVisita = null;
  let usuarioEjecutor = null;

  if (!historial || !Array.isArray(historial)) {
    return {
      horaAsignacion,
      horaEnCamino,
      inicioVisita,
      finVisita,
      usuarioEjecutor
    };
  }

  // 1. Extraer hitos de tiempo
  for (const h of historial) {
    const st = (h.estado || '').toUpperCase();
    const parsedDate = parseDateToMySQL(h.fecha);
    if (!parsedDate) continue;

    if (st.includes('CAMINO') && !horaEnCamino) {
      horaEnCamino = parsedDate;
    }
    if ((st.includes('INICIA') || st.includes('PROCESO')) && !inicioVisita) {
      inicioVisita = parsedDate;
    }
    if ((st.includes('FINALIZ') || st.includes('LIQUID') || st.includes('TERMIN')) && !finVisita) {
      finVisita = parsedDate;
    }
    if ((st.includes('ASIGNA') || st.includes('AGENDA')) && !horaAsignacion) {
      horaAsignacion = parsedDate;
    }
  }

  // 2. Extraer usuario ejecutor de campo REAL (ESTRICTAMENTE en estados operativos: En camino, Iniciada, Revisión)
  const filasCampo = historial.filter((h) => {
    const st = (h.estado || '').toUpperCase();
    const u = (h.usuario || '').trim();
    if (!u || /^(administrador|admin|sistema|central)$/i.test(u)) return false;
    return st.includes('CAMINO') || st.includes('INICIA') || st.includes('PROCESO') || st.includes('REVISI');
  });

  if (filasCampo.length > 0) {
    // Priorizar estado de Revisión o Iniciada con duración
    const opRow = filasCampo.find(h => {
      const st = (h.estado || '').toUpperCase();
      return st.includes('REVISI') || st.includes('INICIA') || st.includes('CAMINO');
    }) || filasCampo[0];
    usuarioEjecutor = opRow.usuario.trim();
  }

  return {
    horaAsignacion,
    horaEnCamino,
    inicioVisita,
    finVisita,
    usuarioEjecutor
  };
}`;

const oldExtractRegex = /\/\*\*[\s\S]*?10\.\s*Extrae[\s\S]*?function extraerTiemposDeHistorial[\s\S]*?return \{[\s\S]*?\};\s*\}/;

if (oldExtractRegex.test(normalize(fenixContent))) {
  fenixContent = normalize(fenixContent).replace(oldExtractRegex, newExtractFn);
  fs.writeFileSync(fenixPath, fenixContent, 'utf-8');
  console.log("✅ fenixScraper.js extraerTiemposDeHistorial actualizado con reglas estrictas");
} else {
  console.log("⚠️ No se pudo reemplazar con regex en fenixScraper.js");
}

// 2. UPDATE server.js
const serverPath = path.join(__dirname, '..', 'server.js');
let serverContent = fs.readFileSync(serverPath, 'utf-8');

const newHistorialEndpoint = `// --- 1.4 OBTENER HISTORIAL DE ESTADOS DE UNA ORDEN (Y ENRIQUECER HORARIOS, ESTADO REAL Y EJECUTOR) ---
app.get('/ordenes/:numero/historial-estados', async (req, res) => {
  try {
    const { numero } = req.params;
    const historial = await obtenerHistorialEstados(numero);
    let estadoActualizado = null;
    let tecnicoActualizado = null;
    let idTecnicoActualizado = null;
    
    // Si se obtuvieron hitos de tiempo, estado o ejecutor, enriquecer automáticamente la BD
    if (historial && historial.length > 0) {
      const tiempos = extraerTiemposDeHistorial(historial);
      const ultimoEstadoFenix = historial[0]?.estado ? String(historial[0].estado).trim() : null;

      // Obtener estado actual de la orden y si tiene asignación manual
      const [ordRows] = await pool.query(
        "SELECT id_orden, numero, asignacion_manual, id_tecnico, tecnico_asignado, cuadrilla FROM ordenes WHERE numero = ? OR id_orden = ? LIMIT 1",
        [numero, numero]
      );
      const ordenActual = ordRows[0] || null;
      const esManual = Boolean(ordenActual && (ordenActual.asignacion_manual === 1 || ordenActual.asignacion_manual === true || ordenActual.asignacion_manual === '1'));

      let autoIdTecnico = ordenActual ? ordenActual.id_tecnico : null;
      let autoNombreTecnico = ordenActual ? ordenActual.tecnico_asignado : null;

      // Si NO tiene asignación manual y SÍ hubo trabajo de campo real (En camino / Iniciada / Revisión)
      if (!esManual && tiempos.usuarioEjecutor) {
        const [techUsers] = await pool.query("SELECT id_usuario, nombres, apellidos, primer_apellido, segundo_apellido FROM usuarios");
        
        // Verificar si alguna fila de campo pertenece a un técnico de Céspedes (prioridad absoluta a técnicos internos)
        const filasCampo = historial.filter((h) => {
          const st = (h.estado || '').toUpperCase();
          const u = (h.usuario || '').trim();
          if (!u || /^(administrador|admin|sistema|central)$/i.test(u)) return false;
          return st.includes('CAMINO') || st.includes('INICIA') || st.includes('PROCESO') || st.includes('REVISI');
        });

        let foundTech = null;
        for (const h of filasCampo) {
          const norm = String(h.usuario).toUpperCase().trim();
          foundTech = (techUsers || []).find((u) => {
            const full1 = \`\${u.nombres || ''} \${u.apellidos || ''}\`.toUpperCase().trim();
            const full2 = \`\${u.nombres || ''} \${u.primer_apellido || ''} \${u.segundo_apellido || ''}\`.toUpperCase().trim();
            if (full1 && (norm === full1 || norm.includes(full1) || full1.includes(norm))) return true;
            if (full2 && (norm === full2 || norm.includes(full2) || full2.includes(norm))) return true;

            const nameParts = (u.nombres || '').toUpperCase().split(/\\s+/).filter(p => p.length > 2);
            const apeParts = (u.apellidos || u.primer_apellido || '').toUpperCase().split(/\\s+/).filter(p => p.length > 2);
            return nameParts.some(p => norm.includes(p)) && apeParts.some(p => norm.includes(p));
          });
          if (foundTech) break;
        }

        if (foundTech) {
          autoIdTecnico = foundTech.id_usuario;
          autoNombreTecnico = \`\${foundTech.nombres} \${foundTech.apellidos || foundTech.primer_apellido || ''}\`.trim();
        } else {
          // Técnico externo REAL de campo (no es admin/central y estuvo en camino/iniciada)
          autoIdTecnico = null;
          autoNombreTecnico = 'EXTERNO: ' + tiempos.usuarioEjecutor;
        }
      }

      // Lista de estados oficiales de Fénix
      const esEstadoFenixSolido = ultimoEstadoFenix && [
        'Finalizada', 'Liquidada', 'Cancelada', 'Anulada', 'Regestión', 'Regestion', 'Iniciada', 'En camino', 'Agendada'
      ].includes(ultimoEstadoFenix);

      const [updateRes] = await pool.query(
        \`UPDATE ordenes 
         SET 
           estado = CASE 
             WHEN UPPER(estado) = 'LIQUIDADA' THEN estado 
             WHEN ? IS NOT NULL THEN ? 
             ELSE estado 
           END,
           hora_en_camino = COALESCE(hora_en_camino, ?),
           inicio_visita = COALESCE(inicio_visita, ?),
           fin_visita = COALESCE(fin_visita, ?),
           hora_asignacion = COALESCE(hora_asignacion, ?),
           usuario_ejecutor_fenix = ?,
           id_tecnico = CASE WHEN asignacion_manual = 1 THEN id_tecnico ELSE ? END,
           tecnico_asignado = CASE WHEN asignacion_manual = 1 THEN tecnico_asignado ELSE ? END
         WHERE numero = ? OR id_orden = ?\`,
        [
          esEstadoFenixSolido ? ultimoEstadoFenix : null,
          esEstadoFenixSolido ? ultimoEstadoFenix : null,
          tiempos.horaEnCamino,
          tiempos.inicioVisita,
          tiempos.finVisita,
          tiempos.horaAsignacion,
          tiempos.usuarioEjecutor || null,
          autoIdTecnico,
          autoNombreTecnico,
          numero,
          numero
        ]
      ).catch((err) => {
        console.error("Aviso al enriquecer estado desde historial:", err.message);
        return [{}];
      });

      if (updateRes && updateRes.affectedRows > 0) {
        if (esEstadoFenixSolido) estadoActualizado = ultimoEstadoFenix;
        tecnicoActualizado = autoNombreTecnico;
        idTecnicoActualizado = autoIdTecnico;
      }
    }
    
    res.json({ 
      success: true, 
      numero, 
      historial, 
      estadoActual: estadoActualizado || historial?.[0]?.estado || null,
      tecnicoAsignado: tecnicoActualizado,
      idTecnico: idTecnicoActualizado
    });
  } catch (error) {
    console.error("Error al obtener historial de estados:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});`;

const oldServerRegex = /\/\/\s*---\s*1\.4\s*OBTENER\s*HISTORIAL\s*DE\s*ESTADOS[\s\S]*?app\.get\('\/ordenes\/:numero\/historial-estados'[\s\S]*?res\.status\(500\)[\s\S]*?\}\);\s*\}/;

if (oldServerRegex.test(normalize(serverContent))) {
  serverContent = normalize(serverContent).replace(oldServerRegex, newHistorialEndpoint);
  fs.writeFileSync(serverPath, serverContent, 'utf-8');
  console.log("✅ server.js /ordenes/:numero/historial-estados actualizado con reglas estrictas");
} else {
  console.log("⚠️ No se pudo reemplazar endpoint en server.js con regex");
}
