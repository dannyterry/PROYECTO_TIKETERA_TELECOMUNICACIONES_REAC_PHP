const pool = require('../db');
const { loginWin, cargarGrillaWin, parsearHtmlFenix } = require('../services/fenixScraper');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function generarTramos() {
  const tramos = [];
  const anio = 2026;
  const mesesDias = [
    { mes: 1, nombre: "Enero", dias: 31 },
    { mes: 2, nombre: "Febrero", dias: 28 },
    { mes: 3, nombre: "Marzo", dias: 31 },
    { mes: 4, nombre: "Abril", dias: 30 },
    { mes: 5, nombre: "Mayo", dias: 31 },
    { mes: 6, nombre: "Junio", dias: 30 },
    { mes: 7, nombre: "Julio", dias: 31 },
    { mes: 8, nombre: "Agosto", dias: 31 },
    { mes: 9, nombre: "Septiembre", dias: 16 }
  ];

  const pad = (n) => String(n).padStart(2, '0');

  for (const m of mesesDias) {
    let diaInicio = 1;
    while (diaInicio <= m.dias) {
      const diaFin = Math.min(diaInicio + 4, m.dias); // bloques de 5 días
      tramos.push({
        mesNombre: m.nombre,
        mesNum: m.mes,
        desde: `${pad(diaInicio)}/${pad(m.mes)}/${anio}`,
        hasta: `${pad(diaFin)}/${pad(m.mes)}/${anio}`
      });
      diaInicio = diaFin + 1;
    }
  }

  return tramos;
}

async function main() {
  console.log("==================================================================");
  console.log("🚀 ACTUALIZACIÓN MASIVA DE COLUMNA 'PRODUCTO' DESDE FÉNIX (2026)");
  console.log("==================================================================");

  await loginWin();
  const tramos = generarTramos();
  console.log(`📦 Total de tramos de 5 días a procesar: ${tramos.length}\n`);

  let totalActualizadas = 0;
  let totalOrdenesObtenidas = 0;
  const inicioT = Date.now();

  for (let idx = 0; idx < tramos.length; idx++) {
    const tramo = tramos[idx];
    const num = idx + 1;
    console.log(`[${num}/${tramos.length}] 📅 ${tramo.mesNombre}: ${tramo.desde} al ${tramo.hasta}...`);

    let pag = 1;
    let totalPaginas = 1;
    let totalReg = 0;
    let ordenesTramo = [];

    while (pag <= totalPaginas && pag <= 30) {
      let resPag = null;
      let intentos = 0;

      while (intentos < 3 && !resPag) {
        intentos++;
        try {
          resPag = await cargarGrillaWin(pag, tramo.desde, tramo.hasta);
          if (!resPag || !resPag.d) {
            await loginWin();
            resPag = null;
          }
        } catch (e) {
          console.warn(`   ⚠️ Reintento pág ${pag} (intento ${intentos}): ${e.message}`);
          await loginWin().catch(() => {});
          await sleep(1500);
        }
      }

      if (!resPag || !resPag.d) break;

      try {
        const decoded = Buffer.from(resPag.d, 'base64').toString('utf-8');
        const dataJson = JSON.parse(decoded);

        if (pag === 1 && dataJson.registros) {
          try {
            const decReg = Buffer.from(dataJson.registros, 'base64').toString('utf-8');
            totalReg = parseInt(JSON.parse(decReg), 10) || 0;
            totalPaginas = Math.ceil(totalReg / 30) || 1;
          } catch (e) {}
        }

        if (dataJson.html) {
          const html = Buffer.from(dataJson.html, 'base64').toString('utf-8');
          const parsed = parsearHtmlFenix(html);
          if (parsed && parsed.length > 0) {
            ordenesTramo = ordenesTramo.concat(parsed);
          }
        }
      } catch (errDec) {
        console.error("   ❌ Error decodificando HTML:", errDec.message);
      }

      pag++;
    }

    totalOrdenesObtenidas += ordenesTramo.length;

    // Actualizar en base de datos local
    let updCount = 0;
    for (const ord of ordenesTramo) {
      if (!ord.numero) continue;
      const prod = ord.producto || null;
      if (prod) {
        const [r] = await pool.query(`
          UPDATE ordenes 
          SET producto = ?,
              suscripcion = COALESCE(NULLIF(?, ''), NULLIF(suscripcion, ''))
          WHERE numero = ?
        `, [prod, ord.suscripcion || null, ord.numero]);
        if (r.affectedRows > 0) updCount++;
      }
    }

    console.log(`   ✅ ${ordenesTramo.length} órdenes obtenidas de Fénix (Total Fénix: ${totalReg}) -> ${updCount} actualizadas en BD`);
    totalActualizadas += updCount;

    // Pequeña pausa de cortesía para Fénix
    await sleep(400);
  }

  const mins = ((Date.now() - inicioT) / 1000 / 60).toFixed(1);
  console.log("\n==================================================================");
  console.log(`🎉 ¡PROCESO COMPLETADO EN ${mins} MINUTOS!`);
  console.log(`📦 Órdenes procesadas de Fénix: ${totalOrdenesObtenidas}`);
  console.log(`💾 Registros actualizados en BD Local: ${totalActualizadas}`);
  console.log("==================================================================");

  // Consulta resumen de la columna producto por mes
  const [resumen] = await pool.query(`
    SELECT 
      MONTH(fecha_visita) as mes,
      COUNT(*) as total_ordenes,
      SUM(CASE WHEN producto LIKE '%POST%VENTA%' THEN 1 ELSE 0 END) as post_venta,
      SUM(CASE WHEN producto NOT LIKE '%POST%VENTA%' AND producto IS NOT NULL AND TRIM(producto) != '' THEN 1 ELSE 0 END) as averias_y_otros,
      SUM(CASE WHEN producto IS NULL OR TRIM(producto) = '' THEN 1 ELSE 0 END) as sin_producto
    FROM ordenes
    WHERE YEAR(fecha_visita) = 2026
    GROUP BY MONTH(fecha_visita)
    ORDER BY mes ASC
  `);
  console.log("\n📊 Distribución final de 'producto' en BD Local (2026):");
  console.table(resumen);

  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});
