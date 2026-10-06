const mysql = require('d:/proyectofinal/telecom-api/node_modules/mysql2/promise');

const prodConfig = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
};

async function auditAllProdOrders() {
  const conn = await mysql.createConnection(prodConfig);
  try {
    const [techUsers] = await conn.query("SELECT id_usuario, nombres, apellidos, primer_apellido, segundo_apellido FROM usuarios");
    
    // Find all finalized orders with an external executor or where usuario_ejecutor_fenix does not match internal users
    const [orders] = await conn.query(`
      SELECT id_orden, numero, cliente, tecnico_asignado, id_tecnico, usuario_ejecutor_fenix, estado, fecha_visita, fecha_solicitud
      FROM ordenes 
      WHERE (estado = 'Finalizada' OR estado = 'Finalizada Externa' OR estado = 'Liquidada')
        AND usuario_ejecutor_fenix IS NOT NULL 
        AND usuario_ejecutor_fenix != ''
    `);

    console.log(`🔍 Evaluando ${orders.length} órdenes finalizadas con ejecutor registrado en Producción...`);

    let fixedCount = 0;
    for (const o of orders) {
      const exec = String(o.usuario_ejecutor_fenix).toUpperCase().trim();
      const matched = techUsers.find((u) => {
        const full1 = `${u.nombres || ''} ${u.apellidos || ''}`.toUpperCase().trim();
        const full2 = `${u.nombres || ''} ${u.primer_apellido || ''} ${u.segundo_apellido || ''}`.toUpperCase().trim();
        if (full1 && (exec === full1 || exec.includes(full1) || full1.includes(exec))) return true;
        if (full2 && (exec === full2 || exec.includes(full2) || full2.includes(exec))) return true;
        const nameParts = (u.nombres || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
        const apeParts = (u.apellidos || u.primer_apellido || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
        return nameParts.some(p => exec.includes(p)) && apeParts.some(p => exec.includes(p));
      });

      // If NOT matched with internal Céspedes technician, it is EXTERNAL
      if (!matched) {
        if (o.estado !== 'Finalizada Externa' || o.id_tecnico !== null || !String(o.tecnico_asignado).startsWith('EXTERNO:')) {
          console.log(`⚠️ Corrigiendo orden #${o.numero} (${o.cliente}) -> Ejecutor Real: ${o.usuario_ejecutor_fenix} (Antes: ${o.tecnico_asignado})`);
          await conn.query(`
            UPDATE ordenes 
            SET 
              estado = 'Finalizada Externa',
              tecnico_asignado = ?,
              id_tecnico = NULL
            WHERE id_orden = ?
          `, [`EXTERNO: ${o.usuario_ejecutor_fenix}`, o.id_orden]);
          fixedCount++;
        }
      }
    }

    console.log(`\n✅ Auditoría y saneamiento en Producción completado. Órdenes corregidas: ${fixedCount}`);

  } catch (err) {
    console.error(err);
  } finally {
    await conn.end();
  }
}

auditAllProdOrders();
