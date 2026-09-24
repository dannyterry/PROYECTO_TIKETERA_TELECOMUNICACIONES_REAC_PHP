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
  const [dni, setDni] = useState("");
  const [cuadrilla, setCuadrilla] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [hora, setHora] = useState(
    new Date().toTimeString().split(" ")[0].slice(0, 5)
  );
  const [lugarInspeccion, setLugarInspeccion] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [observaciones, setObservaciones] = useState("");

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
    if (ord.dni_tecnico) setDni(ord.dni_tecnico);
    if (ord.cuadrilla) setCuadrilla(ord.cuadrilla);
    if (ord.fecha_atencion) setFecha(ord.fecha_atencion);
    if (ord.distrito || ord.direccion) {
      setLugarInspeccion(
        `${ord.distrito ? ord.distrito + " - " : ""}${ord.direccion || ""}`
      );
    }
    if (ord.id_tecnico) {
      const match = tecnicosCombo.find((t) => t.id_tecnico === ord.id_tecnico);
      if (match) setSelectedTecnico(match);
    }
    setSearchOtTerm(`OT: ${ord.ot} | ${ord.cliente}`);
    setShowOtDropdown(false);
  };

  // Filtered Technicians
  const filteredTecnicos = useMemo(() => {
    if (!searchTermTecnico.trim()) return tecnicosCombo;
    const q = searchTermTecnico.toLowerCase();
    return tecnicosCombo.filter(
      (t) =>
        t.tecnico.toLowerCase().includes(q) ||
        t.dni.includes(q) ||
        t.cuadrilla.toLowerCase().includes(q)
    );
  }, [tecnicosCombo, searchTermTecnico]);

  // Handle Technician Selection
  const handleSelectTecnico = (t: TecnicoCombo) => {
    setSelectedTecnico(t);
    setTecnicoName(t.tecnico);
    setDni(t.dni || "");
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

  // Handle Item Toggle
  const handleToggleCumple = (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, cumple: !it.cumple } : it))
    );
  };

  const handleEstadoChange = (id: string, estado: any) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, estado } : it))
    );
  };

  const handleObservacionChange = (id: string, obs: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, observacion: obs } : it))
    );
  };

  const handleMarcarTodos = (cumple: boolean) => {
    setItems((prev) => prev.map((it) => ({ ...it, cumple })));
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
      dni: dni.trim() || undefined,
      cuadrilla: cuadrilla.trim() || undefined,
      tipo_inspeccion: selectedTipo,
      fecha,
      hora,
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

  // Export to Excel
  const handleExportExcel = () => {
    const headerRows = [
      ["CORPORACIÓN CÉSPEDES - FICHA DE SUPERVISIÓN DE TRABAJO EN CAMPO"],
      ["Tipo de Inspección:", selectedTipo, "Fecha:", fecha, "Hora:", hora],
      ["Técnico Evaluado:", tecnicoName, "DNI:", dni, "Cuadrilla:", cuadrilla],
      ["Lugar / Ubicación:", lugarInspeccion, "Supervisor:", supervisor],
      ["Cumplimiento:", `${scoreStats.porcentaje}%`, "Semáforo:", scoreStats.semaforo.toUpperCase()],
      [],
      ["CATEGORÍA", "ÍTEM", "CUMPLE (SÍ/NO)", "ESTADO", "OBSERVACIÓN"],
    ];

    const dataRows = items.map((it) => [
      it.categoria,
      it.nombre,
      it.cumple ? "SÍ" : "NO",
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
      {/* Top Template Switcher & Banner */}
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
              Auditoría en terreno de EPP, uniformes, herramientas calibradas, materiales, seguridad vial y equipos.
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
                  ? "bg-purple-600 text-white shadow-md shadow-purple-500/30 scale-102"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ordenamiento</span>
            </button>
          </div>
        </div>

        {/* Live Score Bar on Mobile/Desktop */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`w-4 h-4 rounded-full ${
                scoreStats.semaforo === "verde"
                  ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)] animate-pulse"
                  : scoreStats.semaforo === "amarillo"
                  ? "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)] animate-pulse"
                  : "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)] animate-pulse"
              }`}
            />
            <div>
              <span className="text-xs font-bold text-slate-200">
                Resultado de Inspección:{" "}
                <strong className="text-white text-sm">
                  {scoreStats.porcentaje}% ({scoreStats.cumplidos}/{scoreStats.total} cumplidos)
                </strong>
              </span>
              <span
                className={`ml-2 text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                  scoreStats.semaforo === "verde"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : scoreStats.semaforo === "amarillo"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                }`}
              >
                {scoreStats.semaforo === "verde" && "🟢 Conforme / En Regla"}
                {scoreStats.semaforo === "amarillo" && "🟡 Observado"}
                {scoreStats.semaforo === "rojo" && "🔴 No Conforme / Riesgo"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleMarcarTodos(true)}
              className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              ✓ Marcar Todos SÍ
            </button>
            <button
              type="button"
              onClick={() => handleMarcarTodos(false)}
              className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              ✗ Marcar Todos NO
            </button>
          </div>
        </div>
      </div>

      {/* 1. Header Information Box (Datos del Técnico & Orden) */}
      <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <h3 className="font-extrabold text-slate-800 text-sm md:text-base">
              1. Datos del Técnico y de la Inspección
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Plantilla Activa: <strong>{selectedTipo}</strong> ({items.length} ítems)
          </span>
        </div>

        {/* OT / Orden Fast Search Assistant */}
        <div ref={otContainerRef} className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-3.5 space-y-2 relative">
          <label className="block text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-blue-600" />
            Vincular con Orden de Trabajo (Jalar datos de OT / Cliente / Técnico automáticamente)
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchOtTerm}
              onChange={(e) => {
                setSearchOtTerm(e.target.value);
                setShowOtDropdown(true);
              }}
              onFocus={() => {
                if (ordenesResultados.length > 0) setShowOtDropdown(true);
              }}
              placeholder="Ingresa N° de OT (ej. 3463541), Ticket (ej. VTEXT-...), Pedido o Cliente..."
              className="w-full pl-9 pr-14 py-2 text-xs md:text-sm bg-white border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium text-slate-900"
            />
            <Search className="w-4 h-4 text-blue-400 absolute left-3 top-2.5" />
            <div className="absolute right-2.5 top-2 flex items-center gap-1">
              {isSearchingOt && (
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              )}
              {searchOtTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchOtTerm("");
                    setOrdenesResultados([]);
                    setShowOtDropdown(false);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Orders Autocomplete Dropdown */}
          {showOtDropdown && ordenesResultados.length > 0 && (
            <div className="absolute left-3.5 right-3.5 top-full mt-1 bg-white border border-blue-200 rounded-xl shadow-2xl max-h-56 overflow-y-auto z-50 divide-y divide-slate-100">
              {ordenesResultados.map((ord) => (
                <button
                  key={ord.id_orden}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectOrden(ord);
                  }}
                  className="w-full text-left p-2.5 hover:bg-blue-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs cursor-pointer"
                >
                  <div>
                    <div className="font-bold text-blue-900 flex items-center gap-2">
                      <span>OT: {ord.ot}</span>
                      {ord.ticket && (
                        <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.2 rounded font-mono">
                          {ord.ticket}
                        </span>
                      )}
                    </div>
                    <div className="text-slate-700 font-medium">{ord.cliente}</div>
                    <div className="text-[11px] text-slate-400">
                      {ord.distrito || ord.direccion || "Sin dirección"}
                    </div>
                  </div>
                  <div className="text-right sm:text-right">
                    <span className="text-slate-800 font-bold block">{ord.tecnico || "Sin Técnico"}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{ord.cuadrilla || ""}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Technician, Cuadrilla, DNI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Autocomplete Technician */}
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
                placeholder="Buscar por Nombre o DNI..."
                className="w-full pl-8 pr-16 py-2 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
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
                      setDni("");
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
                          DNI: {t.dni || "—"} · Cel: {t.celular || "—"}
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

          {/* DNI */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              DNI del Técnico
            </label>
            <input
              type="text"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="Número de documento"
              className="w-full px-3 py-2 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono"
            />
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
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              Ubicación / Lugar de Trabajo
            </label>
            <input
              type="text"
              value={lugarInspeccion}
              onChange={(e) => setLugarInspeccion(e.target.value)}
              placeholder="ej. Base San Juan / CTO 14 Surco"
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

      {/* 2. Dynamic Categories Navigation Bar (Touch-friendly for Mobile) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {[
          { id: "TODOS", label: `Todos (${items.length})`, icon: ClipboardCheck },
          { id: "UNIFORME", label: `Uniforme & EPP (${groupedItems.UNIFORME.length})`, icon: HardHat },
          { id: "HERRAMIENTAS", label: `Herramientas (${groupedItems.HERRAMIENTAS.length})`, icon: Wrench },
          { id: "MATERIALES", label: `Materiales (${groupedItems.MATERIALES.length})`, icon: PackageCheck },
          { id: "VEHICULOS", label: `Vehículo & Seguridad (${groupedItems.VEHICULOS.length})`, icon: Truck },
          ...(groupedItems.EQUIPOS.length > 0
            ? [{ id: "EQUIPOS", label: `Equipos (${groupedItems.EQUIPOS.length})`, icon: Cpu }]
            : []),
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFiltroCategoria(tab.id)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                filtroCategoria === tab.id
                  ? "bg-slate-900 text-white shadow-md"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Items Checklist Sections */}
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

              {/* Items Grid (Optimized for Mobile Touch) */}
              <div className="p-3 md:p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {catItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-2xl border transition-all ${
                      item.cumple
                        ? "bg-emerald-50/40 border-emerald-200/70 hover:bg-emerald-50"
                        : "bg-rose-50/50 border-rose-200 hover:bg-rose-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => handleToggleCumple(item.id)}
                          className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-transform active:scale-90 cursor-pointer ${
                            item.cumple
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "bg-rose-600 text-white shadow-sm"
                          }`}
                        >
                          {item.cumple ? "✓" : "✗"}
                        </button>
                        <span className="font-extrabold text-xs md:text-sm text-slate-900 truncate">
                          {item.nombre}
                        </span>
                      </div>

                      {/* State Pills: Bueno / Regular / Malo */}
                      <div className="flex items-center gap-1 shrink-0">
                        {(["BUENO", "REGULAR", "MALO"] as const).map((est) => (
                          <button
                            key={est}
                            type="button"
                            onClick={() => handleEstadoChange(item.id, est)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                              item.estado === est
                                ? est === "BUENO"
                                  ? "bg-emerald-600 text-white"
                                  : est === "REGULAR"
                                  ? "bg-amber-500 text-white"
                                  : "bg-rose-600 text-white"
                                : "bg-white/80 text-slate-500 hover:bg-white"
                            }`}
                          >
                            {est[0]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Observación input if not passing or noted */}
                    {(!item.cumple || item.observacion) && (
                      <div className="mt-2 pt-2 border-t border-slate-200/60">
                        <input
                          type="text"
                          value={item.observacion || ""}
                          onChange={(e) => handleObservacionChange(item.id, e.target.value)}
                          placeholder="Observación específica de este ítem..."
                          className="w-full px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Evidencias Fotográficas de Validación */}
      <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-slate-800 text-sm md:text-base">
              4. Evidencias Fotográficas de Validación en Terreno
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
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-black/5 aspect-4/3 flex items-center justify-center group/img">
                  <img
                    src={fotoEppUniforme}
                    alt="Técnico con Implementos"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setModalFotoPreview({
                          isOpen: true,
                          url: fotoEppUniforme,
                          titulo: "Foto del Técnico con Implementos y EPP",
                        })
                      }
                      className="p-2 bg-white/90 hover:bg-white text-slate-800 rounded-lg shadow text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Ver en grande"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFotoEppUniforme(null)}
                      className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Eliminar foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/50 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors aspect-4/3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-blue-700 text-center">
                    Tomar / Subir Foto EPP
                  </span>
                  <span className="text-[10px] text-slate-400">JPG, PNG (Auto comprimido)</span>
                  <input
                    type="file"
                    accept="image/*"
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

          {/* Card 2: Herramientas y Equipos */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-gradient-to-b from-slate-50/50 to-white flex flex-col justify-between relative group hover:border-indigo-300 transition-all">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <span className="font-extrabold text-xs text-slate-800">
                    Herramientas y Equipos
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
                Foto de maleta/caja de herramientas ordenadas, fusionadora, OTDR, peladoras y escaleras.
              </p>
            </div>

            <div className="mt-3">
              {fotoHerramientas ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-black/5 aspect-4/3 flex items-center justify-center group/img">
                  <img
                    src={fotoHerramientas}
                    alt="Herramientas y Equipos"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setModalFotoPreview({
                          isOpen: true,
                          url: fotoHerramientas,
                          titulo: "Foto de Herramientas y Equipos",
                        })
                      }
                      className="p-2 bg-white/90 hover:bg-white text-slate-800 rounded-lg shadow text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Ver en grande"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFotoHerramientas(null)}
                      className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Eliminar foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="border-2 border-dashed border-slate-300 hover:border-amber-500 bg-white hover:bg-amber-50/50 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors aspect-4/3">
                  <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-amber-700 text-center">
                    Tomar / Subir Herramientas
                  </span>
                  <span className="text-[10px] text-slate-400">JPG, PNG (Auto comprimido)</span>
                  <input
                    type="file"
                    accept="image/*"
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

          {/* Card 3: Carro Limpio y Ordenado */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-gradient-to-b from-slate-50/50 to-white flex flex-col justify-between relative group hover:border-indigo-300 transition-all">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Truck className="w-4 h-4" />
                  </div>
                  <span className="font-extrabold text-xs text-slate-800">
                    Carro Limpio y Ordenado
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
                Foto del vehículo de la cuadrilla limpio interior/exterior, stock ordenado, conos y extintor.
              </p>
            </div>

            <div className="mt-3">
              {fotoCarroLimpio ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-black/5 aspect-4/3 flex items-center justify-center group/img">
                  <img
                    src={fotoCarroLimpio}
                    alt="Carro Limpio y Ordenado"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setModalFotoPreview({
                          isOpen: true,
                          url: fotoCarroLimpio,
                          titulo: "Foto del Carro Limpio y Ordenado",
                        })
                      }
                      className="p-2 bg-white/90 hover:bg-white text-slate-800 rounded-lg shadow text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Ver en grande"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFotoCarroLimpio(null)}
                      className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Eliminar foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-white hover:bg-emerald-50/50 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors aspect-4/3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-emerald-700 text-center">
                    Tomar / Subir Carro Limpio
                  </span>
                  <span className="text-[10px] text-slate-400">JPG, PNG (Auto comprimido)</span>
                  <input
                    type="file"
                    accept="image/*"
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

      {/* 5. General Observations & Action Bar */}
      <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5">
            Observaciones Generales y Acuerdos con el Técnico:
          </label>
          <textarea
            rows={3}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Anotar compromisos de regularización de uniformes, reemplazo de herramientas dañadas o reposición de stock..."
            className="w-full px-3 py-2 text-xs md:text-sm border border-slate-300 rounded-2xl focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {saveSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ¡Ficha de Supervisión guardada con éxito en la base de datos!
          </div>
        )}

        {saveError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            {saveError}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex-1 sm:flex-none py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Exportar Excel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir Ficha
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="py-2.5 px-3 text-slate-400 hover:text-slate-600 text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
              title="Restablecer Ficha"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto py-3 px-8 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Guardando Ficha...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Guardar Ficha en Sistema
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal Preview Photo Full Size */}
      {modalFotoPreview.isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setModalFotoPreview({ isOpen: false, url: "", titulo: "" })}
        >
          <div
            className="bg-white rounded-3xl overflow-hidden max-w-3xl w-full shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="font-extrabold text-sm flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-400" />
                {modalFotoPreview.titulo}
              </span>
              <button
                type="button"
                onClick={() => setModalFotoPreview({ isOpen: false, url: "", titulo: "" })}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-4 bg-slate-950 flex items-center justify-center overflow-auto flex-1">
              <img
                src={modalFotoPreview.url}
                alt={modalFotoPreview.titulo}
                className="max-h-[70vh] w-auto rounded-xl object-contain shadow-lg"
              />
            </div>
            <div className="p-3 bg-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>Fotografía de verificación en campo</span>
              <button
                type="button"
                onClick={() => setModalFotoPreview({ isOpen: false, url: "", titulo: "" })}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
