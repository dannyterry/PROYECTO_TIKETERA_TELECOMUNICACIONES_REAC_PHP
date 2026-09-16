const mysql = require('mysql2/promise');

const localConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'corporacioncespe_cespedes',
  connectTimeout: 10000
};

const remoteConfig = {
  host: 'corporacioncespedes.com',
  port: 3306,
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  connectTimeout: 15000
};

function normalizeText(text) {
  if (!text) return "";
  return String(text)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s\+\-\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolverTipoTrabajoConCatalogo(motivoLiquidacion, motivoAveria = "", estado = "", catalogoMotivos = []) {
  const normEstado = String(estado || "").toLowerCase().trim();
  const isFinalizada = normEstado.includes("finaliz") || normEstado.includes("liquid") || normEstado.includes("termin") || normEstado.includes("cerrad") || normEstado.includes("fenix");

  if (!isFinalizada) {
    return null;
  }

  const normLiq = normalizeText(motivoLiquidacion);
  const normAveria = normalizeText(motivoAveria);

  if (!normLiq) {
    if (normAveria.includes("PLANTA EXTERNA")) return "PEX";
    if (normAveria.includes("TRASLADO")) return "TRASLADO";
    return "VISITA EXTERNA";
  }

  // 1. Match exacto contra la tabla `motivos`
  if (catalogoMotivos && catalogoMotivos.length > 0) {
    const matchExacto = catalogoMotivos.find(m => m.nombreNorm === normLiq);
    if (matchExacto && matchExacto.tipo_trabajo) {
      return matchExacto.tipo_trabajo;
    }

    // 2. Match parcial / inteligente
    const matchParcial = catalogoMotivos.find(m => {
      if (m.nombreNorm === normLiq) return true;

      // Conectores
      if (normLiq.includes("CONECTOR") && m.nombreNorm.includes("CONECTOR")) {
        if (normLiq.includes("ROSETA") && m.nombreNorm.includes("ROSETA")) return true;
        if ((normLiq.includes("CTO") || normLiq.includes("NAP")) && (m.nombreNorm.includes("CTO") || m.nombreNorm.includes("NAP"))) return true;
      }
      // Recableados
      if (normLiq.includes("RECABLEADO") && m.nombreNorm === "RECABLEADO") {
        if (normLiq.includes("CONDOMINIO")) return m.nombreNorm.includes("CONDOMINIO");
        return true;
      }
      // Reubicaciones
      if (normLiq.includes("REUBICACION") && m.nombreNorm.includes("REUBICACION")) {
        if (normLiq.includes("SIN RESERVA") && m.nombreNorm.includes("SIN RESERVA")) return true;
        if (normLiq.includes("CON RESERVA") && m.nombreNorm.includes("CON RESERVA")) return true;
      }
      // Normalización
      if (normLiq.includes("NORMALIZACION") && m.nombreNorm.includes("NORMALIZACION")) return true;
      // Traslado
      if (normLiq.includes("TRASLADO") && m.nombreNorm === "TRASLADO") return true;
      // Pruebas de servicio / PEX
      if ((normLiq.includes("PRUEBA DE SERVICIO") || normLiq.includes("PRUEBAS DE SERVICIO")) && m.nombreNorm.includes("PRUEBA")) {
        return true;
      }
      return false;
    });

    if (matchParcial && matchParcial.tipo_trabajo) {
      return matchParcial.tipo_trabajo;
    }
  }

  // 3. Reglas de contingencia
  if (normLiq.includes("RECABLEADO")) {
    return normLiq.includes("CONDOMINIO") ? "RECABLEADO EN CONDOMINIO" : "RECABLEADO";
  }
  if (normLiq.includes("REUBICACION")) {
    return normLiq.includes("SIN RESERVA") ? "REUBICACIÓN SIN RESERVA" : "REUBICACIÓN CON RESERVA";
  }
  if (normLiq.includes("TRASLADO") || normLiq.includes("MUDANZA")) {
    return normLiq.includes("CONDOMINIO") ? "TRASALDO EN CONDOMINIO" : "TRASLADO";
  }
  if (normLiq.includes("NORMALIZACION")) return "NORMALIZACIÓN";
  if (normLiq.includes("GARANTIA")) {
    return (normLiq.includes("NO REALIZADA") || normLiq.includes("CANCELADA") || normLiq.includes("OBSERVADA")) ? "GARANTIA NO REALIZADA" : "GARANTIA";
  }
  if (normLiq.includes("SPLITTER") || normLiq.includes("SPLITER") || normLiq.includes("WIFI PRO")) {
    return "ADICIONAL";
  }
  if (normLiq.includes("PRUEBA DE SERVICIO") || normLiq.includes("CONJUNTA")) {
    return "PEX";
  }

  return "VISITA EXTERNA";
}

async function run() {
  console.log("===============================================================");
  console.log("🔍 REVISIÓN Y SINCRONIZACIÓN DE BASE DE DATOS LOCAL VS HOSTING");
  console.log("===============================================================");

  const localPool = mysql.createPool(localConfig);
  const remotePool = mysql.createPool(remoteConfig);

  // 1. Columnas faltantes
  console.log("\n📌 [Paso 1] Verificando columnas faltantes en Hosting...");
  const [remoteColsUsuarios] = await remotePool.query("SHOW COLUMNS FROM usuarios LIKE 'password_plano'");
  if (remoteColsUsuarios.length === 0) {
    console.log("⚠️ Columna 'password_plano' falta en tabla 'usuarios' del hosting. Agregando...");
    await remotePool.query("ALTER TABLE usuarios ADD COLUMN password_plano VARCHAR(255) NULL DEFAULT NULL AFTER password");
    console.log("✅ Columna 'password_plano' agregada exitosamente a 'usuarios' en Hosting.");
  } else {
    console.log("✅ Columna 'password_plano' ya existe en 'usuarios' en Hosting.");
  }

  // 2. Catalogo de motivos en Hosting
  console.log("\n📌 [Paso 2] Cargando catálogo oficial de motivos desde Hosting...");
  const [motivosRows] = await remotePool.query("SELECT id_motivo, nombre, tipo_trabajo FROM motivos WHERE estado = 'Activo'");
  const catalogo = motivosRows.map(m => ({
    id_motivo: m.id_motivo,
    nombre: m.nombre,
    nombreNorm: normalizeText(m.nombre),
    tipo_trabajo: String(m.tipo_trabajo || '').trim()
  }));
  console.log(`✅ ${catalogo.length} motivos activos cargados.`);

  // 3. Revisar ordenes en Hosting
  console.log("\n📌 [Paso 3] Analizando y normalizando 'tipo_trabajo' en tabla 'ordenes' del Hosting...");
  const [ordenes] = await remotePool.query(
    "SELECT id_orden, numero, motivo_finalizacion, motivo_trabajo, tipo_trabajo, estado FROM ordenes"
  );
  console.log(`📊 Total órdenes en Hosting: ${ordenes.length}`);

  let corregidas = 0;
  let batchUpdates = [];

  for (const ord of ordenes) {
    const rawStatus = String(ord.estado || "").toLowerCase().trim();
    const isFinalizada = rawStatus.includes("finaliz") || rawStatus.includes("liquid") || rawStatus.includes("termin") || rawStatus.includes("cerrad") || rawStatus.includes("fenix");

    if (isFinalizada) {
      const officialTipo = resolverTipoTrabajoConCatalogo(ord.motivo_finalizacion, ord.motivo_trabajo || ord.tipo_trabajo, ord.estado, catalogo);
      const rawAveria = ord.motivo_trabajo || ord.tipo_trabajo;

      if (officialTipo && officialTipo !== ord.tipo_trabajo) {
        batchUpdates.push({
          id_orden: ord.id_orden,
          numero: ord.numero,
          antes: ord.tipo_trabajo,
          nuevo: officialTipo,
          motivo_fin: ord.motivo_finalizacion,
          motivo_trabajo: rawAveria
        });
      }
    }
  }

  console.log(`🔎 Órdenes que requieren corrección de tipo_trabajo en Hosting: ${batchUpdates.length}`);

  if (batchUpdates.length > 0) {
    console.log("📝 Muestra de correcciones que se aplicarán (primeras 5):");
    console.table(batchUpdates.slice(0, 5));

    console.log(`⚙️ Aplicando ${batchUpdates.length} actualizaciones en Hosting...`);
    for (const item of batchUpdates) {
      await remotePool.query(
        "UPDATE ordenes SET tipo_trabajo = ?, motivo_trabajo = COALESCE(motivo_trabajo, ?) WHERE id_orden = ?",
        [item.nuevo, item.motivo_trabajo, item.id_orden]
      );
      corregidas++;
    }
    console.log(`✅ Se actualizaron correctamente ${corregidas} órdenes en Hosting.`);
  } else {
    console.log("✅ Todas las órdenes en Hosting ya cuentan con su 'tipo_trabajo' perfectamente sincronizado.");
  }

  // 4. Resumen final de distribución en Hosting
  const [resumenHosting] = await remotePool.query(`
    SELECT tipo_trabajo, COUNT(*) as total 
    FROM ordenes 
    GROUP BY tipo_trabajo 
    ORDER BY total DESC 
    LIMIT 15
  `);
  console.log("\n📊 Distribución final de 'tipo_trabajo' en HOSTING:");
  console.table(resumenHosting);

  await localPool.end();
  await remotePool.end();
  console.log("\n🏁 Proceso de verificación y sincronización finalizado exitosamente.");
  process.exit(0);
}

run().catch(err => {
  console.error("❌ Error en ejecución:", err);
  process.exit(1);
});
