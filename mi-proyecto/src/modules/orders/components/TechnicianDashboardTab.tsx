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
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  PieChart,
  BarChart3,
  Layers,
  UserCheck,
  Calendar,
  Coffee,
} from "lucide-react";
import { Order } from "../types/Order";
import { getOrders } from "../services/orderService";
import { getMatrizAsistencias } from "../../../services/employeeService";

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

  // Calendario Mensual de Asistencia y Descansos para el Técnico
  const [mostrarCalendario, setMostrarCalendario] = useState<boolean>(false);
  const [fechaCalendario, setFechaCalendario] = useState<Date>(() => new Date());
  const [calendarioData, setCalendarioData] = useState<{
    asistencias: any[];
    descansos: any[];
  }>({ asistencias: [], descansos: [] });
  const [cargandoCalendario, setCargandoCalendario] = useState(false);

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

  // Cargar datos de asistencia y descansos del mes
  useEffect(() => {
    if (!trabajador) return;
    const y = fechaCalendario.getFullYear();
    const m = fechaCalendario.getMonth();
    const fDesde = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const fHasta = `${y}-${String(m + 1).padStart(2, "0")}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, "0")}`;

    setCargandoCalendario(true);
    getMatrizAsistencias(fDesde, fHasta)
      .then((res) => {
        setCalendarioData({
          asistencias: res.asistencias || [],
          descansos: res.descansos || [],
        });
      })
      .catch(console.error)
      .finally(() => setCargandoCalendario(false));
  }, [fechaCalendario, trabajador]);

  // Cuadrícula y estados del calendario mensual para el técnico
  const diasMesGrid = useMemo(() => {
    const y = fechaCalendario.getFullYear();
    const m = fechaCalendario.getMonth();
    const totalDias = new Date(y, m + 1, 0).getDate();
    const primerDia = new Date(y, m, 1);
    const offsetInicio = (primerDia.getDay() + 6) % 7; // Lunes = 0 ... Domingo = 6
    const hoyStr = new Date().toISOString().slice(0, 10);

    const idUser = trabajador?.id_usuario;
    const idTrab = trabajador?.id_trabajador;
    const tecNombre = (trabajador?.nombre_completo || "").toLowerCase().trim();

    // Map descansos programados
    const setDescansos = new Set<string>();
    for (const d of calendarioData.descansos) {
      const matchId = (idUser && d.id_usuario === idUser) || (idTrab && d.id_trabajador === idTrab);
      if (matchId && d.fecha_inicio && d.fecha_fin) {
        let cur = new Date(d.fecha_inicio + "T00:00:00");
        const end = new Date(d.fecha_fin + "T00:00:00");
        while (cur <= end) {
          setDescansos.add(cur.toISOString().slice(0, 10));
          cur.setDate(cur.getDate() + 1);
        }
      }
    }

    // Map asistencias
    const mapAsistencias = new Map<string, string>();
    for (const a of calendarioData.asistencias) {
      const matchId = (idUser && a.id_usuario === idUser) || (idTrab && a.id_trabajador === idTrab);
      if (matchId && a.fecha) {
        mapAsistencias.set(a.fecha.slice(0, 10), a.estado || "");
      }
    }

    // Map órdenes finalizadas por fecha
    const setDiasConOrdenes = new Set<string>();
    for (const ord of orders) {
      const fV = (ord as any).fechaVisita || (ord as any).fecha_visita || (ord as any).fecha_solicitud;
      if (fV && (ord.status || "").toUpperCase().includes("FINALIZ")) {
        setDiasConOrdenes.add(String(fV).slice(0, 10));
      }
    }

    const celdas = [];
    let totalD = 0;
    let semD = 0;
    let domD = 0;
    let totalP = 0;
    let totalT = 0;
    let totalF = 0;
    let totalJ = 0;
    let totalAsistidos = 0;

    for (let d = 1; d <= totalDias; d++) {
      const curDate = new Date(y, m, d);
      const fStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayOfWeek = (curDate.getDay() + 6) % 7; // 0 = Lunes, 6 = Domingo
      const esDomingo = dayOfWeek === 6;
      const esSabado = dayOfWeek === 5;
      const esHoy = fStr === hoyStr;
      const esPasadoOHoy = fStr <= hoyStr;

      const estadoAsist = mapAsistencias.get(fStr);
      const tieneDescanso = setDescansos.has(fStr) || estadoAsist === "Descanso";
      const tienePermiso = estadoAsist === "Permiso";
      const tieneTardanza = estadoAsist === "Tardanza";
      const tieneAsistencia = estadoAsist === "Asistio" || setDiasConOrdenes.has(fStr);
      const tieneFalta = estadoAsist === "Falta";

      let codigo = "-";
      let tipo: "descanso" | "tardanza" | "falta" | "puntual" | "permiso" | "vacio" = "vacio";

      if (tieneDescanso) {
        codigo = "D";
        tipo = "descanso";
        totalD++;
        if (esDomingo) domD++;
        else semD++;
      } else if (tienePermiso) {
        codigo = "J";
        tipo = "permiso";
        totalJ++;
      } else if (tieneTardanza) {
        codigo = "T";
        tipo = "tardanza";
        totalT++;
        totalAsistidos++; // Asistió pero tarde
      } else if (tieneAsistencia) {
        codigo = "P";
        tipo = "puntual";
        totalP++;
        totalAsistidos++; // Asistió puntual
      } else if (tieneFalta) {
        codigo = "F";
        tipo = "falta";
        totalF++;
      } else if (esPasadoOHoy && !esDomingo) {
        // Días pasados laborales sin órdenes ni asistencia ni descanso = Falta
        codigo = "F";
        tipo = "falta";
        totalF++;
      } else {
        codigo = "-";
        tipo = "vacio";
      }

      celdas.push({
        dia: d,
        fechaStr: fStr,
        esHoy,
        esDomingo,
        esSabado,
        codigo,
        tipo,
      });
    }

    const nombreMes = fechaCalendario.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

    return {
      offsetInicio,
      celdas,
      nombreMes: nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1),
      totales: {
        totalD,
        semD,
        domD,
        totalP,
        totalT,
        totalF,
        totalJ,
        totalAsistidos,
      },
    };
  }, [fechaCalendario, calendarioData, orders, trabajador]);

  return (
    <div className="space-y-4 animate-fade-in text-slate-800">

      {/* ─────────────────────────────────────────────────────────────
          📅 CALENDARIO MENSUAL DE ASISTENCIA Y DESCANSOS (ESTILO WIN)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3.5 transition-all">
        {/* Cabecera del Calendario interactiva para Desplegar / Ocultar */}
        <div
          onClick={() => setMostrarCalendario(!mostrarCalendario)}
          className="flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-600/20 shrink-0">
              <Calendar size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                  Mi Calendario de Asistencia y Descansos
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {diasMesGrid.nombreMes}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                {mostrarCalendario
                  ? "Consulta tus descansos, tardanzas, asistencias y faltas del mes"
                  : "Haz clic para ver el desglose diario de descansos y asistencia"}
              </p>
            </div>
          </div>

          {/* Resumen en Chips y Botón de Toggle */}
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-1 rounded-xl bg-sky-50 text-sky-800 border border-sky-200 text-[10.5px] font-black">
                {diasMesGrid.totales.totalD} Descansos
              </span>
              <span className="px-2 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10.5px] font-black">
                {diasMesGrid.totales.totalAsistidos} Días Trab.
              </span>
              {diasMesGrid.totales.totalT > 0 && (
                <span className="px-2 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-[10.5px] font-black">
                  {diasMesGrid.totales.totalT} Tardanzas (T)
                </span>
              )}
              {diasMesGrid.totales.totalF > 0 && (
                <span className="px-2 py-1 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-[10.5px] font-black">
                  {diasMesGrid.totales.totalF} Faltas (F)
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMostrarCalendario(!mostrarCalendario);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-bold text-xs transition-colors cursor-pointer border border-slate-200"
            >
              <span>{mostrarCalendario ? "Ocultar" : "Ver Calendario"}</span>
              {mostrarCalendario ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
        </div>

        {/* CONTENIDO DESPLEGABLE CUANDO ESTÁ VISIBLE */}
        {mostrarCalendario && (
          <div className="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Navegación de Mes y Leyenda Compacta para Móvil */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {/* Selector de Mes */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-2xs self-center sm:self-auto">
                <button
                  type="button"
                  onClick={() =>
                    setFechaCalendario(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                    )
                  }
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-xl transition-all cursor-pointer"
                  title="Mes anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="font-black text-xs md:text-sm text-slate-800 px-3 min-w-[130px] text-center capitalize">
                  {diasMesGrid.nombreMes}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setFechaCalendario(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                    )
                  }
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-xl transition-all cursor-pointer"
                  title="Mes siguiente"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Leyenda en píldoras (Optimizado para móvil con scroll horizontal táctil si es necesario) */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-[10px] sm:text-[10.5px] font-bold text-slate-600 bg-slate-50/80 p-1.5 rounded-2xl border border-slate-200">
                <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-slate-100 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Presente (P)</span>
                </span>
                <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-slate-100 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Tardanza (T)</span>
                </span>
                <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-slate-100 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>Falta (F)</span>
                </span>
                <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-slate-100 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  <span>Descanso (D)</span>
                </span>
                <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-slate-100 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>Permiso (J)</span>
                </span>
              </div>
            </div>

            {/* Cuadrícula de 7 Columnas: LU MA MI JU VI SA DO */}
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-7 bg-[#1f4e78] text-white text-center font-black text-[11px] py-2">
                <div>LU</div>
                <div>MA</div>
                <div>MI</div>
                <div>JU</div>
                <div>VI</div>
                <div className="text-amber-300">SÁ</div>
                <div className="text-rose-300">DO</div>
              </div>

              {cargandoCalendario ? (
                <div className="py-12 text-center text-slate-400 font-medium text-xs flex flex-col items-center justify-center gap-2">
                  <RefreshCw size={20} className="animate-spin text-indigo-600" />
                  <span>Cargando calendario del mes...</span>
                </div>
              ) : (
                <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 bg-slate-50/50">
                  {/* Espacios en blanco para offset inicial */}
                  {Array.from({ length: diasMesGrid.offsetInicio }).map((_, i) => (
                    <div key={`offset-${i}`} className="min-h-[58px] bg-slate-100/40 p-1" />
                  ))}

                  {/* Días del Mes */}
                  {diasMesGrid.celdas.map((dia) => (
                    <div
                      key={`mes-dia-${dia.fechaStr}`}
                      className={`min-h-[58px] p-1.5 flex flex-col justify-between transition-colors ${
                        dia.esHoy
                          ? "bg-indigo-50/60 ring-2 ring-indigo-500 ring-inset"
                          : dia.esDomingo
                          ? "bg-rose-50/20"
                          : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[11px] font-black font-mono leading-none ${
                            dia.esHoy ? "text-indigo-700" : "text-slate-700"
                          }`}
                        >
                          {dia.dia}
                        </span>
                        {dia.esHoy && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
                        )}
                      </div>

                      <div className="flex items-center justify-center my-0.5">
                        {dia.tipo === "descanso" ? (
                          <span
                            className="inline-flex items-center justify-center min-w-[28px] h-7 px-1 rounded-lg text-xs font-black bg-blue-100 text-blue-800 border border-blue-300 shadow-2xs"
                            title="Día de Descanso (D)"
                          >
                            D
                          </span>
                        ) : dia.tipo === "tardanza" ? (
                          <span
                            className="inline-flex items-center justify-center min-w-[28px] h-7 px-1 rounded-lg text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs"
                            title="Tardanza (T) - Asistió"
                          >
                            T
                          </span>
                        ) : dia.tipo === "puntual" ? (
                          <span
                            className="inline-flex items-center justify-center min-w-[28px] h-7 px-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs"
                            title="Presente / Puntual (P)"
                          >
                            P
                          </span>
                        ) : dia.tipo === "falta" ? (
                          <span
                            className="inline-flex items-center justify-center min-w-[28px] h-7 px-1 rounded-lg text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs"
                            title="Falta / Inasistencia (F)"
                          >
                            F
                          </span>
                        ) : dia.tipo === "permiso" ? (
                          <span
                            className="inline-flex items-center justify-center min-w-[28px] h-7 px-1 rounded-lg text-xs font-black bg-purple-100 text-purple-800 border border-purple-300 shadow-2xs"
                            title="Permiso / Justificado (J)"
                          >
                            J
                          </span>
                        ) : (
                          <span className="text-slate-300 font-mono text-xs">-</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cuadro Resumen Inferior (Exactamente como en Asistencia) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-2.5 text-center">
                <span className="text-[10px] font-bold text-sky-700 block uppercase">Total Descansos</span>
                <span className="text-base font-black text-sky-950 font-mono">
                  {diasMesGrid.totales.totalD}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-center">
                <span className="text-[10px] font-bold text-slate-600 block uppercase">Sem. (Lun-Sáb)</span>
                <span className="text-base font-black text-slate-900 font-mono">
                  {diasMesGrid.totales.semD}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-center">
                <span className="text-[10px] font-bold text-slate-600 block uppercase">Domingos (Dom)</span>
                <span className="text-base font-black text-slate-900 font-mono">
                  {diasMesGrid.totales.domD}
                </span>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-2.5 text-center">
                <span className="text-[10px] font-bold text-amber-700 block uppercase">Tardanzas (T)</span>
                <span className="text-base font-black text-amber-950 font-mono">
                  {diasMesGrid.totales.totalT}
                </span>
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-2.5 text-center">
                <span className="text-[10px] font-bold text-rose-700 block uppercase">Faltas (F)</span>
                <span className="text-base font-black text-rose-950 font-mono">
                  {diasMesGrid.totales.totalF}
                </span>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-2.5 text-center">
                <span className="text-[10px] font-bold text-emerald-700 block uppercase">Días Trab. (P+T)</span>
                <span className="text-base font-black text-emerald-950 font-mono">
                  {diasMesGrid.totales.totalAsistidos}
                </span>
                <span className="text-[9px] text-emerald-700/80 block mt-0.5">
                  {diasMesGrid.totales.totalP} punt. + {diasMesGrid.totales.totalT} tarde
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

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
