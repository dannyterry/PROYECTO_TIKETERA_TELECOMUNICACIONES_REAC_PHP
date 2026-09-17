import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  X,
  Search,
  FileSpreadsheet,
  AlertCircle,
  Layers,
  Phone,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  RefreshCw,
} from "lucide-react";
import * as XLSX from "xlsx";
import { API_URL } from "../../../config/api";

interface OrderDetail {
  id_orden: number;
  numero: string;
  codigo_seguimiento?: string;
  cliente?: string;
  numero_documento?: string;
  telefono?: string;
  celular?: string;
  estado?: string;
  tecnico_asignado?: string;
  nombre_tecnico?: string;
  cuadrilla?: string;
  cuadrilla_tecnico?: string;
  tipo_trabajo?: string;
  tipo_trabajo_asignado?: string;
  motivo?: string;
  motivo_cancelacion?: string;
  motivo_finalizacion?: string;
  tipo_liquidacion?: string;
  fecha_solicitud?: string;
  fecha_visita?: string;
  hora_asignacion?: string;
  inicio_visita?: string;
  fecha_finalizacion?: string;
  fecha_creacion?: string;
  direccion?: string;
  distrito?: string;
  georeferencia?: string;
  cto?: string;
  ot?: string;
  codigo_pedido?: string;
}

interface ClassificationOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  classificationKey: string;
  periodLabel: string;
  fechaDesde?: string;
  fechaHasta?: string;
  accentColor?: string;
}

