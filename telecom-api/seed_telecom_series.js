const db = require('./db');

async function seedTelecomSeries() {
  console.log('🚀 Actualizando series de telecomunicaciones realistas...');

  const equiposSetup = [
    {
      id_producto: 37, // ONT ZTE F670L DUAL BAND WIFI 6
      prefix: 'ZTEGC89A',
      start: 101,
      count: 30,
      assignedToBrayan: 3
    },
    {
      id_producto: 38, // ROUTER REPETIDOR MESH ZTE H196A
      prefix: 'ZTEGH196',
      start: 201,
      count: 30,
      assignedToBrayan: 3
    },
    {
      id_producto: 39, // DECODIFICADOR WIN TV 4K ANDROID
      prefix: 'WINTV4K',
      start: 301,
      count: 30,
      assignedToBrayan: 3
    },
    {
      id_producto: 1, // ONT genérica
      prefix: 'ZTEGC7A1',
      start: 401,
      count: 30,
      assignedToBrayan: 3
    },
    {
      id_producto: 2, // MESH genérico
      prefix: 'MESHWIN',
      start: 501,
      count: 20,
      assignedToBrayan: 0
    },
    {
      id_producto: 3, // TV BOX genérico
      prefix: 'TVBOXWIN',
      start: 601,
      count: 20,
      assignedToBrayan: 0
    }
  ];

  const idBrayan = 21;

  for (const eq of equiposSetup) {
    // 1. Limpiar series anteriores de este producto
    const [existingPs] = await db.query('SELECT id_producto_serie FROM producto_series WHERE id_producto = ?', [eq.id_producto]);
    for (const ps of existingPs) {
      await db.query('DELETE FROM trabajador_series WHERE id_producto_serie = ?', [ps.id_producto_serie]);
    }
    await db.query('DELETE FROM producto_series WHERE id_producto = ?', [eq.id_producto]);

    // 2. Insertar las nuevas series
    for (let i = 0; i < eq.count; i++) {
      const numSerie = `${eq.prefix}${String(eq.start + i).padStart(4, '0')}`;
      const isAssigned = i < eq.assignedToBrayan;
      const estadoPs = isAssigned ? 'RESERVADO' : 'DISPONIBLE';

      const [insPs] = await db.query(
        'INSERT INTO producto_series (id_producto, id_almacen, numero_serie, estado, fecha_ingreso) VALUES (?, 1, ?, ?, NOW())',
        [eq.id_producto, numSerie, estadoPs]
      );

      if (isAssigned) {
        await db.query(
          'INSERT INTO trabajador_series (id_trabajador, id_producto, id_producto_serie, estado, fecha_asignacion) VALUES (?, ?, ?, "Asignada", NOW())',
          [idBrayan, eq.id_producto, insPs.insertId]
        );
      }
    }

    // 3. Actualizar stock central y stock del técnico
    const stockCentral = eq.count - eq.assignedToBrayan;
    const [stExist] = await db.query('SELECT id_stock FROM stock WHERE id_producto = ? AND id_almacen = 1', [eq.id_producto]);
    if (stExist.length > 0) {
      await db.query('UPDATE stock SET cantidad = ? WHERE id_stock = ?', [stockCentral, stExist[0].id_stock]);
    } else {
      await db.query('INSERT INTO stock (id_producto, id_almacen, cantidad) VALUES (?, 1, ?)', [eq.id_producto, stockCentral]);
    }

    if (eq.assignedToBrayan > 0) {
      const [tpExist] = await db.query('SELECT id_trabajador_producto FROM trabajador_productos WHERE id_trabajador = ? AND id_producto = ?', [idBrayan, eq.id_producto]);
      if (tpExist.length > 0) {
        await db.query('UPDATE trabajador_productos SET stock = ? WHERE id_trabajador_producto = ?', [eq.assignedToBrayan, tpExist[0].id_trabajador_producto]);
      } else {
        await db.query('INSERT INTO trabajador_productos (id_trabajador, id_producto, stock, fecha_creacion) VALUES (?, ?, ?, NOW())', [idBrayan, eq.id_producto, eq.assignedToBrayan]);
      }
    }
  }

  console.log('✅ ¡Series de telecomunicaciones (ZTE GPON, MESH, TV 4K) generadas y asignadas con éxito!');
  process.exit();
}

seedTelecomSeries().catch(err => {
  console.error(err);
  process.exit(1);
});
