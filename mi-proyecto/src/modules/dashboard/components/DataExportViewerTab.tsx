import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Order } from "../../orders/types/Order";
import { getOrders, getTecnicos, TecnicoOption } from "../../orders/services/orderService";
import { getRowColorByStatus, getBadgeColorByStatus } from "../../orders/utils/statusColors";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet,
  Download,
  Search,
  RefreshCw,
  Calendar,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
  FileText,
  Activity,
  ArrowUpDown,
  Eye,
  RotateCcw,
  CheckSquare,
  Square,
  Check,
  Settings2,
  Columns,
} from "lucide-react";

// ── CONFIGURACIÓN DE TODAS LAS COLUMNAS DISPONIBLES PARA VER Y EXPORTAR ──
export interface ColumnaConfig {
  id: string;
  label: string;
  category: "General" | "Cliente" | "Técnico" | "Tiempos" | "Detalles";
  width: number;
}

export const TODAS_COLUMNAS: ColumnaConfig[] = [
  { id: "indice", label: "#", category: "General", width: 5 },
  { id: "fecha", label: "Fecha", category: "General", width: 12 },
  { id: "celular", label: "Celular", category: "Cliente", width: 14 },
  { id: "llamada", label: "Llamada", category: "Cliente", width: 10 },
  { id: "observacionLlamada", label: "Observación de Llamada", category: "Cliente", width: 30 },
  { id: "dni", label: "DNI", category: "Cliente", width: 12 },
  { id: "cliente", label: "Cliente", category: "Cliente", width: 28 },
  { id: "direccion", label: "Dirección", category: "Cliente", width: 35 },
  { id: "distrito", label: "Distrito", category: "Cliente", width: 20 },
  { id: "cto", label: "CTO", category: "Detalles", width: 16 },
  { id: "codigoPedido", label: "Código de Pedido", category: "General", width: 18 },
  { id: "ot", label: "OT", category: "General", width: 14 },
  { id: "ticket", label: "Número de Ticket", category: "General", width: 18 },
  { id: "tecnico", label: "Técnico", category: "Técnico", width: 26 },
  { id: "acta", label: "Acta", category: "Detalles", width: 14 },
  { id: "tareas", label: "Tareas", category: "Detalles", width: 10 },
  { id: "asignacion", label: "Asignación", category: "Tiempos", width: 12 },
  { id: "camino", label: "Camino", category: "Tiempos", width: 12 },
  { id: "inicio", label: "Inicio", category: "Tiempos", width: 12 },
  { id: "fin", label: "Fin", category: "Tiempos", width: 12 },
  { id: "tramo", label: "Tramo", category: "Tiempos", width: 16 },
  { id: "status", label: "Status", category: "General", width: 16 },
  { id: "cuadrilla", label: "Cuadrilla", category: "Técnico", width: 20 },
  { id: "tipoTrabajoAsignado", label: "Tipo de Trabajo Asignado", category: "Detalles", width: 24 },
  { id: "tipoLiquidacion", label: "Tipo de Liquidación", category: "Detalles", width: 24 },
  { id: "tipoTrabajo", label: "Tipo de Trabajo", category: "Detalles", width: 24 },
  { id: "observacionesAtencion", label: "Observaciones Atención", category: "Detalles", width: 35 },
  { id: "totalDrop", label: "Total Drop", category: "Detalles", width: 12 },
  { id: "anchoBanda", label: "Ancho de Banda", category: "Detalles", width: 16 },
];

// Meses y nombres en español
const MESES = [
  { num: 1, label: "Enero" },
  { num: 2, label: "Febrero" },
  { num: 3, label: "Marzo" },
  { num: 4, label: "Abril" },
  { num: 5, label: "Mayo" },
  { num: 6, label: "Junio" },
  { num: 7, label: "Julio" },
  { num: 8, label: "Agosto" },
  { num: 9, label: "Septiembre" },
  { num: 10, label: "Octubre" },
  { num: 11, label: "Noviembre" },
  { num: 12, label: "Diciembre" },
];

