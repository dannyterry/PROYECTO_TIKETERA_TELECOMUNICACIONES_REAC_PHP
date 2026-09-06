import React, { useState, useEffect } from "react";
import {
  X,
  Car,
  Check,
  RotateCw,
  AlertCircle,
  Calendar,
  Shield,
  FileCheck,
} from "lucide-react";
import { Vehiculo, CatalogosFlota } from "../types/mobilityTypes";
import { crearVehiculo, actualizarVehiculo } from "../services/mobilityService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  vehiculo: Vehiculo | null; // Si es null => Crear, si tiene valor => Editar
  catalogos: CatalogosFlota | null;
  onSaved: () => void;
}

export const VehicleFormModal: React.FC<Props> = ({
  isOpen,
  onClose,
  vehiculo,
  catalogos,
  onSaved,
}) => {
  const isEditing = !!vehiculo;

  const [placa, setPlaca] = useState("");
  const [idMarca, setIdMarca] = useState<string>("");
  const [idModelo, setIdModelo] = useState<string>("");
  const [idTipoVehiculo, setIdTipoVehiculo] = useState<string>("");
  const [idCombustible, setIdCombustible] = useState<string>("");
  const [anio, setAnio] = useState<string>(new Date().getFullYear().toString());
  const [transmision, setTransmision] = useState<"Manual" | "Automática">("Manual");
  const [color, setColor] = useState("");
  const [estado, setEstado] = useState<"Disponible" | "En uso" | "En mantenimiento" | "Inactivo">("Disponible");
  const [observaciones, setObservaciones] = useState("");
  const [fechaVenSoat, setFechaVenSoat] = useState("");
  const [fechaVenRevision, setFechaVenRevision] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (vehiculo) {
      setPlaca(vehiculo.placa || "");
      setIdMarca(vehiculo.id_marca ? String(vehiculo.id_marca) : "");
      setIdModelo(vehiculo.id_modelo ? String(vehiculo.id_modelo) : "");
      setIdTipoVehiculo(vehiculo.id_tipo_vehiculo ? String(vehiculo.id_tipo_vehiculo) : "");
      setIdCombustible(vehiculo.id_combustible ? String(vehiculo.id_combustible) : "");
      setAnio(vehiculo.anio ? String(vehiculo.anio) : new Date().getFullYear().toString());
      setTransmision(vehiculo.transmision === "Automática" ? "Automática" : "Manual");
      setColor(vehiculo.color || "");
      setEstado(vehiculo.estado || "Disponible");
      setObservaciones(vehiculo.observaciones || "");
      setFechaVenSoat(vehiculo.fecha_ven_soat ? vehiculo.fecha_ven_soat.substring(0, 10) : "");
      setFechaVenRevision(vehiculo.fecha_ven_revision ? vehiculo.fecha_ven_revision.substring(0, 10) : "");
    } else {
      setPlaca("");
      setIdMarca(catalogos?.marcas?.[0]?.id_marca ? String(catalogos.marcas[0].id_marca) : "");
      setIdModelo(catalogos?.modelos?.[0]?.id_modelo ? String(catalogos.modelos[0].id_modelo) : "");
      setIdTipoVehiculo(catalogos?.tipos_vehiculo?.[0]?.id_tipo_vehiculo ? String(catalogos.tipos_vehiculo[0].id_tipo_vehiculo) : "");
      setIdCombustible(catalogos?.combustibles?.[0]?.id_combustible ? String(catalogos.combustibles[0].id_combustible) : "");
      setAnio(new Date().getFullYear().toString());
      setTransmision("Manual");
      setColor("");
      setEstado("Disponible");
      setObservaciones("");
      setFechaVenSoat("");
      setFechaVenRevision("");
    }
    setErrorMsg("");
  }, [vehiculo, isOpen, catalogos]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placa.trim()) {
      setErrorMsg("La placa es obligatoria");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg("");

      const payload = {
        placa: placa.trim().toUpperCase(),
        id_marca: idMarca ? Number(idMarca) : null,
        id_modelo: idModelo ? Number(idModelo) : null,
        id_tipo_vehiculo: idTipoVehiculo ? Number(idTipoVehiculo) : null,
        id_combustible: idCombustible ? Number(idCombustible) : null,
        anio: anio ? Number(anio) : null,
        transmision,
        color: color.trim() || null,
        estado,
        observaciones: observaciones.trim() || null,
        fecha_ven_soat: fechaVenSoat || null,
        fecha_ven_revision: fechaVenRevision || null,
      };

      if (isEditing && vehiculo) {
        await actualizarVehiculo(vehiculo.id_vehiculo, payload);
      } else {
        await crearVehiculo(payload);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-600 text-white flex items-center justify-center font-bold shadow-md shadow-cyan-600/20">
              <Car size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {isEditing ? `Editar Vehículo: ${vehiculo?.placa}` : "Registrar Nuevo Vehículo"}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Completa las características técnicas y documentación del vehículo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Fila 1: Placa, Año, Color */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Placa <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={placa}
                onChange={(e) => setPlaca(e.target.value)}
                placeholder="ej. ABC-123"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:border-cyan-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Año de Fabricación
              </label>
              <input
                type="number"
                min="1990"
                max="2035"
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
                placeholder="2023"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-cyan-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Color
              </label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="ej. Blanco"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-cyan-500 transition-all"
              />
            </div>
          </div>

          {/* Fila 2: Marca, Modelo, Tipo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Marca
              </label>
              <select
                value={idMarca}
                onChange={(e) => setIdMarca(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-cyan-500 transition-all"
              >
                <option value="">-- Seleccionar Marca --</option>
                {catalogos?.marcas?.map((m) => (
                  <option key={m.id_marca} value={m.id_marca}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Modelo
              </label>
              <select
                value={idModelo}
                onChange={(e) => setIdModelo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-cyan-500 transition-all"
              >
                <option value="">-- Seleccionar Modelo --</option>
                {catalogos?.modelos?.map((mo) => (
                  <option key={mo.id_modelo} value={mo.id_modelo}>
                    {mo.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tipo de Vehículo
              </label>
              <select
                value={idTipoVehiculo}
                onChange={(e) => setIdTipoVehiculo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-cyan-500 transition-all"
              >
                <option value="">-- Seleccionar Tipo --</option>
                {catalogos?.tipos_vehiculo?.map((tv) => (
                  <option key={tv.id_tipo_vehiculo} value={tv.id_tipo_vehiculo}>
                    {tv.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fila 3: Combustible, Transmisión, Estado */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Combustible
              </label>
              <select
                value={idCombustible}
                onChange={(e) => setIdCombustible(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-cyan-500 transition-all"
              >
                <option value="">-- Seleccionar Combustible --</option>
                {catalogos?.combustibles?.map((c) => (
                  <option key={c.id_combustible} value={c.id_combustible}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Transmisión
              </label>
              <select
                value={transmision}
                onChange={(e) => setTransmision(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-cyan-500 transition-all"
              >
                <option value="Manual">Manual</option>
                <option value="Automática">Automática</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Estado Operativo
              </label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-cyan-500 transition-all"
              >
                <option value="Disponible">Disponible</option>
                <option value="En uso">En uso</option>
                <option value="En mantenimiento">En mantenimiento</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>
          </div>

          {/* Fila 4: Fechas de Vencimiento de SOAT y Revisión Técnica */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Shield size={14} className="text-cyan-600" />
                Vencimiento SOAT
              </label>
              <input
                type="date"
                value={fechaVenSoat}
                onChange={(e) => setFechaVenSoat(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-cyan-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <FileCheck size={14} className="text-cyan-600" />
                Vencimiento Revisión Técnica
              </label>
              <input
                type="date"
                value={fechaVenRevision}
                onChange={(e) => setFechaVenRevision(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-cyan-500 transition-all"
              />
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Observaciones adicionales
            </label>
            <textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas sobre el estado físico, accesorios o historial del vehículo..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-cyan-500 transition-all"
            />
          </div>

          {/* Footer botones */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
            >
              {loading ? (
                <RotateCw className="animate-spin" size={15} />
              ) : (
                <Check size={15} />
              )}
              <span>{isEditing ? "Guardar Cambios" : "Crear Vehículo"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
