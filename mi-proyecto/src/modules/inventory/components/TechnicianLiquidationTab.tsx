import React, { useState, useEffect } from "react";
import {
  ClipboardCheck,
  History,
  Truck,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  RefreshCw,
  QrCode,
  Layers,
  Search,
  Check,
  X,
  FileText,
  UserCheck,
  Clock,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  StockTecnicoDetalle,
  SerieTecnicoDetalle,
} from "../types/inventoryTypes";
import {
  procesarLiquidacionTecnico,
  getHistorialLiquidaciones,
  getDetalleLiquidacion,
} from "../services/inventoryService";

interface Props {
  stockPorTecnico: StockTecnicoDetalle[];
  seriesTecnicos: SerieTecnicoDetalle[];
  onRefresh?: () => void;
}

interface ItemVerificacion {
  id_producto: number;
  producto_nombre: string;
  producto_codigo: string;
  categoria: string;
  es_drop: boolean;
  cantidad_esperada: number;
  devuelve: boolean;
  cantidad_devuelta: number;
  observaciones: string;
}

export const TechnicianLiquidationTab: React.FC<Props> = ({
  stockPorTecnico,
  seriesTecnicos,
  onRefresh,
}) => {
  const [subTab, setSubTab] = useState<"nueva" | "historial">("nueva");
  const [tecnicoSeleccionadoId, setTecnicoSeleccionadoId] = useState<number | "">("");
  const [motivo, setMotivo] = useState("Baja / Retiro definitivo de la empresa");
  const [almaceneroNombre, setAlmaceneroNombre] = useState("Almacén Central Céspedes");
  const [observacionesGenerales, setObservacionesGenerales] = useState("");

  // Lista de verificación de materiales en mesa
  const [itemsVerificacion, setItemsVerificacion] = useState<ItemVerificacion[]>([]);
  // Series seleccionadas con check
  const [seriesVerificadas, setSeriesVerificadas] = useState<{ [sn: string]: boolean }>({});
  const [guardando, setGuardando] = useState(false);

  // Historial
  const [historial, setHistorial] = useState<any[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [busquedaHistorial, setBusquedaHistorial] = useState("");

  // Técnicos únicos que tienen dotación activa
  const tecnicosConStock = Array.from(
    new Map(
      stockPorTecnico
        .filter((s) => s.stock > 0)
        .map((s) => [s.id_trabajador, {
          id: s.id_trabajador,
          nombre: s.tecnico_nombre,
          cuadrilla: s.cuadrilla || "S/C",
          placa: s.vehiculo_placa || "Sin vehículo",
        }])
    ).values()
  );

  // Técnico activo seleccionado
  const tecnicoActual = tecnicosConStock.find((t) => t.id === Number(tecnicoSeleccionadoId));

  // Cargar items y series al cambiar técnico seleccionado
  useEffect(() => {
    if (!tecnicoSeleccionadoId) {
      setItemsVerificacion([]);
      setSeriesVerificadas({});
      return;
    }

    const id = Number(tecnicoSeleccionadoId);
    const productosTecnico = stockPorTecnico.filter((s) => s.id_trabajador === id && s.stock > 0);

    const items: ItemVerificacion[] = productosTecnico.map((p) => ({
      id_producto: p.id_producto,
      producto_nombre: p.producto_nombre,
      producto_codigo: p.producto_codigo || "-",
      categoria: p.categoria || "MATERIALES",
      es_drop: Boolean(p.es_drop),
      cantidad_esperada: p.stock,
      devuelve: true,
      cantidad_devuelta: p.stock, // Por defecto se asume que entrega todo lo asignado
      observaciones: "",
    }));
    setItemsVerificacion(items);

    // Series asignadas al técnico
    const seriesTec = seriesTecnicos.filter(
      (s) => s.id_trabajador === id && s.estado === "Asignada"
    );
    const checks: { [sn: string]: boolean } = {};
    seriesTec.forEach((s) => {
      checks[s.numero_serie] = true; // Marcadas por defecto
    });
    setSeriesVerificadas(checks);
  }, [tecnicoSeleccionadoId, stockPorTecnico, seriesTecnicos]);

  // Cargar historial
  const cargarHistorial = async () => {
    try {
      setCargandoHistorial(true);
      const data = await getHistorialLiquidaciones();
      setHistorial(data || []);
    } catch (err) {
      console.error("Error al cargar historial:", err);
    } finally {
      setCargandoHistorial(false);
    }
  };

  useEffect(() => {
    if (subTab === "historial") {
      cargarHistorial();
    }
  }, [subTab]);

  // Totales en tiempo real
  const totalEsperado = itemsVerificacion.reduce((acc, i) => acc + i.cantidad_esperada, 0);
  const totalDevuelto = itemsVerificacion.reduce(
    (acc, i) => acc + (i.devuelve ? Number(i.cantidad_devuelta) || 0 : 0),
    0
  );
  const totalFaltante = Math.max(0, totalEsperado - totalDevuelto);
  const seriesTecnicoActual = seriesTecnicos.filter(
    (s) => s.id_trabajador === Number(tecnicoSeleccionadoId) && s.estado === "Asignada"
  );
  const totalSeriesSeleccionadas = Object.values(seriesVerificadas).filter(Boolean).length;

  // Generador Oficial de Constancia / Paz y Salvo en Excel (.xlsx)
  const generarExcelConstancia = (datosLiq: {
    id_liquidacion: number;
    tecnico_nombre: string;
    cuadrilla: string;
    vehiculo_placa: string;
    almacenero_nombre: string;
    motivo: string;
    observaciones: string;
    fecha_liquidacion: string;
    detalles: any[];
    series_devueltas: string[];
  }) => {
    try {
      const wb = XLSX.utils.book_new();

      // Formato oficial membretado
      const rowsExcel: any[][] = [
        ["CORPORACIÓN CÉSPEDES TELECOMUNICACIONES S.A.C."],
        ["ÁREA DE LOGÍSTICA & ALMACÉN CENTRAL"],
        ["ACTA DE ENTREGA, RECEPCIÓN Y LIQUIDACIÓN DE DOTACIÓN "],
        [],
        ["Nº DE CONSTANCIA:", `LIQ-${String(datosLiq.id_liquidacion).padStart(5, "0")}`, "FECHA Y HORA:", datosLiq.fecha_liquidacion.replace("T", " ")],
        ["TÉCNICO / CONDUCTOR:", datosLiq.tecnico_nombre, "CUADRILLA:", datosLiq.cuadrilla],
        ["VEHÍCULO / PLACA:", datosLiq.vehiculo_placa, "ALMACENERO RECEPTOR:", datosLiq.almacenero_nombre],
        ["MOTIVO DE DEVOLUCIÓN:", datosLiq.motivo, "OBSERVACIONES:", datosLiq.observaciones || "Conforme sin observaciones"],
        [],
        ["1. DETALLE DE MATERIALES, HERRAMIENTAS Y SUMINISTROS DEVUELTOS"],
        ["Categoría", "Producto / Descripción", "Código", "Cant. Asignada (Sistema)", "Cant. Entregada Físicamente", "Faltante / Diferencia", "Observación / Estado"],
      ];

      // Agregar filas de materiales
      datosLiq.detalles.forEach((d: any) => {
        rowsExcel.push([
          d.categoria || "MATERIALES",
          d.producto_nombre,
          d.producto_codigo || "-",
          d.cantidad_esperada,
          d.cantidad_devuelta,
          d.cantidad_faltante > 0 ? `🚨 FALTANTE: ${d.cantidad_faltante}` : "0 (Conforme)",
          d.observaciones || "OK",
        ]);
      });

      // Agregar sección de equipos y series
      rowsExcel.push([]);
      rowsExcel.push(["2. DETALLE DE EQUIPOS Y SERIES INDIVIDUALES RECIBIDAS (ONT / DECOS / MESH)"]);
      rowsExcel.push(["#", "Número de Serie (MAC / SN)", "Estado en Almacén", "Verificación"]);

      if (datosLiq.series_devueltas && datosLiq.series_devueltas.length > 0) {
        datosLiq.series_devueltas.forEach((sn: string, idx: number) => {
          rowsExcel.push([idx + 1, sn, "DISPONIBLE EN CENTRAL", "RECIBIDO EN MANO"]);
        });
      } else {
        rowsExcel.push(["-", "No se registraron equipos serializados en esta entrega", "-", "-"]);
      }

      rowsExcel.push([]);
      rowsExcel.push(["DECLARACIÓN DE CONFORMIDAD:"]);
      rowsExcel.push([
        "Por medio de la presente, el Técnico declara haber hecho entrega formal de los materiales y equipos detallados precedentemente al Almacén Central de Corporación Céspedes. Ambas partes firman en señal de conformidad quedando regularizado el inventario del vehículo asignado.",
      ]);
      rowsExcel.push([]);
      rowsExcel.push([]);
      rowsExcel.push(["________________________________________", "", "________________________________________"]);
      rowsExcel.push([`FIRMA DEL TRABAJADOR`, "", "FIRMA RESPONSABLE ALMACÉN"]);
      rowsExcel.push([`Técnico: ${datosLiq.tecnico_nombre}`, "", `Almacenero: ${datosLiq.almacenero_nombre}`]);
      rowsExcel.push([`Placa: ${datosLiq.vehiculo_placa}`, "", "Corporación Céspedes Telecomunicaciones"]);

      const ws = XLSX.utils.aoa_to_sheet(rowsExcel);

      ws["!cols"] = [
        { wch: 22 }, // Col A
        { wch: 36 }, // Col B
        { wch: 16 }, // Col C
        { wch: 24 }, // Col D
        { wch: 26 }, // Col E
        { wch: 22 }, // Col F
        { wch: 28 }, // Col G
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Acta de Devolución");

      const nombreSanitizado = datosLiq.tecnico_nombre.replace(/\s+/g, "_");
      XLSX.writeFile(wb, `PAZ_Y_SALVO_${nombreSanitizado}_LIQ_${datosLiq.id_liquidacion}.xlsx`);
    } catch (err) {
      console.error("Error al exportar constancia en Excel:", err);
      alert("Error al generar el archivo Excel de la constancia.");
    }
  };

  // Procesar Liquidación
  const handleProcesarLiquidacion = async () => {
    if (!tecnicoActual) {
      alert("Por favor selecciona un técnico con dotación activa.");
      return;
    }

    const confirmar = window.confirm(
      `¿Estás seguro de procesar la liquidación y devolución de ${tecnicoActual.nombre}?\n\n- Se devolverán los materiales verificados a Almacén Central.\n- Se liberarán ${totalSeriesSeleccionadas} equipos con serie a Central.\n- Se descargará automáticamente el Acta Oficial en Excel.`
    );
    if (!confirmar) return;

    try {
      setGuardando(true);

      const itemsPayload = itemsVerificacion.map((it) => ({
        id_producto: it.id_producto,
        producto_nombre: it.producto_nombre,
        producto_codigo: it.producto_codigo,
        categoria: it.categoria,
        cantidad_esperada: it.cantidad_esperada,
        cantidad_devuelta: it.devuelve ? Number(it.cantidad_devuelta) || 0 : 0,
        cantidad_faltante: it.devuelve
          ? Math.max(0, it.cantidad_esperada - (Number(it.cantidad_devuelta) || 0))
          : it.cantidad_esperada,
        observaciones: it.observaciones,
      }));

      const seriesDevueltasTodas = Object.entries(seriesVerificadas)
        .filter(([_, checked]) => checked)
        .map(([sn]) => sn);

      const payload = {
        id_trabajador: tecnicoActual.id,
        tecnico_nombre: tecnicoActual.nombre,
        cuadrilla: tecnicoActual.cuadrilla,
        vehiculo_placa: tecnicoActual.placa,
        almacenero_nombre: almaceneroNombre,
        motivo: motivo,
        observaciones: observacionesGenerales,
        items: itemsPayload,
        series_devueltas_todas: seriesDevueltasTodas,
      };

      const res = await procesarLiquidacionTecnico(payload);

      // Generar y descargar el Excel inmediatamente
      generarExcelConstancia({
        id_liquidacion: res.id_liquidacion,
        tecnico_nombre: tecnicoActual.nombre,
        cuadrilla: tecnicoActual.cuadrilla,
        vehiculo_placa: tecnicoActual.placa,
        almacenero_nombre: almaceneroNombre,
        motivo: motivo,
        observaciones: observacionesGenerales,
        fecha_liquidacion: new Date().toISOString(),
        detalles: itemsPayload,
        series_devueltas: seriesDevueltasTodas,
      });

      alert(`✅ ${res.message}\n\nEl archivo Excel  se descargó en tu equipo.`);

      // Limpiar formulario y refrescar almacén
      setTecnicoSeleccionadoId("");
      setItemsVerificacion([]);
      setSeriesVerificadas({});
      setObservacionesGenerales("");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      alert("Error al procesar liquidación: " + (err.response?.data?.error || err.message));
    } finally {
      setGuardando(false);
    }
  };

  // Re-descargar Excel desde historial
  const handleRedescargarExcel = async (idLiq: number) => {
    try {
      const data = await getDetalleLiquidacion(idLiq);
      let seriesList: string[] = [];
      if (data.detalles) {
        data.detalles.forEach((d: any) => {
          if (d.series_devueltas) {
            try {
              const parsed = JSON.parse(d.series_devueltas);
              if (Array.isArray(parsed)) seriesList.push(...parsed);
            } catch {
              seriesList.push(d.series_devueltas);
            }
          }
        });
      }

      generarExcelConstancia({
        id_liquidacion: data.id_liquidacion,
        tecnico_nombre: data.tecnico_nombre,
        cuadrilla: data.cuadrilla,
        vehiculo_placa: data.vehiculo_placa,
        almacenero_nombre: data.almacenero_nombre,
        motivo: data.motivo,
        observaciones: data.observaciones,
        fecha_liquidacion: data.fecha_liquidacion,
        detalles: data.detalles || [],
        series_devueltas: seriesList,
      });
    } catch (err) {
      alert("Error al obtener detalle de liquidación para Excel.");
    }
  };

  const historialFiltrado = historial.filter((h) => {
    if (!busquedaHistorial) return true;
    const q = busquedaHistorial.toLowerCase();
    return (
      (h.tecnico_nombre && h.tecnico_nombre.toLowerCase().includes(q)) ||
      (h.almacenero_nombre && h.almacenero_nombre.toLowerCase().includes(q)) ||
      (h.vehiculo_placa && h.vehiculo_placa.toLowerCase().includes(q)) ||
      (h.motivo && h.motivo.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">

      {/* ─────────────────────────────────────────────────────────────
          1. HEADER & SUBTAB SELECTOR
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 text-amber-400 flex items-center justify-center font-black shadow-md shadow-slate-900/10 border border-slate-600/30">
            <ClipboardCheck size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Liquidación & Devolución de Dotaciones
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                Oficial
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Verificación física uno por uno, control de faltantes, emisión de constancias en Excel e historial de auditoría.
            </p>
          </div>
        </div>

        {/* Botonera Switch: Nueva vs Historial */}
        <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setSubTab("nueva")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${subTab === "nueva"
              ? "bg-slate-700 text-white shadow-xs font-bold"
              : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <ClipboardCheck size={15} className={subTab === "nueva" ? "text-slate-200" : "text-slate-400"} />
            <span>Nueva Liquidación (En Mesa)</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab("historial")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${subTab === "historial"
              ? "bg-slate-700 text-white shadow-xs font-bold"
              : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <History size={15} className={subTab === "historial" ? "text-slate-200" : "text-slate-400"} />
            <span>Historial de Constancias</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. VISTA A: FORMULARIO DE LIQUIDACIÓN ACTIVA
      ───────────────────────────────────────────────────────────── */}
      {subTab === "nueva" && (
        <div className="space-y-6">

          {/* PASO 1: SELECCIÓN DEL TÉCNICO Y MOTIVO */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Truck size={16} className="text-slate-700" />
                Paso 1: Seleccionar Técnico a Liquidar
              </span>
              <span className="text-xs font-bold text-slate-400">
                {tecnicosConStock.length} técnicos con dotación en vehículo
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Técnico / Conductor:
                </label>
                <select
                  value={tecnicoSeleccionadoId}
                  onChange={(e) => setTecnicoSeleccionadoId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none"
                >
                  <option value="">-- Seleccionar Técnico --</option>
                  {tecnicosConStock.map((t) => (
                    <option key={t.id} value={t.id}>
                      👤 {t.nombre} ({t.cuadrilla} - {t.placa})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Motivo de la Liquidación:
                </label>
                <select
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                >
                  <option value="Baja / Retiro definitivo de la empresa">Baja / Retiro definitivo de la empresa</option>
                  <option value="Cambio de camioneta / vehículo">Cambio de camioneta / vehículo</option>
                  <option value="Cambio de cuadrilla / rol">Cambio de cuadrilla / rol</option>
                  <option value="Devolución periódica de sobrantes">Devolución periódica de sobrantes</option>
                  <option value="Auditoría / Conteo general">Auditoría / Conteo general</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Almacenero Receptor:
                </label>
                <input
                  type="text"
                  value={almaceneroNombre}
                  onChange={(e) => setAlmaceneroNombre(e.target.value)}
                  placeholder="Nombre de quien recibe en almacén"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Ficha del Técnico Seleccionado */}
            {tecnicoActual && (
              <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl flex flex-wrap items-center justify-between gap-4 mt-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-700 text-white flex items-center justify-center font-black">
                    <UserCheck size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900">{tecnicoActual.nombre}</div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      Cuadrilla: <strong className="text-slate-700">{tecnicoActual.cuadrilla}</strong> | Placa: <strong className="text-cyan-700 font-mono">{tecnicoActual.placa}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Líneas en Dotación</span>
                    <span className="font-black text-slate-800">{itemsVerificacion.length} productos</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Equipos Seriales</span>
                    <span className="font-black text-amber-700">{seriesTecnicoActual.length} ONTs/Decos</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PASO 2: TABLA DE CONTEO Y VERIFICACIÓN EN MESA (UNO POR UNO) */}
          {tecnicoActual && (
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden space-y-4">
              <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Layers size={16} className="text-slate-700" />
                    Paso 2: Conteo Físico y Verificación en Mesa (Uno por Uno)
                  </span>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Modifica la cantidad física recibida si el técnico gastó o tiene faltantes. El sistema calculará la diferencia.
                  </p>
                </div>

                {/* Botón marcar todo */}
                <button
                  type="button"
                  onClick={() => {
                    const allDevuelve = itemsVerificacion.every((i) => i.devuelve);
                    setItemsVerificacion(
                      itemsVerificacion.map((i) => ({ ...i, devuelve: !allDevuelve }))
                    );
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all cursor-pointer"
                >
                  {itemsVerificacion.every((i) => i.devuelve) ? "Desmarcar Todos" : "Marcar Todos para Devolución"}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">Devolver</th>
                      <th className="py-3 px-4">Producto / Suministro</th>
                      <th className="py-3 px-4">Categoría</th>
                      <th className="py-3 px-4 text-right">Cant. Asignada (Carro)</th>
                      <th className="py-3 px-4 text-center w-36">Cant. Recibida en Mano</th>
                      <th className="py-3 px-4 text-center w-32">Diferencia / Faltante</th>
                      <th className="py-3 px-4">Observación / Estado del Ítem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemsVerificacion.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                          Este técnico no tiene materiales registrados en su vehículo.
                        </td>
                      </tr>
                    ) : (
                      itemsVerificacion.map((item, idx) => {
                        const cantDev = item.devuelve ? Number(item.cantidad_devuelta) || 0 : 0;
                        const faltante = Math.max(0, item.cantidad_esperada - cantDev);

                        return (
                          <tr key={idx} className={item.devuelve ? "hover:bg-slate-50/70" : "bg-slate-50/40 opacity-60"}>
                            {/* Checkbox Devolver */}
                            <td className="py-3.5 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={item.devuelve}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setItemsVerificacion((prev) =>
                                    prev.map((it, i) =>
                                      i === idx ? { ...it, devuelve: checked } : it
                                    )
                                  );
                                }}
                                className="w-4 h-4 rounded text-slate-700 cursor-pointer"
                              />
                            </td>

                            {/* Producto */}
                            <td className="py-3.5 px-4 font-bold text-slate-900">
                              <div>{item.producto_nombre}</div>
                              {item.producto_codigo && (
                                <span className="text-[10px] font-mono text-slate-400 font-normal">
                                  {item.producto_codigo}
                                </span>
                              )}
                            </td>

                            {/* Categoría */}
                            <td className="py-3.5 px-4">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {item.categoria}
                              </span>
                            </td>

                            {/* Asignada */}
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700">
                              {item.cantidad_esperada} {item.es_drop ? "m" : "und"}
                            </td>

                            {/* Recibida Input */}
                            <td className="py-3.5 px-4 text-center">
                              <input
                                type="number"
                                min={0}
                                max={item.cantidad_esperada}
                                disabled={!item.devuelve}
                                value={item.cantidad_devuelta}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setItemsVerificacion((prev) =>
                                    prev.map((it, i) =>
                                      i === idx ? { ...it, cantidad_devuelta: val } : it
                                    )
                                  );
                                }}
                                className="w-24 px-2.5 py-1 text-center font-mono font-bold text-xs bg-white border border-slate-300 rounded-xl focus:border-slate-700 focus:outline-none"
                              />
                            </td>

                            {/* Faltante */}
                            <td className="py-3.5 px-4 text-center">
                              {faltante > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                  <AlertTriangle size={11} />
                                  Falta: {faltante}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Check size={11} />
                                  Completo
                                </span>
                              )}
                            </td>

                            {/* Observación */}
                            <td className="py-3.5 px-4">
                              <input
                                type="text"
                                placeholder="Ej: Bobina con restos, buen estado..."
                                value={item.observaciones}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setItemsVerificacion((prev) =>
                                    prev.map((it, i) =>
                                      i === idx ? { ...it, observaciones: val } : it
                                    )
                                  );
                                }}
                                className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PASO 3: CONTROL DE EQUIPOS SERIALIZADOS (ONT / DECOS / MESH) */}
          {tecnicoActual && seriesTecnicoActual.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <QrCode size={16} className="text-amber-600" />
                  Paso 3: Verificación de Equipos y Series en Físico ({seriesTecnicoActual.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const allChecked = Object.values(seriesVerificadas).every(Boolean);
                    const newChecks: { [sn: string]: boolean } = {};
                    seriesTecnicoActual.forEach((s) => {
                      newChecks[s.numero_serie] = !allChecked;
                    });
                    setSeriesVerificadas(newChecks);
                  }}
                  className="text-xs text-amber-700 hover:text-amber-900 font-bold hover:underline cursor-pointer"
                >
                  Marcar/Desmarcar todas las series
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {seriesTecnicoActual.map((s, sIdx) => {
                  const isChecked = Boolean(seriesVerificadas[s.numero_serie]);

                  return (
                    <label
                      key={sIdx}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${isChecked
                        ? "bg-amber-50/70 border-amber-300 shadow-2xs"
                        : "bg-slate-50 border-slate-200 opacity-60"
                        }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setSeriesVerificadas((prev) => ({
                              ...prev,
                              [s.numero_serie]: val,
                            }));
                          }}
                          className="w-4 h-4 rounded text-amber-600 cursor-pointer"
                        />
                        <div>
                          <div className="font-mono font-bold text-xs text-slate-900 tracking-wide">
                            {s.numero_serie}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {s.producto_nombre}
                          </div>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${isChecked ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-slate-200 text-slate-600 border-slate-300"
                        }`}>
                        {isChecked ? "Recibida" : "Faltante"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* PASO 4: RESUMEN Y PROCESAMIENTO CON DESCARGA DE EXCEL */}
          {tecnicoActual && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Ítems en Carro</span>
                  <span className="text-xl font-black text-slate-900">{totalEsperado}</span>
                </div>
                <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase block">Total Físico Recibido</span>
                  <span className="text-xl font-black text-emerald-800">{totalDevuelto}</span>
                </div>
                <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200">
                  <span className="text-[10px] font-bold text-rose-700 uppercase block">Total Faltantes</span>
                  <span className="text-xl font-black text-rose-800">{totalFaltante}</span>
                </div>
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-800 uppercase block">Series a Liberar a Central</span>
                  <span className="text-xl font-black text-amber-900">{totalSeriesSeleccionadas} equipos</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observaciones Generales para el Acta de Entrega:
                </label>
                <textarea
                  rows={2}
                  value={observacionesGenerales}
                  onChange={(e) => setObservacionesGenerales(e.target.value)}
                  placeholder="Ej: Se liquidó la totalidad de la dotación por renuncia. Queda  con Almacén Central."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="text-xs text-slate-400 font-medium">
                  💡 Al confirmar, se devolverá el inventario a Almacén Central y se descargará el Excel oficial para imprimir y firmar.
                </span>

                <button
                  type="button"
                  onClick={handleProcesarLiquidacion}
                  disabled={guardando}
                  className="px-6 py-3 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white rounded-2xl font-bold text-xs transition-all shadow-md shadow-emerald-700/20 flex items-center gap-2 cursor-pointer"
                >
                  {guardando ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Procesando Liquidación...</span>
                    </>
                  ) : (
                    <>
                      <Download size={15} />
                      <span>Procesar Liquidación & Descargar  (.xlsx)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. VISTA B: HISTORIAL DE CONSTANCIAS & AUDITORÍA
      ───────────────────────────────────────────────────────────── */}
      {subTab === "historial" && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden space-y-4">

          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <History size={16} className="text-slate-700" />
                Historial de Liquidaciones & Constancias Emitidas ({historial.length})
              </span>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Registro permanente de todas las devoluciones de dotación realizadas para auditoría y re-descarga.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  value={busquedaHistorial}
                  onChange={(e) => setBusquedaHistorial(e.target.value)}
                  placeholder="Buscar por técnico, placa o motivo..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={cargarHistorial}
                disabled={cargandoHistorial}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
                title="Refrescar historial"
              >
                <RefreshCw size={14} className={cargandoHistorial ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Nº Constancia</th>
                  <th className="py-3 px-4">Fecha & Hora</th>
                  <th className="py-3 px-4">Técnico / Conductor</th>
                  <th className="py-3 px-4">Cuadrilla / Vehículo</th>
                  <th className="py-3 px-4">Almacenero Receptor</th>
                  <th className="py-3 px-4">Motivo</th>
                  <th className="py-3 px-4 text-center">Ítems Devueltos</th>
                  <th className="py-3 px-4 text-center">Series</th>
                  <th className="py-3 px-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historialFiltrado.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                      {cargandoHistorial
                        ? "Cargando historial de liquidaciones..."
                        : "No se registran liquidaciones pasadas en la base de datos."}
                    </td>
                  </tr>
                ) : (
                  historialFiltrado.map((h, hIdx) => (
                    <tr key={hIdx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        LIQ-{String(h.id_liquidacion).padStart(5, "0")}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock size={12} className="text-slate-400" />
                          <span>{h.fecha_liquidacion ? h.fecha_liquidacion.replace("T", " ") : "-"}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {h.tecnico_nombre}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] font-bold text-slate-700 block">{h.cuadrilla}</span>
                        <span className="text-[10px] font-mono text-cyan-700 font-bold">{h.vehiculo_placa}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        {h.almacenero_nombre}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {h.motivo}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-700">
                        {h.total_items_devueltos}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-amber-700">
                        {h.total_series_devueltas}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleRedescargarExcel(h.id_liquidacion)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-[11px] inline-flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                          title="Descargar copia del Acta / en Excel"
                        >
                          <Download size={12} />
                          <span>(.xlsx)</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

    </div>
  );
};
