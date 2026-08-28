/**
 * actaTemplates.ts
 * Plantillas inteligentes de materiales e insumos según el Tipo de Trabajo del Acta WIN.
 */

export interface MaterialSugerido {
  nombre: string;
  codigoAprox?: string;
  cantidadDefault: number;
  unidad: string;
}

export interface PlantillaActa {
  requiereDrop: boolean;
  requiereEquipoInstalado: boolean;
  requiereEquipoRetirado: boolean;
  materialesDefault: MaterialSugerido[];
}

export const PLANTILLAS_POR_TRABAJO: Record<string, PlantillaActa> = {
  // ─── 1. CAMBIO DE CABLE PATCH CORD (Solo Patch Cord, 1 unidad) ───
  "CAMBIO DE CABLE PATCH CORD": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "PATCH CORD FIBRA OPTICA SC/APC-SC/APC 3M", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "CAMBIO DE PATCH CORD": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "PATCH CORD FIBRA OPTICA SC/APC-SC/APC 3M", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "PATCH CORD": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "PATCH CORD FIBRA OPTICA SC/APC-SC/APC 3M", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "CAMBIO DE CABLE PACHTCORD": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "PATCH CORD FIBRA OPTICA SC/APC-SC/APC 3M", cantidadDefault: 1, unidad: "UND" },
    ],
  },

  // ─── 2. CAMBIO DE CONECTOR EN CTO / NAP (1 Conector) ───
  "CAMBIO DE CONECTOR EN CTO/NAP": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "CAMBIO DE CONECTOR CTO/NAP": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },

  // ─── 3. CAMBIO DE CONECTOR EN ROSETA (1 Conector) ───
  "CAMBIO DE CONECTOR EN ROSETA": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "CAMBIO DE ROSETA": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "ADAPTADOR ROSETA": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "CAMBIO DE ACOPLADOR": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "ACOMODO DE FIBRA": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [],
  },
  "ATENCIÓN DE AVERÍAS ULTIMA MILLA": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },

  // ─── 4. RECABLEADOS (Drop + 2 Conectores + Roseta) ───
  RECABLEADO: {
    requiereDrop: true,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 2, unidad: "UND" },
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "SERVICIO COMPLETO DE RECABLEADO EN ABONADO RESIDENCIAL - VISITA TÉCNICA": {
    requiereDrop: true,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 2, unidad: "UND" },
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "SERVICIO COMPLETO DE RECABLEADO EN ABONADO RESIDENCIAL - POST VENTA": {
    requiereDrop: true,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 2, unidad: "UND" },
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "SERVICIO COMPLETO DE RECABLEADO EN ABONADO CONDOMINIO - POST VENTA": {
    requiereDrop: true,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 2, unidad: "UND" },
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "RECABLEADO EN CONDOMINIO": {
    requiereDrop: true,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 2, unidad: "UND" },
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "SERVICIO COMPLETO DE RECABLEADO EN ABONADO CONDOMINIO - VISITA TÉCNICA": {
    requiereDrop: true,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 2, unidad: "UND" },
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "RECABLEADO - AVERIADO POR TERCEROS": {
    requiereDrop: true,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 2, unidad: "UND" },
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "RECABLEADO - CLIENTE MIGRA A OTRA CTO": {
    requiereDrop: true,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 2, unidad: "UND" },
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "RECABLEADO - CAMBIO DE POSTE": {
    requiereDrop: true,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 2, unidad: "UND" },
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "RECABLEADO POR MANTENIMIENTO": {
    requiereDrop: true,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 2, unidad: "UND" },
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },

  // ─── 5. NORMALIZACIÓN (2 Conectores + Roseta + Patch Cord) ───
  NORMALIZACIÓN: {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 2, unidad: "UND" },
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
      { nombre: "PATCH CORD FIBRA OPTICA SC/APC-SC/APC 3M", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  NORMALIZACION: {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 2, unidad: "UND" },
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
      { nombre: "PATCH CORD FIBRA OPTICA SC/APC-SC/APC 3M", cantidadDefault: 1, unidad: "UND" },
    ],
  },

  // ─── 6. REUBICACIONES ───
  "REUBICACION DE ROUTER SIN RESERVA - POST VENTA": {
    requiereDrop: true,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 2, unidad: "UND" },
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "REUBICACION SIN RESERVA": {
    requiereDrop: true,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 2, unidad: "UND" },
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "REUBICACION DE ROUTER CON RESERVA - POST VENTA": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 1, unidad: "UND" },
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "REUBICACION CON RESERVA": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 1, unidad: "UND" },
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },

  // ─── 7. TRASLADOS ───
  "TRASLADO DE SERVICIOS POR MUDANZA EN RESIDENCIALES - POST VENTA": {
    requiereDrop: true,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 2, unidad: "UND" },
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "TRASLADO DE SERVICIOS POR MUDANZA EN CONDOMINIO - POST VENTA": {
    requiereDrop: true,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 2, unidad: "UND" },
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  TRASLADO: {
    requiereDrop: true,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 2, unidad: "UND" },
      { nombre: "ROSETA OPTICA 2 PUERTOS CON ADAPTADOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },

  // ─── 8. CAMBIOS DE EQUIPOS ONT (ONT Serializada + Patch Cord) ───
  "CAMBIO DE EQUIPO ONT": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: true,
    materialesDefault: [
      { nombre: "PATCH CORD FIBRA OPTICA SC/APC-SC/APC 3M", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "CAMBIO DE ONT ADICIONAL": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: true,
    materialesDefault: [
      { nombre: "PATCH CORD FIBRA OPTICA SC/APC-SC/APC 3M", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "CAMBIO DE ONT POR REPOSICION - POST VENTA": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: true,
    materialesDefault: [
      { nombre: "PATCH CORD FIBRA OPTICA SC/APC-SC/APC 3M", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "RE-INSTALACIÓN DE ONT - CONDOMINIO": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: true,
    materialesDefault: [
      { nombre: "PATCH CORD FIBRA OPTICA SC/APC-SC/APC 3M", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "RE-INSTALACIÓN DE ONT - RESIDENCIAL": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: true,
    materialesDefault: [
      { nombre: "PATCH CORD FIBRA OPTICA SC/APC-SC/APC 3M", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "CAMBIO DE ONT POR REPOSICION ADICIONAL": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: true,
    materialesDefault: [
      { nombre: "PATCH CORD FIBRA OPTICA SC/APC-SC/APC 3M", cantidadDefault: 1, unidad: "UND" },
    ],
  },

  // ─── 9. CAMBIOS DE EQUIPOS MESH / TV BOX / FONOWIN ───
  "CAMBIO DE EQUIPO MESH": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: true,
    materialesDefault: [],
  },
  "CAMBIO DE MESH ADICIONAL": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: true,
    materialesDefault: [],
  },
  "SERVICIO DE ENTREGA Y CONFIGURACIÓN DE MESH - POST VENTA": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: false,
    materialesDefault: [],
  },
  "SERVICIOS DE ENTREGA Y CONFIGURACIÓN MESH - ADICIONAL": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: false,
    materialesDefault: [],
  },
  "CAMBIO DE TV BOX": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: true,
    materialesDefault: [],
  },
  "CAMBIO DE TV BOX ADICIONAL": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: true,
    materialesDefault: [],
  },
  "SERVICIO DE ENTREGA Y CONFIGURACIÓN DE TV BOX - POST VENTA": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: false,
    materialesDefault: [],
  },
  "SERVICIO DE ENTREGA Y CONFIGURACIÓN DE TV BOX - ADICIONAL": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: false,
    materialesDefault: [],
  },
  CAMBIOFONOWIN: {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: true,
    materialesDefault: [],
  },
  "CAMBIO FONOWIN": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: true,
    materialesDefault: [],
  },
  "CAMBIO DE FONO WIN": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: true,
    materialesDefault: [],
  },
  "CAMBIO DE TELEFONO ADICIONAL": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: true,
    materialesDefault: [],
  },
  "SERVICIO DE ENTREGA Y CONFIGURACIÓN DE FONO WIN - POST VENTA": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: false,
    materialesDefault: [],
  },
  "SERVICIO DE ENTREGA Y CONFIGURACIÓN DE FONO WIN - ADICIONAL": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: false,
    materialesDefault: [],
  },

  // ─── 10. CABLEADOS UTP CAT 6 ───
  "CABLEADO UTP CAT 6 - POST VENTA": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CABLE UTP CAT 6", cantidadDefault: 15, unidad: "MTR" },
      { nombre: "CONECTOR RJ45 CAT 6", cantidadDefault: 2, unidad: "UND" },
    ],
  },
  "CABLEADO UTP CAT 6 ADICIONAL - POST VENTA": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CABLE UTP CAT 6", cantidadDefault: 15, unidad: "MTR" },
      { nombre: "CONECTOR RJ45 CAT 6", cantidadDefault: 2, unidad: "UND" },
    ],
  },
  "INSTALACIÓN DE MESH MAS CABLEADO CAT 6 - POST VENTA": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CABLE UTP CAT 6", cantidadDefault: 15, unidad: "MTR" },
      { nombre: "CONECTOR RJ45 CAT 6", cantidadDefault: 2, unidad: "UND" },
    ],
  },
  "INSTALACIÓN DE MESH MAS CABLEADO CAT 6 DURANTE LA ATENCIÓN - POST VENTA": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CABLE UTP CAT 6", cantidadDefault: 15, unidad: "MTR" },
      { nombre: "CONECTOR RJ45 CAT 6", cantidadDefault: 2, unidad: "UND" },
    ],
  },
  "CABLEADO CAT 6 Y CONFIGURACIÓN DE MESH DURANTE LA ATENCIÓN - VISITA TÉCNICA": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CABLE UTP CAT 6", cantidadDefault: 15, unidad: "MTR" },
      { nombre: "CONECTOR RJ45 CAT 6", cantidadDefault: 2, unidad: "UND" },
    ],
  },

  // ─── 11. ADICIONALES (Splitters & Wifi Pro) ───
  "INSTALACION DE SPLITTERS 1X2": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "KIT WIFI PRO (AL CONTADO)": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: false,
    materialesDefault: [],
  },

  // ─── 12. GARANTIA & PEX ───
  GARANTIA: {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 1, unidad: "UND" },
      { nombre: "PATCH CORD FIBRA OPTICA SC/APC-SC/APC 3M", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "PRUEBAS DE SERVICIO": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },
  "CONJUNTA FINALIZADA": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "CONECTOR SC/APC FAST CONNECTOR", cantidadDefault: 1, unidad: "UND" },
    ],
  },

  // ─── 13. CONFIGURACIONES Y ASISTENCIAS (Sin materiales) ───
  "CONFIGURACION ONT": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [],
  },
  "WINBOX - CONTROL DEFECT": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [],
  },
  "ASISTENCIA WIN TV": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [],
  },
  "MIGRA XGSPON": {
    requiereDrop: false,
    requiereEquipoInstalado: true,
    requiereEquipoRetirado: true,
    materialesDefault: [
      { nombre: "PATCH CORD FIBRA OPTICA SC/APC-SC/APC 3M", cantidadDefault: 1, unidad: "UND" },
    ],
  },

  // ─── 14. VISITA EXTERNA GENERAL (Por defecto solo Patch Cord) ───
  "VISITA EXTERNA": {
    requiereDrop: false,
    requiereEquipoInstalado: false,
    requiereEquipoRetirado: false,
    materialesDefault: [
      { nombre: "PATCH CORD FIBRA OPTICA SC/APC-SC/APC 3M", cantidadDefault: 1, unidad: "UND" },
    ],
  },
};

