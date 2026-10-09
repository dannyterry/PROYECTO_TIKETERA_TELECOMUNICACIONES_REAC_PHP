import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  FileText,
  X,
  QrCode,
  Wifi,
  MapPin,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Package,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Check,
  PlusCircle,
  Clock,
  Car,
  Camera,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Maximize2,
  Search,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { Order } from "../types/Order";
import { getPlantillaPorTrabajo } from "../utils/actaTemplates";
import {
  getTecnicoStock,
  liquidarActaOrden,
  getActaLiquidacion,
  getMotivos,
  getFotoActaLiquidacion,
} from "../../inventory/services/inventoryService";
import { MotivoItem } from "../../inventory/types/inventoryTypes";
import { CameraBarcodeScannerModal } from "../../../components/CameraBarcodeScannerModal";
import { authService } from "../../../services/authService";

interface MaterialRow {
  id_producto: number;
  nombre: string;
  cantidad: number;
  unidad: string;
  stockDisponible?: number;
}

interface Props {
  order: Order;
  idTrabajadorActual?: number;
  readOnly?: boolean;
  canEditTipoTrabajo?: boolean; // Permite editar el tipo de liquidación
  isTechnicianView?: boolean; // Si es la vista móvil del técnico en campo
  showActaPhoto?: boolean; // Controla si se muestra el panel derecho con la foto del acta
  onClose: () => void;
  onSuccess?: () => void;
}

