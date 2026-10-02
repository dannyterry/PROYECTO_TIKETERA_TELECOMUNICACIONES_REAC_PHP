import React, { useState } from "react";
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  Package, 
  Layers, 
  Clock, 
  User, 
  AlertCircle,
  RefreshCw,
  ArrowDownLeft,
  Truck
} from "lucide-react";
import { API_URL } from "../../../config/api";

interface IncomingTransfersModalProps {
  isOpen: boolean;
  onClose: () => void;
  transferencias: any[];
  idTrabajadorDestino: number;
  onActualizado: () => void;
}

export const IncomingTransfersModal: React.FC<IncomingTransfersModalProps> = ({
  isOpen,
  onClose,
  transferencias,
  idTrabajadorDestino,
  onActualizado,
}) => {
  const [procesandoId, setProcesandoId] = useState<number | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState<Record<number, string>>({});
  const [mostrarInputRechazo, setMostrarInputRechazo] = useState<Record<number, boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const responderTransferencia = async (idTransferencia: number, accion: "ACEPTAR" | "RECHAZAR") => {
    setProcesandoId(idTransferencia);
    setErrorMsg(null);

    try {
      const res = await fetch(`${API_URL}/api/inventario/transferencias/${idTransferencia}/responder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_trabajador_destino: idTrabajadorDestino,
          accion,
          motivo_rechazo: motivoRechazo[idTransferencia] || "",
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setErrorMsg(data.message || "Error al responder la transferencia");
        setProcesandoId(null);
        return;
      }

      alert(accion === "ACEPTAR" 
        ? "✅ ¡Transferencia aceptada con éxito! El stock y las series ya están disponibles en tu camioneta." 
        : "Transferencia rechazada.");

      try {
        const bc = new BroadcastChannel("stock_transfers_sync");
        bc.postMessage({ type: "TRANSFER_UPDATED", timestamp: Date.now() });
        bc.close();
      } catch {}

      onActualizado();
      if (transferencias.length <= 1) {
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Error de conexión al responder la transferencia.");
    } finally {
      setProcesandoId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
              <ArrowDownLeft size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black leading-tight">
                Transferencias Pendientes de Aceptar
              </h2>
              <p className="text-[11px] text-emerald-100 font-medium">
                {transferencias.length} solicitud(es) entrante(s) de tus compañeros
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mensaje de error si ocurre */}
        {errorMsg && (
          <div className="mx-4 mt-3 bg-rose-50 border border-rose-300 p-3 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Lista de transferencias pendientes */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {transferencias.length === 0 ? (
            <div className="py-8 text-center text-slate-400 space-y-2">
              <CheckCircle2 size={36} className="mx-auto text-emerald-400" />
              <p className="font-bold">No tienes transferencias pendientes por aceptar.</p>
            </div>
          ) : (
            transferencias.map((trf) => {
              const detalles = trf.detalles || [];
              const materiales = detalles.filter((d: any) => Number(d.es_serie) === 0);
              const series = detalles.filter((d: any) => Number(d.es_serie) === 1);
              const isProcessing = procesandoId === trf.id_transferencia;
              const isRechazando = mostrarInputRechazo[trf.id_transferencia];

              return (
                <div
                  key={trf.id_transferencia}
                  className="bg-white rounded-2xl border-2 border-emerald-200 shadow-sm overflow-hidden divide-y divide-slate-100"
                >
                  {/* Info del Emisor */}
                  <div className="bg-emerald-50/60 p-3.5 flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
                          {trf.codigo_transferencia}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                          <Clock size={11} />
                          Hace {trf.minutos_transcurridos || 0} min
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-slate-900 pt-1 flex items-center gap-1.5">
                        <User size={13} className="text-emerald-700" />
                        De: {trf.nombre_origen}
                      </h4>
                      <p className="text-[10.5px] text-slate-600 font-medium">
                        DNI: {trf.dni_origen} • Cuadrilla: {trf.cuadrilla_origen || "Sin cuadrilla"}
                      </p>
                    </div>

                    <span className="text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                      🟡 Pendiente
                    </span>
                  </div>

                  {/* Motivo */}
                  {trf.motivo_transferencia && (
                    <div className="p-3 bg-slate-50/50">
                      <span className="text-[10px] font-black text-slate-500 uppercase">Motivo:</span>
                      <p className="text-slate-800 font-medium text-[11px] italic">
                        "{trf.motivo_transferencia}"
                      </p>
                    </div>
                  )}

                  {/* Items detallados */}
                  <div className="p-3.5 space-y-3">
                    {/* Materiales */}
                    {materiales.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10.5px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                          <Layers size={13} className="text-indigo-600" />
                          Materiales ({materiales.length}):
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {materiales.map((m: any, mIdx: number) => (
                            <div key={mIdx} className="bg-slate-50 border border-slate-200 p-2 rounded-xl flex items-center justify-between">
                              <span className="font-bold text-[10px] text-slate-700 truncate pr-1" title={m.nombre_producto}>
                                {m.nombre_producto}
                              </span>
                              <span className="font-mono font-black text-xs text-indigo-900 shrink-0">
                                +{m.cantidad} {m.unidad_medida || "und"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Equipos Serializados */}
                    {series.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10.5px] font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1">
                          <Package size={13} className="text-emerald-600" />
                          Equipos con Serie ({series.length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {series.map((s: any, sIdx: number) => (
                            <div
                              key={sIdx}
                              className="px-2.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-950 font-mono text-[10.5px] font-bold rounded-lg shadow-2xs"
                            >
                              {s.numero_serie}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Formulario de Rechazo Opcional */}
                  {isRechazando && (
                    <div className="p-3 bg-rose-50/70 border-t border-rose-200 space-y-2">
                      <label className="font-bold text-rose-900 text-[11px]">
                        Indica el motivo del rechazo:
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: No reconozco las series / Ya no requiero el material..."
                        value={motivoRechazo[trf.id_transferencia] || ""}
                        onChange={(e) =>
                          setMotivoRechazo((prev) => ({
                            ...prev,
                            [trf.id_transferencia]: e.target.value,
                          }))
                        }
                        className="w-full p-2 bg-white border border-rose-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setMostrarInputRechazo((prev) => ({
                              ...prev,
                              [trf.id_transferencia]: false,
                            }))
                          }
                          className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-lg text-[10.5px] font-bold"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => responderTransferencia(trf.id_transferencia, "RECHAZAR")}
                          disabled={isProcessing}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10.5px] font-bold"
                        >
                          {isProcessing ? "Rechazando..." : "Confirmar Rechazo"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Botones de Acción */}
                  {!isRechazando && (
                    <div className="p-3 bg-slate-50 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setMostrarInputRechazo((prev) => ({
                            ...prev,
                            [trf.id_transferencia]: true,
                          }))
                        }
                        disabled={isProcessing}
                        className="px-3 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <XCircle size={14} />
                        <span>Rechazar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => responderTransferencia(trf.id_transferencia, "ACEPTAR")}
                        disabled={isProcessing}
                        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/25 cursor-pointer transition-all active:scale-95"
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Procesando...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={14} />
                            <span>Aceptar y Recibir Stock</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-3.5 border-t border-slate-200 shrink-0 text-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
          >
            Cerrar Ventana
          </button>
        </div>

      </div>
    </div>
  );
};
export default IncomingTransfersModal;
