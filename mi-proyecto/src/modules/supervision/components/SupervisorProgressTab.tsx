import React, { useState, useEffect } from "react";
import {
  Target,
  Users,
  CheckCircle2,
  Clock,
  Navigation,
  Play,
  CheckCheck,
  Star,
  RefreshCw,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  HardHat,
  Sparkles,
  Award,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { supervisionService } from "../services/supervisionService";
import { authService } from "../../../services/authService";
import { SupervisorAvanceDiario } from "../types/supervisionTypes";

interface SupervisorProgressTabProps {
  onGoToCampo?: () => void;
  onGoToCliente?: () => void;
}

export const SupervisorProgressTab: React.FC<SupervisorProgressTabProps> = ({
  onGoToCampo,
  onGoToCliente,
}) => {
  const currentUser = authService.getCurrentUser();
  const [fecha, setFecha] = useState<string>(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState<boolean>(true);
  const [avanceData, setAvanceData] = useState<any | null>(null);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<number | null>(null);

  const cargarAvance = async (selectedDate = fecha) => {
    setLoading(true);
    try {
      const data = await supervisionService.getAvanceDiario(selectedDate);
      if (data) {
        setAvanceData(data);
        if (data.supervisores && data.supervisores.length > 0 && !selectedSupervisorId) {
          // Intentar coincidir con el usuario logueado
          const match = data.supervisores.find(
            (s: any) =>
              s.usuario?.toLowerCase() === currentUser?.usuario?.toLowerCase() ||
              s.supervisor?.toLowerCase().includes((currentUser?.nombres || "").toLowerCase())
          );
          setSelectedSupervisorId(match ? match.id_supervisor : data.supervisores[0].id_supervisor);
        }
      }
    } catch (e) {
      console.error("Error al cargar avance diario:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarAvance(fecha);
    const interval = setInterval(() => {
      cargarAvance(fecha);
    }, 25000); // 25s auto-refresh
    return () => clearInterval(interval);
  }, [fecha]);

  const currentSupervisor: SupervisorAvanceDiario | undefined = avanceData?.supervisores?.find(
    (s: SupervisorAvanceDiario) => s.id_supervisor === selectedSupervisorId
  ) || avanceData?.supervisores?.[0];

  const metaTecnicos = currentSupervisor?.meta_tecnicos || 6;
  const metaClientes = currentSupervisor?.meta_clientes || 2;
  const totalTecnicos = currentSupervisor?.total_tecnicos_supervisados || 0;
  const totalClientes = currentSupervisor?.total_clientes_auditados || 0;
  const porcentajeGlobal = currentSupervisor?.porcentaje_avance || 0;

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Controls */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-5 md:p-7 text-white shadow-xl border border-blue-700/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-blue-300 text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Trazabilidad Operativa en Vivo · Meta 6 Técnicos + 2 Clientes
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">
              Avance Diario del Supervisor
            </h2>
            <p className="text-blue-200/80 text-xs md:text-sm">
              Monitoreo en tiempo real de metas diarias, estados de jornada y auditorías completadas.
            </p>
          </div>

          {/* Controls: Date Picker + Supervisor Select + Refresh */}
          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            {/* Supervisor Selector */}
            {avanceData?.supervisores && avanceData.supervisores.length > 1 && (
              <select
                value={selectedSupervisorId || ""}
                onChange={(e) => setSelectedSupervisorId(Number(e.target.value))}
                className="bg-black/30 backdrop-blur-md border border-white/20 text-white rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-400"
              >
                {avanceData.supervisores.map((s: any) => (
                  <option key={s.id_supervisor} value={s.id_supervisor} className="text-slate-900 font-medium">
                    {s.supervisor} ({s.porcentaje_avance}%)
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center bg-black/30 backdrop-blur-md border border-white/20 rounded-xl px-2.5 py-1.5 text-xs text-white">
              <Calendar className="w-3.5 h-3.5 mr-2 text-blue-300" />
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="bg-transparent border-none text-white text-xs font-bold focus:outline-hidden"
              />
            </div>

            <button
              type="button"
              onClick={() => cargarAvance(fecha)}
              disabled={loading}
              className="p-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-white transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Supervisor Dashboard Cards */}
      {currentSupervisor && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Meta 6 Técnicos */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <HardHat className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-800">Técnicos en Campo</h4>
                  <span className="text-[11px] text-slate-400">Meta diaria: 6 técnicos</span>
                </div>
              </div>
              <span className="text-2xl font-black text-slate-900">
                {totalTecnicos} <span className="text-sm font-bold text-slate-400">/ {metaTecnicos}</span>
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5 mt-3">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-500">Progreso</span>
                <span className={totalTecnicos >= metaTecnicos ? "text-emerald-600" : "text-blue-600"}>
                  {Math.min(Math.round((totalTecnicos / metaTecnicos) * 100), 100)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    totalTecnicos >= metaTecnicos ? "bg-emerald-500" : "bg-blue-600"
                  }`}
                  style={{ width: `${Math.min((totalTecnicos / metaTecnicos) * 100, 100)}%` }}
                />
              </div>
            </div>

            {onGoToCampo && (
              <button
                type="button"
                onClick={onGoToCampo}
                className="mt-4 w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Nueva Supervisión de Campo</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Card 2: Meta 2 Clientes (4D) */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                  <Star className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-800">Calidad Cliente (4D)</h4>
                  <span className="text-[11px] text-slate-400">Meta diaria: 2 clientes</span>
                </div>
              </div>
              <span className="text-2xl font-black text-slate-900">
                {totalClientes} <span className="text-sm font-bold text-slate-400">/ {metaClientes}</span>
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5 mt-3">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-500">Progreso</span>
                <span className={totalClientes >= metaClientes ? "text-emerald-600" : "text-teal-600"}>
                  {Math.min(Math.round((totalClientes / metaClientes) * 100), 100)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    totalClientes >= metaClientes ? "bg-emerald-500" : "bg-teal-600"
                  }`}
                  style={{ width: `${Math.min((totalClientes / metaClientes) * 100, 100)}%` }}
                />
              </div>
            </div>

            {onGoToCliente && (
              <button
                type="button"
                onClick={onGoToCliente}
                className="mt-4 w-full py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Nueva Auditoría de Calidad</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Card 3: Estado Actual & Avance Global */}
          <div className="bg-slate-900 rounded-3xl p-5 text-white border border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <span className="text-xs font-black uppercase text-slate-300">
                  {currentSupervisor.supervisor}
                </span>
              </div>
              <span
                className={`text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 ${
                  currentSupervisor.estado_actual === "EN_CAMINO"
                    ? "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                    : currentSupervisor.estado_actual === "EN_SUPERVISION"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : currentSupervisor.estado_actual === "FINALIZADO"
                    ? "bg-blue-400/20 text-blue-300 border border-blue-400/40"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                {currentSupervisor.estado_actual === "EN_CAMINO" && <Navigation className="w-3 h-3" />}
                {currentSupervisor.estado_actual === "EN_SUPERVISION" && <Play className="w-3 h-3" />}
                {currentSupervisor.estado_actual === "FINALIZADO" && <CheckCheck className="w-3 h-3" />}
                {currentSupervisor.estado_actual}
              </span>
            </div>

            {/* Avance Global Circular / Badge */}
            <div className="py-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-bold block">Cumplimiento Global</span>
                <span className="text-3xl font-black text-white">{porcentajeGlobal}%</span>
              </div>
              {currentSupervisor.supervisando_a && (
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Atendiendo a:</span>
                  <span className="text-xs font-extrabold text-blue-300">
                    {currentSupervisor.supervisando_a}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {currentSupervisor.cuadrilla_actual}
                  </span>
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex items-center justify-between">
              <span>Último registro:</span>
              <span className="font-mono font-bold text-slate-300">
                {currentSupervisor.ultima_actividad || "Sin actividad aún"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Feed of Today's Supervisions */}
      <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="font-extrabold text-slate-800 text-sm md:text-base">
              Supervisiones Registradas Hoy ({currentSupervisor?.supervisiones_hoy?.length || 0})
            </h3>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            Fecha: {fecha}
          </span>
        </div>

        {currentSupervisor?.supervisiones_hoy && currentSupervisor.supervisiones_hoy.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {currentSupervisor.supervisiones_hoy.map((sup: any, idx: number) => (
              <div
                key={sup.id || idx}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/60 p-2 rounded-2xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                      sup.tipo === "CAMPO"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-teal-100 text-teal-700"
                    }`}
                  >
                    {sup.tipo === "CAMPO" ? <HardHat className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-slate-900">
                        {sup.tecnico}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {sup.cuadrilla || "S/C"}
                      </span>
                    </div>
                    {sup.cliente && (
                      <div className="text-[11px] text-slate-500">Cliente: {sup.cliente}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  {sup.hora && (
                    <span className="text-[11px] font-mono text-slate-400">{sup.hora}</span>
                  )}
                  <span
                    className={`text-xs font-black px-2.5 py-1 rounded-full ${
                      sup.semaforo === "verde"
                        ? "bg-emerald-100 text-emerald-800"
                        : sup.semaforo === "amarillo"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {sup.cumplimiento}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-medium">No se han registrado supervisiones hoy para este supervisor.</p>
          </div>
        )}
      </div>
    </div>
  );
};
