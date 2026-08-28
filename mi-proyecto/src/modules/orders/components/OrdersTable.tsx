import React, { useState, useMemo } from "react";
import { Order } from "../types/Order";
import { getRowColorByStatus, getBadgeColorByStatus } from "../utils/statusColors";
import { extractCuadrillaKey, extractCuadrillaMemberName } from "../utils/cuadrillaUtils";
import { mapTipificacionWinToTipoTrabajo, matchWithCatalog, TIPOS_TRABAJO_CATALOGO } from "../utils/tipoTrabajoMapper";
import { Phone, Copy, Check, Activity, Eye, ExternalLink, FileText, UserPlus, Users, Edit2, X, User } from "lucide-react";
import { LookerCardsAlertBanner } from "./LookerCardsAlertBanner";

interface OrdersTableProps {
  orders: Order[];
  isSearching?: boolean;
  tecnicosDisponibles?: string[];
  tiposTrabajoDisponibles?: string[];
  tasksProgressMap?: Record<string, { total: number; done: number; pct: number }>;
  onToggleInconcert?: (orderId: number) => void;
  onUpdateObservacionLlamada?: (orderId: number, value: string) => void;
  onUpdateObservacionesAtencion?: (orderId: number, value: string) => void;
  onAssignTechnician?: (orderId: number, technician: string) => void;
  onUpdateTipoTrabajo?: (orderId: number, tipoTrabajo: string) => void;
  onSelectOrder?: (order: Order) => void;
  onOpenLiquidar?: (order: Order) => void;
  onViewTasks?: (order: Order) => void;
  onViewClientHistory?: (clientName: string) => void;
  onViewStats?: (order: Order) => void;
}

/**
 * Genera la plantilla ordenada de la orden solicitada por el usuario
 */
const generarPlantillaOrden = (order: Order): string => {
  const fechaLimpia = order.fecha ? order.fecha.split(" ")[0].split("T")[0] : "-";
  return [
    `Fecha: ${fechaLimpia}`,
    `Celular: ${order.celular || "-"}`,
    `DNI: ${order.dni || "-"}`,
    `Número de Ticket: ${order.ticket || "-"}`,
    `Cliente: ${order.cliente || "-"}`,
    `Dirección: ${order.direccion || "-"}`,
    `Distrito: ${order.distrito || "-"}`,
    `CTO: ${order.cto || "-"}`,
    `Código de Pedido: ${order.codigoPedido || "-"}`,
    `OT: ${order.ot || "-"}`,
    `Técnico: ${order.tecnico || "-"}`,
    `Hora Asignación: ${order.horaAsignacion || "-"}`,
    `Tramo: ${order.tramo || "-"}`,
    `Cuadrilla: ${order.cuadrilla || "-"}`,
    `Tipo de Liquidación: ${order.tipoLiquidacion || order.motivoLiquidacion || order.motivoFinalizacion || "-"}`,
    `Tipo de Trabajo: ${order.tipoTrabajo || "-"}`,
    `Ancho de Banda: ${order.anchoBanda || "-"}`
  ].join("\n");
};

