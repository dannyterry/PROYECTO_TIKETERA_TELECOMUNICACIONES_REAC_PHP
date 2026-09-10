import React, { useState, useEffect } from "react";
import {
  X,
  Pencil,
  Tag,
  CheckCircle2,
  AlertCircle,
  Hash,
  Layers,
  Archive,
} from "lucide-react";
import { ProductoStock, CategoriaItem } from "../types/inventoryTypes";
import { actualizarProducto, getCategorias } from "../services/inventoryService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  producto: ProductoStock | null;
  onProductoActualizado: () => void;
}

export const EditProductModal: React.FC<Props> = ({
  isOpen,
  onClose,
  producto,
  onProductoActualizado,
}) => {
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [idCategoria, setIdCategoria] = useState<number | string>("");
  const [stockMinimo, setStockMinimo] = useState<number>(5);
  const [estado, setEstado] = useState<"Activo" | "Inactivo">("Activo");
  const [categorias, setCategorias] = useState<CategoriaItem[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      getCategorias()
        .then((cats) => {
          const listaCats = cats || [];
          setCategorias(listaCats);
          if (producto) {
            let catId: number | string = producto.id_categoria || "";
            if (!catId && producto.categoria) {
              const match = listaCats.find(
                (c) => c.nombre.trim().toUpperCase() === (producto.categoria || "").trim().toUpperCase()
              );
              if (match) catId = match.id_categoria;
            }
            if (catId) setIdCategoria(catId);
          }
        })
        .catch(console.error);
    }
  }, [isOpen, producto]);

  useEffect(() => {
    if (isOpen && producto) {
      setNombre(producto.nombre || "");
      setCodigo(producto.codigo || "");
      setStockMinimo(Number(producto.stock_minimo || 5));
      setEstado((producto.estado as "Activo" | "Inactivo") || "Activo");
      setError(null);

      let catId: number | string = producto.id_categoria || "";
      if (!catId && producto.categoria && categorias.length > 0) {
        const match = categorias.find(
          (c) => c.nombre.trim().toUpperCase() === (producto.categoria || "").trim().toUpperCase()
        );
        if (match) catId = match.id_categoria;
      }
      setIdCategoria(catId);
    }
  }, [isOpen, producto, categorias]);

  if (!isOpen || !producto) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setError("El nombre del producto es obligatorio.");
      return;
    }

    try {
      setGuardando(true);
      setError(null);

      // Si no se cambió la categoría, asegurar que conserve la existente
      let finalCatId = idCategoria ? Number(idCategoria) : undefined;
      if (!finalCatId && producto.categoria && categorias.length > 0) {
        const match = categorias.find(
          (c) => c.nombre.trim().toUpperCase() === (producto.categoria || "").trim().toUpperCase()
        );
        if (match) finalCatId = match.id_categoria;
      }

      await actualizarProducto(producto.id_producto, {
        nombre: nombre.trim().toUpperCase(),
        codigo: codigo.trim() ? codigo.trim().toUpperCase() : undefined,
        id_categoria: finalCatId,
        stock_minimo: Number(stockMinimo) || 0,
        estado,
      });

      alert(`✅ Producto "${nombre.trim().toUpperCase()}" actualizado correctamente.`);
      onProductoActualizado();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Error al actualizar el producto");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 md:p-6 animate-fade-in font-sans">
      <div className="bg-white rounded-3xl p-5 md:p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-5 max-h-[92vh] overflow-y-auto">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold shadow-2xs">
              <Pencil size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Editar Nombre y Catálogo
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Actualiza el nombre oficial, código y categoría del producto.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Info Actual */}
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Producto #{producto.id_producto}</span>
            <span className="font-mono font-bold text-slate-700">Cód Actual: {producto.codigo || "S/C"}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Stock Actual</span>
            <span className="font-mono font-black text-emerald-700">{producto.stock_central || 0} unds</span>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center gap-2 font-bold">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Nombre del Producto */}
          <div className="space-y-1">
            <label className="text-slate-700 font-black text-xs flex items-center gap-1.5">
              <Pencil size={13} className="text-indigo-600" />
              Nombre del Producto *
            </label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value.toUpperCase())}
              placeholder="Ej: ACOPLE AZUL SC/APC"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-black text-slate-900 outline-none focus:bg-white transition-all uppercase"
            />
            <span className="text-[10px] text-slate-400 block">
              Este nombre se mostrará en despachos, compras, reportes y stock.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Categoría */}
            <div className="space-y-1">
              <label className="text-slate-700 font-extrabold text-xs flex items-center gap-1.5">
                <Tag size={13} className="text-indigo-600" />
                Categoría
              </label>
              <select
                value={idCategoria}
                onChange={(e) => setIdCategoria(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 text-xs cursor-pointer"
              >
                <option value="">-- Sin Categoría --</option>
                {categorias.map((cat) => (
                  <option key={cat.id_categoria} value={cat.id_categoria}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Código del Producto */}
            <div className="space-y-1">
              <label className="text-slate-700 font-extrabold text-xs flex items-center gap-1.5">
                <Hash size={13} className="text-slate-600" />
                Código / SKU
              </label>
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="Ej: MAT-ACO"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-slate-400 text-xs uppercase"
              />
            </div>

            {/* Stock Mínimo */}
            <div className="space-y-1">
              <label className="text-slate-700 font-extrabold text-xs flex items-center gap-1.5">
                <Layers size={13} className="text-slate-600" />
                Stock Mínimo (Alerta)
              </label>
              <input
                type="number"
                min="0"
                value={stockMinimo}
                onChange={(e) => setStockMinimo(Number(e.target.value) || 0)}
                placeholder="Ej: 5"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-slate-400 text-xs"
              />
            </div>

            {/* Estado */}
            <div className="space-y-1">
              <label className="text-slate-700 font-extrabold text-xs flex items-center gap-1.5">
                <Archive size={13} className="text-slate-600" />
                Estado
              </label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as "Activo" | "Inactivo")}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 text-xs cursor-pointer"
              >
                <option value="Activo">🟢 Activo</option>
                <option value="Inactivo">🔴 Inactivo</option>
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20"
            >
              {guardando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
