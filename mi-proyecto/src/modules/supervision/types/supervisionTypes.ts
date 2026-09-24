export type TipoInspeccion = "CAMPO_GENERAL" | "AVERIAS" | "ORDENAMIENTO" | "ALTAS";

export type EstadoItem = "BUENO" | "REGULAR" | "MALO" | "NO_APLICA";

export interface ItemChecklist {
  id: string;
  categoria: "UNIFORME" | "HERRAMIENTAS" | "MATERIALES" | "VEHICULOS" | "EQUIPOS";
  nombre: string;
  cumple: boolean; // SI / NO
  cantidad?: number | string;
  estado?: EstadoItem;
  observacion?: string;
  unidad?: string; // PZ, METROS, etc.
}

export interface FichaSupervisionCampo {
  id?: number;
  id_tecnico?: number;
  tecnico: string;
  dni?: string;
  cuadrilla?: string;
  tipo_inspeccion: TipoInspeccion;
  fecha: string;
  hora?: string;
  lugar_inspeccion?: string;
  supervisor: string;
  cumplimiento_porcentaje: number;
  semaforo: "verde" | "amarillo" | "rojo";
  items_json: ItemChecklist[];
  observaciones?: string;
  firma_supervisor?: string;
  foto_epp_uniforme?: string;
  foto_herramientas?: string;
  foto_carro_limpio?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PreguntaCalidad {
  id: string;
  dimension: "PUNTUALIDAD_TRATO" | "DESARROLLO_SERVICIO" | "SOLUCION_PRUEBAS" | "DOCUMENTACION_CIERRE";
  dimension_titulo: string;
  pregunta: string;
  respuesta: boolean; // SI (cumplió) / NO (no cumplió)
  observacion?: string;
}

export interface AuditoriaCalidadCliente {
  id?: number;
  id_orden?: number;
  numero_ticket?: string;
  id_tecnico?: number;
  tecnico: string;
  cuadrilla?: string;
  cliente: string;
  telefono?: string;
  distrito?: string;
  fecha_atencion?: string;
  fecha_auditoria: string;
  auditor: string;
  preguntas_json: PreguntaCalidad[];
  puntaje_porcentaje: number;
  calificacion_estrellas: number;
  comentario_cliente?: string;
  estado_conformidad: "CONFORME" | "CON_OBSERVACIONES" | "NO_CONFORME";
  created_at?: string;
  updated_at?: string;
}

export interface TecnicoCombo {
  id_tecnico: number;
  tecnico: string;
  nombres: string;
  apellidos: string;
  dni: string;
  cuadrilla: string;
  celular: string;
  cargo?: string;
  tipo_servicio?: string;
}

export interface SupervisorCombo {
  id_usuario: number;
  supervisor: string;
  usuario: string;
  cargo: string;
  telefono?: string;
}

export interface OrdenBusqueda {
  id_orden: number;
  ot: string;
  codigo_pedido: string;
  ticket: string;
  cliente: string;
  telefono: string;
  distrito: string;
  tecnico: string;
  id_tecnico: number;
  dni_tecnico: string;
  cuadrilla: string;
  fecha_atencion: string;
  tipo_trabajo: string;
  direccion: string;
}

export interface SupervisionStats {
  campo: {
    total_inspecciones: number;
    promedio_cumplimiento: number;
    total_verdes: number;
    total_amarillos: number;
    total_rojos: number;
  };
  cliente: {
    total_auditorias: number;
    promedio_puntaje: number;
    promedio_estrellas: number;
    total_conformes: number;
    total_observaciones: number;
    total_no_conformes: number;
  };
  ranking: Array<{
    tecnico: string;
    cuadrilla: string;
    total_supervisiones: number;
    score_campo: number;
    score_cliente: number;
    score_global: number;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 📋 PLANTILLAS OFICIALES CORPORACIÓN CÉSPEDES
// ─────────────────────────────────────────────────────────────────────────────

// 1. PLANTILLA: CAMPO GENERAL / ALTAS (Oficial Imagen 1)
export const ITEMS_CAMPO_GENERAL: ItemChecklist[] = [
  // UNIFORME
  { id: "cg_u_pantalon", categoria: "UNIFORME", nombre: "PANTALON", cumple: true, estado: "BUENO" },
  { id: "cg_u_chaleco", categoria: "UNIFORME", nombre: "CHALECO", cumple: true, estado: "BUENO" },
  { id: "cg_u_polo", categoria: "UNIFORME", nombre: "POLO", cumple: true, estado: "BUENO" },
  { id: "cg_u_bota", categoria: "UNIFORME", nombre: "BOTA", cumple: true, estado: "BUENO" },
  { id: "cg_u_casco", categoria: "UNIFORME", nombre: "CASCO HOMOLOGADO", cumple: true, estado: "BUENO" },
  { id: "cg_u_barbiquejo", categoria: "UNIFORME", nombre: "BARBIQUEJO", cumple: true, estado: "BUENO" },
  { id: "cg_u_guantes", categoria: "UNIFORME", nombre: "GUANTE DE SEGURIDAD", cumple: true, estado: "BUENO" },
  { id: "cg_u_lentes", categoria: "UNIFORME", nombre: "LENTES DE PROTECCION", cumple: true, estado: "BUENO" },
  { id: "cg_u_fotosheck", categoria: "UNIFORME", nombre: "FOTOSHECK", cumple: true, estado: "BUENO" },

  // HERRAMIENTAS
  { id: "cg_h_cinturon", categoria: "HERRAMIENTAS", nombre: "CINTURON SEGURIDAD", cumple: true, estado: "BUENO" },
  { id: "cg_h_portadrop", categoria: "HERRAMIENTAS", nombre: "PORTA DROP", cumple: true, estado: "BUENO" },
  { id: "cg_h_martillo", categoria: "HERRAMIENTAS", nombre: "MARTILLO", cumple: true, estado: "BUENO" },
  { id: "cg_h_taladro", categoria: "HERRAMIENTAS", nombre: "TALADRO", cumple: true, estado: "BUENO" },
  { id: "cg_h_broca_pasa", categoria: "HERRAMIENTAS", nombre: "BROCA PASAMURO", cumple: true, estado: "BUENO" },
  { id: "cg_h_broca_chica", categoria: "HERRAMIENTAS", nombre: "BROCA CHICA", cumple: true, estado: "BUENO" },
  { id: "cg_h_desm_estrella", categoria: "HERRAMIENTAS", nombre: "DESARMADOR ESTRELLA", cumple: true, estado: "BUENO" },
  { id: "cg_h_desm_plano", categoria: "HERRAMIENTAS", nombre: "DESARMADOR PLANO", cumple: true, estado: "BUENO" },
  { id: "cg_h_alic_pinza", categoria: "HERRAMIENTAS", nombre: "ALICATE PINZA", cumple: true, estado: "BUENO" },
  { id: "cg_h_alic_corte", categoria: "HERRAMIENTAS", nombre: "ALICATE CORTE", cumple: true, estado: "BUENO" },
  { id: "cg_h_wincha", categoria: "HERRAMIENTAS", nombre: "WINCHA", cumple: true, estado: "BUENO" },
  { id: "cg_h_zunchadora", categoria: "HERRAMIENTAS", nombre: "ZUNCHADORA", cumple: true, estado: "BUENO" },
  { id: "cg_h_kit_fibra", categoria: "HERRAMIENTAS", nombre: "KIT DE FIBRA", cumple: true, estado: "BUENO" },
  { id: "cg_h_extension", categoria: "HERRAMIENTAS", nombre: "EXTENSION", cumple: true, estado: "BUENO" },

  // MATERIALES
  { id: "cg_m_conectores", categoria: "MATERIALES", nombre: "CONECTORES", cumple: true, estado: "BUENO" },
  { id: "cg_m_patch_cor", categoria: "MATERIALES", nombre: "PATCH COR", cumple: true, estado: "BUENO" },
  { id: "cg_m_patch_azul_verde", categoria: "MATERIALES", nombre: "PATCH COR AZUL VERDE", cumple: true, estado: "BUENO" },
  { id: "cg_m_templadores", categoria: "MATERIALES", nombre: "TEMPLADORES", cumple: true, estado: "BUENO" },
  { id: "cg_m_rosetas", categoria: "MATERIALES", nombre: "ROSETAS", cumple: true, estado: "BUENO" },
  { id: "cg_m_acoples", categoria: "MATERIALES", nombre: "ACOPLES", cumple: true, estado: "BUENO" },
  { id: "cg_m_grapas", categoria: "MATERIALES", nombre: "GRAPAS", cumple: true, estado: "BUENO" },
  { id: "cg_m_cintillos", categoria: "MATERIALES", nombre: "CINTILLO AMARRES", cumple: true, estado: "BUENO" },
  { id: "cg_m_rotulador", categoria: "MATERIALES", nombre: "ROTULADOR", cumple: true, estado: "BUENO" },
  { id: "cg_m_drop", categoria: "MATERIALES", nombre: "DROP", cumple: true, estado: "BUENO" },
  { id: "cg_m_anclaje", categoria: "MATERIALES", nombre: "ANCLAJE T/P", cumple: true, estado: "BUENO" },
  { id: "cg_m_clevis", categoria: "MATERIALES", nombre: "CLEVIS", cumple: true, estado: "BUENO" },
  { id: "cg_m_hebillas", categoria: "MATERIALES", nombre: "HEBILLAS", cumple: true, estado: "BUENO" },
  { id: "cg_m_bandix", categoria: "MATERIALES", nombre: "C. BANDIX", cumple: true, estado: "BUENO" },
  { id: "cg_m_vulcanizante", categoria: "MATERIALES", nombre: "C.VULCANIZANTE", cumple: true, estado: "BUENO" },
  { id: "cg_m_doble_contacto", categoria: "MATERIALES", nombre: "C. DOBLE CONTACTO", cumple: true, estado: "BUENO" },
  { id: "cg_m_splitter", categoria: "MATERIALES", nombre: "SPLITER", cumple: true, estado: "BUENO" },
  { id: "cg_m_conectores_rg", categoria: "MATERIALES", nombre: "CONECTORES RG", cumple: true, estado: "BUENO" },
  { id: "cg_m_cable_rg11", categoria: "MATERIALES", nombre: "CABLE RG11", cumple: true, estado: "BUENO" },
  { id: "cg_m_actas", categoria: "MATERIALES", nombre: "ACTAS", cumple: true, estado: "BUENO" },

  // VEHICULOS
  { id: "cg_v_cono", categoria: "VEHICULOS", nombre: "CONO DE SEGURIDAD", cumple: true, estado: "BUENO" },
  { id: "cg_v_barra", categoria: "VEHICULOS", nombre: "BARRA RETRACTIL", cumple: true, estado: "BUENO" },
  { id: "cg_v_llanta_rep", categoria: "VEHICULOS", nombre: "LLANTA DE REPUESTO", cumple: true, estado: "BUENO" },
  { id: "cg_v_gata", categoria: "VEHICULOS", nombre: "GATA HIDRAULICA", cumple: true, estado: "BUENO" },
  { id: "cg_v_llave_ruedas", categoria: "VEHICULOS", nombre: "LLAVE DE RUEDAS", cumple: true, estado: "BUENO" },
  { id: "cg_v_cadena", categoria: "VEHICULOS", nombre: "CADENA", cumple: true, estado: "BUENO" },
  { id: "cg_v_candado", categoria: "VEHICULOS", nombre: "CANDADO", cumple: true, estado: "BUENO" },
  { id: "cg_v_escalera_tele", categoria: "VEHICULOS", nombre: "ESCALERA TELESCOPICA", cumple: true, estado: "BUENO" },
  { id: "cg_v_banderin", categoria: "VEHICULOS", nombre: "BANDERIN", cumple: true, estado: "BUENO" },
  { id: "cg_v_escalera_pasos", categoria: "VEHICULOS", nombre: "ESCALERA 8 PASOS", cumple: true, estado: "BUENO" },
  { id: "cg_v_botiquin", categoria: "VEHICULOS", nombre: "BOTIQUIN", cumple: true, estado: "BUENO" },
  { id: "cg_v_triangulo", categoria: "VEHICULOS", nombre: "TRIANGULO", cumple: true, estado: "BUENO" },
  { id: "cg_v_extintor", categoria: "VEHICULOS", nombre: "EXTINTOR 6KG / 2KG", cumple: true, estado: "BUENO" },
  { id: "cg_v_logotipos", categoria: "VEHICULOS", nombre: "LOGOTIPOS PARNER", cumple: true, estado: "BUENO" },

  // EQUIPOS
  { id: "cg_eq_ont", categoria: "EQUIPOS", nombre: "ONT -ROUTER", cumple: true, estado: "BUENO" },
  { id: "cg_eq_mesh", categoria: "EQUIPOS", nombre: "MESH", cumple: true, estado: "BUENO" },
  { id: "cg_eq_telefono", categoria: "EQUIPOS", nombre: "TELEFONO", cumple: true, estado: "BUENO" },
  { id: "cg_eq_tvbox", categoria: "EQUIPOS", nombre: "TV BOX", cumple: true, estado: "BUENO" },
];

// 2. PLANTILLA: AVERÍAS (Oficial Imagen 2)
export const ITEMS_AVERIAS: ItemChecklist[] = [
  // UNIFORME
  { id: "av_u_pantalon", categoria: "UNIFORME", nombre: "PANTALON", cumple: true, estado: "BUENO" },
  { id: "av_u_chaleco", categoria: "UNIFORME", nombre: "CHALECO", cumple: true, estado: "BUENO" },
  { id: "av_u_polo", categoria: "UNIFORME", nombre: "POLO", cumple: true, estado: "BUENO" },
  { id: "av_u_botas", categoria: "UNIFORME", nombre: "BOTAS", cumple: true, estado: "BUENO" },
  { id: "av_u_casco", categoria: "UNIFORME", nombre: "CASCO HOMOLOGADO", cumple: true, estado: "BUENO" },
  { id: "av_u_tapanuca", categoria: "UNIFORME", nombre: "TAPANUCA", cumple: true, estado: "BUENO" },
  { id: "av_u_guantes", categoria: "UNIFORME", nombre: "GUANTE DE SEGURIDAD", cumple: true, estado: "BUENO" },
  { id: "av_u_lentes", categoria: "UNIFORME", nombre: "LENTES DE PROTECCION", cumple: true, estado: "BUENO" },
  { id: "av_u_fotosheck", categoria: "UNIFORME", nombre: "FOTOSHECK", cumple: true, estado: "BUENO" },

  // HERRAMIENTAS
  { id: "av_h_strobo", categoria: "HERRAMIENTAS", nombre: "STROBO HOMOLOGADO", cumple: true, estado: "BUENO" },
  { id: "av_h_portadrop", categoria: "HERRAMIENTAS", nombre: "PORTA DROP", cumple: true, estado: "BUENO" },
  { id: "av_h_martillo", categoria: "HERRAMIENTAS", nombre: "MARTILLO", cumple: true, estado: "BUENO" },
  { id: "av_h_taladro", categoria: "HERRAMIENTAS", nombre: "TALADRO", cumple: true, estado: "BUENO" },
  { id: "av_h_broca_pasa", categoria: "HERRAMIENTAS", nombre: "BROCA PASAMURO", cumple: true, estado: "BUENO" },
  { id: "av_h_broca_chica", categoria: "HERRAMIENTAS", nombre: "BROCA CHICA", cumple: true, estado: "BUENO" },
  { id: "av_h_desm_estrella", categoria: "HERRAMIENTAS", nombre: "DESARMADOR ESTRELLA", cumple: true, estado: "BUENO" },
  { id: "av_h_desm_plano", categoria: "HERRAMIENTAS", nombre: "DESARMADOR PLANO", cumple: true, estado: "BUENO" },
  { id: "av_h_alic_pinza", categoria: "HERRAMIENTAS", nombre: "ALICATE PINZA", cumple: true, estado: "BUENO" },
  { id: "av_h_alic_corte", categoria: "HERRAMIENTAS", nombre: "ALICATE CORTE", cumple: true, estado: "BUENO" },
  { id: "av_h_wincha_15m", categoria: "HERRAMIENTAS", nombre: "WINCHA - AMAR 15M", cumple: true, estado: "BUENO" },
  { id: "av_h_zunchadora", categoria: "HERRAMIENTAS", nombre: "ZUNCHADORA", cumple: true, estado: "BUENO" },
  { id: "av_h_kit_fibra", categoria: "HERRAMIENTAS", nombre: "KIT DE FIBRA (PZ)", cumple: true, estado: "BUENO" },
  { id: "av_h_alcohol", categoria: "HERRAMIENTAS", nombre: "ALCOHOL ISOPROPILICO", cumple: true, estado: "BUENO" },
  { id: "av_h_one_click", categoria: "HERRAMIENTAS", nombre: "ONE CLICK", cumple: true, estado: "BUENO" },
  { id: "av_h_extension_15m", categoria: "HERRAMIENTAS", nombre: "EXTENSION AMAR 15M", cumple: true, estado: "BUENO" },
  { id: "av_h_tablero", categoria: "HERRAMIENTAS", nombre: "TABLERO + LAPICERO", cumple: true, estado: "BUENO" },
  { id: "av_h_marcador", categoria: "HERRAMIENTAS", nombre: "MARCADOR DELGADO", cumple: true, estado: "BUENO" },
  { id: "av_h_crimpi", categoria: "HERRAMIENTAS", nombre: "CRIMPI", cumple: true, estado: "BUENO" },

  // MATERIALES
  { id: "av_m_conectores", categoria: "MATERIALES", nombre: "CONECTORES", cumple: true, estado: "BUENO" },
  { id: "av_m_patch_cor", categoria: "MATERIALES", nombre: "PATCH COR", cumple: true, estado: "BUENO" },
  { id: "av_m_patch_azul_verde", categoria: "MATERIALES", nombre: "PATCH COR AZUL VERDE", cumple: true, estado: "BUENO" },
  { id: "av_m_templadores", categoria: "MATERIALES", nombre: "TEMPLADORES", cumple: true, estado: "BUENO" },
  { id: "av_m_rosetas", categoria: "MATERIALES", nombre: "ROSETAS", cumple: true, estado: "BUENO" },
  { id: "av_m_acoples", categoria: "MATERIALES", nombre: "ACOPLES", cumple: true, estado: "BUENO" },
  { id: "av_m_grapas_6", categoria: "MATERIALES", nombre: "GRAPAS *6", cumple: true, estado: "BUENO" },
  { id: "av_m_cintillo_150", categoria: "MATERIALES", nombre: "CINTILLO AMARRES *150", cumple: true, estado: "BUENO" },
  { id: "av_m_rotulador", categoria: "MATERIALES", nombre: "ROTULADOR", cumple: true, estado: "BUENO" },
  { id: "av_m_anclaje", categoria: "MATERIALES", nombre: "ANCLAJE T/P", cumple: true, estado: "BUENO" },
  { id: "av_m_clevis", categoria: "MATERIALES", nombre: "CLEVIS", cumple: true, estado: "BUENO" },
  { id: "av_m_hebillas_1_2", categoria: "MATERIALES", nombre: "HEBILLAS 1/2", cumple: true, estado: "BUENO" },
  { id: "av_m_bandix_1_2", categoria: "MATERIALES", nombre: "C. BANDIX 1/2", cumple: true, estado: "BUENO" },
  { id: "av_m_vulcanizante", categoria: "MATERIALES", nombre: "C.VULCANIZANTE", cumple: true, estado: "BUENO" },
  { id: "av_m_doble_contacto", categoria: "MATERIALES", nombre: "C. DOBLE CONTACTO", cumple: true, estado: "BUENO" },
  { id: "av_m_splitter", categoria: "MATERIALES", nombre: "SPLITER", cumple: true, estado: "BUENO" },
  { id: "av_m_conectores_rg", categoria: "MATERIALES", nombre: "CONECTORES RG", cumple: true, estado: "BUENO" },
  { id: "av_m_cable_utp", categoria: "MATERIALES", nombre: "CABLE UTP", cumple: true, estado: "BUENO" },
  { id: "av_m_actas", categoria: "MATERIALES", nombre: "ACTAS", cumple: true, estado: "BUENO" },
  { id: "av_m_sticker_qr", categoria: "MATERIALES", nombre: "STICKER QR", cumple: true, estado: "BUENO" },
  { id: "av_m_drop_metraje", categoria: "MATERIALES", nombre: "DROP - CODIGO Y METRAJE", cumple: true, estado: "BUENO" },

  // VEHICULOS
  { id: "av_v_cono", categoria: "VEHICULOS", nombre: "CONO DE SEGURIDAD", cumple: true, estado: "BUENO" },
  { id: "av_v_barra", categoria: "VEHICULOS", nombre: "BARRA RETRACTIL", cumple: true, estado: "BUENO" },
  { id: "av_v_llanta_rep", categoria: "VEHICULOS", nombre: "LLANTA DE REPUESTO", cumple: true, estado: "BUENO" },
  { id: "av_v_gata", categoria: "VEHICULOS", nombre: "GATA HIDRAULICA", cumple: true, estado: "BUENO" },
  { id: "av_v_llave_ruedas", categoria: "VEHICULOS", nombre: "LLAVE DE RUEDAS", cumple: true, estado: "BUENO" },
  { id: "av_v_cadena", categoria: "VEHICULOS", nombre: "CADENA", cumple: true, estado: "BUENO" },
  { id: "av_v_candado", categoria: "VEHICULOS", nombre: "CANDADO", cumple: true, estado: "BUENO" },
  { id: "av_v_escalera_tele", categoria: "VEHICULOS", nombre: "ESCALERA TELESCOPICA", cumple: true, estado: "BUENO" },
  { id: "av_v_banderin", categoria: "VEHICULOS", nombre: "BANDERIN", cumple: true, estado: "BUENO" },
  { id: "av_v_escalera_pasos", categoria: "VEHICULOS", nombre: "ESCALERA 8 PASOS", cumple: true, estado: "BUENO" },
  { id: "av_v_botiquin", categoria: "VEHICULOS", nombre: "BOTIQUIN", cumple: true, estado: "BUENO" },
  { id: "av_v_triangulo", categoria: "VEHICULOS", nombre: "TRIANGULO", cumple: true, estado: "BUENO" },
  { id: "av_v_extintor", categoria: "VEHICULOS", nombre: "EXTINTOR 6KG / 2KG", cumple: true, estado: "BUENO" },
  { id: "av_v_tacos_madera", categoria: "VEHICULOS", nombre: "TACOS DE MADERA", cumple: true, estado: "BUENO" },
  { id: "av_v_medidor_aire", categoria: "VEHICULOS", nombre: "MEDIDOR DE AIRE", cumple: true, estado: "BUENO" },
  { id: "av_v_logotipos", categoria: "VEHICULOS", nombre: "LOGOTIPOS PARTNER", cumple: true, estado: "BUENO" },
  { id: "av_v_documentos_veh", categoria: "VEHICULOS", nombre: "TARJ.P, SOAT, REV.TECNICA", cumple: true, estado: "BUENO" },
  { id: "av_v_limpieza", categoria: "VEHICULOS", nombre: "LIMPIEZA DE VEHICULO", cumple: true, estado: "BUENO" },
  { id: "av_v_combustible", categoria: "VEHICULOS", nombre: "COMBUSTIBLE", cumple: true, estado: "BUENO" },
  { id: "av_v_llave_inglesa", categoria: "VEHICULOS", nombre: "LLAVE INGLESA", cumple: true, estado: "BUENO" },
  { id: "av_v_tortol", categoria: "VEHICULOS", nombre: "TORTOL", cumple: true, estado: "BUENO" },

  // EQUIPOS
  { id: "av_eq_ont_huawei", categoria: "EQUIPOS", nombre: "ONT HUAWEI", cumple: true, estado: "BUENO" },
  { id: "av_eq_ont_zte", categoria: "EQUIPOS", nombre: "ONT ZTE", cumple: true, estado: "BUENO" },
  { id: "av_eq_smart_huawei", categoria: "EQUIPOS", nombre: "SMART HUAWEI", cumple: true, estado: "BUENO" },
  { id: "av_eq_smart_zte", categoria: "EQUIPOS", nombre: "SMART ZTE", cumple: true, estado: "BUENO" },
  { id: "av_eq_telefono", categoria: "EQUIPOS", nombre: "TELEFONO", cumple: true, estado: "BUENO" },
  { id: "av_eq_tvbox", categoria: "EQUIPOS", nombre: "TV BOX", cumple: true, estado: "BUENO" },
];

// 3. PLANTILLA: ORDENAMIENTO (Oficial Imagen 3)
export const ITEMS_ORDENAMIENTO: ItemChecklist[] = [
  // UNIFORME
  { id: "ord_u_pantalon", categoria: "UNIFORME", nombre: "PANTALON", cumple: true, estado: "BUENO" },
  { id: "ord_u_chaleco", categoria: "UNIFORME", nombre: "CHALECO", cumple: true, estado: "BUENO" },
  { id: "ord_u_polo", categoria: "UNIFORME", nombre: "POLO", cumple: true, estado: "BUENO" },
  { id: "ord_u_botas", categoria: "UNIFORME", nombre: "BOTAS", cumple: true, estado: "BUENO" },
  { id: "ord_u_casco", categoria: "UNIFORME", nombre: "CASCO HOMOLOGADO", cumple: true, estado: "BUENO" },
  { id: "ord_u_tapanuca", categoria: "UNIFORME", nombre: "TAPANUCA", cumple: true, estado: "BUENO" },
  { id: "ord_u_guantes", categoria: "UNIFORME", nombre: "GUANTE DE SEGURIDAD", cumple: true, estado: "BUENO" },
  { id: "ord_u_lentes", categoria: "UNIFORME", nombre: "LENTES DE PROTECCION", cumple: true, estado: "BUENO" },
  { id: "ord_u_fotosheck", categoria: "UNIFORME", nombre: "FOTOSHECK", cumple: true, estado: "BUENO" },

  // HERRAMIENTAS
  { id: "ord_h_strobo", categoria: "HERRAMIENTAS", nombre: "STROBO HOMOLOGADO", cumple: true, estado: "BUENO" },
  { id: "ord_h_portadrop", categoria: "HERRAMIENTAS", nombre: "PORTA DROP", cumple: true, estado: "BUENO" },
  { id: "ord_h_martillo", categoria: "HERRAMIENTAS", nombre: "MARTILLO", cumple: true, estado: "BUENO" },
  { id: "ord_h_taladro", categoria: "HERRAMIENTAS", nombre: "TALADRO", cumple: true, estado: "BUENO" },
  { id: "ord_h_broca_pasa", categoria: "HERRAMIENTAS", nombre: "BROCA PASAMURO", cumple: true, estado: "BUENO" },
  { id: "ord_h_broca_chica", categoria: "HERRAMIENTAS", nombre: "BROCA CHICA", cumple: true, estado: "BUENO" },
  { id: "ord_h_desm_estrella", categoria: "HERRAMIENTAS", nombre: "DESARMADOR ESTRELLA", cumple: true, estado: "BUENO" },
  { id: "ord_h_desm_plano", categoria: "HERRAMIENTAS", nombre: "DESARMADOR PLANO", cumple: true, estado: "BUENO" },
  { id: "ord_h_alic_pinza", categoria: "HERRAMIENTAS", nombre: "ALICATE PINZA", cumple: true, estado: "BUENO" },
  { id: "ord_h_alic_corte", categoria: "HERRAMIENTAS", nombre: "ALICATE CORTE", cumple: true, estado: "BUENO" },
  { id: "ord_h_wincha_15m", categoria: "HERRAMIENTAS", nombre: "WINCHA - AMAR 15M", cumple: true, estado: "BUENO" },
  { id: "ord_h_zunchadora", categoria: "HERRAMIENTAS", nombre: "ZUNCHADORA", cumple: true, estado: "BUENO" },
  { id: "ord_h_kit_fibra", categoria: "HERRAMIENTAS", nombre: "KIT DE FIBRA (PZ)", cumple: true, estado: "BUENO" },
  { id: "ord_h_alcohol", categoria: "HERRAMIENTAS", nombre: "ALCOHOL ISOPROPILICO", cumple: true, estado: "BUENO" },
  { id: "ord_h_one_click", categoria: "HERRAMIENTAS", nombre: "ONE CLICK", cumple: true, estado: "BUENO" },
  { id: "ord_h_extension_15m", categoria: "HERRAMIENTAS", nombre: "EXTENSION AMAR 15M", cumple: true, estado: "BUENO" },
  { id: "ord_h_tablero", categoria: "HERRAMIENTAS", nombre: "TABLERO + LAPICERO", cumple: true, estado: "BUENO" },
  { id: "ord_h_marcador", categoria: "HERRAMIENTAS", nombre: "MARCADOR DELGADO", cumple: true, estado: "BUENO" },
  { id: "ord_h_crimpi", categoria: "HERRAMIENTAS", nombre: "CRIMPI", cumple: true, estado: "BUENO" },

  // MATERIALES
  { id: "ord_m_conectores", categoria: "MATERIALES", nombre: "CONECTORES", cumple: true, estado: "BUENO" },
  { id: "ord_m_patch_cor", categoria: "MATERIALES", nombre: "PATCH COR", cumple: true, estado: "BUENO" },
  { id: "ord_m_patch_azul_verde", categoria: "MATERIALES", nombre: "PATCH COR AZUL VERDE", cumple: true, estado: "BUENO" },
  { id: "ord_m_templadores", categoria: "MATERIALES", nombre: "TEMPLADORES", cumple: true, estado: "BUENO" },
  { id: "ord_m_rosetas", categoria: "MATERIALES", nombre: "ROSETAS", cumple: true, estado: "BUENO" },
  { id: "ord_m_acoples", categoria: "MATERIALES", nombre: "ACOPLES", cumple: true, estado: "BUENO" },
  { id: "ord_m_grapas_6", categoria: "MATERIALES", nombre: "GRAPAS *6", cumple: true, estado: "BUENO" },
  { id: "ord_m_cintillo_150", categoria: "MATERIALES", nombre: "CINTILLO AMARRES *150", cumple: true, estado: "BUENO" },
  { id: "ord_m_cintillo_200", categoria: "MATERIALES", nombre: "CINTILLO AMARRES *200", cumple: true, estado: "BUENO" },
  { id: "ord_m_cintillo_300", categoria: "MATERIALES", nombre: "CINTILLO AMARRES *300", cumple: true, estado: "BUENO" },
  { id: "ord_m_rotulador", categoria: "MATERIALES", nombre: "ROTULADOR", cumple: true, estado: "BUENO" },
  { id: "ord_m_anclaje", categoria: "MATERIALES", nombre: "ANCLAJE T/P", cumple: true, estado: "BUENO" },
  { id: "ord_m_clevis", categoria: "MATERIALES", nombre: "CLEVIS", cumple: true, estado: "BUENO" },
  { id: "ord_m_hebillas_1_2", categoria: "MATERIALES", nombre: "HEBILLAS 1/2", cumple: true, estado: "BUENO" },
  { id: "ord_m_hebillas_3_4", categoria: "MATERIALES", nombre: "HEBILLAS 3/4", cumple: true, estado: "BUENO" },
  { id: "ord_m_bandix_1_2", categoria: "MATERIALES", nombre: "C. BANDIX 1/2", cumple: true, estado: "BUENO" },
  { id: "ord_m_bandix_3_4", categoria: "MATERIALES", nombre: "C. BANDIX 3/4", cumple: true, estado: "BUENO" },
  { id: "ord_m_brazo_1m", categoria: "MATERIALES", nombre: "BRAZO 1M", cumple: true, estado: "BUENO" },
  { id: "ord_m_brazo_60cm", categoria: "MATERIALES", nombre: "BRAZO 60CM", cumple: true, estado: "BUENO" },
  { id: "ord_m_vulcanizante", categoria: "MATERIALES", nombre: "C.VULCANIZANTE", cumple: true, estado: "BUENO" },
  { id: "ord_m_doble_contacto", categoria: "MATERIALES", nombre: "C. DOBLE CONTACTO", cumple: true, estado: "BUENO" },
  { id: "ord_m_splitter", categoria: "MATERIALES", nombre: "SPLITER", cumple: true, estado: "BUENO" },
  { id: "ord_m_conectores_rg", categoria: "MATERIALES", nombre: "CONECTORES RG (PZ)", cumple: true, estado: "BUENO" },
  { id: "ord_m_cable_utp", categoria: "MATERIALES", nombre: "CABLE UTP", cumple: true, estado: "BUENO" },
  { id: "ord_m_actas", categoria: "MATERIALES", nombre: "ACTAS", cumple: true, estado: "BUENO" },
  { id: "ord_m_sticker_qr", categoria: "MATERIALES", nombre: "STICKER QR", cumple: true, estado: "BUENO" },
  { id: "ord_m_cinta_aislante", categoria: "MATERIALES", nombre: "CINTA AISLANTE", cumple: true, estado: "BUENO" },
  { id: "ord_m_drop", categoria: "MATERIALES", nombre: "DROP -", cumple: true, estado: "BUENO" },

  // VEHICULOS
  { id: "ord_v_cono", categoria: "VEHICULOS", nombre: "CONO DE SEGURIDAD", cumple: true, estado: "BUENO" },
  { id: "ord_v_barra", categoria: "VEHICULOS", nombre: "BARRA RETRACTIL", cumple: true, estado: "BUENO" },
  { id: "ord_v_llanta_rep", categoria: "VEHICULOS", nombre: "LLANTA DE REPUESTO", cumple: true, estado: "BUENO" },
  { id: "ord_v_gata", categoria: "VEHICULOS", nombre: "GATA HIDRAULICA", cumple: true, estado: "BUENO" },
  { id: "ord_v_llave_ruedas", categoria: "VEHICULOS", nombre: "LLAVE DE RUEDAS", cumple: true, estado: "BUENO" },
  { id: "ord_v_cadena", categoria: "VEHICULOS", nombre: "CADENA", cumple: true, estado: "BUENO" },
  { id: "ord_v_candado", categoria: "VEHICULOS", nombre: "CANDADO", cumple: true, estado: "BUENO" },
  { id: "ord_v_escalera_tele", categoria: "VEHICULOS", nombre: "ESCALERA TELESCOPICA", cumple: true, estado: "BUENO" },
  { id: "ord_v_banderin", categoria: "VEHICULOS", nombre: "BANDERIN", cumple: true, estado: "BUENO" },
  { id: "ord_v_escalera_pasos", categoria: "VEHICULOS", nombre: "ESCALERA 8 PASOS", cumple: true, estado: "BUENO" },
  { id: "ord_v_botiquin", categoria: "VEHICULOS", nombre: "BOTIQUIN", cumple: true, estado: "BUENO" },
  { id: "ord_v_triangulo", categoria: "VEHICULOS", nombre: "TRIANGULO", cumple: true, estado: "BUENO" },
  { id: "ord_v_extintor", categoria: "VEHICULOS", nombre: "EXTINTOR 6KG / 2KG", cumple: true, estado: "BUENO" },
  { id: "ord_v_tacos_madera", categoria: "VEHICULOS", nombre: "TACOS DE MADERA", cumple: true, estado: "BUENO" },
  { id: "ord_v_medidor_aire", categoria: "VEHICULOS", nombre: "MEDIDOR DE AIRE", cumple: true, estado: "BUENO" },
  { id: "ord_v_logotipos", categoria: "VEHICULOS", nombre: "LOGOTIPOS PARTNER", cumple: true, estado: "BUENO" },
  { id: "ord_v_documentos_veh", categoria: "VEHICULOS", nombre: "TARJ.P, SOAT, REV.TECNICA", cumple: true, estado: "BUENO" },
  { id: "ord_v_limpieza", categoria: "VEHICULOS", nombre: "LIMPIEZA DE VEHICULO", cumple: true, estado: "BUENO" },
  { id: "ord_v_combustible", categoria: "VEHICULOS", nombre: "COMBUSTIBLE", cumple: true, estado: "BUENO" },
  { id: "ord_v_llave_inglesa", categoria: "VEHICULOS", nombre: "LLAVE INGLESA", cumple: true, estado: "BUENO" },
  { id: "ord_v_tortol", categoria: "VEHICULOS", nombre: "TORTOL", cumple: true, estado: "BUENO" },
];

export function getItemsForTipo(tipo: TipoInspeccion): ItemChecklist[] {
  switch (tipo) {
    case "AVERIAS":
      return JSON.parse(JSON.stringify(ITEMS_AVERIAS));
    case "ORDENAMIENTO":
      return JSON.parse(JSON.stringify(ITEMS_ORDENAMIENTO));
    case "CAMPO_GENERAL":
    case "ALTAS":
    default:
      return JSON.parse(JSON.stringify(ITEMS_CAMPO_GENERAL));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🌟 4 DIMENSIONES DE CALIDAD AL CLIENTE (Oficial Cuestionario)
// ─────────────────────────────────────────────────────────────────────────────
export const PREGUNTAS_CALIDAD_DEFAULT: PreguntaCalidad[] = [
  // 1. Puntualidad y trato inicial
  {
    id: "p1_1",
    dimension: "PUNTUALIDAD_TRATO",
    dimension_titulo: "1. Sobre la puntualidad y el trato inicial: Presentación",
    pregunta: "¿El técnico llegó dentro del horario acordado o le avisó con anticipación si se retrasaría?",
    respuesta: true,
  },
  {
    id: "p1_2",
    dimension: "PUNTUALIDAD_TRATO",
    dimension_titulo: "1. Sobre la puntualidad y el trato inicial: Presentación",
    pregunta: "¿El técnico se identificó adecuadamente al llegar a su domicilio (mostró su fotocheck o credencial de Corporación Céspedes / WIN)?",
    respuesta: true,
  },
  {
    id: "p1_3",
    dimension: "PUNTUALIDAD_TRATO",
    dimension_titulo: "1. Sobre la puntualidad y el trato inicial: Presentación",
    pregunta: "¿Fue amable, respetuoso y usó su equipo de protección (como cubrezapatos/EPP) al ingresar a su hogar?",
    respuesta: true,
  },

  // 2. Desarrollo del servicio
  {
    id: "p2_1",
    dimension: "DESARROLLO_SERVICIO",
    dimension_titulo: "2. Sobre el desarrollo del servicio: Proceso",
    pregunta: "¿El técnico le explicó claramente cuál era el problema o en qué consistiría la instalación antes de empezar?",
    respuesta: true,
  },
  {
    id: "p2_2",
    dimension: "DESARROLLO_SERVICIO",
    dimension_titulo: "2. Sobre el desarrollo del servicio: Proceso",
    pregunta: "¿Le solicitó su opinión o autorización antes de realizar alguna perforación o cambio importante en la ubicación de los equipos?",
    respuesta: true,
  },
  {
    id: "p2_3",
    dimension: "DESARROLLO_SERVICIO",
    dimension_titulo: "2. Sobre el desarrollo del servicio: Proceso",
    pregunta: "¿Trabajó de manera ordenada y limpia, cuidando sus espacios y dejando el área libre de residuos al terminar?",
    respuesta: true,
  },

  // 3. Solución final y pruebas
  {
    id: "p3_1",
    dimension: "SOLUCION_PRUEBAS",
    dimension_titulo: "3. Sobre la solución final y pruebas: Calidad técnica",
    pregunta: "¿El servicio quedó funcionando correctamente y pudo hacer pruebas de navegación junto con el técnico antes de que él se retirara?",
    respuesta: true,
  },
  {
    id: "p3_2",
    dimension: "SOLUCION_PRUEBAS",
    dimension_titulo: "3. Sobre la solución final y pruebas: Calidad técnica",
    pregunta: "¿El técnico le enseñó a usar el equipo, cambiar la contraseña del Wi-Fi o verificar el estado del servicio?",
    respuesta: true,
  },
  {
    id: "p3_3",
    dimension: "SOLUCION_PRUEBAS",
    dimension_titulo: "3. Sobre la solución final y pruebas: Calidad técnica",
    pregunta: "¿Tiene alguna duda pendiente sobre cómo quedó operando el sistema?",
    respuesta: false, // False = No tiene dudas (positivo)
  },

  // 4. Documentación y cierre
  {
    id: "p4_1",
    dimension: "DOCUMENTACION_CIERRE",
    dimension_titulo: "4. Sobre la documentación y cierre: Formalidad",
    pregunta: "¿El técnico le indicó las garantías y canales de atención por el trabajo realizado?",
    respuesta: true,
  },
  {
    id: "p4_2",
    dimension: "DOCUMENTACION_CIERRE",
    dimension_titulo: "4. Sobre la documentación y cierre: Formalidad",
    pregunta: "¿Le solicitó su firma o conformidad de manera digital (App) o en papel (Acta WIN) al finalizar?",
    respuesta: true,
  },
];
