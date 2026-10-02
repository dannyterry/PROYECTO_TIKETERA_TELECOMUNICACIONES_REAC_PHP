import React, { useState, useEffect, useMemo } from "react";
import { 
  ArrowRightLeft, 
  Search, 
  Filter, 
  RefreshCw, 
  Calendar, 
  User, 
  Package, 
  Layers, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Truck,
  Eye,
  X,
  FileSpreadsheet
} from "lucide-react";
import { API_URL } from "../../../config/api";

export const TechnicianTransfersTab: React.FC = () => {
  const [transferencias, setTransferencias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [buscar, setBuscar] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Modal de Detalle
  const [transferenciaSeleccionada, setTransferenciaSeleccionada] = useState<any | null>(null);

  const cargarTransferencias = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/inventario/transferencias/historial?`;
      const params = new URLSearchParams();
      if (filtroEstado !== "TODOS") params.append("estado", filtroEstado);
      if (fechaDesde) params.append("fecha_desde", fechaDesde);
      if (fechaHasta) params.append("fecha_hasta", fechaHasta);
      if (buscar.trim()) params.append("buscar", buscar.trim());

      const res = await fetch(url + params.toString());
      const data = await res.json();
      if (data.success) {
        setTransferencias(data.transferencias || []);
      }
    } catch (err) {
      console.error("Error al cargar historial de transferencias:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTransferencias();

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("stock_transfers_sync");
      bc.onmessage = (ev) => {
        if (ev?.data?.type === "TRANSFER_UPDATED") {
          cargarTransferencias();
        }
      };
    } catch {}

    const handleFocusOrVisibility = () => {
      if (document.visibilityState === "visible") {
        cargarTransferencias();
      }
    };
    window.addEventListener("focus", handleFocusOrVisibility);
    document.addEventListener("visibilitychange", handleFocusOrVisibility);

    return () => {
      if (bc) bc.close();
      window.removeEventListener("focus", handleFocusOrVisibility);
      document.removeEventListener("visibilitychange", handleFocusOrVisibility);
    };
  }, [filtroEstado, fechaDesde, fechaHasta]);

  // KPIs
  const kpis = useMemo(() => {
    const total = transferencias.length;
    const pendientes = transferencias.filter((t) => t.estado === "PENDIENTE").length;
    const aceptadas = transferencias.filter((t) => t.estado === "ACEPTADA").length;
    const rechazadas = transferencias.filter((t) => t.estado === "RECHAZADA" || t.estado === "CANCELADA").length;
    const totalSeries = transferencias
      .filter((t) => t.estado === "ACEPTADA")
      .reduce((acc, curr) => acc + (Number(curr.total_series) || 0), 0);

    return { total, pendientes, aceptadas, rechazadas, totalSeries };
  }, [transferencias]);

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "ACEPTADA":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "PENDIENTE":
        return "bg-amber-100 text-amber-900 border-amber-300 animate-pulse";
      case "RECHAZADA":
        return "bg-rose-100 text-rose-800 border-rose-300";
      case "CANCELADA":
        return "bg-slate-100 text-slate-700 border-slate-300";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  return (
    <div className="space-y-6">
      
      {/* CABECERA Y KPIS */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <ArrowRightLeft size={16} />
              </span>
              <span className="text-xs font-black uppercase tracking-widest text-indigo-400">
                Auditoría de Almacén & Campo
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Traspasos entre Técnicos
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Control en tiempo real de dotación transferida de técnico a técnico con impacto automático en Kardex.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={cargarTransferencias}
              disabled={loading}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* TARJETAS KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Traspasos</span>
            <div className="text-2xl font-black text-white mt-1">{kpis.total}</div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 backdrop-blur-xs">
            <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">🟡 Pendientes</span>
            <div className="text-2xl font-black text-amber-300 mt-1">{kpis.pendientes}</div>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5 backdrop-blur-xs">
            <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">🟢 Aceptadas</span>
            <div className="text-2xl font-black text-emerald-300 mt-1">{kpis.aceptadas}</div>
          </div>
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-3.5 backdrop-blur-xs">
            <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">📦 Equipos Traspasados</span>
            <div className="text-2xl font-black text-indigo-300 mt-1">{kpis.totalSeries} <span className="text-xs font-normal">und</span></div>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Buscador */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Buscar por código, técnico, DNI, serie..."
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && cargarTransferencias()}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Search size={14} className="absolute left-3 top-3 text-slate-400" />
        </div>

        {/* Filtro de Estado */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {["TODOS", "PENDIENTE", "ACEPTADA", "RECHAZADA"].map((est) => (
            <button
              key={est}
              type="button"
              onClick={() => setFiltroEstado(est)}
              className={`px-3 py-1.5 rounded-xl font-black text-xs border transition-all cursor-pointer whitespace-nowrap ${
                filtroEstado === est
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {est === "TODOS" ? "Todos los Estados" : est}
            </button>
          ))}
        </div>

        {/* Filtro de Fechas */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
            title="Desde"
          />
          <span className="text-slate-400 text-xs font-bold">-</span>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
            title="Hasta"
          />
        </div>

      </div>

      {/* TABLA DE REGISTROS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                <th className="p-3.5 pl-4">Código / Fecha</th>
                <th className="p-3.5">Técnico Emisor (Origen)</th>
                <th className="p-3.5">Técnico Receptor (Destino)</th>
                <th className="p-3.5 text-center">Items Traspasados</th>
                <th className="p-3.5 text-center">Estado</th>
                <th className="p-3.5 text-right pr-4">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-600" />
                    Cargando historial de traspasos...
                  </td>
                </tr>
              ) : transferencias.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold">
                    <ArrowRightLeft size={32} className="mx-auto mb-2 text-slate-300" />
                    No se encontraron registros de transferencias con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                transferencias.map((trf) => (
                  <tr key={trf.id_transferencia} className="hover:bg-slate-50/80 transition-colors">
                    
                    {/* Código / Fecha */}
                    <td className="p-3.5 pl-4">
                      <span className="font-mono font-black text-indigo-950 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-[11px] block w-fit mb-1">
                        {trf.codigo_transferencia}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium block">
                        📅 {trf.fecha_solicitud_fmt || trf.fecha_solicitud}
                      </span>
                    </td>

                    {/* Técnico Origen */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{trf.nombre_origen}</div>
                      <div className="text-[10.5px] text-slate-500 font-medium">
                        DNI: <span className="font-mono">{trf.dni_origen}</span> • {trf.cuadrilla_origen || "Sin cuadrilla"}
                      </div>
                    </td>

                    {/* Técnico Destino */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{trf.nombre_destino}</div>
                      <div className="text-[10.5px] text-slate-500 font-medium">
                        DNI: <span className="font-mono">{trf.dni_destino}</span> • {trf.cuadrilla_destino || "Sin cuadrilla"}
                      </div>
                    </td>

                    {/* Items */}
                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 font-bold text-[11px]">
                        <span>{trf.total_items || 0} mat.</span>
                        <span>•</span>
                        <span className="text-emerald-700 font-black">{trf.total_series || 0} series</span>
                      </span>
                    </td>

                    {/* Estado */}
                    <td className="p-3.5 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getEstadoBadge(trf.estado)}`}>
                        {trf.estado}
                      </span>
                      {trf.fecha_respuesta_fmt && (
                        <span className="block text-[9.5px] text-slate-400 mt-0.5 font-medium">
                          {trf.fecha_respuesta_fmt}
                        </span>
                      )}
                    </td>

                    {/* Acción */}
                    <td className="p-3.5 text-right pr-4">
                      <button
                        onClick={() => setTransferenciaSeleccionada(trf)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Eye size={13} />
                        <span>Detalles</span>
                      </button>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE DETALLES DE TRANSFERENCIA */}
      {transferenciaSeleccionada && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div>
                <span className="text-[10px] font-mono font-black uppercase text-indigo-300">
                  {transferenciaSeleccionada.codigo_transferencia}
                </span>
                <h3 className="text-base font-black">Detalle de Traspaso</h3>
              </div>
              <button
                onClick={() => setTransferenciaSeleccionada(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              
              {/* Emisor y Receptor */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Emisor (Salida)</span>
                  <div className="font-black text-slate-900">{transferenciaSeleccionada.nombre_origen}</div>
                  <div className="text-[10.5px] text-slate-600 font-medium">DNI: {transferenciaSeleccionada.dni_origen}</div>
                  <div className="text-[10px] text-slate-500 font-medium">{transferenciaSeleccionada.cuadrilla_origen}</div>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Receptor (Entrada)</span>
                  <div className="font-black text-slate-900">{transferenciaSeleccionada.nombre_destino}</div>
                  <div className="text-[10.5px] text-slate-600 font-medium">DNI: {transferenciaSeleccionada.dni_destino}</div>
                  <div className="text-[10px] text-slate-500 font-medium">{transferenciaSeleccionada.cuadrilla_destino}</div>
                </div>
              </div>

              {/* Motivo */}
              {transferenciaSeleccionada.motivo_transferencia && (
                <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                  <span className="text-[10px] font-black text-indigo-900 uppercase block mb-0.5">Motivo / Sustento:</span>
                  <p className="text-slate-800 italic font-medium">{transferenciaSeleccionada.motivo_transferencia}</p>
                </div>
              )}

              {/* Motivo Rechazo */}
              {transferenciaSeleccionada.motivo_rechazo && (
                <div className="bg-rose-50 p-3 rounded-xl border border-rose-200">
                  <span className="text-[10px] font-black text-rose-900 uppercase block mb-0.5">Motivo de Rechazo:</span>
                  <p className="text-rose-800 font-medium">{transferenciaSeleccionada.motivo_rechazo}</p>
                </div>
              )}

              {/* Lista de Items */}
              <div className="space-y-2">
                <h4 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                  <Package size={14} className="text-indigo-600" />
                  <span>Items y Equipos Traspasados:</span>
                </h4>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {(transferenciaSeleccionada.detalles || []).map((d: any, dIdx: number) => (
                    <div key={dIdx} className="p-2.5 bg-white flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800">{d.nombre_producto}</div>
                        {Number(d.es_serie) === 1 ? (
                          <div className="font-mono text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 w-fit mt-0.5">
                            SN: {d.numero_serie}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-500">Material Insumo</div>
                        )}
                      </div>
                      <div className="font-mono font-black text-xs text-slate-900">
                        {d.cantidad} {d.unidad_medida || "und"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                onClick={() => setTransferenciaSeleccionada(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
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
export default TechnicianTransfersTab;
