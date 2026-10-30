'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { uploadFotoActa } = require('../middleware/upload');
const { requireAuth, signToken } = require('../middleware/requireAuth');
const { uploadFileToS3, uploadBufferToS3, getS3ObjectStream, checkS3ObjectExists, getS3SignedUrl } = require('../services/s3Service');
const path = require('path');
const fs = require('fs');

const { sincronizarTareasOrdenSeguro, getTareasDeBD, sincronizarTareasOrdenesActivas, guardarDetalleTareaEnBD, getMetrajeDeclaradoFenix } = require('../services/taskSyncService');
const { getMotivosCatalogo, resolverTipoTrabajoConCatalogo, resolverTipoTrabajoOficial, normalizeText } = require('../services/tipoTrabajoHelper');

// ─── RUTAS MÓDULO: ALMACEN ───────────────────────────────────────

router.get(['/equipos-generales', '/almacen/equipos-generales'], async (req, res) => {
  try {
    const {
      search = '',
      id_producto,
      subtab = 'all',
      mes,
      anio,
      semana,
      fecha_desde,
      fecha_hasta,
      tipo_fecha = 'ingreso_win',
      almacen,
      estado,
      id_trabajador,
      limit = 1500,
      offset = 0
    } = req.query;

    const whereConditions = [];
    const params = [];

    // Búsqueda global por Serie S/N, MAC, Serie Interna, N° Acta, N° Guía, Cliente, Técnico, etc.
    if (search && search.trim() !== '') {
      const s = `%${search.trim()}%`;
      whereConditions.push(`(
        ps.numero_serie LIKE ? OR
        ps.id_equipo LIKE ? OR
        ps.mac LIKE ? OR
        p.nombre LIKE ? OR
        p.codigo LIKE ? OR
        ol.numero_acta LIKE ? OR
        ol.numero_guia LIKE ? OR
        o.cliente LIKE ? OR
        u.nombres LIKE ? OR
        u.primer_apellido LIKE ? OR
        u.apellidos LIKE ? OR
        oer.numero_serie LIKE ?
      )`);
      params.push(s, s, s, s, s, s, s, s, s, s, s, s);
    }

    // Filtro por ID de Producto
    if (id_producto && !isNaN(Number(id_producto))) {
      whereConditions.push(`ps.id_producto = ?`);
      params.push(Number(id_producto));
    }

    // Filtro obligatorio: SOLO EQUIPOS DE TELECOMUNICACIONES (Excluye actas de papel y materiales)
    whereConditions.push(`(
      (c.nombre = 'EQUIPOS' 
       OR p.codigo IN ('HWA', 'ZTA', 'HWB', 'ZTB', 'WTA', 'TLA') 
       OR p.nombre LIKE '%ONT%' 
       OR p.nombre LIKE '%MESH%' 
       OR p.nombre LIKE '%SMART%' 
       OR p.nombre LIKE '%TV BOX%' 
       OR p.nombre LIKE '%FONO%' 
       OR p.nombre LIKE '%TELEF%')
      AND p.nombre != 'ACTAS'
      AND p.codigo != 'MAT-ACT'
    )`);

    // Filtro por Sub-pestañas múltiples (ZTE ONT, HUAWEI ONT, ZTE MESH, etc.)
    const rawSubtabs = req.query.subtabs || req.query.subtab || '';
    const selectedSubtabs = (Array.isArray(rawSubtabs) ? rawSubtabs : String(rawSubtabs).split(','))
      .map(s => String(s).toLowerCase().trim())
      .filter(s => s && s !== 'all' && s !== 'todos');

    if (selectedSubtabs.length > 0) {
      const subConditions = [];
      for (const sub of selectedSubtabs) {
        if (sub === 'zte_ont' || sub === 'zteont') {
          subConditions.push(`(p.nombre LIKE '%ZTE%' AND (p.nombre LIKE '%ONT%' OR ps.proid LIKE '%ONT%' OR ps.proid LIKE '%F6600P%' OR p.codigo = 'ZTA'))`);
        } else if (sub === 'huawei_ont' || sub === 'ont_huawei' || sub === 'ont') {
          subConditions.push(`(p.nombre LIKE '%HUAWEI%' AND (p.nombre LIKE '%ONT%' OR ps.proid LIKE '%ONT%' OR ps.proid LIKE '%EG8145%' OR p.codigo = 'HWA'))`);
        } else if (sub === 'zte_mesh' || sub === 'ztemesh') {
          subConditions.push(`(p.nombre LIKE '%ZTE%' AND (p.nombre LIKE '%MESH%' OR p.nombre LIKE '%SMART%' OR ps.proid LIKE '%MESH%' OR p.codigo = 'ZTB'))`);
        } else if (sub === 'huawei_mesh' || sub === 'mesh') {
          subConditions.push(`((p.nombre LIKE '%HUAWEI%' AND (p.nombre LIKE '%MESH%' OR p.nombre LIKE '%SMART%' OR ps.proid LIKE '%MESH%' OR p.codigo = 'HWB')) OR (p.nombre NOT LIKE '%ZTE%' AND (p.nombre LIKE '%MESH%' OR p.nombre LIKE '%SMART%')))`);
        } else if (sub === 'tv_box' || sub === 'tvbox') {
          subConditions.push(`(p.nombre LIKE '%TV%BOX%' OR p.nombre LIKE '%TV BOX%' OR p.codigo = 'WTA')`);
        } else if (sub === 'telef' || sub === 'telefono' || sub === 'telefonia') {
          subConditions.push(`(p.nombre LIKE '%TELEF%' OR p.nombre LIKE '%FONO%' OR p.codigo = 'TLA')`);
        }
      }
      if (subConditions.length > 0) {
        whereConditions.push(`(${subConditions.join(' OR ')})`);
      }
    }

    // Filtro por Estado
    if (estado && estado !== 'TODOS') {
      whereConditions.push(`ps.estado = ?`);
      params.push(estado);
    }

    // Filtro por Almacén
    if (almacen === 'ALM') {
      whereConditions.push(`ts.id_trabajador_serie IS NULL AND ps.id_almacen = 1`);
    } else if (almacen === 'TEC') {
      whereConditions.push(`(ts.id_trabajador_serie IS NOT NULL OR ps.id_almacen = 2)`);
    } else if (almacen === 'LIQ') {
      whereConditions.push(`(ol.id_liquidacion IS NOT NULL OR ps.estado = 'VENDIDO')`);
    }

    // Filtros de fecha (mes, semana, anio, rango)
    const dateField = tipo_fecha === 'asignacion_tec' ? 'ts.fecha_asignacion' 
      : tipo_fecha === 'instalacion' ? 'o.fecha_visita' 
      : tipo_fecha === 'liquidacion' ? 'ol.fecha_liquidacion' 
      : 'ps.fecha_ingreso';

    if (anio && !isNaN(Number(anio))) {
      whereConditions.push(`YEAR(${dateField}) = ?`);
      params.push(Number(anio));
    }

    if (mes && !isNaN(Number(mes))) {
      whereConditions.push(`MONTH(${dateField}) = ?`);
      params.push(Number(mes));
    }

    if (semana && !isNaN(Number(semana))) {
      whereConditions.push(`WEEK(${dateField}, 1) = ?`);
      params.push(Number(semana));
    }

    if (fecha_desde) {
      whereConditions.push(`DATE(${dateField}) >= ?`);
      params.push(fecha_desde);
    }

    if (fecha_hasta) {
      whereConditions.push(`DATE(${dateField}) <= ?`);
      params.push(fecha_hasta);
    }

    if (id_trabajador && !isNaN(Number(id_trabajador))) {
      whereConditions.push(`ts.id_trabajador = ?`);
      params.push(Number(id_trabajador));
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        ps.id_producto_serie,
        ps.id_producto,
        p.nombre AS producto_nombre,
        p.codigo AS producto_codigo,
        COALESCE(c.nombre, 'EQUIPOS') AS categoria_nombre,
        ps.id_equipo AS numero_serie_interno,
        ps.numero_serie AS sn,
        ps.mac,
        ps.estado AS estado_serie,
        ps.fecha_ingreso AS fecha_ingreso_win,
        
        -- Almacén TEC
        CASE 
          WHEN ts.id_trabajador_serie IS NOT NULL THEN 'TEC'
          WHEN ps.id_almacen = 2 THEN 'TEC'
          ELSE 'ALM'
        END AS almacen_tec_win,
        ts.fecha_asignacion AS fecha_ingreso_tec,
        ts.fecha_asignacion AS fecha_entrega_tecnico,
        ts.id_trabajador,
        
        -- Técnico
        COALESCE(
          NULLIF(TRIM(CONCAT(
            COALESCE(u.nombres, u_ord.nombres, ''),
            ' ',
            COALESCE(u.apellidos, CONCAT(COALESCE(u.primer_apellido, ''), ' ', COALESCE(u.segundo_apellido, '')), u_ord.apellidos, '')
          )), ''),
          ol.liquidado_por,
          o.tecnico_asignado,
          COALESCE(u.primer_apellido, u.apellidos, u_ord.primer_apellido, u_ord.apellidos, '')
        ) AS nombre_tecnico_completo,
        COALESCE(u.primer_apellido, u.apellidos, u_ord.primer_apellido, u_ord.apellidos, '') AS nombre_tecnico,
        
        -- Almacén LIQ
        CASE 
          WHEN ol.id_liquidacion IS NOT NULL THEN 'LIQ'
          WHEN ps.estado = 'VENDIDO' THEN 'LIQ'
          ELSE ''
        END AS almacen_liq_win,
        ol.fecha_liquidacion AS fecha_ingreso_liq,
        
        -- Instalación & Cliente
        COALESCE(o.fecha_visita, ol.fecha_liquidacion) AS fecha_instalacion,
        o.cliente AS nom_cliente,
        ol.numero_acta,
        
        -- Equipo de baja & Guía
        COALESCE(oer.numero_serie, '') AS equipo_baja,
        COALESCE(oer.fecha_internamiento, '') AS fecha_ingreso_almacen,
        COALESCE(ol.numero_guia, oer.guia_remision_win, '') AS numero_guia,
        COALESCE(oer.fecha_internamiento, '') AS fecha_entrega_almacen_win,
        COALESCE(ol.observaciones_tecnico, oer.observaciones, ps.proid, '') AS observacion_equipos

      FROM producto_series ps
      JOIN productos p ON ps.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN (
        SELECT ts1.id_producto_serie, ts1.id_trabajador_serie, ts1.id_trabajador, ts1.fecha_asignacion
        FROM trabajador_series ts1
        INNER JOIN (
          SELECT id_producto_serie, MAX(id_trabajador_serie) as max_id
          FROM trabajador_series
          GROUP BY id_producto_serie
        ) ts_max ON ts1.id_trabajador_serie = ts_max.max_id
      ) ts ON ps.id_producto_serie = ts.id_producto_serie
      LEFT JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN (
        SELECT old1.numero_serie, old1.id_producto_serie, old1.id_liquidacion, old1.id_detalle_liq
        FROM orden_liquidacion_detalle old1
        INNER JOIN (
          SELECT COALESCE(NULLIF(numero_serie, ''), CONCAT('ID_', id_producto_serie)) as serie_key, MAX(id_detalle_liq) as max_id
          FROM orden_liquidacion_detalle
          WHERE (numero_serie IS NOT NULL AND numero_serie != '') OR id_producto_serie IS NOT NULL
          GROUP BY COALESCE(NULLIF(numero_serie, ''), CONCAT('ID_', id_producto_serie))
        ) old_max ON old1.id_detalle_liq = old_max.max_id
      ) old ON (old.id_producto_serie = ps.id_producto_serie OR (ps.numero_serie IS NOT NULL AND ps.numero_serie != '' AND old.numero_serie = ps.numero_serie))
      LEFT JOIN orden_liquidaciones ol ON old.id_liquidacion = ol.id_liquidacion
      LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
      LEFT JOIN trabajadores t_ord ON ol.id_trabajador = t_ord.id_trabajador
      LEFT JOIN usuarios u_ord ON t_ord.id_usuario = u_ord.id_usuario
      LEFT JOIN (
        SELECT oer1.id_orden, oer1.numero_serie, oer1.fecha_internamiento, oer1.observaciones, oer1.guia_remision_win
        FROM orden_equipos_retirados oer1
        INNER JOIN (
          SELECT id_orden, MAX(id_equipo_retirado) as max_id
          FROM orden_equipos_retirados
          GROUP BY id_orden
        ) oer_max ON oer1.id_equipo_retirado = oer_max.max_id
      ) oer ON ol.id_orden = oer.id_orden
      ${whereClause}
      ORDER BY ps.id_producto_serie DESC
      LIMIT ? OFFSET ?
    `;

    const queryParams = [...params, Math.min(Number(limit) || 1500, 5000), Number(offset) || 0];
    const [rows] = await pool.query(query, queryParams);

    // Contadores rápidos para estadísticas estrictamente de EQUIPOS
    const equiposOnlyCondition = `
      (
        c.nombre = 'EQUIPOS' 
        OR p.codigo IN ('HWA', 'ZTA', 'HWB', 'ZTB', 'WTA', 'TLA') 
        OR p.nombre LIKE '%ONT%' 
        OR p.nombre LIKE '%MESH%' 
        OR p.nombre LIKE '%SMART%' 
        OR p.nombre LIKE '%TV BOX%' 
        OR p.nombre LIKE '%FONO%' 
        OR p.nombre LIKE '%TELEF%'
      )
      AND p.nombre != 'ACTAS'
      AND p.codigo != 'MAT-ACT'
    `;

    const [counts] = await pool.query(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN ps.estado = 'DISPONIBLE' THEN 1 ELSE 0 END) AS en_almacen,
        SUM(CASE WHEN ps.estado = 'RESERVADO' THEN 1 ELSE 0 END) AS en_tecnicos,
        SUM(CASE WHEN ps.estado = 'VENDIDO' THEN 1 ELSE 0 END) AS liquidados,
        SUM(CASE WHEN ps.estado = 'BAJA' THEN 1 ELSE 0 END) AS de_baja
      FROM producto_series ps
      JOIN productos p ON ps.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE ${equiposOnlyCondition}
    `);

    // Sub-pestañas conteos estrictamente de EQUIPOS
    const [subcounts] = await pool.query(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN p.nombre LIKE '%ZTE%' AND (p.nombre LIKE '%ONT%' OR ps.proid LIKE '%ONT%' OR ps.proid LIKE '%F6600P%' OR p.codigo = 'ZTA') THEN 1 ELSE 0 END) AS zte_ont,
        SUM(CASE WHEN p.nombre LIKE '%HUAWEI%' AND (p.nombre LIKE '%ONT%' OR ps.proid LIKE '%ONT%' OR ps.proid LIKE '%EG8145%' OR p.codigo = 'HWA') THEN 1 ELSE 0 END) AS huawei_ont,
        SUM(CASE WHEN p.nombre LIKE '%ZTE%' AND (p.nombre LIKE '%MESH%' OR p.nombre LIKE '%SMART%' OR ps.proid LIKE '%MESH%' OR p.codigo = 'ZTB') THEN 1 ELSE 0 END) AS zte_mesh,
        SUM(CASE WHEN p.nombre LIKE '%HUAWEI%' AND (p.nombre LIKE '%MESH%' OR p.nombre LIKE '%SMART%' OR ps.proid LIKE '%MESH%' OR p.codigo = 'HWB') THEN 1 ELSE 0 END) AS huawei_mesh,
        SUM(CASE WHEN p.nombre LIKE '%TV%BOX%' OR p.nombre LIKE '%TV BOX%' OR p.codigo = 'WTA' THEN 1 ELSE 0 END) AS tv_box,
        SUM(CASE WHEN p.nombre LIKE '%TELEF%' OR p.nombre LIKE '%FONO%' OR p.codigo = 'TLA' THEN 1 ELSE 0 END) AS telef
      FROM producto_series ps
      JOIN productos p ON ps.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE ${equiposOnlyCondition}
    `);

    res.json({
      success: true,
      total: rows.length,
      data: rows,
      stats: counts[0] || {},
      subtab_counts: subcounts[0] || {}
    });

  } catch (error) {
    console.error('Error al obtener equipos generales:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put(['/equipos-generales/:id_producto_serie', '/almacen/equipos-generales/:id_producto_serie'], async (req, res) => {
  try {
    const { id_producto_serie } = req.params;
    const { mac, numero_serie_interno, id_equipo, proid, observacion_equipos } = req.body;

    const updates = [];
    const params = [];

    if (mac !== undefined) {
      updates.push('mac = ?');
      params.push(mac ? mac.trim() : null);
    }
    if (numero_serie_interno !== undefined || id_equipo !== undefined) {
      updates.push('id_equipo = ?');
      params.push((numero_serie_interno || id_equipo || '').trim());
    }
    if (proid !== undefined || observacion_equipos !== undefined) {
      updates.push('proid = ?');
      params.push((proid || observacion_equipos || '').trim());
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No hay campos a actualizar' });
    }

    params.push(Number(id_producto_serie));
    await pool.query(`UPDATE producto_series SET ${updates.join(', ')} WHERE id_producto_serie = ?`, params);

    res.json({ success: true, message: 'Equipo actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar equipo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stock-general', async (req, res) => {
  try {
    // 1. Productos con su stock en almacén central
    const [productos] = await pool.query(`
      SELECT 
        p.id_producto,
        p.id_categoria,
        p.codigo,
        p.nombre,
        p.descripcion,
        p.stand,
        p.fila,
        CASE 
          WHEN p.stand IS NOT NULL AND p.fila IS NOT NULL THEN CONCAT('Stand ', p.stand, ' · Fila ', p.fila)
          WHEN p.stand IS NOT NULL THEN CONCAT('Stand ', p.stand)
          ELSE NULL 
        END AS ubicacion,
        p.proid,
        p.stock_minimo,
        p.maneja_serie,
        p.es_drop,
        p.precio_compra,
        p.categoria_liquidar,
        COALESCE((SELECT MAX(ps.fecha_ingreso) FROM producto_series ps WHERE ps.id_producto = p.id_producto), p.fecha_creacion) AS fecha_ingreso,
        c.nombre AS categoria,
        CASE 
          WHEN p.maneja_serie = 1 THEN COALESCE((SELECT COUNT(*) FROM producto_series ps WHERE ps.id_producto = p.id_producto AND ps.estado = 'DISPONIBLE'), 0)
          ELSE COALESCE((SELECT SUM(s.cantidad) FROM stock s WHERE s.id_producto = p.id_producto AND (s.id_almacen = 1 OR s.id_almacen IS NULL)), 0)
        END AS stock_central,
        COALESCE((SELECT SUM(s.cantidad_segundo_uso) FROM stock s WHERE s.id_producto = p.id_producto AND (s.id_almacen = 1 OR s.id_almacen IS NULL)), 0) AS stock_segundo_uso,
        CASE
          WHEN p.maneja_serie = 1 THEN COALESCE((
            SELECT COUNT(*) 
            FROM trabajador_series ts 
            JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador 
            JOIN usuarios u ON t.id_usuario = u.id_usuario 
            LEFT JOIN roles r ON u.id_rol = r.id_rol 
            WHERE ts.id_producto = p.id_producto 
              AND ts.estado = 'Asignada'
              AND (u.id_rol IN (2, 6) OR UPPER(COALESCE(r.nombre, '')) LIKE '%TECNIC%' OR UPPER(COALESCE(r.nombre, '')) LIKE '%SUPERVI%')
          ), 0)
          ELSE COALESCE((
            SELECT SUM(tp.stock) 
            FROM trabajador_productos tp 
            JOIN trabajadores t ON tp.id_trabajador = t.id_trabajador 
            JOIN usuarios u ON t.id_usuario = u.id_usuario 
            LEFT JOIN roles r ON u.id_rol = r.id_rol 
            WHERE tp.id_producto = p.id_producto 
              AND (u.id_rol IN (2, 6) OR UPPER(COALESCE(r.nombre, '')) LIKE '%TECNIC%' OR UPPER(COALESCE(r.nombre, '')) LIKE '%SUPERVI%')
          ), 0)
        END AS stock_en_tecnicos,
        COALESCE((SELECT COUNT(*) FROM producto_series ps WHERE ps.id_producto = p.id_producto AND ps.estado = 'DISPONIBLE'), 0) AS series_disponibles
      FROM productos p
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE p.estado = 'Activo' OR p.estado IS NULL
      ORDER BY c.nombre ASC, p.nombre ASC
    `);

    // 2. Stock detallado por cada técnico (Stock en Carro - Solo Técnicos)
    const [stockPorTecnico] = await pool.query(`
      SELECT 
        tp.id_trabajador,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        COALESCE(u.documento, '') AS tecnico_dni,
        COALESCE(u.cuadrilla, '') AS cuadrilla,
        COALESCE(v.placa, 'Sin vehículo') AS vehiculo_placa,
        p.id_producto,
        p.nombre AS producto_nombre,
        p.codigo AS producto_codigo,
        p.proid,
        p.es_drop,
        c.nombre AS categoria,
        tp.stock,
        COALESCE(
          (SELECT MAX(ts.fecha_asignacion) FROM trabajador_series ts WHERE ts.id_trabajador = tp.id_trabajador AND ts.id_producto = tp.id_producto),
          (SELECT MAX(d.fecha_despacho) FROM despacho_detalles dd JOIN despachos d ON dd.id_despacho = d.id_despacho WHERE d.id_trabajador = tp.id_trabajador AND dd.id_producto = tp.id_producto),
          tp.fecha_creacion,
          tp.fecha_actualizacion
        ) AS fecha_entrega,
        COALESCE((
          SELECT SUM(dd.cantidad) 
          FROM despacho_detalles dd 
          JOIN despachos d ON dd.id_despacho = d.id_despacho 
          WHERE d.id_trabajador = tp.id_trabajador AND dd.id_producto = tp.id_producto
        ), 0) AS total_despachado_historial,
        COALESCE((
          SELECT SUM(old.cantidad)
          FROM orden_liquidacion_detalle old
          JOIN orden_liquidaciones ol ON old.id_liquidacion = ol.id_liquidacion
          WHERE ol.id_trabajador = tp.id_trabajador AND old.id_producto = tp.id_producto
        ), 0) AS total_gastado_ordenes,
        COALESCE((
          SELECT SUM(m.cantidad)
          FROM movimientos m
          WHERE (m.referencia LIKE CONCAT('%Técnico #', tp.id_trabajador, '%') 
                 OR (m.referencia LIKE CONCAT('%', u.nombres, '%') AND m.referencia LIKE CONCAT('%', COALESCE(u.primer_apellido, u.apellidos), '%'))
                 OR m.referencia LIKE CONCAT('%', u.nombres, '%'))
            AND m.id_producto = tp.id_producto
            AND m.tipo = 'ENTRADA'
            AND (m.referencia LIKE '%Devolución%' OR m.referencia LIKE '%devolucion%' OR m.referencia LIKE '%Retorno%')
        ), 0) AS total_devuelto_almacen
      FROM trabajador_productos tp
      JOIN trabajadores t ON tp.id_trabajador = t.id_trabajador
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      JOIN productos p ON tp.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      WHERE tp.stock >= 0 
        AND (u.id_rol IN (2, 6) OR UPPER(COALESCE(r.nombre, '')) LIKE '%TECNIC%' OR UPPER(COALESCE(r.nombre, '')) LIKE '%SUPERVI%')
      ORDER BY tecnico_nombre ASC, p.nombre ASC
    `);

    // 3. Series activas y liquidadas de técnicos (Solo Técnicos)
    const [seriesTecnicos] = await pool.query(`
      SELECT 
        ts.id_trabajador_serie,
        ts.id_trabajador,
        ts.id_producto,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        COALESCE(u.documento, '') AS tecnico_dni,
        COALESCE(u.cuadrilla, '') AS cuadrilla,
        COALESCE(v.placa, 'Sin vehículo') AS vehiculo_placa,
        ps.numero_serie,
        p.nombre AS equipo_nombre,
        p.codigo AS equipo_codigo,
        ps.codigo_serie,
        ps.id_equipo,
        ps.proid AS equipo_proid,
        c.nombre AS categoria,
        ts.estado,
        ts.fecha_asignacion,
        ol.id_orden,
        o.numero AS orden_numero,
        ol.fecha_liquidacion
      FROM trabajador_series ts
      JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
      JOIN productos p ON ts.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN orden_liquidaciones ol ON (
        ol.id_trabajador = ts.id_trabajador AND 
        (ol.numero_acta = ps.numero_serie OR ol.numero_guia = ps.numero_serie)
      )
      LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
      WHERE (ts.estado = 'Asignada' OR ts.estado = 'Usada' OR ts.estado = 'Liquidada' OR ts.estado = 'Anulada')
        AND (u.id_rol IN (2, 6) OR UPPER(COALESCE(r.nombre, '')) LIKE '%TECNIC%' OR UPPER(COALESCE(r.nombre, '')) LIKE '%SUPERVI%')
      ORDER BY ts.id_trabajador ASC, ps.numero_serie ASC
    `);

    // 4. Incorporar items serializados únicos (ej: ACTAS / GUIAS, Equipos) que están en trabajador_series
    const existingPairs = new Set(stockPorTecnico.map((st) => `${st.id_trabajador}_${st.id_producto}`));
    const serializedExtraRows = [];

    for (const s of seriesTecnicos) {
      const key = `${s.id_trabajador}_${s.id_producto}`;
      if (!existingPairs.has(key)) {
        existingPairs.add(key);
        serializedExtraRows.push({
          id_trabajador: s.id_trabajador,
          tecnico_nombre: s.tecnico_nombre,
          tecnico_dni: s.tecnico_dni || '',
          cuadrilla: s.cuadrilla || 'S/C',
          vehiculo_placa: s.vehiculo_placa || 'Sin vehículo',
          id_producto: s.id_producto,
          producto_nombre: s.equipo_nombre,
          producto_codigo: s.equipo_codigo || '',
          proid: s.equipo_proid || null,
          es_drop: 0,
          categoria: (s.equipo_nombre && (s.equipo_nombre.toUpperCase().includes('ACTA') || s.equipo_nombre.toUpperCase().includes('GUIA') || s.equipo_nombre.toUpperCase().includes('TALONARIO'))) ? 'ACTAS / GUÍAS' : (s.categoria || 'EQUIPOS'),
          stock: 0,
          fecha_entrega: s.fecha_asignacion,
          total_despachado_historial: 0,
          total_gastado_ordenes: 0,
          total_devuelto_almacen: 0,
        });
      }
    }

    const allStockRows = [...stockPorTecnico, ...serializedExtraRows];

    // 5. Enlazar series y rangos a cada fila de stock
    const stockPorTecnicoEnriquecido = allStockRows.map((st) => {
      const seriesDelItem = seriesTecnicos.filter(
        (s) => s.id_trabajador === st.id_trabajador && s.id_producto === st.id_producto
      );

      const seriesDisponibles = seriesDelItem.filter((s) => s.estado === 'Asignada');
      const seriesUsadas = seriesDelItem.filter((s) => s.estado === 'Usada' || s.estado === 'Liquidada');

      // Calcular rangos correlativos si es Acta o Talonario
      let rangos = [];
      const esActa =
        (st.categoria || '').toUpperCase().includes('TALONARIO') ||
        (st.categoria || '').toUpperCase().includes('ACTA') ||
        (st.categoria || '').toUpperCase().includes('GUIA') ||
        (st.producto_nombre || '').toUpperCase().includes('ACTA') ||
        (st.producto_nombre || '').toUpperCase().includes('GUIA');

      if (esActa && seriesDisponibles.length > 0) {
        const sorted = [...seriesDisponibles].sort((a, b) =>
          a.numero_serie.localeCompare(b.numero_serie, undefined, { numeric: true })
        );
        let rangoInicio = sorted[0].numero_serie;
        let anteriorNum = parseInt(rangoInicio.replace(/\D/g, ''), 10);
        let cantEnRango = 1;

        for (let i = 1; i < sorted.length; i++) {
          const actualStr = sorted[i].numero_serie;
          const actualNum = parseInt(actualStr.replace(/\D/g, ''), 10);
          if (!isNaN(anteriorNum) && !isNaN(actualNum) && actualNum === anteriorNum + 1) {
            cantEnRango++;
            anteriorNum = actualNum;
          } else {
            const finStr = sorted[i - 1].numero_serie;
            rangos.push(rangoInicio === finStr ? rangoInicio : `${rangoInicio} → ${finStr} (${cantEnRango} actas)`);
            rangoInicio = actualStr;
            anteriorNum = actualNum;
            cantEnRango = 1;
          }
        }
        const ultimoStr = sorted[sorted.length - 1].numero_serie;
        rangos.push(rangoInicio === ultimoStr ? rangoInicio : `${rangoInicio} → ${ultimoStr} (${cantEnRango} actas)`);
      }

      const totalGastadoNonSer = Number(st.total_gastado_ordenes) || 0;
      const totalDevueltoNonSer = Number(st.total_devuelto_almacen) || 0;
      const totalDespachadoNonSer = Number(st.total_despachado_historial) || 0;
      const stockActualNonSer = Number(st.stock) || 0;
      const totalAsignadoNonSer = totalDespachadoNonSer > 0
        ? Math.max(totalDespachadoNonSer, stockActualNonSer + totalGastadoNonSer + totalDevueltoNonSer)
        : (stockActualNonSer + totalGastadoNonSer + totalDevueltoNonSer);

      // Detectar si es ACTA/TALONARIO/GUÍA — estas se descargan en orden_liquidacion_detalle,
      // no cambian estado en trabajador_series → usar total_gastado_ordenes
      const esActaItem =
        (st.producto_nombre || '').toUpperCase().includes('ACTA') ||
        (st.producto_nombre || '').toUpperCase().includes('TALONARIO') ||
        (st.producto_codigo || '').toUpperCase().includes('ACT') ||
        (st.categoria || '').toUpperCase().includes('ACTA') ||
        st.id_producto === 65;

      const totalEnCarro = seriesDelItem.length > 0 ? seriesDisponibles.length : stockActualNonSer;
      const cantAsignada = seriesDelItem.length > 0 ? seriesDelItem.length : totalAsignadoNonSer;
      // Para ACTAS: siempre usar total_gastado_ordenes (las actas no marcan "Usada" en trabajador_series)
      const cantGastada = (seriesDelItem.length > 0 && !esActaItem) ? seriesUsadas.length : totalGastadoNonSer;
      const cantDevuelta = totalDevueltoNonSer;

      return {
        ...st,
        stock: totalEnCarro,
        cantidad_asignada: cantAsignada,
        cantidad_gastada: cantGastada,
        cantidad_devuelta: cantDevuelta,
        total_devuelto_almacen: cantDevuelta,
        series: seriesDelItem,
        series_disponibles: seriesDisponibles.map((s) => s.numero_serie),
        series_liquidadas: seriesUsadas.map((s) => s.numero_serie),
        total_asignadas: cantAsignada,
        total_en_carro: totalEnCarro,
        total_liquidadas: cantGastada,
        rangos: rangos,
      };
    });

    res.json({
      productos,
      stockPorTecnico: stockPorTecnicoEnriquecido,
      seriesTecnicos
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/descargas-tecnico-detalle', async (req, res) => {
  try {
    const { id_trabajador, id_producto } = req.query;
    if (!id_trabajador) {
      return res.status(400).json({ error: "Parámetro 'id_trabajador' es requerido." });
    }

    // 1. Descargas de materiales, drops y productos desde orden_liquidacion_detalle
    let paramsMateriales = [id_trabajador];
    let whereMateriales = "WHERE ol.id_trabajador = ?";
    if (id_producto) {
      whereMateriales += " AND old.id_producto = ?";
      paramsMateriales.push(id_producto);
    }

    const [descargasMateriales] = await pool.query(`
      SELECT 
        old.id_detalle_liq,
        ol.id_liquidacion,
        ol.id_orden,
        COALESCE(o.numero, 'S/N') AS orden_numero,
        COALESCE(o.cod_seguimiento_cliente, o.numero, 'S/T') AS ticket,
        COALESCE(o.cliente, 'Cliente sin registrar') AS cliente,
        COALESCE(o.direccion, 'Sin dirección') AS direccion,
        COALESCE(o.localidad, o.region_zona, 'Sin distrito') AS distrito,
        COALESCE(o.tipo_trabajo, ol.tipo_trabajo_acta, 'Instalación') AS tipo_trabajo,
        ol.numero_acta,
        ol.numero_guia,
        ol.fecha_liquidacion,
        ol.estado AS estado_liquidacion,
        ol.liquidado_por,
        ol.observaciones,
        ol.observaciones_tecnico,
        p.id_producto,
        p.nombre AS producto_nombre,
        p.codigo AS producto_codigo,
        p.es_drop,
        old.cantidad,
        old.drop_inicio,
        old.drop_fin,
        old.numero_serie
      FROM orden_liquidacion_detalle old
      JOIN orden_liquidaciones ol ON old.id_liquidacion = ol.id_liquidacion
      JOIN productos p ON old.id_producto = p.id_producto
      LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
      ${whereMateriales}
      ORDER BY ol.fecha_liquidacion DESC, ol.id_liquidacion DESC
    `, paramsMateriales);

    // 2. Series/Equipos/Actas liquidadas desde trabajador_series
    let paramsSeries = [id_trabajador];
    // Excluir ACTAS/TALONARIOS de la query de series — se rastrean por orden_liquidacion_detalle
    let whereSeries = `WHERE ts.id_trabajador = ? AND (ts.estado = 'Usada' OR ts.estado = 'Liquidada')
      AND ts.id_producto NOT IN (
        SELECT p2.id_producto FROM productos p2 
        WHERE p2.id_producto = 65 OR UPPER(p2.codigo) LIKE '%ACT%' OR UPPER(p2.nombre) LIKE '%ACTA%'
      )`;
    if (id_producto) {
      whereSeries += " AND ts.id_producto = ?";
      paramsSeries.push(id_producto);
    }

    const [descargasSeries] = await pool.query(`
      SELECT 
        ts.id_trabajador_serie,
        ts.id_trabajador,
        ts.id_producto,
        p.nombre AS producto_nombre,
        p.codigo AS producto_codigo,
        p.es_drop,
        ps.numero_serie,
        ps.codigo_serie,
        ts.estado AS estado_serie,
        ts.fecha_asignacion,
        ol.id_liquidacion,
        ol.id_orden,
        COALESCE(o.numero, 'S/N') AS orden_numero,
        COALESCE(o.cod_seguimiento_cliente, o.numero, 'S/T') AS ticket,
        COALESCE(o.cliente, 'Cliente sin registrar') AS cliente,
        COALESCE(o.direccion, 'Sin dirección') AS direccion,
        COALESCE(o.localidad, o.region_zona, 'Sin distrito') AS distrito,
        COALESCE(o.tipo_trabajo, ol.tipo_trabajo_acta, 'Instalación') AS tipo_trabajo,
        ol.numero_acta,
        ol.numero_guia,
        ol.fecha_liquidacion,
        ol.estado AS estado_liquidacion,
        ol.liquidado_por,
        ol.observaciones,
        ol.observaciones_tecnico
      FROM trabajador_series ts
      JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
      JOIN productos p ON ts.id_producto = p.id_producto
      LEFT JOIN orden_liquidaciones ol ON (
        ol.id_trabajador = ts.id_trabajador AND 
        (ol.numero_acta = ps.numero_serie OR ol.numero_guia = ps.numero_serie)
      )
      LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
      ${whereSeries}
        AND NOT EXISTS (
          SELECT 1 FROM orden_liquidacion_detalle old2 
          JOIN orden_liquidaciones ol2 ON old2.id_liquidacion = ol2.id_liquidacion
          WHERE ol2.id_trabajador = ts.id_trabajador 
            AND (old2.numero_serie = ps.numero_serie OR (old2.id_producto = ts.id_producto AND old2.id_liquidacion = ol.id_liquidacion))
        )
      ORDER BY COALESCE(ol.fecha_liquidacion, ts.fecha_asignacion) DESC
    `, paramsSeries);

    // 3. Devoluciones a Almacén Central registradas en movimientos
    let paramsDevoluciones = [id_trabajador];
    let whereDevoluciones = "";
    if (id_producto) {
      whereDevoluciones = "AND m.id_producto = ?";
      paramsDevoluciones.push(id_producto);
    }

    const [devolucionesAlmacen] = await pool.query(`
      SELECT 
        m.id_movimiento,
        m.id_producto,
        p.nombre AS producto_nombre,
        p.codigo AS producto_codigo,
        p.es_drop,
        m.cantidad,
        m.tipo,
        m.referencia,
        m.fecha_creacion,
        COALESCE(u_resp.nombres, 'Almacén Central') AS recibido_por
      FROM movimientos m
      JOIN productos p ON m.id_producto = p.id_producto
      JOIN trabajadores t ON t.id_trabajador = ?
      JOIN usuarios u_tec ON t.id_usuario = u_tec.id_usuario
      LEFT JOIN usuarios u_resp ON m.id_usuario = u_resp.id_usuario
      WHERE m.tipo = 'ENTRADA'
        AND (m.referencia LIKE '%Devolución%' OR m.referencia LIKE '%devolucion%' OR m.referencia LIKE '%Retorno%')
        AND (
          m.referencia LIKE CONCAT('%Técnico #', t.id_trabajador, '%')
          OR (m.referencia LIKE CONCAT('%', u_tec.nombres, '%') AND m.referencia LIKE CONCAT('%', COALESCE(u_tec.primer_apellido, u_tec.apellidos), '%'))
          OR m.referencia LIKE CONCAT('%', u_tec.nombres, '%')
        )
        ${whereDevoluciones}
      ORDER BY m.fecha_creacion DESC
    `, paramsDevoluciones);

    res.json({
      descargasMateriales,
      descargasSeries,
      devolucionesAlmacen: devolucionesAlmacen || [],
      totalDescargas: descargasMateriales.length + descargasSeries.length,
      totalDevoluciones: (devolucionesAlmacen || []).length
    });
  } catch (error) {
    console.error("Error en /api/almacen/descargas-tecnico-detalle:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/categorias', async (req, res) => {
  try {
    const { incluir_inactivos } = req.query;
    let sql = "SELECT id_categoria, nombre, descripcion, estado FROM categorias";
    if (incluir_inactivos !== 'true') {
      sql += " WHERE estado = 'Activo' OR estado IS NULL";
    }
    sql += " ORDER BY nombre ASC";
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/categorias', async (req, res) => {
  try {
    const { nombre, descripcion, estado = 'Activo' } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: "El nombre de la categoría es obligatorio." });
    }
    const [result] = await pool.query(
      "INSERT INTO categorias (nombre, descripcion, estado) VALUES (?, ?, ?)",
      [nombre.trim().toUpperCase(), descripcion?.trim() || null, estado]
    );
    res.json({ success: true, id_categoria: result.insertId, message: "Categoría creada con éxito." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/categorias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, estado } = req.body;
    await pool.query(
      "UPDATE categorias SET nombre = COALESCE(?, nombre), descripcion = COALESCE(?, descripcion), estado = COALESCE(?, estado) WHERE id_categoria = ?",
      [nombre?.trim()?.toUpperCase() || null, descripcion !== undefined ? descripcion?.trim() : null, estado || null, id]
    );
    res.json({ success: true, message: "Categoría actualizada con éxito." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/categorias/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [prods] = await pool.query("SELECT COUNT(*) AS total FROM productos WHERE id_categoria = ?", [id]);
    if (prods[0].total > 0) {
      await pool.query("UPDATE categorias SET estado = 'Inactivo' WHERE id_categoria = ?", [id]);
      res.json({ success: true, message: "Categoría desactivada con éxito (posee productos asociados)." });
    } else {
      await pool.query("DELETE FROM categorias WHERE id_categoria = ?", [id]);
      res.json({ success: true, message: "Categoría eliminada permanentemente con éxito." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/productos', async (req, res) => {
  try {
    const { nombre, id_categoria, categoria, codigo, stock_minimo, maneja_serie, es_drop, precio_compra, stand, fila, proid } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: "El nombre del producto es obligatorio." });
    }

    let catId = id_categoria;
    let catNombre = categoria;

    if (!catId && categoria) {
      const [cRows] = await pool.query("SELECT id_categoria, nombre FROM categorias WHERE UPPER(nombre) = UPPER(?) LIMIT 1", [categoria.trim()]);
      if (cRows.length > 0) {
        catId = cRows[0].id_categoria;
        catNombre = cRows[0].nombre;
      }
    } else if (catId && !catNombre) {
      const [cRows] = await pool.query("SELECT nombre FROM categorias WHERE id_categoria = ? LIMIT 1", [catId]);
      if (cRows.length > 0) {
        catNombre = cRows[0].nombre;
      }
    }

    // Generar código automático inteligente (Brand Prefix + Letra Modelo + 001)
    let codProd = (codigo || '').trim().toUpperCase();
    if (!codProd) {
      const nom = nombre.trim().toUpperCase();
      let prefix = '';

      if (nom.includes('ZTE')) {
        prefix = 'ZT';
      } else if (nom.includes('HUAWEI')) {
        prefix = 'HW';
      } else if (nom.includes('FIBERHOME')) {
        prefix = 'FH';
      } else if (nom.includes('WIN TV') || nom.includes('DECODIFICADOR') || nom.includes('DECO')) {
        prefix = 'WT';
      } else if (nom.includes('TP-LINK') || nom.includes('TPLINK')) {
        prefix = 'TP';
      } else if (nom.includes('MERCUSYS')) {
        prefix = 'MC';
      } else if (nom.includes('ROSETA')) {
        prefix = 'ROS';
      } else if (nom.includes('CONECTOR')) {
        prefix = 'CON';
      } else if (nom.includes('DROP') || nom.includes('CABLE')) {
        prefix = 'DRP';
      } else if (nom.includes('PATCH')) {
        prefix = 'PCH';
      } else if (catNombre.includes('EQUIPO')) {
        const palabras = nom.replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(w => w.length >= 2);
        prefix = (palabras[0] || 'EQ').slice(0, 2);
      } else {
        const palabras = nom.replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(w => w.length >= 2);
        prefix = (palabras[0] || 'PR').slice(0, 3);
      }

      // Consultar productos existentes con ese prefijo para calcular la siguiente letra correlativa (A, B, C...)
      const [existentes] = await pool.query(
        "SELECT codigo FROM productos WHERE codigo LIKE ?",
        [`${prefix}%`]
      );

      const letrasUsadas = new Set();
      existentes.forEach(p => {
        const resto = String(p.codigo || '').slice(prefix.length);
        const match = resto.match(/^([A-Z])/);
        if (match) letrasUsadas.add(match[1]);
      });

      const abecedario = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      let letraAsignada = 'A';
      for (let i = 0; i < abecedario.length; i++) {
        if (!letrasUsadas.has(abecedario[i])) {
          letraAsignada = abecedario[i];
          break;
        }
      }

      codProd = `${prefix}${letraAsignada}`;
    }

    const manejaSerieVal = maneja_serie !== undefined ? (maneja_serie ? 1 : 0) : (catNombre === 'EQUIPOS' ? 1 : 0);
    const esDropVal = es_drop ? 1 : 0;
    const stockMinVal = Number(stock_minimo) || 5;
    const precVal = Number(precio_compra) || 0;
    const cleanStand = stand ? String(stand).trim().toUpperCase() : null;
    const cleanFila = fila ? Number(fila) : null;
    const cleanProid = proid ? String(proid).trim().toUpperCase() : null;

    const [insResult] = await pool.query(`
      INSERT INTO productos (codigo, nombre, id_categoria, stock_minimo, maneja_serie, es_drop, precio_compra, stand, fila, proid, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Activo')
    `, [codProd, nombre.trim().toUpperCase(), catId || null, stockMinVal, manejaSerieVal, esDropVal, precVal, cleanStand, cleanFila, cleanProid]);

    const newProdId = insResult.insertId;

    // Inicializar registro en stock almacén central
    await pool.query(`
      INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso)
      VALUES (?, 1, 0, 0)
      ON DUPLICATE KEY UPDATE id_stock = id_stock
    `, [newProdId]);

    const nuevoProducto = {
      id_producto: newProdId,
      codigo: codProd,
      nombre: nombre.trim().toUpperCase(),
      categoria: catNombre || 'GENERAL',
      stand: cleanStand,
      fila: cleanFila,
      ubicacion: cleanStand && cleanFila ? `Stand ${cleanStand} · Fila ${cleanFila}` : (cleanStand ? `Stand ${cleanStand}` : null),
      proid: cleanProid,
      stock_minimo: stockMinVal,
      maneja_serie: manejaSerieVal,
      es_drop: esDropVal,
      precio_compra: precVal,
      stock_central: 0,
      stock_segundo_uso: 0,
      stock_en_tecnicos: 0,
      series_disponibles: 0
    };

    res.json({
      success: true,
      message: `Producto ${nuevoProducto.nombre} (${nuevoProducto.codigo}) creado exitosamente.`,
      producto: nuevoProducto
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/productos/:id/ubicacion', async (req, res) => {
  try {
    const { id } = req.params;
    const { stand, fila, proid, id_usuario, usuario_nombre } = req.body;

    const cleanStand = stand ? String(stand).trim().toUpperCase() : null;
    const cleanFila = fila ? Number(fila) : null;
    const cleanProid = proid !== undefined ? (proid && String(proid).trim() ? String(proid).trim().toUpperCase() : null) : undefined;

    const [pRows] = await pool.query('SELECT nombre, codigo FROM productos WHERE id_producto = ?', [id]);
    const prod = pRows[0] || {};

    if (cleanProid !== undefined) {
      await pool.query(`
        UPDATE productos SET
          stand = ?,
          fila = ?,
          proid = ?
        WHERE id_producto = ?
      `, [cleanStand, cleanFila, cleanProid, id]);
    } else {
      await pool.query(`
        UPDATE productos SET
          stand = ?,
          fila = ?
        WHERE id_producto = ?
      `, [cleanStand, cleanFila, id]);
    }

    const ubicacionStr = cleanStand && cleanFila ? `Stand ${cleanStand} · Fila ${cleanFila}` : (cleanStand ? `Stand ${cleanStand}` : 'Sin asignar');

    // 🛡️ Registrar Auditoría y actualizar última acción
    await registrarAuditoria(pool, {
      id_usuario: id_usuario || null,
      usuario_nombre: usuario_nombre || null,
      modulo: 'ALMACEN',
      accion: 'ACTUALIZAR_UBICACION',
      id_referencia: prod.codigo || `PROD-${id}`,
      descripcion: `Asignó ubicación "${ubicacionStr}" a ${prod.nombre || 'Producto #' + id}`,
      req
    });

    res.json({
      success: true,
      message: "Ubicación y Product ID actualizados correctamente.",
      stand: cleanStand,
      fila: cleanFila,
      proid: cleanProid !== undefined ? cleanProid : null,
      ubicacion: ubicacionStr
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/productos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, id_categoria, codigo, descripcion, stock_minimo, estado, id_usuario, usuario_nombre } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: "El nombre del producto es obligatorio." });
    }

    const cleanNombre = nombre.trim().toUpperCase();
    const cleanCodigo = codigo ? codigo.trim().toUpperCase() : null;
    const cleanDesc = descripcion !== undefined ? (descripcion ? descripcion.trim() : null) : undefined;
    const cleanCatId = id_categoria ? Number(id_categoria) : null;
    const cleanStockMin = stock_minimo !== undefined ? Number(stock_minimo) : null;
    const cleanEstado = estado || 'Activo';

    const [prev] = await pool.query('SELECT nombre, codigo FROM productos WHERE id_producto = ?', [id]);
    if (prev.length === 0) {
      return res.status(404).json({ error: "Producto no encontrado." });
    }
    const nombreAnterior = prev[0].nombre;

    await pool.query(`
      UPDATE productos SET
        nombre = ?,
        codigo = COALESCE(?, codigo),
        id_categoria = COALESCE(?, id_categoria),
        descripcion = COALESCE(?, descripcion),
        stock_minimo = COALESCE(?, stock_minimo),
        estado = COALESCE(?, estado)
      WHERE id_producto = ?
    `, [cleanNombre, cleanCodigo, cleanCatId, cleanDesc, cleanStockMin, cleanEstado, id]);

    await registrarAuditoria(pool, {
      id_usuario: id_usuario || null,
      usuario_nombre: usuario_nombre || null,
      modulo: 'ALMACEN',
      accion: 'ACTUALIZAR_PRODUCTO',
      id_referencia: cleanCodigo || `PROD-${id}`,
      descripcion: `Actualizó producto de "${nombreAnterior}" a "${cleanNombre}"`,
      req
    });

    res.json({
      success: true,
      message: `Producto actualizado a "${cleanNombre}" correctamente.`,
      id_producto: Number(id),
      nombre: cleanNombre
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/productos/:id/precio', async (req, res) => {
  try {
    const { id } = req.params;
    const { precio_compra, id_usuario, usuario_nombre } = req.body;
    const precio = Math.max(0, parseFloat(precio_compra) || 0);

    const [pRows] = await pool.query('SELECT nombre, codigo, precio_compra FROM productos WHERE id_producto = ?', [id]);
    const prod = pRows[0] || {};
    const precioAnt = Number(prod.precio_compra || 0).toFixed(2);
    const precioNuevo = Number(precio).toFixed(2);

    await pool.query('UPDATE productos SET precio_compra = ? WHERE id_producto = ?', [precio, id]);

    // 🛡️ Registrar Auditoría y actualizar última acción
    await registrarAuditoria(pool, {
      id_usuario: id_usuario || null,
      usuario_nombre: usuario_nombre || null,
      modulo: 'ALMACEN',
      accion: 'ACTUALIZAR_PRECIO',
      id_referencia: prod.codigo || `PROD-${id}`,
      descripcion: `Modificó costo de compra de "${prod.nombre || 'Producto #' + id}" de S/ ${precioAnt} a S/ ${precioNuevo}`,
      req
    });

    res.json({
      success: true,
      message: 'Precio de compra actualizado correctamente.',
      id_producto: Number(id),
      precio_compra: precio
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/productos/:id/stock-segundo-uso', async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad_segundo_uso, motivo, tecnico_nombre } = req.body;
    const cant = Math.max(0, parseInt(cantidad_segundo_uso, 10) || 0);

    const [pRow] = await pool.query(
      "SELECT c.nombre AS categoria FROM productos p LEFT JOIN categorias c ON p.id_categoria = c.id_categoria WHERE p.id_producto = ?",
      [id]
    );
    const cat = pRow[0]?.categoria || "";
    if (!esCategoriaSegundoUso(cat)) {
      return res.status(400).json({ error: "El stock de Segundo Uso solo aplica para categorías: HERRAMIENTAS, UNIFORMES y VEHICULO." });
    }

    const [upd] = await pool.query(
      "UPDATE stock SET cantidad_segundo_uso = ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)",
      [cant, id]
    );
    if (upd.affectedRows === 0) {
      await pool.query(
        "INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 0, ?)",
        [id, cant]
      );
    }

    await pool.query(`
      INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
      VALUES (?, 1, 'AJUSTE', ?, ?, NOW())
    `, [id, cant, `Ajuste 2do Uso (${cant} unds): ${motivo || 'Devolución / Ajuste'} ${tecnico_nombre ? '(' + tecnico_nombre + ')' : ''}`]);

    res.json({
      success: true,
      message: `Stock de segundo uso actualizado a ${cant} unidades.`,
      cantidad_segundo_uso: cant
    });
  } catch (error) {
    console.error("Error al actualizar stock de segundo uso:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/proveedores', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM proveedores ORDER BY razon_social ASC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/proveedores', async (req, res) => {
  try {
    const { razon_social, nombre_comercial, ruc, telefono, email, direccion, estado = 'Activo' } = req.body;
    if (!razon_social || !razon_social.trim()) {
      return res.status(400).json({ error: "La Razón Social es requerida." });
    }
    if (ruc) {
      const [exist] = await pool.query("SELECT id_proveedor FROM proveedores WHERE ruc = ?", [ruc.trim()]);
      if (exist.length > 0) {
        return res.status(400).json({ error: `El RUC ${ruc} ya se encuentra registrado.` });
      }
    }
    const [result] = await pool.query(
      `INSERT INTO proveedores (razon_social, nombre_comercial, ruc, telefono, email, direccion, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [razon_social.trim().toUpperCase(), nombre_comercial?.trim() || null, ruc?.trim() || null, telefono?.trim() || null, email?.trim() || null, direccion?.trim() || null, estado]
    );
    res.json({ success: true, id_proveedor: result.insertId, message: "Proveedor registrado con éxito." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/proveedores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { razon_social, nombre_comercial, ruc, telefono, email, direccion, estado } = req.body;
    if (ruc) {
      const [exist] = await pool.query("SELECT id_proveedor FROM proveedores WHERE ruc = ? AND id_proveedor != ?", [ruc.trim(), id]);
      if (exist.length > 0) {
        return res.status(400).json({ error: `El RUC ${ruc} ya está asignado a otro proveedor.` });
      }
    }
    await pool.query(
      `UPDATE proveedores SET
        razon_social = COALESCE(?, razon_social),
        nombre_comercial = COALESCE(?, nombre_comercial),
        ruc = COALESCE(?, ruc),
        telefono = COALESCE(?, telefono),
        email = COALESCE(?, email),
        direccion = COALESCE(?, direccion),
        estado = COALESCE(?, estado)
       WHERE id_proveedor = ?`,
      [
        razon_social?.trim()?.toUpperCase() || null,
        nombre_comercial !== undefined ? nombre_comercial?.trim() : null,
        ruc !== undefined ? ruc?.trim() : null,
        telefono !== undefined ? telefono?.trim() : null,
        email !== undefined ? email?.trim() : null,
        direccion !== undefined ? direccion?.trim() : null,
        estado || null,
        id
      ]
    );
    res.json({ success: true, message: "Proveedor actualizado con éxito." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/proveedores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE proveedores SET estado = 'Inactivo' WHERE id_proveedor = ?", [id]);
    res.json({ success: true, message: "Proveedor desactivado con éxito." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/compras', async (req, res) => {
  try {
    const {
      id_proveedor,
      ruc_proveedor,
      razon_social_proveedor,
      direccion_proveedor,
      telefono_proveedor,
      tipo_comprobante,
      numero_comprobante,
      fecha,
      items, // Array de { id_producto, cantidad, precio, series: ['SN1', 'SN2'] }
      observaciones
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Debe ingresar al menos un producto en la compra." });
    }

    let provId = id_proveedor ? Number(id_proveedor) : null;

    // A. Auto-guardar proveedor si es nuevo y se proporcionó RUC
    const rucLimpio = ruc_proveedor ? String(ruc_proveedor).trim() : '';
    if (!provId && rucLimpio) {
      const [provExistente] = await pool.query("SELECT id_proveedor FROM proveedores WHERE ruc = ?", [rucLimpio]);
      if (provExistente.length > 0) {
        provId = provExistente[0].id_proveedor;
      } else {
        const [nuevoProv] = await pool.query(`
          INSERT INTO proveedores (ruc, razon_social, nombre_comercial, direccion, telefono, estado)
          VALUES (?, ?, ?, ?, ?, 'Activo')
        `, [
          rucLimpio,
          razon_social_proveedor || `PROVEEDOR RUC ${rucLimpio}`,
          razon_social_proveedor || `PROVEEDOR RUC ${rucLimpio}`,
          direccion_proveedor || '',
          telefono_proveedor || ''
        ]);
        provId = nuevoProv.insertId;
      }
    }

    const fechaCompra = fecha || new Date().toISOString().slice(0, 10);
    const totalCompra = items.reduce((acc, it) => acc + (Number(it.cantidad) * Number(it.precio || 0)), 0);

    // B1. Validar regla de negocio: Productos serializados deben tener exactamente la misma cantidad de series y sin duplicados
    const todasLasSeriesCompra = [];
    const todosLosIdEquiposCompra = [];

    for (const item of items) {
      const prodId = Number(item.id_producto);
      const cant = Number(item.cantidad) || 0;
      const rawSeries = Array.isArray(item.series) ? item.series : [];

      const seriesNormalizadas = [];
      for (const s of rawSeries) {
        let sn = '';
        let id_equipo = null;
        let proid = null;
        if (typeof s === 'object' && s !== null) {
          sn = String(s.numero_serie || '').trim().toUpperCase();
          id_equipo = s.id_equipo ? String(s.id_equipo).trim().toUpperCase() : null;
          proid = s.proid ? String(s.proid).trim().toUpperCase() : null;
        } else {
          const rawStr = String(s).trim();
          const parts = rawStr.split(/[\t,;]+/);
          sn = parts[0].trim().toUpperCase();
          if (parts.length >= 3) {
            id_equipo = parts[1].trim().toUpperCase() || null;
            proid = parts[2].trim().toUpperCase() || null;
          } else if (parts.length === 2) {
            id_equipo = parts[1].trim().toUpperCase() || null;
          } else if (item.proid && String(item.proid).trim()) {
            proid = String(item.proid).trim().toUpperCase();
          }
        }
        if (sn.length >= 3) {
          seriesNormalizadas.push({ numero_serie: sn, id_equipo, proid });
        }
      }

      // Validar duplicados de Serie y de ID Equipo dentro de la misma compra
      for (const sObj of seriesNormalizadas) {
        const s = sObj.numero_serie;
        if (todasLasSeriesCompra.includes(s)) {
          return res.status(400).json({
            error: `La serie "${s}" está duplicada dentro de esta misma compra. Cada equipo debe tener un número de serie único e irrepetible.`,
          });
        }
        todasLasSeriesCompra.push(s);

        if (sObj.id_equipo) {
          if (todosLosIdEquiposCompra.includes(sObj.id_equipo)) {
            return res.status(400).json({
              error: `El ID de equipo "${sObj.id_equipo}" está duplicado dentro de esta misma compra. Cada equipo debe tener un ID de equipo único e irrepetible.`,
            });
          }
          todosLosIdEquiposCompra.push(sObj.id_equipo);
        }
      }

      const [prodRows] = await pool.query(
        "SELECT id_producto, nombre, maneja_serie, id_categoria FROM productos WHERE id_producto = ?",
        [prodId]
      );
      if (prodRows.length > 0) {
        const prod = prodRows[0];
        const nomUpper = String(prod.nombre || "").toUpperCase();
        const esActa = nomUpper.includes("ACTA") || nomUpper.includes("GUIA") || nomUpper.includes("TALONARIO") || prod.id_categoria === 11;
        const esSerializado = !esActa && Boolean(prod.maneja_serie || prod.id_categoria === 7);
        if (esSerializado && seriesNormalizadas.length !== cant) {
          return res.status(400).json({
            error: `El producto "${prod.nombre}" requiere exactamente ${cant} series registradas, pero se ingresaron ${seriesNormalizadas.length}. Por favor completa las ${cant - seriesNormalizadas.length} series faltantes.`,
          });
        }
      }
    }

    // B2. Validar que las series y los ID de equipo no existan previamente registrados en la base de datos
    // NOTA: Para Talonarios / Actas de servicio, si alguna serie ya fue asignada previamente a técnicos en caliente,
    // se permite la compra para regularizar su costo y asiento contable sin bloquear.
    if (todasLasSeriesCompra.length > 0) {
      const [seriesExistentes] = await pool.query(`
        SELECT ps.numero_serie, p.nombre as producto_nombre, ps.id_almacen, c.nombre as categoria_nombre
        FROM producto_series ps 
        JOIN productos p ON ps.id_producto = p.id_producto 
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
        WHERE ps.numero_serie IN (?)
      `, [todasLasSeriesCompra]);

      if (seriesExistentes.length > 0) {
        const repetidasEquipos = seriesExistentes.filter((r) => {
          const nom = (r.producto_nombre || '').toUpperCase();
          const cat = (r.categoria_nombre || '').toUpperCase();
          const esActa = nom.includes('ACTA') || nom.includes('GUIA') || nom.includes('TALONARIO') || cat.includes('TALONARIO');
          // Si es acta y ya estaba asignada en técnicos (almacén 2), permitimos regularización.
          // Solo bloqueamos si es hardware real o si el acta ya estaba registrada como disponible en almacén central
          return !esActa || r.id_almacen === 1;
        });

        if (repetidasEquipos.length > 0) {
          const repetidas = repetidasEquipos.map((r) => `"${r.numero_serie}" (${r.producto_nombre})`).join(", ");
          return res.status(400).json({
            error: `Las siguientes series ya se encuentran registradas previamente en el almacén: ${repetidas}. No se permiten series duplicadas.`,
          });
        }
      }
    }

    if (todosLosIdEquiposCompra.length > 0) {
      const [idEquiposExistentes] = await pool.query(
        "SELECT ps.id_equipo, p.nombre as producto_nombre FROM producto_series ps JOIN productos p ON ps.id_producto = p.id_producto WHERE ps.id_equipo IN (?)",
        [todosLosIdEquiposCompra]
      );
      if (idEquiposExistentes.length > 0) {
        const repetidos = idEquiposExistentes.map((r) => `"${r.id_equipo}" (${r.producto_nombre})`).join(", ");
        return res.status(400).json({
          error: `Los siguientes ID de Equipo ya se encuentran registrados previamente en el almacén: ${repetidos}. No se permiten ID de Equipo duplicados.`,
        });
      }
    }

    // B2.1 Nota: El ID de Modelo (proid) puede repetirse válidamente en varios equipos del mismo modelo
    // Solo las series físicas / MAC (numero_serie) y el ID de Equipo (id_equipo) son estrictamente únicos.

    // B3. Crear registro de Compra
    const [compraResult] = await pool.query(`
      INSERT INTO compras (id_proveedor, id_almacen, fecha, total, tipo_comprobante, numero_comprobante, estado, observaciones)
      VALUES (?, 1, ?, ?, ?, ?, 'COMPLETADO', ?)
    `, [provId || null, fechaCompra, totalCompra, tipo_comprobante || 'Factura', numero_comprobante || '', observaciones || '']);

    const idCompra = compraResult.insertId;

    // C. Procesar cada ítem
    for (const item of items) {
      const prodId = Number(item.id_producto);
      const cant = Number(item.cantidad) || 0;
      const prec = Number(item.precio) || 0;
      const subtotal = cant * prec;
      const rawSeries = Array.isArray(item.series) ? item.series : [];

      const seriesNormalizadas = [];
      for (const s of rawSeries) {
        let sn = '';
        let id_equipo = null;
        let proid = null;
        if (typeof s === 'object' && s !== null) {
          sn = String(s.numero_serie || '').trim().toUpperCase();
          id_equipo = s.id_equipo ? String(s.id_equipo).trim().toUpperCase() : null;
          proid = s.proid ? String(s.proid).trim().toUpperCase() : null;
        } else {
          const rawStr = String(s).trim();
          const parts = rawStr.split(/[\t,;]+/);
          sn = parts[0].trim().toUpperCase();
          if (parts.length >= 3) {
            id_equipo = parts[1].trim().toUpperCase() || null;
            proid = parts[2].trim().toUpperCase() || null;
          } else if (parts.length === 2) {
            id_equipo = parts[1].trim().toUpperCase() || null;
          } else if (item.proid && String(item.proid).trim()) {
            proid = String(item.proid).trim().toUpperCase();
          }
        }
        if (sn.length >= 3) {
          seriesNormalizadas.push({ numero_serie: sn, id_equipo, proid });
        }
      }

      // 1. Detalle de compra
      await pool.query(`
        INSERT INTO detalle_compras (id_compra, id_producto, cantidad, precio, subtotal, series_ingresadas)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [idCompra, prodId, cant, prec, subtotal, seriesNormalizadas.map(s => s.numero_serie).join(',')]);

      // 1.1 Si se especificó stand o fila en la compra, actualizar la ubicación del producto
      if (item.stand || item.fila) {
        await pool.query(`
          UPDATE productos SET
            stand = COALESCE(?, stand),
            fila = COALESCE(?, fila)
          WHERE id_producto = ?
        `, [
          item.stand ? String(item.stand).trim().toUpperCase() : null,
          item.fila ? Number(item.fila) : null,
          prodId
        ]);
      }

      // 1.2 Actualizar precio_compra en productos si prec > 0
      if (prec > 0) {
        await pool.query("UPDATE productos SET precio_compra = ? WHERE id_producto = ?", [prec, prodId]);
      }

      // 2. Incrementar stock en Almacén Central (id_almacen = 1)
      const [stockExistente] = await pool.query("SELECT id_stock, cantidad FROM stock WHERE id_producto = ? AND id_almacen = 1", [prodId]);
      if (stockExistente.length > 0) {
        await pool.query("UPDATE stock SET cantidad = cantidad + ? WHERE id_stock = ?", [cant, stockExistente[0].id_stock]);
      } else {
        await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, ?, 0)", [prodId, cant]);
      }

      // 3. Registrar Movimiento Kardex
      await pool.query(`
        INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
        VALUES (?, 1, 'ENTRADA', ?, ?, NOW())
      `, [prodId, cant, `Compra #${idCompra} - ${tipo_comprobante || 'Fac'} ${numero_comprobante || ''}`]);

      // 4. Si el producto maneja series (ONT, Mesh, etc.), registrar cada serie pistoleada con su código correlativo
      if (seriesNormalizadas.length > 0) {
        const [prodInfo] = await pool.query("SELECT codigo FROM productos WHERE id_producto = ?", [prodId]);
        const modelCode = (prodInfo[0]?.codigo || 'EQA').trim();

        // Obtener el último número correlativo asignado a este producto
        const [lastSerie] = await pool.query(
          "SELECT codigo_serie FROM producto_series WHERE id_producto = ? AND codigo_serie IS NOT NULL ORDER BY id_producto_serie DESC LIMIT 1",
          [prodId]
        );
        let nextNum = 1;
        if (lastSerie.length > 0 && lastSerie[0].codigo_serie) {
          const m = lastSerie[0].codigo_serie.match(/-S(\d+)$/i);
          if (m) nextNum = parseInt(m[1], 10) + 1;
        }

        for (const sObj of seriesNormalizadas) {
          const cleanSerie = sObj.numero_serie;
          const serieIdEquipo = sObj.id_equipo || null;
          const serieProid = sObj.proid || null;

          if (cleanSerie.length > 2) {
            const codigoSerie = `${modelCode}-S${String(nextNum).padStart(3, '0')}`;
            nextNum++;

            await pool.query(`
              INSERT INTO producto_series (id_producto, id_almacen, codigo_serie, id_equipo, proid, numero_serie, estado, fecha_ingreso)
              VALUES (?, 1, ?, ?, ?, ?, 'DISPONIBLE', NOW())
              ON DUPLICATE KEY UPDATE 
                codigo_serie = COALESCE(codigo_serie, VALUES(codigo_serie)),
                id_equipo = COALESCE(VALUES(id_equipo), id_equipo),
                proid = COALESCE(VALUES(proid), proid),
                estado = IF(id_almacen = 2, estado, 'DISPONIBLE'), 
                id_almacen = IF(id_almacen = 2, 2, 1)
            `, [prodId, codigoSerie, serieIdEquipo, serieProid, cleanSerie]);
          }
        }
      }
    }

    res.json({
      success: true,
      message: `Compra #${idCompra} registrada con éxito. Stock y series cargados al Almacén Central.`,
      id_compra: idCompra
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/compras', async (req, res) => {
  try {
    const [compras] = await pool.query(`
      SELECT 
        c.id_compra,
        c.id_proveedor,
        c.id_almacen,
        c.fecha,
        c.total,
        c.estado,
        c.tipo_comprobante,
        c.numero_comprobante,
        c.observaciones,
        c.fecha_creacion,
        pr.razon_social AS proveedor_nombre,
        pr.ruc AS proveedor_ruc,
        pr.telefono AS proveedor_telefono
      FROM compras c
      LEFT JOIN proveedores pr ON c.id_proveedor = pr.id_proveedor
      ORDER BY c.id_compra DESC
    `);

    if (compras.length === 0) {
      return res.json([]);
    }

    const idsCompras = compras.map(c => c.id_compra);
    const [detalles] = await pool.query(`
      SELECT 
        dc.id_detalle_compra,
        dc.id_compra,
        dc.id_producto,
        dc.cantidad,
        dc.precio,
        dc.subtotal,
        dc.series_ingresadas,
        p.codigo AS producto_codigo,
        p.nombre AS producto_nombre,
        cat.nombre AS categoria_nombre
      FROM detalle_compras dc
      JOIN productos p ON dc.id_producto = p.id_producto
      LEFT JOIN categorias cat ON p.id_categoria = cat.id_categoria
      WHERE dc.id_compra IN (?)
    `, [idsCompras]);

    // Mapear detalles a cada compra
    const detallesPorCompra = {};
    for (const d of detalles) {
      if (!detallesPorCompra[d.id_compra]) {
        detallesPorCompra[d.id_compra] = [];
      }
      detallesPorCompra[d.id_compra].push({
        ...d,
        series_array: d.series_ingresadas ? d.series_ingresadas.split(',').map(s => s.trim()).filter(Boolean) : []
      });
    }

    const resultado = compras.map(c => ({
      ...c,
      items: detallesPorCompra[c.id_compra] || [],
      total_items: (detallesPorCompra[c.id_compra] || []).reduce((acc, it) => acc + Number(it.cantidad || 0), 0)
    }));

    res.json(resultado);
  } catch (error) {
    console.error("Error al obtener historial de compras:", error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/compras/:id/precios', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { items } = req.body; // Array de { id_detalle_compra, id_producto, precio }

    if (!Array.isArray(items) || items.length === 0) {
      connection.release();
      return res.status(400).json({ error: "Debe enviar los ítems con sus precios actualizados." });
    }

    await connection.beginTransaction();

    for (const it of items) {
      const precioNum = Math.max(0, Number(it.precio || 0));
      const prodId = Number(it.id_producto);

      if (it.id_detalle_compra) {
        await connection.query(`
          UPDATE detalle_compras 
          SET precio = ?, subtotal = cantidad * ? 
          WHERE id_detalle_compra = ? AND id_compra = ?
        `, [precioNum, precioNum, it.id_detalle_compra, id]);
      } else if (prodId) {
        await connection.query(`
          UPDATE detalle_compras 
          SET precio = ?, subtotal = cantidad * ? 
          WHERE id_producto = ? AND id_compra = ?
        `, [precioNum, precioNum, prodId, id]);
      }

      // Actualizar también en la tabla maestra productos si precio > 0
      if (prodId && precioNum > 0) {
        await connection.query(`
          UPDATE productos 
          SET precio_compra = ? 
          WHERE id_producto = ?
        `, [precioNum, prodId]);
      }
    }

    // Recalcular total general de la compra
    const [totRows] = await connection.query(`
      SELECT COALESCE(SUM(subtotal), 0) AS nuevo_total 
      FROM detalle_compras 
      WHERE id_compra = ?
    `, [id]);
    const nuevoTotal = totRows[0]?.nuevo_total || 0;

    await connection.query("UPDATE compras SET total = ? WHERE id_compra = ?", [nuevoTotal, id]);

    await connection.commit();
    connection.release();

    res.json({ success: true, message: "Precios actualizados exitosamente.", nuevo_total: nuevoTotal });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error("Error al actualizar precios de compra:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/compras/:id/anular', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const idCompra = Number(req.params.id);
    const { motivo } = req.body || {};

    if (!idCompra) {
      connection.release();
      return res.status(400).json({ error: "ID de compra inválido." });
    }

    // 1. Obtener la compra
    const [compraRows] = await connection.query("SELECT * FROM compras WHERE id_compra = ?", [idCompra]);
    if (compraRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: "La compra no existe." });
    }

    const compra = compraRows[0];
    if (compra.estado === 'ANULADA') {
      connection.release();
      return res.status(400).json({ error: "Esta compra ya se encuentra ANULADA previamente." });
    }

    // 2. Obtener los detalles de la compra
    const [detalles] = await connection.query(`
      SELECT dc.*, p.nombre AS producto_nombre, p.maneja_serie 
      FROM detalle_compras dc
      JOIN productos p ON dc.id_producto = p.id_producto
      WHERE dc.id_compra = ?
    `, [idCompra]);

    if (detalles.length === 0) {
      connection.release();
      return res.status(400).json({ error: "La compra no tiene ítems asociados." });
    }

    // 3. Extraer todas las series ingresadas en esta compra
    const todasSeries = [];
    for (const d of detalles) {
      if (d.series_ingresadas) {
        const sns = d.series_ingresadas.split(',').map(s => s.trim()).filter(Boolean);
        todasSeries.push(...sns);
      }
    }

    // 4. VALIDACIÓN DE SEGURIDAD ESTRICTA PARA LAS SERIES
    // Las series NO deben haber sido despachadas a técnicos ni liquidadas en órdenes
    if (todasSeries.length > 0) {
      const [seriesEnUso] = await connection.query(`
        SELECT 
          ps.numero_serie,
          ps.estado,
          p.nombre AS producto_nombre,
          ts.id_trabajador,
          TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre
        FROM producto_series ps
        JOIN productos p ON ps.id_producto = p.id_producto
        LEFT JOIN trabajador_series ts ON ps.id_producto_serie = ts.id_producto_serie AND ts.estado = 'Asignada'
        LEFT JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador
        LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
        WHERE ps.numero_serie IN (?)
          AND (ps.estado != 'DISPONIBLE' OR ps.id_almacen != 1 OR ts.id_trabajador_serie IS NOT NULL)
      `, [todasSeries]);

      if (seriesEnUso.length > 0) {
        const listaDetalles = seriesEnUso.map(s => {
          const motivoUso = s.tecnico_nombre ? `asignada a ${s.tecnico_nombre}` : `en estado '${s.estado}'`;
          return `• Serie "${s.numero_serie}" (${s.producto_nombre}): ${motivoUso}`;
        }).join('\\n');

        connection.release();
        return res.status(400).json({
          error: `🚫 No se puede anular la compra porque ${seriesEnUso.length} equipo(s) ya no están disponibles en Almacén Central:\n\n${listaDetalles}\n\nPara anular esta compra, primero el técnico debe devolver las series o deben desvincularse.`
        });
      }
    }

    // 5. Iniciar Transacción de Anulación
    await connection.beginTransaction();

    const motivoFinal = motivo ? `Motivo: ${String(motivo).trim()}` : "Anulación de ingreso de compra";

    for (const d of detalles) {
      const prodId = d.id_producto;
      const cant = Number(d.cantidad) || 0;

      // Descontar stock en Almacén Central (id_almacen = 1)
      await connection.query(`
        UPDATE stock 
        SET cantidad = GREATEST(0, cantidad - ?)
        WHERE id_producto = ? AND id_almacen = 1
      `, [cant, prodId]);

      // Si tenía series, eliminarlas de producto_series
      if (d.series_ingresadas) {
        const sns = d.series_ingresadas.split(',').map(s => s.trim()).filter(Boolean);
        if (sns.length > 0) {
          await connection.query(`
            DELETE FROM producto_series 
            WHERE numero_serie IN (?) AND id_producto = ? AND id_almacen = 1
          `, [sns, prodId]);
        }
      }

      // Registrar movimiento de SALIDA por Anulación en Kardex
      await connection.query(`
        INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
        VALUES (?, 1, 'SALIDA', ?, ?, NOW())
      `, [prodId, cant, `Anulación Compra #${idCompra} (${compra.tipo_comprobante || 'Comp'} ${compra.numero_comprobante || ''}) - ${motivoFinal}`]);
    }

    // Actualizar estado de la compra a ANULADA
    const observacionAnulacion = compra.observaciones 
      ? `${compra.observaciones} | [ANULADA: ${motivoFinal}]`
      : `[ANULADA: ${motivoFinal}]`;

    await connection.query(`
      UPDATE compras 
      SET estado = 'ANULADA', observaciones = ?
      WHERE id_compra = ?
    `, [observacionAnulacion, idCompra]);

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: `✅ Compra #${idCompra} anulada exitosamente. Se revirtió el stock y se retiraron las series de Almacén Central.`
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error("Error al anular compra:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/producto-series/:id/reasignar-producto', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const idProductoSerie = Number(req.params.id);
    const { nuevo_id_producto, motivo } = req.body || {};

    if (!idProductoSerie || !nuevo_id_producto) {
      connection.release();
      return res.status(400).json({ error: "Datos incompletos para reasignar el producto." });
    }

    // 1. Obtener la serie
    const [serieRows] = await connection.query(`
      SELECT ps.*, p.nombre AS producto_origen_nombre, p.codigo AS producto_origen_codigo
      FROM producto_series ps
      JOIN productos p ON ps.id_producto = p.id_producto
      WHERE ps.id_producto_serie = ?
    `, [idProductoSerie]);

    if (serieRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: "La serie no existe." });
    }

    const serie = serieRows[0];

    // Verificar que esté en Almacén Central y DISPONIBLE
    if (serie.estado !== 'DISPONIBLE' || serie.id_almacen !== 1) {
      connection.release();
      return res.status(400).json({ 
        error: `La serie "${serie.numero_serie}" está en estado '${serie.estado}'. Solo se pueden reasignar series disponibles en Almacén Central.` 
      });
    }

    if (serie.id_producto === Number(nuevo_id_producto)) {
      connection.release();
      return res.status(400).json({ error: "La serie ya pertenece a este producto." });
    }

    // 2. Obtener producto destino
    const [prodDestinoRows] = await connection.query("SELECT id_producto, nombre, codigo FROM productos WHERE id_producto = ?", [nuevo_id_producto]);
    if (prodDestinoRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: "El producto de destino no existe." });
    }
    const prodDestino = prodDestinoRows[0];

    // 3. Iniciar Transacción
    await connection.beginTransaction();

    // Descontar 1 al producto anterior en Almacén Central
    await connection.query(`
      UPDATE stock 
      SET cantidad = GREATEST(0, cantidad - 1) 
      WHERE id_producto = ? AND id_almacen = 1
    `, [serie.id_producto]);

    // Incrementar 1 al nuevo producto en Almacén Central
    const [stockDestino] = await connection.query("SELECT id_stock FROM stock WHERE id_producto = ? AND id_almacen = 1", [nuevo_id_producto]);
    if (stockDestino.length > 0) {
      await connection.query("UPDATE stock SET cantidad = cantidad + 1 WHERE id_stock = ?", [stockDestino[0].id_stock]);
    } else {
      await connection.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 1, 0)", [nuevo_id_producto]);
    }

    // Generar nuevo correlativo para el nuevo producto
    const modelCode = (prodDestino.codigo || 'EQ').trim();
    const [lastSerie] = await connection.query(
      "SELECT codigo_serie FROM producto_series WHERE id_producto = ? AND codigo_serie IS NOT NULL ORDER BY id_producto_serie DESC LIMIT 1",
      [nuevo_id_producto]
    );
    let nextNum = 1;
    if (lastSerie.length > 0 && lastSerie[0].codigo_serie) {
      const m = lastSerie[0].codigo_serie.match(/-S(\d+)$/i);
      if (m) nextNum = parseInt(m[1], 10) + 1;
    }
    const nuevoCodigoSerie = `${modelCode}-S${String(nextNum).padStart(3, '0')}`;

    // Actualizar producto_series
    await connection.query(`
      UPDATE producto_series 
      SET id_producto = ?, codigo_serie = ?
      WHERE id_producto_serie = ?
    `, [nuevo_id_producto, nuevoCodigoSerie, idProductoSerie]);

    // Registrar en movimientos
    const ref = `Corrección: Serie ${serie.numero_serie} movida de [${serie.producto_origen_nombre}] a [${prodDestino.nombre}]. ${motivo || ''}`;
    await connection.query(`
      INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
      VALUES (?, 1, 'SALIDA', 1, ?, NOW())
    `, [serie.id_producto, ref]);

    await connection.query(`
      INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
      VALUES (?, 1, 'ENTRADA', 1, ?, NOW())
    `, [nuevo_id_producto, ref]);

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: `✅ Serie "${serie.numero_serie}" reasignada exitosamente a "${prodDestino.nombre}". Stock de ambos productos actualizado.`,
      nuevo_codigo_serie: nuevoCodigoSerie
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error("Error al reasignar serie a producto:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/verificar-serie-despacho/:serie', async (req, res) => {
  try {
    const rawSerie = req.params.serie;
    const cleanSerie = String(rawSerie || '').trim().toUpperCase();
    const idProducto = req.query.id_producto ? Number(req.query.id_producto) : null;

    if (!cleanSerie) {
      return res.status(400).json({ disponible: false, error: "Debe ingresar o pistolear un número de serie válido." });
    }

    const [rows] = await pool.query(`
      SELECT 
        ps.id_producto_serie,
        ps.id_producto,
        ps.numero_serie,
        ps.codigo_serie,
        ps.id_equipo,
        ps.proid,
        ps.estado,
        ps.id_almacen,
        p.nombre AS producto_nombre,
        p.proid AS producto_proid,
        c.nombre AS categoria,
        ts.id_trabajador,
        ts.estado AS estado_trabajador,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        u.cuadrilla,
        COALESCE(v.placa, '') AS vehiculo_placa
      FROM producto_series ps
      JOIN productos p ON ps.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN trabajador_series ts ON ps.id_producto_serie = ts.id_producto_serie AND ts.estado = 'Asignada'
      LEFT JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      WHERE ps.numero_serie = ? OR ps.codigo_serie = ? OR ps.id_equipo = ? OR ps.proid = ?
      ORDER BY (ps.estado = 'DISPONIBLE') DESC, ps.id_producto_serie DESC
      LIMIT 1
    `, [cleanSerie, cleanSerie, cleanSerie, cleanSerie]);

    if (rows.length === 0) {
      return res.status(404).json({
        disponible: false,
        error: `⛔ La serie o código "${cleanSerie}" no existe en el catálogo ni en Almacén Central.`
      });
    }

    const item = rows[0];

    // Si se especificó un producto (ej: desde QuickDispatchModal) y no coincide
    if (idProducto && item.id_producto !== idProducto) {
      return res.status(400).json({
        disponible: false,
        error: `⚠️ La serie pertenece a "${item.producto_nombre}", no al producto seleccionado.`
      });
    }

    // Validar estado de la serie
    if (item.estado !== 'DISPONIBLE') {
      if (item.estado === 'RESERVADO' || item.estado_trabajador === 'Asignada') {
        const detTec = item.tecnico_nombre
          ? `asignada a ${item.tecnico_nombre}${item.cuadrilla ? ` (Cuadrilla: ${item.cuadrilla})` : ''}${item.vehiculo_placa ? ` [Placa: ${item.vehiculo_placa}]` : ''}`
          : 'ya asignada a otra cuadrilla';
        return res.status(400).json({
          disponible: false,
          error: `⚠️ La serie "${item.numero_serie}" (${item.producto_nombre}) está ${detTec}. No se puede despachar.`
        });
      }

      if (item.estado === 'DEFECTUOSO') {
        return res.status(400).json({
          disponible: false,
          error: `⚠️ La serie "${item.numero_serie}" (${item.producto_nombre}) está en estado DEFECTUOSO / AVERIADO.`
        });
      }

      if (item.estado === 'BAJA') {
        return res.status(400).json({
          disponible: false,
          error: `⚠️ La serie "${item.numero_serie}" (${item.producto_nombre}) fue dada de BAJA.`
        });
      }

      if (item.estado === 'VENDIDO') {
        return res.status(400).json({
          disponible: false,
          error: `⚠️ La serie "${item.numero_serie}" (${item.producto_nombre}) ya fue liquidada e instalada a un cliente.`
        });
      }

      return res.status(400).json({
        disponible: false,
        error: `⚠️ La serie "${item.numero_serie}" (${item.producto_nombre}) no está disponible (Estado actual: ${item.estado}).`
      });
    }

    // Validar que esté en Almacén Central (id_almacen = 1)
    if (item.id_almacen !== 1) {
      return res.status(400).json({
        disponible: false,
        error: `⚠️ La serie "${item.numero_serie}" (${item.producto_nombre}) no se encuentra en Almacén Central.`
      });
    }

    // Serie válida y 100% disponible
    return res.json({
      disponible: true,
      equipo: {
        id_producto_serie: item.id_producto_serie,
        id_producto: item.id_producto,
        numero_serie: item.numero_serie,
        codigo_serie: item.codigo_serie,
        id_equipo: item.id_equipo || null,
        proid: item.proid || item.producto_proid || null,
        producto_nombre: item.producto_nombre,
        categoria: item.categoria
      }
    });
  } catch (error) {
    console.error("Error al verificar serie para despacho:", error);
    res.status(500).json({ disponible: false, error: "Error en el servidor al verificar serie: " + error.message });
  }
});

router.get('/tecnicos-disponibles', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        t.id_trabajador,
        t.id_usuario,
        u.usuario,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))) AS nombre_completo,
        COALESCE(u.documento, '') AS documento,
        COALESCE(u.cuadrilla, '') AS cuadrilla,
        COALESCE(v.placa, 'Sin vehículo') AS vehiculo_placa,
        COALESCE(r.nombre, 'Técnico') AS rol_nombre
      FROM trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      WHERE t.estado = 'Activo' AND u.estado = 'Activo'
        AND (u.id_rol IN (2, 6) OR UPPER(COALESCE(r.nombre, '')) LIKE '%TECNIC%' OR UPPER(COALESCE(r.nombre, '')) LIKE '%SUPERVI%')
      ORDER BY u.nombres ASC
    `);
    res.json({ success: true, tecnicos: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/despacho-tecnico', async (req, res) => {
  try {
    const { id_trabajador, items, series_pistoleadas, observaciones } = req.body;

    if (!id_trabajador) {
      return res.status(400).json({ error: "Debe seleccionar el técnico al que se entrega el material." });
    }

    const [tUserRows] = await pool.query(`
      SELECT 
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))) AS nombre,
        COALESCE(u.cuadrilla, '') AS cuadrilla,
        COALESCE(r.nombre, 'Técnico') AS rol_nombre
      FROM trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      WHERE t.id_trabajador = ?
    `, [id_trabajador]);
    const tecNombre = tUserRows[0]?.nombre || `Técnico #${id_trabajador}`;
    const rolLabel = (tUserRows[0]?.rol_nombre || '').toUpperCase().includes('SUPERVI') ? 'Supervisor' : 'Técnico';
    const tecCuadrilla = tUserRows[0]?.cuadrilla ? ` (${tUserRows[0].cuadrilla})` : '';

    const productosConSeries = new Set(
      (Array.isArray(series_pistoleadas) ? series_pistoleadas : [])
        .map((serie) => Number(serie.id_producto || (items && items[0] ? items[0].id_producto : 0)))
        .filter(Boolean)
    );

    // VALIDACIÓN PREVIA ESTRICTA:
    // Todas las series de equipos que no sean talonarios autogenerados deben existir y estar DISPONIBLES en Almacén Central
    if (Array.isArray(series_pistoleadas) && series_pistoleadas.length > 0) {
      for (const itemSerie of series_pistoleadas) {
        const cleanSerie = String(itemSerie.numero_serie || itemSerie).trim().toUpperCase();
        if (!cleanSerie) continue;
        const esTalonario = Boolean(itemSerie.es_talonario);

        if (!esTalonario) {
          const [serieRows] = await pool.query(`
            SELECT ps.id_producto_serie, ps.id_producto, ps.numero_serie, ps.estado, ps.id_almacen, p.nombre AS producto_nombre
            FROM producto_series ps
            JOIN productos p ON ps.id_producto = p.id_producto
            WHERE ps.numero_serie = ? OR ps.codigo_serie = ? OR ps.id_equipo = ? OR ps.proid = ?
          `, [cleanSerie, cleanSerie, cleanSerie, cleanSerie]);

          if (serieRows.length === 0) {
            return res.status(400).json({
              error: `⛔ La serie "${cleanSerie}" no existe en el catálogo de Almacén Central. Despacho cancelado.`
            });
          }

          const s = serieRows[0];
          const productosSolicitados = new Set((Array.isArray(items) ? items : []).map((item) => Number(item.id_producto)));
          if (productosSolicitados.size > 0 && !productosSolicitados.has(Number(s.id_producto))) {
            return res.status(400).json({
              error: `⛔ La serie "${s.numero_serie}" pertenece a otro producto. Despacho cancelado.`
            });
          }
          if (s.estado !== 'DISPONIBLE') {
            return res.status(400).json({
              error: `⛔ El equipo "${s.producto_nombre}" (Serie: ${s.numero_serie}) no está disponible en Almacén Central (Estado: ${s.estado}). Despacho cancelado.`
            });
          }

          if (s.id_almacen !== 1) {
            return res.status(400).json({
              error: `⛔ El equipo "${s.producto_nombre}" (Serie: ${s.numero_serie}) no está en Almacén Central. Despacho cancelado.`
            });
          }
        }
      }
    }

    // 1. Validar disponibilidad de stock de Insumos / Materiales antes de despachar (Nuevo o Segundo Uso)
    if (Array.isArray(items)) {
      for (const item of items) {
        const prodId = Number(item.id_producto);
        const cant = Number(item.cantidad) || 0;
        const esSegundoUso = Boolean(item.es_segundo_uso || item.tipo_origen === 'SEGUNDO_USO');
        if (cant <= 0) continue;
        if (productosConSeries.has(prodId)) continue;

        const [stockRows] = await pool.query(
          "SELECT s.cantidad, s.cantidad_segundo_uso, p.nombre FROM stock s JOIN productos p ON s.id_producto = p.id_producto WHERE s.id_producto = ? AND s.id_almacen = 1",
          [prodId]
        );
        const stockNuevo = stockRows.length > 0 ? Number(stockRows[0].cantidad) : 0;
        const stock2do = stockRows.length > 0 ? Number(stockRows[0].cantidad_segundo_uso || 0) : 0;
        const stockActual = esSegundoUso ? stock2do : stockNuevo;
        const nombreProd = stockRows.length > 0 ? stockRows[0].nombre : `Producto #${prodId}`;
        const labelOrigen = esSegundoUso ? "Segundo Uso" : "Stock Nuevo";

        if (stockActual <= 0) {
          return res.status(400).json({
            error: `⛔ No hay stock disponible en Almacén Central (${labelOrigen}) para "${nombreProd}" (Stock: 0). Despacho cancelado.`
          });
        }
        if (cant > stockActual) {
          return res.status(400).json({
            error: `⛔ Stock insuficiente (${labelOrigen}) para "${nombreProd}". Disponible en Almacén Central: ${stockActual}, Solicitado: ${cant}. Despacho cancelado.`
          });
        }
      }
    }

    // 1.1 Asignar Insumos / Materiales (Conectores, Cable Drop, Rosetas, Herramientas, Uniformes, etc.)
    const itemsParaDetalle = [];

    if (Array.isArray(items)) {
      for (const item of items) {
        const prodId = Number(item.id_producto);
        const cant = Number(item.cantidad) || 0;
        const esSegundoUso = Boolean(item.es_segundo_uso || item.tipo_origen === 'SEGUNDO_USO');
        if (cant <= 0) continue;
        if (productosConSeries.has(prodId)) continue;

        itemsParaDetalle.push({
          id_producto: prodId,
          cantidad: cant,
          es_segundo_uso: esSegundoUso ? 1 : 0,
          series_entregadas: null,
          observaciones: item.observaciones || null,
        });

        // Descontar de Almacén Central del campo correspondiente
        if (esSegundoUso) {
          await pool.query("UPDATE stock SET cantidad_segundo_uso = GREATEST(0, COALESCE(cantidad_segundo_uso, 0) - ?) WHERE id_producto = ? AND id_almacen = 1", [cant, prodId]);
        } else {
          await pool.query("UPDATE stock SET cantidad = GREATEST(0, cantidad - ?) WHERE id_producto = ? AND id_almacen = 1", [cant, prodId]);
        }

        // Aumentar en Stock del Técnico y actualizar fecha_actualizacion a NOW()
        const [tpExistente] = await pool.query("SELECT id_trabajador_producto FROM trabajador_productos WHERE id_trabajador = ? AND id_producto = ?", [id_trabajador, prodId]);
        if (tpExistente.length > 0) {
          await pool.query("UPDATE trabajador_productos SET stock = stock + ?, fecha_actualizacion = NOW() WHERE id_trabajador_producto = ?", [cant, tpExistente[0].id_trabajador_producto]);
        } else {
          await pool.query("INSERT INTO trabajador_productos (id_trabajador, id_producto, stock, fecha_creacion, fecha_actualizacion) VALUES (?, ?, ?, NOW(), NOW())", [id_trabajador, prodId, cant]);
        }

        // Kardex Salida
        const refTexto = esSegundoUso
          ? `Despacho (SEGUNDO USO) a ${rolLabel}: ${tecNombre}${tecCuadrilla} (${observaciones || 'Dotación operativa'})`
          : `Despacho a ${rolLabel}: ${tecNombre}${tecCuadrilla} (${observaciones || 'Dotación operativa'})`;

        await pool.query(`
          INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
          VALUES (?, 1, 'SALIDA', ?, ?, NOW())
        `, [prodId, cant, refTexto]);
      }
    }

    // 2. Asignar Equipos Serializados o Talonarios de Actas / Guías
    const seriesPorProducto = new Map();

    if (Array.isArray(series_pistoleadas) && series_pistoleadas.length > 0) {
      const prodIdsSeries = new Set();

      for (const itemSerie of series_pistoleadas) {
        const cleanSerie = String(itemSerie.numero_serie || itemSerie).trim().toUpperCase();
        if (!cleanSerie) continue;

        let targetProdId = itemSerie.id_producto || (items && items[0] ? items[0].id_producto : null);

        // Buscar serie en producto_series
        let [serieRows] = await pool.query(
          "SELECT id_producto_serie, id_producto, numero_serie FROM producto_series WHERE numero_serie = ? OR codigo_serie = ? OR id_equipo = ? OR proid = ?",
          [cleanSerie, cleanSerie, cleanSerie, cleanSerie]
        );
        let idProdSerie = null;
        let actualProdId = targetProdId;

        if (serieRows.length > 0) {
          idProdSerie = serieRows[0].id_producto_serie;
          actualProdId = serieRows[0].id_producto;
          await pool.query("UPDATE producto_series SET estado = 'RESERVADO', id_almacen = 2 WHERE id_producto_serie = ?", [idProdSerie]);
          await pool.query("UPDATE stock SET cantidad = GREATEST(0, cantidad - 1) WHERE id_producto = ? AND id_almacen = 1", [actualProdId]);
        } else if (itemSerie.es_talonario && actualProdId) {
          // Si es un lote de talonarios autogenerados
          const [insRes] = await pool.query(`
            INSERT INTO producto_series (id_producto, id_almacen, numero_serie, estado, fecha_ingreso)
            VALUES (?, 2, ?, 'RESERVADO', NOW())
            ON DUPLICATE KEY UPDATE estado = 'RESERVADO', id_almacen = 2
          `, [actualProdId, cleanSerie]);
          idProdSerie = insRes.insertId || insRes.id_producto_serie;
          if (!idProdSerie) {
            const [findRes] = await pool.query("SELECT id_producto_serie FROM producto_series WHERE numero_serie = ?", [cleanSerie]);
            if (findRes.length > 0) idProdSerie = findRes[0].id_producto_serie;
          }
          await pool.query("UPDATE stock SET cantidad = GREATEST(0, cantidad - 1) WHERE id_producto = ? AND id_almacen = 1", [actualProdId]);
        }

        if (idProdSerie && actualProdId) {
          prodIdsSeries.add(actualProdId);
          await pool.query(`
            INSERT INTO trabajador_series (id_trabajador, id_producto, id_producto_serie, estado, fecha_asignacion)
            VALUES (?, ?, ?, 'Asignada', NOW())
            ON DUPLICATE KEY UPDATE estado = 'Asignada', id_trabajador = ?, fecha_asignacion = NOW()
          `, [id_trabajador, actualProdId, idProdSerie, id_trabajador]);

          if (!seriesPorProducto.has(actualProdId)) {
            seriesPorProducto.set(actualProdId, []);
          }
          seriesPorProducto.get(actualProdId).push(cleanSerie);
        }
      }

      // Asegurar que el stock en trabajador_productos refleje las series asignadas
      for (const pId of prodIdsSeries) {
        const [cntRows] = await pool.query(`
          SELECT COUNT(*) as totalAsig 
          FROM trabajador_series 
          WHERE id_trabajador = ? AND id_producto = ? AND estado = 'Asignada'
        `, [id_trabajador, pId]);
        const totalAsig = cntRows[0]?.totalAsig || 0;

        const [tpExistente] = await pool.query("SELECT id_trabajador_producto FROM trabajador_productos WHERE id_trabajador = ? AND id_producto = ?", [id_trabajador, pId]);
        if (tpExistente.length > 0) {
          await pool.query("UPDATE trabajador_productos SET stock = ?, fecha_actualizacion = NOW() WHERE id_trabajador_producto = ?", [totalAsig, tpExistente[0].id_trabajador_producto]);
        } else {
          await pool.query("INSERT INTO trabajador_productos (id_trabajador, id_producto, stock, fecha_creacion, fecha_actualizacion) VALUES (?, ?, ?, NOW(), NOW())", [id_trabajador, pId, totalAsig]);
        }
      }
    }

    // 3. Registrar comprobante oficial en tabla 'despachos' y 'despacho_detalles'
    try {
      const [tInfo] = await pool.query("SELECT id_vehiculo FROM trabajadores WHERE id_trabajador = ?", [id_trabajador]);
      const idVehiculo = tInfo.length > 0 ? tInfo[0].id_vehiculo : null;

      const [maxDesp] = await pool.query("SELECT MAX(id_despacho) as maxId FROM despachos");
      const nextNum = (maxDesp[0]?.maxId || 0) + 1;
      const codDespacho = `DSP-${new Date().getFullYear()}-${String(nextNum).padStart(5, '0')}`;

      const totalItemsDesp = itemsParaDetalle.reduce((acc, i) => acc + i.cantidad, 0);
      let totalSeriesDesp = 0;
      seriesPorProducto.forEach((sList) => { totalSeriesDesp += sList.length; });

      const [insDesp] = await pool.query(`
        INSERT INTO despachos (
          codigo_despacho, id_trabajador, id_usuario_despacha, id_vehiculo,
          tipo_despacho, total_items, total_series, observaciones, estado, fecha_despacho, fecha_creacion
        ) VALUES (?, ?, ?, ?, 'DOTACION_OPERATIVA', ?, ?, ?, 'COMPLETADO', NOW(), NOW())
      `, [
        codDespacho,
        id_trabajador,
        req.user?.id_usuario || req.body.id_usuario_despacha || null,
        idVehiculo,
        totalItemsDesp,
        totalSeriesDesp,
        observaciones || null,
      ]);

      const idDespachoCreado = insDesp.insertId;

      // Insertar detalle de insumos no serializados
      for (const itemD of itemsParaDetalle) {
        await pool.query(`
          INSERT INTO despacho_detalles (id_despacho, id_producto, cantidad, es_segundo_uso, series_entregadas, observaciones)
          VALUES (?, ?, ?, ?, NULL, ?)
        `, [idDespachoCreado, itemD.id_producto, itemD.cantidad, itemD.es_segundo_uso, itemD.observaciones]);
      }

      // Insertar detalle de productos serializados
      for (const [pId, arrSeries] of seriesPorProducto.entries()) {
        await pool.query(`
          INSERT INTO despacho_detalles (id_despacho, id_producto, cantidad, es_segundo_uso, series_entregadas, observaciones)
          VALUES (?, ?, ?, 0, ?, 'Equipos/Talonarios pistoleados')
        `, [idDespachoCreado, pId, arrSeries.length, JSON.stringify(arrSeries)]);
      }
    } catch (despErr) {
      console.warn("[DESPACHO] Error al registrar historial de despacho:", despErr.message);
    }

    res.json({ success: true, message: "Dotación, materiales y actas asignados exitosamente al técnico." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/despachos-historial', async (req, res) => {
  try {
    const { fechaDesde, fechaHasta, id_trabajador, busqueda, estado } = req.query;

    let whereSql = "WHERE 1=1";
    const params = [];

    if (fechaDesde && fechaHasta) {
      whereSql += " AND DATE(d.fecha_despacho) BETWEEN ? AND ?";
      params.push(fechaDesde, fechaHasta);
    } else if (fechaDesde) {
      whereSql += " AND DATE(d.fecha_despacho) >= ?";
      params.push(fechaDesde);
    } else if (fechaHasta) {
      whereSql += " AND DATE(d.fecha_despacho) <= ?";
      params.push(fechaHasta);
    }

    if (id_trabajador && id_trabajador !== 'todos') {
      whereSql += " AND d.id_trabajador = ?";
      params.push(id_trabajador);
    }

    if (estado && estado !== 'todos') {
      whereSql += " AND d.estado = ?";
      params.push(estado);
    }

    if (busqueda && busqueda.trim()) {
      const q = `%${busqueda.trim()}%`;
      whereSql += ` AND (
        d.codigo_despacho LIKE ? OR
        u.nombres LIKE ? OR
        u.apellidos LIKE ? OR
        u.documento LIKE ? OR
        u.cuadrilla LIKE ? OR
        v.placa LIKE ? OR
        d.observaciones LIKE ? OR
        EXISTS (
          SELECT 1 FROM despacho_detalles dd 
          JOIN productos p ON dd.id_producto = p.id_producto 
          WHERE dd.id_despacho = d.id_despacho 
            AND (p.nombre LIKE ? OR p.codigo LIKE ? OR dd.series_entregadas LIKE ?)
        )
      )`;
      params.push(q, q, q, q, q, q, q, q, q, q);
    }

    const [despachos] = await pool.query(`
      SELECT 
        d.id_despacho,
        d.codigo_despacho,
        d.id_trabajador,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        COALESCE(u.documento, '') AS tecnico_dni,
        COALESCE(u.cuadrilla, '') AS cuadrilla,
        COALESCE(v.placa, vt.placa, 'Sin vehículo') AS vehiculo_placa,
        d.id_usuario_despacha,
        TRIM(CONCAT(COALESCE(ud.nombres, ''), ' ', COALESCE(ud.primer_apellido, ud.apellidos, ''))) AS despachador_nombre,
        d.tipo_despacho,
        d.total_items,
        d.total_series,
        d.observaciones,
        d.estado,
        d.fecha_despacho,
        d.fecha_creacion
      FROM despachos d
      JOIN trabajadores t ON d.id_trabajador = t.id_trabajador
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN usuarios ud ON d.id_usuario_despacha = ud.id_usuario
      LEFT JOIN vehiculos v ON d.id_vehiculo = v.id_vehiculo
      LEFT JOIN vehiculos vt ON t.id_vehiculo = vt.id_vehiculo
      ${whereSql}
      ORDER BY d.fecha_despacho DESC, d.id_despacho DESC
    `, params);

    // Adjuntar detalles para cada despacho
    for (const d of despachos) {
      const [detalles] = await pool.query(`
        SELECT 
          dd.id_detalle_despacho,
          dd.id_producto,
          p.nombre AS producto_nombre,
          p.codigo AS producto_codigo,
          p.proid,
          p.es_drop,
          c.nombre AS categoria,
          dd.cantidad,
          dd.es_segundo_uso,
          dd.series_entregadas,
          dd.drop_inicio,
          dd.drop_fin,
          dd.observaciones
        FROM despacho_detalles dd
        JOIN productos p ON dd.id_producto = p.id_producto
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
        WHERE dd.id_despacho = ?
        ORDER BY c.nombre ASC, p.nombre ASC
      `, [d.id_despacho]);

      d.detalles = detalles.map(det => {
        let seriesArr = [];
        if (det.series_entregadas) {
          try {
            seriesArr = JSON.parse(det.series_entregadas);
          } catch {
            seriesArr = [det.series_entregadas];
          }
        }
        return {
          ...det,
          series: seriesArr,
        };
      });
    }

    // KPIs Generales
    const totalDespachos = despachos.length;
    const totalItemsEntregados = despachos.reduce((acc, d) => acc + Number(d.total_items || 0), 0);
    const totalSeriesEntregadas = despachos.reduce((acc, d) => acc + Number(d.total_series || 0), 0);
    const tecnicosUnicos = new Set(despachos.map(d => d.id_trabajador)).size;

    res.json({
      success: true,
      despachos,
      kpis: {
        totalDespachos,
        totalItemsEntregados,
        totalSeriesEntregadas,
        tecnicosUnicos,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/actas-historial', async (req, res) => {
  try {
    const { fechaDesde, fechaHasta, id_trabajador, busqueda, estado } = req.query;

    let whereSql = "WHERE (p.nombre LIKE '%ACTA%' OR p.nombre LIKE '%TALONARIO%' OR ps.numero_serie LIKE '%001-%')";
    const params = [];

    if (id_trabajador && id_trabajador !== 'todos') {
      whereSql += " AND ts.id_trabajador = ?";
      params.push(id_trabajador);
    }

    if (fechaDesde && fechaHasta) {
      whereSql += " AND DATE(ts.fecha_asignacion) BETWEEN ? AND ?";
      params.push(fechaDesde, fechaHasta);
    } else if (fechaDesde) {
      whereSql += " AND DATE(ts.fecha_asignacion) >= ?";
      params.push(fechaDesde);
    } else if (fechaHasta) {
      whereSql += " AND DATE(ts.fecha_asignacion) <= ?";
      params.push(fechaHasta);
    }

    const [rows] = await pool.query(`
      SELECT 
        ts.id_trabajador_serie,
        ts.id_trabajador,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        COALESCE(u.documento, '') AS tecnico_dni,
        COALESCE(u.cuadrilla, 'S/C') AS cuadrilla,
        COALESCE(v.placa, 'Sin vehículo') AS vehiculo_placa,
        ts.id_producto,
        p.nombre AS producto_nombre,
        ps.id_producto_serie,
        ps.numero_serie,
        ts.estado,
        ts.fecha_asignacion
      FROM trabajador_series ts
      JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
      JOIN productos p ON ts.id_producto = p.id_producto
      JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      ${whereSql}
      ORDER BY ts.fecha_asignacion DESC, ps.numero_serie ASC
    `, params);

    // Agrupar por técnico
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.id_trabajador)) {
        map.set(r.id_trabajador, {
          id_trabajador: r.id_trabajador,
          tecnico_nombre: r.tecnico_nombre,
          tecnico_dni: r.tecnico_dni,
          cuadrilla: r.cuadrilla,
          vehiculo_placa: r.vehiculo_placa,
          fecha_asignacion: r.fecha_asignacion,
          series: [],
        });
      }
      map.get(r.id_trabajador).series.push(r);
    }

    let items = Array.from(map.values()).map(tec => {
      const total = tec.series.length;
      const disp = tec.series.filter(s => s.estado === 'Asignada').length;
      const usadas = tec.series.filter(s => s.estado === 'Usada' || s.estado === 'Liquidada').length;
      const devueltas = tec.series.filter(s => s.estado === 'Devuelta').length;

      // Calcular rangos correlativos
      const sorted = [...tec.series].sort((a, b) => a.numero_serie.localeCompare(b.numero_serie, undefined, { numeric: true }));
      let rangos = [];
      if (sorted.length > 0) {
        let rIni = sorted[0].numero_serie;
        let prevNum = parseInt(rIni.replace(/\D/g, ''), 10);
        let count = 1;
        for (let i = 1; i < sorted.length; i++) {
          const curStr = sorted[i].numero_serie;
          const curNum = parseInt(curStr.replace(/\D/g, ''), 10);
          if (!isNaN(prevNum) && !isNaN(curNum) && curNum === prevNum + 1) {
            count++;
            prevNum = curNum;
          } else {
            const finStr = sorted[i-1].numero_serie;
            rangos.push(rIni === finStr ? rIni : `${rIni} → ${finStr} (${count} und)`);
            rIni = curStr;
            prevNum = curNum;
            count = 1;
          }
        }
        const uStr = sorted[sorted.length - 1].numero_serie;
        rangos.push(rIni === uStr ? rIni : `${rIni} → ${uStr} (${count} und)`);
      }

      return {
        id_trabajador: tec.id_trabajador,
        tecnico_nombre: tec.tecnico_nombre,
        tecnico_dni: tec.tecnico_dni,
        cuadrilla: tec.cuadrilla,
        vehiculo_placa: tec.vehiculo_placa,
        fecha_asignacion: tec.fecha_asignacion,
        total_actas: total,
        disponibles_carro: disp,
        usadas_liquidaciones: usadas,
        devueltas_almacen: devueltas,
        rangos,
        rangos_texto: rangos.join(' | '),
        series: tec.series.map(s => ({
          numero_serie: s.numero_serie,
          estado: s.estado,
          fecha_asignacion: s.fecha_asignacion,
        })),
      };
    });

    if (estado && estado !== 'todos') {
      if (estado === 'con_stock') {
        items = items.filter(i => i.disponibles_carro > 0);
      } else if (estado === 'usadas') {
        items = items.filter(i => i.usadas_liquidaciones > 0);
      } else if (estado === 'devueltas') {
        items = items.filter(i => i.devueltas_almacen > 0);
      }
    }

    if (busqueda && busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      items = items.filter(i => 
        i.tecnico_nombre.toLowerCase().includes(q) ||
        i.tecnico_dni.toLowerCase().includes(q) ||
        i.cuadrilla.toLowerCase().includes(q) ||
        i.vehiculo_placa.toLowerCase().includes(q) ||
        i.rangos_texto.toLowerCase().includes(q) ||
        i.series.some(s => s.numero_serie.toLowerCase().includes(q))
      );
    }

    const totalActasAsignadas = items.reduce((acc, i) => acc + i.total_actas, 0);
    const totalDisponibles = items.reduce((acc, i) => acc + i.disponibles_carro, 0);
    const totalUsadas = items.reduce((acc, i) => acc + i.usadas_liquidaciones, 0);
    const totalDevueltas = items.reduce((acc, i) => acc + i.devueltas_almacen, 0);

    res.json({
      success: true,
      items,
      kpis: {
        totalTecnicos: items.length,
        totalActasAsignadas,
        totalDisponibles,
        totalUsadas,
        totalDevueltas,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/devolucion-tecnico', async (req, res) => {
  try {
    const { id_trabajador, id_producto, cantidad, series_devueltas, motivo, devolver_todo } = req.body;

    if (!id_trabajador) {
      return res.status(400).json({ error: "Debe indicar el técnico que realiza la devolución." });
    }

    const [tecnicoRows] = await pool.query(`
      SELECT TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre
      FROM trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE t.id_trabajador = ?
    `, [id_trabajador]);
    const tecnicoNombre = tecnicoRows[0]?.tecnico_nombre || `Técnico #${id_trabajador}`;

    // CASO A: Devolver toda la dotación completa (cuando el técnico se retira / cese)
    if (devolver_todo) {
      // 1. Devolver todos los productos asignados (trabajador_productos)
      const [prodRows] = await pool.query(`
        SELECT tp.id_producto, tp.stock, c.nombre AS categoria
        FROM trabajador_productos tp
        JOIN productos p ON tp.id_producto = p.id_producto
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
        WHERE tp.id_trabajador = ? AND tp.stock > 0
      `, [id_trabajador]);

      for (const p of prodRows) {
        const es2doUso = esCategoriaSegundoUso(p.categoria);
        if (es2doUso) {
          const [upd] = await pool.query("UPDATE stock SET cantidad_segundo_uso = COALESCE(cantidad_segundo_uso, 0) + ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [p.stock, p.id_producto]);
          if (upd.affectedRows === 0) {
            await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 0, ?)", [p.id_producto, p.stock]);
          }
          await pool.query(`
            INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
            VALUES (?, 1, 'ENTRADA', ?, ?, NOW())
          `, [p.id_producto, p.stock, `Devolución total por retiro (SEGUNDO USO): ${tecnicoNombre} (${motivo || 'Baja de personal'})`]);
        } else {
          const [upd] = await pool.query("UPDATE stock SET cantidad = COALESCE(cantidad, 0) + ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [p.stock, p.id_producto]);
          if (upd.affectedRows === 0) {
            await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, ?, 0)", [p.id_producto, p.stock]);
          }
          await pool.query(`
            INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
            VALUES (?, 1, 'ENTRADA', ?, ?, NOW())
          `, [p.id_producto, p.stock, `Devolución total por retiro: ${tecnicoNombre} (${motivo || 'Baja de personal'})`]);
        }
      }
      await pool.query("UPDATE trabajador_productos SET stock = 0 WHERE id_trabajador = ?", [id_trabajador]);

      // 2. Devolver todas las series activas (trabajador_series)
      const [serieRows] = await pool.query(`
        SELECT ts.id_trabajador_serie, ts.id_producto_serie, ps.id_producto, c.nombre AS categoria
        FROM trabajador_series ts
        JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
        JOIN productos p ON ps.id_producto = p.id_producto
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
        WHERE ts.id_trabajador = ? AND ts.estado = 'Asignada'
      `, [id_trabajador]);

      for (const s of serieRows) {
        await pool.query("UPDATE trabajador_series SET estado = 'Devuelta' WHERE id_trabajador_serie = ?", [s.id_trabajador_serie]);
        await pool.query("UPDATE producto_series SET estado = 'DISPONIBLE', id_almacen = 1 WHERE id_producto_serie = ?", [s.id_producto_serie]);
        const es2doUso = esCategoriaSegundoUso(s.categoria);
        if (es2doUso) {
          const [upd] = await pool.query("UPDATE stock SET cantidad_segundo_uso = COALESCE(cantidad_segundo_uso, 0) + 1 WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [s.id_producto]);
          if (upd.affectedRows === 0) {
            await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 0, 1)", [s.id_producto]);
          }
        } else {
          const [upd] = await pool.query("UPDATE stock SET cantidad = COALESCE(cantidad, 0) + 1 WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [s.id_producto]);
          if (upd.affectedRows === 0) {
            await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 1, 0)", [s.id_producto]);
          }
        }
      }

      return res.json({ success: true, message: `Se devolvió exitosamente toda la dotación de ${tecnicoNombre} a Almacén Central.` });
    }

    // CASO B: Devolución específica de un producto o material
    if (id_producto && Number(cantidad) > 0) {
      const cant = Number(cantidad);
      const [tp] = await pool.query("SELECT stock FROM trabajador_productos WHERE id_trabajador = ? AND id_producto = ?", [id_trabajador, id_producto]);
      const stockActual = tp[0]?.stock || 0;
      if (cant > stockActual) {
        return res.status(400).json({ error: `El técnico solo tiene ${stockActual} unidades en su vehículo. No puede devolver ${cant}.` });
      }

      // 1. Obtener datos del producto (categoría y si maneja serie)
      const [pRow] = await pool.query("SELECT p.id_producto, p.nombre, p.maneja_serie, c.nombre AS categoria FROM productos p LEFT JOIN categorias c ON p.id_categoria = c.id_categoria WHERE p.id_producto = ?", [id_producto]);
      const prodInfo = pRow[0] || {};
      const esEquipo = Boolean(prodInfo.maneja_serie) || String(prodInfo.categoria || '').toUpperCase().includes('EQUIP');
      const es2doUso = esCategoriaSegundoUso(prodInfo.categoria);

      // 2. Si el producto es equipo o maneja series, procesar las series asociadas
      if (esEquipo) {
        let seriesALiberar = [];
        if (Array.isArray(series_devueltas) && series_devueltas.length > 0) {
          seriesALiberar = series_devueltas.map(s => String(s.numero_serie || s).trim().toUpperCase());
        } else {
          // Tomar automáticamente las cant series asignadas activas de este técnico para este producto
          const [seriesActivas] = await pool.query(`
            SELECT ps.numero_serie 
            FROM trabajador_series ts
            JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
            WHERE ts.id_trabajador = ? AND ts.id_producto = ? AND ts.estado = 'Asignada'
            ORDER BY ts.id_trabajador_serie ASC
            LIMIT ?
          `, [id_trabajador, id_producto, cant]);
          seriesALiberar = seriesActivas.map(s => s.numero_serie);
        }

        for (const numSerie of seriesALiberar) {
          const [sRows] = await pool.query(`
            SELECT ts.id_trabajador_serie, ts.id_producto_serie
            FROM trabajador_series ts
            JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
            WHERE ts.id_trabajador = ? AND ps.numero_serie = ? AND ts.estado = 'Asignada'
          `, [id_trabajador, numSerie]);

          if (sRows.length > 0) {
            const s = sRows[0];
            await pool.query("UPDATE trabajador_series SET estado = 'Devuelta' WHERE id_trabajador_serie = ?", [s.id_trabajador_serie]);
            await pool.query("UPDATE producto_series SET estado = 'DISPONIBLE', id_almacen = 1 WHERE id_producto_serie = ?", [s.id_producto_serie]);
          }
        }

        // Recalcular stock del técnico en base a las series que realmente le quedan asignadas
        const [cntRows] = await pool.query(`
          SELECT COUNT(*) as totalAsig 
          FROM trabajador_series 
          WHERE id_trabajador = ? AND id_producto = ? AND estado = 'Asignada'
        `, [id_trabajador, id_producto]);
        const nuevoStockTecnico = cntRows[0]?.totalAsig || 0;
        await pool.query("UPDATE trabajador_productos SET stock = ? WHERE id_trabajador = ? AND id_producto = ?", [nuevoStockTecnico, id_trabajador, id_producto]);
      } else {
        await pool.query("UPDATE trabajador_productos SET stock = GREATEST(0, stock - ?) WHERE id_trabajador = ? AND id_producto = ?", [cant, id_trabajador, id_producto]);
      }

      // 3. Devolver stock a Almacén Central (id_almacen = 1)
      // 🎯 REGLA DE DROP EN BOBINA: Solo si es >= 70m entra a Almacén como Stock Reutilizable. Si es < 70m es MERMA.
      const prodNombreUpper = String(prodInfo.nombre || '').toUpperCase();
      const esDropBobina = prodInfo.id_producto === 55 || (
        prodNombreUpper.includes('DROP') && !prodNombreUpper.includes('CONECTORIZADO')
      );

      if (esDropBobina) {
        if (cant >= 70) {
          // Entra a stock como saldo reutilizable (segundo uso para reasignar)
          const [upd] = await pool.query("UPDATE stock SET cantidad_segundo_uso = COALESCE(cantidad_segundo_uso, 0) + ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [cant, id_producto]);
          if (upd.affectedRows === 0) {
            await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 0, ?)", [id_producto, cant]);
          }
          await pool.query(`
            INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
            VALUES (?, 1, 'ENTRADA', ?, ?, NOW())
          `, [id_producto, cant, `Devolución DROP REUTILIZABLE (>=70m) de ${tecnicoNombre} (${motivo || 'Sobrante de bobina'})`]);

          // Registrar en tabla de trazabilidad de drop
          await pool.query(`
            INSERT INTO inventario_devoluciones_drop (id_trabajador, id_producto, metros_devueltos, clasificacion, motivo, origen, id_usuario_registro, fecha_registro)
            VALUES (?, ?, ?, 'REUTILIZABLE', ?, 'MODAL_INDIVIDUAL', ?, NOW())
          `, [id_trabajador, id_producto, cant, motivo || 'Sobrante de bobina', req.user?.id_usuario || null]).catch(console.error);

        } else {
          // Es MERMA / retazo corto (<70m): NO se suma a stock disponible de almacén
          await pool.query(`
            INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
            VALUES (?, 1, 'SALIDA', ?, ?, NOW())
          `, [id_producto, cant, `Devolución DROP MERMA (<70m) de ${tecnicoNombre} (${motivo || 'Retazo no utilizable'})`]);

          // Registrar en tabla de mermas
          await pool.query(`
            INSERT INTO inventario_devoluciones_drop (id_trabajador, id_producto, metros_devueltos, clasificacion, motivo, origen, id_usuario_registro, fecha_registro)
            VALUES (?, ?, ?, 'MERMA', ?, 'MODAL_INDIVIDUAL', ?, NOW())
          `, [id_trabajador, id_producto, cant, motivo || 'Retazo no utilizable', req.user?.id_usuario || null]).catch(console.error);
        }
      } else if (es2doUso) {
        const [upd] = await pool.query("UPDATE stock SET cantidad_segundo_uso = COALESCE(cantidad_segundo_uso, 0) + ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [cant, id_producto]);
        if (upd.affectedRows === 0) {
          await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 0, ?)", [id_producto, cant]);
        }
        await pool.query(`
          INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
          VALUES (?, 1, 'ENTRADA', ?, ?, NOW())
        `, [id_producto, cant, `Devolución (SEGUNDO USO) de ${tecnicoNombre} (${motivo || 'Retorno de dotación'})`]);
      } else {
        const [upd] = await pool.query("UPDATE stock SET cantidad = COALESCE(cantidad, 0) + ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [cant, id_producto]);
        if (upd.affectedRows === 0) {
          await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, ?, 0)", [id_producto, cant]);
        }
        await pool.query(`
          INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
          VALUES (?, 1, 'ENTRADA', ?, ?, NOW())
        `, [id_producto, cant, `Devolución de ${esEquipo ? 'equipo' : 'material'} de ${tecnicoNombre} (${motivo || 'Retorno a almacén'})`]);
      }
    }

    res.json({ success: true, message: "Devolución registrada exitosamente en Almacén Central." });
  } catch (error) {
    console.error("Error en devolucion-tecnico:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/cruce-inventario/tecnicos', async (req, res) => {
  try {
    const { tipo_servicio, buscar } = req.query;

    let whereExtra = "";
    const params = [];

    if (tipo_servicio && tipo_servicio !== 'Todos') {
      whereExtra += " AND u.tipo_servicio = ?";
      params.push(tipo_servicio);
    }
    if (buscar && String(buscar).trim() !== '') {
      whereExtra += " AND (u.documento LIKE ? OR u.nombres LIKE ? OR u.primer_apellido LIKE ? OR u.apellidos LIKE ? OR u.cuadrilla LIKE ?)";
      const b = `%${String(buscar).trim()}%`;
      params.push(b, b, b, b, b);
    }

    const [tecnicosRows] = await pool.query(`
      SELECT 
        t.id_trabajador,
        t.id_usuario,
        u.documento AS dni,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        COALESCE(r.nombre, 'TECNICO') AS rol_nombre,
        COALESCE(u.tipo_servicio, 'GENERAL') AS tipo_servicio,
        COALESCE(u.cuadrilla, 'S/C') AS cuadrilla,
        COALESCE(v.placa, 'Sin vehículo') AS vehiculo_placa,
        COALESCE(tp.stock, 0) AS stock_drop_sistema,
        COALESCE(drop_info.id_producto, 55) AS id_producto_drop,
        COALESCE(drop_info.nombre, 'DROP') AS drop_nombre,
        -- Última auditoría realizada
        last_aud.id_auditoria AS last_id_auditoria,
        last_aud.stock_fisico AS last_stock_fisico,
        last_aud.sobrante_devuelto AS last_sobrante_devuelto,
        last_aud.metros_reutilizables AS last_metros_reutilizables,
        last_aud.metros_merma AS last_metros_merma,
        last_aud.diferencia AS last_diferencia,
        last_aud.estado_cuadre AS last_estado_cuadre,
        last_aud.observaciones AS last_observaciones,
        last_aud.fecha_auditoria AS last_fecha_auditoria,
        -- Totales históricos devueltos de este técnico
        COALESCE(totales_drop.total_reutilizable, 0) AS total_historico_reutilizable,
        COALESCE(totales_drop.total_merma, 0) AS total_historico_merma
      FROM trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      -- Buscar producto DROP (id 55 o MAT-DRP)
      LEFT JOIN productos drop_info ON drop_info.id_producto = 55
      -- Stock en móvil del Drop
      LEFT JOIN trabajador_productos tp ON t.id_trabajador = tp.id_trabajador AND tp.id_producto = 55
      -- Subquery de la última auditoría
      LEFT JOIN (
        SELECT a.*
        FROM inventario_auditorias_cruce a
        INNER JOIN (
          SELECT id_trabajador, MAX(id_auditoria) AS max_id
          FROM inventario_auditorias_cruce
          GROUP BY id_trabajador
        ) max_a ON a.id_auditoria = max_a.max_id
      ) last_aud ON t.id_trabajador = last_aud.id_trabajador
      -- Subquery de totales devueltos
      LEFT JOIN (
        SELECT 
          id_trabajador,
          SUM(CASE WHEN clasificacion = 'REUTILIZABLE' THEN metros_devueltos ELSE 0 END) AS total_reutilizable,
          SUM(CASE WHEN clasificacion = 'MERMA' THEN metros_devueltos ELSE 0 END) AS total_merma
        FROM inventario_devoluciones_drop
        GROUP BY id_trabajador
      ) totales_drop ON t.id_trabajador = totales_drop.id_trabajador
      WHERE (u.id_rol IN (2, 6) OR UPPER(r.nombre) IN ('TECNICO', 'SUPERVICION', 'SUPERVISOR'))
        AND u.estado = 'Activo'
        AND (t.estado = 'Activo' OR t.estado IS NULL)
        ${whereExtra}
      ORDER BY 
        CASE WHEN last_aud.fecha_auditoria IS NULL THEN 0 ELSE 1 END ASC,
        tecnico_nombre ASC
    `, params);

    res.json(tecnicosRows);
  } catch (error) {
    console.error("Error en /cruce-inventario/tecnicos:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/cruce-inventario/guardar', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      id_trabajador,
      id_producto = 55,
      stock_sistema,
      stock_fisico,
      sobrante_devuelto = 0,
      observaciones = '',
      metodo = 'MANUAL_INDIVIDUAL'
    } = req.body;

    if (!id_trabajador) {
      await conn.rollback();
      return res.status(400).json({ error: "Debe indicar el técnico a auditar." });
    }

    const nStockSistema = Number(stock_sistema) || 0;
    const nStockFisico = Number(stock_fisico) || 0;
    const nSobrante = Number(sobrante_devuelto) || 0;

    let metrosReutilizables = 0;
    let metrosMerma = 0;

    // Obtener nombre del técnico
    const [tRows] = await conn.query(`
      SELECT TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre
      FROM trabajadores t JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE t.id_trabajador = ?
    `, [id_trabajador]);
    const tecnicoNombre = tRows[0]?.tecnico_nombre || `Técnico #${id_trabajador}`;

    // Si devuelve sobrante, aplicar la regla de los 70m
    if (nSobrante > 0) {
      if (nSobrante >= 70) {
        metrosReutilizables = nSobrante;
        // Sumar al stock de Almacén Central como segundo uso
        const [upd] = await conn.query("UPDATE stock SET cantidad_segundo_uso = COALESCE(cantidad_segundo_uso, 0) + ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [nSobrante, id_producto]);
        if (upd.affectedRows === 0) {
          await conn.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 0, ?)", [id_producto, nSobrante]);
        }
        await conn.query(`
          INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
          VALUES (?, 1, 'ENTRADA', ?, ?, NOW())
        `, [id_producto, nSobrante, `Inventario Cruce: DROP REUTILIZABLE (>=70m) de ${tecnicoNombre}`]);

        await conn.query(`
          INSERT INTO inventario_devoluciones_drop (id_trabajador, id_producto, metros_devueltos, clasificacion, motivo, origen, id_usuario_registro, fecha_registro)
          VALUES (?, ?, ?, 'REUTILIZABLE', ?, ?, ?, NOW())
        `, [id_trabajador, id_producto, nSobrante, observaciones || 'Sobrante de bobina en inventario', metodo, req.user?.id_usuario || null]);
      } else {
        metrosMerma = nSobrante;
        await conn.query(`
          INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
          VALUES (?, 1, 'SALIDA', ?, ?, NOW())
        `, [id_producto, nSobrante, `Inventario Cruce: DROP MERMA (<70m) de ${tecnicoNombre}`]);

        await conn.query(`
          INSERT INTO inventario_devoluciones_drop (id_trabajador, id_producto, metros_devueltos, clasificacion, motivo, origen, id_usuario_registro, fecha_registro)
          VALUES (?, ?, ?, 'MERMA', ?, ?, ?, NOW())
        `, [id_trabajador, id_producto, nSobrante, observaciones || 'Retazo de bobina en inventario', metodo, req.user?.id_usuario || null]);
      }
    }

    // Actualizar el stock del técnico con lo que físicamente se queda en la camioneta
    const [updTech] = await conn.query("UPDATE trabajador_productos SET stock = ? WHERE id_trabajador = ? AND id_producto = ?", [nStockFisico, id_trabajador, id_producto]);
    if (updTech.affectedRows === 0) {
      await conn.query("INSERT INTO trabajador_productos (id_trabajador, id_producto, stock) VALUES (?, ?, ?)", [id_trabajador, id_producto, nStockFisico]);
    }

    // Cálculo matemático del cuadre: (Físico en carro + Sobrante devuelto) - Sistema
    const diferencia = (nStockFisico + nSobrante) - nStockSistema;
    let estadoCuadre = 'CUADRADO';
    if (diferencia < 0) estadoCuadre = 'FALTANTE';
    else if (diferencia > 0) estadoCuadre = 'SOBRANTE';

    // Guardar en tabla de auditorías
    const [resIns] = await conn.query(`
      INSERT INTO inventario_auditorias_cruce (
        id_trabajador, id_producto, stock_sistema, stock_fisico, sobrante_devuelto,
        metros_reutilizables, metros_merma, diferencia, estado_cuadre, observaciones,
        metodo, id_usuario_auditor, fecha_auditoria
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      id_trabajador, id_producto, nStockSistema, nStockFisico, nSobrante,
      metrosReutilizables, metrosMerma, diferencia, estadoCuadre, observaciones || null,
      metodo, req.user?.id_usuario || null
    ]);

    await conn.commit();

    res.json({
      success: true,
      id_auditoria: resIns.insertId,
      estado_cuadre: estadoCuadre,
      diferencia,
      metros_reutilizables: metrosReutilizables,
      metros_merma: metrosMerma,
      message: `Auditoría registrada exitosamente. Estado: ${estadoCuadre} (${diferencia > 0 ? '+' : ''}${diferencia}m).`
    });
  } catch (error) {
    await conn.rollback();
    console.error("Error al guardar cruce de inventario:", error);
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

router.post('/cruce-inventario/importar-excel', async (req, res) => {
  const { filas, id_producto = 55 } = req.body;
  if (!Array.isArray(filas) || filas.length === 0) {
    return res.status(400).json({ error: "No se proporcionaron filas válidas para importar." });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let totalProcesados = 0;
    let totalReutilizable = 0;
    let totalMerma = 0;
    let totalCuadrados = 0;
    let totalFaltantes = 0;
    let totalSobrantes = 0;

    for (const fila of filas) {
      let id_trabajador = fila.id_trabajador;

      // Si no viene id_trabajador, buscar por DNI o Nombre
      if (!id_trabajador && fila.dni) {
        const [uRow] = await conn.query("SELECT t.id_trabajador FROM trabajadores t JOIN usuarios u ON t.id_usuario = u.id_usuario WHERE u.documento = ? LIMIT 1", [String(fila.dni).trim()]);
        if (uRow[0]) id_trabajador = uRow[0].id_trabajador;
      }
      if (!id_trabajador && fila.nombre) {
        const [uRow] = await conn.query(`
          SELECT t.id_trabajador 
          FROM trabajadores t 
          JOIN usuarios u ON t.id_usuario = u.id_usuario 
          WHERE TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) LIKE ?
          LIMIT 1
        `, [`%${String(fila.nombre).trim()}%`]);
        if (uRow[0]) id_trabajador = uRow[0].id_trabajador;
      }

      if (!id_trabajador) continue;

      // Obtener stock actual en sistema de este técnico para el producto
      const [tpRows] = await conn.query("SELECT stock FROM trabajador_productos WHERE id_trabajador = ? AND id_producto = ?", [id_trabajador, id_producto]);
      const nStockSistema = tpRows[0] ? Number(tpRows[0].stock || 0) : 0;

      const nStockFisico = Number(fila.stock_fisico || fila.metros_fisicos || fila.stock_en_carro || 0);
      const nSobrante = Number(fila.sobrante_devuelto || fila.metros_sobrantes || fila.devolucion || 0);
      const obs = String(fila.observaciones || fila.motivo || 'Importación Excel de inventario');

      let mReutilizable = 0;
      let mMerma = 0;

      // Regla de los 70m
      if (nSobrante > 0) {
        if (nSobrante >= 70) {
          mReutilizable = nSobrante;
          totalReutilizable += nSobrante;
          const [upd] = await conn.query("UPDATE stock SET cantidad_segundo_uso = COALESCE(cantidad_segundo_uso, 0) + ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [nSobrante, id_producto]);
          if (upd.affectedRows === 0) {
            await conn.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 0, ?)", [id_producto, nSobrante]);
          }
          await conn.query(`
            INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
            VALUES (?, 1, 'ENTRADA', ?, ?, NOW())
          `, [id_producto, nSobrante, `Excel Cruce: DROP REUTILIZABLE (>=70m) Técnico #${id_trabajador}`]);

          await conn.query(`
            INSERT INTO inventario_devoluciones_drop (id_trabajador, id_producto, metros_devueltos, clasificacion, motivo, origen, id_usuario_registro, fecha_registro)
            VALUES (?, ?, ?, 'REUTILIZABLE', ?, 'IMPORTACION_EXCEL', ?, NOW())
          `, [id_trabajador, id_producto, nSobrante, obs, req.user?.id_usuario || null]);
        } else {
          mMerma = nSobrante;
          totalMerma += nSobrante;
          await conn.query(`
            INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
            VALUES (?, 1, 'SALIDA', ?, ?, NOW())
          `, [id_producto, nSobrante, `Excel Cruce: DROP MERMA (<70m) Técnico #${id_trabajador}`]);

          await conn.query(`
            INSERT INTO inventario_devoluciones_drop (id_trabajador, id_producto, metros_devueltos, clasificacion, motivo, origen, id_usuario_registro, fecha_registro)
            VALUES (?, ?, ?, 'MERMA', ?, 'IMPORTACION_EXCEL', ?, NOW())
          `, [id_trabajador, id_producto, nSobrante, obs, req.user?.id_usuario || null]);
        }
      }

      // Actualizar stock del técnico
      await conn.query("UPDATE trabajador_productos SET stock = ? WHERE id_trabajador = ? AND id_producto = ?", [nStockFisico, id_trabajador, id_producto]);

      const dif = (nStockFisico + nSobrante) - nStockSistema;
      let est = 'CUADRADO';
      if (dif < 0) { est = 'FALTANTE'; totalFaltantes++; }
      else if (dif > 0) { est = 'SOBRANTE'; totalSobrantes++; }
      else { totalCuadrados++; }

      await conn.query(`
        INSERT INTO inventario_auditorias_cruce (
          id_trabajador, id_producto, stock_sistema, stock_fisico, sobrante_devuelto,
          metros_reutilizables, metros_merma, diferencia, estado_cuadre, observaciones,
          metodo, id_usuario_auditor, fecha_auditoria
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IMPORTACION_EXCEL', ?, NOW())
      `, [
        id_trabajador, id_producto, nStockSistema, nStockFisico, nSobrante,
        mReutilizable, mMerma, dif, est, obs, req.user?.id_usuario || null
      ]);

      totalProcesados++;
    }

    await conn.commit();

    res.json({
      success: true,
      totalProcesados,
      totalReutilizable,
      totalMerma,
      totalCuadrados,
      totalFaltantes,
      totalSobrantes,
      message: `¡Importación completada! ${totalProcesados} técnicos auditados.`
    });
  } catch (errExcel) {
    await conn.rollback();
    console.error("Error al importar Excel de auditoría:", errExcel);
    res.status(500).json({ error: errExcel.message });
  } finally {
    conn.release();
  }
});

router.get('/cruce-inventario/historial', async (req, res) => {
  try {
    const { id_trabajador, tipo_servicio, clasificacion, fecha_desde, fecha_hasta } = req.query;

    let whereDev = "1=1";
    const paramsDev = [];

    if (id_trabajador && id_trabajador !== 'Todos') {
      whereDev += " AND d.id_trabajador = ?";
      paramsDev.push(Number(id_trabajador));
    }
    if (tipo_servicio && tipo_servicio !== 'Todos') {
      whereDev += " AND u.tipo_servicio = ?";
      paramsDev.push(tipo_servicio);
    }
    if (clasificacion && clasificacion !== 'Todos') {
      whereDev += " AND d.clasificacion = ?";
      paramsDev.push(clasificacion);
    }
    if (fecha_desde) {
      whereDev += " AND DATE(d.fecha_registro) >= ?";
      paramsDev.push(fecha_desde);
    }
    if (fecha_hasta) {
      whereDev += " AND DATE(d.fecha_registro) <= ?";
      paramsDev.push(fecha_hasta);
    }

    const [devoluciones] = await pool.query(`
      SELECT 
        d.id_devolucion,
        d.id_trabajador,
        d.id_producto,
        p.nombre AS producto_nombre,
        p.codigo AS producto_codigo,
        d.metros_devueltos,
        d.clasificacion,
        d.motivo,
        d.origen,
        d.fecha_registro,
        u.documento AS dni,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        COALESCE(r.nombre, 'TECNICO') AS rol_nombre,
        COALESCE(u.tipo_servicio, 'GENERAL') AS tipo_servicio,
        COALESCE(u.cuadrilla, 'S/C') AS cuadrilla,
        COALESCE(v.placa, 'Sin vehículo') AS vehiculo_placa,
        -- Usuario que registró
        TRIM(CONCAT(COALESCE(u_reg.nombres, ''), ' ', COALESCE(u_reg.primer_apellido, ''))) AS registrado_por
      FROM inventario_devoluciones_drop d
      JOIN productos p ON d.id_producto = p.id_producto
      JOIN trabajadores t ON d.id_trabajador = t.id_trabajador
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      LEFT JOIN usuarios u_reg ON d.id_usuario_registro = u_reg.id_usuario
      WHERE ${whereDev}
      ORDER BY d.fecha_registro DESC
      LIMIT 500
    `, paramsDev);

    // Auditorías de cruce realizadas
    const [auditorias] = await pool.query(`
      SELECT 
        a.id_auditoria,
        a.id_trabajador,
        a.id_producto,
        p.nombre AS producto_nombre,
        a.stock_sistema,
        a.stock_fisico,
        a.sobrante_devuelto,
        a.metros_reutilizables,
        a.metros_merma,
        a.diferencia,
        a.estado_cuadre,
        a.observaciones,
        a.metodo,
        a.fecha_auditoria,
        u.documento AS dni,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        COALESCE(r.nombre, 'TECNICO') AS rol_nombre,
        COALESCE(u.tipo_servicio, 'GENERAL') AS tipo_servicio,
        COALESCE(u.cuadrilla, 'S/C') AS cuadrilla
      FROM inventario_auditorias_cruce a
      JOIN productos p ON a.id_producto = p.id_producto
      JOIN trabajadores t ON a.id_trabajador = t.id_trabajador
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      ORDER BY a.fecha_auditoria DESC
      LIMIT 200
    `);

    res.json({
      devoluciones: devoluciones || [],
      auditorias: auditorias || []
    });
  } catch (error) {
    console.error("Error en /cruce-inventario/historial:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/cruce-inventario/tecnico-materiales/:idTrabajador', async (req, res) => {
  try {
    const idTrabajador = Number(req.params.idTrabajador);
    if (!idTrabajador) {
      return res.status(400).json({ error: "id_trabajador inválido." });
    }

    const [tRows] = await pool.query(`
      SELECT 
        t.id_trabajador,
        t.id_usuario,
        u.documento AS dni,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        COALESCE(r.nombre, 'TECNICO') AS rol_nombre,
        COALESCE(u.tipo_servicio, 'GENERAL') AS tipo_servicio,
        COALESCE(u.cuadrilla, 'S/C') AS cuadrilla,
        COALESCE(v.placa, 'Sin vehículo') AS vehiculo_placa
      FROM trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      WHERE t.id_trabajador = ?
    `, [idTrabajador]);

    if (tRows.length === 0) {
      return res.status(404).json({ error: "Técnico no encontrado." });
    }

    const [materiales] = await pool.query(`
      SELECT 
        p.id_producto,
        p.codigo,
        p.nombre,
        COALESCE(c.nombre, 'MATERIALES') AS categoria,
        COALESCE(c.id_categoria, 1) AS id_categoria,
        COALESCE(tp.stock, 0) AS stock_sistema,
        CASE 
          WHEN p.id_producto = 65 OR p.codigo = 'MAT-ACT' OR UPPER(p.nombre) LIKE '%ACTA%' THEN 1 
          ELSE 0 
        END AS es_acta,
        CASE 
          WHEN p.id_producto = 55 OR p.codigo = 'MAT-DRP' OR UPPER(p.nombre) = 'DROP' THEN 1 
          ELSE 0 
        END AS es_drop,
        COALESCE(p.maneja_serie, 0) AS maneja_serie,
        CASE 
          WHEN p.id_producto = 55 OR p.codigo = 'MAT-DRP' OR UPPER(p.nombre) = 'DROP' THEN 'Metros' 
          ELSE 'Unidades' 
        END AS unidad_medida,
        last_aud.stock_fisico AS last_stock_fisico,
        last_aud.sobrante_devuelto AS last_sobrante_devuelto,
        last_aud.metros_reutilizables AS last_metros_reutilizables,
        last_aud.metros_merma AS last_metros_merma,
        last_aud.diferencia AS last_diferencia,
        last_aud.estado_cuadre AS last_estado_cuadre,
        last_aud.fecha_auditoria AS last_fecha_auditoria
      FROM productos p
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN trabajador_productos tp ON p.id_producto = tp.id_producto AND tp.id_trabajador = ?
      LEFT JOIN (
        SELECT a.*
        FROM inventario_auditorias_cruce a
        INNER JOIN (
          SELECT id_trabajador, id_producto, MAX(id_auditoria) AS max_id
          FROM inventario_auditorias_cruce
          WHERE id_trabajador = ?
          GROUP BY id_trabajador, id_producto
        ) ma ON a.id_auditoria = ma.max_id
      ) last_aud ON p.id_producto = last_aud.id_producto
      WHERE (tp.stock > 0 OR p.id_categoria IN (1, 7, 12) OR p.id_producto = 55)
        AND (p.estado = 'Activo' OR p.estado IS NULL)
      ORDER BY 
        CASE WHEN p.id_producto = 55 THEN 0 ELSE 1 END,
        c.nombre ASC,
        p.nombre ASC
    `, [idTrabajador, idTrabajador]);

    const categorias = Array.from(new Set(materiales.map(m => m.categoria))).filter(Boolean);

    // Consultar series activas asignadas a este técnico (EQUIPOS y ACTAS)
    const [seriesRows] = await pool.query(`
      SELECT 
        ts.id_trabajador_serie,
        ts.id_trabajador,
        ts.id_producto,
        ts.id_producto_serie,
        COALESCE(ts.estado, 'Asignada') AS estado_asignacion,
        ts.fecha_asignacion,
        ps.numero_serie,
        ps.mac,
        ps.proid,
        ps.codigo_serie,
        COALESCE(ps.estado, 'RESERVADO') AS estado_serie,
        p.nombre AS equipo_nombre,
        p.codigo AS equipo_codigo,
        COALESCE(c.nombre, 'EQUIPOS') AS categoria,
        CASE WHEN p.nombre LIKE '%ACTA%' OR ps.numero_serie LIKE '001-%' OR p.id_producto = 65 THEN 1 ELSE 0 END AS es_acta
      FROM trabajador_series ts
      JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
      JOIN productos p ON ps.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE ts.id_trabajador = ?
        AND (ts.estado = 'Asignada' OR ts.estado = 'RESERVADO' OR ts.estado = '' OR ts.estado IS NULL OR ps.estado = 'RESERVADO')
      ORDER BY p.nombre ASC, ps.numero_serie ASC
    `, [idTrabajador]);

    // Agrupar actas correlativas en rangos
    const actasOnly = seriesRows.filter(s => s.es_acta);
    const rangosActas = [];
    let currRange = null;

    for (const a of actasOnly) {
      const parts = String(a.numero_serie).split('-');
      if (parts.length === 2 && !isNaN(Number(parts[1]))) {
        const prefix = parts[0] + '-';
        const num = Number(parts[1]);
        const padLen = parts[1].length;

        if (!currRange) {
          currRange = { prefix, startNum: num, endNum: num, padLen, count: 1 };
        } else if (currRange.prefix === prefix && num === currRange.endNum + 1) {
          currRange.endNum = num;
          currRange.count++;
        } else {
          rangosActas.push({
            rango_texto: `${currRange.prefix}${String(currRange.startNum).padStart(currRange.padLen, '0')} al ${currRange.prefix}${String(currRange.endNum).padStart(currRange.padLen, '0')}`,
            prefijo: currRange.prefix,
            inicio: String(currRange.startNum).padStart(currRange.padLen, '0'),
            fin: String(currRange.endNum).padStart(currRange.padLen, '0'),
            cantidad: currRange.count
          });
          currRange = { prefix, startNum: num, endNum: num, padLen, count: 1 };
        }
      }
    }
    if (currRange) {
      rangosActas.push({
        rango_texto: `${currRange.prefix}${String(currRange.startNum).padStart(currRange.padLen, '0')} al ${currRange.prefix}${String(currRange.endNum).padStart(currRange.padLen, '0')}`,
        prefijo: currRange.prefix,
        inicio: String(currRange.startNum).padStart(currRange.padLen, '0'),
        fin: String(currRange.endNum).padStart(currRange.padLen, '0'),
        cantidad: currRange.count
      });
    }

    res.json({
      tecnico: tRows[0],
      materiales: materiales || [],
      categorias: categorias,
      series: seriesRows || [],
      rangos_actas: rangosActas || []
    });
  } catch (error) {
    console.error("Error en /cruce-inventario/tecnico-materiales:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/cruce-inventario/guardar-lote-tecnico', async (req, res) => {
  const { id_trabajador, items = [], observaciones_generales = '' } = req.body;
  if (!id_trabajador) {
    return res.status(400).json({ error: "id_trabajador es requerido." });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "No hay materiales para guardar." });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [tRows] = await conn.query(`
      SELECT TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre
      FROM trabajadores t JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE t.id_trabajador = ?
    `, [id_trabajador]);
    const tecnicoNombre = tRows[0]?.tecnico_nombre || `Técnico #${id_trabajador}`;

    let totalGuardados = 0;
    let totalDropReutilizable = 0;
    let totalDropMerma = 0;

    for (const item of items) {
      const id_producto = Number(item.id_producto);
      if (!id_producto) continue;

      const nStockSistema = Number(item.stock_sistema) || 0;
      const nStockFisico = Number(item.stock_fisico !== undefined && item.stock_fisico !== '' ? item.stock_fisico : nStockSistema);
      const nSobrante = Number(item.sobrante_devuelto) || 0;
      const esDrop = Boolean(item.es_drop || id_producto === 55);
      const obs = String(item.observaciones || observaciones_generales || '');

      let metrosReutilizables = 0;
      let metrosMerma = 0;

      // Regla de DROP en bobina
      if (esDrop) {
        if (nSobrante > 0) {
          if (nSobrante >= 70) {
            metrosReutilizables = nSobrante;
            totalDropReutilizable += nSobrante;
            const [upd] = await conn.query("UPDATE stock SET cantidad_segundo_uso = COALESCE(cantidad_segundo_uso, 0) + ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [nSobrante, id_producto]);
            if (upd.affectedRows === 0) {
              await conn.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 0, ?)", [id_producto, nSobrante]);
            }
            await conn.query(`
              INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
              VALUES (?, 1, 'ENTRADA', ?, ?, NOW())
            `, [id_producto, nSobrante, `Inventario Cruce: DROP REUTILIZABLE (>=70m) de ${tecnicoNombre}`]);

            await conn.query(`
              INSERT INTO inventario_devoluciones_drop (id_trabajador, id_producto, metros_devueltos, clasificacion, motivo, origen, id_usuario_registro, fecha_registro)
              VALUES (?, ?, ?, 'REUTILIZABLE', ?, 'INVENTARIO_TECNICO', ?, NOW())
            `, [id_trabajador, id_producto, nSobrante, obs || 'Sobrante de bobina en inventario', req.user?.id_usuario || null]);
          } else {
            metrosMerma = nSobrante;
            totalDropMerma += nSobrante;
            await conn.query(`
              INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
              VALUES (?, 1, 'SALIDA', ?, ?, NOW())
            `, [id_producto, nSobrante, `Inventario Cruce: DROP MERMA (<70m) de ${tecnicoNombre}`]);

            await conn.query(`
              INSERT INTO inventario_devoluciones_drop (id_trabajador, id_producto, metros_devueltos, clasificacion, motivo, origen, id_usuario_registro, fecha_registro)
              VALUES (?, ?, ?, 'MERMA', ?, 'INVENTARIO_TECNICO', ?, NOW())
            `, [id_trabajador, id_producto, nSobrante, obs || 'Retazo de bobina en inventario', req.user?.id_usuario || null]);
          }
        }
      } else {
        // Otros materiales / equipos: si entrega sobrante, ingresa a almacén central
        if (nSobrante > 0) {
          const [upd] = await conn.query("UPDATE stock SET cantidad = COALESCE(cantidad, 0) + ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [nSobrante, id_producto]);
          if (upd.affectedRows === 0) {
            await conn.query("INSERT INTO stock (id_producto, id_almacen, cantidad) VALUES (?, 1, ?)", [id_producto, nSobrante]);
          }
          await conn.query(`
            INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
            VALUES (?, 1, 'ENTRADA', ?, ?, NOW())
          `, [id_producto, nSobrante, `Inventario Cruce: Devolución material de ${tecnicoNombre}`]);
        }
      }

      // Actualizar stock del técnico con lo que físicamente tiene
      const [updTech] = await conn.query("UPDATE trabajador_productos SET stock = ? WHERE id_trabajador = ? AND id_producto = ?", [nStockFisico, id_trabajador, id_producto]);
      if (updTech.affectedRows === 0) {
        await conn.query("INSERT INTO trabajador_productos (id_trabajador, id_producto, stock) VALUES (?, ?, ?)", [id_trabajador, id_producto, nStockFisico]);
      }

      // Diferencia y estado: (Físico + Sobrante) - Sistema
      const diferencia = (nStockFisico + nSobrante) - nStockSistema;
      let estadoCuadre = 'CUADRADO';
      if (diferencia < 0) estadoCuadre = 'FALTANTE';
      else if (diferencia > 0) estadoCuadre = 'SOBRANTE';

      // Insertar auditoría de cruce
      await conn.query(`
        INSERT INTO inventario_auditorias_cruce (
          id_trabajador, id_producto, stock_sistema, stock_fisico, sobrante_devuelto,
          metros_reutilizables, metros_merma, diferencia, estado_cuadre,
          observaciones, metodo, id_usuario_auditor, fecha_auditoria
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INVENTARIO_TECNICO', ?, NOW())
      `, [
        id_trabajador, id_producto, nStockSistema, nStockFisico, nSobrante,
        metrosReutilizables, metrosMerma, diferencia, estadoCuadre,
        obs, req.user?.id_usuario || null
      ]);

      totalGuardados++;
    }

    await conn.commit();
    res.json({
      success: true,
      totalGuardados,
      totalDropReutilizable,
      totalDropMerma,
      message: `Inventario de ${tecnicoNombre} guardado con éxito (${totalGuardados} materiales auditados).`
    });
  } catch (error) {
    await conn.rollback();
    console.error("Error en /cruce-inventario/guardar-lote-tecnico:", error);
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

router.post('/procesar-liquidacion', async (req, res) => {
  try {
    const {
      id_trabajador,
      tecnico_nombre,
      cuadrilla,
      vehiculo_placa,
      almacenero_nombre,
      motivo,
      observaciones,
      items,
      series_devueltas_todas
    } = req.body;

    if (!id_trabajador) {
      return res.status(400).json({ error: "Debe especificar el técnico a liquidar." });
    }

    let totalItemsDevueltos = 0;
    let totalSeriesDevueltas = Array.isArray(series_devueltas_todas) ? series_devueltas_todas.length : 0;

    // 1. Insertar cabecera de la liquidación
    const [liqResult] = await pool.query(`
      INSERT INTO liquidaciones_tecnicos (
        id_trabajador, tecnico_nombre, cuadrilla, vehiculo_placa, almacenero_nombre,
        motivo, observaciones, total_items_devueltos, total_series_devueltas, fecha_liquidacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      id_trabajador,
      tecnico_nombre || `Técnico #${id_trabajador}`,
      cuadrilla || 'S/C',
      vehiculo_placa || 'Sin vehículo',
      almacenero_nombre || 'Almacén Central',
      motivo || 'Baja / Retiro de personal',
      observaciones || '',
      0,
      totalSeriesDevueltas
    ]);

    const idLiquidacion = liqResult.insertId;

    // 2. Procesar ítems y descontar del vehículo / sumar a central
    if (Array.isArray(items)) {
      for (const it of items) {
        const prodId = Number(it.id_producto);
        const cantDevuelta = Number(it.cantidad_devuelta) || 0;
        const cantEsperada = Number(it.cantidad_esperada) || 0;
        const cantFaltante = Math.max(0, cantEsperada - cantDevuelta);

        totalItemsDevueltos += cantDevuelta;

        const cantAsignada = Number(it.cantidad_asignada) || (Number(it.cantidad_esperada) + Number(it.cantidad_gastada || 0)) || cantEsperada;
        const cantGastada = Number(it.cantidad_gastada) || 0;

        // Guardar detalle
        await pool.query(`
          INSERT INTO liquidacion_detalles (
            id_liquidacion, id_producto, producto_nombre, producto_codigo, categoria,
            cantidad_asignada, cantidad_gastada, cantidad_esperada, cantidad_devuelta, cantidad_faltante, series_devueltas, observaciones
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          idLiquidacion,
          prodId,
          it.producto_nombre || 'Material',
          it.producto_codigo || null,
          it.categoria || 'MATERIALES',
          cantAsignada,
          cantGastada,
          cantEsperada,
          cantDevuelta,
          cantFaltante,
          Array.isArray(it.series_devueltas) ? JSON.stringify(it.series_devueltas) : (it.series_devueltas || null),
          it.observaciones || null
        ]);

        // Aumentar en Almacén Central la cantidad devuelta (Segundo Uso solo para HERRAMIENTAS, UNIFORMES y VEHICULO)
        if (cantDevuelta > 0) {
          const esSegundoUso = esCategoriaSegundoUso(it.categoria);
          if (esSegundoUso) {
            const [upd] = await pool.query("UPDATE stock SET cantidad_segundo_uso = COALESCE(cantidad_segundo_uso, 0) + ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [cantDevuelta, prodId]);
            if (upd.affectedRows === 0) {
              await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 0, ?)", [prodId, cantDevuelta]);
            }
          } else {
            const [upd] = await pool.query("UPDATE stock SET cantidad = COALESCE(cantidad, 0) + ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [cantDevuelta, prodId]);
            if (upd.affectedRows === 0) {
              await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, ?, 0)", [prodId, cantDevuelta]);
            }
          }

          // Kardex Entrada
          await pool.query(`
            INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
            VALUES (?, 1, 'ENTRADA', ?, ?, NOW())
          `, [prodId, cantDevuelta, `Liquidación Dotación #${idLiquidacion} (${esSegundoUso ? 'SEGUNDO USO' : 'RETORNO ALMACEN'}): ${tecnico_nombre} (${motivo})`]);
        }

        // Si fue una liquidación total, dejar en 0 el stock asignado en el vehículo
        await pool.query("UPDATE trabajador_productos SET stock = GREATEST(0, stock - ?) WHERE id_trabajador = ? AND id_producto = ?", [cantEsperada, id_trabajador, prodId]);
      }
    }

    // 3. Procesar Equipos / Series devueltas
    if (Array.isArray(series_devueltas_todas) && series_devueltas_todas.length > 0) {
      for (const sn of series_devueltas_todas) {
        const cleanSn = String(sn).trim().toUpperCase();
        if (!cleanSn) continue;

        const [sRows] = await pool.query(`
          SELECT ts.id_trabajador_serie, ts.id_producto_serie, ps.id_producto, c.nombre AS categoria
          FROM trabajador_series ts
          JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
          JOIN productos p ON ps.id_producto = p.id_producto
          LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
          WHERE ts.id_trabajador = ? AND ps.numero_serie = ? AND ts.estado = 'Asignada'
        `, [id_trabajador, cleanSn]);

        if (sRows.length > 0) {
          const s = sRows[0];
          await pool.query("UPDATE trabajador_series SET estado = 'Devuelta' WHERE id_trabajador_serie = ?", [s.id_trabajador_serie]);
          await pool.query("UPDATE producto_series SET estado = 'DISPONIBLE', id_almacen = 1 WHERE id_producto_serie = ?", [s.id_producto_serie]);
          const es2doUso = esCategoriaSegundoUso(s.categoria);
          if (es2doUso) {
            const [upd] = await pool.query("UPDATE stock SET cantidad_segundo_uso = COALESCE(cantidad_segundo_uso, 0) + 1 WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)", [s.id_producto]);
            if (upd.affectedRows === 0) {
              await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 0, 1)", [s.id_producto]);
            }
          } else {
            const [upd] = await pool.query("UPDATE stock SET cantidad = COALESCE(cantidad, 0) + 1 WHERE id_producto = ? AND id_almacen = 1", [s.id_producto]);
            if (upd.affectedRows === 0) {
              await pool.query("INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso) VALUES (?, 1, 1, 0)", [s.id_producto]);
            }
          }
        }
      }
    }

    // Actualizar total devueltos en cabecera
    await pool.query("UPDATE liquidaciones_tecnicos SET total_items_devueltos = ? WHERE id_liquidacion = ?", [totalItemsDevueltos, idLiquidacion]);

    res.json({
      success: true,
      id_liquidacion: idLiquidacion,
      message: `Liquidación de ${tecnico_nombre} procesada exitosamente. Constancia #${idLiquidacion} generada.`
    });
  } catch (error) {
    console.error("Error en procesar-liquidacion:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/historial-liquidaciones', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        l.id_liquidacion,
        l.id_trabajador,
        l.tecnico_nombre,
        COALESCE(u.documento, '') AS tecnico_dni,
        l.cuadrilla,
        l.vehiculo_placa,
        l.almacenero_nombre,
        l.motivo,
        l.observaciones,
        l.total_items_devueltos,
        l.total_series_devueltas,
        l.fecha_liquidacion,
        COUNT(d.id_detalle) as total_lineas
      FROM liquidaciones_tecnicos l
      LEFT JOIN trabajadores t ON l.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN liquidacion_detalles d ON l.id_liquidacion = d.id_liquidacion
      GROUP BY l.id_liquidacion
      ORDER BY l.fecha_liquidacion DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error("Error en historial-liquidaciones:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/liquidacion/:id', async (req, res) => {
  try {
    const idLiq = req.params.id;
    const [cabecera] = await pool.query(`
      SELECT l.*, COALESCE(u.documento, '') AS tecnico_dni
      FROM liquidaciones_tecnicos l
      LEFT JOIN trabajadores t ON l.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE l.id_liquidacion = ?
    `, [idLiq]);
    if (cabecera.length === 0) {
      return res.status(404).json({ error: "Liquidación no encontrada." });
    }
    const [detalles] = await pool.query(`
      SELECT 
        d.*,
        CASE 
          WHEN COALESCE(d.cantidad_asignada, 0) > 0 THEN d.cantidad_asignada
          ELSE (d.cantidad_esperada + COALESCE(d.cantidad_gastada, 0))
        END AS cantidad_asignada,
        COALESCE(d.cantidad_gastada, 0) AS cantidad_gastada
      FROM liquidacion_detalles d 
      WHERE d.id_liquidacion = ?
    `, [idLiq]);
    res.json({
      ...cabecera[0],
      detalles
    });
  } catch (error) {
    console.error("Error en liquidacion/:id:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/kardex-movimientos', async (req, res) => {
  try {
    const {
      fechaDesde,
      fechaHasta,
      tipo,
      subtipo,
      idProducto,
      idCategoria,
      idTrabajador,
      search
    } = req.query;

    // 1. Movimientos Generales de Kardex (Compras, Despachos, Devoluciones, Ajustes)
    let whereMov = "1=1";
    const paramsMov = [];

    if (fechaDesde) {
      whereMov += " AND DATE(m.fecha_creacion) >= ?";
      paramsMov.push(fechaDesde);
    }
    if (fechaHasta) {
      whereMov += " AND DATE(m.fecha_creacion) <= ?";
      paramsMov.push(fechaHasta);
    }
    if (idProducto) {
      whereMov += " AND m.id_producto = ?";
      paramsMov.push(Number(idProducto));
    }
    if (idCategoria) {
      whereMov += " AND p.id_categoria = ?";
      paramsMov.push(Number(idCategoria));
    }

    const [movs] = await pool.query(`
      SELECT 
        CONCAT('MOV-', m.id_movimiento) AS id_unico,
        'KARDEX' AS origen,
        m.id_movimiento,
        m.id_producto,
        p.codigo AS producto_codigo,
        p.nombre AS producto_nombre,
        p.es_drop,
        p.maneja_serie,
        COALESCE(c.nombre, 'MATERIALES') AS categoria,
        m.tipo,
        CASE 
          WHEN m.referencia LIKE '%Traspaso%' OR m.referencia LIKE '%traspaso%' OR m.referencia LIKE '%Transferencia%' OR m.referencia LIKE '%transferencia%' THEN 
            CASE WHEN m.tipo = 'ENTRADA' THEN 'TRASPASO_ENTRADA' ELSE 'TRASPASO_SALIDA' END
          WHEN m.referencia LIKE '%Devolución%' OR m.referencia LIKE '%devolucion%' OR m.referencia LIKE '%Retorno%' THEN 'DEVOLUCION_TECNICO'
          WHEN m.referencia LIKE '%Compra%' OR m.referencia LIKE '%Factura%' OR m.referencia LIKE '%Ingreso%' OR m.referencia LIKE '%Proveedor%' THEN 'COMPRA_INGRESO'
          WHEN m.referencia LIKE '%Despacho%' OR m.referencia LIKE '%Dotación%' THEN 'DESPACHO_TECNICO'
          WHEN m.referencia LIKE '%Ajuste%' THEN 'AJUSTE_INVENTARIO'
          WHEN m.tipo = 'ENTRADA' THEN 'COMPRA_INGRESO'
          ELSE m.tipo
        END AS subtipo,
        m.cantidad,
        COALESCE(ps.numero_serie, '') AS numero_serie,
        COALESCE(ps.codigo_serie, '') AS codigo_serie,
        m.referencia,
        m.fecha_creacion AS fecha
      FROM movimientos m
      JOIN productos p ON m.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN producto_series ps ON m.id_producto_serie = ps.id_producto_serie
      WHERE ${whereMov}
      ORDER BY m.fecha_creacion DESC, m.id_movimiento DESC
    `, paramsMov);

    // Mapear trabajadores para enriquecer referencias que tengan "Técnico #123"
    const [allWorkers] = await pool.query(`
      SELECT 
        t.id_trabajador,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))) AS nombre_completo,
        COALESCE(u.cuadrilla, '') AS cuadrilla,
        COALESCE(r.nombre, 'Técnico') AS rol_nombre
      FROM trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN roles r ON u.id_rol = r.id_rol
    `);
    const workerMap = new Map();
    allWorkers.forEach(w => {
      workerMap.set(String(w.id_trabajador), w);
    });

    movs.forEach(m => {
      if (m.referencia) {
        const matchTecId = m.referencia.match(/(?:Técnico|Tecnico|Cuadrilla)\s*#(\d+)/i);
        if (matchTecId && matchTecId[1]) {
          m.id_trabajador = Number(matchTecId[1]);
        }

        m.referencia = m.referencia.replace(/(?:Técnico|Tecnico|Cuadrilla)\s*#(\d+)/gi, (match, id) => {
          const w = workerMap.get(String(id));
          if (w && w.nombre_completo) {
            const role = (w.rol_nombre || '').toUpperCase().includes('SUPERVI') ? 'Supervisor' : 'Técnico';
            return `${role}: ${w.nombre_completo}${w.cuadrilla ? ` (${w.cuadrilla})` : ''}`;
          }
          return match;
        });
      }
    });

    // 2. Consumos y Descargos en Órdenes de Trabajo de Campo
    let whereOrd = "1=1";
    const paramsOrd = [];

    if (fechaDesde) {
      whereOrd += " AND DATE(ol.fecha_liquidacion) >= ?";
      paramsOrd.push(fechaDesde);
    }
    if (fechaHasta) {
      whereOrd += " AND DATE(ol.fecha_liquidacion) <= ?";
      paramsOrd.push(fechaHasta);
    }
    if (idProducto) {
      whereOrd += " AND old.id_producto = ?";
      paramsOrd.push(Number(idProducto));
    }
    if (idCategoria) {
      whereOrd += " AND p.id_categoria = ?";
      paramsOrd.push(Number(idCategoria));
    }
    if (idTrabajador) {
      whereOrd += " AND ol.id_trabajador = ?";
      paramsOrd.push(Number(idTrabajador));
    }

    const [ordenLiquidaciones] = await pool.query(`
      SELECT 
        CONCAT('ORD-', old.id_detalle_liq) AS id_unico,
        'ORDEN_CAMPO' AS origen,
        old.id_detalle_liq AS id_movimiento,
        old.id_producto,
        ol.id_trabajador,
        p.codigo AS producto_codigo,
        p.nombre AS producto_nombre,
        p.es_drop,
        p.maneja_serie,
        COALESCE(c.nombre, 'MATERIALES') AS categoria,
        'SALIDA' AS tipo,
        'LIQUIDACION_ORDEN' AS subtipo,
        old.cantidad,
        COALESCE(old.numero_serie, '') AS numero_serie,
        '' AS codigo_serie,
        CONCAT(
          'Descargo en Orden #', COALESCE(o.numero, old.id_liquidacion),
          ' - Técnico: ', TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))),
          IF(COALESCE(u.cuadrilla, '') != '', CONCAT(' (', u.cuadrilla, ')'), '')
        ) AS referencia,
        ol.fecha_liquidacion AS fecha
      FROM orden_liquidacion_detalle old
      JOIN orden_liquidaciones ol ON old.id_liquidacion = ol.id_liquidacion
      JOIN productos p ON old.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN trabajadores t ON ol.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
      WHERE ${whereOrd}
      ORDER BY ol.fecha_liquidacion DESC
    `, paramsOrd);

    // 3. Unificar todos los movimientos
    let unificados = [...movs, ...ordenLiquidaciones];

    // Filtros en memoria para búsqueda textual y filtros específicos
    if (idTrabajador && String(idTrabajador).toUpperCase() !== 'TODOS') {
      const [tUser] = await pool.query(`
        SELECT 
          t.id_trabajador, 
          TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido, ''))) AS nombre,
          u.usuario,
          u.cuadrilla,
          u.nombres,
          COALESCE(u.primer_apellido, u.apellidos, '') AS primer_apellido
        FROM trabajadores t JOIN usuarios u ON t.id_usuario = u.id_usuario WHERE t.id_trabajador = ?
      `, [idTrabajador]);

      if (tUser && tUser.length > 0) {
        const uInfo = tUser[0];
        const nomTec = (uInfo.nombre || '').toUpperCase();
        const userTec = (uInfo.usuario || '').toUpperCase();
        const nomSimple = `${(uInfo.nombres || '').split(' ')[0]} ${(uInfo.primer_apellido || '').split(' ')[0]}`.trim().toUpperCase();
        const apellidoPart = (uInfo.primer_apellido || '').split(' ')[0].toUpperCase();

        unificados = unificados.filter(m => {
          // Si tiene id_trabajador coincidente
          if (m.id_trabajador && Number(m.id_trabajador) === Number(idTrabajador)) return true;
          // Si proviene de ordenes de campo y ya fue filtrado en la consulta SQL por ol.id_trabajador = ?
          if (m.origen === 'ORDEN_CAMPO') return true;

          const refUpper = (m.referencia || '').toUpperCase();
          return refUpper.includes(`TÉCNICO #${idTrabajador}`) || 
                 refUpper.includes(`TECNICO #${idTrabajador}`) || 
                 refUpper.includes(`SUPERVISOR #${idTrabajador}`) || 
                 refUpper.includes(`CUADRILLA #${idTrabajador}`) ||
                 (nomTec && refUpper.includes(nomTec)) ||
                 (userTec && refUpper.includes(userTec)) ||
                 (nomSimple.length > 4 && refUpper.includes(nomSimple)) ||
                 (apellidoPart.length >= 4 && refUpper.includes(apellidoPart));
        });
      }
    }

    if (tipo && tipo !== 'TODOS') {
      unificados = unificados.filter(m => m.tipo === tipo);
    }

    if (subtipo && subtipo !== 'TODOS') {
      if (subtipo === 'TRASPASOS') {
        unificados = unificados.filter(m => m.subtipo === 'TRASPASO_ENTRADA' || m.subtipo === 'TRASPASO_SALIDA');
      } else {
        unificados = unificados.filter(m => m.subtipo === subtipo);
      }
    }

    if (search && String(search).trim() !== '') {
      const q = String(search).trim().toUpperCase();
      unificados = unificados.filter(m => 
        (m.producto_nombre || '').toUpperCase().includes(q) ||
        (m.producto_codigo || '').toUpperCase().includes(q) ||
        (m.numero_serie || '').toUpperCase().includes(q) ||
        (m.codigo_serie || '').toUpperCase().includes(q) ||
        (m.referencia || '').toUpperCase().includes(q) ||
        (m.categoria || '').toUpperCase().includes(q)
      );
    }

    // Ordenar por fecha descendente
    unificados.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    // KPIs en tiempo real del conjunto filtrado / general
    const totalEntradas = unificados.filter(m => m.tipo === 'ENTRADA').reduce((acc, m) => acc + Number(m.cantidad || 0), 0);
    const totalDespachos = unificados.filter(m => m.subtipo === 'DESPACHO_TECNICO').reduce((acc, m) => acc + Number(m.cantidad || 0), 0);
    const totalDevoluciones = unificados.filter(m => m.subtipo === 'DEVOLUCION_TECNICO').reduce((acc, m) => acc + Number(m.cantidad || 0), 0);
    const totalConsumidoOrdenes = unificados.filter(m => m.subtipo === 'LIQUIDACION_ORDEN').reduce((acc, m) => acc + Number(m.cantidad || 0), 0);

    res.json({
      success: true,
      kpis: {
        totalMovimientos: unificados.length,
        totalEntradas,
        totalDespachos,
        totalDevoluciones,
        totalConsumidoOrdenes
      },
      movimientos: unificados
    });
  } catch (error) {
    console.error("Error en kardex-movimientos:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/actas-tecnicos', async (req, res) => {
  try {
    // 1. Obtener todos los técnicos
    const [tecnicos] = await pool.query(`
      SELECT 
        t.id_trabajador,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        COALESCE(u.cuadrilla, 'S/C') AS cuadrilla,
        COALESCE(v.placa, 'Sin vehículo') AS vehiculo_placa,
        COALESCE(u.telefono, '') AS telefono
      FROM trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      WHERE (u.id_rol IN (2, 6) OR UPPER(COALESCE(r.nombre, '')) LIKE '%TECNIC%' OR UPPER(COALESCE(r.nombre, '')) LIKE '%SUPERVI%')
        AND (t.estado = 'Activo' OR t.estado IS NULL)
      ORDER BY tecnico_nombre ASC
    `);

    // 2. Obtener todas las series de actas / talonarios
    const [actasSeries] = await pool.query(`
      SELECT 
        ts.id_trabajador_serie,
        ts.id_trabajador,
        ps.id_producto_serie,
        ps.numero_serie,
        p.id_producto,
        p.nombre AS producto_nombre,
        ts.estado,
        ts.fecha_asignacion,
        ol.id_orden,
        o.numero AS orden_numero,
        ol.fecha_liquidacion
      FROM trabajador_series ts
      JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
      JOIN productos p ON ts.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN orden_liquidaciones ol ON (
        ol.id_trabajador = ts.id_trabajador AND 
        (ol.numero_acta = ps.numero_serie OR ol.numero_guia = ps.numero_serie OR ol.numero_acta LIKE CONCAT('%', ps.numero_serie) OR ps.numero_serie LIKE CONCAT('%', ol.numero_acta))
      )
      LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
      WHERE (UPPER(COALESCE(c.nombre, '')) LIKE '%TALONARIO%' 
          OR UPPER(COALESCE(c.nombre, '')) LIKE '%ACTA%' 
          OR UPPER(COALESCE(c.nombre, '')) LIKE '%GUIA%' 
          OR UPPER(p.nombre) LIKE '%ACTA%' 
          OR UPPER(p.nombre) LIKE '%GUIA%')
        AND (ts.estado = 'Asignada' OR ts.estado = 'Usada' OR ts.estado = 'Liquidada' OR ts.estado = 'Anulada')
      ORDER BY ts.id_trabajador ASC, ps.numero_serie ASC
    `);

    // 3. Consolidar por técnico y agrupar correlativos consecutivos en rangos claros
    const resultado = tecnicos.map((tec) => {
      const actasDelTecnico = actasSeries.filter((a) => a.id_trabajador === tec.id_trabajador);
      const totalAsignadas = actasDelTecnico.length;
      const totalUsadas = actasDelTecnico.filter((a) => a.estado === 'Usada').length;
      const totalAnuladas = actasDelTecnico.filter((a) => a.estado === 'Anulada').length;
      const totalDisponibles = Math.max(0, totalAsignadas - totalUsadas - totalAnuladas);

      // Agrupar números correlativos consecutivos
      const rangos = [];
      if (actasDelTecnico.length > 0) {
        const sorted = [...actasDelTecnico].sort((a, b) => a.numero_serie.localeCompare(b.numero_serie, undefined, { numeric: true }));
        let rangoInicio = sorted[0].numero_serie;
        let rangoFin = sorted[0].numero_serie;
        let count = 1;

        for (let i = 1; i < sorted.length; i++) {
          const prevMatch = sorted[i - 1].numero_serie.match(/^(.*?)(\d+)$/);
          const currMatch = sorted[i].numero_serie.match(/^(.*?)(\d+)$/);

          if (
            prevMatch &&
            currMatch &&
            prevMatch[1] === currMatch[1] &&
            parseInt(currMatch[2], 10) === parseInt(prevMatch[2], 10) + 1
          ) {
            rangoFin = sorted[i].numero_serie;
            count++;
          } else {
            rangos.push(`${rangoInicio} → ${rangoFin} (${count} actas)`);
            rangoInicio = sorted[i].numero_serie;
            rangoFin = sorted[i].numero_serie;
            count = 1;
          }
        }
        rangos.push(`${rangoInicio} → ${rangoFin} (${count} actas)`);
      }

      return {
        id_trabajador: tec.id_trabajador,
        tecnico_nombre: tec.tecnico_nombre,
        cuadrilla: tec.cuadrilla,
        vehiculo_placa: tec.vehiculo_placa,
        telefono: tec.telefono,
        total_asignadas: totalAsignadas,
        total_usadas: totalUsadas,
        total_anuladas: totalAnuladas,
        total_disponibles: totalDisponibles,
        rangos: rangos.length > 0 ? rangos : ['Sin talonarios asignados'],
        actas: actasDelTecnico
      };
    });

    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/actas-central', async (req, res) => {
  try {
    const [actasCentral] = await pool.query(`
      SELECT 
        ps.id_producto_serie,
        ps.numero_serie,
        ps.codigo_serie,
        ps.estado,
        ps.fecha_ingreso,
        p.id_producto,
        p.nombre AS producto_nombre,
        p.stand,
        p.fila
      FROM producto_series ps
      JOIN productos p ON ps.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE ps.id_almacen = 1 
        AND ps.estado = 'DISPONIBLE'
        AND (UPPER(COALESCE(c.nombre, '')) LIKE '%TALONARIO%' 
          OR UPPER(COALESCE(c.nombre, '')) LIKE '%ACTA%' 
          OR UPPER(COALESCE(c.nombre, '')) LIKE '%GUIA%' 
          OR UPPER(p.nombre) LIKE '%ACTA%' 
          OR UPPER(p.nombre) LIKE '%GUIA%')
      ORDER BY ps.numero_serie ASC
    `);

    // Agrupar números correlativos consecutivos en talonarios / paquetes
    const rangos = [];
    if (actasCentral.length > 0) {
      const sorted = [...actasCentral].sort((a, b) => 
        a.numero_serie.localeCompare(b.numero_serie, undefined, { numeric: true })
      );
      let rangoInicio = sorted[0].numero_serie;
      let rangoFin = sorted[0].numero_serie;
      let count = 1;
      let primerItem = sorted[0];

      for (let i = 1; i < sorted.length; i++) {
        const prevMatch = sorted[i - 1].numero_serie.match(/^(.*?)(\d+)$/);
        const currMatch = sorted[i].numero_serie.match(/^(.*?)(\d+)$/);

        if (
          prevMatch &&
          currMatch &&
          prevMatch[1] === currMatch[1] &&
          parseInt(currMatch[2], 10) === parseInt(prevMatch[2], 10) + 1
        ) {
          rangoFin = sorted[i].numero_serie;
          count++;
        } else {
          rangos.push({
            rango_texto: `${rangoInicio} → ${rangoFin} (${count} actas)`,
            inicio: rangoInicio,
            fin: rangoFin,
            cantidad: count,
            stand: primerItem.stand || 'A',
            fila: primerItem.fila || 1,
            fecha_ingreso: primerItem.fecha_ingreso
          });
          rangoInicio = sorted[i].numero_serie;
          rangoFin = sorted[i].numero_serie;
          count = 1;
          primerItem = sorted[i];
        }
      }
      rangos.push({
        rango_texto: `${rangoInicio} → ${rangoFin} (${count} actas)`,
        inicio: rangoInicio,
        fin: rangoFin,
        cantidad: count,
        stand: primerItem.stand || 'A',
        fila: primerItem.fila || 1,
        fecha_ingreso: primerItem.fecha_ingreso
      });
    }

    res.json({
      total_disponibles: actasCentral.length,
      rangos,
      actas: actasCentral
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/actas/anular', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id_trabajador, id_usuario, numero_acta, motivo, foto_url, anulado_por } = req.body || {};

    if (!numero_acta || !motivo) {
      return res.status(400).json({ success: false, error: 'Número de acta y motivo son obligatorios.' });
    }

    const cleanActa = String(numero_acta).trim();
    const matchPrefAnul = cleanActa.match(/^([A-Z0-9]+)[-–\s]+([0-9]+)$/i);
    const prefAnul = matchPrefAnul ? matchPrefAnul[1] : '001';
    const sufAnul = matchPrefAnul ? matchPrefAnul[2] : cleanActa.replace(/^[A-Z0-9]+[-–]/i, '').trim();
    const numIntAnul = parseInt(sufAnul, 10);
    const sufSinCerosAnul = !isNaN(numIntAnul) ? String(numIntAnul) : sufAnul;
    const sufPad5Anul = !isNaN(numIntAnul) ? String(numIntAnul).padStart(5, '0') : sufAnul;
    const sufPad6Anul = !isNaN(numIntAnul) ? String(numIntAnul).padStart(6, '0') : sufAnul;

    const variantesAnulacion = Array.from(new Set([
      cleanActa,
      `${prefAnul}-${sufAnul}`,
      `${prefAnul}-${sufSinCerosAnul}`,
      `${prefAnul}-${sufPad5Anul}`,
      `${prefAnul}-${sufPad6Anul}`,
      sufAnul,
      sufSinCerosAnul,
      sufPad5Anul,
      sufPad6Anul
    ]));
    const formatoCompleto = `${prefAnul}-${sufAnul}`;

    await connection.beginTransaction();

    // 1. Resolver id_trabajador si nos pasaron id_usuario
    let finalIdTrabajador = id_trabajador;
    if (!finalIdTrabajador && id_usuario) {
      const [tRows] = await connection.query(`
        SELECT id_trabajador FROM trabajadores WHERE id_usuario = ? LIMIT 1
      `, [id_usuario]);
      if (tRows.length > 0) finalIdTrabajador = tRows[0].id_trabajador;
    }

    // 2. Buscar la serie del acta en producto_series y trabajador_series
    let querySerie = `
      SELECT ps.id_producto_serie, ps.id_producto, ps.numero_serie, ts.id_trabajador_serie, ts.id_trabajador, ts.estado AS estado_ts
      FROM producto_series ps
      JOIN trabajador_series ts ON ps.id_producto_serie = ts.id_producto_serie
      WHERE ps.numero_serie IN (?)
    `;
    let queryParams = [variantesAnulacion];

    if (finalIdTrabajador) {
      querySerie += ' AND ts.id_trabajador = ?';
      queryParams.push(finalIdTrabajador);
    }

    const [serieRows] = await connection.query(querySerie + ' LIMIT 1', queryParams);

    let idProductoSerie = null;
    let idProducto = null;
    let idTrabajadorSerie = null;

    if (serieRows.length > 0) {
      const s = serieRows[0];
      idProductoSerie = s.id_producto_serie;
      idProducto = s.id_producto;
      idTrabajadorSerie = s.id_trabajador_serie;
      finalIdTrabajador = s.id_trabajador;

      if (s.estado_ts === 'Anulada') {
        await connection.rollback();
        return res.status(400).json({ success: false, error: `El acta ${formatoCompleto} ya figura como Anulada.` });
      }

      // Marcar trabajador_series como Anulada
      await connection.query("UPDATE trabajador_series SET estado = 'Anulada' WHERE id_trabajador_serie = ?", [idTrabajadorSerie]);

      // Marcar producto_series como BAJA / ANULADA
      await connection.query("UPDATE producto_series SET estado = 'BAJA' WHERE id_producto_serie = ?", [idProductoSerie]);

      // Descontar -1 en trabajador_productos (stock del técnico en camioneta)
      if (finalIdTrabajador && idProducto) {
        await connection.query(`
          UPDATE trabajador_productos 
          SET stock = GREATEST(0, stock - 1) 
          WHERE id_trabajador = ? AND id_producto = ?
        `, [finalIdTrabajador, idProducto]);
      }
    } else {
      // Buscar si al menos existe en producto_series general
      const [psGeneral] = await connection.query(`
        SELECT id_producto_serie, id_producto FROM producto_series 
        WHERE numero_serie = ? OR numero_serie = ? OR numero_serie = ?
        LIMIT 1
      `, [cleanActa, sufAnul, formatoCompleto]);

      if (psGeneral.length > 0) {
        idProductoSerie = psGeneral[0].id_producto_serie;
        idProducto = psGeneral[0].id_producto;
        await connection.query("UPDATE producto_series SET estado = 'BAJA' WHERE id_producto_serie = ?", [idProductoSerie]);
      }
    }

    // 3. Insertar en actas_anuladas
    await connection.query(`
      INSERT INTO actas_anuladas (
        id_trabajador, id_producto_serie, numero_acta, motivo, foto_url, anulado_por, fecha_anulacion
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [
      finalIdTrabajador || null,
      idProductoSerie || null,
      formatoCompleto,
      motivo,
      foto_url || null,
      anulado_por || 'Técnico en Campo'
    ]);

    // 4. Registrar en movimientos (Kardex: SALIDA por Anulación de Acta)
    if (idProducto) {
      await connection.query(`
        INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
        VALUES (?, 1, 'SALIDA', 1, ?, NOW())
      `, [
        idProducto,
        `Acta Física Anulada [${formatoCompleto}]: ${motivo} (Técnico ID: ${finalIdTrabajador || 'N/A'})`
      ]);
    }

    // 5. Auditoría
    try {
      await connection.query(`
        INSERT INTO auditoria_actividad (id_usuario, usuario_nombre, id_rol, rol_nombre, area, modulo, accion, id_referencia, descripcion, fecha_creacion)
        VALUES (1, ?, 1, 'TECNICO', 'OPERACIONES', 'ACTAS', 'ANULAR_ACTA', ?, ?, NOW())
      `, [
        anulado_por || 'Técnico en Campo',
        idProductoSerie || 0,
        `Acta física ${formatoCompleto} anulada. Motivo: "${motivo}".`
      ]);
    } catch (e) {}

    await connection.commit();

    res.json({
      success: true,
      message: `Acta física ${formatoCompleto} anulada correctamente e invalidada del stock.`,
      numero_acta: formatoCompleto
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error al anular acta física:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

router.get('/actas/anuladas', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        aa.id_acta_anulada,
        aa.id_trabajador,
        aa.id_producto_serie,
        aa.numero_acta,
        aa.motivo,
        aa.foto_url,
        aa.anulado_por,
        aa.fecha_anulacion,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        COALESCE(u.cuadrilla, 'S/C') AS cuadrilla,
        COALESCE(v.placa, 'Sin vehículo') AS vehiculo_placa
      FROM actas_anuladas aa
      LEFT JOIN trabajadores t ON aa.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      ORDER BY aa.fecha_anulacion DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener actas anuladas:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/tecnico-stock/:idTrabajador', async (req, res) => {
  try {
    const paramId = req.params.idTrabajador;

    // Obtener el id_trabajador real y su rol con prioridad al técnico que tenga stock asignado
    const [tRows] = await pool.query(`
      SELECT t.id_trabajador, u.id_usuario, u.id_rol, r.nombre AS rol_nombre
      FROM trabajadores t 
      JOIN usuarios u ON t.id_usuario = u.id_usuario 
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      WHERE t.id_usuario = ? OR t.id_trabajador = ?
      ORDER BY 
        (SELECT COUNT(*) FROM trabajador_productos tp WHERE tp.id_trabajador = t.id_trabajador) DESC,
        (t.id_usuario = ?) DESC
      LIMIT 1
    `, [paramId, paramId, paramId]);

    if (tRows.length === 0) {
      return res.json({ permitido: true, materiales: [], seriesAsignadas: [] });
    }

    const idTrabajador = tRows[0].id_trabajador;
    const idRol = tRows[0].id_rol;

    // 🔒 Permitido para técnicos
    const permitido = true;

    const [materiales] = await pool.query(`
      SELECT 
        tp.id_producto,
        p.codigo,
        p.nombre,
        p.es_drop,
        p.maneja_serie,
        p.categoria_liquidar,
        COALESCE(c.nombre, 'MATERIALES') AS categoria,
        tp.stock
      FROM trabajador_productos tp
      JOIN productos p ON tp.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE tp.id_trabajador = ? AND tp.stock > 0
      ORDER BY c.nombre ASC, p.nombre ASC
    `, [idTrabajador]);

    const [seriesAsignadas] = await pool.query(`
      SELECT 
        ts.id_trabajador_serie,
        ps.id_producto_serie,
        ps.numero_serie,
        p.id_producto,
        p.nombre AS equipo_nombre,
        COALESCE(c.nombre, 'EQUIPOS') AS categoria,
        ts.estado
      FROM trabajador_series ts
      JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
      JOIN productos p ON ts.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE ts.id_trabajador = ? AND ts.estado = 'Asignada'
      ORDER BY p.nombre ASC
    `, [idTrabajador]);

    res.json({ permitido, materiales, seriesAsignadas });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/producto-series/:idProducto', async (req, res) => {
  try {
    const idProducto = req.params.idProducto;

    const [productoRows] = await pool.query(`
      SELECT p.id_producto, p.codigo, p.proid, p.nombre, p.descripcion, c.nombre AS categoria, p.stock_minimo
      FROM productos p
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE p.id_producto = ?
    `, [idProducto]);

    if (productoRows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const producto = productoRows[0];

    const [series] = await pool.query(`
      SELECT 
        ps.id_producto_serie,
        ps.id_producto,
        ps.id_equipo,
        ps.proid,
        p.codigo AS producto_codigo,
        ps.codigo_serie,
        ps.numero_serie,
        ps.estado AS estado_serie,
        ps.fecha_ingreso,
        ts.id_trabajador,
        ts.estado AS estado_en_tecnico,
        ts.fecha_asignacion,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        COALESCE(u.cuadrilla, '') AS tecnico_cuadrilla,
        COALESCE(v.placa, '') AS vehiculo_placa
      FROM producto_series ps
      JOIN productos p ON ps.id_producto = p.id_producto
      LEFT JOIN trabajador_series ts ON ps.id_producto_serie = ts.id_producto_serie AND ts.estado = 'Asignada'
      LEFT JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      WHERE ps.id_producto = ?
      ORDER BY 
        CASE 
          WHEN ps.estado = 'DISPONIBLE' THEN 1
          WHEN ts.id_trabajador IS NOT NULL THEN 2
          ELSE 3
        END,
        ps.numero_serie ASC
    `, [idProducto]);

    res.json({
      producto,
      total_series: series.length,
      disponibles_almacen: series.filter(s => s.estado_serie === 'DISPONIBLE').length,
      asignadas_tecnicos: series.filter(s => s.id_trabajador !== null).length,
      defectuosos: series.filter(s => s.estado_serie === 'DEFECTUOSO').length,
      series
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/producto-series/:idProductoSerie/id-equipo', async (req, res) => {
  try {
    const { idProductoSerie } = req.params;
    const { id_equipo } = req.body;
    const cleanIdEquipo = id_equipo && String(id_equipo).trim() ? String(id_equipo).trim().toUpperCase() : null;

    if (cleanIdEquipo) {
      const [dups] = await pool.query(
        "SELECT id_producto_serie, numero_serie FROM producto_series WHERE id_equipo = ? AND id_producto_serie != ?",
        [cleanIdEquipo, idProductoSerie]
      );
      if (dups.length > 0) {
        return res.status(400).json({
          error: `El ID de equipo "${cleanIdEquipo}" ya está registrado en la serie "${dups[0].numero_serie}". Cada ID de equipo debe ser único.`
        });
      }
    }

    await pool.query(
      "UPDATE producto_series SET id_equipo = ? WHERE id_producto_serie = ?",
      [cleanIdEquipo, idProductoSerie]
    );

    res.json({ success: true, message: "ID de equipo actualizado correctamente.", id_equipo: cleanIdEquipo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/producto-series/:idProductoSerie/proid', async (req, res) => {
  try {
    const { idProductoSerie } = req.params;
    const { proid } = req.body;
    const cleanProid = proid && String(proid).trim() ? String(proid).trim().toUpperCase() : null;

    await pool.query(
      "UPDATE producto_series SET proid = ? WHERE id_producto_serie = ?",
      [cleanProid, idProductoSerie]
    );

    res.json({ success: true, message: "ID de modelo actualizado correctamente.", proid: cleanProid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/trazabilidad-serie/:serie', async (req, res) => {
  try {
    const rawSerie = req.params.serie ? req.params.serie.trim() : '';
    if (!rawSerie) {
      return res.json({ success: true, series: [] });
    }

    const [rows] = await pool.query(`
      SELECT 
        ps.id_producto_serie,
        ps.id_producto,
        ps.id_equipo,
        ps.proid,
        p.codigo AS producto_codigo,
        p.nombre AS producto_nombre,
        c.nombre AS categoria,
        ps.codigo_serie,
        ps.numero_serie,
        ps.estado AS estado_serie,
        ps.fecha_ingreso,
        ts.id_trabajador,
        ts.estado AS estado_en_tecnico,
        ts.fecha_asignacion,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        COALESCE(u.cuadrilla, '') AS tecnico_cuadrilla,
        COALESCE(v.placa, '') AS vehiculo_placa,
        -- Datos de Liquidación (si la serie fue liquidada en un equipo o como número de acta)
        CASE 
          WHEN ol_eq.id_liquidacion IS NOT NULL THEN 1 
          WHEN ol_acta.id_liquidacion IS NOT NULL THEN 1 
          ELSE 0 
        END AS es_liquidada,
        COALESCE(ol_eq.numero_acta, ol_acta.numero_acta, '') AS liq_acta,
        COALESCE(o_eq.numero, o_acta.numero, '') AS liq_orden,
        COALESCE(o_eq.cliente, o_acta.cliente, '') AS liq_cliente,
        COALESCE(ol_eq.fecha_liquidacion, ol_acta.fecha_liquidacion) AS liq_fecha,
        TRIM(CONCAT(
          COALESCE(u_eq.nombres, u_acta.nombres, ''), ' ', 
          COALESCE(u_eq.primer_apellido, u_eq.apellidos, u_acta.primer_apellido, u_acta.apellidos, '')
        )) AS liq_tecnico_nombre,
        COALESCE(u_eq.cuadrilla, u_acta.cuadrilla, '') AS liq_tecnico_cuadrilla
      FROM producto_series ps
      JOIN productos p ON ps.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN trabajador_series ts ON ps.id_producto_serie = ts.id_producto_serie AND ts.estado = 'Asignada'
      LEFT JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      -- Join si la serie fue instalada en un detalle de liquidación
      LEFT JOIN orden_liquidacion_detalle old ON (old.numero_serie = ps.numero_serie OR (old.id_producto_serie IS NOT NULL AND old.id_producto_serie = ps.id_producto_serie))
      LEFT JOIN orden_liquidaciones ol_eq ON old.id_liquidacion = ol_eq.id_liquidacion
      LEFT JOIN ordenes o_eq ON ol_eq.id_orden = o_eq.id_orden
      LEFT JOIN trabajadores t_eq ON ol_eq.id_trabajador = t_eq.id_trabajador
      LEFT JOIN usuarios u_eq ON t_eq.id_usuario = u_eq.id_usuario
      -- Join si el número de serie es un acta y fue liquidada en orden_liquidaciones
      LEFT JOIN orden_liquidaciones ol_acta ON ol_acta.numero_acta = ps.numero_serie
      LEFT JOIN ordenes o_acta ON ol_acta.id_orden = o_acta.id_orden
      LEFT JOIN trabajadores t_acta ON ol_acta.id_trabajador = t_acta.id_trabajador
      LEFT JOIN usuarios u_acta ON t_acta.id_usuario = u_acta.id_usuario
      WHERE ps.numero_serie LIKE ? OR ps.codigo_serie LIKE ? OR ps.id_equipo LIKE ? OR ps.proid LIKE ?
      ORDER BY es_liquidada DESC, ps.id_producto_serie DESC
      LIMIT 15
    `, [`%${rawSerie}%`, `%${rawSerie}%`, `%${rawSerie}%`, `%${rawSerie}%`]);

    res.json({ success: true, series: rows });
  } catch (err) {
    console.error("Error en trazabilidad-serie:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/producto-series/:idProductoSerie/estado', async (req, res) => {
  try {
    const { idProductoSerie } = req.params;
    const { nuevo_estado } = req.body;

    const estadosValidos = ['DISPONIBLE', 'RESERVADO', 'DEFECTUOSO', 'BAJA', 'VENDIDO'];
    if (!estadosValidos.includes(nuevo_estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    await pool.query(
      'UPDATE producto_series SET estado = ? WHERE id_producto_serie = ?',
      [nuevo_estado, idProductoSerie]
    );

    res.json({ success: true, message: `Estado de la serie actualizado a ${nuevo_estado}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/tecnico-dotacion-completa/:idTrabajador', async (req, res) => {
  try {
    const paramId = req.params.idTrabajador;

    const [tRows] = await pool.query(`
      SELECT t.id_trabajador 
      FROM trabajadores t 
      JOIN usuarios u ON t.id_usuario = u.id_usuario 
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      WHERE (t.id_usuario = ? OR t.id_trabajador = ?)
        AND (u.id_rol IN (2, 6) OR UPPER(COALESCE(r.nombre, '')) LIKE '%TECNIC%' OR UPPER(COALESCE(r.nombre, '')) LIKE '%SUPERVI%')
      ORDER BY 
        (SELECT COUNT(*) FROM trabajador_productos tp WHERE tp.id_trabajador = t.id_trabajador) DESC,
        (t.id_usuario = ?) DESC
      LIMIT 1
    `, [paramId, paramId, paramId]);

    if (tRows.length === 0) {
      return res.json({
        id_trabajador: paramId,
        materiales: [],
        cablesDrop: [],
        equipos: [],
        herramientas: [],
        uniformes: [],
        vehiculo: [],
        todosLosItems: [],
        seriesAsignadas: []
      });
    }
    const idTrabajador = tRows[0].id_trabajador;

    const [items] = await pool.query(`
      SELECT 
        tp.id_producto,
        p.codigo,
        p.nombre,
        p.es_drop,
        p.maneja_serie,
        COALESCE(c.nombre, 'GENERAL') AS categoria,
        tp.stock
      FROM trabajador_productos tp
      JOIN productos p ON tp.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE tp.id_trabajador = ? AND tp.stock > 0
      ORDER BY c.nombre ASC, p.nombre ASC
    `, [idTrabajador]);

    const [seriesAsignadas] = await pool.query(`
      SELECT 
        ts.id_trabajador_serie,
        ps.id_producto_serie,
        ps.numero_serie,
        p.id_producto,
        p.nombre AS equipo_nombre,
        COALESCE(c.nombre, 'EQUIPOS') AS categoria,
        ts.estado,
        ts.fecha_asignacion
      FROM trabajador_series ts
      JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
      JOIN productos p ON ts.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE ts.id_trabajador = ? AND ts.estado = 'Asignada'
      ORDER BY p.nombre ASC
    `, [idTrabajador]);

    const isDrop = (i) => i.es_drop == 1 || /drop|fibra drop|cable drop/i.test(i.nombre || '');

    res.json({
      id_trabajador: idTrabajador,
      materiales: items.filter(i => i.categoria === 'MATERIALES' && !isDrop(i)),
      cablesDrop: items.filter(i => isDrop(i)),
      equipos: items.filter(i => i.categoria === 'EQUIPOS'),
      herramientas: items.filter(i => i.categoria === 'HERRAMIENTAS'),
      uniformes: items.filter(i => i.categoria === 'UNIFORMES'),
      vehiculo: items.filter(i => i.categoria === 'VEHICULO'),
      todosLosItems: items,
      seriesAsignadas
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/orden-liquidaciones', async (req, res) => {
  try {
    let { desde, hasta, id_trabajador, estado } = req.query;

    if (!desde && !hasta) {
      const hoy = new Date();
      const pad = n => String(n).padStart(2, '0');
      const hoyStr = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;
      desde = hoyStr;
      hasta = hoyStr;
    }

    let dateCondLiq = "";
    let dateCondOrd = "";
    const paramsLiq = [];
    const paramsTec = [];

    if (desde) {
      dateCondLiq += " AND ol.fecha_liquidacion >= ?";
      paramsLiq.push(`${desde} 00:00:00`);
      dateCondOrd += " AND COALESCE(o2.fecha_solicitud, o2.fecha_visita, o2.fecha_creacion) >= ?";
      paramsTec.push(`${desde} 00:00:00`);
    }
    if (hasta) {
      dateCondLiq += " AND ol.fecha_liquidacion <= ?";
      paramsLiq.push(`${hasta} 23:59:59`);
      dateCondOrd += " AND COALESCE(o2.fecha_solicitud, o2.fecha_visita, o2.fecha_creacion) <= ?";
      paramsTec.push(`${hasta} 23:59:59`);
    }

    let workerCondLiq = "";
    if (id_trabajador && id_trabajador !== 'todos') {
      workerCondLiq = " AND (ol.id_trabajador = ? OR o.id_tecnico = ?)";
      paramsLiq.push(Number(id_trabajador), Number(id_trabajador));
    }

    let estadoCond = "";
    if (estado && estado !== 'todos') {
      estadoCond = " AND ol.estado = ?";
      paramsLiq.push(estado);
    }

    const paramsResumen = [...paramsTec, ...paramsTec];
    let dateCondLiqJoin = "";
    if (desde) {
      dateCondLiqJoin += " AND ol.fecha_liquidacion >= ?";
      paramsResumen.push(`${desde} 00:00:00`);
    }
    if (hasta) {
      dateCondLiqJoin += " AND ol.fecha_liquidacion <= ?";
      paramsResumen.push(`${hasta} 23:59:59`);
    }

    // 1. Resumen por técnico (con id_usuario real correspondiente a id_tecnico de ordenes)
    const [tecnicosRows] = await pool.query(`
      SELECT
        u.id_usuario AS id_trabajador,
        CONCAT(u.nombres, ' ', u.apellidos) AS tecnico,
        u.foto_personal,
        u.documento AS tecnico_dni,
        COALESCE(
          NULLIF(TRIM(u.cuadrilla), ''),
          (
            SELECT TRIM(
              CASE 
                WHEN o_c.cuadrilla LIKE '% CESPEDES%' THEN CONCAT(SUBSTRING_INDEX(o_c.cuadrilla, ' CESPEDES', 1), ' CESPEDES')
                WHEN o_c.cuadrilla LIKE '% TRASLADO%' THEN CONCAT(SUBSTRING_INDEX(o_c.cuadrilla, ' TRASLADO', 1), ' TRASLADO')
                WHEN o_c.cuadrilla LIKE '% MOTOWIN%' THEN CONCAT(SUBSTRING_INDEX(o_c.cuadrilla, ' MOTOWIN', 1), ' MOTOWIN')
                ELSE SUBSTRING_INDEX(o_c.cuadrilla, ' ', 3)
              END
            )
            FROM ordenes o_c 
            WHERE o_c.id_tecnico = u.id_usuario AND o_c.cuadrilla IS NOT NULL AND o_c.cuadrilla != ''
            ORDER BY o_c.fecha_visita DESC LIMIT 1
          )
        ) AS cuadrilla,
        (SELECT COUNT(*) FROM ordenes o2 WHERE o2.id_tecnico = u.id_usuario ${dateCondOrd}) AS total_ordenes,
        (SELECT COUNT(*) FROM ordenes o2 WHERE o2.id_tecnico = u.id_usuario AND (LOWER(o2.estado) LIKE '%finaliz%' OR LOWER(o2.estado) LIKE '%liquid%') ${dateCondOrd}) AS total_finalizadas,
        COUNT(DISTINCT CASE WHEN lq.estado <> 'Rechazada' THEN lq.id_liquidacion END) AS total_liquidaciones,
        COUNT(DISTINCT CASE WHEN lq.estado = 'Pendiente' THEN lq.id_liquidacion END) AS total_pendientes,
        COUNT(DISTINCT CASE WHEN lq.estado = 'Aprobada' THEN lq.id_liquidacion END) AS total_aprobadas,
        COUNT(DISTINCT CASE WHEN lq.estado = 'Rechazada' THEN lq.id_liquidacion END) AS total_rechazadas,
        COALESCE(SUM(
          CASE WHEN lq.estado = 'Rechazada' THEN 0
               ELSE lq.costo_liquidacion
          END
        ), 0) AS total_costo,
        MAX(lq.fecha_liquidacion) AS ultima_liquidacion
      FROM usuarios u
      LEFT JOIN trabajadores t ON t.id_usuario = u.id_usuario
      LEFT JOIN (
        SELECT 
          ol.id_liquidacion,
          ol.estado,
          ol.fecha_liquidacion,
          COALESCE(ol.id_trabajador, t2.id_trabajador) AS id_trabajador,
          COALESCE(t2.id_usuario, o2.id_tecnico) AS id_usuario,
          COALESCE(SUM(d.cantidad * COALESCE(p.precio_compra, 0)), 0) AS costo_liquidacion
        FROM orden_liquidaciones ol
        LEFT JOIN trabajadores t2 ON t2.id_trabajador = ol.id_trabajador
        LEFT JOIN ordenes o2 ON o2.id_orden = ol.id_orden
        LEFT JOIN orden_liquidacion_detalle d ON d.id_liquidacion = ol.id_liquidacion
        LEFT JOIN productos p ON p.id_producto = d.id_producto
        WHERE 1=1 ${dateCondLiqJoin}
        GROUP BY ol.id_liquidacion
      ) lq ON (lq.id_usuario = u.id_usuario OR (t.id_trabajador IS NOT NULL AND lq.id_trabajador = t.id_trabajador))
      GROUP BY u.id_usuario
      HAVING total_ordenes > 0 OR total_liquidaciones > 0
      ORDER BY tecnico ASC
    `, paramsResumen);

    const tecnicos = tecnicosRows.map((t) => {
      const finalizadas = Number(t.total_finalizadas) || 0;
      const liquidaciones = Number(t.total_liquidaciones) || 0;
      const pendientes = Math.max(0, finalizadas - liquidaciones);
      const ratio = finalizadas > 0 ? Math.round((liquidaciones / finalizadas) * 1000) / 10 : 0;
      return {
        ...t,
        total_finalizadas: finalizadas,
        total_pendientes_liquidacion: pendientes,
        ratio_liquidacion: ratio
      };
    });

    // 2. Detalle de liquidaciones individuales
    const [liquidaciones] = await pool.query(`
      SELECT
        ol.id_liquidacion,
        ol.id_orden,
        COALESCE(t.id_trabajador, ol.id_trabajador, o.id_tecnico) AS id_trabajador,
        COALESCE(
          NULLIF(TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))), ''),
          o.tecnico_asignado,
          o.cuadrilla,
          'Técnico Asignado'
        ) AS tecnico,
        COALESCE(u.documento, '') AS tecnico_dni,
        COALESCE(u.cuadrilla, o.cuadrilla, '') AS cuadrilla,
        ol.liquidado_por,
        ol.numero_acta,
        ol.numero_guia,
        COALESCE(
          NULLIF(TRIM(o.motivo_finalizacion), ''),
          CASE 
            WHEN ol.tipo_trabajo_acta NOT LIKE 'REASIGNAC%' AND ol.tipo_trabajo_acta != 'REITERADA'
            THEN NULLIF(TRIM(ol.tipo_trabajo_acta), '')
            ELSE NULL 
          END,
          NULLIF(TRIM(ol.tipo_trabajo_acta), ''),
          NULLIF(TRIM(o.tipo_trabajo), ''),
          'Liquidación Técnica'
        ) AS tipo_trabajo_acta,
        COALESCE(
          NULLIF(TRIM(o.motivo_finalizacion), ''),
          NULLIF(TRIM(ol.tipo_trabajo_acta), ''),
          NULLIF(TRIM(o.tipo_trabajo), '')
        ) AS tipo_liquidacion,
        ol.cto,
        ol.puerto,
        ol.speedtest_download,
        ol.speedtest_upload,
        ol.tipo_conexion,
        ol.drop_metro_inicio,
        ol.drop_metro_fin,
        ol.drop_total_metros,
        ol.observaciones,
        ol.observaciones_tecnico,
        ol.estado AS estado_liquidacion,
        ol.motivo_rechazo,
        ol.fecha_liquidacion,
        COALESCE(o.fecha_solicitud, o.fecha_visita, o.fecha_creacion) AS fecha_orden,
        o.fecha_solicitud,
        o.numero AS numero_orden,
        o.cliente,
        o.direccion,
        o.tipo_trabajo,
        COALESCE(
          NULLIF(TRIM(o.motivo_finalizacion), ''),
          NULLIF(TRIM(o.motivo_cancelacion), '')
        ) AS tipo_averia,
        o.fecha_visita,
        COUNT(d.id_detalle_liq) AS total_items,
        COALESCE(SUM(
          CASE WHEN ol.estado = 'Rechazada' THEN 0
               ELSE d.cantidad * COALESCE(p.precio_compra, 0)
          END
        ), 0) AS total_costo
      FROM orden_liquidaciones ol
      INNER JOIN ordenes o ON o.id_orden = ol.id_orden
      LEFT JOIN trabajadores t ON ol.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON (u.id_usuario = t.id_usuario OR u.id_usuario = o.id_tecnico)
      LEFT JOIN orden_liquidacion_detalle d ON d.id_liquidacion = ol.id_liquidacion
      LEFT JOIN productos p ON p.id_producto = d.id_producto
      WHERE 1=1 ${dateCondLiq} ${workerCondLiq} ${estadoCond}
      GROUP BY ol.id_liquidacion
      ORDER BY ol.fecha_liquidacion DESC
    `, paramsLiq);

    // 3. Enriquecer con materiales, metraje de Fénix y cálculo de alertas
    for (const liq of liquidaciones) {
      const [mats] = await pool.query(`
        SELECT
          d.id_detalle_liq,
          d.id_producto,
          d.numero_serie,
          d.cantidad,
          d.drop_inicio,
          d.drop_fin,
          p.nombre AS nombre_producto,
          p.categoria_liquidar,
          p.precio_compra,
          (d.cantidad * COALESCE(p.precio_compra, 0)) AS costo
        FROM orden_liquidacion_detalle d
        JOIN productos p ON p.id_producto = d.id_producto
        WHERE d.id_liquidacion = ?
        ORDER BY p.categoria_liquidar DESC, p.nombre ASC
      `, [liq.id_liquidacion]);
      liq.materiales = mats;

      // Buscar si Fénix reportó metraje en orden_tareas
      const [fenixTask] = await pool.query(`
        SELECT metraje, valor_texto, titulo
        FROM orden_tareas
        WHERE numero_orden = ? AND titulo LIKE '%METRAJE%'
        LIMIT 1
      `, [liq.numero_orden]);
      liq.metraje_fenix = fenixTask.length > 0 && fenixTask[0].metraje ? Number(fenixTask[0].metraje) : null;

      // REGLAS INTELIGENTES DE ALERTA:
      const trabTexto = ((liq.tipo_trabajo || '') + ' ' + (liq.tipo_averia || '') + ' ' + (liq.tipo_trabajo_acta || '')).toUpperCase();
      const esRecableado = trabTexto.includes('RECABLEADO') || trabTexto.includes('ALTA') || trabTexto.includes('NUEV') || trabTexto.includes('TENDIDO');
      const maxDropPermitido = esRecableado ? 500 : 120; // 500m en recableado, 120m en averías normales

      // Detectar si se liquidó con Rollo Drop Pre-Conectorizado
      let metrosConectorizado = 0;
      let itemConectorizado = null;
      for (const m of mats) {
        const nom = (m.nombre_producto || '').toUpperCase();
        if (nom.includes('CONECTORIZADO') || /DROP.*(50|100|150|200)/i.test(nom)) {
          itemConectorizado = m;
          let rollMts = 0;
          if (/200\s*(M|MT)?\b|\*200/i.test(nom)) rollMts = 200;
          else if (/150\s*(M|MT)?\b|\*150/i.test(nom)) rollMts = 150;
          else if (/100\s*(M|MT)?\b|\*100/i.test(nom)) rollMts = 100;
          else if (/(?:^|[^\d])50\s*(M|MT)?\b|\*50/i.test(nom)) rollMts = 50;
          else {
            const match = nom.match(/(\d+)\s*(?:M|MT)?/i);
            if (match) rollMts = parseInt(match[1], 10);
          }
          metrosConectorizado += rollMts * (Number(m.cantidad) || 1);
        }
      }
      liq.drop_conectorizado_item = itemConectorizado;
      liq.drop_conectorizado_metros = metrosConectorizado;

      const dropBobina = Number(liq.drop_total_metros) || 0;
      const totalDrop = dropBobina + metrosConectorizado;
      liq.drop_consumo_total_efectivo = totalDrop;

      // 🛡️ Detección precisa de Equipos Reales (ONT / Mesh / Router) sin falsos positivos por substrings (ej: CONTACTO)
      const esEquipoReal = (m) => {
        const nom = (m.nombre_producto || '').toUpperCase();
        // Descartar explícitamente insumos, cables, ferretería y cintas
        if (
          nom.includes('CONTACTO') || 
          nom.includes('CONECTOR') || 
          nom.includes('DROP') || 
          nom.includes('CABLE') || 
          nom.includes('CINTILLO') || 
          nom.includes('TEMPLADOR') || 
          nom.includes('AMARRE') || 
          nom.includes('ROTULADOR')
        ) {
          return false;
        }
        const esOntOMesh = /\b(ONT|MESH|ROUTER|MODEM|DECODIFICADOR)\b/i.test(nom);
        const tieneSerie = Boolean(m.numero_serie || m.serie);
        const esCatEquipo = (m.categoria_liquidar || m.categoria || '').toUpperCase() === 'EQUIPO';
        return (esOntOMesh || esCatEquipo) && (tieneSerie || esOntOMesh);
      };

      const esOntPrincipal = (m) => {
        const nom = (m.nombre_producto || '').toUpperCase();
        return esEquipoReal(m) && /\b(ONT|MODEM)\b/i.test(nom) && !/\b(TV\s*BOX|WINBOX|DECO|DECODIFICADOR|MESH)\b/i.test(nom);
      };

      const totalOntsPrincipales = mats.filter(esOntPrincipal).reduce((acc, m) => acc + (Number(m.cantidad) || 0), 0);

      const motivosAlerta = [];
      // ⚠️ DROP SUELTO DE BOBINA: Solo evaluar límite de metraje si se usó drop continuo de bobina
      if (dropBobina > maxDropPermitido) {
        motivosAlerta.push(`Drop bobina declarado (${dropBobina}m) supera el límite permitido (${maxDropPermitido}m) para ${esRecableado ? 'recableado/traslado' : 'avería'}.`);
      }
      // Si usó más de 1 rollo pre-conectorizado en una sola orden
      if (itemConectorizado && Number(itemConectorizado.cantidad) > 1) {
        motivosAlerta.push(`Se liquidaron ${itemConectorizado.cantidad} rollos de drop pre-conectorizado en una sola orden.`);
      }
      if (totalOntsPrincipales > 1) {
        motivosAlerta.push(`Se liquidaron ${totalOntsPrincipales} equipos ONT en una sola orden.`);
      }
      // Discrepancia con Fénix solo aplicable a bobina continua
      if (dropBobina > 0 && liq.metraje_fenix && Math.abs(dropBobina - liq.metraje_fenix) > 25) {
        motivosAlerta.push(`Discrepancia con Fénix: Declaró ${dropBobina}m de bobina pero tarea Fénix reporta ${liq.metraje_fenix}m.`);
      }

      liq.es_alerta = motivosAlerta.length > 0;
      liq.motivo_alerta = motivosAlerta.join(' | ');
      liq.max_drop_permitido = maxDropPermitido;
    }

    res.json({
      success: true,
      desde,
      hasta,
      tecnicos,
      liquidaciones
    });
  } catch (error) {
    console.error("Error al obtener liquidaciones para almacén:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/orden-liquidaciones/:id/aprobar', async (req, res) => {
  try {
    const idLiquidacion = req.params.id;
    await pool.query("UPDATE orden_liquidaciones SET estado = 'Aprobada', motivo_rechazo = NULL WHERE id_liquidacion = ?", [idLiquidacion]);
    res.json({ success: true, message: 'Liquidación aprobada correctamente.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/ordenes-pendientes-tecnico/:idTrabajador', async (req, res) => {
  try {
    const paramId = req.params.idTrabajador;
    const { desde, hasta, search } = req.query;

    // 1. Obtener id_usuario y id_trabajador asociados
    const [tRows] = await pool.query(`
      SELECT t.id_trabajador, u.id_usuario, 
             TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
             COALESCE(u.cuadrilla, '') AS cuadrilla
      FROM usuarios u
      LEFT JOIN trabajadores t ON t.id_usuario = u.id_usuario
      WHERE u.id_usuario = ? OR t.id_trabajador = ?
      LIMIT 1
    `, [paramId, paramId]);

    const idUsuario = tRows.length > 0 ? tRows[0].id_usuario : Number(paramId);
    const idTrabajador = tRows.length > 0 && tRows[0].id_trabajador ? tRows[0].id_trabajador : idUsuario;
    const tecnicoNombre = tRows.length > 0 ? tRows[0].tecnico_nombre : 'Técnico';
    const cuadrilla = tRows.length > 0 ? tRows[0].cuadrilla : '';

    let whereCond = `
      (o.id_tecnico = ? OR o.id_tecnico = ? OR t.id_trabajador = ?)
      AND (LOWER(o.estado) LIKE '%finaliz%' OR LOWER(o.estado) LIKE '%liquid%')
      AND NOT EXISTS (
        SELECT 1 FROM orden_liquidaciones ol 
        WHERE ol.id_orden = o.id_orden AND ol.estado <> 'Rechazada'
      )
      AND (
        o.tipo_trabajo IS NULL 
        OR (
          UPPER(o.tipo_trabajo) NOT LIKE '%PEX%' 
          AND UPPER(COALESCE(o.motivo_finalizacion, '')) NOT LIKE '%PEX%'
          AND UPPER(COALESCE(o.motivo_finalizacion, '')) NOT LIKE '%CONJUNTA%'
          AND (
            UPPER(COALESCE(o.motivo_finalizacion, '')) LIKE '%VALIDACION%'
            OR UPPER(COALESCE(o.motivo_finalizacion, '')) NOT LIKE '%PRUEBA DE SERVICIO%'
          )
        )
      )
    `;
    const params = [idUsuario, idTrabajador, idTrabajador];

    if (desde) {
      whereCond += " AND COALESCE(o.fecha_solicitud, o.fecha_visita, o.fecha_creacion) >= ?";
      params.push(`${desde} 00:00:00`);
    }
    if (hasta) {
      whereCond += " AND COALESCE(o.fecha_solicitud, o.fecha_visita, o.fecha_creacion) <= ?";
      params.push(`${hasta} 23:59:59`);
    }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      whereCond += " AND (o.numero LIKE ? OR o.cliente LIKE ? OR o.direccion LIKE ?)";
      params.push(q, q, q);
    }

    const [ordenes] = await pool.query(`
      SELECT 
        o.id_orden AS id,
        o.id_orden,
        o.numero,
        o.numero AS numero_orden,
        CASE 
          WHEN o.motivo_finalizacion IS NOT NULL AND TRIM(o.motivo_finalizacion) <> '' AND UPPER(TRIM(o.motivo_finalizacion)) NOT IN ('REASIGNACION', 'REGESTION', 'REITERADA', 'LOS ROJO', 'AVERIAS') THEN TRIM(o.motivo_finalizacion)
          WHEN o.tipo_trabajo_asignado IS NOT NULL AND TRIM(o.tipo_trabajo_asignado) <> '' AND UPPER(TRIM(o.tipo_trabajo_asignado)) NOT IN ('LOS ROJO', 'AVERIAS') THEN TRIM(o.tipo_trabajo_asignado)
          WHEN o.tipo_trabajo IS NOT NULL AND TRIM(o.tipo_trabajo) <> '' THEN TRIM(o.tipo_trabajo)
          ELSE 'VISITA EXTERNA'
        END AS tipo_trabajo,
        o.motivo_finalizacion,
        o.tipo_trabajo_asignado,
        o.motivo_trabajo,
        o.tipo_trabajo AS tipo_trabajo_original,
        COALESCE(o.cliente, 'Cliente no especificado') AS cliente,
        COALESCE(o.direccion, '') AS direccion,
        COALESCE(o.cuadrilla, ?) AS cuadrilla,
        o.estado,
        o.fecha_solicitud,
        o.fecha_visita,
        o.inicio_visita,
        o.fin_visita,
        COALESCE(o.fin_visita, o.fecha_visita, o.fecha_solicitud, o.fecha_creacion) AS fecha_referencia,
        o.georeferencia,
        o.datos_tecnicos,
        o.observaciones,
        o.id_tecnico,
        ? AS id_trabajador_tecnico,
        ? AS tecnico_nombre
      FROM ordenes o
      LEFT JOIN usuarios u ON o.id_tecnico = u.id_usuario
      LEFT JOIN trabajadores t ON t.id_usuario = u.id_usuario
      WHERE ${whereCond}
      ORDER BY COALESCE(o.fin_visita, o.fecha_visita, o.fecha_solicitud, o.fecha_creacion) DESC
    `, [cuadrilla, idTrabajador, tecnicoNombre, ...params]);

    res.json({
      success: true,
      id_trabajador: idTrabajador,
      id_usuario: idUsuario,
      tecnico: tecnicoNombre,
      cuadrilla: cuadrilla,
      total_pendientes: ordenes.length,
      ordenes
    });
  } catch (error) {
    console.error("Error al obtener órdenes pendientes del técnico:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/orden-liquidaciones/:id/rechazar', async (req, res) => {
  try {
    const idLiquidacion = req.params.id;
    const { motivo } = req.body || {};
    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ success: false, error: 'Debe especificar el motivo del rechazo.' });
    }
    await pool.query("UPDATE orden_liquidaciones SET estado = 'Rechazada', motivo_rechazo = ? WHERE id_liquidacion = ?", [motivo.trim(), idLiquidacion]);
    res.json({ success: true, message: 'Liquidación rechazada.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post(['/orden-liquidaciones/:id/resetear', '/almacen/orden-liquidaciones/:id/resetear'], async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const idLiquidacion = req.params.id;
    const { motivo, reset_por } = req.body || {};

    await connection.beginTransaction();

    // 1. Obtener la liquidación completa
    const [liqRows] = await connection.query(`
      SELECT ol.*, o.numero as numero_orden, o.id_tecnico, o.tipo_trabajo, o.motivo_finalizacion
      FROM orden_liquidaciones ol
      LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
      WHERE ol.id_liquidacion = ?
    `, [idLiquidacion]);

    if (liqRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Liquidación no encontrada.' });
    }

    const liq = liqRows[0];
    const idOrden = liq.id_orden;
    let idTrabajador = liq.id_trabajador;

    if (!idTrabajador && liq.id_tecnico) {
      const [tRows] = await connection.query("SELECT id_trabajador FROM trabajadores WHERE id_usuario = ? LIMIT 1", [liq.id_tecnico]);
      if (tRows.length > 0) idTrabajador = tRows[0].id_trabajador;
    }

    // 2. Obtener todos los materiales consumidos en esta liquidación
    const [detalles] = await connection.query(`
      SELECT * FROM orden_liquidacion_detalle WHERE id_liquidacion = ?
    `, [idLiquidacion]);

    // 3. Devolver Insumos y Materiales al stock del técnico
    if (idTrabajador && detalles.length > 0) {
      for (const d of detalles) {
        const prodId = d.id_producto;
        const cant = Number(d.cantidad) || 0;
        if (cant > 0) {
          await connection.query(`
            UPDATE trabajador_productos 
            SET stock = stock + ? 
            WHERE id_trabajador = ? AND id_producto = ?
          `, [cant, idTrabajador, prodId]);
        }
        // Si tenía serie de equipo asignada, restaurar su estado
        if (d.numero_serie) {
          await connection.query("UPDATE producto_series SET estado = 'ASIGNADO' WHERE numero_serie = ?", [d.numero_serie]);
          await connection.query(`
            UPDATE trabajador_series ts
            JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
            SET ts.estado = 'Asignada'
            WHERE ts.id_trabajador = ? AND ps.numero_serie = ?
          `, [idTrabajador, d.numero_serie]);
        }
      }
    }

    // 4. Devolver Metraje de Bobina Drop si no estaba en detalle
    const metrosDrop = Number(liq.drop_total_metros) || 0;
    if (idTrabajador && metrosDrop > 0) {
      // Verificar si ya se devolvió en el bucle de detalles
      const yaEnDetalle = detalles.some(d => Number(d.cantidad) === metrosDrop);
      if (!yaEnDetalle) {
        const [dropRows] = await connection.query(`
          SELECT p.id_producto 
          FROM productos p 
          WHERE (p.es_drop = 1 OR p.id_producto = 55 OR (p.id_categoria = 1 AND UPPER(p.nombre) LIKE '%DROP%'))
            AND UPPER(p.nombre) NOT LIKE '%PORTA%' 
            AND UPPER(p.nombre) NOT LIKE '%PELAD%'
          ORDER BY p.es_drop DESC LIMIT 1
        `);
        if (dropRows.length > 0) {
          await connection.query(`
            UPDATE trabajador_productos 
            SET stock = stock + ? 
            WHERE id_trabajador = ? AND id_producto = ?
          `, [metrosDrop, idTrabajador, dropRows[0].id_producto]);
        }
      }
    }

    // 5. LIBERAR EL ACTA FÍSICA AL STOCK DEL TÉCNICO
    const actaNum = liq.numero_acta || liq.numero_guia;
    if (actaNum && idTrabajador) {
      const matchP = String(actaNum).trim().match(/^([A-Z0-9]+)[-–\s]+([0-9]+)$/i);
      const prefA = matchP ? matchP[1] : '001';
      const sufA = matchP ? matchP[2] : String(actaNum).trim().replace(/^[A-Z0-9]+[-–]/i, '');
      const numInt = parseInt(sufA, 10);
      const sufSinCeros = !isNaN(numInt) ? String(numInt) : sufA;
      const sufPad5 = !isNaN(numInt) ? String(numInt).padStart(5, '0') : sufA;
      const sufPad6 = !isNaN(numInt) ? String(numInt).padStart(6, '0') : sufA;

      const variantes = Array.from(new Set([
        actaNum,
        `${prefA}-${sufA}`,
        `${prefA}-${sufSinCeros}`,
        `${prefA}-${sufPad5}`,
        `${prefA}-${sufPad6}`,
        sufA,
        sufSinCeros,
        sufPad5,
        sufPad6
      ]));

      const [serieRows] = await connection.query(`
        SELECT ps.id_producto_serie, ps.id_producto
        FROM producto_series ps
        JOIN trabajador_series ts ON ps.id_producto_serie = ts.id_producto_serie
        WHERE ts.id_trabajador = ? 
          AND ps.numero_serie IN (?)
        LIMIT 1
      `, [idTrabajador, variantes]);

      if (serieRows.length > 0) {
        const idProdSerie = serieRows[0].id_producto_serie;
        const idProdActa = serieRows[0].id_producto;

        await connection.query("UPDATE producto_series SET estado = 'ASIGNADO' WHERE id_producto_serie = ?", [idProdSerie]);
        await connection.query("UPDATE trabajador_series SET estado = 'Asignada' WHERE id_trabajador = ? AND id_producto_serie = ?", [idTrabajador, idProdSerie]);
        await connection.query("UPDATE trabajador_productos SET stock = stock + 1 WHERE id_trabajador = ? AND id_producto = ?", [idTrabajador, idProdActa]);
      }
    }

    // 6. Eliminar registros de equipos retirados si se crearon en esta orden
    if (idOrden) {
      await connection.query("DELETE FROM orden_equipos_retirados WHERE id_orden = ?", [idOrden]);
    }

    // 7. Eliminar detalles y la liquidación
    await connection.query("DELETE FROM orden_liquidacion_detalle WHERE id_liquidacion = ?", [idLiquidacion]);
    await connection.query("DELETE FROM orden_liquidaciones WHERE id_liquidacion = ?", [idLiquidacion]);

    // 8. Restaurar estado de la orden a 'Finalizada'
    if (idOrden) {
      await connection.query("UPDATE ordenes SET estado = 'Finalizada', fecha_estado = NOW() WHERE id_orden = ?", [idOrden]);
    }

    // 9. Registrar auditoría
    try {
      const descAuditoria = `[Reset Liquidación #${idLiquidacion}] Orden #${liq.numero_orden || idOrden}. Acta ${actaNum} liberada y reincorporada al técnico. Materiales y stock devueltos. Motivo: ${motivo || 'Reversión / Reingreso por Almacén'}. Ejecutado por: ${reset_por || 'Almacén'}`;
      await connection.query(`
        INSERT INTO auditoria_actividad (id_usuario, usuario_nombre, id_rol, rol_nombre, area, modulo, accion, id_referencia, descripcion, fecha_creacion)
        VALUES (1, ?, 1, 'ADMINISTRACION', 'ALMACEN', 'LIQUIDACIONES', 'RESET_LIQUIDACION', ?, ?, NOW())
      `, [reset_por || 'Almacén', idLiquidacion, descAuditoria]);
    } catch (eAud) {}

    await connection.commit();

    res.json({
      success: true,
      message: `Liquidación #${idLiquidacion} reseteada exitosamente. El Acta ${actaNum} y los materiales fueron devueltos a la dotación del técnico. La orden #${liq.numero_orden || idOrden} volvió a estado "Finalizada".`,
      id_orden: idOrden,
      acta_liberada: actaNum
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error al resetear liquidación:", error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

router.put('/orden-liquidaciones/:id/ajustar-material', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const idLiquidacion = req.params.id;
    const { id_detalle_liq, nueva_cantidad, motivo } = req.body || {};

    if (!id_detalle_liq || nueva_cantidad === undefined || nueva_cantidad === null) {
      return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos (id_detalle_liq, nueva_cantidad).' });
    }

    const nCant = parseInt(nueva_cantidad, 10);
    if (isNaN(nCant) || nCant < 0) {
      return res.status(400).json({ success: false, error: 'La cantidad debe ser un número entero mayor o igual a 0.' });
    }

    await connection.beginTransaction();

    // 1. Obtener detalle actual y liquidación
    const [detRows] = await connection.query(`
      SELECT d.*, p.nombre as nombre_producto, ol.id_trabajador, ol.id_orden, ol.numero_acta
      FROM orden_liquidacion_detalle d
      JOIN orden_liquidaciones ol ON d.id_liquidacion = ol.id_liquidacion
      JOIN productos p ON d.id_producto = p.id_producto
      WHERE d.id_detalle_liq = ? AND d.id_liquidacion = ?
    `, [id_detalle_liq, idLiquidacion]);

    if (detRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Detalle de liquidación no encontrado.' });
    }

    const det = detRows[0];
    const cantAnterior = Number(det.cantidad) || 0;
    let idTrabajador = det.id_trabajador;
    const idProducto = det.id_producto;
    const diff = cantAnterior - nCant; // Si es positivo, se declaró de más y se devuelve stock al técnico

    // Si id_trabajador no está en orden_liquidaciones, buscarlo en la orden
    if (!idTrabajador && det.id_orden) {
      const [ordRows] = await connection.query(`
        SELECT t.id_trabajador 
        FROM ordenes o 
        LEFT JOIN trabajadores t ON t.id_usuario = o.id_tecnico 
        WHERE o.id_orden = ? LIMIT 1
      `, [det.id_orden]);
      if (ordRows.length > 0) idTrabajador = ordRows[0].id_trabajador;
    }

    // 2. Si nueva cantidad es 0, eliminar o poner 0
    if (nCant === 0) {
      await connection.query("DELETE FROM orden_liquidacion_detalle WHERE id_detalle_liq = ?", [id_detalle_liq]);
      if (det.numero_serie) {
        // Liberar serie si tenía
        await connection.query("UPDATE producto_series SET estado = 'ASIGNADO' WHERE numero_serie = ?", [det.numero_serie]);
        if (idTrabajador) {
          await connection.query(`
            UPDATE trabajador_series ts
            JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
            SET ts.estado = 'Asignada'
            WHERE ts.id_trabajador = ? AND ps.numero_serie = ?
          `, [idTrabajador, det.numero_serie]);
        }
      }
    } else {
      await connection.query("UPDATE orden_liquidacion_detalle SET cantidad = ? WHERE id_detalle_liq = ?", [nCant, id_detalle_liq]);
    }

    // 3. Ajustar el stock móvil del técnico (devolver excedente o descontar faltante)
    if (idTrabajador && diff !== 0) {
      if (diff > 0) {
        // Técnico declaró de más (ej. 101 en vez de 10). Se le retornan diff (+91) unidades a su camioneta
        await connection.query(`
          UPDATE trabajador_productos 
          SET stock = stock + ? 
          WHERE id_trabajador = ? AND id_producto = ?
        `, [diff, idTrabajador, idProducto]);
      } else {
        // Técnico declaró de menos (ej. 10 en vez de 15). Se le descuenta el faltante (|diff|) de su camioneta
        const cantRestar = Math.abs(diff);
        await connection.query(`
          UPDATE trabajador_productos 
          SET stock = GREATEST(0, stock - ?) 
          WHERE id_trabajador = ? AND id_producto = ?
        `, [cantRestar, idTrabajador, idProducto]);
      }
    }

    // 4. Registrar en log de auditoría
    try {
      const desc = `[Auditoría Liquidación #${idLiquidacion} / Acta ${det.numero_acta}] Ajuste de material "${det.nombre_producto}": de ${cantAnterior} a ${nCant} UND. Diferencia de stock aplicada al técnico: ${diff > 0 ? '+' + diff : diff} UND. Motivo: ${motivo || 'Corrección por auditoría de almacén'}.`;
      await connection.query(`
        INSERT INTO auditoria_actividad (id_usuario, usuario_nombre, id_rol, rol_nombre, area, modulo, accion, id_referencia, descripcion, fecha_creacion)
        VALUES (1, 'Auditoría Almacén', 1, 'ADMINISTRACION', 'ALMACEN', 'LIQUIDACIONES', 'AJUSTE_MATERIAL', ?, ?, NOW())
      `, [idLiquidacion, desc]);
    } catch (e) {}

    await connection.commit();

    res.json({
      success: true,
      message: `Cantidad de "${det.nombre_producto}" actualizada a ${nCant} UND. ${diff > 0 ? `Se retornaron ${diff} UND al stock móvil del técnico.` : diff < 0 ? `Se descontaron ${Math.abs(diff)} UND del stock móvil del técnico.` : ''}`,
      id_detalle_liq,
      cantidad_anterior: cantAnterior,
      nueva_cantidad: nCant,
      diferencia_retornada: diff
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error al ajustar material de liquidación:", error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

router.put('/orden-liquidaciones/:id/cambiar-producto', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const idLiquidacion = req.params.id;
    const { id_detalle_liq, nuevo_id_producto, nueva_cantidad, nuevo_numero_serie, motivo, drop_inicio, drop_fin } = req.body || {};

    if (!id_detalle_liq || !nuevo_id_producto) {
      return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos (id_detalle_liq, nuevo_id_producto).' });
    }

    const nCant = nueva_cantidad ? parseInt(nueva_cantidad, 10) : 1;
    if (isNaN(nCant) || nCant <= 0) {
      return res.status(400).json({ success: false, error: 'La nueva cantidad debe ser un número entero mayor a 0.' });
    }

    await connection.beginTransaction();

    // 1. Obtener detalle actual, producto viejo y datos de liquidación
    const [detRows] = await connection.query(`
      SELECT d.*, p.nombre as nombre_producto_viejo, p.precio_compra as precio_viejo,
             ol.id_trabajador, ol.id_orden, ol.numero_acta
      FROM orden_liquidacion_detalle d
      JOIN orden_liquidaciones ol ON d.id_liquidacion = ol.id_liquidacion
      JOIN productos p ON d.id_producto = p.id_producto
      WHERE d.id_detalle_liq = ? AND d.id_liquidacion = ?
    `, [id_detalle_liq, idLiquidacion]);

    if (detRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Detalle de liquidación no encontrado.' });
    }

    const det = detRows[0];
    const cantVieja = Number(det.cantidad) || 0;
    const prodIdViejo = Number(det.id_producto);
    const serieVieja = det.numero_serie;
    let idTrabajador = det.id_trabajador;

    if (!idTrabajador && det.id_orden) {
      const [ordRows] = await connection.query(`
        SELECT t.id_trabajador 
        FROM ordenes o 
        LEFT JOIN trabajadores t ON t.id_usuario = o.id_tecnico 
        WHERE o.id_orden = ? LIMIT 1
      `, [det.id_orden]);
      if (ordRows.length > 0) idTrabajador = ordRows[0].id_trabajador;
    }

    // 2. Obtener datos del nuevo producto
    const [nProdRows] = await connection.query(`
      SELECT id_producto, nombre, precio_compra, categoria_liquidar, es_drop, maneja_serie
      FROM productos WHERE id_producto = ?
    `, [nuevo_id_producto]);

    if (nProdRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'El nuevo producto seleccionado no existe.' });
    }

    const nuevoProd = nProdRows[0];
    let finalNuevaSerie = nuevo_numero_serie ? String(nuevo_numero_serie).trim().toUpperCase() : null;
    const nuevoRequiereSerie = Number(nuevoProd.maneja_serie) === 1 || String(nuevoProd.categoria_liquidar || '').toUpperCase() === 'EQUIPO';

    if (nuevoRequiereSerie) {
      if (!finalNuevaSerie) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: `El producto de reemplazo "${nuevoProd.nombre}" es un equipo y requiere seleccionar una serie obligatoria de la camioneta del técnico.`
        });
      }

      if (idTrabajador) {
        const [serieCheck] = await connection.query(`
          SELECT ts.id_trabajador_serie, ts.estado, ps.numero_serie
          FROM trabajador_series ts
          JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
          WHERE ts.id_trabajador = ? AND ps.numero_serie = ? AND ts.id_producto = ?
        `, [idTrabajador, finalNuevaSerie, nuevo_id_producto]);

        if (serieCheck.length === 0) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            error: `La serie "${finalNuevaSerie}" no está asignada en la camioneta del técnico para el equipo "${nuevoProd.nombre}".`
          });
        }

        if (serieCheck[0].estado !== 'Asignada') {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            error: `La serie "${finalNuevaSerie}" figura como "${serieCheck[0].estado}" y no está disponible en la camioneta.`
          });
        }
      }
    }

    // 3. Revertir / Devolver stock del producto viejo a la camioneta del técnico
    if (idTrabajador && cantVieja > 0) {
      await connection.query(`
        UPDATE trabajador_productos 
        SET stock = stock + ? 
        WHERE id_trabajador = ? AND id_producto = ?
      `, [cantVieja, idTrabajador, prodIdViejo]);
    }

    // Si el producto viejo tenía serie, liberarla
    if (serieVieja) {
      await connection.query("UPDATE producto_series SET estado = 'ASIGNADO' WHERE numero_serie = ?", [serieVieja]);
      if (idTrabajador) {
        await connection.query(`
          UPDATE trabajador_series ts
          JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
          SET ts.estado = 'Asignada'
          WHERE ts.id_trabajador = ? AND ps.numero_serie = ?
        `, [idTrabajador, serieVieja]);
      }
    }

    // 4. Descontar stock del NUEVO producto de la camioneta del técnico
    if (idTrabajador) {
      // Verificar si ya tiene registro en trabajador_productos
      const [tpExist] = await connection.query(`
        SELECT id_trabajador_producto, stock FROM trabajador_productos 
        WHERE id_trabajador = ? AND id_producto = ?
      `, [idTrabajador, nuevo_id_producto]);

      if (tpExist.length > 0) {
        await connection.query(`
          UPDATE trabajador_productos 
          SET stock = GREATEST(0, stock - ?) 
          WHERE id_trabajador = ? AND id_producto = ?
        `, [nCant, idTrabajador, nuevo_id_producto]);
      } else {
        await connection.query(`
          INSERT INTO trabajador_productos (id_trabajador, id_producto, stock, fecha_creacion, fecha_actualizacion)
          VALUES (?, ?, 0, NOW(), NOW())
        `, [idTrabajador, nuevo_id_producto]);
      }
    }

    // Si el nuevo producto incluye serie
    if (finalNuevaSerie) {
      await connection.query("UPDATE producto_series SET estado = 'VENDIDO' WHERE numero_serie = ?", [finalNuevaSerie]);
      if (idTrabajador) {
        await connection.query(`
          UPDATE trabajador_series ts
          JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
          SET ts.estado = 'Usada'
          WHERE ts.id_trabajador = ? AND ps.numero_serie = ?
        `, [idTrabajador, finalNuevaSerie]);
      }
    }

    // 5. Actualizar el detalle de liquidación
    const dropIniVal = drop_inicio !== undefined && drop_inicio !== null && drop_inicio !== '' ? parseInt(drop_inicio, 10) : null;
    const dropFinVal = drop_fin !== undefined && drop_fin !== null && drop_fin !== '' ? parseInt(drop_fin, 10) : null;

    await connection.query(`
      UPDATE orden_liquidacion_detalle 
      SET id_producto = ?, cantidad = ?, numero_serie = ?, drop_inicio = ?, drop_fin = ?
      WHERE id_detalle_liq = ?
    `, [nuevo_id_producto, nCant, finalNuevaSerie, dropIniVal, dropFinVal, id_detalle_liq]);

    // 5.1 Si el nuevo producto es drop, recalibrar metraje en orden_liquidaciones
    const esNuevoDrop = Boolean(nuevoProd.es_drop) || String(nuevoProd.nombre || '').toUpperCase().includes('DROP') || String(nuevoProd.nombre || '').toUpperCase().includes('BOBINA');
    if (esNuevoDrop) {
      await connection.query(`
        UPDATE orden_liquidaciones 
        SET drop_metro_inicio = COALESCE(?, drop_metro_inicio),
            drop_metro_fin = COALESCE(?, drop_metro_fin),
            drop_total_metros = COALESCE(drop_total_metros, 0) + ?
        WHERE id_liquidacion = ?
      `, [dropIniVal, dropFinVal, nCant, idLiquidacion]);

      if (det.id_orden) {
        await connection.query(`
          UPDATE ordenes 
          SET drop_metros = COALESCE(drop_metros, 0) + ?
          WHERE id_orden = ?
        `, [nCant, det.id_orden]);
      }
    }

    // 6. Registrar en auditoría
    try {
      const desc = `[Auditoría Liquidación #${idLiquidacion} / Acta ${det.numero_acta}] Cambio de producto: "${det.nombre_producto_viejo}" (${cantVieja} UND) sustituido por "${nuevoProd.nombre}" (${nCant} UND). Stock móvil recalibrado. Motivo: ${motivo || 'Corrección por auditoría de almacén'}.`;
      await connection.query(`
        INSERT INTO auditoria_actividad (id_usuario, usuario_nombre, id_rol, rol_nombre, area, modulo, accion, id_referencia, descripcion, fecha_creacion)
        VALUES (1, 'Auditoría Almacén', 1, 'ADMINISTRACION', 'ALMACEN', 'LIQUIDACIONES', 'CAMBIO_PRODUCTO', ?, ?, NOW())
      `, [idLiquidacion, desc]);
    } catch (e) {}

    await connection.commit();

    res.json({
      success: true,
      message: `Producto cambiado exitosamente a "${nuevoProd.nombre}" (${nCant} UND). Se reincorporó "${det.nombre_producto_viejo}" al stock del técnico y se descontó el nuevo.`,
      id_detalle_liq,
      id_producto: nuevo_id_producto,
      nombre_producto: nuevoProd.nombre,
      cantidad: nCant,
      numero_serie: finalNuevaSerie,
      precio_compra: nuevoProd.precio_compra,
      costo: nCant * Number(nuevoProd.precio_compra || 0)
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error al cambiar producto de liquidación:", error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

router.post('/orden-liquidaciones/:id/agregar-material', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const idLiquidacion = req.params.id;
    const { id_producto, cantidad, numero_serie, motivo, equipo_retirado, drop_inicio, drop_fin } = req.body || {};

    if (!id_producto || !cantidad) {
      return res.status(400).json({ success: false, error: 'Debe seleccionar un producto y una cantidad.' });
    }

    const cant = parseInt(cantidad, 10);
    if (isNaN(cant) || cant <= 0) {
      return res.status(400).json({ success: false, error: 'La cantidad debe ser un entero mayor a 0.' });
    }

    await connection.beginTransaction();

    // 1. Obtener liquidación y técnico
    const [liqRows] = await connection.query(`
      SELECT ol.id_liquidacion, ol.id_trabajador, ol.id_orden, ol.numero_acta
      FROM orden_liquidaciones ol
      WHERE ol.id_liquidacion = ?
    `, [idLiquidacion]);

    if (liqRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Liquidación no encontrada.' });
    }

    const liq = liqRows[0];
    let idTrabajador = liq.id_trabajador;

    if (!idTrabajador && liq.id_orden) {
      const [ordRows] = await connection.query(`
        SELECT t.id_trabajador 
        FROM ordenes o 
        LEFT JOIN trabajadores t ON t.id_usuario = o.id_tecnico 
        WHERE o.id_orden = ? LIMIT 1
      `, [liq.id_orden]);
      if (ordRows.length > 0) idTrabajador = ordRows[0].id_trabajador;
    }

    // 2. Obtener producto
    const [pRows] = await connection.query(`
      SELECT id_producto, nombre, precio_compra, categoria_liquidar, maneja_serie, es_drop
      FROM productos WHERE id_producto = ?
    `, [id_producto]);

    if (pRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Producto no encontrado.' });
    }

    const prod = pRows[0];
    const finalSerie = numero_serie ? String(numero_serie).trim().toUpperCase() : null;
    const requiereSerie = Number(prod.maneja_serie) === 1 || String(prod.categoria_liquidar || '').toUpperCase() === 'EQUIPO';

    if (requiereSerie) {
      if (!finalSerie) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: "El producto " + prod.nombre + " es un equipo y requiere seleccionar una serie obligatoria de la camioneta del técnico."
        });
      }

      if (idTrabajador) {
        const [serieCheck] = await connection.query(
          "SELECT ts.id_trabajador_serie, ts.estado, ps.numero_serie FROM trabajador_series ts JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie WHERE ts.id_trabajador = ? AND ps.numero_serie = ? AND ts.id_producto = ?",
          [idTrabajador, finalSerie, id_producto]
        );

        if (serieCheck.length === 0) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            error: "La serie " + finalSerie + " no está asignada en la camioneta del técnico para el equipo " + prod.nombre + "."
          });
        }

        if (serieCheck[0].estado !== 'Asignada') {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            error: "La serie " + finalSerie + " figura como " + serieCheck[0].estado + " y no está disponible en la camioneta."
          });
        }
      }
    }

    // 3. Descontar stock del vehículo del técnico
    if (idTrabajador) {
      const [tpRows] = await connection.query(`
        SELECT id_trabajador_producto, stock FROM trabajador_productos 
        WHERE id_trabajador = ? AND id_producto = ?
      `, [idTrabajador, id_producto]);

      if (tpRows.length > 0) {
        await connection.query(`
          UPDATE trabajador_productos 
          SET stock = GREATEST(0, stock - ?) 
          WHERE id_trabajador = ? AND id_producto = ?
        `, [cant, idTrabajador, id_producto]);
      } else {
        await connection.query(`
          INSERT INTO trabajador_productos (id_trabajador, id_producto, stock, fecha_creacion, fecha_actualizacion)
          VALUES (?, ?, 0, NOW(), NOW())
        `, [idTrabajador, id_producto]);
      }
    }

    // Si tiene serie, marcarla como usada / vendida
    if (finalSerie) {
      await connection.query("UPDATE producto_series SET estado = 'VENDIDO' WHERE numero_serie = ?", [finalSerie]);
      if (idTrabajador) {
        await connection.query(`
          UPDATE trabajador_series ts
          JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
          SET ts.estado = 'Usada'
          WHERE ts.id_trabajador = ? AND ps.numero_serie = ?
        `, [idTrabajador, finalSerie]);
      }
    }

    // 4. Insertar en orden_liquidacion_detalle con soporte para drop_inicio y drop_fin
    const dropIniVal = drop_inicio !== undefined && drop_inicio !== null && drop_inicio !== '' ? parseInt(drop_inicio, 10) : null;
    const dropFinVal = drop_fin !== undefined && drop_fin !== null && drop_fin !== '' ? parseInt(drop_fin, 10) : null;

    const [insRes] = await connection.query(`
      INSERT INTO orden_liquidacion_detalle (id_liquidacion, id_producto, cantidad, numero_serie, drop_inicio, drop_fin)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [idLiquidacion, id_producto, cant, finalSerie, dropIniVal, dropFinVal]);

    // 4.0 Si es bobina drop o cable drop, recalibrar metraje en orden_liquidaciones y ordenes
    const esDropProd = Boolean(prod.es_drop) || String(prod.nombre || '').toUpperCase().includes('DROP') || String(prod.nombre || '').toUpperCase().includes('BOBINA');
    if (esDropProd) {
      await connection.query(`
        UPDATE orden_liquidaciones 
        SET drop_metro_inicio = COALESCE(?, drop_metro_inicio),
            drop_metro_fin = COALESCE(?, drop_metro_fin),
            drop_total_metros = COALESCE(drop_total_metros, 0) + ?
        WHERE id_liquidacion = ?
      `, [dropIniVal, dropFinVal, cant, idLiquidacion]);

      if (liq.id_orden) {
        await connection.query(`
          UPDATE ordenes 
          SET drop_metros = COALESCE(drop_metros, 0) + ?
          WHERE id_orden = ?
        `, [cant, liq.id_orden]);
      }
    }

    // 4.1 Si viene un equipo retirado o sin recupero, registrar en orden_equipos_retirados
    if (equipo_retirado && liq.id_orden) {
      const serieRet = String(equipo_retirado.numero_serie || '').trim().toUpperCase();
      const tipoRet = equipo_retirado.tipo_equipo || (prod.nombre.toUpperCase().includes('MESH') ? 'MESH' : 'ONT');
      const motRet = equipo_retirado.motivo_retiro || (equipo_retirado.sin_recupero ? 'Sin Recupero / Cliente no entrega' : 'Cambio por avería');
      const obsRet = equipo_retirado.sin_recupero ? 'Declarado Sin Recupero en Auditoría' : `Recogido en domicilio (Auditoría Acta ${liq.numero_acta || ''})`;
      const estadoRet = equipo_retirado.sin_recupero ? 'Sin_Recupero' : 'En_Poder_Tecnico';

      if (serieRet || equipo_retirado.sin_recupero) {
        await connection.query(`
          INSERT INTO orden_equipos_retirados (
            id_orden, id_trabajador, tipo_equipo, numero_serie,
            motivo_retiro, estado, fecha_recojo, observaciones
          ) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
        `, [
          liq.id_orden,
          idTrabajador || null,
          tipoRet,
          serieRet || 'SIN_RECUPERO',
          motRet,
          estadoRet,
          obsRet
        ]);
      }
    }

    // 5. Registrar en bitácora de auditoría
    try {
      const desc = `[Auditoría Liquidación #${idLiquidacion} / Acta ${liq.numero_acta}] Material agregado: "${prod.nombre}" x ${cant} UND ${finalSerie ? `(Serie: ${finalSerie})` : ''}${dropIniVal !== null && dropFinVal !== null ? ` (Metraje: ${dropIniVal} a ${dropFinVal}m = ${cant}m)` : ''}. Descontado de la camioneta del técnico. Motivo: ${motivo || 'Material agregado por auditoría'}.`;
      await connection.query(`
        INSERT INTO auditoria_actividad (id_usuario, usuario_nombre, id_rol, rol_nombre, area, modulo, accion, id_referencia, descripcion, fecha_creacion)
        VALUES (1, 'Auditoría Almacén', 1, 'ADMINISTRACION', 'ALMACEN', 'LIQUIDACIONES', 'AGREGAR_MATERIAL', ?, ?, NOW())
      `, [idLiquidacion, desc]);
    } catch (e) {}

    await connection.commit();

    res.json({
      success: true,
      message: `"${prod.nombre}" x ${cant} UND agregado correctamente a la liquidación y descontado del stock del técnico.`,
      id_detalle_liq: insRes.insertId,
      id_producto,
      nombre_producto: prod.nombre,
      categoria_liquidar: prod.categoria_liquidar,
      cantidad: cant,
      numero_serie: finalSerie,
      precio_compra: prod.precio_compra,
      costo: cant * Number(prod.precio_compra || 0)
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error al agregar material a liquidación:", error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

router.delete('/orden-liquidaciones/:id/eliminar-material/:id_detalle_liq', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const idLiquidacion = req.params.id;
    const idDetalleLiq = req.params.id_detalle_liq;
    const { motivo } = req.body || req.query || {};

    await connection.beginTransaction();

    // 1. Obtener detalle actual
    const [detRows] = await connection.query(`
      SELECT d.*, p.nombre as nombre_producto, ol.id_trabajador, ol.id_orden, ol.numero_acta
      FROM orden_liquidacion_detalle d
      JOIN orden_liquidaciones ol ON d.id_liquidacion = ol.id_liquidacion
      JOIN productos p ON d.id_producto = p.id_producto
      WHERE d.id_detalle_liq = ? AND d.id_liquidacion = ?
    `, [idDetalleLiq, idLiquidacion]);

    if (detRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Detalle de material no encontrado.' });
    }

    const det = detRows[0];
    const cant = Number(det.cantidad) || 0;
    const prodId = Number(det.id_producto);
    const serie = det.numero_serie;
    let idTrabajador = det.id_trabajador;

    if (!idTrabajador && det.id_orden) {
      const [ordRows] = await connection.query(`
        SELECT t.id_trabajador 
        FROM ordenes o 
        LEFT JOIN trabajadores t ON t.id_usuario = o.id_tecnico 
        WHERE o.id_orden = ? LIMIT 1
      `, [det.id_orden]);
      if (ordRows.length > 0) idTrabajador = ordRows[0].id_trabajador;
    }

    // 2. Eliminar detalle
    await connection.query("DELETE FROM orden_liquidacion_detalle WHERE id_detalle_liq = ?", [idDetalleLiq]);

    // 3. Devolver stock al técnico
    if (idTrabajador && cant > 0) {
      await connection.query(`
        UPDATE trabajador_productos 
        SET stock = stock + ? 
        WHERE id_trabajador = ? AND id_producto = ?
      `, [cant, idTrabajador, prodId]);
    }

    // 4. Liberar serie si existía
    if (serie) {
      await connection.query("UPDATE producto_series SET estado = 'ASIGNADO' WHERE numero_serie = ?", [serie]);
      if (idTrabajador) {
        await connection.query(`
          UPDATE trabajador_series ts
          JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
          SET ts.estado = 'Asignada'
          WHERE ts.id_trabajador = ? AND ps.numero_serie = ?
        `, [idTrabajador, serie]);
      }
    }

    // 5. Auditoría
    try {
      const desc = `[Auditoría Liquidación #${idLiquidacion} / Acta ${det.numero_acta}] Material eliminado: "${det.nombre_producto}" x ${cant} UND. Stock reintegrado a la camioneta del técnico. Motivo: ${motivo || 'Eliminado por auditoría de almacén'}.`;
      await connection.query(`
        INSERT INTO auditoria_actividad (id_usuario, usuario_nombre, id_rol, rol_nombre, area, modulo, accion, id_referencia, descripcion, fecha_creacion)
        VALUES (1, 'Auditoría Almacén', 1, 'ADMINISTRACION', 'ALMACEN', 'LIQUIDACIONES', 'ELIMINAR_MATERIAL', ?, ?, NOW())
      `, [idLiquidacion, desc]);
    } catch (e) {}

    await connection.commit();

    res.json({
      success: true,
      message: `"${det.nombre_producto}" x ${cant} UND eliminado de la liquidación y reintegrado a la camioneta del técnico.`
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error al eliminar material de liquidación:", error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

router.put(['/orden-liquidaciones/:id/editar-acta', '/almacen/orden-liquidaciones/:id/editar-acta'], async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const idLiquidacion = req.params.id;
    let { nuevo_numero_acta, motivo } = req.body || {};

    if (!nuevo_numero_acta || !String(nuevo_numero_acta).trim()) {
      return res.status(400).json({ success: false, error: 'Debe ingresar un número de acta válido.' });
    }

    let cleanNuevaActa = String(nuevo_numero_acta).trim().toUpperCase();
    if (/^\d{4,8}$/.test(cleanNuevaActa.replace(/^001-?/i, ''))) {
      cleanNuevaActa = `001-${cleanNuevaActa.replace(/^001-?/i, '')}`;
    }

    await connection.beginTransaction();

    // 1. Obtener la liquidación actual
    const [liqRows] = await connection.query(`
      SELECT ol.id_liquidacion, ol.id_orden, ol.id_trabajador, ol.numero_acta, ol.numero_guia,
             o.numero as numero_orden, o.id_tecnico
      FROM orden_liquidaciones ol
      LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
      WHERE ol.id_liquidacion = ?
    `, [idLiquidacion]);

    if (liqRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Liquidación no encontrada.' });
    }

    const liq = liqRows[0];
    const actaVieja = String(liq.numero_acta || liq.numero_guia || '').trim();
    let idTrabajador = liq.id_trabajador;

    if (!idTrabajador && liq.id_tecnico) {
      const [tRows] = await connection.query("SELECT id_trabajador FROM trabajadores WHERE id_usuario = ? LIMIT 1", [liq.id_tecnico]);
      if (tRows.length > 0) idTrabajador = tRows[0].id_trabajador;
    }

    if (actaVieja === cleanNuevaActa) {
      await connection.rollback();
      return res.json({ success: true, message: 'El número de acta ingresado es idéntico al actual.', nuevo_numero_acta: cleanNuevaActa });
    }

    // 2. Validar que la nueva acta no esté ya usada en otra liquidación activa
    const [dupRows] = await connection.query(`
      SELECT ol.id_liquidacion, o.numero as numero_orden
      FROM orden_liquidaciones ol
      LEFT JOIN ordenes o ON ol.id_orden = o.id_orden
      WHERE (ol.numero_acta = ? OR ol.numero_guia = ?) AND ol.id_liquidacion != ?
      LIMIT 1
    `, [cleanNuevaActa, cleanNuevaActa, idLiquidacion]);

    if (dupRows.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: `El Acta "${cleanNuevaActa}" ya está registrada y utilizada en la Orden #${dupRows[0].numero_orden || dupRows[0].id_liquidacion}. No se puede duplicar.`
      });
    }

    // 3. REVERSIÓN DEL ACTA ANTERIOR: Reincorporar al stock del técnico si estaba asignada
    if (actaVieja && idTrabajador) {
      const cleanViejaSinPrefijo = actaVieja.replace(/^001-?/i, '');
      const [serieViejaRows] = await connection.query(`
        SELECT ps.id_producto_serie, ps.id_producto, ts.id_trabajador_serie
        FROM producto_series ps
        JOIN trabajador_series ts ON ps.id_producto_serie = ts.id_producto_serie
        WHERE ts.id_trabajador = ?
          AND (ps.numero_serie = ? OR ps.numero_serie = ? OR ps.numero_serie = ? OR ps.numero_serie LIKE ?)
        LIMIT 1
      `, [idTrabajador, actaVieja, cleanViejaSinPrefijo, `001-${cleanViejaSinPrefijo}`, `%${cleanViejaSinPrefijo}%`]);

      if (serieViejaRows.length > 0) {
        const idProdSerieVieja = serieViejaRows[0].id_producto_serie;
        const idProdViejo = serieViejaRows[0].id_producto;

        await connection.query("UPDATE producto_series SET estado = 'ASIGNADO' WHERE id_producto_serie = ?", [idProdSerieVieja]);
        await connection.query("UPDATE trabajador_series SET estado = 'Asignada' WHERE id_trabajador = ? AND id_producto_serie = ?", [idTrabajador, idProdSerieVieja]);
        await connection.query("UPDATE trabajador_productos SET stock = stock + 1 WHERE id_trabajador = ? AND id_producto = ?", [idTrabajador, idProdViejo]);

        try {
          await connection.query(`
            INSERT INTO movimientos (id_producto, id_almacen, id_producto_serie, tipo, cantidad, referencia, fecha_creacion)
            VALUES (?, 1, ?, 'ENTRADA', 1, ?, NOW())
          `, [idProdViejo, idProdSerieVieja, `Corrección Acta: Reversión al técnico de serie [${actaVieja}] en Orden #${liq.numero_orden || liq.id_orden}`]);
        } catch (eMov) {}
      }
    }

    // 4. CONSUMO DE LA NUEVA ACTA: Descontar del stock del técnico si existe en sus series asignadas
    if (cleanNuevaActa && idTrabajador) {
      const cleanNuevaSinPrefijo = cleanNuevaActa.replace(/^001-?/i, '');
      const [serieNuevaRows] = await connection.query(`
        SELECT ps.id_producto_serie, ps.id_producto, ts.id_trabajador_serie
        FROM producto_series ps
        JOIN trabajador_series ts ON ps.id_producto_serie = ts.id_producto_serie
        WHERE ts.id_trabajador = ?
          AND (ps.numero_serie = ? OR ps.numero_serie = ? OR ps.numero_serie = ? OR ps.numero_serie LIKE ?)
        LIMIT 1
      `, [idTrabajador, cleanNuevaActa, cleanNuevaSinPrefijo, `001-${cleanNuevaSinPrefijo}`, `%${cleanNuevaSinPrefijo}%`]);

      if (serieNuevaRows.length > 0) {
        const idProdSerieNueva = serieNuevaRows[0].id_producto_serie;
        const idProdNuevo = serieNuevaRows[0].id_producto;

        await connection.query("UPDATE producto_series SET estado = 'CONSUMIDO' WHERE id_producto_serie = ?", [idProdSerieNueva]);
        await connection.query("UPDATE trabajador_series SET estado = 'Usada' WHERE id_trabajador = ? AND id_producto_serie = ?", [idTrabajador, idProdSerieNueva]);
        await connection.query("UPDATE trabajador_productos SET stock = GREATEST(0, stock - 1) WHERE id_trabajador = ? AND id_producto = ?", [idTrabajador, idProdNuevo]);

        try {
          await connection.query(`
            INSERT INTO movimientos (id_producto, id_almacen, id_producto_serie, tipo, cantidad, referencia, fecha_creacion)
            VALUES (?, 1, ?, 'SALIDA', 1, ?, NOW())
          `, [idProdNuevo, idProdSerieNueva, `Corrección Acta: Consumo de serie [${cleanNuevaActa}] en Orden #${liq.numero_orden || liq.id_orden}`]);
        } catch (eMov) {}
      }
    }

    // 5. Actualizar en orden_liquidaciones
    await connection.query(`
      UPDATE orden_liquidaciones 
      SET numero_acta = ?, numero_guia = ?
      WHERE id_liquidacion = ?
    `, [cleanNuevaActa, cleanNuevaActa, idLiquidacion]);

    // 6. Auditoría de Actividad
    try {
      const desc = `[Auditoría Liquidación #${idLiquidacion} / Orden #${liq.numero_orden || liq.id_orden}] Corrección de N° de Acta Física: de "${actaVieja}" a "${cleanNuevaActa}". Serie anterior reincorporada al stock y nueva serie descontada. Motivo: ${motivo || 'Corrección por auditoría de almacén'}.`;
      await connection.query(`
        INSERT INTO auditoria_actividad (id_usuario, usuario_nombre, id_rol, rol_nombre, area, modulo, accion, id_referencia, descripcion, fecha_creacion)
        VALUES (1, 'Auditoría Almacén', 1, 'ADMINISTRACION', 'ALMACEN', 'LIQUIDACIONES', 'EDITAR_NUMERO_ACTA', ?, ?, NOW())
      `, [idLiquidacion, desc]);
    } catch (eAud) {}

    await connection.commit();

    res.json({
      success: true,
      message: `Número de Acta actualizado correctamente a "${cleanNuevaActa}". Stock y Kardex recalibrados.`,
      id_liquidacion: idLiquidacion,
      acta_anterior: actaVieja,
      nuevo_numero_acta: cleanNuevaActa
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error al editar número de acta:", error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

router.post('/orden-liquidaciones/aprobar-masivo', async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Debe enviar una lista de IDs a aprobar.' });
    }
    await pool.query("UPDATE orden_liquidaciones SET estado = 'Aprobada', motivo_rechazo = NULL WHERE id_liquidacion IN (?)", [ids]);
    res.json({ success: true, message: `${ids.length} liquidaciones aprobadas con éxito.` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/orden-liquidaciones/:numeroOrden/foto-acta', async (req, res) => {
  try {
    const rawNum = req.params.numeroOrden;
    if (!rawNum) {
      return res.status(400).json({ success: false, error: 'Número de orden requerido' });
    }
    let cleanNum = String(rawNum).trim().replace(/^#/, '').replace(/^0+/, '');
    const descargar = req.query.descargar === '1';
    console.log(`🔍 [Foto Acta] Solicitando acta HD para identificador/orden #${cleanNum}...`);
    try {
      const [liqFotoRows] = await pool.query(
        `SELECT ol.foto_acta FROM orden_liquidaciones ol
         JOIN ordenes o ON ol.id_orden = o.id_orden
         WHERE (o.numero = ? OR o.id_orden = ? OR ol.id_orden = ?) AND ol.foto_acta IS NOT NULL AND ol.foto_acta != ''
         LIMIT 1`,
        [cleanNum, isNaN(cleanNum) ? 0 : Number(cleanNum), isNaN(cleanNum) ? 0 : Number(cleanNum)]
      );
      if (liqFotoRows.length > 0 && liqFotoRows[0].foto_acta) {
        return res.json({
          success: true,
          origen: 'ORDENAMIENTO_TECNICO',
          numero_orden: cleanNum,
          titulo: 'Acta de Ordenamiento Subida por Técnico',
          foto_url: liqFotoRows[0].foto_acta
        });
      }
    } catch(e) {}


    // 💡 Resolver a número de orden oficial de Fénix (priorizando órdenes Finalizadas con evidencias)
    try {
      const [ordRows] = await pool.query(
        `SELECT numero, codigo_seguimiento, cod_seguimiento_cliente, id_orden, estado 
         FROM ordenes 
         WHERE numero = ? OR codigo_seguimiento = ? OR cod_seguimiento_cliente = ? OR id_orden = ? 
         ORDER BY 
           CASE 
             WHEN UPPER(COALESCE(estado, '')) LIKE '%FINALIZ%' THEN 1 
             WHEN UPPER(COALESCE(estado, '')) LIKE '%LIQUID%' THEN 2 
             ELSE 3 
           END, 
           fecha_visita DESC, 
           id_orden DESC 
         LIMIT 1`,
        [cleanNum, cleanNum, cleanNum, isNaN(cleanNum) ? 0 : Number(cleanNum)]
      );
      if (ordRows.length > 0 && ordRows[0].numero) {
        const numResuelto = String(ordRows[0].numero).trim().replace(/^0+/, '');
        if (numResuelto) {
          console.log(`📌 [Foto Acta] Identificador '${cleanNum}' resuelto a OrdenId oficial Fénix #${numResuelto} (Estado: ${ordRows[0].estado})`);
          cleanNum = numResuelto;
        }
      }
    } catch (eResolve) {
      console.warn("⚠️ [Foto Acta] Error resolviendo número de orden en BD:", eResolve.message);
    }

    const nombreDescarga = String(req.query.nombre_archivo || `Acta_Orden_${cleanNum}_HD.jpg`)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 120);
    const contentDisposition = descargar
      ? `attachment; filename="${nombreDescarga || `Acta_Orden_${cleanNum}_HD.jpg`}"`
      : undefined;

    // 1. Verificar si ya tenemos el Acta en caché en la BD local (Apertura instantánea 0ms)
    try {
      const [rows] = await pool.query(
        "SELECT tareas_json FROM orden_tareas_cache WHERE numero_orden = ? OR numero_orden = ? LIMIT 1",
        [cleanNum, `000${cleanNum}`.slice(-10)]
      );

      if (rows.length > 0 && rows[0].tareas_json) {
        const tasks = JSON.parse(rows[0].tareas_json);
        const actaTask = tasks.find(t => {
          const tit = (t.titulo || t.nombre || '').toUpperCase();
          return tit.includes('ACTA') || tit.includes('CONFORMIDAD');
        }) || tasks[tasks.length - 1];

        if (actaTask && actaTask.detalle && actaTask.detalle.fotografias && actaTask.detalle.fotografias.length > 0) {
          // Buscar si alguna foto ya tiene imagen_hd (en Base64 o en AWS S3)
          for (const fotoObj of actaTask.detalle.fotografias) {
            if (fotoObj.imagen_hd && (fotoObj.imagen_hd.length > 5000 || fotoObj.imagen_hd.startsWith('http') || fotoObj.imagen_hd.startsWith('tareas/'))) {
              console.log(`⚡ [Foto Acta] Acta encontrada en caché HD para orden #${cleanNum}`);
              let finalUrl = fotoObj.imagen_hd;
              if (finalUrl.includes('amazonaws.com') || finalUrl.startsWith('tareas/')) {
                const s3Key = finalUrl.replace(/^https?:\/\/[^\/]+\//, '');
                const signed = await getS3SignedUrl(s3Key, 86400, contentDisposition).catch(() => null);
                if (descargar && !signed) {
                  return res.status(503).json({ success: false, error: 'No se pudo generar una URL de descarga desde S3.' });
                }
                if (signed) finalUrl = signed;
              }
              return res.json({
                success: true,
                origen: 'CACHE_LOCAL',
                numero_orden: cleanNum,
                titulo: actaTask.titulo,
                dataId: fotoObj.dataId,
                foto_url: finalUrl,
                tiempos: actaTask.detalle.tiempos || null,
                coordenadas: actaTask.detalle.coordenadas_inicio || null
              });
            }
          }

          // Si tiene dataId pero aún no descargada en HD, intentar descargarla
          for (const fotoObj of actaTask.detalle.fotografias) {
            if (fotoObj.dataId && String(fotoObj.dataId) !== String(actaTask.id)) {
              console.log(`📥 [Foto Acta] Descargando imagen HD desde dataId ${fotoObj.dataId}...`);
              const imgBase64 = await obtenerImagenReal(fotoObj.dataId, fotoObj.opcion || 1, fotoObj.titulo || 'ACTA');
              if (imgBase64 && imgBase64.length > 5000) {
                fotoObj.imagen_hd = imgBase64;
                await pool.query(
                  "UPDATE orden_tareas_cache SET tareas_json = ?, fecha_actualizacion = NOW() WHERE numero_orden = ?",
                  [JSON.stringify(tasks), cleanNum]
                ).catch(() => {});

                console.log(`✅ [Foto Acta] Acta HD descargada y guardada en caché para orden #${cleanNum}`);
                return res.json({
                  success: true,
                  origen: 'FENIX_LIVE',
                  numero_orden: cleanNum,
                  titulo: actaTask.titulo,
                  dataId: fotoObj.dataId,
                  foto_url: imgBase64,
                  tiempos: actaTask.detalle.tiempos || null,
                  coordenadas: actaTask.detalle.coordenadas_inicio || null
                });
              }
            }
          }
        }
      }
    } catch (errCache) {
      console.warn("⚠️ [Foto Acta] Error leyendo caché para foto de acta:", errCache.message);
    }

    // 2. Si no está en caché o falló, consultar a Fénix en vivo
    console.log(`🌐 [Foto Acta] Consultando Fénix en vivo para orden #${cleanNum}...`);
    const ordeVisiId = await obtenerOrdeVisiId(cleanNum);
    if (!ordeVisiId) {
      return res.status(404).json({ success: false, error: `No se encontró la orden #${cleanNum} en Fénix.` });
    }

    const tareas = await obtenerTareasOrden(ordeVisiId, cleanNum);
    if (!tareas || tareas.length === 0) {
      return res.status(404).json({ success: false, error: `No se encontraron tareas registradas para la orden #${cleanNum}.` });
    }

    const actaTask = tareas.find(t => {
      const tit = (t.titulo || t.nombre || '').toUpperCase();
      return tit.includes('ACTA') || tit.includes('CONFORMIDAD');
    }) || tareas[tareas.length - 1];

    if (!actaTask || !actaTask.id) {
      return res.status(404).json({ success: false, error: 'No se encontró la tarea del Acta de Conformidad.' });
    }

    const detalle = await obtenerDetalleTarea(actaTask.id, actaTask.index);
    if (!detalle || !detalle.fotografias || detalle.fotografias.length === 0) {
      return res.status(404).json({ success: false, error: 'La tarea del Acta aún no tiene fotografías registradas por el técnico.' });
    }

    let imgBase64 = null;
    let selectedFoto = null;

    // Probar descargar alta resolución de cada fotografía encontrada
    for (const f of detalle.fotografias) {
      const dataId = f.dataId || actaTask.id;
      const opcion = f.opcion || 1;
      console.log(`🖼️ [Foto Acta] Probando descarga HD para foto con DataId: ${dataId}, Op: ${opcion}...`);
      const resImg = await obtenerImagenReal(dataId, opcion, f.titulo || 'ACTA');
      if (resImg && resImg.length > 5000) {
        imgBase64 = resImg;
        selectedFoto = f;
        f.imagen_hd = resImg;
        break;
      }
    }

    // Si la descarga HD falló, usar la miniatura / preview como respaldo si existe
    if (!imgBase64) {
      for (const f of detalle.fotografias) {
        if (f.imagen && f.imagen.length > 500) {
          imgBase64 = f.imagen;
          selectedFoto = f;
          console.log(`ℹ️ [Foto Acta] Usando imagen preview de respaldo para orden #${cleanNum}`);
          break;
        }
      }
    }

    if (!imgBase64) {
      return res.status(404).json({ success: false, error: 'No se pudo descargar la imagen del acta desde Fénix. Verifique si el técnico subió la foto.' });
    }

    // Subir a S3 para evitar saturar MySQL con megabytes de Base64
    let fotoUrlFinal = imgBase64;
    try {
      const s3KeyActa = `tareas/orden_${cleanNum}/acta_hd_${(selectedFoto && selectedFoto.dataId) || 'foto'}_${Date.now()}.jpg`;
      const bMatch = imgBase64.match(/^data:(image\/[a-zA-Z0-9.+]+);base64,(.+)$/);
      const bBuffer = Buffer.from(bMatch ? bMatch[2] : imgBase64, 'base64');
      const bMime = bMatch ? bMatch[1] : 'image/jpeg';
      const s3Res = await uploadBufferToS3(bBuffer, s3KeyActa, bMime);
      if (s3Res && s3Res.s3Url) {
        if (selectedFoto) selectedFoto.imagen_hd = s3Res.s3Url;
        const signed = await getS3SignedUrl(s3KeyActa, 86400, contentDisposition).catch(() => null);
        if (descargar && !signed) {
          return res.status(503).json({ success: false, error: 'La foto se guardó en S3, pero no se pudo generar su URL de descarga.' });
        }
        fotoUrlFinal = signed || s3Res.s3Url;
      }
    } catch (eS3) {
      console.warn("⚠️ [Foto Acta] Error subiendo a S3:", eS3.message);
    }

    // Guardar en caché local para que futuras aperturas sean instantáneas (0ms)
    try {
      actaTask.detalle = detalle;
      await pool.query(`
        INSERT INTO orden_tareas_cache (numero_orden, total_tareas, tareas_finalizadas, progreso_porcentaje, tareas_json, fecha_sincronizacion)
        VALUES (?, ?, ?, 100, ?, NOW())
        ON DUPLICATE KEY UPDATE tareas_json = VALUES(tareas_json), fecha_actualizacion = NOW()
      `, [cleanNum, tareas.length, tareas.length, JSON.stringify(tareas)]).catch(() => {});
      console.log(`💾 [Foto Acta] Guardado con éxito en orden_tareas_cache (S3) para orden #${cleanNum}`);
    } catch (e) {}

    res.json({
      success: true,
      origen: 'FENIX_LIVE',
      numero_orden: cleanNum,
      titulo: actaTask.titulo,
      dataId: selectedFoto ? selectedFoto.dataId : null,
      foto_url: fotoUrlFinal,
      tiempos: detalle.tiempos || null,
      coordenadas: detalle.coordenadas_inicio || null
    });
  } catch (error) {
    console.error("❌ [Foto Acta] Error al obtener foto del acta:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/equipos-recogidos', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        er.id_equipo_retirado,
        er.id_orden,
        er.tipo_equipo,
        er.numero_serie,
        COALESCE(er.proid, '') AS proid,
        COALESCE(er.codigo_producto, '') AS codigo_producto,
        COALESCE(er.guia_remision_win, '') AS guia_remision_win,
        er.motivo_retiro,
        er.estado,
        er.fecha_recojo,
        er.fecha_internamiento,
        er.recibido_por,
        er.observaciones,
        COALESCE(o.numero, '') AS ticket,
        COALESCE(o.cliente, '') AS cliente,
        COALESCE(o.direccion, '') AS direccion,
        COALESCE(o.localidad, '') AS distrito,
        COALESCE(
          (SELECT COALESCE(ol.numero_acta, ol.numero_guia, '') 
           FROM orden_liquidaciones ol 
           WHERE ol.id_orden = er.id_orden 
           ORDER BY ol.id_liquidacion DESC LIMIT 1),
          ''
        ) AS numero_acta,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        u.cuadrilla,
        (
          SELECT GROUP_CONCAT(CONCAT(p_inst.nombre, ' (', old_inst.numero_serie, ')') SEPARATOR ', ')
          FROM orden_liquidaciones ol_inst
          JOIN orden_liquidacion_detalle old_inst ON ol_inst.id_liquidacion = old_inst.id_liquidacion
          JOIN productos p_inst ON old_inst.id_producto = p_inst.id_producto
          WHERE ol_inst.id_orden = er.id_orden AND old_inst.numero_serie IS NOT NULL AND old_inst.numero_serie != ''
        ) AS equipo_instalado_detalle,
        COALESCE(
          er.serie_instalada,
          (
            SELECT old_inst.numero_serie
            FROM orden_liquidaciones ol_inst
            JOIN orden_liquidacion_detalle old_inst ON ol_inst.id_liquidacion = old_inst.id_liquidacion
            WHERE ol_inst.id_orden = er.id_orden AND old_inst.numero_serie IS NOT NULL AND old_inst.numero_serie != ''
            LIMIT 1
          )
        ) AS equipo_instalado_serie,
        COALESCE(
          (SELECT p.nombre FROM producto_series ps JOIN productos p ON ps.id_producto = p.id_producto WHERE ps.numero_serie = er.serie_instalada LIMIT 1),
          (
            SELECT p_inst.nombre
            FROM orden_liquidaciones ol_inst
            JOIN orden_liquidacion_detalle old_inst ON ol_inst.id_liquidacion = old_inst.id_liquidacion
            JOIN productos p_inst ON old_inst.id_producto = p_inst.id_producto
            WHERE ol_inst.id_orden = er.id_orden AND old_inst.numero_serie IS NOT NULL AND old_inst.numero_serie != ''
            LIMIT 1
          )
        ) AS equipo_instalado_nombre
      FROM orden_equipos_retirados er
      LEFT JOIN ordenes o ON er.id_orden = o.id_orden
      LEFT JOIN trabajadores t ON er.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      ORDER BY er.fecha_recojo DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/internar-equipo', async (req, res) => {
  try {
    const { id_equipo_retirado, estado_destino, recibido_por, observaciones, guia_remision_win, proid, codigo_producto } = req.body;

    if (!id_equipo_retirado) {
      return res.status(400).json({ error: "id_equipo_retirado es requerido" });
    }

    const estadoFinal = estado_destino || 'Internado_Almacen'; // 'Internado_Almacen', 'Defectuoso', 'Baja'

    await pool.query(`
      UPDATE orden_equipos_retirados SET
        estado = ?,
        id_almacen_destino = 1,
        recibido_por = ?,
        fecha_internamiento = NOW(),
        guia_remision_win = COALESCE(?, guia_remision_win),
        proid = COALESCE(?, proid),
        codigo_producto = COALESCE(?, codigo_producto),
        observaciones = CONCAT(COALESCE(observaciones, ''), ' | Internado: ', COALESCE(?, ''))
      WHERE id_equipo_retirado = ?
    `, [
      estadoFinal,
      recibido_por || 'Almacén Central',
      guia_remision_win !== undefined ? guia_remision_win : null,
      proid !== undefined ? proid : null,
      codigo_producto !== undefined ? codigo_producto : null,
      observaciones || 'Recepción confirmada',
      id_equipo_retirado
    ]);

    res.json({ success: true, message: "Equipo retirado internado en Almacén Central exitosamente." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/equipos-recogidos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { guia_remision_win, proid, codigo_producto, observaciones } = req.body;

    await pool.query(`
      UPDATE orden_equipos_retirados SET
        guia_remision_win = COALESCE(?, guia_remision_win),
        proid = COALESCE(?, proid),
        codigo_producto = COALESCE(?, codigo_producto),
        observaciones = COALESCE(?, observaciones)
      WHERE id_equipo_retirado = ?
    `, [
      guia_remision_win !== undefined ? guia_remision_win : null,
      proid !== undefined ? proid : null,
      codigo_producto !== undefined ? codigo_producto : null,
      observaciones !== undefined ? observaciones : null,
      id
    ]);

    res.json({ success: true, message: "Datos del equipo recogido actualizados correctamente." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/trazabilidad-serie/:serie', async (req, res) => {
  try {
    const serie = req.params.serie.trim().toUpperCase();

    // 1. Estado en producto_series
    const [serieInfo] = await pool.query(`
      SELECT ps.*, p.nombre AS producto_nombre, p.codigo AS producto_codigo, a.nombre AS almacen_nombre
      FROM producto_series ps
      JOIN productos p ON ps.id_producto = p.id_producto
      LEFT JOIN almacenes a ON ps.id_almacen = a.id_almacen
      WHERE ps.numero_serie = ?
    `, [serie]);

    // 2. Historial de compras
    const [compraInfo] = await pool.query(`
      SELECT c.*, pr.razon_social AS proveedor_nombre, pr.ruc AS proveedor_ruc
      FROM detalle_compras dc
      JOIN compras c ON dc.id_compra = c.id_compra
      LEFT JOIN proveedores pr ON c.id_proveedor = pr.id_proveedor
      WHERE dc.series_ingresadas LIKE ?
    `, [`%${serie}%`]);

    // 3. Asignación a técnico
    const [asignaciones] = await pool.query(`
      SELECT ts.*, TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre, u.cuadrilla
      FROM trabajador_series ts
      JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE ts.id_producto_serie = (SELECT id_producto_serie FROM producto_series WHERE numero_serie = ? LIMIT 1)
    `, [serie]);

    // 4. Si fue retirado de algún cliente
    const [retiros] = await pool.query(`
      SELECT er.*, COALESCE(o.numero, '') AS ticket, COALESCE(o.cliente, '') AS cliente, COALESCE(o.direccion, '') AS direccion, COALESCE(o.localidad, '') AS distrito
      FROM orden_equipos_retirados er
      LEFT JOIN ordenes o ON er.id_orden = o.id_orden
      WHERE er.numero_serie = ?
    `, [serie]);

    res.json({
      serie,
      existe: serieInfo.length > 0 || retiros.length > 0,
      detalle: serieInfo[0] || null,
      compra: compraInfo[0] || null,
      asignaciones,
      retiros
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;