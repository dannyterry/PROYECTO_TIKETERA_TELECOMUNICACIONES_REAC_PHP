import React, { useState, useEffect } from "react";
import { Employee } from "./Employee";
import { API_URL } from "../../config/api";
import { Input } from "../ui/input";
import { 
  AlertTriangle, 
  X, 
  Loader2, 
  History, 
  CheckCircle2, 
  Info
} from "lucide-react";

interface QuickStatusModalProps {
  isOpen: boolean;
  empleado: Employee | null;
  onClose: () => void;
  onStatusUpdated: (updated: { id: number; estado: string; estadoFechaInicio?: string; estadoFechaFin?: string; estadoObservacion?: string }) => void;
}

export const QuickStatusModal: React.FC<QuickStatusModalProps> = ({
  isOpen,
  empleado,
  onClose,
  onStatusUpdated
}) => {
  const [nuevoEstado, setNuevoEstado] = useState<string>("Activo");
  const [fechaInicio, setFechaInicio] = useState<string>("");
  const [fechaFin, setFechaFin] = useState<string>("");
  const [observacion, setObservacion] = useState<string>("");
  const [guardando, setGuardando] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Historial
  const [historial, setHistorial] = useState<any[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState<boolean>(false);
  const [mostrarHistorial, setMostrarHistorial] = useState<boolean>(false);

  useEffect(() => {
    if (empleado && isOpen) {
      const estadoActual = empleado.estado || "Activo";
      setNuevoEstado(estadoActual);
      
      const hoy = new Date().toISOString().split("T")[0];
      setFechaInicio(empleado.estadoFechaInicio || hoy);
      setFechaFin(empleado.estadoFechaFin || "");
      setObservacion(empleado.estadoObservacion || "");
      setErrorMsg(null);
      setSuccessMsg(null);
      setMostrarHistorial(false);

      // Cargar historial
      cargarHistorial(empleado.id);
    }
  }, [empleado, isOpen]);

  const cargarHistorial = async (idUsuario: number) => {
    try {
      setCargandoHistorial(true);
      const res = await fetch(`${API_URL}/empleados/${idUsuario}/historial`);
      if (res.ok) {
        const data = await res.json();
        setHistorial(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Error al cargar historial:", e);
    } finally {
      setCargandoHistorial(false);
    }
  };

  if (!isOpen || !empleado) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        estado: nuevoEstado,
        estadoFechaInicio: fechaInicio || null,
        estadoFechaFin: fechaFin || null,
        estadoObservacion: observacion.trim() || null
      };

      const res = await fetch(`${API_URL}/empleados/${empleado.id}/estado`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Error al actualizar estado");
      }

      setSuccessMsg(`¡Estado actualizado exitosamente a "${nuevoEstado}"!`);
      
      // Notificar al componente padre
      onStatusUpdated({
        id: empleado.id,
        estado: nuevoEstado,
        estadoFechaInicio: fechaInicio,
        estadoFechaFin: fechaFin,
        estadoObservacion: observacion
      });

      setTimeout(() => {
        onClose();
      }, 700);

    } catch (err: any) {
      setErrorMsg(err.message || "Ocurrió un error al guardar los cambios.");
    } finally {
      setGuardando(false);
    }
  };

  const nombreCompleto = `${empleado.nombres || ""} ${empleado.primerApellido || ""} ${empleado.segundoApellido || ""}`.trim();

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER MODAL */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300 font-bold text-lg shadow-inner">
              ⚡
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Cambio Rápido de Estado
              </h3>
              <p className="text-xs text-slate-300">
                Directorio de Personal &bull; Sincronización Automática
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X size={18} />
          </button>
        </div>

        {/* INFO DEL EMPLEADO */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-col">
            <span className="font-bold text-gray-900 text-sm">{nombreCompleto}</span>
            <div className="flex items-center gap-2 text-gray-500 mt-0.5">
              <span className="font-mono font-medium">DNI: {empleado.dni || "N/A"}</span>
              <span>&bull;</span>
              <span className="text-sky-700 font-semibold">{empleado.rolNombre || "Sin rol"}</span>
              {empleado.area && (
                <>
                  <span>&bull;</span>
                  <span className="text-slate-600">{empleado.area}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-[11px] font-medium">Estado actual:</span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
              empleado.estado === "Activo" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
              empleado.estado === "Inactivo" ? "bg-red-50 text-red-700 border-red-200" :
              empleado.estado === "Vacaciones" ? "bg-blue-50 text-blue-700 border-blue-200" :
              empleado.estado === "Descanso Médico" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
              empleado.estado === "Cesado" ? "bg-gray-100 text-gray-700 border-gray-300" :
              "bg-gray-50 text-gray-700 border-gray-200"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                empleado.estado === "Activo" ? "bg-emerald-500" :
                empleado.estado === "Inactivo" ? "bg-red-500" :
                empleado.estado === "Vacaciones" ? "bg-blue-500" :
                empleado.estado === "Descanso Médico" ? "bg-yellow-500" : "bg-gray-500"
              }`} />
              {empleado.estado || "Activo"}
            </span>
          </div>
        </div>

        {/* FORMULARIO */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* MENSAJES DE ESTADO */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2 font-medium animate-in fade-in">
              <AlertTriangle size={16} className="shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2 font-medium animate-in fade-in">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. SELECCIÓN DE NUEVO ESTADO (DESPLEGABLE COMPACTO) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center justify-between">
              <span>Estado *</span>
              <span className="text-[10px] text-gray-400 font-normal normal-case">
                Seleccione el nuevo estado laboral
              </span>
            </label>
            <div className="relative">
              <select
                value={nuevoEstado}
                onChange={(e) => setNuevoEstado(e.target.value)}
                className={`w-full h-11 rounded-xl px-3.5 pr-10 text-sm font-bold border transition-all cursor-pointer appearance-none bg-white shadow-2xs focus:outline-none focus:ring-2 ${
                  nuevoEstado === "Activo" ? "border-emerald-300 text-emerald-900 focus:ring-emerald-500 bg-emerald-50/30" :
                  nuevoEstado === "Inactivo" ? "border-red-300 text-red-900 focus:ring-red-500 bg-red-50/30" :
                  nuevoEstado === "Vacaciones" ? "border-blue-300 text-blue-900 focus:ring-blue-500 bg-blue-50/30" :
                  nuevoEstado === "Descanso Médico" ? "border-amber-300 text-amber-900 focus:ring-amber-500 bg-amber-50/30" :
                  "border-gray-300 text-gray-900 focus:ring-gray-500 bg-gray-50/30"
                }`}
              >
                <option value="Activo">🟢 Activo (Operativo y disponible)</option>
                <option value="Inactivo">🔴 Inactivo (Suspensión o inactividad)</option>
                <option value="Vacaciones">🔵 Vacaciones (Periodo vacacional)</option>
                <option value="Descanso Médico">🟡 Descanso Médico (ESSALUD / Médico)</option>
                <option value="Cesado">⚫ Cesado (Desvinculación definitiva)</option>
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* 2. CAJA DINÁMICA DE DETALLES DEL ESTADO */}
          {nuevoEstado === "Activo" && (empleado.estado === "Activo" || !empleado.estado) ? (
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold">El empleado ya se encuentra Activo y operativo.</p>
                <p className="text-[11px] text-emerald-700/90 mt-0.5">No se requiere ingresar fechas ni comentarios adicionales.</p>
              </div>
            </div>
          ) : (
            <div className={`p-4 rounded-xl border transition-all duration-300 space-y-3.5 animate-in fade-in ${
              nuevoEstado === "Activo" ? "bg-emerald-50/70 border-emerald-200" :
              nuevoEstado === "Inactivo" ? "bg-red-50/70 border-red-200" :
              nuevoEstado === "Vacaciones" ? "bg-blue-50/70 border-blue-200" :
              nuevoEstado === "Descanso Médico" ? "bg-amber-50/70 border-amber-200" :
              "bg-slate-100/70 border-slate-300"
            }`}>
              
              {/* Header del bloque de detalle */}
              <div className="flex items-center justify-between border-b pb-2 border-gray-200/60">
                <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  nuevoEstado === "Activo" ? "text-emerald-900" :
                  nuevoEstado === "Inactivo" ? "text-red-900" :
                  nuevoEstado === "Vacaciones" ? "text-blue-900" :
                  nuevoEstado === "Descanso Médico" ? "text-amber-900" : "text-slate-900"
                }`}>
                  {nuevoEstado === "Activo" && "✅ DETALLES DE REINGRESO / RETORNO"}
                  {nuevoEstado === "Inactivo" && "⚠️ DETALLES DE INACTIVO"}
                  {nuevoEstado === "Vacaciones" && "🏖️ DETALLES DE VACACIONES"}
                  {nuevoEstado === "Descanso Médico" && "🩺 DETALLES DE DESCANSO MÉDICO"}
                  {nuevoEstado === "Cesado" && "⛔ DETALLES DE CESE LABORAL"}
                </h4>
                <span className="text-[10px] font-semibold text-gray-500">
                  Se guardará en historial
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Fecha Inicio / Retorno / Desde */}
                {["Activo", "Inactivo", "Vacaciones", "Descanso Médico"].includes(nuevoEstado) && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-700">
                      {nuevoEstado === "Activo" ? "Fecha de Retorno / Reingreso" : "Fecha Inicio / Desde"}
                    </label>
                    <Input 
                      type="date" 
                      value={fechaInicio} 
                      onChange={(e) => setFechaInicio(e.target.value)} 
                      className="bg-white border-gray-300 text-xs focus:ring-sky-500 h-9" 
                    />
                  </div>
                )}

                {/* Fecha Fin / Cese */}
                {["Vacaciones", "Descanso Médico", "Cesado"].includes(nuevoEstado) && (
                  <div className={`flex flex-col gap-1 ${nuevoEstado === "Cesado" ? "sm:col-span-2" : ""}`}>
                    <label className="text-xs font-bold text-gray-700">
                      {nuevoEstado === "Cesado" ? "Fecha de Cese Laboral *" : "Fecha Fin / Hasta"}
                    </label>
                    <Input 
                      type="date" 
                      value={fechaFin} 
                      onChange={(e) => setFechaFin(e.target.value)} 
                      required={nuevoEstado === "Cesado"}
                      className="bg-white border-gray-300 text-xs focus:ring-sky-500 h-9" 
                    />
                  </div>
                )}

                {/* Observación / Motivo */}
                <div className={`flex flex-col gap-1 ${["Vacaciones", "Descanso Médico"].includes(nuevoEstado) ? "sm:col-span-2" : (nuevoEstado === "Cesado" || nuevoEstado === "Inactivo" || nuevoEstado === "Activo") ? "sm:col-span-2" : ""}`}>
                  <label className="text-xs font-bold text-gray-700">
                    Observación / Motivo
                  </label>
                  <Input 
                    type="text"
                    value={observacion} 
                    onChange={(e) => setObservacion(e.target.value)} 
                    placeholder={
                      nuevoEstado === "Activo" ? "Ej. Reingreso por nueva campaña, Retorno de vacaciones..." :
                      nuevoEstado === "Vacaciones" ? "Ej. Vacaciones anuales correspondientes al periodo 2026..." :
                      nuevoEstado === "Descanso Médico" ? "Ej. Descanso ESSALUD por 7 días..." :
                      nuevoEstado === "Cesado" ? "Ej. Renuncia voluntaria / Fin de contrato..." :
                      "Escriba un comentario o motivo..."
                    }
                    className="bg-white border-gray-300 text-xs focus:ring-sky-500 h-9" 
                  />
                </div>
              </div>

              {/* Aviso informativo de sincronización */}
              <div className="pt-1 flex items-start gap-1.5 text-[11px] text-gray-500">
                <Info size={13} className="shrink-0 text-sky-600 mt-0.5" />
                <span>
                  {nuevoEstado === "Activo" 
                    ? "Al marcar como Activo, el empleado quedará disponible automáticamente en Despachos, Rutas y Asignaciones."
                    : "Al cambiar a este estado, se sincronizará automáticamente como Inactivo en la tabla de Trabajadores para evitar despachos indebidos."}
                </span>
              </div>

            </div>
          )}

          {/* HISTORIAL RÁPIDO COLAPSABLE */}
          <div className="pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setMostrarHistorial(!mostrarHistorial)}
              className="w-full flex items-center justify-between text-xs font-bold text-gray-600 hover:text-sky-700 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <History size={14} className="text-sky-600" />
                <span>Ver historial de cambios anteriores ({historial.length})</span>
              </div>
              <span className="text-[10px] text-gray-400">
                {mostrarHistorial ? "▲ Ocultar" : "▼ Ver detalles"}
              </span>
            </button>

            {mostrarHistorial && (
              <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-gray-200 max-h-40 overflow-y-auto space-y-2">
                {cargandoHistorial ? (
                  <div className="text-center py-2 text-xs text-gray-400 flex items-center justify-center gap-1.5">
                    <Loader2 size={13} className="animate-spin" /> Cargando historial...
                  </div>
                ) : historial.length > 0 ? (
                  historial.map((item, idx) => (
                    <div key={item.id_historial || idx} className="p-2 bg-white rounded-lg border border-gray-100 shadow-2xs text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-800">
                          {item.estado_cambiado}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {item.fecha_registro ? item.fecha_registro.substring(0, 10) : ""}
                        </span>
                      </div>
                      {(item.fecha_inicio || item.fecha_fin) && (
                        <div className="text-[10px] text-gray-500 font-mono">
                          Periodo: {item.fecha_inicio || "-"} al {item.fecha_fin || "-"}
                        </div>
                      )}
                      {item.observacion && (
                        <div className="text-[11px] text-gray-600 italic">
                          "{item.observacion}"
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-2 text-xs text-gray-400">
                    No hay cambios de estado registrados anteriormente.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {guardando ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Guardar Estado</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
