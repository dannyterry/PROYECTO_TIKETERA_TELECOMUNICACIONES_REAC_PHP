import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Save,
  FileSpreadsheet,
  Printer,
  Sparkles,
  Search,
  Wrench,
  Truck,
  HardHat,
  Cpu,
  PackageCheck,
  UserCheck,
  Calendar,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  FileText,
  Camera,
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  Eye,
  Maximize2,
  ShieldCheck,
  Check,
  X,
  Play,
  CheckCheck,
  Navigation,
  Barcode,
  Plus,
  Tag,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  FichaSupervisionCampo,
  ItemChecklist,
  TipoInspeccion,
  TecnicoCombo,
  SupervisorCombo,
  OrdenBusqueda,
  getItemsForTipo,
} from "../types/supervisionTypes";
import { supervisionService } from "../services/supervisionService";
import { CameraBarcodeScannerModal } from "../../../components/CameraBarcodeScannerModal";

interface FieldSupervisionTabProps {
  onSaved?: () => void;
}

export const FieldSupervisionTab: React.FC<FieldSupervisionTabProps> = ({ onSaved }) => {
  // Catalogs from DB
  const [tecnicosCombo, setTecnicosCombo] = useState<TecnicoCombo[]>([]);
  const [supervisoresCombo, setSupervisoresCombo] = useState<SupervisorCombo[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Search & autocomplete states
  const [searchTermTecnico, setSearchTermTecnico] = useState("");
  const [showTecnicoDropdown, setShowTecnicoDropdown] = useState(false);
  const tecnicoContainerRef = useRef<HTMLDivElement>(null);

  const [searchOtTerm, setSearchOtTerm] = useState("");
  const [ordenesResultados, setOrdenesResultados] = useState<OrdenBusqueda[]>([]);
  const [showOtDropdown, setShowOtDropdown] = useState(false);
  const [isSearchingOt, setIsSearchingOt] = useState(false);
  const otContainerRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        tecnicoContainerRef.current &&
        !tecnicoContainerRef.current.contains(e.target as Node)
      ) {
        setShowTecnicoDropdown(false);
      }
      if (
        otContainerRef.current &&
        !otContainerRef.current.contains(e.target as Node)
      ) {
        setShowOtDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Form State
  const [selectedTipo, setSelectedTipo] = useState<TipoInspeccion>("CAMPO_GENERAL");
  const [selectedTecnico, setSelectedTecnico] = useState<TecnicoCombo | null>(null);
  const [tecnicoName, setTecnicoName] = useState("");
  const [cuadrilla, setCuadrilla] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [hora, setHora] = useState(
    new Date().toTimeString().split(" ")[0].slice(0, 5)
  );
  const [lugarInspeccion, setLugarInspeccion] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // Operative Workflow Status & Stopwatch Timer
  const [estadoOperativo, setEstadoOperativo] = useState<"EN_CAMINO" | "INICIADA" | "FINALIZADA">("INICIADA");
  const [horaInicio, setHoraInicio] = useState<string>(
    new Date().toTimeString().split(" ")[0].slice(0, 5)
  );
  const [horaFin, setHoraFin] = useState<string>("");
  const [segundosTranscurridos, setSegundosTranscurridos] = useState<number>(0);

  // Live stopwatch when INICIADA
  useEffect(() => {
    let interval: any = null;
    if (estadoOperativo === "INICIADA") {
      interval = setInterval(() => {
        setSegundosTranscurridos((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [estadoOperativo]);

  const formatoTiempo = (totalSeg: number) => {
    const m = Math.floor(totalSeg / 60);
    const s = totalSeg % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Barcode Scanner Modal State for Equipment
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeScanningItemId, setActiveScanningItemId] = useState<string | null>(null);
  const [manualSerieInputs, setManualSerieInputs] = useState<{ [itemId: string]: string }>({});

  // Fotos de Validación en Terreno
  const [fotoEppUniforme, setFotoEppUniforme] = useState<string | null>(null);
  const [fotoHerramientas, setFotoHerramientas] = useState<string | null>(null);
  const [fotoCarroLimpio, setFotoCarroLimpio] = useState<string | null>(null);
  const [modalFotoPreview, setModalFotoPreview] = useState<{ isOpen: boolean; url: string; titulo: string }>({
    isOpen: false,
    url: "",
    titulo: "",
  });

  // Items State (dynamically initialized by template)
  const [items, setItems] = useState<ItemChecklist[]>(() =>
    getItemsForTipo("CAMPO_GENERAL")
  );

  // Selected Category filter for quick mobile view
  const [filtroCategoria, setFiltroCategoria] = useState<string>("TODOS");

  // Save states
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load Catalogs on Mount
  useEffect(() => {
    const loadCatalogs = async () => {
      setLoadingCatalog(true);
      try {
        const [tecnicos, supervisores] = await Promise.all([
          supervisionService.getTecnicosCombo(),
          supervisionService.getSupervisoresCombo(),
        ]);
        setTecnicosCombo(tecnicos);
        setSupervisoresCombo(supervisores);
        if (supervisores.length > 0) {
          setSupervisor(supervisores[0].supervisor);
        }
      } catch (e) {
        console.error("Error al cargar catálogos:", e);
      } finally {
        setLoadingCatalog(false);
      }
    };
    loadCatalogs();
  }, []);

  // When Inspection Type Changes, load template items
  const handleCambiarTipo = (tipo: TipoInspeccion) => {
    if (tipo === selectedTipo) return;
    setSelectedTipo(tipo);
    setItems(getItemsForTipo(tipo));
  };

  // Search OT Debounced
  useEffect(() => {
    if (!searchOtTerm || searchOtTerm.trim().length < 2) {
      setOrdenesResultados([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingOt(true);
      const res = await supervisionService.buscarOrdenes(searchOtTerm);
      setOrdenesResultados(res);
      setIsSearchingOt(false);
      setShowOtDropdown(true);
    }, 280);

    return () => clearTimeout(timer);
  }, [searchOtTerm]);

  // Handle Order Selection from Search
  const handleSelectOrden = (ord: OrdenBusqueda) => {
    if (ord.tecnico) {
      setTecnicoName(ord.tecnico);
      setSearchTermTecnico(ord.tecnico);
    }
    if (ord.cuadrilla) setCuadrilla(ord.cuadrilla);
    if (ord.distrito || ord.direccion) {
      setLugarInspeccion(`${ord.distrito ? ord.distrito + " - " : ""}${ord.direccion || ""}`);
    }
    if (ord.id_tecnico) {
      const match = tecnicosCombo.find((t) => t.id_tecnico === ord.id_tecnico);
      if (match) setSelectedTecnico(match);
    }

    setSearchOtTerm(`OT: ${ord.ot} · ${ord.tecnico}`);
    setShowOtDropdown(false);
  };

  // Filter combo without DNI in filter or display
  const filteredTecnicos = useMemo(() => {
    if (!searchTermTecnico.trim()) return tecnicosCombo;
    const q = searchTermTecnico.toLowerCase();
    return tecnicosCombo.filter(
      (t) =>
        t.tecnico.toLowerCase().includes(q) ||
        t.cuadrilla.toLowerCase().includes(q)
    );
  }, [tecnicosCombo, searchTermTecnico]);

  // Handle Technician Selection
  const handleSelectTecnico = (t: TecnicoCombo) => {
    setSelectedTecnico(t);
    setTecnicoName(t.tecnico);
    setCuadrilla(t.cuadrilla || "");
    setSearchTermTecnico(t.tecnico);
    setShowTecnicoDropdown(false);
  };

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: { [key: string]: ItemChecklist[] } = {
      UNIFORME: [],
      HERRAMIENTAS: [],
      MATERIALES: [],
      VEHICULOS: [],
      EQUIPOS: [],
    };
    items.forEach((item) => {
      if (groups[item.categoria]) {
        groups[item.categoria].push(item);
      }
    });
    return groups;
  }, [items]);

  // Checklist score calculation
  const scoreStats = useMemo(() => {
    const total = items.length;
    const cumplidos = items.filter((i) => i.cumple).length;
    const noCumplidos = total - cumplidos;
    const porcentaje = total > 0 ? Math.round((cumplidos / total) * 100) : 100;

    let semaforo: "verde" | "amarillo" | "rojo" = "verde";
    if (porcentaje >= 85) semaforo = "verde";
    else if (porcentaje >= 70) semaforo = "amarillo";
    else semaforo = "rojo";

    return { total, cumplidos, noCumplidos, porcentaje, semaforo };
  }, [items]);

  // Handle Item Toggle (SÍ / NO)
  const handleToggleCumple = (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, cumple: !it.cumple } : it))
    );
  };

  const handleSetCumple = (id: string, cumple: boolean) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, cumple } : it))
    );
  };

  const handleEstadoChange = (id: string, estado: any) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, estado } : it))
    );
  };

  const handleCantidadChange = (id: string, cantidad: string | number) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, cantidad } : it))
    );
  };

  const handleObservacionChange = (id: string, obs: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, observacion: obs } : it))
    );
  };

  // Series management for Equipos
  const handleOpenScanner = (itemId: string) => {
    setActiveScanningItemId(itemId);
    setIsScannerOpen(true);
  };

  const handleScanSerie = (decodedText: string) => {
    if (!activeScanningItemId) return;
    const cleanSerie = decodedText.trim().toUpperCase();
    if (!cleanSerie) return;

    setItems((prev) =>
      prev.map((it) => {
        if (it.id === activeScanningItemId) {
          const currentSeries = it.series || [];
          if (!currentSeries.includes(cleanSerie)) {
            const nextSeries = [...currentSeries, cleanSerie];
            return {
              ...it,
              series: nextSeries,
              cantidad: nextSeries.length,
              cumple: true,
            };
          }
        }
        return it;
      })
    );
    setIsScannerOpen(false);
  };

  const handleAddManualSerie = (itemId: string) => {
    const text = (manualSerieInputs[itemId] || "").trim().toUpperCase();
    if (!text) return;

    setItems((prev) =>
      prev.map((it) => {
        if (it.id === itemId) {
          const currentSeries = it.series || [];
          if (!currentSeries.includes(text)) {
            const nextSeries = [...currentSeries, text];
            return {
              ...it,
              series: nextSeries,
              cantidad: nextSeries.length,
              cumple: true,
            };
          }
        }
        return it;
      })
    );
    setManualSerieInputs((prev) => ({ ...prev, [itemId]: "" }));
  };

  const handleRemoveSerie = (itemId: string, serieToRemove: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === itemId) {
          const nextSeries = (it.series || []).filter((s) => s !== serieToRemove);
          return {
            ...it,
            series: nextSeries,
            cantidad: nextSeries.length > 0 ? nextSeries.length : it.cantidad,
          };
        }
        return it;
      })
    );
  };

  const handleMarcarTodos = (cumple: boolean) => {
    setItems((prev) => prev.map((it) => ({ ...it, cumple })));
  };

  // Workflow transitions
  const handleIniciarSupervision = () => {
    const currentNow = new Date().toTimeString().split(" ")[0].slice(0, 5);
    setEstadoOperativo("INICIADA");
    setHoraInicio(currentNow);
    setHoraFin("");
  };

  const handleFinalizarSupervision = () => {
    const currentNow = new Date().toTimeString().split(" ")[0].slice(0, 5);
    setEstadoOperativo("FINALIZADA");
    setHoraFin(currentNow);
  };

  // Procesar y comprimir fotos cargadas
  const procesarFoto = (file: File, callback: (base64: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.78);
          callback(compressedDataUrl);
        }
      };
      if (typeof e.target?.result === "string") {
        img.src = e.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  // Reset Form
  const handleReset = () => {
    if (window.confirm("¿Deseas restablecer todos los ítems de esta ficha?")) {
      setItems(getItemsForTipo(selectedTipo));
      setObservaciones("");
      setFotoEppUniforme(null);
      setFotoHerramientas(null);
      setFotoCarroLimpio(null);
      setEstadoOperativo("INICIADA");
      setHoraInicio(new Date().toTimeString().split(" ")[0].slice(0, 5));
      setHoraFin("");
      setSegundosTranscurridos(0);
      setSaveSuccess(false);
      setSaveError(null);
    }
  };

  // Save to DB
  const handleSave = async () => {
    if (!tecnicoName.trim()) {
      alert("Por favor ingresa o selecciona el nombre del técnico evaluado.");
      return;
    }

    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    const payload: FichaSupervisionCampo = {
      id_tecnico: selectedTecnico?.id_tecnico,
      tecnico: tecnicoName.trim(),
      cuadrilla: cuadrilla.trim() || undefined,
      tipo_inspeccion: selectedTipo,
      fecha,
      hora,
      hora_inicio: horaInicio || undefined,
      hora_fin: horaFin || undefined,
      estado_operativo: estadoOperativo,
      lugar_inspeccion: lugarInspeccion.trim() || undefined,
      supervisor: supervisor.trim() || "Supervisor de Calidad",
      cumplimiento_porcentaje: scoreStats.porcentaje,
      semaforo: scoreStats.semaforo,
      items_json: items,
      observaciones: observaciones.trim() || undefined,
      foto_epp_uniforme: fotoEppUniforme || undefined,
      foto_herramientas: fotoHerramientas || undefined,
      foto_carro_limpio: fotoCarroLimpio || undefined,
    };

    const res = await supervisionService.saveSupervisionCampo(payload);
    setSaving(false);

    if (res.success) {
      setSaveSuccess(true);
      if (onSaved) onSaved();
      setTimeout(() => setSaveSuccess(false), 5000);
    } else {
      setSaveError(res.message || "Error al guardar la supervisión");
    }
  };

  // Export to Excel (Without DNI)
  const handleExportExcel = () => {
    const headerRows = [
      ["CORPORACIÓN CÉSPEDES - FICHA DE SUPERVISIÓN DE TRABAJO EN CAMPO"],
      ["Tipo de Inspección:", selectedTipo, "Fecha:", fecha, "Hora:", hora],
      ["Técnico Evaluado:", tecnicoName, "Cuadrilla:", cuadrilla, "Estado:", estadoOperativo],
      ["Hora Inicio:", horaInicio || "—", "Hora Fin:", horaFin || "—"],
      ["Lugar / Ubicación:", lugarInspeccion, "Supervisor:", supervisor],
      ["Cumplimiento:", `${scoreStats.porcentaje}%`, "Semáforo:", scoreStats.semaforo.toUpperCase()],
      [],
      ["CATEGORÍA", "ÍTEM", "CUMPLE (SÍ/NO)", "CANTIDAD", "SERIES ESCANEADAS", "ESTADO", "OBSERVACIÓN"],
    ];

    const dataRows = items.map((it) => [
      it.categoria,
      it.nombre,
      it.cumple ? "SÍ" : "NO",
      it.cantidad !== undefined ? it.cantidad : "—",
      it.series && it.series.length > 0 ? it.series.join(", ") : "—",
      it.estado || "BUENO",
      it.observacion || "",
    ]);

    const footerRows = [
      [],
      ["OBSERVACIONES GENERALES DEL SUPERVISOR:"],
      [observaciones || "Sin observaciones adicionales"],
    ];

    const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows, ...footerRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Supervision_${selectedTipo}`);
    const filename = `Ficha_Supervision_${selectedTipo}_${tecnicoName.replace(/\s+/g, "_")}_${fecha}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* 1. Top Operative Workflow & Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-5 md:p-7 text-white shadow-xl border border-blue-700/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-blue-300 text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Corporación Céspedes · Formulario Oficial de Inspección
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">
              Ficha de Supervisión de Trabajo en Campo
            </h2>
            <p className="text-blue-200/80 text-xs md:text-sm max-w-2xl leading-relaxed">
              Control en terreno con verificación de Uniformes, Herramientas, Materiales, Vehículo y Escaneo de Series para Equipos.
            </p>
          </div>

          {/* Template Selectors */}
          <div className="flex flex-wrap items-center gap-2 bg-black/30 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => handleCambiarTipo("CAMPO_GENERAL")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                selectedTipo === "CAMPO_GENERAL"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-102"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Campo General</span>
            </button>

            <button
              type="button"
              onClick={() => handleCambiarTipo("AVERIAS")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                selectedTipo === "AVERIAS"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30 scale-102"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Averías</span>
            </button>

            <button
              type="button"
              onClick={() => handleCambiarTipo("ORDENAMIENTO")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                selectedTipo === "ORDENAMIENTO"
                  ? "bg-teal-600 text-white shadow-md shadow-teal-500/30 scale-102"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Ordenamiento</span>
            </button>

            <button
              type="button"
              onClick={() => handleCambiarTipo("ALTAS")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                selectedTipo === "ALTAS"
                  ? "bg-sky-600 text-white shadow-md shadow-sky-500/30 scale-102"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <HardHat className="w-3.5 h-3.5" />
              <span>Altas</span>
            </button>
          </div>
        </div>

        {/* Real-Time Operative Status Bar */}
        <div className="mt-5 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-black text-blue-200 uppercase tracking-wider">
              Estado de la Supervisión:
            </span>

            {/* Operative Buttons */}
            <button
              type="button"
              onClick={() => setEstadoOperativo("EN_CAMINO")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                estadoOperativo === "EN_CAMINO"
                  ? "bg-amber-500 text-slate-950 font-black shadow-md scale-105"
                  : "bg-white/10 text-slate-200 hover:bg-white/20"
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>🚗 En Camino</span>
            </button>

            <button
              type="button"
              onClick={handleIniciarSupervision}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                estadoOperativo === "INICIADA"
                  ? "bg-emerald-500 text-slate-950 font-black shadow-md scale-105"
                  : "bg-white/10 text-slate-200 hover:bg-white/20"
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>⏱️ En Supervisión</span>
            </button>

            <button
              type="button"
              onClick={handleFinalizarSupervision}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                estadoOperativo === "FINALIZADA"
                  ? "bg-blue-400 text-slate-950 font-black shadow-md scale-105"
                  : "bg-white/10 text-slate-200 hover:bg-white/20"
              }`}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>🏁 Finalizada</span>
            </button>
          </div>

          {/* Time & Duration Display */}
          <div className="flex items-center gap-4 bg-black/40 px-3.5 py-1.5 rounded-xl border border-white/10 text-xs">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-300">Inicio:</span>
              <span className="font-mono font-bold text-white">{horaInicio || hora}</span>
            </div>
            {horaFin && (
              <div className="flex items-center gap-1.5 border-l border-white/20 pl-3">
                <span className="text-slate-300">Fin:</span>
                <span className="font-mono font-bold text-emerald-400">{horaFin}</span>
              </div>
            )}
            {estadoOperativo === "INICIADA" && (
              <div className="flex items-center gap-1.5 border-l border-white/20 pl-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-mono font-bold text-emerald-300">
                  {formatoTiempo(segundosTranscurridos)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Header Data & Technician Selector (NO DNI) */}
      <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <h3 className="font-extrabold text-slate-800 text-xs md:text-sm">
              1. Datos de la Inspección & Técnico Asignado
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2.5 py-1 rounded-full">
            Plantilla: {selectedTipo.replace("_", " ")}
          </span>
        </div>

        {/* Quick OT Autofill */}
        <div ref={otContainerRef} className="relative">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            ⚡ Autocompletar desde Orden de Trabajo / Ticket
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchOtTerm}
              onChange={(e) => setSearchOtTerm(e.target.value)}
              placeholder="Escribe OT, Ticket, o Nombre para autocompletar..."
              className="w-full pl-9 pr-10 py-2 text-xs md:text-sm border border-blue-200 bg-blue-50/40 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 placeholder:text-slate-400"
            />
            <Search className="w-4 h-4 text-blue-600 absolute left-3 top-2.5" />
            {searchOtTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchOtTerm("");
                  setOrdenesResultados([]);
                  setShowOtDropdown(false);
                }}
                className="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* OT Dropdown */}
          {showOtDropdown && ordenesResultados.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-blue-200 rounded-xl shadow-2xl max-h-56 overflow-y-auto z-50 divide-y divide-slate-100">
              {ordenesResultados.map((ord) => (
                <button
                  key={ord.id_orden}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectOrden(ord);
                  }}
                  className="w-full text-left p-2.5 hover:bg-blue-50 transition-colors flex flex-col justify-between gap-1 text-xs cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-900">OT: {ord.ot}</span>
                    <span className="text-slate-500 font-bold">{ord.tecnico}</span>
                  </div>
                  <div className="text-slate-800 font-semibold">{ord.cliente}</div>
                  <div className="text-[10px] text-slate-400">
                    {ord.distrito} · {ord.direccion}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main Grid: Technician, Cuadrilla, Fecha, Hora, Lugar */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {/* Technician Selector (NO DNI) */}
          <div ref={tecnicoContainerRef} className="relative">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Técnico Evaluado *
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTermTecnico || tecnicoName}
                onChange={(e) => {
                  setSearchTermTecnico(e.target.value);
                  setTecnicoName(e.target.value);
                  setShowTecnicoDropdown(true);
                }}
                onFocus={() => setShowTecnicoDropdown(true)}
                placeholder="Buscar técnico por nombre o cuadrilla..."
                className="w-full pl-8 pr-16 py-2 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />

              <div className="absolute right-2 top-2 flex items-center gap-0.5">
                {(searchTermTecnico || tecnicoName) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTermTecnico("");
                      setTecnicoName("");
                      setSelectedTecnico(null);
                      setCuadrilla("");
                      setShowTecnicoDropdown(false);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                    title="Limpiar técnico"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowTecnicoDropdown((prev) => !prev)}
                  className="p-1 text-slate-400 hover:text-blue-600 rounded-md cursor-pointer"
                  title="Mostrar/Ocultar lista"
                >
                  {showTecnicoDropdown ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Dropdown */}
            {showTecnicoDropdown && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-slate-50">
                {filteredTecnicos.length > 0 ? (
                  filteredTecnicos.map((t) => (
                    <button
                      key={t.id_tecnico}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectTecnico(t);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between text-xs transition-colors cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-slate-800">{t.tecnico}</div>
                        <div className="text-[10px] text-slate-400">
                          Cel: {t.celular || "—"} · Cargo: {t.cargo || "Técnico"}
                        </div>
                      </div>
                      <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {t.cuadrilla || "S/C"}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-slate-400 italic">
                    No se encontraron técnicos
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cuadrilla */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Cuadrilla / Móvil
            </label>
            <input
              type="text"
              value={cuadrilla}
              onChange={(e) => setCuadrilla(e.target.value)}
              placeholder="ej. K 5 CESPEDES SGA"
              className="w-full px-3 py-2 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Fecha de Inspección *
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Hora */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Hora de Inspección
            </label>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="w-full px-3 py-2 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Ubicación */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              Ubicación / Lugar de Trabajo
            </label>
            <input
              type="text"
              value={lugarInspeccion}
              onChange={(e) => setLugarInspeccion(e.target.value)}
              placeholder="ej. Base San Juan / CTO 14 Surco / Av. Los Próceres 120"
              className="w-full px-3 py-2 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Supervisor Selector */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Supervisor Responsable de la Auditoría *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={supervisor}
              onChange={(e) => setSupervisor(e.target.value)}
              className="w-full px-3 py-2 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium bg-white"
            >
              {supervisoresCombo.map((sup) => (
                <option key={sup.id_usuario} value={sup.supervisor}>
                  {sup.supervisor} ({sup.cargo || "SUPERVISOR"})
                </option>
              ))}
            </select>
            <input
              type="text"
              value={supervisor}
              onChange={(e) => setSupervisor(e.target.value)}
              placeholder="O ingresa nombre del auditor personalizado..."
              className="w-full px-3 py-2 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 3. Score & Category Filter Bar */}
      <div className="bg-slate-900 rounded-3xl p-4 md:p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-md ${
              scoreStats.semaforo === "verde"
                ? "bg-emerald-500 text-emerald-950"
                : scoreStats.semaforo === "amarillo"
                ? "bg-amber-400 text-amber-950"
                : "bg-rose-500 text-white"
            }`}
          >
            {scoreStats.porcentaje}%
          </div>
          <div>
            <div className="text-xs text-slate-400 font-bold">Cumplimiento Global</div>
            <div className="text-sm font-extrabold flex items-center gap-1.5">
              <span>
                {scoreStats.cumplidos} de {scoreStats.total} ítems conformes
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  scoreStats.semaforo === "verde"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : scoreStats.semaforo === "amarillo"
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-rose-500/20 text-rose-300"
                }`}
              >
                {scoreStats.semaforo}
              </span>
            </div>
          </div>
        </div>

        {/* Global check buttons & Category Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleMarcarTodos(true)}
            className="px-3 py-1.5 rounded-xl bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50 text-xs font-bold transition-all cursor-pointer"
          >
            Marcar Todos SÍ
          </button>
          <button
            type="button"
            onClick={() => handleMarcarTodos(false)}
            className="px-3 py-1.5 rounded-xl bg-rose-600/30 text-rose-300 hover:bg-rose-600/50 text-xs font-bold transition-all cursor-pointer"
          >
            Marcar Todos NO
          </button>
        </div>
      </div>

      {/* Category Pills Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {["TODOS", "UNIFORME", "HERRAMIENTAS", "MATERIALES", "VEHICULOS", "EQUIPOS"].map((cat) => {
          const isSelected = filtroCategoria === cat;
          const count =
            cat === "TODOS"
              ? items.length
              : items.filter((i) => i.categoria === cat).length;

          return (
            <button
              key={cat}
              type="button"
              onClick={() => setFiltroCategoria(cat)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                isSelected
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-102"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <span>{cat}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. Category Checklists with Specialized Row Controls */}
      <div className="space-y-6">
        {Object.entries(groupedItems).map(([categoria, catItems]) => {
          if (catItems.length === 0) return null;
          if (filtroCategoria !== "TODOS" && filtroCategoria !== categoria) return null;

          const cumplidosCat = catItems.filter((i) => i.cumple).length;
          const porcentajeCat = Math.round((cumplidosCat / catItems.length) * 100);

          return (
            <div
              key={categoria}
              className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden"
            >
              {/* Category Header */}
              <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow">
                    {categoria === "UNIFORME" && <HardHat className="w-4 h-4" />}
                    {categoria === "HERRAMIENTAS" && <Wrench className="w-4 h-4" />}
                    {categoria === "MATERIALES" && <PackageCheck className="w-4 h-4" />}
                    {categoria === "VEHICULOS" && <Truck className="w-4 h-4" />}
                    {categoria === "EQUIPOS" && <Cpu className="w-4 h-4" />}
                  </span>
                  <div>
                    <h4 className="font-extrabold text-sm tracking-wide">{categoria}</h4>
                    <span className="text-[10px] text-slate-400">
                      {cumplidosCat} de {catItems.length} conformes ({porcentajeCat}%)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      porcentajeCat >= 85
                        ? "bg-emerald-500/20 text-emerald-300"
                        : porcentajeCat >= 70
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-rose-500/20 text-rose-300"
                    }`}
                  >
                    {porcentajeCat}%
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="p-3 md:p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {catItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      item.cumple
                        ? "bg-emerald-50/40 border-emerald-200/80 hover:bg-emerald-50/70"
                        : "bg-rose-50/50 border-rose-200 hover:bg-rose-50/80"
                    }`}
                  >
                    {/* Top Row: Title + SÍ/NO Toggle */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => handleToggleCumple(item.id)}
                          className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-transform active:scale-90 cursor-pointer ${
                            item.cumple
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "bg-rose-600 text-white shadow-sm"
                          }`}
                          title="Alternar SÍ / NO"
                        >
                          {item.cumple ? "✓" : "✗"}
                        </button>
                        <span className="font-extrabold text-xs md:text-sm text-slate-900 truncate">
                          {item.nombre}
                        </span>
                      </div>

                      {/* SÍ / NO Quick Switch */}
                      <div className="flex items-center bg-white/90 p-0.5 rounded-xl border border-slate-200 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSetCumple(item.id, true)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                            item.cumple
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          SÍ
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetCumple(item.id, false)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                            !item.cumple
                              ? "bg-rose-600 text-white shadow-xs"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          NO
                        </button>
                      </div>
                    </div>

                    {/* CATEGORY SPECIFIC ROW CONTROLS */}

                    {/* 1. MATERIALES: Cantidad Input */}
                    {categoria === "MATERIALES" && (
                      <div className="mt-2 flex items-center gap-2 pt-2 border-t border-slate-200/60">
                        <label className="text-[11px] font-bold text-slate-600 shrink-0">
                          Cantidad:
                        </label>
                        <input
                          type="text"
                          value={item.cantidad !== undefined ? item.cantidad : ""}
                          onChange={(e) => handleCantidadChange(item.id, e.target.value)}
                          placeholder="ej. 50 PZ, 3 Rollos"
                          className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-medium"
                        />
                      </div>
                    )}

                    {/* 2. VEHICULOS: Estado (Bueno/Regular/Malo) + Cantidad */}
                    {categoria === "VEHICULOS" && (
                      <div className="mt-2 flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-slate-500">Estado:</span>
                          {(["BUENO", "REGULAR", "MALO"] as const).map((est) => (
                            <button
                              key={est}
                              type="button"
                              onClick={() => handleEstadoChange(item.id, est)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black cursor-pointer transition-all ${
                                item.estado === est
                                  ? est === "BUENO"
                                    ? "bg-emerald-600 text-white"
                                    : est === "REGULAR"
                                    ? "bg-amber-500 text-white"
                                    : "bg-rose-600 text-white"
                                  : "bg-white text-slate-500 hover:bg-slate-100"
                              }`}
                            >
                              {est[0]}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-slate-500">Cant:</span>
                          <input
                            type="text"
                            value={item.cantidad !== undefined ? item.cantidad : ""}
                            onChange={(e) => handleCantidadChange(item.id, e.target.value)}
                            placeholder="1"
                            className="w-12 px-1.5 py-0.5 text-xs text-center bg-white border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 font-bold"
                          />
                        </div>
                      </div>
                    )}

                    {/* 3. EQUIPOS: Cantidad + Scanner de Código de Barras + Series Chips */}
                    {categoria === "EQUIPOS" && (
                      <div className="mt-2 space-y-2 pt-2 border-t border-slate-200/60">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-700">Cantidad:</span>
                            <input
                              type="number"
                              min="0"
                              value={item.cantidad !== undefined ? item.cantidad : (item.series?.length || 0)}
                              onChange={(e) => handleCantidadChange(item.id, e.target.value)}
                              className="w-14 px-2 py-0.5 text-xs text-center font-black bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          {/* Scanner Trigger Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenScanner(item.id)}
                            className="px-2.5 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
                            title="Abrir lector de código de barras para este equipo"
                          >
                            <Barcode className="w-3.5 h-3.5" />
                            <span>Escanear Serie</span>
                          </button>
                        </div>

                        {/* Series Chips List */}
                        {item.series && item.series.length > 0 && (
                          <div className="flex flex-wrap gap-1 bg-white/70 p-2 rounded-xl border border-slate-200">
                            {item.series.map((serie) => (
                              <span
                                key={serie}
                                className="inline-flex items-center gap-1 bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border border-blue-200"
                              >
                                <Tag className="w-2.5 h-2.5 text-blue-700" />
                                {serie}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSerie(item.id, serie)}
                                  className="text-blue-500 hover:text-rose-600 ml-0.5 cursor-pointer"
                                  title="Eliminar serie"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Manual Serie Input Helper */}
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={manualSerieInputs[item.id] || ""}
                            onChange={(e) =>
                              setManualSerieInputs((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddManualSerie(item.id);
                              }
                            }}
                            placeholder="O escribe serie manual..."
                            className="w-full px-2 py-0.5 text-[11px] bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddManualSerie(item.id)}
                            className="p-1 bg-slate-800 text-white rounded-md hover:bg-slate-700 text-xs cursor-pointer shrink-0"
                            title="Agregar serie manual"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Observación input per item (Always readily accessible) */}
                    <div className="mt-2 pt-2 border-t border-slate-200/60">
                      <input
                        type="text"
                        value={item.observacion || ""}
                        onChange={(e) => handleObservacionChange(item.id, e.target.value)}
                        placeholder="Observación de este ítem (ej. desgastado, incompleto)..."
                        className="w-full px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. Evidencias Fotográficas de Validación */}
      <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-slate-800 text-sm md:text-base">
              5. Evidencias Fotográficas de Validación en Terreno
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2.5 py-1 rounded-full">
            Registro visual del supervisor
          </span>
        </div>

        <p className="text-xs text-slate-500">
          El supervisor debe registrar las evidencias fotográficas de validación para certificar que el técnico cumple con los implementos, herramientas en regla y vehículo en condiciones óptimas.
        </p>

        {/* 3 Photo Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Card 1: EPP e Implementos */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-gradient-to-b from-slate-50/50 to-white flex flex-col justify-between relative group hover:border-indigo-300 transition-all">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <HardHat className="w-4 h-4" />
                  </div>
                  <span className="font-extrabold text-xs text-slate-800">
                    Técnico con Implementos
                  </span>
                </div>
                {fotoEppUniforme ? (
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> Subida
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    Pendiente
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Foto de cuerpo completo con uniforme, EPP, chaleco, casco, guantes y calzado reglamentario.
              </p>
            </div>

            <div className="mt-3">
              {fotoEppUniforme ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 group/img bg-slate-900">
                  <img
                    src={fotoEppUniforme}
                    alt="EPP e Implementos"
                    className="w-full h-36 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setModalFotoPreview({
                          isOpen: true,
                          url: fotoEppUniforme,
                          titulo: "Foto: Técnico con Implementos y EPP",
                        })
                      }
                      className="p-2 rounded-lg bg-white/90 text-slate-800 hover:bg-white transition-all cursor-pointer"
                      title="Ver en grande"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFotoEppUniforme(null)}
                      className="p-2 rounded-lg bg-rose-600/90 text-white hover:bg-rose-600 transition-all cursor-pointer"
                      title="Eliminar foto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all">
                  <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  <span className="text-xs font-bold text-slate-700">Tomar / Subir Foto</span>
                  <span className="text-[10px] text-slate-400">JPG, PNG hasta 5MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) procesarFoto(file, setFotoEppUniforme);
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Card 2: Herramientas y Kit */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-gradient-to-b from-slate-50/50 to-white flex flex-col justify-between relative group hover:border-indigo-300 transition-all">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <span className="font-extrabold text-xs text-slate-800">
                    Herramientas & Kit de Fibra
                  </span>
                </div>
                {fotoHerramientas ? (
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> Subida
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    Pendiente
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Evidencia de maletín de herramientas, taladro, escalera, kit de fibra y medidores operativos.
              </p>
            </div>

            <div className="mt-3">
              {fotoHerramientas ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 group/img bg-slate-900">
                  <img
                    src={fotoHerramientas}
                    alt="Herramientas y Kit"
                    className="w-full h-36 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setModalFotoPreview({
                          isOpen: true,
                          url: fotoHerramientas,
                          titulo: "Foto: Herramientas y Kit de Fibra",
                        })
                      }
                      className="p-2 rounded-lg bg-white/90 text-slate-800 hover:bg-white transition-all cursor-pointer"
                      title="Ver en grande"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFotoHerramientas(null)}
                      className="p-2 rounded-lg bg-rose-600/90 text-white hover:bg-rose-600 transition-all cursor-pointer"
                      title="Eliminar foto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all">
                  <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  <span className="text-xs font-bold text-slate-700">Tomar / Subir Foto</span>
                  <span className="text-[10px] text-slate-400">JPG, PNG hasta 5MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) procesarFoto(file, setFotoHerramientas);
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Card 3: Carro Limpio & Rotulado */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-gradient-to-b from-slate-50/50 to-white flex flex-col justify-between relative group hover:border-indigo-300 transition-all">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                    <Truck className="w-4 h-4" />
                  </div>
                  <span className="font-extrabold text-xs text-slate-800">
                    Vehículo Limpio y Ordenado
                  </span>
                </div>
                {fotoCarroLimpio ? (
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> Subida
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    Pendiente
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Vista de la camioneta o moto limpia, con logotipos reglamentarios, orden interior y conos visibles.
              </p>
            </div>

            <div className="mt-3">
              {fotoCarroLimpio ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 group/img bg-slate-900">
                  <img
                    src={fotoCarroLimpio}
                    alt="Vehículo Limpio"
                    className="w-full h-36 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setModalFotoPreview({
                          isOpen: true,
                          url: fotoCarroLimpio,
                          titulo: "Foto: Vehículo Limpio y Rotulado",
                        })
                      }
                      className="p-2 rounded-lg bg-white/90 text-slate-800 hover:bg-white transition-all cursor-pointer"
                      title="Ver en grande"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFotoCarroLimpio(null)}
                      className="p-2 rounded-lg bg-rose-600/90 text-white hover:bg-rose-600 transition-all cursor-pointer"
                      title="Eliminar foto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="border-2 border-dashed border-slate-200 hover:border-teal-400 hover:bg-teal-50/40 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all">
                  <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-teal-600 transition-colors" />
                  <span className="text-xs font-bold text-slate-700">Tomar / Subir Foto</span>
                  <span className="text-[10px] text-slate-400">JPG, PNG hasta 5MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) procesarFoto(file, setFotoCarroLimpio);
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 6. Observaciones Generales y Acciones */}
      <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 space-y-4">
        <label className="block text-xs font-bold text-slate-700">
          6. Observaciones Generales del Supervisor
        </label>
        <textarea
          rows={3}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Escribe comentarios adicionales sobre el desempeño, compromiso o aspectos a corregir..."
          className="w-full px-3 py-2 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
        />

        {/* Feedback Alerts */}
        {saveSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ¡Ficha de supervisión guardada con éxito en la base de datos!
          </div>
        )}

        {saveError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            {saveError}
          </div>
        )}

        {/* Bottom Actions Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Exportar Excel</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Imprimir</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3.5 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restablecer</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-500 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "Guardando..." : "Guardar Supervisión en Terreno"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Barcode / QR Camera Scanner Modal */}
      {isScannerOpen && (
        <CameraBarcodeScannerModal
          isOpen={isScannerOpen}
          onClose={() => {
            setIsScannerOpen(false);
            setActiveScanningItemId(null);
          }}
          onScan={handleScanSerie}
          title="Escanear Código / Serie de Equipo"
          subtitle="Apunta la cámara al código de barras o número de serie de la ONT/Router"
        />
      )}

      {/* Full Photo Modal Preview */}
      {modalFotoPreview.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl space-y-3 p-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-800">{modalFotoPreview.titulo}</h4>
              <button
                type="button"
                onClick={() => setModalFotoPreview({ isOpen: false, url: "", titulo: "" })}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-hidden rounded-2xl flex items-center justify-center bg-slate-900">
              <img
                src={modalFotoPreview.url}
                alt="Vista previa"
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
