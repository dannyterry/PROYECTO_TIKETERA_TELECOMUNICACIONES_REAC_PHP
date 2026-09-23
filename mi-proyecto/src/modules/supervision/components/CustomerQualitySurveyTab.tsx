import React, { useState, useEffect, useMemo } from "react";
import {
  Star,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Save,
  RotateCcw,
  FileSpreadsheet,
  Printer,
  UserCheck,
  Phone,
  Calendar,
  Building,
  Hash,
  MessageSquare,
  Sparkles,
  HelpCircle,
  Search,
  Check,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  AuditoriaCalidadCliente,
  PreguntaCalidad,
  PREGUNTAS_CALIDAD_DEFAULT,
  TecnicoCombo,
  SupervisorCombo,
  OrdenBusqueda,
} from "../types/supervisionTypes";
import { supervisionService } from "../services/supervisionService";

interface CustomerQualitySurveyTabProps {
  onSaved?: () => void;
}

export const CustomerQualitySurveyTab: React.FC<CustomerQualitySurveyTabProps> = ({
  onSaved,
}) => {
  const [tecnicosCombo, setTecnicosCombo] = useState<TecnicoCombo[]>([]);
  const [supervisoresCombo, setSupervisoresCombo] = useState<SupervisorCombo[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);

  // Search Technicians
  const [searchTermTecnico, setSearchTermTecnico] = useState("");
  const [showTecnicoDropdown, setShowTecnicoDropdown] = useState(false);

  // Search Orders by OT / Ticket / Codigo de Pedido
  const [searchOtTerm, setSearchOtTerm] = useState("");
  const [ordenesResultados, setOrdenesResultados] = useState<OrdenBusqueda[]>([]);
  const [showOtDropdown, setShowOtDropdown] = useState(false);
  const [isSearchingOt, setIsSearchingOt] = useState(false);

  // Form State
  const [idOrden, setIdOrden] = useState<string>("");
  const [numeroTicket, setNumeroTicket] = useState<string>("");
  const [selectedTecnico, setSelectedTecnico] = useState<TecnicoCombo | null>(null);
  const [tecnicoName, setTecnicoName] = useState<string>("");
  const [cuadrilla, setCuadrilla] = useState<string>("");
  const [cliente, setCliente] = useState<string>("");
  const [telefono, setTelefono] = useState<string>("");
  const [distrito, setDistrito] = useState<string>("");
  const [fechaAtencion, setFechaAtencion] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [fechaAuditoria, setFechaAuditoria] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [auditor, setAuditor] = useState<string>("Control de Calidad");

  // Questions
  const [preguntas, setPreguntas] = useState<PreguntaCalidad[]>(
    JSON.parse(JSON.stringify(PREGUNTAS_CALIDAD_DEFAULT))
  );

  // Stars & Conformity
  const [calificacionEstrellas, setCalificacionEstrellas] = useState<number>(5);
  const [hoverEstrellas, setHoverEstrellas] = useState<number>(0);
  const [comentarioCliente, setComentarioCliente] = useState<string>("");
  const [estadoConformidad, setEstadoConformidad] = useState<
    "CONFORME" | "CON_OBSERVACIONES" | "NO_CONFORME"
  >("CONFORME");

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load Catalogs on mount
  useEffect(() => {
    const loadCatalogs = async () => {
      setLoadingCatalogs(true);
      try {
        const [tecnicos, supervisores] = await Promise.all([
          supervisionService.getTecnicosCombo(),
          supervisionService.getSupervisoresCombo(),
        ]);
        setTecnicosCombo(tecnicos);
        setSupervisoresCombo(supervisores);
        if (supervisores.length > 0 && auditor === "Control de Calidad") {
          setAuditor(supervisores[0].supervisor);
        }
      } catch (e) {
        console.error("Error al cargar catálogos:", e);
      } finally {
        setLoadingCatalogs(false);
      }
    };
    loadCatalogs();
  }, []);

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
    if (ord.id_orden) setIdOrden(String(ord.id_orden));
    if (ord.ot || ord.ticket) {
      setNumeroTicket(ord.ot ? `OT: ${ord.ot}${ord.ticket ? " / " + ord.ticket : ""}` : ord.ticket);
    }
    if (ord.cliente) setCliente(ord.cliente);
    if (ord.telefono) setTelefono(ord.telefono);
    if (ord.distrito) setDistrito(ord.distrito);
    if (ord.fecha_atencion) setFechaAtencion(ord.fecha_atencion);
    if (ord.tecnico) {
      setTecnicoName(ord.tecnico);
      setSearchTermTecnico(ord.tecnico);
    }
    if (ord.cuadrilla) setCuadrilla(ord.cuadrilla);
    if (ord.id_tecnico) {
      const match = tecnicosCombo.find((t) => t.id_tecnico === ord.id_tecnico);
      if (match) setSelectedTecnico(match);
    }

    setSearchOtTerm(`OT: ${ord.ot} | ${ord.cliente}`);
    setShowOtDropdown(false);
  };

  // Filter combo
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
    setCuadrilla(t.cuadrilla || "");
    setSearchTermTecnico(t.tecnico);
    setShowTecnicoDropdown(false);
  };

  // Group questions by dimension
  const groupedQuestions = useMemo(() => {
    const groups: { [key: string]: PreguntaCalidad[] } = {};
    preguntas.forEach((p) => {
      if (!groups[p.dimension_titulo]) {
        groups[p.dimension_titulo] = [];
      }
      groups[p.dimension_titulo].push(p);
    });
    return groups;
  }, [preguntas]);

  // Handle Question Answer Change
  const handleToggleRespuesta = (id: string, value: boolean) => {
    setPreguntas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, respuesta: value } : p))
    );
  };

  const handleObservacionChange = (id: string, obs: string) => {
    setPreguntas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, observacion: obs } : p))
    );
  };

  // Score Calculation
  const scoreStats = useMemo(() => {
    let cumplidos = 0;
    preguntas.forEach((p) => {
      if (p.id === "p3_3") {
        if (!p.respuesta) cumplidos++;
      } else {
        if (p.respuesta) cumplidos++;
      }
    });
    const porcentaje = Math.round((cumplidos / preguntas.length) * 100);
    return {
      cumplidos,
      total: preguntas.length,
      porcentaje,
    };
  }, [preguntas]);

  // Automatic adjustment of conformity suggestion based on score
  useEffect(() => {
    if (scoreStats.porcentaje === 100 && calificacionEstrellas >= 4) {
      setEstadoConformidad("CONFORME");
    } else if (scoreStats.porcentaje >= 70 && calificacionEstrellas >= 3) {
      setEstadoConformidad("CON_OBSERVACIONES");
    } else {
      setEstadoConformidad("NO_CONFORME");
    }
  }, [scoreStats.porcentaje, calificacionEstrellas]);

  // Reset Form
  const handleReset = () => {
    if (window.confirm("¿Deseas restablecer todas las respuestas del formulario?")) {
      setPreguntas(JSON.parse(JSON.stringify(PREGUNTAS_CALIDAD_DEFAULT)));
      setCliente("");
      setTelefono("");
      setDistrito("");
      setNumeroTicket("");
      setIdOrden("");
      setComentarioCliente("");
      setSearchOtTerm("");
      setCalificacionEstrellas(5);
      setEstadoConformidad("CONFORME");
      setSaveSuccess(false);
      setSaveError(null);
    }
  };

  // Save to DB
  const handleSave = async () => {
    if (!tecnicoName.trim()) {
      alert("Por favor selecciona o ingresa el nombre del técnico evaluado.");
      return;
    }
    if (!cliente.trim()) {
      alert("Por favor ingresa el nombre del cliente auditado.");
      return;
    }

    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    const payload: AuditoriaCalidadCliente = {
      id_orden: idOrden ? parseInt(idOrden, 10) : undefined,
      numero_ticket: numeroTicket.trim() || undefined,
      id_tecnico: selectedTecnico?.id_tecnico,
      tecnico: tecnicoName.trim(),
      cuadrilla: cuadrilla.trim() || undefined,
      cliente: cliente.trim(),
      telefono: telefono.trim() || undefined,
      distrito: distrito.trim() || undefined,
      fecha_atencion: fechaAtencion || undefined,
      fecha_auditoria: fechaAuditoria,
      auditor: auditor.trim() || "Control de Calidad",
      preguntas_json: preguntas,
      puntaje_porcentaje: scoreStats.porcentaje,
      calificacion_estrellas: calificacionEstrellas,
      comentario_cliente: comentarioCliente.trim() || undefined,
      estado_conformidad: estadoConformidad,
    };

    const res = await supervisionService.saveAuditoriaCalidad(payload);
    setSaving(false);

    if (res.success) {
      setSaveSuccess(true);
      if (onSaved) onSaved();
      setTimeout(() => setSaveSuccess(false), 5000);
    } else {
      setSaveError(res.message || "No se pudo guardar la auditoría.");
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const headerRows = [
      ["CORPORACIÓN CÉSPEDES - AUDITORÍA Y ENCUESTA DE CALIDAD AL CLIENTE"],
      ["Fecha de Auditoría:", fechaAuditoria, "Fecha de Atención:", fechaAtencion],
      ["Técnico:", tecnicoName, "Cuadrilla:", cuadrilla],
      ["Cliente:", cliente, "Teléfono:", telefono],
      ["Distrito:", distrito, "Ticket / OT:", numeroTicket],
      ["Auditor:", auditor, "Puntaje Obtenido:", `${scoreStats.porcentaje}%`],
      ["Calificación Estrellas:", `${calificacionEstrellas} / 5`, "Conformidad:", estadoConformidad],
      [],
      ["DIMENSIÓN", "PREGUNTA", "RESPUESTA", "OBSERVACIÓN"],
    ];

    const dataRows = preguntas.map((p) => [
      p.dimension_titulo,
      p.pregunta,
      p.respuesta ? "SÍ" : "NO",
      p.observacion || "",
    ]);

    const footerRows = [
      [],
      ["COMENTARIOS DEL CLIENTE / OBSERVACIONES ADICIONALES:"],
      [comentarioCliente || "Sin observaciones"],
    ];

    const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows, ...footerRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria_Calidad");
    const filename = `Encuesta_Calidad_${tecnicoName.replace(/\s+/g, "_")}_${fechaAuditoria}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Score Card */}
      <div className="bg-gradient-to-r from-teal-900 via-emerald-900 to-cyan-950 rounded-3xl p-5 md:p-7 text-white shadow-xl border border-teal-700/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-teal-300 text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Corporación Céspedes · Control de Calidad Post-Servicio
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">
              Auditoría y Encuesta de Calidad al Cliente
            </h2>
            <p className="text-teal-200/80 text-xs md:text-sm max-w-2xl leading-relaxed">
              Evaluación directa de la satisfacción del abonado en 4 dimensiones técnicas y operativas.
            </p>
          </div>

          {/* Quick Stats & Star Meter */}
          <div className="flex flex-wrap items-center gap-4 bg-black/30 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-white/10 self-start lg:self-auto">
            <div className="text-center pr-4 border-r border-white/15">
              <div className="text-[11px] text-teal-300 font-bold uppercase">Índice Calidad</div>
              <div className="text-2xl md:text-3xl font-black text-white">
                {scoreStats.porcentaje}%
              </div>
              <div className="text-[10px] text-teal-200/70">
                {scoreStats.cumplidos} de {scoreStats.total} criterios
              </div>
            </div>

            <div className="text-center">
              <div className="text-[11px] text-teal-300 font-bold uppercase mb-1">Satisfacción</div>
              <div className="flex items-center gap-1 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setCalificacionEstrellas(star)}
                    onMouseEnter={() => setHoverEstrellas(star)}
                    onMouseLeave={() => setHoverEstrellas(0)}
                    className="transition-transform hover:scale-125 focus:outline-none cursor-pointer"
                  >
                    <Star
                      className={`w-5 h-5 md:w-6 md:h-6 transition-colors ${
                        (hoverEstrellas || calificacionEstrellas) >= star
                          ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                          : "text-slate-500"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <div className="text-[10px] font-extrabold text-amber-300 mt-1">
                {calificacionEstrellas === 5 && "⭐ Excelente (5/5)"}
                {calificacionEstrellas === 4 && "👍 Bueno (4/5)"}
                {calificacionEstrellas === 3 && "😐 Regular (3/5)"}
                {calificacionEstrellas === 2 && "⚠️ Deficiente (2/5)"}
                {calificacionEstrellas === 1 && "❌ Muy Malo (1/5)"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Data & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Fast OT Search & Client Data */}
        <div className="space-y-6">
          {/* Fast Order Search Assistant */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-teal-200/80 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-teal-100">
              <Search className="w-4 h-4 text-teal-600" />
              <h3 className="font-extrabold text-slate-800 text-xs md:text-sm">
                Buscar por N° de OT / Ticket / Seguimiento
              </h3>
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchOtTerm}
                onChange={(e) => setSearchOtTerm(e.target.value)}
                onFocus={() => {
                  if (ordenesResultados.length > 0) setShowOtDropdown(true);
                }}
                placeholder="Escribe N° OT (ej. 3463541), Ticket o Cliente..."
                className="w-full pl-9 pr-8 py-2 text-xs md:text-sm bg-teal-50/40 border border-teal-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium text-slate-900"
              />
              <Search className="w-4 h-4 text-teal-500 absolute left-3 top-2.5" />
              {isSearchingOt && (
                <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin absolute right-3 top-2.5" />
              )}
            </div>

            {/* Orders Autocomplete Dropdown */}
            {showOtDropdown && ordenesResultados.length > 0 && (
              <div className="bg-white border border-teal-200 rounded-xl shadow-xl max-h-56 overflow-y-auto z-30 divide-y divide-slate-100">
                {ordenesResultados.map((ord) => (
                  <button
                    key={ord.id_orden}
                    type="button"
                    onClick={() => handleSelectOrden(ord)}
                    className="w-full text-left p-2.5 hover:bg-teal-50 transition-colors flex flex-col justify-between gap-1 text-xs cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-teal-900">OT: {ord.ot}</span>
                      <span className="text-slate-500 font-bold">{ord.tecnico}</span>
                    </div>
                    <div className="text-slate-800 font-semibold">{ord.cliente}</div>
                    <div className="text-[10px] text-slate-400">
                      {ord.distrito} · {ord.telefono}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Form Box */}
          <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <UserCheck className="w-5 h-5 text-teal-600" />
              <h3 className="font-extrabold text-slate-800 text-xs md:text-sm">
                Datos de la Auditoría & Técnico
              </h3>
            </div>

            {/* Technician Autocomplete */}
            <div className="relative">
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
                  className="w-full pl-8 pr-3 py-2 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium text-slate-800"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
              </div>

              {/* Autocomplete dropdown */}
              {showTecnicoDropdown && filteredTecnicos.length > 0 && (
                <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto divide-y divide-slate-50">
                  {filteredTecnicos.map((t) => (
                    <button
                      key={t.id_tecnico}
                      type="button"
                      onClick={() => handleSelectTecnico(t)}
                      className="w-full text-left px-3 py-2 hover:bg-teal-50 flex items-center justify-between text-xs transition-colors cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-slate-800">{t.tecnico}</div>
                        <div className="text-[10px] text-slate-400">
                          DNI: {t.dni || "—"} · Cel: {t.celular || "—"}
                        </div>
                      </div>
                      <span className="bg-teal-100 text-teal-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
                        {t.cuadrilla || "S/C"}
                      </span>
                    </button>
                  ))}
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
                className="w-full px-3 py-2 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
              />
            </div>

            {/* Client Info */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre del Cliente *
                </label>
                <input
                  type="text"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="ej. Juan Carlos Pérez"
                  className="w-full px-3 py-2 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Teléfono / Celular
                  </label>
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="999888777"
                    className="w-full px-3 py-2 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Distrito
                  </label>
                  <input
                    type="text"
                    value={distrito}
                    onChange={(e) => setDistrito(e.target.value)}
                    placeholder="ej. Surco / Chorrillos"
                    className="w-full px-3 py-2 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    N° Ticket / OT
                  </label>
                  <input
                    type="text"
                    value={numeroTicket}
                    onChange={(e) => setNumeroTicket(e.target.value)}
                    placeholder="TK-10829 o OT 346..."
                    className="w-full px-3 py-2 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Auditor / Evaluador
                  </label>
                  <select
                    value={auditor}
                    onChange={(e) => setAuditor(e.target.value)}
                    className="w-full px-3 py-2 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium bg-white"
                  >
                    {supervisoresCombo.map((sup) => (
                      <option key={sup.id_usuario} value={sup.supervisor}>
                        {sup.supervisor} ({sup.cargo || "Auditor"})
                      </option>
                    ))}
                    <option value="Control de Calidad">Control de Calidad (General)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fecha de Atención
                  </label>
                  <input
                    type="date"
                    value={fechaAtencion}
                    onChange={(e) => setFechaAtencion(e.target.value)}
                    className="w-full px-3 py-2 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fecha de Auditoría
                  </label>
                  <input
                    type="date"
                    value={fechaAuditoria}
                    onChange={(e) => setFechaAuditoria(e.target.value)}
                    className="w-full px-3 py-2 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* Conformity Selector */}
            <div className="pt-3 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Dictamen de Conformidad:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setEstadoConformidad("CONFORME")}
                  className={`py-2 px-1 text-xs font-bold rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    estadoConformidad === "CONFORME"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-md scale-102"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Conforme
                </button>
                <button
                  type="button"
                  onClick={() => setEstadoConformidad("CON_OBSERVACIONES")}
                  className={`py-2 px-1 text-xs font-bold rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    estadoConformidad === "CON_OBSERVACIONES"
                      ? "bg-amber-500 text-white border-amber-500 shadow-md scale-102"
                      : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  Con Obs.
                </button>
                <button
                  type="button"
                  onClick={() => setEstadoConformidad("NO_CONFORME")}
                  className={`py-2 px-1 text-xs font-bold rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    estadoConformidad === "NO_CONFORME"
                      ? "bg-rose-600 text-white border-rose-600 shadow-md scale-102"
                      : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  No Conforme
                </button>
              </div>
            </div>

            {/* Client Comments */}
            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Comentarios Directos del Abonado / Observaciones:
              </label>
              <textarea
                rows={3}
                value={comentarioCliente}
                onChange={(e) => setComentarioCliente(e.target.value)}
                placeholder="Observaciones dadas por el cliente durante la llamada o visita de auditoría..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 space-y-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-teal-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Guardando Encuesta...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar Encuesta en Sistema
                </>
              )}
            </button>

            {saveSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Auditoría guardada exitosamente en el historial.
              </div>
            )}

            {saveError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                {saveError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportExcel}
                className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Exportar Excel
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Imprimir Ficha
              </button>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="w-full py-1.5 text-slate-400 hover:text-slate-600 text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restablecer Formulario
            </button>
          </div>
        </div>

        {/* Right Column: 4 Dimensions Questionnaire */}
        <div className="lg:col-span-2 space-y-5">
          {Object.entries(groupedQuestions).map(([dimensionTitle, questions], groupIndex) => (
            <div
              key={dimensionTitle}
              className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden"
            >
              {/* Group Header */}
              <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-xl bg-teal-600 text-white font-black text-xs flex items-center justify-center shadow">
                    {groupIndex + 1}
                  </span>
                  <h4 className="font-extrabold text-xs md:text-sm tracking-wide">{dimensionTitle}</h4>
                </div>
                <span className="text-[10px] text-slate-300 font-bold bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">
                  {questions.filter((q) => (q.id === "p3_3" ? !q.respuesta : q.respuesta)).length}{" "}
                  / {questions.length} cumplidos
                </span>
              </div>

              {/* Questions List */}
              <div className="divide-y divide-slate-100 p-2 md:p-3 space-y-1">
                {questions.map((q) => {
                  const isNegativeCriterion = q.id === "p3_3"; // "¿Tiene dudas pendientes?"
                  const isPassing = isNegativeCriterion ? !q.respuesta : q.respuesta;

                  return (
                    <div
                      key={q.id}
                      className={`p-3.5 rounded-2xl transition-colors ${
                        isPassing ? "hover:bg-teal-50/40" : "bg-rose-50/50 hover:bg-rose-50 border border-rose-200/60"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 pr-2">
                          <p className="text-slate-900 font-bold text-xs md:text-sm leading-snug">
                            {q.pregunta}
                          </p>
                          {isNegativeCriterion && (
                            <span className="text-[11px] text-amber-700 font-semibold block mt-0.5">
                              (Nota: 'NO' indica que todo quedó 100% claro y sin dudas).
                            </span>
                          )}
                        </div>

                        {/* Interactive YES/NO Touch Buttons */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleToggleRespuesta(q.id, true)}
                            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                              q.respuesta
                                ? isNegativeCriterion
                                  ? "bg-amber-600 text-white shadow-md scale-105"
                                  : "bg-emerald-600 text-white shadow-md scale-105"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            SÍ
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleRespuesta(q.id, false)}
                            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                              !q.respuesta
                                ? isNegativeCriterion
                                  ? "bg-emerald-600 text-white shadow-md scale-105"
                                  : "bg-rose-600 text-white shadow-md scale-105"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            NO
                          </button>
                        </div>
                      </div>

                      {/* Optional Note / Observación per Question */}
                      {(!isPassing || q.observacion) && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200/60">
                          <input
                            type="text"
                            value={q.observacion || ""}
                            onChange={(e) => handleObservacionChange(q.id, e.target.value)}
                            placeholder="Detalle u observación específica sobre esta pregunta..."
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
