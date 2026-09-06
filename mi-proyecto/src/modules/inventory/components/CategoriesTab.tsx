import React, { useState, useEffect } from "react";
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  RotateCw,
  AlertCircle,
  Search,
  Sparkles,
  Layers,
} from "lucide-react";
import { CategoriaItem } from "../types/inventoryTypes";
import {
  getCategorias,
  crearCategoria,
  actualizarCategoria,
  desactivarCategoria,
} from "../services/inventoryService";

export const CategoriesTab: React.FC = () => {
  const [categorias, setCategorias] = useState<CategoriaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState("");

  // Form states
  const [modalAbierto, setModalAbierto] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState<CategoriaItem | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [estado, setEstado] = useState<"Activo" | "Inactivo">("Activo");
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const cargarCategorias = async () => {
    try {
      setLoading(true);
      const data = await getCategorias();
      setCategorias(data || []);
    } catch (err: any) {
      console.error("Error al cargar categorias:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCategorias();
  }, []);

  const handleAbrirCrear = () => {
    setCategoriaEditando(null);
    setNombre("");
    setDescripcion("");
    setEstado("Activo");
    setErrorMsg("");
    setModalAbierto(true);
  };

  const handleAbrirEditar = (cat: CategoriaItem) => {
    setCategoriaEditando(cat);
    setNombre(cat.nombre);
    setDescripcion(cat.descripcion || "");
    setEstado(cat.estado || "Activo");
    setErrorMsg("");
    setModalAbierto(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setErrorMsg("El nombre de la categoría es requerido.");
      return;
    }

    try {
      setGuardando(true);
      setErrorMsg("");

      if (categoriaEditando) {
        await actualizarCategoria(categoriaEditando.id_categoria, {
          nombre: nombre.trim().toUpperCase(),
          descripcion: descripcion.trim() || undefined,
          estado,
        });
      } else {
        await crearCategoria({
          nombre: nombre.trim().toUpperCase(),
          descripcion: descripcion.trim() || undefined,
          estado,
        });
      }

      setModalAbierto(false);
      cargarCategorias();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleDesactivar = async (cat: CategoriaItem) => {
    if (!window.confirm(`¿Estás seguro de desactivar la categoría "${cat.nombre}"?`)) return;

    try {
      await desactivarCategoria(cat.id_categoria);
      cargarCategorias();
    } catch (err: any) {
      alert("Error al desactivar: " + (err.response?.data?.error || err.message));
    }
  };

  const categoriasFiltradas = categorias.filter((c) => {
    const txt = filtroTexto.toLowerCase();
    return (
      !txt ||
      c.nombre.toLowerCase().includes(txt) ||
      (c.descripcion && c.descripcion.toLowerCase().includes(txt))
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER Y BARRA DE BÚSQUEDA
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Tag size={22} />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">
              Categorías de Productos
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Clasificación para inventario, compras, dotación y control de mermas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-1 sm:flex-initial justify-end">
          {/* Buscador */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Buscar categoría..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <button
            type="button"
            onClick={handleAbrirCrear}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer shrink-0"
          >
            <Plus size={16} />
            <span>Nueva Categoría</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. TABLA DE CATEGORÍAS
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs font-semibold text-slate-400">
            Cargando categorías...
          </div>
        ) : categoriasFiltradas.length === 0 ? (
          <div className="p-12 text-center text-xs font-medium text-slate-400">
            No se encontraron categorías registradas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">ID</th>
                  <th className="py-3.5 px-5">Categoría</th>
                  <th className="py-3.5 px-5">Descripción</th>
                  <th className="py-3.5 px-5 text-center">Estado</th>
                  <th className="py-3.5 px-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categoriasFiltradas.map((c) => (
                  <tr key={c.id_categoria} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-slate-400 font-bold">
                      #{c.id_categoria}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span className="font-extrabold text-slate-900 tracking-wide">
                          {c.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-slate-500">
                      {c.descripcion || <span className="text-slate-300 italic">Sin descripción</span>}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          c.estado === "Activo" || !c.estado
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {c.estado || "Activo"}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleAbrirEditar(c)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                          title="Editar categoría"
                        >
                          <Edit2 size={15} />
                        </button>
                        {c.estado !== "Inactivo" && (
                          <button
                            type="button"
                            onClick={() => handleDesactivar(c)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                            title="Desactivar"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. MODAL CREAR / EDITAR CATEGORÍA
      ───────────────────────────────────────────────────────────── */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Tag size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {categoriaEditando ? "Editar Categoría" : "Nueva Categoría"}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Ingresa los datos para clasificar productos
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
                  Nombre de Categoría <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="ej. EQUIPOS, FIBRA ÓPTICA, HERRAMIENTAS..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 uppercase focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descripción
                </label>
                <textarea
                  rows={3}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Breve detalle de los tipos de artículos en esta categoría..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Estado
                </label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 transition-all"
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
                  <span>{categoriaEditando ? "Guardar Cambios" : "Crear Categoría"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
