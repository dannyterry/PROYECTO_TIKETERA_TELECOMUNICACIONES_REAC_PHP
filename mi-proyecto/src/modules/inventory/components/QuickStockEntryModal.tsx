import React, { useState, useEffect } from "react";
import {
  X,
  PackagePlus,
  Layers,
  MapPin,
  CheckCircle2,
  FileText,
  Sparkles,
  DollarSign,
  AlertCircle,
  Plus,
} from "lucide-react";
import { ProductoStock, CompraPayload } from "../types/inventoryTypes";
import { registrarCompra } from "../services/inventoryService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  producto: ProductoStock | null;
  onStockIngresado: () => void;
}

const STAND_OPTIONS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const FILA_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const QuickStockEntryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  producto,
  onStockIngresado,
}) => {
  const [cantidad, setCantidad] = useState<number>(50);
  const [precioUnitario, setPrecioUnitario] = useState<string>("");
  const [numeroNia, setNumeroNia] = useState<string>("");
  const [stand, setStand] = useState<string>("");
  const [fila, setFila] = useState<string>("");
  const [observaciones, setObservaciones] = useState<string>("Ingreso directo a almacén central");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inicializar formulario al abrir con el producto
  useEffect(() => {
    if (isOpen && producto) {
      const hoy = new Date();
      const year = hoy.getFullYear();
      const correlativo = String(Date.now()).slice(-5);
      setNumeroNia(`NIA-${year}-${correlativo}`);

      setCantidad(50);
      setPrecioUnitario(
        producto.precio_compra !== undefined && producto.precio_compra !== null
          ? String(producto.precio_compra)
          : ""
      );
      setStand(producto.stand || "");
      setFila(producto.fila ? String(producto.fila) : "");
      setObservaciones("Ingreso directo a almacén central");
      setError(null);
    }
  }, [isOpen, producto]);

  if (!isOpen || !producto) return null;

  const handlePrecioChange = (val: string) => {
    // Permitir vacío o números con hasta un punto decimal (ej: 2.5, 0.80)
    const sanitized = val.replace(/,/g, ".");
    if (sanitized === "" || /^\d*\.?\d*$/.test(sanitized)) {
      setPrecioUnitario(sanitized);
    }
  };

  const sumarCantidad = (sum: number) => {
    setCantidad((prev) => Math.max(1, (Number(prev) || 0) + sum));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!producto) return;

    if (!cantidad || Number(cantidad) <= 0) {
      setError("La cantidad a ingresar debe ser mayor a 0.");
      return;
    }

    try {
      setGuardando(true);
      setError(null);

      const numCompFinal = numeroNia.trim() || `NIA-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
      const numPrecio = precioUnitario.trim() === "" ? 0 : Number(precioUnitario) || 0;

      const payload: CompraPayload = {
        id_proveedor: null,
        razon_social_proveedor: "INGRESO INTERNO / NOTA DE INGRESO (NIA)",
        tipo_comprobante: "Nota de Ingreso (NIA)",
        numero_comprobante: numCompFinal,
        fecha: new Date().toISOString().slice(0, 10),
        items: [
          {
            id_producto: producto.id_producto,
            cantidad: Number(cantidad),
            precio: numPrecio,
            series: [],
            stand: stand.trim() || undefined,
            fila: fila.trim() ? Number(fila) : undefined,
          },
        ],
        observaciones: observaciones.trim() || undefined,
      };

      await registrarCompra(payload);
      alert(
        `✅ ¡Ingreso rápido registrado con éxito!\n\nSe sumaron ${cantidad} unidades de "${producto.nombre}" al Almacén Central.\nComprobante: ${numCompFinal}`
      );
      onStockIngresado();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Error al procesar el ingreso de stock";
      setError(msg);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 md:p-6 animate-fade-in">
      <div className="bg-white rounded-3xl p-5 md:p-6 max-w-xl w-full shadow-2xl border border-slate-100 space-y-5 max-h-[92vh] overflow-y-auto">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shadow-2xs">
              <PackagePlus size={22} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                Ingreso Rápido de Stock
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Sin Comprobante / NIA
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Suma directa al inventario central sin exigir proveedor fiscal.
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

        {/* Tarjeta del Producto Seleccionado */}
        <div className="p-4 bg-gradient-to-br from-slate-50 to-emerald-50/40 rounded-2xl border border-emerald-100/80 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md inline-block mb-1">
              {producto.categoria || "MATERIALES"}
            </span>
            <h4 className="text-sm font-black text-slate-900 truncate" title={producto.nombre}>
              {producto.nombre}
            </h4>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
              <span>Cód: {producto.codigo || "S/C"}</span>
              {producto.stand && (
                <>
                  <span>•</span>
                  <span>Ubicación: Stand {producto.stand} {producto.fila ? `- Fila ${producto.fila}` : ""}</span>
                </>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Stock Central Actual</span>
            <span className="text-base font-black font-mono text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-xl inline-block mt-0.5 border border-emerald-200">
              {Number(producto.stock_central || 0)} unds
            </span>
          </div>
        </div>

        {/* Formulario de Entrada */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center gap-2 font-bold text-xs">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Cantidad a Ingresar */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-slate-700 font-black flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <Layers size={14} className="text-emerald-600" />
                  Cantidad a Ingresar *
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  Nuevo stock total: {Number(producto.stock_central || 0) + (Number(cantidad) || 0)} unds
                </span>
              </label>
              
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={cantidad || ""}
                  onChange={(e) => setCantidad(Number(e.target.value) || 0)}
                  placeholder="Ej: 50"
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border-2 border-emerald-200 focus:border-emerald-500 rounded-xl text-base font-mono font-black text-slate-900 outline-none focus:bg-white transition-all"
                />
                
                {/* Botones de incremento rápido */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => sumarCantidad(10)}
                    className="px-2.5 py-2.5 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 font-black text-xs rounded-xl transition-all cursor-pointer border border-slate-200"
                    title="Sumar 10 unidades"
                  >
                    +10
                  </button>
                  <button
                    type="button"
                    onClick={() => sumarCantidad(50)}
                    className="px-2.5 py-2.5 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 font-black text-xs rounded-xl transition-all cursor-pointer border border-slate-200"
                    title="Sumar 50 unidades"
                  >
                    +50
                  </button>
                  <button
                    type="button"
                    onClick={() => sumarCantidad(100)}
                    className="px-2.5 py-2.5 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 font-black text-xs rounded-xl transition-all cursor-pointer border border-slate-200"
                    title="Sumar 100 unidades"
                  >
                    +100
                  </button>
                </div>
              </div>
            </div>

            {/* Número de Nota de Ingreso (Automático) */}
            <div className="space-y-1">
              <label className="text-slate-700 font-extrabold flex items-center gap-1.5 text-xs">
                <FileText size={13} className="text-indigo-600" />
                N° Nota de Ingreso (NIA)
              </label>
              <input
                type="text"
                value={numeroNia}
                onChange={(e) => setNumeroNia(e.target.value.toUpperCase())}
                placeholder="NIA-2026-XXXXX"
                className="w-full px-3 py-2 bg-indigo-50/50 border border-indigo-200 rounded-xl font-mono font-bold text-indigo-950 outline-none focus:bg-white focus:border-indigo-500 text-xs"
              />
              <span className="text-[10px] text-slate-400 block">Generado automáticamente por el sistema</span>
            </div>

            {/* Costo / Precio Unitario (Decimal) */}
            <div className="space-y-1">
              <label className="text-slate-700 font-extrabold flex items-center gap-1.5 text-xs">
                <DollarSign size={13} className="text-emerald-600" />
                Costo Unitario (S/ - Opcional)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={precioUnitario}
                onChange={(e) => handlePrecioChange(e.target.value)}
                placeholder="Ej: 2.50 ó 0.80"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-emerald-500 text-xs"
              />
              <span className="text-[10px] text-slate-400 block">Acepta decimales (ej: 2.5)</span>
            </div>

            {/* Stand & Fila Desplegables Rápidos */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-slate-700 font-extrabold flex items-center gap-1.5 text-xs">
                  <MapPin size={13} className="text-emerald-600" />
                  Stand / Módulo
                </label>
                {stand && (
                  <span className="text-[10px] font-black font-mono text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                    Stand {stand}
                  </span>
                )}
              </div>
              <select
                value={stand}
                onChange={(e) => setStand(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-800 outline-none focus:bg-white focus:border-emerald-500 text-xs cursor-pointer transition-all"
              >
                <option value="">-- Seleccionar Stand (Opcional) --</option>
                {STAND_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    Stand {st}
                  </option>
                ))}
                {stand && !STAND_OPTIONS.includes(stand) && (
                  <option value={stand}>Stand {stand} (Actual)</option>
                )}
              </select>
              {/* Botones de 1 clic para Stands frecuentes */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {STAND_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStand(s)}
                    className={`px-2 py-0.5 text-[10px] font-black rounded-lg transition-all cursor-pointer border ${
                      stand === s
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                        : "bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border-slate-200"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-slate-700 font-extrabold flex items-center gap-1.5 text-xs">
                  <MapPin size={13} className="text-emerald-600" />
                  Fila / Nivel
                </label>
                {fila && (
                  <span className="text-[10px] font-black font-mono text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                    Fila {fila}
                  </span>
                )}
              </div>
              <select
                value={fila}
                onChange={(e) => setFila(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-800 outline-none focus:bg-white focus:border-emerald-500 text-xs cursor-pointer transition-all"
              >
                <option value="">-- Seleccionar Fila (Opcional) --</option>
                {FILA_OPTIONS.map((fl) => (
                  <option key={fl} value={fl}>
                    Fila {fl}
                  </option>
                ))}
                {fila && !FILA_OPTIONS.includes(Number(fila)) && (
                  <option value={fila}>Fila {fila} (Actual)</option>
                )}
              </select>
              {/* Botones de 1 clic para Filas frecuentes */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {FILA_OPTIONS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFila(String(f))}
                    className={`px-2 py-0.5 text-[10px] font-black rounded-lg transition-all cursor-pointer border ${
                      String(fila) === String(f)
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                        : "bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border-slate-200"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Observaciones */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-slate-700 font-extrabold text-xs">
                Motivo u Observación (Opcional)
              </label>
              <input
                type="text"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Ej: Ingreso directo de stock sobrante / reposición sin factura"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 outline-none focus:bg-white focus:border-slate-400 text-xs"
              />
            </div>
          </div>

          {/* Footer Botones */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-extrabold text-xs transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md"
            >
              {guardando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Registrar Ingreso</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
