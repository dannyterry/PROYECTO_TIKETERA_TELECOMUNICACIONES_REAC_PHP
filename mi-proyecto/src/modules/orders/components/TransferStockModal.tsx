import React, { useState, useEffect, useMemo } from "react";
import { 
  X, 
  Search, 
  UserCheck, 
  Package, 
  Layers, 
  AlertCircle, 
  CheckCircle2, 
  Send, 
  RefreshCw,
  Plus,
  Minus,
  Check,
  Truck,
  ArrowRightLeft,
  FileText,
  CheckSquare,
  Square
} from "lucide-react";
import { API_URL } from "../../../config/api";

interface TransferStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  trabajadorActual: any;
  miStock: any[];
  misSeries: any[];
  onTransferenciaExitosa: () => void;
}

export const TransferStockModal: React.FC<TransferStockModalProps> = ({
  isOpen,
  onClose,
  trabajadorActual,
  miStock,
  misSeries,
  onTransferenciaExitosa,
}) => {
  // Búsqueda de técnico receptor
  const [dniBusqueda, setDniBusqueda] = useState("");
  const [buscandoDni, setBuscandoDni] = useState(false);
  const [tecnicoReceptor, setTecnicoReceptor] = useState<any | null>(null);
  const [errorDni, setErrorDni] = useState<string | null>(null);

  // Materiales a transferir: map de id_producto -> cantidad
  const [materialesSeleccionados, setMaterialesSeleccionados] = useState<Record<number, number>>({});
  
  // Series a transferir (Equipos y Actas seleccionadas)
  const [seriesSeleccionadas, setSeriesSeleccionadas] = useState<any[]>([]);

  // Filtro de búsqueda para Actas
  const [busquedaActa, setBusquedaActa] = useState("");
  const [rangoInicio, setRangoInicio] = useState("");
  const [rangoFin, setRangoFin] = useState("");

  // Motivo
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  // Helper para saber si un producto es serializado o acta
  const esItemSerializadoOActa = (m: any) => {
    const nom = (m.nombre || "").toUpperCase();
    const cat = (m.categoria || "").toUpperCase();
    return (
      Number(m.maneja_serie) === 1 ||
      nom.includes("ONT") ||
      nom.includes("ACTA") ||
      nom.includes("TALONARIO") ||
      nom.includes("EQUIPO") ||
      nom.includes("ROUTER") ||
      nom.includes("MESH") ||
      nom.includes("DECO") ||
      nom.includes("SMART") ||
      cat.includes("EQUIPO") ||
      cat.includes("TALONARIO") ||
      cat.includes("ACTA") ||
      cat.includes("HERRAMIENTA") ||
      cat.includes("UNIFORME") ||
      cat.includes("VEHICULO")
    );
  };

  // 1. Insumos y Materiales consumibles estrictamente NO serializados
  const materialesDisponibles = useMemo(() => {
    return miStock.filter((m) => !esItemSerializadoOActa(m) && Number(m.stock) > 0);
  }, [miStock]);

  // 2. Equipos serializados (ONTs, Mesh, Routers, Smart, Decos)
  const equiposDisponibles = useMemo(() => {
    return misSeries.filter((s) => {
      const nom = (s.equipo_nombre || "").toUpperCase();
      const cat = (s.categoria || "").toUpperCase();
      return !nom.includes("ACTA") && !cat.includes("TALONARIO") && !nom.includes("TALONARIO") && !nom.includes("GUIA");
    });
  }, [misSeries]);

  // Agrupados por modelo
  const equiposAgrupados = useMemo(() => {
    return equiposDisponibles.reduce((acc: Record<string, any[]>, curr: any) => {
      const modelo = curr.equipo_nombre || "Equipo";
      if (!acc[modelo]) acc[modelo] = [];
      acc[modelo].push(curr);
      return acc;
    }, {});
  }, [equiposDisponibles]);

  // 3. Actas físicas correlativas asignadas
  const actasDisponibles = useMemo(() => {
    return misSeries
      .filter((s) => {
        const nom = (s.equipo_nombre || "").toUpperCase();
        const cat = (s.categoria || "").toUpperCase();
        return nom.includes("ACTA") || cat.includes("TALONARIO") || nom.includes("TALONARIO") || nom.includes("GUIA");
      })
      .sort((a, b) => (a.numero_serie || "").localeCompare(b.numero_serie || ""));
  }, [misSeries]);

  // Actas filtradas por buscador
  const actasFiltradas = useMemo(() => {
    if (!busquedaActa.trim()) return actasDisponibles;
    const q = busquedaActa.trim().toUpperCase();
    return actasDisponibles.filter((a) => (a.numero_serie || "").toUpperCase().includes(q));
  }, [actasDisponibles, busquedaActa]);

  useEffect(() => {
    if (isOpen) {
      setDniBusqueda("");
      setTecnicoReceptor(null);
      setErrorDni(null);
      setMaterialesSeleccionados({});
      setSeriesSeleccionadas([]);
      setBusquedaActa("");
      setRangoInicio("");
      setRangoFin("");
      setMotivo("");
      setErrorGeneral(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Manejar búsqueda por DNI
  const buscarPorDni = async (dniQuery: string) => {
    const cleanDni = dniQuery.trim();
    if (cleanDni.length < 8) {
      setTecnicoReceptor(null);
      setErrorDni(null);
      return;
    }

    setBuscandoDni(true);
    setErrorDni(null);
    try {
      const res = await fetch(`${API_URL}/api/inventario/transferencias/buscar-tecnico-dni?dni=${encodeURIComponent(cleanDni)}`);
      const data = await res.json();
      if (data.success && data.tecnico) {
        const esMismoTecnico =
          (trabajadorActual?.id_trabajador && Number(data.tecnico.id_trabajador) === Number(trabajadorActual.id_trabajador)) ||
          (trabajadorActual?.id_usuario && Number(data.tecnico.id_usuario) === Number(trabajadorActual.id_usuario)) ||
          (trabajadorActual?.dni && String(data.tecnico.dni).trim() === String(trabajadorActual.dni).trim()) ||
          (trabajadorActual?.documento && String(data.tecnico.dni).trim() === String(trabajadorActual.documento).trim());

        if (esMismoTecnico) {
          setErrorDni("No puedes transferirte a ti mismo. Ingresa el DNI del compañero receptor.");
          setTecnicoReceptor(null);
        } else {
          setTecnicoReceptor(data.tecnico);
          setErrorDni(null);
        }
      } else {
        setTecnicoReceptor(null);
        setErrorDni(data.message || "Solo se permite personal con rol técnico o supervisor");
      }
    } catch (err: any) {
      console.error(err);
      setErrorDni("Error de conexión al buscar técnico.");
    } finally {
      setBuscandoDni(false);
    }
  };

  // Modificar cantidad de material consumible
  const cambiarCantidadMaterial = (id_producto: number, delta: number, maxStock: number) => {
    setMaterialesSeleccionados((prev) => {
      const actual = prev[id_producto] || 0;
      const nueva = Math.max(0, Math.min(maxStock, actual + delta));
      if (nueva === 0) {
        const copy = { ...prev };
        delete copy[id_producto];
        return copy;
      }
      return { ...prev, [id_producto]: nueva };
    });
  };

  const setCantidadDirecta = (id_producto: number, valor: number, maxStock: number) => {
    const num = isNaN(valor) ? 0 : Math.max(0, Math.min(maxStock, valor));
    setMaterialesSeleccionados((prev) => {
      if (num === 0) {
        const copy = { ...prev };
        delete copy[id_producto];
        return copy;
      }
      return { ...prev, [id_producto]: num };
    });
  };

  // Alternar selección de serie (Equipo o Acta)
  const toggleSerie = (serieItem: any) => {
    setSeriesSeleccionadas((prev) => {
      const existe = prev.some((s) => s.numero_serie === serieItem.numero_serie);
      if (existe) {
        return prev.filter((s) => s.numero_serie !== serieItem.numero_serie);
      } else {
        return [...prev, serieItem];
      }
    });
  };

  // Seleccionar todas o deseleccionar grupo de equipos
  const toggleGrupoEquipos = (grupoSeries: any[]) => {
    const todosSeleccionados = grupoSeries.every((g) =>
      seriesSeleccionadas.some((s) => s.numero_serie === g.numero_serie)
    );
    if (todosSeleccionados) {
      setSeriesSeleccionadas((prev) =>
        prev.filter((s) => !grupoSeries.some((g) => g.numero_serie === s.numero_serie))
      );
    } else {
      const nuevasSeries = grupoSeries.filter(
        (g) => !seriesSeleccionadas.some((s) => s.numero_serie === g.numero_serie)
      );
      setSeriesSeleccionadas((prev) => [...prev, ...nuevasSeries]);
    }
  };

  // Seleccionar cantidad rápida de Actas (ej: 5, 10)
  const seleccionarCantidadActas = (cant: number) => {
    const noSeleccionadas = actasDisponibles.filter(
      (a) => !seriesSeleccionadas.some((s) => s.numero_serie === a.numero_serie)
    );
    const aAgregar = noSeleccionadas.slice(0, cant);
    setSeriesSeleccionadas((prev) => [...prev, ...aAgregar]);
  };

  // Seleccionar Actas por Rango (ej: 001-44951 a 001-44960)
  const aplicarRangoActas = () => {
    if (!rangoInicio.trim() || !rangoFin.trim()) return;
    const ini = rangoInicio.trim().toUpperCase();
    const fin = rangoFin.trim().toUpperCase();

    const enRango = actasDisponibles.filter((a) => {
      const num = (a.numero_serie || "").toUpperCase();
      return num >= ini && num <= fin;
    });

    if (enRango.length === 0) {
      alert("No se encontraron actas en el rango especificado.");
      return;
    }

    setSeriesSeleccionadas((prev) => {
      const sinRepetir = enRango.filter((r) => !prev.some((s) => s.numero_serie === r.numero_serie));
      return [...prev, ...sinRepetir];
    });
  };

  const deseleccionarTodasLasActas = () => {
    setSeriesSeleccionadas((prev) =>
      prev.filter((s) => !actasDisponibles.some((a) => a.numero_serie === s.numero_serie))
    );
  };

  // Conteo
  const cantMateriales = Object.values(materialesSeleccionados).reduce((a, b) => a + b, 0);
  const equiposSeleccionadosCount = seriesSeleccionadas.filter((s) =>
    equiposDisponibles.some((e) => e.numero_serie === s.numero_serie)
  ).length;
  const actasSeleccionadasCount = seriesSeleccionadas.filter((s) =>
    actasDisponibles.some((a) => a.numero_serie === s.numero_serie)
  ).length;
  const totalItems = cantMateriales + seriesSeleccionadas.length;

  // Enviar solicitud
  const handleSubmit = async () => {
    if (!tecnicoReceptor) {
      setErrorGeneral("Por favor busca y selecciona al técnico receptor.");
      return;
    }

    if (totalItems === 0) {
      setErrorGeneral("Debes seleccionar al menos 1 material, equipo serializado o acta para transferir.");
      return;
    }

    const itemsSummary = [
      cantMateriales > 0 ? `• ${cantMateriales} materiales / consumibles` : null,
      equiposSeleccionadosCount > 0 ? `• ${equiposSeleccionadosCount} equipos ONT/Mesh serializados` : null,
      actasSeleccionadasCount > 0 ? `• ${actasSeleccionadasCount} actas físicas` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const confirmMsg = `¿Confirmas enviar la solicitud de traspaso a:\n\n👤 ${tecnicoReceptor.nombre_completo}\n🪪 DNI: ${tecnicoReceptor.dni}\n\nDetalle a traspasar:\n${itemsSummary}\n\nEl compañero recibirá una notificación inmediata en su portal para aceptar los ítems.`;
    if (!window.confirm(confirmMsg)) {
      return;
    }

    setEnviando(true);
    setErrorGeneral(null);

    try {
      const materialesPayload = Object.entries(materialesSeleccionados).map(([idStr, cant]) => {
        const mat = miStock.find((m) => Number(m.id_producto) === Number(idStr));
        return {
          id_producto: Number(idStr),
          nombre_producto: mat?.nombre || "Material",
          cantidad: cant,
          unidad_medida: mat?.es_drop ? "m" : "und",
        };
      });

      const seriesPayload = seriesSeleccionadas.map((s) => ({
        id_producto: s.id_producto,
        id_producto_serie: s.id_producto_serie,
        numero_serie: s.numero_serie,
        nombre_producto: s.equipo_nombre || "Equipo / Acta",
      }));

      const res = await fetch(`${API_URL}/api/inventario/transferencias/solicitar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_trabajador_origen: trabajadorActual.id_trabajador,
          id_trabajador_destino: tecnicoReceptor.id_trabajador,
          motivo: motivo.trim() || "Traspaso de dotación operativa entre técnicos de campo",
          materiales: materialesPayload,
          series: seriesPayload,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setErrorGeneral(data.message || data.error || "Error al procesar la solicitud de transferencia");
        setEnviando(false);
        return;
      }

      alert(`✅ Solicitud de Traspaso Generada con Éxito (${data.codigo}).\n\nEl técnico receptor (${tecnicoReceptor.nombre_completo}) recibirá una alerta en su portal para aceptar la transferencia.`);
      try {
        const bc = new BroadcastChannel("stock_transfers_sync");
        bc.postMessage({ type: "TRANSFER_UPDATED", timestamp: Date.now() });
        bc.close();
      } catch {}
      onTransferenciaExitosa();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorGeneral("Error de conexión al enviar la transferencia.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Cabecera */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-sky-600 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
              <ArrowRightLeft size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black leading-tight">Traspaso a Compañero</h2>
              <p className="text-[11px] text-sky-100 font-medium">Transfiere materiales, equipos ONT/Mesh o actas a otro técnico</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          
          {/* PASO 1: BÚSQUEDA Y FIJACIÓN DEL TÉCNICO RECEPTOR */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-extrabold text-slate-800 flex items-center gap-1.5 text-xs">
                <UserCheck size={15} className="text-indigo-600" />
                <span>1. Técnico Receptor de Campo:</span>
              </label>
              {tecnicoReceptor && (
                <button
                  type="button"
                  onClick={() => {
                    setTecnicoReceptor(null);
                    setDniBusqueda("");
                    setErrorDni(null);
                  }}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline decoration-dotted cursor-pointer"
                >
                  ✏️ Cambiar Receptor
                </button>
              )}
            </div>

            {!tecnicoReceptor ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      maxLength={10}
                      placeholder="Ingresa DNI completo de 8 dígitos..."
                      value={dniBusqueda}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setDniBusqueda(val);
                        if (val.length === 8) {
                          buscarPorDni(val);
                        } else {
                          setTecnicoReceptor(null);
                          setErrorDni(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && dniBusqueda.length >= 8) {
                          buscarPorDni(dniBusqueda);
                        }
                      }}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                    />
                    <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                  </div>
                  <button
                    type="button"
                    onClick={() => buscarPorDni(dniBusqueda)}
                    disabled={buscandoDni || dniBusqueda.length < 8}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                  >
                    {buscandoDni ? <RefreshCw size={13} className="animate-spin" /> : "Buscar"}
                  </button>
                </div>

                {errorDni && (
                  <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1 bg-rose-50 p-2 rounded-xl border border-rose-200">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>{errorDni}</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-emerald-50 border-2 border-emerald-400 p-3.5 rounded-2xl flex items-center justify-between gap-2 animate-fade-in shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 font-black shadow-sm">
                    <Check size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <span className="text-[9.5px] font-black uppercase tracking-wider text-emerald-900">
                        🟢 Técnico Receptor Fijado
                      </span>
                      <span className="text-[8.5px] font-black uppercase px-1.5 py-0.5 bg-emerald-200 text-emerald-950 rounded-md border border-emerald-300 font-mono">
                        DNI: {tecnicoReceptor.dni}
                      </span>
                      <span className="text-[8.5px] font-black uppercase px-1.5 py-0.5 bg-emerald-200 text-emerald-950 rounded-md border border-emerald-300">
                        🔧 {tecnicoReceptor.rol_nombre || "TÉCNICO"}
                      </span>
                    </div>
                    <h4 className="text-xs font-black text-slate-900 truncate">
                      {tecnicoReceptor.nombre_completo}
                    </h4>
                    <p className="text-[10.5px] font-medium text-slate-600 truncate">
                      📍 Cuadrilla: {tecnicoReceptor.cuadrilla || "Sin cuadrilla"} • 🚗 {tecnicoReceptor.vehiculo_placa}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PASO 2: SELECCIÓN DE MATERIALES CONSUMIBLES (SIN SERIE) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-extrabold text-slate-800 flex items-center gap-1.5 text-xs">
                <Layers size={15} className="text-indigo-600" />
                <span>2. Insumos & Materiales Consumibles:</span>
              </label>
              <span className="text-[10.5px] font-bold text-slate-500">
                {materialesDisponibles.length} tipos disponibles
              </span>
            </div>

            {materialesDisponibles.length === 0 ? (
              <p className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center font-medium">
                No tienes stock de materiales consumibles en tu camioneta.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1">
                {materialesDisponibles.map((mat) => {
                  const idProd = Number(mat.id_producto);
                  const cantSel = materialesSeleccionados[idProd] || 0;
                  const maxStock = Number(mat.stock);

                  return (
                    <div
                      key={idProd}
                      className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between ${
                        cantSel > 0
                          ? "bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-400"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <span className="font-bold text-[10.5px] text-slate-800 line-clamp-2" title={mat.nombre}>
                          {mat.nombre}
                        </span>
                        <span className="text-[9px] font-mono font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                          Max: {maxStock}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-[10px] text-slate-500 font-medium">A transferir:</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => cambiarCantidadMaterial(idProd, -1, maxStock)}
                            disabled={cantSel <= 0}
                            className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 disabled:opacity-30 text-slate-700 flex items-center justify-center font-bold"
                          >
                            <Minus size={11} />
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={maxStock}
                            value={cantSel || ""}
                            placeholder="0"
                            onChange={(e) => setCantidadDirecta(idProd, parseInt(e.target.value) || 0, maxStock)}
                            className="w-12 py-0.5 text-center font-mono font-black text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => cambiarCantidadMaterial(idProd, 1, maxStock)}
                            disabled={cantSel >= maxStock}
                            className="w-6 h-6 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 text-white flex items-center justify-center font-bold"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* PASO 3: SELECCIÓN DE EQUIPOS SERIALIZADOS (ONT / MESH / ROUTER) */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="font-extrabold text-slate-800 flex items-center gap-1.5 text-xs">
                <Package size={15} className="text-emerald-600" />
                <span>3. Equipos Serializados (ONT / Mesh / Router):</span>
              </label>
              <span className="text-[10.5px] font-bold text-emerald-700">
                {equiposSeleccionadosCount} de {equiposDisponibles.length} sel.
              </span>
            </div>

            {equiposDisponibles.length === 0 ? (
              <p className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center font-medium">
                No tienes equipos serializados asignados en tu camioneta.
              </p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto p-1">
                {Object.entries(equiposAgrupados).map(([nombreModelo, seriesList]: [string, any[]], gIdx) => {
                  const todosSel = seriesList.every((g) =>
                    seriesSeleccionadas.some((s) => s.numero_serie === g.numero_serie)
                  );

                  return (
                    <div key={gIdx} className="bg-emerald-50/40 border border-emerald-200 rounded-2xl p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-[11px] text-emerald-950 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span>{nombreModelo} ({seriesList.length})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleGrupoEquipos(seriesList)}
                          className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-100/80 px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                        >
                          {todosSel ? "Deseleccionar todos" : "Seleccionar todos"}
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {seriesList.map((ser, sIdx) => {
                          const isSel = seriesSeleccionadas.some((s) => s.numero_serie === ser.numero_serie);
                          return (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => toggleSerie(ser)}
                              className={`px-2.5 py-1 rounded-xl font-mono text-[10.5px] font-black border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                                isSel
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                  : "bg-white text-emerald-950 border-emerald-300 hover:bg-emerald-50"
                              }`}
                            >
                              <span>{ser.numero_serie}</span>
                              {isSel && <Check size={12} className="text-white shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* PASO 4: SELECCIÓN DE ACTAS FÍSICAS (TALONARIOS CORRELATIVOS) */}
          {actasDisponibles.length > 0 && (
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="font-extrabold text-slate-800 flex items-center gap-1.5 text-xs">
                  <FileText size={15} className="text-sky-600" />
                  <span>4. Talonarios de Actas Físicas (Correlativos):</span>
                </label>
                <span className="text-[10.5px] font-bold text-sky-700">
                  {actasSeleccionadasCount} de {actasDisponibles.length} sel.
                </span>
              </div>

              {/* Herramientas de selección rápida de Actas */}
              <div className="bg-sky-50/60 border border-sky-200 rounded-2xl p-2.5 space-y-2">
                
                {/* Botones de selección rápida y buscador */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => seleccionarCantidadActas(5)}
                      className="px-2 py-0.5 bg-white border border-sky-300 text-sky-800 hover:bg-sky-100 rounded-lg text-[10px] font-bold"
                    >
                      +5 Actas
                    </button>
                    <button
                      type="button"
                      onClick={() => seleccionarCantidadActas(10)}
                      className="px-2 py-0.5 bg-white border border-sky-300 text-sky-800 hover:bg-sky-100 rounded-lg text-[10px] font-bold"
                    >
                      +10 Actas
                    </button>
                    {actasSeleccionadasCount > 0 && (
                      <button
                        type="button"
                        onClick={deseleccionarTodasLasActas}
                        className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg text-[10px] font-bold"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>

                  <div className="relative w-36">
                    <input
                      type="text"
                      placeholder="Filtrar N°..."
                      value={busquedaActa}
                      onChange={(e) => setBusquedaActa(e.target.value)}
                      className="w-full pl-6 pr-2 py-1 bg-white border border-sky-300 rounded-lg text-[10px] font-mono font-bold text-sky-950 focus:outline-none"
                    />
                    <Search size={11} className="absolute left-2 top-2 text-sky-400" />
                  </div>
                </div>

                {/* Selección por Rango */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-sky-100 text-[10px]">
                  <span className="font-bold text-sky-900 shrink-0">Rango:</span>
                  <input
                    type="text"
                    placeholder="Desde (ej: 001-44951)"
                    value={rangoInicio}
                    onChange={(e) => setRangoInicio(e.target.value)}
                    className="w-28 px-1.5 py-0.5 bg-white border border-sky-300 rounded-md font-mono font-bold text-[10px]"
                  />
                  <span className="text-slate-400">-</span>
                  <input
                    type="text"
                    placeholder="Hasta (ej: 001-44960)"
                    value={rangoFin}
                    onChange={(e) => setRangoFin(e.target.value)}
                    className="w-28 px-1.5 py-0.5 bg-white border border-sky-300 rounded-md font-mono font-bold text-[10px]"
                  />
                  <button
                    type="button"
                    onClick={aplicarRangoActas}
                    className="px-2 py-0.5 bg-sky-600 hover:bg-sky-700 text-white rounded-md font-bold text-[10px] shrink-0"
                  >
                    Marcar
                  </button>
                </div>

                {/* Listado de Chips de Actas */}
                <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pt-1">
                  {actasFiltradas.map((acta, aIdx) => {
                    const isSel = seriesSeleccionadas.some((s) => s.numero_serie === acta.numero_serie);
                    return (
                      <button
                        key={aIdx}
                        type="button"
                        onClick={() => toggleSerie(acta)}
                        className={`px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold border transition-all flex items-center gap-1 cursor-pointer shadow-2xs ${
                          isSel
                            ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                            : "bg-white text-sky-950 border-sky-200 hover:bg-sky-50"
                        }`}
                      >
                        <span>{acta.numero_serie}</span>
                        {isSel && <Check size={10} className="text-white shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* PASO 5: MOTIVO / OBSERVACIONES */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <label className="font-extrabold text-slate-800 text-xs">
              5. Motivo u Observación (Opcional):
            </label>
            <textarea
              rows={2}
              placeholder="Ej: Préstamo de ONT y actas para orden #3478136..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs resize-none"
            />
          </div>

          {/* ALERTA DE ERROR GENERAL */}
          {errorGeneral && (
            <div className="bg-rose-50 border border-rose-300 p-3 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{errorGeneral}</span>
            </div>
          )}

        </div>

        {/* Footer con Resumen y Botón de Envío */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 shrink-0 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">
              Total a Traspasar
            </span>
            <span className="text-xs font-black text-slate-900 truncate block">
              {cantMateriales} mat. • {equiposSeleccionadosCount} equipos • {actasSeleccionadasCount} actas
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={enviando || totalItems === 0 || !tecnicoReceptor}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/25 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              {enviando ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>
                    {tecnicoReceptor
                      ? `🚀 Traspasar a ${(tecnicoReceptor.nombre_completo || "").split(" ")[0]} (${tecnicoReceptor.dni})`
                      : "Solicitar Traspaso"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
export default TransferStockModal;
