const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function auditIntegrity() {
  console.log("==================================================================");
  console.log("🔍 AUDITORÍA INTEGRAL DE BASE DE DATOS Y CÓDIGO (MYSQL <-> BACKEND)");
  console.log("==================================================================");

  // 1. Obtener todas las tablas y columnas existentes en la BD
  const [tablesRows] = await pool.query("SHOW TABLES");
  const dbTables = tablesRows.map(r => Object.values(r)[0]);
  console.log(`📊 Total de tablas en la base de datos: ${dbTables.length}`);

  const [colsRows] = await pool.query(
    "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.columns WHERE TABLE_SCHEMA = 'corporacioncespe_cespedes'"
  );
  
  const schemaMap = {};
  for (const c of colsRows) {
    if (!schemaMap[c.TABLE_NAME]) schemaMap[c.TABLE_NAME] = new Map();
    schemaMap[c.TABLE_NAME].set(c.COLUMN_NAME, c);
  }

  // 2. Probar todos los endpoints clave que la aplicación usa
  console.log("\n🧪 PROBANDO QUERIES Y ENDPOINTS PRINCIPALES DEL SISTEMA...");

  const endpointsToTest = [
    { name: "Listado de Órdenes", sql: "SELECT o.*, tc.total_tareas FROM ordenes o LEFT JOIN usuarios u ON o.id_tecnico = u.id_usuario LEFT JOIN orden_tareas_cache tc ON o.numero = tc.numero_orden LIMIT 5" },
    { name: "Técnicos de Órdenes", sql: "SELECT id_usuario, nombres, apellidos, cuadrilla FROM usuarios WHERE estado = 'Activo' LIMIT 5" },
    { name: "Tipos de Trabajo", sql: "SELECT * FROM tipos_trabajo LIMIT 5" },
    { name: "Historial Estados", sql: "SELECT * FROM historial_estados LIMIT 5" },
    { name: "Tareas y Caché", sql: "SELECT * FROM orden_tareas_cache LIMIT 5" },
    { name: "Tareas Detalle", sql: "SELECT * FROM orden_tareas LIMIT 5" },
    { name: "Auditoría Actas (Liquidaciones)", sql: "SELECT ol.*, d.cantidad, p.nombre FROM orden_liquidaciones ol LEFT JOIN orden_liquidacion_detalle d ON d.id_liquidacion = ol.id_liquidacion LEFT JOIN productos p ON p.id_producto = d.id_producto LIMIT 5" },
    { name: "Liquidaciones Técnicos (Devoluciones)", sql: "SELECT lt.*, ld.cantidad_devuelta FROM liquidaciones_tecnicos lt LEFT JOIN liquidacion_detalles ld ON ld.id_liquidacion = lt.id_liquidacion LIMIT 5" },
    { name: "Stock y Productos", sql: "SELECT p.*, c.nombre as categoria FROM productos p LEFT JOIN categorias c ON c.id_categoria = p.id_categoria LIMIT 5" },
    { name: "Series de Productos", sql: "SELECT ps.*, p.nombre as producto FROM producto_series ps LEFT JOIN productos p ON p.id_producto = ps.id_producto LIMIT 5" },
    { name: "Stock por Técnico", sql: "SELECT tp.*, p.nombre as producto FROM trabajador_productos tp LEFT JOIN productos p ON p.id_producto = tp.id_producto LIMIT 5" },
    { name: "Series por Técnico", sql: "SELECT ts.*, ps.numero_serie FROM trabajador_series ts LEFT JOIN producto_series ps ON ps.id_producto_serie = ts.id_producto_serie LIMIT 5" },
    { name: "Equipos Retirados", sql: "SELECT * FROM orden_equipos_retirados LIMIT 5" },
    { name: "Movilidad: Vehículos", sql: "SELECT * FROM vehiculos LIMIT 5" },
    { name: "Movilidad: Asignaciones", sql: "SELECT * FROM vehiculo_asignaciones LIMIT 5" },
    { name: "Movilidad: Inspecciones", sql: "SELECT * FROM vehiculo_inspecciones LIMIT 5" },
    { name: "Movilidad: Combustibles", sql: "SELECT * FROM vehiculo_combustibles LIMIT 5" },
    { name: "Asistencias y Horarios", sql: "SELECT * FROM asistencias LIMIT 5" },
    { name: "Auditoría de Actividad", sql: "SELECT * FROM auditoria_actividad LIMIT 5" }
  ];

  let passed = 0;
  let failed = 0;

  for (const t of endpointsToTest) {
    try {
      const [rows] = await pool.query(t.sql);
      console.log(`  ✅ [${t.name}]: OK (${rows.length} registros obtenidos)`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [${t.name}]: ERROR -> ${err.message}`);
      failed++;
    }
  }

  // 3. Verificar columnas críticas agregadas en 2026
  console.log("\n🔎 VERIFICACIÓN DE COLUMNAS CRÍTICAS:");
  const criticalChecks = [
    { table: "productos", column: "categoria_liquidar" },
    { table: "productos", column: "es_drop" },
    { table: "orden_liquidaciones", column: "motivo_rechazo" },
    { table: "orden_liquidaciones", column: "drop_metro_inicio" },
    { table: "orden_liquidaciones", column: "drop_metro_fin" },
    { table: "orden_liquidaciones", column: "drop_total_metros" },
    { table: "orden_liquidaciones", column: "speedtest_download" },
    { table: "orden_liquidaciones", column: "speedtest_upload" },
    { table: "orden_liquidaciones", column: "tipo_conexion" },
    { table: "orden_liquidaciones", column: "firma_cliente" },
    { table: "orden_liquidaciones", column: "firma_tecnico" },
    { table: "orden_liquidacion_detalle", column: "drop_inicio" },
    { table: "orden_liquidacion_detalle", column: "drop_fin" },
    { table: "orden_liquidacion_detalle", column: "es_baja" },
    { table: "orden_liquidacion_detalle", column: "serie_creada" },
    { table: "orden_tareas_cache", column: "tareas_json" },
    { table: "orden_tareas_cache", column: "progreso_porcentaje" }
  ];

  for (const c of criticalChecks) {
    const tableExists = schemaMap[c.table];
    if (!tableExists) {
      console.error(`  ❌ Tabla [${c.table}] NO EXISTE en la base de datos.`);
      failed++;
    } else {
      const colExists = schemaMap[c.table].has(c.column);
      if (!colExists) {
        console.error(`  ❌ Columna [${c.table}.${c.column}] NO EXISTE.`);
        failed++;
      } else {
        console.log(`  ✅ [${c.table}.${c.column}]: EXISTE`);
      }
    }
  }

  console.log("\n==================================================================");
  if (failed === 0) {
    console.log(`🎉 RESULTADO: TODO ESTÁ 100% CORRECTO (${passed}/${passed} pruebas pasadas con éxito).`);
  } else {
    console.log(`⚠️ RESULTADO: Se encontraron ${failed} inconsistencias.`);
  }
  console.log("==================================================================");

  process.exit(0);
}

auditIntegrity().catch(err => {
  console.error("Error fatal en auditoría:", err);
  process.exit(1);
});
