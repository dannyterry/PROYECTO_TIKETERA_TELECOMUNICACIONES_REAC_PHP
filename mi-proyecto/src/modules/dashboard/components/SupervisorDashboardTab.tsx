import React, { useState, useEffect, useMemo } from "react";
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
  AlertTriangle,
  FileSpreadsheet,
  HardHat,
  Sparkles,
  Award,
  ChevronRight,
  ShieldCheck,
  Package,
  Layers,
  Search,
  Filter,
  BarChart3,
  TrendingUp,
  Cpu,
  History,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supervisionService } from "../../supervision/services/supervisionService";
import { SupervisionHistoryTab } from "../../supervision/components/SupervisionHistoryTab";
import { SupervisorAvanceDiario } from "../../supervision/types/supervisionTypes";

export const SupervisorDashboardTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<"AVANCE_VIVO" | "CRUCE_STOCK" | "HISTORIAL_RANKING">("AVANCE_VIVO");
  const [fecha, setFecha] = useState<string>(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState<boolean>(true);
  const [avanceData, setAvanceData] = useState<any | null>(null);

  // Cruce de stock search & filter
  const [stockSearchTerm, setStockSearchTerm] = useState("");

  const cargarDatos = async (targetFecha = fecha) => {
    setLoading(true);
    try {
      const data = await supervisionService.getAvanceDiario(targetFecha);
      if (data) {
        setAvanceData(data);
      }
    } catch (e) {
      console.error("Error al cargar datos del dashboard de supervisión:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos(fecha);
    const interval = setInterval(() => {
      cargarDatos(fecha);
    }, 25000); // 25s auto-refresh for real-time tracking
    return () => clearInterval(interval);
  }, [fecha]);

  // Cruce de stock filtered
  const filteredStock = useMemo(() => {
    const list: any[] = avanceData?.cruce_stock || [];
    if (!stockSearchTerm.trim()) return list;
    const q = stockSearchTerm.toLowerCase();
    return list.filter(
      (item) =>
        (item.tecnico && item.tecnico.toLowerCase().includes(q)) ||
        (item.cuadrilla && item.cuadrilla.toLowerCase().includes(q)) ||
        (item.producto && item.producto.toLowerCase().includes(q))
    );
  }, [avanceData, stockSearchTerm]);

  const handleExportStockExcel = () => {
    if (!filteredStock || filteredStock.length === 0) return;
    const rows = filteredStock.map((s) => ({
      Técnico: s.tecnico,
      Cuadrilla: s.cuadrilla || "S/C",
      Producto: s.producto,
      "Stock en Sistema (Almacén)": s.stock_sistema,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cruce_Stock");
    XLSX.writeFile(wb, `Cruce_Stock_Camioneta_Almacen_${fecha}.xlsx`);
  };

  const kpis = avanceData?.kpis_globales || {
    total_supervisores_activos: 0,
    total_tecnicos_supervisados_hoy: 0,
    total_clientes_auditados_hoy: 0,
    meta_global_tecnicos: 0,
    meta_global_clientes: 0,
    porcentaje_cumplimiento_global: 0,
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Navigation Sub-Tabs */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-5 md:p-6 text-white shadow-xl border border-indigo-800/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-300 text-[11px] font-black uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            Panel de Control Ejecutivo · Supervisión de Campo & Calidad
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight">
            Supervisión & Control de Calidad
          </h2>
          <p className="text-slate-300 text-xs md:text-sm">
            Monitoreo en tiempo real del avance 6+2, cruce de stock camioneta vs almacén, historial y ranking.
          </p>
        </div>

        {/* Sub-tabs pills */}
        <div className="flex flex-wrap items-center gap-2 bg-black/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab("AVANCE_VIVO")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === "AVANCE_VIVO"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/30 font-black scale-102"
                : "text-slate-300 hover:text-white hover:bg-white/10"
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Avance en Vivo (6+2)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("CRUCE_STOCK")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === "CRUCE_STOCK"
                ? "bg-teal-600 text-white shadow-md shadow-teal-500/30 font-black scale-102"
                : "text-slate-300 hover:text-white hover:bg-white/10"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Cruce de Stock</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("HISTORIAL_RANKING")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === "HISTORIAL_RANKING"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30 font-black scale-102"
                : "text-slate-300 hover:text-white hover:bg-white/10"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historial & Ranking</span>
          </button>
        </div>
      </div>

      {/* 2. SUB-TAB 1: AVANCE EN VIVO (SUPERVISORES 6+2) */}
      {activeSubTab === "AVANCE_VIVO" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700">
                <Calendar className="w-3.5 h-3.5 mr-2 text-blue-600" />
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="bg-transparent border-none text-slate-800 text-xs font-bold focus:outline-hidden cursor-pointer"
                />
              </div>
              <button
                type="button"
                onClick={() => cargarDatos(fecha)}
                disabled={loading}
                className="p-2 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                title="Actualizar datos"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-bold text-slate-500">
                Transmisión en vivo · Actualizado automáticamente cada 25s
              </span>
            </div>
          </div>

          {/* Global KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Supervisores Activos</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl lg:text-3xl font-black text-slate-900">
                {kpis.total_supervisores_activos}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Asignados a ruta hoy</div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Técnicos Auditados</span>
                <HardHat className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl lg:text-3xl font-black text-slate-900">
                {kpis.total_tecnicos_supervisados_hoy}{" "}
                <span className="text-sm font-bold text-slate-400">/ {kpis.meta_global_tecnicos}</span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Meta: 6 por supervisor</div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Clientes Auditados (4D)</span>
                <Star className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl lg:text-3xl font-black text-slate-900">
                {kpis.total_clientes_auditados_hoy}{" "}
                <span className="text-sm font-bold text-slate-400">/ {kpis.meta_global_clientes}</span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Meta: 2 por supervisor</div>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-3xl text-white shadow-lg shadow-blue-500/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-100">Cumplimiento Global</span>
                <Award className="w-4 h-4 text-amber-300" />
              </div>
              <div className="text-2xl lg:text-3xl font-black text-white">
                {kpis.porcentaje_cumplimiento_global}%
              </div>
              <div className="text-[11px] text-blue-200 font-medium">Meta combinada (6+2)</div>
            </div>
          </div>

          {/* Supervisors Live Grid */}
          <div className="space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm md:text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              Estado y Rendimiento Individual de Supervisores
            </h3>

            {avanceData?.supervisores && avanceData.supervisores.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {avanceData.supervisores.map((sup: SupervisorAvanceDiario) => (
                  <div
                    key={sup.id_supervisor}
                    className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    {/* Top Supervisor Info & Live State Badge */}
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <div className="font-black text-sm text-slate-900">{sup.supervisor}</div>
                        <div className="text-[11px] text-slate-400">Usuario: @{sup.usuario || "supervisor"}</div>
                      </div>

                      <span
                        className={`text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 ${
                          sup.estado_actual === "EN_CAMINO"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : sup.estado_actual === "EN_SUPERVISION"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse"
                            : sup.estado_actual === "FINALIZADO"
                            ? "bg-blue-100 text-blue-800 border border-blue-300"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {sup.estado_actual === "EN_CAMINO" && <Navigation className="w-3 h-3 text-amber-600" />}
                        {sup.estado_actual === "EN_SUPERVISION" && <Play className="w-3 h-3 text-emerald-600" />}
                        {sup.estado_actual === "FINALIZADO" && <CheckCheck className="w-3 h-3 text-blue-600" />}
                        {sup.estado_actual}
                      </span>
                    </div>

                    {/* Active task info if ongoing */}
                    {sup.supervisando_a && (
                      <div className="bg-blue-50/60 p-3 rounded-2xl border border-blue-100 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-blue-700 font-bold">Supervisando a:</span>
                          <span className="font-mono font-bold text-blue-900">
                            {sup.hora_inicio_actual || "—"}
                          </span>
                        </div>
                        <div className="text-xs font-extrabold text-slate-900">{sup.supervisando_a}</div>
                        <div className="text-[10px] text-slate-500 font-medium">{sup.cuadrilla_actual}</div>
                      </div>
                    )}

                    {/* Progress Bars: 6 Técnicos & 2 Clientes */}
                    <div className="space-y-3">
                      {/* Técnicos (Meta 6) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-slate-600 flex items-center gap-1">
                            <HardHat className="w-3.5 h-3.5 text-blue-600" />
                            Técnicos ({sup.total_tecnicos_supervisados}/{sup.meta_tecnicos})
                          </span>
                          <span className={sup.total_tecnicos_supervisados >= sup.meta_tecnicos ? "text-emerald-600" : "text-blue-600"}>
                            {Math.min(Math.round((sup.total_tecnicos_supervisados / sup.meta_tecnicos) * 100), 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              sup.total_tecnicos_supervisados >= sup.meta_tecnicos ? "bg-emerald-500" : "bg-blue-600"
                            }`}
                            style={{ width: `${Math.min((sup.total_tecnicos_supervisados / sup.meta_tecnicos) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Clientes (Meta 2) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-slate-600 flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-teal-600" />
                            Clientes ({sup.total_clientes_auditados}/{sup.meta_clientes})
                          </span>
                          <span className={sup.total_clientes_auditados >= sup.meta_clientes ? "text-emerald-600" : "text-teal-600"}>
                            {Math.min(Math.round((sup.total_clientes_auditados / sup.meta_clientes) * 100), 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              sup.total_clientes_auditados >= sup.meta_clientes ? "bg-emerald-500" : "bg-teal-600"
                            }`}
                            style={{ width: `${Math.min((sup.total_clientes_auditados / sup.meta_clientes) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Footer with % and today's mini list */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">Avance Global</span>
                        <span className="font-black text-slate-900 text-base">{sup.porcentaje_avance}%</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {sup.supervisiones_hoy?.length || 0} registros hoy
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400 space-y-2">
                <Users className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs font-medium">No se encontraron supervisores activos para esta fecha.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. SUB-TAB 2: CRUCE DE STOCK (CAMIONETA VS ALMACÉN) */}
      {activeSubTab === "CRUCE_STOCK" && (
        <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm md:text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-teal-600" />
                Cruce de Stock Físico en Camioneta vs Sistema de Almacén
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Verifica las cantidades de ONTs, routers y materiales auditados en terreno contra lo despachado en almacén.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportStockExcel}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Exportar Excel</span>
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              value={stockSearchTerm}
              onChange={(e) => setStockSearchTerm(e.target.value)}
              placeholder="Filtrar por técnico, cuadrilla o producto..."
              className="w-full pl-9 pr-4 py-2 text-xs md:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-medium"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-bold">
                  <th className="py-3 px-4">Técnico Evaluado</th>
                  <th className="py-3 px-4">Cuadrilla / Móvil</th>
                  <th className="py-3 px-4">Producto / Equipo</th>
                  <th className="py-3 px-4 text-center">Stock Registrado Almacén</th>
                  <th className="py-3 px-4 text-center">Estado Auditoría</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStock.length > 0 ? (
                  filteredStock.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800">{s.tecnico}</td>
                      <td className="py-3 px-4 font-semibold text-slate-600">{s.cuadrilla || "S/C"}</td>
                      <td className="py-3 px-4">
                        <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded text-[11px]">
                          {s.producto}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-black text-slate-900 text-sm">
                        {s.stock_sistema}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                          Auditado
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No hay registros de stock cruzado disponibles.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. SUB-TAB 3: HISTORIAL DE FICHAS & RANKING DE DESEMPEÑO */}
      {activeSubTab === "HISTORIAL_RANKING" && (
        <SupervisionHistoryTab />
      )}
    </div>
  );
};
