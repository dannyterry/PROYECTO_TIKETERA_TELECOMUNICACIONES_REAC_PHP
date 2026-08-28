/**
 * nameNormalizer.ts
 * Utilidad inteligente de desduplicación, homologación y Mesh de nombres de técnicos.
 * Resuelve errores de tipeo de Fénix (ej: FIGUERA vs FIGUEROA) y nombres abreviados.
 */

// Normalizar texto para comparación fonética/estructural
const normalizeForCompare = (str: string): string => {
  return (str || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

// Distancia de Levenshtein entre dos palabras
const levenshtein = (a: string, b: string): number => {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = Array.from({ length: bn + 1 }, () => Array(an + 1).fill(0));
  for (let i = 0; i <= an; i++) matrix[0][i] = i;
  for (let j = 0; j <= bn; j++) matrix[j][0] = j;
  for (let j = 1; j <= bn; j++) {
    for (let i = 1; i <= an; i++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1, // deletion
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i - 1] + 1 // substitution
        );
      }
    }
  }
  return matrix[bn][an];
};

// Comprueba si dos palabras son prácticamente iguales (tolerancia de 1-2 letras para apellidos)
const areWordsSimilar = (w1: string, w2: string): boolean => {
  if (w1 === w2) return true;
  if (w1.length >= 5 && w2.length >= 5) {
    const dist = levenshtein(w1, w2);
    // Ej: FIGUERA vs FIGUEROA (distancia 1)
    if (dist <= 1) return true;
    if (w1.length >= 7 && w2.length >= 7 && dist <= 2) return true;
  }
  return false;
};

/**
 * Determina si dos nombres representan a la misma persona
 * Ej: "BERNARDO RIVERA FIGUEROA" y "BERNARDO ANDRES RIVERA FIGUERA" -> TRUE
 */
export const areSameTechnician = (nameA: string, nameB: string): boolean => {
  const normA = normalizeForCompare(nameA);
  const normB = normalizeForCompare(nameB);

  if (!normA || !normB) return false;
  if (normA === normB) return true;

  const tokensA = normA.split(" ").filter((w) => w.length > 1);
  const tokensB = normB.split(" ").filter((w) => w.length > 1);

  if (tokensA.length === 0 || tokensB.length === 0) return false;

  // Si el primer nombre no coincide, no son la misma persona
  if (!areWordsSimilar(tokensA[0], tokensB[0])) {
    return false;
  }

  // Contar cuántas palabras de la lista más corta coinciden con la más larga
  const [shorter, longer] = tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];

  let matches = 0;
  for (const sWord of shorter) {
    if (longer.some((lWord) => areWordsSimilar(sWord, lWord))) {
      matches++;
    }
  }

  // Si coinciden todas las palabras significativas de la versión corta (ej: Primer nombre + 2 apellidos)
  if (matches === shorter.length && matches >= 2) {
    return true;
  }

  // Si coinciden al menos 3 palabras (ej: BERNARDO ANDRES RIVERA)
  if (matches >= 3) {
    return true;
  }

  return false;
};

/**
 * 🧹 Desduplica y homologa una lista completa de nombres de técnicos
 * Preserva nombres oficiales si se le pasa una lista base.
 */
export const deduplicateTechnicians = (
  rawNames: string[],
  officialNames: string[] = []
): string[] => {
  // Mapa de Clusters: CanonicalName -> Array de variantes
  const clusters: { canonical: string; score: number }[] = [];

  // 1. Registrar primero los nombres oficiales
  officialNames.forEach((off) => {
    const clean = off.trim();
    if (clean && !clusters.some((c) => areSameTechnician(c.canonical, clean))) {
      clusters.push({ canonical: clean, score: 1000 + clean.length });
    }
  });

  // 2. Procesar los nombres crudos de las órdenes
  rawNames.forEach((raw) => {
    const clean = raw.trim();
    if (!clean || clean === "-" || clean === "-- Seleccione --" || clean.length < 3) return;

    // Buscar si encaja en algún cluster existente
    let matchIdx = clusters.findIndex((c) => areSameTechnician(c.canonical, clean));

    if (matchIdx !== -1) {
      // Si el nombre encontrado es más completo (tiene más palabras/detalles) y el cluster no es oficial
      const current = clusters[matchIdx];
      const wordCount = clean.split(/\s+/).length;
      if (current.score < 1000 && wordCount > current.canonical.split(/\s+/).length) {
        clusters[matchIdx].canonical = clean;
        clusters[matchIdx].score = wordCount;
      }
    } else {
      // Crear nuevo cluster
      clusters.push({
        canonical: clean,
        score: clean.split(/\s+/).length,
      });
    }
  });

  // 3. Retornar lista única ordenada alfabéticamente
  return clusters
    .map((c) => c.canonical)
    .sort((a, b) => a.localeCompare(b, "es"));
};

/**
 * 🏷️ Encuentra el nombre canónico/oficial para un nombre dado
 */
export const getCanonicalTechnicianName = (
  name: string,
  canonicalList: string[]
): string => {
  if (!name || !name.trim()) return name;
  const match = canonicalList.find((canon) => areSameTechnician(canon, name));
  return match || name.trim();
};
