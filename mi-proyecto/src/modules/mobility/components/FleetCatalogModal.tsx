import React, { useState } from "react";
import {
  X,
  Tags,
  Layers,
  Truck,
  Plus,
  Edit2,
  Trash2,
  Check,
  RotateCw,
  AlertCircle,
} from "lucide-react";
import {
  CatalogosFlota,
  Marca,
  Modelo,
  TipoVehiculo,
} from "../types/mobilityTypes";
import {
  crearMarca,
  actualizarMarca,
  desactivarMarca,
  crearModelo,
  actualizarModelo,
  desactivarModelo,
  crearTipoVehiculo,
  actualizarTipoVehiculo,
  desactivarTipoVehiculo,
} from "../services/mobilityService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  catalogos: CatalogosFlota | null;
  onRefresh: () => void;
}

export const FleetCatalogModal: React.FC<Props> = ({
  isOpen,
  onClose,
  catalogos,
  onRefresh,
}) => {
  const [tab, setTab] = useState<"marcas" | "modelos" | "tipos">("marcas");

  // Form states
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;

    try {
      setLoading(true);
      setErrorMsg("");

      if (tab === "marcas") {
        await crearMarca({ nombre: nuevoNombre.trim() });
      } else if (tab === "modelos") {
        await crearModelo({ nombre: nuevoNombre.trim() });
      } else {
        await crearTipoVehiculo({ nombre: nuevoNombre.trim() });
      }

      setNuevoNombre("");
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarEdicion = async (id: number) => {
    if (!editNombre.trim()) return;

    try {
      setLoading(true);
      setErrorMsg("");

      if (tab === "marcas") {
        await actualizarMarca(id, { nombre: editNombre.trim() });
      } else if (tab === "modelos") {
        await actualizarModelo(id, { nombre: editNombre.trim() });
      } else {
        await actualizarTipoVehiculo(id, { nombre: editNombre.trim() });
      }

      setEditId(null);
      setEditNombre("");
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDesactivar = async (id: number, nombre: string) => {
    if (!window.confirm(`¿Estás seguro de desactivar "${nombre}"?`)) return;

    try {
      setLoading(true);
      setErrorMsg("");

      if (tab === "marcas") {
        await desactivarMarca(id);
      } else if (tab === "modelos") {
        await desactivarModelo(id);
      } else {
        await desactivarTipoVehiculo(id);
      }

      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const getListaActual = () => {
    if (!catalogos) return [];
    if (tab === "marcas") return catalogos.marcas || [];
    if (tab === "modelos") return catalogos.modelos || [];
    return catalogos.tipos_vehiculo || [];
  };

  const lista = getListaActual();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Catálogo de Flota
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Gestiona marcas, modelos y tipos de vehículos
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

        {/* Tabs */}
        <div className="flex border-b border-slate-100 bg-white px-5 pt-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setTab("marcas");
              setEditId(null);
              setErrorMsg("");
            }}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              tab === "marcas"
                ? "border-cyan-600 text-cyan-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Tags size={15} />
            Marcas ({catalogos?.marcas?.length || 0})
          </button>

          <button
            type="button"
            onClick={() => {
              setTab("modelos");
              setEditId(null);
              setErrorMsg("");
            }}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              tab === "modelos"
                ? "border-cyan-600 text-cyan-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers size={15} />
            Modelos ({catalogos?.modelos?.length || 0})
          </button>

          <button
            type="button"
            onClick={() => {
              setTab("tipos");
              setEditId(null);
              setErrorMsg("");
            }}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              tab === "tipos"
                ? "border-cyan-600 text-cyan-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Truck size={15} />
            Tipos de Vehículo ({catalogos?.tipos_vehiculo?.length || 0})
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form Crear */}
          <form onSubmit={handleCrear} className="flex gap-2">
            <input
              type="text"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder={`Nuevo nombre de ${
                tab === "marcas"
                  ? "marca (ej. TOYOTA)"
                  : tab === "modelos"
                  ? "modelo (ej. HILUX 2023)"
                  : "tipo (ej. Furgoneta)"
              }`}
              className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-cyan-500 transition-all uppercase"
            />
            <button
              type="submit"
              disabled={loading || !nuevoNombre.trim()}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-cyan-600/20 transition-all cursor-pointer"
            >
              {loading ? <RotateCw className="animate-spin" size={15} /> : <Plus size={15} />}
              <span>Agregar</span>
            </button>
          </form>

          {/* Listado */}
          <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden">
            {lista.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 font-medium">
                No hay registros en esta categoría.
              </div>
            ) : (
              lista.map((item: any) => {
                const id =
                  item.id_marca || item.id_modelo || item.id_tipo_vehiculo;
                const isEditing = editId === id;

                return (
                  <div
                    key={id}
                    className="p-3 bg-white hover:bg-slate-50/80 flex items-center justify-between gap-3 transition-all"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-white border border-cyan-400 rounded-lg text-xs font-bold text-slate-800 uppercase focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleGuardarEdicion(id)}
                          disabled={loading}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs cursor-pointer"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditId(null);
                            setEditNombre("");
                          }}
                          className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              item.estado === "Activo"
                                ? "bg-emerald-500"
                                : "bg-slate-300"
                            }`}
                          />
                          <span className="text-xs font-bold text-slate-800 tracking-wide">
                            {item.nombre}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              item.estado === "Activo"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {item.estado}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditId(id);
                              setEditNombre(item.nombre);
                            }}
                            className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-all cursor-pointer"
                            title="Editar nombre"
                          >
                            <Edit2 size={14} />
                          </button>
                          {item.estado === "Activo" && (
                            <button
                              type="button"
                              onClick={() => handleDesactivar(id, item.nombre)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                              title="Desactivar"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
