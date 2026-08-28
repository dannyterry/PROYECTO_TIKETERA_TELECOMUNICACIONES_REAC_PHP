import React, { useState } from "react";
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Car,
  User,
  Gauge,
  Droplet,
  Waves,
  Eye,
  MessageSquare,
  Calendar,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import { Inspeccion, Vehiculo, Tecnico } from "../types/mobilityTypes";
import { auditarInspeccion, getImageUrl } from "../services/mobilityService";
import { PhotoViewerModal, PhotoItem } from "./PhotoViewerModal";

interface Props {
  inspecciones: Inspeccion[];
  vehiculos: Vehiculo[];
  tecnicos: Tecnico[];
  loading: boolean;
  onRefresh: () => void;
}

export const InspectionAuditTab: React.FC<Props> = ({
  inspecciones,
  vehiculos,
  tecnicos,
  loading,
  onRefresh,
}) => {
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("Todos");
  const [filtroVehiculo, setFiltroVehiculo] = useState<string>("");
  const [filtroFecha, setFiltroFecha] = useState<string>("");

  // Estado para visor de fotos modal
  const [viewerPhotos, setViewerPhotos] = useState<PhotoItem[] | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Estado para modal de observación
  const [observandoId, setObservandoId] = useState<number | null>(null);
  const [textoObservacion, setTextoObservacion] = useState("");
  const [auditandoLoading, setAuditandoLoading] = useState(false);

  // Filtrado de inspecciones
  const inspeccionesFiltradas = inspecciones.filter((insp) => {
    const txt = filtroTexto.toLowerCase();
    const coincideTexto =
      !txt ||
      (insp.placa && insp.placa.toLowerCase().includes(txt)) ||
      (insp.nombre_tecnico && insp.nombre_tecnico.toLowerCase().includes(txt)) ||
      (insp.cuadrilla && insp.cuadrilla.toLowerCase().includes(txt));

    const coincideEstado =
      filtroEstado === "Todos" || insp.estado_auditoria === filtroEstado;

    const coincideVehiculo =
      !filtroVehiculo || String(insp.id_vehiculo) === filtroVehiculo;

    const coincideFecha =
      !filtroFecha || (insp.fecha && insp.fecha.startsWith(filtroFecha));

    return coincideTexto && coincideEstado && coincideVehiculo && coincideFecha;
  });

  const handleOpenPhotos = (insp: Inspeccion, startIndex = 0) => {
    const list: PhotoItem[] = [];
    if (insp.foto_tablero_inicio) {
      list.push({
        url: insp.foto_tablero_inicio,
        title: "Tablero Inicio de Jornada",
        subtitle: `Placa: ${insp.placa || "S/P"} | KM Inicial: ${insp.km_inicio || "0"} | Hora: ${insp.hora_inicio || "--"}`,
      });
    }
    if (insp.foto_aceite) {
      list.push({
        url: insp.foto_aceite,
        title: "Nivel de Aceite de Motor",
        subtitle: `Técnico: ${insp.nombre_tecnico || "Técnico"} | Placa: ${insp.placa || ""}`,
      });
    }
    if (insp.foto_agua) {
      list.push({
        url: insp.foto_agua,
        title: "Nivel de Agua / Refrigerante",
        subtitle: `Depósito del Radiador | Placa: ${insp.placa || ""}`,
      });
    }
    if (insp.foto_estado_general) {
      list.push({
        url: insp.foto_estado_general,
        title: "Estado General del Vehículo",
        subtitle: `Carrocería / Llantas | Placa: ${insp.placa || ""}`,
      });
    }
    if (insp.foto_tablero_fin) {
      list.push({
        url: insp.foto_tablero_fin,
        title: "Tablero Cierre de Jornada",
        subtitle: `Placa: ${insp.placa || "S/P"} | KM Final: ${insp.km_fin || "0"} | Hora: ${insp.hora_fin || "--"}`,
      });
    }

    if (list.length > 0) {
      setViewerPhotos(list);
      setViewerIndex(Math.min(startIndex, list.length - 1));
    }
  };

  const handleAprobarRapido = async (id_inspeccion: number) => {
    try {
      setAuditandoLoading(true);
      await auditarInspeccion(id_inspeccion, { estado_auditoria: "Aprobado" });
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setAuditandoLoading(false);
    }
  };

  const handleGuardarObservacion = async () => {
    if (!observandoId) return;
    try {
      setAuditandoLoading(true);
      await auditarInspeccion(observandoId, {
        estado_auditoria: "Observado",
        observaciones_admin: textoObservacion,
      });
      setObservandoId(null);
      setTextoObservacion("");
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setAuditandoLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          1. BARRA DE CONTROL Y FILTROS
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="Buscar por placa, técnico o cuadrilla..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-sm font-medium text-slate-800 placeholder-slate-400 rounded-2xl border border-slate-200/80 focus:border-cyan-500 focus:outline-none transition-all"
          />
        </div>

        {/* Filtros Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Filtro Fecha */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-2xl px-3 py-1.5">
            <Calendar size={15} className="text-slate-500" />
            <input
              type="date"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            />
            {filtroFecha && (
              <button
                onClick={() => setFiltroFecha("")}
                className="text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filtro Vehículo */}
          <select
            value={filtroVehiculo}
            onChange={(e) => setFiltroVehiculo(e.target.value)}
            className="bg-slate-50 border border-slate-200/80 rounded-2xl px-3.5 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="">🚗 Todos los Vehículos</option>
            {vehiculos.map((v) => (
              <option key={v.id_vehiculo} value={v.id_vehiculo}>
                {v.placa} ({v.modelo || "S/M"})
              </option>
            ))}
          </select>

          {/* Filtro Estado */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
            {["Todos", "Pendiente", "Aprobado", "Observado"].map((est) => (
              <button
                key={est}
                onClick={() => setFiltroEstado(est)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filtroEstado === est
                    ? est === "Aprobado"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : est === "Observado"
                      ? "bg-amber-500 text-white shadow-xs"
                      : est === "Pendiente"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-800 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {est}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. LISTA DE INSPECCIONES EN TARJETAS INTERACTIVAS
      ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
          <p className="text-sm font-semibold">Cargando inspecciones diarias...</p>
        </div>
      ) : inspeccionesFiltradas.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300">
          <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400 mb-3">
            <Car size={32} />
          </div>
          <h3 className="text-base font-bold text-slate-700">No se encontraron inspecciones</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            No hay registros de checklists que coincidan con los filtros seleccionados.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {inspeccionesFiltradas.map((insp) => {
            const fotosDisponibles = [
              insp.foto_tablero_inicio,
              insp.foto_aceite,
              insp.foto_agua,
              insp.foto_estado_general,
              insp.foto_tablero_fin,
            ].filter(Boolean);

            const kmInicio = Number(insp.km_inicio) || 0;
            const kmFin = Number(insp.km_fin) || 0;
            const kmRecorridos = Number(insp.km_recorridos) || (kmFin > kmInicio ? kmFin - kmInicio : 0);

            return (
              <div
                key={insp.id_inspeccion}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col overflow-hidden group"
              >
                {/* HEADER DE TARJETA */}
                <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-cyan-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                      {insp.placa?.slice(0, 3) || "VEH"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 tracking-wider text-sm font-mono">
                          {insp.placa || "SIN PLACA"}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          {insp.modelo || insp.marca || "Vehículo"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                        <Calendar size={12} className="text-slate-400" />
                        {insp.fecha}
                      </p>
                    </div>
                  </div>

                  {/* BADGE DE ESTADO */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${
                      insp.estado_auditoria === "Aprobado"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : insp.estado_auditoria === "Observado"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    {insp.estado_auditoria === "Aprobado" ? (
                      <CheckCircle2 size={13} />
                    ) : insp.estado_auditoria === "Observado" ? (
                      <AlertTriangle size={13} />
                    ) : (
                      <Clock size={13} />
                    )}
                    {insp.estado_auditoria}
                  </span>
                </div>

                {/* CUERPO DE TARJETA: TÉCNICO Y KILOMETRAJE */}
                <div className="p-4 space-y-3.5 flex-1">
                  
                  {/* Técnico y Cuadrilla */}
                  <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2 truncate">
                      <User size={15} className="text-cyan-600 shrink-0" />
                      <span className="font-bold text-slate-800 truncate" title={insp.nombre_tecnico}>
                        {insp.nombre_tecnico || "Técnico No Asignado"}
                      </span>
                    </div>
                    {insp.cuadrilla && (
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg bg-teal-100 text-teal-800 shrink-0">
                        {insp.cuadrilla}
                      </span>
                    )}
                  </div>

                  {/* Lecturas de Kilometraje: Inicio / Fin / Recorrido */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">KM Inicio (7am)</span>
                      <span className="text-xs font-extrabold text-slate-800 font-mono">
                        {kmInicio > 0 ? `${kmInicio.toLocaleString()} km` : "--"}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">KM Fin (7pm)</span>
                      <span className="text-xs font-extrabold text-slate-800 font-mono">
                        {kmFin > 0 ? `${kmFin.toLocaleString()} km` : "Pendiente"}
                      </span>
                    </div>
                    <div className="bg-cyan-50/70 p-2 rounded-2xl border border-cyan-100">
                      <span className="text-[10px] font-bold text-cyan-700 uppercase block">Recorrido</span>
                      <span className="text-xs font-black text-cyan-800 font-mono">
                        {kmRecorridos > 0 ? `+${kmRecorridos} km` : "--"}
                      </span>
                    </div>
                  </div>

                  {/* MINIATURAS DE FOTOS REQUERIDAS */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-2">
                      <span className="flex items-center gap-1.5">
                        <Eye size={13} className="text-cyan-600" />
                        Evidencias Fotográficas ({fotosDisponibles.length}/5)
                      </span>
                      {fotosDisponibles.length > 0 && (
                        <button
                          onClick={() => handleOpenPhotos(insp, 0)}
                          className="text-[11px] text-cyan-600 hover:text-cyan-700 font-bold hover:underline cursor-pointer"
                        >
                          Ver Todas
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      
                      {/* Foto Tablero Inicio */}
                      <button
                        type="button"
                        onClick={() => insp.foto_tablero_inicio && handleOpenPhotos(insp, 0)}
                        className={`relative aspect-square rounded-2xl border overflow-hidden flex flex-col items-center justify-center p-1 transition-all ${
                          insp.foto_tablero_inicio
                            ? "border-slate-200 hover:border-cyan-500 cursor-pointer shadow-xs"
                            : "border-dashed border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed"
                        }`}
                      >
                        {insp.foto_tablero_inicio ? (
                          <>
                            <img
                              src={getImageUrl(insp.foto_tablero_inicio)}
                              alt="Tablero Inicio"
                              className="w-full h-full object-cover rounded-xl"
                            />
                            <span className="absolute bottom-1 inset-x-1 bg-black/70 text-[9px] font-bold text-white text-center rounded py-0.5">
                              Tablero
                            </span>
                          </>
                        ) : (
                          <Gauge size={18} />
                        )}
                      </button>

                      {/* Foto Aceite */}
                      <button
                        type="button"
                        onClick={() => insp.foto_aceite && handleOpenPhotos(insp, 1)}
                        className={`relative aspect-square rounded-2xl border overflow-hidden flex flex-col items-center justify-center p-1 transition-all ${
                          insp.foto_aceite
                            ? "border-slate-200 hover:border-cyan-500 cursor-pointer shadow-xs"
                            : "border-dashed border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed"
                        }`}
                      >
                        {insp.foto_aceite ? (
                          <>
                            <img
                              src={getImageUrl(insp.foto_aceite)}
                              alt="Aceite"
                              className="w-full h-full object-cover rounded-xl"
                            />
                            <span className="absolute bottom-1 inset-x-1 bg-black/70 text-[9px] font-bold text-white text-center rounded py-0.5">
                              Aceite
                            </span>
                          </>
                        ) : (
                          <Droplet size={18} />
                        )}
                      </button>

                      {/* Foto Agua */}
                      <button
                        type="button"
                        onClick={() => insp.foto_agua && handleOpenPhotos(insp, 2)}
                        className={`relative aspect-square rounded-2xl border overflow-hidden flex flex-col items-center justify-center p-1 transition-all ${
                          insp.foto_agua
                            ? "border-slate-200 hover:border-cyan-500 cursor-pointer shadow-xs"
                            : "border-dashed border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed"
                        }`}
                      >
                        {insp.foto_agua ? (
                          <>
                            <img
                              src={getImageUrl(insp.foto_agua)}
                              alt="Agua"
                              className="w-full h-full object-cover rounded-xl"
                            />
                            <span className="absolute bottom-1 inset-x-1 bg-black/70 text-[9px] font-bold text-white text-center rounded py-0.5">
                              Agua
                            </span>
                          </>
                        ) : (
                          <Waves size={18} />
                        )}
                      </button>

                      {/* Foto Tablero Fin */}
                      <button
                        type="button"
                        onClick={() => insp.foto_tablero_fin && handleOpenPhotos(insp, 4)}
                        className={`relative aspect-square rounded-2xl border overflow-hidden flex flex-col items-center justify-center p-1 transition-all ${
                          insp.foto_tablero_fin
                            ? "border-slate-200 hover:border-cyan-500 cursor-pointer shadow-xs"
                            : "border-dashed border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed"
                        }`}
                      >
                        {insp.foto_tablero_fin ? (
                          <>
                            <img
                              src={getImageUrl(insp.foto_tablero_fin)}
                              alt="Tablero Cierre"
                              className="w-full h-full object-cover rounded-xl"
                            />
                            <span className="absolute bottom-1 inset-x-1 bg-black/70 text-[9px] font-bold text-white text-center rounded py-0.5">
                              Cierre
                            </span>
                          </>
                        ) : (
                          <Clock size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Observaciones del Técnico si las hay */}
                  {insp.observaciones_tecnico && (
                    <div className="text-xs bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-slate-600">
                      <span className="font-bold text-slate-700 block mb-0.5">Nota del técnico:</span>
                      <p className="line-clamp-2">{insp.observaciones_tecnico}</p>
                    </div>
                  )}

                  {/* Observaciones del Administrador si está observado */}
                  {insp.observaciones_admin && (
                    <div className="text-xs bg-amber-50 p-2.5 rounded-2xl border border-amber-200/60 text-amber-800">
                      <span className="font-bold block mb-0.5">Observación de Auditoría:</span>
                      <p className="line-clamp-2">{insp.observaciones_admin}</p>
                    </div>
                  )}
                </div>

                {/* FOOTER DE ACCIONES DE AUDITORÍA */}
                <div className="p-3 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setObservandoId(insp.id_inspeccion);
                      setTextoObservacion(insp.observaciones_admin || "");
                    }}
                    className="flex-1 py-2 px-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <AlertTriangle size={14} />
                    Observar
                  </button>

                  <button
                    onClick={() => handleAprobarRapido(insp.id_inspeccion)}
                    disabled={auditandoLoading || insp.estado_auditoria === "Aprobado"}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      insp.estado_auditoria === "Aprobado"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200 opacity-80"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow"
                    }`}
                  >
                    <Check size={14} />
                    {insp.estado_auditoria === "Aprobado" ? "Aprobado" : "Aprobar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. MODAL DE OBSERVACIÓN
      ───────────────────────────────────────────────────────────── */}
      {observandoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
                <AlertTriangle size={18} />
                <span>Observar Inspección</span>
              </div>
              <button
                onClick={() => setObservandoId(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Motivo de la observación (será visible para el técnico):
              </label>
              <textarea
                value={textoObservacion}
                onChange={(e) => setTextoObservacion(e.target.value)}
                rows={3}
                placeholder="Ej: Foto de tablero borrosa, falta evidenciar varilla de aceite, odómetro no concuerda..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none transition-all"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setObservandoId(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarObservacion}
                disabled={auditandoLoading || !textoObservacion.trim()}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                Guardar Observación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. VISOR DE FOTOS MODAL
      ───────────────────────────────────────────────────────────── */}
      {viewerPhotos && (
        <PhotoViewerModal
          photos={viewerPhotos}
          initialIndex={viewerIndex}
          onClose={() => setViewerPhotos(null)}
        />
      )}
    </div>
  );
};
