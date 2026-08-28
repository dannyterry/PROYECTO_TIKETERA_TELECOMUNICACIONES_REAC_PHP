import { Order } from "../types/Order";

/**
 * Normaliza texto quitando tildes, caracteres especiales y espacios múltiples
 */
const normalizeText = (text?: string): string => {
  if (!text) return "";
  return text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * 🏷️ Extrae la Clave / Identificador Único de Cuadrilla.
 * 
 * Regla: Identifica por el prefijo (ej: "K 5", "K 12") MÁS el descriptor que le sigue
 * (ej: "CESPEDES" vs "TRASLADO").
 * 
 * Ejemplos:
 * • "K 5 CESPEDES SGA FERNANDO RAFAEL..." -> "K 5 CESPEDES"
 * • "K 5 TRASLADO SGA JUAN PEREZ..."     -> "K 5 TRASLADO"
 * • "K 5 TRASLADOS"                      -> "K 5 TRASLADO"
 * • "K-5 CESPEDES"                       -> "K 5 CESPEDES"
 * • "K5 CESPEDES"                        -> "K 5 CESPEDES"
 * • "K 05 CESPEDES"                      -> "K 5 CESPEDES"
 * • "K 12 CESPEDES"                      -> "K 12 CESPEDES"
 * • "K 12 TRASLADO"                      -> "K 12 TRASLADO"
 */
export const extractCuadrillaKey = (cuadStr?: string): string => {
  if (!cuadStr) return "";
  let clean = normalizeText(cuadStr);

  if (!clean || clean === "-" || clean === "SIN CUADRILLA" || clean === "SELECCIONE") {
    return "";
  }

  // Quitar palabra "CUADRILLA" al inicio
  clean = clean.replace(/^CUADRILLA\s+/i, "");

  // Normalizar K5, K-5 a K 5, K05 a K 5
  clean = clean.replace(/\b([A-Z])\s*0*(\d+)\b/g, "$1 $2");

  const tokens = clean.split(" ");
  if (tokens.length === 0) return "";

  // Normalizar plural común "TRASLADOS" -> "TRASLADO"
  const cleanWord = (w: string) => {
    if (w === "TRASLADOS") return "TRASLADO";
    if (w === "MIGRACIONES") return "MIGRACION";
    if (w === "INSTALACIONES") return "INSTALACION";
    return w;
  };

  // CASO 1: [LETRA] [NUMERO] [DESCRIPTOR] (ej: "K", "5", "CESPEDES" o "K", "5", "TRASLADO")
  if (tokens.length >= 3 && /^[A-Z]{1,3}$/.test(tokens[0]) && /^\d+$/.test(tokens[1])) {
    const prefix = `${tokens[0]} ${parseInt(tokens[1], 10)}`;
    const descriptor = cleanWord(tokens[2]);
    return `${prefix} ${descriptor}`;
  }

  // CASO 2: [CODIGO_NUMERO] [DESCRIPTOR] (ej: "K5", "CESPEDES")
  if (tokens.length >= 2) {
    const match = tokens[0].match(/^([A-Z]+)(\d+)$/);
    if (match) {
      const prefix = `${match[1]} ${parseInt(match[2], 10)}`;
      const descriptor = cleanWord(tokens[1]);
      return `${prefix} ${descriptor}`;
    }
    // Ej: "SGA", "01" o "CESPEDES", "01"
    return `${tokens[0]} ${cleanWord(tokens[1])}`;
  }

  return cleanWord(tokens[0]);
};

/**
 * 🔍 Compara si dos órdenes o strings pertenecen a la MISMA cuadrilla.
 * "K 5 CESPEDES" !== "K 5 TRASLADO" -> Retorna FALSE (Diferentes cuadrillas)
 * "K 5 CESPEDES SGA..." === "K-5 CESPEDES" -> Retorna TRUE (Misma cuadrilla)
 */
export const isSameCuadrilla = (cuadA?: string, cuadB?: string): boolean => {
  const keyA = extractCuadrillaKey(cuadA);
  const keyB = extractCuadrillaKey(cuadB);

  if (!keyA || !keyB) return false;
  return keyA === keyB;
};

export interface CuadrillaOption {
  key: string;
  label: string;
  memberName?: string;
}

/**
 * 📋 Obtiene la lista de Cuadrillas únicas ordenadas a partir de una lista de órdenes
 */
export const getUniqueCuadrillas = (orders: Order[]): string[] => {
  const set = new Set<string>();
  orders.forEach((o) => {
    const key = extractCuadrillaKey(o.cuadrilla);
    if (key && key.length > 2) {
      set.add(key);
    }
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
};

import { areSameTechnician, deduplicateTechnicians, getCanonicalTechnicianName } from "./nameNormalizer";

/**
 * 📋 Obtiene la lista de Cuadrillas con su Nombre de Técnico asignado homologado
 * Ej: { key: "K 1 CESPEDES", label: "K 1 CESPEDES - OSCAR PIÑERO OCHOA" }
 */
export const getUniqueCuadrillasWithOptions = (orders: Order[]): CuadrillaOption[] => {
  const map = new Map<string, string>();
  const allRawMembers: string[] = [];

  orders.forEach((o) => {
    const key = extractCuadrillaKey(o.cuadrilla);
    if (key && key.length > 2) {
      const member = extractCuadrillaMemberName(o.cuadrilla, o.tecnico);
      if (member) allRawMembers.push(member);
      if (!map.has(key) || (member && !map.get(key))) {
        map.set(key, member || "");
      }
    }
  });

  const canonicalMembers = deduplicateTechnicians(allRawMembers);
  const keys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));

  return keys.map((key) => {
    const rawMember = map.get(key) || "";
    const cleanMember = rawMember ? getCanonicalTechnicianName(rawMember, canonicalMembers) : "";
    return {
      key,
      memberName: cleanMember,
      label: cleanMember ? `${key} - ${cleanMember}` : key,
    };
  });
};

/**
 * 👤 Extrae únicamente el nombre completo de la persona/técnico dentro de la cuadrilla.
 * Ejemplos:
 * • "K 1 MOTOWIN CESPEDES EDIXON RAFAEL VILLALBA LUGO" -> "EDIXON RAFAEL VILLALBA LUGO"
 * • "K 2 MOTOWIN CESPEDES SAITH ABRAHAM ILIZARBE"      -> "SAITH ABRAHAM ILIZARBE"
 * • "K 6 CESPEDES SGA EDMUNDO FLORES PEREZ"            -> "EDMUNDO FLORES PEREZ"
 * • "K 5 CESPEDES SGA CARLOS EDUARDO MARRUFO AGUILAR"  -> "CARLOS EDUARDO MARRUFO AGUILAR"
 * • "K 5 TRASLADO JUAN PEREZ"                          -> "JUAN PEREZ"
 */
export const extractCuadrillaMemberName = (cuadStr?: string, fallbackTecnico?: string): string => {
  let result = "";

  if (cuadStr && cuadStr !== "-") {
    let str = cuadStr.trim();

    // 1. Si contiene "SGA", extraer todo lo que sigue después de "SGA"
    const sgaMatch = str.match(/\bSGA[\s-_:•|/\\]+(.+)$/i);
    if (sgaMatch && sgaMatch[1] && sgaMatch[1].trim().length > 2) {
      result = sgaMatch[1].trim();
    } else {
      // 2. Quitar el prefijo de cuadrilla (ej: "K 1 MOTOWIN", "K 6 CESPEDES", "O 1 CESPEDES")
      const key = extractCuadrillaKey(str);
      if (key) {
        const escapedKey = key
          .split(/\s+/)
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("\\s*");
        const regexKey = new RegExp(`^${escapedKey}[\\s-_:•|/\\\\]*`, "i");
        result = str.replace(regexKey, "").trim();
      } else {
        result = str;
      }
    }

    // 3. Quitar palabras residuales como "CESPEDES", "SGA", "MOTOWIN", "WIN" al inicio del nombre
    result = result
      .replace(/^(?:CESPEDES|SGA|MOTOWIN|WIN|CONTRATISTA|MIGRACION|MIGRACIONES|TRASLADO|TRASLADOS|INSTALACION|INSTALACIONES)[\s-_:•|/\\\\]+/i, "")
      .replace(/^(?:CESPEDES|SGA|MOTOWIN|WIN|CONTRATISTA|MIGRACION|MIGRACIONES|TRASLADO|TRASLADOS|INSTALACION|INSTALACIONES)[\s-_:•|/\\\\]+/i, "")
      .replace(/^[-_:•|/\\.\s]+/, "")
      .replace(/[-_:•|/\\.\s]+$/, "")
      .replace(/\s+/g, " ")
      .trim();

    // Si lo que quedó es solo una palabra clave o número corto, no es un nombre
    if (/^(?:CESPEDES|SGA|MOTOWIN|WIN|CONTRATISTA|MIGRACION|TRASLADO|INSTALACION|\d+)$/i.test(result)) {
      result = "";
    }
  }

  // 4. Si no se pudo extraer o quedó vacío, usar fallbackTecnico si es válido
  if (!result || result.length < 3) {
    if (
      fallbackTecnico &&
      fallbackTecnico !== "-- SELECCIONE --" &&
      fallbackTecnico !== "-- Seleccione --" &&
      fallbackTecnico !== "-" &&
      fallbackTecnico.length > 2
    ) {
      result = fallbackTecnico.trim();
    } else {
      result = "";
    }
  }

  return result;
};
