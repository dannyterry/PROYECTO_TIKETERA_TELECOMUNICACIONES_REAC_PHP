import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Scale,
  Search,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Calendar,
  Truck,
  Layers,
  History,
  Check,
  X,
  FileText,
  UserCheck,
  Clock,
  ArrowRight,
  TrendingDown,
  Building2,
  HelpCircle,
  Plus,
  Users,
  ClipboardCheck,
  Package,
  Save,
  ChevronRight,
  Sparkles,
  Info,
  Copy,
  Tag,
  ScanLine,
  BookOpen,
  CheckSquare,
  Square,
  Keyboard
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  TecnicoCruceItem,
  MaterialTecnicoCruce,
  TecnicoMaterialesResponse,
  SerieTecnicoInventario,
  RangoActaInventario,
  getCruceInventarioTecnicos,
  getMaterialesTecnicoCruce,
  guardarAuditoriaCruce,
  guardarInventarioLoteTecnico,
  importarExcelCruce,
  getHistorialCruceInventario,
  CruceHistorialResponse,
} from "../services/inventoryService";

export const InventoryReconciliationTab: React.FC = () => {
  // Pestañas principales de este módulo
  const [subTab, setSubTab] = useState<"cruce" | "inventario_tecnico" | "historial">("cruce");

  // Lista de técnicos con stock
  const [tecnicos, setTecnicos] = useState<TecnicoCruceItem[]>([]);
  const [cargando, setCargando] = useState(false);

  // Filtros de la Matriz General
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipoServicio, setFiltroTipoServicio] = useState("Todos");
  const [filtroRol, setFiltroRol] = useState("Todos");
  const [filtroEstadoCuadre, setFiltroEstadoCuadre] = useState("Todos");

  // ─────────────────────────────────────────────────────────────
  // ESTADO: INVENTARIO DETALLADO POR TÉCNICO (NUEVO WORKSPACE)
  // ─────────────────────────────────────────────────────────────
  const [tecnicoSeleccionadoId, setTecnicoSeleccionadoId] = useState<number | null>(null);
  const [tecnicoDetalle, setTecnicoDetalle] = useState<TecnicoCruceItem | null>(null);
  const [materialesTecnico, setMaterialesTecnico] = useState<MaterialTecnicoCruce[]>([]);
  const [categoriasTecnico, setCategoriasTecnico] = useState<string[]>([]);
  const [cargandoMateriales, setCargandoMateriales] = useState(false);

  // Filtros del técnico seleccionado
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [busquedaMaterial, setBusquedaMaterial] = useState("");
  const [soloConStock, setSoloConStock] = useState(false);

  // Valores de conteo por producto (id_producto -> valor)
  const [valoresFisico, setValoresFisico] = useState<Record<number, number | "">>({});
  const [valoresSobrante, setValoresSobrante] = useState<Record<number, number | "">>({});
  const [valoresObs, setValoresObs] = useState<Record<number, string>>({});
  const [guardandoLote, setGuardandoLote] = useState(false);

  // SERIES Y ACTAS
  const [seriesTecnico, setSeriesTecnico] = useState<SerieTecnicoInventario[]>([]);
  const [rangosActas, setRangosActas] = useState<RangoActaInventario[]>([]);
  const [seriesVerificadas, setSeriesVerificadas] = useState<Record<number, boolean>>({});
  const [inputPistola, setInputPistola] = useState('');
  const [mensajePistola, setMensajePistola] = useState<{ tipo: 'ok' | 'error' | 'dup'; texto: string } | null>(null);
  const pistolaRef = React.useRef<HTMLInputElement>(null);
  const [rangoPrefijoInput, setRangoPrefijoInput] = useState('');
  const [rangoInicioInput, setRangoInicioInput] = useState('');
  const [rangoFinInput, setRangoFinInput] = useState('');
  const [mensajeRango, setMensajeRango] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // Modal Auditoría Individual Rápida (para cuando auditan desde la tabla o botón rápido)
  const [modalAuditoria, setModalAuditoria] = useState<{
    isOpen: boolean;
    tecnico: TecnicoCruceItem | null;
  }>({ isOpen: false, tecnico: null });
  const [inputFisico, setInputFisico] = useState<number | "">("");
  const [inputSobrante, setInputSobrante] = useState<number | "">("");
  const [inputObs, setInputObs] = useState("");
  const [guardandoAudit, setGuardandoAudit] = useState(false);

  // Modal Importación Excel
  const [modalImportar, setModalImportar] = useState(false);
  const [filasExcel, setFilasExcel] = useState<any[]>([]);
  const [procesandoExcel, setProcesandoExcel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Historial de Devoluciones & Mermas
  const [historialData, setHistorialData] = useState<CruceHistorialResponse>({ devoluciones: [], auditorias: [] });
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [filtroHistClasificacion, setFiltroHistClasificacion] = useState("Todos");
  const [filtroHistDesde, setFiltroHistDesde] = useState("");
  const [filtroHistHasta, setFiltroHistHasta] = useState("");

  // Cargar técnicos generales
  const cargarTecnicos = async () => {
    try {
      setCargando(true);
      const data = await getCruceInventarioTecnicos({
        tipo_servicio: filtroTipoServicio !== "Todos" ? filtroTipoServicio : undefined,
        buscar: busqueda || undefined
      });
      setTecnicos(data || []);

      // Si no hay técnico seleccionado para el workspace individual, inicializar con el primero
      if (!tecnicoSeleccionadoId && data && data.length > 0) {
        setTecnicoSeleccionadoId(data[0].id_trabajador);
      }
    } catch (err) {
      console.error("Error al cargar técnicos para cruce:", err);
    } finally {
      setCargando(false);
    }
  };

  // Cargar materiales de un técnico específico
  const cargarMaterialesTecnico = async (idTrabajador: number) => {
    try {
      setCargandoMateriales(true);
      const res = await getMaterialesTecnicoCruce(idTrabajador);
      setTecnicoDetalle(res.tecnico);
      setMaterialesTecnico(res.materiales || []);
      setCategoriasTecnico(res.categorias || []);

      // Prellenar inputs con los valores previos de conteo o vacíos
      const initFisico: Record<number, number | ""> = {};
      const initSobrante: Record<number, number | ""> = {};
      const initObs: Record<number, string> = {};

      (res.materiales || []).forEach((m) => {
        initFisico[m.id_producto] = m.last_stock_fisico !== null && m.last_stock_fisico !== undefined
          ? Number(m.last_stock_fisico)
          : "";
        initSobrante[m.id_producto] = m.last_sobrante_devuelto !== null && m.last_sobrante_devuelto !== undefined
          ? Number(m.last_sobrante_devuelto)
          : 0;
        initObs[m.id_producto] = "";
      });

      setValoresFisico(initFisico);
      setValoresSobrante(initSobrante);
      setValoresObs(initObs);

      // Series y rangos de actas
      const initVerif: Record<number, boolean> = {};
      (res.series || []).forEach((s) => { initVerif[s.id_trabajador_serie] = false; });
      setSeriesTecnico(res.series || []);
      setSeriesVerificadas(initVerif);
      setRangosActas(res.rangos_actas || []);
      setInputPistola('');
      setMensajePistola(null);
      setRangoPrefijoInput('');
      setRangoInicioInput('');
      setRangoFinInput('');
      setMensajeRango(null);
    } catch (err) {
      console.error("Error al cargar materiales del técnico:", err);
    } finally {
      setCargandoMateriales(false);
    }
  };

  // Cargar historial
  const cargarHistorial = async () => {
    try {
      setCargandoHistorial(true);
      const data = await getHistorialCruceInventario({
        clasificacion: filtroHistClasificacion !== "Todos" ? filtroHistClasificacion : undefined,
        fecha_desde: filtroHistDesde || undefined,
        fecha_hasta: filtroHistHasta || undefined
      });
      setHistorialData(data);
    } catch (err) {
      console.error("Error al cargar historial:", err);
    } finally {
      setCargandoHistorial(false);
    }
  };

  useEffect(() => {
    cargarTecnicos();
  }, [filtroTipoServicio]);

  useEffect(() => {
    if (subTab === "historial") {
      cargarHistorial();
    } else if (subTab === "inventario_tecnico" && tecnicoSeleccionadoId) {
      cargarMaterialesTecnico(tecnicoSeleccionadoId);
    }
  }, [subTab, filtroHistClasificacion, filtroHistDesde, filtroHistHasta]);

  // Cuando cambia el técnico seleccionado en el workspace
  useEffect(() => {
    if (tecnicoSeleccionadoId && subTab === "inventario_tecnico") {
      cargarMaterialesTecnico(tecnicoSeleccionadoId);
    }
  }, [tecnicoSeleccionadoId]);

  // Técnicos filtrados en la Matriz General
  const tecnicosFiltrados = useMemo(() => {
    return tecnicos.filter((t) => {
      if (filtroRol !== "Todos") {
        const esSuper = t.rol_nombre.toUpperCase().includes("SUPERVIS");
        if (filtroRol === "TECNICOS" && esSuper) return false;
        if (filtroRol === "SUPERVISORES" && !esSuper) return false;
      }

      if (filtroEstadoCuadre !== "Todos") {
        const est = t.last_estado_cuadre || "PENDIENTE";
        if (filtroEstadoCuadre === "CUADRADO" && est !== "CUADRADO") return false;
        if (filtroEstadoCuadre === "FALTANTE" && est !== "FALTANTE") return false;
        if (filtroEstadoCuadre === "SOBRANTE" && est !== "SOBRANTE") return false;
        if (filtroEstadoCuadre === "PENDIENTE" && t.last_id_auditoria) return false;
      }

      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        const nom = (t.tecnico_nombre || "").toLowerCase();
        const dni = (t.dni || "").toLowerCase();
        const cuad = (t.cuadrilla || "").toLowerCase();
        const pla = (t.vehiculo_placa || "").toLowerCase();
        return nom.includes(q) || dni.includes(q) || cuad.includes(q) || pla.includes(q);
      }

      return true;
    });
  }, [tecnicos, filtroRol, filtroEstadoCuadre, busqueda]);

  // Materiales filtrados en el Workspace del Técnico
  const materialesFiltrados = useMemo(() => {
    return materialesTecnico.filter((m) => {
      if (filtroCategoria !== "Todas" && m.categoria !== filtroCategoria) {
        return false;
      }
      if (soloConStock && Number(m.stock_sistema || 0) <= 0) {
        return false;
      }
      if (busquedaMaterial.trim()) {
        const q = busquedaMaterial.toLowerCase().trim();
        const nom = (m.nombre || "").toLowerCase();
        const cod = (m.codigo || "").toLowerCase();
        const cat = (m.categoria || "").toLowerCase();
        return nom.includes(q) || cod.includes(q) || cat.includes(q);
      }
      return true;
    });
  }, [materialesTecnico, filtroCategoria, soloConStock, busquedaMaterial]);

  // KPIs Generales
  const kpis = useMemo(() => {
    let totalMetrosSistema = 0;
    let totalReutilizable = 0;
    let totalMerma = 0;
    let totalAuditados = 0;

    tecnicos.forEach((t) => {
      totalMetrosSistema += Number(t.stock_drop_sistema || 0);
      totalReutilizable += Number(t.total_historico_reutilizable || 0);
      totalMerma += Number(t.total_historico_merma || 0);
      if (t.last_id_auditoria) totalAuditados++;
    });

    return {
      totalMetrosSistema,
      totalReutilizable,
      totalMerma,
      totalAuditados,
      totalTecnicos: tecnicos.length,
      porcentajeAuditados: tecnicos.length > 0 ? Math.round((totalAuditados / tecnicos.length) * 100) : 0
    };
  }, [tecnicos]);

  // KPIs del Técnico en el Workspace
  const kpisTecnico = useMemo(() => {
    let totalItems = materialesTecnico.length;
    let itemsContados = 0;
    let totalDropSistema = 0;
    let totalDropFisico = 0;
    let totalDropSobrante = 0;
    let dropReutilizable = 0;
    let dropMerma = 0;

    materialesTecnico.forEach((m) => {
      const f = valoresFisico[m.id_producto];
      const s = Number(valoresSobrante[m.id_producto] || 0);
      if (f !== "" && f !== undefined) {
        itemsContados++;
      }

      if (m.es_drop) {
        totalDropSistema = Number(m.stock_sistema || 0);
        totalDropFisico = f !== "" && f !== undefined ? Number(f) : 0;
        totalDropSobrante = s;
        if (s >= 70) {
          dropReutilizable = s;
        } else if (s > 0) {
          dropMerma = s;
        }
      }
    });

    return {
      totalItems,
      itemsContados,
      totalDropSistema,
      totalDropFisico,
      totalDropSobrante,
      dropReutilizable,
      dropMerma
    };
  }, [materialesTecnico, valoresFisico, valoresSobrante]);

  // Abrir auditoría individual
  const abrirAuditoria = (t: TecnicoCruceItem | null) => {
    const tech = t || (tecnicos.length > 0 ? tecnicos[0] : null);
    setModalAuditoria({ isOpen: true, tecnico: tech });
    if (tech) {
      setInputFisico(tech.last_stock_fisico !== null && tech.last_stock_fisico !== undefined ? Number(tech.last_stock_fisico) : Number(tech.stock_drop_sistema || 0));
    } else {
      setInputFisico("");
    }
    setInputSobrante(0);
    setInputObs("");
  };

  // Ir directamente al workspace de inventario de este técnico
  const irAInventarioTecnico = (idTrabajador: number) => {
    setTecnicoSeleccionadoId(idTrabajador);
    setSubTab("inventario_tecnico");
  };

  // Guardar auditoría individual
  const handleGuardarAuditoria = async () => {
    if (!modalAuditoria.tecnico) return;
    if (inputFisico === "" || Number(inputFisico) < 0) {
      alert("Por favor ingresa una cantidad válida de metros físicos en camioneta.");
      return;
    }

    try {
      setGuardandoAudit(true);
      const res = await guardarAuditoriaCruce({
        id_trabajador: modalAuditoria.tecnico.id_trabajador,
        id_producto: modalAuditoria.tecnico.id_producto_drop || 55,
        stock_sistema: Number(modalAuditoria.tecnico.stock_drop_sistema) || 0,
        stock_fisico: Number(inputFisico) || 0,
        sobrante_devuelto: Number(inputSobrante) || 0,
        observaciones: inputObs,
        metodo: "MANUAL_INDIVIDUAL"
      });

      alert(res.message || "Auditoría registrada exitosamente.");
      setModalAuditoria({ isOpen: false, tecnico: null });
      cargarTecnicos();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || "Error al registrar auditoría.");
    } finally {
      setGuardandoAudit(false);
    }
  };

  // Guardar inventario completo del técnico seleccionado en el workspace
  const handleGuardarInventarioLote = async () => {
    if (!tecnicoDetalle) return;

    // Filtrar materiales que tienen valor físico ingresado o sobrante
    const itemsAGuardar = materialesTecnico
      .filter((m) => {
        const f = valoresFisico[m.id_producto];
        const s = valoresSobrante[m.id_producto];
        return (f !== "" && f !== undefined) || (s !== "" && Number(s) > 0);
      })
      .map((m) => ({
        id_producto: m.id_producto,
        stock_sistema: Number(m.stock_sistema || 0),
        stock_fisico: Number(valoresFisico[m.id_producto] !== "" ? valoresFisico[m.id_producto] : m.stock_sistema),
        sobrante_devuelto: Number(valoresSobrante[m.id_producto] || 0),
        es_drop: Boolean(m.es_drop),
        observaciones: valoresObs[m.id_producto] || ""
      }));

    if (itemsAGuardar.length === 0) {
      alert("No has ingresado ningún conteo físico para guardar. Ingresa los valores o haz clic en 'Copiar Stock de Sistema a Físico' para confirmar que todo coincide.");
      return;
    }

    try {
      setGuardandoLote(true);
      const res = await guardarInventarioLoteTecnico({
        id_trabajador: tecnicoDetalle.id_trabajador,
        items: itemsAGuardar,
        observaciones_generales: "Auditoría de inventario registrada desde módulo web"
      });

      alert(res.message || "Inventario de técnico guardado exitosamente.");
      cargarMaterialesTecnico(tecnicoDetalle.id_trabajador);
      cargarTecnicos();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || "Error al guardar inventario.");
    } finally {
      setGuardandoLote(false);
    }
  };

  // Función rápida: Copiar Stock Sistema a Físico en todos los materiales mostrados
  // ── HANDLER: Pistolear S/N de equipo ─────────────────────────────────────
  const handlePistolearSerie = (rawInput: string) => {
    const sn = rawInput.trim().toUpperCase();
    if (!sn) return;
    const serie = seriesTecnico.find(
      (s) =>
        (s.numero_serie || '').trim().toUpperCase() === sn ||
        (s.proid || '').trim().toUpperCase() === sn
    );
    if (!serie) {
      setMensajePistola({ tipo: 'error', texto: `S/N "${sn}" no está asignado a este técnico` });
      setInputPistola('');
      return;
    }
    if (seriesVerificadas[serie.id_trabajador_serie]) {
      setMensajePistola({ tipo: 'dup', texto: `S/N "${sn}" ya fue escaneado ✓` });
      setInputPistola('');
      return;
    }
    const nuevaVerif = { ...seriesVerificadas, [serie.id_trabajador_serie]: true };
    setSeriesVerificadas(nuevaVerif);
    const conteo = seriesTecnico
      .filter((s) => s.id_producto === serie.id_producto)
      .filter((s) => nuevaVerif[s.id_trabajador_serie])
      .length;
    setValoresFisico((prev) => ({ ...prev, [serie.id_producto]: conteo }));
    setMensajePistola({ tipo: 'ok', texto: `✓ ${serie.equipo_nombre} — S/N ${sn}` });
    setInputPistola('');
    setTimeout(() => setMensajePistola(null), 3000);
  };

  // ── HANDLER: Toggle manual de serie ──────────────────────────────────────
  const handleToggleSerie = (s: SerieTecnicoInventario) => {
    const nuevaVerif = { ...seriesVerificadas, [s.id_trabajador_serie]: !seriesVerificadas[s.id_trabajador_serie] };
    setSeriesVerificadas(nuevaVerif);
    const conteo = seriesTecnico
      .filter((x) => x.id_producto === s.id_producto)
      .filter((x) => nuevaVerif[x.id_trabajador_serie])
      .length;
    setValoresFisico((prev) => ({ ...prev, [s.id_producto]: conteo }));
  };

  // ── HANDLER: Marcar/desmarcar todas del producto ─────────────────────────
  const handleMarcarTodasSeries = (idProducto: number, marcar: boolean) => {
    const actualizado = { ...seriesVerificadas };
    seriesTecnico
      .filter((s) => s.id_producto === idProducto)
      .forEach((s) => { actualizado[s.id_trabajador_serie] = marcar; });
    setSeriesVerificadas(actualizado);
    const conteo = marcar ? seriesTecnico.filter((s) => s.id_producto === idProducto).length : 0;
    setValoresFisico((prev) => ({ ...prev, [idProducto]: conteo }));
  };

  // ── HANDLER: Aplicar rango de actas ──────────────────────────────────────
  const handleAplicarRangoActas = () => {
    const ini = parseInt(rangoInicioInput.trim(), 10);
    const fin = parseInt(rangoFinInput.trim(), 10);
    if (isNaN(ini) || isNaN(fin) || ini > fin) {
      setMensajeRango({ tipo: 'error', texto: 'Rango inválido: inicio debe ser ≤ fin y ambos numéricos' });
      return;
    }
    const cantidad = fin - ini + 1;
    const prodActas = materialesTecnico.find(
      (m) => m.es_acta || (m.codigo || '').toUpperCase().includes('ACT')
    );
    if (!prodActas) {
      setMensajeRango({ tipo: 'error', texto: 'No se encontró el producto ACTAS en este técnico' });
      return;
    }
    setValoresFisico((prev) => ({ ...prev, [prodActas.id_producto]: cantidad }));
    const prefStr = rangoPrefijoInput ? rangoPrefijoInput + '-' : '';
    setMensajeRango({
      tipo: 'ok',
      texto: `✓ Rango aplicado: ${cantidad} actas (${prefStr}${rangoInicioInput} al ${prefStr}${rangoFinInput})`,
    });
    setTimeout(() => setMensajeRango(null), 4000);
  };


  const handleCopiarStockTodos = () => {
    const nuevosFisico = { ...valoresFisico };
    materialesFiltrados.forEach((m) => {
      nuevosFisico[m.id_producto] = Number(m.stock_sistema || 0);
    });
    setValoresFisico(nuevosFisico);
  };

  // 📥 Descargar Plantilla Excel EN BLANCO para Auditoría en Campo (Auditoría a Ciegas)
  // "ellos no tienen que ver la cantidad de stock en el sistema, solo se contabiliza cuando se sube al sistema"
  const descargarPlantillaExcel = (tipo: "todos" | "tecnico_actual" = "todos") => {
    let dataFilas: any[] = [];

    if (tipo === "tecnico_actual" && tecnicoDetalle && materialesTecnico.length > 0) {
      // Exporta todos los materiales de este técnico específico EN BLANCO
      dataFilas = materialesTecnico.map((m) => ({
        ID_TRABAJADOR: tecnicoDetalle.id_trabajador,
        DNI: tecnicoDetalle.dni || "",
        TECNICO_RESPONSABLE: tecnicoDetalle.tecnico_nombre,
        CUADRILLA: tecnicoDetalle.cuadrilla || "",
        VEHICULO_PLACA: tecnicoDetalle.vehiculo_placa || "",
        TIPO_SERVICIO: tecnicoDetalle.tipo_servicio || "",
        CATEGORIA: m.categoria,
        CODIGO_MATERIAL: m.codigo,
        MATERIAL: m.nombre + (m.es_drop ? " (BOBINA METROS)" : ""),
        UNIDAD_MEDIDA: m.unidad_medida,
        FISICO_EN_CAMIONETA: "", // EN BLANCO: auditor llena en campo
        SOBRANTE_DEVUELTO: "",   // EN BLANCO: para retazo o sobrante
        OBSERVACIONES: ""
      }));
    } else {
      // Exporta para todos los técnicos activos EN BLANCO
      if (!tecnicos || tecnicos.length === 0) {
        alert("No hay técnicos cargados todavía. Por favor espere un momento o presione Actualizar.");
        return;
      }

      dataFilas = tecnicos.map((t) => ({
        ID_TRABAJADOR: t.id_trabajador,
        DNI: t.dni || "",
        TECNICO_RESPONSABLE: t.tecnico_nombre,
        CUADRILLA: t.cuadrilla || "",
        VEHICULO_PLACA: t.vehiculo_placa || "",
        TIPO_SERVICIO: t.tipo_servicio || "",
        CATEGORIA: "MATERIALES",
        CODIGO_MATERIAL: "MAT-DRP",
        MATERIAL: "CABLE DROP EN BOBINA (METROS)",
        UNIDAD_MEDIDA: "Metros",
        FISICO_EN_CAMIONETA: "", // EN BLANCO
        SOBRANTE_DEVUELTO: "",   // EN BLANCO
        OBSERVACIONES: ""
      }));
    }

    const ws = XLSX.utils.json_to_sheet(dataFilas);

    // Ajustar anchos de columnas
    ws["!cols"] = [
      { wch: 14 }, // ID_TRABAJADOR
      { wch: 12 }, // DNI
      { wch: 32 }, // TECNICO_RESPONSABLE
      { wch: 18 }, // CUADRILLA
      { wch: 16 }, // VEHICULO_PLACA
      { wch: 16 }, // TIPO_SERVICIO
      { wch: 18 }, // CATEGORIA
      { wch: 16 }, // CODIGO_MATERIAL
      { wch: 36 }, // MATERIAL
      { wch: 14 }, // UNIDAD_MEDIDA
      { wch: 24 }, // FISICO_EN_CAMIONETA
      { wch: 22 }, // SOBRANTE_DEVUELTO
      { wch: 34 }  // OBSERVACIONES
    ];

    const wb = XLSX.utils.book_new();
    const sheetName = tipo === "tecnico_actual" && tecnicoDetalle
      ? `Auditoria_${tecnicoDetalle.tecnico_nombre.slice(0, 18).replace(/\s+/g, "_")}`
      : "Conteo_Fisico_Campo";

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const fechaStr = new Date().toISOString().slice(0, 10);
    const fileName = tipo === "tecnico_actual" && tecnicoDetalle
      ? `Plantilla_Conteo_${tecnicoDetalle.tecnico_nombre.replace(/\s+/g, "_")}_${fechaStr}.xlsx`
      : `Plantilla_Conteo_Fisico_Campo_${fechaStr}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  // 📤 Leer archivo Excel importado y hacer el CRUCE automático contra el sistema
  const handleLeerExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const dataJson: any[] = XLSX.utils.sheet_to_json(ws);

        if (!dataJson || dataJson.length === 0) {
          alert("El archivo no contiene filas o está vacío.");
          return;
        }

        // Mapear filas y realizar el cruce contra el sistema
        const procesadas = dataJson.map((r) => {
          const id_trabajador = Number(r.ID_TRABAJADOR || r.id_trabajador || 0);
          const dni = String(r.DNI || r.dni || "").trim();
          const nombre = String(r.TECNICO_RESPONSABLE || r.nombre || r.tecnico || "").trim();
          const stock_fisico = Number(r.FISICO_EN_CAMIONETA || r.stock_fisico || r.metros_fisicos || r.METROS_FISICOS_CAMIONETA || 0);
          const sobrante_devuelto = Number(r.SOBRANTE_DEVUELTO || r.sobrante_devuelto || r.metros_sobrantes || r.METROS_SOBRANTE_DEVUELTO || 0);
          const observaciones = String(r.OBSERVACIONES || r.observaciones || "");
          const materialNombre = String(r.MATERIAL || r.material || "CABLE DROP EN BOBINA").trim();

          // Buscar match con técnico del sistema
          const techEncontrado = tecnicos.find(
            (t) =>
              (id_trabajador && t.id_trabajador === id_trabajador) ||
              (dni && t.dni === dni) ||
              (nombre && t.tecnico_nombre.toUpperCase().includes(nombre.toUpperCase()))
          );

          // Stock real en el sistema (lo calcula el sistema, el técnico no lo veía en el excel)
          const stock_sistema = techEncontrado ? Number(techEncontrado.stock_drop_sistema) : 0;
          const dif = (stock_fisico + sobrante_devuelto) - stock_sistema;

          return {
            id_trabajador: techEncontrado ? techEncontrado.id_trabajador : id_trabajador,
            dni: techEncontrado ? techEncontrado.dni : dni,
            nombre: techEncontrado ? techEncontrado.tecnico_nombre : nombre,
            cuadrilla: techEncontrado ? techEncontrado.cuadrilla : "",
            material: materialNombre,
            stock_sistema,
            stock_fisico,
            sobrante_devuelto,
            observaciones,
            diferencia: dif,
            estado: dif === 0 ? "CUADRADO" : (dif < 0 ? "FALTANTE" : "SOBRANTE"),
            esReutilizable: sobrante_devuelto >= 70,
            esMerma: sobrante_devuelto > 0 && sobrante_devuelto < 70
          };
        });

        setFilasExcel(procesadas);
        setModalImportar(true);
      } catch (err: any) {
        alert("Error al leer el archivo Excel: " + err.message);
      }
    };

    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Confirmar y aplicar importación masiva del cruce
  const handleAplicarImportacion = async () => {
    if (filasExcel.length === 0) return;
    try {
      setProcesandoExcel(true);
      const res = await importarExcelCruce(filasExcel, 55);
      alert(res.message || "Importación completada con éxito.");
      setModalImportar(false);
      setFilasExcel([]);
      cargarTecnicos();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || "Error al procesar importación masiva.");
    } finally {
      setProcesandoExcel(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER & KPIS GLOBALES
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Drop Total en Sistema */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              DROP EN CAMIONETAS
            </span>
            <span className="text-xl font-black font-mono text-slate-900 mt-1 block">
              {kpis.totalMetrosSistema.toLocaleString()} <span className="text-xs font-bold text-slate-500">metros</span>
            </span>
            <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
              {kpis.totalTecnicos} técnicos & supervisores
            </span>
          </div>
          <div className="p-3 bg-cyan-50 border border-cyan-100 rounded-2xl text-cyan-700">
            <Truck size={22} />
          </div>
        </div>

        {/* KPI 2: Retornos Reutilizables (>= 70m) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
              SALDO REUTILIZABLE (≥70M)
            </span>
            <span className="text-xl font-black font-mono text-emerald-800 mt-1 block">
              {kpis.totalReutilizable.toLocaleString()} <span className="text-xs font-bold text-emerald-800">m</span>
            </span>
            <span className="text-[10px] text-emerald-800 font-semibold block mt-0.5">
              Retornado a Almacén Central
            </span>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700">
            <Layers size={22} />
          </div>
        </div>

        {/* KPI 3: Merma Registrada (< 70m) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">
              MERMA REGISTRADA (&lt;70M)
            </span>
            <span className="text-xl font-black font-mono text-rose-800 mt-1 block">
              {kpis.totalMerma.toLocaleString()} <span className="text-xs font-bold text-rose-800">m</span>
            </span>
            <span className="text-[10px] text-rose-800 font-semibold block mt-0.5">
              Retazos dados de baja
            </span>
          </div>
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700">
            <TrendingDown size={22} />
          </div>
        </div>

        {/* KPI 4: Cuadres Auditados */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider block">
              CUADRES AUDITADOS
            </span>
            <span className="text-xl font-black font-mono text-indigo-900 mt-1 block">
              {kpis.totalAuditados} <span className="text-xs font-bold text-slate-500">/ {kpis.totalTecnicos}</span>
            </span>
            <span className="text-[10px] text-indigo-700 font-semibold block mt-0.5">
              {kpis.porcentajeAuditados}% de cobertura
            </span>
          </div>
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-700">
            <Scale size={22} />
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. NAVEGACIÓN ENTRE VISTAS & ACCIONES EXCEL
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {/* Tabs Selector */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-2xl">
            <button
              type="button"
              onClick={() => setSubTab("cruce")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                subTab === "cruce"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Users size={15} />
              Matriz General de Técnicos ({tecnicos.length})
            </button>

            <button
              type="button"
              onClick={() => setSubTab("inventario_tecnico")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                subTab === "inventario_tecnico"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ClipboardCheck size={15} />
              Inventario Detallado por Técnico
              {tecnicoDetalle && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-mono">
                  {tecnicoDetalle.tecnico_nombre.split(" ")[0]}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSubTab("historial")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                subTab === "historial"
                  ? "bg-slate-700 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <History size={15} />
              Historial de Cruces & Devoluciones
            </button>
          </div>

          {/* Botones de Acción */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLeerExcel}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />

            {/* Descargar Plantilla en Blanco para conteo a ciegas */}
            <div className="relative inline-flex items-center">
              <button
                type="button"
                onClick={() => descargarPlantillaExcel(subTab === "inventario_tecnico" ? "tecnico_actual" : "todos")}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Descarga la plantilla en blanco (sin stock de sistema visible) para conteo físico en campo"
              >
                <FileSpreadsheet size={15} className="text-emerald-700" />
                <span>
                  {subTab === "inventario_tecnico" ? "📥 Plantilla Este Técnico (En Blanco)" : "📥 Plantilla General (En Blanco)"}
                </span>
              </button>
            </div>

            {/* Subir archivo Excel e importar cruce */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Subir archivo Excel con los conteos físicos para realizar el cruce automático"
            >
              <Upload size={15} />
              <span>Importar Auditoría Excel</span>
            </button>

            {/* Botón Nuevo Cuadre Rápido */}
            <button
              type="button"
              onClick={() => abrirAuditoria(null)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Registrar auditoría manual rápida de Drop"
            >
              <Plus size={15} />
              <span>Cuadre Rápido</span>
            </button>

            <button
              type="button"
              onClick={() => {
                cargarTecnicos();
                if (subTab === "inventario_tecnico" && tecnicoSeleccionadoId) {
                  cargarMaterialesTecnico(tecnicoSeleccionadoId);
                }
              }}
              disabled={cargando || cargandoMateriales}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
              title="Actualizar datos"
            >
              <RefreshCw size={15} className={cargando || cargandoMateriales ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            SUB-VISTA 1: MATRIZ GENERAL DE TÉCNICOS
        ───────────────────────────────────────────────────────────── */}
        {subTab === "cruce" && (
          <div className="space-y-4">
            {/* Barra de Filtros de la Matriz General */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
              <div className="relative md:col-span-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por técnico, DNI, cuadrilla..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <select
                  value={filtroTipoServicio}
                  onChange={(e) => setFiltroTipoServicio(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-none"
                >
                  <option value="Todos">Servicio: Todos los Servicios</option>
                  <option value="ORDENAMIENTO">ORDENAMIENTO</option>
                  <option value="AVERIAS">AVERIAS</option>
                  <option value="POST VENTA">POST VENTA</option>
                  <option value="MOTO WIN">MOTO WIN</option>
                  <option value="GENERAL">GENERAL</option>
                </select>
              </div>

              <div>
                <select
                  value={filtroRol}
                  onChange={(e) => setFiltroRol(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-none"
                >
                  <option value="Todos">Rol: Técnicos & Supervisores</option>
                  <option value="TECNICOS">Sólo Técnicos</option>
                  <option value="SUPERVISORES">Sólo Supervisores</option>
                </select>
              </div>

              <div>
                <select
                  value={filtroEstadoCuadre}
                  onChange={(e) => setFiltroEstadoCuadre(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-none"
                >
                  <option value="Todos">Cuadre: Todos los Estados</option>
                  <option value="CUADRADO">🟢 Cuadrados</option>
                  <option value="FALTANTE">🔴 Con Faltante</option>
                  <option value="SOBRANTE">🟡 Con Sobrante</option>
                  <option value="PENDIENTE">⚪ Sin Auditar</option>
                </select>
              </div>
            </div>

            {/* Banner Informativo */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-3">
              <Info size={18} className="text-amber-700 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-900 leading-relaxed font-medium">
                <span className="font-extrabold text-amber-950">Regla Oficial de Retorno de Bobinas Drop:</span> Las devoluciones de cable Drop en bobina $\ge 70$ metros ingresan a Almacén Central como stock reutilizable para ser reasignadas. Si la devolución es $&lt; 70$ metros, se clasifica automáticamente como <strong>Merma</strong> y no incrementa el stock útil.
              </div>
            </div>

            {/* Tabla Matriz */}
            <div className="w-full overflow-x-auto touch-pan-x border border-slate-200 rounded-2xl">
              <table className="w-full min-w-[1050px] text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Técnico / Responsable</th>
                    <th className="py-3 px-4 text-center">Material</th>
                    <th className="py-3 px-4">Cuadrilla / Móvil</th>
                    <th className="py-3 px-4">Tipo Servicio</th>
                    <th className="py-3 px-4 text-center">Stock Sistema (Drop)</th>
                    <th className="py-3 px-4 text-center">Físico en Carro</th>
                    <th className="py-3 px-4 text-center">Sobrante Devuelto</th>
                    <th className="py-3 px-4 text-center">Diferencia / Cuadre</th>
                    <th className="py-3 px-4 text-center">Última Auditoría</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {cargando ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                        Cargando técnicos para auditoría de inventario...
                      </td>
                    </tr>
                  ) : tecnicosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                        No se encontraron técnicos con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    tecnicosFiltrados.map((t) => {
                      const fueAuditado = Boolean(t.last_id_auditoria);
                      const dif = t.last_diferencia || 0;
                      const est = t.last_estado_cuadre || "PENDIENTE";

                      return (
                        <tr key={t.id_trabajador} className="hover:bg-slate-50/70 transition-colors">
                          {/* Técnico */}
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span>{t.tecnico_nombre}</span>
                                  <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-extrabold border ${
                                    t.rol_nombre.toUpperCase().includes("SUPERVIS")
                                      ? "bg-purple-50 text-purple-700 border-purple-200"
                                      : "bg-blue-50 text-blue-700 border-blue-200"
                                  }`}>
                                    {t.rol_nombre}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-600 font-mono block">
                                  DNI: {t.dni || "S/D"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Material */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-extrabold bg-cyan-50 text-cyan-800 border border-cyan-200">
                              Cable Drop Bobina
                            </span>
                          </td>

                          {/* Cuadrilla / Móvil */}
                          <td className="py-3.5 px-4">
                            <span className="text-[11px] font-bold text-slate-700 block">{t.cuadrilla || "S/C"}</span>
                            <span className="text-[10px] font-mono text-cyan-700 font-semibold">{t.vehiculo_placa}</span>
                          </td>

                          {/* Tipo Servicio */}
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {t.tipo_servicio}
                            </span>
                          </td>

                          {/* Stock Sistema */}
                          <td className="py-3.5 px-4 text-center font-mono font-black text-slate-900">
                            <span className="px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-xs">
                              {Number(t.stock_drop_sistema || 0)} m
                            </span>
                          </td>

                          {/* Físico en Carro */}
                          <td className="py-3.5 px-4 text-center font-mono font-bold">
                            {fueAuditado ? (
                              <span className="text-cyan-800 text-xs font-black">
                                {Number(t.last_stock_fisico || 0)} m
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">Sin conteo</span>
                            )}
                          </td>

                          {/* Sobrante Devuelto */}
                          <td className="py-3.5 px-4 text-center">
                            {fueAuditado && Number(t.last_sobrante_devuelto || 0) > 0 ? (
                              <div className="inline-flex items-center gap-1">
                                {Number(t.last_metros_reutilizables || 0) > 0 && (
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    +{t.last_metros_reutilizables}m Reutilizable
                                  </span>
                                )}
                                {Number(t.last_metros_merma || 0) > 0 && (
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                    {t.last_metros_merma}m Merma
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>

                          {/* Diferencia / Cuadre */}
                          <td className="py-3.5 px-4 text-center">
                            {!fueAuditado ? (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600">
                                Pendiente
                              </span>
                            ) : est === "CUADRADO" ? (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                ✓ Cuadrado
                              </span>
                            ) : est === "FALTANTE" ? (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                                Faltante ({dif}m)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                                Sobrante (+{dif}m)
                              </span>
                            )}
                          </td>

                          {/* Última Auditoría */}
                          <td className="py-3.5 px-4 text-center text-slate-600 text-[10px]">
                            {t.last_fecha_auditoria ? (
                              <span>{new Date(t.last_fecha_auditoria).toLocaleDateString()}</span>
                            ) : (
                              <span className="text-slate-400 italic">Nunca</span>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => irAInventarioTecnico(t.id_trabajador)}
                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                title="Ver todos sus materiales e inventariar"
                              >
                                <Package size={13} />
                                <span>Inventariar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => abrirAuditoria(t)}
                                className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                                title="Cuadre rápido individual de Drop"
                              >
                                Rápido
                              </button>
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
        )}

        {/* ─────────────────────────────────────────────────────────────
            SUB-VISTA 2: INVENTARIO DETALLADO POR TÉCNICO (WORKSPACE)
        ───────────────────────────────────────────────────────────── */}
        {subTab === "inventario_tecnico" && (
          <div className="space-y-5">
            {/* 1. Selector de Técnico Principal & Datos del Móvil */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                    Seleccionar Técnico o Supervisor para Inventario:
                  </label>
                  <select
                    value={tecnicoSeleccionadoId || ""}
                    onChange={(e) => setTecnicoSeleccionadoId(Number(e.target.value))}
                    className="w-full max-w-xl px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer"
                  >
                    {tecnicos.map((t) => (
                      <option key={t.id_trabajador} value={t.id_trabajador}>
                        {t.tecnico_nombre} • {t.cuadrilla || "Sin Cuadrilla"} • Placa: {t.vehiculo_placa} ({t.tipo_servicio})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Botón Guardar Todo el Inventario */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopiarStockTodos}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Copia el stock teórico a físico en todos los materiales para confirmar coincidencia"
                  >
                    <Copy size={14} />
                    <span>Igualar Sistema a Físico</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGuardarInventarioLote}
                    disabled={guardandoLote || cargandoMateriales}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Save size={15} />
                    <span>{guardandoLote ? "Guardando..." : "💾 Guardar Inventario Completo"}</span>
                  </button>
                </div>
              </div>

              {/* Ficha Resumen del Técnico Seleccionado */}
              {tecnicoDetalle && (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-2 border-t border-slate-200/80 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-600 font-bold block">DNI:</span>
                    <span className="font-mono font-black text-slate-800">{tecnicoDetalle.dni || "S/D"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-600 font-bold block">Cuadrilla:</span>
                    <span className="font-bold text-slate-800">{tecnicoDetalle.cuadrilla || "S/C"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-600 font-bold block">Vehículo / Placa:</span>
                    <span className="font-mono font-bold text-cyan-800">{tecnicoDetalle.vehiculo_placa}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-600 font-bold block">Servicio:</span>
                    <span className="font-bold text-slate-800">{tecnicoDetalle.tipo_servicio}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-600 font-bold block">Stock Drop Sistema:</span>
                    <span className="font-mono font-black text-indigo-700">{Number(tecnicoDetalle.stock_drop_sistema || 0)} m</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-600 font-bold block">Materiales Auditados:</span>
                    <span className="font-black text-emerald-800">
                      {kpisTecnico.itemsContados} / {kpisTecnico.totalItems}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Filtros de Categorías & Búsqueda de Materiales */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Chips de Categorías */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFiltroCategoria("Todas")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    filtroCategoria === "Todas"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Todas las Categorías ({materialesTecnico.length})
                </button>

                {categoriasTecnico.map((cat) => {
                  const count = materialesTecnico.filter((m) => m.categoria === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFiltroCategoria(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        filtroCategoria === cat
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      <Tag size={12} />
                      <span>{cat}</span>
                      <span className="text-[10px] opacity-75 font-mono">({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Búsqueda de Material y Toggle de Stock */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={busquedaMaterial}
                    onChange={(e) => setBusquedaMaterial(e.target.value)}
                    placeholder="Filtrar material..."
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                  />
                </div>

                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={soloConStock}
                    onChange={(e) => setSoloConStock(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Solo con stock &gt; 0</span>
                </label>
              </div>
            </div>

            {/* 3A. SECCIÓN PISTOLEO DE EQUIPOS SERIALIZADOS */}
            {seriesTecnico.filter((s) => !s.es_acta).length > 0 && (
              <div className="border border-violet-200 rounded-2xl bg-violet-50/40 overflow-hidden">
                <div className="bg-violet-600 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <ScanLine size={16} />
                    <span className="font-black text-sm">Escaneo de Equipos Serializados</span>
                    <span className="text-violet-200 text-xs font-bold">
                      ({seriesTecnico.filter((s) => !s.es_acta && seriesVerificadas[s.id_trabajador_serie]).length} / {seriesTecnico.filter((s) => !s.es_acta).length} verificados)
                    </span>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {/* Input pistola */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-sm">
                      <Keyboard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400" />
                      <input
                        ref={pistolaRef}
                        type="text"
                        value={inputPistola}
                        onChange={(e) => setInputPistola(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handlePistolearSerie(inputPistola); }}
                        placeholder="Escanear o escribir S/N y presionar Enter..."
                        className="w-full pl-9 pr-3 py-2 bg-white border border-violet-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
                        autoComplete="off"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePistolearSerie(inputPistola)}
                      className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 size={14} /> Verificar
                    </button>
                  </div>
                  {mensajePistola && (
                    <div className={
                      'text-xs font-bold px-3 py-1.5 rounded-lg ' +
                      (mensajePistola.tipo === 'ok'
                        ? 'bg-emerald-100 text-emerald-800'
                        : mensajePistola.tipo === 'dup'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800')
                    }>
                      {mensajePistola.texto}
                    </div>
                  )}
                  {/* Grid de series por producto */}
                  {Array.from(
                    new Set(seriesTecnico.filter((s) => !s.es_acta).map((s) => s.id_producto))
                  ).map((idProd) => {
                    const seriesProd = seriesTecnico.filter((s) => !s.es_acta && s.id_producto === idProd);
                    const verificadasProd = seriesProd.filter((s) => seriesVerificadas[s.id_trabajador_serie]);
                    const todasMarcadas = verificadasProd.length === seriesProd.length;
                    return (
                      <div key={idProd} className="bg-white border border-violet-100 rounded-xl overflow-hidden">
                        <div className="bg-violet-100 px-3 py-2 flex items-center justify-between">
                          <span className="text-xs font-black text-violet-900">
                            {seriesProd[0]?.equipo_nombre || 'Equipo'}
                            <span className="ml-2 font-mono text-violet-600">
                              ({verificadasProd.length}/{seriesProd.length})
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleMarcarTodasSeries(idProd, !todasMarcadas)}
                            className="text-[10px] font-black text-violet-700 hover:text-violet-900 flex items-center gap-1 cursor-pointer"
                          >
                            {todasMarcadas ? <CheckSquare size={13} /> : <Square size={13} />}
                            {todasMarcadas ? 'Desmarcar todas' : 'Marcar todas'}
                          </button>
                        </div>
                        <div className="p-2 flex flex-wrap gap-1.5">
                          {seriesProd.map((s) => (
                            <button
                              key={s.id_trabajador_serie}
                              type="button"
                              onClick={() => handleToggleSerie(s)}
                              title={s.mac ? 'MAC: ' + s.mac : s.numero_serie}
                              className={
                                'px-2 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer flex items-center gap-1 ' +
                                (seriesVerificadas[s.id_trabajador_serie]
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300')
                              }
                            >
                              {seriesVerificadas[s.id_trabajador_serie] ? <Check size={10} /> : <X size={10} />}
                              {s.numero_serie}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3B. SECCIÓN TALONARIO DE ACTAS */}
            {materialesTecnico.some(
              (m) => m.es_acta || (m.codigo || '').toUpperCase().includes('ACT')
            ) && (
              <div className="border border-amber-200 rounded-2xl bg-amber-50/40 overflow-hidden">
                <div className="bg-amber-500 px-4 py-2.5 flex items-center gap-2 text-white">
                  <BookOpen size={16} />
                  <span className="font-black text-sm">Talonario de Actas</span>
                  <span className="text-amber-100 text-xs font-bold">
                    — Ingresa el rango físico para actualizar el conteo
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  {/* Rangos en sistema */}
                  {rangosActas.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider">
                        Rangos en sistema:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {rangosActas.map((r, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-[10px] font-mono font-bold"
                          >
                            {r.rango_texto} ({r.cantidad} actas)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Inputs para rango físico */}
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-black text-amber-800 block">Prefijo</label>
                      <input
                        type="text"
                        value={rangoPrefijoInput}
                        onChange={(e) => setRangoPrefijoInput(e.target.value)}
                        placeholder="001"
                        className="w-20 px-2 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-black text-amber-800 block">Desde #</label>
                      <input
                        type="number"
                        value={rangoInicioInput}
                        onChange={(e) => setRangoInicioInput(e.target.value)}
                        placeholder="45001"
                        className="w-28 px-2 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-black text-amber-800 block">Hasta #</label>
                      <input
                        type="number"
                        value={rangoFinInput}
                        onChange={(e) => setRangoFinInput(e.target.value)}
                        placeholder="45500"
                        className="w-28 px-2 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAplicarRangoActas}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowRight size={13} /> Aplicar Conteo
                    </button>
                    {rangoInicioInput &&
                      rangoFinInput &&
                      !isNaN(parseInt(rangoInicioInput)) &&
                      !isNaN(parseInt(rangoFinInput)) &&
                      parseInt(rangoFinInput) >= parseInt(rangoInicioInput) && (
                        <span className="text-xs font-black text-amber-700 bg-amber-100 px-2.5 py-1.5 rounded-lg border border-amber-300">
                          = {parseInt(rangoFinInput) - parseInt(rangoInicioInput) + 1} actas
                        </span>
                      )}
                  </div>
                  {mensajeRango && (
                    <div
                      className={
                        'text-xs font-bold px-3 py-1.5 rounded-lg ' +
                        (mensajeRango.tipo === 'ok'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800')
                      }
                    >
                      {mensajeRango.texto}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. Grid / Tabla de Materiales del Técnico Seleccionado */}
            <div className="w-full overflow-x-auto touch-pan-x border border-slate-200 rounded-2xl">
              <table className="w-full min-w-[1000px] text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Categoría</th>
                    <th className="py-3 px-3">Código</th>
                    <th className="py-3 px-4">Producto / Material</th>
                    <th className="py-3 px-3 text-center">Unidad</th>
                    <th className="py-3 px-3 text-center bg-slate-200/60 text-slate-900">
                      Stock Sistema
                    </th>
                    <th className="py-3 px-4 text-center bg-indigo-50/70 text-indigo-900">
                      Físico en Camioneta
                    </th>
                    <th className="py-3 px-4 text-center bg-amber-50/70 text-amber-900">
                      Sobrante Devuelto
                    </th>
                    <th className="py-3 px-3 text-center">Diferencia</th>
                    <th className="py-3 px-3 text-center">Estado</th>
                    <th className="py-3 px-3">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {cargandoMateriales ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                        Cargando materiales del técnico...
                      </td>
                    </tr>
                  ) : materialesFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                        No se encontraron materiales para este técnico con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    materialesFiltrados.map((m) => {
                      const stockSis = Number(m.stock_sistema || 0);
                      const valorFis = valoresFisico[m.id_producto];
                      const valorSob = Number(valoresSobrante[m.id_producto] || 0);
                      const nFis = valorFis !== "" && valorFis !== undefined ? Number(valorFis) : stockSis;
                      const dif = (nFis + valorSob) - stockSis;
                      const esDrop = Boolean(m.es_drop);

                      return (
                        <tr
                          key={m.id_producto}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            esDrop ? "bg-cyan-50/20" : ""
                          }`}
                        >
                          {/* Categoría */}
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                              {m.categoria}
                            </span>
                          </td>

                          {/* Código */}
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-600 text-[10px]">
                            {m.codigo || "-"}
                          </td>

                          {/* Nombre Material */}
                          <td className="py-2.5 px-4 font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span>{m.nombre}</span>
                              {esDrop && (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-cyan-100 text-cyan-900 border border-cyan-300">
                                  DROP BOBINA
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Unidad */}
                          <td className="py-2.5 px-3 text-center text-[10px] font-semibold text-slate-600">
                            {m.unidad_medida}
                          </td>

                          {/* Stock Sistema (Teórico) */}
                          <td className="py-2.5 px-3 text-center font-mono font-black text-slate-800 bg-slate-50/80">
                            {stockSis}
                          </td>

                          {/* Input Físico en Camioneta */}
                          <td className="py-2 px-3 text-center bg-indigo-50/30">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min={0}
                                value={valorFis !== undefined ? valorFis : ""}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : Number(e.target.value);
                                  setValoresFisico((prev) => ({ ...prev, [m.id_producto]: val }));
                                }}
                                placeholder={String(stockSis)}
                                className="w-20 px-2 py-1 bg-white border border-indigo-200 rounded-lg text-center font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                              <button
                                type="button"
                                onClick={() => setValoresFisico((prev) => ({ ...prev, [m.id_producto]: stockSis }))}
                                className="p-1 hover:bg-indigo-100 text-indigo-600 rounded text-[9px] font-bold"
                                title="Copiar stock del sistema"
                              >
                                =
                              </button>
                            </div>
                          </td>

                          {/* Input Sobrante Devuelto (Con regla 70m para Drop) */}
                          <td className="py-2 px-3 text-center bg-amber-50/30">
                            <div className="space-y-1">
                              <input
                                type="number"
                                min={0}
                                value={valorSob || ""}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? 0 : Number(e.target.value);
                                  setValoresSobrante((prev) => ({ ...prev, [m.id_producto]: val }));
                                }}
                                placeholder="0"
                                className="w-20 px-2 py-1 bg-white border border-amber-200 rounded-lg text-center font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                              />
                              {esDrop && valorSob > 0 && (
                                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded block ${
                                  valorSob >= 70
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                    : "bg-rose-100 text-rose-800 border border-rose-300"
                                }`}>
                                  {valorSob >= 70 ? "≥70m Reutilizable" : "<70m Merma"}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Diferencia */}
                          <td className="py-2.5 px-3 text-center font-mono font-black">
                            {dif === 0 ? (
                              <span className="text-slate-400">0</span>
                            ) : dif < 0 ? (
                              <span className="text-rose-600">{dif}</span>
                            ) : (
                              <span className="text-amber-600">+{dif}</span>
                            )}
                          </td>

                          {/* Estado Cuadre */}
                          <td className="py-2.5 px-3 text-center">
                            {valorFis === "" && valorSob === 0 ? (
                              <span className="text-slate-400 text-[10px] italic">Sin auditar</span>
                            ) : dif === 0 ? (
                              <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                CUADRADO
                              </span>
                            ) : dif < 0 ? (
                              <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                FALTANTE
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                SOBRANTE
                              </span>
                            )}
                          </td>

                          {/* Observación */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={valoresObs[m.id_producto] || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setValoresObs((prev) => ({ ...prev, [m.id_producto]: val }));
                              }}
                              placeholder="Observación..."
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] focus:bg-white focus:outline-none"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Barra flotante inferior de confirmación */}
            {tecnicoDetalle && (
              <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Técnico:</span>
                    <span className="font-bold">{tecnicoDetalle.tecnico_nombre}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Auditados:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {kpisTecnico.itemsContados} de {kpisTecnico.totalItems} materiales
                    </span>
                  </div>
                  {kpisTecnico.dropReutilizable > 0 && (
                    <div>
                      <span className="text-slate-400 block text-[10px]">Drop Reutilizable (Almacén):</span>
                      <span className="font-mono font-bold text-emerald-300">+{kpisTecnico.dropReutilizable} metros</span>
                    </div>
                  )}
                  {kpisTecnico.dropMerma > 0 && (
                    <div>
                      <span className="text-slate-400 block text-[10px]">Drop Merma (Baja):</span>
                      <span className="font-mono font-bold text-rose-400">{kpisTecnico.dropMerma} metros</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => descargarPlantillaExcel("tecnico_actual")}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Download size={14} />
                    <span>Descargar Plantilla Este Técnico</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGuardarInventarioLote}
                    disabled={guardandoLote || cargandoMateriales}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Check size={16} />
                    <span>{guardandoLote ? "Guardando..." : "Guardar y Aplicar Inventario"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            SUB-VISTA 3: HISTORIAL DE CRUCES Y DEVOLUCIONES DROP
        ───────────────────────────────────────────────────────────── */}
        {subTab === "historial" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={filtroHistClasificacion}
                onChange={(e) => setFiltroHistClasificacion(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-none"
              >
                <option value="Todos">Todas las clasificaciones</option>
                <option value="REUTILIZABLE">Solo Reutilizables (≥70m)</option>
                <option value="MERMA">Solo Mermas (&lt;70m)</option>
              </select>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Desde:</span>
                <input
                  type="date"
                  value={filtroHistDesde}
                  onChange={(e) => setFiltroHistDesde(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Hasta:</span>
                <input
                  type="date"
                  value={filtroHistHasta}
                  onChange={(e) => setFiltroHistHasta(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>
            </div>

            <div className="w-full overflow-x-auto touch-pan-x border border-slate-200 rounded-2xl">
              <table className="w-full min-w-[900px] text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Fecha y Hora</th>
                    <th className="py-3 px-4">Técnico / Responsable</th>
                    <th className="py-3 px-4">Cuadrilla / Móvil</th>
                    <th className="py-3 px-4 text-center">Metros Devueltos</th>
                    <th className="py-3 px-4 text-center">Clasificación Regla 70m</th>
                    <th className="py-3 px-4">Origen / Motivo</th>
                    <th className="py-3 px-4">Registrado Por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {cargandoHistorial ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                        Cargando historial de devoluciones...
                      </td>
                    </tr>
                  ) : historialData.devoluciones.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                        No hay registros de devoluciones en el rango seleccionado.
                      </td>
                    </tr>
                  ) : (
                    historialData.devoluciones.map((d) => (
                      <tr key={d.id_devolucion} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {new Date(d.fecha_registro).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {d.tecnico_nombre}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-700 block">{d.cuadrilla}</span>
                          <span className="text-[10px] font-mono text-slate-500">{d.vehiculo_placa}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-black text-slate-900">
                          {d.metros_devueltos} m
                        </td>
                        <td className="py-3 px-4 text-center">
                          {d.clasificacion === "REUTILIZABLE" ? (
                            <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ REUTILIZABLE (≥70m)
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                              ✕ MERMA (&lt;70m)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <span className="font-semibold block">{d.motivo}</span>
                          <span className="text-[10px] text-slate-600 font-mono">{d.origen}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {d.registrado_por || "Sistema"}
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

      {/* ─────────────────────────────────────────────────────────────
          4. MODAL: AUDITORÍA INDIVIDUAL RÁPIDA DE DROP
      ───────────────────────────────────────────────────────────── */}
      {modalAuditoria.isOpen && modalAuditoria.tecnico && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700">
                  <Scale size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Cuadre Rápido de Drop en Camioneta
                  </h3>
                  <p className="text-[11px] text-slate-500 font-bold">
                    {modalAuditoria.tecnico.tecnico_nombre} • Cuadrilla: {modalAuditoria.tecnico.cuadrilla || "S/C"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalAuditoria({ isOpen: false, tecnico: null })}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Selector de Técnico */}
            <div className="space-y-1">
              <label className="block text-xs font-extrabold text-slate-800">
                Seleccionar Técnico o Supervisor:
              </label>
              <select
                value={modalAuditoria.tecnico.id_trabajador}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  const sel = tecnicos.find((item) => item.id_trabajador === id);
                  if (sel) {
                    setModalAuditoria({ isOpen: true, tecnico: sel });
                    setInputFisico(sel.last_stock_fisico !== null && sel.last_stock_fisico !== undefined ? Number(sel.last_stock_fisico) : Number(sel.stock_drop_sistema || 0));
                    setInputSobrante(0);
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {tecnicos.map((tech) => (
                  <option key={tech.id_trabajador} value={tech.id_trabajador}>
                    {tech.tecnico_nombre} — Cuadrilla: {tech.cuadrilla || "S/C"} ({Number(tech.stock_drop_sistema || 0)} m Drop)
                  </option>
                ))}
              </select>
            </div>

            {/* Stock en Sistema */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 font-bold block">
                  Stock Teórico en Sistema (Drop):
                </span>
                <span className="text-lg font-black font-mono text-slate-900">
                  {Number(modalAuditoria.tecnico.stock_drop_sistema || 0)} <span className="text-xs font-bold text-slate-500">metros</span>
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-xl text-[10px] font-extrabold bg-indigo-100 text-indigo-900 border border-indigo-200">
                {modalAuditoria.tecnico.tipo_servicio}
              </span>
            </div>

            {/* Inputs */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-slate-800">
                  1. Metros Físicos que se quedan en la camioneta:
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={inputFisico}
                    onChange={(e) => setInputFisico(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Ej: 300"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold focus:bg-white focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    metros
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-slate-800">
                  2. Metros Sobrantes devueltos a Almacén Central:
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={inputSobrante}
                    onChange={(e) => setInputSobrante(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="0 si no devuelve nada"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold focus:bg-white focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    metros
                  </span>
                </div>

                {/* Badge 70m dinámico */}
                {Number(inputSobrante) > 0 && (
                  <div className="pt-1">
                    {Number(inputSobrante) >= 70 ? (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        <span>
                          <strong>REUTILIZABLE (≥70m):</strong> Los {inputSobrante} metros ingresarán al Almacén Central como stock disponible para asignar a otros técnicos.
                        </span>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold flex items-center gap-2">
                        <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                        <span>
                          <strong>MERMA (&lt;70m):</strong> Los {inputSobrante} metros serán registrados como merma (retazo inutilizable) y NO aumentarán el stock disponible de Almacén.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cálculo en vivo */}
              {inputFisico !== "" && (
                <div className="p-3 bg-slate-100 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>Balance Total Contado:</span>
                  <span className="font-mono font-black text-sm">
                    {Number(inputFisico) + Number(inputSobrante || 0)} m
                    <span className="text-slate-500 text-[11px] font-normal">
                      {" "}(Diferencia: {(Number(inputFisico) + Number(inputSobrante || 0)) - Number(modalAuditoria.tecnico.stock_drop_sistema || 0)} m)
                    </span>
                  </span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Observaciones (Opcional):</label>
                <input
                  type="text"
                  value={inputObs}
                  onChange={(e) => setInputObs(e.target.value)}
                  placeholder="Ej: Auditoría física semanal..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalAuditoria({ isOpen: false, tecnico: null })}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarAuditoria}
                disabled={guardandoAudit}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-sm"
              >
                {guardandoAudit ? "Guardando..." : "Guardar Cruce y Aplicar Devolución"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. MODAL: PREVIEW DE IMPORTACIÓN MASIVA EXCEL
      ───────────────────────────────────────────────────────────── */}
      {modalImportar && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-700">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Cruce de Auditoría Importado desde Excel
                  </h3>
                  <p className="text-[11px] text-slate-500 font-bold">
                    El sistema cruzó los conteos físicos de campo contra el stock teórico del sistema.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalImportar(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="w-full max-h-96 overflow-y-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-extrabold text-[10px] uppercase sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Técnico</th>
                    <th className="py-2.5 px-3">Material</th>
                    <th className="py-2.5 px-3 text-center bg-slate-200/60">Stock Sistema</th>
                    <th className="py-2.5 px-3 text-center">Físico Carro</th>
                    <th className="py-2.5 px-3 text-center">Sobrante</th>
                    <th className="py-2.5 px-3 text-center">Diferencia</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                    <th className="py-2.5 px-3 text-center">Clasificación 70m</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filasExcel.map((f, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{f.nombre}</td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">{f.material || "Drop Bobina"}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold bg-slate-50">{f.stock_sistema}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-700">{f.stock_fisico}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold">{f.sobrante_devuelto}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-black">
                        {f.diferencia === 0 ? "0" : f.diferencia < 0 ? (
                          <span className="text-rose-600">{f.diferencia}</span>
                        ) : (
                          <span className="text-amber-600">+{f.diferencia}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${
                          f.estado === "CUADRADO"
                            ? "bg-emerald-100 text-emerald-800"
                            : f.estado === "FALTANTE"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {f.estado}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {f.sobrante_devuelto > 0 ? (
                          f.esReutilizable ? (
                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-emerald-100 text-emerald-800">
                              ≥70m Reutilizable
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-rose-100 text-rose-800">
                              &lt;70m Merma
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400 text-[10px]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalImportar(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAplicarImportacion}
                disabled={procesandoExcel}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm"
              >
                {procesandoExcel ? "Aplicando cruce..." : "Confirmar y Aplicar Cruce"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
