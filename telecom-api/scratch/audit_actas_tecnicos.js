const db = require('../db');

async function run() {
  console.log("=== AUDITORÍA DE ACTAS LIQUIDADAS VS ACTAS ASIGNADAS A TÉCNICOS ===");
  
  // 1. Obtener todas las liquidaciones registradas
  const [liquidaciones] = await db.query(`
    SELECT 
      ol.id_liquidacion,
      ol.id_orden,
      ol.id_trabajador,
      ol.numero_acta,
      ol.tipo_trabajo_acta,
      ol.fecha_liquidacion,
      ol.liquidado_por,
      ol.estado,
      t.id_usuario,
      CONCAT(u.nombres, ' ', u.apellidos) AS nombre_tecnico,
      u.documento
    FROM orden_liquidaciones ol
    LEFT JOIN trabajadores t ON ol.id_trabajador = t.id_trabajador
    LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
    ORDER BY ol.id_liquidacion DESC
  `);

  console.log(`Total liquidaciones encontradas: ${liquidaciones.length}\n`);

  for (const liq of liquidaciones) {
    const numActa = liq.numero_acta || '';
    const sufijoActa = numActa.replace(/^001-?/i, '').trim();
    const idTrabajador = liq.id_trabajador;

    // Buscar si esta serie/acta existe en producto_series y a quién estuvo/está asignada
    const [seriesInfo] = await db.query(`
      SELECT 
        ps.id_producto_serie,
        ps.numero_serie,
        ps.estado AS estado_serie,
        p.nombre AS nombre_producto,
        ts.id_trabajador,
        ts.estado AS estado_asignacion,
        ts.fecha_asignacion,
        CONCAT(u.nombres, ' ', u.apellidos) AS asignado_a_tecnico
      FROM producto_series ps
      JOIN productos p ON ps.id_producto = p.id_producto
      LEFT JOIN trabajador_series ts ON ps.id_producto_serie = ts.id_producto_serie
      LEFT JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador
      LEFT JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE ps.numero_serie = ? 
         OR ps.numero_serie = ? 
         OR ps.numero_serie = ? 
         OR ps.numero_serie LIKE CONCAT('%', ?)
    `, [numActa, sufijoActa, `001-${sufijoActa}`, sufijoActa]);

    console.log(`--------------------------------------------------`);
    console.log(`Liquidación #${liq.id_liquidacion} | Orden #${liq.id_orden}`);
    console.log(`Técnico que Liquidó: ${liq.nombre_tecnico || liq.liquidado_por || 'ID ' + idTrabajador}`);
    console.log(`Acta Declarada: "${numActa}" | Fecha: ${liq.fecha_liquidacion} | Tipo: ${liq.tipo_trabajo_acta}`);
    
    if (seriesInfo.length === 0) {
      console.log(`❌ ALERTA: El acta "${numActa}" NO EXISTE en la base de datos de Almacén/Series.`);
    } else {
      let asignadaCorrectamente = false;
      let asignadaAOtro = false;
      let otroTecnico = '';

      for (const s of seriesInfo) {
        if (s.id_trabajador === idTrabajador) {
          asignadaCorrectamente = true;
          console.log(`✅ CONFORME: El acta "${s.numero_serie}" está asignada correctamente a ${s.asignado_a_tecnico} (Estado serie: ${s.estado_serie}, Asignación: ${s.estado_asignacion}).`);
        } else if (s.id_trabajador) {
          asignadaAOtro = true;
          otroTecnico = s.asignado_a_tecnico;
        }
      }

      if (!asignadaCorrectamente && asignadaAOtro) {
        console.log(`⚠️ DISCREPANCIA: El acta "${numActa}" NO estaba asignada al técnico de la liquidación, sino a: "${otroTecnico}".`);
      } else if (!asignadaCorrectamente && !asignadaAOtro) {
        console.log(`⚠️ DISCREPANCIA: El acta "${numActa}" existe en almacén pero NO fue asignada a este técnico.`);
      }
    }
  }

  // 2. Ver además los talonarios/actas que tiene asignados cada técnico activo
  console.log(`\n==================================================`);
  console.log(`RESUMEN DE TALONARIOS / ACTAS ASIGNADAS POR TÉCNICO EN ALMACÉN:`);
  console.log(`==================================================`);

  const [actasPorTecnico] = await db.query(`
    SELECT 
      t.id_trabajador,
      CONCAT(u.nombres, ' ', u.apellidos) AS tecnico,
      COUNT(CASE WHEN ts.estado = 'Asignada' THEN 1 END) AS actas_disponibles,
      COUNT(CASE WHEN ts.estado = 'Usada' THEN 1 END) AS actas_usadas,
      MIN(CASE WHEN ts.estado = 'Asignada' THEN ps.numero_serie END) AS primera_disponible,
      MAX(CASE WHEN ts.estado = 'Asignada' THEN ps.numero_serie END) AS ultima_disponible
    FROM trabajador_series ts
    JOIN producto_series ps ON ts.id_producto_serie = ps.id_producto_serie
    JOIN productos p ON ps.id_producto = p.id_producto
    JOIN trabajadores t ON ts.id_trabajador = t.id_trabajador
    JOIN usuarios u ON t.id_usuario = u.id_usuario
    WHERE (p.nombre LIKE '%ACTA%' OR p.nombre LIKE '%GUIA%' OR p.nombre LIKE '%TALONARIO%' OR ps.numero_serie LIKE '001-%')
    GROUP BY t.id_trabajador, tecnico
    ORDER BY tecnico ASC
  `);

  console.table(actasPorTecnico);

  process.exit(0);
}
run();
