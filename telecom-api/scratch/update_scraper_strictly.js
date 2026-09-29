const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'services', 'fenixScraper.js');
let content = fs.readFileSync(filePath, 'utf-8');

const normalize = str => str.replace(/\r\n/g, '\n');

// 1. Reemplazar extraerTiemposDeHistorial con la versión estricta
const oldExtract = `function extraerTiemposDeHistorial(historial) {
  let horaAsignacion = null;
  let horaEnCamino = null;
  let inicioVisita = null;
  let finVisita = null;

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

  return {
    horaAsignacion,
    horaEnCamino,
    inicioVisita,
    finVisita
  };
}`;

const newExtract = `function extraerTiemposDeHistorial(historial) {
  let horaAsignacion = null;
  let horaEnCamino = null;
  let inicioVisita = null;
  let finVisita = null;
  let usuarioEjecutor = null;

  if (!historial || !Array.isArray(historial)) {
    return { horaAsignacion, horaEnCamino, inicioVisita, finVisita, usuarioEjecutor };
  }

  // 1. Extraer hitos de tiempo
  for (const h of historial) {
    const st = (h.estado || '').toUpperCase();
    const parsedDate = parseDateToMySQL(h.fecha);
    if (!parsedDate) continue;

    if (st.includes('CAMINO') && !horaEnCamino) horaEnCamino = parsedDate;
    if ((st.includes('INICIA') || st.includes('PROCESO')) && !inicioVisita) inicioVisita = parsedDate;
    if ((st.includes('FINALIZ') || st.includes('LIQUID') || st.includes('TERMIN')) && !finVisita) finVisita = parsedDate;
    if ((st.includes('ASIGNA') || st.includes('AGENDA')) && !horaAsignacion) horaAsignacion = parsedDate;
  }

  // 2. Extraer usuario ejecutor de campo REAL (ESTRICTAMENTE en estados operativos: En camino, Iniciada, Revisión)
  // Estados administrativos como Pendiente, Agendada, Asignada, Anulada, Cancelada NO generan ejecutor.
  const filasCampo = historial.filter((h) => {
    const st = (h.estado || '').toUpperCase();
    const u = (h.usuario || '').trim();
    if (!u || /^(administrador|admin|sistema|central)$/i.test(u)) return false;
    return st.includes('CAMINO') || st.includes('INICIA') || st.includes('PROCESO') || st.includes('REVISI');
  });

  if (filasCampo.length > 0) {
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

if (normalize(content).includes(normalize(oldExtract))) {
  content = normalize(content).replace(normalize(oldExtract), normalize(newExtract));
  console.log("✅ extraerTiemposDeHistorial reemplazado exitosamente");
} else {
  console.log("⚠️ No se encontró exacto oldExtract");
}

// 2. Enriquecimiento en sincronizarFenix
const oldSync = `                if (tiempos.horaEnCamino) ord.hora_en_camino = tiempos.horaEnCamino;
                if (tiempos.inicioVisita) ord.inicio_visita = tiempos.inicioVisita;
                if (tiempos.finVisita) ord.fin_visita = tiempos.finVisita;
                if (tiempos.horaAsignacion) ord.hora_asignacion = tiempos.horaAsignacion;`;

const newSync = `                if (tiempos.horaEnCamino) ord.hora_en_camino = tiempos.horaEnCamino;
                if (tiempos.inicioVisita) ord.inicio_visita = tiempos.inicioVisita;
                if (tiempos.finVisita) ord.fin_visita = tiempos.finVisita;
                if (tiempos.horaAsignacion) ord.hora_asignacion = tiempos.horaAsignacion;
                if (tiempos.usuarioEjecutor) ord.usuario_ejecutor_fenix = tiempos.usuarioEjecutor;`;

if (normalize(content).includes(normalize(oldSync))) {
  content = normalize(content).replace(normalize(oldSync), normalize(newSync));
  console.log("✅ sincronizarFenix enriquecimiento actualizado");
}

// 3. Loop de matching en guardarOrdenesEnBD
const oldGuardar = `    try {
      const techInfo = findTechMatch(o.cuadrilla);
      const autoIdTecnico = techInfo?.id || null;
      const autoNombreTecnico = techInfo?.nombre || null;`;

const newGuardar = `    try {
      // Prioridad de matching inteligente: si hubo trabajo de campo real, validar ejecutor
      let techInfo = null;
      if (o.usuario_ejecutor_fenix) {
        techInfo = findTechMatch(o.usuario_ejecutor_fenix);
        if (techInfo && techInfo.isExternal) {
          techInfo.id = null;
          techInfo.nombre = 'EXTERNO: ' + o.usuario_ejecutor_fenix;
        }
      }
      if (!techInfo) {
        techInfo = findTechMatch(o.cuadrilla);
      }
      const autoIdTecnico = techInfo?.id || null;
      const autoNombreTecnico = techInfo?.nombre || null;`;

if (normalize(content).includes(normalize(oldGuardar))) {
  content = normalize(content).replace(normalize(oldGuardar), normalize(newGuardar));
  console.log("✅ guardarOrdenesEnBD loop de matching actualizado");
}

// 4. isExternal flag en findTechMatch
const oldMatchRet = `return found ? { id: found.id_usuario, nombre: \`\${found.nombres} \${found.apellidos || found.primer_apellido || ''}\`.trim() } : (rawName.length > 3 ? { id: null, nombre: rawName } : null);`;
const newMatchRet = `return found ? { id: found.id_usuario, nombre: \`\${found.nombres} \${found.apellidos || found.primer_apellido || ''}\`.trim(), isExternal: false } : (rawName.length > 3 ? { id: null, nombre: rawName, isExternal: true } : null);`;

if (normalize(content).includes(normalize(oldMatchRet))) {
  content = normalize(content).replace(normalize(oldMatchRet), normalize(newMatchRet));
  console.log("✅ findTechMatch isExternal flag actualizado");
}

// 5. UPDATE y INSERT persistiendo usuario_ejecutor_fenix
const oldUpd = `          fijo = COALESCE(?, fijo),
          sector_operativo = COALESCE(?, sector_operativo),
          suscripcion = COALESCE(NULLIF(?, ''), NULLIF(suscripcion, ''))
        WHERE numero = ?\`,
        [
          o.fecha_solicitud, o.cliente, o.inicio_visita, o.fin_visita,
          o.hora_en_camino, o.hora_asignacion,
          o.motivo_finalizacion, o.datos_tecnicos, autoTipoTrabajo || o.tipo_trabajo, autoTipoTrabajo, o.georeferencia,
          o.motivo_cancelacion, o.numero_documento, o.movil, o.codigo_seguimiento,
          o.region_zona, o.fecha_visita, o.fecha_solicitud, o.cod_seguimiento_cliente, o.direccion,
          o.estado, o.cuadrilla, o.cuadrilla, autoIdTecnico, autoNombreTecnico, o.tipo_orden, o.motivo, o.ubicacion, o.fecha_estado,
          o.motivo_anulacion, o.motivo_regestion, o.motivo_suspension, o.pais_empresa,
          o.email, o.tipo_ubicacion, o.codigo_postal, o.tipo_documento, o.producto,
          o.id_proyecto, o.proveedor, o.localidad, o.tipo_trabajo || o.motivo_trabajo, o.prioridad,
          o.historial_estados, o.fijo, o.sector_operativo, o.suscripcion,
          o.numero
        ]`;

const newUpd = `          fijo = COALESCE(?, fijo),
          sector_operativo = COALESCE(?, sector_operativo),
          suscripcion = COALESCE(NULLIF(?, ''), NULLIF(suscripcion, '')),
          usuario_ejecutor_fenix = COALESCE(?, usuario_ejecutor_fenix)
        WHERE numero = ?\`,
        [
          o.fecha_solicitud, o.cliente, o.inicio_visita, o.fin_visita,
          o.hora_en_camino, o.hora_asignacion,
          o.motivo_finalizacion, o.datos_tecnicos, autoTipoTrabajo || o.tipo_trabajo, autoTipoTrabajo, o.georeferencia,
          o.motivo_cancelacion, o.numero_documento, o.movil, o.codigo_seguimiento,
          o.region_zona, o.fecha_visita, o.fecha_solicitud, o.cod_seguimiento_cliente, o.direccion,
          o.estado, o.cuadrilla, o.cuadrilla, autoIdTecnico, autoNombreTecnico, o.tipo_orden, o.motivo, o.ubicacion, o.fecha_estado,
          o.motivo_anulacion, o.motivo_regestion, o.motivo_suspension, o.pais_empresa,
          o.email, o.tipo_ubicacion, o.codigo_postal, o.tipo_documento, o.producto,
          o.id_proyecto, o.proveedor, o.localidad, o.tipo_trabajo || o.motivo_trabajo, o.prioridad,
          o.historial_estados, o.fijo, o.sector_operativo, o.suscripcion,
          o.usuario_ejecutor_fenix,
          o.numero
        ]`;

if (normalize(content).includes(normalize(oldUpd))) {
  content = normalize(content).replace(normalize(oldUpd), normalize(newUpd));
  console.log("✅ UPDATE query actualizado");
}

const oldIns = `            historial_estados, fijo, sector_operativo, suscripcion, fecha_creacion
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())\`,
          [
            o.numero, o.fecha_solicitud, o.cliente, o.inicio_visita, o.fin_visita,
            o.hora_en_camino, o.hora_asignacion,
            o.motivo_finalizacion, o.datos_tecnicos, autoTipoTrabajo, autoTipoTrabajo || o.tipo_trabajo, o.georeferencia,
            o.motivo_cancelacion, o.numero_documento, o.movil, o.codigo_seguimiento,
            o.region_zona, (o.fecha_visita || o.fecha_solicitud), o.cod_seguimiento_cliente, o.direccion,
            o.estado, o.cuadrilla, o.cuadrilla, autoIdTecnico, autoNombreTecnico, o.tipo_orden, o.motivo, o.ubicacion, o.fecha_estado,
            o.motivo_anulacion, o.motivo_regestion, o.motivo_suspension, o.pais_empresa,
            o.email, o.tipo_ubicacion, o.codigo_postal, o.tipo_documento, o.producto,
            o.id_proyecto, o.proveedor, o.localidad, o.tipo_trabajo || o.motivo_trabajo, o.prioridad,
            o.historial_estados, o.fijo, o.sector_operativo, o.suscripcion
          ]`;

const newIns = `            historial_estados, fijo, sector_operativo, suscripcion, usuario_ejecutor_fenix, fecha_creacion
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())\`,
          [
            o.numero, o.fecha_solicitud, o.cliente, o.inicio_visita, o.fin_visita,
            o.hora_en_camino, o.hora_asignacion,
            o.motivo_finalizacion, o.datos_tecnicos, autoTipoTrabajo, autoTipoTrabajo || o.tipo_trabajo, o.georeferencia,
            o.motivo_cancelacion, o.numero_documento, o.movil, o.codigo_seguimiento,
            o.region_zona, (o.fecha_visita || o.fecha_solicitud), o.cod_seguimiento_cliente, o.direccion,
            o.estado, o.cuadrilla, o.cuadrilla, autoIdTecnico, autoNombreTecnico, o.tipo_orden, o.motivo, o.ubicacion, o.fecha_estado,
            o.motivo_anulacion, o.motivo_regestion, o.motivo_suspension, o.pais_empresa,
            o.email, o.tipo_ubicacion, o.codigo_postal, o.tipo_documento, o.producto,
            o.id_proyecto, o.proveedor, o.localidad, o.tipo_trabajo || o.motivo_trabajo, o.prioridad,
            o.historial_estados, o.fijo, o.sector_operativo, o.suscripcion, o.usuario_ejecutor_fenix
          ]`;

if (normalize(content).includes(normalize(oldIns))) {
  content = normalize(content).replace(normalize(oldIns), normalize(newIns));
  console.log("✅ INSERT query actualizado");
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log("🎉 fenixScraper.js actualizado limpiamente");
