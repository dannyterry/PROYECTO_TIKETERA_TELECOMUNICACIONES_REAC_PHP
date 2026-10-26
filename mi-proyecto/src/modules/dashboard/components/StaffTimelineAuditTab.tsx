import React, { useState, useEffect, useMemo } from "react";
import {
  Clock,
  Calendar,
  Search,
  Filter,
  Users,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  Activity,
  MapPin,
  Laptop,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Eye,
  Info
} from "lucide-react";
import { API_URL } from "../../../config/api";

export interface TimelineSegment {
  inicio: string;
  fin: string;
  inicioFormato: string;
  finFormato: string;
  minutos: number;
  leftPct: number;
  widthPct: number;
}

export interface UsuarioTimeline {
  id_usuario: number;
  nombre_completo: string;
  email?: string;
  usuario?: string;
  id_rol?: number;
  rol_nombre?: string;
  area?: string;
  distrito?: string;
  distrito_conexion?: string;
  foto_personal?: string | null;
  ultimo_acceso?: string | null;
  esta_online: number;
  hora_primer_ingreso?: string | null;
  hora_ultimo_acceso?: string | null;
  hora_primer_ingreso_formato: string;
  hora_ultimo_acceso_formato: string;
  minutos_totales: number;
  tiempo_conectado_formato: string;
  ultima_accion?: string;
  ip_address?: string;
  segmentosGrafico: TimelineSegment[];
}

interface TimelineResponse {
  success: boolean;
  fecha: string;
  resumen: {
    totalPersonal: number;
    totalActivosEnDia: number;
    totalOnlineAhora: number;
    promedioHoraIngreso: string;
    promedioHorasTrabajadas: string;
  };
  usuarios: UsuarioTimeline[];
}

// Horas mostradas en el gráfico de 06:00 AM a 22:00 PM (16 horas)
const HORAS_REGLA = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00"
];

const RANGO_INICIO_MIN = 6 * 60; // 06:00 = 360
const RANGO_FIN_MIN = 22 * 60;   // 22:00 = 1320
const RANGO_DURACION_MIN = RANGO_FIN_MIN - RANGO_INICIO_MIN; // 960

