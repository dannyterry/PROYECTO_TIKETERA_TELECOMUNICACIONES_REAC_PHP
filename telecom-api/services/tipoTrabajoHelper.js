/**
 * Mapeo oficial dinámico entre Motivos de Liquidación de Fénix
 * y la tabla MySQL `motivos` / `tipos_trabajo` gestionada en el Sistema.
 */

let poolInstance = null;
let motivosCache = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minuto de caché para reflejar cambios de configuración rápidamente

function setPool(pool) {
  poolInstance = pool;
}

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

/**
 * Carga los motivos activos desde la tabla MySQL `motivos`
 */
async function getMotivosCatalogo(pool = poolInstance) {
  const now = Date.now();
  if (motivosCache && (now - lastCacheTime < CACHE_TTL_MS)) {
    return motivosCache;
  }

  if (!pool) {
    try {
      pool = require('../db');
    } catch (e) {}
  }

  if (pool) {
    try {
      const [rows] = await pool.query(
        "SELECT id_motivo, nombre, tipo_trabajo FROM motivos WHERE estado = 'Activo'"
      );
      if (rows && rows.length > 0) {
        motivosCache = rows.map(m => ({
          id_motivo: m.id_motivo,
          nombre: m.nombre,
          nombreNorm: normalizeText(m.nombre),
          tipo_trabajo: String(m.tipo_trabajo || '').trim()
        }));
        lastCacheTime = now;
        return motivosCache;
      }
    } catch (err) {
      console.error("[tipoTrabajoHelper] Error cargando motivos desde BD:", err.message);
    }
  }

  return motivosCache || [];
}

/**
 * Determina el Tipo de Trabajo Oficial consultando la tabla `motivos`
 */
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

    // 2. Match parcial / inteligente contra los motivos configurados en BD
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

  // 3. Reglas de contingencia basadas en las categorías maestras oficiales
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

  // Por defecto para cualquier atención técnica domiciliaria (cambio de ont, mesh, patch cord, conector, etc.)
  return "VISITA EXTERNA";
}

/**
 * Función síncrona/asíncrona compatible con llamadas directas
 */
function resolverTipoTrabajoOficial(motivoLiquidacion, motivoAveria = "", estado = "") {
  return resolverTipoTrabajoConCatalogo(motivoLiquidacion, motivoAveria, estado, motivosCache || []);
}

module.exports = {
  setPool,
  normalizeText,
  getMotivosCatalogo,
  resolverTipoTrabajoConCatalogo,
  resolverTipoTrabajoOficial
};
