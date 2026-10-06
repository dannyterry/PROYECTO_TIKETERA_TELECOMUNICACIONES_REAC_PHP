const mysql = require('d:/proyectofinal/telecom-api/node_modules/mysql2/promise');
const { obtenerHistorialEstados, extraerTiemposDeHistorial } = require('d:/proyectofinal/telecom-api/services/fenixScraper');

async function testFix() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes',
    port: 3306
  });

  try {
    const numero = '3417896';
    const historial = await obtenerHistorialEstados(numero);
    console.log("Historial fetched:", historial.length, "entries");

    const tiempos = extraerTiemposDeHistorial(historial);
    console.log("Tiempos extraídos:", tiempos);

    // Get tech users
    const [techUsers] = await pool.query("SELECT id_usuario, nombres, apellidos, primer_apellido, segundo_apellido FROM usuarios");
    
    // Check match for tiempos.usuarioEjecutor
    let matchedInternalTech = null;
    if (tiempos.usuarioEjecutor) {
      const norm = tiempos.usuarioEjecutor.toUpperCase().trim();
      matchedInternalTech = (techUsers || []).find((u) => {
        const full1 = `${u.nombres || ''} ${u.apellidos || ''}`.toUpperCase().trim();
        const full2 = `${u.nombres || ''} ${u.primer_apellido || ''} ${u.segundo_apellido || ''}`.toUpperCase().trim();
        if (full1 && (norm === full1 || norm.includes(full1) || full1.includes(norm))) return true;
        if (full2 && (norm === full2 || norm.includes(full2) || full2.includes(norm))) return true;
        const nameParts = (u.nombres || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
        const apeParts = (u.apellidos || u.primer_apellido || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
        return nameParts.some(p => norm.includes(p)) && apeParts.some(p => norm.includes(p));
      });
    }

    console.log("Matched internal tech for executor:", matchedInternalTech ? matchedInternalTech.nombres : "NONE (EXTERNAL)");

    // Update the DB
    let nuevoEstado = 'Finalizada Externa';
    let nuevoTecnico = 'EXTERNO: ' + tiempos.usuarioEjecutor;
    let nuevoIdTecnico = null;

    if (matchedInternalTech) {
      nuevoEstado = 'Finalizada';
      nuevoTecnico = `${matchedInternalTech.nombres} ${matchedInternalTech.apellidos || matchedInternalTech.primer_apellido || ''}`.trim();
      nuevoIdTecnico = matchedInternalTech.id_usuario;
    }

    await pool.query(`
      UPDATE ordenes 
      SET 
        estado = ?,
        tecnico_asignado = ?,
        id_tecnico = ?,
        usuario_ejecutor_fenix = ?,
        historial_estados = ?,
        hora_en_camino = COALESCE(hora_en_camino, ?),
        inicio_visita = COALESCE(inicio_visita, ?),
        fin_visita = COALESCE(fin_visita, ?),
        hora_asignacion = COALESCE(hora_asignacion, ?)
      WHERE numero = ?
    `, [
      nuevoEstado,
      nuevoTecnico,
      nuevoIdTecnico,
      tiempos.usuarioEjecutor,
      JSON.stringify(historial),
      tiempos.horaEnCamino,
      tiempos.inicioVisita,
      tiempos.finVisita,
      tiempos.horaAsignacion,
      numero
    ]);

    const [updated] = await pool.query("SELECT id_orden, numero, cliente, tecnico_asignado, id_tecnico, usuario_ejecutor_fenix, estado FROM ordenes WHERE numero = ?", [numero]);
    console.log("Orden actualizada:", updated[0]);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

testFix();