export const OrdersTable: React.FC<OrdersTableProps> = ({
  orders,
  isSearching = false,
  tecnicosDisponibles = [],
  tiposTrabajoDisponibles = [],
  tasksProgressMap = {},
  onToggleInconcert,
  onUpdateObservacionLlamada,
  onUpdateObservacionesAtencion,
  onAssignTechnician,
  onUpdateTipoTrabajo,
  onSelectOrder,
  onOpenLiquidar,
  onViewTasks,
  onViewClientHistory,
  onViewStats,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Estado para el modal de asignación dual de técnicos (T1 & T2)
  const [assigningOrder, setAssigningOrder] = useState<Order | null>(null);
  const [selectedT1, setSelectedT1] = useState<string>("");
  const [selectedT2, setSelectedT2] = useState<string>("");

  // 🚀 Lógica de Ordenamiento Inteligente:
  // 1. Si hay una BÚSQUEDA activa: Ordenar cronológicamente (Fecha y Hora: Antiguo arriba ➔ Más reciente abajo)
  // 2. Si es la vista NORMAL del grid: Mantener el orden alfabético por Técnico A-Z
  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      if (isSearching) {
        // Modo Búsqueda: Antiguo arriba ➔ Actual abajo (Fecha ASC, Hora ASC)
        const fechaA = (a.fecha || "").trim();
        const fechaB = (b.fecha || "").trim();
        if (fechaA && fechaB && fechaA !== fechaB) {
          return fechaA.localeCompare(fechaB);
        }

        const horaA = (a.horaInicio || a.horaAsignacion || a.horaEnCamino || a.tramo || "").trim();
        const horaB = (b.horaInicio || b.horaAsignacion || b.horaEnCamino || b.tramo || "").trim();
        if (horaA && horaB && horaA !== horaB) {
          return horaA.localeCompare(horaB);
        }

        return (a.cliente || "").localeCompare(b.cliente || "", "es");
      }

      // Modo Normal (Grid): Alfabético por Técnico (A-Z)
      const tecA = (a.tecnico || "").trim();
      const tecB = (b.tecnico || "").trim();

      // Órdenes con técnico primero, sin técnico al final
      if (tecA && !tecB) return -1;
      if (!tecA && tecB) return 1;

      if (tecA && tecB) {
        const comp = tecA.localeCompare(tecB, "es", { sensitivity: "base", numeric: true });
        if (comp !== 0) return comp;
      }

      // Desempate secundario por cuadrilla o cliente
      const cuadA = (a.cuadrilla || "").trim();
      const cuadB = (b.cuadrilla || "").trim();
      const cuadComp = cuadA.localeCompare(cuadB, "es", { numeric: true });
      if (cuadComp !== 0) return cuadComp;

      return (a.cliente || "").localeCompare(b.cliente || "", "es");
    });
  }, [orders, isSearching]);

  // Lista de técnicos ordenados alfabéticamente para selectores
  const sortedTecnicosDisponibles = useMemo(() => {
    return [...tecnicosDisponibles].sort((a, b) => a.localeCompare(b, "es"));
  }, [tecnicosDisponibles]);

  const openAssignModal = (order: Order) => {
    const rawTecs = (order.tecnico || "")
      .split(/\s*[\/,+]\s*|\s+y\s+/i)
      .map((t) => t.trim())
      .filter((t) => t && t !== "-- Seleccione --" && t !== "-" && t !== "-- Seleccionar --");
    setSelectedT1(rawTecs[0] || "");
    setSelectedT2(rawTecs[1] || "");
    setAssigningOrder(order);
  };

  const handleSaveAssignment = () => {
    if (!assigningOrder) return;
    let combined = "";
    if (selectedT1 && selectedT2) combined = `${selectedT1} / ${selectedT2}`;
    else if (selectedT1) combined = selectedT1;
    else if (selectedT2) combined = selectedT2;
    else combined = "";
    onAssignTechnician && onAssignTechnician(assigningOrder.id, combined);
    setAssigningOrder(null);
  };

  const copyToClipboard = (key: string, text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col">
      {/* 🚨 TARJETA / BANNER DE ALERTAS LOOKER STUDIO (3 TARJETAS + ZONAS SUR) */}
      <LookerCardsAlertBanner />

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto custom-scrollbar">
        <table className="w-full text-[11px] border-separate border-spacing-0 whitespace-nowrap">

          {/* CABECERA DE LA TABLA COMPACTA ESTILO EXCEL */}
          <thead className="sticky top-0 z-30 bg-[#1e4b8a] text-white shadow-xs">
            <tr>
              {/* 1. FECHA (Fija en Scroll Horizontal a left-0) */}
              <th className="sticky top-0 left-0 z-40 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-left border-b-2 border-slate-950 border-r border-blue-900 min-w-[85px] w-[85px]">
                Fecha
              </th>
              {/* 2 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-left border-b-2 border-slate-950">
                Celular
              </th>
              {/* 3 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-center border-b-2 border-slate-950">
                Llamada
              </th>
              {/* 4 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-left border-b-2 border-slate-950">
                Observación de Llamada
              </th>
              {/* 5 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-left border-b-2 border-slate-950">
                DNI
              </th>
              {/* 7 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-center border-b-2 border-slate-950">
                Acta
              </th>
              {/* 8 - Tareas */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-1.5 text-center border-b-2 border-slate-950">
                Tareas
              </th>
              {/* 9 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-left border-b-2 border-slate-950">
                Número de Ticket
              </th>
              {/* 10. CLIENTE (Fija en Scroll Horizontal a left-[85px]) */}
              <th className="sticky top-0 left-[85px] z-40 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2.5 text-left border-b-2 border-slate-950 border-r border-blue-800 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.3)] min-w-[200px]">
                Cliente
              </th>
              {/* 11 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-left border-b-2 border-slate-950">
                Dirección
              </th>
              {/* 12 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-left border-b-2 border-slate-950">
                Distrito
              </th>
              {/* 13 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-center border-b-2 border-slate-950">
                CTO
              </th>
              {/* 13.1 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-center border-b-2 border-slate-950">
                Código de Pedido
              </th>
              {/* 14 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-center border-b-2 border-slate-950">
                OT
              </th>
              {/* 16 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-center border-b-2 border-slate-950">
                Técnico
              </th>
              {/* 17 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-center border-b-2 border-slate-950">
                Asignación
              </th>
              {/* 18 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-center border-b-2 border-slate-950">
                Camino
              </th>
              {/* 19 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-center border-b-2 border-slate-950">
                Inicio
              </th>
              {/* 20 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-center border-b-2 border-slate-950">
                Fin
              </th>
              {/* 21 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-center border-b-2 border-slate-950">
                Tramo
              </th>
              {/* 22 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-center border-b-2 border-slate-950">
                Status
              </th>
              {/* 23 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-left border-b-2 border-slate-950">
                Cuadrilla
              </th>
              {/* 25 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-left border-b-2 border-slate-950">
                Tipo de Liquidación
              </th>
              {/* 26 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-left border-b-2 border-slate-950">
                Tipo de Trabajo
              </th>
              {/* 27 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-left border-b-2 border-slate-950">
                Observaciones de la Atención
              </th>
              {/* 28 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-center border-b-2 border-slate-950">
                Total Drop
              </th>
              {/* 29 */}
              <th className="sticky top-0 z-30 bg-[#1e4b8a] font-bold uppercase text-[10px] tracking-wider py-1.5 px-2 text-center border-b-2 border-slate-950">
                Ancho de Banda
              </th>
            </tr>
          </thead>

          {/* CUERPO DE LA TABLA CON COLOREADO COMPLETO POR ESTADO Y ORDEN ALFABÉTICO POR TÉCNICO */}
          <tbody>
            {sortedOrders.length > 0 ? (
              sortedOrders.map((order) => {
                const rowColorClass = getRowColorByStatus(order.status);
                const badgeColorClass = getBadgeColorByStatus(order.status);

                return (
                  <tr
                    key={order.id}
                    onClick={() => onSelectOrder && onSelectOrder(order)}
                    className={`transition-colors cursor-pointer ${rowColorClass}`}
                  >

                    {/* 1. Fecha (Fija en Scroll Horizontal a left-0) */}
                    <td className={`sticky left-0 z-20 py-1 px-2 font-mono font-bold text-[11px] ${rowColorClass} border-b border-slate-950 border-r border-slate-300/80 min-w-[85px] w-[85px]`}>
                      {order.fecha ? order.fecha.split(" ")[0].split("T")[0] : "-"}
                    </td>

                    {/* 2. Celular con botón de copiado para llamada (Celular + Cliente + Dirección) */}
                    <td className="py-1 px-2 font-mono text-[11px] border-b border-slate-950" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between gap-1">
                        {order.celular ? (
                          <span className="inline-flex items-center gap-1 font-semibold">
                            <Phone size={9} className="text-slate-500" />
                            {order.celular}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            const datosLlamada = [
                              order.celular,
                              order.cliente,
                              order.direccion
                            ].filter(Boolean).join(" - ");
                            copyToClipboard(`llamada-${order.id}`, datosLlamada, e);
                          }}
                          className={`p-0.5 rounded transition-all shrink-0 cursor-pointer ${copiedKey === `llamada-${order.id}`
                            ? "bg-slate-900 text-emerald-400 shadow-sm scale-105"
                            : "hover:bg-black/10 text-slate-500 hover:text-slate-800"
                            }`}
                          title={`Copiar datos para llamada:\n• Celular: ${order.celular || "-"}\n• Cliente: ${order.cliente || "-"}\n• Dirección: ${order.direccion || "-"}`}
                        >
                          {copiedKey === `llamada-${order.id}` ? (
                            <Check size={11} className="text-emerald-400 stroke-[3]" />
                          ) : (
                            <Copy size={11} />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* 3. Llamada Inconcert (Switch Interactivo) */}
                    <td className="py-1 px-2 text-center border-b border-slate-950" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onToggleInconcert && onToggleInconcert(order.id)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black transition-all cursor-pointer shadow-2xs ${order.inconcert
                          ? "bg-emerald-500 text-white hover:bg-emerald-600"
                          : "bg-rose-500 text-white hover:bg-rose-600"
                          }`}
                        title="Alternar estado de Inconcert (Sí / No)"
                      >
                        <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0"></span>
                        <span>{order.inconcert ? "Sí" : "No"}</span>
                      </button>
                    </td>

                    {/* 4. Observación de Llamada (Caja para llenar) */}
                    <td className="py-0.5 px-1.5 border-b border-slate-950" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        defaultValue={order.observacionLlamada || ""}
                        placeholder="Escribir observación..."
                        onBlur={(e) => onUpdateObservacionLlamada && onUpdateObservacionLlamada(order.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-44 h-6 text-[11px] font-medium bg-white/95 border border-slate-300 rounded px-1.5 py-0 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 shadow-2xs truncate"
                        title={order.observacionLlamada}
                      />
                    </td>

                    {/* 5. DNI */}
                    <td className="py-1 px-2 font-mono text-[11px] font-medium border-b border-slate-950">
                      {order.dni || "-"}
                    </td>

                    {/* 7. Acta (Muestra N° de Acta o Botón para abrir / auditar Acta WIN) */}
                    <td className="py-1 px-1.5 text-center border-b border-slate-950" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const s = (order.status || "").toUpperCase();
                        const isFinalizada =
                          s.includes("FINALIZ") ||
                          s.includes("LIQUID") ||
                          s.includes("TERMIN") ||
                          s.includes("CERRAD") ||
                          s.includes("FENIX");

                        if (order.acta) {
                          return (
                            <button
                              type="button"
                              onClick={() => onOpenLiquidar && onOpenLiquidar(order)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white/90 hover:bg-amber-50 text-amber-950 border border-amber-300 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                              title={`Acta N° ${order.acta}. Clic para ver / auditar acta.`}
                            >
                              <FileText size={10} className="text-amber-700" />
                              <span>{order.acta}</span>
                            </button>
                          );
                        }

                        if (onOpenLiquidar && isFinalizada) {
                          return (
                            <button
                              type="button"
                              onClick={() => onOpenLiquidar(order)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                              title="Llenar Acta de Servicio Técnico WIN y Liquidar Materiales"
                            >
                              <FileText size={10} className="text-amber-700" />
                              <span>Acta WIN</span>
                            </button>
                          );
                        }

                        return <span className="font-mono text-slate-400 font-bold text-[11px]">-</span>;
                      })()}
                    </td>

                    {/* 8. Tareas (Supervisión en Tiempo Real / Avance) */}
                    <td className="py-1 px-1.5 text-center border-b border-slate-950" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const rawStatus = (order.status || "").toLowerCase();
                        const isProcesadaOIniciada =
                          rawStatus.includes("inicia") ||
                          rawStatus.includes("camino") ||
                          rawStatus.includes("proceso") ||
                          rawStatus.includes("procesad");

                        const progress = tasksProgressMap?.[String(order.id)] ||
                          tasksProgressMap?.[String(order.ot || "")] ||
                          tasksProgressMap?.[String(order.ticket || "")] ||
                          tasksProgressMap?.[String(order.numeroOrden || "")];

                        // Si la orden está Procesada o Iniciada: mostrar botón con porcentaje de avance
                        if (isProcesadaOIniciada) {
                          const pct = progress && progress.total > 0 ? progress.pct : 0;
                          const done = progress && progress.total > 0 ? progress.done : 0;
                          const total = progress && progress.total > 0 ? progress.total : 0;

                          return (
                            <button
                              type="button"
                              onClick={() => onViewTasks && onViewTasks(order)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black font-mono shadow-2xs border tracking-tight transition-all cursor-pointer hover:scale-102 active:scale-95 whitespace-nowrap ${pct === 100
                                ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20"
                                : pct >= 50
                                  ? "bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/20"
                                  : "bg-amber-400 text-slate-950 border-amber-500 shadow-amber-500/20"
                                }`}
                              title={`En proceso: ${done}/${total} tareas completadas. Clic para ver tareas en vivo.`}
                            >
                              <span className="relative flex h-1.5 w-1.5 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current"></span>
                              </span>
                              <span>{total > 0 ? `${pct}% (${done}/${total})` : `${pct}%`}</span>
                            </button>
                          );
                        }

                        // Para órdenes que no están en proceso/iniciadas (Finalizadas, Pendientes, etc.)
                        return (
                          <button
                            type="button"
                            onClick={() => onViewTasks && onViewTasks(order)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-slate-600 hover:text-indigo-700 bg-slate-100/90 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                            title="Clic para ver tareas"
                          >
                            <Activity size={10} className="text-slate-400" />
                            <span>Tareas</span>
                          </button>
                        );
                      })()}
                    </td>

                    {/* 9. Número de Ticket con botón de copiar */}
                    <td className="py-1 px-2 font-mono font-bold border-b border-slate-950">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-900 font-bold">{order.ticket}</span>
                        <button
                          type="button"
                          onClick={(e) => copyToClipboard(`ticket-${order.id}`, order.ticket, e)}
                          className={`p-0.5 rounded transition-all cursor-pointer ${copiedKey === `ticket-${order.id}`
                            ? "bg-slate-900 text-emerald-400 shadow-sm scale-105"
                            : "hover:bg-black/10 text-slate-600"
                            }`}
                          title="Copiar Ticket"
                        >
                          {copiedKey === `ticket-${order.id}` ? (
                            <Check size={11} className="text-emerald-400 stroke-[3]" />
                          ) : (
                            <Copy size={11} />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* 10. Cliente (Fija en Scroll Horizontal a left-[85px]) */}
                    <td className={`sticky left-[85px] z-20 py-1 px-2.5 uppercase tracking-tight max-w-[260px] min-w-[200px] ${rowColorClass} border-b border-slate-950 border-r border-slate-300/80 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)]`}>
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 truncate">
                          {order.esReiterada ? (
                            <div
                              onClick={(e) => {
                                if (onViewClientHistory) {
                                  e.stopPropagation();
                                  onViewClientHistory(order.cliente);
                                }
                              }}
                              className="inline-flex items-center gap-1 bg-[#fce7ed] hover:bg-[#fbcfe8] text-[#881337] border border-[#f43f5e]/40 px-1.5 py-0.2 rounded font-black text-[10px] shadow-2xs truncate cursor-pointer transition-all hover:scale-102 active:scale-98"
                              title={`${order.cliente} - ⚠️ Cliente con historial (${order.totalOrdenesCliente} órdenes en el sistema). Clic para ver historial completo.`}
                            >
                              <span className="truncate">{order.cliente}</span>
                              {order.totalOrdenesCliente && order.totalOrdenesCliente > 1 && (
                                <span className="shrink-0 bg-[#881337] text-white text-[8px] px-1 py-0 rounded-full font-bold shadow-xs">
                                  {order.totalOrdenesCliente}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span
                              onClick={(e) => {
                                if (onViewClientHistory) {
                                  e.stopPropagation();
                                  onViewClientHistory(order.cliente);
                                }
                              }}
                              className="font-bold text-slate-900 truncate hover:text-indigo-600 hover:underline cursor-pointer"
                              title={`${order.cliente} - Clic para ver historial`}
                            >
                              {order.cliente}
                            </span>
                          )}
                        </div>

                        {/* ACCIONES DE COPIADO: 1. SOLO CLIENTE | 2. PLANTILLA COMPLETA */}
                        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {/* 1. Copiar solo nombre de cliente */}
                          <button
                            type="button"
                            onClick={(e) => copyToClipboard(`cliente-${order.id}`, order.cliente, e)}
                            className={`p-0.5 rounded transition-all cursor-pointer ${copiedKey === `cliente-${order.id}`
                              ? "bg-slate-900 text-emerald-400 shadow-sm scale-105"
                              : "hover:bg-black/10 text-slate-500 hover:text-slate-900"
                              }`}
                            title="Copiar Cliente"
                          >
                            {copiedKey === `cliente-${order.id}` ? (
                              <Check size={11} className="text-emerald-400 stroke-[3]" />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>

                          {/* 2. Copiar plantilla completa ordenada */}
                          <button
                            type="button"
                            onClick={(e) => copyToClipboard(`plantilla-${order.id}`, generarPlantillaOrden(order), e)}
                            className={`p-0.5 rounded transition-all cursor-pointer flex items-center gap-0.5 ${copiedKey === `plantilla-${order.id}`
                              ? "bg-slate-900 text-emerald-400 shadow-sm scale-105"
                              : "hover:bg-black/10 text-indigo-600 hover:text-indigo-900"
                              }`}
                            title="Copiar plantilla"
                          >
                            {copiedKey === `plantilla-${order.id}` ? (
                              <Check size={11} className="text-emerald-400 stroke-[3]" />
                            ) : (
                              <FileText size={11} />
                            )}
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* 11. Dirección con botón de copiar */}
                    <td className="py-1 px-2 max-w-[260px] text-slate-700 border-b border-slate-950" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-slate-800 font-medium" title={order.direccion}>
                          {order.direccion || "-"}
                        </span>
                        {order.direccion && (
                          <button
                            type="button"
                            onClick={(e) => copyToClipboard(`dir-${order.id}`, order.direccion || "", e)}
                            className={`p-0.5 rounded transition-all shrink-0 cursor-pointer ${copiedKey === `dir-${order.id}`
                              ? "bg-slate-900 text-emerald-400 shadow-sm scale-105"
                              : "hover:bg-black/10 text-slate-500 hover:text-slate-900"
                              }`}
                            title={`Copiar Dirección: ${order.direccion}`}
                          >
                            {copiedKey === `dir-${order.id}` ? (
                              <Check size={11} className="text-emerald-400 stroke-[3]" />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* 12. Distrito */}
                    <td className="py-1 px-2 text-slate-800 font-bold uppercase text-[10px] border-b border-slate-950">
                      {order.distrito || "-"}
                    </td>

                    {/* 13. CTO */}
                    <td className="py-1 px-1.5 text-center font-mono text-[11px] border-b border-slate-950">
                      {order.cto || "-"}
                    </td>

                    {/* 13.1. Código de Pedido con botón de copiar */}
                    <td className="py-1 px-1.5 text-center font-mono text-[11px] border-b border-slate-950">
                      <div className="flex items-center justify-center gap-1 font-bold">
                        <span>{order.codigoPedido || "-"}</span>
                        {order.codigoPedido && (
                          <button
                            type="button"
                            onClick={(e) => copyToClipboard(`pedido-${order.id}`, order.codigoPedido || "", e)}
                            className="p-0.5 rounded hover:bg-black/10 text-slate-600 transition-colors cursor-pointer"
                            title="Copiar Código de Pedido"
                          >
                            {copiedKey === `pedido-${order.id}` ? (
                              <Check size={11} className="text-emerald-700" />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* 14. OT con botón de copiar */}
                    <td className="py-1 px-1.5 text-center font-mono text-[11px] border-b border-slate-950">
                      <div className="flex items-center justify-center gap-1 font-bold">
                        <span>{order.ot || "-"}</span>
                        {order.ot && (
                          <button
                            type="button"
                            onClick={(e) => copyToClipboard(`ot-${order.id}`, order.ot || "", e)}
                            className="p-0.5 rounded hover:bg-black/10 text-slate-600 transition-colors cursor-pointer"
                            title="Copiar OT"
                          >
                            {copiedKey === `ot-${order.id}` ? (
                              <Check size={11} className="text-emerald-700" />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* 16. Técnico 1 y Técnico 2 con botón de copiado directo y asignación */}
                    <td className="py-1 px-1.5 max-w-[210px] border-b border-slate-950" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const rawTecs = (order.tecnico || "")
                          .split(/\s*[\/,+]\s*|\s+y\s+/i)
                          .map((t) => t.trim())
                          .filter((t) => t && t !== "-- Seleccione --" && t !== "-" && t !== "-- Seleccionar --");

                        if (rawTecs.length === 0) {
                          return (
                            <button
                              type="button"
                              onClick={() => openAssignModal(order)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] text-slate-500 hover:text-indigo-600 bg-slate-100/90 hover:bg-indigo-50 border border-dashed border-slate-300 hover:border-indigo-300 rounded transition-all cursor-pointer font-semibold shadow-2xs"
                              title="Clic para asignar Técnico 1 y Técnico 2"
                            >
                              <UserPlus size={11} className="text-slate-400" />
                              <span>+ Asignar</span>
                            </button>
                          );
                        }

                        const t1 = rawTecs[0];
                        const t2 = rawTecs[1];
                        const tecFull = `${t1}${t2 ? ` / ${t2}` : ''}`;

                        return (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openAssignModal(order)}
                              className="flex-1 min-w-0 text-left inline-flex items-center justify-between gap-1 px-1.5 py-0.5 text-[10px] bg-indigo-50/80 hover:bg-indigo-100/90 text-indigo-950 border border-indigo-200/90 hover:border-indigo-300 rounded transition-all cursor-pointer shadow-2xs group"
                              title="Clic para editar o cambiar técnicos asignados"
                            >
                              <div className="flex items-center gap-1 truncate font-medium">
                                <span className="text-[8px] font-black uppercase text-indigo-700 bg-indigo-200/70 px-1 py-0 rounded font-mono shrink-0">
                                  T1
                                </span>
                                <span className="truncate font-semibold text-slate-900">{t1}</span>
                                {t2 && (
                                  <>
                                    <span className="text-indigo-300 font-bold">/</span>
                                    <span className="text-[8px] font-black uppercase text-slate-700 bg-slate-200 px-1 py-0 rounded font-mono shrink-0">
                                      T2
                                    </span>
                                    <span className="truncate font-semibold text-slate-900">{t2}</span>
                                  </>
                                )}
                              </div>
                              <Edit2 size={10} className="text-indigo-400 group-hover:text-indigo-600 shrink-0 ml-1 opacity-70 group-hover:opacity-100" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => copyToClipboard(`tecnico-${order.id}`, tecFull, e)}
                              className={`p-0.5 rounded transition-all cursor-pointer shrink-0 ${copiedKey === `tecnico-${order.id}`
                                ? "bg-slate-900 text-emerald-400 shadow-sm scale-105"
                                : "hover:bg-black/10 text-slate-500 hover:text-slate-900"
                                }`}
                              title={`Copiar Técnico:\n${tecFull}`}
                            >
                              {copiedKey === `tecnico-${order.id}` ? (
                                <Check size={11} className="text-emerald-400 stroke-[3]" />
                              ) : (
                                <Copy size={11} />
                              )}
                            </button>
                          </div>
                        );
                      })()}
                    </td>

                    {/* 17. Hora Asignación (Clic para abrir panel de control de tiempos y cuadrilla) */}
                    <td
                      className="py-1 px-1.5 text-center font-mono text-[11px] cursor-pointer group border-b border-slate-950"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onViewStats) onViewStats(order);
                      }}
                      title="Clic para ver control de tiempos, demoras y gestión de cuadrilla"
                    >
                      <span className="inline-block px-1 py-0.2 rounded group-hover:bg-indigo-600 group-hover:text-white transition-all font-bold">
                        {order.horaAsignacion || "-"}
                      </span>
                    </td>

                    {/* 18. En Camino */}
                    <td
                      className="py-1 px-1.5 text-center font-mono text-[11px] cursor-pointer group border-b border-slate-950"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onViewStats) onViewStats(order);
                      }}
                      title="Clic para ver control de tiempos, demoras y gestión de cuadrilla"
                    >
                      <span className="inline-block px-1 py-0.2 rounded group-hover:bg-indigo-600 group-hover:text-white transition-all font-medium">
                        {order.horaEnCamino || "-"}
                      </span>
                    </td>

                    {/* 19. Inicio */}
                    <td
                      className="py-1 px-1.5 text-center font-mono text-[11px] cursor-pointer group border-b border-slate-950"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onViewStats) onViewStats(order);
                      }}
                      title="Clic para ver control de tiempos, demoras y gestión de cuadrilla"
                    >
                      <span className="inline-block px-1 py-0.2 rounded group-hover:bg-indigo-600 group-hover:text-white transition-all font-medium">
                        {order.horaInicio || "-"}
                      </span>
                    </td>

                    {/* 20. Fin */}
                    <td
                      className="py-1 px-1.5 text-center font-mono text-[11px] cursor-pointer group border-b border-slate-950"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onViewStats) onViewStats(order);
                      }}
                      title="Clic para ver control de tiempos, demoras y gestión de cuadrilla"
                    >
                      <span className="inline-block px-1 py-0.2 rounded group-hover:bg-indigo-600 group-hover:text-white transition-all font-medium">
                        {order.horaFin || "-"}
                      </span>
                    </td>

                    {/* 21. Tramo */}
                    <td
                      className="py-1 px-1.5 text-center font-mono text-[11px] font-bold cursor-pointer group border-b border-slate-950"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onViewStats) onViewStats(order);
                      }}
                      title="Clic para ver control de tiempos, demoras y gestión de cuadrilla"
                    >
                      <span className="inline-block px-1 py-0.2 rounded group-hover:bg-indigo-600 group-hover:text-white transition-all font-bold">
                        {order.tramo || "-"}
                      </span>
                    </td>

                    {/* 22. Status (Badge) */}
                    <td className="py-1 px-2 text-center border-b border-slate-950">
                      <span className={`inline-block px-2 py-0.2 rounded text-[9px] font-black uppercase tracking-wider ${badgeColorClass}`}>
                        {order.status}
                      </span>
                    </td>

                    {/* 23. Cuadrilla con botón de copiar (1 Sola Línea) */}
                    <td className="py-1 px-2 text-slate-800 font-medium max-w-[240px] border-b border-slate-950">
                      <div className="flex items-center justify-between gap-1">
                        {order.cuadrilla && order.cuadrilla !== "-" ? (
                          <div className="flex items-center gap-1 truncate min-w-0 pr-1 text-[11px]" title={order.cuadrilla}>
                            <span className="truncate font-black text-slate-950 uppercase tracking-tight shrink-0">
                              {extractCuadrillaKey(order.cuadrilla) || order.cuadrilla}
                            </span>
                            {extractCuadrillaMemberName(order.cuadrilla, order.tecnico) && (
                              <span
                                className="truncate text-[10px] font-bold text-slate-700 tracking-tight"
                                title={`Técnico: ${extractCuadrillaMemberName(order.cuadrilla, order.tecnico)}`}
                              >
                                &bull; {extractCuadrillaMemberName(order.cuadrilla, order.tecnico)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                        {order.cuadrilla && order.cuadrilla !== "-" && (
                          <button
                            type="button"
                            onClick={(e) => copyToClipboard(`cuad-${order.id}`, order.cuadrilla || "", e)}
                            className={`p-0.5 rounded transition-all cursor-pointer shrink-0 ${copiedKey === `cuad-${order.id}`
                              ? "bg-slate-900 text-emerald-400 font-bold shadow-xs scale-105"
                              : "hover:bg-black/10 text-slate-600"
                              }`}
                            title={`Copiar Cuadrilla: ${order.cuadrilla}`}
                          >
                            {copiedKey === `cuad-${order.id}` ? (
                              <Check size={11} className="text-emerald-400 stroke-[3]" />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* 25. Tipo de Liquidación (Traído de Detalle de Orden: Finalización / Cancelación / Regestión / Anulación) */}
                    <td
                      className="py-1 px-2 font-semibold text-slate-900 text-[10px] max-w-[240px] truncate border-b border-slate-950"
                      title={order.tipoLiquidacion || order.motivoLiquidacion || order.motivoFinalizacion || order.motivoCancelacion || order.motivoRegestion || order.motivoAnulacion || ""}
                    >
                      {(() => {
                        const liq = order.tipoLiquidacion || order.motivoLiquidacion || order.motivoFinalizacion || order.motivoCancelacion || order.motivoRegestion || order.motivoAnulacion || "";
                        return liq ? (
                          <span className="text-slate-900 font-bold tracking-tight">{liq}</span>
                        ) : (
                          <span className="text-slate-400 font-mono">-</span>
                        );
                      })()}
                    </td>

                    {/* 26. Tipo de Trabajo (Solo disponible en órdenes FINALIZADAS; en el resto en blanco / '-') */}
                    <td className="py-0.5 px-1.5 border-b border-slate-950" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const rawStatus = (order.status || "").toLowerCase().trim();
                        const isFinalizada = rawStatus.includes("finaliz") || rawStatus.includes("liquid") || rawStatus.includes("termin") || rawStatus.includes("cerrad") || rawStatus.includes("fenix");

                        // Si NO está finalizada (Agendada, Iniciada, En camino, Cancelada, Observada, etc.) -> En blanco / '-'
                        if (!isFinalizada) {
                          return (
                            <select
                              disabled
                              value=""
                              className="h-6 text-[10px] font-semibold bg-slate-100/70 border border-slate-200 rounded px-1.5 py-0 text-slate-400 cursor-not-allowed max-w-[180px] truncate select-none opacity-60"
                              title="Tipo de trabajo solo disponible en órdenes finalizadas"
                            >
                              <option value="">-</option>
                            </select>
                          );
                        }

                        // 1. Verificamos si la orden ya tiene un tipo manual válido del catálogo / tabla
                        const matchedManual = matchWithCatalog(order.tipoTrabajo, tiposTrabajoDisponibles);

                        // 2. Emparejado automático con motivo de liquidación / finalización / avería según tabla tipos_trabajo
                        const autoPaired = mapTipificacionWinToTipoTrabajo(
                          order.tipoLiquidacion ||
                          order.motivoLiquidacion ||
                          order.motivoFinalizacion ||
                          order.motivoCancelacion ||
                          order.motivoRegestion ||
                          order.motivoAnulacion,
                          `${order.tipoAveria || ""} ${order.tipoTrabajoAsignado || ""}`
                        );

                        let pairedValue = "";
                        if (matchedManual) {
                          pairedValue = matchedManual;
                        } else if (autoPaired) {
                          pairedValue = autoPaired;
                        } else {
                          pairedValue = order.tipoTrabajo || order.tipoTrabajoAsignado || "";
                        }

                        return (
                          <select
                            value={pairedValue}
                            onChange={(e) => onUpdateTipoTrabajo && onUpdateTipoTrabajo(order.id, e.target.value)}
                            className="h-6 text-[10px] font-semibold bg-white border border-slate-300 rounded px-1.5 py-0 focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-800 shadow-2xs max-w-[180px] truncate"
                          >
                            <option value="">-- Seleccionar --</option>
                            {tiposTrabajoDisponibles.map((tt) => (
                              <option key={tt} value={tt}>
                                {tt}
                              </option>
                            ))}
                            {pairedValue && !tiposTrabajoDisponibles.includes(pairedValue) && (
                              <option value={pairedValue}>
                                {pairedValue}
                              </option>
                            )}
                          </select>
                        );
                      })()}
                    </td>

                    {/* 27. Observaciones de la Atención (Caja para llenar) */}
                    <td className="py-0.5 px-1.5 border-b border-slate-950" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        defaultValue={order.observacionesAtencion || ""}
                        placeholder="Escribir observación..."
                        onBlur={(e) => onUpdateObservacionesAtencion && onUpdateObservacionesAtencion(order.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-44 h-6 text-[10px] font-medium bg-white/95 border border-slate-300 rounded px-1.5 py-0 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 shadow-2xs truncate"
                        title={order.observacionesAtencion}
                      />
                    </td>

                    {/* 28. Total Drop */}
                    <td className="py-1 px-1.5 text-center font-mono font-bold border-b border-slate-950">
                      {order.totalDrop ? `${order.totalDrop}m` : "-"}
                    </td>

                    {/* 29. Suscripción Ancho de Banda */}
                    <td className="py-1 px-1.5 text-center font-mono border-b border-slate-950">
                      {order.anchoBanda || "-"}
                    </td>

                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={27} className="text-center py-16 text-slate-400 bg-white">
                  No se encontraron órdenes con los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE ASIGNACIÓN DUAL DE TÉCNICOS (T1 & T2) */}
      {assigningOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setAssigningOrder(null)}
        >
          <div
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users size={16} className="text-indigo-600" />
                  Asignar Técnicos a la Orden
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Ticket #{assigningOrder.ticket || assigningOrder.id} &bull; {assigningOrder.cliente || "Cliente"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssigningOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Selector T1 */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 font-bold text-slate-800">
                  <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200 font-mono">
                    T1
                  </span>
                  Técnico 1 (Titular / Principal)
                </label>
                <select
                  value={selectedT1}
                  onChange={(e) => setSelectedT1(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Sin asignar (Ninguno) --</option>
                  {sortedTecnicosDisponibles.map((tec) => (
                    <option key={tec} value={tec} disabled={tec === selectedT2}>
                      {tec}
                    </option>
                  ))}
                  {selectedT1 && !sortedTecnicosDisponibles.includes(selectedT1) && (
                    <option value={selectedT1}>{selectedT1}</option>
                  )}
                </select>
              </div>

              {/* Selector T2 */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 font-bold text-slate-800">
                  <span className="text-[10px] font-black uppercase text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded border border-slate-300 font-mono">
                    T2
                  </span>
                  Técnico 2 (Auxiliar / Acompañante)
                </label>
                <select
                  value={selectedT2}
                  onChange={(e) => setSelectedT2(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Sin asignar (Ninguno) --</option>
                  {sortedTecnicosDisponibles.map((tec) => (
                    <option key={tec} value={tec} disabled={tec === selectedT1}>
                      {tec}
                    </option>
                  ))}
                  {selectedT2 && !sortedTecnicosDisponibles.includes(selectedT2) && (
                    <option value={selectedT2}>{selectedT2}</option>
                  )}
                </select>
              </div>

              {/* Vista previa */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Vista previa de asignación:
                </span>
                <div className="font-semibold text-slate-700 text-xs">
                  {selectedT1 && selectedT2 ? (
                    <span>{selectedT1} <strong className="text-indigo-600">/</strong> {selectedT2}</span>
                  ) : selectedT1 ? (
                    <span>{selectedT1}</span>
                  ) : selectedT2 ? (
                    <span>{selectedT2}</span>
                  ) : (
                    <span className="text-slate-400 italic">Sin técnicos asignados</span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setSelectedT1("");
                  setSelectedT2("");
                }}
                className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-medium transition-colors cursor-pointer"
              >
                Limpiar
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAssigningOrder(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignment}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
