import React, { useState, useEffect } from "react";
import {
  Coins,
  Search,
  RotateCw,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  Ban,
  Calendar,
  DollarSign,
  User,
  ArrowDownRight,
  Receipt,
  FileSpreadsheet,
  AlertCircle,
  X,
  CreditCard,
  Building2,
  Check,
  Edit2,
  Trash2,
} from "lucide-react";
import {
  AdelantoItem,
  AdelantoTotales,
  getAdelantos,
  crearAdelanto,
  actualizarAdelanto,
  eliminarAdelanto,
} from "../services/adelantoService";
import { getEmpleados } from "../../../services/employeeService";
import { Employee } from "../../../components/employee/Employee";

interface AdelantosTabProps {
  currentUserId?: number;
}

export const AdelantosTab: React.FC<AdelantosTabProps> = ({ currentUserId }) => {
  const hoy = new Date().toISOString().split("T")[0];

  // Filtros
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("TODOS");
  const [filtroTexto, setFiltroTexto] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Datos
  const [adelantos, setAdelantos] = useState<AdelantoItem[]>([]);
  const [totales, setTotales] = useState<AdelantoTotales>({
    total_monto: 0,
    total_pendiente: 0,
    total_descontado: 0,
    total_anulado: 0,
    cantidad: 0,
  });

  // Empleados para el modal
  const [empleados, setEmpleados] = useState<Employee[]>([]);

  // Modal Nuevo Adelanto
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [empBusqueda, setEmpBusqueda] = useState("");
  const [formEmpleado, setFormEmpleado] = useState<Employee | null>(null);
  const [formMonto, setFormMonto] = useState<number | "">(100);
  const [formFecha, setFormFecha] = useState(hoy);
  const [formMetodo, setFormMetodo] = useState("Transferencia");
  const [formOperacion, setFormOperacion] = useState("");
  const [formMotivo, setFormMotivo] = useState("Adelanto de sueldo");
  const [formObservaciones, setFormObservaciones] = useState("");

  // Modal Edición / Estado
  const [adelantoEditando, setAdelantoEditando] = useState<AdelantoItem | null>(null);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const res = await getAdelantos(desde || undefined, hasta || undefined, estadoFiltro);
      setAdelantos(res.adelantos || []);
      setTotales(res.totales);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error al cargar adelantos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    getEmpleados()
      .then((data) => setEmpleados(data.filter((e) => e.estado === "Activo")))
      .catch((err) => console.error("Error al cargar empleados:", err));
  }, []);

  const handleFiltrar = (e: React.FormEvent) => {
    e.preventDefault();
    cargarDatos();
  };

  const handleLimpiar = () => {
    setDesde("");
    setHasta("");
    setEstadoFiltro("TODOS");
    setFiltroTexto("");
    getAdelantos().then((res) => {
      setAdelantos(res.adelantos || []);
      setTotales(res.totales);
    });
  };

  const handleAbrirNuevo = () => {
    setFormEmpleado(null);
    setEmpBusqueda("");
    setFormMonto(100);
    setFormFecha(hoy);
    setFormMetodo("Transferencia");
    setFormOperacion("");
    setFormMotivo("Adelanto de sueldo");
    setFormObservaciones("");
    setModalAbierto(true);
  };

  const handleGuardarAdelanto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmpleado) {
      alert("Por favor selecciona al trabajador");
      return;
    }
    const montoNum = Number(formMonto);
    if (!montoNum || montoNum <= 0) {
      alert("Ingresa un monto válido mayor a S/ 0");
      return;
    }

    try {
      setGuardando(true);
      await crearAdelanto({
        id_trabajador: Number(formEmpleado.id),
        id_usuario_registro: currentUserId,
        monto: montoNum,
        fecha_adelanto: formFecha,
        metodo_pago: formMetodo,
        numero_operacion: formOperacion || undefined,
        motivo: formMotivo || "Adelanto de sueldo",
        observaciones: formObservaciones || undefined,
      });
      setModalAbierto(false);
      await cargarDatos();
    } catch (err: any) {
      alert(err.message || "Error al guardar el adelanto");
    } finally {
      setGuardando(false);
    }
  };

  const handleCambiarEstado = async (id: number, nuevoEstado: "PENDIENTE" | "DESCONTADO" | "ANULADO") => {
    const confirmMsg =
      nuevoEstado === "DESCONTADO"
        ? "¿Marcar este adelanto como DESCONTADO / COBRADO?"
        : nuevoEstado === "ANULADO"
        ? "¿Estás seguro de ANULAR este adelanto?"
        : "¿Regresar este adelanto a estado PENDIENTE?";

    if (!window.confirm(confirmMsg)) return;

    try {
      await actualizarAdelanto(id, { estado: nuevoEstado });
      await cargarDatos();
    } catch (err: any) {
      alert(err.message || "Error al actualizar estado");
    }
  };

  const handleEliminar = async (id: number) => {
    if (!window.confirm("¿Seguro de eliminar este registro de adelanto de forma permanente?")) return;
    try {
      await eliminarAdelanto(id);
      await cargarDatos();
    } catch (err: any) {
      alert(err.message || "Error al eliminar adelanto");
    }
  };

  const exportarExcel = () => {
    if (adelantos.length === 0) return alert("No hay adelantos para exportar");
    const filasCsv = [
      ["ID", "Fecha", "Trabajador", "Documento", "Monto (S/)", "Metodo", "Operacion", "Motivo", "Estado", "Fecha Descuento"],
      ...adelantos.map((a) => [
        a.id_adelanto,
        a.fecha_adelanto,
        `"${a.trabajador || ""}"`,
        a.documento || "",
        Number(a.monto).toFixed(2),
        a.metodo_pago,
        `"${a.numero_operacion || ""}"`,
        `"${a.motivo || ""}"`,
        a.estado,
        a.fecha_descuento || "",
      ]),
    ];
    const contenido = "\uFEFF" + filasCsv.map((e) => e.join(",")).join("\n");
    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `adelantos_sueldo_${hoy}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const adelantosFiltrados = adelantos.filter((a) => {
    if (!filtroTexto.trim()) return true;
    const term = filtroTexto.toLowerCase();
    return (
      (a.trabajador && a.trabajador.toLowerCase().includes(term)) ||
      (a.documento && a.documento.includes(term)) ||
      (a.motivo && a.motivo.toLowerCase().includes(term)) ||
      (a.numero_operacion && a.numero_operacion.toLowerCase().includes(term))
    );
  });

  const empleadosFiltradosModal = empleados.filter((e) => {
    if (!empBusqueda.trim()) return true;
    const term = empBusqueda.toLowerCase();
    const fullName = `${e.nombres} ${e.primerApellido} ${e.segundoApellido}`.toLowerCase();
    return fullName.includes(term) || (e.dni && e.dni.includes(term));
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6">
      {/* 4 KPIs de Resumen Financiero */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total General */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center font-black shrink-0">
            <Coins size={24} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
              Total Adelantado
            </span>
            <span className="text-xl font-black text-slate-900 tracking-tight block truncate">
              S/ {Number(totales.total_monto || 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-500 font-bold">
              {totales.cantidad} solicitudes registradas
            </span>
          </div>
        </div>

        {/* Pendientes de Descontar */}
        <div className="bg-white rounded-3xl p-5 border border-amber-200/80 shadow-xs flex items-center gap-3.5 bg-gradient-to-br from-white to-amber-50/20">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-black shrink-0">
            <Clock size={24} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-black text-amber-600 uppercase tracking-wider block">
              Por Descontar (Pendientes)
            </span>
            <span className="text-xl font-black text-amber-700 tracking-tight block truncate">
              S/ {Number(totales.total_pendiente || 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-amber-600/80 font-bold">
              Saldo activo a cobrar en planilla/liquidación
            </span>
          </div>
        </div>

        {/* Ya Descontados */}
        <div className="bg-white rounded-3xl p-5 border border-emerald-200/80 shadow-xs flex items-center gap-3.5 bg-gradient-to-br from-white to-emerald-50/20">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-black shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-black text-emerald-600 uppercase tracking-wider block">
              Cobrados / Descontados
            </span>
            <span className="text-xl font-black text-emerald-700 tracking-tight block truncate">
              S/ {Number(totales.total_descontado || 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-emerald-600/80 font-bold">
              Retenidos en liquidaciones cerradas
            </span>
          </div>
        </div>

        {/* Anulados */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center font-black shrink-0">
            <Ban size={24} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
              Anulados
            </span>
            <span className="text-xl font-black text-rose-600 tracking-tight block truncate">
              S/ {Number(totales.total_anulado || 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-500 font-bold">
              Cancelados o sin efecto
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Botón Nuevo */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <form onSubmit={handleFiltrar} className="flex flex-wrap items-end gap-3 flex-1">
          <div className="flex flex-col gap-1 min-w-[130px]">
            <label className="text-[11px] font-black text-slate-500 uppercase">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex flex-col gap-1 min-w-[130px]">
            <label className="text-[11px] font-black text-slate-500 uppercase">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex flex-col gap-1 min-w-[150px]">
            <label className="text-[11px] font-black text-slate-500 uppercase">Estado</label>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500"
            >
              <option value="TODOS">Todos los estados</option>
              <option value="PENDIENTE">Pendientes por descontar</option>
              <option value="DESCONTADO">Descontados / Cobrados</option>
              <option value="ANULADO">Anulados</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-sky-600/20 disabled:opacity-50"
          >
            {loading ? <RotateCw className="animate-spin" size={14} /> : <Search size={14} />}
            <span>Filtrar</span>
          </button>

          <button
            type="button"
            onClick={handleLimpiar}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Limpiar
          </button>
        </form>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportarExcel}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <FileSpreadsheet size={15} />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={handleAbrirNuevo}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Nuevo Adelanto</span>
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda rápida */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por técnico, DNI, motivo o N° operación..."
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 shadow-2xs"
          />
        </div>
        <span className="text-xs font-bold text-slate-500">
          Mostrando {adelantosFiltrados.length} de {adelantos.length} registros
        </span>
      </div>

      {/* Tabla de Registros */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RotateCw className="animate-spin text-sky-600" size={32} />
            <span className="text-xs font-bold">Cargando adelantos de sueldo...</span>
          </div>
        ) : errorMsg ? (
          <div className="p-8 text-center text-rose-500 text-xs font-bold flex flex-col items-center gap-2">
            <AlertCircle size={24} />
            <span>{errorMsg}</span>
          </div>
        ) : adelantosFiltrados.length === 0 ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Coins size={36} className="text-slate-300" />
            <span className="text-sm font-bold text-slate-600">No hay adelantos registrados</span>
            <span className="text-xs text-slate-400">Haz clic en "+ Nuevo Adelanto" para registrar el primero</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Fecha</th>
                  <th className="py-3.5 px-4">Trabajador</th>
                  <th className="py-3.5 px-4 text-right">Monto Adelanto</th>
                  <th className="py-3.5 px-4">Método / Operación</th>
                  <th className="py-3.5 px-4">Motivo</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                  <th className="py-3.5 px-4 text-center">Fecha Descuento</th>
                  <th className="py-3.5 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {adelantosFiltrados.map((a) => {
                  const montoNum = Number(a.monto) || 0;
                  return (
                    <tr key={a.id_adelanto} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-900">
                        {a.fecha_adelanto}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900">{a.trabajador || `ID #${a.id_trabajador}`}</span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {a.rol_nombre || "Técnico"} • DNI: {a.documento || "S/D"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="text-sm font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                          S/ {montoNum.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{a.metodo_pago}</span>
                          {a.numero_operacion && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Op: {a.numero_operacion}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <span className="text-slate-600 block truncate" title={a.motivo || ""}>
                          {a.motivo || "Adelanto de sueldo"}
                        </span>
                        {a.observaciones && (
                          <span className="text-[10px] text-slate-400 block truncate" title={a.observaciones}>
                            {a.observaciones}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {a.estado === "PENDIENTE" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-200">
                            <Clock size={11} />
                            <span>Pendiente</span>
                          </span>
                        ) : a.estado === "DESCONTADO" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={11} />
                            <span>Descontado</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200">
                            <Ban size={11} />
                            <span>Anulado</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap text-slate-500 font-bold">
                        {a.fecha_descuento || "—"}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {a.estado === "PENDIENTE" && (
                            <button
                              type="button"
                              onClick={() => handleCambiarEstado(a.id_adelanto, "DESCONTADO")}
                              title="Marcar como descontado / cobrado manualmente"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                          )}
                          {a.estado === "DESCONTADO" && (
                            <button
                              type="button"
                              onClick={() => handleCambiarEstado(a.id_adelanto, "PENDIENTE")}
                              title="Revertir a pendiente"
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                            >
                              <Clock size={16} />
                            </button>
                          )}
                          {a.estado !== "ANULADO" ? (
                            <button
                              type="button"
                              onClick={() => handleCambiarEstado(a.id_adelanto, "ANULADO")}
                              title="Anular adelanto"
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            >
                              <Ban size={16} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCambiarEstado(a.id_adelanto, "PENDIENTE")}
                              title="Restaurar a pendiente"
                              className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-all cursor-pointer"
                            >
                              <RotateCw size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleEliminar(a.id_adelanto)}
                            title="Eliminar registro"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL REGISTRAR ADELANTO */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-black">
                  <Coins size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Registrar Adelanto de Sueldo</h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Ingresa el monto para el trabajador y se descontará en su liquidación
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleGuardarAdelanto} className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Seleccionar Trabajador */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-1">
                  <User size={13} />
                  <span>Trabajador / Técnico *</span>
                </label>

                {formEmpleado ? (
                  <div className="p-3 bg-sky-50/60 border border-sky-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">
                        {formEmpleado.nombres} {formEmpleado.primerApellido} {formEmpleado.segundoApellido}
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">
                        {formEmpleado.rolNombre || "Técnico"} • DNI: {formEmpleado.dni || "S/D"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormEmpleado(null)}
                      className="px-2.5 py-1 text-[11px] font-bold bg-white text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 cursor-pointer"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Buscar trabajador por nombre o DNI..."
                      value={empBusqueda}
                      onChange={(e) => setEmpBusqueda(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                    <div className="max-h-36 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100">
                      {empleadosFiltradosModal.map((emp) => (
                        <div
                          key={emp.id}
                          onClick={() => setFormEmpleado(emp)}
                          className="p-2.5 hover:bg-sky-50/50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                        >
                          <div>
                            <span className="font-bold text-slate-900">
                              {emp.nombres} {emp.primerApellido} {emp.segundoApellido}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {emp.rolNombre || "Personal"} • DNI: {emp.dni}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md">
                            Seleccionar
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Botones de Monto Rápido y Entrada */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-1">
                  <DollarSign size={13} />
                  <span>Monto del Adelanto (S/) *</span>
                </label>

                {/* Chips de montos rápidos */}
                <div className="grid grid-cols-4 gap-2">
                  {[50, 100, 200, 400].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setFormMonto(m)}
                      className={`py-2 text-xs font-black rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        formMonto === m
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/30"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      <span>S/ {m}</span>
                    </button>
                  ))}
                </div>

                {/* Campo manual */}
                <div className="relative mt-2">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">
                    S/
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={formMonto}
                    onChange={(e) => setFormMonto(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Otro monto personalizado..."
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Fecha y Método */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-1">
                    <Calendar size={13} />
                    <span>Fecha de Entrega</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formFecha}
                    onChange={(e) => setFormFecha(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-1">
                    <CreditCard size={13} />
                    <span>Método de Entrega</span>
                  </label>
                  <select
                    value={formMetodo}
                    onChange={(e) => setFormMetodo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                  >
                    <option value="Transferencia BCP">Transferencia BCP</option>
                    <option value="Transferencia BBVA">Transferencia BBVA</option>
                    <option value="Yape">Yape</option>
                    <option value="Plin">Plin</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              {/* Número de Operación */}
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 uppercase">
                  N° de Operación / Referencia (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. OP-182937 o código de Yape"
                  value={formOperacion}
                  onChange={(e) => setFormOperacion(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Motivo */}
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 uppercase">
                  Motivo / Razón del Adelanto
                </label>
                <input
                  type="text"
                  placeholder="Ej. Incidente familiar, adelanto fin de semana, etc."
                  value={formMotivo}
                  onChange={(e) => setFormMotivo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Observaciones */}
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 uppercase">
                  Observaciones adicionales
                </label>
                <textarea
                  rows={2}
                  placeholder="Anotaciones internas..."
                  value={formObservaciones}
                  onChange={(e) => setFormObservaciones(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 resize-none"
                />
              </div>

              {/* Footer Botones */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer transition-all disabled:opacity-50"
                >
                  {guardando ? <RotateCw className="animate-spin" size={15} /> : <Check size={15} />}
                  <span>Guardar Adelanto</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
