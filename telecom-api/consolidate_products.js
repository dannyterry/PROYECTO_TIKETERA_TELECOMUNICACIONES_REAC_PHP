const db = require('./db');

async function consolidateProducts() {
  console.log('🚀 Consolidando catálogo de productos para evitar duplicados...');

  // 1. Inactivar y limpiar stock de duplicados antiguos (ids 1, 2, 3, 4, 5)
  const idsToInactivate = [1, 2, 3, 4, 5];
  for (const id of idsToInactivate) {
    const [psRows] = await db.query('SELECT id_producto_serie FROM producto_series WHERE id_producto = ?', [id]);
    for (const ps of psRows) {
      await db.query('DELETE FROM trabajador_series WHERE id_producto_serie = ?', [ps.id_producto_serie]);
    }
    await db.query('DELETE FROM producto_series WHERE id_producto = ?', [id]);
    await db.query('DELETE FROM stock WHERE id_producto = ?', [id]);
    await db.query('DELETE FROM trabajador_productos WHERE id_producto = ?', [id]);
    await db.query('UPDATE productos SET estado = "Inactivo" WHERE id_producto = ?', [id]);
  }

  // 2. Asegurar que los 3 equipos oficiales tengan sus 30 series (3 en técnico Brayan, 27 en almacén central)
  const officialEquipos = [
    { id_producto: 37, prefix: 'ZTEGC89A', start: 101, name: 'ONT ZTE F670L DUAL BAND WIFI 6' },
    { id_producto: 38, prefix: 'ZTEGH196A', start: 201, name: 'ROUTER REPETIDOR MESH ZTE H196A' },
    { id_producto: 39, prefix: 'WINTV4K', start: 301, name: 'DECODIFICADOR WIN TV 4K ANDROID' }
  ];

  const idBrayan = 21;

  for (const eq of officialEquipos) {
    // Asegurar estado Activo
    await db.query('UPDATE productos SET estado = "Activo" WHERE id_producto = ?', [eq.id_producto]);

    // Limpiar series existentes para generar exactamente 30 limpias
    const [psRows] = await db.query('SELECT id_producto_serie FROM producto_series WHERE id_producto = ?', [eq.id_producto]);
    for (const ps of psRows) {
      await db.query('DELETE FROM trabajador_series WHERE id_producto_serie = ?', [ps.id_producto_serie]);
    }
    await db.query('DELETE FROM producto_series WHERE id_producto = ?', [eq.id_producto]);

    for (let i = 1; i <= 30; i++) {
      const sn = `${eq.prefix}${String(eq.start + i - 1).padStart(4, '0')}`;
      const isAssigned = i <= 3; // 3 asignadas a Brayan
      const estadoPs = isAssigned ? 'RESERVADO' : 'DISPONIBLE';

      const [insPs] = await db.query(
        'INSERT INTO producto_series (id_producto, id_almacen, numero_serie, estado, fecha_ingreso) VALUES (?, 1, ?, ?, NOW())',
        [eq.id_producto, sn, estadoPs]
      );

      if (isAssigned) {
        await db.query(
          'INSERT INTO trabajador_series (id_trabajador, id_producto, id_producto_serie, estado, fecha_asignacion) VALUES (?, ?, ?, "Asignada", NOW())',
          [idBrayan, eq.id_producto, insPs.insertId]
        );
      }
    }

    // Actualizar stock central = 27
    const [stExist] = await db.query('SELECT id_stock FROM stock WHERE id_producto = ? AND id_almacen = 1', [eq.id_producto]);
    if (stExist.length > 0) {
      await db.query('UPDATE stock SET cantidad = 27 WHERE id_stock = ?', [stExist[0].id_stock]);
    } else {
      await db.query('INSERT INTO stock (id_producto, id_almacen, cantidad) VALUES (?, 1, 27)', [eq.id_producto]);
    }

    // Actualizar stock de Brayan = 3
    const [tpExist] = await db.query('SELECT id_trabajador_producto FROM trabajador_productos WHERE id_trabajador = ? AND id_producto = ?', [idBrayan, eq.id_producto]);
    if (tpExist.length > 0) {
      await db.query('UPDATE trabajador_productos SET stock = 3 WHERE id_trabajador_producto = ?', [tpExist[0].id_trabajador_producto]);
    } else {
      await db.query('INSERT INTO trabajador_productos (id_trabajador, id_producto, stock, fecha_creacion) VALUES (?, ?, 3, NOW())', [idBrayan, eq.id_producto]);
    }
  }

  console.log('✅ Catálogo consolidado y sincronizado perfectamente al 100%!');
  process.exit();
}

consolidateProducts().catch(err => {
  console.error(err);
  process.exit(1);
});
