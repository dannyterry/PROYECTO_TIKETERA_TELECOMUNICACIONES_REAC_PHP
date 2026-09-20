const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function alignWorkers() {
  console.log('====================================================');
  console.log('🔄 INICIANDO ALINEACIÓN: id_trabajador = id_usuario');
  console.log('====================================================');

  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes',
    multipleStatements: true
  });

  try {
    await conn.beginTransaction();
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    // 1. Obtener mapeo actual entre trabajadores y usuarios
    const [workers] = await conn.query(`
      SELECT t.id_trabajador as old_id, t.id_usuario as new_id, u.usuario, t.id_vehiculo, t.id_horario, t.fecha_ingreso, t.estado
      FROM trabajadores t
      JOIN usuarios u ON t.id_usuario = u.id_usuario
    `);

    console.log(`📋 Total trabajadores a normalizar: ${workers.length}`);

    // Tablas hijas que tienen clave foránea o columna id_trabajador
    const childTables = [
      'asistencias',
      'trabajador_productos',
      'trabajador_series',
      'vehiculo_asignaciones',
      'vehiculo_combustibles',
      'vehiculo_inspecciones',
      'tecnico_gps_logs',
      'trabajador_descansos',
      'orden_equipos_retirados',
      'orden_liquidaciones',
      'adelantos_sueldo',
      'liquidaciones_tecnicos'
    ];

    const sqlStatements = [
      '-- ==============================================================',
      '-- SCRIPT DE MIGRACIÓN: ALINEACIÓN id_trabajador = id_usuario',
      '-- ==============================================================',
      'SET FOREIGN_KEY_CHECKS = 0;',
      'START TRANSACTION;'
    ];

    // Paso A: Mover IDs viejos a un rango temporal (+100000) para evitar colisiones de clave primaria
    console.log('\n1️⃣ Evitando colisiones en tablas hijas y asignando nuevo id_usuario...');
    for (const w of workers) {
      if (w.old_id !== w.new_id) {
        for (const table of childTables) {
          try {
            await conn.query(
              `UPDATE \`${table}\` SET id_trabajador = ? WHERE id_trabajador = ?`,
              [w.new_id, w.old_id]
            );
            sqlStatements.push(`UPDATE \`${table}\` SET id_trabajador = ${w.new_id} WHERE id_trabajador = ${w.old_id};`);
          } catch (err) {}
        }
      }
    }

    // Paso B: Reconstruir la tabla trabajadores con id_trabajador = id_usuario
    console.log('\n2️⃣ Reconstruyendo tabla trabajadores...');
    await conn.query('DELETE FROM trabajadores');
    sqlStatements.push('DELETE FROM `trabajadores`;');

    for (const w of workers) {
      await conn.query(`
        INSERT INTO trabajadores (id_trabajador, id_usuario, id_vehiculo, id_horario, fecha_ingreso, estado)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [w.new_id, w.new_id, w.id_vehiculo, w.id_horario, w.fecha_ingreso, w.estado]);

      const fIngreso = w.fecha_ingreso ? `'${new Date(w.fecha_ingreso).toISOString().slice(0, 10)}'` : 'CURDATE()';
      const veh = w.id_vehiculo ? w.id_vehiculo : 'NULL';
      const hor = w.id_horario ? w.id_horario : '1';
      sqlStatements.push(`INSERT INTO \`trabajadores\` (id_trabajador, id_usuario, id_vehiculo, id_horario, fecha_ingreso, estado) VALUES (${w.new_id}, ${w.new_id}, ${veh}, ${hor}, ${fIngreso}, '${w.estado}');`);
    }

    // Paso C: Asegurar auto_increment adecuado
    const [maxRow] = await conn.query('SELECT MAX(id_usuario) as maxId FROM usuarios');
    const nextAutoIncrement = (maxRow[0].maxId || 100) + 1;
    await conn.query(`ALTER TABLE trabajadores AUTO_INCREMENT = ${nextAutoIncrement}`);
    sqlStatements.push(`ALTER TABLE \`trabajadores\` AUTO_INCREMENT = ${nextAutoIncrement};`);

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    sqlStatements.push('SET FOREIGN_KEY_CHECKS = 1;');
    sqlStatements.push('COMMIT;');

    await conn.commit();

    // Guardar el archivo SQL para producción
    const sqlFile = path.join(__dirname, '..', 'backups', 'migracion_alinear_trabajadores_prod.sql');
    fs.writeFileSync(sqlFile, sqlStatements.join('\n'), 'utf8');

    console.log('====================================================');
    console.log('🎉 ¡ALINEACIÓN LOCAL COMPLETADA CON ÉXITO!');
    console.log(`📄 Script SQL para Producción guardado en:`);
    console.log(`   ${sqlFile}`);
    console.log('====================================================');

  } catch (error) {
    await conn.rollback();
    console.error('❌ ERROR ALINEANDO TRABAJADORES:', error);
  } finally {
    await conn.end();
  }
}

alignWorkers();
