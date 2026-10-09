import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Check,
  X,
  Calendar,
  Sparkles,
  Zap,
  TrendingUp,
  Package,
  Layers,
  Activity,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  ArrowUpDown,
  MapPin,
  FileText,
  User,
  Info,
  XCircle,
  Edit2,
  Table,
  LayoutGrid,
  Plus,
  Trash2,
  ArrowLeftRight,
  Truck,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  Download,
  Move,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import {
  LiquidacionOrdenAudit,
  TecnicoLiqAuditResumen,
  MaterialLiquidadoAudit,
  ProductoStock,
} from "../types/inventoryTypes";
import {
  getLiquidacionesOrdenesAudit,
  aprobarLiquidacionOrden,
  rechazarLiquidacionOrden,
  aprobarMasivoLiquidaciones,
  ajustarMaterialLiquidacion,
  cambiarProductoLiquidacion,
  agregarMaterialLiquidacion,
  eliminarMaterialLiquidacion,
  editarNumeroActaLiquidacion,
  getTecnicoStock,
  getStockGeneral,
  getFotoActaLiquidacion,
} from "../services/inventoryService";

export const getDropConectorizadoInfo = (materiales?: any[]) => {
  if (!materiales || !Array.isArray(materiales)) return null;
  const match = materiales.find((m) => {
    const nom = String(m.nombre_producto || m.nombre || "").toUpperCase();
    return (
      nom.includes("CONECTORIZADO") ||
      /DROP.*(50|100|150|200)/i.test(nom) ||
      /DROP\s*(50M|100M|150M|200M|50MT|100MT|150MT|200MT)/i.test(nom)
    );
  });
  if (!match) return null;
  const nom = String(match.nombre_producto || match.nombre || "").toUpperCase();
  let metrosRollo = 0;
  if (/200\s*(M|MT)?\b|\*200/i.test(nom)) metrosRollo = 200;
  else if (/150\s*(M|MT)?\b|\*150/i.test(nom)) metrosRollo = 150;
  else if (/100\s*(M|MT)?\b|\*100/i.test(nom)) metrosRollo = 100;
  else if (/(?:^|[^\d])50\s*(M|MT)?\b|\*50/i.test(nom)) metrosRollo = 50;
  else {
    const numMatch = nom.match(/(\d+)\s*(?:M|MT)?/i);
    if (numMatch) metrosRollo = parseInt(numMatch[1], 10);
  }
  const cantidad = Number(match.cantidad) || 1;
  const totalMetros = metrosRollo * cantidad;
  return {
    item: match,
    nombre: match.nombre_producto || match.nombre,
    cantidad,
    metrosRollo,
    totalMetros,
  };
};