/**
 * Obtiene la plantilla configurada para un tipo de trabajo ordenando por mayor especificidad
 */
export const getPlantillaPorTrabajo = (tipoTrabajo?: string): PlantillaActa => {
  if (!tipoTrabajo) return PLANTILLAS_POR_TRABAJO["CAMBIO DE CABLE PATCH CORD"];

  const norm = tipoTrabajo
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // 1. Detección prioritaria: Si es PATCH CORD (o variaciones), sugerir ÚNICAMENTE Patch Cord
  if (norm.includes("PATCH") || norm.includes("PACHT") || norm.includes("CORD")) {
    return PLANTILLAS_POR_TRABAJO["CAMBIO DE CABLE PATCH CORD"];
  }

  // 2. Coincidencia exacta
  if (PLANTILLAS_POR_TRABAJO[norm]) {
    return PLANTILLAS_POR_TRABAJO[norm];
  }

  // 3. Detección de tipos específicos por palabras clave
  if (norm.includes("CTO") || norm.includes("NAP")) {
    return PLANTILLAS_POR_TRABAJO["CAMBIO DE CONECTOR EN CTO/NAP"];
  }
  if (norm.includes("ROSETA") && norm.includes("CONECTOR")) {
    return PLANTILLAS_POR_TRABAJO["CAMBIO DE CONECTOR EN ROSETA"];
  }
  if (norm.includes("ROSETA") || norm.includes("ACOPLADOR") || norm.includes("ADAPTADOR")) {
    return PLANTILLAS_POR_TRABAJO["CAMBIO DE ROSETA"];
  }
  if (norm.includes("RECABLEADO")) {
    return PLANTILLAS_POR_TRABAJO["RECABLEADO"];
  }
  if (norm.includes("NORMALIZAC")) {
    return PLANTILLAS_POR_TRABAJO["NORMALIZACIÓN"];
  }
  if (norm.includes("REUBICAC")) {
    return norm.includes("SIN RESERVA")
      ? PLANTILLAS_POR_TRABAJO["REUBICACION SIN RESERVA"]
      : PLANTILLAS_POR_TRABAJO["REUBICACION CON RESERVA"];
  }
  if (norm.includes("TRASLAD") || norm.includes("TRASALD")) {
    return PLANTILLAS_POR_TRABAJO["TRASLADO"];
  }
  if (norm.includes("ONT")) {
    return PLANTILLAS_POR_TRABAJO["CAMBIO DE EQUIPO ONT"];
  }
  if (norm.includes("MESH")) {
    return norm.includes("CABLEADO") || norm.includes("CAT 6")
      ? PLANTILLAS_POR_TRABAJO["INSTALACIÓN DE MESH MAS CABLEADO CAT 6 - POST VENTA"]
      : PLANTILLAS_POR_TRABAJO["CAMBIO DE EQUIPO MESH"];
  }
  if (norm.includes("TV BOX") || norm.includes("WINBOX")) {
    return PLANTILLAS_POR_TRABAJO["CAMBIO DE TV BOX"];
  }
  if (norm.includes("FONOWIN") || norm.includes("FONO WIN") || norm.includes("TELEFONO")) {
    return PLANTILLAS_POR_TRABAJO["CAMBIO FONOWIN"];
  }
  if (norm.includes("UTP") || norm.includes("CAT 6")) {
    return PLANTILLAS_POR_TRABAJO["CABLEADO UTP CAT 6 - POST VENTA"];
  }
  if (norm.includes("GARANTIA")) {
    return PLANTILLAS_POR_TRABAJO["GARANTIA"];
  }
  if (norm.includes("PRUEBA") || norm.includes("PEX") || norm.includes("CONJUNTA")) {
    return PLANTILLAS_POR_TRABAJO["PRUEBAS DE SERVICIO"];
  }

  // 4. Ordenar las claves por longitud descendente
  const sortedKeys = Object.keys(PLANTILLAS_POR_TRABAJO).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    const normKey = key
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    if (norm.includes(normKey) || normKey.includes(norm)) {
      return PLANTILLAS_POR_TRABAJO[key];
    }
  }

  return PLANTILLAS_POR_TRABAJO["VISITA EXTERNA"];
};