export const StaffTimelineAuditTab: React.FC = () => {
  const getTodayStr = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(getTodayStr);
  const [dataTimeline, setDataTimeline] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filtroArea, setFiltroArea] = useState<string>("Todos");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "online" | "activos">("todos");
  const [busqueda, setBusqueda] = useState<string>("");
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<UsuarioTimeline | null>(null);

  // Calcular la posición porcentual de la hora actual en tiempo real para la fecha de hoy
  const porcentajeHoraActual = useMemo(() => {
    const hoyStr = getTodayStr();
    if (fechaSeleccionada !== hoyStr) return null;
    const now = new Date();
    const minutosActuales = now.getHours() * 60 + now.getMinutes();
    if (minutosActuales < RANGO_INICIO_MIN || minutosActuales > RANGO_FIN_MIN) return null;
    return ((minutosActuales - RANGO_INICIO_MIN) / RANGO_DURACION_MIN) * 100;
  }, [fechaSeleccionada]);

  const cargarDatos = async (fecha: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/auditoria/jornada-timeline?fecha=${fecha}`);
      const json: TimelineResponse = await res.json();
      if (json.success) {
        setDataTimeline(json);
      }
    } catch (err) {
      console.error("Error al cargar timeline de jornada:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos(fechaSeleccionada);
  }, [fechaSeleccionada]);

  // Cambiar día con botones rápidos
  const cambiarDia = (offset: number) => {
    const [y, m, d] = fechaSeleccionada.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + offset);
    const pad = (n: number) => String(n).padStart(2, "0");
    const nuevaFecha = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    setFechaSeleccionada(nuevaFecha);
  };

  // Áreas únicas para filtro
  const areasDisponibles = useMemo(() => {
    if (!dataTimeline?.usuarios) return [];
    const setAreas = new Set<string>();
    dataTimeline.usuarios.forEach((u) => {
      const a = u.area || u.rol_nombre;
      if (a) setAreas.add(a);
    });
    return Array.from(setAreas);
  }, [dataTimeline]);

  // Filtrado de usuarios
  const usuariosFiltrados = useMemo(() => {
    if (!dataTimeline?.usuarios) return [];
    return dataTimeline.usuarios.filter((u) => {
      // Filtro área
      if (filtroArea !== "Todos") {
        const userArea = (u.area || u.rol_nombre || "").toLowerCase();
        if (!userArea.includes(filtroArea.toLowerCase())) return false;
      }
      // Filtro estado
      if (filtroEstado === "online" && u.esta_online !== 1) return false;
      if (filtroEstado === "activos" && u.minutos_totales <= 0 && !u.hora_primer_ingreso) return false;

      // Filtro búsqueda
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        const matchNombre = (u.nombre_completo || "").toLowerCase().includes(q);
        const matchRol = (u.rol_nombre || "").toLowerCase().includes(q);
        const matchArea = (u.area || "").toLowerCase().includes(q);
        if (!matchNombre && !matchRol && !matchArea) return false;
      }
      return true;
    });
  }, [dataTimeline, filtroArea, filtroEstado, busqueda]);

  // Exportar a CSV
  const exportarCSV = () => {
    if (!usuariosFiltrados.length) return;
    const encabezados = [
      "ID",
      "Nombre Completo",
      "Rol / Cargo",
      "Area",
      "Estado",
      "Hora Entrada (Primer Inicio)",
      "Hora Salida (Ultimo Acceso)",
      "Minutos Totales",
      "Tiempo Formateado",
      "Ultima Accion",
      "IP Conexion"
    ];

    const filas = usuariosFiltrados.map((u) => [
      u.id_usuario,
      `"${u.nombre_completo || ""}"`,
      `"${u.rol_nombre || ""}"`,
      `"${u.area || ""}"`,
      u.esta_online ? "ONLINE" : "OFFLINE",
      u.hora_primer_ingreso_formato,
      u.hora_ultimo_acceso_formato,
      u.minutos_totales,
      `"${u.tiempo_conectado_formato}"`,
      `"${(u.ultima_accion || "").replace(/"/g, '""')}"`,
      u.ip_address || ""
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [encabezados.join(","), ...filas.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Jornada_Timeline_${fechaSeleccionada}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 🧭 ENCABEZADO Y CONTROLES SUPERIORES */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  Control de Jornada & Línea de Tiempo del Personal
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
                  En Vivo 24/7
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoreo visual de horas de inicio, última interacción y tiempo acumulado en el sistema por usuario.
              </p>
            </div>
          </div>

          {/* CONTROLES DE FECHA Y EXPORTACIÓN */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Controles de Día Anterior / Hoy / Día Siguiente */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-2xs">
              <button
                onClick={() => cambiarDia(-1)}
                className="p-1.5 rounded-xl hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                title="Día anterior"
              >
                <ChevronLeft size={16} />
              </button>

              <button
                onClick={() => setFechaSeleccionada(getTodayStr())}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  fechaSeleccionada === getTodayStr()
                    ? "bg-white text-sky-700 shadow-xs border border-slate-200/60"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Hoy
              </button>

              <button
                onClick={() => cambiarDia(1)}
                className="p-1.5 rounded-xl hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                title="Día siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Input Date Picker */}
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={fechaSeleccionada}
                onChange={(e) => setFechaSeleccionada(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-2xl pl-8 pr-3 py-2 focus:outline-none focus:border-sky-500 shadow-2xs cursor-pointer"
              />
            </div>

            {/* Botón Refrescar */}
            <button
              onClick={() => cargarDatos(fechaSeleccionada)}
              disabled={loading}
              className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-2xl transition-all cursor-pointer shadow-2xs"
              title="Refrescar datos"
            >
              <RefreshCw size={15} className={loading ? "animate-spin text-sky-600" : ""} />
            </button>

            {/* Botón Exportar */}
            <button
              onClick={exportarCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-2xl border border-emerald-200 transition-all cursor-pointer shadow-2xs"
            >
              <Download size={14} />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* 📊 TARJETAS KPI DE RESUMEN DEL DÍA */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div className="bg-gradient-to-br from-sky-50/80 to-white p-4 rounded-2xl border border-sky-100 shadow-2xs">
            <div className="flex items-center justify-between text-sky-700">
              <span className="text-[11px] font-black uppercase tracking-wider">Personal Activo Hoy</span>
              <Users className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
              {dataTimeline?.resumen?.totalActivosEnDia ?? 0}
              <span className="text-xs text-slate-400 font-normal ml-1">
                / {dataTimeline?.resumen?.totalPersonal ?? 0}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Colaboradores que iniciaron jornada</span>
          </div>

          <div className="bg-gradient-to-br from-emerald-50/80 to-white p-4 rounded-2xl border border-emerald-100 shadow-2xs">
            <div className="flex items-center justify-between text-emerald-700">
              <span className="text-[11px] font-black uppercase tracking-wider">En Línea Ahora</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
              {dataTimeline?.resumen?.totalOnlineAhora ?? 0}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Conectados en este momento</span>
          </div>

          <div className="bg-gradient-to-br from-amber-50/80 to-white p-4 rounded-2xl border border-amber-100 shadow-2xs">
            <div className="flex items-center justify-between text-amber-700">
              <span className="text-[11px] font-black uppercase tracking-wider">Hora Promedio Entrada</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
              {dataTimeline?.resumen?.promedioHoraIngreso || "--:--"}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Primer acceso promedio</span>
          </div>

          <div className="bg-gradient-to-br from-indigo-50/80 to-white p-4 rounded-2xl border border-indigo-100 shadow-2xs">
            <div className="flex items-center justify-between text-indigo-700">
              <span className="text-[11px] font-black uppercase tracking-wider">Tiempo Promedio Activo</span>
              <Activity className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
              {dataTimeline?.resumen?.promedioHorasTrabajadas || "0m"}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Horas en el sistema por usuario</span>
          </div>
        </div>

        {/* 🔍 FILTROS IN SITU: BUSCADOR + ÁREA + ESTADO */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Buscador */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por colaborador o cargo..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Selector de Área */}
            <select
              value={filtroArea}
              onChange={(e) => setFiltroArea(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="Todos">Todas las Áreas</option>
              {areasDisponibles.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>

            {/* Pills de Estado */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => setFiltroEstado("todos")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filtroEstado === "todos"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Todos ({dataTimeline?.usuarios?.length || 0})
              </button>
              <button
                onClick={() => setFiltroEstado("activos")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filtroEstado === "activos"
                    ? "bg-white text-sky-700 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Solo Activos ({dataTimeline?.resumen?.totalActivosEnDia || 0})
              </button>
              <button
                onClick={() => setFiltroEstado("online")}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  filtroEstado === "online"
                    ? "bg-white text-emerald-700 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Online ({dataTimeline?.resumen?.totalOnlineAhora || 0})
              </button>
            </div>
          </div>

          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
            <Info size={13} className="text-sky-500" />
            <span>Rango visible: 06:00 AM - 10:00 PM</span>
          </div>
        </div>
      </div>

      {/* ⏱️ TABLA + GRÁFICO HORIZONTAL DE LÍNEA DE TIEMPO (TIMELINE GANTT) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Cabecera del Timeline */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <TrendingUp size={16} className="text-sky-600" />
              Línea de Tiempo de Horarios y Actividad Diaria
            </h3>
            <p className="text-[11px] text-slate-500">
              Franja horaria horizontal que muestra de qué hora a qué hora estuvo conectado cada usuario.
            </p>
          </div>

          {/* Leyenda de Colores */}
          <div className="flex items-center gap-3 text-[11px] font-bold">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-3 h-3 rounded-md bg-gradient-to-r from-emerald-400 to-teal-500 border border-emerald-300"></span>
              Conectado / Online Ahora
            </span>
            <span className="flex items-center gap-1.5 text-sky-800">
              <span className="w-3 h-3 rounded-md bg-gradient-to-r from-sky-400 to-indigo-500 border border-sky-300"></span>
              Jornada Registrada
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-3 h-3 rounded-md bg-slate-200 border border-slate-300"></span>
              Sin Conexión
            </span>
          </div>
        </div>

        {/* CONTENEDOR CON SCROLL HORIZONTAL PARA EL TIMELINE */}
        <div className="overflow-x-auto">
          <div className="min-w-[1000px]">
            {/* 1. REGLA DE TIEMPO HORIZONTAL */}
            <div className="flex border-b border-slate-200 bg-slate-100/70 text-[10px] font-mono font-bold text-slate-600 sticky top-0 z-20">
              {/* Columna Usuario (Ancho fijo: 280px) */}
              <div className="w-[300px] shrink-0 px-4 py-2.5 border-r border-slate-200 uppercase tracking-wider text-slate-500">
                Colaborador / Área
              </div>

              {/* Columna Horas Métricas (180px) */}
              <div className="w-[180px] shrink-0 px-3 py-2.5 border-r border-slate-200 uppercase tracking-wider text-slate-500 flex justify-between">
                <span>Entrada</span>
                <span>Salida</span>
                <span>Total</span>
              </div>

              {/* Regla Horaria (El resto del ancho distribuido uniformemente) */}
              <div className="flex-1 relative flex">
                {HORAS_REGLA.map((hora, idx) => (
                  <div
                    key={hora}
                    className="flex-1 border-r border-slate-200/80 px-1 py-2.5 text-center truncate last:border-r-0"
                  >
                    {hora}
                  </div>
                ))}
              </div>
            </div>

            {/* 2. FILAS DE USUARIOS CON LÍNEA DE TIEMPO */}
            {loading ? (
              <div className="py-20 text-center space-y-3">
                <RefreshCw className="w-8 h-8 mx-auto animate-spin text-sky-500" />
                <p className="text-xs text-slate-500 font-bold">Cargando línea de tiempo de jornada...</p>
              </div>
            ) : usuariosFiltrados.length === 0 ? (
              <div className="py-20 text-center space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-sm font-bold text-slate-600">No se encontraron usuarios para esta fecha o filtros</p>
                <p className="text-xs text-slate-400">Prueba cambiando la fecha o seleccionando otra área.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {usuariosFiltrados.map((u) => {
                  const isOnline = u.esta_online === 1;
                  const tieneJornada = u.hora_primer_ingreso && u.hora_primer_ingreso !== "--:--";
                  const initials = (u.nombre_completo || "US")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase();

                  return (
                    <div
                      key={u.id_usuario}
                      onClick={() => setUsuarioSeleccionado(usuarioSeleccionado?.id_usuario === u.id_usuario ? null : u)}
                      className={`flex items-center hover:bg-slate-50/80 transition-colors group cursor-pointer ${
                        usuarioSeleccionado?.id_usuario === u.id_usuario ? "bg-sky-50/50" : ""
                      }`}
                    >
                      {/* COLUMNA 1: DATOS DEL COLABORADOR */}
                      <div className="w-[300px] shrink-0 p-3.5 border-r border-slate-100 flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs border ${
                              isOnline
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-sky-50 text-sky-800 border-sky-200"
                            }`}
                          >
                            {initials}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                              isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                            }`}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-900 truncate" title={u.nombre_completo}>
                            {u.nombre_completo}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-sky-100/70 text-sky-800 border border-sky-200">
                              {u.rol_nombre || u.area || "Personal"}
                            </span>
                            {u.distrito && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
                                <MapPin size={8} />
                                {u.distrito}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* COLUMNA 2: MÉTRICAS DE HORAS */}
                      <div className="w-[180px] shrink-0 px-3 py-3 border-r border-slate-100 font-mono text-xs flex items-center justify-between text-slate-700">
                        {/* Entrada */}
                        <div className="text-left">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                              tieneJornada
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "text-slate-300"
                            }`}
                          >
                            {u.hora_primer_ingreso_formato}
                          </span>
                        </div>

                        {/* Salida */}
                        <div className="text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                              tieneJornada
                                ? "bg-sky-50 text-sky-800 border border-sky-200"
                                : "text-slate-300"
                            }`}
                          >
                            {u.hora_ultimo_acceso_formato}
                          </span>
                        </div>

                        {/* Tiempo Total */}
                        <div className="text-right">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                              u.minutos_totales > 0
                                ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                : "text-slate-300"
                            }`}
                          >
                            {u.tiempo_conectado_formato}
                          </span>
                        </div>
                      </div>

                      {/* COLUMNA 3: BARRA HORIZONTAL DEL TIMELINE (06:00 a 22:00) */}
                      <div className="flex-1 relative h-12 flex items-center px-1">
                        {/* Líneas guía verticales horarias */}
                        <div className="absolute inset-0 flex pointer-events-none">
                          {HORAS_REGLA.map((h, i) => (
                            <div
                              key={h}
                              className="flex-1 border-r border-slate-100/80 last:border-r-0"
                            />
                          ))}
                        </div>

                        {/* Línea roja de hora actual si la fecha es hoy */}
                        {porcentajeHoraActual !== null && (
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10 pointer-events-none"
                            style={{ left: `${porcentajeHoraActual}%` }}
                            title="Hora actual"
                          >
                            <span className="w-2 h-2 rounded-full bg-rose-500 -ml-[3px] -mt-1 block"></span>
                          </div>
                        )}

                        {/* BARRAS DE INTERVALOS ACTIVOS */}
                        {u.segmentosGrafico && u.segmentosGrafico.length > 0 ? (
                          u.segmentosGrafico.map((seg, idx) => (
                            <div
                              key={idx}
                              className={`absolute h-7 rounded-xl shadow-xs border transition-all duration-300 flex items-center justify-between px-2 text-[10px] font-bold text-white z-10 group/bar ${
                                isOnline
                                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-400 hover:brightness-105"
                                  : "bg-gradient-to-r from-sky-500 to-indigo-600 border-sky-400 hover:brightness-105"
                              }`}
                              style={{
                                left: `${seg.leftPct}%`,
                                width: `${seg.widthPct}%`,
                                minWidth: "24px"
                              }}
                              title={`${u.nombre_completo}\nDe: ${seg.inicioFormato} a ${seg.finFormato}\nDuración: ${seg.minutos} min\nÚltima acción: ${u.ultima_accion || "Activo"}`}
                            >
                              <span className="truncate drop-shadow-xs font-mono text-[9px]">
                                {seg.inicioFormato} - {seg.finFormato}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="w-full text-center text-[11px] text-slate-300 font-semibold italic">
                            Sin actividad en el sistema en esta fecha
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 📋 DETALLE DESPLEGABLE DEL USUARIO SELECCIONADO */}
        {usuarioSeleccionado && (
          <div className="p-5 border-t border-slate-200 bg-sky-50/40 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sky-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-sky-200 flex items-center justify-center font-black text-sky-800 text-xs shadow-2xs">
                  {usuarioSeleccionado.nombre_completo.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    Detalle de Jornada: {usuarioSeleccionado.nombre_completo}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {usuarioSeleccionado.rol_nombre || "Personal"} • Fecha auditada: {fechaSeleccionada}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setUsuarioSeleccionado(null)}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold px-2 py-1 rounded-lg hover:bg-white transition-all cursor-pointer"
              >
                Cerrar Detalle ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3">
              <div className="bg-white p-3 rounded-2xl border border-sky-100 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Primer Ingreso del Día</span>
                <span className="text-base font-black text-emerald-700 font-mono mt-0.5 block">
                  {usuarioSeleccionado.hora_primer_ingreso_formato}
                </span>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-sky-100 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Última Desconexión / Ping</span>
                <span className="text-base font-black text-sky-800 font-mono mt-0.5 block">
                  {usuarioSeleccionado.hora_ultimo_acceso_formato}
                </span>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-sky-100 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Tiempo Conectado Acumulado</span>
                <span className="text-base font-black text-indigo-700 font-mono mt-0.5 block">
                  {usuarioSeleccionado.tiempo_conectado_formato}
                </span>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-sky-100 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Última Acción en Plataforma</span>
                <span className="text-xs font-bold text-slate-800 mt-0.5 block truncate" title={usuarioSeleccionado.ultima_accion}>
                  {usuarioSeleccionado.ultima_accion || "Inicio de sesión"}
                </span>
              </div>
            </div>

            {/* Intervalos exactos */}
            {usuarioSeleccionado.segmentosGrafico && usuarioSeleccionado.segmentosGrafico.length > 0 && (
              <div className="mt-3.5 pt-3 border-t border-sky-100/60">
                <span className="text-[11px] font-black text-slate-700 block mb-2 uppercase tracking-wide">
                  Bloques de Conexión & Actividad Registrados ({usuarioSeleccionado.segmentosGrafico.length}):
                </span>
                <div className="flex flex-wrap gap-2">
                  {usuarioSeleccionado.segmentosGrafico.map((seg, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-sky-200 text-xs font-mono font-bold text-slate-800 shadow-2xs"
                    >
                      <Clock size={12} className="text-sky-600" />
                      <span>{seg.inicioFormato}</span>
                      <ArrowRight size={11} className="text-slate-400" />
                      <span>{seg.finFormato}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded-md font-bold">
                        {seg.minutos} min
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