export const OrderLiquidationsAuditTab: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [tecnicos, setTecnicos] = useState<TecnicoLiqAuditResumen[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionOrdenAudit[]>([]);

  // Filtros
  const getTodayStr = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const [fechaPreset, setFechaPreset] = useState<"hoy" | "ayer" | "semana" | "custom">("hoy");
  const [fechaDesde, setFechaDesde] = useState<string>(getTodayStr());
  const [fechaHasta, setFechaHasta] = useState<string>(getTodayStr());
  const [tecnicoFiltro, setTecnicoFiltro] = useState<string>("todos");
  const [estadoFiltro, setEstadoFiltro] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState<string>("");
  const [vistaTecnicos, setVistaTecnicos] = useState<"tabla" | "tarjetas">("tabla");

  // Modal de Detalle / Auditoría
  const [modalLiq, setModalLiq] = useState<LiquidacionOrdenAudit | null>(null);
  const [procesandoAccion, setProcesandoAccion] = useState<boolean>(false);
  const [motivoRechazo, setMotivoRechazo] = useState<string>("");
  const [mostrandoRechazoInput, setMostrandoRechazoInput] = useState<boolean>(false);

  // Estados para corrección rápida de cantidad de materiales en auditoría
  const [editingMatId, setEditingMatId] = useState<number | null>(null);
  const [editingMatCant, setEditingMatCant] = useState<string>("");
  const [ajusteFeedback, setAjusteFeedback] = useState<{ msg: string; tipo: "success" | "error" } | null>(null);

  // Estados para Modal de Agregar Material Olvidado
  const [modalAgregarAbierto, setModalAgregarAbierto] = useState<boolean>(false);
  const [nuevoMatProdId, setNuevoMatProdId] = useState<number | "">("");
  const [nuevoMatCant, setNuevoMatCant] = useState<string>("1");
  const [nuevoMatSerie, setNuevoMatSerie] = useState<string>("");
  const [nuevoMatMotivo, setNuevoMatMotivo] = useState<string>("");
  const [origenStockAgregar, setOrigenStockAgregar] = useState<"camioneta" | "catalogo">("camioneta");

  // Estados para Modal de Cambiar / Sustituir Producto
  const [materialACambiar, setMaterialACambiar] = useState<MaterialLiquidadoAudit | null>(null);
  const [cambioProdId, setCambioProdId] = useState<number | "">("");
  const [cambioCant, setCambioCant] = useState<string>("1");
  const [cambioSerie, setCambioSerie] = useState<string>("");
  const [cambioMotivo, setCambioMotivo] = useState<string>("");
  const [origenStockCambio, setOrigenStockCambio] = useState<"camioneta" | "catalogo">("camioneta");

  // Stock del técnico y catálogo general para los selectores
  const [stockTecnico, setStockTecnico] = useState<{ materiales: any[]; seriesAsignadas: any[] } | null>(null);
  const [catalogoGeneral, setCatalogoGeneral] = useState<ProductoStock[]>([]);
  const [cargandoStockTec, setCargandoStockTec] = useState<boolean>(false);

  // ── 🚚 LÓGICA DE DETECCIÓN Y SERIES DE CAMIONETA PARA AGREGAR ──
  const prodSeleccionadoAgregar = useMemo(() => {
    if (!nuevoMatProdId) return null;
    if (origenStockAgregar === "camioneta") {
      const match = stockTecnico?.materiales?.find((m: any) => m.id_producto === nuevoMatProdId);
      if (match) return match;
    }
    return catalogoGeneral.find((p) => p.id_producto === nuevoMatProdId) || null;
  }, [nuevoMatProdId, origenStockAgregar, stockTecnico, catalogoGeneral]);

  const esEquipoAgregar = useMemo(() => {
    if (!prodSeleccionadoAgregar) return false;
    return (
      Boolean(prodSeleccionadoAgregar.maneja_serie) ||
      String(prodSeleccionadoAgregar.categoria_liquidar || "").toUpperCase() === "EQUIPO" ||
      Boolean(
        stockTecnico?.seriesAsignadas &&
        stockTecnico.seriesAsignadas.some(
          (s: any) => s.id_producto === prodSeleccionadoAgregar.id_producto
        )
      )
    );
  }, [prodSeleccionadoAgregar, stockTecnico]);

  const seriesCamionetaAgregar = useMemo(() => {
    if (!nuevoMatProdId || !stockTecnico?.seriesAsignadas) return [];
    return stockTecnico.seriesAsignadas.filter(
      (s: any) => s.id_producto === nuevoMatProdId && (s.estado === "Asignada" || !s.estado)
    );
  }, [nuevoMatProdId, stockTecnico]);

  useEffect(() => {
    if (esEquipoAgregar) {
      setNuevoMatCant("1");
      if (seriesCamionetaAgregar.length === 1) {
        setNuevoMatSerie(seriesCamionetaAgregar[0].numero_serie);
      } else if (!seriesCamionetaAgregar.some((s: any) => s.numero_serie === nuevoMatSerie)) {
        setNuevoMatSerie("");
      }
    } else {
      setNuevoMatSerie("");
    }
  }, [esEquipoAgregar, nuevoMatProdId, seriesCamionetaAgregar]);

  // ── 🚚 LÓGICA DE DETECCIÓN Y SERIES DE CAMIONETA PARA CAMBIO ──
  const prodSeleccionadoCambio = useMemo(() => {
    if (!cambioProdId) return null;
    if (origenStockCambio === "camioneta") {
      const match = stockTecnico?.materiales?.find((m: any) => m.id_producto === cambioProdId);
      if (match) return match;
    }
    return catalogoGeneral.find((p) => p.id_producto === cambioProdId) || null;
  }, [cambioProdId, origenStockCambio, stockTecnico, catalogoGeneral]);

  const esEquipoCambio = useMemo(() => {
    if (!prodSeleccionadoCambio) return false;
    return (
      Boolean(prodSeleccionadoCambio.maneja_serie) ||
      String(prodSeleccionadoCambio.categoria_liquidar || "").toUpperCase() === "EQUIPO" ||
      Boolean(
        stockTecnico?.seriesAsignadas &&
        stockTecnico.seriesAsignadas.some(
          (s: any) => s.id_producto === prodSeleccionadoCambio.id_producto
        )
      )
    );
  }, [prodSeleccionadoCambio, stockTecnico]);

  const seriesCamionetaCambio = useMemo(() => {
    if (!cambioProdId || !stockTecnico?.seriesAsignadas) return [];
    return stockTecnico.seriesAsignadas.filter(
      (s: any) => s.id_producto === cambioProdId && (s.estado === "Asignada" || !s.estado)
    );
  }, [cambioProdId, stockTecnico]);

  useEffect(() => {
    if (esEquipoCambio) {
      setCambioCant("1");
      if (seriesCamionetaCambio.length === 1) {
        setCambioSerie(seriesCamionetaCambio[0].numero_serie);
      } else if (!seriesCamionetaCambio.some((s: any) => s.numero_serie === cambioSerie)) {
        setCambioSerie("");
      }
    } else {
      setCambioSerie("");
    }
  }, [esEquipoCambio, cambioProdId, seriesCamionetaCambio]);

  // Modal de confirmación para aprobación masiva
  const [modalMasivoAbierto, setModalMasivoAbierto] = useState<boolean>(false);

  // 📸 Estados para Visor HD del Acta de Conformidad
  const [fotoActaUrl, setFotoActaUrl] = useState<string | null>(null);
  const [fotoActaLoading, setFotoActaLoading] = useState<boolean>(false);
  const [fotoActaError, setFotoActaError] = useState<string | null>(null);
  const [fotoActaDataId, setFotoActaDataId] = useState<string | null>(null);
  const [fotoActaTiempos, setFotoActaTiempos] = useState<any>(null);
  const [fotoActaCoordenadas, setFotoActaCoordenadas] = useState<any>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [panPos, setPanPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [lupaActiva, setLupaActiva] = useState<boolean>(false);
  const [lupaPos, setLupaPos] = useState<{ x: number; y: number; relX: number; relY: number }>({ x: 0, y: 0, relX: 50, relY: 50 });
  const [fotoFullscreen, setFotoFullscreen] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const imgWrapperRef = useRef<HTMLDivElement | null>(null);

  // 📝 Estados para Edición de Número de Acta Física
  const [editandoActa, setEditandoActa] = useState<boolean>(false);
  const [nuevoNumeroActaInput, setNuevoNumeroActaInput] = useState<string>("");
  const [guardandoActa, setGuardandoActa] = useState<boolean>(false);

  // Extraer series de guías/actas disponibles en el stock asignado al técnico
  const guiasDisponiblesTecnico: string[] = useMemo(() => {
    if (!stockTecnico || !stockTecnico.seriesAsignadas) return [];
    return stockTecnico.seriesAsignadas
      .filter((s: any) => {
        const cat = String(s.categoria || "").toUpperCase();
        const nom = String(s.equipo_nombre || s.nombre_producto || s.nombre || "").toUpperCase();
        const num = String(s.numero_serie || "").trim();
        return (
          cat.includes("ACTA") ||
          cat.includes("GUIA") ||
          cat.includes("TALONARIO") ||
          cat.includes("DOCUMENT") ||
          nom.includes("ACTA") ||
          nom.includes("GUIA") ||
          nom.includes("TALONARIO") ||
          /^\d{4,8}$/.test(num.replace(/^001-?/i, ""))
        );
      })
      .map((s: any) => String(s.numero_serie || "").trim())
      .filter(Boolean);
  }, [stockTecnico]);

  const cargarStockTecnicoYCatalogo = async (idTrabajador?: number | string) => {
    setCargandoStockTec(true);
    try {
      const [resStock, resGen] = await Promise.all([
        idTrabajador ? getTecnicoStock(idTrabajador) : Promise.resolve({ materiales: [], seriesAsignadas: [] }),
        getStockGeneral().catch(() => ({ productos: [] }))
      ]);
      setStockTecnico(resStock || { materiales: [], seriesAsignadas: [] });
      setCatalogoGeneral(resGen?.productos || []);
    } catch (e) {
      console.error("Error al cargar stock del técnico y catálogo:", e);
    } finally {
      setCargandoStockTec(false);
    }
  };

  const abrirAuditoria = (liq: LiquidacionOrdenAudit) => {
    setModalLiq(liq);
    setMostrandoRechazoInput(false);
    setMotivoRechazo("");
    setEditingMatId(null);
    setMaterialACambiar(null);
    setModalAgregarAbierto(false);
    setAjusteFeedback(null);
    setEditandoActa(false);
    setNuevoNumeroActaInput("");
    setGuardandoActa(false);

    // Resetear visor interactivo de foto de acta
    setFotoActaUrl(null);
    setFotoActaLoading(true);
    setFotoActaError(null);
    setFotoActaDataId(null);
    setFotoActaTiempos(null);
    setFotoActaCoordenadas(null);
    setZoomLevel(1);
    setRotation(0);
    setPanPos({ x: 0, y: 0 });
    setLupaActiva(false);
    setFotoFullscreen(false);

    // Cargar fotografía HD del Acta desde Fénix o BD
    if (liq.numero_orden) {
      getFotoActaLiquidacion(liq.numero_orden)
        .then((res) => {
          if (res && res.success && res.foto_url) {
            setFotoActaUrl(res.foto_url);
            setFotoActaDataId(res.dataId || null);
            setFotoActaTiempos(res.tiempos || null);
            setFotoActaCoordenadas(res.coordenadas || null);
            setFotoActaError(null);
          } else {
            setFotoActaError(res?.error || "El técnico no registró fotografía del Acta en Fénix.");
          }
        })
        .catch((err: any) => {
          console.warn("Error cargando foto del acta:", err);
          setFotoActaError(err.response?.data?.error || "No se pudo conectar con Fénix para obtener el Acta.");
        })
        .finally(() => {
          setFotoActaLoading(false);
        });
    } else {
      setFotoActaLoading(false);
      setFotoActaError("La liquidación no tiene número de orden.");
    }

    if (liq.id_trabajador) {
      cargarStockTecnicoYCatalogo(liq.id_trabajador);
    }
  };

  // Controles del visor interactivo de imagen
  const handleZoomIn = () => setZoomLevel((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100));
  const handleZoomOut = () => {
    setZoomLevel((z) => {
      const next = Math.max(0.5, Math.round((z - 0.25) * 100) / 100);
      if (next <= 1) setPanPos({ x: 0, y: 0 });
      return next;
    });
  };
  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanPos({ x: 0, y: 0 });
    setRotation(0);
    setLupaActiva(false);
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (lupaActiva) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panPos.x, y: e.clientY - panPos.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (lupaActiva && imgWrapperRef.current) {
      const rect = imgWrapperRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const relX = Math.max(0, Math.min(100, (x / rect.width) * 100));
      const relY = Math.max(0, Math.min(100, (y / rect.height) * 100));
      setLupaPos({ x, y, relX, relY });
    } else if (isDragging) {
      setPanPos({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleDownloadFoto = () => {
    if (!fotoActaUrl || !modalLiq) return;
    const a = document.createElement("a");
    a.href = fotoActaUrl;
    a.download = `Acta_Orden_${modalLiq.numero_orden || "WIN"}_${modalLiq.numero_acta || "HD"}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleGuardarAjusteMaterial = async (mat: MaterialLiquidadoAudit) => {
    if (!modalLiq) return;
    const nCant = parseInt(editingMatCant, 10);
    if (isNaN(nCant) || nCant < 0) {
      alert("Por favor ingrese una cantidad válida (número entero >= 0).");
      return;
    }
    if (nCant === mat.cantidad) {
      setEditingMatId(null);
      return;
    }

    const conf = window.confirm(
      `¿Deseas cambiar la cantidad de "${mat.nombre_producto}" de ${mat.cantidad} a ${nCant} UND?\n\nEl sistema ajustará y recalibrará automáticamente el stock en la camioneta del técnico.`
    );
    if (!conf) return;

    setProcesandoAccion(true);
    try {
      const res = await ajustarMaterialLiquidacion(modalLiq.id_liquidacion, {
        id_detalle_liq: mat.id_detalle_liq,
        nueva_cantidad: nCant,
        motivo: `Corrección de cantidad de ${mat.cantidad} a ${nCant} UND por Auditoría de Almacén`
      });

      if (res && res.success) {
        setAjusteFeedback({ msg: res.message || "Material y stock actualizados correctamente.", tipo: "success" });
        setTimeout(() => setAjusteFeedback(null), 6000);

        // Actualizar localmente el material en modalLiq
        const nuevosMats = modalLiq.materiales
          .map((m) => {
            if (m.id_detalle_liq === mat.id_detalle_liq) {
              return {
                ...m,
                cantidad: nCant,
                costo: nCant * Number(m.precio_compra || 0)
              };
            }
            return m;
          })
          .filter((m) => m.cantidad > 0);

        const nuevoTotalCosto = nuevosMats.reduce((acc, m) => acc + (Number(m.costo) || 0), 0);
        setModalLiq({
          ...modalLiq,
          materiales: nuevosMats,
          total_costo: nuevoTotalCosto,
          total_items: nuevosMats.length
        });

        setEditingMatId(null);
        if (modalLiq.id_trabajador) {
          cargarStockTecnicoYCatalogo(modalLiq.id_trabajador);
        }
        await cargarDatos(true);
      } else {
        alert(res?.error || "No se pudo actualizar el material.");
      }
    } catch (err: any) {
      console.error("Error al ajustar material:", err);
      alert(err.response?.data?.error || err.message || "Error al actualizar material.");
    } finally {
      setProcesandoAccion(false);
    }
  };

  const handleGuardarNuevoMaterial = async () => {
    if (!modalLiq || !nuevoMatProdId) {
      alert("Por favor seleccione un producto.");
      return;
    }
    const nCant = parseInt(nuevoMatCant, 10);
    if (isNaN(nCant) || nCant <= 0) {
      alert("Por favor ingrese una cantidad válida mayor a 0.");
      return;
    }

    if (esEquipoAgregar) {
      if (!nuevoMatSerie.trim()) {
        alert("Debe seleccionar una serie disponible de la camioneta del técnico.");
        return;
      }
      if (!seriesCamionetaAgregar.some((s: any) => s.numero_serie === nuevoMatSerie.trim())) {
        alert("La serie seleccionada no está asignada o disponible en la camioneta del técnico.");
        return;
      }
    }

    setProcesandoAccion(true);
    try {
      const res = await agregarMaterialLiquidacion(modalLiq.id_liquidacion, {
        id_producto: Number(nuevoMatProdId),
        cantidad: nCant,
        numero_serie: nuevoMatSerie.trim() || undefined,
        motivo: nuevoMatMotivo.trim() || "Material agregado por auditoría de almacén"
      });

      if (res && res.success) {
        setAjusteFeedback({ msg: res.message || "Material agregado correctamente.", tipo: "success" });
        setTimeout(() => setAjusteFeedback(null), 6000);

        const nuevoItem: MaterialLiquidadoAudit = {
          id_detalle_liq: res.id_detalle_liq,
          id_producto: res.id_producto,
          nombre_producto: res.nombre_producto,
          categoria_liquidar: res.categoria_liquidar,
          cantidad: res.cantidad,
          numero_serie: res.numero_serie,
          precio_compra: res.precio_compra,
          costo: res.costo
        };

        const nuevosMats = [...(modalLiq.materiales || []), nuevoItem];
        const nuevoTotalCosto = nuevosMats.reduce((acc, m) => acc + (Number(m.costo) || 0), 0);
        setModalLiq({
          ...modalLiq,
          materiales: nuevosMats,
          total_costo: nuevoTotalCosto,
          total_items: nuevosMats.length
        });

        setModalAgregarAbierto(false);
        setNuevoMatProdId("");
        setNuevoMatCant("1");
        setNuevoMatSerie("");
        setNuevoMatMotivo("");

        if (modalLiq.id_trabajador) {
          cargarStockTecnicoYCatalogo(modalLiq.id_trabajador);
        }
        await cargarDatos(true);
      } else {
        alert(res?.error || "Error al agregar material.");
      }
    } catch (err: any) {
      console.error("Error al agregar material:", err);
      alert(err.response?.data?.error || err.message || "Error al agregar material.");
    } finally {
      setProcesandoAccion(false);
    }
  };

  const handleGuardarCambioProducto = async () => {
    if (!modalLiq || !materialACambiar || !cambioProdId) {
      alert("Por favor seleccione el nuevo producto de reemplazo.");
      return;
    }
    const nCant = parseInt(cambioCant, 10);
    if (isNaN(nCant) || nCant <= 0) {
      alert("Por favor ingrese una cantidad válida mayor a 0.");
      return;
    }

    if (esEquipoCambio) {
      if (!cambioSerie.trim()) {
        alert("Debe seleccionar una serie disponible de la camioneta del técnico para el producto de reemplazo.");
        return;
      }
      if (!seriesCamionetaCambio.some((s: any) => s.numero_serie === cambioSerie.trim())) {
        alert("La serie seleccionada no está asignada o disponible en la camioneta del técnico.");
        return;
      }
    }

    const conf = window.confirm(
      `¿Confirmas cambiar "${materialACambiar.nombre_producto}" por el nuevo producto seleccionado (${nCant} UND)?\n\nEl sistema reincorporará el producto anterior al stock del técnico y descontará el nuevo.`
    );
    if (!conf) return;

    setProcesandoAccion(true);
    try {
      const res = await cambiarProductoLiquidacion(modalLiq.id_liquidacion, {
        id_detalle_liq: materialACambiar.id_detalle_liq,
        nuevo_id_producto: Number(cambioProdId),
        nueva_cantidad: nCant,
        nuevo_numero_serie: cambioSerie.trim() || undefined,
        motivo: cambioMotivo.trim() || "Cambio de producto por corrección en auditoría"
      });

      if (res && res.success) {
        setAjusteFeedback({ msg: res.message || "Producto cambiado correctamente.", tipo: "success" });
        setTimeout(() => setAjusteFeedback(null), 6000);

        const nuevosMats = modalLiq.materiales.map((m) => {
          if (m.id_detalle_liq === materialACambiar.id_detalle_liq) {
            return {
              ...m,
              id_producto: res.id_producto,
              nombre_producto: res.nombre_producto,
              cantidad: res.cantidad,
              numero_serie: res.numero_serie,
              precio_compra: res.precio_compra,
              costo: res.costo
            };
          }
          return m;
        });

        const nuevoTotalCosto = nuevosMats.reduce((acc, m) => acc + (Number(m.costo) || 0), 0);
        setModalLiq({
          ...modalLiq,
          materiales: nuevosMats,
          total_costo: nuevoTotalCosto
        });

        setMaterialACambiar(null);
        setCambioProdId("");
        setCambioCant("1");
        setCambioSerie("");
        setCambioMotivo("");

        if (modalLiq.id_trabajador) {
          cargarStockTecnicoYCatalogo(modalLiq.id_trabajador);
        }
        await cargarDatos(true);
      } else {
        alert(res?.error || "Error al cambiar producto.");
      }
    } catch (err: any) {
      console.error("Error al cambiar producto:", err);
      alert(err.response?.data?.error || err.message || "Error al cambiar producto.");
    } finally {
      setProcesandoAccion(false);
    }
  };

  const handleEliminarMaterial = async (mat: MaterialLiquidadoAudit) => {
    if (!modalLiq) return;
    const conf = window.confirm(
      `¿Deseas eliminar "${mat.nombre_producto}" (${mat.cantidad} UND) de esta liquidación?\n\nLas unidades serán reintegradas automáticamente al stock de la camioneta del técnico.`
    );
    if (!conf) return;

    setProcesandoAccion(true);
    try {
      const res = await eliminarMaterialLiquidacion(modalLiq.id_liquidacion, mat.id_detalle_liq);
      if (res && res.success) {
        setAjusteFeedback({ msg: res.message || "Material eliminado y stock reintegrado.", tipo: "success" });
        setTimeout(() => setAjusteFeedback(null), 6000);

        const nuevosMats = modalLiq.materiales.filter((m) => m.id_detalle_liq !== mat.id_detalle_liq);
        const nuevoTotalCosto = nuevosMats.reduce((acc, m) => acc + (Number(m.costo) || 0), 0);
        setModalLiq({
          ...modalLiq,
          materiales: nuevosMats,
          total_costo: nuevoTotalCosto,
          total_items: nuevosMats.length
        });

        if (modalLiq.id_trabajador) {
          cargarStockTecnicoYCatalogo(modalLiq.id_trabajador);
        }
        await cargarDatos(true);
      } else {
        alert(res?.error || "Error al eliminar material.");
      }
    } catch (err: any) {
      console.error("Error al eliminar material:", err);
      alert(err.response?.data?.error || err.message || "Error al eliminar material.");
    } finally {
      setProcesandoAccion(false);
    }
  };

  // 📝 Guardar corrección de número de Acta Física con recalibración de series y Kardex
  const handleGuardarNuevoNumeroActa = async () => {
    if (!modalLiq) return;
    const cleanNum = nuevoNumeroActaInput.trim();
    if (!cleanNum) {
      alert("Por favor ingrese un número de acta válido.");
      return;
    }

    const actaActual = String(modalLiq.numero_acta || "").trim();
    if (cleanNum === actaActual) {
      setEditandoActa(false);
      return;
    }

    const conf = window.confirm(
      `¿Confirmas corregir el número de Acta física de "${actaActual || 'Sin Acta'}" a "${cleanNum}"?\n\nEl sistema liberará la serie anterior al stock del técnico, descontará la nueva y recalibrará Kardex y Auditoría.`
    );
    if (!conf) return;

    setGuardandoActa(true);
    try {
      const res = await editarNumeroActaLiquidacion(modalLiq.id_liquidacion, {
        nuevo_numero_acta: cleanNum,
        motivo: "Corrección de número de acta física en auditoría de liquidación",
      });

      if (res && res.success) {
        setAjusteFeedback({ msg: res.message || "Número de acta actualizado con éxito.", tipo: "success" });
        setTimeout(() => setAjusteFeedback(null), 6000);

        setModalLiq({
          ...modalLiq,
          numero_acta: res.nuevo_numero_acta || cleanNum,
        });
        setEditandoActa(false);

        if (modalLiq.id_trabajador) {
          cargarStockTecnicoYCatalogo(modalLiq.id_trabajador);
        }
        await cargarDatos(true);
      } else {
        alert(res?.error || "Error al actualizar el número de acta.");
      }
    } catch (err: any) {
      console.error("Error al actualizar acta:", err);
      alert(err.response?.data?.error || err.message || "Error al actualizar número de acta.");
    } finally {
      setGuardandoActa(false);
    }
  };

  // Cargar datos
  const isFetchingRef = React.useRef(false);
  const cargarDatos = async (silent: boolean | unknown = false) => {
    const isSilent = typeof silent === "boolean" && silent;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!isSilent) setLoading(true);
    try {
      const res = await getLiquidacionesOrdenesAudit({
        desde: fechaDesde,
        hasta: fechaHasta,
        id_trabajador: tecnicoFiltro !== "todos" ? tecnicoFiltro : undefined,
        estado: estadoFiltro !== "todos" ? estadoFiltro : undefined
      });
      if (res.success) {
        setTecnicos(res.tecnicos || []);
        setLiquidaciones(res.liquidaciones || []);
      }
    } catch (err) {
      console.error("Error al cargar auditoría de liquidaciones:", err);
    } finally {
      isFetchingRef.current = false;
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();

    // ⚡ 1. Polling automático cada 20 segundos solo si está en pantalla
    const timer = setInterval(() => {
      if (!document.hidden && !modalLiq) {
        cargarDatos(true);
      }
    }, 20000);

    // ⚡ 2. Refrescar automáticamente al regresar al navegador o pestaña
    const handleFocus = () => {
      if (document.visibilityState === "visible" && !modalLiq) {
        cargarDatos(true);
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [fechaDesde, fechaHasta, tecnicoFiltro, estadoFiltro, modalLiq]);

  // Manejador de presets de fecha
  const aplicarPresetFecha = (preset: "hoy" | "ayer" | "semana") => {
    setFechaPreset(preset);
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");

    if (preset === "hoy") {
      const h = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      setFechaDesde(h);
      setFechaHasta(h);
    } else if (preset === "ayer") {
      d.setDate(d.getDate() - 1);
      const a = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      setFechaDesde(a);
      setFechaHasta(a);
    } else if (preset === "semana") {
      const h = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      d.setDate(d.getDate() - 7);
      const ini = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      setFechaDesde(ini);
      setFechaHasta(h);
    }
  };

  // Filtrado en memoria
  const liquidacionesFiltradas = useMemo(() => {
    return liquidaciones.filter((liq) => {
      if (tecnicoFiltro !== "todos" && String(liq.id_trabajador) !== tecnicoFiltro) {
        return false;
      }
      if (estadoFiltro !== "todos" && liq.estado_liquidacion !== estadoFiltro) {
        return false;
      }
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        const matchNum = (liq.numero_orden || "").toLowerCase().includes(q);
        const matchCli = (liq.cliente || "").toLowerCase().includes(q);
        const matchActa = (liq.numero_acta || "").toLowerCase().includes(q);
        const matchTec = (liq.tecnico || "").toLowerCase().includes(q);
        if (!matchNum && !matchCli && !matchActa && !matchTec) return false;
      }
      return true;
    });
  }, [liquidaciones, tecnicoFiltro, estadoFiltro, busqueda]);

  // Métricas para KPI Cards
  const kpis = useMemo(() => {
    const total = liquidaciones.length;
    const aprobadas = liquidaciones.filter((l) => l.estado_liquidacion === "Aprobada").length;
    const pendientes = liquidaciones.filter((l) => l.estado_liquidacion === "Pendiente").length;
    const conAlerta = liquidaciones.filter((l) => l.es_alerta).length;
    const costoTotal = liquidaciones.reduce((acc, l) => acc + (parseFloat(String(l.total_costo)) || 0), 0);
    const elegiblesAprobacionMasiva = liquidaciones.filter(
      (l) => l.estado_liquidacion === "Pendiente" && !l.es_alerta
    );

    return { total, aprobadas, pendientes, conAlerta, costoTotal, elegiblesAprobacionMasiva };
  }, [liquidaciones]);

  // Acciones individuales
  const handleAprobar = async (idLiq: number) => {
    setProcesandoAccion(true);
    try {
      const res = await aprobarLiquidacionOrden(idLiq);
      if (res.success) {
        await cargarDatos();
        setModalLiq(null);
      }
    } catch (err) {
      console.error("Error al aprobar liquidación:", err);
    } finally {
      setProcesandoAccion(false);
    }
  };

  const handleRechazar = async (idLiq: number) => {
    if (!motivoRechazo.trim()) {
      alert("Por favor ingrese el motivo del rechazo.");
      return;
    }
    setProcesandoAccion(true);
    try {
      const res = await rechazarLiquidacionOrden(idLiq, motivoRechazo.trim());
      if (res.success) {
        await cargarDatos();
        setModalLiq(null);
        setMotivoRechazo("");
        setMostrandoRechazoInput(false);
      }
    } catch (err) {
      console.error("Error al rechazar liquidación:", err);
    } finally {
      setProcesandoAccion(false);
    }
  };

  const handleAprobarMasivo = async () => {
    const ids = kpis.elegiblesAprobacionMasiva.map((l) => l.id_liquidacion);
    if (ids.length === 0) return;
    setProcesandoAccion(true);
    try {
      const res = await aprobarMasivoLiquidaciones(ids);
      if (res.success) {
        await cargarDatos();
        setModalMasivoAbierto(false);
      }
    } catch (err) {
      console.error("Error en aprobación masiva:", err);
    } finally {
      setProcesandoAccion(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ─────────────────────────────────────────────────────────────
          1. KPI CARDS DEL DÍA / FILTRO
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Liquidadas */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Órdenes Liquidadas</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-slate-900 font-mono">{kpis.total}</span>
              <span className="text-xs text-slate-400 font-medium">actas</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/60">
            <FileCheck size={22} />
          </div>
        </div>

        {/* Auto-Aprobadas / Conformes */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aprobadas / Conformes</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-emerald-600 font-mono">{kpis.aprobadas}</span>
              <span className="text-xs text-emerald-600/80 font-medium">validadas</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/60">
            <ShieldCheck size={22} />
          </div>
        </div>

        {/* En Alerta / Observadas */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Con Alerta / Excesos</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-amber-500 font-mono">{kpis.conAlerta}</span>
              <span className="text-xs text-amber-600 font-semibold">&gt;500m o múltiples ONT</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-200/60">
            <AlertTriangle size={22} />
          </div>
        </div>

        {/* Costo Total en Materiales */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Costo Consumido</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl md:text-3xl font-black text-indigo-700 font-mono">
                S/ {kpis.costoTotal.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200/60">
            <TrendingUp size={22} />
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. BARRA DE HERRAMIENTAS, FILTROS Y APROBACIÓN MASIVA
      ───────────────────────────────────────────────────────────── */}
      <div className="p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
        
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Presets de Fecha */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              onClick={() => aplicarPresetFecha("hoy")}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                fechaPreset === "hoy"
                  ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => aplicarPresetFecha("ayer")}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                fechaPreset === "ayer"
                  ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Ayer
            </button>
            <button
              onClick={() => aplicarPresetFecha("semana")}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                fechaPreset === "semana"
                  ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Últimos 7 días
            </button>
          </div>

          {/* Rango de Fechas Manual */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs font-semibold text-slate-600">
              <Calendar size={14} className="text-slate-400" />
              <span>Desde:</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => {
                  setFechaDesde(e.target.value);
                  setFechaPreset("custom");
                }}
                className="px-2.5 py-1 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 bg-white"
              />
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-slate-600">
              <span>Hasta:</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => {
                  setFechaHasta(e.target.value);
                  setFechaPreset("custom");
                }}
                className="px-2.5 py-1 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 bg-white"
              />
            </div>
          </div>

          {/* Botón de Aprobación Masiva */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setModalMasivoAbierto(true)}
              disabled={kpis.elegiblesAprobacionMasiva.length === 0}
              className={`px-4 py-2 rounded-2xl font-bold text-xs inline-flex items-center gap-2 transition-all cursor-pointer ${
                kpis.elegiblesAprobacionMasiva.length > 0
                  ? "bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-md shadow-emerald-600/20 scale-[1.01]"
                  : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
              }`}
            >
              <Zap size={14} />
              <span>Aprobar Conformes en Lote ({kpis.elegiblesAprobacionMasiva.length})</span>
            </button>

            <button
              onClick={cargarDatos}
              disabled={loading}
              className="p-2 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all cursor-pointer"
              title="Refrescar datos"
            >
              <RefreshCw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
            </button>
          </div>

        </div>

        {/* Fila de Filtros Secundarios (Buscador, Técnico, Estado) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          
          {/* Buscador */}
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por Orden, Cliente, Acta..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-2xl border border-slate-300 text-xs font-medium text-slate-900 bg-slate-50/50 focus:bg-white focus:border-blue-500 transition-all"
            />
          </div>

          {/* Filtro por Técnico */}
          <div>
            <select
              value={tecnicoFiltro}
              onChange={(e) => setTecnicoFiltro(e.target.value)}
              className="w-full px-3 py-2 rounded-2xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
            >
              <option value="todos">-- Todos los Técnicos ({tecnicos.length}) --</option>
              {tecnicos.map((t) => (
                <option key={t.id_trabajador} value={String(t.id_trabajador)}>
                  {t.cuadrilla ? `${t.cuadrilla} - ` : ""}{t.tecnico} ({t.total_ordenes} ord / {t.total_liquidaciones} liq)
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Estado */}
          <div>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="w-full px-3 py-2 rounded-2xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
            >
              <option value="todos">-- Todos los Estados --</option>
              <option value="Pendiente">🟡 Pendientes / Por Auditar</option>
              <option value="Aprobada">🟢 Aprobadas / Conformes</option>
              <option value="Rechazada">🔴 Rechazadas</option>
            </select>
          </div>

        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. SPLIT VIEW: MAESTRO TÉCNICOS & DETALLE ÓRDENES
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* COLUMNA IZQUIERDA: RESUMEN DE TÉCNICOS & CONCILIACIÓN (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 space-y-3 self-start lg:sticky lg:top-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <User size={16} className="text-indigo-600" />
              <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                Técnicos ({tecnicos.length})
              </h3>
            </div>

            {/* Selector de Vista: Tabla Conciliación vs Tarjetas */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-[11px]">
              <button
                type="button"
                onClick={() => setVistaTecnicos("tabla")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  vistaTecnicos === "tabla"
                    ? "bg-white text-indigo-700 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Vista Tabla de Conciliación (Finalizadas vs Liquidadas)"
              >
                <Table size={13} />
                Tabla
              </button>
              <button
                type="button"
                onClick={() => setVistaTecnicos("tarjetas")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  vistaTecnicos === "tarjetas"
                    ? "bg-white text-indigo-700 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Vista Tarjetas Detalladas"
              >
                <LayoutGrid size={13} />
                Tarjetas
              </button>
            </div>
          </div>

          <div className="max-h-[calc(100vh-230px)] min-h-[300px] overflow-auto border rounded-2xl border-slate-200">
            {tecnicos.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400 font-semibold">
                No hay técnicos con órdenes registradas en este rango.
              </div>
            ) : vistaTecnicos === "tabla" ? (
              /* ── VISTA TABLA DE CONCILIACIÓN PARA ALMACÉN ── */
              <table className="w-full text-left text-xs border-separate border-spacing-0">
                <thead className="sticky top-0 z-20 bg-slate-100 shadow-xs">
                  <tr>
                    <th className="sticky top-0 z-20 bg-slate-100 p-2.5 pl-3 text-slate-700 font-bold border-b border-slate-200 min-w-[120px]">
                      Técnico
                    </th>
                    <th className="sticky top-0 z-20 bg-slate-100 p-2 text-center text-[#1f4e78] font-black border-b border-slate-200">
                      Finalizadas
                    </th>
                    <th className="sticky top-0 z-20 bg-slate-100 p-2 text-center text-indigo-700 font-black border-b border-slate-200">
                      Liquidadas
                    </th>
                    <th className="sticky top-0 z-20 bg-slate-100 p-2 text-center text-amber-700 font-black border-b border-slate-200">
                      Pendientes
                    </th>
                    <th className="sticky top-0 z-20 bg-slate-100 p-2 text-center text-slate-700 font-bold min-w-[110px] border-b border-slate-200">
                      % Conciliación
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {tecnicos.map((t) => {
                    const esActivo = tecnicoFiltro === String(t.id_trabajador);
                    const finalizadas = t.total_finalizadas !== undefined ? t.total_finalizadas : t.total_ordenes;
                    const liquidadas = t.total_liquidaciones || 0;
                    const pendientes = t.total_pendientes_liquidacion !== undefined
                      ? t.total_pendientes_liquidacion
                      : Math.max(0, finalizadas - liquidadas);
                    const ratio = t.ratio_liquidacion !== undefined
                      ? t.ratio_liquidacion
                      : (finalizadas > 0 ? Math.round((liquidadas / finalizadas) * 1000) / 10 : 0);

                    const colorBarra =
                      ratio >= 90
                        ? "bg-emerald-500"
                        : ratio >= 50
                        ? "bg-amber-500"
                        : ratio > 0
                        ? "bg-rose-500"
                        : "bg-slate-300";

                    const colorTexto =
                      ratio >= 90
                        ? "text-emerald-700"
                        : ratio >= 50
                        ? "text-amber-700"
                        : ratio > 0
                        ? "text-rose-700"
                        : "text-slate-400";

                    return (
                      <tr
                        key={t.id_trabajador}
                        onClick={() => setTecnicoFiltro(esActivo ? "todos" : String(t.id_trabajador))}
                        className={`cursor-pointer transition-colors ${
                          esActivo
                            ? "bg-indigo-50/80 font-bold border-l-4 border-indigo-600"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="p-2.5 pl-3 border-b border-slate-100">
                          <div className="font-bold text-slate-900 leading-tight truncate max-w-[130px]" title={t.tecnico}>
                            {t.tecnico}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                            {t.cuadrilla || "Sin Cuadrilla"}
                          </div>
                        </td>
                        <td className="p-2 text-center font-black text-[#1f4e78] border-b border-slate-100">
                          {finalizadas}
                        </td>
                        <td className="p-2 text-center border-b border-slate-100">
                          <span className="inline-block px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 font-black text-indigo-700 text-[11px]">
                            {liquidadas}
                          </span>
                        </td>
                        <td className="p-2 text-center border-b border-slate-100">
                          {pendientes > 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 font-black text-amber-700 text-[11px]">
                              {pendientes}
                            </span>
                          ) : finalizadas > 0 ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 font-bold text-emerald-700 text-[10px]">
                              <CheckCircle2 size={10} />
                              Al día
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">0</span>
                          )}
                        </td>
                        <td className="p-2 border-b border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-[36px]">
                              <div
                                className={`h-full rounded-full ${colorBarra} transition-all duration-500`}
                                style={{ width: `${Math.min(ratio, 100)}%` }}
                              />
                            </div>
                            <span className={`text-[10px] font-black min-w-[36px] text-right ${colorTexto}`}>
                              {ratio}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Pie de tabla con totales */}
                {tecnicos.length > 0 && (
                  <tfoot className="sticky bottom-0 z-20 bg-slate-100/95 font-bold border-t-2 border-slate-300 shadow-xs">
                    <tr>
                      <td className="p-2 pl-3 font-black text-slate-900 uppercase text-[10px]">
                        Total ({tecnicos.length})
                      </td>
                      <td className="p-2 text-center font-black text-[#1f4e78]">
                        {tecnicos.reduce((acc, t) => acc + (t.total_finalizadas !== undefined ? t.total_finalizadas : t.total_ordenes), 0)}
                      </td>
                      <td className="p-2 text-center font-black text-indigo-700">
                        {tecnicos.reduce((acc, t) => acc + (t.total_liquidaciones || 0), 0)}
                      </td>
                      <td className="p-2 text-center font-black text-amber-700">
                        {tecnicos.reduce((acc, t) => {
                          const fin = t.total_finalizadas !== undefined ? t.total_finalizadas : t.total_ordenes;
                          const liq = t.total_liquidaciones || 0;
                          return acc + Math.max(0, fin - liq);
                        }, 0)}
                      </td>
                      <td className="p-2 text-center font-black text-slate-900 text-[10px]">
                        {(() => {
                          const totFin = tecnicos.reduce((acc, t) => acc + (t.total_finalizadas !== undefined ? t.total_finalizadas : t.total_ordenes), 0);
                          const totLiq = tecnicos.reduce((acc, t) => acc + (t.total_liquidaciones || 0), 0);
                          return totFin > 0 ? `${((totLiq / totFin) * 100).toFixed(1)}%` : "0.0%";
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            ) : (
              /* ── VISTA TARJETAS DETALLADAS ── */
              <div className="p-2 space-y-2">
                {tecnicos.map((t) => {
                  const esActivo = tecnicoFiltro === String(t.id_trabajador);
                  const finalizadas = t.total_finalizadas !== undefined ? t.total_finalizadas : t.total_ordenes;
                  const liquidadas = t.total_liquidaciones || 0;
                  const pendientes = t.total_pendientes_liquidacion !== undefined
                    ? t.total_pendientes_liquidacion
                    : Math.max(0, finalizadas - liquidadas);
                  const ratio = t.ratio_liquidacion !== undefined
                    ? t.ratio_liquidacion
                    : (finalizadas > 0 ? Math.round((liquidadas / finalizadas) * 1000) / 10 : 0);

                  return (
                    <div
                      key={t.id_trabajador}
                      onClick={() => setTecnicoFiltro(esActivo ? "todos" : String(t.id_trabajador))}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 ${
                        esActivo
                          ? "bg-indigo-50/70 border-indigo-300 shadow-2xs"
                          : "bg-slate-50/50 hover:bg-slate-50 border-slate-200/70"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {t.tecnico.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-extrabold text-xs text-slate-900 block truncate">
                              {t.tecnico}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                              {t.cuadrilla && (
                                <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 truncate max-w-[150px]">
                                  {t.cuadrilla}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-xs text-slate-900 block">
                            S/ {parseFloat(String(t.total_costo)).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Fila de Métricas: Finalizadas | Liquidadas | Pendientes | % Conciliación */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60 text-[11px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded-md bg-sky-50 text-[#1f4e78] font-bold border border-sky-200 text-[10px]">
                            {finalizadas} fin
                          </span>
                          <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-bold text-[10px]">
                            {liquidadas} liq
                          </span>
                          {pendientes > 0 ? (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px]">
                              {pendientes} pend
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              ✓ Al día
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-[11px] font-black text-indigo-800">
                          <span>{ratio}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: TABLA DE ÓRDENES LIQUIDADAS (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 space-y-4">
          
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                Auditoría de Actas y Órdenes ({liquidacionesFiltradas.length})
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Valida los materiales, metrajes de drop y series instaladas por los técnicos.
              </p>
            </div>
            {tecnicoFiltro !== "todos" && (
              <button
                onClick={() => setTecnicoFiltro("todos")}
                className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
              >
                ✕ Ver todos los técnicos
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-16 text-xs text-slate-400">
              <RefreshCw size={24} className="animate-spin text-blue-600 mx-auto mb-2" />
              <span>Cargando auditoría de liquidaciones...</span>
            </div>
          ) : liquidacionesFiltradas.length === 0 ? (
            <div className="text-center py-16 text-xs text-slate-400">
              No se encontraron órdenes liquidadas con los filtros actuales.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider bg-slate-50/50">
                    <th className="py-2.5 px-3">Orden & Fecha</th>
                    <th className="py-2.5 px-3">Cliente & Técnico</th>
                    <th className="py-2.5 px-3">Acta Física</th>
                    <th className="py-2.5 px-3">Fibra Drop</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                    <th className="py-2.5 px-3 text-right">Costo</th>
                    <th className="py-2.5 px-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {liquidacionesFiltradas.map((l) => {
                    const esAprobada = l.estado_liquidacion === "Aprobada";
                    const esPendiente = l.estado_liquidacion === "Pendiente";
                    const esRechazada = l.estado_liquidacion === "Rechazada";

                    return (
                      <tr
                        key={l.id_liquidacion}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          l.es_alerta ? "bg-amber-50/30" : ""
                        }`}
                      >
                        {/* Orden & Fecha y Hora */}
                        <td className="py-3 px-3">
                          <span className="font-mono font-bold text-slate-900 block">
                            #{l.numero_orden}
                          </span>
                          <div className="space-y-0.5 mt-0.5 font-mono text-[10px]">
                            {/* Fecha de la Orden / Solicitud */}
                            {l.fecha_orden && (
                              <span className="text-slate-500 block truncate" title="Fecha de solicitud/visita de la orden">
                                <span className="font-bold text-slate-400">Ord:</span> {l.fecha_orden.slice(0, 10)}
                              </span>
                            )}
                            {/* Fecha y Hora de Liquidación */}
                            <span className="text-indigo-600 font-semibold block truncate" title="Fecha y hora de liquidación">
                              <span className="font-bold text-indigo-400">Liq:</span>{" "}
                              {(() => {
                                if (!l.fecha_liquidacion) return "-";
                                try {
                                  const parts = l.fecha_liquidacion.split(" ");
                                  if (parts.length >= 2) {
                                    const time = parts[1].substring(0, 5);
                                    return `${parts[0]} ${time}`;
                                  }
                                  const d = new Date(l.fecha_liquidacion);
                                  if (!isNaN(d.getTime())) {
                                    return (
                                      d.toLocaleDateString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit" }) +
                                      " " +
                                      d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
                                    );
                                  }
                                  return l.fecha_liquidacion;
                                } catch {
                                  return l.fecha_liquidacion;
                                }
                              })()}
                            </span>
                          </div>
                        </td>

                        {/* Cliente & Técnico */}
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-900 block truncate max-w-[180px]" title={l.cliente}>
                            {l.cliente}
                          </span>
                          <span className="text-[11px] text-indigo-700 font-semibold block truncate max-w-[180px]">
                            {l.tecnico}
                          </span>
                        </td>

                        {/* Acta */}
                        <td className="py-3 px-3 font-mono font-semibold text-slate-700">
                          {l.numero_acta || "-"}
                        </td>

                        {/* Fibra Drop & Comparativa Fénix */}
                        <td className="py-3 px-3">
                          {(() => {
                            const conecInfo = getDropConectorizadoInfo(l.materiales);
                            if (conecInfo) {
                              return (
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono font-bold text-emerald-700 text-xs">
                                      {conecInfo.totalMetros > 0 ? `${conecInfo.totalMetros}m` : `${l.drop_total_metros}m`}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-extrabold text-[9px] border border-emerald-300">
                                      Conectorizado ({conecInfo.cantidad} {conecInfo.cantidad === 1 ? "UND" : "UNDS"})
                                    </span>
                                    {l.es_alerta && (
                                      <span
                                        className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[10px]"
                                        title={l.motivo_alerta}
                                      >
                                        !
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-500 font-medium block truncate max-w-[170px]" title={conecInfo.nombre}>
                                    {conecInfo.nombre}
                                  </span>
                                  {l.metraje_fenix && (
                                    <span className="text-[10px] text-emerald-700 font-semibold block">
                                      Fénix: {l.metraje_fenix}m
                                    </span>
                                  )}
                                </div>
                              );
                            }

                            const dropMetros = Number(l.drop_total_metros || 0);
                            return (
                              <div className="flex items-center gap-2">
                                <span className={`font-mono text-xs ${dropMetros > 0 ? "font-bold text-slate-800" : "font-semibold text-slate-400"}`}>
                                  {dropMetros}m
                                </span>
                                {dropMetros > (l.max_drop_permitido || 120) && (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">
                                    Excede
                                  </span>
                                )}
                                {l.es_alerta && (
                                  <span
                                    className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[10px]"
                                    title={l.motivo_alerta}
                                  >
                                    !
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* Estado */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-tight shadow-2xs ${
                              esAprobada
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : esRechazada
                                ? "bg-rose-100 text-rose-800 border border-rose-300"
                                : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}
                          >
                            {esAprobada && <CheckCircle2 size={12} />}
                            {esRechazada && <XCircle size={12} />}
                            {esPendiente && <Clock size={12} />}
                            {l.estado_liquidacion || "Pendiente"}
                          </span>
                        </td>

                        {/* Costo */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                          S/ {parseFloat(String(l.total_costo || 0)).toFixed(2)}
                        </td>

                        {/* Acción */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => abrirAuditoria(l)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-2xs hover:scale-[1.02]"
                          >
                            <Eye size={13} />
                            <span>Auditar</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. MODAL DE AUDITORÍA DETALLADA DE LA LIQUIDACIÓN (SPLIT 2-PANEL CON FOTO HD DEL ACTA)
      ───────────────────────────────────────────────────────────── */}
      {modalLiq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-[1440px] overflow-hidden flex flex-col max-h-[94vh]">
            
            {/* Header Modal Unificado */}
            <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white px-6 py-3.5 flex items-center justify-between shrink-0 border-b border-indigo-900/50">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-xl bg-indigo-500/30 border border-indigo-400/40 text-xs font-black font-mono text-indigo-200 shadow-xs">
                    Orden #{modalLiq.numero_orden}
                  </span>

                  {/* ✏️ EDITAR ACTA FÍSICA CON RECALIBRACIÓN EN STOCK Y KARDEX */}
                  {editandoActa ? (
                    <div className="flex items-center gap-1.5 bg-slate-900 border border-indigo-400 p-1 rounded-xl shadow-lg animate-in zoom-in-95">
                      <div className="relative">
                        <input
                          type="text"
                          value={nuevoNumeroActaInput}
                          onChange={(e) => setNuevoNumeroActaInput(e.target.value)}
                          placeholder="001-XXXXX"
                          className="w-32 sm:w-36 px-2 py-0.5 rounded-lg bg-slate-800 text-white font-mono font-bold text-xs border border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-400"
                          autoFocus
                          list="sugerencias-actas-disponibles"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleGuardarNuevoNumeroActa();
                            else if (e.key === "Escape") setEditandoActa(false);
                          }}
                        />
                        {guiasDisponiblesTecnico.length > 0 && (
                          <datalist id="sugerencias-actas-disponibles">
                            {guiasDisponiblesTecnico.map((g, idx) => (
                              <option key={idx} value={g} />
                            ))}
                          </datalist>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleGuardarNuevoNumeroActa}
                        disabled={guardandoActa}
                        className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-xs disabled:opacity-50"
                        title="Guardar nuevo número de acta y recalibrar stock del técnico"
                      >
                        <Check size={13} className={guardandoActa ? "animate-spin" : ""} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditandoActa(false)}
                        disabled={guardandoActa}
                        className="p-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all cursor-pointer"
                        title="Cancelar edición"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-3 py-1 rounded-xl bg-white/10 border border-white/15 text-xs font-bold text-slate-200 group hover:border-indigo-400 transition-all">
                      <span>Acta Física: <strong className="font-mono text-white font-black">{modalLiq.numero_acta || "Sin N° Acta"}</strong></span>
                      <button
                        type="button"
                        onClick={() => {
                          setNuevoNumeroActaInput(modalLiq.numero_acta || "001-");
                          setEditandoActa(true);
                        }}
                        className="ml-1 p-0.5 rounded text-indigo-300 hover:text-white hover:bg-indigo-600/50 transition-colors cursor-pointer"
                        title="Editar Número de Acta Física (Rebalancea series y stock en la camioneta del técnico)"
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                  )}

                  {(modalLiq.tipo_trabajo_acta || modalLiq.tipo_trabajo) && (
                    <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-xs font-black uppercase tracking-wider">
                      {modalLiq.tipo_trabajo_acta || modalLiq.tipo_trabajo}
                    </span>
                  )}
                </div>
                <div className="hidden sm:block h-4 w-px bg-white/20"></div>
                <h3 className="text-sm font-black tracking-tight text-white flex items-center gap-2">
                  <span>Auditoría & Conciliación de Acta WIN</span>
                </h3>
              </div>
              
              <div className="flex items-center gap-3">
                {fotoActaUrl && (
                  <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono font-bold text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Acta Original HD {fotoActaDataId ? `(#${fotoActaDataId})` : ""}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setModalLiq(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
                  title="Cerrar auditoría"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Contenido Principal en Grid Split de 2 Columnas (7 Cols Formulario | 5 Cols Fotografía) */}
            <div className="p-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* ══════════════════════════════════════════════════════════
                    COLUMNA IZQUIERDA: FORMULARIO Y CONTROL DE MATERIALES (7 Cols)
                ══════════════════════════════════════════════════════════ */}
                <div className="lg:col-span-7 space-y-4">

                  {/* Banner de Alerta si aplica */}
                  {modalLiq.es_alerta && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300/80 flex items-start gap-3">
                      <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-extrabold text-xs text-amber-900 block">
                          Liquidación Marcada para Revisión
                        </span>
                        <p className="text-xs text-amber-800 mt-0.5 font-medium">
                          {modalLiq.motivo_alerta}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Ficha de Cliente y Técnico */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px] uppercase">Cliente</span>
                      <span className="font-bold text-slate-900 text-xs block mt-0.5">{modalLiq.cliente}</span>
                      <span className="text-slate-600 text-[11px] block mt-0.5 flex items-center gap-1">
                        <MapPin size={11} className="text-slate-400 shrink-0" />
                        {modalLiq.direccion}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px] uppercase">Técnico Responsable</span>
                      <span className="font-bold text-indigo-700 text-xs block mt-0.5">{modalLiq.tecnico}</span>
                      <span className="text-slate-600 font-semibold text-[11px] block mt-0.5">
                        {modalLiq.cuadrilla || "Sin Cuadrilla"}
                      </span>
                    </div>

                    {/* Tipo de Trabajo / Liquidación */}
                    <div className="sm:col-span-2 pt-2 border-t border-slate-200/60 flex items-center justify-between flex-wrap gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-bold uppercase text-[10px]">Tipo de Liquidación:</span>
                        <span className="font-extrabold text-indigo-900 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md uppercase">
                          {modalLiq.tipo_trabajo_acta || modalLiq.tipo_trabajo || "Liquidación Técnica"}
                        </span>
                      </div>
                      {modalLiq.tipo_conexion && (
                        <span className="text-slate-500">
                          Conexión: <strong className="text-slate-800 font-semibold">{modalLiq.tipo_conexion}</strong>
                        </span>
                      )}
                    </div>

                    {/* Fechas de Orden y Liquidación */}
                    <div className="sm:col-span-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600 font-mono">
                      <span>
                        📅 Fecha Orden: <strong className="text-slate-900">{modalLiq.fecha_orden ? modalLiq.fecha_orden.slice(0, 10) : "-"}</strong>
                      </span>
                      <span>
                        ⏱️ Liquidado: <strong className="text-indigo-700">{modalLiq.fecha_liquidacion || "-"}</strong>
                      </span>
                    </div>
                    {modalLiq.cto && (
                      <div className="sm:col-span-2 pt-1 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span>CTO: <strong className="text-slate-800 font-mono">{modalLiq.cto}</strong></span>
                        <span>Puerto: <strong className="text-slate-800 font-mono">{modalLiq.puerto || "-"}</strong></span>
                      </div>
                    )}
                    {modalLiq.observaciones_tecnico && (
                      <div className="sm:col-span-2 pt-1.5 border-t border-slate-200/60 text-[11px] bg-slate-100/70 p-2.5 rounded-xl">
                        <span className="text-slate-500 font-bold text-[10px] uppercase block mb-0.5">Observación del Técnico:</span>
                        <span className="italic text-slate-800 font-medium leading-relaxed">"{modalLiq.observaciones_tecnico}"</span>
                      </div>
                    )}
                  </div>

                  {/* Tarjeta de Fibra Drop y Mediciones (SOLO si realmente se usó Drop: Conectorizado o Bobina) */}
                  {(() => {
                    const modalConecInfo = getDropConectorizadoInfo(modalLiq.materiales);
                    const hasBobinaDrop = Number(modalLiq.drop_total_metros || 0) > 0 || Number(modalLiq.drop_metro_inicio || 0) > 0 || Number(modalLiq.drop_metro_fin || 0) > 0;
                    
                    if (!modalConecInfo && !hasBobinaDrop) {
                      return null;
                    }

                    return (
                      <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Package size={14} className="text-indigo-400" />
                            {modalConecInfo
                              ? "Cable Drop Pre-Conectorizado"
                              : "Medición de Bobina Drop Continua"}
                          </span>
                          <div className="flex items-center gap-2">
                            {modalConecInfo && (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                                ✓ Pre-Conectorizado ({modalConecInfo.totalMetros}m)
                              </span>
                            )}
                            {hasBobinaDrop && (
                              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold">
                                ✓ Bobina Continua ({modalLiq.drop_total_metros}m)
                              </span>
                            )}
                          </div>
                        </div>

                        {modalConecInfo ? (
                          <div className="space-y-2 pt-1">
                            <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-between text-xs">
                              <span className="text-emerald-300 font-medium">Rollo Pre-Conectorizado:</span>
                              <span className="font-mono font-black text-emerald-100">{modalConecInfo.nombre}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
                              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                                <span className="text-[10px] text-slate-400 block font-medium">Metraje Rollo</span>
                                <span className="font-mono font-black text-sm text-white">{modalConecInfo.metrosRollo}m</span>
                              </div>
                              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                                <span className="text-[10px] text-slate-400 block font-medium">Cantidad Usada</span>
                                <span className="font-mono font-black text-sm text-white">{modalConecInfo.cantidad} UND</span>
                              </div>
                              <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40">
                                <span className="text-[10px] text-emerald-300 block font-bold">Total Fibra</span>
                                <span className="font-mono font-black text-sm text-emerald-200">{modalConecInfo.totalMetros}m</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 text-center pt-1">
                            <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                              <span className="text-[10px] text-slate-400 block font-medium">Carrete Inicio</span>
                              <span className="font-mono font-black text-sm text-white">{modalLiq.drop_metro_inicio || "-"}m</span>
                            </div>
                            <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                              <span className="text-[10px] text-slate-400 block font-medium">Carrete Fin</span>
                              <span className="font-mono font-black text-sm text-white">{modalLiq.drop_metro_fin || "-"}m</span>
                            </div>
                            <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-400/40">
                              <span className="text-[10px] text-indigo-300 block font-bold">Total Consumido</span>
                              <span className="font-mono font-black text-sm text-indigo-200">{modalLiq.drop_total_metros}m</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Desglose de Materiales y Equipos */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                          Materiales e Insumos Declarados ({modalLiq.materiales?.length || 0})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setNuevoMatProdId("");
                            setNuevoMatCant("1");
                            setNuevoMatSerie("");
                            setNuevoMatMotivo("");
                            setModalAgregarAbierto(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-all shadow-xs cursor-pointer"
                          title="Agregar producto o material olvidado desde el vehículo o catálogo"
                        >
                          <Plus size={13} />
                          <span>Agregar Material</span>
                        </button>
                      </div>
                      <span className="font-mono font-black text-xs text-indigo-700">
                        Total: S/ {parseFloat(String(modalLiq.total_costo)).toFixed(2)}
                      </span>
                    </div>

                    {ajusteFeedback && (
                      <div
                        className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between animate-fade-in ${
                          ajusteFeedback.tipo === "success"
                            ? "bg-emerald-50 text-emerald-900 border border-emerald-300"
                            : "bg-rose-50 text-rose-900 border border-rose-300"
                        }`}
                      >
                        <span>{ajusteFeedback.msg}</span>
                        <button
                          type="button"
                          onClick={() => setAjusteFeedback(null)}
                          className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">Producto / Equipo</th>
                            <th className="py-2.5 px-3">Serie / Metraje</th>
                            <th className="py-2.5 px-3 text-center">Cant.</th>
                            <th className="py-2.5 px-3 text-right">P. Unit</th>
                            <th className="py-2.5 px-3 text-right">Subtotal</th>
                            <th className="py-2.5 px-3 text-center min-w-[120px]">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {modalLiq.materiales?.map((mat, mIdx) => {
                            const isEditing = editingMatId === mat.id_detalle_liq;
                            return (
                              <tr key={mat.id_detalle_liq || mIdx} className={isEditing ? "bg-indigo-50/70" : "hover:bg-slate-50/50"}>
                                <td className="py-2.5 px-3 font-semibold text-slate-900">
                                  {mat.nombre_producto}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">
                                  {mat.numero_serie ? (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                                      {mat.numero_serie}
                                    </span>
                                  ) : mat.drop_inicio ? (
                                    <span>{mat.drop_inicio} → {mat.drop_fin}</span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      min="0"
                                      value={editingMatCant}
                                      onChange={(e) => setEditingMatCant(e.target.value)}
                                      className="w-16 px-1.5 py-0.5 border-2 border-indigo-500 rounded-md font-black text-center text-xs bg-white text-indigo-950 focus:outline-hidden"
                                      autoFocus
                                    />
                                  ) : (
                                    mat.cantidad
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right text-slate-500 font-mono">
                                  S/ {parseFloat(String(mat.precio_compra)).toFixed(2)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                                  S/ {parseFloat(String(mat.costo)).toFixed(2)}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {isEditing ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        title="Guardar y recalibrar stock del técnico"
                                        disabled={procesandoAccion}
                                        onClick={() => handleGuardarAjusteMaterial(mat)}
                                        className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs transition-colors"
                                      >
                                        <Check size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        title="Cancelar"
                                        onClick={() => setEditingMatId(null)}
                                        className="p-1 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer transition-colors"
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center gap-1">
                                      {/* Editar Cantidad */}
                                      <button
                                        type="button"
                                        title="Corregir cantidad (recalibra el stock del técnico)"
                                        onClick={() => {
                                          setEditingMatId(mat.id_detalle_liq);
                                          setEditingMatCant(String(mat.cantidad));
                                        }}
                                        className="p-1.5 rounded-lg text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
                                      >
                                        <Edit2 size={12} />
                                      </button>

                                      {/* Cambiar Producto */}
                                      <button
                                        type="button"
                                        title="Cambiar por otro producto (retorna este al stock y descuenta el nuevo)"
                                        onClick={() => {
                                          setMaterialACambiar(mat);
                                          setCambioProdId("");
                                          setCambioCant(String(mat.cantidad || 1));
                                          setCambioSerie("");
                                          setCambioMotivo("");
                                        }}
                                        className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                                      >
                                        <ArrowLeftRight size={12} />
                                      </button>

                                      {/* Eliminar Ítem */}
                                      <button
                                        type="button"
                                        title="Eliminar de la liquidación (reintegra el stock al técnico)"
                                        onClick={() => handleEliminarMaterial(mat)}
                                        disabled={procesandoAccion}
                                        className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Cuadro de texto para motivo de rechazo */}
                  {mostrandoRechazoInput && (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2 animate-fade-in">
                      <span className="font-extrabold text-xs text-rose-900 block">
                        Motivo del Rechazo de la Liquidación:
                      </span>
                      <textarea
                        rows={2}
                        placeholder="Escriba la razón del rechazo (ej. metraje excesivo sin justificación, falta serie de ONT)..."
                        value={motivoRechazo}
                        onChange={(e) => setMotivoRechazo(e.target.value)}
                        className="w-full p-2 rounded-xl border border-rose-300 text-xs text-slate-900 bg-white"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setMostrandoRechazoInput(false)}
                          className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRechazar(modalLiq.id_liquidacion)}
                          disabled={procesandoAccion}
                          className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
                        >
                          Confirmar Rechazo
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Acciones de Liquidación */}
                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setModalLiq(null)}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 cursor-pointer"
                    >
                      Cerrar
                    </button>

                    <div className="flex items-center gap-2">
                      {!mostrandoRechazoInput && modalLiq.estado_liquidacion !== "Rechazada" && (
                        <button
                          type="button"
                          onClick={() => setMostrandoRechazoInput(true)}
                          disabled={procesandoAccion}
                          className="px-4 py-2 rounded-xl border border-rose-300 hover:bg-rose-50 text-rose-700 font-bold text-xs transition-all cursor-pointer"
                        >
                          Rechazar
                        </button>
                      )}

                      {modalLiq.estado_liquidacion !== "Aprobada" && (
                        <button
                          type="button"
                          onClick={() => handleAprobar(modalLiq.id_liquidacion)}
                          disabled={procesandoAccion}
                          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                          <Check size={14} />
                          <span>Aprobar Liquidación</span>
                        </button>
                      )}
                    </div>
                  </div>

                </div>

                {/* ══════════════════════════════════════════════════════════
                    COLUMNA DERECHA: VISOR HD INTERACTIVO DEL ACTA DE CONFORMIDAD (5 Cols)
                ══════════════════════════════════════════════════════════ */}
                <div className="lg:col-span-5 flex flex-col space-y-2 bg-slate-900/5 rounded-3xl p-3 border border-slate-200/90 self-start lg:sticky lg:top-0">
                  
                  {/* Toolbar de Controles Interactivos Elevada al Máximo */}
                  <div className="flex items-center justify-between gap-1 p-2 bg-slate-900 text-white rounded-2xl shadow-md text-xs">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <ImageIcon size={13} />
                      </div>
                      <span className="font-extrabold text-[11px] text-slate-100 hidden sm:inline tracking-tight">
                        Acta de Conformidad
                      </span>
                      <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono font-bold text-[9px]">
                        HD
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5 sm:gap-1">
                      {/* Zoom Controls */}
                      <button
                        type="button"
                        onClick={handleZoomIn}
                        disabled={!fotoActaUrl}
                        title="Acercar (+25%)"
                        className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <ZoomIn size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={handleZoomOut}
                        disabled={!fotoActaUrl}
                        title="Alejar (-25%)"
                        className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <ZoomOut size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={handleResetZoom}
                        disabled={!fotoActaUrl}
                        title="Restablecer tamaño (100%)"
                        className="px-1.5 py-1 rounded-xl hover:bg-slate-800 text-[11px] font-mono font-bold text-indigo-300 transition-colors cursor-pointer disabled:opacity-40"
                      >
                        {Math.round(zoomLevel * 100)}%
                      </button>

                      <div className="h-3.5 w-px bg-slate-700/80 mx-0.5"></div>

                      {/* Modo Lupa */}
                      <button
                        type="button"
                        onClick={() => {
                          setLupaActiva(!lupaActiva);
                          if (!lupaActiva) {
                            setZoomLevel(1);
                            setPanPos({ x: 0, y: 0 });
                          }
                        }}
                        disabled={!fotoActaUrl}
                        title={lupaActiva ? "Desactivar Lente Lupa" : "Activar Lente Lupa (Aumento 2.5x al mover el cursor)"}
                        className={`px-2 py-1 rounded-xl text-[11px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40 ${
                          lupaActiva
                            ? "bg-indigo-500 text-white shadow-xs font-black ring-1 ring-white/50"
                            : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                        }`}
                      >
                        <Search size={12} />
                        <span>{lupaActiva ? "Lupa ON" : "Lupa"}</span>
                      </button>

                      {/* Girar */}
                      <button
                        type="button"
                        onClick={handleRotate}
                        disabled={!fotoActaUrl}
                        title="Girar 90 grados"
                        className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <RotateCw size={14} />
                      </button>

                      {/* Descargar */}
                      <button
                        type="button"
                        onClick={handleDownloadFoto}
                        disabled={!fotoActaUrl}
                        title="Descargar fotografía en alta resolución"
                        className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <Download size={14} />
                      </button>

                      {/* Pantalla Completa */}
                      <button
                        type="button"
                        onClick={() => setFotoFullscreen(true)}
                        disabled={!fotoActaUrl}
                        title="Expandir a Pantalla Completa"
                        className="p-1.5 rounded-xl hover:bg-slate-800 text-indigo-300 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <Maximize2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Viewport Interactivo de la Fotografía (Maximizando Altura Vertical) */}
                  <div
                    ref={imgWrapperRef}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onDoubleClick={() => setZoomLevel((z) => (z > 1 ? 1 : 2))}
                    className={`relative w-full h-[580px] sm:h-[640px] xl:h-[680px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 select-none flex items-center justify-center ${
                      lupaActiva ? "cursor-crosshair" : zoomLevel > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
                    }`}
                  >
                    {fotoActaLoading ? (
                      /* Estado de Carga / Descarga de Fénix */
                      <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-400/30 flex items-center justify-center animate-pulse">
                          <Loader2 size={24} className="animate-spin text-indigo-400" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-white">
                            Descargando Acta Original en Alta Resolución...
                          </p>
                          <p className="text-[11px] text-slate-400 max-w-xs">
                            Conectando con el servidor oficial de Fénix (WIN) para obtener la fotografía nítida con sello y firmas.
                          </p>
                        </div>
                      </div>
                    ) : fotoActaError ? (
                      /* Estado de Error o Sin Foto */
                      <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-400/30 flex items-center justify-center">
                          <AlertTriangle size={24} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-rose-300">
                            {fotoActaError}
                          </p>
                          <p className="text-[11px] text-slate-400 max-w-xs">
                            Verifique si el técnico ya subió la fotografía del acta de cierre en la tarea finalizada.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (modalLiq) abrirAuditoria(modalLiq);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw size={13} />
                          <span>Reintentar</span>
                        </button>
                      </div>
                    ) : fotoActaUrl ? (
                      <>
                        {/* Imagen Principal con Zoom y Pan */}
                        <img
                          ref={imgRef}
                          src={fotoActaUrl}
                          alt="Acta de Conformidad"
                          draggable={false}
                          style={{
                            transform: `translate(${panPos.x}px, ${panPos.y}px) scale(${zoomLevel}) rotate(${rotation}deg)`,
                            transition: isDragging ? "none" : "transform 0.15s ease-out",
                            maxWidth: "92%",
                            maxHeight: "92%",
                            objectFit: "contain"
                          }}
                          className="shadow-2xl pointer-events-none rounded-lg"
                        />

                        {/* Lente Lupa Flotante (Magnifier Lens 2.5x) */}
                        {lupaActiva && (
                          <div
                            style={{
                              left: `${lupaPos.x - 90}px`,
                              top: `${lupaPos.y - 90}px`,
                              backgroundImage: `url(${fotoActaUrl})`,
                              backgroundPosition: `${lupaPos.relX}% ${lupaPos.relY}%`,
                              backgroundSize: "280%",
                              backgroundRepeat: "no-repeat"
                            }}
                            className="w-44 h-44 rounded-full border-3 border-indigo-400 shadow-[0_0_25px_rgba(99,102,241,0.6)] pointer-events-none absolute overflow-hidden z-30 ring-4 ring-black/40"
                          >
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-3 h-3 border border-indigo-300/60 rounded-full"></div>
                            </div>
                          </div>
                        )}

                        {/* Barra Inferior de Ayuda y Tips */}
                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-3 py-1.5 bg-slate-900/80 backdrop-blur-xs text-white rounded-xl border border-white/10 text-[10px] pointer-events-none">
                          <span className="font-mono font-bold text-indigo-300">
                            Zoom: {Math.round(zoomLevel * 100)}% {rotation !== 0 ? `• Giro: ${rotation}°` : ""}
                          </span>
                          <span className="text-slate-300">
                            {lupaActiva
                              ? "🔍 Mueve el cursor para ampliar con la lupa"
                              : zoomLevel > 1
                              ? "✋ Arrastra para explorar • Doble clic para 100%"
                              : "💡 Rueda para zoom • Doble clic para 200%"}
                          </span>
                        </div>
                      </>
                    ) : null}
                  </div>

                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4.0.1 MODAL DE FOTOGRAFÍA EN PANTALLA COMPLETA
      ───────────────────────────────────────────────────────────── */}
      {fotoFullscreen && fotoActaUrl && (
        <div className="fixed inset-0 z-70 flex flex-col bg-slate-950/95 backdrop-blur-md animate-fade-in">
          {/* Header Fullscreen */}
          <div className="p-4 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 text-xs font-mono font-bold">
                Orden #{modalLiq?.numero_orden}
              </span>
              <h4 className="text-sm font-black text-white">
                Visor Pantalla Completa • Acta de Conformidad WIN
              </h4>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs cursor-pointer"
                title="Acercar"
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs cursor-pointer"
                title="Alejar"
              >
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-mono text-xs font-bold cursor-pointer"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={handleRotate}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs cursor-pointer"
                title="Girar"
              >
                <RotateCw size={16} />
              </button>
              <button
                type="button"
                onClick={handleDownloadFoto}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs cursor-pointer"
                title="Descargar"
              >
                <Download size={16} />
              </button>
              <button
                type="button"
                onClick={() => setFotoFullscreen(false)}
                className="p-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs cursor-pointer ml-2"
                title="Salir de pantalla completa"
              >
                <Minimize2 size={16} />
              </button>
            </div>
          </div>

          {/* Body Fullscreen */}
          <div
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`flex-1 overflow-hidden flex items-center justify-center select-none ${
              zoomLevel > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
            }`}
          >
            <img
              src={fotoActaUrl}
              alt="Acta Fullscreen"
              draggable={false}
              style={{
                transform: `translate(${panPos.x}px, ${panPos.y}px) scale(${zoomLevel}) rotate(${rotation}deg)`,
                transition: isDragging ? "none" : "transform 0.15s ease-out",
                maxHeight: "92vh",
                maxWidth: "92vw",
                objectFit: "contain"
              }}
              className="shadow-2xl pointer-events-none rounded-xl"
            />
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4.1 SUBMODAL: AGREGAR MATERIAL OLVIDADO
      ───────────────────────────────────────────────────────────── */}
      {modalAgregarAbierto && modalLiq && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="bg-gradient-to-r from-indigo-900 to-indigo-950 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus size={18} className="text-indigo-400" />
                <h4 className="text-sm font-black text-white">
                  Agregar Material Olvidado a la Liquidación
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setModalAgregarAbierto(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              
              <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center gap-2">
                <Truck size={16} className="text-indigo-700 shrink-0" />
                <span className="text-slate-700">
                  Técnico: <strong className="text-indigo-900">{modalLiq.tecnico}</strong> (Acta #{modalLiq.numero_acta || modalLiq.numero_orden})
                </span>
              </div>

              {/* Selector de Origen: Camioneta vs Catálogo */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setOrigenStockAgregar("camioneta")}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    origenStockAgregar === "camioneta"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  🚚 En Camioneta ({stockTecnico?.materiales?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setOrigenStockAgregar("catalogo")}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    origenStockAgregar === "catalogo"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  📦 Catálogo General ({catalogoGeneral.length})
                </button>
              </div>

              {/* Selector de Producto */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">
                  Seleccionar Producto a Agregar:
                </label>
                <select
                  value={nuevoMatProdId}
                  onChange={(e) => setNuevoMatProdId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:border-indigo-500"
                >
                  <option value="">-- Seleccionar producto --</option>
                  {origenStockAgregar === "camioneta" ? (
                    stockTecnico?.materiales && stockTecnico.materiales.length > 0 ? (
                      stockTecnico.materiales.map((m: any) => (
                        <option key={m.id_producto} value={m.id_producto}>
                          {m.nombre} (Stock Vehículo: {m.stock} UND)
                        </option>
                      ))
                    ) : (
                      <option disabled value="">No hay stock registrado en el vehículo</option>
                    )
                  ) : (
                    catalogoGeneral.map((p) => (
                      <option key={p.id_producto} value={p.id_producto}>
                        {p.nombre} {p.codigo ? `[${p.codigo}]` : ""}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Cantidad y Serie */}
              {esEquipoAgregar ? (
                /* ── CASO EQUIPO: SERIE EXCLUSIVA DE CAMIONETA ── */
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-extrabold text-amber-950 flex items-center gap-1.5 text-xs">
                        <Truck size={14} className="text-amber-700" />
                        Serie del Camión del Técnico (Obligatorio):
                      </label>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full font-mono ${
                        seriesCamionetaAgregar.length > 0 ? "bg-amber-200 text-amber-900" : "bg-rose-200 text-rose-900"
                      }`}>
                        {seriesCamionetaAgregar.length} disponibles
                      </span>
                    </div>

                    {seriesCamionetaAgregar.length > 0 ? (
                      <>
                        <select
                          value={nuevoMatSerie}
                          onChange={(e) => setNuevoMatSerie(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-amber-300 bg-white font-mono font-bold text-slate-900 focus:border-amber-500 shadow-2xs text-xs"
                        >
                          <option value="">-- Seleccionar Serie Física del Vehículo --</option>
                          {seriesCamionetaAgregar.map((s: any) => (
                            <option key={s.id_trabajador_serie || s.numero_serie} value={s.numero_serie}>
                              {s.numero_serie} — {s.equipo_nombre} (En Camioneta)
                            </option>
                          ))}
                        </select>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {seriesCamionetaAgregar.map((s: any) => {
                            const isSelected = nuevoMatSerie === s.numero_serie;
                            return (
                              <button
                                type="button"
                                key={s.id_trabajador_serie || s.numero_serie}
                                onClick={() => setNuevoMatSerie(s.numero_serie)}
                                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition-all cursor-pointer border ${
                                  isSelected
                                    ? "bg-amber-600 text-white border-amber-700 shadow-2xs"
                                    : "bg-white text-amber-900 border-amber-200 hover:bg-amber-100"
                                }`}
                              >
                                {s.numero_serie}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                        <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block font-black">Sin stock en camioneta:</strong>
                          El técnico <span className="underline">{modalLiq.tecnico}</span> no tiene ninguna unidad disponible de este equipo en su vehículo. No es posible agregar series no asignadas.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
                    <span className="font-bold">Cantidad a Liquidar:</span>
                    <span className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      1 UND (Serializado)
                    </span>
                  </div>
                </div>
              ) : (
                /* ── CASO MATERIAL / INSUMO COMÚN (SIN SERIE) ── */
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Cantidad a Liquidar:</label>
                    <input
                      type="number"
                      min="1"
                      value={nuevoMatCant}
                      onChange={(e) => setNuevoMatCant(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 bg-white"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-[11px] flex items-center gap-2">
                    <Check size={14} className="text-emerald-600 shrink-0" />
                    <span>Este producto es un material/insumo común, no requiere número de serie.</span>
                  </div>
                </div>
              )}

              {/* Motivo */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Motivo / Justificación:</label>
                <input
                  type="text"
                  placeholder="Ej. Material no marcado por error en aplicativo de campo..."
                  value={nuevoMatMotivo}
                  onChange={(e) => setNuevoMatMotivo(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-300 text-slate-800 bg-white"
                />
              </div>

            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalAgregarAbierto(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarNuevoMaterial}
                disabled={
                  procesandoAccion ||
                  !nuevoMatProdId ||
                  (esEquipoAgregar && (!nuevoMatSerie || seriesCamionetaAgregar.length === 0))
                }
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                Agregar y Descontar Stock
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4.2 SUBMODAL: CAMBIAR / SUSTITUIR PRODUCTO
      ───────────────────────────────────────────────────────────── */}
      {materialACambiar && modalLiq && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="bg-gradient-to-r from-amber-700 to-amber-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight size={18} className="text-amber-300" />
                <h4 className="text-sm font-black text-white">
                  Cambiar / Sustituir Producto en Liquidación
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setMaterialACambiar(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              
              {/* Producto a Reemplazar */}
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 space-y-1">
                <span className="text-[10px] font-bold text-rose-800 uppercase block">
                  Producto a Retornar al Técnico:
                </span>
                <div className="flex items-center justify-between">
                  <strong className="text-xs text-rose-950">{materialACambiar.nombre_producto}</strong>
                  <span className="font-mono font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md">
                    {materialACambiar.cantidad} UND
                  </span>
                </div>
                {materialACambiar.numero_serie && (
                  <span className="text-[10px] text-rose-700 font-mono block">
                    Serie: {materialACambiar.numero_serie}
                  </span>
                )}
              </div>

              {/* Selector de Origen para Nuevo Producto */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setOrigenStockCambio("camioneta")}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    origenStockCambio === "camioneta"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  🚚 En Camioneta ({stockTecnico?.materiales?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setOrigenStockCambio("catalogo")}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    origenStockCambio === "catalogo"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  📦 Catálogo General ({catalogoGeneral.length})
                </button>
              </div>

              {/* Nuevo Producto */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">
                  Seleccionar Producto Correcto (Nuevo):
                </label>
                <select
                  value={cambioProdId}
                  onChange={(e) => setCambioProdId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:border-amber-500"
                >
                  <option value="">-- Seleccionar producto de reemplazo --</option>
                  {origenStockCambio === "camioneta" ? (
                    stockTecnico?.materiales && stockTecnico.materiales.length > 0 ? (
                      stockTecnico.materiales.map((m: any) => (
                        <option key={m.id_producto} value={m.id_producto}>
                          {m.nombre} (Stock Vehículo: {m.stock} UND)
                        </option>
                      ))
                    ) : (
                      <option disabled value="">No hay stock registrado en el vehículo</option>
                    )
                  ) : (
                    catalogoGeneral.map((p) => (
                      <option key={p.id_producto} value={p.id_producto}>
                        {p.nombre} {p.codigo ? `[${p.codigo}]` : ""}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Cantidad y Serie */}
              {esEquipoCambio ? (
                /* ── CASO EQUIPO: SERIE EXCLUSIVA DE CAMIONETA ── */
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-extrabold text-amber-950 flex items-center gap-1.5 text-xs">
                        <Truck size={14} className="text-amber-700" />
                        Serie del Camión del Técnico (Obligatorio):
                      </label>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full font-mono ${
                        seriesCamionetaCambio.length > 0 ? "bg-amber-200 text-amber-900" : "bg-rose-200 text-rose-900"
                      }`}>
                        {seriesCamionetaCambio.length} disponibles
                      </span>
                    </div>

                    {seriesCamionetaCambio.length > 0 ? (
                      <>
                        <select
                          value={cambioSerie}
                          onChange={(e) => setCambioSerie(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-amber-300 bg-white font-mono font-bold text-slate-900 focus:border-amber-500 shadow-2xs text-xs"
                        >
                          <option value="">-- Seleccionar Serie Física del Vehículo --</option>
                          {seriesCamionetaCambio.map((s: any) => (
                            <option key={s.id_trabajador_serie || s.numero_serie} value={s.numero_serie}>
                              {s.numero_serie} — {s.equipo_nombre} (En Camioneta)
                            </option>
                          ))}
                        </select>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {seriesCamionetaCambio.map((s: any) => {
                            const isSelected = cambioSerie === s.numero_serie;
                            return (
                              <button
                                type="button"
                                key={s.id_trabajador_serie || s.numero_serie}
                                onClick={() => setCambioSerie(s.numero_serie)}
                                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition-all cursor-pointer border ${
                                  isSelected
                                    ? "bg-amber-600 text-white border-amber-700 shadow-2xs"
                                    : "bg-white text-amber-900 border-amber-200 hover:bg-amber-100"
                                }`}
                              >
                                {s.numero_serie}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                        <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block font-black">Sin stock en camioneta:</strong>
                          El técnico <span className="underline">{modalLiq.tecnico}</span> no tiene ninguna unidad disponible de este equipo en su vehículo. No es posible sustituir por series no asignadas.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
                    <span className="font-bold">Cantidad a Liquidar:</span>
                    <span className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      1 UND (Serializado)
                    </span>
                  </div>
                </div>
              ) : (
                /* ── CASO MATERIAL / INSUMO COMÚN (SIN SERIE) ── */
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Nueva Cantidad:</label>
                    <input
                      type="number"
                      min="1"
                      value={cambioCant}
                      onChange={(e) => setCambioCant(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 bg-white"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-[11px] flex items-center gap-2">
                    <Check size={14} className="text-emerald-600 shrink-0" />
                    <span>Este producto es un material/insumo común, no requiere número de serie.</span>
                  </div>
                </div>
              )}

              {/* Motivo */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Motivo del Cambio:</label>
                <input
                  type="text"
                  placeholder="Ej. Error de tipificación del técnico al seleccionar modelo..."
                  value={cambioMotivo}
                  onChange={(e) => setCambioMotivo(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-300 text-slate-800 bg-white"
                />
              </div>

            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMaterialACambiar(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarCambioProducto}
                disabled={
                  procesandoAccion ||
                  !cambioProdId ||
                  (esEquipoCambio && (!cambioSerie || seriesCamionetaCambio.length === 0))
                }
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                Cambiar y Recalibrar Stock
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. MODAL DE CONFIRMACIÓN APROBACIÓN MASIVA
      ───────────────────────────────────────────────────────────── */}
      {modalMasivoAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
              <Zap size={28} />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900">
                ¿Aprobar {kpis.elegiblesAprobacionMasiva.length} liquidaciones conformes?
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Se marcarán como <strong>Aprobadas</strong> todas las órdenes pendientes que cumplen con las reglas estándar y no tienen alertas.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setModalMasivoAbierto(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAprobarMasivo}
                disabled={procesandoAccion}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Check size={14} />
                <span>Confirmar Aprobación</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default OrderLiquidationsAuditTab;
