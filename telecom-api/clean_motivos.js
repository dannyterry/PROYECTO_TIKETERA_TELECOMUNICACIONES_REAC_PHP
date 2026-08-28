const db = require('./db');

async function syncRealMotivos() {
  console.log('🔍 Extrayendo tipos de liquidación del ÚLTIMO MES de órdenes FINALIZADAS...');

  // 1. Obtener la fecha más reciente de visitas
  const [maxRes] = await db.query("SELECT MAX(fecha_visita) as maxDate FROM ordenes WHERE fecha_visita IS NOT NULL AND fecha_visita != ''");
  const maxFecha = maxRes[0]?.maxDate || '2026-12-08';
  console.log('📅 Fecha máxima detectada en BD:', maxFecha);

  // 2. Mapeo estandarizado a los Tipos de Trabajo Oficiales del Catálogo
  const homologarTipoTrabajo = (nom, tipoOriginal) => {
    const n = nom.toUpperCase();
    if (n.includes('PATCH CORD') || n.includes('PATCHCORD')) return 'VISITA EXTERNA';
    if (n.includes('CONECTOR') || n.includes('ROSETA') || n.includes('ACOPLADOR') || n.includes('ADAPTADOR')) return 'VISITA EXTERNA';
    if (n.includes('REUBICACION SIN RESERVA') || n.includes('REUBICACIÓN SIN RESERVA')) return 'REUBICACIÓN SIN RESERVA';
    if (n.includes('REUBICACION CON RESERVA') || n.includes('REUBICACIÓN CON RESERVA')) return 'REUBICACIÓN CON RESERVA';
    if (n.includes('CONDOMINIO') && n.includes('RECABLEADO')) return 'RECABLEADO EN CONDOMINIO';
    if (n.includes('RECABLEADO')) return 'RECABLEADO';
    if (n.includes('NORMALIZAC') || n.includes('ACONDICIONAMIENTO')) return 'NORMALIZACIÓN';
    if (n.includes('TRASLADO') || n.includes('TRASALDO')) return 'TRASLADO';
    if (n.includes('ADICIONAL') || n.includes('WIFI PRO') || n.includes('SPLITTER') || n.includes('APARATO TEL')) return 'ADICIONAL';
    if (n.includes('GARANTIA')) return 'GARANTIA';
    if (n.includes('PRUEBA DE SERVICIO') || n.includes('CONJUNTA') || n.includes('PEX')) return 'PEX';
    if (n.includes('ONT') || n.includes('MESH') || n.includes('WINBOX') || n.includes('FONOWIN') || n.includes('WIN TV') || n.includes('DGO')) return 'VISITA EXTERNA';

    return tipoOriginal && tipoOriginal !== '-' && tipoOriginal !== 'LOS ROJO' ? tipoOriginal : 'VISITA EXTERNA';
  };

  // 3. Consultar órdenes finalizadas recientes (excluyendo cancelaciones, reprogramaciones, suspensiones)
  const [rows] = await db.query(`
    SELECT 
      TRIM(motivo_finalizacion) AS tipo_liquidacion,
      COALESCE(NULLIF(TRIM(tipo_trabajo_asignado), ''), NULLIF(TRIM(tipo_trabajo), '')) AS tipo_trabajo,
      COUNT(*) AS total_ordenes
    FROM ordenes
    WHERE UPPER(estado) IN ('FINALIZADA', 'LIQUIDADA', 'CERRADA', 'TERMINADA')
      AND fecha_visita >= DATE_SUB('${maxFecha}', INTERVAL 60 DAY)
      AND motivo_finalizacion IS NOT NULL 
      AND motivo_finalizacion != ''
      AND motivo_finalizacion != '-'
      AND motivo_finalizacion NOT LIKE '%REASIGNAC%'
      AND motivo_finalizacion NOT LIKE '%CANCELAC%'
      AND motivo_finalizacion NOT LIKE '%CANCELAD%'
      AND motivo_finalizacion NOT LIKE '%ANULAD%'
      AND motivo_finalizacion NOT LIKE '%REPROGRAMAC%'
      AND motivo_finalizacion NOT LIKE '%IMPUTABLE%'
      AND motivo_finalizacion NOT LIKE '%SUSPENS%'
      AND motivo_finalizacion NOT LIKE '%NO REALIZAD%'
    GROUP BY tipo_liquidacion, tipo_trabajo
    ORDER BY total_ordenes DESC
  `);

  console.log(`📋 Se encontraron ${rows.length} tipos de liquidación válidos en órdenes finalizadas recientes:`);

  // 4. Limpiar tabla motivos y rellenar únicamente los motivos consolidados
  console.log('🧹 Vaciando y reconstruyendo tabla motivos...');
  await db.query('DELETE FROM motivos');

  const insertados = new Set();
  let count = 0;

  for (const r of rows) {
    let nom = r.tipo_liquidacion.trim().toUpperCase();

    // Limpieza y unificación de sinónimos / typos
    if (nom === 'CAMBIO DE CABLE PATCHCORD' || nom === 'CAMBIO DE PATCH CORD' || nom === 'PATCHCORD') {
      nom = 'CAMBIO DE CABLE PATCH CORD';
    }
    if (nom === 'CAMBIO DE CONECTOR CTO NAP' || nom === 'CAMBIO DE CONECTOR EN CTO NAP' || nom === 'CAMBIO DE CONECTOR EN CTO/NAP') {
      nom = 'CAMBIO DE CONECTOR CTO/NAP';
    }
    if (nom === 'NORMALIZACION FINALIZADA' || nom === 'NORMALIZACION FINALIZADA + BRAZO EXTENSOR') {
      nom = 'NORMALIZACIÓN';
    }

    if (insertados.has(nom)) continue;
    insertados.add(nom);

    const tipoTrabajo = homologarTipoTrabajo(nom, r.tipo_trabajo);

    // Límites de conectores (si aplica)
    let limites = null;
    if (nom.includes('CONECTOR') || nom.includes('CTO') || nom.includes('ROSETA')) {
      limites = JSON.stringify([{ id_producto: 27, cantidad: 1 }]);
    } else if (nom.includes('RECABLEADO') || nom.includes('NORMALIZAC')) {
      limites = JSON.stringify([{ id_producto: 27, cantidad: 2 }]);
    }

    await db.query(
      `INSERT INTO motivos (nombre, tipo_trabajo, precio_compra, precio_venta, limites_materiales, estado, fecha_creacion)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [nom, tipoTrabajo, '90.00', '40.00', limites, 'Activo']
    );

    count++;
    console.log(`  [${count}] ➕ "${nom}" | Tipo Trabajo: "${tipoTrabajo}" | (${r.total_ordenes} órdenes)`);
  }

  // Motivos base indispensables para liquidaciones
  const baseEsenciales = [
    { nombre: 'CAMBIO DE CABLE PATCH CORD', tipo: 'VISITA EXTERNA', lim: null },
    { nombre: 'CAMBIO DE CONECTOR EN ROSETA', tipo: 'VISITA EXTERNA', lim: JSON.stringify([{ id_producto: 27, cantidad: 1 }]) },
    { nombre: 'CAMBIO DE CONECTOR CTO/NAP', tipo: 'VISITA EXTERNA', lim: JSON.stringify([{ id_producto: 27, cantidad: 1 }]) },
    { nombre: 'CAMBIO DE EQUIPO ONT', tipo: 'VISITA EXTERNA', lim: null },
    { nombre: 'CAMBIO FONOWIN', tipo: 'VISITA EXTERNA', lim: null },
    { nombre: 'CAMBIO DE ONT ADICIONAL', tipo: 'ADICIONAL', lim: null },
    { nombre: 'REUBICACION SIN RESERVA', tipo: 'REUBICACIÓN SIN RESERVA', lim: JSON.stringify([{ id_producto: 27, cantidad: 2 }]) },
    { nombre: 'REUBICACION CON RESERVA', tipo: 'REUBICACIÓN CON RESERVA', lim: JSON.stringify([{ id_producto: 27, cantidad: 1 }]) },
    { nombre: 'RECABLEADO', tipo: 'RECABLEADO', lim: JSON.stringify([{ id_producto: 27, cantidad: 2 }]) },
    { nombre: 'RECABLEADO EN CONDOMINIO', tipo: 'RECABLEADO EN CONDOMINIO', lim: JSON.stringify([{ id_producto: 27, cantidad: 2 }]) },
    { nombre: 'NORMALIZACIÓN', tipo: 'NORMALIZACIÓN', lim: JSON.stringify([{ id_producto: 27, cantidad: 2 }]) },
    { nombre: 'TRASLADO', tipo: 'TRASLADO', lim: JSON.stringify([{ id_producto: 27, cantidad: 2 }]) },
    { nombre: 'GARANTIA', tipo: 'GARANTIA', lim: JSON.stringify([{ id_producto: 27, cantidad: 1 }]) }
  ];

  for (const b of baseEsenciales) {
    if (!insertados.has(b.nombre.toUpperCase())) {
      insertados.add(b.nombre.toUpperCase());
      await db.query(
        `INSERT INTO motivos (nombre, tipo_trabajo, precio_compra, precio_venta, limites_materiales, estado, fecha_creacion)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [b.nombre, b.tipo, '90.00', '40.00', b.lim, 'Activo']
      );
      count++;
      console.log(`  [${count}] ➕ Base: "${b.nombre}" | Tipo Trabajo: "${b.tipo}"`);
    }
  }

  const [total] = await db.query('SELECT COUNT(*) AS c FROM motivos');
  console.log(`\n✨ Tabla motivos consolidada con éxito: Total ${total[0].c} motivos activos y sin duplicados.`);
  process.exit();
}

syncRealMotivos();

