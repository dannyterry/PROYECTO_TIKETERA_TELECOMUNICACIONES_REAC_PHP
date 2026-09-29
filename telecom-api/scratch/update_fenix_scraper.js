const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'services', 'fenixScraper.js');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Update extraerTiemposDeHistorial
const oldExtractFn = `function extraerTiemposDeHistorial(historial) {
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

const newExtractFn = `function extraerTiemposDeHistorial(historial) {
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

  // Extraer usuario ejecutor real (quien operó en la app móvil)
  for (const h of historial) {
    const st = (h.estado || '').toUpperCase();
    const u = (h.usuario || '').trim();
    if (!u || /^(administrador|admin|sistema|central)$/i.test(u)) continue;

    if (st.includes('REVISI') || st.includes('INICIA') || st.includes('PROCESO') || st.includes('CAMINO')) {
      usuarioEjecutor = u;
      break;
    }
  }

  if (!usuarioEjecutor) {
    for (const h of historial) {
      const st = (h.estado || '').toUpperCase();
      const u = (h.usuario || '').trim();
      if (!u || /^(administrador|admin|sistema|central)$/i.test(u)) continue;
      if (!st.includes('PENDIENTE') && !st.includes('AGENDADA') && !st.includes('ASIGNADA')) {
        usuarioEjecutor = u;
        break;
      }
    }
  }

  return {
    horaAsignacion,
    horaEnCamino,
    inicioVisita,
    finVisita,
    usuarioEjecutor
  };
}`;

// Normalize line endings for replacement
const normalize = str => str.replace(/\r\n/g, '\n');

if (normalize(content).includes(normalize(oldExtractFn))) {
  content = normalize(content).replace(normalize(oldExtractFn), normalize(newExtractFn));
  console.log("✅ extraerTiemposDeHistorial actualizado");
} else {
  console.log("⚠️ No se encontró exacto oldExtractFn");
}

// 2. Update enriquecimiento en sincronizarFenix
const oldSyncEnrich = `                if (tiempos.horaEnCamino) ord.hora_en_camino = tiempos.horaEnCamino;
                if (tiempos.inicioVisita) ord.inicio_visita = tiempos.inicioVisita;
                if (tiempos.finVisita) ord.fin_visita = tiempos.finVisita;
                if (tiempos.horaAsignacion) ord.hora_asignacion = tiempos.horaAsignacion;`;

const newSyncEnrich = `                if (tiempos.horaEnCamino) ord.hora_en_camino = tiempos.horaEnCamino;
                if (tiempos.inicioVisita) ord.inicio_visita = tiempos.inicioVisita;
                if (tiempos.finVisita) ord.fin_visita = tiempos.finVisita;
                if (tiempos.horaAsignacion) ord.hora_asignacion = tiempos.horaAsignacion;
                if (tiempos.usuarioEjecutor) ord.usuario_ejecutor_fenix = tiempos.usuarioEjecutor;`;

if (normalize(content).includes(normalize(oldSyncEnrich))) {
  content = normalize(content).replace(normalize(oldSyncEnrich), normalize(newSyncEnrich));
  console.log("✅ sincronizarFenix enriquecimiento actualizado");
}

// 3. Update guardarOrdenesEnBD matching & columns
const oldGuardarLoop = `    try {
      const techInfo = findTechMatch(o.cuadrilla);
      const autoIdTecnico = techInfo?.id || null;
      const autoNombreTecnico = techInfo?.nombre || null;`;

const newGuardarLoop = `    try {
      // Prioridad de auto-matching: si tenemos el usuario ejecutor real del historial de Fénix, validarlo primero
      let techInfo = null;
      if (o.usuario_ejecutor_fenix) {
        techInfo = findTechMatch(o.usuario_ejecutor_fenix);
        // Si no se encuentra en usuarios de Céspedes (isExternal), marcar id_tecnico = null y nombre = 'EXTERNO: ...'
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

if (normalize(content).includes(normalize(oldGuardarLoop))) {
  content = normalize(content).replace(normalize(oldGuardarLoop), normalize(newGuardarLoop));
  console.log("✅ guardarOrdenesEnBD loop de matching actualizado");
}

// 4. Update findTechMatch inside guardarOrdenesEnBD to return isExternal flag
const oldFindTechMatchReturn = `return found ? { id: found.id_usuario, nombre: \`\${found.nombres} \${found.apellidos || found.primer_apellido || ''}\`.trim() } : (rawName.length > 3 ? { id: null, nombre: rawName } : null);`;
const newFindTechMatchReturn = `return found ? { id: found.id_usuario, nombre: \`\${found.nombres} \${found.apellidos || found.primer_apellido || ''}\`.trim(), isExternal: false } : (rawName.length > 3 ? { id: null, nombre: rawName, isExternal: true } : null);`;

if (normalize(content).includes(normalize(oldFindTechMatchReturn))) {
  content = normalize(content).replace(normalize(oldFindTechMatchReturn), normalize(newFindTechMatchReturn));
  console.log("✅ findTechMatch isExternal flag actualizado");
}

// 5. Update UPDATE & INSERT queries in guardarOrdenesEnBD to persist usuario_ejecutor_fenix
const oldUpdateQuery = `          fijo = COALESCE(?, fijo),
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

const newUpdateQuery = `          fijo = COALESCE(?, fijo),
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

if (normalize(content).includes(normalize(oldUpdateQuery))) {
  content = normalize(content).replace(normalize(oldUpdateQuery), normalize(newUpdateQuery));
  console.log("✅ UPDATE query con usuario_ejecutor_fenix actualizado");
}

const oldInsertQuery = `            historial_estados, fijo, sector_operativo, suscripcion, fecha_creacion
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

const newInsertQuery = `            historial_estados, fijo, sector_operativo, suscripcion, usuario_ejecutor_fenix, fecha_creacion
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

if (normalize(content).includes(normalize(oldInsertQuery))) {
  content = normalize(content).replace(normalize(oldInsertQuery), normalize(newInsertQuery));
  console.log("✅ INSERT query con usuario_ejecutor_fenix actualizado");
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log("🎉 fenixScraper.js guardado exitosamente");
