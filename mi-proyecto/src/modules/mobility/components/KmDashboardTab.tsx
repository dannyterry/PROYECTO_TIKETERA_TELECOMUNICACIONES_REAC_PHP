import React, { useState } from "react";
import {
  Gauge,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Search,
  Calendar,
  User,
  Car,
  ChevronDown,
  ChevronUp,
  Compass,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Navigation,
  Clock,
  Eye,
  Bike,
} from "lucide-react";
import { Inspeccion, DashboardKmResumen } from "../types/mobilityTypes";
import { TechnicianRouteMapModal } from "./TechnicianRouteMapModal";

interface Props {
  inspecciones: Inspeccion[];
  resumen: DashboardKmResumen;
  alertasDesvio: Inspeccion[];
  loading: boolean;
}

export const KmDashboardTab: React.FC<Props> = ({
  inspecciones,
  resumen,
  alertasDesvio,
  loading,
}) => {
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroAlerta, setFiltroAlerta] = useState<"todas" | "alertas" | "conformes">("todas");
  const [modalRecorrido, setModalRecorrido] = useState<{
    isOpen: boolean;
    idTrabajador: number;
    nombreTecnico: string;
    cuadrilla?: string;
    placa?: string;
    fecha?: string;
    modoInicial?: "gps" | "ordenes";
  } | null>(null);

  // Filtrado de filas
  const filasFiltradas = inspecciones.filter((insp) => {
    const kmDec = Number(insp.km_recorridos) || 0;
    const kmEst = Number(insp.km_estimados_ordenes) || 0;
    const diff = kmDec - kmEst;
    const esAlerta = diff > 35 && kmDec > 0;

    const txt = filtroTexto.toLowerCase();
    const coincideTexto =
      !txt ||
      (insp.nombre_tecnico && insp.nombre_tecnico.toLowerCase().includes(txt)) ||
      (insp.placa && insp.placa.toLowerCase().includes(txt)) ||
      (insp.cuadrilla && insp.cuadrilla.toLowerCase().includes(txt));

    if (filtroAlerta === "alertas") return coincideTexto && esAlerta;
    if (filtroAlerta === "conformes") return coincideTexto && !esAlerta;
    return coincideTexto;
  });

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          1. TARJETAS DE MÉTRICAS KPI (DASHBOARD SUPERIOR)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total KM Declarados */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 shrink-0">
            <Gauge size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              KM Declarados (Fotos)
            </span>
            <h3 className="text-2xl font-black text-slate-900 font-mono">
              {(resumen.totalKmDeclarados || 0).toLocaleString()}{" "}
              <span className="text-xs font-bold text-slate-400">KM</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-medium">Odómetros de inicio a fin</span>
          </div>
        </div>

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
              {(resumen.totalKmEstimados || 0).toLocaleString()}{" "}
              <span className="text-xs font-bold text-slate-400">KM</span>
            </h3>
            <span className="text-[10px] text-teal-600 font-bold">Rutas de clientes atendidos</span>
          </div>
        </div>

        {/* Diferencia Global */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-600 shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Diferencia / Margen
            </span>
            <h3 className="text-2xl font-black text-slate-900 font-mono">
              {resumen.diferenciaTotal > 0 ? `+${resumen.diferenciaTotal.toLocaleString()}` : resumen.diferenciaTotal}{" "}
              <span className="text-xs font-bold text-slate-400">KM</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-medium">Margen de desvío general</span>
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
              {resumen.alertasDesvioCount || 0}
            </h3>
            <span className="text-[10px] text-rose-500 font-bold">Diferencia &gt; 35 KM</span>
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. EXPLICACIÓN DEL CRUCE DE RUTAS
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-slate-950 rounded-3xl p-5 text-white border border-cyan-500/20 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Compass size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-cyan-200">
              Auditoría Inteligente de Rutas vs Odómetros
            </h4>
            <p className="text-xs text-slate-300 max-w-2xl mt-0.5 leading-relaxed">
              El sistema analiza la georreferencia de cada cliente visitado en el día por el técnico, calcula la ruta secuencial y la contrasta contra los kilómetros declarados en las fotos de 7am y 7pm.
            </p>
          </div>
        </div>

        {/* Leyenda Semáforo */}
        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 p-2 rounded-2xl shrink-0 text-[11px]">
          <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Conforme
          </span>
          <span className="text-slate-600">|</span>
          <span className="inline-flex items-center gap-1 font-bold text-rose-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Desvío Crítico (&gt;35km)
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. TABLA COMPARATIVA CON SEMÁFORO DE AUDITORÍA
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        
        {/* HEADER DE FILTROS */}
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Filtrar por técnico, placa o cuadrilla..."
              className="w-full pl-10 pr-4 py-2 bg-white text-xs font-medium text-slate-800 placeholder-slate-400 rounded-2xl border border-slate-200 focus:border-cyan-500 focus:outline-none transition-all shadow-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setFiltroAlerta("todas")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filtroAlerta === "todas" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
              }`}
            >
              Todas ({inspecciones.length})
            </button>
            <button
              onClick={() => setFiltroAlerta("alertas")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                filtroAlerta === "alertas" ? "bg-rose-600 text-white shadow-xs" : "text-slate-600 hover:text-rose-600"
              }`}
            >
              <AlertTriangle size={13} />
              Alertas ({alertasDesvio.length})
            </button>
            <button
              onClick={() => setFiltroAlerta("conformes")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filtroAlerta === "conformes" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600"
              }`}
            >
              Conformes
            </button>
          </div>
        </div>

        {/* TABLA PRINCIPAL */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm font-semibold">
            Calculando métricas y distancias...
          </div>
        ) : filasFiltradas.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No se encontraron registros de recorrido.
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
                  <th className="py-3 px-4 text-center">KM Estimado (Órdenes)</th>
                  <th className="py-3 px-4 text-center bg-indigo-50/50 text-indigo-900">KM Real GPS (App)</th>
                  <th className="py-3 px-4 text-center">Diferencia</th>
                  <th className="py-3 px-4 text-center">Estado Auditoría</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filasFiltradas.map((insp) => {
                  const kmDec = Number(insp.km_recorridos) || 0;
                  const kmEst = Number(insp.km_estimados_ordenes) || 0;
                  const kmGps = Number(insp.km_gps_app) || kmEst;
                  const diff = kmDec - (kmGps || kmEst);
                  const esAlerta = diff > 35 && kmDec > 0;

                  return (
                    <tr
                      key={insp.id_inspeccion}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        esAlerta ? "bg-rose-50/30" : ""
                      }`}
                    >
                      {/* Fecha */}
                      <td className="py-3.5 px-4 font-bold text-slate-700 font-mono whitespace-nowrap">
                        {insp.fecha}
                      </td>

                      {/* Técnico & Alerta de Inicio */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[11px] shrink-0">
                            <User size={14} />
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-800 block truncate max-w-[180px]">
                              {insp.nombre_tecnico || "Técnico"}
                            </span>
                            <div className="flex items-center gap-1 flex-wrap">
                              {insp.cuadrilla && (
                                <span className="text-[10px] text-teal-700 font-bold font-mono">
                                  {insp.cuadrilla}
                                </span>
                              )}
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
                          const esMoto =
                            (insp.modelo || "").toLowerCase().includes("gl") ||
                            (insp.modelo || "").toLowerCase().includes("pulsar") ||
                            (insp.cuadrilla || "").toLowerCase().includes("motowin") ||
                            (insp.placa || "").includes("-E") ||
                            (insp.placa || "").includes("-K");

                          return (
                            <div className="flex items-center gap-1.5">
                              {esMoto ? (
                                <Bike size={15} className="text-amber-500 shrink-0" />
                              ) : (
                                <Car size={14} className="text-cyan-600 shrink-0" />
                              )}
                              <span className="font-extrabold text-slate-900 font-mono tracking-wider">
                                {insp.placa || "S/P"}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ({insp.modelo || (esMoto ? "Moto Propia" : "Vehículo")})
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* KM Mañana & Hora Dinámica */}
                      <td className="py-3.5 px-4 text-center font-mono">
                        <div className="text-slate-900 font-bold text-xs">
                          {insp.km_inicio ? `${insp.km_inicio.toLocaleString()} km` : "--"}
                        </div>
                        <span className="text-[10px] text-emerald-700 font-semibold block">
                          ⏰ {insp.hora_inicio_real || insp.hora_inicio || "07:00 AM"}
                        </span>
                      </td>

                      {/* KM Noche & Hora Dinámica de Cierre */}
                      <td className="py-3.5 px-4 text-center font-mono">
                        <div className="text-slate-900 font-bold text-xs">
                          {insp.km_fin ? `${insp.km_fin.toLocaleString()} km` : "En curso"}
                        </div>
                        <span className="text-[10px] text-slate-500 font-semibold block">
                          {insp.km_fin ? `🌙 ${insp.hora_cierre_real || insp.hora_fin || "-"}` : "Pendiente"}
                        </span>
                      </td>

                      {/* KM Declarado */}
                      <td className="py-3.5 px-4 text-center font-mono font-black text-slate-900 bg-slate-50/50">
                        {kmDec > 0 ? `${kmDec} km` : "--"}
                      </td>

                      {/* KM Estimado (Órdenes) con botón Ver Ruta */}
                      <td className="py-3.5 px-4 text-center bg-teal-50/30">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-mono font-black text-xs text-teal-950">
                            {kmEst > 0 ? `${kmEst} km` : "--"}
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
                              title="Ver trazado satelital de clientes visitados"
                            >
                              <MapPin size={10} />
                              <span>Ruta Clientes</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-normal">Sin órdenes</span>
                          )}
                        </div>
                      </td>

                      {/* KM Real GPS (App) & Botón Ver Mapa */}
                      <td className="py-3.5 px-4 text-center bg-indigo-50/30">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-mono font-black text-xs text-indigo-950">
                            {kmGps > 0 ? `${kmGps} km` : "--"}
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
                            {diff > 0 ? `+${diff}` : diff} km
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal text-xs">--</span>
                        )}
                      </td>

                      {/* Estado Semáforo */}
                      <td className="py-3.5 px-4 text-center">
                        {kmDec === 0 ? (
                          <span className="text-[11px] text-slate-400 font-bold">En Progreso</span>
                        ) : esAlerta ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                            <ShieldAlert size={14} />
                            🚨 Desvío Crítico
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <ShieldCheck size={14} />
                            🟢 Conforme
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
          4. MODAL DEL RECORRIDO EN MAPA PARA EL ADMINISTRADOR
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
