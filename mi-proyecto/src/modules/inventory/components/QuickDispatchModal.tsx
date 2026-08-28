import React, { useState, useEffect } from "react";
import {
  X,
  Send,
  Truck,
  User,
  Package,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  RefreshCw,
  Layers,
  ArrowRight,
  ShieldCheck,
  Wrench,
  Shirt,
  Car,
  FileText,
  Sparkles,
} from "lucide-react";
import { ProductoStock, DespachoPayload } from "../types/inventoryTypes";
import { despacharATecnico, getTecnicoDotacionCompleta } from "../services/inventoryService";
import axios from "axios";
import { API_URL } from "../../../config/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  producto: ProductoStock | null;
  onDespachoRealizado: () => void;
}

export const QuickDispatchModal: React.FC<Props> = ({
  isOpen,
  onClose,
  producto,
  onDespachoRealizado,
}) => {
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [idTrabajador, setIdTrabajador] = useState<string>("");
  const [cantidad, setCantidad] = useState<number>(50);
  const [guardando, setGuardando] = useState(false);
  const [cargandoDotacion, setCargandoDotacion] = useState(false);
  const [dotacionTecnico, setDotacionTecnico] = useState<any>(null);

  // Pistoleo de series para Equipos ONT / Mesh
  const [serieInput, setSerieInput] = useState("");
  const [seriesPistoleadas, setSeriesPistoleadas] = useState<string[]>([]);
  const [observaciones, setObservaciones] = useState("Dotación desde almacén");

  // Asignación de Actas / Guías por Rango Correlativo (Sin escáner)
  const [prefijoActa, setPrefijoActa] = useState("001-");
  const [correlativoInicio, setCorrelativoInicio] = useState("04201");

  // Cargar técnicos
  useEffect(() => {
    if (isOpen) {
      axios
        .get(`${API_URL}/api/movilidad/tecnicos`)
        .then((res) => {
          setTecnicos(res.data || []);
          if (res.data && res.data.length > 0 && !idTrabajador) {
            setIdTrabajador(String(res.data[0].id_trabajador));
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  // Cargar dotación en tiempo real cuando cambia el técnico
  useEffect(() => {
    if (idTrabajador) {
      setCargandoDotacion(true);
      getTecnicoDotacionCompleta(idTrabajador)
        .then((res) => setDotacionTecnico(res))
        .catch(console.error)
        .finally(() => setCargandoDotacion(false));
    }
  }, [idTrabajador]);

  // Reset al abrir con un producto
  useEffect(() => {
    if (producto) {
      const cat = (producto.categoria || "").toUpperCase();
      const nom = (producto.nombre || "").toUpperCase();
      const esActaProd = cat.includes("TALONARIO") || cat.includes("ACTA") || cat.includes("GUIA") || nom.includes("ACTA") || nom.includes("GUIA");

      if (esActaProd) {
        setCantidad(50);
        setPrefijoActa("001-");
        setCorrelativoInicio("04201");
        setSeriesPistoleadas([]);
      } else if (producto.maneja_serie) {
        setCantidad(1);
        setSeriesPistoleadas([]);
      } else {
        setCantidad(Math.min(10, Math.max(1, producto.stock_central || 1)));
        setSeriesPistoleadas([]);
      }
      setSerieInput("");
    }
  }, [producto]);

  if (!isOpen || !producto) return null;

  const tecnicoActual = tecnicos.find((t) => String(t.id_trabajador) === String(idTrabajador));
  
  const catUpper = (producto.categoria || "").toUpperCase();
  const nomUpper = (producto.nombre || "").toUpperCase();
  const esActa = catUpper.includes("TALONARIO") || catUpper.includes("ACTA") || catUpper.includes("GUIA") || nomUpper.includes("ACTA") || nomUpper.includes("GUIA");
  const esEquipo = !esActa && (Boolean(producto.maneja_serie) || producto.categoria === "EQUIPOS");

  // Stock actual del técnico de este producto específico
  const itemEnTecnico = dotacionTecnico?.todosLosItems?.find(
    (i: any) => i.id_producto === producto.id_producto
  );
  const stockActualTecnico = Number(itemEnTecnico?.stock || 0);

  // Cálculo del número final de acta según cantidad y correlativo inicial
  const parseNumInicio = parseInt(correlativoInicio.replace(/\D/g, ""), 10) || 1;
  const padLength = Math.max(5, correlativoInicio.replace(/\D/g, "").length || 5);
  const parseNumFin = parseNumInicio + Math.max(1, cantidad) - 1;
  const correlativoFinCalculado = String(parseNumFin).padStart(padLength, "0");
  const correlativoInicioFormateado = String(parseNumInicio).padStart(padLength, "0");

  // Generador de series correlativas para Actas
  const generarSeriesActas = (): string[] => {
    const list: string[] = [];
    for (let i = parseNumInicio; i <= parseNumFin; i++) {
      const numStr = String(i).padStart(padLength, "0");
      list.push(`${prefijoActa}${numStr}`);
    }
    return list;
  };

  // Escaneo continuo con pistola de código de barras para equipos ONT/Mesh
  const handlePistolear = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && serieInput.trim()) {
      e.preventDefault();
      const clean = serieInput.trim().toUpperCase();
      if (!seriesPistoleadas.includes(clean)) {
        const nuevas = [...seriesPistoleadas, clean];
        setSeriesPistoleadas(nuevas);
        setCantidad(nuevas.length);
        setSerieInput("");
      }
    }
  };

  const handleRemoveSerie = (sn: string) => {
    const nuevas = seriesPistoleadas.filter((s) => s !== sn);
    setSeriesPistoleadas(nuevas);
    setCantidad(Math.max(1, nuevas.length));
  };

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idTrabajador) {
      alert("Selecciona un técnico.");
      return;
    }

    if (esEquipo && seriesPistoleadas.length === 0) {
      alert("Por favor escanea o ingresa al menos un número de serie para este equipo.");
      return;
    }

    if (cantidad <= 0) {
      alert("Ingresa una cantidad mayor a 0.");
      return;
    }

    try {
      setGuardando(true);

      let seriesFinalesPayload: { numero_serie: string; id_producto?: number }[] = [];
      let cantidadFinal = cantidad;

      if (esActa) {
        // Generar lote de actas correlativas automáticamente
        const actasGeneradas = generarSeriesActas();
        seriesFinalesPayload = actasGeneradas.map((s) => ({ numero_serie: s, id_producto: producto.id_producto }));
        cantidadFinal = actasGeneradas.length;
      } else if (esEquipo) {
        seriesFinalesPayload = seriesPistoleadas.map((s) => ({ numero_serie: s, id_producto: producto.id_producto }));
        cantidadFinal = seriesPistoleadas.length;
      }

      const payload: DespachoPayload = {
        id_trabajador: Number(idTrabajador),
        items: [{ id_producto: producto.id_producto, cantidad: cantidadFinal }],
        series_pistoleadas: seriesFinalesPayload,
        observaciones: esActa
          ? `Talonario de ${cantidadFinal} actas (${prefijoActa}${correlativoInicioFormateado} al ${prefijoActa}${correlativoFinCalculado}) - ${observaciones}`
          : `${observaciones} (${producto.nombre})`,
      };

      await despacharATecnico(payload);
      
      const msgExito = esActa
        ? `✅ ¡Talonario asignado con éxito! Se entregaron ${cantidadFinal} actas correlativas (${prefijoActa}${correlativoInicioFormateado} al ${prefijoActa}${correlativoFinCalculado}) a ${tecnicoActual?.nombre_completo || "Técnico"}.`
        : `✅ ¡Despacho exitoso! Se asignaron ${cantidadFinal} unidad(es) de ${producto.nombre} a ${tecnicoActual?.nombre_completo || "Técnico"}.`;

      alert(msgExito);
      onDespachoRealizado();
      onClose();
    } catch (err: any) {
      alert("Error al despachar: " + (err.response?.data?.error || err.message));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 md:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl p-5 md:p-6 max-w-2xl w-full shadow-2xl border border-slate-100 space-y-4 max-h-[95vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl text-white flex items-center justify-center font-black shadow-md shrink-0 ${
              esActa ? "bg-amber-500 shadow-amber-500/25" : "bg-indigo-600 shadow-indigo-600/20"
            }`}>
              {esActa ? <FileText size={20} /> : <Send size={20} />}
            </div>
            <div>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                esActa ? "bg-amber-50 text-amber-800" : "bg-indigo-50 text-indigo-700"
              }`}>
                {esActa ? "Asignación de Talonario de Actas / Guías" : "Asignación / Dotación a Cuadrilla"}
              </span>
              <h2 className="text-base font-black text-slate-900 mt-0.5">
                Despachar {producto.nombre}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleConfirmar} className="space-y-4">
          
          {/* 1. Selector de Técnico con verificación destacada */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <User size={14} className="text-indigo-600" />
              <span>Seleccionar Técnico / Conductor Destino:</span>
            </label>
            <select
              value={idTrabajador}
              onChange={(e) => setIdTrabajador(e.target.value)}
              className="w-full p-3 bg-slate-50 border-2 border-indigo-200 focus:border-indigo-600 rounded-2xl font-black text-xs text-slate-900 focus:bg-white cursor-pointer shadow-xs"
            >
              {tecnicos.map((t) => (
                <option key={t.id_trabajador} value={t.id_trabajador}>
                  👤 {t.nombre_completo} {t.cuadrilla ? `— Cuadrilla: ${t.cuadrilla}` : ""} {t.vehiculo_placa ? `(Placa: ${t.vehiculo_placa})` : ""}
                </option>
              ))}
            </select>

            {/* Badge de confirmación visual del técnico seleccionado */}
            {tecnicoActual && (
              <div className="p-2.5 bg-indigo-50/80 rounded-xl border border-indigo-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  <span className="font-extrabold text-indigo-950">
                    {tecnicoActual.nombre_completo}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="bg-white px-2 py-0.5 rounded-md text-indigo-800 font-bold border border-indigo-200">
                    📍 {tecnicoActual.cuadrilla || "Sin cuadrilla"}
                  </span>
                  <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-md font-bold">
                    🚗 {tecnicoActual.vehiculo_placa || "Sin auto"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 2. Stock en Móvil en Tiempo Real */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                <Truck size={14} className="text-cyan-600" />
                <span>Stock Actual en Camioneta de {tecnicoActual?.nombre_completo?.split(" ")[0] || "Técnico"}:</span>
              </span>
              {cargandoDotacion ? (
                <RefreshCw size={12} className="animate-spin text-indigo-600" />
              ) : (
                <span className="font-mono font-black text-xs text-indigo-900">
                  {stockActualTecnico} {esActa ? "actas disp." : "unid."}
                </span>
              )}
            </div>

            {/* Vista Rápida de Categorías en Poder del Técnico */}
            {dotacionTecnico && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="p-2 bg-white rounded-xl border border-slate-200 text-center">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase">Materiales</span>
                  <span className="font-mono font-black text-xs text-slate-800">
                    {dotacionTecnico.materiales?.reduce((a: any, b: any) => a + Number(b.stock), 0) || 0} u.
                  </span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200 text-center">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase">Equipos (ONT/Mesh)</span>
                  <span className="font-mono font-black text-xs text-emerald-700">
                    {dotacionTecnico.equipos?.reduce((a: any, b: any) => a + Number(b.stock), 0) || 0} u.
                  </span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200 text-center">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase">Herramientas</span>
                  <span className="font-mono font-black text-xs text-slate-800">
                    {dotacionTecnico.herramientas?.reduce((a: any, b: any) => a + Number(b.stock), 0) || 0} u.
                  </span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200 text-center">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase">Uniformes / EPP</span>
                  <span className="font-mono font-black text-xs text-slate-800">
                    {dotacionTecnico.uniformes?.reduce((a: any, b: any) => a + Number(b.stock), 0) || 0} u.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 3. Modo de Entrada: Actas por Rango / Equipos por Pistoleo / Insumos por Cantidad */}
          {esActa ? (
            /* ASIGNACIÓN DE ACTAS / GUÍAS POR RANGO & CANTIDAD (SIN ESCÁNER) */
            <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 rounded-2xl p-4 border border-amber-200 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                  <FileText size={16} className="text-amber-700" />
                  Asignación de Talonario por Rango Correlativo (Sin Escáner)
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 bg-amber-200 text-amber-900 rounded-md">
                  {cantidad} Actas a asignar
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Cantidad de Actas:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={cantidad}
                    onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full p-2.5 bg-white border border-amber-300 rounded-xl font-mono font-black text-sm text-slate-900 text-center shadow-2xs"
                  />
                  <div className="flex gap-1 mt-1 justify-center">
                    {[25, 50, 100].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCantidad(num)}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                          cantidad === num
                            ? "bg-amber-600 text-white border-amber-600"
                            : "bg-white text-amber-900 border-amber-200 hover:bg-amber-100"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Prefijo de Serie:
                  </label>
                  <input
                    type="text"
                    value={prefijoActa}
                    onChange={(e) => setPrefijoActa(e.target.value)}
                    placeholder="001-"
                    className="w-full p-2.5 bg-white border border-amber-300 rounded-xl font-mono font-bold text-xs text-slate-800 text-center shadow-2xs"
                  />
                  <span className="text-[9px] text-slate-400 block text-center mt-1">Ej: 001-</span>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Correlativo Inicial:
                  </label>
                  <input
                    type="text"
                    value={correlativoInicio}
                    onChange={(e) => setCorrelativoInicio(e.target.value.replace(/\D/g, ""))}
                    placeholder="04201"
                    className="w-full p-2.5 bg-white border border-amber-300 rounded-xl font-mono font-bold text-xs text-slate-800 text-center shadow-2xs"
                  />
                  <span className="text-[9px] text-slate-400 block text-center mt-1">Número de la 1ra hoja</span>
                </div>
              </div>

              {/* Rango Calculado en Tiempo Real */}
              <div className="bg-white p-3 rounded-xl border border-amber-200 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Rango que se registrará en BD:
                  </span>
                  <span className="text-xs font-black font-mono text-amber-900 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 bg-amber-100 rounded-md border border-amber-200">
                      {prefijoActa}{correlativoInicioFormateado}
                    </span>
                    <span className="text-amber-500 font-bold">→</span>
                    <span className="px-2 py-0.5 bg-amber-100 rounded-md border border-amber-200">
                      {prefijoActa}{correlativoFinCalculado}
                    </span>
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 block">
                    ✓ {cantidad} series correlativas
                  </span>
                </div>
              </div>
            </div>
          ) : esEquipo ? (
            /* EQUIPOS ONT / MESH (PISTOLEO CONTINUO) */
            <div className="bg-emerald-50/50 rounded-2xl p-3.5 border border-emerald-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                  <QrCode size={16} className="text-emerald-700" />
                  <span>Pistoleo de Series Barcode ({producto.nombre}):</span>
                </label>
                <span className="text-[10px] font-black font-mono px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                  {seriesPistoleadas.length} series leídas
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Escanea con la pistola o digita el serial..."
                  value={serieInput}
                  onChange={(e) => setSerieInput(e.target.value)}
                  onKeyDown={handlePistolear}
                  className="flex-1 p-2 bg-white border border-emerald-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    if (serieInput.trim()) {
                      const clean = serieInput.trim().toUpperCase();
                      if (!seriesPistoleadas.includes(clean)) {
                        setSeriesPistoleadas([...seriesPistoleadas, clean]);
                        setCantidad(seriesPistoleadas.length + 1);
                        setSerieInput("");
                      }
                    }
                  }}
                  className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 cursor-pointer"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Tags de Series */}
              {seriesPistoleadas.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                  {seriesPistoleadas.map((sn) => (
                    <span
                      key={sn}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-white text-emerald-900 border border-emerald-300 rounded-lg text-[10px] font-mono font-bold shadow-2xs"
                    >
                      <span>{sn}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSerie(sn)}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* INSUMOS Y MATERIALES CONVENCIONALES */
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Cantidad a Entregar (Disponible en Almacén: {producto.stock_central}):
              </label>
              <input
                type="number"
                min="1"
                max={producto.stock_central || 1000}
                value={cantidad}
                onChange={(e) => setCantidad(Math.max(1, Number(e.target.value)))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-sm text-slate-900"
              />
            </div>
          )}

          {/* 4. Impacto en Vivo */}
          <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-[10px] text-indigo-600 uppercase font-bold block">Almacén Central</span>
              <span className="font-bold text-slate-800">
                {producto.stock_central || 0} → <strong className="text-rose-600">{Math.max(0, (producto.stock_central || 0) - (esEquipo ? seriesPistoleadas.length : cantidad))}</strong>
              </span>
            </div>

            <ArrowRight size={16} className="text-indigo-400" />

            <div className="text-right">
              <span className="text-[10px] text-indigo-600 uppercase font-bold block">Camioneta Técnico</span>
              <span className="font-bold text-slate-800">
                {stockActualTecnico} → <strong className="text-emerald-700">{stockActualTecnico + (esEquipo ? seriesPistoleadas.length : cantidad)}</strong>
              </span>
            </div>
          </div>

          {/* Botón Submit */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || (esEquipo && seriesPistoleadas.length === 0)}
              className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:bg-slate-300 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
            >
              {guardando ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 size={14} />
              )}
              <span>Confirmar Asignación</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

