const pool = require('../db.js');

async function auditVillaverdeExact() {
  console.log('========================================================================');
  console.log('🔍 AUDITORÍA DE CONCILIACIÓN EXACTA: TÉCNICO ROBERTO PUCHURE VILLAVERDE');
  console.log('========================================================================\n');

  const idTrabajador = 76;
  const idUsuario = 76;

  // 1. Despachos recibidos desde Almacén Central
  const [despachos] = await pool.query(`
    SELECT d.id_despacho, d.codigo_despacho, d.fecha_despacho, d.observaciones,
           dd.id_producto, p.nombre as producto_nombre, p.codigo, c.nombre as categoria,
           dd.cantidad, dd.es_segundo_uso
    FROM despachos d
    JOIN despacho_detalles dd ON d.id_despacho = dd.id_despacho
    JOIN productos p ON dd.id_producto = p.id_producto
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
    WHERE d.id_trabajador = ?
    ORDER BY d.fecha_despacho ASC
  `, [idTrabajador]);

  const despachosAgrupados = {};
  for (const d of despachos) {
    if (!despachosAgrupados[d.id_producto]) {
      despachosAgrupados[d.id_producto] = {
        nombre: d.producto_nombre,
        codigo: d.codigo,
        categoria: d.categoria,
        total_despachado: 0,
        detalle_entregas: []
      };
    }
    despachosAgrupados[d.id_producto].total_despachado += Number(d.cantidad);
    despachosAgrupados[d.id_producto].detalle_entregas.push({
      despacho: d.codigo_despacho,
      fecha: d.fecha_despacho,
      cant: Number(d.cantidad)
    });
  }

  // 2. Materiales consumidos/liquidados en órdenes por este técnico
  const [liquidaciones] = await pool.query(`
    SELECT ol.id_liquidacion, ol.id_orden, o.numero as numero_orden, ol.numero_acta,
           ol.fecha_liquidacion, ol.estado as estado_liquidacion,
           old.id_producto, p.nombre as producto_nombre, p.codigo, c.nombre as categoria,
           old.cantidad, old.numero_serie, old.id_producto_serie
    FROM orden_liquidaciones ol
    JOIN ordenes o ON ol.id_orden = o.id_orden
    JOIN orden_liquidacion_detalle old ON ol.id_liquidacion = old.id_liquidacion
    JOIN productos p ON old.id_producto = p.id_producto
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
    WHERE ol.id_trabajador = ?
    ORDER BY ol.fecha_liquidacion ASC
  `, [idTrabajador]);

  const liquidacionesAgrupadas = {};
  for (const l of liquidaciones) {
    if (!liquidacionesAgrupadas[l.id_producto]) {
      liquidacionesAgrupadas[l.id_producto] = {
        nombre: l.producto_nombre,
        codigo: l.codigo,
        categoria: l.categoria,
        total_liquidado: 0,
        ordenes: []
      };
    }
    liquidacionesAgrupadas[l.id_producto].total_liquidado += Number(l.cantidad);
    liquidacionesAgrupadas[l.id_producto].ordenes.push({
      orden: l.numero_orden,
      acta: l.numero_acta,
      fecha: l.fecha_liquidacion,
      cant: Number(l.cantidad),
      serie: l.numero_serie
    });
  }

  // 3. Stock actual en el Móvil (trabajador_productos)
  const [stockMovil] = await pool.query(`
    SELECT tp.id_producto, p.nombre as producto_nombre, p.codigo, c.nombre as categoria,
           tp.stock, tp.fecha_actualizacion
    FROM trabajador_productos tp
    JOIN productos p ON tp.id_producto = p.id_producto
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
    WHERE tp.id_trabajador = ?
  `, [idTrabajador]);

  const stockMovilMap = {};
  for (const sm of stockMovil) {
    stockMovilMap[sm.id_producto] = {
      nombre: sm.producto_nombre,
      codigo: sm.codigo,
      categoria: sm.categoria,
      stock: Number(sm.stock),
      fecha_act: sm.fecha_actualizacion
    };
  }

  // 4. Series (Equipos y Actas)
  const [series] = await pool.query(`
    SELECT ts.id_trabajador_serie, ts.id_producto, p.nombre as producto_nombre,
           ps.numero_serie, ts.estado, ts.fecha_asignacion
    FROM trabajador_series ts
    JOIN productos p ON ts.id_producto = p.id_producto
    JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
    WHERE ts.id_trabajador = ?
  `, [idTrabajador]);

  const seriesResumen = {};
  for (const s of series) {
    if (!seriesResumen[s.id_producto]) {
      seriesResumen[s.id_producto] = {
        nombre: s.producto_nombre,
        asignadas_en_poder: 0,
        usadas_liquidadas: 0,
        total_entregadas: 0,
        series_disponibles: [],
        series_usadas: []
      };
    }
    seriesResumen[s.id_producto].total_entregadas++;
    if (s.estado === 'Asignada') {
      seriesResumen[s.id_producto].asignadas_en_poder++;
      seriesResumen[s.id_producto].series_disponibles.push(s.numero_serie);
    } else {
      seriesResumen[s.id_producto].usadas_liquidadas++;
      seriesResumen[s.id_producto].series_usadas.push(s.numero_serie);
    }
  }

  // 5. CONCILIACIÓN MATEMÁTICA ÍTEM POR ÍTEM
  const allIds = new Set([
    ...Object.keys(despachosAgrupados),
    ...Object.keys(liquidacionesAgrupadas),
    ...Object.keys(stockMovilMap)
  ]);

  const conciliationTable = [];
  let totalItemsCuadrados = 0;
  let totalItemsDiscrepancia = 0;

  for (const id of allIds) {
    const d = despachosAgrupados[id];
    const l = liquidacionesAgrupadas[id];
    const s = stockMovilMap[id];

    const nombre = d?.nombre || l?.nombre || s?.nombre || `Prod #${id}`;
    const categoria = d?.categoria || l?.categoria || s?.categoria || '-';
    const despachado = d?.total_despachado || 0;
    const liquidado = l?.total_liquidado || 0;
    const stockCalculado = despachado - liquidado;
    const stockActualMovil = s?.stock !== undefined ? s.stock : 'NO_REGISTRADO';

    const diferencia = typeof stockActualMovil === 'number' ? stockActualMovil - stockCalculado : null;

    let evaluacion = '';
    if (diferencia === 0) {
      evaluacion = '✅ CUADRA EXACTO';
      totalItemsCuadrados++;
    } else if (diferencia !== null && diferencia > 0) {
      evaluacion = `⚠️ SOBRANTE EN MÓVIL (+${diferencia})`;
      totalItemsDiscrepancia++;
    } else if (diferencia !== null && diferencia < 0) {
      evaluacion = `🚨 FALTANTE EN MÓVIL (${diferencia})`;
      totalItemsDiscrepancia++;
    } else {
      evaluacion = '❓ SIN REGISTRO EN MÓVIL';
      totalItemsDiscrepancia++;
    }

    conciliationTable.push({
      id: Number(id),
      producto: nombre.length > 25 ? nombre.substring(0, 23) + '..' : nombre,
      categoria: categoria.substring(0, 9),
      entregado: despachado,
      gastado: liquidado,
      deberia_tener: stockCalculado,
      tiene_en_movil: stockActualMovil,
      diferencia: diferencia !== null ? diferencia : 'N/A',
      diagnostico: evaluacion
    });
  }

  // Ordenar: primero los que tienen discrepancia, luego los cuadrados
  conciliationTable.sort((a, b) => {
    if (a.diferencia !== 0 && b.diferencia === 0) return -1;
    if (a.diferencia === 0 && b.diferencia !== 0) return 1;
    return a.id - b.id;
  });

  console.log('📊 TABLA DE BALANCE Y CONCILIACIÓN GENERAL:');
  console.table(conciliationTable);

  console.log(`\n📌 RESUMEN DE CUADRATURA:`);
  console.log(`   - Ítems analizados: ${conciliationTable.length}`);
  console.log(`   - Ítems matemáticamente cuadrados: ${totalItemsCuadrados}`);
  console.log(`   - Ítems con diferencia/descuadre: ${totalItemsDiscrepancia}`);

  // 6. DETALLE DE DISCREPANCIAS
  console.log('\n========================================================================');
  console.log('🔎 ANÁLISIS DE LAS DISCREPANCIAS ENCONTRADAS:');
  console.log('========================================================================');

  const discrepancias = conciliationTable.filter(c => c.diferencia !== 0);
  for (const disc of discrepancias) {
    const prodId = disc.id;
    const d = despachosAgrupados[prodId];
    const l = liquidacionesAgrupadas[prodId];
    const s = stockMovilMap[prodId];

    console.log(`\n▶ [ID ${prodId}] ${disc.producto} (Cat: ${disc.categoria})`);
    console.log(`   Entregado desde almacén: ${disc.entregado}`);
    if (d?.detalle_entregas?.length > 0) {
      console.log(`      Entregas: ${d.detalle_entregas.map(e => `${e.fecha?.substring(0,10)} (${e.cant})`).join(', ')}`);
    }
    console.log(`   Gastado en órdenes: ${disc.gastado}`);
    if (l?.ordenes?.length > 0) {
      console.log(`      Órdenes: ${l.ordenes.map(o => `OT #${o.orden}: -${o.cant} (${o.fecha?.substring(0,10)})`).join(', ')}`);
    }
    console.log(`   Stock actual en móvil: ${disc.tiene_en_movil} (Última actualización: ${s?.fecha_act})`);
    console.log(`   Diagnóstico: ${disc.diagnostico}`);
  }

  // 7. AUDITORÍA DE ACTAS Y EQUIPOS CON SERIE
  console.log('\n========================================================================');
  console.log('🏷️ AUDITORÍA DE SERIES Y TALONARIOS DE ACTAS:');
  console.log('========================================================================');
  for (const [prodId, data] of Object.entries(seriesResumen)) {
    console.log(`\n▶ ${data.nombre} (ID Prod: ${prodId})`);
    console.log(`   Total asignadas a Villaverde: ${data.total_entregadas}`);
    console.log(`   Actualmente disponibles en su poder: ${data.asignadas_en_poder}`);
    console.log(`   Usadas / Liquidadas en órdenes: ${data.usadas_liquidadas}`);
    if (data.asignadas_en_poder <= 10) {
      console.log(`   Series disponibles: ${data.series_disponibles.join(', ')}`);
    } else {
      console.log(`   Series disponibles (rango): ${data.series_disponibles[0]} ... ${data.series_disponibles[data.series_disponibles.length - 1]} (${data.asignadas_en_poder} actas)`);
    }
  }

  // 8. VERIFICAR SI LAS 17 LIQUIDACIONES TIENEN ESTADO 'Pendiente' O 'Aprobada'
  console.log('\n========================================================================');
  console.log('📋 ESTADO DE LAS 17 LIQUIDACIONES REALIZADAS POR VILLAVERDE:');
  console.log('========================================================================');
  const [liqEstados] = await pool.query(`
    SELECT ol.id_liquidacion, o.numero as numero_orden, ol.numero_acta, 
           ol.estado as estado_liquidacion, ol.tipo_trabajo_acta, ol.fecha_liquidacion,
           (SELECT COUNT(*) FROM orden_liquidacion_detalle old WHERE old.id_liquidacion = ol.id_liquidacion) as cant_materiales
    FROM orden_liquidaciones ol
    JOIN ordenes o ON ol.id_orden = o.id_orden
    WHERE ol.id_trabajador = ?
    ORDER BY ol.fecha_liquidacion ASC
  `, [idTrabajador]);
  console.table(liqEstados);

  process.exit(0);
}

auditVillaverdeExact().catch(console.error);
