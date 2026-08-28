const db = require('./db');

async function seedStock() {
  console.log('🚀 Iniciando carga de stock de prueba...');

  // 1. Catálogo completo de productos
  const productosData = [
    // EQUIPOS (id_categoria: 7)
    { codigo: 'EQ-ONT-01', nombre: 'ONT ZTE F670L DUAL BAND WIFI 6', id_categoria: 7, maneja_serie: 1, es_drop: 0, precio_compra: 140.00, stock_minimo: 10, categoria_liquidar: 'EQUIPO' },
    { codigo: 'EQ-MESH-01', nombre: 'ROUTER REPETIDOR MESH ZTE H196A', id_categoria: 7, maneja_serie: 1, es_drop: 0, precio_compra: 95.00, stock_minimo: 5, categoria_liquidar: 'EQUIPO' },
    { codigo: 'EQ-TV-01', nombre: 'DECODIFICADOR WIN TV 4K ANDROID', id_categoria: 7, maneja_serie: 1, es_drop: 0, precio_compra: 120.00, stock_minimo: 5, categoria_liquidar: 'EQUIPO' },

    // MATERIALES (id_categoria: 1)
    { codigo: 'PROD-00027', nombre: 'CONECTOR SC/APC FAST CONNECTOR', id_categoria: 1, maneja_serie: 0, es_drop: 0, precio_compra: 3.50, stock_minimo: 500, categoria_liquidar: 'MATERIAL' },
    { codigo: 'PROD-00029', nombre: 'CABLE DROP FTTH 1 HILO G657A2', id_categoria: 1, maneja_serie: 0, es_drop: 1, precio_compra: 0.35, stock_minimo: 5000, categoria_liquidar: 'MATERIAL' },
    { codigo: 'PROD-00028', nombre: 'PATCH CORD FIBRA OPTICA SC/APC-SC/APC 3M', id_categoria: 1, maneja_serie: 0, es_drop: 0, precio_compra: 4.50, stock_minimo: 100, categoria_liquidar: 'MATERIAL' },
    { codigo: 'MAT-ROS-01', nombre: 'ROSETA OPTICA 2 PUERTOS CON ADAPTADOR', id_categoria: 1, maneja_serie: 0, es_drop: 0, precio_compra: 5.00, stock_minimo: 100, categoria_liquidar: 'MATERIAL' },
    { codigo: 'MAT-ALC-01', nombre: 'ALCOHOL ISOPROPILICO 99.9% 1L', id_categoria: 1, maneja_serie: 0, es_drop: 0, precio_compra: 18.00, stock_minimo: 10, categoria_liquidar: 'MATERIAL' },
    { codigo: 'MAT-KIM-01', nombre: 'PAÑOS DE LIMPIEZA KIMWIPES (CAJA 280)', id_categoria: 1, maneja_serie: 0, es_drop: 0, precio_compra: 22.00, stock_minimo: 10, categoria_liquidar: 'MATERIAL' },
    { codigo: 'MAT-CIN-01', nombre: 'CINTA AISLANTE 3M 1700 NEGRA', id_categoria: 1, maneja_serie: 0, es_drop: 0, precio_compra: 4.00, stock_minimo: 30, categoria_liquidar: 'MATERIAL' },

    // HERRAMIENTAS (id_categoria: 12)
    { codigo: 'HER-OPM-01', nombre: 'POWER METER OPTICO DIGITAL (-70 a +10 dBm)', id_categoria: 12, maneja_serie: 0, es_drop: 0, precio_compra: 85.00, stock_minimo: 5, categoria_liquidar: 'EQUIPO' },
    { codigo: 'HER-VFL-01', nombre: 'LOCALIZADOR VISUAL DE FALLAS (VFL 30MW)', id_categoria: 12, maneja_serie: 0, es_drop: 0, precio_compra: 45.00, stock_minimo: 5, categoria_liquidar: 'EQUIPO' },
    { codigo: 'HER-PELD-01', nombre: 'PELADORA DE CABLE DROP FTTH', id_categoria: 12, maneja_serie: 0, es_drop: 0, precio_compra: 25.00, stock_minimo: 5, categoria_liquidar: 'MATERIAL' },
    { codigo: 'HER-PELC-01', nombre: 'PELADORA DE FIBRA CLAUSS 3 AGUJEROS', id_categoria: 12, maneja_serie: 0, es_drop: 0, precio_compra: 35.00, stock_minimo: 5, categoria_liquidar: 'MATERIAL' },
    { codigo: 'HER-FUS-01', nombre: 'FUSIONADORA DE FIBRA OPTICA 6 MOTORES', id_categoria: 12, maneja_serie: 1, es_drop: 0, precio_compra: 3500.00, stock_minimo: 2, categoria_liquidar: 'EQUIPO' },

    // UNIFORMES / EPP (id_categoria: 13)
    { codigo: 'UNIF-001', nombre: 'POLO MANGA LARGA CON CINTA REFLECTIVA', id_categoria: 13, maneja_serie: 0, es_drop: 0, precio_compra: 35.00, stock_minimo: 20, categoria_liquidar: 'MATERIAL' },
    { codigo: 'UNIF-002', nombre: 'PANTALON DRILL CON CINTAS REFLECTIVAS', id_categoria: 13, maneja_serie: 0, es_drop: 0, precio_compra: 55.00, stock_minimo: 20, categoria_liquidar: 'MATERIAL' },
    { codigo: 'UNIF-003', nombre: 'CHALECO DE SEGURIDAD GEOLOGO ALTA VISIBILIDAD', id_categoria: 13, maneja_serie: 0, es_drop: 0, precio_compra: 45.00, stock_minimo: 15, categoria_liquidar: 'MATERIAL' },
    { codigo: 'UNIF-004', nombre: 'CASCO DE SEGURIDAD BLANCO DIELECTRICO', id_categoria: 13, maneja_serie: 0, es_drop: 0, precio_compra: 35.00, stock_minimo: 10, categoria_liquidar: 'MATERIAL' },
    { codigo: 'UNIF-005', nombre: 'BOTAS DIELECTRICAS PUNTA DE BAQUELITA', id_categoria: 13, maneja_serie: 0, es_drop: 0, precio_compra: 120.00, stock_minimo: 10, categoria_liquidar: 'MATERIAL' },

    // VEHICULO (id_categoria: 10)
    { codigo: 'VEH-EXT-01', nombre: 'EXTINTOR PQS 6KG CON SOPORTE', id_categoria: 10, maneja_serie: 0, es_drop: 0, precio_compra: 65.00, stock_minimo: 5, categoria_liquidar: 'MATERIAL' },
    { codigo: 'PROD-00017', nombre: 'BOTIQUIN DE PRIMEROS AUXILIOS REGLAMENTARIO', id_categoria: 10, maneja_serie: 0, es_drop: 0, precio_compra: 50.00, stock_minimo: 5, categoria_liquidar: 'MATERIAL' },
    { codigo: 'PROD-00018', nombre: 'CONOS DE SEGURIDAD 28" CON CINTA REFLECTIVA', id_categoria: 10, maneja_serie: 0, es_drop: 0, precio_compra: 25.00, stock_minimo: 10, categoria_liquidar: 'MATERIAL' },

    // TALONARIOS Y GUIAS (id_categoria: 11)
    { codigo: 'PROD-ACTA01', nombre: 'ACTAS DE SERVICIO WIN / GUIAS', id_categoria: 11, maneja_serie: 1, es_drop: 0, precio_compra: 2.00, stock_minimo: 100, categoria_liquidar: 'EQUIPO' }
  ];

  for (const p of productosData) {
    const [exist] = await db.query('SELECT id_producto FROM productos WHERE codigo = ? OR nombre = ?', [p.codigo, p.nombre]);
    let prodId;
    if (exist.length > 0) {
      prodId = exist[0].id_producto;
      await db.query(
        'UPDATE productos SET nombre = ?, id_categoria = ?, maneja_serie = ?, es_drop = ?, precio_compra = ?, stock_minimo = ?, categoria_liquidar = ? WHERE id_producto = ?',
        [p.nombre, p.id_categoria, p.maneja_serie, p.es_drop, p.precio_compra, p.stock_minimo, p.categoria_liquidar, prodId]
      );
    } else {
      const [ins] = await db.query(
        'INSERT INTO productos (codigo, nombre, id_categoria, maneja_serie, es_drop, precio_compra, stock_minimo, categoria_liquidar, estado, fecha_creacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "Activo", NOW())',
        [p.codigo, p.nombre, p.id_categoria, p.maneja_serie, p.es_drop, p.precio_compra, p.stock_minimo, p.categoria_liquidar]
      );
      prodId = ins.insertId;
    }

    // Actualizar Stock Central (id_almacen = 1)
    let cantCentral = 50;
    if (p.nombre.includes('CONECTOR')) cantCentral = 2500;
    else if (p.nombre.includes('DROP')) cantCentral = 45000;
    else if (p.nombre.includes('PATCH') || p.nombre.includes('PASH')) cantCentral = 1200;
    else if (p.nombre.includes('ROSETA')) cantCentral = 600;
    else if (p.nombre.includes('ACTA')) cantCentral = 500;
    else if (p.maneja_serie) cantCentral = 30;

    const [stExist] = await db.query('SELECT id_stock FROM stock WHERE id_producto = ? AND id_almacen = 1', [prodId]);
    if (stExist.length > 0) {
      await db.query('UPDATE stock SET cantidad = ? WHERE id_stock = ?', [cantCentral, stExist[0].id_stock]);
    } else {
      await db.query('INSERT INTO stock (id_producto, id_almacen, cantidad) VALUES (?, 1, ?)', [prodId, cantCentral]);
    }

    // Series disponibles para equipos en Almacén Central
    if (p.maneja_serie && !p.nombre.includes('ACTA')) {
      for (let s = 1; s <= 10; s++) {
        const numSerie = `${p.codigo.replace(/[^A-Z]/g, '')}2026${String(s).padStart(4, '0')}`;
        await db.query(
          'INSERT INTO producto_series (id_producto, id_almacen, numero_serie, estado, fecha_ingreso) VALUES (?, 1, ?, "DISPONIBLE", NOW()) ON DUPLICATE KEY UPDATE estado = "DISPONIBLE"',
          [prodId, numSerie]
        );
      }
    }
  }

  // 2. Asignar Stock Completo a Brayan Jesús Canelón (id_trabajador: 21)
  const idBrayan = 21;
  const [prodsAll] = await db.query('SELECT id_producto, codigo, nombre, maneja_serie, es_drop FROM productos');

  // Limpiar dotación anterior de Brayan para prueba limpia y completa
  await db.query('DELETE FROM trabajador_productos WHERE id_trabajador = ?', [idBrayan]);
  await db.query('DELETE FROM trabajador_series WHERE id_trabajador = ?', [idBrayan]);

  // Asignar insumos y materiales
  for (const pr of prodsAll) {
    let cantTec = 0;
    if (pr.nombre.includes('CONECTOR')) cantTec = 50;
    else if (pr.nombre.includes('DROP')) cantTec = 800;
    else if (pr.nombre.includes('PATCH') || pr.nombre.includes('PASH')) cantTec = 25;
    else if (pr.nombre.includes('ROSETA')) cantTec = 15;
    else if (pr.nombre.includes('ALCOHOL')) cantTec = 2;
    else if (pr.nombre.includes('KIMWIPES')) cantTec = 1;
    else if (pr.nombre.includes('CINTA')) cantTec = 3;
    else if (pr.nombre.includes('POWER METER')) cantTec = 1;
    else if (pr.nombre.includes('LOCALIZADOR') || pr.nombre.includes('VFL')) cantTec = 1;
    else if (pr.nombre.includes('PELADORA')) cantTec = 1;
    else if (pr.nombre.includes('CHALECO')) cantTec = 1;
    else if (pr.nombre.includes('CASCO')) cantTec = 1;
    else if (pr.nombre.includes('BOTIQUIN')) cantTec = 1;
    else if (pr.nombre.includes('EXTINTOR')) cantTec = 1;
    else if (pr.nombre.includes('CONO')) cantTec = 4;
    else if (pr.nombre.includes('ACTA')) cantTec = 50;
    else if (pr.maneja_serie) cantTec = 3;

    if (cantTec > 0) {
      await db.query(
        'INSERT INTO trabajador_productos (id_trabajador, id_producto, stock, fecha_creacion) VALUES (?, ?, ?, NOW())',
        [idBrayan, pr.id_producto, cantTec]
      );

      // Si es equipo con serie (ONT / MESH), insertar series
      if (pr.maneja_serie && !pr.nombre.includes('ACTA')) {
        for (let k = 1; k <= cantTec; k++) {
          const sn = `TEC-${pr.codigo.replace(/[^A-Z]/g, '')}-${String(k).padStart(3, '0')}`;
          // 1. Asegurar en producto_series
          let [psRow] = await db.query('SELECT id_producto_serie FROM producto_series WHERE numero_serie = ?', [sn]);
          let idPs;
          if (psRow.length > 0) {
            idPs = psRow[0].id_producto_serie;
          } else {
            const [insPs] = await db.query(
              'INSERT INTO producto_series (id_producto, id_almacen, numero_serie, estado, fecha_ingreso) VALUES (?, 1, ?, "RESERVADO", NOW())',
              [pr.id_producto, sn]
            );
            idPs = insPs.insertId;
          }

          // 2. Insertar en trabajador_series
          await db.query(
            'INSERT INTO trabajador_series (id_trabajador, id_producto, id_producto_serie, estado, fecha_asignacion) VALUES (?, ?, ?, "Asignada", NOW()) ON DUPLICATE KEY UPDATE estado = "Asignada"',
            [idBrayan, pr.id_producto, idPs]
          );
        }
      }

      // Si es Talonario de Actas, asignar rango correlativo de 50 actas
      if (pr.nombre.includes('ACTA')) {
        for (let a = 4201; a <= 4250; a++) {
          const numActa = `001-${String(a).padStart(5, '0')}`;
          let [psRow] = await db.query('SELECT id_producto_serie FROM producto_series WHERE numero_serie = ?', [numActa]);
          let idPs;
          if (psRow.length > 0) {
            idPs = psRow[0].id_producto_serie;
          } else {
            const [insPs] = await db.query(
              'INSERT INTO producto_series (id_producto, id_almacen, numero_serie, estado, fecha_ingreso) VALUES (?, 1, ?, "RESERVADO", NOW())',
              [pr.id_producto, numActa]
            );
            idPs = insPs.insertId;
          }

          await db.query(
            'INSERT INTO trabajador_series (id_trabajador, id_producto, id_producto_serie, estado, fecha_asignacion) VALUES (?, ?, ?, "Asignada", NOW()) ON DUPLICATE KEY UPDATE estado = "Asignada"',
            [idBrayan, pr.id_producto, idPs]
          );
        }
      }
    }
  }

  console.log('✅ ¡Stock de prueba poblado exitosamente en Almacén Central y para el técnico Brayan Canelón!');
  process.exit();
}

seedStock().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
