import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Search,
  FileSpreadsheet,
  Calendar,
  Layers,
  FileText,
  User,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  Zap,
  ArrowDownRight,
  Package,
  QrCode,
  MapPin,
  RefreshCw,
} from "lucide-react";
import * as XLSX from "xlsx";
import { DescargaOrdenItem } from "../types/inventoryTypes";
import { getDescargasTecnicoDetalle } from "../services/inventoryService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  idTrabajador: number | null;
  tecnicoNombre: string;
  cuadrilla?: string;
  vehiculoPlaca?: string;
  idProducto?: number | null;
  productoNombre?: string;
  productoCodigo?: string;
  categoria?: string;
  esDrop?: boolean | number;
  cantidadEntregada?: number;
  cantidadGastada?: number;
  stockEnCarro?: number;
}

export const DischargeDetailModal: React.FC<Props> = ({
  isOpen,
  onClose,
  idTrabajador,
  tecnicoNombre,
  cuadrilla,
  vehiculoPlaca,
  idProducto,
  productoNombre,
  productoCodigo,
  categoria,
  esDrop,
  cantidadEntregada,
  cantidadGastada,
  stockEnCarro,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [descargas, setDescargas] = useState<DescargaOrdenItem[]>([]);
  const [filtroTexto, setFiltroTexto] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<string>("Todos");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !idTrabajador) return;

    let isMounted = true;
    setLoading(true);

    getDescargasTecnicoDetalle(idTrabajador, idProducto || undefined)
      .then((data) => {
        if (!isMounted) return;
        // Unir materiales y series asegurando 0 duplicados
        const rawList: DescargaOrdenItem[] = [
          ...(data.descargasMateriales || []),
          ...(data.descargasSeries || []),
        ];

        const seen = new Set<string>();
        const combinadas: DescargaOrdenItem[] = [];

        for (const item of rawList) {
          const key = item.numero_serie && item.numero_serie.trim()
            ? `serie_${item.id_producto || 0}_${item.numero_serie.trim().toUpperCase()}`
            : item.id_detalle_liq
              ? `det_${item.id_detalle_liq}`
              : `ord_${item.id_liquidacion || 0}_${item.id_producto || 0}_${item.cantidad || 0}`;

          if (!seen.has(key)) {
            seen.add(key);
            combinadas.push(item);
          }
        }

        // Ordenar descendentemente por fecha
        combinadas.sort((a, b) => {
          const dateA = new Date(a.fecha_liquidacion || 0).getTime();
          const dateB = new Date(b.fecha_liquidacion || 0).getTime();
          return dateB - dateA;
        });

        setDescargas(combinadas);
      })
      .catch((err) => {
        console.error("Error al cargar detalle de descargas:", err);
        if (isMounted) setDescargas([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, idTrabajador, idProducto]);

  // Manejo de tecla ESC para cerrar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Filtrado reactivo en memoria
  const descargasFiltradas = useMemo(() => {
    return descargas.filter((d) => {
      // Filtro de estado
      if (filtroEstado !== "Todos") {
        const est = (d.estado_liquidacion || "Pendiente").toUpperCase();
        if (filtroEstado === "Aprobada" && !est.includes("APROB")) return false;
        if (filtroEstado === "Pendiente" && !est.includes("PEND")) return false;
        if (filtroEstado === "Rechazada" && !est.includes("RECH")) return false;
      }

      // Filtro de texto
      if (!filtroTexto.trim()) return true;
      const q = filtroTexto.toLowerCase().trim();
      const matchOT = (d.orden_numero || "").toLowerCase().includes(q);
      const matchTicket = (d.ticket || "").toLowerCase().includes(q);
      const matchCliente = (d.cliente || "").toLowerCase().includes(q);
      const matchDir = (d.direccion || "").toLowerCase().includes(q);
      const matchDist = (d.distrito || "").toLowerCase().includes(q);
      const matchActa = (d.numero_acta || "").toLowerCase().includes(q);
      const matchGuia = (d.numero_guia || "").toLowerCase().includes(q);
      const matchSerie = (d.numero_serie || "").toLowerCase().includes(q);
      const matchTipo = (d.tipo_trabajo || "").toLowerCase().includes(q);
      const matchProd = (d.producto_nombre || "").toLowerCase().includes(q);

      return (
        matchOT ||
        matchTicket ||
        matchCliente ||
        matchDir ||
        matchDist ||
        matchActa ||
        matchGuia ||
        matchSerie ||
        matchTipo ||
        matchProd
      );
    });
  }, [descargas, filtroTexto, filtroEstado]);

  // Suma total descargada
  const sumaTotalConsumida = useMemo(() => {
    return descargas.reduce((acc, curr) => acc + (Number(curr.cantidad) || 1), 0);
  }, [descargas]);

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleExportExcel = () => {
    if (descargasFiltradas.length === 0) return;

    const dataToExport = descargasFiltradas.map((d, i) => ({
      "N°": i + 1,
      "TÉCNICO": tecnicoNombre,
      "CUADRILLA": cuadrilla || "S/C",
      "VEHÍCULO": vehiculoPlaca || "Sin móvil",
      "MATERIAL / EQUIPO": d.producto_nombre || productoNombre || "",
      "CÓDIGO": d.producto_codigo || productoCodigo || "",
      "N° PEDIDO (OT)": d.orden_numero,
      "TICKET": d.ticket,
      "CLIENTE": d.cliente,
      "DISTRITO": d.distrito,
      "DIRECCIÓN": d.direccion,
      "TIPO TRABAJO": d.tipo_trabajo,
      "N° ACTA": d.numero_acta || "-",
      "N° GUÍA": d.numero_guia || "-",
      "FECHA LIQUIDACIÓN": d.fecha_liquidacion ? new Date(d.fecha_liquidacion).toLocaleString("es-PE") : "-",
      "CANTIDAD DESCARGADA": Number(d.cantidad) || 1,
      "UNIDAD": esDrop ? "Metros" : "Unidades",
      "DROP INICIO": d.drop_inicio || "-",
      "DROP FIN": d.drop_fin || "-",
      "SERIE INSTALADA": d.numero_serie || "-",
      "ESTADO LIQUIDACIÓN": d.estado_liquidacion || "Pendiente",
      "LIQUIDADO POR": d.liquidado_por || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Descargas");

    const safeName = (productoNombre || "Materiales").replace(/[^a-zA-Z0-9]/g, "_");
    XLSX.writeFile(wb, `Descargas_${tecnicoNombre}_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (!isOpen) return null;

  const unidadTxt = esDrop ? "m" : "und";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 text-white flex items-center justify-between shrink-0 border-b border-slate-700">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-sky-400 flex items-center justify-center shadow-lg shadow-cyan-500/30 shrink-0">
              <Zap size={22} className="text-slate-950" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black tracking-tight truncate">
                  Auditoría de Descargas y Consumos por Orden / Acta
                </h3>
                {categoria && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-400/20 text-cyan-200 border border-cyan-400/30">
                    {categoria}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 font-medium flex items-center gap-2 mt-0.5 truncate">
                <User size={13} className="text-cyan-400 shrink-0" />
                <span className="font-bold text-white">{tecnicoNombre}</span>
                {cuadrilla && (
                  <>
                    <span className="text-slate-500">•</span>
                    <span className="text-cyan-200 font-bold">{cuadrilla}</span>
                  </>
                )}
                {vehiculoPlaca && (
                  <>
                    <span className="text-slate-500">•</span>
                    <Truck size={12} className="text-slate-400 shrink-0" />
                    <span className="font-mono text-slate-300">{vehiculoPlaca}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer shrink-0 ml-2"
            title="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* METRICS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50/90 border-b border-slate-200 shrink-0">
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Material / Item
            </span>
            <span className="text-xs font-black text-slate-900 block truncate mt-0.5" title={productoNombre || "Todos los materiales"}>
              {productoNombre || "Todos los materiales"}
            </span>
            {productoCodigo && (
              <span className="text-[10px] font-mono text-cyan-700 font-bold block">
                {productoCodigo}
              </span>
            )}
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              📦 Entregado (Historial)
            </span>
            <span className="text-sm font-black font-mono text-slate-900 block mt-0.5">
              {cantidadEntregada !== undefined ? cantidadEntregada : sumaTotalConsumida + (stockEnCarro || 0)} {unidadTxt}
            </span>
            <span className="text-[9.5px] text-slate-400 font-medium block">
              Despachado al técnico
            </span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-amber-200/80 bg-amber-50/30 shadow-2xs">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block flex items-center gap-1">
              <Zap size={11} className="text-amber-600" />
              ⚡ Descargado / Gastado
            </span>
            <span className="text-sm font-black font-mono text-amber-900 block mt-0.5">
              {sumaTotalConsumida} {unidadTxt}
            </span>
            <span className="text-[9.5px] text-amber-700/80 font-medium block">
              en {descargas.length} liquidaciones
            </span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-cyan-200/80 bg-cyan-50/30 shadow-2xs">
            <span className="text-[10px] font-bold text-cyan-800 uppercase tracking-wider block flex items-center gap-1">
              <Truck size={11} className="text-cyan-600" />
              🚗 Saldo en Móvil
            </span>
            <span className="text-sm font-black font-mono text-cyan-950 block mt-0.5">
              {stockEnCarro !== undefined ? stockEnCarro : Math.max(0, (cantidadEntregada || 0) - sumaTotalConsumida)} {unidadTxt}
            </span>
            <span className="text-[9.5px] text-cyan-700/80 font-medium block">
              Disponible en la camioneta
            </span>
          </div>
        </div>

        {/* TOOLBAR: SEARCH & FILTERS & EXCEL */}
        <div className="p-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                placeholder="Buscar por OT, Ticket, Cliente, Dirección, N° Acta, Serie..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all placeholder:text-slate-400"
              />
              {filtroTexto && (
                <button
                  type="button"
                  onClick={() => setFiltroTexto("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
              {["Todos", "Aprobada", "Pendiente", "Rechazada"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFiltroEstado(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    filtroEstado === st
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={descargasFiltradas.length === 0}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:cursor-not-allowed"
            >
              <FileSpreadsheet size={13} />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* BODY TABLE */}
        <div className="flex-1 overflow-y-auto min-h-[300px] scrollbar-thin">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <RefreshCw size={28} className="animate-spin text-cyan-600" />
              <span className="text-xs font-bold text-slate-600">
                Consultando liquidaciones y órdenes del técnico...
              </span>
            </div>
          ) : descargasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
              <FileText size={36} className="text-slate-300 stroke-1" />
              <span className="text-xs font-bold text-slate-600">
                No se encontraron registros de descargas para este filtro.
              </span>
              <p className="text-[11px] text-slate-400">
                {descargas.length === 0
                  ? "Este técnico aún no ha liquidado este material en órdenes o actas."
                  : "Prueba modificando los términos de búsqueda."}
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3.5 text-center">#</th>
                  <th className="py-3 px-3.5">N° Pedido (OT) / Ticket</th>
                  <th className="py-3 px-3.5">Cliente & Ubicación</th>
                  <th className="py-3 px-3.5">Tipo Trabajo</th>
                  <th className="py-3 px-3.5">N° Acta / Guía</th>
                  <th className="py-3 px-3.5">Fecha Liquidación</th>
                  <th className="py-3 px-3.5 text-center">Cant. Gastada</th>
                  {esDrop ? <th className="py-3 px-3.5">Rango Metraje</th> : null}
                  <th className="py-3 px-3.5">Serie / Identificador</th>
                  <th className="py-3 px-3.5 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {descargasFiltradas.map((item, idx) => {
                  const est = (item.estado_liquidacion || "Pendiente").toUpperCase();
                  const isAprob = est.includes("APROB");
                  const isRech = est.includes("RECH");

                  return (
                    <tr key={idx} className="hover:bg-cyan-50/30 transition-colors">
                      {/* 1. ÍNDICE */}
                      <td className="py-3 px-3.5 text-center font-mono text-[10px] text-slate-400 font-bold">
                        {idx + 1}
                      </td>

                      {/* 2. OT / TICKET */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-slate-900 text-xs">
                            {item.orden_numero}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(item.orden_numero, `ot_${idx}`)}
                            className="text-slate-400 hover:text-cyan-600 p-0.5 rounded cursor-pointer"
                            title="Copiar OT"
                          >
                            {copiedKey === `ot_${idx}` ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                          </button>
                        </div>
                        {item.ticket && item.ticket !== item.orden_numero && (
                          <span className="text-[10px] font-mono text-slate-400 block">
                            Ticket: {item.ticket}
                          </span>
                        )}
                      </td>

                      {/* 3. CLIENTE & UBICACIÓN */}
                      <td className="py-3 px-3.5 min-w-[200px] max-w-[280px]">
                        <span className="font-extrabold text-slate-900 block truncate" title={item.cliente}>
                          {item.cliente}
                        </span>
                        <div className="flex items-center gap-1 text-[10.5px] text-slate-500 mt-0.5 truncate" title={item.direccion}>
                          <MapPin size={11} className="text-cyan-600 shrink-0" />
                          <span className="font-bold text-slate-700">{item.distrito || "Lima"}</span>
                          <span className="text-slate-300">•</span>
                          <span className="truncate">{item.direccion}</span>
                        </div>
                      </td>

                      {/* 4. TIPO TRABAJO */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {item.tipo_trabajo || "Instalación"}
                        </span>
                      </td>

                      {/* 5. N° ACTA / GUÍA */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {item.numero_acta ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 font-mono font-bold text-[11px]">
                            <FileText size={11} className="text-amber-600" />
                            <span>{item.numero_acta}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono text-xs">—</span>
                        )}
                        {item.numero_guia && item.numero_guia !== item.numero_acta && (
                          <span className="text-[9.5px] text-slate-400 block font-mono">
                            Guía: {item.numero_guia}
                          </span>
                        )}
                      </td>

                      {/* 6. FECHA LIQUIDACIÓN */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {item.fecha_liquidacion ? (
                          <div className="flex items-center gap-1 font-mono text-[11px] text-slate-700 font-medium">
                            <Clock size={11} className="text-cyan-600 shrink-0" />
                            <span>
                              {new Date(item.fecha_liquidacion).toLocaleDateString("es-PE", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </span>
                            <span className="text-slate-400 text-[10px]">
                              {new Date(item.fecha_liquidacion).toLocaleTimeString("es-PE", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs italic">No registrada</span>
                        )}
                      </td>

                      {/* 7. CANTIDAD DESCARGADA */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 font-black font-mono text-xs border border-amber-300">
                          <Zap size={10} className="text-amber-600" />
                          <span>{item.cantidad || 1} {unidadTxt}</span>
                        </span>
                      </td>

                      {/* 8. RANGO METRAJE (DROP) */}
                      {esDrop ? (
                        <td className="py-3 px-3.5 whitespace-nowrap font-mono text-[11px]">
                          {item.drop_inicio !== null && item.drop_inicio !== undefined && item.drop_fin !== null && item.drop_fin !== undefined ? (
                            <span className="text-cyan-900 font-bold bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200">
                              {item.drop_inicio}m → {item.drop_fin}m ({Math.abs(item.drop_fin - item.drop_inicio)}m)
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      ) : null}

                      {/* 9. SERIE / IDENTIFICADOR */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-mono text-[11px]">
                        {item.numero_serie ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-950 border border-emerald-300 font-bold">
                            <QrCode size={11} className="text-emerald-700" />
                            <span>{item.numero_serie}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* 10. ESTADO LIQUIDACIÓN */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${
                            isAprob
                              ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                              : isRech
                              ? "bg-rose-50 text-rose-900 border-rose-300"
                              : "bg-amber-50 text-amber-900 border-amber-300"
                          }`}
                        >
                          {isAprob ? (
                            <CheckCircle2 size={10} className="text-emerald-600" />
                          ) : isRech ? (
                            <AlertCircle size={10} className="text-rose-600" />
                          ) : (
                            <Clock size={10} className="text-amber-600" />
                          )}
                          <span>{item.estado_liquidacion || "Pendiente"}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <span className="text-slate-500 font-medium">
            Mostrando <span className="font-bold text-slate-800">{descargasFiltradas.length}</span> de <span className="font-bold text-slate-800">{descargas.length}</span> descargas
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer"
          >
            Cerrar Ventana
          </button>
        </div>

      </div>
    </div>
  );
};
