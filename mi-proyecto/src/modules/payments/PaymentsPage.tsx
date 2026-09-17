import React, { useState, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  Package,
  Users,
  ClipboardList,
  Calendar,
  Search,
  Filter,
  FileSpreadsheet,
  RotateCw,
  RotateCcw,
  Eye,
  X,
  AlertCircle,
  Coins,
  ArrowUpRight,
  Receipt,
  Wallet,
  Clock,
  CheckCircle2,
} from "lucide-react";
import {
  PagoTotales,
  TecnicoPagoItem,
  OrdenPagoDetalle,
  AdelantoTecnicoItem,
  getPagosResumen,
  getPagoDetalleTecnico,
} from "./services/paymentService";
import { AdelantosTab } from "./components/AdelantosTab";
import { OnlineChatDropdown } from "../../components/chat/OnlineChatDropdown";

interface PaymentsPageProps {
  currentUserId?: number;
}

export const PaymentsPage: React.FC<PaymentsPageProps> = ({ currentUserId }) => {
  const hoy = new Date().toISOString().split("T")[0];

  // Pestaña activa: "liquidaciones" | "adelantos"
  const [activeTab, setActiveTab] = useState<"liquidaciones" | "adelantos">("liquidaciones");

  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [estadoLiquidacion, setEstadoLiquidacion] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [totales, setTotales] = useState<PagoTotales>({
    num_ordenes: 0,
    sin_precio: 0,
    ingreso_win: 0,
    costo_material: 0,
    pago_tecnicos: 0,
    ganancia: 0,
    total_adelantos: 0,
    neto_total: 0,
  });

  const [tecnicos, setTecnicos] = useState<TecnicoPagoItem[]>([]);
  const [filtroTexto, setFiltroTexto] = useState("");

  // Modal Detalle
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [tecnicoSeleccionado, setTecnicoSeleccionado] = useState<TecnicoPagoItem | null>(null);
  const [ordenesDetalle, setOrdenesDetalle] = useState<OrdenPagoDetalle[]>([]);
  const [adelantosDetalle, setAdelantosDetalle] = useState<AdelantoTecnicoItem[]>([]);
  const [totalesDetalle, setTotalesDetalle] = useState<(PagoTotales & { total_adelantos?: number; neto_a_pagar?: number }) | null>(null);

  const consultarPagos = async (d = desde, h = hasta, est = estadoLiquidacion) => {
    try {
      setLoading(true);
      setErrorMsg("");
      const res = await getPagosResumen(d, h, est);
      setTotales(res.totales);
      setTecnicos(res.tecnicos);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error al consultar pagos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    consultarPagos();
  }, []);

  const handleHoy = () => {
    setDesde(hoy);
    setHasta(hoy);
    consultarPagos(hoy, hoy, estadoLiquidacion);
  };

  const handleLimpiar = () => {
    setDesde(hoy);
    setHasta(hoy);
    setEstadoLiquidacion("");
    setFiltroTexto("");
    consultarPagos(hoy, hoy, "");
  };

  const handleConsultar = (e: React.FormEvent) => {
    e.preventDefault();
    consultarPagos();
  };

  const handleAbrirDetalle = async (tec: TecnicoPagoItem) => {
    setTecnicoSeleccionado(tec);
    setModalAbierto(true);
    try {
      setCargandoDetalle(true);
      const res = await getPagoDetalleTecnico(tec.id_trabajador, desde, hasta, estadoLiquidacion);
      setOrdenesDetalle(res.ordenes);
      setAdelantosDetalle(res.adelantos || []);
      setTotalesDetalle(res.totales);
    } catch (err: any) {
      alert("Error al cargar detalle: " + err.message);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const exportarExcel = () => {
    if (tecnicos.length === 0) return alert("No hay datos para exportar");
    const filasCsv = [
      ["Tecnico", "Ordenes", "Sin Precio", "Ingreso WIN (S/)", "Material (S/)", "Pago Bruto (S/)", "Adelantos Pendientes (S/)", "Neto a Pagar (S/)", "Ganancia (S/)"],
      ...tecnicos.map((t) => [
        `"${t.tecnico}"`,
        t.num_ordenes,
        t.sin_precio,
        t.ingreso_win.toFixed(2),
        t.costo_material.toFixed(2),
        t.pago_tecnico.toFixed(2),
        (t.adelantos || 0).toFixed(2),
        (t.neto_a_pagar ?? t.pago_tecnico).toFixed(2),
        t.ganancia.toFixed(2),
      ]),
    ];
    const contenido = "\uFEFF" + filasCsv.map((e) => e.join(",")).join("\n");
    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `pagos_tecnicos_${desde}_al_${hasta}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tecnicosFiltrados = tecnicos.filter((t) => {
    if (!filtroTexto.trim()) return true;
    return t.tecnico.toLowerCase().includes(filtroTexto.toLowerCase());
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100/70 overflow-hidden font-sans">
      {/* Header General del Módulo */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("toggleSidebar"))}
            className="w-11 h-11 rounded-2xl bg-sky-50 hover:bg-sky-100 active:scale-95 text-sky-600 hover:text-sky-800 border border-sky-200 hover:border-sky-300 flex items-center justify-center font-black shadow-xs cursor-pointer transition-all group shrink-0"
            title="📋 Clic para abrir el menú lateral"
          >
            <Coins size={22} className="group-hover:scale-110 transition-transform" />
          </button>
          <div>
            <h1
              onClick={() => window.dispatchEvent(new CustomEvent("toggleSidebar"))}
              className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 cursor-pointer hover:text-sky-700 transition-colors"
              title="📋 Clic para abrir el menú lateral"
            >
              <span>Liquidación Financiera y Pagos</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Control de ingresos WIN, descuentos por materiales, pago a técnicos, adelantos de sueldo y ganancia neta
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <OnlineChatDropdown />

          {activeTab === "liquidaciones" && (
            <button
              type="button"
              onClick={exportarExcel}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm shadow-sky-600/20 transition-all cursor-pointer h-9"
            >
              <FileSpreadsheet size={15} />
              <span>Exportar CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Pestañas Principales del Módulo: Liquidaciones vs Adelantos */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-2.5 flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("liquidaciones")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "liquidaciones"
              ? "bg-sky-600 text-white shadow-sm shadow-sky-600/20"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Receipt size={16} />
          <span>Liquidación de Técnicos</span>
          <span
            className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md ${
              activeTab === "liquidaciones" ? "bg-white/20 text-white" : "bg-sky-100 text-sky-700"
            }`}
          >
            {tecnicos.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("adelantos")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "adelantos"
              ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Wallet size={16} />
          <span>Adelantos de Sueldo</span>
          {(totales.total_adelantos || 0) > 0 && (
            <span
              className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md ${
                activeTab === "adelantos" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              S/ {Number(totales.total_adelantos).toFixed(0)}
            </span>
          )}
        </button>
      </div>

      {/* Contenido con Scroll */}
      <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6 min-h-0">
        {activeTab === "adelantos" ? (
          <AdelantosTab currentUserId={currentUserId} />
        ) : (
          <>
            {/* Barra de Filtros */}
            <form
              onSubmit={handleConsultar}
              className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-wrap items-end gap-3"
            >
              <div className="flex flex-col gap-1 min-w-[140px]">
                <label className="text-[11px] font-black text-slate-500 uppercase">Desde</label>
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex flex-col gap-1 min-w-[140px]">
                <label className="text-[11px] font-black text-slate-500 uppercase">Hasta</label>
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex flex-col gap-1 min-w-[160px]">
                <label className="text-[11px] font-black text-slate-500 uppercase">Liquidación</label>
                <select
                  value={estadoLiquidacion}
                  onChange={(e) => setEstadoLiquidacion(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                >
                  <option value="">Todas</option>
                  <option value="liquidada">Liquidadas</option>
                  <option value="pendiente">Pendientes</option>
                  <option value="rechazada">Rechazadas</option>
                  <option value="sin_liquidar">Sin liquidar</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleHoy}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Calendar size={14} />
                <span>Hoy</span>
              </button>

              <button
                type="button"
                onClick={handleLimpiar}
                title="Limpiar filtros y volver al día de hoy"
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw size={14} />
                <span>Limpiar Filtro</span>
              </button>

              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 shadow-md shadow-sky-600/20 disabled:opacity-50"
              >
                {loading ? <RotateCw className="animate-spin" size={14} /> : <Search size={14} />}
                <span>Consultar</span>
              </button>
            </form>

            {/* 6 Tarjetas KPIs de Resumen del Periodo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              {/* Ingreso WIN */}
              <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center font-black shrink-0">
                  <DollarSign size={22} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Ingreso WIN</span>
                  <span className="text-base font-black text-slate-900 tracking-tight block truncate">
                    S/ {totales.ingreso_win.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Costo Material */}
              <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black shrink-0">
                  <Package size={22} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Costo Material</span>
                  <span className="text-base font-black text-amber-600 tracking-tight block truncate">
                    S/ {totales.costo_material.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Pago Bruto Técnicos */}
              <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-black shrink-0">
                  <Users size={22} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Pago Bruto Técnico</span>
                  <span className="text-base font-black text-rose-600 tracking-tight block truncate">
                    S/ {totales.pago_tecnicos.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Adelantos Descontables */}
              <div className="bg-white rounded-3xl p-4 border border-amber-200/80 shadow-xs flex items-center gap-3 bg-amber-50/20">
                <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-black shrink-0">
                  <Wallet size={22} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider block">Adelantos Activos</span>
                  <span className="text-base font-black text-amber-700 tracking-tight block truncate">
                    - S/ {Number(totales.total_adelantos || 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Neto Total a Pagar */}
              <div className="bg-white rounded-3xl p-4 border border-rose-200/80 shadow-xs flex items-center gap-3 bg-rose-50/20">
                <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
                  <Coins size={22} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider block">Neto a Transferir</span>
                  <span className="text-base font-black text-rose-700 tracking-tight block truncate">
                    S/ {Number(totales.neto_total ?? totales.pago_tecnicos).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Ganancia Neta */}
              <div className="bg-white rounded-3xl p-4 border border-emerald-200/80 shadow-xs flex items-center gap-3 bg-emerald-50/10">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black shrink-0">
                  <TrendingUp size={22} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Ganancia Neta</span>
                  <span className="text-base font-black text-emerald-600 tracking-tight block truncate">
                    S/ {totales.ganancia.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabla Desglosada por Técnico */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Resumen y Liquidación por Técnico</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Periodo: {desde} al {hasta} · {tecnicos.length} técnicos con órdenes finalizadas
                  </p>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    type="text"
                    placeholder="Buscar técnico..."
                    value={filtroTexto}
                    onChange={(e) => setFiltroTexto(e.target.value)}
                    className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-100">
                      <th className="p-3.5 pl-6">Técnico Asignado</th>
                      <th className="p-3.5 text-center">Órdenes</th>
                      <th className="p-3.5 text-center">Sin Precio</th>
                      <th className="p-3.5 text-right">Ingreso WIN</th>
                      <th className="p-3.5 text-right">Material</th>
                      <th className="p-3.5 text-right text-slate-600">Pago Bruto</th>
                      <th className="p-3.5 text-right text-amber-600">Adelantos</th>
                      <th className="p-3.5 text-right text-rose-600">Neto a Pagar</th>
                      <th className="p-3.5 text-right text-emerald-600">Ganancia</th>
                      <th className="p-3.5 text-center pr-6">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                    {loading ? (
                      <tr>
                        <td colSpan={10} className="p-10 text-center text-slate-400 font-bold">
                          <RotateCw className="animate-spin inline-block mr-2" size={16} />
                          Calculando liquidaciones y adelantos...
                        </td>
                      </tr>
                    ) : tecnicosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-10 text-center text-slate-400">
                          No se encontraron registros en el periodo seleccionado.
                        </td>
                      </tr>
                    ) : (
                      tecnicosFiltrados.map((t) => {
                        const tieneAdelanto = (t.adelantos || 0) > 0;
                        const neto = t.neto_a_pagar ?? Math.max(0, t.pago_tecnico - (t.adelantos || 0));

                        return (
                          <tr key={t.id_trabajador} className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-3.5 pl-6 font-bold text-slate-900">{t.tecnico}</td>
                            <td className="p-3.5 text-center font-bold">{t.num_ordenes}</td>
                            <td className="p-3.5 text-center">
                              {t.sin_precio > 0 ? (
                                <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-md text-[11px] font-black">
                                  {t.sin_precio}
                                </span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                            <td className="p-3.5 text-right font-bold text-slate-900">
                              S/ {t.ingreso_win.toFixed(2)}
                            </td>
                            <td className="p-3.5 text-right font-bold text-amber-600">
                              S/ {t.costo_material.toFixed(2)}
                            </td>
                            <td className="p-3.5 text-right font-bold text-slate-600">
                              S/ {t.pago_tecnico.toFixed(2)}
                            </td>
                            <td className="p-3.5 text-right font-bold">
                              {tieneAdelanto ? (
                                <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-black">
                                  - S/ {t.adelantos?.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-slate-400">S/ 0.00</span>
                              )}
                            </td>
                            <td className="p-3.5 text-right font-black text-rose-600 text-sm">
                              S/ {neto.toFixed(2)}
                            </td>
                            <td className="p-3.5 text-right font-black text-emerald-600">
                              S/ {t.ganancia.toFixed(2)}
                            </td>
                            <td className="p-3.5 text-center pr-6">
                              <button
                                type="button"
                                onClick={() => handleAbrirDetalle(t)}
                                className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/80 rounded-xl text-[11px] font-black transition-all cursor-pointer flex items-center gap-1.5 mx-auto"
                              >
                                <Eye size={13} />
                                <span>Detalle</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal Detalle por Técnico */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Receipt size={18} className="text-sky-600" />
                  <span>Detalle de Liquidación: {tecnicoSeleccionado?.tecnico}</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Periodo: {desde} al {hasta} · {ordenesDetalle.length} órdenes finalizadas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 p-5 overflow-y-auto min-h-0 space-y-6">
              {cargandoDetalle ? (
                <div className="p-12 text-center text-slate-400 font-bold">
                  <RotateCw className="animate-spin inline-block mr-2" size={18} />
                  Cargando desglose de órdenes y adelantos...
                </div>
              ) : (
                <>
                  {/* Resumen de Liquidación del Técnico */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                      <span className="text-[10px] font-black text-slate-400 uppercase block">Total Producción Bruta</span>
                      <span className="text-base font-black text-slate-900">
                        S/ {totalesDetalle?.pago_tecnicos.toFixed(2) || "0.00"}
                      </span>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl">
                      <span className="text-[10px] font-black text-amber-600 uppercase block">Adelantos a Descontar</span>
                      <span className="text-base font-black text-amber-700">
                        - S/ {totalesDetalle?.total_adelantos?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl">
                      <span className="text-[10px] font-black text-rose-600 uppercase block">Neto Final a Transferir</span>
                      <span className="text-lg font-black text-rose-700">
                        S/ {totalesDetalle?.neto_a_pagar?.toFixed(2) || totalesDetalle?.pago_tecnicos.toFixed(2) || "0.00"}
                      </span>
                    </div>
                  </div>

                  {/* Sección Adelantos Registrados del Técnico */}
                  {adelantosDetalle.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Wallet size={14} className="text-amber-600" />
                        <span>Adelantos de Sueldo Pendientes / Aplicados</span>
                      </h4>
                      <div className="border border-amber-200 bg-amber-50/30 rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-amber-100/50 text-[10px] font-black text-amber-800 uppercase border-b border-amber-200">
                              <th className="p-2.5">Fecha</th>
                              <th className="p-2.5">Monto</th>
                              <th className="p-2.5">Método</th>
                              <th className="p-2.5">Motivo</th>
                              <th className="p-2.5 text-center">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100 text-xs font-medium">
                            {adelantosDetalle.map((a) => (
                              <tr key={a.id_adelanto} className="hover:bg-amber-100/30">
                                <td className="p-2.5 font-bold text-slate-800">{a.fecha_adelanto}</td>
                                <td className="p-2.5 font-black text-amber-700">S/ {Number(a.monto).toFixed(2)}</td>
                                <td className="p-2.5 text-slate-600">{a.metodo_pago}</td>
                                <td className="p-2.5 text-slate-600">{a.motivo || "Adelanto"}</td>
                                <td className="p-2.5 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                      a.estado === "PENDIENTE"
                                        ? "bg-amber-200 text-amber-800"
                                        : a.estado === "DESCONTADO"
                                        ? "bg-emerald-200 text-emerald-800"
                                        : "bg-rose-200 text-rose-800"
                                    }`}
                                  >
                                    {a.estado}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Tabla de Órdenes */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <ClipboardList size={14} className="text-sky-600" />
                      <span>Desglose de Órdenes Realizadas ({ordenesDetalle.length})</span>
                    </h4>

                    {ordenesDetalle.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl">
                        No se encontraron órdenes registradas para este técnico en este periodo.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-100">
                              <th className="p-3">N° Orden</th>
                              <th className="p-3">Fecha Visita</th>
                              <th className="p-3">Cliente</th>
                              <th className="p-3">Tipo / Motivo</th>
                              <th className="p-3 text-right">Ingreso WIN</th>
                              <th className="p-3 text-right text-rose-600">Pago Técnico</th>
                              <th className="p-3 text-right text-amber-600">Material</th>
                              <th className="p-3 text-right text-emerald-600">Ganancia</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                            {ordenesDetalle.map((ord, idx) => (
                              <tr key={`${ord.id_orden}-${idx}`} className="hover:bg-slate-50/60">
                                <td className="p-3 font-bold text-slate-900">{ord.numero}</td>
                                <td className="p-3 text-slate-500">
                                  {ord.fecha_visita ? ord.fecha_visita.substring(0, 10) : "-"}
                                </td>
                                <td className="p-3 truncate max-w-[150px]">{ord.cliente}</td>
                                <td className="p-3">
                                  <span className="block font-bold text-slate-800">{ord.tipo_trabajo}</span>
                                  {ord.motivo && <span className="text-[10px] text-slate-400">{ord.motivo}</span>}
                                </td>
                                <td className="p-3 text-right font-bold text-slate-900">
                                  S/ {ord.precio_win.toFixed(2)}
                                </td>
                                <td className="p-3 text-right font-black text-rose-600">
                                  S/ {ord.pago_tecnico.toFixed(2)}
                                </td>
                                <td className="p-3 text-right font-bold text-amber-600">
                                  S/ {ord.costo_material.toFixed(2)}
                                </td>
                                <td className="p-3 text-right font-black text-emerald-600">
                                  S/ {ord.ganancia.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between rounded-b-3xl">
              <div className="text-xs text-slate-600 font-bold">
                Neto final a pagar al técnico:{" "}
                <span className="text-rose-600 font-black text-base ml-1">
                  S/ {totalesDetalle?.neto_a_pagar?.toFixed(2) || totalesDetalle?.pago_tecnicos.toFixed(2) || "0.00"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
