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
} from "lucide-react";
import {
  PagoTotales,
  TecnicoPagoItem,
  OrdenPagoDetalle,
  getPagosResumen,
  getPagoDetalleTecnico,
} from "./services/paymentService";

export const PaymentsPage: React.FC = () => {
  const hoy = new Date().toISOString().split("T")[0];

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
  });

  const [tecnicos, setTecnicos] = useState<TecnicoPagoItem[]>([]);
  const [filtroTexto, setFiltroTexto] = useState("");

  // Modal Detalle
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [tecnicoSeleccionado, setTecnicoSeleccionado] = useState<TecnicoPagoItem | null>(null);
  const [ordenesDetalle, setOrdenesDetalle] = useState<OrdenPagoDetalle[]>([]);
  const [totalesDetalle, setTotalesDetalle] = useState<PagoTotales | null>(null);

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
      ["Tecnico", "Ordenes", "Sin Precio", "Ingreso WIN (S/)", "Material (S/)", "Pago Tecnico (S/)", "Ganancia (S/)"],
      ...tecnicos.map((t) => [
        `"${t.tecnico}"`,
        t.num_ordenes,
        t.sin_precio,
        t.ingreso_win.toFixed(2),
        t.costo_material.toFixed(2),
        t.pago_tecnico.toFixed(2),
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
          <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center font-black shadow-xs">
            <Coins size={22} />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Liquidación Financiera y Pagos</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Control de ingresos WIN, descuentos por materiales, pago a técnicos y ganancia neta
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportarExcel}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm shadow-sky-600/20 transition-all cursor-pointer"
          >
            <FileSpreadsheet size={15} />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Contenido con Scroll */}
      <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6 min-h-0">
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

        {/* 5 Tarjetas KPIs de Resumen del Periodo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Ingreso WIN */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center font-black shrink-0">
              <DollarSign size={24} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Ingreso WIN</span>
              <span className="text-lg font-black text-slate-900 tracking-tight block truncate">
                S/ {totales.ingreso_win.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Costo Material */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black shrink-0">
              <Package size={24} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Costo Material</span>
              <span className="text-lg font-black text-amber-600 tracking-tight block truncate">
                S/ {totales.costo_material.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Pago a Técnicos */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-black shrink-0">
              <Users size={24} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Pago Técnicos</span>
              <span className="text-lg font-black text-rose-600 tracking-tight block truncate">
                S/ {totales.pago_tecnicos.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Ganancia Neta */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black shrink-0">
              <TrendingUp size={24} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Ganancia Neta</span>
              <span className="text-lg font-black text-emerald-600 tracking-tight block truncate">
                S/ {totales.ganancia.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Total Órdenes */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-black shrink-0">
              <ClipboardList size={24} />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Órdenes</span>
              <span className="text-lg font-black text-sky-700 tracking-tight block">
                {totales.num_ordenes}{" "}
                {totales.sin_precio > 0 && (
                  <span className="text-xs font-semibold text-rose-500">({totales.sin_precio} sin precio)</span>
                )}
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
                  <th className="p-3.5 text-right text-rose-600">Pago Técnico</th>
                  <th className="p-3.5 text-right text-emerald-600">Ganancia</th>
                  <th className="p-3.5 text-center pr-6">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-slate-400 font-bold">
                      <RotateCw className="animate-spin inline-block mr-2" size={16} />
                      Calculando liquidaciones...
                    </td>
                  </tr>
                ) : tecnicosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-slate-400">
                      No se encontraron registros en el periodo seleccionado.
                    </td>
                  </tr>
                ) : (
                  tecnicosFiltrados.map((t) => (
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
                      <td className="p-3.5 text-right font-black text-rose-600">
                        S/ {t.pago_tecnico.toFixed(2)}
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Detalle por Técnico */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
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

            <div className="flex-1 p-5 overflow-y-auto min-h-0">
              {cargandoDetalle ? (
                <div className="p-12 text-center text-slate-400 font-bold">
                  <RotateCw className="animate-spin inline-block mr-2" size={18} />
                  Cargando desglose de órdenes...
                </div>
              ) : ordenesDetalle.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
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
                          <td className="p-3 text-slate-500">{ord.fecha_visita ? ord.fecha_visita.substring(0, 10) : "-"}</td>
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

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between rounded-b-3xl">
              <div className="text-xs text-slate-600 font-bold">
                Total a pagar al técnico:{" "}
                <span className="text-rose-600 font-black text-sm">
                  S/ {totalesDetalle?.pago_tecnicos.toFixed(2) || "0.00"}
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
