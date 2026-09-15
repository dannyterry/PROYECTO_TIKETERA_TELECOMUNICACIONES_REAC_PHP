const mysql = require('mysql2/promise');

async function fixAndCheck() {
  const p = mysql.createPool({ host: '127.0.0.1', user: 'root', password: '', database: 'corporacioncespe_cespedes' });
  
  // 1. Mostrar técnicos activos en usuarios
  const [activos] = await p.query(`
    SELECT 
      u.id_usuario, 
      CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.primer_apellido, '')) as nombre, 
      u.estado as u_estado, 
      t.id_trabajador, 
      t.estado as t_estado 
    FROM usuarios u 
    LEFT JOIN trabajadores t ON u.id_usuario = t.id_usuario 
    WHERE (u.id_rol = 2 OR u.id_usuario IN (SELECT id_usuario FROM usuarios WHERE id_rol = 2))
      AND (u.estado = 'Activo' OR u.estado IS NULL)
  `);
  console.log('TÉCNICOS ACTIVOS SEGÚN USUARIOS:');
  console.table(activos);

  // 2. Sincronizar estado de trabajadores con el de usuarios para que coincidan siempre
  await p.query(`
    UPDATE trabajadores t
    JOIN usuarios u ON t.id_usuario = u.id_usuario
    SET t.estado = u.estado
    WHERE t.estado != u.estado
  `);

  // 3. Crear registro en trabajadores para cualquier usuario activo que no lo tenga
  const [sinTrabajador] = await p.query(`
    SELECT u.id_usuario, u.estado 
    FROM usuarios u 
    LEFT JOIN trabajadores t ON u.id_usuario = t.id_usuario 
    WHERE t.id_trabajador IS NULL AND u.id_rol = 2
  `);

  for (const u of sinTrabajador) {
    await p.query(`
      INSERT INTO trabajadores (id_usuario, estado, fecha_creacion)
      VALUES (?, ?, NOW())
    `, [u.id_usuario, u.estado || 'Activo']);
  }

  console.log('✅ Sincronización de trabajadores realizada.');
  await p.end();
}

fixAndCheck();