export const TechnicalActModal: React.FC<Props> = ({
  order,
  idTrabajadorActual,
  readOnly = false,
  canEditTipoTrabajo = true, // Habilitado para que el técnico siempre pueda escoger el tipo de liquidación
  isTechnicianView = false,
  showActaPhoto,
  onClose,
  onSuccess,
}) => {
  const shouldShowPhoto = showActaPhoto !== undefined ? showActaPhoto : !isTechnicianView;
  const isAlreadyLiquidated = readOnly || String(order.status || order.estado || "").toUpperCase().includes("LIQUID");
  const [guardando, setGuardando] = useState(false);
  const [cargandoActaGuardada, setCargandoActaGuardada] = useState(false);
  const [actaGuardadaNoExiste, setActaGuardadaNoExiste] = useState(false);

  // 1. Cabecera & Guía/Acta Física (001- fijo, solo se digita sufijo numérico)
  const [guiaCorrelativo, setGuiaCorrelativo] = useState("");
  const [showGuiaSuggestions, setShowGuiaSuggestions] = useState(false);
  const [numeroGuiaGuardada, setNumeroGuiaGuardada] = useState("");
  
  // Tipo de Liquidación (reemplaza Tipo de Trabajo)
  const initialTipoLiq = (
    order.tipoLiquidacion ||
    order.motivoLiquidacion ||
    order.motivoFinalizacion ||
    order.tipoTrabajo ||
    "CAMBIO DE CABLE PATCH CORD"
  ).trim();

  const [tipoLiquidacion, setTipoLiquidacion] = useState(initialTipoLiq);
  const [motivosList, setMotivosList] = useState<MotivoItem[]>([]);
  const [mostrarEquiposManual, setMostrarEquiposManual] = useState<boolean | null>(null);

  useEffect(() => {
    const t = (
      order.tipoLiquidacion ||
      order.motivoLiquidacion ||
      order.motivoFinalizacion ||
      order.tipoTrabajo ||
      ""
    ).trim();
    if (t) {
      setTipoLiquidacion(t);
      setMostrarEquiposManual(null);
    }
  }, [order]);

  // Reglas de negocio / Alarmas emergentes
  const [alertaActaVisible, setAlertaActaVisible] = useState(false);
  const [alertaLimiteMsg, setAlertaLimiteMsg] = useState<string | null>(null);
  const actaInputRef = useRef<HTMLInputElement>(null);

  // Campos adicionales de red y conexión
  const [cto, setCto] = useState(order.cto || "");
  const [puerto, setPuerto] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");

  // 2. Metraje Drop
  const [dropMetroInicio, setDropMetroInicio] = useState<string>("");
  const [dropMetroFin, setDropMetroFin] = useState<string>("");
  const totalDropCalculado = useMemo(() => {
    const ini = Number(dropMetroInicio);
    const fin = Number(dropMetroFin);
    const iniVal = !isNaN(ini) && ini > 0 ? ini : 0;
    const finVal = !isNaN(fin) && fin > 0 ? fin : 0;
    if (iniVal > 0 && finVal > 0) {
      return Math.abs(iniVal - finVal);
    }
    return iniVal || finVal || 0;
  }, [dropMetroInicio, dropMetroFin]);

  // Activación manual de sección Drop de Fibra Óptica (cuando el técnico lo selecciona desde "+ Agregar Material")
  const [mostrarSeccionDropManual, setMostrarSeccionDropManual] = useState(false);

  // 3. Stock disponible del técnico
  const [stockTecnicoMateriales, setStockTecnicoMateriales] = useState<any[]>([]);
  const [seriesAsignadasTecnico, setSeriesAsignadasTecnico] = useState<any[]>([]);

  // 4. Selector para añadir materiales desde Stock (+)
  const [mostrarSelectorStock, setMostrarSelectorStock] = useState(false);
  const [selectedStockProductoId, setSelectedStockProductoId] = useState<number | "">("");
  const [selectedStockCantidad, setSelectedStockCantidad] = useState<number>(1);

  // 5. Materiales dinámicos
  const [materiales, setMateriales] = useState<MaterialRow[]>([]);

  // 6. Equipos Instalados vs Retirados
  const [snOntInstalado, setSnOntInstalado] = useState("");
  const [snOntRetirado, setSnOntRetirado] = useState("");
  const [motivoOntRetiro, setMotivoOntRetiro] = useState("");
  const [snMeshInstalado, setSnMeshInstalado] = useState("");
  const [snMeshRetirado, setSnMeshRetirado] = useState("");

  // 7. Test de Velocidad & Observaciones
  const [speedDownload, setSpeedDownload] = useState("");
  const [speedUpload, setSpeedUpload] = useState("");
  const [tipoConexion, setTipoConexion] = useState<"Inalámbrica" | "Alámbrica">("Inalámbrica");
  const [observaciones, setObservaciones] = useState("");
  const [latGpsGuardada, setLatGpsGuardada] = useState<number | null>(null);
  const [lngGpsGuardada, setLngGpsGuardada] = useState<number | null>(null);
  const [tecnicoNombreGuardado, setTecnicoNombreGuardado] = useState<string>("");

  // 8. Escáner de Código de Barras / QR con Cámara Móvil
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<"acta" | "ont_instalado" | "ont_retirado" | "mesh_instalado" | "mesh_retirado">("ont_instalado");
  const [scannerTitle, setScannerTitle] = useState("Escanear Código");
  const [scannerSubtitle, setScannerSubtitle] = useState("Apunta al código de barras del equipo");

  const abrirEscaner = (
    target: "acta" | "ont_instalado" | "ont_retirado" | "mesh_instalado" | "mesh_retirado",
    titulo: string,
    subtitulo: string
  ) => {
    setScannerTarget(target);
    setScannerTitle(titulo);
    setScannerSubtitle(subtitulo);
    setScannerOpen(true);
  };

  // 📱 Si el escáner de cámara está abierto, el botón atrás del celular solo cierra la cámara
  useEffect(() => {
    if (!scannerOpen) return;
    window.history.pushState({ modal: "scanner" }, "");
    const onPopScanner = () => {
      setScannerOpen(false);
    };
    window.addEventListener("popstate", onPopScanner);
    return () => window.removeEventListener("popstate", onPopScanner);
  }, [scannerOpen]);

  const handleScanResult = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (scannerTarget === "ont_instalado") {
      setSnOntInstalado(clean);
    } else if (scannerTarget === "ont_retirado") {
      setSnOntRetirado(clean);
    } else if (scannerTarget === "mesh_instalado") {
      setSnMeshInstalado(clean);
    } else if (scannerTarget === "mesh_retirado") {
      setSnMeshRetirado(clean);
    } else if (scannerTarget === "acta") {
      const numOnly = clean.replace(/^001-?/i, "");
      setGuiaCorrelativo(numOnly);
      setAlertaActaVisible(false);
    }
  };

  // Cargar catálogo de motivos con limites_materiales desde API
  useEffect(() => {
    getMotivos()
      .then((data) => {
        if (Array.isArray(data)) {
          setMotivosList(data);
        }
      })
      .catch((err) => console.error("Error al cargar motivos:", err));
  }, []);

  // 9. Visor Interactivo de Fotografía HD del Acta (Original WIN)
  const [fotoActaUrl, setFotoActaUrl] = useState<string | null>(null);
  const [fotoActaLoading, setFotoActaLoading] = useState(false);
  const [fotoActaError, setFotoActaError] = useState<string | null>(null);
  const [fotoActaDataId, setFotoActaDataId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [panPos, setPanPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lupaActiva, setLupaActiva] = useState(false);
  const [lupaPos, setLupaPos] = useState({ x: 0, y: 0, relX: 50, relY: 50 });
  const [fotoFullscreen, setFotoFullscreen] = useState(false);

  const imgWrapperRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const numeroOrdenStr = useMemo(() => {
    // 1. Prioridad: Número de OT único de Fénix (ej: 3485524)
    const otCandidate = String(order.ot || order.numeroOrden || (order as any).numero || "").trim();
    if (otCandidate && /^\d+$/.test(otCandidate)) {
      return otCandidate.replace(/^0+/, "");
    }
    // 2. ID único de la orden en la BD (ej: 11954)
    if (order.id && typeof order.id === "number") {
      return String(order.id);
    }
    // 3. Fallback a ticket o código de seguimiento
    return String(order.ot || order.numeroOrden || (order as any).numero || order.ticket || (order as any).codigo_seguimiento || order.id || "").trim().replace(/^0+/, "");
  }, [order]);

  const cargarFotoActa = () => {
    if (!numeroOrdenStr) return;
    setFotoActaLoading(true);
    setFotoActaError(null);
    setFotoActaUrl(null);
    setFotoActaDataId(null);
    setZoomLevel(1);
    setRotation(0);
    setPanPos({ x: 0, y: 0 });
    setLupaActiva(false);

    getFotoActaLiquidacion(numeroOrdenStr)
      .then((res) => {
        if (res && res.success && res.foto_url) {
          setFotoActaUrl(res.foto_url);
          setFotoActaDataId(res.dataId || null);
          setFotoActaError(null);
        } else {
          setFotoActaError(res?.error || "Fotografía del Acta no disponible en Fénix.");
        }
      })
      .catch((err: any) => {
        console.warn("Error cargando foto del acta:", err);
        setFotoActaError(err.response?.data?.error || "No se pudo conectar con Fénix para obtener el Acta.");
      })
      .finally(() => {
        setFotoActaLoading(false);
      });
  };

  useEffect(() => {
    if (shouldShowPhoto) {
      cargarFotoActa();
    }
  }, [numeroOrdenStr, shouldShowPhoto]);

  // Controles del visor interactivo de imagen
  const handleZoomIn = () => setZoomLevel((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100));
  const handleZoomOut = () => {
    setZoomLevel((z) => {
      const next = Math.max(0.5, Math.round((z - 0.25) * 100) / 100);
      if (next <= 1) setPanPos({ x: 0, y: 0 });
      return next;
    });
  };
  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanPos({ x: 0, y: 0 });
    setRotation(0);
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleWheel = (e: React.WheelEvent) => {
    if (lupaActiva) return;
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (lupaActiva) return;
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - panPos.x,
        y: e.clientY - panPos.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (lupaActiva && imgWrapperRef.current) {
      const rect = imgWrapperRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const relX = Math.max(0, Math.min(100, (x / rect.width) * 100));
      const relY = Math.max(0, Math.min(100, (y / rect.height) * 100));
      setLupaPos({ x, y, relX, relY });
    } else if (isDragging) {
      setPanPos({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleDownloadFoto = () => {
    if (!fotoActaUrl) return;
    const a = document.createElement("a");
    a.href = fotoActaUrl;
    a.download = `Acta_Orden_${numeroOrdenStr || "WIN"}_${guiaCorrelativo || "HD"}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Extraer series de guías/actas disponibles en el stock del técnico
  const guiasDisponibles: string[] = useMemo(() => {
    return seriesAsignadasTecnico
      .filter((s: any) => {
        const cat = (s.categoria || "").toUpperCase();
        const nom = (s.equipo_nombre || "").toUpperCase();
        const num = (s.numero_serie || "").trim();
        return (
          cat.includes("ACTA") ||
          cat.includes("GUIA") ||
          cat.includes("TALONARIO") ||
          cat.includes("DOCUMENT") ||
          nom.includes("ACTA") ||
          nom.includes("GUIA") ||
          nom.includes("TALONARIO") ||
          /^\d{4,8}$/.test(num.replace(/^001-?/i, ""))
        );
      })
      .map((s: any) => (s.numero_serie || "").trim().replace(/^001-?/i, ""))
      .filter(Boolean);
  }, [seriesAsignadasTecnico]);

  // 🌟 Filtrar estrictamente solo Materiales e Insumos Consumibles para la liquidación de la orden
  // (Excluyendo herramientas, uniformes, vehículos, equipos serializados y ACTAS/GUIAS que se ingresan únicamente en cabecera)
  // 🌟 REGLA DE NEGOCIO DE LIQUIDACIONES:
  // En Liquidaciones SOLO participan 2 categorías principales:
  // 1. MATERIALES (Insumos consumibles, Cable Drop en bobina continua y Drop Pre-Conectorizado unitario)
  // 2. EQUIPOS (Dispositivos serializados: ONTs, Routers Mesh, TV Box, Teléfonos)
  //
  // Jerarquía de búsqueda / filtro (Categoría primero, luego Producto):
  //   Paso 1: Validar primero la CATEGORÍA (MATERIALES vs EQUIPOS vs HERRAMIENTAS / OTROS)
  //   Paso 2: Validar el PRODUCTO específico dentro de esa categoría

  // Helper para identificar rollos de Drop Pre-Conectorizado unitario (50M, 100M, 150M, 200M)
  const esDropConectorizado = (m: any) => {
    const nom = String(m?.nombre || "").toUpperCase().trim();
    return (
      nom.includes("CONECTORIZADO") ||
      /drop.*(50|100|150|200)/i.test(nom) ||
      /drop\s*(50m|100m|150m|200m|50mt|100mt|150mt|200mt)/i.test(nom)
    );
  };

  // Helper para identificar Cable Drop en bobina continua (medido en metros)
  const esBobinaDrop = (m: any) => {
    const nom = String(m?.nombre || "").toUpperCase().trim();
    return (
      !esDropConectorizado(m) &&
      (m?.es_drop === 1 || Number(m?.id_producto) === 55 || nom === "DROP" || nom === "CABLE DROP" || nom === "FIBRA DROP")
    );
  };

  // Filtro estricto de Materiales Consumibles para la lista de liquidación
  const soloMaterialesLiquidables = useMemo(() => {
    return stockTecnicoMateriales.filter((m) => {
      const cat = String(m.categoria || "").toUpperCase().trim();
      const catLiq = String(m.categoria_liquidar || "").toUpperCase().trim();
      const nom = String(m.nombre || "").toUpperCase().trim();

      // 🌟 Excepción prioritaria: Si es Drop Conectorizado o Bobina Drop, se PERMITE siempre en el selector
      if (esDropConectorizado(m) || esBobinaDrop(m)) {
        return true;
      }

      // ─── PASO 1: VALIDACIÓN POR CATEGORÍA ───
      // Debe ser estrictamente categoría MATERIAL / MATERIALES
      const esCategoriaMaterial =
        cat === "MATERIALES" ||
        cat === "MATERIAL" ||
        catLiq === "MATERIAL" ||
        Number(m.id_categoria) === 1;

      // Si pertenece a HERRAMIENTAS, VEHÍCULOS, UNIFORMES, EPPS o EQUIPOS, se descarta de inmediato
      const esCategoriaExcluida =
        cat.includes("HERRAMIEN") ||
        catLiq === "HERRAMIENTA" ||
        cat.includes("VEHIC") ||
        catLiq === "VEHICULO" ||
        cat.includes("UNIFORM") ||
        catLiq === "UNIFORME" ||
        cat.includes("EPP") ||
        cat === "EQUIPOS" ||
        catLiq === "EQUIPO" ||
        m.maneja_serie === 1;

      if (!esCategoriaMaterial || esCategoriaExcluida) {
        return false;
      }

      // ─── PASO 2: VALIDACIÓN POR PRODUCTO ───
      // Excluir actas y guías físicas (se ingresan únicamente en la cabecera N° 001-XXXX)
      if (nom.includes("ACTA") || nom.includes("GUIA") || nom.includes("TALONARIO") || cat.includes("DOCUMENT")) {
        return false;
      }

      return true;
    });
  }, [stockTecnicoMateriales]);

  // 🌟 Extraer el Stock de Bobina Continua de Drop del técnico (en metros)
  const dropStockItem = useMemo(() => {
    return stockTecnicoMateriales.find((m) => {
      const nom = String(m.nombre || "").toUpperCase().trim();
      const cat = String(m.categoria || "").toUpperCase().trim();
      const catLiq = String(m.categoria_liquidar || "").toUpperCase().trim();

      // Descartar herramientas y descartar conectorizados (los conectorizados se miden en unidades)
      if (
        nom.includes("PORTA") ||
        nom.includes("PELAD") ||
        cat.includes("HERRAMIEN") ||
        catLiq === "HERRAMIENTA" ||
        esDropConectorizado(m)
      ) {
        return false;
      }

      // Paso 1: Validar Categoría
      const esCategoriaMaterial =
        cat === "MATERIALES" ||
        cat === "MATERIAL" ||
        catLiq === "MATERIAL" ||
        Number(m.id_categoria) === 1 ||
        m.es_drop === 1;

      if (!esCategoriaMaterial) return false;

      // Paso 2: Validar Producto específico
      return (
        m.es_drop === 1 ||
        Number(m.id_producto) === 55 ||
        nom === "DROP" ||
        nom === "CABLE DROP" ||
        nom === "FIBRA DROP"
      );
    });
  }, [stockTecnicoMateriales]);

  const stockDropDisponible = Number(dropStockItem?.stock ?? 0);

  // Verificar si el técnico ha seleccionado un Drop Conectorizado en sus materiales
  const dropConectorizadoSeleccionado = useMemo(() => {
    return materiales.find(
      (m) => esDropConectorizado(m) && Number(m.cantidad) > 0
    );
  }, [materiales]);

  // Rollos Drop Conectorizados disponibles en el stock del técnico
  const rollosConectorizadosDisponibles = useMemo(() => {
    return stockTecnicoMateriales.filter(
      (m) => esDropConectorizado(m) && Number(m.stock) > 0
    );
  }, [stockTecnicoMateriales]);

  // Sugerencias de autocompletado según lo que el técnico va digitando
  const sugerenciasGuias: string[] = useMemo(() => {
    if (!guiaCorrelativo.trim()) {
      return guiasDisponibles.slice(0, 6);
    }
    const val = guiaCorrelativo.trim();
    return guiasDisponibles.filter((g: string) => g.includes(val) || g.endsWith(val)).slice(0, 8);
  }, [guiasDisponibles, guiaCorrelativo]);

  // Motivo seleccionado según tipo de liquidación
  const motivoSeleccionado = useMemo(() => {
    const clean = tipoLiquidacion.toUpperCase().trim();
    return (
      motivosList.find((m) => m.nombre.toUpperCase().trim() === clean) ||
      motivosList.find(
        (m) =>
          clean.includes(m.nombre.toUpperCase().trim()) ||
          m.nombre.toUpperCase().trim().includes(clean)
      ) ||
      null
    );
  }, [motivosList, tipoLiquidacion]);

  // Parsear los límites de materiales del motivo seleccionado
  const limitesDelMotivo = useMemo(() => {
    if (!motivoSeleccionado || !motivoSeleccionado.limites_materiales) return [];
    try {
      const raw = motivoSeleccionado.limites_materiales;
      if (typeof raw === "string") {
        return JSON.parse(raw);
      }
      if (Array.isArray(raw)) return raw;
      return [];
    } catch (e) {
      console.error("Error parseando limites_materiales:", e);
      return [];
    }
  }, [motivoSeleccionado]);

  // Función para obtener el límite numérico de unidades permitidas EXCLUSIVAMENTE para CONECTORES
  const obtenerLimiteParaMaterial = (idProducto: number, nombreMat: string): number | null => {
    const esConector =
      Number(idProducto) === 27 ||
      nombreMat.toUpperCase().includes("CONECTOR") ||
      nombreMat.toUpperCase().includes("FAST");

    // Si NO es conector, no se restringe (se comporta normal)
    if (!esConector) {
      return null;
    }

    // 1. Si el técnico seleccionó un Drop Pre-Conectorizado (el cual ya viene con conector en cabeza/CTO):
    // Solo requiere 1 conector mecánico manual en la Roseta.
    if (dropConectorizadoSeleccionado) {
      return 1;
    }

    // 2. Revisar si el motivo en BD tiene configurado limites_materiales
    if (limitesDelMotivo && limitesDelMotivo.length > 0) {
      const matchConector = limitesDelMotivo.find((l: any) => {
        const id = Number(l.id_producto);
        const nom = String(l.nombre || "").toUpperCase();
        return id === 27 || nom.includes("CONECTOR") || nom.includes("FAST");
      });
      if (matchConector && (matchConector.cantidad !== undefined || matchConector.max !== undefined || matchConector.limite !== undefined)) {
        return Number(matchConector.cantidad ?? matchConector.max ?? matchConector.limite);
      }
      // Si el motivo tiene límites explícitos configurados y el conector NO figura en ellos, el límite es 0
      return 0;
    }

    // 3. Revisar por plantilla de tipo de liquidación o palabras clave
    const tipoNorm = tipoLiquidacion.toUpperCase();
    if (tipoNorm.includes("CTO") || tipoNorm.includes("NAP") || tipoNorm.includes("ROSETA") || tipoNorm.includes("REUBICACION CON RESERVA")) {
      return 1;
    }
    if (tipoNorm.includes("RECABLEADO") || tipoNorm.includes("NORMALIZAC") || tipoNorm.includes("INSTALAC") || tipoNorm.includes("TRASLADO") || tipoNorm.includes("REUBICACION SIN RESERVA")) {
      return 2;
    }

    // 4. Si la plantilla por defecto NO usa conectores ni requiere drop (ej: Patch Cord, ONT, Mesh, Acomodo, Pruebas, etc.), el límite es 0
    const plantillaTieneConector = (plantillaActual.materialesDefault || []).some((m) =>
      m.nombre.toUpperCase().includes("CONECTOR") || m.nombre.toUpperCase().includes("FAST")
    );
    if (!plantillaTieneConector && !plantillaActual.requiereDrop) {
      return 0;
    }

    return null;
  };

  // Si está en modo solo lectura (Admin) o ya fue liquidada, cargar el acta real guardada
  useEffect(() => {
    if (isAlreadyLiquidated) {
      setCargandoActaGuardada(true);
      getActaLiquidacion(order.id)
        .then((res) => {
          const a = res.acta;
          if (a) {
            setNumeroGuiaGuardada(a.numero_acta || a.numero_guia || "001-XXXXXX");
            const sufijo = (a.numero_acta || a.numero_guia || "").replace(/^001-?/i, "");
            setGuiaCorrelativo(sufijo);
            setTipoLiquidacion(a.tipo_trabajo_acta || order.tipoLiquidacion || order.tipoTrabajo || "RECABLEADO");
            setCto(a.cto || "");
            setPuerto(a.puerto || "");
            setDropMetroInicio(a.drop_metro_inicio ? String(a.drop_metro_inicio) : "");
            setDropMetroFin(a.drop_metro_fin ? String(a.drop_metro_fin) : "");
            setSpeedDownload(a.speedtest_download ? String(a.speedtest_download) : "");
            setSpeedUpload(a.speedtest_upload ? String(a.speedtest_upload) : "");
            setTipoConexion(a.tipo_conexion || "Inalámbrica");
            setObservaciones(a.observaciones_tecnico || "");
            setLatGpsGuardada(a.lat_liquidacion ? Number(a.lat_liquidacion) : null);
            setLngGpsGuardada(a.lng_liquidacion ? Number(a.lng_liquidacion) : null);
            setTecnicoNombreGuardado(a.tecnico_nombre || "");

            if (res.materiales && res.materiales.length > 0) {
              const soloConsumiblesGuardados = res.materiales.filter((m: any) => {
                const nom = String(m.nombre || "").toUpperCase().trim();
                return m.es_drop !== 1 && Number(m.id_producto) !== 55 && nom !== "DROP" && !nom.includes("CABLE DROP") && !nom.includes("FIBRA DROP");
              });
              setMateriales(
                soloConsumiblesGuardados.map((m: any) => ({
                  id_producto: m.id_producto,
                  nombre: m.nombre,
                  cantidad: m.cantidad,
                  unidad: "UND",
                }))
              );
            }

            if (res.equiposRetirados && res.equiposRetirados.length > 0) {
              const primerRet = res.equiposRetirados[0];
              setSnOntRetirado(primerRet.numero_serie || "");
              setMotivoOntRetiro(primerRet.motivo_retiro || "");
            }
          }
        })
        .catch((err) => {
          console.log("No hay acta guardada aún:", err.message);
          setActaGuardadaNoExiste(true);
        })
        .finally(() => setCargandoActaGuardada(false));
    }
  }, [isAlreadyLiquidated, order.id]);

  const orderTecnicoId =
    idTrabajadorActual ||
    order.idTecnico ||
    (order as any)?.id_trabajador ||
    (order as any)?.id_tecnico_asignado;

  // Plantilla activa y detección del tipo de equipo serializado
  const plantillaActual = useMemo(() => {
    return getPlantillaPorTrabajo(tipoLiquidacion);
  }, [tipoLiquidacion]);

  const isFono = useMemo(() => {
    const t = tipoLiquidacion.toUpperCase();
    return t.includes("FONO") || t.includes("PHONO") || t.includes("TELEFONO") || t.includes("DESCARTE");
  }, [tipoLiquidacion]);

  const isMesh = useMemo(() => {
    return tipoLiquidacion.toUpperCase().includes("MESH");
  }, [tipoLiquidacion]);

  const isTvBox = useMemo(() => {
    const t = tipoLiquidacion.toUpperCase();
    return t.includes("TV BOX") || t.includes("WINBOX");
  }, [tipoLiquidacion]);

  const eqTipoNombre = isFono ? "FonoWin / Teléfono" : isMesh ? "Router Mesh" : isTvBox ? "TV Box" : "ONT";

  // Control dinámico de visibilidad para equipos serializados
  const seccionEquiposVisible = useMemo(() => {
    if (mostrarEquiposManual !== null) return mostrarEquiposManual;
    return Boolean(
      plantillaActual.requiereEquipoInstalado ||
      plantillaActual.requiereEquipoRetirado ||
      snOntInstalado ||
      snOntRetirado ||
      snMeshInstalado ||
      snMeshRetirado
    );
  }, [mostrarEquiposManual, plantillaActual, snOntInstalado, snOntRetirado, snMeshInstalado, snMeshRetirado]);

  // Series disponibles de equipos (excluyendo actas/talonarios y priorizando por tipo de equipo)
  const seriesEquiposDisponibles = useMemo(() => {
    const noActas = seriesAsignadasTecnico.filter((s: any) => {
      const nom = String(s.equipo_nombre || s.categoria || "").toUpperCase();
      const num = String(s.numero_serie || "").trim();
      return !nom.includes("ACTA") && !nom.includes("GUIA") && !nom.includes("TALONARIO") && !/^\d{4,8}$/.test(num.replace(/^001-?/i, ""));
    });

    if (isFono) {
      const filtrados = noActas.filter((s: any) => {
        const nom = String(s.equipo_nombre || s.categoria || "").toUpperCase();
        const num = String(s.numero_serie || "").trim();
        return nom.includes("FONO") || nom.includes("PHONO") || nom.includes("TELEFONO") || num.startsWith("2FWS") || nom.includes("TLA");
      });
      return filtrados.length > 0 ? filtrados : noActas;
    }
    if (isMesh) {
      const filtrados = noActas.filter((s: any) => {
        const nom = String(s.equipo_nombre || s.categoria || "").toUpperCase();
        return nom.includes("MESH");
      });
      return filtrados.length > 0 ? filtrados : noActas;
    }
    if (isTvBox) {
      const filtrados = noActas.filter((s: any) => {
        const nom = String(s.equipo_nombre || s.categoria || "").toUpperCase();
        return nom.includes("TV") || nom.includes("BOX") || nom.includes("WINBOX");
      });
      return filtrados.length > 0 ? filtrados : noActas;
    }
    return noActas;
  }, [seriesAsignadasTecnico, isFono, isMesh, isTvBox]);

  // Cargar stock del técnico
  useEffect(() => {
    if (orderTecnicoId) {
      getTecnicoStock(orderTecnicoId)
        .then((res) => {
          const mats = [...(res.materiales || []), ...(res.cablesDrop || [])];
          setStockTecnicoMateriales(mats);
          setSeriesAsignadasTecnico(res.seriesAsignadas || []);
        })
        .catch((err) => console.error("Error al cargar stock:", err));
    }
  }, [orderTecnicoId]);

  // Aplicar sugerencias de materiales cuando cambia el Tipo de Liquidación
  useEffect(() => {
    if (isAlreadyLiquidated) return;
    const plant = plantillaActual;
    const nuevasFilas: MaterialRow[] = plant.materialesDefault
      .filter((def) => !def.nombre.toUpperCase().includes("ACTA") && !def.nombre.toUpperCase().includes("GUIA"))
      .map((def, idx) => {
        // Buscar si el producto existe en el catálogo o stock del técnico con concordancia inteligente
        const match = stockTecnicoMateriales.find((m) => {
          const mName = String(m.nombre || "").toUpperCase();
          const dName = String(def.nombre || "").toUpperCase();
          if (mName.includes("ACTA") || mName.includes("GUIA")) return false;
          if (mName.includes(dName) || dName.includes(mName)) return true;
          if (dName.includes("CONECTOR") && mName.includes("CONECTOR")) return true;
          if (dName.includes("PATCH") && mName.includes("PATCH")) return true;
          if (dName.includes("ROSETA") && mName.includes("ROSETA")) return true;
          if (dName.includes("DROP") && mName.includes("DROP")) return true;
          if (dName.includes("CINTA") && mName.includes("CINTA")) return true;
          if (dName.includes("ALCOHOL") && mName.includes("ALCOHOL")) return true;
          return false;
        });

        const prodId = match ? match.id_producto : (idx + 1);
        const prodNombre = match ? match.nombre : def.nombre;
        const stockDisp = match ? Number(match.stock || 0) : 0;
        const lim = obtenerLimiteParaMaterial(prodId, prodNombre);
        let cant = def.cantidadDefault;
        if (lim !== null && cant > lim) {
          cant = lim;
        }
        return {
          id_producto: prodId,
          nombre: prodNombre,
          cantidad: cant,
          unidad: def.unidad,
          stockDisponible: stockDisp,
        };
      })
      .filter((row) => !row.nombre.toUpperCase().includes("ACTA") && !row.nombre.toUpperCase().includes("GUIA"));

    setMateriales(nuevasFilas);
  }, [tipoLiquidacion, stockTecnicoMateriales, limitesDelMotivo, readOnly]);

  // Handler para agregar material desde el stock del técnico (+)
  const handleAgregarMaterialDeStock = () => {
    if (!selectedStockProductoId) return;
    const prod = stockTecnicoMateriales.find((p) => p.id_producto === Number(selectedStockProductoId));
    if (!prod || prod.nombre.toUpperCase().includes("ACTA") || prod.nombre.toUpperCase().includes("GUIA")) return;

    // 🌟 Si el usuario seleccionó "DROP (Bobina Continua)":
    if (esBobinaDrop(prod)) {
      setMostrarSeccionDropManual(true);
      setSelectedStockProductoId("");
      setSelectedStockCantidad(1);
      setMostrarSelectorStock(false);
      setAlertaLimiteMsg("ℹ️ Se activó la sección de Metraje de Bobina de Cable Drop arriba. Ingresa Metro Inicio y Fin.");
      setTimeout(() => setAlertaLimiteMsg(null), 5000);
      return;
    }

    // 🌟 Si el usuario seleccionó un "DROP CONECTORIZADO":
    if (esDropConectorizado(prod)) {
      setMostrarSeccionDropManual(true);
      setMateriales((prev) => {
        const sinOtros = prev.filter((m) => !esDropConectorizado(m));
        // Ajustar conectores mecánicos existentes a máx 1 (porque el conectorizado ya tiene 1 de fábrica en la cabeza)
        const conAjuste = sinOtros.map((m) => {
          const esConect = Number(m.id_producto) === 27 || m.nombre.toUpperCase().includes("CONECTOR") || m.nombre.toUpperCase().includes("FAST");
          if (esConect && m.cantidad > 1) {
            return { ...m, cantidad: 1 };
          }
          return m;
        });
        return [
          ...conAjuste,
          {
            id_producto: prod.id_producto,
            nombre: prod.nombre,
            cantidad: 1,
            unidad: "UND",
            stockDisponible: prod.stock,
          },
        ];
      });
      setDropMetroInicio("");
      setDropMetroFin("");
      setSelectedStockProductoId("");
      setSelectedStockCantidad(1);
      setMostrarSelectorStock(false);
      setAlertaLimiteMsg(`✅ Agregado rollo pre-conectorizado: "${prod.nombre}". Límite de conectores mecánicos ajustado a 1 (Roseta).`);
      setTimeout(() => setAlertaLimiteMsg(null), 5000);
      return;
    }

    const cant = Math.max(1, Number(selectedStockCantidad) || 1);
    const lim = obtenerLimiteParaMaterial(prod.id_producto, prod.nombre);

    if (lim !== null) {
      if (lim === 0) {
        setAlertaLimiteMsg(
          `⛔ El tipo de liquidación "${tipoLiquidacion}" no requiere ni permite conectores ópticos (límite: 0).`
        );
        setTimeout(() => setAlertaLimiteMsg(null), 6000);
        return;
      }
      if (cant > lim) {
        setAlertaLimiteMsg(
          `⚠️ El tipo de liquidación "${tipoLiquidacion}" solo permite hasta ${lim} conector(es).`
        );
        setTimeout(() => setAlertaLimiteMsg(null), 5000);
        return;
      }
    }

    const esConector = Number(prod.id_producto) === 27 || prod.nombre.toUpperCase().includes("CONECTOR") || prod.nombre.toUpperCase().includes("FAST");
    if (esConector && lim !== null) {
      const conectoresActuales = materiales
        .filter((m) => Number(m.id_producto) === 27 || m.nombre.toUpperCase().includes("CONECTOR") || m.nombre.toUpperCase().includes("FAST"))
        .reduce((sum, m) => sum + Number(m.cantidad || 0), 0);
      if (conectoresActuales + cant > lim) {
        setAlertaLimiteMsg(
          `⚠️ Límite de conectores alcanzado: "${tipoLiquidacion}" solo permite un máximo de ${lim} conector(es). Ya tienes ${conectoresActuales} asignado(s).`
        );
        setTimeout(() => setAlertaLimiteMsg(null), 6000);
        return;
      }
    }

    setMateriales((prev) => {
      const existeIndex = prev.findIndex((m) => m.id_producto === prod.id_producto);
      if (existeIndex >= 0) {
        const nuevaCant = prev[existeIndex].cantidad + cant;
        if (lim !== null && nuevaCant > lim) {
          setAlertaLimiteMsg(
            `⚠️ Superarías el límite máximo de ${lim} unidades de ${prod.nombre} para "${tipoLiquidacion}".`
          );
          setTimeout(() => setAlertaLimiteMsg(null), 5000);
          return prev.map((m, i) => (i === existeIndex ? { ...m, cantidad: lim } : m));
        }
        return prev.map((m, i) => (i === existeIndex ? { ...m, cantidad: nuevaCant } : m));
      }
      return [
        ...prev,
        {
          id_producto: prod.id_producto,
          nombre: prod.nombre,
          cantidad: cant,
          unidad: prod.es_drop ? "MTR" : "UND",
          stockDisponible: prod.stock,
        },
      ];
    });

    setSelectedStockProductoId("");
    setSelectedStockCantidad(1);
    setMostrarSelectorStock(false);
  };

  // Handler para modificar la cantidad en el cuadrito validando límites
  const handleCambiarCantidadMaterial = (idx: number, valorStr: string) => {
    const rawVal = parseInt(valorStr, 10);
    const mat = materiales[idx];
    if (!mat) return;

    if (isNaN(rawVal) || rawVal < 0) {
      setMateriales((prev) => prev.map((item, i) => (i === idx ? { ...item, cantidad: 0 } : item)));
      return;
    }

    const lim = obtenerLimiteParaMaterial(mat.id_producto, mat.nombre);
    if (lim !== null && rawVal > lim) {
      setAlertaLimiteMsg(
        `⚠️ Límite alcanzado: El tipo de liquidación "${tipoLiquidacion}" solo permite un máximo de ${lim} unidades de ${mat.nombre}.`
      );
      setTimeout(() => setAlertaLimiteMsg(null), 5000);
      setMateriales((prev) => prev.map((item, i) => (i === idx ? { ...item, cantidad: lim } : item)));
      return;
    }

    setMateriales((prev) => prev.map((item, i) => (i === idx ? { ...item, cantidad: rawVal } : item)));
  };

  const handleEliminarMaterial = (idx: number) => {
    setMateriales((prev) => prev.filter((_, i) => i !== idx));
  };

  // Función para capturar coordenadas GPS reales
  const getGps = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 3500 }
      );
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ─────────────────────────────────────────────────────────────
    // REGLA DE NEGOCIO 1: NÚMERO DE ACTA ES OBLIGATORIO Y DEBE ESTAR ASIGNADO AL TÉCNICO
    // ─────────────────────────────────────────────────────────────
    const cleanSufijo = guiaCorrelativo.trim();
    if (!cleanSufijo) {
      setAlertaActaVisible(true);
      if (actaInputRef.current) {
        actaInputRef.current.focus();
      }
      return;
    }

    if (guiasDisponibles.length === 0) {
      alert(
        `❌ SIN ACTAS DISPONIBLES EN STOCK:\n\n` +
        `El técnico asignado a esta orden no tiene actas de servicio físicas asignadas en su stock móvil (0 disponibles).\n\n` +
        `Debes solicitar a Almacén la entrega y asignación de un talonario de actas antes de poder liquidar órdenes.`
      );
      return;
    }

    const sufijoNormalizado = cleanSufijo.replace(/^001-?/i, "").trim();
    const actaValida = guiasDisponibles.some((g) => {
      const gNorm = g.replace(/^001-?/i, "").trim();
      return gNorm === sufijoNormalizado || g === cleanSufijo;
    });

    if (!actaValida) {
      alert(
        `❌ ACTA NO ASIGNADA AL TÉCNICO:\n\n` +
        `El Acta física N° 001-${cleanSufijo} no se encuentra en el talonario/dotación asignada a este técnico en Almacén.\n\n` +
        `👉 Actas disponibles en stock (${guiasDisponibles.length}):\n` +
        `${guiasDisponibles.slice(0, 6).map((g) => `001-${g}`).join(", ")}${guiasDisponibles.length > 6 ? "..." : ""}\n\n` +
        `Por favor haz clic en la casilla para seleccionar una de las actas asignadas o solicita un nuevo talonario a Almacén.`
      );
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // REGLA DE NEGOCIO 2: VALIDACIÓN DE LÍMITES DE MATERIALES Y CONECTORES
    // ─────────────────────────────────────────────────────────────
    for (const mat of materiales) {
      if (mat.cantidad > 0) {
        const lim = obtenerLimiteParaMaterial(mat.id_producto, mat.nombre);
        if (lim !== null && mat.cantidad > lim) {
          alert(
            lim === 0
              ? `❌ MATERIAL NO PERMITIDO:\n\nEl tipo de liquidación "${tipoLiquidacion}" no requiere ni permite "${mat.nombre}" (límite: 0).\n\nPor favor elimina este material antes de liquidar.`
              : `❌ LÍMITE DE MATERIAL EXCEDIDO:\n\nHas ingresado ${mat.cantidad} unidades de "${mat.nombre}", pero el tipo de liquidación "${tipoLiquidacion}" solo permite un máximo de ${lim} conector(es).\n\nPor favor ajusta la cantidad antes de liquidar.`
          );
          return;
        }
      }
    }

    const totalConectoresEnActa = materiales
      .filter((m) => Number(m.id_producto) === 27 || m.nombre.toUpperCase().includes("CONECTOR") || m.nombre.toUpperCase().includes("FAST"))
      .reduce((sum, m) => sum + Number(m.cantidad || 0), 0);
    const limConectorGlobal = obtenerLimiteParaMaterial(27, "CONECTOR SC/APC FAST");
    if (limConectorGlobal !== null && totalConectoresEnActa > limConectorGlobal) {
      alert(
        limConectorGlobal === 0
          ? `❌ CONECTORES NO PERMITIDOS:\n\nEl tipo de liquidación "${tipoLiquidacion}" no lleva conectores ópticos (límite: 0). Tienes ${totalConectoresEnActa} conector(es) ingresado(s).\n\nPor favor quítalos antes de liquidar.`
          : `❌ LÍMITE TOTAL DE CONECTORES EXCEDIDO:\n\nHas ingresado un total de ${totalConectoresEnActa} conector(es), pero para "${tipoLiquidacion}" el límite permitido es de ${limConectorGlobal} conector(es).\n\nPor favor ajusta los materiales antes de liquidar.`
      );
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // REGLA DE NEGOCIO 3: VALIDACIÓN DE STOCK REAL EN CAMIONETA
    // ─────────────────────────────────────────────────────────────
    for (const mat of materiales) {
      if (mat.cantidad > 0) {
        const stockReal = Number(mat.stockDisponible ?? 0);
        if (mat.cantidad > stockReal) {
          alert(
            `❌ STOCK INSUFICIENTE EN TU VEHÍCULO:\n\n` +
            `Estás intentando liquidar ${mat.cantidad} unidad(es) de "${mat.nombre}", pero actualmente solo tienes ${stockReal} disponible(s) en tu camioneta.\n\n` +
            `No puedes liquidar esta orden hasta que Almacén te despache el material necesario.`
          );
          return;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────
    // REGLA DE NEGOCIO 3.1: VALIDACIÓN DE STOCK DE CABLE DROP (BOBINA O CONECTORIZADO)
    // ─────────────────────────────────────────────────────────────
    if (plantillaActual.requiereDrop && totalDropCalculado <= 0 && !dropConectorizadoSeleccionado) {
      alert(
        `❌ FALTA REGISTRAR CABLE DROP:\n\n` +
        `El tipo de liquidación "${tipoLiquidacion}" requiere Cable Drop.\n\n` +
        `👉 Opción 1: Ingresa "Metro Inicio" y "Metro Fin" en las casillas de carrete.\n` +
        `👉 Opción 2: O selecciona un rollo "Drop Pre-Conectorizado (50m, 100m, 150m, 200m)".`
      );
      return;
    }

    if (totalDropCalculado > 0) {
      if (stockDropDisponible <= 0) {
        alert(
          `❌ SIN STOCK EN BOBINA CONTINUA:\n\n` +
          `No tienes bobina de Cable Drop en metros en tu camioneta (0 m disponibles).\n\n` +
          `💡 Si utilizaste un rollo "Drop Conectorizado (50m, 100m, 150m, 200m)", por favor borra las casillas de carrete y agrégalo desde "+ Agregar Material de mi Stock".`
        );
        return;
      }
      if (totalDropCalculado > stockDropDisponible) {
        alert(
          `❌ STOCK DE BOBINA INSUFICIENTE:\n\n` +
          `Has ingresado un consumo de ${totalDropCalculado} metros de bobina continua, pero actualmente solo tienes ${stockDropDisponible} metros disponibles en tu camioneta.\n\n` +
          `Ajusta el rango de metraje o solicita bobina a Almacén.`
        );
        return;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // REGLA DE NEGOCIO 3.2: VALIDACIÓN ESTRICTA DE EQUIPOS INSTALADOS (ONT / MESH / FONOWIN / TV BOX)
    // ─────────────────────────────────────────────────────────────
    if (snOntInstalado) {
      const cleanEq = snOntInstalado.trim().toUpperCase();
      const serieValida = seriesAsignadasTecnico.some((s: any) => {
        const num = String(s.numero_serie || "").trim().toUpperCase();
        return num === cleanEq;
      });

      if (!serieValida) {
        alert(
          `❌ SERIE DE ${eqTipoNombre.toUpperCase()} NO ASIGNADA AL TÉCNICO:\n\n` +
          `La serie "${cleanEq}" no se encuentra en la dotación de equipos asignados a este técnico en Almacén.\n\n` +
          `Por favor verifica la serie correcta del equipo o solicita su despacho/asignación a Almacén.`
        );
        return;
      }
    }

    if (snMeshInstalado) {
      const cleanMesh = snMeshInstalado.trim().toUpperCase();
      const serieValida = seriesAsignadasTecnico.some((s: any) => {
        const num = String(s.numero_serie || "").trim().toUpperCase();
        return num === cleanMesh;
      });

      if (!serieValida) {
        alert(
          `❌ SERIE DE MESH NO ASIGNADA AL TÉCNICO:\n\n` +
          `La serie Router Mesh "${cleanMesh}" no se encuentra en la dotación de equipos asignados a este técnico.\n\n` +
          `Por favor verifica la serie correcta o solicita su despacho a Almacén.`
        );
        return;
      }
    }

    try {
      setGuardando(true);
      const gps = await getGps();
      if (!gps) {
        const confirmar = window.confirm(
          "⚠️ ATENCIÓN: Tu GPS está apagado o sin permisos.\n\nPara registrar la posición exacta de liquidación, es recomendable encender el GPS.\n\n¿Deseas continuar de todas formas?"
        );
        if (!confirmar) {
          setGuardando(false);
          return;
        }
      }

      const tipoEquipoDetectado = isFono ? "FONOWIN" : isMesh ? "MESH" : isTvBox ? "TV_BOX" : "ONT";
      const equiposInstaladosPayload = [];
      if (snOntInstalado) equiposInstaladosPayload.push({ numero_serie: snOntInstalado, tipo_equipo: tipoEquipoDetectado });
      if (snMeshInstalado) equiposInstaladosPayload.push({ numero_serie: snMeshInstalado, tipo_equipo: "MESH" });

      const equiposRetiradosPayload = [];
      if (snOntRetirado) {
        equiposRetiradosPayload.push({
          tipo_equipo: tipoEquipoDetectado,
          numero_serie: snOntRetirado,
          motivo_retiro: motivoOntRetiro || "Cambio / Avería",
        });
      }
      if (snMeshRetirado) {
        equiposRetiradosPayload.push({
          tipo_equipo: "MESH",
          numero_serie: snMeshRetirado,
          motivo_retiro: "Cambio / Devolución",
        });
      }

      const finalTrabajadorId =
        idTrabajadorActual ||
        order.idTecnico ||
        (order as any)?.id_trabajador ||
        (order as any)?.id_tecnico_asignado;

      const numeroGuiaFinal = `001-${cleanSufijo}`;

      const currentUser = authService.getCurrentUser();
      const esGestionOAdmin = Boolean(
        currentUser?.id_rol === 1 ||
        currentUser?.rol?.toUpperCase().includes("GEST") ||
        currentUser?.rol?.toUpperCase().includes("ADMIN") ||
        currentUser?.rol?.toUpperCase().includes("SUPER")
      );
      const liquidadoPorNombre = currentUser
        ? `${currentUser.nombres || ''} ${currentUser.apellidos || ''} (${currentUser.rol || 'Usuario'})`.trim()
        : "Técnico";

      await liquidarActaOrden(order.id, {
        id_trabajador: finalTrabajadorId ? Number(finalTrabajadorId) : undefined,
        numero_guia: numeroGuiaFinal,
        numero_acta: numeroGuiaFinal,
        tipo_trabajo_acta: tipoLiquidacion,
        cto,
        puerto,
        speedtest_download: Number(speedDownload) || 0,
        speedtest_upload: Number(speedUpload) || 0,
        tipo_conexion: tipoConexion,
        drop_metro_inicio: Number(dropMetroInicio) || undefined,
        drop_metro_fin: Number(dropMetroFin) || undefined,
        drop_total_metros: totalDropCalculado,
        lat_liquidacion: gps?.lat,
        lng_liquidacion: gps?.lng,
        observaciones_tecnico: observaciones,
        materiales_utilizados: materiales.map((m) => ({ id_producto: m.id_producto, cantidad: m.cantidad })),
        equipos_instalados: equiposInstaladosPayload,
        equipos_retirados: equiposRetiradosPayload,
        liquidado_por: liquidadoPorNombre,
        es_gestion: esGestionOAdmin,
      });

      alert(`✅ ¡Acta ${numeroGuiaFinal} guardada exitosamente! Orden liquidada como "${tipoLiquidacion}".`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      alert("Error al liquidar acta: " + (err.response?.data?.error || err.message));
    } finally {
      setGuardando(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
      <div className={`bg-white rounded-3xl w-full ${shouldShowPhoto ? "max-w-[1440px]" : "max-w-3xl"} shadow-2xl border border-slate-200 max-h-[96vh] overflow-hidden flex flex-col relative`}>
        
        {/* ─────────────────────────────────────────────────────────────
            HEADER ACTA WIN OFICIAL
        ───────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3.5 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-md shadow-amber-500/25 shrink-0">
              <FileText size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded-lg bg-orange-100 text-orange-800 border border-orange-200">
                  ACTA DE SERVICIO TÉCNICO
                </span>
                {(order.ot || order.numeroOrden || (order as any).numero) && (
                  <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                    OT #{order.ot || order.numeroOrden || (order as any).numero}
                  </span>
                )}
                {order.ticket && order.ticket !== (order.ot || order.numeroOrden || (order as any).numero) && (
                  <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                    {order.ticket}
                  </span>
                )}
                {isAlreadyLiquidated ? (
                  <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-amber-400 font-mono font-black text-xs border border-slate-700 shadow-2xs flex items-center gap-1.5">
                    <span>N° {numeroGuiaGuardada || (guiaCorrelativo ? `001-${guiaCorrelativo}` : "001-XXXXXX")}</span>
                    <span className="text-[10px] text-amber-300/80 font-sans font-bold">🔒 Registrada</span>
                  </span>
                ) : (
                  <div className="relative">
                    <div
                      className={`flex items-center bg-white border rounded-lg px-2 py-0.5 shadow-2xs transition-all ${
                        !guiaCorrelativo.trim() && alertaActaVisible
                          ? "border-rose-500 ring-2 ring-rose-300 animate-pulse"
                          : "border-indigo-300 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100"
                      }`}
                    >
                      <span className="text-[11px] font-black text-indigo-700 font-mono select-none bg-indigo-50 px-1.5 py-0.2 rounded mr-1">
                        N° 001-
                      </span>
                      <input
                        ref={actaInputRef}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        required
                        placeholder="04235"
                        value={guiaCorrelativo}
                        onChange={(e) => {
                          const onlyNums = e.target.value.replace(/\D/g, "");
                          setGuiaCorrelativo(onlyNums);
                          if (onlyNums) setAlertaActaVisible(false);
                          setShowGuiaSuggestions(true);
                        }}
                        onFocus={() => setShowGuiaSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowGuiaSuggestions(false), 250)}
                        className="w-24 text-xs font-black text-slate-900 font-mono focus:outline-none bg-transparent placeholder:text-slate-300"
                      />
                    </div>

                    {/* Menú de Autocompletado de Guías en Stock */}
                    {showGuiaSuggestions && sugerenciasGuias.length > 0 && (
                      <div className="absolute top-full left-0 mt-1.5 z-50 bg-white border border-indigo-200 rounded-xl shadow-xl p-2 w-52 space-y-1 animate-fade-in">
                        <div className="text-[9px] font-bold text-slate-500 uppercase px-1 flex items-center justify-between border-b border-slate-100 pb-1">
                          <span>Guías en tu stock:</span>
                          <span className="text-indigo-600 font-mono font-black">{guiasDisponibles.length} disp.</span>
                        </div>
                        <div className="max-h-36 overflow-y-auto space-y-0.5">
                          {sugerenciasGuias.map((sug) => (
                            <button
                              key={sug}
                              type="button"
                              onMouseDown={() => {
                                setGuiaCorrelativo(sug);
                                setAlertaActaVisible(false);
                                setShowGuiaSuggestions(false);
                              }}
                              className="w-full text-left px-2 py-1 rounded-lg text-xs font-mono font-bold hover:bg-indigo-50 text-indigo-950 flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <span>001-{sug}</span>
                              <span className="text-[9px] text-emerald-600 font-sans font-bold">✓ Usar</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 mt-0.5">
                {isAlreadyLiquidated
                  ? `Auditoría de Liquidación (Llenado por: ${tecnicoNombreGuardado || "Técnico en Campo"})`
                  : `Liquidación de Orden de Campo`}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {shouldShowPhoto && fotoActaUrl && (
              <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-400/40 font-mono font-bold text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Acta Original HD {fotoActaDataId ? `(#${fotoActaDataId})` : ""}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all cursor-pointer"
              title="Cerrar ventana"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            CONTENIDO PRINCIPAL: GRID SPLIT DE 2 COLUMNAS (7 Cols Formulario | 5 Cols Foto HD)
        ───────────────────────────────────────────────────────────── */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1">
          {/* Banner de alerta si aplica */}
          {alertaLimiteMsg && (
            <div className="mb-4 p-3 bg-amber-500 text-white rounded-2xl font-bold text-xs shadow-lg flex items-center justify-between gap-2 animate-bounce">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="shrink-0 text-white" />
                <span>{alertaLimiteMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setAlertaLimiteMsg(null)}
                className="text-white hover:opacity-80 cursor-pointer font-black px-2"
              >
                ✕
              </button>
            </div>
          )}

          {cargandoActaGuardada ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw size={28} className="animate-spin text-amber-500 mx-auto" />
              <p className="text-xs font-bold text-slate-600">Consultando Acta WIN guardada en base de datos...</p>
            </div>
          ) : actaGuardadaNoExiste && isAlreadyLiquidated ? (
            <div className="py-12 px-6 bg-amber-50 rounded-3xl border border-amber-200 text-center space-y-3">
              <AlertCircle size={36} className="text-amber-600 mx-auto" />
              <h3 className="text-sm font-black text-amber-900">Acta Pendiente de Llenado</h3>
              <p className="text-xs text-amber-800 max-w-md mx-auto">
                El técnico de campo aún no ha llenado el formulario de liquidación para esta orden desde su celular.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-amber-600 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
              >
                Entendido / Cerrar
              </button>
            </div>
          ) : (
            <div className={shouldShowPhoto ? "grid grid-cols-1 lg:grid-cols-12 gap-5 items-start" : "space-y-4"}>
              
              {/* ══════════════════════════════════════════════════════════
                  FORMULARIO TÉCNICO (7 Cols en split desktop, full-width en móvil/técnico)
              ══════════════════════════════════════════════════════════ */}
              <div className={shouldShowPhoto ? "lg:col-span-7 space-y-4" : "space-y-4"}>
                <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold text-slate-700">

                  {/* ─────────────────────────────────────────────────────────────
                      0. TIPO DE LIQUIDACIÓN AUTOMÁTICO DE LA ORDEN
                  ───────────────────────────────────────────────────────────── */}
                  <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
                        Tipo de Liquidación (Asignado a la Orden)
                      </span>
                      <p className="text-xs sm:text-sm font-black text-slate-900 mt-0.5 truncate" title={tipoLiquidacion}>
                        {tipoLiquidacion || "RECABLEADO"}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 bg-amber-500 text-white font-bold text-[10px] rounded-xl shadow-2xs shrink-0">
                      Automático WIN
                    </span>
                  </div>

            {/* ─────────────────────────────────────────────────────────────
                3. CÁLCULO DE CABLE DROP (BOBINA CONTINUA O CONECTORIZADO)
            ───────────────────────────────────────────────────────────── */}
            {(mostrarSeccionDropManual || plantillaActual.requiereDrop || Number(dropMetroInicio) > 0 || Number(dropMetroFin) > 0 || Boolean(dropConectorizadoSeleccionado) || (/fibra|drop|recableado|alta|traslado|instalac/i.test(tipoLiquidacion) && !/conector|roseta|patch|ont|mesh|winbox|fono|visita/i.test(tipoLiquidacion))) && (
              <div className={`p-4 rounded-2xl space-y-3 border transition-all ${
                dropConectorizadoSeleccionado
                  ? "bg-emerald-50/60 border-emerald-200"
                  : stockDropDisponible <= 0
                  ? "bg-slate-50 border-slate-200"
                  : "bg-amber-50/50 border-amber-200"
              }`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className={`font-black text-xs flex items-center gap-1.5 ${
                    dropConectorizadoSeleccionado ? "text-emerald-900" : "text-amber-900"
                  }`}>
                    <Package size={16} />
                    Metraje de Cable Drop (Fibra Óptica)
                  </span>
                  
                  <div className="flex items-center gap-2">
                    {/* Badge según tipo de Drop utilizado */}
                    {dropConectorizadoSeleccionado ? (
                      <span className="text-xs font-bold px-2.5 py-1 bg-emerald-600 text-white rounded-xl font-mono shadow-2xs flex items-center gap-1">
                        <span>✓ Conectorizado: {dropConectorizadoSeleccionado.nombre} ({dropConectorizadoSeleccionado.cantidad} UND)</span>
                      </span>
                    ) : stockDropDisponible > 0 ? (
                      <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl font-mono shadow-2xs flex items-center gap-1">
                        <span>✓ En camioneta (Bobina):</span>
                        <span className="font-black">{stockDropDisponible} m</span>
                      </span>
                    ) : (
                      <span className="text-xs font-bold px-2.5 py-1 bg-slate-200 text-slate-700 rounded-xl shadow-2xs flex items-center gap-1">
                        <span>ℹ️ Bobina: 0 m</span>
                      </span>
                    )}

                    {totalDropCalculado > 0 && !dropConectorizadoSeleccionado && (
                      <span className={`text-xs font-black px-3 py-1 rounded-xl font-mono shadow-xs ${
                        totalDropCalculado > stockDropDisponible && stockDropDisponible > 0
                          ? "bg-rose-600 text-white"
                          : "bg-amber-500 text-white"
                      }`}>
                        Total Consumido: {totalDropCalculado} metros
                      </span>
                    )}

                    {/* Botón para ocultar sección de Drop si se abrió manualmente y no es obligatoria */}
                    {mostrarSeccionDropManual && !plantillaActual.requiereDrop && !isAlreadyLiquidated && (
                      <button
                        type="button"
                        onClick={() => {
                          setMostrarSeccionDropManual(false);
                          setDropMetroInicio("");
                          setDropMetroFin("");
                          setMateriales((prev) => prev.filter((m) => !esDropConectorizado(m)));
                        }}
                        className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-md text-[10px] font-bold cursor-pointer transition-all"
                        title="Ocultar sección de Drop"
                      >
                        ✕ Ocultar
                      </button>
                    )}
                  </div>
                </div>

                {/* Selector rápido de Rollo Drop Conectorizado */}
                {!isAlreadyLiquidated && rollosConectorizadosDisponibles.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-300/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-2xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-emerald-600" />
                      ¿Utilizaste Rollo Pre-Conectorizado?
                    </span>
                    <select
                      value={dropConectorizadoSeleccionado?.id_producto || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!val) {
                          setMateriales((prev) => prev.filter((m) => !esDropConectorizado(m)));
                        } else {
                          const prod = rollosConectorizadosDisponibles.find((p) => p.id_producto === val);
                          if (prod) {
                            setMateriales((prev) => {
                              const sinOtros = prev.filter((m) => !esDropConectorizado(m));
                              return [
                                ...sinOtros,
                                {
                                  id_producto: prod.id_producto,
                                  nombre: prod.nombre,
                                  cantidad: 1,
                                  unidad: "UND",
                                  stockDisponible: prod.stock,
                                },
                              ];
                            });
                            setDropMetroInicio("");
                            setDropMetroFin("");
                          }
                        }
                      }}
                      className="p-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="">-- No (Usar Bobina Continua en Metros) --</option>
                      {rollosConectorizadosDisponibles.map((r) => (
                        <option key={r.id_producto} value={r.id_producto}>
                          {r.nombre} ({r.stock} UND en camioneta)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Banner: Si está usando Drop Conectorizado */}
                {dropConectorizadoSeleccionado && (
                  <div className="p-2.5 bg-emerald-100/90 border border-emerald-300 rounded-xl flex items-center justify-between gap-2 text-emerald-900 text-xs font-bold shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="text-base">✅</span>
                      <span>Liquidando con rollo Pre-Conectorizado: &quot;{dropConectorizadoSeleccionado.nombre}&quot; ({dropConectorizadoSeleccionado.cantidad} UND descontada de stock).</span>
                    </div>
                    {!isAlreadyLiquidated && (
                      <button
                        type="button"
                        onClick={() => setMateriales((prev) => prev.filter((m) => !esDropConectorizado(m)))}
                        className="px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-md text-[10px] font-bold cursor-pointer transition-all"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                )}

                {/* Banner informativo si no tiene bobina continua */}
                {stockDropDisponible <= 0 && !dropConectorizadoSeleccionado && !isAlreadyLiquidated && (
                  <div className="p-2.5 bg-amber-100/90 border border-amber-300 rounded-xl flex items-center gap-2 text-amber-900 text-xs font-semibold shadow-2xs">
                    <span className="text-base">ℹ️</span>
                    <span>No tienes bobina continua en metros (0 m). Si tu instalación usa un rollo <strong>Drop Conectorizado (50m, 100m, 150m, 200m)</strong>, selecciónalo en el menú desplegable arriba.</span>
                  </div>
                )}

                {/* Banner si el metraje calculado excede la bobina */}
                {totalDropCalculado > stockDropDisponible && stockDropDisponible > 0 && !isAlreadyLiquidated && (
                  <div className="p-2.5 bg-rose-100/90 border border-rose-300 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-bold shadow-2xs">
                    <span className="text-base">❌</span>
                    <span>Consumo ingresado ({totalDropCalculado} m) excede tu stock de bobina en camioneta ({stockDropDisponible} m).</span>
                  </div>
                )}

                {!dropConectorizadoSeleccionado && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-center">
                    <div>
                      <label className="block mb-1 text-slate-600 font-bold text-xs">Metro Inicio (Carrete)</label>
                      <input
                        type="number"
                        disabled={isAlreadyLiquidated}
                        value={dropMetroInicio}
                        onChange={(e) => setDropMetroInicio(e.target.value)}
                        placeholder={stockDropDisponible <= 0 ? "Opcional" : "Ej: 500"}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-xs disabled:bg-slate-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-200"
                      />
                    </div>

                    <div>
                      <label className="block mb-1 text-slate-600 font-bold text-xs">Metro Fin (Carrete)</label>
                      <input
                        type="number"
                        disabled={isAlreadyLiquidated}
                        value={dropMetroFin}
                        onChange={(e) => setDropMetroFin(e.target.value)}
                        placeholder={stockDropDisponible <= 0 ? "Opcional" : "Ej: 435"}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-xs disabled:bg-slate-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-200"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-1 bg-white p-2.5 rounded-xl border border-amber-200 text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Descuento de Bobina</span>
                      <span className={`text-sm font-black font-mono ${
                        totalDropCalculado > stockDropDisponible && stockDropDisponible > 0
                          ? "text-rose-600"
                          : "text-amber-800"
                      }`}>
                        -{totalDropCalculado} mtrs
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                4. MATERIALES E INSUMOS A LIQUIDAR (CON BOTÓN + DE STOCK)
            ───────────────────────────────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                    <Layers size={16} className="text-indigo-600" />
                    Materiales e Insumos a Liquidar:
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    Sugeridos según tipo de liquidación y descontados de tu stock
                  </span>
                </div>

                {!isAlreadyLiquidated && (
                  <button
                    type="button"
                    onClick={() => setMostrarSelectorStock(!mostrarSelectorStock)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Plus size={15} className="text-indigo-600" />
                    <span>Agregar Material de mi Stock</span>
                  </button>
                )}
              </div>

              {/* Selector emergente para escoger material del Stock del técnico (+) */}
              {mostrarSelectorStock && !isAlreadyLiquidated && (
                <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl space-y-2.5 animate-fade-in shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                      <Package size={15} className="text-indigo-600" />
                      Seleccionar Material desde tu Camioneta / Stock:
                    </span>
                    <button
                      type="button"
                      onClick={() => setMostrarSelectorStock(false)}
                      className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                    >
                      ✕ Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-slate-600 font-bold block mb-1">Material en Stock</label>
                      <select
                        value={selectedStockProductoId}
                        onChange={(e) => setSelectedStockProductoId(Number(e.target.value) || "")}
                        className="w-full p-2 bg-white border border-indigo-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
                      >
                        <option value="">-- Elige un material de tu stock --</option>
                        {soloMaterialesLiquidables.map((m) => {
                          const esBobina = esBobinaDrop(m);
                          const esConect = esDropConectorizado(m);
                          const esConector = Number(m.id_producto) === 27 || m.nombre.toUpperCase().includes("CONECTOR") || m.nombre.toUpperCase().includes("FAST");
                          const lim = esConector ? obtenerLimiteParaMaterial(m.id_producto, m.nombre) : null;
                          const noPermitido = esConector && lim === 0;

                          return (
                            <option key={m.id_producto} value={m.id_producto} disabled={noPermitido}>
                              {esBobina
                                ? `CABLE DROP (Bobina continua) (Stock: ${m.stock} m)`
                                : esConect
                                ? `${m.nombre} (Stock: ${m.stock} und)`
                                : noPermitido
                                ? `${m.nombre} 🚫 (No permitido para ${tipoLiquidacion})`
                                : `${m.nombre} (Stock: ${m.stock} ${m.es_drop ? "m" : "und"})${lim !== null ? ` [Máx: ${lim}]` : ""}`}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-600 font-bold block mb-1">Cantidad a Usar</label>
                      <input
                        type="number"
                        min="1"
                        value={selectedStockCantidad}
                        onChange={(e) => setSelectedStockCantidad(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        placeholder="1"
                        className="w-full p-2 bg-white border border-indigo-300 rounded-xl text-center font-mono font-black text-xs focus:outline-none"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAgregarMaterialDeStock}
                        disabled={!selectedStockProductoId}
                        className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                      >
                        <PlusCircle size={15} />
                        Añadir
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Lista de Filas de Materiales */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                {/* Banner de Advertencia si algún material no tiene suficiente stock */}
                {!isAlreadyLiquidated && materiales.some((m) => m.cantidad > (m.stockDisponible ?? 0)) && (
                  <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl flex items-center gap-2 text-rose-800 text-[11px] font-bold">
                    <AlertCircle size={16} className="text-rose-600 shrink-0" />
                    <span>
                      ⚠️ No tienes stock suficiente en tu vehículo para uno o más materiales. Solicita dotación en Almacén antes de liquidar.
                    </span>
                  </div>
                )}

                {materiales.length === 0 ? (
                  <div className="py-4 text-center text-slate-400 text-xs font-bold">
                    No hay materiales asignados. Toca "+ Agregar Material de mi Stock" para añadir.
                  </div>
                ) : (
                  materiales.map((mat, idx) => {
                    const limite = obtenerLimiteParaMaterial(mat.id_producto, mat.nombre);
                    const tieneLimite = limite !== null;
                    const stockDisp = Number(mat.stockDisponible ?? 0);
                    const sinStock = stockDisp <= 0;
                    const excedeStock = mat.cantidad > stockDisp;

                    if (isAlreadyLiquidated) {
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs text-slate-900 truncate">{mat.nombre}</span>
                              <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200 flex items-center gap-1">
                                ✓ Descontado / Liquidado
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-3 py-1 border border-slate-200 shrink-0">
                            <span className="font-mono font-black text-xs text-slate-800">{mat.cantidad}</span>
                            <span className="text-[10px] font-bold text-slate-500">{mat.unidad}</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between gap-2 bg-white p-2.5 rounded-xl border shadow-2xs transition-all ${
                          sinStock || excedeStock
                            ? "border-rose-400 bg-rose-50/40 ring-1 ring-rose-200"
                            : tieneLimite && mat.cantidad >= limite
                            ? "border-amber-300 bg-amber-50/30"
                            : "border-slate-200/80"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-slate-900 truncate">{mat.nombre}</span>
                            {tieneLimite && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                                Límite: Máx {limite} {mat.unidad}
                              </span>
                            )}
                            {sinStock ? (
                              <span className="text-[9.5px] font-black px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-300 flex items-center gap-1">
                                ⚠️ Sin stock en carro (0 disp.)
                              </span>
                            ) : excedeStock ? (
                              <span className="text-[9.5px] font-black px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-300">
                                ⚠️ Stock insuficiente ({stockDisp} disp.)
                              </span>
                            ) : (
                              <span className="text-[9.5px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                ✓ En carro: {stockDisp} {mat.unidad}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                            <input
                              type="number"
                              min="0"
                              max={limite !== null ? limite : undefined}
                              disabled={isAlreadyLiquidated}
                              value={mat.cantidad}
                              onChange={(e) => handleCambiarCantidadMaterial(idx, e.target.value)}
                              className="w-16 p-1.5 bg-white border border-slate-200 rounded-lg text-center font-mono font-black text-xs focus:ring-2 focus:ring-indigo-300 focus:outline-none disabled:bg-slate-100"
                              title={tieneLimite ? `Máximo permitido: ${limite}` : "Cantidad"}
                            />
                            <span className="text-[10px] font-bold text-slate-500 px-1">{mat.unidad}</span>
                          </div>

                          {!isAlreadyLiquidated && (
                            <button
                              type="button"
                              onClick={() => handleEliminarMaterial(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Quitar material"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                5. CONTROL DE EQUIPOS SERIALIZADOS (ONT / MESH / FONOWIN / TV BOX)
            ───────────────────────────────────────────────────────────── */}
            {seccionEquiposVisible ? (
              <div className="p-4 bg-gradient-to-r from-indigo-50/60 to-purple-50/60 border border-indigo-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-indigo-900 flex items-center gap-1.5">
                    <QrCode size={16} />
                    Equipos Serializados ({eqTipoNombre})
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800">
                      Control de Series & Recojo
                    </span>
                    {!isAlreadyLiquidated && (
                      <button
                        type="button"
                        onClick={() => {
                          setSnOntInstalado("");
                          setSnOntRetirado("");
                          setSnMeshInstalado("");
                          setSnMeshRetirado("");
                          setMostrarEquiposManual(false);
                        }}
                        className="text-[11px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-2 py-0.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1"
                        title="Omitir o quitar equipos de esta liquidación"
                      >
                        <X size={13} />
                        <span>Omitir / Quitar</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-indigo-100">
                  <div>
                    <label className="block mb-1 text-slate-600 font-bold flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1">
                        <ArrowUpRight size={14} className="text-emerald-600" />
                        S/N {eqTipoNombre} Instalado
                      </span>
                      {!isAlreadyLiquidated && (
                        <span className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
                          Cámara o Digitar
                        </span>
                      )}
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        list="ont-asignadas-list"
                        placeholder={`Digita o escanea serie de ${eqTipoNombre}...`}
                        disabled={isAlreadyLiquidated}
                        value={snOntInstalado}
                        onChange={(e) => setSnOntInstalado(e.target.value.toUpperCase())}
                        className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white font-bold disabled:bg-slate-100"
                      />
                      <datalist id="ont-asignadas-list">
                        {seriesEquiposDisponibles.map((s: any) => (
                          <option key={s.id_producto_serie || s.numero_serie} value={s.numero_serie}>
                            {s.equipo_nombre || "Equipo"} (S/N: {s.numero_serie})
                          </option>
                        ))}
                      </datalist>
                      {!isAlreadyLiquidated && (
                        <button
                          type="button"
                          onClick={() => abrirEscaner("ont_instalado", `Escanear ${eqTipoNombre} Instalado`, `Apunta al código de barras o serie del ${eqTipoNombre} nuevo`)}
                          className="px-2.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                          title="Escanear con la cámara del celular"
                        >
                          <Camera size={14} />
                          <span className="hidden sm:inline">Cámara</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block mb-1 text-slate-600 font-bold flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1">
                        <ArrowDownLeft size={14} className="text-rose-600" />
                        S/N {eqTipoNombre} Retirado (Recogido)
                      </span>
                      {!isAlreadyLiquidated && (
                        <span className="text-[10px] text-rose-700 font-medium bg-rose-50 px-1.5 py-0.5 rounded">
                          Cámara o Digitar
                        </span>
                      )}
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder={`Digita o escanea serie retirada de ${eqTipoNombre}...`}
                        disabled={isAlreadyLiquidated}
                        value={snOntRetirado}
                        onChange={(e) => setSnOntRetirado(e.target.value.toUpperCase())}
                        className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white font-bold text-rose-800 disabled:bg-slate-100"
                      />
                      {!isAlreadyLiquidated && (
                        <button
                          type="button"
                          onClick={() => abrirEscaner("ont_retirado", `Escanear ${eqTipoNombre} Retirado`, `Apunta al código de barras del equipo recogido al cliente`)}
                          className="px-2.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                          title="Escanear equipo recogido con la cámara del celular"
                        >
                          <Camera size={14} />
                          <span className="hidden sm:inline">Cámara</span>
                        </button>
                      )}
                    </div>
                    {motivoOntRetiro && (
                      <span className="text-[10px] text-slate-500 mt-1 block">Motivo: {motivoOntRetiro}</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              !isAlreadyLiquidated && (
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl hover:bg-indigo-50/50 hover:border-indigo-200 transition-colors">
                  <div className="flex items-center gap-2 text-slate-500 text-xs">
                    <QrCode size={15} className="text-slate-400" />
                    <span>¿Hubo cambio o instalación de equipo ({eqTipoNombre})?</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMostrarEquiposManual(true)}
                    className="px-2.5 py-1 bg-white hover:bg-indigo-600 hover:text-white text-indigo-600 border border-indigo-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                  >
                    <PlusCircle size={13} />
                    <span>+ Registrar Equipo</span>
                  </button>
                </div>
              )
            )}

            {/* Observaciones */}
            <div>
              <label className="block mb-1 text-slate-600 font-bold">Observaciones del Técnico</label>
              <textarea
                rows={2}
                disabled={isAlreadyLiquidated}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Observaciones de campo..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none disabled:bg-slate-100 font-medium text-xs"
              />
            </div>

            {/* ─────────────────────────────────────────────────────────────
                BOTONES DE ACCIÓN
            ───────────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              {isAlreadyLiquidated ? (
                <>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-5 py-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    🖨️ Imprimir Acta
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs transition-all cursor-pointer"
                  >
                    Cerrar Auditoría
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-2xl text-slate-600 hover:bg-slate-100 font-bold transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardando}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black rounded-2xl shadow-lg shadow-orange-500/25 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {guardando ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Liquidando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        Guardar Acta & Liquidar Orden
                      </>
                    )}
                  </button>
                </>
              )}
            </div>

          </form>
        </div>

        {/* ══════════════════════════════════════════════════════════
            COLUMNA DERECHA: VISOR HD INTERACTIVO DEL ACTA DE CONFORMIDAD (5 Cols)
            (SOLO ACTIVO EN VISTA DE ADMINISTRACIÓN / AUDITORÍA, NO EN CELULAR DEL TÉCNICO)
        ══════════════════════════════════════════════════════════ */}
        {shouldShowPhoto && (
          <div className="lg:col-span-5 flex flex-col space-y-2 bg-slate-900/5 rounded-3xl p-3 border border-slate-200/90 self-start lg:sticky lg:top-0">
            
            {/* Toolbar de Controles Interactivos Elevada al Máximo */}
            <div className="flex items-center justify-between gap-1 p-2 bg-slate-900 text-white rounded-2xl shadow-md text-xs">
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <ImageIcon size={13} />
                </div>
                <span className="font-extrabold text-[11px] text-slate-100 hidden sm:inline tracking-tight">
                  Acta de Conformidad
                </span>
                <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono font-bold text-[9px]">
                  HD
                </span>
              </div>

              <div className="flex items-center gap-0.5 sm:gap-1">
                {/* Zoom Controls */}
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={!fotoActaUrl}
                  title="Acercar (+25%)"
                  className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={!fotoActaUrl}
                  title="Alejar (-25%)"
                  className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                >
                  <ZoomOut size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  disabled={!fotoActaUrl}
                  title="Restablecer tamaño (100%)"
                  className="px-1.5 py-1 rounded-xl hover:bg-slate-800 text-[11px] font-mono font-bold text-indigo-300 transition-colors cursor-pointer disabled:opacity-40"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>

                <div className="h-3.5 w-px bg-slate-700/80 mx-0.5"></div>

                {/* Modo Lupa */}
                <button
                  type="button"
                  onClick={() => {
                    setLupaActiva(!lupaActiva);
                    if (!lupaActiva) {
                      setZoomLevel(1);
                      setPanPos({ x: 0, y: 0 });
                    }
                  }}
                  disabled={!fotoActaUrl}
                  title={lupaActiva ? "Desactivar Lente Lupa" : "Activar Lente Lupa (Aumento 2.5x al mover el cursor)"}
                  className={`px-2 py-1 rounded-xl text-[11px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40 ${
                    lupaActiva
                      ? "bg-indigo-500 text-white shadow-xs font-black ring-1 ring-white/50"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                  }`}
                >
                  <Search size={12} />
                  <span>{lupaActiva ? "Lupa ON" : "Lupa"}</span>
                </button>

                {/* Girar */}
                <button
                  type="button"
                  onClick={handleRotate}
                  disabled={!fotoActaUrl}
                  title="Girar 90 grados"
                  className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                >
                  <RotateCw size={14} />
                </button>

                {/* Descargar */}
                <button
                  type="button"
                  onClick={handleDownloadFoto}
                  disabled={!fotoActaUrl}
                  title="Descargar fotografía en alta resolución"
                  className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Download size={14} />
                </button>

                {/* Pantalla Completa */}
                <button
                  type="button"
                  onClick={() => setFotoFullscreen(true)}
                  disabled={!fotoActaUrl}
                  title="Expandir a Pantalla Completa"
                  className="p-1.5 rounded-xl hover:bg-slate-800 text-indigo-300 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            </div>

            {/* Viewport Interactivo de la Fotografía */}
            <div
              ref={imgWrapperRef}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onDoubleClick={() => setZoomLevel((z) => (z > 1 ? 1 : 2))}
              className={`relative w-full h-[580px] sm:h-[640px] xl:h-[680px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 select-none flex items-center justify-center ${
                lupaActiva ? "cursor-crosshair" : zoomLevel > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
              }`}
            >
              {fotoActaLoading ? (
                <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-400/30 flex items-center justify-center animate-pulse">
                    <Loader2 size={24} className="animate-spin text-amber-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white">
                      Descargando Acta Original en Alta Resolución...
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-xs">
                      Conectando con el servidor oficial de Fénix (WIN) para obtener la fotografía nítida con sello y firmas.
                    </p>
                  </div>
                </div>
              ) : fotoActaError ? (
                <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-400/30 flex items-center justify-center">
                    <AlertTriangle size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-rose-300">
                      {fotoActaError}
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-xs">
                      Verifique si el técnico ya subió la fotografía del acta de cierre en la tarea finalizada.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={cargarFotoActa}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={13} />
                    <span>Reintentar</span>
                  </button>
                </div>
              ) : fotoActaUrl ? (
                <>
                  {/* Imagen Principal con Zoom y Pan */}
                  <img
                    ref={imgRef}
                    src={fotoActaUrl}
                    alt="Acta de Conformidad"
                    draggable={false}
                    style={{
                      transform: `translate(${panPos.x}px, ${panPos.y}px) scale(${zoomLevel}) rotate(${rotation}deg)`,
                      transition: isDragging ? "none" : "transform 0.15s ease-out",
                      maxWidth: "94%",
                      maxHeight: "94%",
                      objectFit: "contain"
                    }}
                    className="shadow-2xl pointer-events-none rounded-lg"
                  />

                  {/* Lente Lupa Flotante (Magnifier Lens 2.5x) */}
                  {lupaActiva && (
                    <div
                      style={{
                        left: `${lupaPos.x - 90}px`,
                        top: `${lupaPos.y - 90}px`,
                        backgroundImage: `url(${fotoActaUrl})`,
                        backgroundPosition: `${lupaPos.relX}% ${lupaPos.relY}%`,
                        backgroundSize: "280%",
                        backgroundRepeat: "no-repeat"
                      }}
                      className="w-44 h-44 rounded-full border-3 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.6)] pointer-events-none absolute overflow-hidden z-30 ring-4 ring-black/40"
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-3 h-3 border border-amber-300/60 rounded-full"></div>
                      </div>
                    </div>
                  )}

                  {/* Barra Inferior de Ayuda y Tips */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-3 py-1.5 bg-slate-900/80 backdrop-blur-xs text-white rounded-xl border border-white/10 text-[10px] pointer-events-none">
                    <span className="font-mono font-bold text-amber-300">
                      Zoom: {Math.round(zoomLevel * 100)}% {rotation !== 0 ? `• Giro: ${rotation}°` : ""}
                    </span>
                    <span className="text-slate-400 hidden sm:inline">
                      Rueda: Zoom • Doble clic: Alternar • Arrastrar: Mover
                    </span>
                  </div>
                </>
              ) : null}
            </div>

          </div>
        )}

      </div>
    )}
  </div>

  {/* ─────────────────────────────────────────────────────────────
      ALARMA / EMERGENTE: NÚMERO DE ACTA FÍSICA OBLIGATORIO
  ───────────────────────────────────────────────────────────── */}
  {alertaActaVisible && (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border-2 border-rose-500 text-center space-y-4 animate-bounce">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 border-4 border-rose-200 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/20">
          <ShieldAlert size={36} className="animate-pulse" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-black text-rose-900 uppercase tracking-tight">
            🚨 ¡Número de Acta Obligatorio!
          </h3>
          <p className="text-xs text-slate-600 font-semibold leading-relaxed">
            Por regla de negocio, <strong>no se puede liquidar la orden</strong> sin ingresar el número correlativo del <strong>Acta de Servicio Técnico física</strong>.
          </p>
        </div>

        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 font-bold">
          👉 Ingresa el número de acta (ej: <strong>001-04235</strong>) en la parte superior del formulario.
        </div>

        <button
          type="button"
          onClick={() => {
            setAlertaActaVisible(false);
            if (actaInputRef.current) {
              actaInputRef.current.focus();
            }
          }}
          className="w-full py-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-rose-600/30 transition-all cursor-pointer active:scale-95"
        >
          Entendido / Ingresar Número de Acta
        </button>
      </div>
    </div>
  )}

  {/* ─────────────────────────────────────────────────────────────
      MODAL FULLSCREEN DE FOTOGRAFÍA EN ALTA RESOLUCIÓN
  ───────────────────────────────────────────────────────────── */}
  {shouldShowPhoto && fotoFullscreen && fotoActaUrl && (
    <div className="fixed inset-0 z-70 bg-black/95 flex flex-col p-4 animate-fade-in">
      <div className="flex items-center justify-between pb-3 border-b border-white/10 text-white">
        <div className="flex items-center gap-3">
          <span className="font-black text-sm text-amber-400 font-mono">
            Orden #{numeroOrdenStr}
          </span>
          <span className="text-xs text-slate-300 font-bold">
            Acta de Conformidad HD
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono text-[10px] font-bold">
            HD 100%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadFoto}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer"
            title="Descargar imagen"
          >
            <Download size={16} />
          </button>
          <button
            type="button"
            onClick={() => setFotoFullscreen(false)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Salir de pantalla completa"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden p-2">
        <img
          src={fotoActaUrl}
          alt="Acta Fullscreen"
          style={{
            transform: `rotate(${rotation}deg)`,
            maxHeight: "92vh",
            maxWidth: "92vw",
            objectFit: "contain"
          }}
          className="rounded-xl shadow-2xl"
        />
      </div>
    </div>
  )}

  {/* ─────────────────────────────────────────────────────────────
      MODAL DE ESCANEO POR CÁMARA MÓVIL (CÓDIGO DE BARRAS & QR)
  ───────────────────────────────────────────────────────────── */}
  <CameraBarcodeScannerModal
    isOpen={scannerOpen}
    onClose={() => setScannerOpen(false)}
    onScan={handleScanResult}
    title={scannerTitle}
    subtitle={scannerSubtitle}
  />

</div>
</div>
);
};

export default TechnicalActModal;

