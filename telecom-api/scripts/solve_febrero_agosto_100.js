const pool = require('../db');

async function solve100() {
  try {
    console.log("==========================================================================");
    console.log("   🎯 BUSCANDO EL CALCE 100.00% EXACTO PARA FEBRERO Y AGOSTO 2026");
    console.log("==========================================================================\n");

    const oficial = {
      2: { av_asig: 1050, av_fin: 701, av_ef: 66.76, pv_asig: 232, pv_fin: 162, pv_ef: 69.83 },
      8: { av_asig: 1129, av_fin: 915, av_ef: 81.05, pv_asig: 137, pv_fin: 111, pv_ef: 81.02 }
    };

    for (const m of [2, 8]) {
      const nombre = m === 2 ? "FEBRERO" : "AGOSTO";
      const of = oficial[m];

      // Ver todas las órdenes de este mes
      const [ordenes] = await pool.query(`
        SELECT 
          id_orden,
          numero,
          codigo_seguimiento,
          cliente,
          fecha_visita,
          cuadrilla,
          tipo_trabajo,
          tipo_trabajo_asignado,
          motivo_finalizacion,
          producto,
          estado
        FROM ordenes
        WHERE YEAR(fecha_visita) = 2026 AND MONTH(fecha_visita) = ?
          AND (cuadrilla IS NULL OR (TRIM(cuadrilla) NOT REGEXP '^[oO][0-9]+' AND TRIM(cuadrilla) NOT REGEXP '^[oO] ' AND TRIM(cuadrilla) NOT LIKE 'ORDENAMIENTO%'))
          AND (cliente IS NULL OR (cliente NOT LIKE '%NORMALIZACI%' AND cliente NOT LIKE '%CONJUNTA PEXT%'))
          AND (tipo_trabajo IS NULL OR tipo_trabajo NOT LIKE '%ORDENAMIENTO%')
          AND (motivo_finalizacion IS NULL OR motivo_finalizacion NOT LIKE '%CONJUNTA PEXT%')
          AND estado != 'Anulada' AND estado NOT LIKE '%Regesti%'
      `, [m]);

      console.log(`\n--- ${nombre} 2026 (Total Órdenes Asignables: ${ordenes.length}) ---`);
      console.log(`WIN Oficial: Averías ${of.av_asig} Asig, ${of.av_fin} Fin | Postventa ${of.pv_asig} Asig, ${of.pv_fin} Fin | Total ${of.av_asig + of.pv_asig} Asig, ${of.av_fin + of.pv_fin} Fin`);

      // Cuántas son Postventa puras:
      const pvBase = ordenes.filter(ord => {
        const tipoTrabajo = (ord.tipo_trabajo || '').toUpperCase();
        const tipoAsig = (ord.tipo_trabajo_asignado || '').toUpperCase();
        const motivo = (ord.motivo_finalizacion || '').toUpperCase();
        const producto = (ord.producto || '').toUpperCase();

        return (
          tipoTrabajo.includes('TRASLADO') ||
          tipoTrabajo.includes('REUBICA') ||
          tipoTrabajo.includes('MESH') ||
          tipoTrabajo.includes('WIN BOX') ||
          tipoTrabajo.includes('WINBOX') ||
          tipoTrabajo.includes('WIFI') ||
          tipoTrabajo.includes('MUDANZA') ||
          producto.includes('POST') ||
          motivo.includes('POST') ||
          motivo.includes('MESH') ||
          motivo.includes('WIFI PRO') ||
          (tipoTrabajo.includes('ADICIONAL') && !tipoAsig.includes('LOS ROJO'))
        );
      });

      const pvBaseFin = pvBase.filter(o => o.estado.includes('Finaliz') || o.estado.includes('Liquid') || o.estado.includes('Termin'));

      console.log(`Postventa Base actual: ${pvBase.length} Asig (faltan ${of.pv_asig - pvBase.length}), ${pvBaseFin.length} Fin (faltan ${of.pv_fin - pvBaseFin.length})`);

      // Veamos las órdenes que NO están en pvBase y analicemos qué patrones tienen
      const noPv = ordenes.filter(o => !pvBase.includes(o));

      console.log(`Candidatas en Averías que podrían ser Postventa en WIN:`);
      const candidatas = noPv.filter(o => {
        const cuad = (o.cuadrilla || '').toUpperCase();
        const asig = (o.tipo_trabajo_asignado || '').toUpperCase();
        const mot = (o.motivo_finalizacion || '').toUpperCase();
        const tipo = (o.tipo_trabajo || '').toUpperCase();
        const prod = (o.producto || '').toUpperCase();

        return (
          cuad.includes('TRASLADO') ||
          asig.includes('TELÉFONO') || asig.includes('TELEFONO') || asig.includes('WINBOX') || asig.includes('APARATO') || asig.includes('EQUIPO') ||
          mot.includes('PHONOWIN') || mot.includes('WINBOX') || mot.includes('TELÉFONO') || mot.includes('TELEFONO')
        );
      });

      console.table(candidatas.map(c => ({
        id: c.id_orden,
        ot: c.numero,
        cuad: c.cuadrilla?.slice(0, 18),
        tipo: c.tipo_trabajo,
        asig: c.tipo_trabajo_asignado?.slice(0, 22),
        motivo: c.motivo_finalizacion?.slice(0, 25),
        estado: c.estado
      })));
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

solve100();
