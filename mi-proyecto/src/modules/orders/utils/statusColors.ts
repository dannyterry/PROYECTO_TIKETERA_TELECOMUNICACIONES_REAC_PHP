// ============================================================
// REGLAS DE COLOR SEGÚN ESTADO EXACTO DE LA ORDEN (FÉNIX & EXCEL)
// ============================================================

/**
 * Normaliza texto quitando tildes y mayúsculas para comparaciones infalibles
 */
const normalizeText = (text?: string): string => {
  if (!text) return "";
  return text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

/**
 * Retorna las clases de Tailwind CSS para colorear TODA la fila
 * 🟢 VERDE (#70ad47): INICIADA, EN PROCESO
 * 🔵 CELESTE: FINALIZADA, LIQUIDADA, TERMINADA, CERRADA, FENIX (#5b9bd5)
 * 🟡 AMARILLO (#ffff00): REGESTIÓN, CANCELADA, OBSERVADA, ANULADA, SUSPENDIDA
 * ⚪ GRIS PROFUNDO: AGENDADA, PENDIENTE, ASIGNADA, EN CAMINO (#d4d8df)
 */
export const getRowColorByStatus = (status?: string): string => {
  if (!status) return "bg-[#d4d8df] hover:bg-[#c2c7cf] text-slate-950 border-l-4 border-l-slate-500 font-medium";
  const s = normalizeText(status);

  // 🟢 1. VERDE: INICIADA, EN PROCESO (#70ad47)
  if (
    s.includes("INICIAD") ||
    s.includes("PROCESO")
  ) {
    return "bg-[#70ad47] hover:bg-[#649e3d] text-slate-950 border-l-4 border-l-[#486f2c] font-semibold";
  }

  // 🔵 2. CELESTE PROFUNDO: FINALIZADA, FINALIZADO, LIQUIDADA, LIQUIDADO, TERMINADA, CERRADA, FENIX (#5b9bd5)
  if (
    s.includes("FINALIZ") ||
    s.includes("LIQUID") ||
    s.includes("TERMIN") ||
    s.includes("CERRAD") ||
    s.includes("FENIX")
  ) {
    return "bg-[#5b9bd5] hover:bg-[#4f88c2] text-slate-950 border-l-4 border-l-[#275a8a] font-medium";
  }

  // 🟡 3. AMARILLO: REGESTIÓN, CANCELADA, OBSERVADA, ANULADA, SUSPENDIDA (Amarillo puro Excel #ffff00)
  if (
    s.includes("REGESTION") ||
    s.includes("CANCELAD") ||
    s.includes("OBSERVAD") ||
    s.includes("ANULAD") ||
    s.includes("SUSPENDID")
  ) {
    return "bg-[#ffff00] hover:bg-[#f2f200] text-slate-950 border-l-4 border-l-amber-600 font-semibold";
  }

  // ⚪ 4. BLANCO: AGENDADA, PENDIENTE, ASIGNADA, EN CAMINO (#ffffff)
  if (
    s.includes("AGENDAD") ||
    s.includes("PENDIENT") ||
    s.includes("ASIGNAD") ||
    s.includes("CAMINO")
  ) {
    return "bg-white hover:bg-slate-50 text-slate-950 border-l-4 border-l-slate-300 font-medium";
  }

  return "bg-white hover:bg-slate-50 text-slate-950 border-l-4 border-l-slate-300 font-medium";
};

/**
 * Retorna las clases de Tailwind CSS para la insignia/badge individual del estado
 */
export const getBadgeColorByStatus = (status?: string): string => {
  if (!status) return "bg-slate-700 text-white border-slate-800 shadow-xs font-bold";
  const s = normalizeText(status);

  // 🟢 VERDE (INICIADA, EN PROCESO)
  if (
    s.includes("INICIAD") ||
    s.includes("PROCESO")
  ) {
    return "bg-[#5a8d36] text-white border-[#477329] shadow-xs font-bold";
  }

  // 🔵 CELESTE (FINALIZADA)
  if (
    s.includes("FINALIZ") ||
    s.includes("LIQUID") ||
    s.includes("TERMIN") ||
    s.includes("CERRAD") ||
    s.includes("FENIX")
  ) {
    return "bg-sky-600 text-white border-sky-700 shadow-xs font-bold";
  }

  // 🟡 AMARILLO
  if (
    s.includes("REGESTION") ||
    s.includes("CANCELAD") ||
    s.includes("OBSERVAD") ||
    s.includes("ANULAD") ||
    s.includes("SUSPENDID")
  ) {
    return "bg-yellow-400 text-yellow-950 border-yellow-500 shadow-xs font-black";
  }

  // ⚪ GRIS / NEUTRO (AGENDADA, ASIGNADA, EN CAMINO, PENDIENTE)
  if (
    s.includes("AGENDAD") ||
    s.includes("PENDIENT") ||
    s.includes("ASIGNAD") ||
    s.includes("CAMINO")
  ) {
    return "bg-slate-700 text-white border-slate-800 shadow-xs font-bold";
  }

  return "bg-slate-700 text-white border-slate-800 shadow-xs font-bold";
};
