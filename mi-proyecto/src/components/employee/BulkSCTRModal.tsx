import React, { useState, useMemo, useEffect } from "react";
import { Employee } from "./Employee";
import {
  ShieldCheck,
  Calendar,
  Search,
  CheckSquare,
  Square,
  AlertCircle,
  Clock,
  Loader2,
  X,
  Users,
  CheckCircle2,
  ArrowRight,
  Filter
} from "lucide-react";
import { actualizarSctrMasivo } from "../../services/employeeService";

interface BulkSCTRModalProps {
  isOpen: boolean;
  onClose: () => void;
  empleadosFiltrados: Employee[];
  onSuccess: (updatedIds: number[], newVencimiento: string) => void;
}

export const BulkSCTRModal: React.FC<BulkSCTRModalProps> = ({
  isOpen,
  onClose,
  empleadosFiltrados,
  onSuccess,
}) => {
  if (!isOpen) return null;

  // 1. Fechas por defecto:
  // Inicio: Hoy en formato YYYY-MM-DD
  // Fin: 1 mes después menos 1 día (o 1 mes exacto)
  const hoyStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  }, []);

  const defaultFinStr = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(d.getDate() - 1); // e.g. Del 07/10 al 06/11
    return d.toISOString().split("T")[0];
  }, []);

  const [fechaInicio, setFechaInicio] = useState(hoyStr);
  const [fechaFin, setFechaFin] = useState(defaultFinStr);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Inicializar seleccionados con todos los filtrados al abrir
  useEffect(() => {
    if (empleadosFiltrados && empleadosFiltrados.length > 0) {
      setSelectedIds(empleadosFiltrados.map((e) => e.id));
    } else {
      setSelectedIds([]);
    }
  }, [empleadosFiltrados, isOpen]);

  // Manejar cambio de fecha inicio -> sugerir fecha fin calculando 1 mes - 1 día
  const handleFechaInicioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFechaInicio(val);
    if (val) {
      const parts = val.split("-").map(Number);
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        d.setMonth(d.getMonth() + 1);
        d.setDate(d.getDate() - 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        setFechaFin(`${yyyy}-${mm}-${dd}`);
      }
    }
  };

  // Botón rápido: +1 Mes
  const aplicarUnMes = () => {
    if (!fechaInicio) return;
    const parts = fechaInicio.split("-").map(Number);
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      d.setMonth(d.getMonth() + 1);
      d.setDate(d.getDate() - 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      setFechaFin(`${yyyy}-${mm}-${dd}`);
    }
  };

  // Botón rápido: Fin de Mes
  const aplicarFinDeMes = () => {
    if (!fechaInicio) return;
    const parts = fechaInicio.split("-").map(Number);
    if (parts.length === 3) {
      // Último día del mes de la fechaInicio
      const d = new Date(parts[0], parts[1], 0);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      setFechaFin(`${yyyy}-${mm}-${dd}`);
    }
  };

  // Filtrar lista interna del modal por texto (búsqueda rápida)
  const listaModalFiltrada = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return empleadosFiltrados;
    return empleadosFiltrados.filter((emp) => {
      const nom = `${emp.nombres || ""} ${emp.primerApellido || ""} ${emp.segundoApellido || ""}`.toLowerCase();
      const dni = (emp.dni || "").toLowerCase();
      const rol = (emp.rolNombre || "").toLowerCase();
      const sub = (emp.subcontrata_codigo || emp.subcontrataCodigo || "").toLowerCase();
      return nom.includes(q) || dni.includes(q) || rol.includes(q) || sub.includes(q);
    });
  }, [empleadosFiltrados, searchTerm]);

  // Alternar selección individual
  const toggleSelectId = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Seleccionar o desmarcar todos los visibles en el modal
  const allModalSelected = listaModalFiltrada.length > 0 && listaModalFiltrada.every((e) => selectedIds.includes(e.id));
  const toggleSelectAll = () => {
    if (allModalSelected) {
      const idsVisibles = new Set(listaModalFiltrada.map((e) => e.id));
      setSelectedIds((prev) => prev.filter((id) => !idsVisibles.has(id)));
    } else {
      const idsToAdd = listaModalFiltrada.map((e) => e.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
    }
  };

  // Helper para badge de estado previo
  const getBadgePrevio = (venc?: string) => {
    if (!venc) {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-semibold border border-slate-200">
          Sin registro
        </span>
      );
    }
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const parts = venc.split("-").map(Number);
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      d.setHours(0, 0, 0, 0);
      const diff = Math.round((d.getTime() - hoy.getTime()) / (1000 * 3600 * 24));
      if (diff < 0) {
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-bold border border-rose-200">
            Venció ({venc})
          </span>
        );
      } else if (diff <= 7) {
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold border border-amber-300">
            Vence {diff}d ({venc})
          </span>
        );
      } else {
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
            Vigente ({venc})
          </span>
        );
      }
    }
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
        {venc}
      </span>
    );
  };

  const handleGuardar = async () => {
    if (selectedIds.length === 0) {
      alert("⚠️ Por favor selecciona al menos un empleado para actualizar.");
      return;
    }
    if (!fechaFin) {
      alert("⚠️ Por favor ingresa la fecha de vencimiento del SCTR.");
      return;
    }

    try {
      setGuardando(true);
      const res = await actualizarSctrMasivo(selectedIds, fechaFin);
      alert(`✅ ¡SCTR actualizado con éxito!\n\nSe renovó la vigencia hasta el ${fechaFin} para ${selectedIds.length} empleado(s).`);
      onSuccess(selectedIds, fechaFin);
      onClose();
    } catch (err: any) {
      alert(`❌ Error al actualizar SCTR: ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabecera */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
              <ShieldCheck size={22} className="text-emerald-300" />
            </div>
            <div>
              <h3 className="font-black text-base tracking-tight flex items-center gap-2">
                Actualización Masiva de SCTR
              </h3>
              <p className="text-xs text-indigo-100 font-medium">
                Renueva la póliza de SCTR para el personal actualmente filtrado
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 bg-slate-50/40">
          {/* 1. SECCIÓN DE RANGO DE FECHAS */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={14} className="text-indigo-600" />
                1. Periodo de Vigencia del SCTR
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={aplicarUnMes}
                  className="text-[11px] font-bold px-2 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer"
                  title="Calcula automáticamente 1 mes de vigencia"
                >
                  +1 Mes Estándar
                </button>
                <button
                  type="button"
                  onClick={aplicarFinDeMes}
                  className="text-[11px] font-bold px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  title="Ajusta hasta el último día del mes"
                >
                  Fin de Mes
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Fecha de Inicio / Emisión
                </label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={handleFechaInicioChange}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-300 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center justify-between">
                  <span>Fecha de Vencimiento / Fin</span>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                    Fecha a Registrar
                  </span>
                </label>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="w-full p-2 bg-emerald-50/50 border border-emerald-300 rounded-xl text-xs font-mono font-black text-emerald-900 focus:bg-white focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 2. SECCIÓN DE PERSONAL FILTRADO */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Users size={14} className="text-indigo-600" />
                  2. Personal a Actualizar ({selectedIds.length} de {empleadosFiltrados.length})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  {allModalSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                  <span>{allModalSelected ? "Desmarcar Todos" : "Seleccionar Todos"}</span>
                </button>
              </div>
            </div>

            {/* Buscador interno */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar por nombre, DNI, rol o cuadrilla en la lista..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-300 focus:outline-none font-medium"
              />
            </div>

            {/* Lista scrolleable de empleados */}
            <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 bg-slate-50/30">
              {listaModalFiltrada.length > 0 ? (
                listaModalFiltrada.map((emp) => {
                  const isChecked = selectedIds.includes(emp.id);
                  return (
                    <div
                      key={emp.id}
                      onClick={() => toggleSelectId(emp.id)}
                      className={`p-2.5 sm:px-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isChecked ? "bg-indigo-50/40 hover:bg-indigo-50/70" : "hover:bg-slate-100/60"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Manejado por el onClick del div
                          className="w-4 h-4 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {emp.nombres} {emp.primerApellido} {emp.segundoApellido}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                              {emp.dni}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {emp.rolNombre && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-50 text-sky-700 font-bold border border-sky-200">
                                {emp.rolNombre}
                              </span>
                            )}
                            {(emp.subcontrata_codigo || emp.subcontrataCodigo) && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-bold border border-purple-200">
                                {emp.subcontrata_codigo || emp.subcontrataCodigo}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Estado actual del SCTR */}
                      <div className="shrink-0 text-right">
                        <span className="text-[9px] text-slate-400 block font-medium">Actual:</span>
                        {getBadgePrevio(emp.sctrVencimiento)}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-slate-400 font-medium">
                  No se encontraron empleados coincidentes en la lista filtrada.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer / Botones */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-800">{selectedIds.length}</span> seleccionados de{" "}
            <span className="font-bold text-slate-800">{empleadosFiltrados.length}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={guardando}
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={guardando || selectedIds.length === 0}
              onClick={handleGuardar}
              className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 active:scale-98"
            >
              {guardando ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Actualizando SCTR...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={15} />
                  <span>Guardar SCTR ({selectedIds.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
