/**
 * Utilidades para manejo de fechas en zona horaria oficial de Perú (America/Lima / UTC-5).
 * Evita descalibraciones producidas por new Date().toISOString() a partir de las 7:00 PM.
 */

/**
 * Devuelve la fecha actual en formato YYYY-MM-DD forzando la zona horaria America/Lima.
 * @param d Fecha opcional (por defecto la fecha y hora actual)
 */
export function getPeruDateStr(d: Date = new Date()): string {
  // 'en-CA' devuelve formato YYYY-MM-DD nativamente con la zona horaria especificada
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/**
 * Devuelve la fecha y hora en formato legible para Perú (DD/MM/YYYY HH:mm:ss)
 */
export function formatPeruDateTime(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(d);
}
