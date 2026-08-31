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
} from "lucide-react";
import { Order } from "../types/Order";
import { getPlantillaPorTrabajo, PLANTILLAS_POR_TRABAJO } from "../utils/actaTemplates";
import {
  getTecnicoStock,
  liquidarActaOrden,
  getActaLiquidacion,
  getMotivos,
} from "../../inventory/services/inventoryService";
import { MotivoItem } from "../../inventory/types/inventoryTypes";
import { CameraBarcodeScannerModal } from "../../../components/CameraBarcodeScannerModal";

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
  onClose: () => void;
  onSuccess?: () => void;
}

export const TechnicalActModal: React.FC<Props> = ({
  order,
  idTrabajadorActual,
  readOnly = false,
  canEditTipoTrabajo = true, // Habilitado para que el técnico siempre pueda escoger el tipo de liquidación
  onClose,
  onSuccess,
}) => {
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

  useEffect(() => {
    const t = (
      order.tipoLiquidacion ||
      order.motivoLiquidacion ||
      order.motivoFinalizacion ||
      order.tipoTrabajo ||
      ""
    ).trim();
    if (t) setTipoLiquidacion(t);
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
  const totalDropCalculado = Math.max(0, (Number(dropMetroInicio) || 0) - (Number(dropMetroFin) || 0));

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

    // 1. Revisar si el motivo en BD tiene configurado limites_materiales
    if (limitesDelMotivo && limitesDelMotivo.length > 0) {
      const matchConector = limitesDelMotivo.find((l: any) => {
        const id = Number(l.id_producto);
        const nom = String(l.nombre || "").toUpperCase();
        return id === 27 || nom.includes("CONECTOR") || nom.includes("FAST");
      });
      if (matchConector && (matchConector.cantidad !== undefined || matchConector.max !== undefined || matchConector.limite !== undefined)) {
        return Number(matchConector.cantidad ?? matchConector.max ?? matchConector.limite);
      }
    }

    // 2. Si no viene en JSON de BD, aplicar el límite según el Tipo de Liquidación de la orden
    const tipoNorm = tipoLiquidacion.toUpperCase();
    if (tipoNorm.includes("CTO") || tipoNorm.includes("NAP") || tipoNorm.includes("ROSETA") || tipoNorm.includes("REUBICACION CON RESERVA")) {
      return 1;
    }
    if (tipoNorm.includes("RECABLEADO") || tipoNorm.includes("NORMALIZAC") || tipoNorm.includes("INSTALAC") || tipoNorm.includes("TRASLADO") || tipoNorm.includes("REUBICACION SIN RESERVA")) {
      return 2;
    }

    return null;
  };

  // Si está en modo solo lectura (Admin), cargar el acta real guardada
  useEffect(() => {
    if (readOnly) {
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
              setMateriales(
                res.materiales.map((m: any) => ({
                  id_producto: m.id_producto,
                  nombre: m.nombre,
                  cantidad: m.cantidad,
                  unidad: m.es_drop ? "MTR" : "UND",
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
  }, [readOnly, order.id]);

  // Cargar stock del técnico
  useEffect(() => {
    const targetId = idTrabajadorActual || order.idTecnico;
    if (targetId) {
      getTecnicoStock(targetId)
        .then((res) => {
          setStockTecnicoMateriales(res.materiales || []);
          setSeriesAsignadasTecnico(res.seriesAsignadas || []);
        })
        .catch((err) => console.error("Error al cargar stock:", err));
    }
  }, [idTrabajadorActual, order.idTecnico]);

  // Aplicar sugerencias de materiales cuando cambia el Tipo de Liquidación
  useEffect(() => {
    if (readOnly) return;
    const plant = getPlantillaPorTrabajo(tipoLiquidacion);
    const nuevasFilas: MaterialRow[] = plant.materialesDefault.map((def, idx) => {
      // Buscar si el producto existe en el catálogo o stock del técnico
      const match = stockTecnicoMateriales.find((m) =>
        m.nombre.toUpperCase().includes(def.nombre.toUpperCase())
      );
      const prodId = match ? match.id_producto : idx + 1;
      const lim = obtenerLimiteParaMaterial(prodId, def.nombre);
      let cant = def.cantidadDefault;
      if (lim !== null && cant > lim) {
        cant = lim;
      }
      return {
        id_producto: prodId,
        nombre: def.nombre,
        cantidad: cant,
        unidad: def.unidad,
        stockDisponible: match ? match.stock : undefined,
      };
    });
    setMateriales(nuevasFilas);
  }, [tipoLiquidacion, stockTecnicoMateriales, limitesDelMotivo, readOnly]);

  // Handler para agregar material desde el stock del técnico (+)
  const handleAgregarMaterialDeStock = () => {
    if (!selectedStockProductoId) return;
    const prod = stockTecnicoMateriales.find((p) => p.id_producto === Number(selectedStockProductoId));
    if (!prod) return;

    const cant = Math.max(1, Number(selectedStockCantidad) || 1);
    const lim = obtenerLimiteParaMaterial(prod.id_producto, prod.nombre);

    if (lim !== null && cant > lim) {
      setAlertaLimiteMsg(
        `⚠️ El tipo de liquidación "${tipoLiquidacion}" solo permite hasta ${lim} unidades de ${prod.nombre}.`
      );
      setTimeout(() => setAlertaLimiteMsg(null), 5000);
      return;
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
    // REGLA DE NEGOCIO 1: NÚMERO DE ACTA ES OBLIGATORIO
    // ─────────────────────────────────────────────────────────────
    const cleanSufijo = guiaCorrelativo.trim();
    if (!cleanSufijo) {
      setAlertaActaVisible(true);
      if (actaInputRef.current) {
        actaInputRef.current.focus();
      }
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // REGLA DE NEGOCIO 2: VALIDACIÓN DE LÍMITES DE MATERIALES
    // ─────────────────────────────────────────────────────────────
    for (const mat of materiales) {
      if (mat.cantidad > 0) {
        const lim = obtenerLimiteParaMaterial(mat.id_producto, mat.nombre);
        if (lim !== null && mat.cantidad > lim) {
          alert(
            `❌ LÍMITE DE MATERIAL EXCEDIDO:\n\nHas ingresado ${mat.cantidad} unidades de "${mat.nombre}", pero el tipo de liquidación "${tipoLiquidacion}" solo permite un máximo de ${lim} unidades.\n\nPor favor ajusta la cantidad antes de liquidar.`
          );
          return;
        }
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

      const equiposInstaladosPayload = [];
      if (snOntInstalado) equiposInstaladosPayload.push({ numero_serie: snOntInstalado, tipo_equipo: "ONT" });
      if (snMeshInstalado) equiposInstaladosPayload.push({ numero_serie: snMeshInstalado, tipo_equipo: "MESH" });

      const equiposRetiradosPayload = [];
      if (snOntRetirado) {
        equiposRetiradosPayload.push({
          tipo_equipo: "ONT",
          numero_serie: snOntRetirado,
          motivo_retiro: motivoOntRetiro,
        });
      }
      if (snMeshRetirado) {
        equiposRetiradosPayload.push({
          tipo_equipo: "MESH",
          numero_serie: snMeshRetirado,
          motivo_retiro: "Cambio / Devolución",
        });
      }

      const numeroGuiaFinal = `001-${cleanSufijo}`;

      await liquidarActaOrden(order.id, {
        id_trabajador: idTrabajadorActual,
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
      });

      alert(`✅ ¡Acta ${numeroGuiaFinal} guardada exitosamente! Orden liquidada como "${tipoLiquidacion}" y materiales descontados de tu stock.`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      alert("Error al liquidar acta: " + (err.response?.data?.error || err.message));
    } finally {
      setGuardando(false);
    }
  };

  const plantillaActual = getPlantillaPorTrabajo(tipoLiquidacion);

  // Lista combinada de opciones de Tipo de Liquidación
  const opcionesTipoLiquidacion = useMemo(() => {
    const baseOptions = [
      "RECABLEADO",
      "NORMALIZACIÓN",
      "CAMBIO DE CONECTOR EN CTO/NAP",
      "CAMBIO DE CONECTOR EN ROSETA",
      "CAMBIO DE EQUIPO ONT",
      "CAMBIO DE EQUIPO MESH",
      "GARANTIA",
      "REUBICACIÓN CON RESERVA",
      "REUBICACIÓN SIN RESERVA",
      "TRASLADO",
      "TRASALDO EN CONDOMINIO",
      "RECABLEADO EN CONDOMINIO",
      "VISITA EXTERNA",
      "INSTALACION",
      "PEX",
      "ADICIONAL",
    ];

    const fromMotivos = motivosList.map((m) => m.nombre.trim()).filter(Boolean);
    const combined = Array.from(new Set([...fromMotivos, ...baseOptions]));
    return combined;
  }, [motivosList]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-2 md:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl p-5 md:p-6 max-w-3xl w-full shadow-2xl border border-slate-100 space-y-5 max-h-[95vh] overflow-y-auto relative">
        
        {/* ─────────────────────────────────────────────────────────────
            HEADER ACTA WIN OFICIAL
        ───────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-md shadow-amber-500/25">
              <FileText size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded-lg bg-orange-100 text-orange-800 border border-orange-200">
                  ACTA DE SERVICIO TÉCNICO
                </span>
                {readOnly ? (
                  <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-amber-400 font-mono font-black text-xs border border-slate-700">
                    N° {numeroGuiaGuardada || `001-${guiaCorrelativo || "XXXXXX"}`} 🔒
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
              <h2 className="text-base md:text-lg font-black text-slate-900 mt-0.5">
                {readOnly
                  ? `Auditoría de Liquidación (Llenado por: ${tecnicoNombreGuardado || "Técnico en Campo"})`
                  : `Liquidación de Orden de Campo`}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            BANNER FLOTANTE DE ALERTA DE LÍMITES
        ───────────────────────────────────────────────────────────── */}
        {alertaLimiteMsg && (
          <div className="p-3 bg-amber-500 text-white rounded-2xl font-bold text-xs shadow-lg flex items-center justify-between gap-2 animate-bounce">
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
        ) : actaGuardadaNoExiste && readOnly ? (
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
          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold text-slate-700">

            {/* ─────────────────────────────────────────────────────────────
                3. CÁLCULO DE CABLE DROP (SI APLICA)
            ───────────────────────────────────────────────────────────── */}
            {(plantillaActual.requiereDrop || Number(dropMetroInicio) > 0) && (
              <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-amber-900 flex items-center gap-1.5">
                    <Package size={16} />
                    Metraje de Cable Drop (Fibra Óptica)
                  </span>
                  <span className="text-xs font-black px-3 py-1 bg-amber-500 text-white rounded-xl font-mono shadow-xs">
                    Total Consumido: {totalDropCalculado} metros
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-center">
                  <div>
                    <label className="block mb-1 text-slate-600">Metro Inicio (Carrete)</label>
                    <input
                      type="number"
                      disabled={readOnly}
                      value={dropMetroInicio}
                      onChange={(e) => setDropMetroInicio(e.target.value)}
                      placeholder="Ej: 160"
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-xs disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 text-slate-600">Metro Fin (Carrete)</label>
                    <input
                      type="number"
                      disabled={readOnly}
                      value={dropMetroFin}
                      onChange={(e) => setDropMetroFin(e.target.value)}
                      placeholder="Ej: 100"
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-xs disabled:bg-slate-100"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1 bg-white p-2.5 rounded-xl border border-amber-200 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Descuento de Bobina</span>
                    <span className="text-sm font-black text-amber-800 font-mono">
                      -{totalDropCalculado} mtrs
                    </span>
                  </div>
                </div>
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

                {!readOnly && (
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
              {mostrarSelectorStock && !readOnly && (
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
                        {stockTecnicoMateriales.map((m) => (
                          <option key={m.id_producto} value={m.id_producto}>
                            {m.nombre} (Stock: {m.stock} {m.es_drop ? "m" : "und"})
                          </option>
                        ))}
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
                {materiales.length === 0 ? (
                  <div className="py-4 text-center text-slate-400 text-xs font-bold">
                    No hay materiales asignados. Toca "+ Agregar Material de mi Stock" para añadir.
                  </div>
                ) : (
                  materiales.map((mat, idx) => {
                    const limite = obtenerLimiteParaMaterial(mat.id_producto, mat.nombre);
                    const tieneLimite = limite !== null;

                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between gap-2 bg-white p-2.5 rounded-xl border shadow-2xs transition-all ${
                          tieneLimite && mat.cantidad >= limite
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
                            {mat.stockDisponible !== undefined && (
                              <span className="text-[9px] font-mono text-slate-400 font-bold">
                                (Stock disponible: {mat.stockDisponible})
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
                              disabled={readOnly}
                              value={mat.cantidad}
                              onChange={(e) => handleCambiarCantidadMaterial(idx, e.target.value)}
                              className="w-16 p-1.5 bg-white border border-slate-200 rounded-lg text-center font-mono font-black text-xs focus:ring-2 focus:ring-indigo-300 focus:outline-none disabled:bg-slate-100"
                              title={tieneLimite ? `Máximo permitido: ${limite}` : "Cantidad"}
                            />
                            <span className="text-[10px] font-bold text-slate-500 px-1">{mat.unidad}</span>
                          </div>

                          {!readOnly && (
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
                5. CONTROL DE EQUIPOS SERIALIZADOS
            ───────────────────────────────────────────────────────────── */}
            {(plantillaActual.requiereEquipoInstalado ||
              plantillaActual.requiereEquipoRetirado ||
              snOntRetirado) && (
              <div className="p-4 bg-gradient-to-r from-indigo-50/60 to-purple-50/60 border border-indigo-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-indigo-900 flex items-center gap-1.5">
                    <QrCode size={16} />
                    Equipos Serializados (ONT / Router / Mesh)
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800">
                    Control de Series & Recojo
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-indigo-100">
                  <div>
                    <label className="block mb-1 text-slate-600 font-bold flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1">
                        <ArrowUpRight size={14} className="text-emerald-600" />
                        S/N ONT Instalado
                      </span>
                      {!readOnly && (
                        <span className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
                          Cámara o Digitar
                        </span>
                      )}
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Digita o escanea serie..."
                        disabled={readOnly}
                        value={snOntInstalado}
                        onChange={(e) => setSnOntInstalado(e.target.value.toUpperCase())}
                        className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white font-bold disabled:bg-slate-100"
                      />
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => abrirEscaner("ont_instalado", "Escanear ONT Instalada", "Apunta al código de barras o serie de la ONT nueva")}
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
                        S/N ONT Retirado (Recogido)
                      </span>
                      {!readOnly && (
                        <span className="text-[10px] text-rose-700 font-medium bg-rose-50 px-1.5 py-0.5 rounded">
                          Cámara o Digitar
                        </span>
                      )}
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Digita o escanea serie retirada..."
                        disabled={readOnly}
                        value={snOntRetirado}
                        onChange={(e) => setSnOntRetirado(e.target.value.toUpperCase())}
                        className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white font-bold text-rose-800 disabled:bg-slate-100"
                      />
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => abrirEscaner("ont_retirado", "Escanear ONT Retirada", "Apunta al código de barras del equipo recogido al cliente")}
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
            )}

            {/* Observaciones */}
            <div>
              <label className="block mb-1 text-slate-600 font-bold">Observaciones del Técnico</label>
              <textarea
                rows={2}
                disabled={readOnly}
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
              {readOnly ? (
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
        )}

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

