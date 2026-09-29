const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'server.js');
let content = fs.readFileSync(filePath, 'utf-8');

const normalize = str => str.replace(/\r\n/g, '\n');

const oldEndpoint = `// --- 1.4 OBTENER HISTORIAL DE ESTADOS DE UNA ORDEN (Y ENRIQUECER HORARIOS Y ESTADO REAL) ---
app.get('/ordenes/:numero/historial-estados', async (req, res) => {
  try {
    const { numero } = req.params;
    const historial = await obtenerHistorialEstados(numero);
    let estadoActualizado = null;
    
    // Si se obtuvieron hitos de tiempo o estado, enriquecer automáticamente la BD
    if (historial && historial.length > 0) {
      const tiempos = extraerTiemposDeHistorial(historial);
      const ultimoEstadoFenix = historial[0]?.estado ? String(historial[0].estado).trim() : null;

      // Lista de estados oficiales de Fénix
      const esEstadoFenixSolido = ultimoEstadoFenix && [
        'Finalizada', 'Liquidada', 'Cancelada', 'Anulada', 'Regestión', 'Regestion', 'Iniciada', 'En camino', 'Agendada'
      ].includes(ultimoEstadoFenix);

      if (esEstadoFenixSolido) {
        // Actualizar la orden preservando si ya estaba Liquidada localmente
        const [updateRes] = await pool.query(
          \`UPDATE ordenes 
           SET 
             estado = CASE 
               WHEN UPPER(estado) = 'LIQUIDADA' THEN estado 
               ELSE ? 
             END,
             hora_en_camino = COALESCE(hora_en_camino, ?),
             inicio_visita = COALESCE(inicio_visita, ?),
             fin_visita = COALESCE(fin_visita, ?),
             hora_asignacion = COALESCE(hora_asignacion, ?)
           WHERE numero = ? OR id_orden = ?\`,
          [
            ultimoEstadoFenix,
            tiempos.horaEnCamino,
            tiempos.inicioVisita,
            tiempos.finVisita,
            tiempos.horaAsignacion,
            numero,
            numero
          ]
        ).catch((err) => {
          console.error("Aviso al enriquecer estado desde historial:", err.message);
          return [{}];
        });

        if (updateRes && updateRes.affectedRows > 0) {
          estadoActualizado = ultimoEstadoFenix;
        }
      } else if (tiempos.horaEnCamino || tiempos.inicioVisita || tiempos.finVisita || tiempos.horaAsignacion) {
        await pool.query(
          \`UPDATE ordenes 
           SET 
             hora_en_camino = COALESCE(hora_en_camino, ?),
             inicio_visita = COALESCE(inicio_visita, ?),
             fin_visita = COALESCE(fin_visita, ?),
             hora_asignacion = COALESCE(hora_asignacion, ?)
           WHERE numero = ? OR id_orden = ?\`,
          [
            tiempos.horaEnCamino,
            tiempos.inicioVisita,
            tiempos.finVisita,
            tiempos.horaAsignacion,
            numero,
            numero
          ]
        ).catch(() => {});
      }
    }
    
    res.json({ success: true, numero, historial, estadoActual: estadoActualizado || historial?.[0]?.estado || null });
  } catch (error) {
    console.error("Error al obtener historial de estados:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});`;

const newEndpoint = `// --- 1.4 OBTENER HISTORIAL DE ESTADOS DE UNA ORDEN (Y ENRIQUECER HORARIOS, ESTADO REAL Y EJECUTOR) ---
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

      // Si NO tiene asignación manual, evaluar ejecutor real vs usuarios de Céspedes
      if (!esManual && tiempos.usuarioEjecutor) {
        const [techUsers] = await pool.query("SELECT id_usuario, nombres, apellidos, primer_apellido, segundo_apellido FROM usuarios");
        const normRaw = String(tiempos.usuarioEjecutor).toUpperCase().trim();
        
        const found = (techUsers || []).find((u) => {
          const full1 = \`\${u.nombres || ''} \${u.apellidos || ''}\`.toUpperCase().trim();
          const full2 = \`\${u.nombres || ''} \${u.primer_apellido || ''} \${u.segundo_apellido || ''}\`.toUpperCase().trim();
          if (full1 && normRaw === full1) return true;
          if (full2 && normRaw === full2) return true;
          if (full1 && (normRaw.includes(full1) || full1.includes(normRaw))) return true;

          const nameParts = (u.nombres || '').toUpperCase().split(/\\s+/).filter(p => p.length > 2);
          const apeParts = (u.apellidos || u.primer_apellido || '').toUpperCase().split(/\\s+/).filter(p => p.length > 2);
          const hasName = nameParts.some(p => normRaw.includes(p));
          const hasApe = apeParts.some(p => normRaw.includes(p));
          return hasName && hasApe;
        });

        if (found) {
          autoIdTecnico = found.id_usuario;
          autoNombreTecnico = \`\${found.nombres} \${found.apellidos || found.primer_apellido || ''}\`.trim();
        } else {
          // Técnico externo / otra contrata / supervisor WIN
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
           usuario_ejecutor_fenix = COALESCE(?, usuario_ejecutor_fenix),
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
          tiempos.usuarioEjecutor,
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

if (normalize(content).includes(normalize(oldEndpoint))) {
  content = normalize(content).replace(normalize(oldEndpoint), normalize(newEndpoint));
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log("✅ Endpoint /ordenes/:numero/historial-estados actualizado con éxito en server.js");
} else {
  console.error("❌ No se encontró el bloque exacto del endpoint en server.js");
}
