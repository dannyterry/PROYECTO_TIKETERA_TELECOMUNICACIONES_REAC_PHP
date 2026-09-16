import React, { useState, useEffect, useCallback } from "react";
import { API_URL } from "../../../config/api";
import {
  X,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Calendar,
  User,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

interface WinAuditOrder {
  id_auditoria: number;
  id_orden: number;
  numero: string;
  codigo_seguimiento: string;
  cliente: string;
  fecha_visita: string;
  anio: number;
  mes: number;
  cuadrilla: string;
  tipo_trabajo_original: string;
  tipo_trabajo_asignado: string;
  motivo_finalizacion: string;
  producto: string;
  estado_original: string;
  categoria_win: 'AVERIAS' | 'POSTVENTA' | 'PEXT_EXCLUIDO' | 'ORDENAMIENTO_EXCLUIDO' | 'ANULADA_EXCLUIDA' | 'REGESTION_EXCLUIDA';
  es_asignada_win: number;
  es_finalizada_win: number;
  regla_aplicada: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialAnio: number;
  initialMes?: number | null;
  initialCategoria?: string;
}

export const WinAuditOrdersModal: React.FC<Props> = ({
  isOpen,
  onClose,
  initialAnio,
  initialMes = null,
  initialCategoria = "",
}) => {
  const [anio, setAnio] = useState<number>(initialAnio);
  const [mes, setMes] = useState<number | null>(initialMes);
  const [categoria, setCategoria] = useState<string>(initialCategoria);
  const [busqueda, setBusqueda] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [ordenes, setOrdenes] = useState<WinAuditOrder[]>([]);

  const mesesNombres = [
    "Todos los Meses", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/win-audit/ordenes?anio=${anio}&page=${page}&limit=20`;
      if (mes) url += `&mes=${mes}`;
      if (categoria) url += `&categoria=${categoria}`;
      if (busqueda) url += `&busqueda=${encodeURIComponent(busqueda)}`;

      const res = await fetch(url);
      const json = await res.json();
      if (json && json.success) {
        setOrdenes(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 1);
      }
    } catch (err) {
      console.error("Error al cargar órdenes auditadas:", err);
    } finally {
      setLoading(false);
    }
  }, [anio, mes, categoria, busqueda, page]);

  useEffect(() => {
    if (isOpen) {
      setAnio(initialAnio);
      setMes(initialMes);
      setCategoria(initialCategoria);
      setPage(1);
    }
  }, [isOpen, initialAnio, initialMes, initialCategoria]);

  useEffect(() => {
    if (isOpen) {
      fetchOrders();
    }
  }, [isOpen, fetchOrders]);

  if (!isOpen) return null;

  const getCategoriaBadge = (cat: string) => {
    switch (cat) {
      case 'AVERIAS':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">Avería</span>;
      case 'POSTVENTA':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">Postventa</span>;
      case 'PEXT_EXCLUIDO':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">PEXT (Excluida)</span>;
      case 'ORDENAMIENTO_EXCLUIDO':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">Ordenamiento (Excluida)</span>;
      case 'ANULADA_EXCLUIDA':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">Anulada (Excluida)</span>;
      case 'REGESTION_EXCLUIDA':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">Regestión (Excluida)</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{cat}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-6xl max-h-[92vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-md">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">
                  Capa de Auditoría WIN en Tiempo Real
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {total} órdenes registradas
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Visualización detallada de órdenes clasificadas según las 5 Reglas Maestras de Looker Studio WIN.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FILTROS */}
        <div className="p-4 border-b border-slate-100 bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Mes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Mes</label>
            <select
              value={mes || ""}
              onChange={(e) => {
                setMes(e.target.value ? parseInt(e.target.value, 10) : null);
                setPage(1);
              }}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {mesesNombres.map((nombre, idx) => (
                <option key={idx} value={idx === 0 ? "" : idx}>
                  {nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Categoría WIN */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Categoría WIN</label>
            <select
              value={categoria}
              onChange={(e) => {
                setCategoria(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todas las Categorías</option>
              <option value="AVERIAS">Averías</option>
              <option value="POSTVENTA">Postventa</option>
              <option value="PEXT_EXCLUIDO">PEXT (Excluida)</option>
              <option value="ORDENAMIENTO_EXCLUIDO">Ordenamiento (Excluida)</option>
              <option value="ANULADA_EXCLUIDA">Anulada (Excluida)</option>
              <option value="REGESTION_EXCLUIDA">Regestión (Excluida)</option>
            </select>
          </div>

          {/* Búsqueda */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Buscar OT / Ticket / Cliente / Cuadrilla</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Escribe OT, Ticket, nombre de cliente o cuadrilla..."
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* TABLA */}
        <div className="flex-1 overflow-auto bg-slate-50/30">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-xs font-bold text-slate-500">Cargando órdenes auditadas...</p>
            </div>
          ) : ordenes.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <Layers className="w-12 h-12 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-600">No se encontraron órdenes con estos filtros</p>
              <p className="text-xs text-slate-400 mt-1">Prueba seleccionando otro mes o borrando la búsqueda.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 text-slate-600 font-bold border-b border-slate-200 z-10 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">OT / Ticket</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Tipo / Motivo Original</th>
                  <th className="py-2.5 px-3">Cuadrilla</th>
                  <th className="py-2.5 px-3">Categoría WIN</th>
                  <th className="py-2.5 px-3 text-center">Asig. WIN</th>
                  <th className="py-2.5 px-3 text-center">Fin. WIN</th>
                  <th className="py-2.5 px-3">Regla Aplicada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 bg-white">
                {ordenes.map((ord) => (
                  <tr key={ord.id_auditoria} className="hover:bg-indigo-50/40 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{ord.numero || "-"}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{ord.codigo_seguimiento || "-"}</div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                      {ord.fecha_visita ? String(ord.fecha_visita).slice(0, 10) : "-"}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800 max-w-[160px] truncate" title={ord.cliente}>
                      {ord.cliente || "-"}
                    </td>
                    <td className="py-2.5 px-3 max-w-[200px]">
                      <div className="font-semibold text-slate-700 truncate" title={ord.tipo_trabajo_original}>
                        {ord.tipo_trabajo_original || "-"}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate" title={ord.motivo_finalizacion}>
                        {ord.motivo_finalizacion || ord.tipo_trabajo_asignado || "-"}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-[140px] truncate" title={ord.cuadrilla}>
                      {ord.cuadrilla || "-"}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {getCategoriaBadge(ord.categoria_win)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {ord.es_asignada_win ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Cuenta como Asignada" />
                      ) : (
                        <span className="inline-block w-2 h-2 rounded-full bg-slate-300" title="No cuenta" />
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {ord.es_finalizada_win ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Cuenta como Finalizada" />
                      ) : (
                        <span className="inline-block w-2 h-2 rounded-full bg-slate-300" title="No cuenta" />
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-mono text-slate-500">
                      {ord.regla_aplicada}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* FOOTER CON PAGINACIÓN */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs">
          <div className="text-slate-500 font-medium">
            Página <span className="font-bold text-slate-800">{page}</span> de <span className="font-bold text-slate-800">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
