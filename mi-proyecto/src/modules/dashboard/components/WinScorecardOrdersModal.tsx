import React, { useState, useEffect, useCallback } from "react";
import { API_URL } from "../../../config/api";
import {
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Clock,
  User,
  MapPin,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Copy,
  Check,
  Phone,
  Calendar,
} from "lucide-react";

interface OrderDetail {
  id_orden: number;
  numero: string;
  codigo_seguimiento: string;
  cliente: string;
  telefono: string;
  direccion: string;
  distrito: string;
  tecnico: string;
  id_tecnico: number;
  estado: string;
  tipo_trabajo: string;
  fecha_visita: string;
  fecha_solicitud: string;
  motivo_cancelacion?: string;
  motivo_regestion?: string;
  observaciones?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  desde: string;
  hasta: string;
  initialTipo?: "terminadas" | "canceladas" | "regestion" | "vtr" | "excluidas" | "todos";
  title?: string;
}

export const WinScorecardOrdersModal: React.FC<Props> = ({
  isOpen,
  onClose,
  desde,
  hasta,
  initialTipo = "todos",
  title = "Detalle de Órdenes - Scorecard WIN",
}) => {
  const [tipo, setTipo] = useState<string>(initialTipo);
  const [busqueda, setBusqueda] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [total, setTotal] = useState<number>(0);
  const [ordenes, setOrdenes] = useState<OrderDetail[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      let url = `${API_URL}/api/dashboard/win-scorecard/detalle?desde=${desde}&hasta=${hasta}&tipo=${tipo}&pagina=${page}&limite=25`;
      if (busqueda.trim()) {
        url += `&q=${encodeURIComponent(busqueda.trim())}`;
      }

      const res = await fetch(url);
      const json = await res.json();
      if (json && json.success) {
        setOrdenes(json.ordenes || []);
        setTotal(json.total || 0);
      }
    } catch (err) {
      console.error("Error al cargar detalle de órdenes WIN:", err);
    } finally {
      setLoading(false);
    }
  }, [isOpen, desde, hasta, tipo, busqueda, page]);

  useEffect(() => {
    if (isOpen) {
      setTipo(initialTipo);
      setPage(1);
    }
  }, [isOpen, initialTipo]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  if (!isOpen) return null;

  const totalPages = Math.ceil(total / 25) || 1;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getBadgeEstado = (estado: string, codSeg: string, tipoTrabajo: string) => {
    const isVtr = (codSeg && codSeg.startsWith("VTR-")) || (tipoTrabajo && tipoTrabajo.toUpperCase() === "REITERADA");
    if (isVtr) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-700 border border-rose-300">
          VTR REITERADA
        </span>
      );
    }
    if (estado === "Finalizada" || estado === "Liquidada") {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          {estado}
        </span>
      );
    }
    if (estado === "Cancelada") {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
          Cancelada
        </span>
      );
    }
    if (estado === "Regestión" || estado === "Regestion") {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
          Regestión
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
        {estado}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 text-[#FF5500] border border-orange-200 flex items-center justify-center shadow-2xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900">{title}</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FF5500] text-white">
                  WIN OFICIAL
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Período: <span className="font-bold text-slate-700">{desde}</span> al <span className="font-bold text-slate-700">{hasta}</span> • {total} órdenes encontradas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* CONTROLES / FILTROS TIPO Y BÚSQUEDA */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Pestañas de categoría */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
            {[
              { id: "todos", label: "Todas" },
              { id: "terminadas", label: "Terminadas (Efectivas)" },
              { id: "canceladas", label: "Canceladas" },
              { id: "regestion", label: "Regestión" },
              { id: "vtr", label: "VTR (Reiteradas)" },
              { id: "excluidas", label: "Excluidas" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTipo(t.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  tipo === t.id
                    ? "bg-[#FF5500] text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Input de Búsqueda */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por orden, cliente, tracking, técnico..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-[#FF5500]"
            />
          </div>
        </div>

        {/* LISTADO DE ÓRDENES */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-7 h-7 animate-spin text-[#FF5500]" />
              <p className="text-xs font-bold">Cargando órdenes del Scorecard WIN...</p>
            </div>
          ) : ordenes.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
              <AlertTriangle className="w-8 h-8 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">No se encontraron órdenes para este filtro</p>
              <p className="text-xs">Prueba cambiando la categoría o término de búsqueda.</p>
            </div>
          ) : (
            ordenes.map((ord) => {
              const isVtr = (ord.codigo_seguimiento && ord.codigo_seguimiento.startsWith("VTR-")) || (ord.tipo_trabajo && ord.tipo_trabajo.toUpperCase() === "REITERADA");
              return (
                <div
                  key={ord.id_orden}
                  className={`p-3.5 rounded-2xl border transition-all hover:shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    isVtr
                      ? "bg-rose-50/40 border-rose-200"
                      : ord.estado === "Cancelada"
                      ? "bg-slate-50/50 border-rose-100"
                      : ord.estado === "Regestión" || ord.estado === "Regestion"
                      ? "bg-amber-50/40 border-amber-200"
                      : "bg-white border-slate-200/80"
                  }`}
                >
                  {/* Columna Izquierda: Número, Tracking, Cliente y Dirección */}
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-900 font-mono">
                        #{ord.numero}
                      </span>
                      {ord.codigo_seguimiento && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-mono font-bold">
                          {ord.codigo_seguimiento}
                          <button
                            type="button"
                            onClick={() => handleCopy(ord.codigo_seguimiento)}
                            className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            title="Copiar código"
                          >
                            {copiedId === ord.codigo_seguimiento ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          </button>
                        </span>
                      )}
                      {getBadgeEstado(ord.estado, ord.codigo_seguimiento, ord.tipo_trabajo)}
                      {ord.tipo_trabajo && (
                        <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100 text-[10.5px] font-bold">
                          {ord.tipo_trabajo}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 truncate">
                      <span>{ord.cliente}</span>
                      {ord.telefono && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-500 font-normal">
                          <Phone size={11} className="text-slate-400" /> {ord.telefono}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
                      <MapPin size={12} className="shrink-0 text-slate-400" />
                      <span className="truncate">{ord.direccion || "Sin dirección"}</span>
                      {ord.distrito && <span className="font-bold text-slate-600">• {ord.distrito}</span>}
                    </div>

                    {/* Motivo de Cancelación o Regestión si aplica */}
                    {(ord.motivo_cancelacion || ord.motivo_regestion) && (
                      <div className="mt-1 p-2 rounded-xl bg-rose-50/80 border border-rose-200 text-[11px] text-rose-800">
                        <span className="font-bold">Motivo: </span>
                        {ord.motivo_cancelacion || ord.motivo_regestion}
                      </div>
                    )}
                  </div>

                  {/* Columna Derecha: Técnico y Fecha */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 gap-1 text-right">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <User size={13} className="text-slate-400" />
                      <span>{ord.tecnico}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                      <Calendar size={11} className="text-slate-400" />
                      <span>{ord.fecha_visita ? ord.fecha_visita.replace("T", " ").slice(0, 16) : "Sin fecha"}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER PAGINACIÓN */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">
            Página <span className="font-bold text-slate-800">{page}</span> de <span className="font-bold text-slate-800">{totalPages}</span> ({total} resultados)
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
            >
              Siguiente <ChevronRight size={14} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
