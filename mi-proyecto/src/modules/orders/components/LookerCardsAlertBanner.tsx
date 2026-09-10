import React, { useState, useEffect, useCallback, useRef } from "react";
import { API_URL } from "../../../config/api";
import {
  AlertTriangle,
  Flame,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  MapPin
} from "lucide-react";

interface ZonaDetail {
  zona: string;
  total: number;
  esSur: boolean;
  franjas: {
    "08:00-11:59": number;
    "12:00-15:59": number;
    "16:00-20:00": number;
    otros: number;
  };
  distritos: Record<string, number>;
}

interface CardData {
  total: number;
  zonas: Record<string, ZonaDetail>;
}

interface AlertaSur {
  alerta: string;
  tarjeta: string;
  zona: string;
  distrito: string;
  ticket: string;
  orden_wn: string;
  direccion: string;
  franja_horaria: string;
  motivo: string;
  sla: string;
}

interface LookerResponse {
  success: boolean;
  timestamp: string;
  totalGeneral: number;
  totalAlertasSur: number;
  resumenZonas?: Record<string, number>;
  cards: {
    "AVERIAS PREFERENTE": CardData;
    "AVERIAS ALTO VALOR": CardData;
    "MOTOWIN ZONAS": CardData;
  };
  alertasSur: AlertaSur[];
}

