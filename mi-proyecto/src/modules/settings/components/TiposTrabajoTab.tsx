import React, { useState, useEffect } from "react";
import {
  Briefcase,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  RotateCw,
  AlertCircle,
  Search,
} from "lucide-react";
import {
  TipoTrabajoItem,
  getTiposTrabajo,
  createTipoTrabajo,
  updateTipoTrabajo,
  deleteTipoTrabajo,
} from "../services/settingsService";

export const TiposTrabajoTab: React.FC = () => {
  const [tipos, setTipos] = useState<TipoTrabajoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState("");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [tipoEditando, setTipoEditando] = useState<TipoTrabajoItem | null>(null);
  const [nombre, setNombre] = useState("");
  const [estado, setEstado] = useState<"Activo" | "Inactivo">("Activo");
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const data = await getTiposTrabajo();
      setTipos(data || []);
    } catch (err: any) {
      console.error("Error al cargar tipos de trabajo:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleAbrirCrear = () => {
    setTipoEditando(null);
    setNombre("");
    setEstado("Activo");
    setErrorMsg("");
    setModalAbierto(true);
  };

  const handleAbrirEditar = (t: TipoTrabajoItem) => {
    setTipoEditando(t);
    setNombre(t.nombre);
    setEstado(t.estado || "Activo");
    setErrorMsg("");
    setModalAbierto(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setErrorMsg("El nombre es requerido.");
      return;
    }

    try {
      setGuardando(true);
      setErrorMsg("");

      if (tipoEditando) {
        await updateTipoTrabajo(tipoEditando.id_tipo_trabajo, {
          nombre: nombre.trim().toUpperCase(),
          estado,
        });
      } else {
        await createTipoTrabajo({
          nombre: nombre.trim().toUpperCase(),
          estado,
        });
      }

      setModalAbierto(false);
      cargarDatos();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  const handleDesactivar = async (t: TipoTrabajoItem) => {
    if (!window.confirm(`¿Estás seguro de desactivar "${t.nombre}"?`)) return;
    try {
      await deleteTipoTrabajo(t.id_tipo_trabajo);
      cargarDatos();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const tiposFiltrados = tipos.filter((t) => {
    const txt = filtroTexto.toLowerCase();
    return !txt || t.nombre.toLowerCase().includes(txt);
  });

  return (
    <div className="space-y-4 font-sans">
      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative min-w-[240px] flex-1 sm:flex-initial">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar tipo de trabajo..."
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={cargarDatos}
            disabled={loading}
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            title="Recargar"
          >
            <RotateCw size={16} className={loading ? "animate-spin text-indigo-600" : ""} />
          </button>
          <button
            onClick={handleAbrirCrear}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer active:scale-95"
          >
            <Plus size={16} />
            <span>Nuevo Tipo de Trabajo</span>
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">ID</th>
                <th className="py-3.5 px-4">Nombre del Tipo de Trabajo</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    <RotateCw className="animate-spin inline-block mr-2 text-indigo-600" size={18} />
                    Cargando tipos de trabajo...
                  </td>
                </tr>
              ) : tiposFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    No se encontraron tipos de trabajo.
                  </td>
                </tr>
              ) : (
                tiposFiltrados.map((t) => {
                  const esActivo = t.estado === "Activo" || !t.estado;
                  return (
                    <tr key={t.id_tipo_trabajo} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 font-bold">
                        #{t.id_tipo_trabajo}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 text-xs">{t.nombre}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            esActivo
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${esActivo ? "bg-emerald-500" : "bg-rose-500"}`} />
                          {t.estado || "Activo"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleAbrirEditar(t)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 size={14} />
                          </button>
                          {esActivo && (
                            <button
                              onClick={() => handleDesactivar(t)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                              title="Desactivar"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Briefcase size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {tipoEditando ? "Editar Tipo de Trabajo" : "Nuevo Tipo de Trabajo"}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Categorización operativa para órdenes y motivos
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalAbierto(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="ej. RECABLEADO, NORMALIZACIÓN, TRASLADO..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 uppercase focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Estado
                </label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {guardando ? <RotateCw className="animate-spin" size={15} /> : <Check size={15} />}
                  <span>{tipoEditando ? "Guardar Cambios" : "Crear Tipo"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
