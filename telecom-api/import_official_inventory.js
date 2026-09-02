const pool = require('./db.js');

const inventoryList = [
  // --- 1. UNIFORMES (id_categoria: 13) ---
  { nombre: 'PANTALON', id_categoria: 13, codigo: 'UNI-PAN', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'CHALECO', id_categoria: 13, codigo: 'UNI-CHA', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'POLO', id_categoria: 13, codigo: 'UNI-POL', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'BOTA', id_categoria: 13, codigo: 'UNI-BOT', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'CASCO HOMOLOG. + BARBIQ', id_categoria: 13, codigo: 'UNI-CAS', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'GUANTE DE SEGURIDAD', id_categoria: 13, codigo: 'UNI-GUA', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'LENTES DE PROTECCION', id_categoria: 13, codigo: 'UNI-LEN', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'TAPA NUCA', id_categoria: 13, codigo: 'UNI-TAP', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'FOTOCHECK', id_categoria: 13, codigo: 'UNI-FOT', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },

  // --- 2. HERRAMIENTAS (id_categoria: 12) ---
  { nombre: 'CINTURON SEGURIDAD', id_categoria: 12, codigo: 'HER-CIN', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'PORTA DROP', id_categoria: 12, codigo: 'HER-PDR', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'MARTILLO', id_categoria: 12, codigo: 'HER-MAR', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'TALADRO', id_categoria: 12, codigo: 'HER-TAL', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'BROCA PASAMURO', id_categoria: 12, codigo: 'HER-BRP', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'BROCA CHICA', id_categoria: 12, codigo: 'HER-BRC', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'DESARMADOR ESTRELLA', id_categoria: 12, codigo: 'HER-DEE', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'DESARMADOR PLANO', id_categoria: 12, codigo: 'HER-DEP', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'TABLERO + LAPICERO', id_categoria: 12, codigo: 'HER-TAB', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'ALICATE PINZA', id_categoria: 12, codigo: 'HER-ALP', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'ALICATE CORTE', id_categoria: 12, codigo: 'HER-ALC', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'CRIMPI', id_categoria: 12, codigo: 'HER-CRI', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'ONE CLICK', id_categoria: 12, codigo: 'HER-ONC', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'WINCHA', id_categoria: 12, codigo: 'HER-WIN', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'ZUNCHADORA', id_categoria: 12, codigo: 'HER-ZUN', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'KIT DE FIBRA', id_categoria: 12, codigo: 'HER-KTF', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'EXTENCION', id_categoria: 12, codigo: 'HER-EXT', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'MARCADOR', id_categoria: 12, codigo: 'HER-MRC', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },

  // --- 3. VEHICULO (id_categoria: 10) ---
  { nombre: 'CONO DE SEGURIDAD- 6', id_categoria: 10, codigo: 'VEH-CON', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'BARRA RETRACTIL- 4', id_categoria: 10, codigo: 'VEH-BAR', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'TACOS DE MADERA', id_categoria: 10, codigo: 'VEH-TAC', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'ESCALERA TELESCOPICA', id_categoria: 10, codigo: 'VEH-EST', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'ESCALERA 8 PASOS', id_categoria: 10, codigo: 'VEH-ES8', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'CADENA', id_categoria: 10, codigo: 'VEH-CAD', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'CANDADO', id_categoria: 10, codigo: 'VEH-CND', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'GATA', id_categoria: 10, codigo: 'VEH-GAT', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'LLAVE DE RUEDAS', id_categoria: 10, codigo: 'VEH-LRU', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'TRIANGULO', id_categoria: 10, codigo: 'VEH-TRI', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'BOTIQUIN', id_categoria: 10, codigo: 'VEH-BOT', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'EXTINTOR 6KG', id_categoria: 10, codigo: 'VEH-EXT', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'LLANTA DE REPUESTO', id_categoria: 10, codigo: 'VEH-REP', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'MEDIDOR DE AIRE', id_categoria: 10, codigo: 'VEH-MED', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'LLAVE INGLESA', id_categoria: 10, codigo: 'VEH-LIN', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'TORTOL', id_categoria: 10, codigo: 'VEH-TOR', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'LOGOTIPOS PARTNER', id_categoria: 10, codigo: 'VEH-LGP', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'LOGOTIPOS', id_categoria: 10, codigo: 'VEH-LOG', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },

  // --- 4. MATERIALES (id_categoria: 1) ---
  { nombre: 'CONECTORES', id_categoria: 1, codigo: 'MAT-CON', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'PATCH COR', id_categoria: 1, codigo: 'MAT-PCO', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'PATCH COR AZUL VERDE', id_categoria: 1, codigo: 'MAT-PCA', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'TEMPLADORES', id_categoria: 1, codigo: 'MAT-TEM', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'ROSETAS', id_categoria: 1, codigo: 'MAT-ROS', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'ACOPLES', id_categoria: 1, codigo: 'MAT-ACO', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'GRAPAS', id_categoria: 1, codigo: 'MAT-GRA', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'CINTILLO AMARRES', id_categoria: 1, codigo: 'MAT-CIN', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'ROTULADOR', id_categoria: 1, codigo: 'MAT-ROT', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'DROP', id_categoria: 1, codigo: 'MAT-DRP', maneja_serie: 0, es_drop: 1, categoria_liquidar: 'MATERIAL' },
  { nombre: 'CONECTORES RG', id_categoria: 1, codigo: 'MAT-CRG', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'CABLE RG11', id_categoria: 1, codigo: 'MAT-R11', maneja_serie: 0, es_drop: 1, categoria_liquidar: 'MATERIAL' },
  { nombre: 'ANCLAJE T/P', id_categoria: 1, codigo: 'MAT-ANC', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'CLEVIS', id_categoria: 1, codigo: 'MAT-CLE', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'HEBILLAS', id_categoria: 1, codigo: 'MAT-HEB', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'C. BANDIX', id_categoria: 1, codigo: 'MAT-BAN', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'SPLITER', id_categoria: 1, codigo: 'MAT-SPL', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'C. VULCANIZANTE', id_categoria: 1, codigo: 'MAT-VUL', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'C. DOBLE CONTACTO', id_categoria: 1, codigo: 'MAT-DCO', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'ACTAS', id_categoria: 1, codigo: 'MAT-ACT', maneja_serie: 1, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'STICKER QR', id_categoria: 1, codigo: 'MAT-SQR', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },
  { nombre: 'VOLANTES WIN', id_categoria: 1, codigo: 'MAT-VOL', maneja_serie: 0, es_drop: 0, categoria_liquidar: 'MATERIAL' },

  // --- 5. EQUIPOS (id_categoria: 7, maneja_serie: 1) ---
  { nombre: 'ONT - ROUTER', id_categoria: 7, codigo: 'HWA', maneja_serie: 1, es_drop: 0, categoria_liquidar: 'EQUIPO' },
  { nombre: 'ONT - ZTE', id_categoria: 7, codigo: 'ZTA', maneja_serie: 1, es_drop: 0, categoria_liquidar: 'EQUIPO' },
  { nombre: 'MESH', id_categoria: 7, codigo: 'HWB', maneja_serie: 1, es_drop: 0, categoria_liquidar: 'EQUIPO' },
  { nombre: 'MESH - ZTE', id_categoria: 7, codigo: 'ZTB', maneja_serie: 1, es_drop: 0, categoria_liquidar: 'EQUIPO' },
  { nombre: 'TELEFONO', id_categoria: 7, codigo: 'TLA', maneja_serie: 1, es_drop: 0, categoria_liquidar: 'EQUIPO' },
  { nombre: 'TV BOX - ZTE', id_categoria: 7, codigo: 'WTA', maneja_serie: 1, es_drop: 0, categoria_liquidar: 'EQUIPO' }
];

