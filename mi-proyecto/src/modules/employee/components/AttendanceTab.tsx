import React, { useState, useEffect } from "react";
import {
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Coffee,
  FileCheck,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Sparkles,
  Users,
  Car,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  AsistenciaDiariaItem,
  getAsistenciaDiaria,
  marcarAsistencia,
  getMatrizAsistencias,
  getDescansos,
  programarDescanso,
  cancelarDescanso,
  getRoles,
  RolItem,
} from "../../../services/employeeService";

export const AttendanceTab: React.FC = () => {
  const [subTab, setSubTab] = useState<"diario" | "matriz" | "descansos">("diario");
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<RolItem[]>([]);
  const [filtroRol, setFiltroRol] = useState<string>("Todos");

  // --- SubTab 1: Pase Diario ---
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [filtroTexto, setFiltroTexto] = useState("");
  const [asistencias, setAsistencias] = useState<AsistenciaDiariaItem[]>([]);
  const [guardandoId, setGuardandoId] = useState<number | null>(null);

  // --- SubTab 2: Matriz Semanal / Mensual ---
  const [rangoTipo, setRangoTipo] = useState<"semana" | "mes">("semana");
  const [fechaInicioMatriz, setFechaInicioMatriz] = useState<string>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Lunes
    const lunes = new Date(d.setDate(diff));
    return lunes.toISOString().slice(0, 10);
  });
  const [matrizData, setMatrizData] = useState<{
    trabajadores: any[];
    asistencias: any[];
    descansos: any[];
  }>({ trabajadores: [], asistencias: [], descansos: [] });

  // --- SubTab 3: Descansos Programados ---
  const [descansos, setDescansos] = useState<any[]>([]);
  const [modalDescanso, setModalDescanso] = useState(false);
  const [descansoForm, setDescansoForm] = useState({
    id_trabajador: "",
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_fin: new Date().toISOString().slice(0, 10),
    motivo: "",
  });

  // Cargar Roles al iniciar
  useEffect(() => {
    getRoles().then(setRoles).catch(console.error);
  }, []);

  // Cargar Pase Diario
  const cargarPaseDiario = async () => {
    try {
      setLoading(true);
      const res = await getAsistenciaDiaria(fechaSeleccionada, filtroRol);
      setAsistencias(res.asistencias || []);
    } catch (err: any) {
      console.error("Error al cargar pase diario:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === "diario") {
      cargarPaseDiario();
    }
  }, [fechaSeleccionada, filtroRol, subTab]);

  // Cargar Matriz
  const cargarMatriz = async () => {
    try {
      setLoading(true);
      const inicio = new Date(fechaInicioMatriz);
      let fin = new Date(inicio);
      if (rangoTipo === "semana") {
        fin.setDate(fin.getDate() + 6);
      } else {
        fin = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0);
      }
      const finStr = fin.toISOString().slice(0, 10);
      const res = await getMatrizAsistencias(fechaInicioMatriz, finStr, filtroRol);
      setMatrizData(res);
    } catch (err: any) {
      console.error("Error cargando matriz:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === "matriz") {
      cargarMatriz();
    }
  }, [fechaInicioMatriz, rangoTipo, filtroRol, subTab]);

  // Cargar Descansos
  const cargarDescansos = async () => {
    try {
      setLoading(true);
      const data = await getDescansos();
      setDescansos(data || []);
    } catch (err: any) {
      console.error("Error al cargar descansos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === "descansos") {
      cargarDescansos();
    }
  }, [subTab]);

  // 1-Clic: Cambiar Estado de Asistencia
  const handleCambiarEstado = async (
    item: AsistenciaDiariaItem,
    nuevoEstado: "Asistio" | "Tardanza" | "Falta" | "Descanso" | "Permiso"
  ) => {
    try {
      setGuardandoId(item.id_trabajador);
      let hEntrada = item.hora_entrada;
      let minTarde = item.minutos_tarde || 0;

      if (nuevoEstado === "Asistio" && !hEntrada) {
        hEntrada = "07:30:00";
        minTarde = 0;
      } else if (nuevoEstado === "Tardanza" && (!hEntrada || hEntrada === "07:30:00")) {
        hEntrada = "07:45:00";
        minTarde = 15;
      }

      await marcarAsistencia({
        id_trabajador: item.id_trabajador,
        id_usuario: item.id_usuario,
        fecha: fechaSeleccionada,
        estado: nuevoEstado,
        hora_entrada: hEntrada,
        hora_salida: item.hora_salida,
        minutos_tarde: minTarde,
        observacion: item.observacion,
      });

      // Actualizar localmente de inmediato para UX instantánea
      setAsistencias((prev) =>
        prev.map((a) =>
          a.id_trabajador === item.id_trabajador
            ? { ...a, estado: nuevoEstado, hora_entrada: hEntrada, minutos_tarde: minTarde }
            : a
        )
      );
    } catch (err: any) {
      alert("Error al marcar asistencia: " + err.message);
    } finally {
      setGuardandoId(null);
    }
  };

  // Cambio de Hora de Entrada en Línea
  const handleHoraEntradaChange = async (item: AsistenciaDiariaItem, valor: string) => {
    try {
      setGuardandoId(item.id_trabajador);
      const hStr = valor.length === 5 ? `${valor}:00` : valor;

      // Calcular si es tardanza (> 07:35)
      let nuevoEstado = item.estado || "Asistio";
      let minTarde = 0;
      if (valor) {
        const [h, m] = valor.split(":").map(Number);
        const minTotales = h * 60 + m;
        const minPactados = 7 * 60 + 30; // 07:30 AM
        if (minTotales > minPactados + 5) {
          nuevoEstado = "Tardanza";
          minTarde = minTotales - minPactados;
        } else {
          nuevoEstado = "Asistio";
          minTarde = 0;
        }
      }

      await marcarAsistencia({
        id_trabajador: item.id_trabajador,
        id_usuario: item.id_usuario,
        fecha: fechaSeleccionada,
        estado: nuevoEstado,
        hora_entrada: hStr,
        minutos_tarde: minTarde,
        observacion: item.observacion,
      });

      setAsistencias((prev) =>
        prev.map((a) =>
          a.id_trabajador === item.id_trabajador
            ? { ...a, hora_entrada: hStr, estado: nuevoEstado, minutos_tarde: minTarde }
            : a
        )
      );
    } catch (err: any) {
      console.error(err);
    } finally {
      setGuardandoId(null);
    }
  };

  // Programar Descanso Form Submit
  const handleGuardarDescanso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descansoForm.id_trabajador) {
      alert("Selecciona un trabajador");
      return;
    }

    try {
      await programarDescanso({
        id_trabajador: Number(descansoForm.id_trabajador),
        fecha_inicio: descansoForm.fecha_inicio,
        fecha_fin: descansoForm.fecha_fin,
        motivo: descansoForm.motivo,
      });
      setModalDescanso(false);
      cargarDescansos();
    } catch (err: any) {
      alert("Error al programar descanso: " + err.message);
    }
  };

  const handleCancelarDescanso = async (id: number) => {
    if (!window.confirm("¿Seguro de cancelar este descanso programado?")) return;
    try {
      await cancelarDescanso(id);
      cargarDescansos();
    } catch (err: any) {
      alert("Error al cancelar: " + err.message);
    }
  };

  // Filtro de texto para pase diario
  const asistenciasFiltradas = asistencias.filter((a) => {
    const txt = filtroTexto.toLowerCase();
    return (
      !txt ||
      a.nombre_completo.toLowerCase().includes(txt) ||
      a.cuadrilla.toLowerCase().includes(txt) ||
      (a.documento && a.documento.includes(txt)) ||
      (a.vehiculo_placa && a.vehiculo_placa.toLowerCase().includes(txt))
    );
  });

  // Métricas del Día
  const metricas = {
    presentes: asistencias.filter((a) => a.estado === "Asistio").length,
    tardanzas: asistencias.filter((a) => a.estado === "Tardanza").length,
    faltas: asistencias.filter((a) => a.estado === "Falta").length,
    descansos: asistencias.filter((a) => a.estado === "Descanso" || a.tiene_descanso_programado).length,
    permisos: asistencias.filter((a) => a.estado === "Permiso").length,
    pendientes: asistencias.filter((a) => !a.estado).length,
  };

  // Exportar Excel Pase Diario
  const handleExportarExcel = () => {
    const data = asistenciasFiltradas.map((a) => ({
      Fecha: fechaSeleccionada,
      DNI: a.documento,
      "Nombre Completo": a.nombre_completo,
      Rol: a.rol_nombre,
      Cuadrilla: a.cuadrilla || "-",
      "Placa Vehículo": a.vehiculo_placa || "-",
      Estado: a.estado || "No Marcado",
      "Hora Entrada": a.hora_entrada || "-",
      "Minutos Tarde": a.minutos_tarde || 0,
      Observación: a.observacion || "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
    XLSX.writeFile(wb, `Asistencia_${fechaSeleccionada}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER PRINCIPAL Y SUBPESTAÑAS
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold shadow-md shadow-teal-600/20">
            <Clock size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Control de Asistencia & Descansos
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Pase diario rápido WhatsApp, calendario semanal/mensual y programación de descansos
            </p>
          </div>
        </div>

        {/* Selector de Subpestañas */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setSubTab("diario")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              subTab === "diario"
                ? "bg-teal-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Clock size={15} />
            <span>Pase Diario</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("matriz")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              subTab === "matriz"
                ? "bg-teal-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Calendar size={15} />
            <span>Matriz Mensual</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("descansos")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              subTab === "descansos"
                ? "bg-teal-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Coffee size={15} />
            <span>Descansos</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. VISTA 1: PASE DIARIO RÁPIDO
      ───────────────────────────────────────────────────────────── */}
      {subTab === "diario" && (
        <div className="space-y-5">
          {/* Métricas del Día */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 block">
                Asistieron
              </span>
              <span className="text-2xl font-black text-slate-900 font-mono">
                {metricas.presentes}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 block">
                Tardanzas
              </span>
              <span className="text-2xl font-black text-slate-900 font-mono">
                {metricas.tardanzas}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-600 block">
                Faltas
              </span>
              <span className="text-2xl font-black text-slate-900 font-mono">
                {metricas.faltas}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 block">
                Descansos
              </span>
              <span className="text-2xl font-black text-slate-900 font-mono">
                {metricas.descansos}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 block">
                Permisos
              </span>
              <span className="text-2xl font-black text-slate-900 font-mono">
                {metricas.permisos}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Sin Marcar
              </span>
              <span className="text-2xl font-black text-slate-500 font-mono">
                {metricas.pendientes}
              </span>
            </div>
          </div>

          {/* Filtros de Pase Diario */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Fecha */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <Calendar size={15} className="text-teal-600" />
                <input
                  type="date"
                  value={fechaSeleccionada}
                  onChange={(e) => setFechaSeleccionada(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                />
              </div>

              {/* Botón Hoy */}
              <button
                type="button"
                onClick={() => setFechaSeleccionada(new Date().toISOString().slice(0, 10))}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Hoy
              </button>

              {/* Filtro Rol */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <Filter size={15} className="text-teal-600" />
                <select
                  value={filtroRol}
                  onChange={(e) => setFiltroRol(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="Todos">Todos los Roles</option>
                  {roles.map((r) => (
                    <option key={r.id_rol} value={r.id_rol}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-1 sm:flex-initial justify-end">
              {/* Buscador */}
              <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  value={filtroTexto}
                  onChange={(e) => setFiltroTexto(e.target.value)}
                  placeholder="Buscar por nombre o cuadrilla..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-500 transition-all"
                />
              </div>

              {/* Exportar Excel */}
              <button
                type="button"
                onClick={handleExportarExcel}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                title="Exportar pase a Excel"
              >
                <FileSpreadsheet size={15} />
                <span className="hidden sm:inline">Excel</span>
              </button>
            </div>
          </div>

          {/* Tabla de Trabajadores Pase Diario */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-xs font-semibold text-slate-400">
                Cargando lista de personal...
              </div>
            ) : asistenciasFiltradas.length === 0 ? (
              <div className="p-12 text-center text-xs font-medium text-slate-400">
                No se encontraron trabajadores con los filtros seleccionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-5">Personal</th>
                      <th className="py-3.5 px-5">Cuadrilla / Vehículo</th>
                      <th className="py-3.5 px-5 text-center">Estado (1-Clic)</th>
                      <th className="py-3.5 px-5 text-center">Hora Entrada</th>
                      <th className="py-3.5 px-5">Observación Rápida</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {asistenciasFiltradas.map((item) => {
                      const tieneDescanso = Boolean(item.tiene_descanso_programado);
                      const isSaving = guardandoId === item.id_trabajador;

                      return (
                        <tr key={item.id_trabajador} className="hover:bg-slate-50/60 transition-colors">
                          {/* Personal */}
                          <td className="py-3.5 px-5">
                            <div>
                              <span className="font-extrabold text-slate-900 block text-xs">
                                {item.nombre_completo}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                                <span>{item.rol_nombre || "Personal"}</span>
                                {item.documento && <span>• DNI: {item.documento}</span>}
                              </div>
                            </div>
                          </td>

                          {/* Cuadrilla / Vehículo */}
                          <td className="py-3.5 px-5">
                            <div className="space-y-0.5">
                              {item.cuadrilla ? (
                                <span className="inline-block px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-mono font-bold text-[10px]">
                                  {item.cuadrilla}
                                </span>
                              ) : (
                                <span className="text-slate-300 italic text-[10px]">Sin cuadrilla</span>
                              )}
                              {item.vehiculo_placa && (
                                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                                  <Car size={11} className="text-cyan-600" />
                                  <span>{item.vehiculo_placa}</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Botones de Estado 1-Clic */}
                          <td className="py-3.5 px-5">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {/* Asistió */}
                              <button
                                type="button"
                                onClick={() => handleCambiarEstado(item, "Asistio")}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer ${
                                  item.estado === "Asistio"
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                                }`}
                              >
                                Asistió
                              </button>

                              {/* Tardanza */}
                              <button
                                type="button"
                                onClick={() => handleCambiarEstado(item, "Tardanza")}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer ${
                                  item.estado === "Tardanza"
                                    ? "bg-amber-500 text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700"
                                }`}
                              >
                                Tardanza
                              </button>

                              {/* Falta */}
                              <button
                                type="button"
                                onClick={() => handleCambiarEstado(item, "Falta")}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer ${
                                  item.estado === "Falta"
                                    ? "bg-red-600 text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-700"
                                }`}
                              >
                                Falta
                              </button>

                              {/* Descanso */}
                              <button
                                type="button"
                                onClick={() => handleCambiarEstado(item, "Descanso")}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer ${
                                  item.estado === "Descanso" || tieneDescanso
                                    ? "bg-blue-600 text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                                }`}
                              >
                                {tieneDescanso ? "Descanso (Prog)" : "Descanso"}
                              </button>

                              {/* Permiso */}
                              <button
                                type="button"
                                onClick={() => handleCambiarEstado(item, "Permiso")}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer ${
                                  item.estado === "Permiso"
                                    ? "bg-purple-600 text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-purple-50 hover:text-purple-700"
                                }`}
                              >
                                Permiso
                              </button>
                            </div>
                          </td>

                          {/* Hora Entrada */}
                          <td className="py-3.5 px-5 text-center">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="time"
                                defaultValue={item.hora_entrada ? item.hora_entrada.slice(0, 5) : ""}
                                onBlur={(e) => handleHoraEntradaChange(item, e.target.value)}
                                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-teal-500"
                              />
                              {isSaving && <RotateCw size={12} className="animate-spin text-teal-600" />}
                            </div>
                            {item.minutos_tarde && item.minutos_tarde > 0 ? (
                              <span className="text-[10px] text-amber-600 font-bold block mt-0.5 font-mono">
                                +{item.minutos_tarde}m tarde
                              </span>
                            ) : null}
                          </td>

                          {/* Observación */}
                          <td className="py-3.5 px-5">
                            <input
                              type="text"
                              defaultValue={item.observacion || ""}
                              placeholder="Nota WhatsApp..."
                              onBlur={(e) => {
                                if (e.target.value !== item.observacion) {
                                  marcarAsistencia({
                                    id_trabajador: item.id_trabajador,
                                    id_usuario: item.id_usuario,
                                    fecha: fechaSeleccionada,
                                    estado: item.estado || "Asistio",
                                    observacion: e.target.value,
                                  });
                                }
                              }}
                              className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-700 focus:bg-white focus:outline-none focus:border-teal-500"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. VISTA 2: MATRIZ MENSUAL / SEMANAL
      ───────────────────────────────────────────────────────────── */}
      {subTab === "matriz" && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setRangoTipo("semana")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    rangoTipo === "semana" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
                  }`}
                >
                  Semana
                </button>
                <button
                  type="button"
                  onClick={() => setRangoTipo("mes")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    rangoTipo === "mes" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
                  }`}
                >
                  Mes Completo
                </button>
              </div>

              <input
                type="date"
                value={fechaInicioMatriz}
                onChange={(e) => setFechaInicioMatriz(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Presente
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Tardanza
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Falta
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Descanso
              </span>
            </div>
          </div>

          {/* Matriz Gráfica */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-xs font-semibold text-slate-400">
                Generando matriz de asistencia...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase">
                    <tr>
                      <th className="py-3 px-4 min-w-[180px]">Personal</th>
                      {(() => {
                        const diasCols = [];
                        const inicio = new Date(fechaInicioMatriz);
                        const cant = rangoTipo === "semana" ? 7 : 30;
                        for (let i = 0; i < cant; i++) {
                          const cur = new Date(inicio);
                          cur.setDate(cur.getDate() + i);
                          const diaSemana = cur.toLocaleDateString("es-ES", { weekday: "short" });
                          const diaNum = cur.getDate();
                          diasCols.push(
                            <th key={i} className="py-2 px-2 text-center min-w-[42px]">
                              <span className="block text-[9px] text-slate-400 uppercase">{diaSemana}</span>
                              <span className="block text-xs font-mono font-bold text-slate-800">{diaNum}</span>
                            </th>
                          );
                        }
                        return diasCols;
                      })()}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {matrizData.trabajadores.map((t) => (
                      <tr key={t.id_trabajador} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-sans font-bold text-slate-800 text-xs truncate max-w-[200px]">
                          {t.nombre_completo}
                        </td>
                        {(() => {
                          const cells = [];
                          const inicio = new Date(fechaInicioMatriz);
                          const cant = rangoTipo === "semana" ? 7 : 30;
                          for (let i = 0; i < cant; i++) {
                            const cur = new Date(inicio);
                            cur.setDate(cur.getDate() + i);
                            const curStr = cur.toISOString().slice(0, 10);

                            const asist = matrizData.asistencias.find(
                              (a) => a.id_trabajador === t.id_trabajador && a.fecha.slice(0, 10) === curStr
                            );
                            const desc = matrizData.descansos.find(
                              (d) =>
                                d.id_trabajador === t.id_trabajador &&
                                curStr >= d.fecha_inicio.slice(0, 10) &&
                                curStr <= d.fecha_fin.slice(0, 10)
                            );

                            let bgClass = "bg-slate-50 text-slate-300";
                            let iconText = "-";

                            if (asist) {
                              if (asist.estado === "Asistio") {
                                bgClass = "bg-emerald-100 text-emerald-800 font-bold";
                                iconText = "P";
                              } else if (asist.estado === "Tardanza") {
                                bgClass = "bg-amber-100 text-amber-800 font-bold";
                                iconText = "T";
                              } else if (asist.estado === "Falta") {
                                bgClass = "bg-red-100 text-red-800 font-bold";
                                iconText = "F";
                              } else if (asist.estado === "Descanso") {
                                bgClass = "bg-blue-100 text-blue-800 font-bold";
                                iconText = "D";
                              } else if (asist.estado === "Permiso") {
                                bgClass = "bg-purple-100 text-purple-800 font-bold";
                                iconText = "J";
                              }
                            } else if (desc) {
                              bgClass = "bg-blue-50 text-blue-600 font-bold";
                              iconText = "D";
                            }

                            cells.push(
                              <td key={i} className="py-2 px-1 text-center">
                                <span
                                  className={`inline-block w-7 h-7 rounded-lg text-xs leading-7 text-center ${bgClass}`}
                                  title={`${curStr}: ${asist?.estado || (desc ? "Descanso" : "Sin marcar")}`}
                                >
                                  {iconText}
                                </span>
                              </td>
                            );
                          }
                          return cells;
                        })()}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. VISTA 3: DESCANSOS PROGRAMADOS
      ───────────────────────────────────────────────────────────── */}
      {subTab === "descansos" && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900">Programación de Descansos Semanales</h3>
              <p className="text-xs text-slate-500 font-medium">
                Los descansos marcados aquí alertan automáticamente en el portal del técnico y en el pase de asistencia
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalDescanso(true)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-teal-600/20 transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>Programar Descanso</span>
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            {descansos.length === 0 ? (
              <div className="p-12 text-center text-xs font-medium text-slate-400">
                No hay descansos programados registrados.
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="py-3.5 px-5">Trabajador</th>
                    <th className="py-3.5 px-5">Cuadrilla</th>
                    <th className="py-3.5 px-5">Fecha Inicio</th>
                    <th className="py-3.5 px-5">Fecha Fin</th>
                    <th className="py-3.5 px-5">Motivo</th>
                    <th className="py-3.5 px-5 text-center">Estado</th>
                    <th className="py-3.5 px-5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {descansos.map((d) => (
                    <tr key={d.id_descanso} className="hover:bg-slate-50/60">
                      <td className="py-3.5 px-5 font-bold text-slate-900">{d.nombre_completo}</td>
                      <td className="py-3.5 px-5">
                        <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-mono text-[10px] font-bold">
                          {d.cuadrilla || "-"}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-mono font-bold text-slate-800">{d.fecha_inicio.slice(0, 10)}</td>
                      <td className="py-3.5 px-5 font-mono font-bold text-slate-800">{d.fecha_fin.slice(0, 10)}</td>
                      <td className="py-3.5 px-5 text-slate-600">{d.motivo || "Descanso semanal regular"}</td>
                      <td className="py-3.5 px-5 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                          {d.estado}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        {d.estado !== "Cancelado" && (
                          <button
                            type="button"
                            onClick={() => handleCancelarDescanso(d.id_descanso)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                            title="Cancelar descanso"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal Programar Descanso */}
      {modalDescanso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold">
                  <Coffee size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Programar Descanso</h3>
                  <p className="text-xs text-slate-500 font-medium">Asigna días de descanso o guardia</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalDescanso(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarDescanso} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Trabajador *</label>
                <select
                  required
                  value={descansoForm.id_trabajador}
                  onChange={(e) => setDescansoForm((prev) => ({ ...prev, id_trabajador: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                >
                  <option value="">-- Seleccionar Trabajador --</option>
                  {asistencias.map((a) => (
                    <option key={a.id_trabajador} value={a.id_trabajador}>
                      {a.nombre_completo} ({a.cuadrilla || a.rol_nombre})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Fecha Inicio *</label>
                  <input
                    type="date"
                    required
                    value={descansoForm.fecha_inicio}
                    onChange={(e) => setDescansoForm((prev) => ({ ...prev, fecha_inicio: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Fecha Fin *</label>
                  <input
                    type="date"
                    required
                    value={descansoForm.fecha_fin}
                    onChange={(e) => setDescansoForm((prev) => ({ ...prev, fecha_fin: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Motivo / Tipo</label>
                <input
                  type="text"
                  placeholder="ej. Descanso semanal, guardia compensatoria..."
                  value={descansoForm.motivo}
                  onChange={(e) => setDescansoForm((prev) => ({ ...prev, motivo: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalDescanso(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold"
                >
                  Guardar Descanso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
