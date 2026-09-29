const pool = require('../db');
const { obtenerHistorialEstados, extraerTiemposDeHistorial } = require('../services/fenixScraper');

async function testCases() {
  const [techUsers] = await pool.query(
    "SELECT id_usuario, nombres, apellidos, primer_apellido, segundo_apellido FROM usuarios"
  );

  const testOrders = ['3471757', '3468586', '3472647'];

  for (const num of testOrders) {
    console.log(`\n==================================================`);
    console.log(`🔍 Probando Orden #${num}...`);
    
    // 1. Estado antes
    const [beforeRows] = await pool.query(
      "SELECT id_orden, numero, asignacion_manual, id_tecnico, tecnico_asignado, cuadrilla, usuario_ejecutor_fenix, estado FROM ordenes WHERE numero = ? LIMIT 1",
      [num]
    );
    console.log("📌 Estado ANTES en BD:", beforeRows[0] || 'No existe en BD');

    // 2. Consultar historial Fénix
    const historial = await obtenerHistorialEstados(num);
    const tiempos = extraerTiemposDeHistorial(historial);
    console.log("⏱️ Tiempos y Ejecutor extraídos de Fénix:", tiempos);

    // 3. Simular lógica de sincronización / enriquecimiento
    const ordenActual = beforeRows[0] || {};
    const esManual = Boolean(ordenActual.asignacion_manual === 1 || ordenActual.asignacion_manual === true || ordenActual.asignacion_manual === '1');

    let autoIdTecnico = ordenActual.id_tecnico;
    let autoNombreTecnico = ordenActual.tecnico_asignado;

    if (!esManual && tiempos.usuarioEjecutor) {
      const normRaw = String(tiempos.usuarioEjecutor).toUpperCase().trim();
      const found = (techUsers || []).find((u) => {
        const full1 = `${u.nombres || ''} ${u.apellidos || ''}`.toUpperCase().trim();
        const full2 = `${u.nombres || ''} ${u.primer_apellido || ''} ${u.segundo_apellido || ''}`.toUpperCase().trim();
        if (full1 && normRaw === full1) return true;
        if (full2 && normRaw === full2) return true;
        if (full1 && (normRaw.includes(full1) || full1.includes(normRaw))) return true;

        const nameParts = (u.nombres || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
        const apeParts = (u.apellidos || u.primer_apellido || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
        const hasName = nameParts.some(p => normRaw.includes(p));
        const hasApe = apeParts.some(p => normRaw.includes(p));
        return hasName && hasApe;
      });

      if (found) {
        autoIdTecnico = found.id_usuario;
        autoNombreTecnico = `${found.nombres} ${found.apellidos || found.primer_apellido || ''}`.trim();
        console.log(`✅ Coincidencia Céspedes Interna: ID ${autoIdTecnico} (${autoNombreTecnico})`);
      } else {
        autoIdTecnico = null;
        autoNombreTecnico = 'EXTERNO: ' + tiempos.usuarioEjecutor;
        console.log(`🏷️ Técnico Externo Detectado: ${autoNombreTecnico}`);
      }
    } else if (esManual) {
      console.log(`🔒 Asignación Manual Protegida (asignacion_manual = 1): Se preserva ID ${autoIdTecnico} (${autoNombreTecnico})`);
    }

    // 4. Aplicar actualización en BD
    await pool.query(
      `UPDATE ordenes 
       SET 
         hora_en_camino = COALESCE(hora_en_camino, ?),
         inicio_visita = COALESCE(inicio_visita, ?),
         fin_visita = COALESCE(fin_visita, ?),
         hora_asignacion = COALESCE(hora_asignacion, ?),
         usuario_ejecutor_fenix = COALESCE(?, usuario_ejecutor_fenix),
         id_tecnico = CASE WHEN asignacion_manual = 1 THEN id_tecnico ELSE ? END,
         tecnico_asignado = CASE WHEN asignacion_manual = 1 THEN tecnico_asignado ELSE ? END
       WHERE numero = ?`,
      [
        tiempos.horaEnCamino,
        tiempos.inicioVisita,
        tiempos.finVisita,
        tiempos.horaAsignacion,
        tiempos.usuarioEjecutor,
        autoIdTecnico,
        autoNombreTecnico,
        num
      ]
    );

    // 5. Estado después
    const [afterRows] = await pool.query(
      "SELECT id_orden, numero, asignacion_manual, id_tecnico, tecnico_asignado, cuadrilla, usuario_ejecutor_fenix, estado FROM ordenes WHERE numero = ? LIMIT 1",
      [num]
    );
    console.log("📌 Estado DESPUÉS en BD:", afterRows[0]);
  }

  process.exit(0);
}

testCases();
