import React, { useState, useEffect } from "react";
import {
  X,
  MapPin,
  Clock,
  Car,
  User,
  Navigation,
  ExternalLink,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Activity,
  Layers,
  Bike,
} from "lucide-react";
import { RecorridoTecnicoResponse, ParadaGps } from "../types/mobilityTypes";
import { getRecorridoTecnico } from "../services/mobilityService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  idTrabajador: number;
  nombreTecnico?: string;
  cuadrilla?: string;
  placa?: string;
  fecha?: string;
  modoInicial?: "gps" | "ordenes";
}

export const TechnicianRouteMapModal: React.FC<Props> = ({
  isOpen,
  onClose,
  idTrabajador,
  nombreTecnico,
  cuadrilla,
  placa,
  fecha,
  modoInicial = "ordenes",
}) => {
  const [data, setData] = useState<RecorridoTecnicoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<"ordenes" | "gps">(modoInicial);
  const [paradaSeleccionada, setParadaSeleccionada] = useState<ParadaGps | null>(null);

  useEffect(() => {
    if (isOpen && idTrabajador) {
      setLoading(true);
      getRecorridoTecnico(idTrabajador, fecha)
        .then((res) => {
          setData(res);
          const hasGps = res.paradas_gps && res.paradas_gps.length > 0;
          const hasOrd = res.paradas_ordenes && res.paradas_ordenes.length > 0;

          // Seleccionar la vista inicial según disponibilidad
          if (modoInicial === "gps" && hasGps) {
            setVistaActiva("gps");
            setParadaSeleccionada(res.paradas_gps![0]);
          } else if (hasOrd) {
            setVistaActiva("ordenes");
            setParadaSeleccionada(res.paradas_ordenes![0]);
          } else if (hasGps) {
            setVistaActiva("gps");
            setParadaSeleccionada(res.paradas_gps![0]);
          } else if (res.paradas && res.paradas.length > 0) {
            setParadaSeleccionada(res.paradas[0]);
          }
        })
        .catch((err) => console.error("Error al cargar recorrido:", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, idTrabajador, fecha, modoInicial]);

  if (!isOpen) return null;

  const paradasGps = data?.paradas_gps || [];
  const paradasOrdenes = data?.paradas_ordenes || [];
  const paradasMostradas = vistaActiva === "ordenes" && paradasOrdenes.length > 0
    ? paradasOrdenes
    : paradasGps.length > 0
    ? paradasGps
    : data?.paradas || [];

  const totalKmGps = data?.km_recorridos_gps || 0;
  const totalKmOrdenes = data?.km_estimados_ordenes || 0;
  const kmActual = vistaActiva === "ordenes" ? totalKmOrdenes : totalKmGps;
  const insp = data?.inspeccion;

  // Centro del mapa interactivo
  const centerLat = paradaSeleccionada
    ? Number(paradaSeleccionada.lat)
    : paradasMostradas[0]
    ? Number(paradasMostradas[0].lat)
    : -12.046374;
  const centerLng = paradaSeleccionada
    ? Number(paradaSeleccionada.lng)
    : paradasMostradas[0]
    ? Number(paradasMostradas[0].lng)
    : -77.042793;

  // Mapa OpenStreetMap embebido
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${centerLng - 0.04}%2C${centerLat - 0.04}%2C${centerLng + 0.04}%2C${centerLat + 0.04}&layer=mapnik&marker=${centerLat}%2C${centerLng}`;

  const esMoto =
    (cuadrilla || "").toLowerCase().includes("motowin") ||
    (placa || "").includes("-E") ||
    (placa || "").includes("-K");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-2 md:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl p-5 md:p-6 max-w-5xl w-full shadow-2xl border border-slate-100 space-y-4 max-h-[95vh] overflow-y-auto flex flex-col">
        
        {/* ─────────────────────────────────────────────────────────────
            HEADER DEL VISOR DE RUTA
        ───────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-500/25 shrink-0">
              {esMoto ? <Bike size={24} /> : <Navigation size={24} />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {esMoto ? "🏍️ RUTA MOTOWIN" : "🚗 RUTA DE CAMPO"}
                </span>
                <span className="text-xs font-bold text-slate-500 font-mono">
                  📅 {fecha || data?.fecha || new Date().toISOString().slice(0, 10)}
                </span>
              </div>
              <h2 className="text-base md:text-lg font-black text-slate-900 mt-0.5 flex items-center gap-2">
                <span>{nombreTecnico || data?.tecnico?.nombre_tecnico || "Técnico"}</span>
                {(cuadrilla || data?.tecnico?.cuadrilla) && (
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {cuadrilla || data?.tecnico?.cuadrilla}
                  </span>
                )}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            {placa && (
              <span className="font-mono font-black text-xs px-3 py-1 bg-slate-900 text-amber-400 rounded-xl border border-slate-700 shadow-xs flex items-center gap-1.5">
                {esMoto ? <Bike size={14} /> : <Car size={14} />}
                {placa}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            TABS SELECTORAS: RUTA ÓRDENES vs PUNTOS GPS
        ───────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setVistaActiva("ordenes");
              if (paradasOrdenes.length > 0) setParadaSeleccionada(paradasOrdenes[0]);
            }}
            className={`flex-1 py-2 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
              vistaActiva === "ordenes"
                ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <MapPin size={15} />
            <span>🗺️ Ruta Órdenes / Clientes ({paradasOrdenes.length})</span>
            <span className="font-mono text-[10px] opacity-80">~{totalKmOrdenes} KM</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setVistaActiva("gps");
              if (paradasGps.length > 0) setParadaSeleccionada(paradasGps[0]);
            }}
            className={`flex-1 py-2 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
              vistaActiva === "gps"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Navigation size={15} />
            <span>🛰️ Puntos GPS App ({paradasGps.length})</span>
            <span className="font-mono text-[10px] opacity-80">{totalKmGps} KM</span>
          </button>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            RESUMEN DE MÉTRICAS DEL DÍA
        ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-teal-50/80 border border-teal-100 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-teal-700 block">KM Estimados (Ruta)</span>
            <span className="text-xl font-black text-teal-950 font-mono">
              {totalKmOrdenes} <span className="text-xs">KM</span>
            </span>
          </div>

          <div className="p-3 bg-indigo-50/80 border border-indigo-100 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-indigo-700 block">KM GPS App</span>
            <span className="text-xl font-black text-indigo-950 font-mono">
              {totalKmGps} <span className="text-xs">KM</span>
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Clientes / Paradas</span>
            <span className="text-base font-black text-slate-800 font-mono">
              {paradasMostradas.length} {vistaActiva === "ordenes" ? "clientes" : "puntos"}
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Estado Auditoría</span>
            <span className="text-xs font-black text-emerald-700 bg-emerald-100/70 border border-emerald-300 px-2 py-0.5 rounded-lg inline-block mt-0.5">
              {insp?.estado_auditoria || "Conforme"}
            </span>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            CONTENIDO PRINCIPAL: MAPA INTERACTIVO + ITINERARIO SECUENCIAL
        ───────────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <RefreshCw size={32} className="animate-spin text-indigo-600 mx-auto" />
            <p className="text-xs font-bold text-slate-600">Calculando trazado geográfico de la ruta...</p>
          </div>
        ) : paradasMostradas.length === 0 ? (
          <div className="py-16 px-6 bg-slate-50 rounded-3xl border border-slate-200 text-center space-y-3">
            <MapPin size={40} className="text-slate-400 mx-auto" />
            <h3 className="text-sm font-black text-slate-800">No hay paradas registradas para esta fecha</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              El técnico no registra órdenes asignadas ni eventos GPS para el día seleccionado.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            
            {/* 1. VISOR DE MAPA EMBEBIDO (7 Columnas) */}
            <div className="lg:col-span-7 bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 shadow-inner flex flex-col h-[380px] lg:h-[460px] relative">
              <iframe
                title="Mapa de Ruta"
                src={osmEmbedUrl}
                className="w-full h-full border-0"
                loading="lazy"
              />

              {/* Botón flotante para abrir en Google Maps */}
              <div className="absolute bottom-3 right-3 z-10">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${centerLat},${centerLng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-slate-900/95 hover:bg-black text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 shadow-lg backdrop-blur-xs transition-all"
                >
                  <ExternalLink size={12} />
                  <span>Navegar en Google Maps</span>
                </a>
              </div>

              {/* Tarjeta flotante del punto seleccionado */}
              {paradaSeleccionada && (
                <div className="absolute top-3 left-3 right-3 sm:right-auto sm:max-w-xs z-10 bg-white/95 backdrop-blur-xs p-3 rounded-2xl border border-slate-200 shadow-xl text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-black text-teal-800">
                      📍 {paradaSeleccionada.orden_visita ? `Cliente #${paradaSeleccionada.orden_visita}` : paradaSeleccionada.hora}
                    </span>
                    {paradaSeleccionada.ticket && (
                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                        #{paradaSeleccionada.ticket}
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-slate-900 line-clamp-2">
                    {paradaSeleccionada.cliente || paradaSeleccionada.descripcion || "Punto de ruta"}
                  </p>
                  {paradaSeleccionada.direccion && (
                    <p className="text-[10px] text-slate-500 line-clamp-1">
                      {paradaSeleccionada.direccion.split("||")[0]}
                    </p>
                  )}
                  <span className="text-[10px] text-slate-400 font-mono block">
                    Lat: {Number(paradaSeleccionada.lat).toFixed(5)}, Lng: {Number(paradaSeleccionada.lng).toFixed(5)}
                  </span>
                </div>
              )}
            </div>

            {/* 2. ITINERARIO SECUENCIAL (5 Columnas) */}
            <div className="lg:col-span-5 space-y-2 h-[380px] lg:h-[460px] overflow-y-auto pr-1 custom-scrollbar">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-600">
                  {vistaActiva === "ordenes" ? "Secuencia de Visitas" : "Línea de Tiempo GPS"} ({paradasMostradas.length})
                </h4>
                <span className="text-[10px] font-bold text-teal-700 font-mono">
                  Distancia: {kmActual} KM
                </span>
              </div>

              {paradasMostradas.map((p, idx) => {
                const isSelected =
                  paradaSeleccionada?.id_gps_log === p.id_gps_log ||
                  (paradaSeleccionada?.lat === p.lat && paradaSeleccionada?.lng === p.lng);

                return (
                  <div
                    key={p.id_gps_log || idx}
                    onClick={() => setParadaSeleccionada(p)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                      isSelected
                        ? "bg-teal-50 border-teal-400 ring-2 ring-teal-200 shadow-xs"
                        : "bg-white border-slate-200/80 hover:border-teal-200 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-mono font-black text-[10px] flex items-center justify-center shrink-0">
                          {p.orden_visita || idx + 1}
                        </span>
                        <span className="font-mono font-black text-xs text-slate-900">
                          {p.cliente ? p.cliente.slice(0, 22) : p.hora || "En Ruta"}
                        </span>
                      </div>

                      {p.ticket && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                          #{p.ticket}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] font-medium text-slate-700 leading-snug line-clamp-2">
                      {p.direccion ? p.direccion.split("||")[0] : p.descripcion || "Punto de trayecto vehicular"}
                    </p>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-100">
                      <span>{p.tramo_km ? `+${p.tramo_km} km` : "Punto Inicial"}</span>
                      <span className="font-bold text-teal-700">Acum: {p.acumulado_km || 0} km</span>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
