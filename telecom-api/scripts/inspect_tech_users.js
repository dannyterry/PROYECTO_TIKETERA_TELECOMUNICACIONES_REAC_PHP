const pool = require('../db.js');

async function inspect() {
  try {
    const [roles] = await pool.query('SELECT * FROM roles');
    console.log('ROLES EN DB:', roles);

    const [usuarios] = await pool.query(`
      SELECT u.id_usuario, u.usuario, u.nombres, u.primer_apellido, u.apellidos, u.estado, u.id_rol, r.nombre as rol_nombre, u.cuadrilla 
      FROM usuarios u 
      LEFT JOIN roles r ON u.id_rol = r.id_rol
    `);
    console.log('\nTOTAL USUARIOS EN DB:', usuarios.length);

    const [trabCols] = await pool.query('DESCRIBE trabajadores');
    console.log('\nCOLUMNAS DE TRABAJADORES:', trabCols.map(c => c.Field));

    const [userCols] = await pool.query('DESCRIBE usuarios');
    console.log('\nCOLUMNAS DE USUARIOS:', userCols.map(c => c.Field));

    const [trabajadores] = await pool.query(`
      SELECT t.id_trabajador, t.id_usuario, t.estado as trab_estado,
             u.nombres, u.primer_apellido, u.apellidos, u.estado as user_estado, u.id_rol, r.nombre as rol_nombre, u.cuadrilla
      FROM trabajadores t
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      LEFT JOIN roles r ON u.id_rol = r.id_rol
    `);
    console.log('\nTOTAL TRABAJADORES EN DB:', trabajadores.length);

    console.log('\nDETALLE DE TRABAJADORES:');
    trabajadores.forEach(t => {
      console.log(`id_trab: ${t.id_trabajador}, id_user: ${t.id_usuario}, nombre: ${t.nombres} ${t.primer_apellido || t.apellidos}, trab_estado: ${t.trab_estado}, user_estado: ${t.user_estado}, rol: ${t.rol_nombre}, cuadrilla: ${t.cuadrilla}`);
    });

    const [usuariosActivos] = await pool.query(`
      SELECT u.id_usuario, u.nombres, u.primer_apellido, u.apellidos, u.estado, u.id_rol, r.nombre as rol_nombre, u.cuadrilla
      FROM usuarios u
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      WHERE u.estado = 'Activo' OR u.estado = 1
    `);
    console.log('\nTOTAL USUARIOS ACTIVOS:', usuariosActivos.length);
    console.log('POR ROL:');
    const rolCount = {};
    usuariosActivos.forEach(u => {
      rolCount[u.rol_nombre] = (rolCount[u.rol_nombre] || 0) + 1;
    });
    console.log(rolCount);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

inspect();