export const LookerCardsAlertBanner: React.FC = () => {
  const [data, setData] = useState<LookerResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const lastAlertCountRef = useRef<number>(0);

  const fetchLookerData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setLoading(true);
      const res = await fetch(`${API_URL}/api/looker/resumen`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: LookerResponse = await res.json();

      if (json && json.success) {
        setData(json);
        setLastUpdated(new Date());

        // Si aumentaron las alertas de zona sur, reabrir banner automáticamente si estaba cerrado
        if (json.totalAlertasSur > lastAlertCountRef.current && json.totalAlertasSur > 0) {
          setDismissed(false);
        }
        lastAlertCountRef.current = json.totalAlertasSur;
      }
    } catch (err) {
      console.warn("No se pudo actualizar Looker Studio:", err);
    } finally {
      if (isManual) setLoading(false);
    }
  }, []);

  // Polling automático cada 30 segundos
  useEffect(() => {
    fetchLookerData();
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchLookerData();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchLookerData]);

  if (!data) return null;

  const totalSur = data.totalAlertasSur || 0;
  const hayAlertaSur = totalSur > 0;

  // 🛡️ REGLA OPERATIVA: Solo trabajamos con ZONA SUR.
  // Si no hay órdenes en Zona Sur, no se muestra nada.
  if (!hayAlertaSur || dismissed) {
    return null;
  }

  // Conteo exclusivo de órdenes en ZONA SUR por cada categoría
  const surAverias = data.alertasSur?.filter(
    (a) => a.tarjeta === "AVERIAS PREFERENTE" || a.tarjeta === "AVERIAS"
  ).length || 0;

  const surAltoValor = data.alertasSur?.filter(
    (a) => a.tarjeta === "AVERIAS ALTO VALOR" || a.tarjeta === "ALTO VALOR"
  ).length || 0;

  const surMotowin = data.alertasSur?.filter(
    (a) => a.tarjeta === "MOTOWIN ZONAS" || a.tarjeta === "MOTOWIN"
  ).length || 0;

  // Filtrar exclusivamente zonas que pertenezcan al SUR
  const zonasSurMap: Record<string, number> = {};
  if (data.resumenZonas) {
    for (const [zNom, cant] of Object.entries(data.resumenZonas)) {
      if (zNom.toUpperCase().includes("SUR")) {
        zonasSurMap[zNom] = cant;
      }
    }
  }
  if (Object.keys(zonasSurMap).length === 0 && data.alertasSur) {
    for (const a of data.alertasSur) {
      const z = a.zona || "ZONA SUR";
      zonasSurMap[z] = (zonasSurMap[z] || 0) + 1;
    }
  }

  return (
    <div className="shrink-0 border-b bg-gradient-to-r from-red-50 via-amber-50 to-orange-50 border-red-200 shadow-sm transition-all duration-200">
      {/* 🚀 BARRA PRINCIPAL COMPACTA (EXCLUSIVA ZONA SUR) */}
      <div className="px-3 py-1.5 flex flex-wrap items-center justify-between gap-2">
        
        {/* LADO IZQUIERDO: Título y Tarjetas de Zona Sur */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-600 text-white font-extrabold text-xs shadow-sm animate-pulse">
            <AlertTriangle size={14} className="shrink-0" />
            <span>🚨 ¡ALERTA ZONA SUR: {totalSur} {totalSur === 1 ? "ORDEN" : "ÓRDENES"}!</span>
          </div>

          {/* 3 MINI TARJETAS EXCLUSIVAS ZONA SUR */}
          <div className="flex items-center gap-1.5">
            {/* 1. AVERIAS */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md border ${
              surAverias > 0
                ? "bg-[#FF8F00]/15 border-[#FF8F00] text-[#b35b00]"
                : "bg-slate-100 border-slate-300 text-slate-400"
            }`}>
              <span className="font-extrabold text-[10px] uppercase">Averías:</span>
              <span className={`font-mono font-black text-xs ${surAverias > 0 ? "text-[#d86900]" : "text-slate-500"}`}>
                {surAverias}
              </span>
            </div>

            {/* 2. ALTO VALOR */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md border ${
              surAltoValor > 0
                ? "bg-cyan-100 border-cyan-400 text-cyan-800"
                : "bg-slate-100 border-slate-300 text-slate-400"
            }`}>
              <span className="font-extrabold text-[10px] uppercase">Alto Valor:</span>
              <span className={`font-mono font-black text-xs ${surAltoValor > 0 ? "text-cyan-900" : "text-slate-500"}`}>
                {surAltoValor}
              </span>
            </div>

            {/* 3. MOTOWIN */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md border ${
              surMotowin > 0
                ? "bg-emerald-100 border-emerald-400 text-emerald-800"
                : "bg-slate-100 border-slate-300 text-slate-400"
            }`}>
              <span className="font-extrabold text-[10px] uppercase">Motowin:</span>
              <span className={`font-mono font-black text-xs ${surMotowin > 0 ? "text-emerald-900" : "text-slate-500"}`}>
                {surMotowin}
              </span>
            </div>
          </div>

          {/* 📍 ZONAS SUR DISPONIBLES */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-red-900 ml-1">Zonas Sur:</span>
            {Object.entries(zonasSurMap).map(([zNom, cant]) => (
              <span
                key={zNom}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border bg-red-100/90 border-red-300 text-red-900 shadow-2xs"
              >
                <MapPin size={10} className="text-red-600" />
                <span>{zNom}:</span>
                <span className="font-mono font-black">{cant}</span>
              </span>
            ))}
          </div>
        </div>

        {/* LADO DERECHO: Acciones */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
            Act: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>

          <button
            onClick={() => fetchLookerData(true)}
            disabled={loading}
            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-black/5 rounded transition-colors"
            title="Refrescar en vivo desde Looker Studio"
          >
            <RefreshCw size={12} className={loading ? "animate-spin text-blue-600" : ""} />
          </button>

          <button
            onClick={() => setExpanded(!expanded)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded border transition-colors ${
              expanded
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
            }`}
          >
            {expanded ? (
              <>
                <ChevronUp size={12} />
                Ocultar Grids
              </>
            ) : (
              <>
                <ChevronDown size={12} />
                Ver Detalle Zonas
              </>
            )}
          </button>

          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-black/10 rounded transition-colors"
            title="Cerrar banner (volverá a aparecer si entran nuevas órdenes de Looker Sur)"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* 🚀 SECCIÓN EXPANDIDA: TABLAS EXCLUSIVAS DE ZONA SUR */}
      {expanded && (
        <div className="px-3 pb-2.5 pt-1 border-t border-red-200/80 bg-white/95">
          
          {/* TABLA PRINCIPAL DE ÓRDENES EN ZONA SUR */}
          <div className="mb-2 p-2 rounded-lg bg-red-50 border border-red-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-black text-red-900 flex items-center gap-1">
                <Flame size={13} className="text-red-600" />
                DETALLE DE ÓRDENES EN ZONA SUR ({data.alertasSur.length})
              </span>
              <span className="text-[10px] text-red-700 font-semibold">
                Prioridad de Despacho Inmediato
              </span>
            </div>
            <div className="overflow-x-auto max-h-36 overflow-y-auto custom-scrollbar">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-red-200/70 text-red-950 text-left font-bold uppercase">
                    <th className="py-1 px-1.5">Tarjeta</th>
                    <th className="py-1 px-1.5">Zona</th>
                    <th className="py-1 px-1.5">Distrito</th>
                    <th className="py-1 px-1.5">Ticket</th>
                    <th className="py-1 px-1.5">Dirección</th>
                    <th className="py-1 px-1.5">Franja</th>
                    <th className="py-1 px-1.5">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.alertasSur.map((al, idx) => (
                    <tr key={idx} className="border-b border-red-100 hover:bg-red-100/50">
                      <td className="py-1 px-1.5 font-bold text-red-800">
                        {al.tarjeta === 'AVERIAS PREFERENTE' ? 'AVERIAS' : al.tarjeta === 'MOTOWIN ZONAS' ? 'MOTOWIN' : 'ALTO VALOR'}
                      </td>
                      <td className="py-1 px-1.5 font-black text-red-700">{al.zona}</td>
                      <td className="py-1 px-1.5 font-semibold text-slate-800">{al.distrito}</td>
                      <td className="py-1 px-1.5 font-mono text-blue-700 font-bold">{al.ticket}</td>
                      <td className="py-1 px-1.5 max-w-[220px] truncate text-slate-700" title={al.direccion}>{al.direccion}</td>
                      <td className="py-1 px-1.5 font-semibold text-purple-700">{al.franja_horaria}</td>
                      <td className="py-1 px-1.5 text-slate-600">{al.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* GRID DE LAS 3 TARJETAS (SOLO ZONAS SUR) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            
            {/* 1. AVERIAS (SUR) */}
            <div className="rounded-lg border border-[#FF8F00]/40 overflow-hidden shadow-2xs">
              <div className="bg-[#FF8F00] text-white px-2 py-1 flex items-center justify-between">
                <span className="font-extrabold text-[11px] tracking-wide">AVERIAS PREFERENTE (SUR)</span>
                <span className="bg-white text-[#d86900] px-1.5 py-0.2 rounded font-mono font-black text-[11px]">
                  TOTAL: {surAverias}
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto custom-scrollbar">
                <table className="w-full text-[10px] text-left">
                  <thead className="bg-orange-50/80 text-orange-950 font-bold border-b border-orange-200">
                    <tr>
                      <th className="py-1 px-1.5">Zona</th>
                      <th className="py-1 px-1">08:00</th>
                      <th className="py-1 px-1">12:00</th>
                      <th className="py-1 px-1">16:00</th>
                      <th className="py-1 px-1.5 text-right font-black">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(data.cards["AVERIAS PREFERENTE"]?.zonas || {})
                      .filter((z) => z.esSur || z.zona.toUpperCase().includes("SUR"))
                      .map((z, i) => (
                        <tr key={i} className="border-b bg-red-50/70 font-bold text-red-950 border-orange-100">
                          <td className="py-1 px-1.5 flex items-center gap-1">
                            <Flame size={11} className="text-red-600 shrink-0" />
                            <span>{z.zona}</span>
                          </td>
                          <td className="py-1 px-1 font-mono text-slate-700">{z.franjas["08:00-11:59"] || "-"}</td>
                          <td className="py-1 px-1 font-mono text-slate-700">{z.franjas["12:00-15:59"] || "-"}</td>
                          <td className="py-1 px-1 font-mono text-slate-700">{z.franjas["16:00-20:00"] || "-"}</td>
                          <td className="py-1 px-1.5 text-right font-mono font-black text-red-900">{z.total}</td>
                        </tr>
                      ))}
                    {Object.values(data.cards["AVERIAS PREFERENTE"]?.zonas || {}).filter((z) => z.esSur || z.zona.toUpperCase().includes("SUR")).length === 0 && (
                      <tr><td colSpan={5} className="p-2 text-center text-slate-400 italic">Sin órdenes Sur pendientes</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. ALTO VALOR (SUR) */}
            <div className="rounded-lg border border-cyan-300 overflow-hidden shadow-2xs">
              <div className="bg-cyan-600 text-white px-2 py-1 flex items-center justify-between">
                <span className="font-extrabold text-[11px] tracking-wide">ALTO VALOR (SUR)</span>
                <span className="bg-white text-cyan-800 px-1.5 py-0.2 rounded font-mono font-black text-[11px]">
                  TOTAL: {surAltoValor}
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto custom-scrollbar">
                <table className="w-full text-[10px] text-left">
                  <thead className="bg-cyan-50/80 text-cyan-950 font-bold border-b border-cyan-200">
                    <tr>
                      <th className="py-1 px-1.5">Zona</th>
                      <th className="py-1 px-1">08:00</th>
                      <th className="py-1 px-1">12:00</th>
                      <th className="py-1 px-1">16:00</th>
                      <th className="py-1 px-1.5 text-right font-black">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(data.cards["AVERIAS ALTO VALOR"]?.zonas || {})
                      .filter((z) => z.esSur || z.zona.toUpperCase().includes("SUR"))
                      .map((z, i) => (
                        <tr key={i} className="border-b bg-red-50/70 font-bold text-red-950 border-cyan-100">
                          <td className="py-1 px-1.5 flex items-center gap-1">
                            <Flame size={11} className="text-red-600 shrink-0" />
                            <span>{z.zona}</span>
                          </td>
                          <td className="py-1 px-1 font-mono text-slate-700">{z.franjas["08:00-11:59"] || "-"}</td>
                          <td className="py-1 px-1 font-mono text-slate-700">{z.franjas["12:00-15:59"] || "-"}</td>
                          <td className="py-1 px-1 font-mono text-slate-700">{z.franjas["16:00-20:00"] || "-"}</td>
                          <td className="py-1 px-1.5 text-right font-mono font-black text-red-900">{z.total}</td>
                        </tr>
                      ))}
                    {Object.values(data.cards["AVERIAS ALTO VALOR"]?.zonas || {}).filter((z) => z.esSur || z.zona.toUpperCase().includes("SUR")).length === 0 && (
                      <tr><td colSpan={5} className="p-2 text-center text-slate-400 italic">Sin órdenes Sur pendientes</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. MOTOWIN (SUR) */}
            <div className="rounded-lg border border-emerald-400 overflow-hidden shadow-2xs">
              <div className="bg-emerald-600 text-white px-2 py-1 flex items-center justify-between">
                <span className="font-extrabold text-[11px] tracking-wide">MOTOWIN ZONAS (SUR)</span>
                <span className="bg-white text-emerald-800 px-1.5 py-0.2 rounded font-mono font-black text-[11px]">
                  TOTAL: {surMotowin}
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto custom-scrollbar">
                <table className="w-full text-[10px] text-left">
                  <thead className="bg-emerald-50/80 text-emerald-950 font-bold border-b border-emerald-200">
                    <tr>
                      <th className="py-1 px-1.5">Zona</th>
                      <th className="py-1 px-1">08:00</th>
                      <th className="py-1 px-1">12:00</th>
                      <th className="py-1 px-1">16:00</th>
                      <th className="py-1 px-1.5 text-right font-black">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(data.cards["MOTOWIN ZONAS"]?.zonas || {})
                      .filter((z) => z.esSur || z.zona.toUpperCase().includes("SUR"))
                      .map((z, i) => (
                        <tr key={i} className="border-b bg-red-50/70 font-bold text-red-950 border-emerald-100">
                          <td className="py-1 px-1.5 flex items-center gap-1">
                            <Flame size={11} className="text-red-600 shrink-0" />
                            <span>{z.zona}</span>
                          </td>
                          <td className="py-1 px-1 font-mono text-slate-700">{z.franjas["08:00-11:59"] || "-"}</td>
                          <td className="py-1 px-1 font-mono text-slate-700">{z.franjas["12:00-15:59"] || "-"}</td>
                          <td className="py-1 px-1 font-mono text-slate-700">{z.franjas["16:00-20:00"] || "-"}</td>
                          <td className="py-1 px-1.5 text-right font-mono font-black text-red-900">{z.total}</td>
                        </tr>
                      ))}
                    {Object.values(data.cards["MOTOWIN ZONAS"]?.zonas || {}).filter((z) => z.esSur || z.zona.toUpperCase().includes("SUR")).length === 0 && (
                      <tr><td colSpan={5} className="p-2 text-center text-slate-400 italic">Sin órdenes Sur pendientes</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
