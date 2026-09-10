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
  AlertTriangle,
  Barcode,
  Search,
  X,
} from "lucide-react";
import { ProductoStock, DespachoPayload, EquipoDespachoPistoleado } from "../types/inventoryTypes";
import { despacharATecnico, verificarSerieDespacho } from "../services/inventoryService";
import axios from "axios";
import { API_URL } from "../../../config/api";

interface Props {
  productos: ProductoStock[];
  onDespachoRealizado: () => void;
}

export const TechnicianDispatchTab: React.FC<Props> = ({ productos, onDespachoRealizado }) => {
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [idTrabajador, setIdTrabajador] = useState<string>("");
  const [busquedaTecnico, setBusquedaTecnico] = useState("");
  const [guardando, setGuardando] = useState(false);

  const tecnicosFiltrados = useMemo(() => {
    if (!busquedaTecnico.trim()) return tecnicos;
    const q = busquedaTecnico.toLowerCase();
    return tecnicos.filter(
      (t) =>
        (t.nombre_completo || "").toLowerCase().includes(q) ||
        (t.cuadrilla || "").toLowerCase().includes(q) ||
        (t.vehiculo_placa || "").toLowerCase().includes(q)
    );
  }, [tecnicos, busquedaTecnico]);

  // Helper para identificar materiales e insumos (excluyendo estrictamente EQUIPOS y productos con número de serie)
  const esMaterialOInsumo = (p: ProductoStock) => {
    const cat = (p.categoria || "").trim().toUpperCase();
    const manejaSerie = Boolean(p.maneja_serie);
    return !manejaSerie && cat !== "EQUIPOS" && cat !== "EQUIPO";
  };

  // Helper para normalizar y limpiar texto en búsquedas
  const cleanStr = (s: string) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  // Helper para ordenar productos por relevancia en búsquedas
  const rankProductos = <T extends { nombre: string; codigo?: string; categoria?: string; proid?: string }>(
    lista: T[],
    query: string,
    catActual?: string
  ): T[] => {
    const q = cleanStr(query);
    if (!q) return lista;

    return [...lista]
      .filter((p) => {
        const n = cleanStr(p.nombre);
        const c = cleanStr(p.codigo || "");
        const pr = cleanStr(p.proid || "");
        return n.includes(q) || c.includes(q) || pr.includes(q);
      })
      .sort((a, b) => {
        const na = cleanStr(a.nombre);
        const nb = cleanStr(b.nombre);
        const ca = cleanStr(a.codigo || "");
        const cb = cleanStr(b.codigo || "");

        // 1. Coincidencia exacta de nombre o código (ej: "DROP" === "drop") -> MÁXIMA PRIORIDAD
        const exactA = na === q || ca === q;
        const exactB = nb === q || cb === q;
        if (exactA && !exactB) return -1;
        if (!exactA && exactB) return 1;

        // 2. Coincidencia exacta de palabra completa (ej: "DROP" en "CABLE DROP")
        const wordsA = na.split(/\s+/);
        const wordsB = nb.split(/\s+/);
        const wordA = wordsA.includes(q);
        const wordB = wordsB.includes(q);
        if (wordA && !wordB) return -1;
        if (!wordA && wordB) return 1;

        // 3. Empieza con la búsqueda (ej: "DROP FIBRA" antes de "PORTA DROP")
        const startsA = na.startsWith(q) || ca.startsWith(q);
        const startsB = nb.startsWith(q) || cb.startsWith(q);
        if (startsA && !startsB) return -1;
        if (!startsA && startsB) return 1;

        // 4. Si pertenece a la categoría actual de la fila
        if (catActual && catActual !== "TODAS") {
          const catA = (a.categoria || "").trim().toUpperCase() === catActual.toUpperCase();
          const catB = (b.categoria || "").trim().toUpperCase() === catActual.toUpperCase();
          if (catA && !catB) return -1;
          if (!catA && catB) return 1;
        }

        // 5. Orden alfabético
        return na.localeCompare(nb);
      });
  };

  // Catálogo base de Materiales e Insumos disponibles (sin equipos)
  const materialesDisponibles = useMemo(() => {
    return productos.filter(esMaterialOInsumo);
  }, [productos]);

  // Obtener categorías únicas de materiales/insumos (sin EQUIPOS)
  const categoriasDisponibles = useMemo(() => {
    const cats = new Set<string>();
    materialesDisponibles.forEach((p) => {
      if (p.categoria) cats.add(p.categoria.trim().toUpperCase());
    });
    return Array.from(cats);
  }, [materialesDisponibles]);

  // 🔒 Filtro: Solo productos con stock disponible en Almacén Central (activado por defecto)
  const [soloConStock, setSoloConStock] = useState<boolean>(true);

  // 📌 Última categoría usada para que al agregar otro insumo se quede en la misma categoría
  const [ultimaCategoria, setUltimaCategoria] = useState<string>("TODAS");

  // Insumos a entregar (con categoría y filtro por fila)
  const [items, setItems] = useState<{
    id_producto: number;
    cantidad: number;
    categoriaFila?: string;
    busquedaMaterial?: string;
  }[]>([
    {
      id_producto: 0,
      cantidad: 10,
      categoriaFila: "TODAS",
      busquedaMaterial: "",
    },
  ]);

  // Sincronizar el primer insumo con un producto que tenga stock disponible al cargar
  useEffect(() => {
    if (materialesDisponibles.length > 0) {
      setItems((prev) => {
        if (prev.length === 0) return prev;
        const currentId = prev[0].id_producto;
        const currentProd = materialesDisponibles.find((p) => p.id_producto === currentId);

        // Si el producto actual no tiene stock (> 0) o no existe, reemplazarlo por uno con stock real
        if (!currentProd || (currentProd.stock_central || 0) <= 0) {
          const prodConStock =
            materialesDisponibles.find((p) => (p.stock_central || 0) > 0) ||
            materialesDisponibles[0];
          if (prodConStock && prodConStock.id_producto !== currentId) {
            const cat = prodConStock.categoria ? prodConStock.categoria.toUpperCase() : "TODAS";
            setUltimaCategoria(cat);
            return [
              {
                id_producto: prodConStock.id_producto,
                cantidad: Math.min(10, Math.max(1, prodConStock.stock_central || 10)),
                categoriaFila: cat,
                busquedaMaterial: "",
              },
              ...prev.slice(1),
            ];
          }
        }
        return prev;
      });
    }
  }, [materialesDisponibles]);

  // Series a entregar
  const [serieInput, setSerieInput] = useState("");
  const [seriesPistoleadas, setSeriesPistoleadas] = useState<EquipoDespachoPistoleado[]>([]);
  const [verificandoSerie, setVerificandoSerie] = useState(false);
  const [errorPistoleo, setErrorPistoleo] = useState<string | null>(null);
  const [exitoPistoleo, setExitoPistoleo] = useState<string | null>(null);
  const serieInputRef = useRef<HTMLInputElement>(null);
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

  const handlePistolearSerie = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && serieInput.trim()) {
      e.preventDefault();
      const clean = serieInput.trim().toUpperCase();
      setErrorPistoleo(null);
      setExitoPistoleo(null);

      // Verificar si ya fue escaneada en esta misma sesión
      if (seriesPistoleadas.some((s) => s.numero_serie === clean || s.codigo_serie === clean || s.proid === clean)) {
        setErrorPistoleo(`⚠️ La serie o código "${clean}" ya fue agregada a este despacho.`);
        setSerieInput("");
        return;
      }

      try {
        setVerificandoSerie(true);
        const res = await verificarSerieDespacho(clean);

        if (res.disponible && res.equipo) {
          const eq = res.equipo;
          // Doble verificación para evitar duplicados por ID de serie o SN
          if (seriesPistoleadas.some((s) => s.id_producto_serie === eq.id_producto_serie || s.numero_serie === eq.numero_serie)) {
            setErrorPistoleo(`⚠️ El equipo "${eq.producto_nombre}" (Serie: ${eq.numero_serie}) ya está en la lista.`);
            setSerieInput("");
            return;
          }

          setSeriesPistoleadas((prev) => [
            {
              id_producto_serie: eq.id_producto_serie,
              id_producto: eq.id_producto,
              numero_serie: eq.numero_serie,
              codigo_serie: eq.codigo_serie,
              proid: eq.proid,
              producto_nombre: eq.producto_nombre,
              categoria: eq.categoria,
            },
            ...prev,
          ]);

          setExitoPistoleo(`✅ Agregado: ${eq.producto_nombre} (S/N: ${eq.numero_serie})`);
          setSerieInput("");
        } else {
          setErrorPistoleo(res.error || `⛔ La serie "${clean}" no está disponible en Almacén Central.`);
          setSerieInput("");
        }
      } catch (err: any) {
        const msg = err.response?.data?.error || err.message || `⛔ Error al verificar la serie "${clean}".`;
        setErrorPistoleo(msg);
        setSerieInput("");
      } finally {
        setVerificandoSerie(false);
        setTimeout(() => serieInputRef.current?.focus(), 50);
      }
    }
  };

  // Agregar nuevo insumo respetando la última categoría usada y soloConStock
  const handleAddItem = (catSugerida?: unknown) => {
    const cat =
      typeof catSugerida === "string" && catSugerida.trim()
        ? catSugerida
        : (ultimaCategoria && ultimaCategoria !== "TODAS"
            ? ultimaCategoria
            : "TODAS");

    let prods =
      cat === "TODAS"
        ? materialesDisponibles
        : materialesDisponibles.filter((p) => (p.categoria || "").trim().toUpperCase() === cat);

    if (soloConStock) {
      const conStock = prods.filter((p) => (p.stock_central || 0) > 0);
      if (conStock.length > 0) prods = conStock;
    }

    const primerProd =
      prods.find((p) => (p.stock_central || 0) > 0) ||
      prods[0] ||
      materialesDisponibles.find((p) => (p.stock_central || 0) > 0) ||
      materialesDisponibles[0];

    const catDef = primerProd?.categoria ? primerProd.categoria.trim().toUpperCase() : cat;
    setUltimaCategoria(catDef);

    setItems((prev) => [
      ...prev,
      {
        id_producto: primerProd?.id_producto || 1,
        cantidad: Math.min(10, Math.max(1, primerProd?.stock_central || 10)),
        categoriaFila: catDef,
        busquedaMaterial: "",
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Buscador predictivo en cada fila: busca en todos los materiales con algoritmo de ranking
  // Si encuentra coincidencia (ej: "drop" -> DROP en vez de PORTA DROP), prioriza coincidencia exacta y cambia automáticamente la categoría y producto
  const handleBusquedaMaterialChange = (idx: number, txt: string) => {
    const q = cleanStr(txt);

    if (q.length >= 1) {
      let matches = rankProductos(materialesDisponibles, q, items[idx]?.categoriaFila);
      if (soloConStock) {
        const conStock = matches.filter((p) => (Number(p.stock_central) || 0) > 0);
        if (conStock.length > 0) matches = conStock;
      }

      if (matches.length > 0) {
        const mejorMatch = matches[0];
        const catEncontrada = (mejorMatch.categoria || "MATERIALES").trim().toUpperCase();

        // 1. Persistir la categoría para siguientes insumos
        setUltimaCategoria(catEncontrada);

        // 2. Actualizar la fila: cambiar categoría a la del producto y seleccionarlo
        setItems((prev) =>
          prev.map((item, i) =>
            i === idx
              ? {
                  ...item,
                  busquedaMaterial: txt,
                  categoriaFila: catEncontrada,
                  id_producto: mejorMatch.id_producto,
                  cantidad: Math.min(item.cantidad || 10, Math.max(1, Number(mejorMatch.stock_central) || 10)),
                }
              : item
          )
        );
        return;
      }
    }

    // Actualizar solo el texto si no hubo match
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, busquedaMaterial: txt } : item))
    );
  };

  // Cambio manual de categoría en la fila
  const handleCambiarCategoriaFila = (idx: number, nuevaCat: string) => {
    setUltimaCategoria(nuevaCat);

    let prodsDeCat =
      nuevaCat === "TODAS"
        ? materialesDisponibles
        : materialesDisponibles.filter(
            (p) => (p.categoria || "").trim().toUpperCase() === nuevaCat
          );

    if (soloConStock) {
      const conStock = prodsDeCat.filter((p) => (p.stock_central || 0) > 0);
      if (conStock.length > 0) prodsDeCat = conStock;
    }

    const primerProd = prodsDeCat[0] || materialesDisponibles[0];
    const nuevoId = primerProd ? primerProd.id_producto : 1;

    setItems((prev) =>
      prev.map((item, i) =>
        i === idx
          ? {
              ...item,
              categoriaFila: nuevaCat,
              id_producto: nuevoId,
              busquedaMaterial: "",
              cantidad: Math.min(item.cantidad || 10, Math.max(1, primerProd?.stock_central || 10)),
            }
          : item
      )
    );
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

    // ─────────────────────────────────────────────────────────────
    // VALIDACIÓN ESTRICTA DE STOCK ANTES DE DESPACHAR
    // ─────────────────────────────────────────────────────────────
    for (const it of items) {
      const prod = productos.find((p) => p.id_producto === it.id_producto);
      if (!prod) continue;
      const stockDisp = Number(prod.stock_central) || 0;

      if (stockDisp <= 0) {
        alert(
          `⛔ NO HAY STOCK DISPONIBLE:\n\nEl producto "${prod.nombre}" no tiene stock en Almacén Central (Stock: 0 ${prod.unidad || "und"}).\n\nNo es posible realizar el despacho. Por favor seleccione un material disponible con stock o elimine la fila antes de continuar.`
        );
        return;
      }

      if (it.cantidad > stockDisp) {
        alert(
          `⛔ STOCK INSUFICIENTE:\n\nPara el producto "${prod.nombre}":\n• Stock disponible en Almacén Central: ${stockDisp} ${prod.unidad || "und"}\n• Cantidad solicitada: ${it.cantidad} ${prod.unidad || "und"}\n\nPor favor reduzca la cantidad a máximo ${stockDisp} antes de continuar.`
        );
        return;
      }
    }

    try {
      setGuardando(true);

      const seriesFinales: { numero_serie: string; id_producto?: number; es_talonario?: boolean }[] = seriesPistoleadas.map((s) => ({
        numero_serie: s.numero_serie,
        id_producto: s.id_producto,
        es_talonario: false,
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
            es_talonario: true,
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
      const primerConStock =
        materialesDisponibles.find((p) => (p.stock_central || 0) > 0) ||
        materialesDisponibles[0];
      setItems([
        {
          id_producto: primerConStock?.id_producto || 1,
          cantidad: Math.min(10, Math.max(1, primerConStock?.stock_central || 10)),
          categoriaFila: primerConStock?.categoria ? primerConStock.categoria.toUpperCase() : "TODAS",
          busquedaMaterial: "",
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
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        // Evitar que presionar ENTER en campos de texto (búsquedas, cantidades, etc.) despache accidentalmente
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
          const inputEl = e.target as HTMLInputElement;
          if (inputEl !== serieInputRef.current) {
            e.preventDefault();
          }
        }
      }}
      className="space-y-6 animate-fade-in"
    >
      
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
          
          <div className="sm:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                Técnico Conductor / Cuadrilla *
              </label>
              <span className="text-[10px] text-slate-400 font-bold">
                {tecnicosFiltrados.length} disponibles
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              {/* Buscador reactivo de técnico */}
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={busquedaTecnico}
                  onChange={(e) => {
                    const txt = e.target.value;
                    setBusquedaTecnico(txt);
                    if (txt.trim()) {
                      const match = tecnicos.find((t) =>
                        (t.nombre_completo || "").toLowerCase().includes(txt.toLowerCase()) ||
                        (t.cuadrilla || "").toLowerCase().includes(txt.toLowerCase()) ||
                        (t.vehiculo_placa || "").toLowerCase().includes(txt.toLowerCase())
                      );
                      if (match) setIdTrabajador(String(match.id_trabajador));
                    }
                  }}
                  placeholder="🔍 Escribe para buscar técnico (nombre, cuadrilla, placa)..."
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-500 outline-none transition-all placeholder-slate-400"
                />
                {busquedaTecnico && (
                  <button
                    type="button"
                    onClick={() => setBusquedaTecnico("")}
                    className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Selector desplegable de técnico */}
              <div className="flex-1">
                <select
                  value={idTrabajador}
                  onChange={(e) => setIdTrabajador(e.target.value)}
                  required
                  className="w-full p-2.5 bg-indigo-50/50 border border-indigo-200 rounded-xl font-black text-xs cursor-pointer text-indigo-950 focus:bg-white focus:border-indigo-500 transition-all"
                >
                  {tecnicosFiltrados.length === 0 ? (
                    <option value="">No hay técnicos con "{busquedaTecnico}"</option>
                  ) : (
                    tecnicosFiltrados.map((t) => (
                      <option key={t.id_trabajador} value={t.id_trabajador}>
                        {t.nombre_completo} - Cuadrilla: {t.cuadrilla || "S/C"} (Placa: {t.vehiculo_placa || "Sin auto"})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
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
              Agrega los materiales a entregar. Puedes buscar por nombre o cambiar de categoría directamente en cada fila.
            </p>
          </div>

          <div className="flex items-center gap-2">
            
            {/* 🔒 Botón Switch: Solo productos con Stock Disponible */}
            <button
              type="button"
              onClick={() => setSoloConStock((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                soloConStock
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-2xs"
                  : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
              }`}
              title="Filtrar para ver solo productos con stock disponible en Almacén Central"
            >
              <ShieldCheck size={14} className={soloConStock ? "text-emerald-600" : "text-slate-400"} />
              <span>{soloConStock ? "✓ Solo con Stock Disp." : "Todos los Insumos"}</span>
            </button>

            {/* Botón Agregar Insumo */}
            <button
              type="button"
              onClick={() => handleAddItem()}
              className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Plus size={14} />
              Agregar Insumo
            </button>

          </div>
        </div>

        {/* Lista de Insumos (Con Categoría y Buscador por Fila) */}
        <div className="space-y-3">
          {items.map((it, idx) => {
            const prodActual =
              materialesDisponibles.find((p) => p.id_producto === it.id_producto) ||
              productos.find((p) => p.id_producto === it.id_producto);
            const rawCat = typeof it.categoriaFila === "string" ? it.categoriaFila : "TODAS";
            const catFila = rawCat.toUpperCase();
            const qFila = typeof it.busquedaMaterial === "string" ? it.busquedaMaterial.trim().toLowerCase() : "";

            // Filtrar productos para esta fila específica (siempre excluyendo EQUIPOS)
            let prodsDeFila: ProductoStock[] = [];
            if (qFila && qFila.length >= 1) {
              prodsDeFila = rankProductos(materialesDisponibles, qFila, catFila);
              if (soloConStock) {
                prodsDeFila = prodsDeFila.filter((p) => (Number(p.stock_central) || 0) > 0);
              }
            } else {
              prodsDeFila =
                catFila === "TODAS"
                  ? materialesDisponibles
                  : materialesDisponibles.filter(
                      (p) => (p.categoria || "").trim().toUpperCase() === catFila
                    );
              if (soloConStock) {
                prodsDeFila = prodsDeFila.filter((p) => (Number(p.stock_central) || 0) > 0);
              }
            }
            // Asegurar que el producto seleccionado actualmente aparezca en la lista
            if (prodActual && !prodsDeFila.some((p) => p.id_producto === prodActual.id_producto)) {
              prodsDeFila = [prodActual, ...prodsDeFila];
            }

            const sinStock = (Number(prodActual?.stock_central) || 0) <= 0;
            const excedeStock = !sinStock && it.cantidad > (Number(prodActual?.stock_central) || 0);

            return (
              <div
                key={idx}
                className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-3 rounded-2xl border transition-colors shadow-2xs ${
                  sinStock
                    ? "bg-rose-50/60 border-rose-200 hover:border-rose-300"
                    : excedeStock
                    ? "bg-amber-50/60 border-amber-200 hover:border-amber-300"
                    : "bg-slate-50 border-slate-200 hover:border-indigo-200"
                }`}
              >
                {/* 1. Categoría de la Fila */}
                <div className="w-full sm:w-44 shrink-0">
                  <select
                    value={it.categoriaFila || "TODAS"}
                    onChange={(e) => handleCambiarCategoriaFila(idx, e.target.value)}
                    className="w-full p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl font-black text-xs cursor-pointer text-indigo-950 focus:bg-white focus:border-indigo-500 transition-all"
                    title="Filtrar por categoría en esta fila"
                  >
                    <option value="TODAS">🏷️ Todas las Categorías</option>
                    {categoriasDisponibles.map((cat) => (
                      <option key={cat} value={cat}>
                        🏷️ {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Buscador Inteligente de Material en la Fila (busca en todas menos EQUIPOS y autodetecta la categoría) */}
                <div className="w-full sm:w-48 shrink-0 relative">
                  <Search size={14} className="absolute left-2.5 top-3 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={it.busquedaMaterial || ""}
                    onChange={(e) => handleBusquedaMaterialChange(idx, e.target.value)}
                    placeholder="🔍 Buscar material..."
                    className="w-full pl-8 pr-7 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-bold text-slate-800 outline-none transition-all placeholder-slate-400"
                  />
                  {it.busquedaMaterial && (
                    <button
                      type="button"
                      onClick={() => handleBusquedaMaterialChange(idx, "")}
                      className="absolute right-2 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* 3. Selector de Producto Filtrado */}
                <div className="flex-1 min-w-[200px]">
                  <select
                    value={it.id_producto}
                    onChange={(e) => {
                      const prodId = Number(e.target.value);
                      const prodSel = materialesDisponibles.find((p) => p.id_producto === prodId);
                      const catProd = prodSel?.categoria ? prodSel.categoria.trim().toUpperCase() : it.categoriaFila;
                      if (catProd && catProd !== "EQUIPOS") {
                        setUltimaCategoria(catProd);
                      }
                      setItems((prev) =>
                        prev.map((item, i) =>
                          i === idx
                            ? {
                                ...item,
                                id_producto: prodId,
                                categoriaFila: catProd || item.categoriaFila,
                                cantidad: Math.min(item.cantidad, Math.max(1, prodSel?.stock_central || 1)),
                              }
                            : item
                        )
                      );
                    }}
                    className={`w-full p-2.5 rounded-xl font-bold text-xs cursor-pointer border text-slate-800 transition-all ${
                      sinStock
                        ? "bg-rose-50 border-rose-300 text-rose-900"
                        : "bg-white border-slate-200 focus:border-indigo-500"
                    }`}
                  >
                    {prodsDeFila.length === 0 ? (
                      <option value="">No hay materiales disponibles con "{it.busquedaMaterial}"</option>
                    ) : (
                      prodsDeFila.map((p) => {
                        const noStock = (p.stock_central || 0) <= 0;
                        return (
                          <option
                            key={p.id_producto}
                            value={p.id_producto}
                            className={noStock ? "text-rose-600 font-bold" : ""}
                          >
                            {p.nombre} ({p.categoria || "MATERIAL"}) — {noStock ? "⚠️ SIN STOCK (0 disp.)" : `Stock: ${p.stock_central} ${p.unidad || (p.es_drop ? "m" : "und")}`}
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>

                {/* 4. Cantidad con tope de stock */}
                <div className="w-24 sm:w-28 flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min="1"
                    max={prodActual?.stock_central || 9999}
                    value={it.cantidad}
                    onChange={(e) => {
                      const cant = Number(e.target.value) || 1;
                      setItems((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, cantidad: cant } : item))
                      );
                    }}
                    className={`w-full p-2.5 rounded-xl font-mono font-bold text-xs text-center border ${
                      sinStock || excedeStock
                        ? "bg-rose-50 border-rose-300 text-rose-900"
                        : "bg-white border-slate-200 focus:border-indigo-500"
                    }`}
                  />
                  <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0 min-w-7">
                    {prodActual?.unidad || (prodActual?.es_drop ? "m" : "und")}
                  </span>
                </div>

                {/* 5. Badge indicador de disponibilidad */}
                {sinStock ? (
                  <div className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-100 text-rose-800 rounded-xl text-[10px] font-black shrink-0 animate-pulse">
                    <AlertTriangle size={12} className="text-rose-600" />
                    <span>Sin stock</span>
                  </div>
                ) : excedeStock ? (
                  <div className="flex items-center gap-1 px-2 py-1.5 bg-amber-100 text-amber-900 rounded-xl text-[10px] font-bold shrink-0" title={`Disponible: ${prodActual?.stock_central}`}>
                    <AlertTriangle size={12} className="text-amber-600" />
                    <span>Máx: {prodActual?.stock_central}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 px-2 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-xl text-[10px] font-bold shrink-0">
                    <ShieldCheck size={12} className="text-emerald-600" />
                    <span>Disp: {prodActual?.stock_central}</span>
                  </div>
                )}

                {/* 6. Botón Eliminar */}
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
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <QrCode size={18} />
            </div>
            <div>
              <span className="font-black text-sm text-slate-900 block">
                Pistoleo de Equipos Serializados (ONT / Mesh / Routers)
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Validación estricta en tiempo real contra stock de Almacén Central
              </span>
            </div>
          </div>
          <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200/60 px-3 py-1 rounded-xl">
            {seriesPistoleadas.length} {seriesPistoleadas.length === 1 ? 'equipo listo' : 'equipos listos'} para asignar
          </span>
        </div>

        {/* Input de escaneo continuo con pistola */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-purple-400">
            {verificandoSerie ? (
              <RefreshCw size={16} className="animate-spin text-purple-600" />
            ) : (
              <Barcode size={18} />
            )}
          </div>
          <input
            ref={serieInputRef}
            type="text"
            disabled={verificandoSerie}
            placeholder="Pistolear código de barras, S/N o ID Modelo y presionar ENTER..."
            value={serieInput}
            onChange={(e) => {
              setSerieInput(e.target.value);
              if (errorPistoleo) setErrorPistoleo(null);
            }}
            onKeyDown={handlePistolearSerie}
            className="w-full pl-10 pr-24 py-3 bg-purple-50/40 border-2 border-purple-200 hover:border-purple-300 focus:border-purple-600 rounded-2xl text-xs font-mono font-bold focus:bg-white text-purple-950 transition-all outline-none"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <span className="text-[10px] font-bold text-purple-400 bg-purple-100/70 px-2 py-1 rounded-lg">
              {verificandoSerie ? 'Verificando...' : 'ENTER ↵'}
            </span>
          </div>
        </div>

        {/* Alerta en tiempo real si la serie no es de almacén o no está disponible */}
        {errorPistoleo && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 animate-fade-in shadow-xs">
            <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs font-semibold leading-relaxed flex-1">
              {errorPistoleo}
            </div>
            <button
              type="button"
              onClick={() => setErrorPistoleo(null)}
              className="text-rose-400 hover:text-rose-700 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Feedback de último equipo agregado */}
        {exitoPistoleo && !errorPistoleo && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-800 font-bold animate-fade-in">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-600" />
              {exitoPistoleo}
            </span>
            <span className="text-[10px] text-emerald-600 font-mono">Stock Central Validado ✓</span>
          </div>
        )}

        {/* Listado enriquecido de equipos pistoleados */}
        {seriesPistoleadas.length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
            <QrCode size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs text-slate-500 font-medium">
              Aún no has pistoleado equipos. Escanea las series de las cajas para agregarlas al despacho.
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Solo se aceptarán equipos que existan en estado <span className="font-bold text-emerald-600">DISPONIBLE</span> en Almacén Central.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
            {seriesPistoleadas.map((eq, idx) => (
              <div
                key={eq.id_producto_serie || idx}
                className="bg-white p-3 rounded-2xl border border-purple-200/90 shadow-xs flex items-center justify-between gap-3 hover:border-purple-400 transition-all group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-black uppercase text-purple-700 bg-purple-100/70 px-1.5 py-0.5 rounded-md truncate">
                      {eq.producto_nombre || 'EQUIPO SERIALIZADO'}
                    </span>
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                      ✓ Central
                    </span>
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-900 truncate">
                    SN: {eq.numero_serie}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                    {eq.codigo_serie && (
                      <span className="text-blue-700 font-semibold">Cód: {eq.codigo_serie}</span>
                    )}
                    {eq.proid && (
                      <span className="text-amber-700 font-semibold">ID Modelo: {eq.proid}</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  title="Quitar equipo del despacho"
                  onClick={() => setSeriesPistoleadas((prev) => prev.filter((_, i) => i !== idx))}
                  className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
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

