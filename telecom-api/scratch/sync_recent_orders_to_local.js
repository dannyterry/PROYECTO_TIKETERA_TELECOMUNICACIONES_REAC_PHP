const mysql = require('mysql2/promise');

const localConfig = {
  host: '127.0.0.1', port: 3306, user: 'root', password: '', database: 'corporacioncespe_cespedes'
};
const remoteConfig = {
  host: 'corporacioncespedes.com', port: 3306, user: 'corporacioncespe_miguel', password: 'corporacioncespe_123', database: 'corporacioncespe_cespedes'
};

async function main() {
  console.log('🔄 Sincronizando órdenes de hosting a local...');
  const localPool = mysql.createPool(localConfig);
  const remotePool = mysql.createPool(remoteConfig);

  const [remoteOrders] = await remotePool.query(`
    SELECT * FROM ordenes 
    WHERE (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
       OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
  `);
  console.log(`📡 Órdenes descargadas de Hosting (Septiembre 01 al 29): ${remoteOrders.length}`);

  let updated = 0;
  let inserted = 0;

  for (const o of remoteOrders) {
    let estadoReal = o.estado;
    const motFin = String(o.motivo_finalizacion || '').toUpperCase();
    const motCanc = String(o.motivo_cancelacion || '').toUpperCase();
    if (/CANCELAD|NO REALIZAD/i.test(motFin) || /CANCELAD/i.test(motCanc)) {
      if (/finalizad|liquidad/i.test(estadoReal)) {
        estadoReal = 'Observada';
      }
    }

    const [upd] = await localPool.query(
      `UPDATE ordenes SET
        fecha_solicitud = ?, cliente = ?, inicio_visita = ?, fin_visita = ?,
        hora_en_camino = ?, hora_asignacion = ?, motivo_finalizacion = ?, datos_tecnicos = ?,
        tipo_trabajo = ?, tipo_trabajo_asignado = ?, georeferencia = ?, motivo_cancelacion = ?,
        numero_documento = ?, movil = ?, codigo_seguimiento = ?, region_zona = ?, fecha_visita = ?,
        cod_seguimiento_cliente = ?, direccion = ?, estado = ?, cuadrilla = ?, cuadrilla_origen_fenix = ?,
        id_tecnico = ?, tecnico_asignado = ?, tipo_orden = ?, motivo = ?, ubicacion = ?, fecha_estado = ?,
        motivo_anulacion = ?, motivo_regestion = ?, motivo_suspension = ?, pais_empresa = ?,
        email = ?, tipo_ubicacion = ?, codigo_postal = ?, tipo_documento = ?, producto = ?,
        id_proyecto = ?, proveedor = ?, localidad = ?, motivo_trabajo = ?, prioridad = ?,
        historial_estados = ?, fijo = ?, sector_operativo = ?, suscripcion = ?, usuario_ejecutor_fenix = ?
      WHERE numero = ?`,
      [
        o.fecha_solicitud, o.cliente, o.inicio_visita, o.fin_visita,
        o.hora_en_camino, o.hora_asignacion, o.motivo_finalizacion, o.datos_tecnicos,
        o.tipo_trabajo, o.tipo_trabajo_asignado, o.georeferencia, o.motivo_cancelacion,
        o.numero_documento, o.movil, o.codigo_seguimiento, o.region_zona, o.fecha_visita,
        o.cod_seguimiento_cliente, o.direccion, estadoReal, o.cuadrilla, o.cuadrilla_origen_fenix,
        o.id_tecnico, o.tecnico_asignado, o.tipo_orden, o.motivo, o.ubicacion, o.fecha_estado,
        o.motivo_anulacion, o.motivo_regestion, o.motivo_suspension, o.pais_empresa,
        o.email, o.tipo_ubicacion, o.codigo_postal, o.tipo_documento, o.producto,
        o.id_proyecto, o.proveedor, o.localidad, o.motivo_trabajo, o.prioridad,
        o.historial_estados, o.fijo, o.sector_operativo, o.suscripcion, o.usuario_ejecutor_fenix,
        o.numero
      ]
    );

    if (upd.affectedRows === 0) {
      await localPool.query(
        `INSERT INTO ordenes (
          numero, fecha_solicitud, cliente, inicio_visita, fin_visita,
          hora_en_camino, hora_asignacion, motivo_finalizacion, datos_tecnicos,
          tipo_trabajo, tipo_trabajo_asignado, georeferencia, motivo_cancelacion,
          numero_documento, movil, codigo_seguimiento, region_zona, fecha_visita,
          cod_seguimiento_cliente, direccion, estado, cuadrilla, cuadrilla_origen_fenix,
          id_tecnico, tecnico_asignado, tipo_orden, motivo, ubicacion, fecha_estado,
          motivo_anulacion, motivo_regestion, motivo_suspension, pais_empresa,
          email, tipo_ubicacion, codigo_postal, tipo_documento, producto,
          id_proyecto, proveedor, localidad, motivo_trabajo, prioridad,
          historial_estados, fijo, sector_operativo, suscripcion, usuario_ejecutor_fenix, fecha_creacion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          o.numero, o.fecha_solicitud, o.cliente, o.inicio_visita, o.fin_visita,
          o.hora_en_camino, o.hora_asignacion, o.motivo_finalizacion, o.datos_tecnicos,
          o.tipo_trabajo, o.tipo_trabajo_asignado, o.georeferencia, o.motivo_cancelacion,
          o.numero_documento, o.movil, o.codigo_seguimiento, o.region_zona, o.fecha_visita,
          o.cod_seguimiento_cliente, o.direccion, estadoReal, o.cuadrilla, o.cuadrilla_origen_fenix,
          o.id_tecnico, o.tecnico_asignado, o.tipo_orden, o.motivo, o.ubicacion, o.fecha_estado,
          o.motivo_anulacion, o.motivo_regestion, o.motivo_suspension, o.pais_empresa,
          o.email, o.tipo_ubicacion, o.codigo_postal, o.tipo_documento, o.producto,
          o.id_proyecto, o.proveedor, o.localidad, o.motivo_trabajo, o.prioridad,
          o.historial_estados, o.fijo, o.sector_operativo, o.suscripcion, o.usuario_ejecutor_fenix
        ]
      );
      inserted++;
    } else {
      updated++;
    }
  }

  console.log(`✅ Sincronización terminada: ${inserted} nuevas insertadas, ${updated} actualizadas.`);

  const [countsLocal] = await localPool.query(`
    SELECT estado, count(*) as cantidad 
    FROM ordenes 
    WHERE (
      (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
      OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
    )
    GROUP BY estado
    ORDER BY cantidad DESC
  `);
  console.log('\n📊 CONTEO FINAL LOCAL SEPTIEMBRE (01 al 29 Sep):');
  console.table(countsLocal);

  const [resumen] = await localPool.query(`
    SELECT 
      SUM(CASE WHEN estado IN ('Finalizada', 'Liquidada') THEN 1 ELSE 0 END) as Total_Finalizadas_Y_Liquidadas,
      SUM(CASE WHEN estado = 'Finalizada' THEN 1 ELSE 0 END) as Finalizadas,
      SUM(CASE WHEN estado = 'Liquidada' THEN 1 ELSE 0 END) as Liquidadas,
      SUM(CASE WHEN estado = 'Cancelada' THEN 1 ELSE 0 END) as Canceladas,
      SUM(CASE WHEN estado = 'Anulada' THEN 1 ELSE 0 END) as Anuladas,
      SUM(CASE WHEN estado = 'Regestión' THEN 1 ELSE 0 END) as Regestion,
      SUM(CASE WHEN estado = 'Iniciada' THEN 1 ELSE 0 END) as Iniciadas,
      SUM(CASE WHEN estado = 'Agendada' THEN 1 ELSE 0 END) as Agendadas,
      SUM(CASE WHEN estado = 'Observada' THEN 1 ELSE 0 END) as Observadas,
      COUNT(*) as TotalGeneral
    FROM ordenes 
    WHERE (
      (fecha_visita >= '2026-09-01 00:00:00' AND fecha_visita <= '2026-09-29 23:59:59')
      OR (fecha_visita IS NULL AND fecha_solicitud >= '2026-09-01 00:00:00' AND fecha_solicitud <= '2026-09-29 23:59:59')
    )
  `);
  console.log('\n📊 RESUMEN TABULAR COMPARATIVO:');
  console.table(resumen);

  await localPool.end();
  await remotePool.end();
}

main().catch(console.error);