// Normalizador de texto sin tildes ni mayúsculas
const normalizeStr = (str?: string): string => {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

// Formateador inteligente de fecha/hora de visita
const formatFechaHora = (fechaStr?: string | null, horaStr?: string | null) => {
  if (!fechaStr && !horaStr) return "-";
  try {
    const raw = String(fechaStr || "").trim();
    if (!raw) return horaStr || "-";
    const dateObj = new Date(raw.includes("T") || raw.includes("Z") ? raw : raw.replace(" ", "T"));
    if (isNaN(dateObj.getTime())) {
      return `${raw} ${horaStr || ""}`.trim();
    }
    const dia = String(dateObj.getDate()).padStart(2, "0");
    const mes = String(dateObj.getMonth() + 1).padStart(2, "0");
    const anio = dateObj.getFullYear();
    const hora = horaStr || dateObj.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${dia}/${mes}/${anio} ${hora}`.trim();
  } catch {
    return `${fechaStr || ""} ${horaStr || ""}`.trim();
  }
};

// Función para obtener el Tipo de Finalización / Liquidación real (resultado final ejecutado)
const getTipoFinalizacion = (ord: OrderDetail): string => {
  return (
    ord.motivo_finalizacion ||
    ord.tipo_liquidacion ||
    ord.motivo_cancelacion ||
    ord.motivo ||
    ord.tipo_trabajo_asignado ||
    ord.tipo_trabajo ||
    "Sin especificar"
  ).trim();
};

// Función para obtener sombreado completo de la fila según su estado oficial
const getRowStylesByStatus = (estado?: string): string => {
  const norm = normalizeStr(estado);

  // 🔵 FINALIZADA, LIQUIDADA
  if (norm.includes("fin") || norm.includes("liquid") || norm.includes("termin") || norm.includes("cerrad")) {
    return "bg-[#deebf7]/85 hover:bg-[#cee2f3] text-slate-950 border-l-4 border-l-[#5b9bd5]";
  }

  // 🔴 CANCELADA
  if (norm.includes("cancel")) {
    return "bg-[#fee2e2]/85 hover:bg-[#fecaca] text-slate-950 border-l-4 border-l-rose-500";
  }

  // 🟡 REGESTIÓN, OBSERVADA
  if (norm.includes("regest") || norm.includes("observ") || norm.includes("suspend")) {
    return "bg-[#fff2cc]/90 hover:bg-[#fae7b4] text-slate-950 border-l-4 border-l-amber-500";
  }

  // ⚫ ANULADA
  if (norm.includes("anul")) {
    return "bg-[#f1f5f9] hover:bg-[#e2e8f0] text-slate-950 border-l-4 border-l-slate-600";
  }

  // 🟢 INICIADA, EN PROCESO, EN CAMINO
  if (norm.includes("inic") || norm.includes("camino") || norm.includes("proceso")) {
    return "bg-[#e2efda]/85 hover:bg-[#d5e8cd] text-slate-950 border-l-4 border-l-emerald-600";
  }

  // 🔘 AGENDADA, ASIGNADA, PENDIENTE
  if (norm.includes("agen") || norm.includes("asig") || norm.includes("pend")) {
    return "bg-white hover:bg-slate-50 text-slate-950 border-l-4 border-l-slate-300";
  }

  return "bg-white hover:bg-slate-50 text-slate-950 border-l-4 border-l-slate-300";
};

// Función para obtener clase de badge de estado
const getBadgeStyles = (estado?: string) => {
  const norm = normalizeStr(estado);
  if (norm.includes("fin") || norm.includes("liquid") || norm.includes("termin")) {
    return "bg-white/95 text-[#1f4e78] border-[#bdd7ee] shadow-2xs";
  }
  if (norm.includes("cancel")) {
    return "bg-white/95 text-[#991b1b] border-[#fca5a5] shadow-2xs";
  }
  if (norm.includes("regest") || norm.includes("observ")) {
    return "bg-white/95 text-[#833c0c] border-[#ffe699] shadow-2xs";
  }
  if (norm.includes("anul")) {
    return "bg-white/95 text-[#334155] border-[#cbd5e1] shadow-2xs";
  }
  if (norm.includes("inic") || norm.includes("camino") || norm.includes("proceso")) {
    return "bg-white/95 text-[#375623] border-[#a9d18e] shadow-2xs";
  }
  return "bg-white text-slate-800 border-slate-300 shadow-2xs";
};

export const ClassificationOrdersModal: React.FC<ClassificationOrdersModalProps> = ({
  isOpen,
  onClose,
  title,
  classificationKey,
  periodLabel,
  fechaDesde,
  fechaHasta,
  accentColor = "#5b9bd5",
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [ordenes, setOrdenes] = useState<OrderDetail[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [copiedTicket, setCopiedTicket] = useState<string | null>(null);
  const itemsPerPage = 50;

  // Cargar órdenes cuando se abre el modal
  const cargarOrdenes = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setCurrentPage(1);
    setSearchTerm("");
    setFiltroTipo("TODOS");

    try {
      const params = new URLSearchParams();
      if (fechaDesde) params.append("fechaDesde", fechaDesde);
      if (fechaHasta) params.append("fechaHasta", fechaHasta);

      const res = await fetch(`${API_URL}/ordenes?${params.toString()}`);
      if (!res.ok) throw new Error("Error al consultar órdenes");
      const data = await res.json();
      const rawList: OrderDetail[] = Array.isArray(data) ? data : data.ordenes || [];

      // Filtrar según classificationKey
      const keyNorm = normalizeStr(classificationKey);

      const filtered = rawList.filter((ord) => {
        const estNorm = normalizeStr(ord.estado);

        if (keyNorm === "total" || keyNorm === "todas" || keyNorm === "all") {
          return true;
        }

        if (keyNorm.includes("finaliz") || keyNorm.includes("liquid")) {
          return estNorm.includes("fin") || estNorm.includes("liquid");
        }

        if (keyNorm.includes("cancelad")) {
          return estNorm.includes("cancel");
        }

        if (keyNorm.includes("anulad")) {
          return estNorm.includes("anul");
        }

        if (keyNorm.includes("regestion")) {
          return estNorm.includes("regest");
        }

        if (keyNorm.includes("agendad") || keyNorm.includes("asignad")) {
          return estNorm.includes("agen") || estNorm.includes("asig");
        }

        if (keyNorm.includes("iniciad") || keyNorm.includes("proceso") || keyNorm.includes("camino")) {
          return estNorm.includes("inic") || estNorm.includes("proceso") || estNorm.includes("camino");
        }

        if (
          keyNorm.includes("observadas_canceladas") ||
          keyNorm.includes("observad") ||
          keyNorm.includes("no liquidadas")
        ) {
          return (
            estNorm.includes("cancel") ||
            estNorm.includes("anul") ||
            estNorm.includes("regest") ||
            estNorm.includes("observ") ||
            estNorm.includes("suspend")
          );
        }

        // Búsqueda directa exacta o parcial
        return estNorm.includes(keyNorm);
      });

      setOrdenes(filtered);
    } catch (err) {
      console.error("Error al cargar órdenes de la clasificación:", err);
      setOrdenes([]);
    } finally {
      setLoading(false);
    }
  }, [isOpen, fechaDesde, fechaHasta, classificationKey]);

  useEffect(() => {
    cargarOrdenes();
  }, [cargarOrdenes]);

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lista de tipos de finalización reales para sub-filtro desplegable
  const tiposFinalizacionDisponibles = useMemo(() => {
    const mapa = new Map<string, number>();
    ordenes.forEach((o) => {
      const t = getTipoFinalizacion(o);
      if (t) mapa.set(t, (mapa.get(t) || 0) + 1);
    });
    return Array.from(mapa.entries())
      .map(([tipo, count]) => ({ tipo, count }))
      .sort((a, b) => b.count - a.count || a.tipo.localeCompare(b.tipo));
  }, [ordenes]);

  // Filtrado reactivo por término de búsqueda y tipo de finalización
  const ordenesFiltradas = useMemo(() => {
    return ordenes.filter((ord) => {
      // 1. Subfiltro por tipo de finalización
      if (filtroTipo !== "TODOS") {
        const tipoFin = getTipoFinalizacion(ord);
        if (tipoFin !== filtroTipo) return false;
      }

      // 2. Búsqueda por texto
      if (!searchTerm.trim()) return true;
      const q = normalizeStr(searchTerm);

      const matchTicket = normalizeStr(ord.numero).includes(q) || normalizeStr(ord.codigo_seguimiento).includes(q);
      const matchCliente =
        normalizeStr(ord.cliente).includes(q) ||
        normalizeStr(ord.numero_documento).includes(q) ||
        normalizeStr(ord.telefono).includes(q) ||
        normalizeStr(ord.celular).includes(q);
      const matchTecnico =
        normalizeStr(ord.nombre_tecnico).includes(q) ||
        normalizeStr(ord.tecnico_asignado).includes(q) ||
        normalizeStr(ord.cuadrilla).includes(q) ||
        normalizeStr(ord.cuadrilla_tecnico).includes(q);
      const matchTipo =
        normalizeStr(ord.tipo_trabajo).includes(q) ||
        normalizeStr(ord.tipo_trabajo_asignado).includes(q) ||
        normalizeStr(ord.motivo).includes(q) ||
        normalizeStr(ord.motivo_cancelacion).includes(q) ||
        normalizeStr(ord.motivo_finalizacion).includes(q) ||
        normalizeStr(getTipoFinalizacion(ord)).includes(q);
      const matchLugar = normalizeStr(ord.distrito).includes(q) || normalizeStr(ord.direccion).includes(q);

      return matchTicket || matchCliente || matchTecnico || matchTipo || matchLugar;
    });
  }, [ordenes, searchTerm, filtroTipo]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(ordenesFiltradas.length / itemsPerPage));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return ordenesFiltradas.slice(start, start + itemsPerPage);
  }, [ordenesFiltradas, currentPage, itemsPerPage]);

  // Copiar Ticket al portapapeles
  const handleCopyTicket = (ticket: string) => {
    navigator.clipboard.writeText(ticket);
    setCopiedTicket(ticket);
    setTimeout(() => setCopiedTicket(null), 2000);
  };

  // Exportar a Excel
  const handleExportExcel = () => {
    if (ordenesFiltradas.length === 0) return;

    const dataExcel = ordenesFiltradas.map((ord, idx) => ({
      "N°": idx + 1,
      "TICKET": ord.numero || "-",
      "CÓDIGO SEGUIMIENTO": ord.codigo_seguimiento || "-",
      "ESTADO": ord.estado || "-",
      "TÉCNICO ASIGNADO": ord.nombre_tecnico || ord.tecnico_asignado || "-",
      "CUADRILLA": ord.cuadrilla || ord.cuadrilla_tecnico || "-",
      "CLIENTE": ord.cliente || "-",
      "DOCUMENTO": ord.numero_documento || "-",
      "TELÉFONO": ord.telefono || ord.celular || "-",
      "TIPO DE TRABAJO": ord.tipo_trabajo_asignado || ord.tipo_trabajo || "-",
      "MOTIVO / LIQUIDACIÓN": ord.motivo_finalizacion || ord.motivo_cancelacion || ord.motivo || ord.tipo_liquidacion || "-",
      "FECHA VISITA": ord.fecha_visita || ord.fecha_solicitud || ord.fecha_creacion || "-",
      "HORA ASIGNACIÓN": ord.hora_asignacion || ord.inicio_visita || "-",
      "DISTRITO": ord.distrito || "-",
      "DIRECCIÓN": ord.direccion || "-",
      "CTO": ord.cto || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(dataExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Órdenes");

    // Nombre de archivo limpio
    const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Reporte_${cleanTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-7xl max-h-[94vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─────────────────────────────────────────────────────────────
            1. HEADER DEL MODAL
        ───────────────────────────────────────────────────────────── */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">{title}</h2>
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-black text-white shadow-2xs"
                  style={{ backgroundColor: accentColor }}
                >
                  {ordenesFiltradas.length} {ordenesFiltradas.length === 1 ? "Orden" : "Órdenes"}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <span className="font-semibold text-slate-700">Período:</span> {periodLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={ordenesFiltradas.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              title="Descargar listado en Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar Excel</span>
            </button>

            <button
              type="button"
              onClick={() => cargarOrdenes()}
              disabled={loading}
              className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
              title="Refrescar lista"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-sky-600" : ""}`} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 transition-all cursor-pointer"
              title="Cerrar ventana (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            2. BARRA DE HERRAMIENTAS & BÚSQUEDA RÁPIDA
        ───────────────────────────────────────────────────────────── */}
        <div className="p-3 sm:p-4 bg-white border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por Ticket, Cliente, Técnico, Cuadrilla, Distrito..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Subfiltro Desplegable por Tipo de Finalización */}
          {tiposFinalizacionDisponibles.length > 0 && (
            <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 whitespace-nowrap">
                <Filter className="w-3.5 h-3.5 text-sky-600" />
                <span>Tipo de Finalización:</span>
              </label>
              <div className="relative flex-1 md:w-72">
                <select
                  value={filtroTipo}
                  onChange={(e) => {
                    setFiltroTipo(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-sky-400 font-bold text-slate-800 text-xs rounded-xl px-3 py-2 appearance-none focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs pr-8 cursor-pointer transition-all truncate"
                >
                  <option value="TODOS">
                    Todos los tipos ({ordenes.length})
                  </option>
                  {tiposFinalizacionDisponibles.map(({ tipo, count }) => (
                    <option key={tipo} value={tipo}>
                      {tipo} ({count})
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            3. CONTENIDO: TABLA PRINCIPAL DE ÓRDENES
        ───────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 bg-slate-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-sky-600" />
              <p className="text-sm font-bold text-slate-700">Cargando órdenes del período...</p>
            </div>
          ) : ordenesFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">No se encontraron órdenes</p>
              <p className="text-xs text-slate-500 max-w-sm">
                No hay órdenes que coincidan con la clasificación seleccionada o el filtro de búsqueda.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-100 shadow-xs border-b border-slate-200">
                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3.5 bg-slate-100 whitespace-nowrap"># Ticket</th>
                      <th className="py-3 px-3.5 bg-slate-100 whitespace-nowrap">Estado</th>
                      <th className="py-3 px-3.5 bg-slate-100 whitespace-nowrap">Técnico & Cuadrilla</th>
                      <th className="py-3 px-3.5 bg-slate-100 whitespace-nowrap">Cliente & Contacto</th>
                      <th className="py-3 px-3.5 bg-slate-100 whitespace-nowrap">Tipo de Finalización</th>
                      <th className="py-3 px-3.5 bg-slate-100 whitespace-nowrap">Fecha / Asignación</th>
                      <th className="py-3 px-3.5 bg-slate-100 whitespace-nowrap">Distrito & Dirección</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedOrders.map((ord) => {
                      const tecName = ord.nombre_tecnico || ord.tecnico_asignado || "Sin asignar";
                      const cuadrilla = ord.cuadrilla || ord.cuadrilla_tecnico || "-";
                      const tipoFin = getTipoFinalizacion(ord);
                      const badgeClass = getBadgeStyles(ord.estado);
                      const isCopied = copiedTicket === ord.numero;

                      const rowStyles = getRowStylesByStatus(ord.estado);

                      return (
                        <tr
                          key={ord.id_orden || ord.numero}
                          className={`transition-colors group border-b border-black/5 ${rowStyles}`}
                        >
                          {/* Ticket / Nro */}
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-slate-950">{ord.numero || "-"}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyTicket(ord.numero)}
                                className={`p-1 rounded-md transition-all ${
                                  isCopied
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "text-slate-500 hover:text-slate-900 hover:bg-white/80 opacity-0 group-hover:opacity-100"
                                }`}
                                title="Copiar número de ticket"
                              >
                                {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                            {ord.codigo_seguimiento && ord.codigo_seguimiento !== ord.numero && (
                              <span className="text-[10px] text-slate-600 font-mono block">
                                Cód: {ord.codigo_seguimiento}
                              </span>
                            )}
                          </td>

                          {/* Estado */}
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${badgeClass}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                              {ord.estado || "PENDIENTE"}
                            </span>
                          </td>

                          {/* Técnico & Cuadrilla */}
                          <td className="py-2.5 px-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-white/90 text-slate-800 border border-slate-300 font-black text-[9px] flex items-center justify-center shrink-0 uppercase shadow-2xs">
                                {tecName.slice(0, 2)}
                              </div>
                              <div className="min-w-0 max-w-[180px]">
                                <p className="font-black text-slate-950 truncate leading-tight" title={tecName}>
                                  {tecName}
                                </p>
                                <p className="text-[10px] text-slate-700 font-bold truncate">
                                  {cuadrilla !== "-" ? `Cuadrilla: ${cuadrilla}` : "Sin cuadrilla"}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Cliente & Contacto */}
                          <td className="py-2.5 px-3.5">
                            <div className="max-w-[200px]">
                              <p className="font-black text-slate-950 truncate" title={ord.cliente || "Sin cliente"}>
                                {ord.cliente || "Sin cliente"}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-700">
                                {ord.numero_documento && <span>Doc: {ord.numero_documento}</span>}
                                {(ord.celular || ord.telefono) && (
                                  <span className="flex items-center gap-0.5 text-slate-800 font-semibold">
                                    <Phone className="w-2.5 h-2.5 text-slate-500" />
                                    {ord.celular || ord.telefono}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Tipo de Finalización */}
                          <td className="py-2.5 px-3.5">
                            <div className="max-w-[240px]">
                              <span className="inline-block px-2 py-0.5 rounded-md bg-white/90 text-slate-900 border border-black/10 font-bold text-[10px] shadow-2xs" title={tipoFin}>
                                {tipoFin}
                              </span>
                              {ord.tipo_trabajo && ord.tipo_trabajo !== tipoFin && (
                                <p
                                  className="text-[10px] text-slate-600 truncate mt-0.5 font-medium"
                                  title={`Tipo Solicitado Original: ${ord.tipo_trabajo}`}
                                >
                                  Orig: {ord.tipo_trabajo}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Fecha / Asignación */}
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            <div className="text-slate-700 font-medium">
                              {formatFechaHora(ord.fecha_visita || ord.fecha_solicitud || ord.fecha_creacion, ord.hora_asignacion)}
                            </div>
                          </td>

                          {/* Distrito & Dirección */}
                          <td className="py-2.5 px-3.5">
                            <div className="max-w-[200px]">
                              <p className="font-bold text-slate-800 truncate">
                                {ord.distrito || "Distrito no especificado"}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate" title={ord.direccion || ""}>
                                {ord.direccion || "-"}
                              </p>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            4. FOOTER & PAGINACIÓN
        ───────────────────────────────────────────────────────────── */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0 text-xs">
          <div className="text-slate-600 font-medium text-center sm:text-left">
            Mostrando{" "}
            <span className="font-black text-slate-900">
              {ordenesFiltradas.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} -{" "}
              {Math.min(currentPage * itemsPerPage, ordenesFiltradas.length)}
            </span>{" "}
            de <span className="font-black text-slate-900">{ordenesFiltradas.length}</span> órdenes
            {ordenesFiltradas.length !== ordenes.length && ` (filtradas de ${ordenes.length} totales)`}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                title="Página anterior"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>

              <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-800">
                Pág. {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                title="Página siguiente"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
