import React, { useState, useMemo } from "react";
import {
  Gauge,
  MapPin,
  AlertTriangle,
  Search,
  Calendar,
  User,
  Car,
  Compass,
  ShieldCheck,
  ShieldAlert,
  Navigation,
  Clock,
  Bike,
  Route,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Inspeccion, DashboardKmResumen } from "../types/mobilityTypes";
import { TechnicianRouteMapModal } from "./TechnicianRouteMapModal";

interface Props {
  inspecciones: Inspeccion[];
  resumen: DashboardKmResumen;
  alertasDesvio: Inspeccion[];
  loading: boolean;
}

const formatKm = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

export const KmDashboardTab: React.FC<Props> = ({
  inspecciones,
  resumen: _resumenGlobal,
  alertasDesvio: _alertasGlobal,
  loading,
}) => {
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroAlerta, setFiltroAlerta] = useState<"todas" | "alertas" | "conformes">("todas");
  const [filtroFecha, setFiltroFecha] = useState<"hoy" | "ayer" | "todas" | "custom">("hoy");
  const [fechaCustom, setFechaCustom] = useState<string>("");

  const [modalRecorrido, setModalRecorrido] = useState<{
    isOpen: boolean;
    idTrabajador: number;
    nombreTecnico: string;
    cuadrilla?: string;
    placa?: string;
    fecha?: string;
    modoInicial?: "gps" | "ordenes";
  } | null>(null);

  // Fechas de referencia
  const hoyStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const ayerStr = useMemo(
    () => new Date(Date.now() - 86400000).toISOString().split("T")[0],
    []
  );

  // Lista de fechas únicas disponibles en los datos para el historial
  const fechasDisponibles = useMemo(() => {
    const setF = new Set<string>();
    inspecciones.forEach((i) => {
      if (i.fecha) setF.add(i.fecha);
    });
    return Array.from(setF).sort().reverse();
  }, [inspecciones]);

  // Conteo de registros por fecha rápida
  const countHoy = useMemo(
    () => inspecciones.filter((i) => i.fecha === hoyStr).length,
    [inspecciones, hoyStr]
  );
  const countAyer = useMemo(
    () => inspecciones.filter((i) => i.fecha === ayerStr).length,
    [inspecciones, ayerStr]
  );

  // 1. Filtrado por Fecha (Historial Diario)
  const filasFecha = useMemo(() => {
    return inspecciones.filter((insp) => {
      if (filtroFecha === "hoy") return insp.fecha === hoyStr;
      if (filtroFecha === "ayer") return insp.fecha === ayerStr;
      if (filtroFecha === "custom" && fechaCustom) return insp.fecha === fechaCustom;
      return true; // "todas"
    });
  }, [inspecciones, filtroFecha, fechaCustom, hoyStr, ayerStr]);

  // 2. KPIs Dinámicos calculados según el día/filtro seleccionado
  const kpisDinamicos = useMemo(() => {
    const totalKmDeclarados = filasFecha.reduce(
      (acc, i) => acc + (Number(i.km_recorridos) || 0),
      0
    );
    const totalKmEstimados =
      Math.round(
        filasFecha.reduce((acc, i) => acc + (Number(i.km_estimados_ordenes) || 0), 0) * 10
      ) / 10;
    const tecnicosActivos = filasFecha.filter(
      (i) => Number(i.km_estimados_ordenes) > 0 || Number(i.km_recorridos) > 0
    ).length;
    const alertasCount = filasFecha.filter((i) => {
      const kmDec = Number(i.km_recorridos) || 0;
      const kmEst = Number(i.km_estimados_ordenes) || 0;
      return kmDec - kmEst > 35 && kmDec > 0;
    }).length;

    return {
      totalKmDeclarados,
      totalKmEstimados,
      tecnicosActivos,
      alertasCount,
      diferencia: totalKmDeclarados - totalKmEstimados,
    };
  }, [filasFecha]);

  // 3. Filtrado por Búsqueda y Estado de Auditoría
  const filasFiltradas = useMemo(() => {
    return filasFecha.filter((insp) => {
      const kmDec = Number(insp.km_recorridos) || 0;
      const kmEst = Number(insp.km_estimados_ordenes) || 0;
      const diff = kmDec - kmEst;
      const esAlerta = diff > 35 && kmDec > 0;

      const txt = filtroTexto.toLowerCase().trim();
      const coincideTexto =
        !txt ||
        (insp.nombre_tecnico && insp.nombre_tecnico.toLowerCase().includes(txt)) ||
        (insp.placa && insp.placa.toLowerCase().includes(txt)) ||
        (insp.cuadrilla && insp.cuadrilla.toLowerCase().includes(txt));

      if (filtroAlerta === "alertas") return coincideTexto && esAlerta;
      if (filtroAlerta === "conformes") return coincideTexto && !esAlerta;
      return coincideTexto;
    });
  }, [filasFecha, filtroTexto, filtroAlerta]);

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          BARRA SUPERIOR DE HISTORIAL DIARIO Y SELECTOR DE FECHAS
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600">
            <Calendar size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-800">
                Historial Diario de Recorridos
              </h3>
              {filtroFecha === "hoy" && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  EN VIVO HOY
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Selecciona una fecha para auditar el trabajo y las rutas de los técnicos
            </p>
          </div>
        </div>

        {/* Botones rápidos de fecha */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setFiltroFecha("hoy")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filtroFecha === "hoy"
                ? "bg-white text-emerald-800 shadow-xs border border-slate-200/70"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Hoy ({countHoy})
          </button>

          <button
            type="button"
            onClick={() => setFiltroFecha("ayer")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filtroFecha === "ayer"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/70"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Ayer ({countAyer})
          </button>

          <button
            type="button"
            onClick={() => setFiltroFecha("todas")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filtroFecha === "todas"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/70"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Todos ({inspecciones.length})
          </button>

          {/* Selector de fecha histórica personalizada */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
            <input
              type="date"
              value={fechaCustom}
              onChange={(e) => {
                setFechaCustom(e.target.value);
                setFiltroFecha("custom");
              }}
              className="text-xs font-bold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
            />
            {fechasDisponibles.length > 0 && (
              <select
                value={filtroFecha === "custom" ? fechaCustom : ""}
                onChange={(e) => {
                  if (e.target.value) {
                    setFechaCustom(e.target.value);
                    setFiltroFecha("custom");
                  }
                }}
                className="text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-0.5 focus:outline-none cursor-pointer"
              >
                <option value="">Historial...</option>
                {fechasDisponibles.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. TARJETAS DE MÉTRICAS KPI (DINÁMICAS SEGÚN DÍA)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total KM Estimados de Órdenes */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-600 shrink-0">
            <MapPin size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              KM Estimados (Órdenes)
            </span>
            <h3 className="text-2xl font-black text-slate-900 font-mono">
              {kpisDinamicos.totalKmEstimados.toLocaleString()}{" "}
              <span className="text-xs font-bold text-slate-400">KM</span>
            </h3>
            <span className="text-[10px] text-teal-600 font-bold">
              Rutas de clientes visitados
            </span>
          </div>
        </div>

        {/* Técnicos con Actividad */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 shrink-0">
            <User size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Técnicos en Campo
            </span>
            <h3 className="text-2xl font-black text-slate-900 font-mono">
              {kpisDinamicos.tecnicosActivos}
            </h3>
            <span className="text-[10px] text-slate-500 font-medium">
              Con órdenes asignadas
            </span>
          </div>
        </div>

        {/* Total KM Declarados (Fotos) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-600 shrink-0">
            <Gauge size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              KM Declarados (Fotos)
            </span>
            <h3 className="text-2xl font-black text-slate-900 font-mono">
              {kpisDinamicos.totalKmDeclarados.toLocaleString()}{" "}
              <span className="text-xs font-bold text-slate-400">KM</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-medium">
              {kpisDinamicos.totalKmDeclarados === 0
                ? "Pendiente fotos app móvil"
                : "Odómetros de inicio a fin"}
            </span>
          </div>
        </div>

        {/* Alertas de Desvío */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-600 shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Alertas de Desvío
            </span>
            <h3 className="text-2xl font-black text-rose-600 font-mono">
              {kpisDinamicos.alertasCount}
            </h3>
            <span className="text-[10px] text-rose-500 font-bold">
              Diferencia &gt; 35 KM
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. EXPLICACIÓN DEL CRUCE DE RUTAS EN VIVO
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-slate-950 rounded-3xl p-5 text-white border border-cyan-500/20 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Compass size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-cyan-200">
                Auditoría en Vivo: Ruta por Clientes vs Odómetros
              </h4>
              <span className="text-[10px] bg-cyan-900/60 border border-cyan-400/30 text-cyan-300 font-bold px-2 py-0.5 rounded-md">
                Automático
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl mt-0.5 leading-relaxed">
              Calculamos la distancia real entre cada cliente visitado según las órdenes asignadas del día. Aunque los técnicos aún no tengan la app móvil para fotos de inicio/cierre, puedes ver sus paradas y kilometraje estimado en el botón <strong className="text-teal-300 font-semibold">[📍 Ruta Clientes]</strong>.
            </p>
          </div>
        </div>

        {/* Leyenda Semáforo */}
        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 p-2 rounded-2xl shrink-0 text-[11px]">
          <span className="inline-flex items-center gap-1 font-bold text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> En Ruta (Órdenes)
          </span>
          <span className="text-slate-600">|</span>
          <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Conforme
          </span>
          <span className="text-slate-600">|</span>
          <span className="inline-flex items-center gap-1 font-bold text-rose-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Desvío Crítico
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. TABLA PRINCIPAL DE RECORRIDOS Y AUDITORÍA
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* HEADER DE BÚSQUEDA Y TABS DE ESTADO */}
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Buscar por técnico, placa o cuadrilla..."
              className="w-full pl-10 pr-4 py-2 bg-white text-xs font-medium text-slate-800 placeholder-slate-400 rounded-2xl border border-slate-200 focus:border-cyan-500 focus:outline-none transition-all shadow-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setFiltroAlerta("todas")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filtroAlerta === "todas"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Todas ({filasFecha.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroAlerta("alertas")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                filtroAlerta === "alertas"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-rose-600"
              }`}
            >
              <AlertTriangle size={13} />
              Alertas ({kpisDinamicos.alertasCount})
            </button>
            <button
              type="button"
              onClick={() => setFiltroAlerta("conformes")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filtroAlerta === "conformes"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Conformes
            </button>
          </div>
        </div>

        {/* CUERPO DE LA TABLA */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm font-semibold flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Calculando rutas y cruzando órdenes con vehículos...</span>
          </div>
        ) : filasFiltradas.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <Route size={36} className="text-slate-300" />
            <p className="font-semibold text-slate-600">
              No hay registros de técnicos u órdenes para esta fecha.
            </p>
            <p className="text-xs text-slate-400">
              Intenta seleccionar otra fecha en el historial o cambiar el filtro de búsqueda.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 uppercase font-black text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Técnico / Cuadrilla</th>
                  <th className="py-3 px-4">Vehículo</th>
                  <th className="py-3 px-4 text-center">Salida / KM Inicio</th>
                  <th className="py-3 px-4 text-center">Cierre / KM Final</th>
                  <th className="py-3 px-4 text-center">KM Declarado (Fotos)</th>
                  <th className="py-3 px-4 text-center bg-teal-50/40 text-teal-900">
                    KM Estimado (Órdenes)
                  </th>
                  <th className="py-3 px-4 text-center bg-indigo-50/50 text-indigo-900">
                    KM Real GPS (App)
                  </th>
                  <th className="py-3 px-4 text-center">Diferencia</th>
                  <th className="py-3 px-4 text-center">Estado Auditoría</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filasFiltradas.map((insp) => {
                  const kmDec = Number(insp.km_recorridos) || 0;
                  const kmEst = Number(insp.km_estimados_ordenes) || 0;
                  const kmGps = Number(insp.km_gps_app) || 0;
                  const diff = kmDec - (kmGps > 0 ? kmGps : kmEst);
                  const esAlerta = diff > 35 && kmDec > 0;

                  return (
                    <tr
                      key={String(insp.id_inspeccion)}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        esAlerta ? "bg-rose-50/30" : ""
                      }`}
                    >
                      {/* Fecha */}
                      <td className="py-3.5 px-4 font-bold text-slate-700 font-mono whitespace-nowrap">
                        {insp.fecha}
                      </td>

                      {/* Técnico & Cuadrilla */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[11px] shrink-0">
                            <User size={15} />
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-800 block truncate max-w-[200px]">
                              {insp.nombre_tecnico || "Técnico"}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              {insp.cuadrilla && (
                                <span className="text-[10px] text-teal-700 font-bold font-mono">
                                  {insp.cuadrilla}
                                </span>
                              )}
                              {insp.puntos_ruta_count && insp.puntos_ruta_count > 0 ? (
                                <span className="text-[9px] bg-teal-50 text-teal-700 border border-teal-200 font-bold px-1.5 py-0.2 rounded-md">
                                  📍 {insp.puntos_ruta_count} clientes
                                </span>
                              ) : null}
                              {insp.alerta_inicio_tardio && (
                                <span className="text-[9px] bg-rose-100 text-rose-800 border border-rose-300 font-black px-1.5 py-0.2 rounded-md animate-pulse">
                                  ⚠️ Sin Inicio (+30m)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Vehículo */}
                      <td className="py-3.5 px-4">
                        {(() => {
                          const modeloLower = (insp.modelo || "").toLowerCase();
                          const cuadrillaLower = (insp.cuadrilla || "").toLowerCase();
                          const placa = (insp.placa || "").toUpperCase();

                          const esMoto =
                            modeloLower.includes("gl") ||
                            modeloLower.includes("pulsar") ||
                            cuadrillaLower.includes("motowin") ||
                            placa.includes("-E") ||
                            placa.includes("-K");

                          return (
                            <div className="flex items-center gap-1.5">
                              {esMoto ? (
                                <Bike size={15} className="text-amber-500 shrink-0" />
                              ) : (
                                <Car size={14} className="text-cyan-600 shrink-0" />
                              )}
                              <div>
                                <span className="font-extrabold text-slate-900 font-mono tracking-wider block">
                                  {insp.placa || "Sin Vehículo"}
                                </span>
                                <span className="text-[10px] text-slate-400 block">
                                  {insp.modelo || (esMoto ? "Moto" : "Vehículo")}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Salida / KM Inicio */}
                      <td className="py-3.5 px-4 text-center font-mono">
                        {insp.km_inicio ? (
                          <>
                            <div className="text-slate-900 font-bold text-xs">
                              {insp.km_inicio.toLocaleString()} km
                            </div>
                            <span className="text-[10px] text-emerald-700 font-semibold block">
                              ⏰ {insp.hora_inicio_real || insp.hora_inicio || "07:00 AM"}
                            </span>
                          </>
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                              📲 Pendiente
                            </span>
                            <span className="text-[9px] text-slate-400 mt-0.5">
                              Sin foto salida
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Cierre / KM Final */}
                      <td className="py-3.5 px-4 text-center font-mono">
                        {insp.km_fin ? (
                          <>
                            <div className="text-slate-900 font-bold text-xs">
                              {insp.km_fin.toLocaleString()} km
                            </div>
                            <span className="text-[10px] text-slate-500 font-semibold block">
                              🌙 {insp.hora_cierre_real || insp.hora_fin || "-"}
                            </span>
                          </>
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-medium">
                              📲 Pendiente
                            </span>
                            <span className="text-[9px] text-slate-400 mt-0.5">
                              Sin foto cierre
                            </span>
                          </div>
                        )}
                      </td>

                      {/* KM Declarado (Fotos) */}
                      <td className="py-3.5 px-4 text-center font-mono font-black text-slate-900 bg-slate-50/50">
                        {kmDec > 0 ? (
                          `${formatKm(kmDec)} km`
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="text-slate-400 text-xs font-medium">--</span>
                            <span className="text-[9px] text-slate-400 font-normal">
                              (Fotos pend.)
                            </span>
                          </div>
                        )}
                      </td>

                      {/* KM Estimado (Órdenes) con Botón Ruta Clientes */}
                      <td className="py-3.5 px-4 text-center bg-teal-50/30">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-mono font-black text-xs text-teal-950">
                            {kmEst > 0 ? `${formatKm(kmEst)} km` : "--"}
                          </span>
                          {kmEst > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setModalRecorrido({
                                  isOpen: true,
                                  idTrabajador: insp.id_trabajador,
                                  nombreTecnico: insp.nombre_tecnico || "Técnico",
                                  cuadrilla: insp.cuadrilla,
                                  placa: insp.placa,
                                  fecha: insp.fecha,
                                  modoInicial: "ordenes",
                                })
                              }
                              className="px-2 py-0.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                              title="Ver clientes visitados y ruta en mapa"
                            >
                              <MapPin size={10} />
                              <span>Ruta Clientes</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-normal">
                              Sin órdenes
                            </span>
                          )}
                        </div>
                      </td>

                      {/* KM Real GPS (App) */}
                      <td className="py-3.5 px-4 text-center bg-indigo-50/30">
                        <div className="flex flex-col items-center gap-1">
                          {kmGps > 0 ? (
                            <>
                              <span className="font-mono font-black text-xs text-indigo-950">
                                {formatKm(kmGps)} km
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setModalRecorrido({
                                    isOpen: true,
                                    idTrabajador: insp.id_trabajador,
                                    nombreTecnico: insp.nombre_tecnico || "Técnico",
                                    cuadrilla: insp.cuadrilla,
                                    placa: insp.placa,
                                    fecha: insp.fecha,
                                    modoInicial: "gps",
                                  })
                                }
                                className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                              >
                                <Navigation size={10} />
                                <span>GPS Vivo</span>
                              </button>
                            </>
                          ) : (
                            <div className="flex flex-col items-center">
                              <span className="text-slate-400 text-[11px] font-semibold">
                                Sin GPS App
                              </span>
                              <span className="text-[9px] text-slate-400">
                                Requiere app móvil
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Diferencia */}
                      <td className="py-3.5 px-4 text-center font-mono font-extrabold">
                        {kmDec > 0 ? (
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs ${
                              esAlerta
                                ? "bg-rose-100 text-rose-700 font-black"
                                : diff < 0
                                ? "bg-blue-100 text-blue-700"
                                : "bg-emerald-100 text-emerald-800 font-bold"
                            }`}
                          >
                            {diff > 0 ? `+${formatKm(diff)}` : formatKm(diff)} km
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal text-xs">--</span>
                        )}
                      </td>

                      {/* Estado Auditoría */}
                      <td className="py-3.5 px-4 text-center">
                        {kmDec > 0 ? (
                          esAlerta ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                              <ShieldAlert size={14} />
                              🚨 Desvío Crítico
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <ShieldCheck size={14} />
                              🟢 Conforme
                            </span>
                          )
                        ) : kmEst > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock size={12} />
                            🟡 En Ruta ({insp.puntos_ruta_count || "1+"} órds)
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            Sin Movimiento
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. MODAL DEL RECORRIDO EN MAPA
      ───────────────────────────────────────────────────────────── */}
      {modalRecorrido && (
        <TechnicianRouteMapModal
          isOpen={modalRecorrido.isOpen}
          onClose={() => setModalRecorrido(null)}
          idTrabajador={modalRecorrido.idTrabajador}
          nombreTecnico={modalRecorrido.nombreTecnico}
          cuadrilla={modalRecorrido.cuadrilla}
          placa={modalRecorrido.placa}
          fecha={modalRecorrido.fecha}
          modoInicial={modalRecorrido.modoInicial}
        />
      )}
    </div>
  );
};
