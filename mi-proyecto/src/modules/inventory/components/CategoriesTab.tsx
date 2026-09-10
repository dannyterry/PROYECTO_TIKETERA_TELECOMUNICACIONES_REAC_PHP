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
  Boxes,
  Pencil,
  Package,
  CheckCircle2,
} from "lucide-react";
import { CategoriaItem, ProductoStock } from "../types/inventoryTypes";
import {
  getCategorias,
  crearCategoria,
  actualizarCategoria,
  desactivarCategoria,
  getProductos,
} from "../services/inventoryService";
import { EditProductModal } from "./EditProductModal";

export const CategoriesTab: React.FC = () => {
  const [subTab, setSubTab] = useState<"categorias" | "productos">("categorias");

  // ── ESTADO DE CATEGORÍAS ──
  const [categorias, setCategorias] = useState<CategoriaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState("");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState<CategoriaItem | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [estado, setEstado] = useState<"Activo" | "Inactivo">("Activo");
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ── ESTADO DE PRODUCTOS (CATÁLOGO / EDICIÓN DE NOMBRES) ──
  const [productos, setProductos] = useState<ProductoStock[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [filtroProductoTexto, setFiltroProductoTexto] = useState("");
  const [filtroProductoCat, setFiltroProductoCat] = useState("TODAS");
  const [productoAEditar, setProductoAEditar] = useState<ProductoStock | null>(null);

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

  const cargarProductos = async () => {
    try {
      setLoadingProductos(true);
      const data = await getProductos();
      setProductos(data || []);
    } catch (err: any) {
      console.error("Error al cargar productos:", err);
    } finally {
      setLoadingProductos(false);
    }
  };

  useEffect(() => {
    cargarCategorias();
    cargarProductos();
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

  const productosFiltrados = productos.filter((p) => {
    const txt = filtroProductoTexto.trim().toLowerCase();
    const matchTxt =
      !txt ||
      (p.nombre || "").toLowerCase().includes(txt) ||
      (p.codigo || "").toLowerCase().includes(txt) ||
      (p.proid || "").toLowerCase().includes(txt);

    const matchCat =
      filtroProductoCat === "TODAS" ||
      (p.categoria || "").trim().toUpperCase() === filtroProductoCat.toUpperCase();

    return matchTxt && matchCat;
  });

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* ─────────────────────────────────────────────────────────────
          SELECTOR DE SUB-PESTAÑA (CATEGORÍAS VS CATÁLOGO DE PRODUCTOS)
      ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 bg-slate-200/70 p-1 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setSubTab("categorias")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            subTab === "categorias"
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Tag size={15} />
          <span>Categorías ({categorias.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("productos")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            subTab === "productos"
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Boxes size={15} />
          <span>Catálogo de Productos / Editar Nombres ({productos.length})</span>
        </button>
      </div>

      {subTab === "categorias" ? (
        <>
          {/* ─────────────────────────────────────────────────────────────
              1. HEADER Y BARRA DE BÚSQUEDA DE CATEGORÍAS
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
                            <span className="font-extrabold text-slate-900">{c.nombre}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-slate-500">
                          {c.descripcion || <span className="italic text-slate-400">Sin descripción</span>}
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              c.estado === "Activo"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {c.estado || "Activo"}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAbrirEditar(c)}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                              title="Editar categoría"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDesactivar(c)}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="Desactivar categoría"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* ─────────────────────────────────────────────────────────────
              CATÁLOGO DE PRODUCTOS / BÚSQUEDA Y EDICIÓN DE NOMBRES
          ───────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Boxes size={22} />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">
                  Catálogo de Productos y Nombres Oficiales
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Busca cualquier producto para modificar su nombre, código o categoría.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap flex-1 sm:flex-initial justify-end">
              {/* Filtro de Categoría */}
              <select
                value={filtroProductoCat}
                onChange={(e) => setFiltroProductoCat(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="TODAS">🏷️ Todas las Categorías</option>
                {categorias.map((c) => (
                  <option key={c.id_categoria} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
              </select>

              {/* Buscador de Producto */}
              <div className="relative min-w-[240px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={filtroProductoTexto}
                  onChange={(e) => setFiltroProductoTexto(e.target.value)}
                  placeholder="Buscar por nombre o código..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500 transition-all"
                />
                {filtroProductoTexto && (
                  <button
                    type="button"
                    onClick={() => setFiltroProductoTexto("")}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tabla de Productos con Botón de Edición de Nombre */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            {loadingProductos ? (
              <div className="p-12 text-center text-xs font-semibold text-slate-400">
                Cargando catálogo de productos...
              </div>
            ) : productosFiltrados.length === 0 ? (
              <div className="p-12 text-center text-xs font-medium text-slate-400">
                No se encontraron productos con la búsqueda actual.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-5">Código / ID</th>
                      <th className="py-3.5 px-5">Nombre Oficial del Producto</th>
                      <th className="py-3.5 px-5">Categoría</th>
                      <th className="py-3.5 px-5 text-center">Ubicación</th>
                      <th className="py-3.5 px-5 text-right">Stock Central</th>
                      <th className="py-3.5 px-5 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productosFiltrados.map((p) => (
                      <tr key={p.id_producto} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-5">
                          <span className="font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {p.codigo || `#${p.id_producto}`}
                          </span>
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 text-xs">
                              {p.nombre}
                            </span>
                            {p.maneja_serie && (
                              <span className="px-1.5 py-0.5 text-[9px] font-black uppercase bg-purple-50 text-purple-700 border border-purple-200 rounded">
                                Serializado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {p.categoria || "SIN CATEGORÍA"}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-center font-mono text-[11px] text-slate-500">
                          {p.stand ? `Stand ${p.stand}${p.fila ? ` - Fila ${p.fila}` : ""}` : "-"}
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono font-black text-emerald-700">
                          {Number(p.stock_central || 0)} {p.unidad || (p.es_drop ? "m" : "und")}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => setProductoAEditar(p)}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl font-bold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer border border-indigo-200 hover:border-indigo-600"
                            title="Editar nombre y categoría de este producto"
                          >
                            <Pencil size={12} />
                            <span>Editar Nombre</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL CREAR / EDITAR CATEGORÍA
      ───────────────────────────────────────────────────────────── */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Tag size={18} className="text-indigo-600" />
                <h3 className="text-base font-black text-slate-900">
                  {categoriaEditando ? "Editar Categoría" : "Nueva Categoría"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2 font-bold">
                  <AlertCircle size={15} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre de la Categoría *
                </label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: HERRAMIENTAS, MATERIALES..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500 uppercase transition-all"
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
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

      {/* ─────────────────────────────────────────────────────────────
          MODAL PARA EDITAR NOMBRE Y CATÁLOGO DE PRODUCTOS
      ───────────────────────────────────────────────────────────── */}
      {productoAEditar && (
        <EditProductModal
          isOpen={!!productoAEditar}
          producto={productoAEditar}
          onClose={() => setProductoAEditar(null)}
          onProductoActualizado={() => {
            cargarProductos();
            cargarCategorias();
          }}
        />
      )}

    </div>
  );
};
