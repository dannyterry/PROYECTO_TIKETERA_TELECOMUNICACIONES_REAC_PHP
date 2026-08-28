// ============================================================
// ⚙️ SWITCH DE ENTORNO (FRONTEND)
// ============================================================
// 🟢 false = MODO LOCAL (Conecta con backend http://localhost:3000)
// 🔴 true  = MODO PRODUCCIÓN (Conecta con https://api.corporacioncespedes.com)
//
// 💡 NOTA: Cámbialo a 'false' para desarrollo local y a 'true' antes de hacer build/subir al hosting.
const IS_PRODUCTION = false; // ⬅️ Cambia aquí (false = Local | true = Hosting)

const getLocalHost = () => {
  if (typeof window !== "undefined" && window.location.hostname) {
    return window.location.hostname;
  }
  return "localhost";
};

// 🟢 Configuración Local / Red WiFi (Detecta automáticamente si estás desde PC o Celular)
const getLocalConfig = () => {
  const host = getLocalHost();
  return {
    API_URL: `http://${host}:3000`,
    DASHBOARD_URL: `http://${host}/corporacionescepe/dashboard`
  };
};

// 🔴 Configuración Producción (Hosting cPanel)
const PROD_CONFIG = {
  API_URL: "https://api.corporacioncespedes.com",
  DASHBOARD_URL: "https://corporacioncespedes.com/dashboard"
};

// 🛡️ Auto-detección Inteligente: Si está en el dominio corporativo o HTTPS, activa Producción automáticamente.
const isLiveProduction = () => {
  if (IS_PRODUCTION) return true;
  if (typeof window !== "undefined" && window.location) {
    const host = window.location.hostname;
    if (host === "corporacioncespedes.com" || host.endsWith(".corporacioncespedes.com") || (!host.includes("localhost") && !host.startsWith("192.168.") && !host.startsWith("127.") && !host.startsWith("172."))) {
      return true;
    }
  }
  return false;
};

export const API_URL = isLiveProduction() ? PROD_CONFIG.API_URL : getLocalConfig().API_URL;
export const DASHBOARD_URL = isLiveProduction() ? PROD_CONFIG.DASHBOARD_URL : getLocalConfig().DASHBOARD_URL;



