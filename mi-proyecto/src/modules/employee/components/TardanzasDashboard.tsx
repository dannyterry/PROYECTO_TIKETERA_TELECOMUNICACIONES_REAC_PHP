import React, { useState, useEffect, useMemo } from "react";
import {
  Trophy,
  Clock,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Users,
  Flame,
  Award,
  TrendingDown,
  BarChart3,
  Building,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Zap,
} from "lucide-react";
import { getMatrizAsistencias, RolItem } from "../../../services/employeeService";

export type TipoFiltroPeriodo = "dia" | "semana" | "mes" | "rango";

const formatLocalYMD = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseLocalYMD = (str: string): Date => {
  if (!str) return new Date();
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const esOrdenamiento = (cuadrilla?: string): boolean =>
  String(cuadrilla || "").trim().toUpperCase().startsWith("O");

interface TardanzasDashboardProps {
  onVerDetalleTecnico: (trabajador: any, tardanzas: any[], periodoTexto?: string) => void;
  roles?: RolItem[];
  canVerDetallesPersonal?: boolean;
}

interface RankingTecnico {
  id_trabajador: number;
  id_usuario?: number;
  nombre_completo: string;
  documento?: string;
  cuadrilla?: string;
  rol_nombre?: string;
  opcion_personal?: string;
  totalTardanzas: number;
  totalMinutos: number;
  promedioMinutos: number;
  maxRetraso: number;
  tardanzas: any[];
}

export const TardanzasDashboard: React.FC<TardanzasDashboardProps> = ({
  onVerDetalleTecnico,
  roles = [],
  canVerDetallesPersonal = true,
}) => {
  // Modo de filtro de periodo: Día, Semana, Mes, Rango
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoFiltroPeriodo>("mes");
  const [fechaDia, setFechaDia] = useState<string>(() => formatLocalYMD(new Date()));
  const [fechaSemana, setFechaSemana] = useState<Date>(() => new Date());
  const [fechaMes, setFechaMes] = useState<Date>(() => new Date());
  const [rangoDesde, setRangoDesde] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return formatLocalYMD(d);
  });
  const [rangoHasta, setRangoHasta] = useState<string>(() => formatLocalYMD(new Date()));

  const [loading, setLoading] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroCuadrilla, setFiltroCuadrilla] = useState("TODOS");
  const [filtroTipoOrdenamiento, setFiltroTipoOrdenamiento] = useState<
    "OPERATIVOS" | "ORDENAMIENTOS" | "TODOS"
  >("OPERATIVOS");
  const [datosMatriz, setDatosMatriz] = useState<{
    trabajadores: any[];
    asistencias: any[];
  }>({ trabajadores: [], asistencias: [] });

  // Calcular rango y etiqueta según el tipo de periodo
  const { fechaDesde, fechaHasta, periodoLabel } = useMemo(() => {
    const meses = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
    ];
    const mesesCortos = [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun",
      "Jul", "Ago", "Set", "Oct", "Nov", "Dic",
    ];
    const diasSemanaNombres = [
      "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
    ];

    if (tipoPeriodo === "dia") {
      const dt = parseLocalYMD(fechaDia);
      const diaNom = diasSemanaNombres[dt.getDay()];
      const diaNum = dt.getDate();
      const mesNom = mesesCortos[dt.getMonth()];
      const anio = dt.getFullYear();
      const hoyStr = formatLocalYMD(new Date());
      const esHoy = fechaDia === hoyStr;

      return {
        fechaDesde: fechaDia,
        fechaHasta: fechaDia,
        periodoLabel: esHoy
          ? `Hoy (${diaNom} ${diaNum} ${mesNom})`
          : `${diaNom} ${diaNum} ${mesNom} ${anio}`,
      };
    }

    if (tipoPeriodo === "semana") {
      const d = new Date(fechaSemana.getFullYear(), fechaSemana.getMonth(), fechaSemana.getDate());
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Lunes
      const lunes = new Date(d.getFullYear(), d.getMonth(), diff);
      const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6);

      const fDesde = formatLocalYMD(lunes);
      const fHasta = formatLocalYMD(domingo);

      const lDia = lunes.getDate();
      const lMes = mesesCortos[lunes.getMonth()];
      const dDia = domingo.getDate();
      const dMes = mesesCortos[domingo.getMonth()];
      const anio = domingo.getFullYear();

      return {
        fechaDesde: fDesde,
        fechaHasta: fHasta,
        periodoLabel: `Semana ${lDia} ${lMes} - ${dDia} ${dMes} ${anio}`,
      };
    }

    if (tipoPeriodo === "mes") {
      const y = fechaMes.getFullYear();
      const m = fechaMes.getMonth();
      const primerDia = new Date(y, m, 1);
      const ultimoDia = new Date(y, m + 1, 0);

      const desde = formatLocalYMD(primerDia);
      const hasta = formatLocalYMD(ultimoDia);

      return {
        fechaDesde: desde,
        fechaHasta: hasta,
        periodoLabel: `${meses[m]} ${y}`,
      };
    }

    // Rango personalizado
    const dDesde = parseLocalYMD(rangoDesde);
    const dHasta = parseLocalYMD(rangoHasta);
    const lDesde = `${dDesde.getDate()} ${mesesCortos[dDesde.getMonth()]}`;
    const lHasta = `${dHasta.getDate()} ${mesesCortos[dHasta.getMonth()]} ${dHasta.getFullYear()}`;

    return {
      fechaDesde: rangoDesde,
      fechaHasta: rangoHasta,
      periodoLabel: `${lDesde} al ${lHasta}`,
    };
  }, [tipoPeriodo, fechaDia, fechaSemana, fechaMes, rangoDesde, rangoHasta]);

  // Alias para mantener compatibilidad con código existente
  const mesLabel = periodoLabel;

  // Navegación de Día
  const cambiarDia = (delta: number) => {
    setFechaDia((prev) => {
      const dt = parseLocalYMD(prev);
      dt.setDate(dt.getDate() + delta);
      return formatLocalYMD(dt);
    });
  };

  const irHoy = () => {
    setFechaDia(formatLocalYMD(new Date()));
  };

  // Navegación de Semana
  const cambiarSemana = (delta: number) => {
    setFechaSemana((prev) => {
      const dt = new Date(prev);
      dt.setDate(dt.getDate() + delta * 7);
      return dt;
    });
  };

  const irSemanaActual = () => {
    setFechaSemana(new Date());
  };

  // Navegación de Meses
  const cambiarMes = (delta: number) => {
    setFechaMes((prev) => {
      const nueva = new Date(prev);
      nueva.setMonth(nueva.getMonth() + delta);
      return nueva;
    });
  };

  const irMesActual = () => {
    setFechaMes(new Date());
  };

  // Presets para rango personalizado
  const setPresetRango = (dias: number | "esteMes") => {
    const hoy = new Date();
    if (dias === "esteMes") {
      const p = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      setRangoDesde(formatLocalYMD(p));
      setRangoHasta(formatLocalYMD(hoy));
    } else {
      const d = new Date();
      d.setDate(d.getDate() - (dias - 1));
      setRangoDesde(formatLocalYMD(d));
      setRangoHasta(formatLocalYMD(hoy));
    }
  };

  // Cargar datos del rango seleccionado
  const cargarDatos = async () => {
    try {
      setLoading(true);
      const res = await getMatrizAsistencias(fechaDesde, fechaHasta);
      setDatosMatriz({
        trabajadores: res.trabajadores || [],
        asistencias: res.asistencias || [],
      });
    } catch (err: any) {
      console.error("Error al cargar ranking de tardanzas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [fechaDesde, fechaHasta]);

  // Construir ranking de técnicos
  const rankingCompleto: RankingTecnico[] = useMemo(() => {
    const asistenciasTardanza = (datosMatriz.asistencias || []).filter(
      (a) => a.estado === "Tardanza"
    );

    // Mapear cada trabajador con sus métricas
    const lista: RankingTecnico[] = [];
    for (const t of datosMatriz.trabajadores || []) {
      const tards = asistenciasTardanza.filter(
        (a) =>
          (t.id_trabajador && a.id_trabajador === t.id_trabajador) ||
          (t.id_usuario && a.id_usuario === t.id_usuario)
      );

      if (tards.length > 0) {
        const totalMin = tards.reduce(
          (acc, curr) => acc + (Number(curr.minutos_tarde) || 0),
          0
        );
        const maxRet = tards.reduce(
          (max, curr) => Math.max(max, Number(curr.minutos_tarde) || 0),
          0
        );
        const prom = Math.round(totalMin / tards.length);

        lista.push({
          id_trabajador: t.id_trabajador,
          id_usuario: t.id_usuario,
          nombre_completo: t.nombre_completo || "Sin Nombre",
          documento: t.documento,
          cuadrilla: t.cuadrilla || "Sin Cuadrilla",
          rol_nombre: t.rol_nombre,
          opcion_personal: t.opcion_personal,
          totalTardanzas: tards.length,
          totalMinutos: totalMin,
          promedioMinutos: prom,
          maxRetraso: maxRet,
          tardanzas: tards,
        });
      }
    }

    // Ordenar de mayor a menor por total de tardanzas, y luego por minutos totales
    return lista.sort((a, b) => {
      if (b.totalTardanzas !== a.totalTardanzas) {
        return b.totalTardanzas - a.totalTardanzas;
      }
      return b.totalMinutos - a.totalMinutos;
    });
  }, [datosMatriz]);

  // Resetear cuadrilla al cambiar el filtro de tipo
  useEffect(() => {
    setFiltroCuadrilla("TODOS");
  }, [filtroTipoOrdenamiento]);

  // Contadores para los botones de tipo
  const conteoOperativos = useMemo(() => {
    return rankingCompleto.filter((r) => !esOrdenamiento(r.cuadrilla)).length;
  }, [rankingCompleto]);

  const conteoOrdenamientos = useMemo(() => {
    return rankingCompleto.filter((r) => esOrdenamiento(r.cuadrilla)).length;
  }, [rankingCompleto]);

  // Ranking según el filtro de tipo (Operativos por defecto excluye 'O', Ordenamientos solo 'O', o Todos)
  const rankingPorTipo = useMemo(() => {
    return rankingCompleto.filter((r) => {
      const esO = esOrdenamiento(r.cuadrilla);
      if (filtroTipoOrdenamiento === "OPERATIVOS") return !esO;
      if (filtroTipoOrdenamiento === "ORDENAMIENTOS") return esO;
      return true;
    });
  }, [rankingCompleto, filtroTipoOrdenamiento]);

  // Lista única de cuadrillas para el filtro (según el tipo activo)
  const listaCuadrillas = useMemo(() => {
    const setC = new Set<string>();
    for (const r of rankingPorTipo) {
      if (r.cuadrilla && r.cuadrilla !== "Sin Cuadrilla") {
        setC.add(r.cuadrilla);
      }
    }
    return Array.from(setC).sort();
  }, [rankingPorTipo]);

  // Filtrado por búsqueda y cuadrilla
  const rankingFiltrado = useMemo(() => {
    return rankingPorTipo.filter((r) => {
      if (filtroCuadrilla !== "TODOS" && r.cuadrilla !== filtroCuadrilla) {
        return false;
      }
      if (filtroTexto.trim()) {
        const q = filtroTexto.toLowerCase();
        return (
          r.nombre_completo.toLowerCase().includes(q) ||
          r.cuadrilla?.toLowerCase().includes(q) ||
          r.documento?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rankingPorTipo, filtroTexto, filtroCuadrilla]);

  // Estadísticas Globales del Mes (según el tipo activo)
  const statsGlobales = useMemo(() => {
    const totalTecnicosConTardanza = rankingPorTipo.length;
    const totalTardanzasMes = rankingPorTipo.reduce(
      (acc, curr) => acc + curr.totalTardanzas,
      0
    );
    const totalMinutosMes = rankingPorTipo.reduce(
      (acc, curr) => acc + curr.totalMinutos,
      0
    );
    const promedioMinutosGeneral =
      totalTardanzasMes > 0 ? Math.round(totalMinutosMes / totalTardanzasMes) : 0;
    const peorTardanzaMes = rankingPorTipo.reduce(
      (max, curr) => Math.max(max, curr.maxRetraso),
      0
    );

    return {
      totalTecnicosConTardanza,
      totalTardanzasMes,
      totalMinutosMes,
      promedioMinutosGeneral,
      peorTardanzaMes,
    };
  }, [rankingPorTipo]);

  // Análisis por Día de la Semana
  const diasSemanaAnalisis = useMemo(() => {
    const dias = [
      { nombre: "Lunes", count: 0 },
      { nombre: "Martes", count: 0 },
      { nombre: "Miércoles", count: 0 },
      { nombre: "Jueves", count: 0 },
      { nombre: "Viernes", count: 0 },
      { nombre: "Sábado", count: 0 },
      { nombre: "Domingo", count: 0 },
    ];

    const tardanzasActivas = rankingPorTipo.flatMap((r) => r.tardanzas);

    for (const a of tardanzasActivas) {
      if (!a.fecha) continue;
      const [y, m, d] = String(a.fecha).slice(0, 10).split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      const dayIdx = dt.getDay(); // 0 Dom, 1 Lun...
      const idxNormalizado = dayIdx === 0 ? 6 : dayIdx - 1;
      if (dias[idxNormalizado]) {
        dias[idxNormalizado].count++;
      }
    }

    const maxCount = Math.max(...dias.map((d) => d.count), 1);
    return dias.map((d) => ({
      ...d,
      porcentaje: Math.round((d.count / maxCount) * 100),
    }));
  }, [rankingPorTipo]);

  // Podio Top 3
  const podioTop3 = rankingFiltrado.slice(0, 3);

  // 📊 Exportar Ranking a Excel
  const handleExportarExcel = () => {
    if (rankingFiltrado.length === 0) return;

    const htmlTable = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <style>
          body { font-family: Calibri, Arial, sans-serif; }
          .th-head { background-color: #B45309; color: #FFFFFF; font-weight: bold; text-align: center; border: 1px solid #78350F; height: 32px; font-size: 11pt; }
          .td-cell { border: 1px solid #CBD5E1; padding: 8px 12px; font-size: 10pt; vertical-align: middle; }
          .td-center { border: 1px solid #CBD5E1; text-align: center; padding: 8px 12px; font-size: 10pt; vertical-align: middle; }
          .td-bad { border: 1px solid #CBD5E1; text-align: center; padding: 8px 12px; font-weight: bold; color: #991B1B; background-color: #FEE2E2; font-size: 11pt; }
          .td-min { border: 1px solid #CBD5E1; text-align: center; padding: 8px 12px; font-weight: bold; color: #B45309; background-color: #FEF3C7; font-size: 10pt; }
        </style>
      </head>
      <body>
        <table border="0" cellpadding="0" cellspacing="0">
          <thead>
            <tr>
              <th class="th-head" width="50">PUESTO</th>
              <th class="th-head" width="280">TÉCNICO</th>
              <th class="th-head" width="130">DNI</th>
              <th class="th-head" width="160">CUADRILLA</th>
              <th class="th-head" width="140">TOTAL TARDANZAS</th>
              <th class="th-head" width="160">MINUTOS ACUMULADOS</th>
              <th class="th-head" width="160">PROMEDIO RETRASO</th>
              <th class="th-head" width="140">MÁX. RETRASO</th>
            </tr>
          </thead>
          <tbody>
            ${rankingFiltrado
              .map(
                (item, idx) => `
              <tr style="background-color: ${idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC"};">
                <td class="td-center">#${idx + 1}</td>
                <td class="td-cell"><b>${item.nombre_completo}</b></td>
                <td class="td-center">${item.documento || "-"}</td>
                <td class="td-center"><b>${item.cuadrilla || "-"}</b></td>
                <td class="td-bad">${item.totalTardanzas} T</td>
                <td class="td-min">+${item.totalMinutos} min</td>
                <td class="td-center">+${item.promedioMinutos} min</td>
                <td class="td-center">+${item.maxRetraso} min</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlTable], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Ranking_Tardanzas_${mesLabel.replace(/[^a-zA-Z0-9]/g, "_")}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Barra de Control Superior */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        {/* Fila 1: Título y Acciones Globales */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <Trophy size={24} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Ranking de Tardanzas & Reincidencias
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
                  Auditoría RRHH
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Control gerencial de puntualidad, minutos perdidos y técnicos más afectados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cargarDatos}
              disabled={loading}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl transition-all cursor-pointer shadow-2xs"
              title="Recargar datos"
            >
              <RotateCw size={16} className={loading ? "animate-spin" : ""} />
            </button>

            <button
              type="button"
              onClick={handleExportarExcel}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-2xl text-xs font-black shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              title="Exportar ranking completo a Excel"
            >
              <FileSpreadsheet size={15} />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* Fila 2: Filtros por Periodo (Día, Semana, Mes, Rango de Fecha) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Botones de Selección de Modo */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/70 shadow-2xs">
            <button
              type="button"
              onClick={() => setTipoPeriodo("dia")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tipoPeriodo === "dia"
                  ? "bg-white text-slate-900 shadow-xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Día
            </button>
            <button
              type="button"
              onClick={() => setTipoPeriodo("semana")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tipoPeriodo === "semana"
                  ? "bg-white text-slate-900 shadow-xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setTipoPeriodo("mes")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tipoPeriodo === "mes"
                  ? "bg-white text-slate-900 shadow-xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Mes
            </button>
            <button
              type="button"
              onClick={() => setTipoPeriodo("rango")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tipoPeriodo === "rango"
                  ? "bg-white text-slate-900 shadow-xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Rango de Fecha
            </button>
          </div>

          {/* Controles dinámicos según el modo activo */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. MODO DÍA */}
            {tipoPeriodo === "dia" && (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center bg-slate-100 rounded-2xl p-1 border border-slate-200/80 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => cambiarDia(-1)}
                    className="p-1.5 hover:bg-white rounded-xl text-slate-600 transition-all cursor-pointer"
                    title="Día anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="flex items-center gap-1.5 px-2">
                    <Calendar size={14} className="text-amber-600" />
                    <input
                      type="date"
                      value={fechaDia}
                      onChange={(e) => setFechaDia(e.target.value)}
                      className="bg-transparent text-xs font-black text-slate-800 focus:outline-none cursor-pointer"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => cambiarDia(1)}
                    className="p-1.5 hover:bg-white rounded-xl text-slate-600 transition-all cursor-pointer"
                    title="Día siguiente"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={irHoy}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  Hoy
                </button>
              </div>
            )}

            {/* 2. MODO SEMANA */}
            {tipoPeriodo === "semana" && (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center bg-slate-100 rounded-2xl p-1 border border-slate-200/80 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => cambiarSemana(-1)}
                    className="p-1.5 hover:bg-white rounded-xl text-slate-600 transition-all cursor-pointer"
                    title="Semana anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-3 font-mono font-black text-xs text-slate-800 min-w-[190px] text-center">
                    {periodoLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => cambiarSemana(1)}
                    className="p-1.5 hover:bg-white rounded-xl text-slate-600 transition-all cursor-pointer"
                    title="Semana siguiente"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={irSemanaActual}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  Esta Semana
                </button>
              </div>
            )}

            {/* 3. MODO MES */}
            {tipoPeriodo === "mes" && (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center bg-slate-100 rounded-2xl p-1 border border-slate-200/80 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => cambiarMes(-1)}
                    className="p-1.5 hover:bg-white rounded-xl text-slate-600 transition-all cursor-pointer"
                    title="Mes anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-3 font-mono font-black text-xs text-slate-800 min-w-[130px] text-center">
                    {periodoLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => cambiarMes(1)}
                    className="p-1.5 hover:bg-white rounded-xl text-slate-600 transition-all cursor-pointer"
                    title="Mes siguiente"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={irMesActual}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  Mes Actual
                </button>
              </div>
            )}

            {/* 4. MODO RANGO DE FECHA */}
            {tipoPeriodo === "rango" && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5 shadow-2xs">
                  <span className="text-[10px] font-black uppercase text-slate-500">Desde:</span>
                  <input
                    type="date"
                    value={rangoDesde}
                    max={rangoHasta}
                    onChange={(e) => setRangoDesde(e.target.value)}
                    className="bg-transparent text-xs font-black text-slate-800 focus:outline-none cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5 shadow-2xs">
                  <span className="text-[10px] font-black uppercase text-slate-500">Hasta:</span>
                  <input
                    type="date"
                    value={rangoHasta}
                    min={rangoDesde}
                    onChange={(e) => setRangoHasta(e.target.value)}
                    className="bg-transparent text-xs font-black text-slate-800 focus:outline-none cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setPresetRango(7)}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-white rounded-xl transition-all cursor-pointer"
                  >
                    7D
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetRango(15)}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-white rounded-xl transition-all cursor-pointer"
                  >
                    15D
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetRango(30)}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-white rounded-xl transition-all cursor-pointer"
                  >
                    30D
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetRango("esteMes")}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-white rounded-xl transition-all cursor-pointer"
                  >
                    Este Mes
                  </button>
                </div>
              </div>
            )}

            {/* Badge indicador del periodo activo */}
            <div className="px-3 py-1.5 bg-amber-50 border border-amber-200/80 rounded-2xl text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
              <Calendar size={13} className="text-amber-600" />
              <span>{periodoLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtro de Personal: Operativos vs Ordenamiento */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-slate-500" />
          <span className="text-xs font-black uppercase text-slate-700 tracking-wider">
            Tipo de Cuadrilla:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setFiltroTipoOrdenamiento("OPERATIVOS")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              filtroTipoOrdenamiento === "OPERATIVOS"
                ? "bg-teal-600 text-white shadow-xs font-black"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Mostrar únicamente técnicos operativos de campo (excluye cuadrillas O por defecto)"
          >
            <Zap size={14} className={filtroTipoOrdenamiento === "OPERATIVOS" ? "text-amber-300" : "text-slate-400"} />
            <span>Operativos ({conteoOperativos})</span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroTipoOrdenamiento("ORDENAMIENTOS")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              filtroTipoOrdenamiento === "ORDENAMIENTOS"
                ? "bg-violet-600 text-white shadow-xs font-black ring-2 ring-violet-300"
                : "text-violet-700 hover:bg-violet-100/70"
            }`}
            title="Mostrar únicamente cuadrillas de Ordenamiento (inician con 'O')"
          >
            <span className={`w-2 h-2 rounded-full ${filtroTipoOrdenamiento === "ORDENAMIENTOS" ? "bg-white" : "bg-violet-500"}`} />
            <span>Ordenamiento (Cuadrillas O) ({conteoOrdenamientos})</span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroTipoOrdenamiento("TODOS")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              filtroTipoOrdenamiento === "TODOS"
                ? "bg-slate-800 text-white shadow-xs font-black"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Ver todos los técnicos sin exclusión"
          >
            <Users size={14} />
            <span>Todos ({rankingCompleto.length})</span>
          </button>
        </div>
      </div>

      {/* Banner Informativo cuando se filtra por Ordenamiento */}
      {filtroTipoOrdenamiento === "ORDENAMIENTOS" && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-2xl text-xs text-violet-900 font-bold animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse" />
            <span>
              Filtro Activo: Visualizando exclusivamente <strong>Ordenamiento ({conteoOrdenamientos} técnicos con cuadrillas que empiezan con 'O')</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFiltroTipoOrdenamiento("OPERATIVOS")}
            className="text-violet-700 hover:text-violet-950 underline font-black cursor-pointer text-xs"
          >
            Volver a Operativos
          </button>
        </div>
      )}

      {/* Tarjetas KPI de Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Tardanzas
            </span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Flame size={18} />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-amber-600">
              {statsGlobales.totalTardanzasMes}
            </span>
            <span className="text-xs text-slate-400 font-medium">incidencias</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            En {statsGlobales.totalTecnicosConTardanza} técnicos registrados
          </p>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Minutos Perdidos
            </span>
            <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <Clock size={18} />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-rose-600">
              +{statsGlobales.totalMinutosMes}
            </span>
            <span className="text-xs text-slate-400 font-medium">min</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Equivale a ~{Math.round(statsGlobales.totalMinutosMes / 60)} horas de retraso
          </p>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Promedio Retraso
            </span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <BarChart3 size={18} />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-slate-800">
              +{statsGlobales.promedioMinutosGeneral}
            </span>
            <span className="text-xs text-slate-400 font-medium">min / día</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Media por día de tardanza</p>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Peor Tardanza
            </span>
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <ShieldAlert size={18} />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-purple-700">
              +{statsGlobales.peorTardanzaMes}
            </span>
            <span className="text-xs text-slate-400 font-medium">min máx</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Mayor retraso en una jornada</p>
        </div>
      </div>

      {/* Podio Top 3 y Análisis por Días de la Semana */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Podio Top 3 Visual */}
        <div className="lg:col-span-2 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white rounded-3xl p-5 border border-amber-200/70 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award className="text-amber-600" size={20} />
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Podio: Técnicos con Mayor Reincidencia
              </h4>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Top 3 del período {mesLabel}
            </span>
          </div>

          {podioTop3.length === 0 ? (
            <div className="py-10 text-center text-slate-400 space-y-2">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500 opacity-70" />
              <p className="text-xs font-semibold">
                ¡Excelente! No hay tardanzas registradas en este período.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {podioTop3.map((tec, idx) => {
                const medallas = [
                  { color: "from-amber-400 to-amber-500", border: "border-amber-300", badge: "bg-amber-100 text-amber-900", icon: "🥇", pos: "1° Puesto" },
                  { color: "from-slate-300 to-slate-400", border: "border-slate-300", badge: "bg-slate-100 text-slate-800", icon: "🥈", pos: "2° Puesto" },
                  { color: "from-amber-600 to-amber-700", border: "border-amber-500/40", badge: "bg-amber-50 text-amber-900", icon: "🥉", pos: "3° Puesto" },
                ];
                const conf = medallas[idx] || medallas[2];

                return (
                  <div
                    key={tec.id_trabajador || idx}
                    className={`bg-white rounded-2xl p-4 border ${conf.border} shadow-sm relative flex flex-col justify-between hover:shadow-md transition-all`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">{conf.icon}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${conf.badge}`}>
                          {conf.pos}
                        </span>
                      </div>

                      <h5 className="font-extrabold text-xs text-slate-900 line-clamp-2 leading-tight">
                        {tec.nombre_completo}
                      </h5>
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono font-bold">
                        {tec.cuadrilla}
                      </span>

                      <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-center">
                        <div className="bg-amber-50/70 p-1.5 rounded-xl border border-amber-200/60">
                          <span className="text-[9px] uppercase font-bold text-amber-800 block">
                            Tardanzas
                          </span>
                          <span className="text-base font-black font-mono text-amber-700">
                            {tec.totalTardanzas}
                          </span>
                        </div>
                        <div className="bg-rose-50/70 p-1.5 rounded-xl border border-rose-200/60">
                          <span className="text-[9px] uppercase font-bold text-rose-800 block">
                            Minutos
                          </span>
                          <span className="text-base font-black font-mono text-rose-700">
                            +{tec.totalMinutos}m
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onVerDetalleTecnico(tec, tec.tardanzas, periodoLabel)}
                      className="mt-3 w-full py-1.5 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Ver Desglose</span>
                      <ExternalLink size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Días Críticos de la Semana */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="text-slate-600" size={18} />
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Días con Más Tardanzas
              </h4>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Distribución de llegadas fuera de tolerancia según día de la semana
            </p>

            <div className="space-y-2.5">
              {diasSemanaAnalisis.map((dia) => (
                <div key={dia.nombre} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">{dia.nombre}</span>
                    <span className="font-mono font-bold text-slate-900">
                      {dia.count} {dia.count === 1 ? "tardanza" : "tardanzas"}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        dia.count > 10
                          ? "bg-rose-500"
                          : dia.count > 5
                          ? "bg-amber-500"
                          : "bg-teal-500"
                      }`}
                      style={{ width: `${dia.porcentaje}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla Completa de Ranking 1 a N */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Cabecera de Filtros de la Tabla */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
              Tabla General de Ranking ({rankingFiltrado.length} Técnicos)
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Buscador */}
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                placeholder="Buscar por técnico o cuadrilla..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white transition-all"
              />
            </div>

            {/* Filtro por Cuadrilla */}
            {listaCuadrillas.length > 0 && (
              <select
                value={filtroCuadrilla}
                onChange={(e) => setFiltroCuadrilla(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="TODOS">Todas las Cuadrillas</option>
                {listaCuadrillas.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {/* Botón rápido Ordenamiento en cabecera de tabla */}
            <button
              type="button"
              onClick={() =>
                setFiltroTipoOrdenamiento((prev) =>
                  prev === "ORDENAMIENTOS" ? "OPERATIVOS" : "ORDENAMIENTOS"
                )
              }
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                filtroTipoOrdenamiento === "ORDENAMIENTOS"
                  ? "bg-violet-600 text-white border-violet-700 font-black shadow-xs ring-1 ring-violet-300"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-violet-50 hover:text-violet-900"
              }`}
              title="Alternar entre técnicos Operativos y personal de Ordenamiento"
            >
              <span className={`w-2 h-2 rounded-full ${filtroTipoOrdenamiento === "ORDENAMIENTOS" ? "bg-white" : "bg-violet-500"}`} />
              <span>{filtroTipoOrdenamiento === "ORDENAMIENTOS" ? "Viendo Ordenamiento" : "Filtrar Ordenamiento"}</span>
            </button>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          {rankingFiltrado.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500 opacity-70" />
              <p className="text-xs font-semibold">
                No se encontraron tardanzas para el criterio de búsqueda seleccionado.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/80 text-[10px] font-black uppercase text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center w-12">Puesto</th>
                  <th className="py-3 px-4">Técnico & Datos</th>
                  <th className="py-3 px-3 text-center">Cuadrilla</th>
                  <th className="py-3 px-3 text-center">Total Tardanzas</th>
                  <th className="py-3 px-3 text-center">Minutos Acumulados</th>
                  <th className="py-3 px-3 text-center">Promedio x Día</th>
                  <th className="py-3 px-3 text-center">Peor Tardanza</th>
                  <th className="py-3 px-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {rankingFiltrado.map((item, idx) => {
                  const esTop3 = idx < 3;
                  const medallaIcon = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;

                  return (
                    <tr
                      key={item.id_trabajador || idx}
                      className="hover:bg-amber-50/30 transition-colors"
                    >
                      <td className="py-3 px-3 text-center font-sans font-black text-sm">
                        {medallaIcon ? (
                          <span title={`${idx + 1}° Puesto`}>{medallaIcon}</span>
                        ) : (
                          <span className="text-slate-400 font-semibold text-xs">#{idx + 1}</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-sans">
                        <div className="font-extrabold text-slate-900 text-xs">
                          {item.nombre_completo}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          {canVerDetallesPersonal && item.documento && (
                            <span className="font-mono">DNI: {item.documento}</span>
                          )}
                          {item.rol_nombre && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold">
                              {item.rol_nombre}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono font-bold text-[11px] border ${
                            esOrdenamiento(item.cuadrilla)
                              ? "bg-violet-100 text-violet-800 border-violet-300 font-black"
                              : "bg-slate-100 text-slate-800 border-slate-200"
                          }`}
                        >
                          {item.cuadrilla}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center min-w-[34px] px-2.5 py-1 rounded-full text-xs font-black ${
                            item.totalTardanzas >= 5
                              ? "bg-rose-100 text-rose-800 border border-rose-300"
                              : item.totalTardanzas >= 3
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-slate-100 text-slate-700 border border-slate-300"
                          }`}
                        >
                          {item.totalTardanzas} T
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="font-black text-rose-600 text-xs">
                          +{item.totalMinutos} min
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="font-bold text-slate-700 text-xs">
                          +{item.promedioMinutos} min
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            item.maxRetraso > 45
                              ? "bg-rose-50 text-rose-700"
                              : "bg-slate-50 text-slate-600"
                          }`}
                        >
                          +{item.maxRetraso}m
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => onVerDetalleTecnico(item, item.tardanzas, periodoLabel)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                          title="Ver desglose detallado con horas de inicio"
                        >
                          <span>Ver Desglose</span>
                          <ExternalLink size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