export const DataExportViewerTab: React.FC = () => {
  // ── 1. ESTADOS DE RANGO TEMPORAL Y CALENDARIO ──
  const getInitialDates = () => {
    const hoy = new Date();
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return { desde: fmt(primero), hasta: fmt(hoy) };
  };

  const [fechaDesde, setFechaDesde] = useState<string>(getInitialDates().desde);
  const [fechaHasta, setFechaHasta] = useState<string>(getInitialDates().hasta);
  const [periodoActivo, setPeriodoActivo] = useState<string>("mes");

  // ── 2. ESTADOS DE FILTROS AVANZADOS (MULTI-ESTADO & INTERACTIVO) ──
  const [filtrosEstados, setFiltrosEstados] = useState<string[]>([]);
  const [filtroTipoObservacion, setFiltroTipoObservacion] = useState<string>("TODAS");
  const [filtroTecnico, setFiltroTecnico] = useState<string>("TODOS");
  const [filtroCuadrilla, setFiltroCuadrilla] = useState<string>("TODAS");
  const [filtroTramo, setFiltroTramo] = useState<string>("TODOS");
  const [filtroTipoTrabajo, setFiltroTipoTrabajo] = useState<string>("TODOS");
  const [filtroDistrito, setFiltroDistrito] = useState<string>("TODOS");
  const [busquedaTexto, setBusquedaTexto] = useState<string>("");

  // ── 2.5. GESTOR DE COLUMNAS VISIBLES Y EXPORTABLES ──
  const [columnasVisibles, setColumnasVisibles] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    TODAS_COLUMNAS.forEach((c) => {
      init[c.id] = true;
    });
    return init;
  });
  const [modalColumnasAbierto, setModalColumnasAbierto] = useState<boolean>(false);

  const cantColumnasActivas = useMemo(() => {
    return TODAS_COLUMNAS.filter((c) => columnasVisibles[c.id] !== false).length;
  }, [columnasVisibles]);

  const toggleColumna = (colId: string) => {
    setColumnasVisibles((prev) => ({
      ...prev,
      [colId]: prev[colId] === false ? true : false,
    }));
  };

  const seleccionarTodasColumnas = () => {
    const all: Record<string, boolean> = {};
    TODAS_COLUMNAS.forEach((c) => {
      all[c.id] = true;
    });
    setColumnasVisibles(all);
  };

  const seleccionarColumnasOperativas = () => {
    const operativas = [
      "indice",
      "fecha",
      "cliente",
      "celular",
      "cuadrilla",
      "tecnico",
      "ticket",
      "ot",
      "tramo",
      "status",
      "direccion",
      "distrito",
    ];
    const map: Record<string, boolean> = {};
    TODAS_COLUMNAS.forEach((c) => {
      map[c.id] = operativas.includes(c.id);
    });
    setColumnasVisibles(map);
  };

  const seleccionarSoloCuadrillas = () => {
    const soloCuad = [
      "indice",
      "fecha",
      "cuadrilla",
      "tecnico",
      "tramo",
      "status",
      "tipoTrabajo",
      "ticket",
      "cliente",
    ];
    const map: Record<string, boolean> = {};
    TODAS_COLUMNAS.forEach((c) => {
      map[c.id] = soloCuad.includes(c.id);
    });
    setColumnasVisibles(map);
  };

  const deseleccionarTodasColumnas = () => {
    const none: Record<string, boolean> = {};
    TODAS_COLUMNAS.forEach((c) => {
      none[c.id] = false;
    });
    setColumnasVisibles(none);
  };

  // Alternar selección de estado en filtros acumulativos
  const handleToggleEstado = (estadoKey: string) => {
    setPaginaActual(1);
    if (estadoKey === "TODOS") {
      setFiltrosEstados([]);
      return;
    }
    setFiltrosEstados((prev) => {
      if (prev.includes(estadoKey)) {
        return prev.filter((k) => k !== estadoKey);
      } else {
        return [...prev, estadoKey];
      }
    });
  };

  const isEstadoActivo = (estadoKey: string) => {
    if (estadoKey === "TODOS") return filtrosEstados.length === 0;
    return filtrosEstados.includes(estadoKey);
  };

  const handleLimpiarFiltros = () => {
    setFiltrosEstados([]);
    setFiltroTipoObservacion("TODAS");
    setFiltroTecnico("TODOS");
    setFiltroCuadrilla("TODAS");
    setFiltroTramo("TODOS");
    setFiltroTipoTrabajo("TODOS");
    setFiltroDistrito("TODOS");
    setBusquedaTexto("");
    setPaginaActual(1);
  };

  // ── 3. DATOS Y CARGA ──
  const [ordenes, setOrdenes] = useState<Order[]>([]);
  const [tecnicosOficiales, setTecnicosOficiales] = useState<TecnicoOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // ── 4. PAGINACIÓN Y ORDENAMIENTO ──
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState<number>(50);
  const [ordenColumna, setOrdenColumna] = useState<string>("fecha");
  const [ordenDireccion, setOrdenDireccion] = useState<"asc" | "desc">("desc");

  // ── 5. MODAL DETALLE DE ORDEN ──
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<Order | null>(null);
  const [modalDetalleAbierto, setModalDetalleAbierto] = useState<boolean>(false);

  // ── 6. FUNCIÓN DE CONSULTA PRINCIPAL A LA API ──
  const fetchOrdenesData = useCallback(
    async (desdeCustom?: string, hastaCustom?: string) => {
      setLoading(true);
      try {
        const d = desdeCustom || fechaDesde;
        const h = hastaCustom || fechaHasta;
        const data = await getOrders({ fechaDesde: d, fechaHasta: h });
        setOrdenes(data || []);
        setPaginaActual(1);
      } catch (err: any) {
        console.error("Error al cargar data de órdenes para exportar:", err);
      } finally {
        setLoading(false);
      }
    },
    [fechaDesde, fechaHasta]
  );

  // Carga inicial
  useEffect(() => {
    fetchOrdenesData();
    // Cargar técnicos oficiales desde la tabla usuarios
    getTecnicos()
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setTecnicosOficiales(list);
        }
      })
      .catch((err) => console.error("Error al cargar técnicos:", err));
  }, []);

  // ── 7. MANEJO DE ATAJOS RÁPIDOS DE FECHA / MESES ──
  const handleShortcutPeriodo = (
    tipo: "hoy" | "ayer" | "semana" | "mes" | "mes_anterior" | "anio"
  ) => {
    setPeriodoActivo(tipo);
    const hoy = new Date();
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    let dStr = "";
    let hStr = "";

    if (tipo === "hoy") {
      dStr = fmt(hoy);
      hStr = fmt(hoy);
    } else if (tipo === "ayer") {
      const ayer = new Date(hoy);
      ayer.setDate(hoy.getDate() - 1);
      dStr = fmt(ayer);
      hStr = fmt(ayer);
    } else if (tipo === "semana") {
      const lunes = new Date(hoy);
      lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
      dStr = fmt(lunes);
      hStr = fmt(hoy);
    } else if (tipo === "mes") {
      const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      dStr = fmt(primero);
      hStr = fmt(hoy);
    } else if (tipo === "mes_anterior") {
      const primeroAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const ultimoAnt = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      dStr = fmt(primeroAnt);
      hStr = fmt(ultimoAnt);
    } else if (tipo === "anio") {
      const primeroAnio = new Date(hoy.getFullYear(), 0, 1);
      dStr = fmt(primeroAnio);
      hStr = fmt(hoy);
    }

    setFechaDesde(dStr);
    setFechaHasta(hStr);
    fetchOrdenesData(dStr, hStr);
  };

  const handleSeleccionarMes = (mesNum: number, anio: number) => {
    setPeriodoActivo(`mes_${anio}_${mesNum}`);
    const primero = new Date(anio, mesNum - 1, 1);
    const ultimo = new Date(anio, mesNum, 0);
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    const dStr = fmt(primero);
    const hStr = fmt(ultimo);
    setFechaDesde(dStr);
    setFechaHasta(hStr);
    fetchOrdenesData(dStr, hStr);
  };

  // ── 8. LISTAS DINÁMICAS ÚNICAS EXTRAÍDAS DE LA DATA Y USUARIOS ──
  const { tecnicosList, cuadrillasList, tramosList, tiposTrabajoList, distritosList } = useMemo(() => {
    const cuad = new Set<string>();
    const tram = new Set<string>();
    const tip = new Set<string>();
    const dist = new Set<string>();

    ordenes.forEach((o) => {
      if (o.cuadrilla && o.cuadrilla.trim() && o.cuadrilla !== "Sin Cuadrilla") {
        cuad.add(o.cuadrilla.trim());
      }
      if (o.tramo && o.tramo.trim()) {
        tram.add(o.tramo.trim());
      }
      const tTrab = (o.tipoTrabajo || (o as any).tipo_trabajo || (o as any).tipoTrabajoAsignado || "").trim();
      if (tTrab && tTrab !== "-" && tTrab !== "null" && tTrab !== "undefined") {
        tip.add(tTrab);
      }
      if (o.distrito && o.distrito.trim()) {
        dist.add(o.distrito.trim());
      }
    });

    let tecsFinales: string[] = [];
    if (tecnicosOficiales && tecnicosOficiales.length > 0) {
      const setOficial = new Set<string>();
      tecnicosOficiales.forEach((t) => {
        const nom = (t.nombreCompleto || "").trim();
        if (nom && nom !== "SELECCIONE" && nom !== "SIN ASIGNAR") {
          setOficial.add(nom.toUpperCase());
        }
      });
      tecsFinales = Array.from(setOficial).sort((a, b) => a.localeCompare(b));
    } else {
      const tecsMap = new Map<string, string>();
      ordenes.forEach((o) => {
        const raw = (o.tecnico || "").trim().toUpperCase();
        if (!raw || raw === "SELECCIONE" || raw === "SIN ASIGNAR" || raw === "-") return;
        const parts = raw.split(/\s*[\/,+]\s*|\s+Y\s+/i);
        parts.forEach((p) => {
          const tClean = p.trim();
          if (tClean.length < 3) return;
          const words = tClean.split(/\s+/);
          const keyShort = words.slice(0, 3).join(" ");
          if (!tecsMap.has(keyShort) || tClean.length > (tecsMap.get(keyShort)?.length || 0)) {
            tecsMap.set(keyShort, tClean);
          }
        });
      });
      tecsFinales = Array.from(new Set(tecsMap.values())).sort((a, b) => a.localeCompare(b));
    }

    return {
      tecnicosList: tecsFinales,
      cuadrillasList: Array.from(cuad).sort((a, b) => a.localeCompare(b)),
      tramosList: Array.from(tram).sort((a, b) => a.localeCompare(b)),
      tiposTrabajoList: Array.from(tip).sort((a, b) => a.localeCompare(b)),
      distritosList: Array.from(dist).sort((a, b) => a.localeCompare(b)),
    };
  }, [ordenes, tecnicosOficiales]);

  // ── 9. CLASIFICACIÓN DE OBSERVADAS ──
  const esObservadaExterna = (o: Order): boolean => {
    const texto = `${o.motivoCancelacion || ""} ${o.motivoRegestion || ""} ${o.motivoAnulacion || ""} ${o.observacionesAtencion || ""}`.toLowerCase();
    return (
      texto.includes("planta externa") ||
      texto.includes("pex") ||
      texto.includes("masiva") ||
      texto.includes("caja llena") ||
      texto.includes("sin puerto") ||
      texto.includes("poste") ||
      texto.includes("permiso municipal") ||
      texto.includes("red win") ||
      texto.includes("cto") ||
      texto.includes("corte de fibra") ||
      texto.includes("sin señal") ||
      texto.includes("atenuación") ||
      texto.includes("atenuacion") ||
      texto.includes("externa")
    );
  };

  const normalizarEstado = (status?: string, tecnico?: string): string => {
    if (!status && !tecnico) return "PENDIENTE";
    const s = String(status || "").toUpperCase().trim();
    const t = String(tecnico || "").toUpperCase().trim();

    // 1. Finalizada Externa (Por status o por técnico externo Fénix)
    if (
      (s.includes("FINALIZ") || s.includes("LIQUID") || s.includes("TERMIN") || s.includes("FENIX")) &&
      (s.includes("EXTERN") || t.includes("EXTERNO:") || t.startsWith("EXTERNO"))
    ) {
      return "FINALIZADA EXTERNA";
    }

    // 2. Finalizada Empresa (Internas)
    if (s.includes("FINALIZ") || s.includes("LIQUID") || s.includes("TERMIN") || s.includes("FENIX")) {
      return "FINALIZADA";
    }

    // 3. Cancelada
    if (s.includes("CANCEL")) return "CANCELADA";

    // 4. Observada / Regestión / Anulada
    if (s.includes("OBSERV")) return "OBSERVADA";
    if (s.includes("REGEST") || s.includes("REAGEND")) return "REGESTION";
    if (s.includes("ANULAD")) return "ANULADA";

    // 5. En Proceso
    if (s.includes("INICIAD") || s.includes("EN CAMINO") || s.includes("PROCESO")) return "EN PROCESO";

    // 6. Agendada
    if (s.includes("AGENDAD") || s.includes("PENDIENTE")) return "AGENDADA";

    return s || "PENDIENTE";
  };

  // ── 9.5. CLASIFICACIÓN EXACTA DE TRAMOS HORARIOS ──
  const clasificarTramo = (tramoStr?: string): "T1" | "T2" | "T3" | "OTRO" => {
    if (!tramoStr) return "OTRO";
    const s = String(tramoStr).toLowerCase().trim();
    if (!s || s === "-" || s === "null" || s === "undefined") return "OTRO";

    // 1. Detección por etiquetas explícitas
    if (s === "t1" || s.includes("tramo 1") || s.includes("tramo1") || s.includes("mañana") || s.includes("manana")) {
      return "T1";
    }
    if (s === "t2" || s.includes("tramo 2") || s.includes("tramo2") || s.includes("tarde")) {
      return "T2";
    }
    if (s === "t3" || s.includes("tramo 3") || s.includes("tramo3") || s.includes("noche")) {
      return "T3";
    }

    // 2. Tramo 1: 8 a 12 (08:00 - 12:00, 8:00 - 12:00, 8 a 12, 8-12)
    if (
      s.includes("08:00") ||
      s.includes("8:00") ||
      s.includes("8 a 12") ||
      s.includes("8 - 12") ||
      s.includes("8-12") ||
      (s.includes("8") && s.includes("12") && !s.includes("16") && !s.includes("20") && !s.includes("4"))
    ) {
      return "T1";
    }

    // 3. Tramo 2: 12 a 4 / 12 a 16 (12:00 - 16:00, 12:00 - 04:00, 12 a 4, 12-16, 12-4)
    if (
      s.includes("12:00 - 16:00") ||
      s.includes("12:00-16:00") ||
      s.includes("12:00 - 04:00") ||
      s.includes("12:00-04:00") ||
      s.includes("12:00 - 4:00") ||
      s.includes("12 a 4") ||
      s.includes("12 - 4") ||
      s.includes("12-4") ||
      s.includes("12 a 16") ||
      s.includes("12 - 16") ||
      s.includes("12-16") ||
      (s.includes("12") && (s.includes("16") || s.includes("4")))
    ) {
      return "T2";
    }

    // 4. Tramo 3: 4 a 8 / 16 a 20 (16:00 - 20:00, 16:00 - 08:00, 04:00 - 08:00, 4 a 8, 16-20, 4-8)
    if (
      s.includes("16:00 - 20:00") ||
      s.includes("16:00-20:00") ||
      s.includes("16:00 - 08:00") ||
      s.includes("16:00-08:00") ||
      s.includes("04:00 - 08:00") ||
      s.includes("04:00-08:00") ||
      s.includes("4:00 - 8:00") ||
      s.includes("04:00 - 20:00") ||
      s.includes("4 a 8") ||
      s.includes("4 - 8") ||
      s.includes("4-8") ||
      s.includes("16 a 20") ||
      s.includes("16 - 20") ||
      s.includes("16-20") ||
      s.includes("20:00") ||
      (s.includes("16") && (s.includes("20") || s.includes("8"))) ||
      (s.includes("4") && s.includes("8") && !s.includes("12"))
    ) {
      return "T3";
    }

    // 5. Fallback por hora de inicio numérica
    const timeMatch = s.match(/(\d{1,2}):?(\d{2})?/);
    if (timeMatch) {
      const h = parseInt(timeMatch[1], 10);
      if (h >= 7 && h < 12) return "T1";
      if (h >= 12 && h < 16) return "T2";
      if (h >= 16 || h === 4) return "T3";
    }

    return "OTRO";
  };

  // ── 10. FILTRADO BASE EN MEMORIA (EXCEPTO ESTADO, PARA MÉTRICAS KPI ROBUSTAS) ──
  const ordenesBaseParaMetricas = useMemo(() => {
    return ordenes.filter((o) => {
      // 1. Observadas Externas vs Internas
      if (filtroTipoObservacion !== "TODAS") {
        const esExt = esObservadaExterna(o);
        if (filtroTipoObservacion === "EXTERNAS" && !esExt) return false;
        if (filtroTipoObservacion === "INTERNAS" && esExt) return false;
      }

      // 2. Técnico
      if (filtroTecnico !== "TODOS") {
        const orderTec = (o.tecnico || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const filterTec = filtroTecnico.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

        if (!orderTec) return false;

        const isDirectMatch =
          orderTec === filterTec ||
          orderTec.includes(filterTec) ||
          filterTec.includes(orderTec);

        if (!isDirectMatch) {
          const wordsFilter = filterTec.split(/\s+/).filter((w) => w.length > 2);
          const wordsOrder = orderTec.split(/\s+/).filter((w) => w.length > 2);
          const commonWords = wordsFilter.filter((w) => wordsOrder.includes(w));
          if (commonWords.length < 2) {
            return false;
          }
        }
      }

      // 3. Cuadrilla
      if (filtroCuadrilla !== "TODAS") {
        if (!o.cuadrilla || o.cuadrilla.trim().toLowerCase() !== filtroCuadrilla.trim().toLowerCase()) {
          return false;
        }
      }

      // 4. Tramo
      if (filtroTramo !== "TODOS") {
        const tramoCat = clasificarTramo(o.tramo);
        if (filtroTramo === "T1" || filtroTramo === "T2" || filtroTramo === "T3") {
          if (tramoCat !== filtroTramo) return false;
        } else {
          if (!o.tramo || o.tramo.trim().toLowerCase() !== filtroTramo.trim().toLowerCase()) {
            return false;
          }
        }
      }

      // 5. Tipo de Trabajo
      if (filtroTipoTrabajo !== "TODOS") {
        const orderTipo = (o.tipoTrabajo || (o as any).tipo_trabajo || (o as any).tipoTrabajoAsignado || "").trim().toLowerCase();
        if (orderTipo !== filtroTipoTrabajo.trim().toLowerCase()) {
          return false;
        }
      }

      // 6. Distrito
      if (filtroDistrito !== "TODOS") {
        if (!o.distrito || o.distrito.trim().toLowerCase() !== filtroDistrito.trim().toLowerCase()) {
          return false;
        }
      }

      // 7. Búsqueda libre
      if (busquedaTexto.trim()) {
        const q = busquedaTexto.toLowerCase().trim();
        const ticket = (o.ticket || "").toLowerCase();
        const ot = (o.ot || o.numeroOrden || "").toLowerCase();
        const codPed = (o.codigoPedido || "").toLowerCase();
        const cli = (o.cliente || "").toLowerCase();
        const tel = (o.celular || "").toLowerCase();
        const dir = (o.direccion || "").toLowerCase();
        const cto = (o.cto || "").toLowerCase();
        const tec = (o.tecnico || "").toLowerCase();
        const mot = (o.motivoFinalizacion || o.motivoCancelacion || o.motivoRegestion || "").toLowerCase();

        const match =
          ticket.includes(q) ||
          ot.includes(q) ||
          codPed.includes(q) ||
          cli.includes(q) ||
          tel.includes(q) ||
          dir.includes(q) ||
          cto.includes(q) ||
          tec.includes(q) ||
          mot.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [
    ordenes,
    filtroTipoObservacion,
    filtroTecnico,
    filtroCuadrilla,
    filtroTramo,
    filtroTipoTrabajo,
    filtroDistrito,
    busquedaTexto,
  ]);

  // ── 10.5. FILTRADO FINAL CON MULTI-SELECCIÓN ACUMULATIVA DE ESTADOS (OR) ──
  const ordenesFiltradas = useMemo(() => {
    if (filtrosEstados.length === 0) {
      return ordenesBaseParaMetricas;
    }

    return ordenesBaseParaMetricas.filter((o) => {
      const stNorm = normalizarEstado(o.status || o.estado, o.tecnico);
      return filtrosEstados.some((stFiltro) => {
        if (stFiltro === "FINALIZADA") return stNorm === "FINALIZADA";
        if (stFiltro === "FINALIZADA_EXTERNA") return stNorm === "FINALIZADA EXTERNA";
        if (stFiltro === "CANCELADA") return stNorm === "CANCELADA";
        if (stFiltro === "OBSERVADA") return stNorm === "OBSERVADA" || stNorm === "REGESTION";
        if (stFiltro === "EN_PROCESO") return stNorm === "EN PROCESO";
        if (stFiltro === "AGENDADA") return stNorm === "AGENDADA" || stNorm === "PENDIENTE";
        if (stFiltro === "ANULADA") return stNorm === "ANULADA";
        return false;
      });
    });
  }, [ordenesBaseParaMetricas, filtrosEstados]);

  // ── 11. ORDENAMIENTO DINÁMICO ──
  const ordenesOrdenadas = useMemo(() => {
    const list = [...ordenesFiltradas];
    list.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      switch (ordenColumna) {
        case "fecha":
          valA = a.fecha || "";
          valB = b.fecha || "";
          break;
        case "ticket":
          valA = a.ticket || "";
          valB = b.ticket || "";
          break;
        case "cliente":
          valA = (a.cliente || "").toLowerCase();
          valB = (b.cliente || "").toLowerCase();
          break;
        case "tecnico":
          valA = (a.tecnico || "").toLowerCase();
          valB = (b.tecnico || "").toLowerCase();
          break;
        case "cuadrilla":
          valA = (a.cuadrilla || "").toLowerCase();
          valB = (b.cuadrilla || "").toLowerCase();
          break;
        case "tramo":
          valA = (a.tramo || "").toLowerCase();
          valB = (b.tramo || "").toLowerCase();
          break;
        case "estado":
          valA = (a.status || a.estado || "").toLowerCase();
          valB = (b.status || b.estado || "").toLowerCase();
          break;
        case "tipoTrabajo":
          valA = (a.tipoTrabajo || "").toLowerCase();
          valB = (b.tipoTrabajo || "").toLowerCase();
          break;
        default:
          valA = a.fecha || "";
          valB = b.fecha || "";
      }

      if (valA < valB) return ordenDireccion === "asc" ? -1 : 1;
      if (valA > valB) return ordenDireccion === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [ordenesFiltradas, ordenColumna, ordenDireccion]);

  // ── 12. PAGINACIÓN ──
  const totalRegistros = ordenesOrdenadas.length;
  const totalPaginas = registrosPorPagina === -1 ? 1 : Math.ceil(totalRegistros / registrosPorPagina) || 1;
  const ordenesPaginadas = useMemo(() => {
    if (registrosPorPagina === -1) return ordenesOrdenadas;
    const inicio = (paginaActual - 1) * registrosPorPagina;
    return ordenesOrdenadas.slice(inicio, inicio + registrosPorPagina);
  }, [ordenesOrdenadas, paginaActual, registrosPorPagina]);

  const handleCambiarOrden = (col: string) => {
    if (ordenColumna === col) {
      setOrdenDireccion((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setOrdenColumna(col);
      setOrdenDireccion("asc");
    }
  };

  // ── 13. RESUMEN KPI COMPACTO (CALCULADO SOBRE BASE PARA CONTEO PERMANENTE) ──
  const metricas = useMemo(() => {
    let finalizadas = 0;
    let finalizadasExt = 0;
    let canceladas = 0;
    let observadas = 0;
    let proceso = 0;
    let agendadas = 0;
    let observadasExt = 0;
    let dropTotal = 0;
    const tecs = new Set<string>();

    ordenesBaseParaMetricas.forEach((o) => {
      const st = normalizarEstado(o.status || o.estado, o.tecnico);
      if (st === "FINALIZADA") finalizadas++;
      else if (st === "FINALIZADA EXTERNA") finalizadasExt++;
      else if (st === "CANCELADA") canceladas++;
      else if (st === "OBSERVADA" || st === "REGESTION" || st === "ANULADA") observadas++;
      else if (st === "EN PROCESO") proceso++;
      else agendadas++;

      if (esObservadaExterna(o)) observadasExt++;
      if (o.tecnico && o.tecnico.trim() && o.tecnico !== "Seleccione") tecs.add(o.tecnico.trim());
      if (o.totalDrop) dropTotal += Number(o.totalDrop) || 0;
    });

    const total = ordenesBaseParaMetricas.length;
    const totalEvaluadasEmpresa = finalizadas + canceladas + observadas;
    const efec = totalEvaluadasEmpresa > 0
      ? ((finalizadas / totalEvaluadasEmpresa) * 100).toFixed(1)
      : "0.0";

    return {
      total,
      finalizadas,
      finalizadasExt,
      canceladas,
      observadas,
      proceso,
      agendadas,
      observadasExt,
      dropTotal,
      tecnicosCount: tecs.size,
      efectividad: efec,
    };
  }, [ordenesBaseParaMetricas]);

  // ── 14. EXPORTACIÓN PROFESIONAL A EXCEL (.XLSX) CON COLUMNAS SELECCIONADAS ──
  const exportarAExcel = () => {
    if (ordenesFiltradas.length === 0) {
      alert("No hay registros en la vista actual para exportar.");
      return;
    }

    const colsActivas = TODAS_COLUMNAS.filter((c) => columnasVisibles[c.id] !== false);
    if (colsActivas.length === 0) {
      alert("Debes seleccionar al menos una columna para exportar.");
      return;
    }

    const dataExcel = ordenesFiltradas.map((o, idx) => {
      const st = normalizarEstado(o.status || o.estado, o.tecnico);
      const isLlamada = Boolean(o.inconcert === true || o.inconcert === "Si" || o.inconcert === "Sí" || String(o.inconcert) === "1") ? "Sí" : "No";

      const row: Record<string, any> = {};

      if (columnasVisibles.indice !== false) row["#"] = idx + 1;
      if (columnasVisibles.fecha !== false) row["Fecha"] = o.fecha ? o.fecha.split(" ")[0].split("T")[0] : "";
      if (columnasVisibles.celular !== false) row["Celular"] = o.celular || "";
      if (columnasVisibles.llamada !== false) row["Llamada"] = isLlamada;
      if (columnasVisibles.observacionLlamada !== false) row["Observación de Llamada"] = o.observacionLlamada || "";
      if (columnasVisibles.dni !== false) row["DNI"] = o.dni || "";
      if (columnasVisibles.cliente !== false) row["Cliente"] = o.cliente || "";
      if (columnasVisibles.direccion !== false) row["Dirección"] = o.direccion || "";
      if (columnasVisibles.distrito !== false) row["Distrito"] = o.distrito || "";
      if (columnasVisibles.cto !== false) row["CTO"] = o.cto || "";
      if (columnasVisibles.codigoPedido !== false) row["Código de Pedido"] = o.codigoPedido || "";
      if (columnasVisibles.ot !== false) row["OT"] = o.ot || o.numeroOrden || "";
      if (columnasVisibles.ticket !== false) row["Número de Ticket"] = o.ticket || "";
      if (columnasVisibles.tecnico !== false) row["Técnico"] = o.tecnico || "";
      if (columnasVisibles.acta !== false) row["Acta"] = o.acta || "";
      if (columnasVisibles.tareas !== false) row["Tareas"] = o.totalTareas ? `${o.tareasFinalizadas || 0}/${o.totalTareas}` : "";
      if (columnasVisibles.asignacion !== false) row["Asignación"] = o.horaAsignacion || "";
      if (columnasVisibles.camino !== false) row["Camino"] = o.horaEnCamino || "";
      if (columnasVisibles.inicio !== false) row["Inicio"] = o.horaInicio || "";
      if (columnasVisibles.fin !== false) row["Fin"] = o.horaFin || "";
      if (columnasVisibles.tramo !== false) row["Tramo"] = o.tramo || "";
      if (columnasVisibles.status !== false) row["Status"] = st === "FINALIZADA EXTERNA" ? "FINALIZADA EXTERNA" : (o.status || o.estado || st);
      if (columnasVisibles.cuadrilla !== false) row["Cuadrilla"] = o.cuadrilla || "";
      if (columnasVisibles.tipoTrabajoAsignado !== false) row["Tipo de Trabajo Asignado"] = o.tipoTrabajoAsignado || "";
      if (columnasVisibles.tipoLiquidacion !== false) row["Tipo de Liquidación"] = o.tipoLiquidacion || o.motivoLiquidacion || o.motivoFinalizacion || "";
      if (columnasVisibles.tipoTrabajo !== false) row["Tipo de Trabajo"] = o.tipoTrabajo || "";
      if (columnasVisibles.observacionesAtencion !== false) row["Observaciones de la Atención"] = o.observacionesAtencion || "";
      if (columnasVisibles.totalDrop !== false) row["Total Drop"] = o.totalDrop || 0;
      if (columnasVisibles.anchoBanda !== false) row["Ancho de Banda"] = o.anchoBanda || "";

      return row;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dataExcel);

    ws["!cols"] = colsActivas.map((c) => ({ wch: c.width || 15 }));

    XLSX.utils.book_append_sheet(wb, ws, "Órdenes");

    const stamp = new Date().toISOString().replace(/T/, "_").replace(/:/g, "-").slice(0, 19);
    const nombreArchivo = `Reporte_Ordenes_Exportacion_${fechaDesde}_al_${fechaHasta}_${stamp}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
  };

  // ── 15. EXPORTACIÓN A CSV CON COLUMNAS SELECCIONADAS ──
  const exportarACSV = () => {
    if (ordenesFiltradas.length === 0) {
      alert("No hay registros en la vista actual para exportar.");
      return;
    }

    const colsActivas = TODAS_COLUMNAS.filter((c) => columnasVisibles[c.id] !== false);
    if (colsActivas.length === 0) {
      alert("Debes seleccionar al menos una columna para exportar.");
      return;
    }

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const s = String(val).replace(/"/g, '""');
      return `"${s}"`;
    };

    const headers = colsActivas.map((c) => c.label.replace(/\s+/g, "_"));

    const rows = ordenesFiltradas.map((o, idx) => {
      const st = normalizarEstado(o.status || o.estado, o.tecnico);
      const isLlamada = Boolean(o.inconcert === true || o.inconcert === "Si" || o.inconcert === "Sí" || String(o.inconcert) === "1") ? "Sí" : "No";

      const rowValues: any[] = [];

      if (columnasVisibles.indice !== false) rowValues.push(idx + 1);
      if (columnasVisibles.fecha !== false) rowValues.push(escapeCsv(o.fecha ? o.fecha.split(" ")[0].split("T")[0] : ""));
      if (columnasVisibles.celular !== false) rowValues.push(escapeCsv(o.celular || ""));
      if (columnasVisibles.llamada !== false) rowValues.push(escapeCsv(isLlamada));
      if (columnasVisibles.observacionLlamada !== false) rowValues.push(escapeCsv(o.observacionLlamada || ""));
      if (columnasVisibles.dni !== false) rowValues.push(escapeCsv(o.dni || ""));
      if (columnasVisibles.cliente !== false) rowValues.push(escapeCsv(o.cliente || ""));
      if (columnasVisibles.direccion !== false) rowValues.push(escapeCsv(o.direccion || ""));
      if (columnasVisibles.distrito !== false) rowValues.push(escapeCsv(o.distrito || ""));
      if (columnasVisibles.cto !== false) rowValues.push(escapeCsv(o.cto || ""));
      if (columnasVisibles.codigoPedido !== false) rowValues.push(escapeCsv(o.codigoPedido || ""));
      if (columnasVisibles.ot !== false) rowValues.push(escapeCsv(o.ot || o.numeroOrden || ""));
      if (columnasVisibles.ticket !== false) rowValues.push(escapeCsv(o.ticket || ""));
      if (columnasVisibles.tecnico !== false) rowValues.push(escapeCsv(o.tecnico || ""));
      if (columnasVisibles.acta !== false) rowValues.push(escapeCsv(o.acta || ""));
      if (columnasVisibles.tareas !== false) rowValues.push(escapeCsv(o.totalTareas ? `${o.tareasFinalizadas || 0}/${o.totalTareas}` : ""));
      if (columnasVisibles.asignacion !== false) rowValues.push(escapeCsv(o.horaAsignacion || ""));
      if (columnasVisibles.camino !== false) rowValues.push(escapeCsv(o.horaEnCamino || ""));
      if (columnasVisibles.inicio !== false) rowValues.push(escapeCsv(o.horaInicio || ""));
      if (columnasVisibles.fin !== false) rowValues.push(escapeCsv(o.horaFin || ""));
      if (columnasVisibles.tramo !== false) rowValues.push(escapeCsv(o.tramo || ""));
      if (columnasVisibles.status !== false) rowValues.push(escapeCsv(st === "FINALIZADA EXTERNA" ? "FINALIZADA EXTERNA" : (o.status || o.estado || st)));
      if (columnasVisibles.cuadrilla !== false) rowValues.push(escapeCsv(o.cuadrilla || ""));
      if (columnasVisibles.tipoTrabajoAsignado !== false) rowValues.push(escapeCsv(o.tipoTrabajoAsignado || ""));
      if (columnasVisibles.tipoLiquidacion !== false) rowValues.push(escapeCsv(o.tipoLiquidacion || o.motivoLiquidacion || o.motivoFinalizacion || ""));
      if (columnasVisibles.tipoTrabajo !== false) rowValues.push(escapeCsv(o.tipoTrabajo || ""));
      if (columnasVisibles.observacionesAtencion !== false) rowValues.push(escapeCsv(o.observacionesAtencion || ""));
      if (columnasVisibles.totalDrop !== false) rowValues.push(o.totalDrop || 0);
      if (columnasVisibles.anchoBanda !== false) rowValues.push(escapeCsv(o.anchoBanda || ""));

      return rowValues;
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Data_Telecom_Ordenes_${fechaDesde}_al_${fechaHasta}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const anioActual = new Date().getFullYear();

  return (
    <div className="space-y-2">
      {/* ─────────────────────────────────────────────────────────────
          1. BARRA SUPERIOR ULTRA-COMPACTA: TÍTULO + MESES + FECHAS + EXPORTACIÓN
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs px-3 py-2 flex flex-col xl:flex-row xl:items-center justify-between gap-2">
        {/* Lado Izquierdo: Título y Atajos de Meses en una sola línea */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#1e4b8a] text-white flex items-center justify-center shadow-2xs">
              <FileSpreadsheet className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
              Data & Exportación
            </span>
          </div>

          {/* Atajos de Meses y Período */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => handleShortcutPeriodo("hoy")}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                periodoActivo === "hoy"
                  ? "bg-[#1e4b8a] text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => handleShortcutPeriodo("ayer")}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                periodoActivo === "ayer"
                  ? "bg-[#1e4b8a] text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Ayer
            </button>
            <button
              type="button"
              onClick={() => handleShortcutPeriodo("semana")}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                periodoActivo === "semana"
                  ? "bg-[#1e4b8a] text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              7d
            </button>
            <button
              type="button"
              onClick={() => handleShortcutPeriodo("mes")}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                periodoActivo === "mes"
                  ? "bg-[#1e4b8a] text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Mes Actual
            </button>
            <button
              type="button"
              onClick={() => handleShortcutPeriodo("mes_anterior")}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                periodoActivo === "mes_anterior"
                  ? "bg-[#1e4b8a] text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Mes Ant.
            </button>
          </div>

          {/* Desplegable de Meses */}
          <div className="relative">
            <select
              value={periodoActivo}
              onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith("mes_")) {
                  const parts = v.split("_");
                  const anio = parseInt(parts[1], 10);
                  const mes = parseInt(parts[2], 10);
                  handleSeleccionarMes(mes, anio);
                }
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg pl-2 pr-6 py-1 text-[11px] font-bold text-slate-800 focus:outline-none focus:border-sky-500 appearance-none cursor-pointer"
            >
              <optgroup label={`📅 ${anioActual}`}>
                {MESES.map((m) => (
                  <option key={`curr_${m.num}`} value={`mes_${anioActual}_${m.num}`}>
                    {m.label} {anioActual}
                  </option>
                ))}
              </optgroup>
              <optgroup label={`📂 ${anioActual - 1}`}>
                {MESES.map((m) => (
                  <option key={`prev_${m.num}`} value={`mes_${anioActual - 1}_${m.num}`}>
                    {m.label} {anioActual - 1}
                  </option>
                ))}
              </optgroup>
            </select>
            <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Calendario Desde / Hasta Inline */}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => {
                setFechaDesde(e.target.value);
                setPeriodoActivo("custom");
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-800 font-bold focus:outline-none focus:border-sky-500 w-[115px]"
            />
            <span className="text-[10px] font-bold text-slate-400">-</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => {
                setFechaHasta(e.target.value);
                setPeriodoActivo("custom");
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-800 font-bold focus:outline-none focus:border-sky-500 w-[115px]"
            />
            <button
              type="button"
              onClick={() => fetchOrdenesData()}
              disabled={loading}
              className="p-1 bg-[#1e4b8a] hover:bg-[#163866] text-white rounded-lg transition-all cursor-pointer shadow-2xs"
              title="Filtrar rango de fechas"
            >
              <Search size={13} />
            </button>
          </div>
        </div>

        {/* Lado Derecho: Botones de Configurar Columnas, Exportar Excel, CSV y Recargar */}
        <div className="flex items-center gap-1.5 shrink-0 justify-end">
          {/* Botón de Selección / Filtro de Columnas */}
          <button
            type="button"
            onClick={() => setModalColumnasAbierto(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs transition-all cursor-pointer active:scale-95"
            title="Seleccionar qué columnas mostrar y exportar"
          >
            <Columns size={13} className="text-sky-700" />
            <span>Columnas</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9.5px] font-mono font-black bg-sky-100 text-sky-900">
              {cantColumnasActivas}/{TODAS_COLUMNAS.length}
            </span>
          </button>

          <button
            type="button"
            onClick={exportarAExcel}
            disabled={ordenesFiltradas.length === 0}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-black bg-[#107c41] hover:bg-[#0c6233] text-white shadow-2xs hover:shadow transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            title="Exportar listado a Excel (.xlsx) con las columnas seleccionadas"
          >
            <Download size={13} />
            <span>Exportar Excel ({ordenesFiltradas.length})</span>
          </button>

          <button
            type="button"
            onClick={exportarACSV}
            disabled={ordenesFiltradas.length === 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-900 text-white shadow-2xs transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            title="Exportar CSV con las columnas seleccionadas"
          >
            <FileText size={13} />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={() => fetchOrdenesData()}
            disabled={loading}
            className="p-1 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded-lg transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            title="Recargar data"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-sky-600" : "text-sky-600"} />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. BARRA DE FILTROS & MINI-MÉTRICAS EN UNA SOLA LÍNEA ULTRA-DELGADA
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs px-3 py-1.5 flex flex-col lg:flex-row lg:items-center justify-between gap-2 text-xs">
        {/* Mini Píldoras de Métricas KPI Interactivas con Multi-Selección */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {/* Total / Órdenes */}
          <button
            type="button"
            onClick={() => handleToggleEstado("TODOS")}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black border transition-all cursor-pointer ${
              isEstadoActivo("TODOS")
                ? "bg-slate-900 text-white border-slate-950 ring-2 ring-slate-400 shadow-2xs scale-102"
                : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
            }`}
            title="Ver todas las órdenes (Clic para restablecer filtro de estado)"
          >
            <span>Órdenes:</span>
            <strong className="font-mono">{metricas.total}</strong>
          </button>

          {/* Finalizadas Empresa */}
          <button
            type="button"
            onClick={() => handleToggleEstado("FINALIZADA")}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black border transition-all cursor-pointer ${
              isEstadoActivo("FINALIZADA")
                ? "bg-[#1f4e78] text-white border-[#163857] ring-2 ring-sky-300 shadow-2xs scale-102"
                : "bg-[#deebf7] text-[#1f4e78] border-[#5b9bd5]/50 hover:bg-[#cbe0f4]"
            }`}
            title="Sumar/Filtrar Finalizadas Empresa (Clic para sumar/quitar)"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isEstadoActivo("FINALIZADA") ? "bg-sky-200" : "bg-[#1f4e78]"}`}></span>
            <span>Fin. Empresa:</span>
            <strong className="font-mono">{metricas.finalizadas}</strong>
            <span className={`text-[10px] font-bold ${isEstadoActivo("FINALIZADA") ? "text-sky-200" : "text-[#2b6ba3]"}`}>
              ({metricas.efectividad}%)
            </span>
          </button>

          {/* Finalizadas Externas (Aparte de Empresa) */}
          <button
            type="button"
            onClick={() => handleToggleEstado("FINALIZADA_EXTERNA")}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black border transition-all cursor-pointer ${
              isEstadoActivo("FINALIZADA_EXTERNA")
                ? "bg-purple-700 text-white border-purple-800 ring-2 ring-purple-300 shadow-2xs scale-102"
                : "bg-purple-50 text-purple-900 border-purple-300 hover:bg-purple-100"
            }`}
            title="Sumar/Filtrar Finalizadas Externas (Clic para sumar/quitar)"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isEstadoActivo("FINALIZADA_EXTERNA") ? "bg-purple-200" : "bg-purple-600"}`}></span>
            <span>Fin. Externas:</span>
            <strong className="font-mono">{metricas.finalizadasExt}</strong>
          </button>

          {/* Canceladas */}
          <button
            type="button"
            onClick={() => handleToggleEstado("CANCELADA")}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black border transition-all cursor-pointer ${
              isEstadoActivo("CANCELADA")
                ? "bg-amber-600 text-white border-amber-700 ring-2 ring-amber-300 shadow-2xs scale-102"
                : "bg-[#fff9db] text-amber-900 border-amber-300 hover:bg-amber-100"
            }`}
            title="Sumar/Filtrar Canceladas (Clic para sumar/quitar)"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isEstadoActivo("CANCELADA") ? "bg-amber-200" : "bg-amber-600"}`}></span>
            <span>Canceladas:</span>
            <strong className="font-mono">{metricas.canceladas}</strong>
          </button>

          {/* Observadas */}
          <button
            type="button"
            onClick={() => handleToggleEstado("OBSERVADA")}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black border transition-all cursor-pointer ${
              isEstadoActivo("OBSERVADA")
                ? "bg-[#833c0c] text-white border-[#612c09] ring-2 ring-amber-400 shadow-2xs scale-102"
                : "bg-[#fff2cc] text-[#833c0c] border-[#ffe699] hover:bg-[#ffebb3]"
            }`}
            title="Sumar/Filtrar Observadas (Clic para sumar/quitar)"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isEstadoActivo("OBSERVADA") ? "bg-amber-200" : "bg-[#833c0c]"}`}></span>
            <span>Observadas:</span>
            <strong className="font-mono">{metricas.observadas}</strong>
            {metricas.observadasExt > 0 && (
              <span className={`text-[9.5px] font-bold ${isEstadoActivo("OBSERVADA") ? "text-amber-200" : "text-[#b45309]"}`}>
                ({metricas.observadasExt} ext)
              </span>
            )}
          </button>

          {/* En Proceso */}
          <button
            type="button"
            onClick={() => handleToggleEstado("EN_PROCESO")}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black border transition-all cursor-pointer ${
              isEstadoActivo("EN_PROCESO")
                ? "bg-[#385723] text-white border-[#273d18] ring-2 ring-emerald-300 shadow-2xs scale-102"
                : "bg-[#e2efda] text-[#385723] border-[#70ad47]/50 hover:bg-[#d1e7c5]"
            }`}
            title="Sumar/Filtrar En Proceso (Clic para sumar/quitar)"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isEstadoActivo("EN_PROCESO") ? "bg-emerald-200" : "bg-[#385723]"}`}></span>
            <span>En Proceso:</span>
            <strong className="font-mono">{metricas.proceso}</strong>
          </button>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold">
            <span>Técnicos:</span>
            <strong className="text-slate-900 font-mono">{metricas.tecnicosCount}</strong>
          </span>
        </div>

        {/* Filtros Dropdowns Compactos */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end flex-1">
          {/* Buscador de texto */}
          <div className="relative min-w-[170px] max-w-[220px] flex-1">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar Ticket, OT, Cliente..."
              value={busquedaTexto}
              onChange={(e) => {
                setBusquedaTexto(e.target.value);
                setPaginaActual(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-5 py-0.5 text-[11px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 font-medium"
            />
            {busquedaTexto && (
              <button
                type="button"
                onClick={() => setBusquedaTexto("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Estado */}
          <select
            value={filtrosEstados.length === 0 ? "TODOS" : (filtrosEstados.length === 1 ? filtrosEstados[0] : "MULTI")}
            onChange={(e) => {
              const val = e.target.value;
              setPaginaActual(1);
              if (val === "TODOS") {
                setFiltrosEstados([]);
              } else if (val === "MULTI_FIN_CANC") {
                setFiltrosEstados(["FINALIZADA", "CANCELADA"]);
              } else if (val === "MULTI_FIN_OBS") {
                setFiltrosEstados(["FINALIZADA", "OBSERVADA"]);
              } else if (val === "MULTI_CANC_OBS") {
                setFiltrosEstados(["CANCELADA", "OBSERVADA"]);
              } else if (val !== "MULTI") {
                setFiltrosEstados([val]);
              }
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] font-bold text-slate-800 focus:outline-none focus:border-sky-500 cursor-pointer max-w-[165px]"
          >
            {filtrosEstados.length > 1 && (
              <option value="MULTI">⭐ Varios ({filtrosEstados.length} activos)</option>
            )}
            <option value="TODOS">Todos Estados</option>
            <option value="FINALIZADA">🔵 Fin. Empresa</option>
            <option value="FINALIZADA_EXTERNA">🟣 Fin. Externas</option>
            <option value="CANCELADA">🟡 Canceladas</option>
            <option value="OBSERVADA">🟡 Observadas</option>
            <option value="EN_PROCESO">🟢 En Proceso</option>
            <option value="AGENDADA">⚪ Agendadas</option>
            <option value="MULTI_FIN_CANC">🔵+🟡 Fin. Empresa + Canceladas</option>
            <option value="MULTI_FIN_OBS">🔵+🟡 Fin. Empresa + Observadas</option>
            <option value="MULTI_CANC_OBS">🟡+🟡 Canceladas + Observadas</option>
          </select>

          {/* Observadas */}
          <select
            value={filtroTipoObservacion}
            onChange={(e) => {
              setFiltroTipoObservacion(e.target.value);
              setPaginaActual(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] font-bold text-slate-800 focus:outline-none focus:border-sky-500 cursor-pointer max-w-[125px]"
          >
            <option value="TODAS">Obs: Todas</option>
            <option value="EXTERNAS">🌐 Obs Externas</option>
            <option value="INTERNAS">👤 Obs Internas</option>
          </select>

          {/* Técnico Asignado (Conectado oficial a usuarios) */}
          <select
            value={filtroTecnico}
            onChange={(e) => {
              setFiltroTecnico(e.target.value);
              setPaginaActual(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] font-bold text-slate-800 focus:outline-none focus:border-sky-500 cursor-pointer max-w-[160px]"
          >
            <option value="TODOS">Todos Técnicos ({tecnicosList.length})</option>
            {tecnicosList.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Cuadrilla */}
          <select
            value={filtroCuadrilla}
            onChange={(e) => {
              setFiltroCuadrilla(e.target.value);
              setPaginaActual(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] font-bold text-slate-800 focus:outline-none focus:border-sky-500 cursor-pointer max-w-[130px]"
          >
            <option value="TODAS">Cuadrillas ({cuadrillasList.length})</option>
            {cuadrillasList.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Tipo de Trabajo */}
          <select
            value={filtroTipoTrabajo}
            onChange={(e) => {
              setFiltroTipoTrabajo(e.target.value);
              setPaginaActual(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] font-bold text-slate-800 focus:outline-none focus:border-sky-500 cursor-pointer max-w-[155px]"
          >
            <option value="TODOS">Todos Tipos Trabajo ({tiposTrabajoList.length})</option>
            {tiposTrabajoList.map((tt) => (
              <option key={tt} value={tt}>
                {tt}
              </option>
            ))}
          </select>

          {/* Tramo */}
          <select
            value={filtroTramo}
            onChange={(e) => {
              setFiltroTramo(e.target.value);
              setPaginaActual(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] font-bold text-slate-800 focus:outline-none focus:border-sky-500 cursor-pointer min-w-[135px]"
          >
            <option value="TODOS">Todos Tramos</option>
            <option value="T1">🌅 Tramo 1 (8 a 12)</option>
            <option value="T2">☀️ Tramo 2 (12 a 4)</option>
            <option value="T3">🌙 Tramo 3 (4 a 8)</option>
          </select>

          {/* Botón Restablecer */}
          <button
            type="button"
            onClick={handleLimpiarFiltros}
            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
            title="Restablecer filtros"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. TABLA DE ÓRDENES MAXIMIZADA A PANTALLA COMPLETA (INFORMATIVA Y LIMPIA)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Barra superior de conteo y registros por página */}
        <div className="px-3 py-1.5 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-slate-800">Vista Oficial de Órdenes</span>
            <span className="px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 font-bold text-[10px]">
              {ordenesFiltradas.length} registros
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold text-[10px]">Filas:</span>
            <select
              value={registrosPorPagina}
              onChange={(e) => {
                setRegistrosPorPagina(Number(e.target.value));
                setPaginaActual(1);
              }}
              className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10.5px] font-bold text-slate-700 focus:outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={-1}>Todas</option>
            </select>
          </div>
        </div>

        {/* Tabla con scroll vertical amplio para maximizar visión del grid */}
        <div className="overflow-x-auto max-h-[calc(100vh-210px)] min-h-[480px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-[11px] border-separate border-spacing-0 whitespace-nowrap">
            {/* CABECERA AZUL OFICIAL DE ÓRDENES (#1e4b8a) */}
            <thead className="sticky top-0 z-10 bg-[#1e4b8a] text-white shadow-2xs">
              <tr>
                {/* 0. # (Índice) */}
                {columnasVisibles.indice !== false && (
                  <th className="sticky top-0 left-0 z-20 bg-[#163866] text-slate-200 font-black uppercase text-[10px] tracking-wider py-1 px-1 text-center border-b border-slate-950 border-r border-blue-900 min-w-[34px] w-[34px] max-w-[34px]">
                    #
                  </th>
                )}
                {/* 1. Fecha */}
                {columnasVisibles.fecha !== false && (
                  <th
                    onClick={() => handleCambiarOrden("fecha")}
                    className={`sticky top-0 ${columnasVisibles.indice !== false ? "left-[34px]" : "left-0"} z-20 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-left border-b border-slate-950 border-r border-blue-900 min-w-[85px] w-[85px] cursor-pointer hover:bg-blue-900`}
                  >
                    <div className="flex items-center gap-1">
                      <span>Fecha</span>
                      <ArrowUpDown size={10} className="text-blue-300" />
                    </div>
                  </th>
                )}
                {/* 2. Celular */}
                {columnasVisibles.celular !== false && (
                  <th className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-left border-b border-slate-950">
                    Celular
                  </th>
                )}
                {/* 3. Llamada */}
                {columnasVisibles.llamada !== false && (
                  <th className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-center border-b border-slate-950">
                    Llamada
                  </th>
                )}
                {/* 4. Observación de Llamada */}
                {columnasVisibles.observacionLlamada !== false && (
                  <th className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-left border-b border-slate-950 min-w-[170px]">
                    Observación de Llamada
                  </th>
                )}
                {/* 5. DNI */}
                {columnasVisibles.dni !== false && (
                  <th className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-left border-b border-slate-950">
                    DNI
                  </th>
                )}
                {/* 6. Cliente */}
                {columnasVisibles.cliente !== false && (
                  <th
                    onClick={() => handleCambiarOrden("cliente")}
                    className="sticky top-0 lg:left-[119px] z-10 lg:z-20 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2.5 text-left border-b border-slate-950 border-r border-blue-900 min-w-[180px] lg:min-w-[210px] cursor-pointer hover:bg-blue-900"
                  >
                    <div className="flex items-center gap-1">
                      <span>Cliente</span>
                      <ArrowUpDown size={10} className="text-blue-300" />
                    </div>
                  </th>
                )}
                {/* 7. Dirección */}
                {columnasVisibles.direccion !== false && (
                  <th className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-left border-b border-slate-950 min-w-[200px]">
                    Dirección
                  </th>
                )}
                {/* 8. Distrito */}
                {columnasVisibles.distrito !== false && (
                  <th className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-left border-b border-slate-950">
                    Distrito
                  </th>
                )}
                {/* 9. CTO */}
                {columnasVisibles.cto !== false && (
                  <th className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-center border-b border-slate-950">
                    CTO
                  </th>
                )}
                {/* 10. Código de Pedido */}
                {columnasVisibles.codigoPedido !== false && (
                  <th className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-center border-b border-slate-950">
                    Código de Pedido
                  </th>
                )}
                {/* 11. OT */}
                {columnasVisibles.ot !== false && (
                  <th className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-center border-b border-slate-950">
                    OT
                  </th>
                )}
                {/* 12. Número de Ticket */}
                {columnasVisibles.ticket !== false && (
                  <th
                    onClick={() => handleCambiarOrden("ticket")}
                    className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-left border-b border-slate-950 min-w-[140px] cursor-pointer hover:bg-blue-900"
                  >
                    <div className="flex items-center gap-1">
                      <span>Número de Ticket</span>
                      <ArrowUpDown size={10} className="text-blue-300" />
                    </div>
                  </th>
                )}
                {/* 13. Técnico */}
                {columnasVisibles.tecnico !== false && (
                  <th
                    onClick={() => handleCambiarOrden("tecnico")}
                    className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-center border-b border-slate-950 min-w-[150px] cursor-pointer hover:bg-blue-900"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Técnico</span>
                      <ArrowUpDown size={10} className="text-blue-300" />
                    </div>
                  </th>
                )}
                {/* 14. Acta */}
                {columnasVisibles.acta !== false && (
                  <th className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-center border-b border-slate-950">
                    Acta
                  </th>
                )}
                {/* 15. Tareas */}
                {columnasVisibles.tareas !== false && (
                  <th className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-1.5 text-center border-b border-slate-950">
                    Tareas
                  </th>
                )}
                {/* 16. Asignación */}
                {columnasVisibles.asignacion !== false && (
                  <th className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-center border-b border-slate-950">
                    Asignación
                  </th>
                )}
                {/* 17. Camino */}
                {columnasVisibles.camino !== false && (
                  <th className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-center border-b border-slate-950">
                    Camino
                  </th>
                )}
                {/* 18. Inicio */}
                {columnasVisibles.inicio !== false && (
                  <th className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-center border-b border-slate-950">
                    Inicio
                  </th>
                )}
                {/* 19. Fin */}
                {columnasVisibles.fin !== false && (
                  <th className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-center border-b border-slate-950">
                    Fin
                  </th>
                )}
                {/* 20. Tramo */}
                {columnasVisibles.tramo !== false && (
                  <th
                    onClick={() => handleCambiarOrden("tramo")}
                    className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-center border-b border-slate-950 cursor-pointer hover:bg-blue-900"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Tramo</span>
                      <ArrowUpDown size={10} className="text-blue-300" />
                    </div>
                  </th>
                )}
                {/* 21. Status */}
                {columnasVisibles.status !== false && (
                  <th
                    onClick={() => handleCambiarOrden("estado")}
                    className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-center border-b border-slate-950 cursor-pointer hover:bg-blue-900"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Status</span>
                      <ArrowUpDown size={10} className="text-blue-300" />
                    </div>
                  </th>
                )}
                {/* 22. Cuadrilla */}
                {columnasVisibles.cuadrilla !== false && (
                  <th
                    onClick={() => handleCambiarOrden("cuadrilla")}
                    className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-left border-b border-slate-950 cursor-pointer hover:bg-blue-900"
                  >
                    <div className="flex items-center gap-1">
                      <span>Cuadrilla</span>
                      <ArrowUpDown size={10} className="text-blue-300" />
                    </div>
                  </th>
                )}
                {/* 23. Tipo de Trabajo Asignado */}
                {columnasVisibles.tipoTrabajoAsignado !== false && (
                  <th className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-left border-b border-slate-950 min-w-[160px]">
                    Tipo de Trabajo Asignado
                  </th>
                )}
                {/* 24. Tipo de Liquidación */}
                {columnasVisibles.tipoLiquidacion !== false && (
                  <th className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-left border-b border-slate-950 min-w-[160px]">
                    Tipo de Liquidación
                  </th>
                )}
                {/* 25. Tipo de Trabajo */}
                {columnasVisibles.tipoTrabajo !== false && (
                  <th
                    onClick={() => handleCambiarOrden("tipoTrabajo")}
                    className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-left border-b border-slate-950 min-w-[160px] cursor-pointer hover:bg-blue-900"
                  >
                    <div className="flex items-center gap-1">
                      <span>Tipo de Trabajo</span>
                      <ArrowUpDown size={10} className="text-blue-300" />
                    </div>
                  </th>
                )}
                {/* 26. Observaciones de la Atención */}
                {columnasVisibles.observacionesAtencion !== false && (
                  <th className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-left border-b border-slate-950 min-w-[200px]">
                    Observaciones de la Atención
                  </th>
                )}
                {/* 27. Total Drop */}
                {columnasVisibles.totalDrop !== false && (
                  <th className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-center border-b border-slate-950">
                    Total Drop
                  </th>
                )}
                {/* 28. Ancho de Banda */}
                {columnasVisibles.anchoBanda !== false && (
                  <th className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-center border-b border-slate-950 min-w-[100px]">
                    Ancho de Banda
                  </th>
                )}
                {/* 29. Ver */}
                <th className="sticky top-0 z-10 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1 px-2 text-center border-b border-slate-950">
                  Ver
                </th>
              </tr>
            </thead>

            {/* CUERPO DE LA TABLA LIMPIO E INFORMATIVO */}
            <tbody className="divide-y divide-slate-950">
              {loading ? (
                <tr>
                  <td colSpan={cantColumnasActivas + 1} className="py-16 text-center text-slate-500 bg-white">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-sky-600" />
                      <span className="text-xs font-bold text-slate-700">Cargando base de datos...</span>
                    </div>
                  </td>
                </tr>
              ) : ordenesPaginadas.length === 0 ? (
                <tr>
                  <td colSpan={cantColumnasActivas + 1} className="py-16 text-center text-slate-400 bg-white">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Layers className="w-7 h-7 text-slate-300" />
                      <span className="text-xs font-bold text-slate-600">
                        No se encontraron órdenes con los filtros seleccionados.
                      </span>
                      <button
                        type="button"
                        onClick={handleLimpiarFiltros}
                        className="text-xs text-sky-600 font-bold hover:underline cursor-pointer"
                      >
                        Limpiar filtros y ver todas
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                ordenesPaginadas.map((order, idx) => {
                  const numFila = registrosPorPagina === -1 ? idx + 1 : (paginaActual - 1) * registrosPorPagina + idx + 1;
                  const stNorm = normalizarEstado(order.status || order.estado, order.tecnico);
                  const rowColorClass = getRowColorByStatus(stNorm);
                  const badgeColorClass = getBadgeColorByStatus(stNorm);
                  const isLlamada = Boolean(order.inconcert === true || order.inconcert === "Si" || order.inconcert === "Sí" || String(order.inconcert) === "1");

                  return (
                    <tr
                      key={order.id || `${order.ticket}_${idx}`}
                      className={`transition-colors hover:brightness-95 ${rowColorClass}`}
                    >
                      {/* 0. # (Índice) */}
                      {columnasVisibles.indice !== false && (
                        <td className="sticky left-0 z-20 py-1 px-1 text-center font-mono font-black text-[10px] text-slate-800 bg-slate-200 border-b border-slate-950 border-r border-slate-400 min-w-[34px] w-[34px] max-w-[34px] select-none">
                          {numFila}
                        </td>
                      )}

                      {/* 1. Fecha */}
                      {columnasVisibles.fecha !== false && (
                        <td className={`sticky ${columnasVisibles.indice !== false ? "left-[34px]" : "left-0"} z-20 py-1 px-2 font-mono font-bold text-[11px] ${rowColorClass} border-b border-slate-950 border-r border-slate-400 min-w-[85px] w-[85px]`}>
                          {order.fecha ? order.fecha.split(" ")[0].split("T")[0] : "-"}
                        </td>
                      )}

                      {/* 2. Celular (Puro texto limpio informativo) */}
                      {columnasVisibles.celular !== false && (
                        <td className="py-1 px-2 font-mono text-[11px] font-bold text-slate-900 border-b border-slate-950">
                          {order.celular || "-"}
                        </td>
                      )}

                      {/* 3. Llamada (Inconcert) */}
                      {columnasVisibles.llamada !== false && (
                        <td className="py-1 px-2 text-center border-b border-slate-950">
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-black text-white ${
                              isLlamada ? "bg-emerald-600" : "bg-rose-600"
                            }`}
                          >
                            {isLlamada ? "Sí" : "No"}
                          </span>
                        </td>
                      )}

                      {/* 4. Observación de Llamada */}
                      {columnasVisibles.observacionLlamada !== false && (
                        <td className="py-1 px-2 text-slate-900 border-b border-slate-950 max-w-[220px] truncate" title={order.observacionLlamada || "-"}>
                          {order.observacionLlamada || "-"}
                        </td>
                      )}

                      {/* 5. DNI */}
                      {columnasVisibles.dni !== false && (
                        <td className="py-1 px-2 font-mono text-[11px] font-medium border-b border-slate-950">
                          {order.dni || "-"}
                        </td>
                      )}

                      {/* 6. Cliente (Puro texto limpio informativo sin botones) */}
                      {columnasVisibles.cliente !== false && (
                        <td className={`lg:sticky lg:left-[119px] z-10 lg:z-20 py-1 px-2.5 uppercase tracking-tight min-w-[180px] lg:min-w-[210px] lg:max-w-[210px] ${rowColorClass} border-b border-slate-950 border-r border-slate-400`}>
                          <span className="font-bold text-slate-900 truncate block" title={order.cliente}>
                            {order.cliente || "-"}
                          </span>
                        </td>
                      )}

                      {/* 7. Dirección */}
                      {columnasVisibles.direccion !== false && (
                        <td className="py-1 px-2 border-b border-slate-950 max-w-[260px] truncate" title={order.direccion || "-"}>
                          {order.direccion || "-"}
                        </td>
                      )}

                      {/* 8. Distrito */}
                      {columnasVisibles.distrito !== false && (
                        <td className="py-1 px-2 font-bold text-slate-900 border-b border-slate-950">
                          {order.distrito || "-"}
                        </td>
                      )}

                      {/* 9. CTO */}
                      {columnasVisibles.cto !== false && (
                        <td className="py-1 px-2 font-mono text-center font-medium border-b border-slate-950">
                          {order.cto || "-"}
                        </td>
                      )}

                      {/* 10. Código de Pedido */}
                      {columnasVisibles.codigoPedido !== false && (
                        <td className="py-1 px-2 font-mono text-center border-b border-slate-950">
                          {order.codigoPedido || "-"}
                        </td>
                      )}

                      {/* 11. OT */}
                      {columnasVisibles.ot !== false && (
                        <td className="py-1 px-2 font-mono font-bold text-center border-b border-slate-950">
                          {order.ot || order.numeroOrden || "-"}
                        </td>
                      )}

                      {/* 12. Número de Ticket */}
                      {columnasVisibles.ticket !== false && (
                        <td className="py-1 px-2 font-mono font-bold text-slate-900 border-b border-slate-950">
                          {order.ticket || "-"}
                        </td>
                      )}

                      {/* 13. Técnico */}
                      {columnasVisibles.tecnico !== false && (
                        <td className="py-1 px-2 font-bold text-slate-900 text-center border-b border-slate-950">
                          {order.tecnico || "-"}
                        </td>
                      )}

                      {/* 14. Acta */}
                      {columnasVisibles.acta !== false && (
                        <td className="py-1 px-2 font-mono text-center border-b border-slate-950">
                          {order.acta || "-"}
                        </td>
                      )}

                      {/* 15. Tareas */}
                      {columnasVisibles.tareas !== false && (
                        <td className="py-1 px-1.5 text-center font-mono text-[10px] border-b border-slate-950">
                          {order.totalTareas ? `${order.tareasFinalizadas || 0}/${order.totalTareas}` : "-"}
                        </td>
                      )}

                      {/* 16. Asignación */}
                      {columnasVisibles.asignacion !== false && (
                        <td className="py-1 px-2 font-mono text-center border-b border-slate-950">
                          {order.horaAsignacion || "-"}
                        </td>
                      )}

                      {/* 17. Camino */}
                      {columnasVisibles.camino !== false && (
                        <td className="py-1 px-2 font-mono text-center border-b border-slate-950">
                          {order.horaEnCamino || "-"}
                        </td>
                      )}

                      {/* 18. Inicio */}
                      {columnasVisibles.inicio !== false && (
                        <td className="py-1 px-2 font-mono text-center border-b border-slate-950">
                          {order.horaInicio || "-"}
                        </td>
                      )}

                      {/* 19. Fin */}
                      {columnasVisibles.fin !== false && (
                        <td className="py-1 px-2 font-mono text-center border-b border-slate-950">
                          {order.horaFin || "-"}
                        </td>
                      )}

                      {/* 20. Tramo */}
                      {columnasVisibles.tramo !== false && (
                        <td className="py-1 px-2 font-bold text-center border-b border-slate-950">
                          {order.tramo || "-"}
                        </td>
                      )}

                      {/* 21. Status (Badge) */}
                      {columnasVisibles.status !== false && (
                        <td className="py-1 px-2 text-center border-b border-slate-950">
                          <span className={`inline-block px-2 py-0.2 rounded text-[9px] uppercase tracking-wider font-bold ${badgeColorClass}`}>
                            {stNorm === "FINALIZADA EXTERNA" ? "FINALIZADA EXTERNA" : (order.status || order.estado || stNorm)}
                          </span>
                        </td>
                      )}

                      {/* 22. Cuadrilla */}
                      {columnasVisibles.cuadrilla !== false && (
                        <td className="py-1 px-2 font-mono font-bold text-slate-900 border-b border-slate-950">
                          {order.cuadrilla || "-"}
                        </td>
                      )}

                      {/* 23. Tipo de Trabajo Asignado */}
                      {columnasVisibles.tipoTrabajoAsignado !== false && (
                        <td className="py-1 px-2 text-slate-900 border-b border-slate-950">
                          {order.tipoTrabajoAsignado || "-"}
                        </td>
                      )}

                      {/* 24. Tipo de Liquidación */}
                      {columnasVisibles.tipoLiquidacion !== false && (
                        <td className="py-1 px-2 text-slate-900 border-b border-slate-950 max-w-[200px] truncate" title={order.tipoLiquidacion || order.motivoLiquidacion || order.motivoFinalizacion || "-"}>
                          {order.tipoLiquidacion || order.motivoLiquidacion || order.motivoFinalizacion || "-"}
                        </td>
                      )}

                      {/* 25. Tipo de Trabajo */}
                      {columnasVisibles.tipoTrabajo !== false && (
                        <td className="py-1 px-2 font-bold text-slate-900 border-b border-slate-950">
                          {order.tipoTrabajo || "-"}
                        </td>
                      )}

                      {/* 26. Observaciones de la Atención */}
                      {columnasVisibles.observacionesAtencion !== false && (
                        <td className="py-1 px-2 text-slate-800 border-b border-slate-950 max-w-[240px] truncate" title={order.observacionesAtencion || "-"}>
                          {order.observacionesAtencion || "-"}
                        </td>
                      )}

                      {/* 27. Total Drop */}
                      {columnasVisibles.totalDrop !== false && (
                        <td className="py-1 px-2 font-mono text-center font-bold text-slate-900 border-b border-slate-950">
                          {order.totalDrop ? `${order.totalDrop}m` : "-"}
                        </td>
                      )}

                      {/* 28. Ancho de Banda */}
                      {columnasVisibles.anchoBanda !== false && (
                        <td className="py-1 px-2 font-mono text-center border-b border-slate-950">
                          {order.anchoBanda || "-"}
                        </td>
                      )}

                      {/* 29. Ver detalle modal */}
                      <td className="py-1 px-2 text-center border-b border-slate-950">
                        <button
                          type="button"
                          onClick={() => {
                            setOrdenSeleccionada(order);
                            setModalDetalleAbierto(true);
                          }}
                          className="p-1 bg-black/5 hover:bg-black/15 text-slate-800 rounded transition-colors cursor-pointer"
                          title="Ver ficha técnica"
                        >
                          <Eye size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación Inferior Compacta */}
        {totalPaginas > 1 && registrosPorPagina !== -1 && (
          <div className="px-3 py-1.5 border-t border-slate-200 flex items-center justify-between gap-2 bg-slate-50 text-[11px]">
            <span className="text-slate-600 font-medium">
              Pág. <strong className="text-slate-900">{paginaActual}</strong> / <strong className="text-slate-900">{totalPaginas}</strong> ({ordenesFiltradas.length} órdenes)
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPaginaActual(1)}
                disabled={paginaActual === 1}
                className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Primera
              </button>
              <button
                type="button"
                onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                disabled={paginaActual === 1}
                className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft size={13} />
              </button>

              <span className="px-2 py-0.5 bg-[#1e4b8a] text-white rounded text-[10.5px] font-black">
                {paginaActual}
              </span>

              <button
                type="button"
                onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaActual === totalPaginas}
                className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronRight size={13} />
              </button>
              <button
                type="button"
                onClick={() => setPaginaActual(totalPaginas)}
                disabled={paginaActual === totalPaginas}
                className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Última
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. MODAL DETALLE COMPLETO DE ORDEN
      ───────────────────────────────────────────────────────────── */}
      {modalDetalleAbierto && ordenSeleccionada && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#1e4b8a] text-white flex items-center justify-center font-bold">
                  <FileText size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Ficha Técnica: {ordenSeleccionada.ticket || ordenSeleccionada.ot || "S/N"}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Fecha: {ordenSeleccionada.fecha} | Tramo: {ordenSeleccionada.tramo || "—"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalDetalleAbierto(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-2 rounded-xl space-y-0.5">
                <span className="text-[10px] font-black uppercase text-slate-400">Cliente</span>
                <p className="font-bold text-slate-900">{ordenSeleccionada.cliente || "—"}</p>
                <p className="text-slate-500">Tel: {ordenSeleccionada.celular || "—"} | DNI: {ordenSeleccionada.dni || "—"}</p>
              </div>

              <div className="bg-slate-50 p-2 rounded-xl space-y-0.5">
                <span className="text-[10px] font-black uppercase text-slate-400">Estado</span>
                <p className="font-black text-blue-800 uppercase">
                  {ordenSeleccionada.status || ordenSeleccionada.estado || "PENDIENTE"}
                </p>
                <p className="text-slate-500">Cuadrilla: {ordenSeleccionada.cuadrilla || "—"}</p>
              </div>

              <div className="bg-slate-50 p-2 rounded-xl space-y-0.5">
                <span className="text-[10px] font-black uppercase text-slate-400">Técnico Asignado</span>
                <p className="font-bold text-slate-900">{ordenSeleccionada.tecnico || "—"}</p>
                <p className="text-slate-500">Acta: {ordenSeleccionada.acta || "—"}</p>
              </div>

              <div className="bg-slate-50 p-2 rounded-xl space-y-0.5">
                <span className="text-[10px] font-black uppercase text-slate-400">Tipo de Trabajo</span>
                <p className="font-bold text-slate-900">{ordenSeleccionada.tipoTrabajo || "—"}</p>
                <p className="text-slate-500">Drop: {ordenSeleccionada.totalDrop || 0}m | Ancho Banda: {ordenSeleccionada.anchoBanda || "—"}</p>
              </div>

              <div className="sm:col-span-2 bg-slate-50 p-2 rounded-xl space-y-0.5">
                <span className="text-[10px] font-black uppercase text-slate-400">Ubicación</span>
                <p className="font-bold text-slate-900">{ordenSeleccionada.direccion || "—"}</p>
                <p className="text-slate-500">
                  Distrito: {ordenSeleccionada.distrito || "—"} | CTO: {ordenSeleccionada.cto || "—"}
                </p>
              </div>

              {(ordenSeleccionada.motivoFinalizacion ||
                ordenSeleccionada.motivoCancelacion ||
                ordenSeleccionada.motivoRegestion ||
                ordenSeleccionada.tipoLiquidacion) && (
                <div className="sm:col-span-2 bg-amber-50 border border-amber-200 p-2 rounded-xl space-y-0.5">
                  <span className="text-[10px] font-black uppercase text-amber-900">
                    Tipo Liquidación / Motivo
                  </span>
                  <p className="font-bold text-amber-950">
                    {ordenSeleccionada.tipoLiquidacion ||
                      ordenSeleccionada.motivoFinalizacion ||
                      ordenSeleccionada.motivoCancelacion ||
                      ordenSeleccionada.motivoRegestion}
                  </p>
                </div>
              )}

              {ordenSeleccionada.observacionesAtencion && (
                <div className="sm:col-span-2 bg-slate-50 p-2 rounded-xl space-y-0.5">
                  <span className="text-[10px] font-black uppercase text-slate-400">Observaciones de Atención</span>
                  <p className="text-slate-700 whitespace-pre-line">
                    {ordenSeleccionada.observacionesAtencion}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => setModalDetalleAbierto(false)}
                className="px-3.5 py-1.5 bg-[#1e4b8a] hover:bg-[#163866] text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. MODAL / DIALOG SELECTOR DE COLUMNAS VISIBLES Y EXPORTABLES
      ───────────────────────────────────────────────────────────── */}
      {modalColumnasAbierto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-3.5 bg-[#1e4b8a] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Columns size={18} className="text-sky-300" />
                <div>
                  <h3 className="text-sm font-black">Personalizar Columnas Visibles y de Exportación</h3>
                  <p className="text-[11px] text-blue-200">
                    Marca las columnas que deseas visualizar en la tabla y descargar en Excel / CSV
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalColumnasAbierto(false)}
                className="p-1 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Presets Rápidos */}
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 flex-wrap justify-between text-xs">
              <span className="text-[11px] font-bold text-slate-600">
                Seleccionadas: <strong className="text-slate-900 font-mono">{cantColumnasActivas}</strong> de {TODAS_COLUMNAS.length}
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={seleccionarTodasColumnas}
                  className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 transition-colors cursor-pointer"
                >
                  ✅ Todas
                </button>
                <button
                  type="button"
                  onClick={seleccionarColumnasOperativas}
                  className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-sky-50 border border-sky-300 hover:bg-sky-100 text-sky-900 transition-colors cursor-pointer"
                >
                  ⭐ Operativas
                </button>
                <button
                  type="button"
                  onClick={seleccionarSoloCuadrillas}
                  className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-purple-50 border border-purple-300 hover:bg-purple-100 text-purple-900 transition-colors cursor-pointer"
                >
                  👥 Solo Cuadrillas
                </button>
                <button
                  type="button"
                  onClick={deseleccionarTodasColumnas}
                  className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 transition-colors cursor-pointer"
                >
                  🧹 Ninguna
                </button>
              </div>
            </div>

            {/* Lista de Columnas con Checkboxes en 2 Columnas */}
            <div className="p-4 overflow-y-auto max-h-[55vh] custom-scrollbar grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {TODAS_COLUMNAS.map((col) => {
                const activa = columnasVisibles[col.id] !== false;
                return (
                  <label
                    key={col.id}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer select-none ${
                      activa
                        ? "bg-sky-50/70 border-sky-300 shadow-2xs text-slate-900 font-bold"
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={activa}
                        onChange={() => toggleColumna(col.id)}
                        className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                      <span className="truncate">{col.label}</span>
                    </div>
                    <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-600 font-mono">
                      {col.category}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 italic">
                * Los cambios se aplican inmediatamente en la tabla y en las exportaciones.
              </span>
              <button
                type="button"
                onClick={() => setModalColumnasAbierto(false)}
                className="px-4 py-1.5 bg-[#1e4b8a] hover:bg-[#163866] text-white rounded-xl text-xs font-black shadow-2xs transition-all cursor-pointer"
              >
                Listo / Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
