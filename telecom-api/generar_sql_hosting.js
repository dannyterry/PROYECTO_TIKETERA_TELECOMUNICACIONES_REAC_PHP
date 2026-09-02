const pool = require('./db.js');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    console.log("Generando script SQL para el Hosting cPanel / phpMyAdmin...");

    let sql = `-- =========================================================================\n`;
    sql += `-- SCRIPT DE ACTUALIZACIÓN DE ALMACÉN, PRODUCTOS, SERIES Y DOTACIONES\n`;
    sql += `-- BASE DE DATOS: corporacioncespe_cespedes (Hosting cPanel)\n`;
    sql += `-- FECHA: ${new Date().toISOString()}\n`;
    sql += `-- =========================================================================\n\n`;

    // 1. ALTER TABLE si falta la columna codigo_serie
    sql += `-- 1. AGREGAR COLUMNA codigo_serie A producto_series SI NO EXISTE\n`;
    sql += `SET @dbname = DATABASE();\n`;
    sql += `SET @tablename = 'producto_series';\n`;
    sql += `SET @columnname = 'codigo_serie';\n`;
    sql += `SET @preparedStatement = (SELECT IF(\n`;
    sql += `  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE\n`;
    sql += `    TABLE_SCHEMA = @dbname\n`;
    sql += `    AND TABLE_NAME = @tablename\n`;
    sql += `    AND COLUMN_NAME = @columnname\n`;
    sql += `  ) > 0,\n`;
    sql += `  'SELECT 1',\n`;
    sql += `  'ALTER TABLE producto_series ADD COLUMN codigo_serie VARCHAR(50) NULL AFTER id_producto;'\n`;
    sql += `));\n`;
    sql += `PREPARE alterIfNotExists FROM @preparedStatement;\n`;
    sql += `EXECUTE alterIfNotExists;\n`;
    sql += `DEALLOCATE PREPARE alterIfNotExists;\n\n`;

    // 2. Exportar todos los productos actuales
    sql += `-- 2. CATÁLOGO OFICIAL DE PRODUCTOS (75 PRODUCTOS CON CÓDIGOS SKU)\n`;
    const [prods] = await pool.query("SELECT * FROM productos ORDER BY id_producto ASC");
    for (const p of prods) {
      const desc = p.descripcion ? `'${p.descripcion.replace(/'/g, "''")}'` : 'NULL';
      sql += `INSERT INTO productos (id_producto, id_categoria, codigo, nombre, descripcion, stock_minimo, maneja_serie, es_drop, precio_compra, estado, fecha_creacion)\n`;
      sql += `VALUES (${p.id_producto}, ${p.id_categoria}, '${p.codigo}', '${p.nombre.replace(/'/g, "''")}', ${desc}, ${p.stock_minimo}, ${p.maneja_serie}, ${p.es_drop}, ${p.precio_compra}, '${p.estado}', '${p.fecha_creacion ? new Date(p.fecha_creacion).toISOString().slice(0, 19).replace('T', ' ') : '2026-09-01 08:00:00'}')\n`;
      sql += `ON DUPLICATE KEY UPDATE codigo = VALUES(codigo), nombre = VALUES(nombre), descripcion = VALUES(descripcion), id_categoria = VALUES(id_categoria), maneja_serie = VALUES(maneja_serie), es_drop = VALUES(es_drop);\n`;
    }
    sql += `\n`;

    // 3. Exportar Series registradas (10 equipos reales + actas)
    sql += `-- 3. SERIES REGISTRADAS (10 EQUIPOS REALES Y 100 ACTAS CORRELATIVAS)\n`;
    const [series] = await pool.query("SELECT * FROM producto_series ORDER BY id_producto_serie ASC");
    for (const s of series) {
      const codSerie = s.codigo_serie ? `'${s.codigo_serie}'` : 'NULL';
      const fechaIngreso = s.fecha_ingreso ? `'${new Date(s.fecha_ingreso).toISOString().slice(0, 19).replace('T', ' ')}'` : `'2026-09-01 08:00:00'`;
      sql += `INSERT INTO producto_series (id_producto_serie, id_producto, id_almacen, codigo_serie, numero_serie, estado, fecha_ingreso)\n`;
      sql += `VALUES (${s.id_producto_serie}, ${s.id_producto}, ${s.id_almacen || 1}, ${codSerie}, '${s.numero_serie}', '${s.estado}', ${fechaIngreso})\n`;
      sql += `ON DUPLICATE KEY UPDATE codigo_serie = VALUES(codigo_serie), estado = VALUES(estado), id_almacen = VALUES(id_almacen), fecha_ingreso = VALUES(fecha_ingreso);\n`;
    }
    sql += `\n`;

    // 4. Exportar Stock Central
    sql += `-- 4. STOCK CENTRAL EN ALMACÉN\n`;
    const [stocks] = await pool.query("SELECT * FROM stock WHERE id_almacen = 1");
    for (const st of stocks) {
      sql += `INSERT INTO stock (id_producto, id_almacen, cantidad)\n`;
      sql += `VALUES (${st.id_producto}, 1, ${st.cantidad})\n`;
      sql += `ON DUPLICATE KEY UPDATE cantidad = VALUES(cantidad);\n`;
    }
    sql += `\n`;

    // 5. Exportar dotaciones a técnicos (trabajador_productos y trabajador_series)
    sql += `-- 5. DOTACIÓN A TÉCNICOS (MATERIALES Y SERIES ASIGNADAS)\n`;
    const [tpRows] = await pool.query("SELECT * FROM trabajador_productos");
    for (const tp of tpRows) {
      const fechaCrea = tp.fecha_creacion ? `'${new Date(tp.fecha_creacion).toISOString().slice(0, 19).replace('T', ' ')}'` : `'2026-09-01 08:30:00'`;
      sql += `INSERT INTO trabajador_productos (id_trabajador, id_producto, stock, fecha_creacion)\n`;
      sql += `VALUES (${tp.id_trabajador}, ${tp.id_producto}, ${tp.stock}, ${fechaCrea})\n`;
      sql += `ON DUPLICATE KEY UPDATE stock = VALUES(stock), fecha_creacion = VALUES(fecha_creacion);\n`;
    }
    sql += `\n`;

    const [tsRows] = await pool.query("SELECT * FROM trabajador_series");
    for (const ts of tsRows) {
      const fechaAsig = ts.fecha_asignacion ? `'${new Date(ts.fecha_asignacion).toISOString().slice(0, 19).replace('T', ' ')}'` : `'2026-09-01 08:30:00'`;
      sql += `INSERT INTO trabajador_series (id_trabajador, id_producto, id_producto_serie, estado, fecha_asignacion)\n`;
      sql += `VALUES (${ts.id_trabajador}, ${ts.id_producto}, ${ts.id_producto_serie}, '${ts.estado}', ${fechaAsig})\n`;
      sql += `ON DUPLICATE KEY UPDATE estado = VALUES(estado), fecha_asignacion = VALUES(fecha_asignacion);\n`;
    }
    sql += `\n`;

    const outputPath = path.join('d:', 'proyecrh', 'SUBIR_DATABASE_almacen.sql');
    fs.writeFileSync(outputPath, sql, 'utf8');
    console.log(`✅ Archivo SQL generado exitosamente en: ${outputPath}`);
  } catch (err) {
    console.error("❌ Error generando SQL:", err);
  } finally {
    process.exit(0);
  }
})();
