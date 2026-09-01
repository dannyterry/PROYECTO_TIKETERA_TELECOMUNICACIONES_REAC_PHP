import React, { useState, useEffect, useMemo } from "react";
import { Order } from "../types/Order";
import { getBadgeColorByStatus, getRowColorByStatus } from "../utils/statusColors";
import {
  X,
  User,
  History,
  Calendar,
  Phone,
  MapPin,
  FileText,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  ExternalLink,
  Loader2
} from "lucide-react";
import { getOrders } from "../services/orderService";

interface ClientHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  orders: Order[]; // Órdenes precargadas en memoria
  onViewTasks?: (order: Order) => void;
}

export const ClientHistoryModal: React.FC<ClientHistoryModalProps> = ({
  isOpen,
  onClose,
  clientName,
  orders,
  onViewTasks,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [dbOrders, setDbOrders] = useState<Order[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Normalizar nombre para coincidencia exacta
  const normalize = (str?: string) =>
    (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const targetKey = normalize(clientName);

  // 🚀 Consultar historial completo del cliente directamente en MySQL
  useEffect(() => {
    if (!isOpen || !clientName) return;
    let isMounted = true;
    setIsLoadingHistory(true);

    getOrders({ cliente: clientName })
      .then((res) => {
        if (isMounted && Array.isArray(res)) {
          setDbOrders(res);
        }
      })
      .catch((err) => {
        console.error("Error al consultar historial de cliente en BD:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingHistory(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, clientName]);

  // Combinar órdenes locales con las obtenidas de la base de datos (sin duplicados)
  const clientOrders = useMemo(() => {
    const map = new Map<string | number, Order>();

    // 1. Agregar órdenes locales que coincidan con el cliente
    orders
      .filter((o) => normalize(o.cliente) === targetKey)
      .forEach((o) => {
        const key = o.id || o.ticket || o.ot || Math.random();
        map.set(key, o);
      });

    // 2. Agregar órdenes traídas directamente de la base de datos
    dbOrders.forEach((o) => {
      const key = o.id || o.ticket || o.ot || Math.random();
      map.set(key, o);
    });

    return Array.from(map.values()).sort((a, b) => {
      const dateA = new Date(a.fecha || 0).getTime();
      const dateB = new Date(b.fecha || 0).getTime();
      return dateB - dateA; // Más recientes primero
    });
  }, [orders, dbOrders, targetKey]);

  if (!isOpen || !clientName) return null;

  // Datos representativos del cliente
  const latestOrder = clientOrders[0] || {};
  const totalVisitas = clientOrders.length;
  const finalizadas = clientOrders.filter((o) =>
    (o.status || "").toLowerCase().includes("finaliz") ||
    (o.status || "").toLowerCase().includes("liquid") ||
    (o.status || "").toLowerCase().includes("termin")
  ).length;
  const observadas = clientOrders.filter((o) =>
    (o.status || "").toLowerCase().includes("cancel") ||
    (o.status || "").toLowerCase().includes("observ") ||
    (o.status || "").toLowerCase().includes("regestion") ||
    (o.status || "").toLowerCase().includes("anulad")
  ).length;
  const enProceso = totalVisitas - finalizadas - observadas;

  // Filtrar órdenes por búsqueda interna dentro del modal
  const filteredList = clientOrders.filter((o) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (o.ticket || "").toLowerCase().includes(q) ||
      (o.ot || "").toLowerCase().includes(q) ||
      (o.tecnico || "").toLowerCase().includes(q) ||
      (o.tipoAveria || "").toLowerCase().includes(q) ||
      (o.fecha || "").toLowerCase().includes(q) ||
      (o.status || "").toLowerCase().includes(q) ||
      (o.observacionesAtencion || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[96vw] xl:max-w-7xl 2xl:max-w-[1450px] rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* HEADER */}
        <div className="bg-[#1e4b8a] text-white px-6 py-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
              <User size={22} className="text-pink-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white uppercase">
                  {clientName}
                </h3>
                {isLoadingHistory ? (
                  <span className="bg-white/20 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
                    <Loader2 size={12} className="animate-spin" /> Buscando en base de datos...
                  </span>
                ) : totalVisitas > 1 ? (
                  <span className="bg-pink-500/30 text-pink-200 border border-pink-400/40 text-[11px] font-black px-2.5 py-0.5 rounded-full">
                    {totalVisitas} Atenciones Registradas
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-blue-200 flex items-center gap-3 mt-0.5 font-medium">
                {latestOrder.dni && <span>DNI / RUC: <strong className="text-white">{latestOrder.dni}</strong></span>}
                {latestOrder.celular && (
                  <span className="flex items-center gap-1">
                    <Phone size={11} /> {latestOrder.celular}
                  </span>
                )}
                {latestOrder.distrito && (
                  <span className="flex items-center gap-1">
                    <MapPin size={11} /> {latestOrder.distrito}
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-blue-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* STATS & SEARCH BAR */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          {/* Tarjetas resumen */}
          <div className="flex items-center gap-3">
            <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-2">
              <History size={16} className="text-indigo-600" />
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block leading-none">Total Visitas</span>
                <span className="text-sm font-black text-slate-800">{totalVisitas}</span>
              </div>
            </div>

            <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-2">
              <CheckCircle2 size={16} className="text-sky-500" />
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block leading-none">Finalizadas</span>
                <span className="text-sm font-black text-sky-600">{finalizadas}</span>
              </div>
            </div>

            <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block leading-none">Canceladas / Re-gestión</span>
                <span className="text-sm font-black text-amber-600">{observadas}</span>
              </div>
            </div>
          </div>

          {/* Buscador dentro del historial */}
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar en el historial..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* TABLA HISTÓRICA */}
        <div className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-6 custom-scrollbar bg-slate-100/50">
          {filteredList.length > 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
                <thead className="bg-[#1e4b8a] text-white text-[10px] font-bold uppercase tracking-wider sticky top-0 z-10 shadow-xs">
                  <tr>
                    <th className="py-3 px-3.5">Fecha</th>
                    <th className="py-3 px-3.5">Ticket / OT</th>
                    <th className="py-3 px-3.5 min-w-[180px]">Tipo Avería / Motivo</th>
                    <th className="py-3 px-3.5 min-w-[150px]">Tipo de Trabajo</th>
                    <th className="py-3 px-3.5 min-w-[180px]">Técnico / Cuadrilla</th>
                    <th className="py-3 px-3.5 text-center">Horarios</th>
                    <th className="py-3 px-3.5 text-center">Estado</th>
                    <th className="py-3 px-3.5 min-w-[220px]">Observaciones de la Atención</th>
                    <th className="py-3 px-3.5 text-center sticky right-0 bg-[#1e4b8a] shadow-xs">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 text-slate-700">
                  {filteredList.map((item, idx) => {
                    const badgeClass = getBadgeColorByStatus(item.status);
                    const rowBg = getRowColorByStatus(item.status);

                    return (
                      <tr key={item.id || idx} className={`hover:bg-slate-50/80 transition-colors ${rowBg}`}>
                        
                        {/* Fecha */}
                        <td className="py-3 px-3.5 font-mono font-bold whitespace-nowrap text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-slate-400" />
                            <span>{item.fecha ? item.fecha.split(" ")[0].split("T")[0] : "-"}</span>
                          </div>
                        </td>

                        {/* Ticket & OT */}
                        <td className="py-3 px-3.5 font-mono whitespace-nowrap">
                          <div className="font-bold text-slate-900">{item.ticket}</div>
                          {item.ot && item.ot !== item.ticket && (
                            <div className="text-[10px] text-slate-500">OT: {item.ot}</div>
                          )}
                        </td>

                        {/* Tipo de Avería */}
                        <td className="py-3 px-3.5 font-medium text-slate-800 max-w-[260px] whitespace-normal">
                          <span className="line-clamp-2" title={item.tipoAveria}>
                            {item.tipoAveria || "-"}
                          </span>
                        </td>

                        {/* Tipo de Trabajo (Texto estático informativo sin desplegable) */}
                        <td className="py-3 px-3.5 font-semibold text-slate-800 whitespace-nowrap" title={item.tipoTrabajo || item.tipoTrabajoAsignado}>
                          {item.tipoTrabajo || item.tipoTrabajoAsignado || "-"}
                        </td>

                        {/* Técnico & Cuadrilla */}
                        <td className="py-3 px-3.5 max-w-[220px]">
                          <div className="font-bold text-slate-900 truncate" title={item.tecnico}>
                            {item.tecnico || "No asignado"}
                          </div>
                          {item.cuadrilla && (
                            <div className="text-[10px] text-slate-500 truncate" title={item.cuadrilla}>
                              {item.cuadrilla}
                            </div>
                          )}
                        </td>

                        {/* Horarios (En camino, Inicio, Fin) */}
                        <td className="py-3 px-3.5 text-center whitespace-nowrap font-mono text-[10px]">
                          <div>{item.horaEnCamino ? `🚗 ${item.horaEnCamino}` : ""}</div>
                          <div>{item.horaInicio ? `▶️ ${item.horaInicio}` : ""} {item.horaFin ? `⏹️ ${item.horaFin}` : ""}</div>
                          {item.tramo && item.tramo !== "-" && (
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded border border-slate-200 mt-0.5 inline-block">
                              {item.tramo}
                            </span>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${badgeClass}`}>
                            {item.status}
                          </span>
                        </td>

                        {/* Observaciones de la Atención */}
                        <td className="py-3 px-3.5 text-[11px] text-slate-600 max-w-[280px] whitespace-normal">
                          <span className="line-clamp-2" title={item.observacionesAtencion}>
                            {item.observacionesAtencion || "-"}
                          </span>
                        </td>

                        {/* Acciones */}
                        <td className="py-3 px-3.5 text-center whitespace-nowrap sticky right-0 bg-white/90 backdrop-blur-xs">
                          <button
                            type="button"
                            onClick={() => onViewTasks && onViewTasks(item)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold inline-flex items-center gap-1 transition-all shadow-2xs cursor-pointer active:scale-95"
                            title="Ver tareas y fotos de esta orden"
                          >
                            <Activity size={11} />
                            <span>Tareas</span>
                          </button>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-12 text-center border border-slate-200 text-slate-400">
              <History size={36} className="mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="font-bold text-sm text-slate-600">No se encontraron atenciones con los términos de búsqueda.</p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Mostrando <strong>{filteredList.length}</strong> de <strong>{totalVisitas}</strong> órdenes del historial del cliente.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
