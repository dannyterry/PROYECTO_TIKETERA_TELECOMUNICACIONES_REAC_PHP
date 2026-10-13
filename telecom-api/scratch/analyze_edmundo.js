const mysql = require('mysql2/promise');

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  dateStrings: true,
  connectTimeout: 30000
};

async function analyzeEdmundo() {
  const pool = await mysql.createConnection(REMOTE_CONFIG);
  try {
    console.log('=== AUDITORÍA DETALLADA: TÉCNICO EDMUNDO FLORES ===\n');

    const [users] = await pool.query(`
      SELECT u.id_usuario, u.nombres, u.primer_apellido, u.segundo_apellido, u.cuadrilla, u.estado,
             t.id_trabajador, t.estado as estado_trabajador, t.id_vehiculo, v.placa as vehiculo_placa
      FROM usuarios u
      LEFT JOIN trabajadores t ON u.id_usuario = t.id_usuario
      LEFT JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      WHERE u.nombres LIKE '%EDMUNDO%' OR u.primer_apellido LIKE '%FLORES%' OR u.segundo_apellido LIKE '%FLORES%'
    `);

    const edmundoUsers = users.filter(u => 
      `${u.nombres} ${u.primer_apellido} ${u.segundo_apellido}`.toUpperCase().includes('EDMUNDO')
    );

    for (const user of edmundoUsers) {
      const idUsuario = user.id_usuario;
      const idTrabajador = user.id_trabajador;
      const nombreCompleto = `${user.nombres} ${user.primer_apellido || ''} ${user.segundo_apellido || ''}`.trim();
      
      console.log(`========================================================================`);
      console.log(`👤 TÉCNICO: ${nombreCompleto}`);
      console.log(`   ID Usuario: ${idUsuario} | ID Trabajador: ${idTrabajador} | Cuadrilla: ${user.cuadrilla} | Estado: ${user.estado} | Placa: ${user.vehiculo_placa || 'Sin auto'}`);
      console.log(`========================================================================\n`);

      // 1. Despachos entregados a este técnico (Almacén Central -> Técnico)
      const [despachos] = await pool.query(`
        SELECT d.id_despacho, d.codigo_despacho, d.fecha_despacho, d.tipo_despacho, d.observaciones,
               dd.id_producto, p.nombre as producto_nombre, p.codigo, p.es_drop, c.nombre as categoria,
               dd.cantidad, dd.es_segundo_uso
        FROM despachos d
        JOIN despacho_detalles dd ON d.id_despacho = dd.id_despacho
        JOIN productos p ON dd.id_producto = p.id_producto
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
        WHERE d.id_trabajador = ?
        ORDER BY d.fecha_despacho ASC
      `, [idTrabajador]);
      console.log(`📦 1. DESPACHOS RECIBIDOS DESDE ALMACÉN CENTRAL: ${despachos.length} líneas de entrega registradas`);

      const despachadoPorProd = {};
      for (const d of despachos) {
        if (!despachadoPorProd[d.id_producto]) {
          despachadoPorProd[d.id_producto] = {
            id_producto: d.id_producto,
            nombre: d.producto_nombre,
            codigo: d.codigo,
            categoria: d.categoria,
            es_drop: d.es_drop,
            cantidad: 0,
            entregas: []
          };
        }
        despachadoPorProd[d.id_producto].cantidad += Number(d.cantidad);
        despachadoPorProd[d.id_producto].entregas.push({
          id_despacho: d.id_despacho,
          codigo: d.codigo_despacho,
          fecha: d.fecha_despacho,
          cant: Number(d.cantidad)
        });
      }

      // 2. Liquidaciones registradas en orden_liquidaciones vinculadas a este técnico
      const [liquidaciones] = await pool.query(`
        SELECT ol.id_liquidacion, ol.id_orden, o.numero as numero_orden, ol.numero_acta, ol.fecha_liquidacion,
               ol.tipo_trabajo_acta,
               old.id_producto, p.nombre as producto_nombre, p.codigo, c.nombre as categoria,
               old.cantidad, old.numero_serie, old.id_producto_serie, old.es_baja,
               old.drop_inicio, old.drop_fin
        FROM orden_liquidaciones ol
        JOIN ordenes o ON ol.id_orden = o.id_orden
        JOIN orden_liquidacion_detalle old ON ol.id_liquidacion = old.id_liquidacion
        JOIN productos p ON old.id_producto = p.id_producto
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
        WHERE ol.id_trabajador = ? 
           OR o.id_tecnico = ? 
           OR ol.liquidado_por LIKE ?
        ORDER BY ol.fecha_liquidacion ASC, old.id_detalle_liq ASC
      `, [idTrabajador, idUsuario, `%${user.nombres}%`]);
      console.log(`📋 2. MATERIALES / EQUIPOS GASTADOS EN LIQUIDACIONES DE ÓRDENES: ${liquidaciones.length} líneas liquidadas`);

      const gastadoPorProd = {};
      const ordenesUnicasMap = new Map();

      for (const l of liquidaciones) {
        if (!gastadoPorProd[l.id_producto]) {
          gastadoPorProd[l.id_producto] = {
            id_producto: l.id_producto,
            nombre: l.producto_nombre,
            codigo: l.codigo,
            categoria: l.categoria,
            cantidad: 0,
            ordenes: new Set()
          };
        }
        gastadoPorProd[l.id_producto].cantidad += Number(l.cantidad);
        if (l.numero_orden) gastadoPorProd[l.id_producto].ordenes.add(l.numero_orden);

        // Agrupar por orden para el detalle de las órdenes liquidadas
        if (!ordenesUnicasMap.has(l.id_liquidacion)) {
          ordenesUnicasMap.set(l.id_liquidacion, {
            id_orden: l.id_orden,
            numero_ticket: l.numero_orden,
            numero_acta: l.numero_acta,
            tipo_trabajo: l.tipo_trabajo_acta,
            fecha: l.fecha_liquidacion,
            materiales: []
          });
        }
        ordenesUnicasMap.get(l.id_liquidacion).materiales.push({
          nombre: l.producto_nombre,
          cantidad: Number(l.cantidad),
          numero_serie: l.numero_serie,
          drop_inicio: l.drop_inicio,
          drop_fin: l.drop_fin
        });
      }

      // 3. Stock actual en Camioneta / Móvil (trabajador_productos)
      const [stockMovil] = await pool.query(`
        SELECT tp.id_producto, p.nombre as producto_nombre, p.codigo, c.nombre as categoria,
               tp.stock, tp.fecha_actualizacion
        FROM trabajador_productos tp
        JOIN productos p ON tp.id_producto = p.id_producto
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
        WHERE tp.id_trabajador = ?
      `, [idTrabajador]);
      console.log(`🚗 3. PRODUCTOS EN TABLA trabajador_productos (STOCK ACTUAL MÓVIL): ${stockMovil.length} registros`);

      const stockActualPorProd = {};
      for (const sm of stockMovil) {
        stockActualPorProd[sm.id_producto] = {
          id_producto: sm.id_producto,
          nombre: sm.producto_nombre,
          codigo: sm.codigo,
          categoria: sm.categoria,
          stock: Number(sm.stock),
          fecha_act: sm.fecha_actualizacion
        };
      }

      // 4. Series asignadas físicamente en trabajador_series (Equipos ONT, Mesh, Actas)
      const [series] = await pool.query(`
        SELECT ts.id_trabajador_serie, ts.id_producto, p.nombre as producto_nombre,
               ps.numero_serie, ts.estado, ts.fecha_asignacion, c.nombre as categoria
        FROM trabajador_series ts
        JOIN productos p ON ts.id_producto = p.id_producto
        JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
        LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
        WHERE ts.id_trabajador = ?
        ORDER BY ts.id_producto, ts.estado, ps.numero_serie
      `, [idTrabajador]);
      console.log(`🏷️ 4. SERIES INDIVIDUALES REGISTRADAS EN trabajador_series: ${series.length} series\n`);

      const seriesResumen = {};
      const equiposHardware = [];
      const actasFisicas = [];

      for (const s of series) {
        if (!seriesResumen[s.id_producto]) {
          seriesResumen[s.id_producto] = {
            id_producto: s.id_producto,
            nombre: s.producto_nombre,
            categoria: s.categoria,
            asignadas_disponibles: 0,
            usadas_liquidadas: 0,
            otras: 0,
            total: 0
          };
        }
        seriesResumen[s.id_producto].total++;
        if (s.estado === 'Asignada') {
          seriesResumen[s.id_producto].asignadas_disponibles++;
          if (s.producto_nombre.toUpperCase().includes('ACTA')) {
            actasFisicas.push({ serie: s.numero_serie, estado: s.estado });
          } else {
            equiposHardware.push({ equipo: s.producto_nombre, serie: s.numero_serie, estado: s.estado });
          }
        } else if (['Usada', 'Instalado', 'Liquidada', 'Consumida'].includes(s.estado)) {
          seriesResumen[s.id_producto].usadas_liquidadas++;
          if (s.producto_nombre.toUpperCase().includes('ACTA')) {
            actasFisicas.push({ serie: s.numero_serie, estado: s.estado });
          } else {
            equiposHardware.push({ equipo: s.producto_nombre, serie: s.numero_serie, estado: s.estado });
          }
        } else {
          seriesResumen[s.id_producto].otras++;
        }
      }

      // 5. Comparativa matemática: Despachado - Liquidado vs Stock Móvil
      console.log('────────────────────────────────────────────────────────────────────────');
      console.log('📊 TABLA DE CONCILIACIÓN / CUADRATURA GENERAL DE MATERIALES:');
      console.log('   Fórmula esperada: Stock en Móvil = Despachado - Liquidado');
      console.log('────────────────────────────────────────────────────────────────────────');

      const todosProductos = new Set([
        ...Object.keys(despachadoPorProd),
        ...Object.keys(gastadoPorProd),
        ...Object.keys(stockActualPorProd)
      ]);

      const reporteBalance = [];
      for (const prodId of todosProductos) {
        const desp = despachadoPorProd[prodId]?.cantidad || 0;
        const gast = gastadoPorProd[prodId]?.cantidad || 0;
        const stockTeorico = desp - gast;
        const stockReal = stockActualPorProd[prodId]?.stock || 0;
        const nombre = despachadoPorProd[prodId]?.nombre || gastadoPorProd[prodId]?.nombre || stockActualPorProd[prodId]?.nombre || `Prod #${prodId}`;
        const cat = despachadoPorProd[prodId]?.categoria || gastadoPorProd[prodId]?.categoria || stockActualPorProd[prodId]?.categoria || '-';
        const diferencia = stockReal - stockTeorico;

        let estadoCuadratura = '';
        if (diferencia === 0) {
          estadoCuadratura = '✅ Cuadrado exacto';
        } else if (diferencia > 0) {
          estadoCuadratura = `⚠️ Tiene de más (+${diferencia})`;
        } else {
          estadoCuadratura = `🚨 Falta (${diferencia})`;
        }

        reporteBalance.push({
          id: Number(prodId),
          producto: nombre,
          categoria: cat,
          entregado: desp,
          gastado: gast,
          deberia_tener: stockTeorico,
          stock_actual_movil: stockReal,
          diferencia: diferencia,
          estado: estadoCuadratura
        });
      }

      // Ordenar por ID producto ascendente
      reporteBalance.sort((a, b) => a.id - b.id);

      console.table(reporteBalance.map(r => ({
        ID: r.id,
        Producto: r.producto.length > 25 ? r.producto.substring(0, 23) + '..' : r.producto,
        'Entregado': r.entregado,
        'Gastado': r.gastado,
        'Debería': r.deberia_tener,
        'Móvil': r.stock_actual_movil,
        'Dif': r.diferencia,
        'Estado': r.estado
      })));

      // Guardar todo en JSON para crear el markdown impecable
      const fs = require('fs');
      fs.writeFileSync('d:/proyectofinal/telecom-api/scratch/reporte_edmundo_completo.json', JSON.stringify({
        usuario: user,
        reporteBalance,
        seriesResumen,
        equiposHardware,
        actasFisicas,
        ordenes: Array.from(ordenesUnicasMap.values())
      }, null, 2));

      console.log('\nReporte guardado en scratch/reporte_edmundo_completo.json');
    }
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

analyzeEdmundo();
