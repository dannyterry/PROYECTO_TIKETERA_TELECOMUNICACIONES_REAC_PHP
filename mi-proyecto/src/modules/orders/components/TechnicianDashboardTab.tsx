import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  Activity,
  ShieldCheck,
  MapPin,
  ChevronDown,
  RefreshCw,
  PieChart,
  BarChart3,
  Layers,
  UserCheck,
} from "lucide-react";
import { Order } from "../types/Order";
import { getOrders } from "../services/orderService";

interface Props {
  trabajador: any;
  onSelectOrderForActa?: (order: Order) => void;
}

type PeriodMode = "dia" | "semana" | "mes";

export const TechnicianDashboardTab: React.FC<Props> = ({ trabajador }) => {
  const [periodMode, setPeriodMode] = useState<PeriodMode>("mes");
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. Generador de Períodos: Días, Semanas y Meses
  const opcionesDias = useMemo(() => {
    const list = [];
    const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const nombreDia = i === 0 ? "Hoy" : i === 1 ? "Ayer" : `${diasSemana[d.getDay()]} ${dd}/${mm}`;
      list.push({ id: dateStr, label: `${nombreDia} (${dateStr})`, desde: dateStr, hasta: dateStr });
    }
    return list;
  }, []);

  const opcionesSemanas = useMemo(() => {
    const list = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      const dayOfWeek = d.getDay() || 7;
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - dayOfWeek + 1);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const fDesde = startOfWeek.toISOString().slice(0, 10);
      const fHasta = endOfWeek.toISOString().slice(0, 10);

      const label =
        i === 0
          ? `Esta Semana (${fDesde.slice(5)} al ${fHasta.slice(5)})`
          : i === 1
          ? `Semana Pasada (${fDesde.slice(5)} al ${fHasta.slice(5)})`
          : `Hace ${i} semanas (${fDesde.slice(5)} al ${fHasta.slice(5)})`;

      list.push({ id: `sem-${i}`, label, desde: fDesde, hasta: fHasta });
    }
    return list;
  }, []);

  const opcionesMeses = useMemo(() => {
    const nombresMeses = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    const list = [];
    const now = new Date();
    for (let i = 0; i < 8; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yyyy = d.getFullYear();
      const mIdx = d.getMonth();
      const mm = String(mIdx + 1).padStart(2, "0");
      const ultimoDia = new Date(yyyy, mIdx + 1, 0).getDate();

      const fDesde = `${yyyy}-${mm}-01`;
      const fHasta = `${yyyy}-${mm}-${String(ultimoDia).padStart(2, "0")}`;

      list.push({
        id: `${yyyy}-${mm}`,
        label: `${nombresMeses[mIdx]} ${yyyy}`,
        desde: fDesde,
        hasta: fHasta,
      });
    }
    return list;
  }, []);

  useEffect(() => {
    if (periodMode === "dia" && opcionesDias.length > 0) {
      setSelectedOption(opcionesDias[0].id);
    } else if (periodMode === "semana" && opcionesSemanas.length > 0) {
      setSelectedOption(opcionesSemanas[0].id);
    } else if (periodMode === "mes" && opcionesMeses.length > 0) {
      setSelectedOption(opcionesMeses[0].id);
    }
  }, [periodMode, opcionesDias, opcionesSemanas, opcionesMeses]);

  // 2. Consulta de Órdenes del Período
  const cargarOrdenesPeriodo = () => {
    if (!trabajador || !selectedOption) return;

    let targetPeriod: { desde: string; hasta: string } | undefined;
    if (periodMode === "dia") {
      targetPeriod = opcionesDias.find((o) => o.id === selectedOption);
    } else if (periodMode === "semana") {
      targetPeriod = opcionesSemanas.find((o) => o.id === selectedOption);
    } else {
      targetPeriod = opcionesMeses.find((o) => o.id === selectedOption);
    }

    if (!targetPeriod) return;

    setLoading(true);
    getOrders({ fechaDesde: targetPeriod.desde, fechaHasta: targetPeriod.hasta })
      .then((allOrders) => {
        const targetName = (trabajador.nombre_completo || "").toLowerCase().trim();
        const targetCuadrilla = (trabajador.cuadrilla || "").toLowerCase().trim();

        const misOrdenes = allOrders.filter((ord) => {
          const tecName = (ord.tecnico || "").toLowerCase();
          const ordCuadrilla = (ord.cuadrilla || "").toLowerCase().trim();

          const matchTec = targetName && tecName.includes(targetName);
          const matchCuad = targetCuadrilla && ordCuadrilla && (ordCuadrilla === targetCuadrilla || ordCuadrilla.includes(targetCuadrilla));
          const matchNameInCuad = targetName && ordCuadrilla && ordCuadrilla.includes(targetName);
          const matchId = String(ord.idTecnico) === String(trabajador.id_trabajador) || String(ord.idTecnico) === String(trabajador.id_usuario);

          return matchTec || matchCuad || matchNameInCuad || matchId;
        });

        setOrders(misOrdenes);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cargarOrdenesPeriodo();
  }, [selectedOption, trabajador]);

  // 3. Cálculos Analíticos Avanzados para Gráficos
  const analytics = useMemo(() => {
    const total = orders.length;
    let finalizadas = 0;
    let canceladas = 0;
    let agendadas = 0;
    let reiteradasPorTecnico = 0;
    let reiteradasGenerales = 0;

    const tiposTrabajoMap: Record<string, number> = {};
    const distritosMap: Record<string, number> = {};

    orders.forEach((o) => {
      const s = (o.status || "").toUpperCase();
      if (s.includes("FINALIZ") || s.includes("LIQUID") || s.includes("TERMIN") || s.includes("CERRAD") || s.includes("FENIX")) {
        finalizadas++;
      } else if (s.includes("CANCELAD") || s.includes("REGESTION") || s.includes("OBSERVAD") || s.includes("ANULAD") || s.includes("SUSPENDID")) {
        canceladas++;
      } else {
        agendadas++;
      }

      // Reiteradas atendidas por ESTE técnico anteriormente
      if (o.esReiteradaTecnico || (o.totalOrdenesMismoTecnico && o.totalOrdenesMismoTecnico > 1)) {
        reiteradasPorTecnico++;
      }

      // Reiteradas generales (cualquier cuadrilla)
      if (o.esReiterada || (o.totalOrdenesCliente && o.totalOrdenesCliente > 1)) {
        reiteradasGenerales++;
      }

      // Tipo de Trabajo
      const rawTipo = (o.tipoTrabajo || o.tipoLiquidacion || "OTROS").toUpperCase().trim();
      const tipoClean = rawTipo.replace(/_/g, " ").replace(/-/g, " ");
      tiposTrabajoMap[tipoClean] = (tiposTrabajoMap[tipoClean] || 0) + 1;

      // Distritos
      const dist = (o.distrito || "LIMA").toUpperCase().trim();
      if (dist && dist !== "-") {
        distritosMap[dist] = (distritosMap[dist] || 0) + 1;
      }
    });

    const efectividad = total > 0 ? Math.round((finalizadas / total) * 100) : 0;
    const tasaReiteracionTec = total > 0 ? Math.round((reiteradasPorTecnico / total) * 100) : 0;
    const calidadScore = Math.max(0, 100 - tasaReiteracionTec);

    // Donut chart SVG stroke calculations (Circunferencia = 2 * PI * R; R = 40 => Circ = 251.32)
    const circ = 251.32;
    const pFin = total > 0 ? finalizadas / total : 0;
    const pCanc = total > 0 ? canceladas / total : 0;
    const pAgend = total > 0 ? agendadas / total : 0;

    const dashFin = pFin * circ;
    const dashCanc = pCanc * circ;
    const dashAgend = pAgend * circ;

    const offsetCanc = -dashFin;
    const offsetAgend = -(dashFin + dashCanc);

    return {
      total,
      finalizadas,
      canceladas,
      agendadas,
      reiteradasPorTecnico,
      reiteradasGenerales,
      efectividad,
      calidadScore,
      donut: {
        circ,
        dashFin,
        dashCanc,
        dashAgend,
        offsetCanc,
        offsetAgend,
        pFin: Math.round(pFin * 100),
        pCanc: Math.round(pCanc * 100),
        pAgend: Math.round(pAgend * 100),
      },
      tiposTrabajo: Object.entries(tiposTrabajoMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6),
      distritos: Object.entries(distritosMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    };
  }, [orders]);

  return (
    <div className="space-y-4 animate-fade-in text-slate-800">
      
      {/* ─────────────────────────────────────────────────────────────
          1. SELECTOR DE PERÍODO (DÍAS | SEMANAS | MESES)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-3.5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setPeriodMode("dia")}
            className={`flex-1 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
              periodMode === "dia" ? "bg-white text-indigo-950 shadow-xs" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            📅 Por Días
          </button>
          <button
            type="button"
            onClick={() => setPeriodMode("semana")}
            className={`flex-1 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
              periodMode === "semana" ? "bg-white text-indigo-950 shadow-xs" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            🗓️ Por Semanas
          </button>
          <button
            type="button"
            onClick={() => setPeriodMode("mes")}
            className={`flex-1 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
              periodMode === "mes" ? "bg-white text-indigo-950 shadow-xs" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            📊 Por Meses
          </button>
        </div>

        {/* Dropdown del período */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <select
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 font-extrabold text-slate-800 text-xs rounded-2xl px-3.5 py-2.5 appearance-none focus:outline-none focus:border-indigo-500 shadow-2xs pr-9 cursor-pointer"
            >
              {periodMode === "dia" &&
                opcionesDias.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.label}
                  </option>
                ))}

              {periodMode === "semana" &&
                opcionesSemanas.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.label}
                  </option>
                ))}

              {periodMode === "mes" &&
                opcionesMeses.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.label}
                  </option>
                ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={cargarOrdenesPeriodo}
            className="p-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all cursor-pointer shadow-2xs"
            title="Recargar analítica"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center text-slate-400 font-bold space-y-3 border border-slate-200">
          <RefreshCw size={30} className="animate-spin text-indigo-600 mx-auto" />
          <p className="text-xs">Calculando indicadores y métricas...</p>
        </div>
      ) : analytics.total === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center text-slate-400 font-bold space-y-2 border border-slate-200">
          <Layers size={36} className="text-slate-300 mx-auto" />
          <p className="text-xs text-slate-600">No hay registros de órdenes para el período seleccionado.</p>
          <p className="text-[11px] text-slate-400 font-normal">Prueba seleccionando otro día, semana o mes.</p>
        </div>
      ) : (
        <>
          {/* ─────────────────────────────────────────────────────────────
              2. GRÁFICO DE DONA: DISTRIBUCIÓN DE ESTADOS (DONUT CHART)
          ───────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-3xl p-4.5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-black text-xs text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                <PieChart size={15} className="text-indigo-600" />
                Distribución de Estados
              </span>
              <span className="text-[10px] font-bold text-slate-400 font-mono">
                {analytics.total} ÓRDENES
              </span>
            </div>

            <div className="flex items-center justify-around gap-4 pt-1">
              {/* Gráfico de Dona SVG */}
              <div className="relative flex items-center justify-center w-28 h-28 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {/* Segmento Finalizadas (Celeste) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#0ea5e9"
                    strokeWidth="14"
                    strokeDasharray={`${analytics.donut.dashFin} ${analytics.donut.circ}`}
                    strokeDashoffset="0"
                    className="fill-transparent transition-all duration-700"
                  />
                  {/* Segmento Canceladas (Amarillo) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#f59e0b"
                    strokeWidth="14"
                    strokeDasharray={`${analytics.donut.dashCanc} ${analytics.donut.circ}`}
                    strokeDashoffset={analytics.donut.offsetCanc}
                    className="fill-transparent transition-all duration-700"
                  />
                  {/* Segmento Agendadas (Gris) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#cbd5e1"
                    strokeWidth="14"
                    strokeDasharray={`${analytics.donut.dashAgend} ${analytics.donut.circ}`}
                    strokeDashoffset={analytics.donut.offsetAgend}
                    className="fill-transparent transition-all duration-700"
                  />
                </svg>

                {/* Agujero Central */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-base font-black text-slate-800 font-mono">
                    {analytics.total}
                  </span>
                  <span className="text-[8px] uppercase font-bold text-slate-400">
                    Total
                  </span>
                </div>
              </div>

              {/* Leyenda Analítica Detallada */}
              <div className="flex-1 space-y-2 text-xs">
                {/* Finalizadas */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-sky-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                      Finalizadas
                    </span>
                    <span className="font-black font-mono text-sky-950">
                      {analytics.finalizadas} ({analytics.donut.pFin}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${analytics.donut.pFin}%` }}
                    ></div>
                  </div>
                </div>

                {/* Canceladas */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Canceladas
                    </span>
                    <span className="font-black font-mono text-amber-950">
                      {analytics.canceladas} ({analytics.donut.pCanc}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${analytics.donut.pCanc}%` }}
                    ></div>
                  </div>
                </div>

                {/* Agendadas */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                      Agendadas
                    </span>
                    <span className="font-black font-mono text-slate-900">
                      {analytics.agendadas} ({analytics.donut.pAgend}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-slate-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${analytics.donut.pAgend}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              3. GRÁFICO DE BARRAS: MIX POR TIPO DE TRABAJO
          ───────────────────────────────────────────────────────────── */}
          {analytics.tiposTrabajo.length > 0 && (
            <div className="bg-white rounded-3xl p-4.5 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-black text-xs text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <BarChart3 size={15} className="text-amber-500" />
                  Mix por Tipo de Trabajo (Barras)
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  TOP {analytics.tiposTrabajo.length}
                </span>
              </div>

              <div className="space-y-2.5 pt-1">
                {analytics.tiposTrabajo.map(([tipo, cant], idx) => {
                  const pct = Math.round((cant / analytics.total) * 100);
                  const colors = [
                    "from-indigo-600 to-blue-500",
                    "from-teal-600 to-emerald-500",
                    "from-violet-600 to-purple-500",
                    "from-amber-600 to-orange-500",
                    "from-rose-600 to-pink-500",
                    "from-cyan-600 to-sky-500",
                  ];
                  const barGradient = colors[idx % colors.length];

                  return (
                    <div key={tipo} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-800 truncate max-w-[220px]">
                          ⚡ {tipo}
                        </span>
                        <span className="font-mono text-slate-900">
                          {cant} <span className="text-slate-400 font-normal text-[10px]">({pct}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`bg-gradient-to-r ${barGradient} h-full rounded-full transition-all duration-700 shadow-xs`}
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              4. CONTROL DE REITERADAS DEL TÉCNICO (REVISITAS PROPIAS)
          ───────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            {/* Reiteradas Atendidas por este Mismo Técnico */}
            <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center gap-1.5 text-rose-700 font-black text-xs">
                <UserCheck size={16} />
                <span>Reiteradas por Ti</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-rose-950 font-mono">
                  {analytics.reiteradasPorTecnico}
                </span>
                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                  {analytics.total > 0 ? Math.round((analytics.reiteradasPorTecnico / analytics.total) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full"
                  style={{ width: `${analytics.total > 0 ? (analytics.reiteradasPorTecnico / analytics.total) * 100 : 0}%` }}
                ></div>
              </div>
              <span className="text-[10px] text-slate-400 block leading-tight">
                Clientes que ya habías atendido tú anteriormente
              </span>
            </div>

            {/* Efectividad en Primera Atención (Sin Reincidencia) */}
            <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center gap-1.5 text-emerald-700 font-black text-xs">
                <ShieldCheck size={16} />
                <span>Sin Reincidencia</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-950 font-mono">
                  {analytics.calidadScore}%
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {analytics.total - analytics.reiteradasPorTecnico} ord.
                </span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{ width: `${analytics.calidadScore}%` }}
                ></div>
              </div>
              <span className="text-[10px] text-slate-400 block leading-tight">
                Clientes resueltos en primera visita por tu parte
              </span>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              5. DISTRIBUCIÓN POR ZONAS / DISTRITOS (TOP RANKING)
          ───────────────────────────────────────────────────────────── */}
          {analytics.distritos.length > 0 && (
            <div className="bg-white rounded-3xl p-4.5 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-black text-xs text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <MapPin size={15} className="text-rose-500" />
                  Top Distritos de Cobertura
                </span>
                <span className="text-[10px] font-bold text-slate-400 font-mono">
                  ZONAS
                </span>
              </div>

              <div className="space-y-2 pt-1">
                {analytics.distritos.map(([distrito, cant], i) => {
                  const pct = Math.round((cant / analytics.total) * 100);
                  return (
                    <div key={distrito} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-slate-400 w-3">#{i + 1}</span>
                          {distrito}
                        </span>
                        <span className="font-mono font-black text-slate-900">
                          {cant} <span className="text-[10px] text-slate-400 font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-rose-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </>
      )}

    </div>
  );
};
