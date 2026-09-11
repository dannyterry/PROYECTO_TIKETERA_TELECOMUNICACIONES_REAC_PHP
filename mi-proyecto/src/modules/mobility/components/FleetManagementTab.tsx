import React, { useState, useEffect } from "react";
import {
  Car,
  User,
  Fuel,
  Gauge,
  RotateCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Wrench,
  X,
  Sparkles,
  Plus,
  Layers,
  Edit3,
  Calendar,
  Shield,
  FileCheck,
  LayoutGrid,
  List,
} from "lucide-react";
import { Vehiculo, Tecnico, CatalogosFlota } from "../types/mobilityTypes";
import { reasignarVehiculo, getCatalogosFlota } from "../services/mobilityService";
import { VehicleFormModal } from "./VehicleFormModal";
import { FleetCatalogModal } from "./FleetCatalogModal";

interface Props {
  vehiculos: Vehiculo[];
  tecnicos: Tecnico[];
  loading: boolean;
  onRefresh: () => void;
}

export const FleetManagementTab: React.FC<Props> = ({
  vehiculos,
  tecnicos,
  loading,
  onRefresh,
}) => {
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [modoVista, setModoVista] = useState<"tarjetas" | "filas">("tarjetas");

  // Catálogos
  const [catalogos, setCatalogos] = useState<CatalogosFlota | null>(null);
  const [modalCatalogoAbierto, setModalCatalogoAbierto] = useState(false);

  // Modal Crear / Editar Vehículo
  const [modalVehiculoAbierto, setModalVehiculoAbierto] = useState(false);
  const [vehiculoAEditar, setVehiculoAEditar] = useState<Vehiculo | null>(null);

  // Modal Reasignación
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<Vehiculo | null>(null);
  const [nuevoTrabajadorId, setNuevoTrabajadorId] = useState<string>("");
  const [motivoCambio, setMotivoCambio] = useState<string>("");
  const [guardando, setGuardando] = useState(false);

  const cargarCatalogos = async () => {
    try {
      const data = await getCatalogosFlota();
      setCatalogos(data);
    } catch (err) {
      console.error("Error al cargar catalogos de flota:", err);
    }
  };

  useEffect(() => {
    cargarCatalogos();
  }, []);

  const vehiculosFiltrados = vehiculos.filter((v) => {
    const txt = filtroTexto.toLowerCase();
    const coincideTexto =
      !txt ||
      (v.placa && v.placa.toLowerCase().includes(txt)) ||
      (v.modelo && v.modelo.toLowerCase().includes(txt)) ||
      (v.marca && v.marca.toLowerCase().includes(txt)) ||
      (v.tecnico_asignado && v.tecnico_asignado.toLowerCase().includes(txt));

    const coincideEstado = filtroEstado === "Todos" || v.estado === filtroEstado;

    return coincideTexto && coincideEstado;
  });

  const handleAbrirNuevoVehiculo = () => {
    setVehiculoAEditar(null);
    setModalVehiculoAbierto(true);
  };

  const handleAbrirEditarVehiculo = (veh: Vehiculo) => {
    setVehiculoAEditar(veh);
    setModalVehiculoAbierto(true);
  };

  const handleAbrirReasignar = (veh: Vehiculo) => {
    setVehiculoSeleccionado(veh);
    setNuevoTrabajadorId(veh.id_trabajador ? String(veh.id_trabajador) : "");
    setMotivoCambio("");
  };

  const handleGuardarReasignacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehiculoSeleccionado) return;

    try {
      setGuardando(true);
      await reasignarVehiculo({
        id_vehiculo: vehiculoSeleccionado.id_vehiculo,
        id_trabajador: nuevoTrabajadorId ? Number(nuevoTrabajadorId) : null,
        motivo_cambio: motivoCambio || "Reasignación operativa de flota",
      });
      setVehiculoSeleccionado(null);
      onRefresh();
    } catch (e: any) {
      alert("Error al reasignar: " + (e.response?.data?.error || e.message));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          1. BARRA DE ACCIONES PRINCIPALES Y FILTROS
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        
        {/* Buscador */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            type="text"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="Buscar por placa, modelo o técnico..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 text-xs font-medium text-slate-800 placeholder-slate-400 rounded-2xl border border-slate-200 focus:border-cyan-500 focus:outline-none transition-all"
          />
        </div>

        {/* Filtros de Estado */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto">
          {["Todos", "Disponible", "En uso", "En mantenimiento"].map((est) => (
            <button
              key={est}
              onClick={() => setFiltroEstado(est)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filtroEstado === est
                  ? est === "Disponible"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : est === "En uso"
                    ? "bg-blue-600 text-white shadow-xs"
                    : est === "En mantenimiento"
                    ? "bg-amber-500 text-white shadow-xs"
                    : "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {est}
            </button>
          ))}
        </div>

        {/* Botones de Acción: Catálogo y Nuevo Vehículo */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setModoVista("tarjetas")}
              className={`p-2 rounded-xl transition-all cursor-pointer ${modoVista === "tarjetas" ? "bg-white text-cyan-700 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
              title="Ver vehículos en tarjetas"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setModoVista("filas")}
              className={`p-2 rounded-xl transition-all cursor-pointer ${modoVista === "filas" ? "bg-white text-cyan-700 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
              title="Ver vehículos en filas"
            >
              <List size={15} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setModalCatalogoAbierto(true)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-bold flex items-center gap-2 border border-slate-200 transition-all cursor-pointer"
            title="Marcas, modelos y tipos de vehículo"
          >
            <Layers size={15} className="text-cyan-600" />
            <span>Catálogo Flota</span>
          </button>

          <button
            type="button"
            onClick={handleAbrirNuevoVehiculo}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-2xl text-xs font-bold flex items-center gap-2 shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Nuevo Vehículo</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. TARJETAS DE VEHÍCULOS DE LA FLOTA
      ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm font-semibold">
          Cargando vehículos de la flota...
        </div>
      ) : vehiculosFiltrados.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-sm">
          No se encontraron vehículos.
        </div>
      ) : (
        <div className={modoVista === "tarjetas" ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" : "space-y-2"}>
          {vehiculosFiltrados.map((v) => (
            <div
              key={v.id_vehiculo}
              className={modoVista === "tarjetas"
                ? "bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 group"
                : "bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all px-4 py-3 flex flex-wrap items-center gap-4 group"}
            >
              {/* Header Vehículo */}
              <div>
                <div className={modoVista === "tarjetas" ? "flex items-start justify-between gap-3" : "flex items-center gap-4 min-w-[260px]"}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-cyan-600/20">
                      <Car size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-black text-slate-900 font-mono tracking-wider">
                          {v.placa}
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {v.anio || "2024"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-bold">
                        {v.marca} {v.modelo}
                      </p>
                    </div>
                  </div>

                  {/* Estado Badge */}
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold border ${
                      v.estado === "Disponible"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : v.estado === "En uso"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {v.estado === "Disponible" ? (
                      <CheckCircle2 size={12} />
                    ) : v.estado === "En uso" ? (
                      <Car size={12} />
                    ) : (
                      <Wrench size={12} />
                    )}
                    {v.estado}
                  </span>
                </div>

                {/* Especificaciones */}
                <div className={modoVista === "tarjetas" ? "grid grid-cols-3 gap-2 mt-4 text-center" : "flex items-center gap-2 text-center"}>
                  <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Combustible</span>
                    <span className="text-xs font-bold text-slate-800 truncate block">
                      {v.combustible || "Gasolina"}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Color</span>
                    <span className="text-xs font-bold text-slate-800 truncate block">
                      {v.color || "Blanco"}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Último KM</span>
                    <span className="text-xs font-black text-cyan-800 font-mono block">
                      {v.ultimo_km ? `${v.ultimo_km.toLocaleString()} km` : "N/D"}
                    </span>
                  </div>
                </div>

                {/* Técnico Asignado */}
                <div className={modoVista === "tarjetas" ? "mt-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-100 flex items-center justify-between" : "bg-slate-50/80 px-3 py-2 rounded-xl border border-slate-100 flex items-center justify-between min-w-[280px] flex-1"}>
                  <div className="flex items-center gap-2 truncate">
                    <User size={16} className="text-cyan-600 shrink-0" />
                    <div className="truncate">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Conductor Asignado
                      </span>
                      <span className="text-xs font-extrabold text-slate-800 truncate block" title={v.tecnico_asignado}>
                        {v.tecnico_asignado || "Sin técnico asignado"}
                      </span>
                    </div>
                  </div>
                  {v.cuadrilla && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-teal-100 text-teal-800 font-mono shrink-0">
                      {v.cuadrilla}
                    </span>
                  )}
                </div>
              </div>

                {/* Botones de Acción en cada vehículo */}
                <div className={modoVista === "tarjetas" ? "flex items-center gap-2 pt-1" : "flex items-center gap-2 ml-auto"}>
                  <button
                    type="button"
                    onClick={() => handleAbrirEditarVehiculo(v)}
                    className="flex-1 py-2.5 px-3 rounded-2xl border border-slate-200 hover:border-cyan-500 bg-white hover:bg-cyan-50/50 text-slate-700 hover:text-cyan-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    title="Editar datos del vehículo"
                  >
                    <Edit3 size={14} className="text-cyan-600" />
                    <span>Editar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAbrirReasignar(v)}
                    className="flex-1 py-2.5 px-3 rounded-2xl border border-slate-200 hover:border-cyan-500 bg-white hover:bg-cyan-50/50 text-slate-700 hover:text-cyan-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    title="Reasignar conductor"
                  >
                    <RotateCw size={14} className="text-cyan-600" />
                    <span>Conductor</span>
                  </button>
                </div>
              </div>
          ))}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. MODAL DE REASIGNACIÓN DE VEHÍCULO
      ───────────────────────────────────────────────────────────── */}
      {vehiculoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 text-cyan-600 font-extrabold text-base">
                <RotateCw size={20} />
                <span>Reasignar Vehículo</span>
              </div>
              <button
                onClick={() => setVehiculoSeleccionado(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Vehículo Info */}
            <div className="p-3 bg-cyan-50/50 rounded-2xl border border-cyan-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center font-black text-sm">
                <Car size={20} />
              </div>
              <div>
                <h5 className="text-sm font-black text-slate-900 font-mono tracking-wider">
                  {vehiculoSeleccionado.placa}
                </h5>
                <p className="text-xs text-slate-500 font-medium">
                  {vehiculoSeleccionado.marca} {vehiculoSeleccionado.modelo} ({vehiculoSeleccionado.color})
                </p>
              </div>
            </div>

            <form onSubmit={handleGuardarReasignacion} className="space-y-4 text-xs font-semibold text-slate-700">
              
              {/* Seleccionar Técnico */}
              <div>
                <label className="block mb-1.5 text-slate-700 font-bold">Técnico Conductor (Rol Técnico) *</label>
                <select
                  value={nuevoTrabajadorId}
                  onChange={(e) => setNuevoTrabajadorId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-cyan-500 focus:outline-none cursor-pointer font-bold text-slate-800"
                >
                  <option value="">-- Dejar como Disponible (Sin técnico) --</option>
                  {tecnicos.map((t) => (
                    <option key={t.id_trabajador} value={t.id_trabajador}>
                      👤 {t.nombre_completo} {t.cuadrilla ? `[${t.cuadrilla}]` : ""} {t.vehiculo_placa ? `(🚗 Actual: ${t.vehiculo_placa})` : "(🟢 Sin vehículo actual)"}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block font-medium">
                  🔒 Solo se listan técnicos de campo activos (Administración y personal de oficina no conducen flota).
                </span>
              </div>

              {/* Motivo de Cambio */}
              <div>
                <label className="block mb-1.5 text-slate-600">Motivo del Cambio</label>
                <input
                  type="text"
                  placeholder="Ej: Carro anterior en taller, reemplazo temporal, asignación regular..."
                  value={motivoCambio}
                  onChange={(e) => setMotivoCambio(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Botones */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVehiculoSeleccionado(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl shadow-md shadow-cyan-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {guardando ? "Reasignando..." : "Confirmar Reasignación"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. MODAL CREAR / EDITAR VEHÍCULO
      ───────────────────────────────────────────────────────────── */}
      <VehicleFormModal
        isOpen={modalVehiculoAbierto}
        onClose={() => setModalVehiculoAbierto(false)}
        vehiculo={vehiculoAEditar}
        catalogos={catalogos}
        onSaved={() => {
          onRefresh();
          cargarCatalogos();
        }}
      />

      {/* ─────────────────────────────────────────────────────────────
          5. MODAL CATÁLOGOS DE FLOTA (MARCAS, MODELOS, TIPOS)
      ───────────────────────────────────────────────────────────── */}
      <FleetCatalogModal
        isOpen={modalCatalogoAbierto}
        onClose={() => setModalCatalogoAbierto(false)}
        catalogos={catalogos}
        onRefresh={() => {
          cargarCatalogos();
          onRefresh();
        }}
      />
    </div>
  );
};
