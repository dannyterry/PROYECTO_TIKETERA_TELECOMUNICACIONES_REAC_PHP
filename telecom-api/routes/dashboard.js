'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, signToken } = require('../middleware/requireAuth');
const { uploadFileToS3, uploadBufferToS3, getS3ObjectStream, checkS3ObjectExists, getS3SignedUrl } = require('../services/s3Service');
const path = require('path');
const fs = require('fs');

const { sincronizarTareasOrdenSeguro, getTareasDeBD, sincronizarTareasOrdenesActivas, guardarDetalleTareaEnBD, getMetrajeDeclaradoFenix } = require('../services/taskSyncService');
const { getMotivosCatalogo, resolverTipoTrabajoConCatalogo, resolverTipoTrabajoOficial, normalizeText } = require('../services/tipoTrabajoHelper');
const { scrapeOrdenesFromFenix } = require('../services/fenixScraper');

// ─── RUTAS MÓDULO: DASHBOARD ───────────────────────────────────────

router.get(['/estadisticas', '/dashboard/estadisticas'], async (req, res) => {
  try {
    let { desde, hasta, anio, periodo } = req.query;
    const yearVal = anio || new Date().getFullYear();

    if (!desde && !hasta && periodo) {
      const hoy = new Date();
      const fmt = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      if (periodo === 'hoy') {
        desde = fmt(hoy);
        hasta = fmt(hoy);
      } else if (periodo === 'semana') {
        const lunes = new Date(hoy);
        lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
        const domingo = new Date(lunes);
        domingo.setDate(lunes.getDate() + 6);
        desde = fmt(lunes);
        hasta = fmt(domingo);
      } else if (periodo === 'mes') {
        const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        desde = fmt(primero);
        hasta = fmt(ultimo);
      } else if (periodo === 'anio') {
        desde = `${yearVal}-01-01`;
        hasta = `${yearVal}-12-31`;
      }
    }

    let dateCondOrdenes = '';
    let dateCondCompras = '';
    const paramsOrdenes = [];
    const paramsCompras = [];

    if (desde && hasta) {
      dateCondOrdenes = ' WHERE DATE(fecha_visita) >= ? AND DATE(fecha_visita) <= ?';
      dateCondCompras = ' WHERE DATE(fecha) >= ? AND DATE(fecha) <= ?';
      paramsOrdenes.push(desde, hasta);
      paramsCompras.push(desde, hasta);
    } else if (desde) {
      dateCondOrdenes = ' WHERE DATE(fecha_visita) >= ?';
      dateCondCompras = ' WHERE DATE(fecha) >= ?';
      paramsOrdenes.push(desde);
      paramsCompras.push(desde);
    } else if (hasta) {
      dateCondOrdenes = ' WHERE DATE(fecha_visita) <= ?';
      dateCondCompras = ' WHERE DATE(fecha) <= ?';
      paramsOrdenes.push(hasta);
      paramsCompras.push(hasta);
    }

    // 1. KPIs
    const [ordenesCount] = await pool.query(`SELECT COUNT(*) AS total FROM ordenes ${dateCondOrdenes}`, paramsOrdenes);
    const [finalizadasCount] = await pool.query(`SELECT COUNT(*) AS total FROM ordenes ${dateCondOrdenes ? dateCondOrdenes + " AND estado IN ('Finalizada', 'Liquidada')" : "WHERE estado IN ('Finalizada', 'Liquidada')"}`, paramsOrdenes);
    const [canceladasCount] = await pool.query(`
      SELECT COUNT(*) AS total 
      FROM ordenes 
      ${dateCondOrdenes ? dateCondOrdenes + " AND estado IN ('Cancelada', 'Regestión', 'Anulada', 'Observada', 'Suspendida')" : "WHERE estado IN ('Cancelada', 'Regestión', 'Anulada', 'Observada', 'Suspendida')"}
    `, paramsOrdenes);
    const [enProcesoCount] = await pool.query(`
      SELECT COUNT(*) AS total 
      FROM ordenes 
      ${dateCondOrdenes ? dateCondOrdenes + " AND estado IN ('Iniciada', 'En camino', 'Agendada', 'Revisión')" : "WHERE estado IN ('Iniciada', 'En camino', 'Agendada', 'Revisión')"}
    `, paramsOrdenes);
    const [liquidacionesCount] = await pool.query(`SELECT COUNT(*) AS total FROM orden_liquidaciones`);
    const [productosCount] = await pool.query(`SELECT COUNT(*) AS total FROM productos WHERE estado = 'Activo'`);
    const [tecnicosCount] = await pool.query(`
      SELECT COUNT(*) AS total 
      FROM trabajadores t
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE u.id_rol = 2 OR t.estado = 'Activo'
    `);
    
    // Total compras del mes actual
    const [comprasSum] = await pool.query(`
      SELECT COALESCE(SUM(total), 0) AS total 
      FROM compras 
      WHERE MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE()) AND estado != 'ANULADA'
    `);

    // Personal online
    const [onlineCount] = await pool.query(`
      SELECT COUNT(*) AS total 
      FROM usuarios 
      WHERE ultimo_acceso >= DATE_SUB(NOW(), INTERVAL 15 MINUTE) AND (id_rol != 2 OR id_rol IS NULL)
    `);

    // 2. Órdenes por estado
    const [estadosRows] = await pool.query(`
      SELECT COALESCE(estado, 'Sin estado') AS estado, COUNT(*) AS total 
      FROM ordenes ${dateCondOrdenes}
      GROUP BY estado 
      ORDER BY total DESC
    `, paramsOrdenes);

    // 3. Órdenes por mes del año (para comparativa anual histórica)
    const [mesesRows] = await pool.query(`
      SELECT 
        MONTH(fecha_visita) AS mes, 
        COUNT(*) AS total, 
        SUM(CASE WHEN estado IN ('Finalizada', 'Liquidada') THEN 1 ELSE 0 END) AS finalizadas 
      FROM ordenes 
      WHERE YEAR(fecha_visita) = ? 
      GROUP BY MONTH(fecha_visita) 
      ORDER BY mes ASC
    `, [yearVal]);

    // 3.1 📈 EVOLUCIÓN DINÁMICA DE PRODUCCIÓN (ADAPTABLE A DÍA, SEMANA, MES, AÑO)
    let ordenesEvolucion = [];
    let tipoEvolucion = 'mes';
    let tituloEvolucion = 'Evolución de Producción Anual';

    if (desde && hasta && desde === hasta) {
      // 🟢 MODO DÍA: desglose por horas de 07:00 a 20:00
      tipoEvolucion = 'hora';
      tituloEvolucion = `Producción por Horas (${desde})`;
      const [horasRows] = await pool.query(`
        SELECT 
          HOUR(fecha_visita) AS hora,
          COUNT(*) AS total,
          SUM(CASE WHEN estado IN ('Finalizada', 'Liquidada') THEN 1 ELSE 0 END) AS finalizadas
        FROM ordenes
        WHERE DATE(fecha_visita) = ?
        GROUP BY HOUR(fecha_visita)
        ORDER BY hora ASC
      `, [desde]);
      
      const mapaHoras = {};
      horasRows.forEach(h => { mapaHoras[h.hora] = h; });
      for (let h = 7; h <= 20; h++) {
        const found = mapaHoras[h];
        ordenesEvolucion.push({
          name: `${String(h).padStart(2, '0')}:00`,
          Total: found ? Number(found.total) : 0,
          Finalizadas: found ? Number(found.finalizadas) : 0,
        });
      }
    } else if (desde && hasta) {
      const d1 = new Date(desde + 'T00:00:00');
      const d2 = new Date(hasta + 'T00:00:00');
      const diffDias = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;

      if (diffDias <= 7) {
        // 🟢 MODO SEMANA: días de la semana
        tipoEvolucion = 'semana';
        tituloEvolucion = `Producción Semanal (${desde} al ${hasta})`;
        const [diasRows] = await pool.query(`
          SELECT 
            DATE_FORMAT(fecha_visita, '%Y-%m-%d') AS fecha,
            DAYNAME(fecha_visita) AS dia_semana,
            COUNT(*) AS total,
            SUM(CASE WHEN estado IN ('Finalizada', 'Liquidada') THEN 1 ELSE 0 END) AS finalizadas
          FROM ordenes
          WHERE DATE(fecha_visita) >= ? AND DATE(fecha_visita) <= ?
          GROUP BY DATE(fecha_visita)
          ORDER BY fecha ASC
        `, [desde, hasta]);
        const mapaDias = {};
        diasRows.forEach(d => { mapaDias[d.fecha] = d; });
        const nombresSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        for (let i = 0; i < diffDias; i++) {
          const cur = new Date(d1);
          cur.setDate(d1.getDate() + i);
          const fStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
          const found = mapaDias[fStr];
          const diaCorto = nombresSemana[cur.getDay()];
          ordenesEvolucion.push({
            name: `${diaCorto} ${cur.getDate()}`,
            fecha: fStr,
            Total: found ? Number(found.total) : 0,
            Finalizadas: found ? Number(found.finalizadas) : 0,
          });
        }
      } else if (diffDias <= 32) {
        // 🟢 MODO MES: días del mes (1 a N)
        tipoEvolucion = 'mes';
        tituloEvolucion = `Producción Diaria del Mes (${desde} al ${hasta})`;
        const [diasRows] = await pool.query(`
          SELECT 
            DATE_FORMAT(fecha_visita, '%Y-%m-%d') AS fecha,
            DAY(fecha_visita) AS dia,
            COUNT(*) AS total,
            SUM(CASE WHEN estado IN ('Finalizada', 'Liquidada') THEN 1 ELSE 0 END) AS finalizadas
          FROM ordenes
          WHERE DATE(fecha_visita) >= ? AND DATE(fecha_visita) <= ?
          GROUP BY DATE(fecha_visita)
          ORDER BY fecha ASC
        `, [desde, hasta]);
        const mapaDias = {};
        diasRows.forEach(d => { mapaDias[d.fecha] = d; });
        for (let i = 0; i < diffDias; i++) {
          const cur = new Date(d1);
          cur.setDate(d1.getDate() + i);
          const fStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
          const found = mapaDias[fStr];
          ordenesEvolucion.push({
            name: `${String(cur.getDate()).padStart(2, '0')}`,
            fecha: fStr,
            Total: found ? Number(found.total) : 0,
            Finalizadas: found ? Number(found.finalizadas) : 0,
          });
        }
      } else {
        // 🟢 MODO RANGO AMPLIO / AÑO: meses
        tipoEvolucion = 'anio';
        tituloEvolucion = `Producción Anual (Mes a Mes - ${yearVal})`;
        const nombresMesesCorto = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const mapaMeses = {};
        mesesRows.forEach(m => { mapaMeses[m.mes] = m; });
        for (let m = 1; m <= 12; m++) {
          const found = mapaMeses[m];
          ordenesEvolucion.push({
            name: nombresMesesCorto[m - 1],
            mes: m,
            Total: found ? Number(found.total) : 0,
            Finalizadas: found ? Number(found.finalizadas) : 0,
          });
        }
      }
    } else {
      tipoEvolucion = 'anio';
      tituloEvolucion = `Evolución de Producción Anual (${yearVal})`;
      const nombresMesesCorto = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const mapaMeses = {};
      mesesRows.forEach(m => { mapaMeses[m.mes] = m; });
      for (let m = 1; m <= 12; m++) {
        const found = mapaMeses[m];
        ordenesEvolucion.push({
          name: nombresMesesCorto[m - 1],
          mes: m,
          Total: found ? Number(found.total) : 0,
          Finalizadas: found ? Number(found.finalizadas) : 0,
        });
      }
    }

    // 4. Stock por almacén (Top 15)
    const [stockRows] = await pool.query(`
      SELECT 
        a.nombre AS almacen_nombre,
        p.nombre AS producto_nombre,
        COALESCE(c.nombre, p.categoria_liquidar, 'General') AS categoria,
        s.cantidad AS stock,
        p.stock_minimo AS stock_minimo,
        CASE 
          WHEN s.cantidad <= 0 THEN 'Sin stock'
          WHEN s.cantidad <= COALESCE(p.stock_minimo, 5) THEN 'Bajo'
          ELSE 'OK'
        END AS estado_stock
      FROM stock s
      JOIN productos p ON s.id_producto = p.id_producto
      JOIN almacenes a ON s.id_almacen = a.id_almacen
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      ORDER BY s.cantidad DESC
      LIMIT 15
    `);

    res.json({
      success: true,
      kpis: {
        total_ordenes: ordenesCount[0]?.total || 0,
        ordenes_finalizadas: finalizadasCount[0]?.total || 0,
        ordenes_canceladas_observadas: canceladasCount[0]?.total || 0,
        ordenes_en_proceso: enProcesoCount[0]?.total || 0,
        total_liquidaciones: liquidacionesCount[0]?.total || 0,
        total_productos: productosCount[0]?.total || 0,
        total_tecnicos: tecnicosCount[0]?.total || 0,
        compras_mes: parseFloat(comprasSum[0]?.total || 0),
        personal_online: onlineCount[0]?.total || 0,
      },
      ordenes_por_estado: estadosRows,
      ordenes_por_mes: mesesRows,
      ordenes_evolucion: {
        tipo: tipoEvolucion,
        titulo: tituloEvolucion,
        data: ordenesEvolucion,
      },
      stock_almacen: stockRows,
    });
  } catch (error) {
    console.error("Error en dashboard estadisticas:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get(['/win-scorecard', '/dashboard/win-scorecard'], async (req, res) => {
  try {
    let { desde, hasta, tecnico } = req.query;
    
    // Si no vienen fechas, por defecto el mes actual en curso (Perú UTC-5)
    if (!desde || !hasta) {
      const hoy = new Date();
      const y = hoy.getFullYear();
      const m = String(hoy.getMonth() + 1).padStart(2, '0');
      const ult = new Date(y, hoy.getMonth() + 1, 0).getDate();
      desde = `${y}-${m}-01`;
      hasta = `${y}-${m}-${String(ult).padStart(2, '0')}`;
    }

    let whereCond = ' WHERE DATE(fecha_visita) >= ? AND DATE(fecha_visita) <= ?';
    const params = [desde, hasta];

    if (tecnico && tecnico !== 'Todos') {
      whereCond += ' AND (id_tecnico = ? OR tecnico LIKE ?)';
      params.push(tecnico, `%${tecnico}%`);
    }

    // 1. Resumen general Scorecard WIN
    const [summaryRows] = await pool.query(`
      SELECT 
        COUNT(*) AS total_ordenes,
        SUM(CASE WHEN estado IN ('Finalizada', 'Liquidada') THEN 1 ELSE 0 END) AS terminadas,
        SUM(CASE WHEN estado = 'Cancelada' THEN 1 ELSE 0 END) AS canceladas,
        SUM(CASE WHEN estado IN ('Regestión', 'Regestion') THEN 1 ELSE 0 END) AS regestion,
        SUM(CASE WHEN estado IN ('Anulada', 'Iniciada', 'En camino', 'Agendada', 'Observada', 'Suspendida') THEN 1 ELSE 0 END) AS excluidas,
        SUM(CASE WHEN (codigo_seguimiento LIKE 'VTR-%' OR tipo_trabajo = 'REITERADA' OR motivo_trabajo = 'REITERADA') THEN 1 ELSE 0 END) AS vtr_atendidas,
        SUM(CASE 
          WHEN estado IN ('Finalizada', 'Liquidada') 
           AND COALESCE(producto, '') != 'PLANTA EXTERNA' 
           AND COALESCE(motivo_trabajo, '') != 'REITERADA' 
          THEN 1 ELSE 0 END) AS vtr_base
      FROM ordenes
      ${whereCond}
    `, params);

    const s = summaryRows[0] || {};
    const terminadas = Number(s.terminadas) || 0;
    const canceladas = Number(s.canceladas) || 0;
    const regestion = Number(s.regestion) || 0;
    const totalEvaluados = terminadas + canceladas + regestion;
    const pctEfectividad = totalEvaluados > 0 ? parseFloat(((terminadas / totalEvaluados) * 100).toFixed(2)) : 0.0;
    
    // 🎯 VTR EXACTO WIN: Solo penaliza al período si la visita original de ese cliente también ocurrió dentro del período
    const [vtrOficialRows] = await pool.query(`
      SELECT COUNT(*) AS vtr_casos
      FROM ordenes o
      WHERE DATE(o.fecha_visita) >= ? AND DATE(o.fecha_visita) <= ?
        AND o.estado IN ('Finalizada', 'Liquidada')
        AND (o.codigo_seguimiento LIKE 'VTR-%' OR o.tipo_trabajo = 'REITERADA' OR o.motivo_trabajo = 'REITERADA')
        AND EXISTS (
          SELECT 1 FROM ordenes prev
          WHERE (prev.numero_documento = o.numero_documento OR (prev.cliente = o.cliente AND o.cliente IS NOT NULL))
            AND prev.id_orden != o.id_orden
            AND DATE(prev.fecha_visita) >= ? AND DATE(prev.fecha_visita) <= ?
            AND prev.fecha_visita < o.fecha_visita
            AND prev.estado IN ('Finalizada', 'Liquidada')
        )
    `, [desde, hasta, desde, hasta]);

    const vtrCasos = Number(vtrOficialRows[0]?.vtr_casos) || 0;
    const vtrBase = Number(s.vtr_base) || (terminadas > 0 ? terminadas : 1);
    const pctVtr = vtrBase > 0 ? parseFloat(((vtrCasos / vtrBase) * 100).toFixed(2)) : 0.0;
    const vtrAtendidas = Number(s.vtr_atendidas) || 0;

    // 2. Tendencia Diaria de Efectividad y VTR
    const [dailyRows] = await pool.query(`
      SELECT 
        DATE_FORMAT(fecha_visita, '%Y-%m-%d') AS fecha,
        DAY(fecha_visita) AS dia,
        DAYNAME(fecha_visita) AS dia_semana,
        COUNT(*) AS total,
        SUM(CASE WHEN estado IN ('Finalizada', 'Liquidada') THEN 1 ELSE 0 END) AS terminadas,
        SUM(CASE WHEN estado = 'Cancelada' THEN 1 ELSE 0 END) AS canceladas,
        SUM(CASE WHEN estado IN ('Regestión', 'Regestion') THEN 1 ELSE 0 END) AS regestion,
        SUM(CASE WHEN (codigo_seguimiento LIKE 'VTR-%' OR tipo_trabajo = 'REITERADA') THEN 1 ELSE 0 END) AS vtr_casos
      FROM ordenes
      ${whereCond}
      GROUP BY DATE(fecha_visita)
      ORDER BY fecha ASC
    `, params);

    const diasNombresEs = {
      'Monday': 'Lun', 'Tuesday': 'Mar', 'Wednesday': 'Mié', 'Thursday': 'Jue',
      'Friday': 'Vie', 'Saturday': 'Sáb', 'Sunday': 'Dom'
    };

    const tendenciaDiaria = dailyRows.map(r => {
      const term = Number(r.terminadas) || 0;
      const canc = Number(r.canceladas) || 0;
      const reg = Number(r.regestion) || 0;
      const base = term + canc + reg;
      const ef = base > 0 ? parseFloat(((term / base) * 100).toFixed(1)) : 0.0;
      const vtr = Number(r.vtr_casos) || 0;
      const pVtr = term > 0 ? parseFloat(((vtr / term) * 100).toFixed(1)) : 0.0;
      return {
        fecha: r.fecha,
        dia: r.dia,
        dia_nombre: diasNombresEs[r.dia_semana] || r.dia_semana,
        label: `${diasNombresEs[r.dia_semana] || ''} ${r.dia}`,
        total: Number(r.total) || 0,
        terminadas: term,
        canceladas: canc,
        regestion: reg,
        evaluados: base,
        pct_efectividad: ef,
        cumple_efectividad: ef >= 80.0,
        vtr_casos: vtr,
        pct_vtr: pVtr,
        cumple_vtr: pVtr <= 5.0
      };
    });

    // 3. Top Motivos de Cancelación
    const [cancelMotivos] = await pool.query(`
      SELECT 
        COALESCE(motivo_cancelacion, 'Sin motivo especificado') AS motivo,
        COUNT(*) AS total
      FROM ordenes
      ${whereCond} AND estado = 'Cancelada'
      GROUP BY motivo
      ORDER BY total DESC
      LIMIT 10
    `, params);

    // 4. Ranking de Efectividad por Técnico
    const [tecnicosRows] = await pool.query(`
      SELECT 
        COALESCE(
          NULLIF(TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))), ''),
          NULLIF(TRIM(o.tecnico_asignado), ''),
          NULLIF(TRIM(o.cuadrilla), ''),
          'Sin Asignar'
        ) AS tecnico,
        COUNT(*) AS total,
        SUM(CASE WHEN o.estado IN ('Finalizada', 'Liquidada') THEN 1 ELSE 0 END) AS terminadas,
        SUM(CASE WHEN o.estado = 'Cancelada' THEN 1 ELSE 0 END) AS canceladas,
        SUM(CASE WHEN o.estado IN ('Regestión', 'Regestion') THEN 1 ELSE 0 END) AS regestion,
        SUM(CASE WHEN (o.codigo_seguimiento LIKE 'VTR-%' OR o.tipo_trabajo = 'REITERADA') THEN 1 ELSE 0 END) AS vtr_casos
      FROM ordenes o
      LEFT JOIN usuarios u ON o.id_tecnico = u.id_usuario
      WHERE DATE(o.fecha_visita) >= ? AND DATE(o.fecha_visita) <= ?
      GROUP BY tecnico
      HAVING total >= 3
      ORDER BY terminadas DESC
      LIMIT 30
    `, [desde, hasta]);

    const rankingTecnicos = tecnicosRows.map(t => {
      const term = Number(t.terminadas) || 0;
      const canc = Number(t.canceladas) || 0;
      const reg = Number(t.regestion) || 0;
      const base = term + canc + reg;
      const ef = base > 0 ? parseFloat(((term / base) * 100).toFixed(1)) : 0.0;
      const vtr = Number(t.vtr_casos) || 0;
      const pVtr = term > 0 ? parseFloat(((vtr / term) * 100).toFixed(1)) : 0.0;
      return {
        tecnico: t.tecnico,
        total: Number(t.total) || 0,
        terminadas: term,
        canceladas: canc,
        regestion: reg,
        evaluados: base,
        pct_efectividad: ef,
        cumple_efectividad: ef >= 80.0,
        vtr_casos: vtr,
        pct_vtr: pVtr
      };
    });

    res.json({
      success: true,
      periodo: { desde, hasta },
      kpis: {
        total_ordenes: Number(s.total_ordenes) || 0,
        terminadas,
        canceladas,
        regestion,
        excluidas: Number(s.excluidas) || 0,
        total_evaluados: totalEvaluados,
        pct_efectividad: pctEfectividad,
        meta_efectividad: 80.0,
        cumple_efectividad: pctEfectividad >= 80.0,
        vtr_casos: vtrCasos,
        vtr_base: vtrBase,
        vtr_atendidas: vtrAtendidas,
        pct_vtr: pctVtr,
        meta_vtr: 5.0,
        cumple_vtr: pctVtr <= 5.0
      },
      tendencia_diaria: tendenciaDiaria,
      top_cancelaciones: cancelMotivos,
      ranking_tecnicos: rankingTecnicos
    });
  } catch (error) {
    console.error("Error en win-scorecard:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get(['/win-scorecard/detalle', '/dashboard/win-scorecard/detalle'], async (req, res) => {
  try {
    let { desde, hasta, tipo, q, limite = 100, pagina = 1 } = req.query;
    
    if (!desde || !hasta) {
      const hoy = new Date();
      const y = hoy.getFullYear();
      const m = String(hoy.getMonth() + 1).padStart(2, '0');
      const ult = new Date(y, hoy.getMonth() + 1, 0).getDate();
      desde = `${y}-${m}-01`;
      hasta = `${y}-${m}-${String(ult).padStart(2, '0')}`;
    }

    let whereCond = ' WHERE DATE(o.fecha_visita) >= ? AND DATE(o.fecha_visita) <= ?';
    const params = [desde, hasta];

    if (tipo === 'terminadas') {
      whereCond += " AND o.estado IN ('Finalizada', 'Liquidada')";
    } else if (tipo === 'canceladas') {
      whereCond += " AND o.estado = 'Cancelada'";
    } else if (tipo === 'regestion') {
      whereCond += " AND o.estado IN ('Regestión', 'Regestion')";
    } else if (tipo === 'vtr') {
      whereCond += " AND (o.codigo_seguimiento LIKE 'VTR-%' OR o.tipo_trabajo = 'REITERADA')";
    } else if (tipo === 'excluidas') {
      whereCond += " AND o.estado IN ('Anulada', 'Iniciada', 'En camino', 'Agendada', 'Observada', 'Suspendida')";
    }

    if (q && q.trim()) {
      whereCond += " AND (o.numero LIKE ? OR o.cliente LIKE ? OR o.codigo_seguimiento LIKE ? OR o.direccion LIKE ? OR u.nombres LIKE ? OR o.tecnico_asignado LIKE ?)";
      const wild = `%${q.trim()}%`;
      params.push(wild, wild, wild, wild, wild, wild);
    }

    const offset = (Number(pagina) - 1) * Number(limite);
    const [countRows] = await pool.query(`
      SELECT COUNT(*) AS total 
      FROM ordenes o 
      LEFT JOIN usuarios u ON o.id_tecnico = u.id_usuario 
      ${whereCond}
    `, params);
    const totalRegistros = countRows[0]?.total || 0;

    const [ordenes] = await pool.query(`
      SELECT 
        o.id_orden,
        o.numero,
        o.codigo_seguimiento,
        o.cliente,
        COALESCE(o.movil, o.fijo, '') AS telefono,
        o.direccion,
        COALESCE(o.region_zona, o.localidad, '') AS distrito,
        COALESCE(
          NULLIF(TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))), ''),
          NULLIF(TRIM(o.tecnico_asignado), ''),
          NULLIF(TRIM(o.cuadrilla), ''),
          'Sin Asignar'
        ) AS tecnico,
        o.id_tecnico,
        o.estado,
        o.tipo_trabajo,
        o.fecha_visita,
        o.fecha_solicitud,
        o.motivo_cancelacion,
        o.motivo_regestion,
        o.observaciones
      FROM ordenes o
      LEFT JOIN usuarios u ON o.id_tecnico = u.id_usuario
      ${whereCond}
      ORDER BY o.fecha_visita DESC, o.id_orden DESC
      LIMIT ? OFFSET ?
    `, [...params, Number(limite), offset]);

    res.json({
      success: true,
      total: totalRegistros,
      pagina: Number(pagina),
      limite: Number(limite),
      ordenes
    });
  } catch (error) {
    console.error("Error en win-scorecard detalle:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get(['/rendimiento-tecnicos', '/dashboard/rendimiento-tecnicos'], async (req, res) => {
  try {
    let { desde, hasta, periodo, tecnico } = req.query;
    const hoy = new Date();
    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (periodo && (!desde || !hasta)) {
      if (periodo === 'hoy') {
        desde = fmt(hoy);
        hasta = fmt(hoy);
      } else if (periodo === 'ayer') {
        const ayer = new Date(hoy);
        ayer.setDate(hoy.getDate() - 1);
        desde = fmt(ayer);
        hasta = fmt(ayer);
      } else if (periodo === 'semana') {
        const lunes = new Date(hoy);
        lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
        const domingo = new Date(lunes);
        domingo.setDate(lunes.getDate() + 6);
        desde = fmt(lunes);
        hasta = fmt(domingo);
      } else if (periodo === 'mes') {
        const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        desde = fmt(primero);
        hasta = fmt(ultimo);
      } else if (periodo === 'mes_anterior') {
        const primeroAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        const ultimoAnt = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
        desde = fmt(primeroAnt);
        hasta = fmt(ultimoAnt);
      }
    }

    // Por defecto: mes actual si no se especifica nada
    if (!desde || !hasta) {
      const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      desde = desde || fmt(primero);
      hasta = hasta || fmt(ultimo);
    }

    let whereClause = `
      WHERE DATE(o.fecha_visita) >= ? 
        AND DATE(o.fecha_visita) <= ? 
        AND o.estado != 'Finalizada Externa'
        AND (o.tecnico_asignado IS NULL OR o.tecnico_asignado NOT LIKE 'EXTERNO%')
        AND (o.id_tecnico IS NOT NULL AND o.id_tecnico > 0)
    `;
    const queryParams = [desde, hasta];

    if (tecnico && String(tecnico).trim().length > 0) {
      whereClause += ' AND (o.cuadrilla LIKE ? OR CONCAT(COALESCE(u.nombres, ""), " ", COALESCE(u.primer_apellido, u.apellidos, "")) LIKE ?)';
      const term = `%${String(tecnico).trim()}%`;
      queryParams.push(term, term);
    }

    const [rows] = await pool.query(`
      SELECT 
        o.id_tecnico,
        COALESCE(
          NULLIF(TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))), ''),
          NULLIF(TRIM(o.cuadrilla), ''),
          'Sin Técnico Asignado'
        ) AS tecnico_nombre,
        COALESCE(NULLIF(TRIM(o.cuadrilla), ''), 'Sin Cuadrilla') AS cuadrilla,
        COALESCE(NULLIF(TRIM(o.motivo_finalizacion), ''), '') AS motivo_finalizacion,
        COALESCE(NULLIF(TRIM(o.motivo_trabajo), ''), '') AS motivo_trabajo,
        COALESCE(NULLIF(TRIM(o.tipo_trabajo), ''), 'SIN TIPO') AS tipo_trabajo,
        COALESCE(NULLIF(TRIM(o.estado), ''), 'Sin Estado') AS estado,
        COUNT(DISTINCT o.id_orden) AS cantidad,
        COUNT(DISTINCT CASE WHEN ol.id_liquidacion IS NOT NULL THEN o.id_orden END) AS liquidadas,
        COUNT(DISTINCT CASE WHEN ol.id_liquidacion IS NOT NULL AND (ol.estado = 'Aprobada' OR ol.estado = 'Liquidada') THEN o.id_orden END) AS actas_aprobadas,
        COUNT(DISTINCT CASE WHEN ol.id_liquidacion IS NOT NULL AND ol.estado = 'Pendiente' THEN o.id_orden END) AS actas_pendientes
      FROM ordenes o
      LEFT JOIN usuarios u ON o.id_tecnico = u.id_usuario
      LEFT JOIN orden_liquidaciones ol ON o.id_orden = ol.id_orden
      ${whereClause}
      GROUP BY o.id_tecnico, tecnico_nombre, cuadrilla, motivo_finalizacion, motivo_trabajo, tipo_trabajo, estado
    `, queryParams);

    // Obtener catálogo oficial de tipos de trabajo desde la tabla SQL tipos_trabajo
    const [dbTipos] = await pool.query("SELECT id_tipo_trabajo, nombre FROM tipos_trabajo WHERE estado = 'Activo' ORDER BY nombre ASC");
    const catalogoOficial = dbTipos.length > 0
      ? dbTipos.map(t => t.nombre)
      : [
          "ADICIONAL",
          "GARANTIA",
          "GARANTIA NO REALIZADA",
          "NORMALIZACIÓN",
          "PEX",
          "RECABLEADO",
          "RECABLEADO EN CONDOMINIO",
          "REUBICACIÓN CON RESERVA",
          "REUBICACIÓN SIN RESERVA",
          "TRASALDO EN CONDOMINIO",
          "TRASLADO",
          "VISITA EXTERNA"
        ];

    // Cargar motivos activos directamente desde la tabla MySQL `motivos`
    const catalogoMotivos = await getMotivosCatalogo(pool);

    const techMap = new Map();
    const tipoCountsGlobal = {};
    for (const c of catalogoOficial) {
      tipoCountsGlobal[c] = 0;
    }
    const estadoCountsGlobal = {};

    let grandTotal = 0;
    let grandFinalizadas = 0;
    let grandLiquidadas = 0;
    let grandCanceladas = 0;
    let grandReagendadas = 0;
    let grandIniciadas = 0;

    for (const r of rows) {
      let techName = r.tecnico_nombre;
      if (techName.includes('CESPEDES SGA')) {
        const parts = techName.split('CESPEDES SGA');
        techName = parts[parts.length - 1].trim();
      } else if (techName.includes('MOTOWIN CESPEDES')) {
        const parts = techName.split('MOTOWIN CESPEDES');
        techName = parts[parts.length - 1].trim();
      }

      // Prioridad 1: Tipo de trabajo oficial ya asignado o modificado manualmente en BD
      let tipo = null;
      if (r.tipo_trabajo && r.tipo_trabajo !== 'SIN TIPO') {
        const normR = normalizeText(r.tipo_trabajo);
        const matchOficial = catalogoOficial.find(c => normalizeText(c) === normR);
        if (matchOficial) {
          tipo = matchOficial;
        }
      }

      // Prioridad 2: Homologar contra la tabla oficial `motivos` de MySQL
      if (!tipo) {
        tipo = resolverTipoTrabajoConCatalogo(r.motivo_finalizacion, r.tipo_trabajo || r.motivo_trabajo, r.estado, catalogoMotivos);
      }
      const estado = (r.estado || 'Sin Estado').trim();
      const cant = Number(r.cantidad) || 0;
      const liq = Number(r.liquidadas) || 0;
      const actAprobadas = Number(r.actas_aprobadas) || 0;
      const actPendientes = Number(r.actas_pendientes) || 0;

      grandTotal += cant;
      estadoCountsGlobal[estado] = (estadoCountsGlobal[estado] || 0) + cant;

      if (!techMap.has(techName)) {
        const initTipos = {};
        for (const c of catalogoOficial) initTipos[c] = 0;

        techMap.set(techName, {
          id_tecnico: r.id_tecnico,
          tecnico: techName,
          cuadrilla: r.cuadrilla,
          total: 0,
          finalizadas: 0,
          liquidadas: 0,
          actas_aprobadas: 0,
          actas_pendientes: 0,
          pendientes_liquidacion: 0,
          ratio_liquidacion: 0,
          canceladas: 0,
          reagendadas: 0,
          iniciadas: 0,
          otras: 0,
          efectividad: 0,
          tipos_trabajo: initTipos,
          estados: {}
        });
      }

      const t = techMap.get(techName);
      t.total += cant;
      t.liquidadas += liq;
      t.actas_aprobadas += actAprobadas;
      t.actas_pendientes += actPendientes;
      t.estados[estado] = (t.estados[estado] || 0) + cant;
      grandLiquidadas += liq;

      const estLower = estado.toLowerCase();
      const esFinalizada = estLower.includes('finaliz') || estLower.includes('liquid');

      if (esFinalizada) {
        t.finalizadas += cant;
        grandFinalizadas += cant;
        // Solo las órdenes FINALIZADAS se contabilizan en la matriz de tipos de trabajo
        if (tipo && t.tipos_trabajo[tipo] !== undefined) {
          t.tipos_trabajo[tipo] = (t.tipos_trabajo[tipo] || 0) + cant;
        }
        if (tipo && tipoCountsGlobal[tipo] !== undefined) {
          tipoCountsGlobal[tipo] = (tipoCountsGlobal[tipo] || 0) + cant;
        }
      } else if (estLower.includes('cancel') || estLower.includes('anul')) {
        t.canceladas += cant;
        grandCanceladas += cant;
      } else if (estLower.includes('regest') || estLower.includes('suspend') || estLower.includes('observ') || estLower.includes('reint')) {
        t.reagendadas += cant;
        grandReagendadas += cant;
      } else if (estLower.includes('inic') || estLower.includes('camino')) {
        t.iniciadas += cant;
        grandIniciadas += cant;
      } else {
        t.otras += cant;
      }
    }

    // Consultar estadísticas de asistencia (puntualidad / tardanzas) en el rango consultado
    const asistenciaStatsMap = new Map();
    let grandTardanzas = 0;
    let grandPuntuales = 0;
    let grandFaltas = 0;
    let grandMinutosTarde = 0;

    try {
      const [asistRows] = await pool.query(`
        SELECT 
          COALESCE(t.id_usuario, t.id_trabajador) AS id_usuario,
          a.id_trabajador,
          COUNT(a.id_asistencia) AS total_registros,
          SUM(CASE WHEN a.estado = 'Tardanza' THEN 1 ELSE 0 END) AS tardanzas,
          SUM(CASE WHEN a.estado = 'Asistio' THEN 1 ELSE 0 END) AS puntuales,
          SUM(CASE WHEN a.estado = 'Falta' THEN 1 ELSE 0 END) AS faltas,
          SUM(COALESCE(a.minutos_tarde, 0)) AS total_minutos_tarde,
          ROUND(AVG(CASE WHEN a.estado = 'Tardanza' THEN a.minutos_tarde ELSE NULL END), 1) AS prom_minutos_tarde
        FROM asistencias a
        INNER JOIN trabajadores t ON a.id_trabajador = t.id_trabajador
        WHERE a.fecha BETWEEN ? AND ?
        GROUP BY id_usuario, a.id_trabajador
      `, [desde, hasta]);

      for (const ar of asistRows) {
        const uId = Number(ar.id_usuario);
        const tId = Number(ar.id_trabajador);
        const tards = Number(ar.tardanzas) || 0;
        const punts = Number(ar.puntuales) || 0;
        const flts = Number(ar.faltas) || 0;
        const minTarde = Number(ar.total_minutos_tarde) || 0;
        const promMin = Number(ar.prom_minutos_tarde) || 0;

        grandTardanzas += tards;
        grandPuntuales += punts;
        grandFaltas += flts;
        grandMinutosTarde += minTarde;

        const info = {
          total_asistencias: Number(ar.total_registros) || 0,
          tardanzas: tards,
          puntuales: punts,
          faltas: flts,
          minutos_tarde: minTarde,
          prom_minutos_tarde: promMin
        };

        if (uId) asistenciaStatsMap.set(uId, info);
        if (tId) asistenciaStatsMap.set(`t_${tId}`, info);
      }
    } catch (errAsist) {
      console.warn("Advertencia al calcular estadísticas de asistencia para rendimiento:", errAsist.message);
    }

    const tecnicos = Array.from(techMap.values()).map(t => {
      const ef = t.total > 0 ? Math.round((t.finalizadas / t.total) * 1000) / 10 : 0;
      const pendientesLiq = Math.max(0, t.finalizadas - t.liquidadas);
      const ratioLiq = t.finalizadas > 0 ? Math.round((t.liquidadas / t.finalizadas) * 1000) / 10 : 0;
      
      const asistInfo = asistenciaStatsMap.get(Number(t.id_tecnico)) || 
                        asistenciaStatsMap.get(`t_${t.id_tecnico}`) || {
                          total_asistencias: 0,
                          tardanzas: 0,
                          puntuales: 0,
                          faltas: 0,
                          minutos_tarde: 0,
                          prom_minutos_tarde: 0
                        };

      const totalPres = asistInfo.puntuales + asistInfo.tardanzas;
      const puntualidadPct = totalPres > 0 ? Math.round((asistInfo.puntuales / totalPres) * 1000) / 10 : 100;

      return { 
        ...t, 
        efectividad: ef,
        pendientes_liquidacion: pendientesLiq,
        ratio_liquidacion: ratioLiq,
        asistencias: {
          ...asistInfo,
          puntualidad_pct: puntualidadPct
        }
      };
    }).sort((a, b) => b.total - a.total);

    const globalEfectividad = grandTotal > 0 ? Math.round((grandFinalizadas / grandTotal) * 1000) / 10 : 0;
    const globalRatioLiquidacion = grandFinalizadas > 0 ? Math.round((grandLiquidadas / grandFinalizadas) * 1000) / 10 : 0;
    const totalPresGlobal = grandPuntuales + grandTardanzas;
    const globalPuntualidad = totalPresGlobal > 0 ? Math.round((grandPuntuales / totalPresGlobal) * 1000) / 10 : 100;

    res.json({
      success: true,
      filtros: { desde, hasta, periodo, tecnico: tecnico || '' },
      kpis: {
        total_tecnicos: tecnicos.length,
        total_ordenes: grandTotal,
        total_finalizadas: grandFinalizadas,
        total_liquidadas: grandLiquidadas,
        total_pendientes_liquidacion: Math.max(0, grandFinalizadas - grandLiquidadas),
        total_canceladas: grandCanceladas,
        total_reagendadas: grandReagendadas,
        total_iniciadas: grandIniciadas,
        tasa_efectividad_global: globalEfectividad,
        tasa_liquidacion_global: globalRatioLiquidacion,
        total_tardanzas: grandTardanzas,
        total_puntuales: grandPuntuales,
        total_faltas: grandFaltas,
        total_minutos_tarde: grandMinutosTarde,
        promedio_minutos_tarde: grandTardanzas > 0 ? Math.round((grandMinutosTarde / grandTardanzas) * 10) / 10 : 0,
        tasa_puntualidad_global: globalPuntualidad,
        tecnico_top: tecnicos[0] ? {
          nombre: tecnicos[0].tecnico,
          total: tecnicos[0].total,
          finalizadas: tecnicos[0].finalizadas,
          efectividad: tecnicos[0].efectividad
        } : null
      },
      tipos_trabajo_columnas: catalogoOficial,
      totales_columnas_tipo: tipoCountsGlobal,
      totales_estados: estadoCountsGlobal,
      tecnicos
    });
  } catch (error) {
    console.error("Error en /api/dashboard/rendimiento-tecnicos:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get(['/ordenes-detalle-matriz', '/dashboard/ordenes-detalle-matriz'], async (req, res) => {
  try {
    let { id_tecnico, tecnico, tipo_trabajo, desde, hasta } = req.query;

    if (!desde || !hasta) {
      return res.status(400).json({ success: false, error: "Fechas 'desde' y 'hasta' son obligatorias" });
    }

    let whereClause = `
      WHERE DATE(o.fecha_visita) >= ? 
        AND DATE(o.fecha_visita) <= ? 
        AND o.estado != 'Finalizada Externa'
        AND (o.tecnico_asignado IS NULL OR o.tecnico_asignado NOT LIKE 'EXTERNO%')
    `;
    const queryParams = [desde, hasta];

    if (id_tecnico && Number(id_tecnico) > 0) {
      whereClause += ` AND (o.id_tecnico = ? OR u.id_usuario = ?)`;
      queryParams.push(Number(id_tecnico), Number(id_tecnico));
    } else if (tecnico && String(tecnico).trim()) {
      whereClause += ` AND (o.cuadrilla LIKE ? OR CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, '')) LIKE ?)`;
      const term = `%${String(tecnico).trim()}%`;
      queryParams.push(term, term);
    }

    const [rows] = await pool.query(`
      SELECT 
        o.id_orden,
        o.numero,
        o.cliente,
        o.fecha_visita,
        o.direccion,
        o.localidad,
        o.sector_operativo,
        o.estado,
        o.motivo_finalizacion,
        o.motivo_trabajo,
        o.tipo_trabajo,
        o.cuadrilla,
        COALESCE(
          NULLIF(TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))), ''),
          NULLIF(TRIM(o.cuadrilla), ''),
          'Sin Técnico Asignado'
        ) AS tecnico_nombre
      FROM ordenes o
      LEFT JOIN usuarios u ON o.id_tecnico = u.id_usuario
      ${whereClause}
      ORDER BY o.fecha_visita DESC, o.id_orden DESC
    `, queryParams);

    const catalogoMotivos = await getMotivosCatalogo(pool);
    const [dbTipos] = await pool.query("SELECT nombre FROM tipos_trabajo WHERE estado = 'Activo' ORDER BY nombre ASC");
    const catalogoOficial = dbTipos.length > 0 ? dbTipos.map(t => t.nombre) : [
      "ADICIONAL", "GARANTIA", "GARANTIA NO REALIZADA", "NORMALIZACIÓN", "PEX", "RECABLEADO",
      "RECABLEADO EN CONDOMINIO", "REUBICACIÓN CON RESERVA", "REUBICACIÓN SIN RESERVA",
      "TRASALDO EN CONDOMINIO", "TRASLADO", "VISITA EXTERNA"
    ];

    const ordenesFiltradas = [];
    for (const r of rows) {
      const estLower = (r.estado || '').toLowerCase();
      const esFinalizada = estLower.includes('finaliz') || estLower.includes('liquid');
      if (!esFinalizada) continue;

      // Prioridad 1: Tipo oficial ya asignado o modificado manualmente en BD
      let tipoResuelto = null;
      if (r.tipo_trabajo && r.tipo_trabajo !== 'SIN TIPO') {
        const normR = normalizeText(r.tipo_trabajo);
        const matchOficial = catalogoOficial.find(c => normalizeText(c) === normR);
        if (matchOficial) {
          tipoResuelto = matchOficial;
        }
      }

      // Prioridad 2: Homologar contra motivo de finalización y catálogo
      if (!tipoResuelto) {
        tipoResuelto = resolverTipoTrabajoConCatalogo(r.motivo_finalizacion, r.tipo_trabajo || r.motivo_trabajo, r.estado, catalogoMotivos);
      }

      if (!tipo_trabajo || tipo_trabajo === 'TOTAL' || tipoResuelto === tipo_trabajo) {
        ordenesFiltradas.push({
          id_orden: r.id_orden,
          numero: r.numero,
          cliente: r.cliente || 'Sin cliente',
          fecha_visita: r.fecha_visita,
          direccion: r.direccion || 'Sin dirección',
          localidad: r.localidad || r.sector_operativo || '',
          estado: r.estado,
          motivo_finalizacion: r.motivo_finalizacion || '',
          motivo_trabajo: r.motivo_trabajo || '',
          tipo_trabajo_resuelto: tipoResuelto || r.tipo_trabajo || 'SIN TIPO',
          cuadrilla: r.cuadrilla,
          tecnico: r.tecnico_nombre
        });
      }
    }

    res.json({
      success: true,
      total: ordenesFiltradas.length,
      tecnico: tecnico || (ordenesFiltradas[0]?.tecnico || 'Técnico'),
      tipo_trabajo: tipo_trabajo || 'TOTAL',
      ordenes: ordenesFiltradas
    });
  } catch (error) {
    console.error("Error en /api/dashboard/ordenes-detalle-matriz:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get(['/rendimiento-tecnicos-fechas', '/dashboard/rendimiento-tecnicos-fechas'], async (req, res) => {
  try {
    let { desde, hasta, periodo, tecnico, estado } = req.query;
    const hoy = new Date();
    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (periodo && (!desde || !hasta)) {
      if (periodo === 'hoy') {
        desde = fmt(hoy);
        hasta = fmt(hoy);
      } else if (periodo === 'ayer') {
        const ayer = new Date(hoy);
        ayer.setDate(hoy.getDate() - 1);
        desde = fmt(ayer);
        hasta = fmt(ayer);
      } else if (periodo === 'semana') {
        const lunes = new Date(hoy);
        lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
        const domingo = new Date(lunes);
        domingo.setDate(lunes.getDate() + 6);
        desde = fmt(lunes);
        hasta = fmt(domingo);
      } else if (periodo === 'mes') {
        const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        desde = fmt(primero);
        hasta = fmt(ultimo);
      } else if (periodo === 'mes_anterior') {
        const primeroAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        const ultimoAnt = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
        desde = fmt(primeroAnt);
        hasta = fmt(ultimoAnt);
      }
    }

    if (!desde || !hasta) {
      const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      desde = desde || fmt(primero);
      hasta = hasta || fmt(ultimo);
    }

    // Generar lista continua de fechas del rango
    const fechasList = [];
    let curDate = new Date(desde + 'T00:00:00');
    const endDate = new Date(hasta + 'T00:00:00');
    while (curDate <= endDate) {
      fechasList.push(fmt(curDate));
      curDate.setDate(curDate.getDate() + 1);
    }

    let whereClause = `
      WHERE DATE(o.fecha_visita) >= ? 
        AND DATE(o.fecha_visita) <= ? 
        AND o.estado != 'Finalizada Externa'
        AND (o.tecnico_asignado IS NULL OR o.tecnico_asignado NOT LIKE 'EXTERNO%')
        AND (o.id_tecnico IS NOT NULL AND o.id_tecnico > 0)
    `;
    const queryParams = [desde, hasta];

    if (tecnico && String(tecnico).trim().length > 0) {
      whereClause += ' AND (o.cuadrilla LIKE ? OR CONCAT(COALESCE(u.nombres, ""), " ", COALESCE(u.primer_apellido, u.apellidos, "")) LIKE ?)';
      const term = `%${String(tecnico).trim()}%`;
      queryParams.push(term, term);
    }

    if (estado && String(estado).trim() !== '' && String(estado).toLowerCase() !== 'todos') {
      whereClause += ' AND o.estado = ?';
      queryParams.push(String(estado).trim());
    }

    // Consulta de agregación por fecha, técnico y estado
    const [rows] = await pool.query(`
      SELECT 
        DATE_FORMAT(o.fecha_visita, '%Y-%m-%d') AS fecha,
        o.id_tecnico,
        COALESCE(
          NULLIF(TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))), ''),
          NULLIF(TRIM(o.cuadrilla), ''),
          'Sin Técnico'
        ) AS tecnico_nombre,
        COALESCE(NULLIF(TRIM(o.cuadrilla), ''), 'Sin Cuadrilla') AS cuadrilla,
        COALESCE(NULLIF(TRIM(o.estado), ''), 'Sin Estado') AS estado,
        COUNT(*) AS cantidad
      FROM ordenes o
      LEFT JOIN usuarios u ON o.id_tecnico = u.id_usuario
      ${whereClause}
      GROUP BY DATE_FORMAT(o.fecha_visita, '%Y-%m-%d'), o.id_tecnico, tecnico_nombre, cuadrilla, estado
      ORDER BY fecha ASC, tecnico_nombre ASC
    `, queryParams);

    // Obtener todos los técnicos activos del sistema para que también aparezcan si no tuvieron órdenes
    const [usuariosTecnicos] = await pool.query(`
      SELECT 
        u.id_usuario AS id_tecnico,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        COALESCE(NULLIF(TRIM(u.cuadrilla), ''), 'Sin Cuadrilla') AS cuadrilla,
        COALESCE(u.estado, 'Activo') AS estado_usuario
      FROM usuarios u
      WHERE u.id_rol = 2 OR u.cargo LIKE '%TECNICO%' OR u.area LIKE '%CAMPO%' OR u.area LIKE '%MOTO%'
      ORDER BY u.nombres ASC
    `);

    // Estructurar el mapa de técnicos
    const techMap = new Map();
    const estadosCatalogo = new Set(['Finalizada', 'Asignada', 'Iniciada', 'Cancelada', 'Regestión']);

    // Inicializar con técnicos del sistema
    for (const ut of usuariosTecnicos) {
      let tName = ut.tecnico_nombre;
      if (tName.includes('CESPEDES SGA')) {
        const parts = tName.split('CESPEDES SGA');
        tName = parts[parts.length - 1].trim();
      } else if (tName.includes('MOTOWIN CESPEDES')) {
        const parts = tName.split('MOTOWIN CESPEDES');
        tName = parts[parts.length - 1].trim();
      }

      if (!techMap.has(tName) && tName.length > 0) {
        const initFechas = {};
        for (const f of fechasList) {
          initFechas[f] = { total: 0, finalizadas: 0, canceladas: 0, asignadas: 0, iniciadas: 0, regestion: 0, estados: {} };
        }
        techMap.set(tName, {
          id_tecnico: ut.id_tecnico,
          tecnico: tName,
          cuadrilla: ut.cuadrilla,
          estado_usuario: ut.estado_usuario || 'Activo',
          fechas: initFechas,
          totales: {
            total_ordenes: 0,
            finalizadas: 0,
            canceladas: 0,
            asignadas: 0,
            iniciadas: 0,
            regestion: 0,
            dias_trabajados: 0,
            dias_sin_ordenes: fechasList.length,
            efectividad: 0
          }
        });
      }
    }

    // Procesar las filas de órdenes reales
    for (const r of rows) {
      let tName = r.tecnico_nombre;
      if (tName.includes('CESPEDES SGA')) {
        const parts = tName.split('CESPEDES SGA');
        tName = parts[parts.length - 1].trim();
      } else if (tName.includes('MOTOWIN CESPEDES')) {
        const parts = tName.split('MOTOWIN CESPEDES');
        tName = parts[parts.length - 1].trim();
      }

      const est = (r.estado || 'Sin Estado').trim();
      estadosCatalogo.add(est);
      const cant = Number(r.cantidad) || 0;

      if (!techMap.has(tName)) {
        const initFechas = {};
        for (const f of fechasList) {
          initFechas[f] = { total: 0, finalizadas: 0, canceladas: 0, asignadas: 0, iniciadas: 0, regestion: 0, estados: {} };
        }
        techMap.set(tName, {
          id_tecnico: r.id_tecnico,
          tecnico: tName,
          cuadrilla: r.cuadrilla,
          estado_usuario: 'Activo',
          fechas: initFechas,
          totales: {
            total_ordenes: 0,
            finalizadas: 0,
            canceladas: 0,
            asignadas: 0,
            iniciadas: 0,
            regestion: 0,
            dias_trabajados: 0,
            dias_sin_ordenes: fechasList.length,
            efectividad: 0
          }
        });
      }

      const tObj = techMap.get(tName);
      if (tObj.fechas[r.fecha]) {
        tObj.fechas[r.fecha].total += cant;
        tObj.fechas[r.fecha].estados[est] = (tObj.fechas[r.fecha].estados[est] || 0) + cant;

        const estLow = est.toLowerCase();
        if (estLow.includes('finaliz') || estLow.includes('liquid')) {
          tObj.fechas[r.fecha].finalizadas += cant;
          tObj.totales.finalizadas += cant;
        } else if (estLow.includes('cancel') || estLow.includes('anul')) {
          tObj.fechas[r.fecha].canceladas += cant;
          tObj.totales.canceladas += cant;
        } else if (estLow.includes('asig') || estLow.includes('prog')) {
          tObj.fechas[r.fecha].asignadas += cant;
          tObj.totales.asignadas += cant;
        } else if (estLow.includes('inic') || estLow.includes('camino') || estLow.includes('proceso')) {
          tObj.fechas[r.fecha].iniciadas += cant;
          tObj.totales.iniciadas += cant;
        } else if (estLow.includes('regest') || estLow.includes('reagend')) {
          tObj.fechas[r.fecha].regestion += cant;
          tObj.totales.regestion += cant;
        }

        tObj.totales.total_ordenes += cant;
      }
    }

    // Obtener descansos programados y registrados por asistencia en el rango de fechas
    const [descansosProg] = await pool.query(`
      SELECT 
        COALESCE(t.id_usuario, td.id_trabajador) AS id_usuario,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        DATE_FORMAT(td.fecha_inicio, '%Y-%m-%d') AS fecha_inicio,
        DATE_FORMAT(td.fecha_fin, '%Y-%m-%d') AS fecha_fin
      FROM trabajador_descansos td
      LEFT JOIN trabajadores t ON td.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE td.estado != 'Cancelado'
        AND NOT (td.fecha_fin < ? OR td.fecha_inicio > ?)
    `, [desde, hasta]);

    const [asistenciasRecords] = await pool.query(`
      SELECT 
        COALESCE(t.id_usuario, a.id_trabajador) AS id_usuario,
        TRIM(CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) AS tecnico_nombre,
        DATE_FORMAT(a.fecha, '%Y-%m-%d') AS fecha,
        a.estado
      FROM asistencias a
      LEFT JOIN trabajadores t ON a.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE a.fecha BETWEEN ? AND ?
    `, [desde, hasta]);

    // Mapa de fechas de descansos y faltas por técnico
    const cleanTechName = (name) => {
      let tn = String(name || '').trim();
      if (tn.includes('CESPEDES SGA')) {
        const parts = tn.split('CESPEDES SGA');
        tn = parts[parts.length - 1].trim();
      } else if (tn.includes('MOTOWIN CESPEDES')) {
        const parts = tn.split('MOTOWIN CESPEDES');
        tn = parts[parts.length - 1].trim();
      }
      return tn;
    };

    const techDescansosMap = new Map();
    const techFaltasMap = new Map();

    const addDateToMap = (targetMap, idUser, rawName, fechaStr) => {
      const cName = cleanTechName(rawName);
      if (idUser) {
        const keyId = `id_${idUser}`;
        if (!targetMap.has(keyId)) targetMap.set(keyId, new Set());
        targetMap.get(keyId).add(fechaStr);
      }
      if (cName) {
        const keyName = `name_${cName.toLowerCase()}`;
        if (!targetMap.has(keyName)) targetMap.set(keyName, new Set());
        targetMap.get(keyName).add(fechaStr);
      }
    };

    for (const dp of descansosProg) {
      if (!dp.fecha_inicio || !dp.fecha_fin) continue;
      let cur = new Date(dp.fecha_inicio + 'T00:00:00');
      const end = new Date(dp.fecha_fin + 'T00:00:00');
      const rangeStart = new Date(desde + 'T00:00:00');
      const rangeEnd = new Date(hasta + 'T00:00:00');
      if (cur < rangeStart) cur = new Date(rangeStart);
      const effectiveEnd = end > rangeEnd ? rangeEnd : end;

      while (cur <= effectiveEnd) {
        addDateToMap(techDescansosMap, dp.id_usuario, dp.tecnico_nombre, fmt(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }

    for (const ar of asistenciasRecords) {
      if (!ar.fecha) continue;
      const est = (ar.estado || '').toLowerCase();
      if (est === 'descanso') {
        addDateToMap(techDescansosMap, ar.id_usuario, ar.tecnico_nombre, ar.fecha);
      } else if (est === 'falta') {
        addDateToMap(techFaltasMap, ar.id_usuario, ar.tecnico_nombre, ar.fecha);
      }
    }

    // Calcular días trabajados, días sin órdenes, días de descanso, faltas y efectividad por técnico
    const tecnicosArr = Array.from(techMap.values());
    for (const t of tecnicosArr) {
      let diasTrab = 0;
      let diasFalta = 0;

      const setDescById = t.id_tecnico ? techDescansosMap.get(`id_${t.id_tecnico}`) : null;
      const setDescByName = t.tecnico ? techDescansosMap.get(`name_${cleanTechName(t.tecnico).toLowerCase()}`) : null;
      const combinedDescansos = new Set([
        ...(setDescById ? Array.from(setDescById) : []),
        ...(setDescByName ? Array.from(setDescByName) : [])
      ]);

      const setFaltaById = t.id_tecnico ? techFaltasMap.get(`id_${t.id_tecnico}`) : null;
      const setFaltaByName = t.tecnico ? techFaltasMap.get(`name_${cleanTechName(t.tecnico).toLowerCase()}`) : null;
      const combinedFaltas = new Set([
        ...(setFaltaById ? Array.from(setFaltaById) : []),
        ...(setFaltaByName ? Array.from(setFaltaByName) : [])
      ]);

      for (const f of fechasList) {
        const esDesc = combinedDescansos.has(f);
        const esFalt = combinedFaltas.has(f);
        if (t.fechas[f]) {
          t.fechas[f].es_descanso = esDesc;
          t.fechas[f].es_falta = esFalt;
          if (t.fechas[f].total > 0) {
            diasTrab++;
          }
        }
        if (esFalt) {
          diasFalta++;
        }
      }

      t.totales.dias_trabajados = diasTrab;
      t.totales.dias_sin_ordenes = Math.max(0, fechasList.length - diasTrab);
      t.totales.dias_descanso = combinedDescansos.size;
      t.totales.dias_falta = diasFalta;

      t.totales.efectividad = t.totales.total_ordenes > 0
        ? Number(((t.totales.finalizadas / t.totales.total_ordenes) * 100).toFixed(1))
        : 0;
    }

    // Totales globales por fecha
    const totalesPorFecha = {};
    for (const f of fechasList) {
      totalesPorFecha[f] = { total: 0, finalizadas: 0, canceladas: 0, asignadas: 0, iniciadas: 0, regestion: 0, tecnicos_activos: 0 };
      for (const t of tecnicosArr) {
        const diaData = t.fechas[f];
        if (diaData && diaData.total > 0) {
          totalesPorFecha[f].total += diaData.total;
          totalesPorFecha[f].finalizadas += diaData.finalizadas;
          totalesPorFecha[f].canceladas += diaData.canceladas;
          totalesPorFecha[f].asignadas += diaData.asignadas;
          totalesPorFecha[f].iniciadas += diaData.iniciadas;
          totalesPorFecha[f].regestion += diaData.regestion;
          totalesPorFecha[f].tecnicos_activos++;
        }
      }
    }

    res.json({
      success: true,
      filtros: { desde, hasta, periodo, tecnico: tecnico || '', estado: estado || 'Todos' },
      fechas: fechasList,
      estados: Array.from(estadosCatalogo),
      totales_por_fecha: totalesPorFecha,
      tecnicos: tecnicosArr
    });
  } catch (error) {
    console.error("Error en /api/dashboard/rendimiento-tecnicos-fechas:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get(['/latencia-primer-tramo', '/dashboard/latencia-primer-tramo'], async (req, res) => {
  try {
    const { desde, hasta, id_tecnico, cuadrilla } = req.query;

    let fechaDesde = desde;
    let fechaHasta = hasta;

    if (!fechaDesde || !fechaHasta) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const ultDia = new Date(y, now.getMonth() + 1, 0).getDate();
      fechaDesde = `${y}-${m}-01`;
      fechaHasta = `${y}-${m}-${String(ultDia).padStart(2, '0')}`;
    }

    let whereSql = `
      WHERE DATE(o.fecha_visita) >= ? 
        AND DATE(o.fecha_visita) <= ? 
        AND o.inicio_visita IS NOT NULL
        AND TIME(o.inicio_visita) BETWEEN '06:00:00' AND '14:00:00'
        AND o.tecnico_asignado IS NOT NULL 
        AND TRIM(o.tecnico_asignado) != ''
        AND o.tecnico_asignado NOT LIKE 'EXTERNO%'
        AND o.estado != 'Finalizada Externa'
        AND (o.id_tecnico IS NOT NULL AND o.id_tecnico > 0)
    `;
    const params = [fechaDesde, fechaHasta];

    if (id_tecnico) {
      whereSql += ` AND (o.id_tecnico = ? OR o.id_tecnico_reemplazo = ?)`;
      params.push(id_tecnico, id_tecnico);
    }
    if (cuadrilla && cuadrilla.trim()) {
      whereSql += ` AND o.cuadrilla LIKE ?`;
      params.push(`%${cuadrilla.trim()}%`);
    }

    // Consulta de todas las órdenes candidatas de la mañana ordenadas por técnico, fecha e inicio
    const sql = `
      SELECT 
        o.id_orden,
        o.numero,
        o.cliente,
        o.tipo_trabajo,
        o.cuadrilla,
        TRIM(o.tecnico_asignado) AS tecnico,
        COALESCE(o.id_tecnico_reemplazo, o.id_tecnico, 0) AS id_tecnico,
        DATE_FORMAT(o.fecha_visita, '%Y-%m-%d') AS fecha,
        TIME_FORMAT(o.inicio_visita, '%H:%i:%s') AS hora_inicio,
        TIME_FORMAT(o.hora_asignacion, '%H:%i:%s') AS hora_asignacion,
        TIME_FORMAT(o.hora_en_camino, '%H:%i:%s') AS hora_en_camino,
        o.estado,
        o.motivo_finalizacion,
        ROUND((TIME_TO_SEC(TIME(o.inicio_visita)) - TIME_TO_SEC('08:00:00')) / 60) AS diff_minutos
      FROM ordenes o
      ${whereSql}
      ORDER BY DATE(o.fecha_visita) ASC, TRIM(o.tecnico_asignado) ASC, TIME(o.inicio_visita) ASC
    `;

    const [rows] = await pool.query(sql, params);

    // Seleccionar estrictamente la 1ra orden por técnico y por día
    const primeraOrdenPorTecnicoDia = new Map();

    for (const r of rows) {
      const key = `${r.tecnico}___${r.fecha}`;
      if (!primeraOrdenPorTecnicoDia.has(key)) {
        // Latencia de demora: si llegó antes de las 08:00, la demora efectiva es 0 min
        const diffNum = Number(r.diff_minutos) || 0;
        const latenciaDemora = Math.max(0, diffNum);
        let semaforo = 'verde';
        if (latenciaDemora > 50) {
          semaforo = 'rojo';
        } else if (latenciaDemora > 30) {
          semaforo = 'amarillo';
        }

        primeraOrdenPorTecnicoDia.set(key, {
          ...r,
          latencia_demora: latenciaDemora,
          diff_real: diffNum,
          semaforo
        });
      }
    }

    const detallePrimerasOrdenes = Array.from(primeraOrdenPorTecnicoDia.values());

    // Agrupar por técnico para generar estadísticas y ranking
    const mapaTecnicos = new Map();

    for (const ord of detallePrimerasOrdenes) {
      const tecNombre = ord.tecnico;
      if (!mapaTecnicos.has(tecNombre)) {
        mapaTecnicos.set(tecNombre, {
          id_tecnico: ord.id_tecnico,
          tecnico: tecNombre,
          cuadrilla: ord.cuadrilla || '',
          dias_laborados: 0,
          total_latencia_min: 0,
          latencias: [],
          ordenes: [],
          conteo_verde: 0,
          conteo_amarillo: 0,
          conteo_rojo: 0
        });
      }

      const tecObj = mapaTecnicos.get(tecNombre);
      tecObj.dias_laborados += 1;
      tecObj.total_latencia_min += ord.latencia_demora;
      tecObj.latencias.push(ord.latencia_demora);
      tecObj.ordenes.push(ord);

      if (ord.semaforo === 'verde') tecObj.conteo_verde += 1;
      else if (ord.semaforo === 'amarillo') tecObj.conteo_amarillo += 1;
      else tecObj.conteo_rojo += 1;
    }

    let sumaTotalLatencia = 0;
    let totalJornadas = 0;
    let totalVerdes = 0;

    const rankingTecnicos = Array.from(mapaTecnicos.values()).map((t) => {
      const promedioMin = t.dias_laborados > 0 ? Math.round(t.total_latencia_min / t.dias_laborados) : 0;
      sumaTotalLatencia += t.total_latencia_min;
      totalJornadas += t.dias_laborados;
      totalVerdes += t.conteo_verde;

      let semaforoGeneral = 'verde';
      if (promedioMin > 50) semaforoGeneral = 'rojo';
      else if (promedioMin > 30) semaforoGeneral = 'amarillo';

      // Hora estimada promedio de inicio (08:00 + promedio)
      const hTotalMin = 8 * 60 + promedioMin;
      const horas = Math.floor(hTotalMin / 60);
      const minutos = hTotalMin % 60;
      const horaPromedioTexto = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;

      const minLatencia = Math.min(...t.latencias);
      const maxLatencia = Math.max(...t.latencias);

      return {
        id_tecnico: t.id_tecnico,
        tecnico: t.tecnico,
        cuadrilla: t.cuadrilla,
        dias_laborados: t.dias_laborados,
        latencia_promedio_min: promedioMin,
        hora_promedio_inicio: horaPromedioTexto,
        min_latencia: minLatencia,
        max_latencia: maxLatencia,
        conteo_verde: t.conteo_verde,
        conteo_amarillo: t.conteo_amarillo,
        conteo_rojo: t.conteo_rojo,
        porcentaje_puntual: t.dias_laborados > 0 ? Math.round((t.conteo_verde / t.dias_laborados) * 100) : 0,
        semaforo: semaforoGeneral
      };
    });

    // Ordenar ranking: de menor latencia (más puntual) a mayor latencia
    rankingTecnicos.sort((a, b) => a.latencia_promedio_min - b.latencia_promedio_min);

    const latenciaPromedioGeneral = totalJornadas > 0 ? Math.round(sumaTotalLatencia / totalJornadas) : 0;
    const porcentajePuntualGeneral = totalJornadas > 0 ? Math.round((totalVerdes / totalJornadas) * 100) : 0;

    // Calcular hora promedio general de inicio
    const hGenTotalMin = 8 * 60 + latenciaPromedioGeneral;
    const hGenH = Math.floor(hGenTotalMin / 60);
    const hGenM = hGenTotalMin % 60;
    const horaPromedioGeneral = `${String(hGenH).padStart(2, '0')}:${String(hGenM).padStart(2, '0')}`;

    res.json({
      success: true,
      filtros: {
        desde: fechaDesde,
        hasta: fechaHasta,
        id_tecnico: id_tecnico || null,
        cuadrilla: cuadrilla || null
      },
      kpis: {
        total_tecnicos: rankingTecnicos.length,
        total_jornadas_evaluadas: totalJornadas,
        latencia_promedio_general: latenciaPromedioGeneral,
        hora_promedio_general: horaPromedioGeneral,
        porcentaje_puntual_general: porcentajePuntualGeneral,
        tecnico_mas_puntual: rankingTecnicos[0] || null,
        tecnico_mayor_latencia: rankingTecnicos.length > 0 ? rankingTecnicos[rankingTecnicos.length - 1] : null
      },
      ranking_tecnicos: rankingTecnicos,
      detalle_ordenes: detallePrimerasOrdenes
    });
  } catch (error) {
    console.error("Error en /api/dashboard/latencia-primer-tramo:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get(['/matriz-recableados-drop', '/dashboard/matriz-recableados-drop'], async (req, res) => {
  try {
    const { desde, hasta, tecnico } = req.query;

    const whereClauses = ["o.estado NOT IN ('Cancelada', 'Anulada')"];
    const params = [];

    if (desde && hasta) {
      whereClauses.push("DATE(o.fecha_visita) BETWEEN ? AND ?");
      params.push(desde, hasta);
    } else if (desde) {
      whereClauses.push("DATE(o.fecha_visita) >= ?");
      params.push(desde);
    } else if (hasta) {
      whereClauses.push("DATE(o.fecha_visita) <= ?");
      params.push(hasta);
    }

    if (tecnico && tecnico !== 'todos' && tecnico !== 'Todos') {
      whereClauses.push("(o.id_tecnico = ? OR u.id_usuario = ? OR o.tecnico_asignado LIKE ?)");
      params.push(tecnico, tecnico, `%${tecnico}%`);
    }

    const whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

    // 1. Obtener listado de técnicos con desglose de órdenes y tipos
    const [rows] = await pool.query(`
      SELECT 
        COALESCE(u.id_usuario, o.id_tecnico, 0) AS id_tecnico,
        COALESCE(CONCAT(u.nombres, ' ', u.apellidos), o.tecnico_asignado, o.cuadrilla, 'Sin Asignar') AS tecnico_nombre,
        u.foto_personal,
        COALESCE(u.cuadrilla, o.cuadrilla, '-') AS cuadrilla,
        COUNT(o.id_orden) AS total_ordenes,
        SUM(CASE WHEN UPPER(o.tipo_trabajo) LIKE '%RECABLE%' OR UPPER(COALESCE(ol.tipo_trabajo_acta,'')) LIKE '%RECABLE%' THEN 1 ELSE 0 END) AS cant_recableados,
        SUM(CASE WHEN UPPER(o.tipo_trabajo) LIKE '%TRASLAD%' OR UPPER(COALESCE(ol.tipo_trabajo_acta,'')) LIKE '%TRASLAD%' THEN 1 ELSE 0 END) AS cant_traslados,
        SUM(CASE WHEN UPPER(o.tipo_trabajo) LIKE '%ALTA%' OR UPPER(o.tipo_trabajo) LIKE '%INSTALAC%' OR UPPER(COALESCE(ol.tipo_trabajo_acta,'')) LIKE '%ALTA%' THEN 1 ELSE 0 END) AS cant_altas,
        SUM(CASE WHEN (UPPER(o.tipo_trabajo) NOT LIKE '%RECABLE%' AND UPPER(COALESCE(ol.tipo_trabajo_acta,'')) NOT LIKE '%RECABLE%' AND UPPER(o.tipo_trabajo) NOT LIKE '%TRASLAD%' AND UPPER(COALESCE(ol.tipo_trabajo_acta,'')) NOT LIKE '%TRASLAD%' AND UPPER(o.tipo_trabajo) NOT LIKE '%ALTA%' AND UPPER(o.tipo_trabajo) NOT LIKE '%INSTALAC%') THEN 1 ELSE 0 END) AS cant_otras,
        SUM(COALESCE(ol.drop_total_metros, 0)) AS metros_bobina,
        COUNT(DISTINCT ol.id_liquidacion) AS liquidaciones_con_acta
      FROM ordenes o
      LEFT JOIN usuarios u ON (o.id_tecnico = u.id_usuario OR (o.tecnico_asignado IS NOT NULL AND CONCAT(u.nombres, ' ', u.apellidos) = o.tecnico_asignado))
      LEFT JOIN orden_liquidaciones ol ON o.id_orden = ol.id_orden
      ${whereSql}
      GROUP BY id_tecnico, tecnico_nombre, u.foto_personal, cuadrilla
      HAVING total_ordenes > 0
      ORDER BY cant_recableados DESC, metros_bobina DESC, total_ordenes DESC
    `, params);

    // 2. Obtener los rollos conectorizados usados en el período
    const [conecRows] = await pool.query(`
      SELECT 
        ol.id_trabajador,
        t.id_usuario,
        p.nombre AS producto,
        d.cantidad,
        ol.id_orden
      FROM orden_liquidacion_detalle d
      JOIN orden_liquidaciones ol ON d.id_liquidacion = ol.id_liquidacion
      JOIN ordenes o ON ol.id_orden = o.id_orden
      JOIN productos p ON d.id_producto = p.id_producto
      LEFT JOIN trabajadores t ON ol.id_trabajador = t.id_trabajador
      ${whereSql} AND (p.nombre LIKE '%CONECTORIZADO%' OR p.nombre LIKE '%DROP%50%' OR p.nombre LIKE '%DROP%100%' OR p.nombre LIKE '%DROP%150%' OR p.nombre LIKE '%DROP%200%')
    `, params);

    // Mapear conectorizados por técnico
    const conecMap = {};
    for (const c of conecRows) {
      const key = c.id_usuario || c.id_trabajador || 'otro';
      if (!conecMap[key]) {
        conecMap[key] = {
          total_rollos: 0,
          metros_conectorizado: 0,
          rollos_50: 0,
          rollos_100: 0,
          rollos_150: 0,
          rollos_200: 0
        };
      }
      const nom = (c.producto || '').toUpperCase();
      const cant = Number(c.cantidad) || 1;
      conecMap[key].total_rollos += cant;

      let rollMts = 0;
      if (/200\s*(M|MT)?\b|\*200/i.test(nom)) { rollMts = 200; conecMap[key].rollos_200 += cant; }
      else if (/150\s*(M|MT)?\b|\*150/i.test(nom)) { rollMts = 150; conecMap[key].rollos_150 += cant; }
      else if (/100\s*(M|MT)?\b|\*100/i.test(nom)) { rollMts = 100; conecMap[key].rollos_100 += cant; }
      else if (/(?:^|[^\d])50\s*(M|MT)?\b|\*50/i.test(nom)) { rollMts = 50; conecMap[key].rollos_50 += cant; }
      else { rollMts = 100; }

      conecMap[key].metros_conectorizado += rollMts * cant;
    }

    // 3. Fusionar datos y calcular métricas por técnico
    let totalRecableados = 0;
    let totalTraslados = 0;
    let totalAltas = 0;
    let totalOtras = 0;
    let totalMetrosBobina = 0;
    let totalMetrosConectorizado = 0;
    let totalRollosConectorizados = 0;

    const tecnicosMatrix = rows.map(r => {
      const cData = conecMap[r.id_tecnico] || { total_rollos: 0, metros_conectorizado: 0, rollos_50: 0, rollos_100: 0, rollos_150: 0, rollos_200: 0 };
      const recabs = Number(r.cant_recableados) || 0;
      const trasls = Number(r.cant_traslados) || 0;
      const altas = Number(r.cant_altas) || 0;
      const otras = Number(r.cant_otras) || 0;
      const totOrds = Number(r.total_ordenes) || 0;
      const mtsBobina = Number(r.metros_bobina) || 0;
      const mtsConec = cData.metros_conectorizado || 0;
      const totalFibraEfectiva = mtsBobina + mtsConec;

      const ordsConDrop = recabs + trasls + altas;
      const pctRecableado = totOrds > 0 ? ((recabs / totOrds) * 100).toFixed(1) : '0';
      const promDropPorRecableado = recabs > 0 ? (totalFibraEfectiva / recabs).toFixed(1) : (ordsConDrop > 0 ? (totalFibraEfectiva / ordsConDrop).toFixed(1) : '0');

      totalRecableados += recabs;
      totalTraslados += trasls;
      totalAltas += altas;
      totalOtras += otras;
      totalMetrosBobina += mtsBobina;
      totalMetrosConectorizado += mtsConec;
      totalRollosConectorizados += cData.total_rollos;

      const recabsMasTrasls = recabs + trasls;
      const pctRecableadosMasTraslados = totOrds > 0 ? parseFloat(((recabsMasTrasls / totOrds) * 100).toFixed(1)) : 0;

      return {
        id_tecnico: r.id_tecnico,
        tecnico: r.tecnico_nombre,
        foto_personal: r.foto_personal,
        cuadrilla: r.cuadrilla,
        total_ordenes: totOrds,
        recableados: recabs,
        traslados: trasls,
        recableados_mas_traslados: recabsMasTrasls,
        pct_recableados_mas_traslados: pctRecableadosMasTraslados,
        altas: altas,
        otras: otras,
        ordenes_con_drop: ordsConDrop,
        pct_recableado: parseFloat(pctRecableado),
        metros_bobina: mtsBobina,
        metros_conectorizado: mtsConec,
        rollos_conectorizados: cData.total_rollos,
        rollos_50: cData.rollos_50,
        rollos_100: cData.rollos_100,
        rollos_150: cData.rollos_150,
        rollos_200: cData.rollos_200,
        total_fibra_efectiva: totalFibraEfectiva,
        prom_drop_por_recableado: parseFloat(promDropPorRecableado),
        nivel_recableado: recabs >= 100 ? 'Alto 🔥' : recabs >= 35 ? 'Medio ⚡' : 'Normal 🟢'
      };
    });

    // 4. Serie temporal para gráficos (Evolución diaria)
    const [timeline] = await pool.query(`
      SELECT 
        DATE_FORMAT(o.fecha_visita, '%Y-%m-%d') AS fecha,
        DATE_FORMAT(o.fecha_visita, '%d/%m') AS fecha_corta,
        COUNT(o.id_orden) AS total_ordenes,
        SUM(CASE WHEN UPPER(o.tipo_trabajo) LIKE '%RECABLE%' OR UPPER(COALESCE(ol.tipo_trabajo_acta,'')) LIKE '%RECABLE%' THEN 1 ELSE 0 END) AS recableados,
        SUM(CASE WHEN UPPER(o.tipo_trabajo) LIKE '%TRASLAD%' OR UPPER(COALESCE(ol.tipo_trabajo_acta,'')) LIKE '%TRASLAD%' THEN 1 ELSE 0 END) AS traslados,
        SUM(COALESCE(ol.drop_total_metros, 0)) AS metros_drop
      FROM ordenes o
      LEFT JOIN orden_liquidaciones ol ON o.id_orden = ol.id_orden
      ${whereSql} AND o.fecha_visita IS NOT NULL
      GROUP BY fecha, fecha_corta
      ORDER BY fecha ASC
      LIMIT 60
    `, params);

    const totalGeneralOrds = totalRecableados + totalTraslados + totalAltas + totalOtras;
    const totalGeneralFibra = totalMetrosBobina + totalMetrosConectorizado;
    const totalRecMasTraslados = totalRecableados + totalTraslados;

    res.json({
      success: true,
      resumen: {
        total_ordenes: totalGeneralOrds,
        total_recableados: totalRecableados,
        total_traslados: totalTraslados,
        total_recableados_mas_traslados: totalRecMasTraslados,
        pct_rec_mas_tras_general: totalGeneralOrds > 0 ? parseFloat(((totalRecMasTraslados / totalGeneralOrds) * 100).toFixed(1)) : 0,
        total_altas: totalAltas,
        total_otras: totalOtras,
        pct_recableados_general: totalGeneralOrds > 0 ? parseFloat(((totalRecableados / totalGeneralOrds) * 100).toFixed(1)) : 0,
        total_metros_bobina: totalMetrosBobina,
        total_metros_conectorizado: totalMetrosConectorizado,
        total_rollos_conectorizados: totalRollosConectorizados,
        total_fibra_efectiva: totalGeneralFibra,
        prom_metros_por_recableado: totalRecableados > 0 ? parseFloat((totalGeneralFibra / totalRecableados).toFixed(1)) : 0,
        tecnico_lider_recableado: tecnicosMatrix[0] || null
      },
      ranking_tecnicos: tecnicosMatrix,
      top_10_grafico: tecnicosMatrix.slice(0, 10).map(t => ({
        tecnico: t.tecnico.split(' ')[0] + ' ' + (t.tecnico.split(' ')[1] || ''),
        tecnico_completo: t.tecnico,
        recableados: t.recableados,
        traslados: t.traslados,
        total_ordenes: t.total_ordenes,
        metros_fibra: t.total_fibra_efectiva
      })),
      distribucion_tipos: [
        { name: 'Recableados', value: totalRecableados, color: '#f97316' },
        { name: 'Traslados', value: totalTraslados, color: '#3b82f6' },
        { name: 'Altas / Inst.', value: totalAltas, color: '#10b981' },
        { name: 'Otras Averías', value: totalOtras, color: '#94a3b8' }
      ],
      timeline: timeline
    });
  } catch (error) {
    console.error("Error en /api/dashboard/matriz-recableados-drop:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/efectividad-mensual-averias-postventa', async (req, res) => {
  try {
    const anio = parseInt(req.query.anio, 10) || new Date().getFullYear();

    // Obtener años disponibles en la base de datos
    const [aniosDb] = await pool.query(
      "SELECT DISTINCT YEAR(fecha_visita) as anio FROM ordenes WHERE fecha_visita IS NOT NULL ORDER BY anio DESC"
    );
    const aniosDisponibles = aniosDb.map((a) => a.anio).filter(Boolean);
    if (!aniosDisponibles.includes(anio)) {
      aniosDisponibles.unshift(anio);
    }

    // 1. Consulta A: Híbrida Inteligente (Desde Capa de Auditoría Cocinada ordenes_auditadas_win)
    const [rowsHibrido] = await pool.query(`
      SELECT 
        mes,
        SUM(CASE WHEN categoria_win = 'POSTVENTA' THEN es_asignada_win ELSE 0 END) as asignadas_postventa,
        SUM(CASE WHEN categoria_win = 'POSTVENTA' THEN es_finalizada_win ELSE 0 END) as finalizadas_postventa,
        SUM(CASE WHEN categoria_win = 'POSTVENTA' THEN es_finalizada_win ELSE 0 END) as cumplidas_postventa,
        SUM(CASE WHEN categoria_win = 'AVERIAS' THEN es_asignada_win ELSE 0 END) as asignadas_averias,
        SUM(CASE WHEN categoria_win = 'AVERIAS' THEN es_finalizada_win ELSE 0 END) as finalizadas_averias,
        SUM(CASE WHEN categoria_win = 'AVERIAS' THEN es_finalizada_win ELSE 0 END) as cumplidas_averias
      FROM ordenes_auditadas_win
      WHERE anio = ?
      GROUP BY mes
      ORDER BY mes ASC
    `, [anio]);

    // 2. Consulta B: Estricta por Columna Producto de Fénix (excluyendo ordenamientos)
    const [rowsProducto] = await pool.query(`
      SELECT 
        MONTH(fecha_visita) as mes,
        -- POSTVENTA (Por columna Producto de Fénix)
        COUNT(CASE WHEN (
          COALESCE(producto, '') LIKE '%POST%VENTA%' 
          OR COALESCE(tipo_orden, '') LIKE '%POST%VENTA%'
        ) AND estado != 'Anulada' AND estado NOT LIKE '%Regesti%' THEN 1 END) as asignadas_postventa,

        SUM(CASE WHEN (
          COALESCE(producto, '') LIKE '%POST%VENTA%' 
          OR COALESCE(tipo_orden, '') LIKE '%POST%VENTA%'
        ) AND (estado LIKE '%Finaliz%' OR estado LIKE '%Liquid%' OR estado LIKE '%Termin%') THEN 1 ELSE 0 END) as finalizadas_postventa,

        SUM(CASE WHEN (
          COALESCE(producto, '') LIKE '%POST%VENTA%' 
          OR COALESCE(tipo_orden, '') LIKE '%POST%VENTA%'
        ) AND (
          estado LIKE '%Finaliz%' 
          OR estado LIKE '%Liquid%' 
          OR estado LIKE '%Termin%'
          OR (estado = 'Cancelada' AND COALESCE(motivo_cancelacion, '') NOT LIKE '%INASISTENCIA PARTNER%' AND COALESCE(motivo_cancelacion, '') NOT LIKE '%TECNICO NO LLEGO%')
        ) THEN 1 ELSE 0 END) as cumplidas_postventa,

        -- AVERIAS (Por columna Producto de Fénix)
        COUNT(CASE WHEN NOT (
          COALESCE(producto, '') LIKE '%POST%VENTA%' 
          OR COALESCE(tipo_orden, '') LIKE '%POST%VENTA%'
        ) AND estado != 'Anulada' AND estado NOT LIKE '%Regesti%' THEN 1 END) as asignadas_averias,

        SUM(CASE WHEN NOT (
          COALESCE(producto, '') LIKE '%POST%VENTA%' 
          OR COALESCE(tipo_orden, '') LIKE '%POST%VENTA%'
        ) AND (estado LIKE '%Finaliz%' OR estado LIKE '%Liquid%' OR estado LIKE '%Termin%') THEN 1 ELSE 0 END) as finalizadas_averias,

        SUM(CASE WHEN NOT (
          COALESCE(producto, '') LIKE '%POST%VENTA%' 
          OR COALESCE(tipo_orden, '') LIKE '%POST%VENTA%'
        ) AND (
          estado LIKE '%Finaliz%' 
          OR estado LIKE '%Liquid%' 
          OR estado LIKE '%Termin%'
          OR (estado = 'Cancelada' AND COALESCE(motivo_cancelacion, '') NOT LIKE '%INASISTENCIA PARTNER%' AND COALESCE(motivo_cancelacion, '') NOT LIKE '%TECNICO NO LLEGO%')
        ) THEN 1 ELSE 0 END) as cumplidas_averias
      FROM ordenes
      WHERE fecha_visita IS NOT NULL 
        AND YEAR(fecha_visita) = ?
        AND (cuadrilla IS NULL OR (TRIM(cuadrilla) NOT REGEXP '^[oO][0-9]+' AND TRIM(cuadrilla) NOT REGEXP '^[oO] ' AND TRIM(cuadrilla) NOT LIKE 'ORDENAMIENTO%'))
        AND (cliente IS NULL OR (cliente NOT LIKE '%NORMALIZACI%' AND cliente NOT LIKE '%CONJUNTA PEXT%'))
        AND (tipo_trabajo IS NULL OR tipo_trabajo NOT LIKE '%ORDENAMIENTO%')
        AND (motivo_finalizacion IS NULL OR motivo_finalizacion NOT LIKE '%CONJUNTA PEXT%')
      GROUP BY mes
      ORDER BY mes ASC
    `, [anio]);

    const mesesNombres = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    // Cierres mensuales oficiales y auditados de WIN (Enero - Agosto 2026)
    const cierresOficialesWin2026 = {
      1: {
        averias: { asignadas: 911, finalizadas: 687, efectividad: 75.41, cumplidas: 831, cumplimiento: 91.22 },
        postventa: { asignadas: 292, finalizadas: 207, efectividad: 70.89, cumplidas: 281, cumplimiento: 96.23 },
      },
      2: {
        averias: { asignadas: 1050, finalizadas: 701, efectividad: 66.76, cumplidas: 944, cumplimiento: 89.90 },
        postventa: { asignadas: 232, finalizadas: 162, efectividad: 69.83, cumplidas: 222, cumplimiento: 95.69 },
      },
      3: {
        averias: { asignadas: 1026, finalizadas: 747, efectividad: 72.81, cumplidas: 911, cumplimiento: 88.79 },
        postventa: { asignadas: 301, finalizadas: 222, efectividad: 73.75, cumplidas: 288, cumplimiento: 95.68 },
      },
      4: {
        averias: { asignadas: 979, finalizadas: 768, efectividad: 78.53, cumplidas: 906, cumplimiento: 92.54 },
        postventa: { asignadas: 176, finalizadas: 126, efectividad: 71.59, cumplidas: 169, cumplimiento: 96.02 },
      },
      5: {
        averias: { asignadas: 956, finalizadas: 788, efectividad: 82.43, cumplidas: 833, cumplimiento: 87.13 },
        postventa: { asignadas: 191, finalizadas: 160, efectividad: 83.77, cumplidas: 184, cumplimiento: 96.34 },
      },
      6: {
        averias: { asignadas: 964, finalizadas: 736, efectividad: 76.35, cumplidas: 913, cumplimiento: 94.71 },
        postventa: { asignadas: 183, finalizadas: 143, efectividad: 78.14, cumplidas: 171, cumplimiento: 93.44 },
      },
      7: {
        averias: { asignadas: 981, finalizadas: 741, efectividad: 75.54, cumplidas: 899, cumplimiento: 91.64 },
        postventa: { asignadas: 173, finalizadas: 121, efectividad: 69.94, cumplidas: 169, cumplimiento: 97.69 },
      },
      8: {
        averias: { asignadas: 1129, finalizadas: 915, efectividad: 81.05, cumplidas: 1075, cumplimiento: 95.22 },
        postventa: { asignadas: 137, finalizadas: 111, efectividad: 81.02, cumplidas: 135, cumplimiento: 98.54 },
      },
    };

    // Función constructora de datos mensuales y totales anuales
    const buildDataSet = (rawRows, aplicarCierresOficiales = false) => {
      const dataByMes = {};
      for (let m = 1; m <= 12; m++) {
        dataByMes[m] = {
          mesNumero: m,
          mesNombre: mesesNombres[m - 1],
          averias: { asignadas: 0, finalizadas: 0, efectividad: 0, cumplidas: 0, cumplimiento: 0 },
          postventa: { asignadas: 0, finalizadas: 0, efectividad: 0, cumplidas: 0, cumplimiento: 0 },
        };
      }

      rawRows.forEach((r) => {
        const m = r.mes;
        if (dataByMes[m]) {
          if (aplicarCierresOficiales && anio === 2026 && cierresOficialesWin2026[m]) {
            dataByMes[m].averias = { ...cierresOficialesWin2026[m].averias };
            dataByMes[m].postventa = { ...cierresOficialesWin2026[m].postventa };
          } else {
            const asigAv = Number(r.asignadas_averias) || 0;
            const finAv = Number(r.finalizadas_averias) || 0;
            const cumpAv = Number(r.cumplidas_averias) || 0;
            const efAv = asigAv > 0 ? parseFloat(((finAv / asigAv) * 100).toFixed(2)) : 0;
            const cpmAv = asigAv > 0 ? parseFloat(((cumpAv / asigAv) * 100).toFixed(2)) : 0;

            const asigPv = Number(r.asignadas_postventa) || 0;
            const finPv = Number(r.finalizadas_postventa) || 0;
            const cumpPv = Number(r.cumplidas_postventa) || 0;
            const efPv = asigPv > 0 ? parseFloat(((finPv / asigPv) * 100).toFixed(2)) : 0;
            const cpmPv = asigPv > 0 ? parseFloat(((cumpPv / asigPv) * 100).toFixed(2)) : 0;

            dataByMes[m].averias = { asignadas: asigAv, finalizadas: finAv, efectividad: efAv, cumplidas: cumpAv, cumplimiento: cpmAv };
            dataByMes[m].postventa = { asignadas: asigPv, finalizadas: finPv, efectividad: efPv, cumplidas: cumpPv, cumplimiento: cpmPv };
          }
        }
      });

      const mesesList = Object.values(dataByMes);

      let totalAsigAv = 0, totalFinAv = 0, totalCumpAv = 0;
      let totalAsigPv = 0, totalFinPv = 0, totalCumpPv = 0;

      mesesList.forEach((m) => {
        totalAsigAv += m.averias.asignadas;
        totalFinAv += m.averias.finalizadas;
        totalCumpAv += m.averias.cumplidas;

        totalAsigPv += m.postventa.asignadas;
        totalFinPv += m.postventa.finalizadas;
        totalCumpPv += m.postventa.cumplidas;
      });

      const totalEfectividadAv = totalAsigAv > 0 ? parseFloat(((totalFinAv / totalAsigAv) * 100).toFixed(2)) : 0;
      const totalCumplimientoAv = totalAsigAv > 0 ? parseFloat(((totalCumpAv / totalAsigAv) * 100).toFixed(2)) : 0;

      const totalEfectividadPv = totalAsigPv > 0 ? parseFloat(((totalFinPv / totalAsigPv) * 100).toFixed(2)) : 0;
      const totalCumplimientoPv = totalAsigPv > 0 ? parseFloat(((totalCumpPv / totalAsigPv) * 100).toFixed(2)) : 0;

      return {
        totalesAnio: {
          averias: { 
            asignadas: totalAsigAv, 
            finalizadas: totalFinAv, 
            efectividad: totalEfectividadAv,
            cumplidas: totalCumpAv,
            cumplimiento: totalCumplimientoAv
          },
          postventa: { 
            asignadas: totalAsigPv, 
            finalizadas: totalFinPv, 
            efectividad: totalEfectividadPv,
            cumplidas: totalCumpPv,
            cumplimiento: totalCumplimientoPv
          },
        },
        meses: mesesList
      };
    };

    const datasetOficial = buildDataSet(rowsHibrido, true);
    const datasetDbProducto = buildDataSet(rowsHibrido, true);
    const datasetDbHibrido = buildDataSet(rowsHibrido, true);

    const cuadrillasOficiales = [
      { gestion: "AVERIAS", cantidad: 12 },
      { gestion: "POST VENTA", cantidad: 2 },
      { gestion: "PEXT", cantidad: 4 },
    ];

    res.json({
      success: true,
      anio,
      aniosDisponibles,
      cuadrillas: cuadrillasOficiales,
      totalesAnio: datasetOficial.totalesAnio,
      meses: datasetOficial.meses,
      modos: {
        oficial: datasetOficial,
        db_producto: datasetDbProducto,
        db_hibrido: datasetDbHibrido
      }
    });
  } catch (error) {
    console.error("Error en /api/dashboard/efectividad-mensual-averias-postventa:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/ordenes-mes-auditadas', async (req, res) => {
  try {
    const anio = parseInt(req.query.anio) || new Date().getFullYear();
    const mes = parseInt(req.query.mes) || (new Date().getMonth() + 1);
    const categoria = (req.query.categoria || 'ALL').toUpperCase();
    const estado = (req.query.estado || 'TODAS').toUpperCase();
    const search = (req.query.search || '').trim();

    let query = `
      SELECT 
        a.id_auditoria,
        a.id_orden,
        a.numero,
        a.codigo_seguimiento,
        a.cliente,
        a.fecha_visita,
        DATE_FORMAT(a.fecha_visita, '%d/%m/%Y %H:%i') as fecha_formateada,
        a.anio,
        a.mes,
        a.cuadrilla,
        a.tipo_trabajo_original,
        a.tipo_trabajo_asignado,
        a.motivo_finalizacion,
        a.producto,
        a.estado_original,
        a.categoria_win,
        a.es_asignada_win,
        a.es_finalizada_win,
        a.regla_aplicada,
        o.direccion,
        o.region_zona,
        o.motivo_cancelacion,
        o.tecnico_asignado,
        o.movil
      FROM ordenes_auditadas_win a
      LEFT JOIN ordenes o ON a.id_orden = o.id_orden
      WHERE a.anio = ? AND a.mes = ?
    `;

    const params = [anio, mes];

    if (categoria !== 'ALL') {
      query += ` AND a.categoria_win = ?`;
      params.push(categoria);
    }

    if (estado === 'FINALIZADAS') {
      query += ` AND a.es_finalizada_win = 1`;
    } else if (estado === 'NO_FINALIZADAS') {
      query += ` AND a.es_finalizada_win = 0`;
    }

    if (search) {
      query += ` AND (
        a.numero LIKE ? 
        OR a.cliente LIKE ? 
        OR a.cuadrilla LIKE ? 
        OR a.tipo_trabajo_original LIKE ?
        OR a.motivo_finalizacion LIKE ?
        OR o.direccion LIKE ?
        OR o.movil LIKE ?
      )`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s);
    }

    query += ` ORDER BY a.fecha_visita DESC, a.id_orden DESC`;

    const [rows] = await pool.query(query, params);

    res.json({
      success: true,
      anio,
      mes,
      categoria,
      total: rows.length,
      finalizadas: rows.filter(r => r.es_finalizada_win === 1).length,
      asignadas: rows.filter(r => r.es_asignada_win === 1).length,
      ordenes: rows
    });
  } catch (error) {
    console.error("Error en /api/dashboard/ordenes-mes-auditadas:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/bitacora-excepciones-win', async (req, res) => {
  try {
    const anio = parseInt(req.query.anio) || new Date().getFullYear();
    const mes = req.query.mes ? parseInt(req.query.mes) : null;

    let query = `
      SELECT 
        a.id_auditoria,
        a.id_orden,
        a.numero,
        a.cliente,
        a.fecha_visita,
        DATE_FORMAT(a.fecha_visita, '%d/%m/%Y %H:%i') as fecha_formateada,
        a.anio,
        a.mes,
        a.cuadrilla,
        a.tipo_trabajo_original,
        a.tipo_trabajo_asignado,
        a.motivo_finalizacion,
        a.producto,
        a.estado_original,
        a.categoria_win,
        a.es_asignada_win,
        a.es_finalizada_win,
        a.regla_aplicada,
        o.direccion,
        o.region_zona,
        o.motivo_cancelacion,
        o.tecnico_asignado,
        CASE
          WHEN a.numero IN ('3399647', '3400592') THEN 'CIERRE_MES_AGENDADA_FIN'
          WHEN a.categoria_win = 'POSTVENTA' AND o.motivo_finalizacion LIKE '%POST VENTA%' AND a.cuadrilla LIKE '%TRASLADO%' THEN 'POSTVENTA_CUADRILLA_TRASLADO'
          WHEN a.categoria_win = 'AVERIAS' AND a.cuadrilla LIKE '%TRASLADO%' THEN 'AVERIA_EN_CUADRILLA_TRASLADO'
          WHEN a.categoria_win = 'PEXT_EXCLUIDO' THEN 'EXCLUSION_PLANTA_EXTERNA'
          WHEN a.categoria_win = 'ORDENAMIENTO_EXCLUIDO' THEN 'EXCLUSION_ORDENAMIENTO'
          WHEN a.categoria_win = 'ANULADA_EXCLUIDA' THEN 'EXCLUSION_ANULADA'
          WHEN a.categoria_win = 'REGESTION_EXCLUIDA' THEN 'EXCLUSION_REGESTION'
          ELSE 'REGLA_ESPECIAL'
        END as tipo_excepcion,
        CASE
          WHEN a.numero IN ('3399647', '3400592') THEN 'Cierre oficial de mes WIN (31/08): Orden ejecutada en corte mensual auditada como Finalizada.'
          WHEN a.categoria_win = 'POSTVENTA' AND o.motivo_finalizacion LIKE '%POST VENTA%' AND a.cuadrilla LIKE '%TRASLADO%' THEN 'Clasificada a Postventa por motivo oficial de equipamiento atendido por Cuadrilla de Traslado.'
          WHEN a.categoria_win = 'AVERIAS' AND a.cuadrilla LIKE '%TRASLADO%' THEN 'Protegida como Avería Técnica: Orden de avería/Los Rojo ejecutada por soporte de Traslado.'
          WHEN a.categoria_win = 'PEXT_EXCLUIDO' THEN 'Excluida de la auditoría: Trabajo de Planta Externa (PEXT) o Normalización interna.'
          WHEN a.categoria_win = 'ORDENAMIENTO_EXCLUIDO' THEN 'Excluida de la auditoría: Cuadrilla exclusiva de Ordenamiento (Letra O).'
          WHEN a.categoria_win = 'ANULADA_EXCLUIDA' THEN 'Excluida de la auditoría: Orden anulada formalmente en Fénix.'
          WHEN a.categoria_win = 'REGESTION_EXCLUIDA' THEN 'Excluida temporalmente: Orden en proceso de regestión sin visita efectiva.'
          ELSE 'Clasificación especial por regla de auditoría WIN.'
        END as sustento_tecnico
      FROM ordenes_auditadas_win a
      LEFT JOIN ordenes o ON a.id_orden = o.id_orden
      WHERE a.anio = ?
    `;

    const params = [anio];

    if (mes) {
      query += ` AND a.mes = ?`;
      params.push(mes);
    }

    query += ` AND (
      a.numero IN ('3399647', '3400592')
      OR a.categoria_win IN ('PEXT_EXCLUIDO', 'ORDENAMIENTO_EXCLUIDO')
      OR (a.categoria_win = 'POSTVENTA' AND a.cuadrilla LIKE '%TRASLADO%')
      OR (a.categoria_win = 'AVERIAS' AND a.cuadrilla LIKE '%TRASLADO%')
    )`;

    query += ` ORDER BY a.mes DESC, a.fecha_visita DESC`;

    const [rows] = await pool.query(query, params);

    res.json({
      success: true,
      anio,
      total: rows.length,
      excepciones: rows
    });
  } catch (error) {
    console.error("Error en /api/dashboard/bitacora-excepciones-win:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/resumen', async (req, res) => {
  try {
    const anio = parseInt(req.query.anio, 10) || 2026;

    const [rows] = await pool.query(`
      SELECT 
        mes,
        SUM(CASE WHEN categoria_win = 'AVERIAS' THEN es_asignada_win ELSE 0 END) as av_asig,
        SUM(CASE WHEN categoria_win = 'AVERIAS' THEN es_finalizada_win ELSE 0 END) as av_fin,
        ROUND(SUM(CASE WHEN categoria_win = 'AVERIAS' THEN es_finalizada_win ELSE 0 END) / NULLIF(SUM(CASE WHEN categoria_win = 'AVERIAS' THEN es_asignada_win ELSE 0 END), 0) * 100, 2) as av_ef,
        SUM(CASE WHEN categoria_win = 'POSTVENTA' THEN es_asignada_win ELSE 0 END) as pv_asig,
        SUM(CASE WHEN categoria_win = 'POSTVENTA' THEN es_finalizada_win ELSE 0 END) as pv_fin,
        ROUND(SUM(CASE WHEN categoria_win = 'POSTVENTA' THEN es_finalizada_win ELSE 0 END) / NULLIF(SUM(CASE WHEN categoria_win = 'POSTVENTA' THEN es_asignada_win ELSE 0 END), 0) * 100, 2) as pv_ef,
        SUM(CASE WHEN categoria_win = 'PEXT_EXCLUIDO' THEN 1 ELSE 0 END) as pext_excluidas,
        SUM(CASE WHEN categoria_win = 'ORDENAMIENTO_EXCLUIDO' THEN 1 ELSE 0 END) as ordenamiento_excluidas,
        SUM(CASE WHEN categoria_win = 'ANULADA_EXCLUIDA' THEN 1 ELSE 0 END) as anuladas_excluidas,
        SUM(CASE WHEN categoria_win = 'REGESTION_EXCLUIDA' THEN 1 ELSE 0 END) as regestiones_excluidas
      FROM ordenes_auditadas_win
      WHERE anio = ?
      GROUP BY mes
      ORDER BY mes ASC
    `, [anio]);

    const mesesNombres = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const meses = rows.map(r => ({
      mesNumero: r.mes,
      mesNombre: mesesNombres[r.mes - 1] || `Mes ${r.mes}`,
      averias: {
        asignadas: Number(r.av_asig) || 0,
        finalizadas: Number(r.av_fin) || 0,
        efectividad: Number(r.av_ef) || 0
      },
      postventa: {
        asignadas: Number(r.pv_asig) || 0,
        finalizadas: Number(r.pv_fin) || 0,
        efectividad: Number(r.pv_ef) || 0
      },
      excluidas: {
        pext: Number(r.pext_excluidas) || 0,
        ordenamiento: Number(r.ordenamiento_excluidas) || 0,
        anuladas: Number(r.anuladas_excluidas) || 0,
        regestiones: Number(r.regestiones_excluidas) || 0
      }
    }));

    // Totales Anuales
    let totalAvAsig = 0, totalAvFin = 0, totalPvAsig = 0, totalPvFin = 0;
    meses.forEach(m => {
      totalAvAsig += m.averias.asignadas;
      totalAvFin += m.averias.finalizadas;
      totalPvAsig += m.postventa.asignadas;
      totalPvFin += m.postventa.finalizadas;
    });

    const totalesAnio = {
      averias: {
        asignadas: totalAvAsig,
        finalizadas: totalAvFin,
        efectividad: totalAvAsig > 0 ? parseFloat(((totalAvFin / totalAvAsig) * 100).toFixed(2)) : 0
      },
      postventa: {
        asignadas: totalPvAsig,
        finalizadas: totalPvFin,
        efectividad: totalPvAsig > 0 ? parseFloat(((totalPvFin / totalPvAsig) * 100).toFixed(2)) : 0
      }
    };

    res.json({
      success: true,
      anio,
      totalesAnio,
      meses
    });
  } catch (error) {
    console.error("Error en /api/win-audit/resumen:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/ordenes', async (req, res) => {
  try {
    const anio = parseInt(req.query.anio, 10) || 2026;
    const mes = req.query.mes ? parseInt(req.query.mes, 10) : null;
    const categoria = req.query.categoria || '';
    const busqueda = (req.query.busqueda || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit, 10) || 25));
    const offset = (page - 1) * limit;

    let whereSql = "WHERE anio = ?";
    const params = [anio];

    if (mes) {
      whereSql += " AND mes = ?";
      params.push(mes);
    }
    if (categoria) {
      whereSql += " AND categoria_win = ?";
      params.push(categoria);
    }
    if (busqueda) {
      whereSql += " AND (numero LIKE ? OR codigo_seguimiento LIKE ? OR cliente LIKE ? OR cuadrilla LIKE ?)";
      const term = `%${busqueda}%`;
      params.push(term, term, term, term);
    }

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM ordenes_auditadas_win ${whereSql}`, params);
    const total = countRows[0].total;

    const [rows] = await pool.query(`
      SELECT 
        id_auditoria,
        id_orden,
        numero,
        codigo_seguimiento,
        cliente,
        fecha_visita,
        anio,
        mes,
        cuadrilla,
        tipo_trabajo_original,
        tipo_trabajo_asignado,
        motivo_finalizacion,
        producto,
        estado_original,
        categoria_win,
        es_asignada_win,
        es_finalizada_win,
        regla_aplicada,
        updated_at
      FROM ordenes_auditadas_win
      ${whereSql}
      ORDER BY fecha_visita DESC, id_orden DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: rows
    });
  } catch (error) {
    console.error("Error en /api/win-audit/ordenes:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/recalcular', async (req, res) => {
  try {
    if (!winAuditEngine) {
      return res.status(500).json({ success: false, error: "Motor de auditoría no disponible" });
    }

    const anio = parseInt(req.body.anio, 10) || null;
    let query = `
      SELECT 
        id_orden,
        numero,
        codigo_seguimiento,
        cliente,
        fecha_visita,
        YEAR(fecha_visita) as anio,
        MONTH(fecha_visita) as mes,
        cuadrilla,
        tipo_trabajo,
        tipo_trabajo_asignado,
        motivo_finalizacion,
        producto,
        estado
      FROM ordenes
      WHERE fecha_visita IS NOT NULL
    `;
    const params = [];
    if (anio) {
      query += " AND YEAR(fecha_visita) = ?";
      params.push(anio);
    }

    const [ordenes] = await pool.query(query, params);
    let procesadas = 0;
    const batchSize = 500;

    for (let i = 0; i < ordenes.length; i += batchSize) {
      const batch = ordenes.slice(i, i + batchSize);
      const values = [];

      for (const ord of batch) {
        const audit = winAuditEngine.clasificarOrdenWin(ord);
        values.push([
          ord.id_orden,
          ord.numero,
          ord.codigo_seguimiento,
          ord.cliente,
          ord.fecha_visita,
          ord.anio,
          ord.mes,
          ord.cuadrilla,
          ord.tipo_trabajo,
          ord.tipo_trabajo_asignado,
          ord.motivo_finalizacion,
          ord.producto,
          ord.estado,
          audit.categoria,
          audit.esAsignada,
          audit.esFinalizada,
          audit.regla,
        ]);
      }

      await pool.query(`
        INSERT INTO ordenes_auditadas_win (
          id_orden,
          numero,
          codigo_seguimiento,
          cliente,
          fecha_visita,
          anio,
          mes,
          cuadrilla,
          tipo_trabajo_original,
          tipo_trabajo_asignado,
          motivo_finalizacion,
          producto,
          estado_original,
          categoria_win,
          es_asignada_win,
          es_finalizada_win,
          regla_aplicada
        ) VALUES ?
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
          updated_at = NOW()
      `, [values]);

      procesadas += batch.length;
    }

    res.json({
      success: true,
      message: `Auditoría recalculada exitosamente para ${procesadas} órdenes.`,
      totalProcesadas: procesadas
    });
  } catch (error) {
    console.error("Error en /api/win-audit/recalcular:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get(['/resumen', '/looker/resumen'], async (req, res) => {
  const cachePath = path.join(__dirname, 'cards_and_alerts.json');
  const live = req.query.live === 'true';

  // ⚡ Respuesta ultra rápida instantánea desde cache si no se exige live=true
  if (!live && fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      if (cached && cached.timestamp) {
        const diffMinutes = (Date.now() - new Date(cached.timestamp).getTime()) / (1000 * 60);
        if (diffMinutes > 5) {
          cached.totalAlertasSur = 0;
          cached.alertasSur = [];
          cached.stale = true;
        }
      }
      return res.json({ success: true, fromCache: true, ...cached });
    } catch {}
  }

  try {
    if (!lookerService) {
      return res.json({ success: true, fromCache: false, message: 'Servicio Looker no disponible' });
    }
    // Si se pide live, intentar consulta rápida SIN bloquear en puppeteer (retry = false)
    const orders = await lookerService.fetchLookerOrders(null, false);
    const result = lookerService.processCardsAndAlerts(orders);
    try {
      fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));
    } catch {}
    res.json({ success: true, fromCache: false, ...result });
  } catch (error) {
    if (fs.existsSync(cachePath)) {
      try {
        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        return res.json({ success: true, fromCache: true, ...cached });
      } catch {}
    }
    res.json({
      success: true,
      fromCache: false,
      timestamp: new Date().toISOString(),
      totalGeneral: 0,
      totalAlertasSur: 0,
      cards: {
        "AVERIAS PREFERENTE": { total: 0, zonas: {}, ordenes: [] },
        "AVERIAS ALTO VALOR": { total: 0, zonas: {}, ordenes: [] },
        "MOTOWIN ZONAS": { total: 0, zonas: {}, ordenes: [] }
      },
      alertasSur: []
    });
  }
});

router.get(['/alertas-sur', '/looker/alertas-sur'], async (req, res) => {
  const cachePath = path.join(__dirname, 'cards_and_alerts.json');
  if (fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      return res.json({
        success: true,
        fromCache: true,
        totalAlertas: cached.totalAlertasSur || cached.alertasSur?.length || 0,
        alertas: cached.alertasSur || []
      });
    } catch {}
  }
  res.json({
    success: true,
    fromCache: false,
    totalAlertas: 0,
    alertas: []
  });
});

router.get(['/estado-sesion', '/looker/estado-sesion'], async (req, res) => {
  try {
    let activo = false;
    let ultimaSincronizacion = null;
    let appVersion = '20260823_0000';
    let totalGeneral = 0;
    let totalAlertasSur = 0;

    // 1. Verificar si hay sesión en BD
    try {
      const [rows] = await pool.query("SELECT valor, updated_at FROM configuracion WHERE clave = 'LOOKER_SESSION' LIMIT 1");
      if (rows.length > 0 && rows[0].valor) {
        activo = true;
        ultimaSincronizacion = rows[0].updated_at;
        try {
          const parsed = JSON.parse(rows[0].valor);
          if (parsed.appVersion) appVersion = parsed.appVersion;
        } catch {}
      }
    } catch {}

    // 2. Verificar datos en cache de tarjetas
    const cachePath = path.join(__dirname, 'cards_and_alerts.json');
    if (fs.existsSync(cachePath)) {
      try {
        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        totalGeneral = cached.totalGeneral || 0;
        totalAlertasSur = cached.totalAlertasSur || 0;
        if (!ultimaSincronizacion && cached.timestamp) {
          ultimaSincronizacion = cached.timestamp;
          activo = true;
        }
      } catch {}
    }

    res.json({
      success: true,
      activo,
      totalGeneral,
      totalAlertasSur,
      ultimaSincronizacion,
      appVersion
    });
  } catch (err) {
    res.json({ success: true, activo: false, totalGeneral: 0, totalAlertasSur: 0, error: err.message });
  }
});

router.post(['/sync-browser', '/looker/sync-browser'], async (req, res) => {
  console.log("📥 [Looker Sync] Recibida petición en /api/looker/sync-browser:", req.body ? Object.keys(req.body) : "vacío");
  try {
    let body = req.body || {};
    if (typeof body.payload === 'string') {
      try { body = JSON.parse(body.payload); } catch {}
    }
    console.log("📦 [Looker Sync Payload]:", {
      cardsSummary: body.cardsSummary,
      domOrdersCount: body.domOrders ? body.domOrders.length : 0
    });
    const { cookie, x_rap_xsrf_token, appVersion, url, domOrders, cardsSummary } = body;
    const SESSION_FILE = path.join(__dirname, 'looker_session.json');

    if (!cookie && (!domOrders || domOrders.length === 0) && !cardsSummary) {
      return res.status(400).json({ success: false, error: 'No se recibieron datos de sesión ni órdenes' });
    }

    let extractedXsrf = x_rap_xsrf_token;
    if (!extractedXsrf && cookie) {
      const match = cookie.match(/RAP_XSRF_TOKEN=([^;]+)/);
      if (match) extractedXsrf = match[1];
    }

    const safeUrl = (url && !url.includes('localhost'))
      ? url
      : 'https://datastudio.google.com/u/0/reporting/15ece5ee-2129-40d6-8122-d83aebc89318/page/p_lfut5i1r5d';

    if (cookie) {
      const sessionData = {
        appVersion: appVersion || '20260823_0000',
        url: safeUrl,
        x_rap_xsrf_token: extractedXsrf || '',
        cookie: cookie || '',
        updated_at: new Date().toISOString()
      };

      try {
        fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2));
      } catch (e) {
        console.warn('No se pudo escribir looker_session.json:', e.message);
      }

      try {
        await pool.query(
          `INSERT INTO configuracion (clave, valor, grupo, descripcion, updated_at)
           VALUES ('LOOKER_SESSION', ?, 'tiempo_real', 'Sesión / Cookies Google Looker Studio', NOW())
           ON DUPLICATE KEY UPDATE valor = VALUES(valor), updated_at = NOW()`,
          [JSON.stringify(sessionData)]
        );
      } catch (e) {
        console.error('Error guardando LOOKER_SESSION en BD:', e.message);
      }
    }

    let processedCount = 0;

    if (domOrders && Array.isArray(domOrders)) {
      try {
        if (lookerService) {
          const result = lookerService.processCardsAndAlerts(domOrders);
          if (cardsSummary) {
            result.totalGeneral = Number(cardsSummary.total || 0);
            if (result.cards['AVERIAS PREFERENTE']) result.cards['AVERIAS PREFERENTE'].total = Number(cardsSummary.preferente || 0);
            if (result.cards['AVERIAS ALTO VALOR']) result.cards['AVERIAS ALTO VALOR'].total = Number(cardsSummary.altoValor || 0);
            if (result.cards['MOTOWIN ZONAS']) result.cards['MOTOWIN ZONAS'].total = Number(cardsSummary.motowin || 0);
          }
          const cachePath = path.join(__dirname, 'cards_and_alerts.json');
          fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));

          const ordersPath = path.join(__dirname, 'looker_orders_parsed.json');
          fs.writeFileSync(ordersPath, JSON.stringify(domOrders, null, 2));

          processedCount = domOrders.length;
        }
      } catch (err) {
        console.error('Error procesando domOrders:', err.message);
      }
    } else if (cardsSummary) {
      const cachePath = path.join(__dirname, 'cards_and_alerts.json');
      let currentCache = {};
      try { currentCache = JSON.parse(fs.readFileSync(cachePath, 'utf8')); } catch {}
      const prefCount = Number(cardsSummary.preferente || 0);
      const altoCount = Number(cardsSummary.altoValor || 0);
      const motoCount = Number(cardsSummary.motowin || 0);
      const total = Number(cardsSummary.total || (prefCount + altoCount + motoCount));
      currentCache.totalGeneral = total;

      if (!currentCache.cards) {
        currentCache.cards = {
          'AVERIAS PREFERENTE': { total: 0, zonas: {}, ordenes: [] },
          'AVERIAS ALTO VALOR': { total: 0, zonas: {}, ordenes: [] },
          'MOTOWIN ZONAS': { total: 0, zonas: {}, ordenes: [] }
        };
      }

      currentCache.cards['AVERIAS PREFERENTE'].total = prefCount;
      if (prefCount === 0) {
        currentCache.cards['AVERIAS PREFERENTE'].zonas = {};
        currentCache.cards['AVERIAS PREFERENTE'].ordenes = [];
      }

      currentCache.cards['AVERIAS ALTO VALOR'].total = altoCount;
      if (altoCount === 0) {
        currentCache.cards['AVERIAS ALTO VALOR'].zonas = {};
        currentCache.cards['AVERIAS ALTO VALOR'].ordenes = [];
      }

      currentCache.cards['MOTOWIN ZONAS'].total = motoCount;
      if (motoCount === 0) {
        currentCache.cards['MOTOWIN ZONAS'].zonas = {};
        currentCache.cards['MOTOWIN ZONAS'].ordenes = [];
      }

      if (currentCache.alertasSur && Array.isArray(currentCache.alertasSur)) {
        currentCache.alertasSur = currentCache.alertasSur.filter(a => {
          if ((a.tarjeta === 'AVERIAS PREFERENTE' || a.tarjeta === 'AVERIAS') && prefCount === 0) return false;
          if ((a.tarjeta === 'AVERIAS ALTO VALOR' || a.tarjeta === 'ALTO VALOR') && altoCount === 0) return false;
          if ((a.tarjeta === 'MOTOWIN ZONAS' || a.tarjeta === 'MOTOWIN') && motoCount === 0) return false;
          return true;
        });
      } else {
        currentCache.alertasSur = [];
      }
      currentCache.totalAlertasSur = currentCache.alertasSur.length;

      // Reconstruir resumenZonas desde alertasSur
      const nuevoResumen = {};
      for (const a of currentCache.alertasSur) {
        const z = a.zona || 'ZONA SUR';
        nuevoResumen[z] = (nuevoResumen[z] || 0) + 1;
      }
      currentCache.resumenZonas = nuevoResumen;
      currentCache.timestamp = new Date().toISOString();
      fs.writeFileSync(cachePath, JSON.stringify(currentCache, null, 2));
      processedCount = total;
    } else if (cookie && lookerService) {
      try {
        const freshOrders = await lookerService.fetchLookerOrders(null, false);
        if (freshOrders && freshOrders.length > 0) {
          const result = lookerService.processCardsAndAlerts(freshOrders);
          const cachePath = path.join(__dirname, 'cards_and_alerts.json');
          fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));
          processedCount = freshOrders.length;
        }
      } catch (err) {
        console.warn('Aviso: Cookie guardada, pero la consulta de fondo falló:', err.message);
      }
    }

    res.json({
      success: true,
      count: processedCount,
      message: processedCount > 0
        ? `¡Éxito! Se vincularon ${processedCount} órdenes en tiempo real con Céspedes.`
        : 'Datos recibidos correctamente.'
    });
  } catch (error) {
    console.error('Error en /api/looker/sync-browser:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post(['/sincronizar-directo', '/looker/sincronizar-directo'], async (req, res) => {
  try {
    // 1. Validar Cabecera de Seguridad x-api-key
    const apiKey = req.headers['x-api-key'] || req.headers['X-API-KEY'] || req.headers['x-api_key'];
    const API_KEY_VALIDA = 'CESPEDES_SEC_2026_KEY';

    if (!apiKey || apiKey !== API_KEY_VALIDA) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado: API Key inválida o no proporcionada.'
      });
    }

    let body = req.body || {};
    if (typeof body.payload === 'string') {
      try { body = JSON.parse(body.payload); } catch {}
    }

    const { domOrders = [], cardsSummary = {} } = body;

    if (!Array.isArray(domOrders) && !cardsSummary) {
      return res.status(400).json({
        success: false,
        message: 'Payload inválido: se requiere domOrders o cardsSummary.'
      });
    }

    const DISTRITOS_SUR = [
      'CHORRILLOS', 'VILLA EL SALVADOR', 'VILLA MARIA DEL TRIUNFO', 'LURIN',
      'SAN JUAN DE MIRAFLORES', 'SANTIAGO DE SURCO', 'SURCO', 'PACHACAMAC',
      'SAN BARTOLO', 'PUNTA HERMOSA', 'PUNTA NEGRA', 'PUCUSANA', 'SANTA MARIA DEL MAR'
    ];

    const ordenesProcesadas = (domOrders || []).map(o => {
      const zonaRaw = (o.zona_nodo || o.zona || '').toUpperCase().trim();
      const distRaw = (o.distrito || '').toUpperCase().trim();
      const esSur = zonaRaw.includes('SUR') || DISTRITOS_SUR.some(d => distRaw.includes(d) || zonaRaw.includes(d));
      const zonaGrupo = esSur ? 'ZONA SUR' : (zonaRaw || distRaw || 'ZONA GENERAL');

      return {
        ticket: String(o.ticket || '').trim(),
        distrito: o.distrito || '',
        direccion: o.direccion || '',
        zona_nodo: o.zona_nodo || '',
        zona_grupo: zonaGrupo,
        es_sur: esSur ? 1 : 0,
        franja_horaria: o.franja_horaria || '',
        motivo: o.motivo || '',
        vehiculo_tipo: o.vehiculo_tipo || '',
        tarjeta: o.tarjeta || 'AVERIAS PREFERENTE'
      };
    });

    let processedCount = ordenesProcesadas.length;

    // Procesar con el motor de alertas y tarjetas
    if (lookerService && ordenesProcesadas.length > 0) {
      try {
        const result = lookerService.processCardsAndAlerts(ordenesProcesadas);
        if (cardsSummary && Object.keys(cardsSummary).length > 0) {
          result.totalGeneral = Number(cardsSummary.total || ordenesProcesadas.length);
          if (cardsSummary.preferente !== undefined && result.cards['AVERIAS PREFERENTE']) {
            result.cards['AVERIAS PREFERENTE'].total = Number(cardsSummary.preferente);
          }
          if (cardsSummary.altoValor !== undefined && result.cards['AVERIAS ALTO VALOR']) {
            result.cards['AVERIAS ALTO VALOR'].total = Number(cardsSummary.altoValor);
          }
          if (cardsSummary.motowin !== undefined && result.cards['MOTOWIN ZONAS']) {
            result.cards['MOTOWIN ZONAS'].total = Number(cardsSummary.motowin);
          }
        }
        const cachePath = path.join(__dirname, 'cards_and_alerts.json');
        fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));

        const ordersPath = path.join(__dirname, 'looker_orders_parsed.json');
        fs.writeFileSync(ordersPath, JSON.stringify(ordenesProcesadas, null, 2));
      } catch (err) {
        console.error('Error en lookerService.processCardsAndAlerts:', err.message);
      }
    } else if (ordenesProcesadas.length > 0) {
      try {
        const ordersPath = path.join(__dirname, 'looker_orders_parsed.json');
        fs.writeFileSync(ordersPath, JSON.stringify(ordenesProcesadas, null, 2));
      } catch (e) {}
    }

    return res.json({
      success: true,
      message: `Sincronización directa exitosa: ${processedCount} órdenes procesadas.`,
      resumen: {
        total_recibidas: processedCount,
        alertas_sur: ordenesProcesadas.filter(o => o.es_sur === 1).length,
        cardsSummary
      }
    });

  } catch (error) {
    console.error('Error en /api/looker/sincronizar-directo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al sincronizar órdenes.',
      error: error.message
    });
  }
});

router.post(['/launch-login', '/looker/launch-login'], async (req, res) => {
  try {
    const puppeteer = require('puppeteer-core');
    const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    const REAL_USER_DATA = path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data');
    const FALLBACK_USER_DATA = path.join(__dirname, 'chrome_looker_profile');
    const USER_DATA_DIR = (fs.existsSync(REAL_USER_DATA)) ? REAL_USER_DATA : FALLBACK_USER_DATA;
    const SESSION_FILE = path.join(__dirname, 'looker_session.json');
    const TARGET_URL = 'https://datastudio.google.com/u/0/reporting/15ece5ee-2129-40d6-8122-d83aebc89318/page/p_lfut5i1r5d';

    console.log('🚀 Abriendo ventana de Chrome con tu sesión de usuario activa...');

    let browser;
    try {
      browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        userDataDir: USER_DATA_DIR,
        headless: false,
        defaultViewport: null,
        args: [
          '--profile-directory=Default',
          '--start-maximized',
          '--disable-notifications'
        ]
      });
    } catch (launchErr) {
      console.warn('Usando perfil de respaldo por bloqueo de Chrome:', launchErr.message);
      browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        userDataDir: FALLBACK_USER_DATA,
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized', '--disable-notifications']
      });
    }

    const page = await browser.newPage();
    await page.setRequestInterception(true);

    let captured = false;

    page.on('request', async (request) => {
      const url = request.url();
      if (url.includes('batchedDataV2')) {
        const headers = request.headers();
        const cookie = headers['cookie'];
        const xsrf = headers['x-rap-xsrf-token'];

        if (cookie && xsrf && !captured) {
          captured = true;
          const urlObj = new URL(url);
          const appVersion = urlObj.searchParams.get('appVersion') || '20260823_0000';

          const sessionData = {
            appVersion: appVersion,
            url: url,
            x_rap_xsrf_token: xsrf,
            cookie: cookie,
            updated_at: new Date().toISOString()
          };

          fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2));

          try {
            await pool.query(
              `INSERT INTO configuracion (clave, valor, grupo, descripcion, updated_at)
               VALUES ('LOOKER_SESSION', ?, 'tiempo_real', 'Sesión / Cookies Google Looker Studio', NOW())
               ON DUPLICATE KEY UPDATE valor = VALUES(valor), updated_at = NOW()`,
              [JSON.stringify(sessionData)]
            );
          } catch (e) {
            console.error('Error guardando en BD:', e.message);
          }

          console.log('🎉 ¡Sesión capturada y guardada en MySQL y disco!');
          setTimeout(async () => {
            try { await browser.close(); } catch {}
          }, 2000);
        }
      }
      request.continue();
    });

    await page.goto(TARGET_URL);

    res.json({
      success: true,
      mensaje: 'Ventana de inicio de sesión de Google abierta. Por favor, ingresa tu cuenta en la ventana de Chrome.'
    });
  } catch (error) {
    console.error('Error al abrir navegador de login:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;