async function runImport() {
  console.log("==================================================");
  console.log("📦 CARGANDO INVENTARIO OFICIAL DE LA EMPRESA");
  console.log("==================================================");

  // 1. Limpiar tablas de inventario de prueba (respetando llaves foráneas)
  await pool.query("SET FOREIGN_KEY_CHECKS = 0");
  await pool.query("TRUNCATE TABLE producto_series");
  await pool.query("TRUNCATE TABLE trabajador_series");
  await pool.query("TRUNCATE TABLE trabajador_productos");
  await pool.query("TRUNCATE TABLE stock");
  await pool.query("TRUNCATE TABLE movimientos");
  await pool.query("TRUNCATE TABLE detalle_compras");
  await pool.query("TRUNCATE TABLE compras");
  await pool.query("TRUNCATE TABLE productos");
  await pool.query("SET FOREIGN_KEY_CHECKS = 1");

  console.log("🧹 Tablas de prueba limpiadas correctamente.");

  // 2. Insertar cada producto del inventario oficial
  let insertados = 0;
  for (const item of inventoryList) {
    const [res] = await pool.query(`
      INSERT INTO productos (codigo, nombre, id_categoria, stock_minimo, maneja_serie, es_drop, categoria_liquidar, precio_compra, estado, fecha_creacion)
      VALUES (?, ?, ?, 5, ?, ?, ?, 0.00, 'Activo', NOW())
    `, [item.codigo, item.nombre, item.id_categoria, item.maneja_serie, item.es_drop, item.categoria_liquidar]);

    const idProducto = res.insertId;

    // Inicializar registro en Almacén Central con stock 0
    await pool.query(`
      INSERT INTO stock (id_producto, id_almacen, cantidad)
      VALUES (?, 1, 0)
    `, [idProducto]);

    insertados++;
  }

  console.log(`✅ ¡Se registraron exitosamente ${insertados} productos oficiales en la base de datos!`);

  // 3. Ver resumen por categoría
  const [resumen] = await pool.query(`
    SELECT c.nombre AS categoria, COUNT(p.id_producto) AS total_productos
    FROM productos p
    JOIN categorias c ON p.id_categoria = c.id_categoria
    GROUP BY c.nombre
    ORDER BY total_productos DESC
  `);
  console.table(resumen);

  process.exit(0);
}

runImport().catch(console.error);
