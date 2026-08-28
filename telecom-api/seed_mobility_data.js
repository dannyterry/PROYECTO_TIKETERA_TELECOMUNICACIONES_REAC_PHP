const pool = require('./db');

async function seed() {
  try {
    console.log("🌱 Sincronizando vehículos y generando datos de muestra para el módulo de Movilidad...");

    // 1. Asignar trabajadores a vehículos según observaciones
    const [vehiculos] = await pool.query("SELECT id_vehiculo, observaciones, placa FROM vehiculos WHERE observaciones IS NOT NULL");
    const [trabajadores] = await pool.query(`
      SELECT t.id_trabajador, u.id_usuario,
             TRIM(CONCAT(COALESCE(u.nombres,''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''), ' ', COALESCE(u.segundo_apellido,''))) as nombre
      FROM usuarios u
      JOIN trabajadores t ON u.id_usuario = t.id_usuario
    `);

    for (const v of vehiculos) {
      const obs = (v.observaciones || '').toUpperCase().trim();
      const parts = obs.split(/[\/\n,]+/).map(p => p.trim()).filter(p => p.length > 2 && p !== 'BASE' && p !== 'SUPERVISION');
      
      for (const part of parts) {
        const words = part.split(/\s+/).filter(w => w.length > 2);
        const match = trabajadores.find(t => {
          const tNom = t.nombre.toUpperCase();
          return words.length > 0 && words.every(w => tNom.includes(w));
        });

        if (match) {
          await pool.query("UPDATE trabajadores SET id_vehiculo = ? WHERE id_trabajador = ?", [v.id_vehiculo, match.id_trabajador]);
          console.log(`✅ Asignado: ${v.placa} (${v.observaciones}) -> Trabajador #${match.id_trabajador} (${match.nombre})`);
          break;
        }
      }
    }

    // 2. Insertar inspecciones de ejemplo con datos reales
    const [tAsignados] = await pool.query(`
      SELECT t.id_trabajador, t.id_vehiculo, v.placa, u.cuadrilla,
             TRIM(CONCAT(COALESCE(u.nombres,''), ' ', COALESCE(u.primer_apellido, u.apellidos, ''))) as nombre
      FROM trabajadores t
      JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
      JOIN usuarios u ON t.id_usuario = u.id_usuario
    `);

    console.log(`Vehículos asignados listos: ${tAsignados.length}`);

    // Fechas recientes
    const hoy = new Date().toISOString().slice(0, 10);
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    let baseKm = 124500;

    for (let idx = 0; idx < tAsignados.length; idx++) {
      const t = tAsignados[idx];
      const kmIni = baseKm + (idx * 3500);
      const kmRecorridos = 45 + (idx * 12);
      const kmFin = kmIni + kmRecorridos;
      const kmEstimados = idx === 1 ? kmRecorridos - 42 : Math.round(kmRecorridos * 0.95); // Simular alerta en el 2do
      const diffKm = kmRecorridos - kmEstimados;
      const estadoAudit = idx === 0 ? 'Aprobado' : (idx === 1 ? 'Observado' : 'Pendiente');

      // Inspección de hoy
      await pool.query(`
        INSERT INTO vehiculo_inspecciones (
          id_vehiculo, id_trabajador, fecha, km_inicio, hora_inicio,
          km_fin, hora_fin, km_recorridos, km_estimados_ordenes, diferencia_km,
          observaciones_tecnico, estado_auditoria, observaciones_admin
        ) VALUES (?, ?, ?, ?, '07:05:00', ?, '19:15:00', ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE km_inicio = VALUES(km_inicio), km_fin = VALUES(km_fin)
      `, [
        t.id_vehiculo, t.id_trabajador, hoy, kmIni, kmFin, kmRecorridos, kmEstimados, diffKm,
        'Jornada completada sin incidentes mecánicos.', estadoAudit,
        idx === 1 ? 'Alerta: El técnico reportó +42 KM por encima de la ruta de sus órdenes del día.' : (idx === 0 ? 'Conforme.' : null)
      ]);

      // Carga de combustible reciente
      if (idx % 2 === 0) {
        await pool.query(`
          INSERT INTO vehiculo_combustibles (
            id_vehiculo, id_trabajador, fecha_carga, tipo_combustible,
            monto_total, galones_m3, km_momento_carga, grifo_estacion,
            numero_comprobante, tipo_comprobante, rendimiento_km_galon, registrado_por
          ) VALUES (?, ?, NOW() - INTERVAL ? DAY, 'Gasolina Regular 90', ?, ?, ?, 'Primax / Repsol', ?, 'Factura', ?, 'Administración')
        `, [
          t.id_vehiculo, t.id_trabajador, idx,
          (80 + idx * 15).toFixed(2),
          (4.8 + idx * 0.8).toFixed(2),
          kmIni + 20,
          `F001-000${4500 + idx}`,
          (28.5 + idx * 1.2).toFixed(2)
        ]);
      }
    }

    console.log("🎉 ¡Datos de prueba y sincronización de movilidad generados exitosamente!");
  } catch (error) {
    console.error("Error al poblar datos:", error);
  } finally {
    process.exit(0);
  }
}

seed();
