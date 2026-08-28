import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Truck,
  Package,
  QrCode,
  Plus,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Layers,
  ArrowRight,
  ShieldCheck,
  FileText,
  Filter,
  CheckSquare,
  Square,
  ChevronDown,
} from "lucide-react";
import { ProductoStock, DespachoPayload } from "../types/inventoryTypes";
import { despacharATecnico } from "../services/inventoryService";
import axios from "axios";
import { API_URL } from "../../../config/api";

interface Props {
  productos: ProductoStock[];
  onDespachoRealizado: () => void;
}

export const TechnicianDispatchTab: React.FC<Props> = ({ productos, onDespachoRealizado }) => {
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [idTrabajador, setIdTrabajador] = useState<string>("");
  const [guardando, setGuardando] = useState(false);

  // Obtener categorías únicas disponibles para despacho (excluyendo series)
  const categoriasDisponibles = useMemo(() => {
    const cats = new Set<string>();
    productos
      .filter((p) => !p.maneja_serie)
      .forEach((p) => {
        if (p.categoria) cats.add(p.categoria.trim().toUpperCase());
      });
    return Array.from(cats);
  }, [productos]);

  // 🏷️ Multi-Select de Categorías (Checkboxes estilo PowerBI)
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<string[]>([]);
  const [menuCategoriasAbierto, setMenuCategoriasAbierto] = useState(false);
  const menuCategoriasRef = useRef<HTMLDivElement>(null);

  // Cerrar el popup de checkboxes al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuCategoriasRef.current && !menuCategoriasRef.current.contains(e.target as Node)) {
        setMenuCategoriasAbierto(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleCategoria = (cat: string) => {
    setCategoriasSeleccionadas((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const seleccionarTodasCategorias = () => {
    if (categoriasSeleccionadas.length === categoriasDisponibles.length) {
      setCategoriasSeleccionadas([]);
    } else {
      setCategoriasSeleccionadas([...categoriasDisponibles]);
    }
  };

  // Productos filtrados según las categorías marcadas en los checkboxes
  const productosFiltrados = useMemo(() => {
    const sinSeries = productos.filter((p) => !p.maneja_serie);
    if (categoriasSeleccionadas.length === 0) return sinSeries;
    return sinSeries.filter((p) =>
      categoriasSeleccionadas.includes((p.categoria || "").trim().toUpperCase())
    );
  }, [productos, categoriasSeleccionadas]);

  // Categorías que se agruparán en el select
  const categoriasActivas = useMemo(() => {
    if (categoriasSeleccionadas.length === 0) return categoriasDisponibles;
    return categoriasDisponibles.filter((c) => categoriasSeleccionadas.includes(c));
  }, [categoriasDisponibles, categoriasSeleccionadas]);

  // Insumos a entregar (vuelve a la lista limpia y directa)
  const [items, setItems] = useState<{ id_producto: number; cantidad: number }[]>([
    {
      id_producto: productos.filter((p) => !p.maneja_serie)[0]?.id_producto || 1,
      cantidad: 20,
    },
  ]);

  // Series a entregar
  const [serieInput, setSerieInput] = useState("");
  const [seriesPistoleadas, setSeriesPistoleadas] = useState<string[]>([]);
  const [observaciones, setObservaciones] = useState("Dotación semanal de cuadrilla");

  // Asignación de Actas por Rango
  const [incluirActas, setIncluirActas] = useState(false);
  const [cantidadActas, setCantidadActas] = useState(50);
  const [prefijoActas, setPrefijoActas] = useState("001-");
  const [correlativoInicialActas, setCorrelativoInicialActas] = useState("04201");

  const prodActas = productos.find(
    (p) =>
      p.categoria?.toUpperCase().includes("TALONARIO") ||
      p.categoria?.toUpperCase().includes("ACTA") ||
      p.nombre?.toUpperCase().includes("ACTA")
  );

  useEffect(() => {
    axios
      .get(`${API_URL}/api/movilidad/tecnicos-flota`)
      .then((res) => {
        setTecnicos(res.data || []);
        if (res.data?.length > 0) {
          setIdTrabajador(String(res.data[0].id_trabajador));
        }
      })
      .catch(console.error);
  }, []);

  const handlePistolearSerie = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && serieInput.trim()) {
      e.preventDefault();
      const clean = serieInput.trim().toUpperCase();
      if (!seriesPistoleadas.includes(clean)) {
        setSeriesPistoleadas((prev) => [...prev, clean]);
        setSerieInput("");
      }
    }
  };

  const handleAddItem = () => {
    const primerProd = productosFiltrados[0] || productos.filter((p) => !p.maneja_serie)[0];
    setItems((prev) => [
      ...prev,
      {
        id_producto: primerProd?.id_producto || 1,
        cantidad: 10,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Cálculo del rango de actas
  const parseNumInicio = parseInt(correlativoInicialActas.replace(/\D/g, ""), 10) || 1;
  const padLength = Math.max(5, correlativoInicialActas.replace(/\D/g, "").length || 5);
  const parseNumFin = parseNumInicio + Math.max(1, cantidadActas) - 1;
  const numFinFormateado = String(parseNumFin).padStart(padLength, "0");
  const numInicioFormateado = String(parseNumInicio).padStart(padLength, "0");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idTrabajador) {
      alert("Selecciona un técnico conductor.");
      return;
    }

    try {
      setGuardando(true);

      const seriesFinales: { numero_serie: string; id_producto?: number }[] = seriesPistoleadas.map((s) => ({
        numero_serie: s,
      }));

      const itemsFinales = items.map((it) => ({
        id_producto: it.id_producto,
        cantidad: it.cantidad,
      }));

      // Si incluye talonario de actas, generar las series correlativas
      if (incluirActas && prodActas) {
        for (let i = parseNumInicio; i <= parseNumFin; i++) {
          const numStr = String(i).padStart(padLength, "0");
          seriesFinales.push({
            numero_serie: `${prefijoActas}${numStr}`,
            id_producto: prodActas.id_producto,
          });
        }
        itemsFinales.push({
          id_producto: prodActas.id_producto,
          cantidad: cantidadActas,
        });
      }

      const payload: DespachoPayload = {
        id_trabajador: Number(idTrabajador),
        items: itemsFinales,
        series_pistoleadas: seriesFinales,
        observaciones: incluirActas
          ? `${observaciones} + Talonario de ${cantidadActas} actas (${prefijoActas}${numInicioFormateado} al ${prefijoActas}${numFinFormateado})`
          : observaciones,
      };

      await despacharATecnico(payload);
      alert("✅ ¡Dotación asignada exitosamente al stock del vehículo del técnico!");
      onDespachoRealizado();

      // Resetear
      setSeriesPistoleadas([]);
      setIncluirActas(false);
      setItems([
        {
          id_producto: productos.filter((p) => !p.maneja_serie)[0]?.id_producto || 1,
          cantidad: 20,
        },
      ]);
    } catch (err: any) {
      alert("Error al despachar: " + (err.response?.data?.error || err.message));
    } finally {
      setGuardando(false);
    }
  };

  const tecActual = tecnicos.find((t) => String(t.id_trabajador) === idTrabajador);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
      
      {/* ─────────────────────────────────────────────────────────────
          1. SELECCIÓN DE TÉCNICO Y VEHÍCULO
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="font-black text-sm text-slate-900 flex items-center gap-2">
            <Truck size={18} className="text-cyan-600" />
            Despacho y Dotación a Vehículo de Cuadrilla
          </span>
          <span className="text-xs text-cyan-700 font-bold bg-cyan-50 px-3 py-1 rounded-xl">
            🚚 Transferencia Almacén Central → Stock Móvil
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Técnico Conductor / Cuadrilla *
            </label>
            <select
              value={idTrabajador}
              onChange={(e) => setIdTrabajador(e.target.value)}
              required
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs cursor-pointer focus:bg-white"
            >
              {tecnicos.map((t) => (
                <option key={t.id_trabajador} value={t.id_trabajador}>
                  {t.nombre_completo} - Cuadrilla: {t.cuadrilla || "S/C"} (Placa: {t.vehiculo_placa || "Sin auto"})
                </option>
              ))}
            </select>
          </div>

          <div className="bg-cyan-50/50 p-3 rounded-2xl border border-cyan-100">
            <span className="text-[10px] uppercase font-bold text-cyan-700 block">Vehículo Asignado</span>
            <span className="text-sm font-black text-cyan-950 font-mono">
              🚗 {tecActual?.vehiculo_placa || "Sin Vehículo"}
            </span>
          </div>

        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. MATERIALES CONSUMIBLES A ENTREGAR (FILTRADO MULTI-CATEGORÍA)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <span className="font-black text-sm text-slate-900 flex items-center gap-2">
              <Layers size={18} className="text-indigo-600" />
              Materiales e Insumos (Conectores, Cable, Rosetas, Uniformes, etc.)
            </span>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              {categoriasSeleccionadas.length === 0
                ? "Mostrando todas las categorías. Usa el filtro si deseas marcar categorías específicas."
                : `Filtrando por: ${categoriasSeleccionadas.join(", ")} (${productosFiltrados.length} disponibles)`}
            </p>
          </div>

          <div className="flex items-center gap-2 relative">
            
            {/* 📊 Menú Desplegable Multi-Selección con Checkboxes (Estilo PowerBI) */}
            <div className="relative" ref={menuCategoriasRef}>
              <button
                type="button"
                onClick={() => setMenuCategoriasAbierto((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                  categoriasSeleccionadas.length > 0
                    ? "bg-indigo-600 text-white border-indigo-700 shadow-md shadow-indigo-600/20"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
                title="Filtrar categorías con casillas de verificación"
              >
                <Filter size={13} />
                <span>
                  {categoriasSeleccionadas.length === 0
                    ? "🏷️ Filtrar Categorías"
                    : `🏷️ ${categoriasSeleccionadas.length} seleccionada${categoriasSeleccionadas.length > 1 ? "s" : ""}`}
                </span>
                <ChevronDown size={13} className={`transition-transform ${menuCategoriasAbierto ? "rotate-180" : ""}`} />
              </button>

              {/* Popover flotante con Checkboxes */}
              {menuCategoriasAbierto && (
                <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 w-64 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
                      Seleccionar Categorías
                    </span>
                    <button
                      type="button"
                      onClick={seleccionarTodasCategorias}
                      className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      {categoriasSeleccionadas.length === categoriasDisponibles.length
                        ? "Desmarcar todo"
                        : "Marcar todas"}
                    </button>
                  </div>

                  <div className="max-h-52 overflow-y-auto space-y-0.5 py-1">
                    {categoriasDisponibles.map((cat) => {
                      const isChecked = categoriasSeleccionadas.includes(cat);
                      const count = productos.filter(
                        (p) => !p.maneja_serie && (p.categoria || "").trim().toUpperCase() === cat
                      ).length;

                      return (
                        <label
                          key={cat}
                          onClick={() => toggleCategoria(cat)}
                          className="flex items-center justify-between p-2 rounded-xl hover:bg-indigo-50/60 cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center gap-2">
                            {isChecked ? (
                              <CheckSquare size={16} className="text-indigo-600 shrink-0" />
                            ) : (
                              <Square size={16} className="text-slate-300 shrink-0" />
                            )}
                            <span className={`text-xs font-bold ${isChecked ? "text-indigo-950 font-black" : "text-slate-700"}`}>
                              {cat}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded-md">
                            {count}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {categoriasSeleccionadas.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-medium">
                        {productosFiltrados.length} productos listados
                      </span>
                      <button
                        type="button"
                        onClick={() => setCategoriasSeleccionadas([])}
                        className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        Mostrar todos
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Botón Agregar Insumo */}
            <button
              type="button"
              onClick={handleAddItem}
              className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Plus size={14} />
              Agregar Insumo
            </button>

          </div>
        </div>

        {/* Lista de Insumos (Limpia y Rápida) */}
        <div className="space-y-3">
          {items.map((it, idx) => {
            const prodActual = productos.find((p) => p.id_producto === it.id_producto);

            return (
              <div
                key={idx}
                className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 hover:border-indigo-200 transition-colors shadow-2xs"
              >
                {/* 1. Selector de Producto Completo */}
                <div className="flex-1 min-w-0">
                  <select
                    value={it.id_producto}
                    onChange={(e) => {
                      const prodId = Number(e.target.value);
                      setItems((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, id_producto: prodId } : item))
                      );
                    }}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs cursor-pointer focus:border-indigo-500 text-slate-800"
                  >
                    {categoriasActivas.map((cat) => {
                      const prodsCat = productosFiltrados.filter(
                        (p) => (p.categoria || "").trim().toUpperCase() === cat
                      );
                      if (prodsCat.length === 0) return null;
                      return (
                        <optgroup key={cat} label={`─── 🏷️ ${cat} ───`}>
                          {prodsCat.map((p) => (
                            <option key={p.id_producto} value={p.id_producto}>
                              {p.nombre} (Stock Central: {p.stock_central} {p.unidad || (p.es_drop ? "m" : "und")})
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>

                {/* 2. Cantidad */}
                <div className="w-28 sm:w-32 flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min="1"
                    value={it.cantidad}
                    onChange={(e) => {
                      const cant = Number(e.target.value) || 1;
                      setItems((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, cantidad: cant } : item))
                      );
                    }}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-mono font-bold text-xs text-center focus:border-indigo-500"
                  />
                  <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0 min-w-8">
                    {prodActual?.unidad || (prodActual?.es_drop ? "m" : "und")}
                  </span>
                </div>

                {/* 3. Botón Eliminar */}
                <button
                  type="button"
                  onClick={() => handleRemoveItem(idx)}
                  className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer shrink-0"
                  title="Quitar insumo"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. ASIGNACIÓN DE ACTAS / GUÍAS POR RANGO CORRELATIVO
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="font-black text-sm text-slate-900 flex items-center gap-2">
              <FileText size={18} className="text-amber-600" />
              Talonario de Actas / Guías de Servicio Técnico
            </span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={incluirActas}
              onChange={(e) => setIncluirActas(e.target.checked)}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
            <span className="text-xs font-bold text-amber-950">
              Asignar Talonario a este técnico
            </span>
          </label>
        </div>

        {incluirActas && (
          <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 space-y-3 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Cantidad de Actas:</label>
                <input
                  type="number"
                  min="1"
                  value={cantidadActas}
                  onChange={(e) => setCantidadActas(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full p-2 bg-white border border-amber-300 rounded-xl font-mono font-bold text-xs text-center"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Prefijo:</label>
                <input
                  type="text"
                  value={prefijoActas}
                  onChange={(e) => setPrefijoActas(e.target.value)}
                  placeholder="001-"
                  className="w-full p-2 bg-white border border-amber-300 rounded-xl font-mono font-bold text-xs text-center"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Número Inicial:</label>
                <input
                  type="text"
                  value={correlativoInicialActas}
                  onChange={(e) => setCorrelativoInicialActas(e.target.value.replace(/\D/g, ""))}
                  placeholder="04201"
                  className="w-full p-2 bg-white border border-amber-300 rounded-xl font-mono font-bold text-xs text-center"
                />
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-amber-200 flex items-center justify-between text-xs font-mono text-amber-950">
              <span>
                Rango correlativo: <strong>{prefijoActas}{numInicioFormateado}</strong> al <strong>{prefijoActas}{numFinFormateado}</strong>
              </span>
              <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md">
                ✓ {cantidadActas} actas registradas
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. EQUIPOS SERIALIZADOS (PISTOLEO ONT / MESH)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="font-black text-sm text-slate-900 flex items-center gap-2">
            <QrCode size={18} className="text-purple-600" />
            Pistoleo de Equipos Serializados (ONT / Mesh)
          </span>
          <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-xl">
            {seriesPistoleadas.length} equipos listos para asignar
          </span>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Pistolear código de barras / serie del equipo y presionar ENTER..."
            value={serieInput}
            onChange={(e) => setSerieInput(e.target.value)}
            onKeyDown={handlePistolearSerie}
            className="flex-1 p-2.5 bg-purple-50/40 border border-purple-200 rounded-xl text-xs font-mono font-bold focus:bg-white text-purple-900"
          />
        </div>

        {seriesPistoleadas.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
            {seriesPistoleadas.map((s, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-purple-200 text-purple-900 rounded-xl font-mono text-xs font-bold shadow-2xs"
              >
                <QrCode size={12} />
                {s}
                <button
                  type="button"
                  onClick={() => setSeriesPistoleadas((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-slate-400 hover:text-rose-600 ml-1 cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          BOTÓN DE CONFIRMACIÓN DE ENTREGA
      ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={guardando}
          className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-black rounded-2xl shadow-lg shadow-cyan-600/25 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
        >
          {guardando ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              Despachando...
            </>
          ) : (
            <>
              <CheckCircle2 size={18} />
              Confirmar Despacho a Técnico
            </>
          )}
        </button>
      </div>

    </form>
  );
};

