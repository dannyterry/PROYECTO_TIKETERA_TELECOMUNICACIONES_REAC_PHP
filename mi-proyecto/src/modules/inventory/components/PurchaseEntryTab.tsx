import React, { useState, useEffect, useRef } from "react";
import {
  ShoppingCart,
  Building2,
  QrCode,
  Plus,
  Trash2,
  CheckCircle2,
  Search,
  Sparkles,
  RefreshCw,
  Package,
  Layers,
  Wrench,
  Shirt,
  Car,
  Boxes,
  X,
  FileText,
  Tag,
  AlertCircle,
  UploadCloud,
  ClipboardPaste,
  FileCode2,
  Check,
  Zap,
  RotateCcw,
  History,
  Eye,
  Ban,
  Calendar,
  DollarSign,
  Clock,
  ArrowRight,
  Copy,
} from "lucide-react";
import { ProductoStock, Proveedor, CompraPayload, CompraHistorialItem, CompraDetalleItem } from "../types/inventoryTypes";
import {
  getProveedores,
  registrarCompra,
  consultarSunatRuc,
  crearProducto,
  getCategorias,
  crearCategoria,
  getCompras,
  anularCompra,
} from "../services/inventoryService";

interface Props {
  productos: ProductoStock[];
  onCompraRegistrada: () => void;
}

const STAND_OPTIONS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const FILA_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export interface SerieIngreso {
  numero_serie: string;
  id_equipo?: string;
  proid?: string;
  codigo_serie?: string;
}

interface ItemRow {
  id_producto: number;
  codigo?: string;
  nombre: string;
  categoria: string;
  cantidad: number;
  precio: number;
  maneja_serie: boolean;
  series: SerieIngreso[];
  stand?: string;
  fila?: number;
  busquedaProducto?: string;
}

export const PurchaseEntryTab: React.FC<Props> = ({ productos, onCompraRegistrada }) => {
  const [localProductos, setLocalProductos] = useState<ProductoStock[]>(productos);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [categorias, setCategorias] = useState<string[]>([
    "EQUIPOS",
    "MATERIALES",
    "HERRAMIENTAS",
    "UNIFORMES",
    "VEHICULO",
    "EPPS",
    "TALONARIOS Y GUIAS",
    "OFICINA",
    "REPUESTOS",
  ]);
  const [guardando, setGuardando] = useState(false);
  const [consultandoSunat, setConsultandoSunat] = useState(false);
  const [estadoSunat, setEstadoSunat] = useState<string | null>(null);
  const [mensajeXmlExito, setMensajeXmlExito] = useState<string | null>(null);

  // --- 📜 PESTAÑA HISTORIAL DE COMPRAS & AUDITORÍA ---
  const [subTab, setSubTab] = useState<"nueva" | "historial">("nueva");
  const [comprasHistorial, setComprasHistorial] = useState<CompraHistorialItem[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [busquedaHistorial, setBusquedaHistorial] = useState("");
  const [filtroEstadoHistorial, setFiltroEstadoHistorial] = useState<"todos" | "COMPLETADO" | "ANULADA">("todos");
  const [compraDetalleModal, setCompraDetalleModal] = useState<CompraHistorialItem | null>(null);
  const [modalAnular, setModalAnular] = useState<{
    isOpen: boolean;
    compra: CompraHistorialItem | null;
    motivo: string;
    guardando: boolean;
    error: string | null;
  }>({
    isOpen: false,
    compra: null,
    motivo: "",
    guardando: false,
    error: null,
  });

  const cargarHistorial = async () => {
    try {
      setCargandoHistorial(true);
      const data = await getCompras();
      setComprasHistorial(data);
    } catch (e: any) {
      console.error("Error al cargar historial de compras:", e);
    } finally {
      setCargandoHistorial(false);
    }
  };

  useEffect(() => {
    if (subTab === "historial") {
      cargarHistorial();
    }
  }, [subTab]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const serieInputRef = useRef<HTMLInputElement>(null);
  const idEquipoInputRef = useRef<HTMLInputElement>(null);

  // 1. Datos Comprobante & Proveedor
  const [tipoComprobante, setTipoComprobante] = useState<"Factura" | "Boleta" | "Guía de Remisión" | "Nota de Ingreso (NIA)">("Factura");
  const [numeroComprobante, setNumeroComprobante] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));

  const [ruc, setRuc] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [idProveedorSeleccionado, setIdProveedorSeleccionado] = useState<number | null>(null);

  // 2. Modal de Nuevo Producto Rápido
  const [modalNuevoProd, setModalNuevoProd] = useState<{
    isOpen: boolean;
    categoria: string;
    rowIndex: number | null;
    nombre: string;
    codigo: string;
    proid: string;
    stand: string;
    fila: number;
    maneja_serie: boolean;
    es_drop: boolean;
    stock_minimo: number;
    precio_compra: number;
    guardando: boolean;
    error: string | null;
  }>({
    isOpen: false,
    categoria: "MATERIALES",
    rowIndex: null,
    nombre: "",
    codigo: "",
    proid: "",
    stand: "A",
    fila: 1,
    maneja_serie: false,
    es_drop: false,
    stock_minimo: 5,
    precio_compra: 0,
    guardando: false,
    error: null,
  });

  // 3. Modal de Carga Masiva de Series (Copiar y Pegar desde Excel)
  const [modalPegarSeries, setModalPegarSeries] = useState<{
    isOpen: boolean;
    itemIndex: number;
    textoPegado: string;
  }>({
    isOpen: false,
    itemIndex: 0,
    textoPegado: "",
  });

  // 3.1 Modal de Generación de Lote de Talonarios / Actas por Rango
  const [modalRangoActas, setModalRangoActas] = useState<{
    isOpen: boolean;
    itemIndex: number;
    prefijo: string;
    inicio: string;
    cantidad: number;
  }>({
    isOpen: false,
    itemIndex: 0,
    prefijo: "001-",
    inicio: "04001",
    cantidad: 500,
  });

  const handleGenerarRangoActasCompra = () => {
    const { itemIndex, prefijo, inicio, cantidad } = modalRangoActas;
    const parseInicio = parseInt(inicio.replace(/\D/g, ""), 10) || 1;
    const padLen = Math.max(5, inicio.replace(/\D/g, "").length || 5);
    const parseFin = parseInicio + Math.max(1, cantidad) - 1;

    const generated: SerieIngreso[] = [];
    for (let i = parseInicio; i <= parseFin; i++) {
      generated.push({ numero_serie: `${prefijo}${String(i).padStart(padLen, "0")}` });
    }

    setItems((prev) =>
      prev.map((item, idx) =>
        idx === itemIndex
          ? {
            ...item,
            cantidad: generated.length,
            series: generated,
          }
          : item
      )
    );

    setModalRangoActas({ isOpen: false, itemIndex: 0, prefijo: "001-", inicio: "04001", cantidad: 500 });
  };

  // 4. Ítems de la compra
  const [items, setItems] = useState<ItemRow[]>(() => {
    const defaultProd = productos[0] || {
      id_producto: 1,
      codigo: "ONT",
      nombre: "ONT",
      categoria: "EQUIPOS",
      maneja_serie: true,
      precio_compra: 145.0,
      stand: "A",
      fila: 1,
    };
    return [
      {
        id_producto: defaultProd.id_producto,
        codigo: defaultProd.codigo || "ONT",
        nombre: defaultProd.nombre,
        categoria: (defaultProd.categoria || "EQUIPOS").toUpperCase(),
        cantidad: 10,
        precio: Number(defaultProd.precio_compra) || 145.0,
        maneja_serie: Boolean(defaultProd.maneja_serie || defaultProd.categoria === "EQUIPOS"),
        series: [],
        stand: defaultProd.stand || "A",
        fila: defaultProd.fila || 1,
      },
    ];
  });

  // 5. Pistoleo temporal
  const [serieInput, setSerieInput] = useState("");
  const [serieIdEquipoInput, setSerieIdEquipoInput] = useState("");
  const [serieProidInput, setSerieProidInput] = useState("");
  const [modoDoblePistola, setModoDoblePistola] = useState(true);
  const [itemIndexParaSeries, setItemIndexParaSeries] = useState<number>(0);

  // Sincronizar catálogo cuando cambien los productos externos
  useEffect(() => {
    setLocalProductos(productos);
  }, [productos]);

  useEffect(() => {
    getProveedores().then(setProveedores).catch(console.error);
    getCategorias()
      .then((cats) => {
        if (cats && cats.length > 0) {
          const names = Array.from(new Set([...cats.map((c) => c.nombre.toUpperCase()), ...categorias]));
          setCategorias(names);
        }
      })
      .catch(console.error);
  }, []);

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

  // Helper para filtrar productos por categoría
  const getProductosPorCategoria = (catName: string) => {
    const c = (catName || "").toUpperCase().trim();
    return localProductos.filter((p) => (p.categoria || "").toUpperCase().trim() === c);
  };

  // Helper: Parser Inteligente de Factura Electrónica XML (UBL 2.1 SUNAT)
  const handleXmlUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const xmlText = e.target?.result as string;
        if (!xmlText) return;

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");

        const getVal = (tags: string[]) => {
          for (const tag of tags) {
            const el = xmlDoc.getElementsByTagName(tag)[0] || xmlDoc.getElementsByTagNameNS("*", tag)[0];
            if (el && el.textContent) return el.textContent.trim();
          }
          return "";
        };

        const idComprobante = getVal(["ID", "InvoiceID", "cbc:ID"]);
        const fechaEmision = getVal(["IssueDate", "cbc:IssueDate"]);

        let rucProv = "";
        let razonSocialProv = "";
        let direccionProv = "";

        const supplierParty =
          xmlDoc.getElementsByTagName("cac:AccountingSupplierParty")[0] ||
          xmlDoc.getElementsByTagNameNS("*", "AccountingSupplierParty")[0];

        if (supplierParty) {
          const idEl =
            supplierParty.getElementsByTagName("cbc:ID")[0] ||
            supplierParty.getElementsByTagNameNS("*", "ID")[0] ||
            supplierParty.getElementsByTagName("cbc:CustomerAssignedAccountID")[0] ||
            supplierParty.getElementsByTagNameNS("*", "CustomerAssignedAccountID")[0];
          if (idEl) rucProv = idEl.textContent?.trim() || "";

          const nameEl =
            supplierParty.getElementsByTagName("cbc:RegistrationName")[0] ||
            supplierParty.getElementsByTagNameNS("*", "RegistrationName")[0] ||
            supplierParty.getElementsByTagName("cbc:PartyName")[0] ||
            supplierParty.getElementsByTagNameNS("*", "PartyName")[0];
          if (nameEl) razonSocialProv = nameEl.textContent?.trim() || "";

          const dirEl =
            supplierParty.getElementsByTagName("cbc:Line")[0] ||
            supplierParty.getElementsByTagNameNS("*", "Line")[0] ||
            supplierParty.getElementsByTagName("cbc:StreetName")[0] ||
            supplierParty.getElementsByTagNameNS("*", "StreetName")[0];
          if (dirEl) direccionProv = dirEl.textContent?.trim() || "";
        }

        // Extraer líneas de factura
        const xmlItems: Array<{ descripcion: string; cantidad: number; precio: number }> = [];
        const lineNodes =
          xmlDoc.getElementsByTagName("cac:InvoiceLine") ||
          xmlDoc.getElementsByTagNameNS("*", "InvoiceLine");

        for (let i = 0; i < lineNodes.length; i++) {
          const line = lineNodes[i];
          const descEl =
            line.getElementsByTagName("cbc:Description")[0] ||
            line.getElementsByTagNameNS("*", "Description")[0];
          const qtyEl =
            line.getElementsByTagName("cbc:InvoicedQuantity")[0] ||
            line.getElementsByTagNameNS("*", "InvoicedQuantity")[0];
          const priceEl =
            line.getElementsByTagName("cbc:PriceAmount")[0] ||
            line.getElementsByTagNameNS("*", "PriceAmount")[0];

          const descripcion = descEl?.textContent?.trim() || `Producto #${i + 1}`;
          const cantidad = parseFloat(qtyEl?.textContent?.trim() || "1") || 1;
          const precio = parseFloat(priceEl?.textContent?.trim() || "0") || 0;

          xmlItems.push({ descripcion, cantidad, precio });
        }

        // Autollenar cabecera
        if (idComprobante) {
          setNumeroComprobante(idComprobante);
          setTipoComprobante(idComprobante.toUpperCase().startsWith("B") ? "Boleta" : "Factura");
        }
        if (fechaEmision) setFecha(fechaEmision);
        if (rucProv) setRuc(rucProv);
        if (razonSocialProv) setRazonSocial(razonSocialProv);
        if (direccionProv) setDireccion(direccionProv);

        // Convertir líneas XML en ítems del formulario asociando con catálogo si coincide
        if (xmlItems.length > 0) {
          const nuevosItems: ItemRow[] = xmlItems.map((xmlIt) => {
            const descNorm = xmlIt.descripcion.toUpperCase();
            // Buscar coincidencia en productos locales
            const matchProd = localProductos.find((p) => {
              const pNom = p.nombre.toUpperCase();
              return descNorm.includes(pNom) || pNom.includes(descNorm.split(" ")[0]);
            });

            if (matchProd) {
              return {
                id_producto: matchProd.id_producto,
                codigo: matchProd.codigo || "EQP",
                nombre: matchProd.nombre,
                categoria: (matchProd.categoria || "MATERIALES").toUpperCase(),
                cantidad: xmlIt.cantidad,
                precio: xmlIt.precio || Number(matchProd.precio_compra) || 0,
                maneja_serie: Boolean(matchProd.maneja_serie || matchProd.categoria === "EQUIPOS"),
                series: [],
              };
            } else {
              const esProbableEquipo =
                descNorm.includes("ONT") ||
                descNorm.includes("ROUTER") ||
                descNorm.includes("MESH") ||
                descNorm.includes("DECO");

              return {
                id_producto: 0,
                codigo: esProbableEquipo ? "EQP" : "MAT",
                nombre: xmlIt.descripcion,
                categoria: esProbableEquipo ? "EQUIPOS" : "MATERIALES",
                cantidad: xmlIt.cantidad,
                precio: xmlIt.precio,
                maneja_serie: esProbableEquipo,
                series: [],
              };
            }
          });

          setItems(nuevosItems);
        }

        setEstadoSunat("XML SUNAT Procesado Correctamente");
        setMensajeXmlExito(`Factura XML (${idComprobante || file.name}) cargada: ${xmlItems.length} productos detectados.`);
      } catch (err: any) {
        alert("No se pudo procesar el archivo XML: " + (err.message || "Formato XML inválido"));
      }
    };
    reader.readAsText(file);
  };

  // Autollenado inteligente por RUC con API SUNAT
  const handleRucChange = async (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 11);
    setRuc(clean);

    // 1. Verificar si ya lo tenemos registrado en proveedores locales
    const provEncontrado = proveedores.find((p) => p.ruc === clean);
    if (provEncontrado) {
      setIdProveedorSeleccionado(provEncontrado.id_proveedor);
      setRazonSocial(provEncontrado.razon_social);
      setDireccion(provEncontrado.direccion || "");
      setTelefono(provEncontrado.telefono || "");
      setEstadoSunat("Proveedor Frecuente (Registrado)");
      return;
    }

    setIdProveedorSeleccionado(null);

    // 2. Si tiene 11 dígitos, consultar SUNAT en vivo
    if (clean.length === 11) {
      try {
        setConsultandoSunat(true);
        const data = await consultarSunatRuc(clean);
        if (data.razonSocial) {
          setRazonSocial(data.razonSocial);
          setDireccion(data.direccion || "");
          setTelefono(data.telefono || "");
          setEstadoSunat(data.origen === "LOCAL_DB" ? "Proveedor Registrado" : "SUNAT: " + (data.condicion || "HABIDO"));
        }
      } catch (err) {
        console.error("Error al consultar RUC:", err);
      } finally {
        setConsultandoSunat(false);
      }
    } else {
      setEstadoSunat(null);
    }
  };

  const handleSeleccionarProveedorExistente = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value);
    if (!id) {
      handleLimpiarProveedorYComprobante();
      return;
    }
    const p = proveedores.find((prov) => prov.id_proveedor === id);
    if (p) {
      setIdProveedorSeleccionado(p.id_proveedor);
      setRuc(p.ruc);
      setRazonSocial(p.razon_social);
      setDireccion(p.direccion || "");
      setTelefono(p.telefono || "");
      setEstadoSunat("Proveedor Frecuente (Registrado)");
    }
  };

  // Limpiador rápido para resetear datos de comprobante y proveedor en caso de equivocación
  const handleLimpiarProveedorYComprobante = () => {
    setNumeroComprobante("");
    setRuc("");
    setRazonSocial("");
    setDireccion("");
    setTelefono("");
    setIdProveedorSeleccionado(null);
    setEstadoSunat(null);
    setMensajeXmlExito(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Pistoleo continuo con pistola de código de barras
  const procesarAgregarSerie = (snRaw: string, idEquipoRaw?: string, proidRaw?: string) => {
    let clean = snRaw.trim().toUpperCase();
    let idEquipo = idEquipoRaw ? idEquipoRaw.trim().toUpperCase() : "";
    let proid = proidRaw ? proidRaw.trim().toUpperCase() : "";

    // Si la serie viene con tabulador o coma (pistoleo 2D / QR o pegado combinado)
    if (clean.includes("\t") || clean.includes(",")) {
      const parts = clean.split(/[\t,]+/);
      clean = parts[0].trim().toUpperCase();
      if (parts.length >= 3) {
        if (!idEquipo) idEquipo = parts[1].trim().toUpperCase();
        if (!proid) proid = parts[2].trim().toUpperCase();
      } else if (parts.length === 2) {
        if (!idEquipo) idEquipo = parts[1].trim().toUpperCase();
      }
    }

    if (!clean) return;

    const currentItem = items[itemIndexParaSeries];
    if (!currentItem) return;

    // 1. Validar si ya se completó el cupo de la cantidad indicada
    if (currentItem.series.length >= currentItem.cantidad) {
      alert(
        `⚠️ LÍMITE DE CANTIDAD ALCANZADO:\n\nYa ingresaste las ${currentItem.cantidad} unidades para "${currentItem.nombre}".\n\nSi deseas agregar más equipos, primero aumenta la casilla "Cant." (Cantidad).`
      );
      setSerieInput("");
      setSerieIdEquipoInput("");
      setSerieProidInput("");
      return;
    }

    // 2. Validar duplicados de Serie dentro de toda la compra actual
    const existeEnEste = currentItem.series.some((s) => s.numero_serie === clean);
    const existeEnOtro = items.some(
      (it, idx) => idx !== itemIndexParaSeries && it.series.some((s) => s.numero_serie === clean)
    );

    if (existeEnEste || existeEnOtro) {
      alert(`⚠️ SERIE DUPLICADA:\n\nLa serie "${clean}" ya fue ingresada en esta compra.\n\nCada equipo debe tener un número de serie único e irrepetible.`);
      setSerieInput("");
      setTimeout(() => serieInputRef.current?.focus(), 50);
      return;
    }

    // 3. Validar duplicados de ID de Equipo si se especificó
    if (idEquipo) {
      const existeIdEnEste = currentItem.series.some((s) => s.id_equipo === idEquipo);
      const existeIdEnOtro = items.some(
        (it, idx) => idx !== itemIndexParaSeries && it.series.some((s) => s.id_equipo === idEquipo)
      );
      if (existeIdEnEste || existeIdEnOtro) {
        alert(`⚠️ ID DE EQUIPO DUPLICADO:\n\nEl ID de equipo "${idEquipo}" ya fue ingresado en esta compra.\n\nCada equipo debe tener un ID de equipo único e irrepetible.`);
        setSerieIdEquipoInput("");
        setTimeout(() => idEquipoInputRef.current?.focus(), 50);
        return;
      }
    }

    const nextIndex = currentItem.series.length + 1;
    const modelPrefix = currentItem.codigo || "EQP";
    const codigoSerieAuto = `${modelPrefix}-S${String(nextIndex).padStart(3, "0")}`;

    const nuevaSerieObj: SerieIngreso = {
      numero_serie: clean,
      id_equipo: idEquipo || undefined,
      proid: proid || undefined,
      codigo_serie: codigoSerieAuto,
    };

    setItems((prev) =>
      prev.map((it, idx) =>
        idx === itemIndexParaSeries
          ? { ...it, series: [...it.series, nuevaSerieObj] }
          : it
      )
    );

    // Limpiar serie e ID de equipo para pistoleo continuo; el ID de Modelo se mantiene fijo
    setSerieInput("");
    setSerieIdEquipoInput("");
    setTimeout(() => serieInputRef.current?.focus(), 50);
  };

  const handlePistolearSerie = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && serieInput.trim()) {
      e.preventDefault();
      // Si el modo doble pistola está activo y no se ha pistoleado aún el ID de equipo, saltar el foco a ID Equipo
      if (modoDoblePistola && !serieIdEquipoInput.trim()) {
        idEquipoInputRef.current?.focus();
      } else {
        procesarAgregarSerie(serieInput, serieIdEquipoInput, serieProidInput);
      }
    }
  };

  const handlePistolearIdEquipo = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (serieInput.trim()) {
        procesarAgregarSerie(serieInput, serieIdEquipoInput, serieProidInput);
      } else {
        serieInputRef.current?.focus();
      }
    }
  };

  const handleRemoveSerie = (itemIdx: number, serieAEliminar: string) => {
    setItems((prev) =>
      prev.map((it, idx) =>
        idx === itemIdx
          ? { ...it, series: it.series.filter((s) => s.numero_serie !== serieAEliminar) }
          : it
      )
    );
  };

  // Agregar nueva fila a la compra
  const handleAddItem = () => {
    const catDefault: string = "MATERIALES";
    const prodsDeCat = getProductosPorCategoria(catDefault);
    const prodDefault = prodsDeCat[0] || localProductos[0];

    setItems((prev) => [
      ...prev,
      {
        id_producto: prodDefault?.id_producto || 0,
        codigo: prodDefault?.codigo || "MAT",
        nombre: prodDefault?.nombre || "Seleccione producto...",
        categoria: catDefault,
        cantidad: 1,
        precio: Number(prodDefault?.precio_compra) || 0,
        maneja_serie: Boolean(prodDefault?.maneja_serie || catDefault === "EQUIPOS"),
        series: [],
        stand: prodDefault?.stand || "A",
        fila: prodDefault?.fila || 1,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (itemIndexParaSeries >= items.length - 1) {
      setItemIndexParaSeries(Math.max(0, items.length - 2));
    }
  };

  // Cambio de Categoría en Cascada
  const handleCategoryChange = (index: number, newCat: string) => {
    const catUpper = newCat.toUpperCase().trim();
    const prodsDeCat = getProductosPorCategoria(catUpper);

    if (prodsDeCat.length > 0) {
      const firstProd = prodsDeCat[0];
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === index
            ? {
              ...it,
              categoria: catUpper,
              id_producto: firstProd.id_producto,
              codigo: firstProd.codigo || "EQP",
              nombre: firstProd.nombre,
              precio: Number(firstProd.precio_compra) || it.precio || 0,
              maneja_serie: Boolean(firstProd.maneja_serie || catUpper === "EQUIPOS"),
              series: [],
              stand: firstProd.stand || it.stand || "A",
              fila: firstProd.fila || it.fila || 1,
            }
            : it
        )
      );
    } else {
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === index
            ? {
              ...it,
              categoria: catUpper,
              id_producto: 0,
              codigo: "EQP",
              nombre: `Sin productos en ${catUpper} (Crear nuevo)`,
              maneja_serie: catUpper === "EQUIPOS",
              series: [],
            }
            : it
        )
      );
      abrirModalNuevoProducto(catUpper, index);
    }
  };

  // Cambio de Producto específico
  const handleProductChange = (index: number, idProd: number) => {
    const prod = localProductos.find((p) => p.id_producto === idProd);
    if (!prod) return;

    setItems((prev) =>
      prev.map((it, idx) =>
        idx === index
          ? {
            ...it,
            id_producto: prod.id_producto,
            codigo: prod.codigo || "EQP",
            nombre: prod.nombre,
            categoria: (prod.categoria || it.categoria || "GENERAL").toUpperCase(),
            precio: Number(prod.precio_compra) || it.precio || 0,
            maneja_serie: Boolean(prod.maneja_serie || prod.categoria === "EQUIPOS"),
            series: it.id_producto === prod.id_producto ? it.series : [],
            stand: prod.stand || it.stand || "A",
            fila: prod.fila || it.fila || 1,
          }
          : it
      )
    );
  };

  // Buscador predictivo en fila de compra: busca en todo el catálogo de productos con algoritmo de ranking
  // Si encuentra coincidencia (ej: "drop", "fono", "zte", "alicate"), prioriza coincidencia exacta y cambia automáticamente la categoría y producto
  const handleBusquedaProductoChange = (index: number, txt: string) => {
    const q = cleanStr(txt);

    if (q.length >= 1) {
      const matches = rankProductos(localProductos, q, items[index]?.categoria);

      if (matches.length > 0) {
        const match = matches[0];
        const catMatch = (match.categoria || "MATERIALES").toUpperCase().trim();

        setItems((prev) =>
          prev.map((it, idx) =>
            idx === index
              ? {
                  ...it,
                  busquedaProducto: txt,
                  categoria: catMatch,
                  id_producto: match.id_producto,
                  codigo: match.codigo || "EQP",
                  nombre: match.nombre,
                  precio: Number(match.precio_compra) || it.precio || 0,
                  maneja_serie: Boolean(match.maneja_serie || catMatch === "EQUIPOS"),
                  series: it.id_producto === match.id_producto ? it.series : [],
                  stand: match.stand || it.stand || "A",
                  fila: match.fila || it.fila || 1,
                }
              : it
          )
        );
        return;
      }
    }

    setItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, busquedaProducto: txt } : it))
    );
  };

  // Abrir Modal de Creación Rápida de Producto
  const abrirModalNuevoProducto = (categoria: string, rowIndex: number) => {
    const cat = (categoria || "MATERIALES").toUpperCase();
    const esEquipo = cat === "EQUIPOS";

    setModalNuevoProd({
      isOpen: true,
      categoria: cat,
      rowIndex,
      nombre: "",
      codigo: "",
      proid: "",
      stand: "A",
      fila: 1,
      maneja_serie: esEquipo,
      es_drop: false,
      stock_minimo: 5,
      precio_compra: 0,
      guardando: false,
      error: null,
    });
  };

  // Guardar Nuevo Producto y Asignarlo de inmediato a la compra
  const handleGuardarNuevoProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalNuevoProd.nombre.trim()) {
      setModalNuevoProd((prev) => ({ ...prev, error: "Ingresa el nombre del producto." }));
      return;
    }

    try {
      setModalNuevoProd((prev) => ({ ...prev, guardando: true, error: null }));
      const res = await crearProducto({
        nombre: modalNuevoProd.nombre.trim().toUpperCase(),
        categoria: modalNuevoProd.categoria,
        codigo: modalNuevoProd.codigo.trim().toUpperCase() || undefined,
        proid: modalNuevoProd.proid.trim().toUpperCase() || undefined,
        stand: modalNuevoProd.stand,
        fila: modalNuevoProd.fila,
        stock_minimo: Number(modalNuevoProd.stock_minimo) || 5,
        maneja_serie: modalNuevoProd.maneja_serie,
        es_drop: modalNuevoProd.es_drop,
        precio_compra: Number(modalNuevoProd.precio_compra) || 0,
      });

      const nuevoProd = res.producto;

      // 1. Agregar a lista local de productos
      setLocalProductos((prev) => [...prev, nuevoProd]);

      // 2. Asignar automáticamente a la fila correspondiente de la compra
      if (modalNuevoProd.rowIndex !== null) {
        const rowIdx = modalNuevoProd.rowIndex;
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === rowIdx
              ? {
                ...it,
                id_producto: nuevoProd.id_producto,
                codigo: nuevoProd.codigo || "EQP",
                nombre: nuevoProd.nombre,
                categoria: nuevoProd.categoria,
                precio: Number(nuevoProd.precio_compra) || it.precio || 0,
                maneja_serie: Boolean(nuevoProd.maneja_serie || nuevoProd.categoria === "EQUIPOS"),
                series: [],
                stand: nuevoProd.stand || modalNuevoProd.stand,
                fila: nuevoProd.fila || modalNuevoProd.fila,
              }
              : it
          )
        );

        if (nuevoProd.maneja_serie || nuevoProd.categoria === "EQUIPOS") {
          setItemIndexParaSeries(rowIdx);
        }
      }

      // Notificar al sistema
      onCompraRegistrada();

      // Cerrar modal
      setModalNuevoProd((prev) => ({ ...prev, isOpen: false, guardando: false }));
    } catch (err: any) {
      setModalNuevoProd((prev) => ({
        ...prev,
        guardando: false,
        error: err.response?.data?.error || err.message || "Error al crear el producto.",
      }));
    }
  };

  // Crear categoría rápida directamente desde el selector
  const [creandoCategoriaRapida, setCreandoCategoriaRapida] = useState(false);
  const [nuevaCatNombre, setNuevaCatNombre] = useState("");

  const handleGuardarCategoriaRapida = async () => {
    if (!nuevaCatNombre.trim()) {
      setCreandoCategoriaRapida(false);
      return;
    }

    try {
      const nombreCat = nuevaCatNombre.trim().toUpperCase();
      await crearCategoria({ nombre: nombreCat, estado: "Activo" });

      // Agregar a la lista de categorías si no existe
      setCategorias((prev) => Array.from(new Set([nombreCat, ...prev])));

      // Seleccionar automáticamente en el modal de nuevo producto
      setModalNuevoProd((prev) => ({
        ...prev,
        categoria: nombreCat,
        maneja_serie: nombreCat === "EQUIPOS",
      }));

      setNuevaCatNombre("");
      setCreandoCategoriaRapida(false);
    } catch (err: any) {
      alert("Error al crear categoría: " + (err.response?.data?.error || err.message));
    }
  };

  // Procesar Pegado Masivo de Series desde Excel / Portapapeles (1 o 2 columnas)
  const handleImportarSeriesMasivas = () => {
    const raw = modalPegarSeries.textoPegado;
    if (!raw.trim()) return;

    const rowIdx = modalPegarSeries.itemIndex;
    const currentItem = items[rowIdx];
    if (!currentItem) return;

    const rawLines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const nuevasSeries: SerieIngreso[] = [];
    const seriesExistentesSet = new Set(currentItem.series.map((s) => s.numero_serie));
    const idEquiposExistentesSet = new Set(
      currentItem.series.filter((s) => s.id_equipo).map((s) => s.id_equipo!.toUpperCase())
    );

    const modelPrefix = currentItem.codigo || "EQP";
    let nextNum = currentItem.series.length + 1;

    for (const line of rawLines) {
      const parts = line.split(/[\t,;]+/).map((p) => p.trim().toUpperCase()).filter(Boolean);
      if (parts.length >= 3) {
        const sn = parts[0];
        const idEq = parts[1];
        const pId = parts[2];
        if (sn.length >= 3 && !seriesExistentesSet.has(sn)) {
          nuevasSeries.push({
            numero_serie: sn,
            id_equipo: idEq || undefined,
            proid: pId || undefined,
            codigo_serie: `${modelPrefix}-S${String(nextNum).padStart(3, "0")}`,
          });
          seriesExistentesSet.add(sn);
          if (idEq) idEquiposExistentesSet.add(idEq);
          nextNum++;
        }
      } else if (parts.length === 2) {
        const sn = parts[0];
        const idEq = parts[1];
        if (sn.length >= 3 && !seriesExistentesSet.has(sn)) {
          nuevasSeries.push({
            numero_serie: sn,
            id_equipo: idEq || undefined,
            proid: serieProidInput.trim().toUpperCase() || undefined,
            codigo_serie: `${modelPrefix}-S${String(nextNum).padStart(3, "0")}`,
          });
          seriesExistentesSet.add(sn);
          if (idEq) idEquiposExistentesSet.add(idEq);
          nextNum++;
        }
      } else if (parts.length === 1) {
        const sn = parts[0];
        if (sn.length >= 3 && !seriesExistentesSet.has(sn)) {
          nuevasSeries.push({
            numero_serie: sn,
            id_equipo: undefined,
            proid: serieProidInput.trim().toUpperCase() || undefined,
            codigo_serie: `${modelPrefix}-S${String(nextNum).padStart(3, "0")}`,
          });
          seriesExistentesSet.add(sn);
          nextNum++;
        }
      }
    }

    const totalSeries = [...currentItem.series, ...nuevasSeries];

    if (totalSeries.length > currentItem.cantidad) {
      const confirmActualizar = confirm(
        `Has pegado ${totalSeries.length} series únicas, pero la cantidad configurada en la fila es de ${currentItem.cantidad} unidades.\n\n¿Deseas actualizar la cantidad de compra a ${totalSeries.length} unidades para que coincida exactamente?`
      );
      if (confirmActualizar) {
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === rowIdx
              ? { ...it, series: totalSeries, cantidad: totalSeries.length }
              : it
          )
        );
      } else {
        const recortadas = totalSeries.slice(0, currentItem.cantidad);
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === rowIdx ? { ...it, series: recortadas } : it
          )
        );
      }
    } else {
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === rowIdx ? { ...it, series: totalSeries } : it
        )
      );
    }

    setModalPegarSeries({ isOpen: false, itemIndex: 0, textoPegado: "" });
  };

  const totalGeneral = items.reduce((acc, it) => acc + it.cantidad * it.precio, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let numCompFinal = numeroComprobante.trim();
    if (tipoComprobante === "Nota de Ingreso (NIA)") {
      if (!numCompFinal) {
        const hoy = new Date();
        numCompFinal = `NIA-${hoy.getFullYear()}-${String(Date.now()).slice(-5)}`;
        setNumeroComprobante(numCompFinal);
      }
    } else {
      if (!numCompFinal) {
        alert(
          `Por favor ingresa el número de ${
            tipoComprobante === "Guía de Remisión" ? "guía de remisión" : "comprobante (factura/boleta)"
          }.`
        );
        return;
      }
    }
    if (items.length === 0) {
      alert("Agrega al menos un producto a la compra.");
      return;
    }

    const itemSinProducto = items.find((it) => !it.id_producto || it.id_producto === 0);
    if (itemSinProducto) {
      alert(`Por favor selecciona o crea un producto válido para la categoría ${itemSinProducto.categoria}.`);
      return;
    }

    // 🔒 REGLA DE NEGOCIO ESTRICTA: Validar que todos los productos serializados tengan exactamente la misma cantidad de series
    for (const it of items) {
      const prod = localProductos.find((p) => p.id_producto === it.id_producto);
      const esSerializado = Boolean(
        it.maneja_serie ||
        it.categoria?.toUpperCase() === "EQUIPOS" ||
        it.categoria?.toUpperCase() === "TALONARIOS Y GUIAS" ||
        prod?.maneja_serie
      );

      if (esSerializado) {
        const cantSeries = Array.isArray(it.series) ? it.series.length : 0;
        if (cantSeries !== it.cantidad) {
          const itemIdx = items.indexOf(it);
          setItemIndexParaSeries(itemIdx);
          alert(
            `⚠️ REGLA DE NEGOCIO: VALIDACIÓN DE SERIES INCOMPLETAS\n\nEl producto "${it.nombre}" tiene una cantidad registrada de ${it.cantidad} unidades, pero solo se han pistoleado o ingresado ${cantSeries} series.\n\n❌ No se puede guardar la compra en Almacén hasta completar las ${it.cantidad - cantSeries} series restantes para garantizar que el stock físico coincida al 100% con los seriales registrados.`
          );
          return;
        }
      }
    }

    try {
      setGuardando(true);
      const payload: CompraPayload = {
        id_proveedor: idProveedorSeleccionado,
        ruc_proveedor: ruc.trim() || undefined,
        razon_social_proveedor: razonSocial.trim() || (tipoComprobante === "Nota de Ingreso (NIA)" ? "INGRESO INTERNO / SIN PROVEEDOR" : undefined),
        direccion_proveedor: direccion.trim() || undefined,
        telefono_proveedor: telefono.trim() || undefined,
        tipo_comprobante: tipoComprobante,
        numero_comprobante: numCompFinal,
        fecha,
        items: items.map((it) => ({
          id_producto: it.id_producto,
          cantidad: it.cantidad,
          precio: Number(it.precio) || 0,
          series: it.series,
          stand: it.stand,
          fila: it.fila,
        })),
      };

      await registrarCompra(payload);
      alert(`✅ ¡Compra guardada con éxito! Se sumaron ${items.length} productos y sus series al Almacén Central.`);
      onCompraRegistrada();

      // Limpiar formulario
      setNumeroComprobante("");
      setRuc("");
      setRazonSocial("");
      setDireccion("");
      setTelefono("");
      setIdProveedorSeleccionado(null);
      setEstadoSunat(null);
      setMensajeXmlExito(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setItems([]);
    } catch (err: any) {
      alert("Error al registrar compra: " + (err.response?.data?.error || err.message));
    } finally {
      setGuardando(false);
    }
  };

  const handleConfirmarAnular = async () => {
    if (!modalAnular.compra) return;
    try {
      setModalAnular((prev) => ({ ...prev, guardando: true, error: null }));
      await anularCompra(modalAnular.compra.id_compra, modalAnular.motivo);
      alert(`✅ Compra #${modalAnular.compra.id_compra} anulada con éxito. Se revirtió el stock y se retiraron las series del Almacén Central.`);
      setModalAnular({ isOpen: false, compra: null, motivo: "", guardando: false, error: null });
      if (compraDetalleModal?.id_compra === modalAnular.compra.id_compra) {
        setCompraDetalleModal(null);
      }
      cargarHistorial();
      onCompraRegistrada();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Error al anular compra.";
      setModalAnular((prev) => ({ ...prev, error: msg, guardando: false }));
    }
  };

  const historialFiltrado = comprasHistorial.filter((c) => {
    if (filtroEstadoHistorial !== "todos" && c.estado !== filtroEstadoHistorial) return false;
    if (!busquedaHistorial) return true;
    const q = busquedaHistorial.toLowerCase().trim();
    const matchComp = (c.numero_comprobante || "").toLowerCase().includes(q) || (c.tipo_comprobante || "").toLowerCase().includes(q);
    const matchProv = (c.proveedor_nombre || "").toLowerCase().includes(q) || (c.proveedor_ruc || "").toLowerCase().includes(q);
    const matchObs = (c.observaciones || "").toLowerCase().includes(q);
    const matchItems = c.items && c.items.some(
      (it) => it.producto_nombre.toLowerCase().includes(q) ||
        it.producto_codigo.toLowerCase().includes(q) ||
        (it.series_array && it.series_array.some((sn) => sn.toLowerCase().includes(q)))
    );
    return matchComp || matchProv || matchObs || matchItems;
  });

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* ─────────────────────────────────────────────────────────────
          ENCABEZADO DE GESTIÓN DE COMPRAS CON SWITCH DE SUBPESTAÑAS
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
            <ShoppingCart size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Gestión de Compras & Entradas a Almacén</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Ingreso oficial con escaneo de series, facturas XML e historial de auditoría.
            </p>
          </div>
        </div>

        {/* Switch: Nueva Compra vs Historial */}
        <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setSubTab("nueva")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${subTab === "nueva"
              ? "bg-slate-700 text-white shadow-xs font-bold"
              : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <ShoppingCart size={15} className={subTab === "nueva" ? "text-slate-200" : "text-slate-400"} />
            <span>Nueva Compra (Entrada)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSubTab("historial");
              cargarHistorial();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${subTab === "historial"
              ? "bg-slate-700 text-white shadow-xs font-bold"
              : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <History size={15} className={subTab === "historial" ? "text-slate-200" : "text-slate-400"} />
            <span>Historial de Compras ({comprasHistorial.length})</span>
          </button>
        </div>
      </div>

      {subTab === "nueva" ? (
        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in font-sans">

        {/* ─────────────────────────────────────────────────────────────
            1. DATOS DEL COMPROBANTE & PROVEEDOR INTELIGENTE (CON CARGA XML)
        ───────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black shadow-2xs">
                <Building2 size={18} />
              </div>
              <div>
                <span className="font-black text-sm text-slate-900 block">
                  Comprobante & Proveedor Inteligente
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  Autocompletado SUNAT / Factura Electrónica XML
                </span>
              </div>
            </div>

            {/* Acciones Inteligentes: Cargar XML y Proveedores Frecuentes */}
            <div className="flex flex-wrap items-center gap-2">

              {/* Botón de Carga XML SUNAT */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleXmlUpload(f);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 text-indigo-700 border border-indigo-200 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                title="Carga una factura electrónica en XML UBL 2.1 para autollenar todos los campos"
              >
                <FileCode2 size={14} className="text-indigo-600" />
                <span>📥 Importar Factura XML</span>
              </button>

              {/* Selector de Proveedor Frecuente */}
              {proveedores.length > 0 && (
                <select
                  value={idProveedorSeleccionado || ""}
                  onChange={handleSeleccionarProveedorExistente}
                  className="p-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer shadow-2xs focus:bg-white"
                >
                  <option value="">
                    📂 Seleccionar Proveedor Frecuente...
                  </option>
                  {proveedores.map((p) => (
                    <option key={p.id_proveedor} value={p.id_proveedor}>
                      {p.ruc} - {p.razon_social}
                    </option>
                  ))}
                </select>
              )}

              {estadoSunat && (
                <span className="text-[11px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-2xs">
                  <Check size={12} className="text-emerald-600" /> {estadoSunat}
                </span>
              )}

              {/* Botón Limpiador para resetear comprobante y proveedor en caso de equivocación */}
              {(ruc || razonSocial || numeroComprobante || estadoSunat) && (
                <button
                  type="button"
                  onClick={handleLimpiarProveedorYComprobante}
                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                  title="Limpiar datos del comprobante y proveedor para empezar de nuevo"
                >
                  <RotateCcw size={13} className="text-rose-600" />
                  <span>Limpiar</span>
                </button>
              )}
            </div>
          </div>

          {/* Banner de Éxito al Cargar Factura XML */}
          {mensajeXmlExito && (
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex items-center justify-between gap-2 text-xs text-indigo-900 animate-fade-in">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-600 shrink-0" />
                <span className="font-bold">{mensajeXmlExito}</span>
              </div>
              <button
                type="button"
                onClick={() => setMensajeXmlExito(null)}
                className="text-indigo-400 hover:text-indigo-700"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Tipo de Comprobante */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Tipo de Ingreso / Comprobante</label>
              <select
                value={tipoComprobante}
                onChange={(e: any) => {
                  const val = e.target.value;
                  setTipoComprobante(val);
                  if (val === "Nota de Ingreso (NIA)") {
                    if (!numeroComprobante || numeroComprobante.startsWith("NIA-")) {
                      const hoy = new Date();
                      setNumeroComprobante(`NIA-${hoy.getFullYear()}-${String(Date.now()).slice(-5)}`);
                    }
                  } else if (numeroComprobante.startsWith("NIA-")) {
                    setNumeroComprobante("");
                  }
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs cursor-pointer shadow-2xs focus:bg-white focus:ring-2 focus:ring-emerald-400"
              >
                <option value="Factura">🧾 Factura Electrónica</option>
                <option value="Boleta">🧾 Boleta de Venta</option>
                <option value="Guía de Remisión">🚚 Guía de Remisión (WIN / Proveedor)</option>
                <option value="Nota de Ingreso (NIA)">⚡ Nota de Ingreso a Almacén (NIA / Sin Comprobante)</option>
              </select>
            </div>

            {/* N° Comprobante */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center justify-between">
                <span>
                  {tipoComprobante === "Nota de Ingreso (NIA)"
                    ? "N° Nota de Ingreso (Automático)"
                    : tipoComprobante === "Guía de Remisión"
                    ? "N° Guía de Remisión *"
                    : "N° Comprobante *"}
                </span>
                {tipoComprobante === "Nota de Ingreso (NIA)" && (
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                    AUTO
                  </span>
                )}
              </label>
              <input
                type="text"
                required={tipoComprobante !== "Nota de Ingreso (NIA)"}
                placeholder={
                  tipoComprobante === "Nota de Ingreso (NIA)"
                    ? "Ej: NIA-2026-0001 (Automático)"
                    : tipoComprobante === "Guía de Remisión"
                    ? "Ej: T001-0004523"
                    : "Ej: F001-0008472"
                }
                value={numeroComprobante}
                onChange={(e) => setNumeroComprobante(e.target.value)}
                className={`w-full p-2.5 rounded-xl font-mono font-bold text-xs shadow-2xs transition-all ${
                  tipoComprobante === "Nota de Ingreso (NIA)"
                    ? "bg-emerald-50/80 border border-emerald-300 text-emerald-950 focus:bg-white focus:ring-2 focus:ring-emerald-400"
                    : "bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-400"
                }`}
              />
            </div>

            {/* RUC con Autollenado SUNAT */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center justify-between">
                <span>RUC Proveedor</span>
                {consultandoSunat && (
                  <span className="text-[10px] text-indigo-600 flex items-center gap-1">
                    <RefreshCw size={10} className="animate-spin" /> Buscando SUNAT...
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={11}
                  placeholder={tipoComprobante === "Nota de Ingreso (NIA)" ? "Opcional (Ingreso Interno)..." : "Digita RUC (11 dígitos)..."}
                  value={ruc}
                  onChange={(e) => handleRucChange(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => handleRucChange(ruc)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                  title="Consultar SUNAT"
                >
                  <Search size={14} />
                </button>
              </div>
            </div>

            {/* Razón Social */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center justify-between">
                <span>Razón Social / Proveedor</span>
                {tipoComprobante === "Nota de Ingreso (NIA)" && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    Opcional
                  </span>
                )}
              </label>
              <input
                type="text"
                placeholder={tipoComprobante === "Nota de Ingreso (NIA)" ? "Opcional (Ingreso Interno sin Proveedor)..." : "Nombre del proveedor..."}
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs focus:bg-white"
              />
            </div>

          </div>

          {/* Dirección y Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">Dirección Fiscal</label>
              <input
                type="text"
                placeholder="Dirección del proveedor (autollenada por SUNAT)..."
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Fecha de Compra</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold"
              />
            </div>
          </div>

        </div>

        {/* ─────────────────────────────────────────────────────────────
            2. DETALLE DE PRODUCTOS: CASCADA (CATEGORÍA ➔ PRODUCTO)
        ───────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black shadow-2xs">
                <Package size={18} />
              </div>
              <div>
                <span className="font-black text-sm text-slate-900 block">
                  Productos y Equipos de la Compra
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  Selección en cascada por categoría y pistoleo/importación de series
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddItem}
              className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Plus size={14} />
              <span>Agregar Producto</span>
            </button>
          </div>

          {/* Tabla de Ítems en Cascada */}
          <div className="space-y-3">
            {items.map((it, idx) => {
              const esEquipo = it.maneja_serie || it.categoria === "EQUIPOS";
              // Si el usuario escribió en el buscador de la fila, mostrar resultados rankeados globalmente
              let prodsDeCat: ProductoStock[] = [];
              if (it.busquedaProducto && it.busquedaProducto.trim().length >= 1) {
                prodsDeCat = rankProductos(localProductos, it.busquedaProducto, it.categoria);
              } else {
                prodsDeCat = getProductosPorCategoria(it.categoria);
              }

              // Asegurar que el producto seleccionado actualmente esté en el select
              if (it.id_producto && !prodsDeCat.some((p) => p.id_producto === it.id_producto)) {
                const prodActual = localProductos.find((p) => p.id_producto === it.id_producto);
                if (prodActual) prodsDeCat = [prodActual, ...prodsDeCat];
              }

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border transition-all space-y-3 ${itemIndexParaSeries === idx && esEquipo
                      ? "bg-emerald-50/40 border-emerald-300 ring-2 ring-emerald-100"
                      : "bg-slate-50/60 border-slate-200/90"
                    }`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">

                    {/* 1. Selector de Categoría (Paso 1) */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-black text-indigo-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Layers size={13} className="text-indigo-600" />
                        <span>1. Categoría</span>
                      </label>
                      <select
                        value={it.categoria}
                        onChange={(e) => handleCategoryChange(idx, e.target.value)}
                        className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl font-bold text-xs text-indigo-950 shadow-2xs focus:ring-2 focus:ring-indigo-400 cursor-pointer"
                      >
                        {categorias.map((cat) => (
                          <option key={cat} value={cat}>
                            📁 {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 🔍 Buscador Rápido de Producto / Auto-detección entre Categoría y Producto */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Search size={13} className="text-slate-500" />
                        <span>Buscar</span>
                      </label>
                      <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-3 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          value={it.busquedaProducto || ""}
                          onChange={(e) => handleBusquedaProductoChange(idx, e.target.value)}
                          placeholder="🔍 Buscar..."
                          className="w-full pl-8 pr-7 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-bold text-slate-800 outline-none transition-all placeholder-slate-400 shadow-2xs"
                        />
                        {it.busquedaProducto && (
                          <button
                            type="button"
                            onClick={() => handleBusquedaProductoChange(idx, "")}
                            className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 2. Selector de Producto de esa Categoría (Paso 2) + Botón "+ Nuevo" */}
                    <div className="sm:col-span-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1 truncate">
                          <Package size={13} className="text-slate-600 shrink-0" />
                          <span>2. Producto</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => abrirModalNuevoProducto(it.categoria, idx)}
                          className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer shrink-0"
                          title="Crear un nuevo producto en esta categoría"
                        >
                          <Plus size={11} />
                          <span>+ Crear</span>
                        </button>
                      </div>

                      <div className="flex gap-1.5">
                        <select
                          value={it.id_producto}
                          onChange={(e) => {
                            if (e.target.value === "__NEW__") {
                              abrirModalNuevoProducto(it.categoria, idx);
                            } else {
                              handleProductChange(idx, Number(e.target.value));
                            }
                          }}
                          className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-900 shadow-2xs focus:ring-2 focus:ring-emerald-400 cursor-pointer truncate"
                        >
                          {prodsDeCat.length === 0 && (
                            <option value={0} disabled>
                              ⚠️ Sin productos en {it.categoria}
                            </option>
                          )}
                          {prodsDeCat.map((p) => (
                            <option key={p.id_producto} value={p.id_producto}>
                              {p.nombre} ({p.codigo}) {it.busquedaProducto ? `• [${p.categoria || "MATERIAL"}]` : ""} {p.maneja_serie ? "• 🏷️ Serie" : ""}
                            </option>
                          ))}
                          <option value="__NEW__" className="text-indigo-600 font-black bg-indigo-50">
                            ➕ + Registrar Nuevo Producto en {it.categoria}...
                          </option>
                        </select>

                        <button
                          type="button"
                          onClick={() => abrirModalNuevoProducto(it.categoria, idx)}
                          className="p-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
                          title="Crear nuevo producto en esta categoría"
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    </div>

                    {/* 4. Ubicación Almacén (Stand A-H & Fila 1-10) */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-black text-sky-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Building2 size={12} className="text-sky-600" />
                        <span>Ubicación</span>
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        <select
                          value={it.stand || "A"}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, stand: val } : item)));
                          }}
                          className="w-full p-2 bg-sky-50/70 border border-sky-200 rounded-xl font-black text-xs text-sky-950 shadow-2xs focus:ring-2 focus:ring-sky-400"
                          title="Stand (A a H)"
                        >
                          {STAND_OPTIONS.map((st) => (
                            <option key={st} value={st}>Std {st}</option>
                          ))}
                        </select>
                        <select
                          value={it.fila || 1}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, fila: val } : item)));
                          }}
                          className="w-full p-2 bg-sky-50/70 border border-sky-200 rounded-xl font-black text-xs text-sky-950 shadow-2xs focus:ring-2 focus:ring-sky-400"
                          title="Fila (1 a 10)"
                        >
                          {FILA_OPTIONS.map((fl) => (
                            <option key={fl} value={fl}>Fila {fl}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* 5. Cantidad */}
                    <div className="sm:col-span-1">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1 text-center">
                        Cant.
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={it.cantidad}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value));
                          setItems((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, cantidad: val } : item))
                          );
                        }}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold font-mono text-xs text-slate-900 text-center shadow-2xs"
                      />
                    </div>

                    {/* 6. Precio Unitario */}
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 truncate text-right" title="Precio Unitario (S/)">
                        Precio
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={it.precio === 0 ? "" : it.precio}
                        placeholder="0.00"
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9.]/g, "");
                          const parts = raw.split(".");
                          const clean = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : raw;
                          setItems((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, precio: clean as any } : item))
                          );
                        }}
                        onBlur={() => {
                          const val = parseFloat(String(it.precio || 0));
                          setItems((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, precio: isNaN(val) ? 0 : Number(val.toFixed(2)) } : item))
                          );
                        }}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold font-mono text-xs text-slate-900 text-right shadow-2xs focus:ring-2 focus:ring-emerald-400"
                      />
                    </div>

                    {/* 7. Subtotal & Eliminar */}
                    <div className="sm:col-span-1 flex flex-col justify-between items-end h-[58px]">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length === 1}
                        className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-20 transition-colors cursor-pointer"
                        title="Eliminar ítem"
                      >
                        <Trash2 size={15} />
                      </button>
                      <div className="text-right">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Subtotal</span>
                        <span className="text-xs font-black text-slate-900 font-mono block truncate">
                          S/ {(it.cantidad * it.precio).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Zona de Pistoleo / Importación Masiva si es EQUIPO / Maneja Serie */}
                  {esEquipo && (
                    <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 space-y-2.5 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                            <QrCode size={15} className="text-emerald-700" />
                            <span>Series para {it.nombre}</span>
                          </span>

                          {/* Badge de estado de completitud de series */}
                          {it.series.length === it.cantidad ? (
                            <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Check size={11} className="text-emerald-700" />
                              Completo ({it.series.length} de {it.cantidad})
                            </span>
                          ) : it.series.length < it.cantidad ? (
                            <span className="text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-md animate-pulse flex items-center gap-1">
                              <AlertCircle size={11} className="text-rose-600" />
                              Faltan {it.cantidad - it.series.length} series ({it.series.length} de {it.cantidad})
                            </span>
                          ) : (
                            <span className="text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <AlertCircle size={11} className="text-amber-700" />
                              {it.series.length} series (excede {it.cantidad})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">

                          {/* Botón Lote de Talonarios / Actas por Rango */}
                          {(it.categoria.includes("TALONARIO") || it.categoria.includes("ACTA") || it.categoria.includes("GUIA") || it.nombre.toUpperCase().includes("ACTA") || it.nombre.toUpperCase().includes("GUIA")) && (
                            <button
                              type="button"
                              onClick={() =>
                                setModalRangoActas({
                                  isOpen: true,
                                  itemIndex: idx,
                                  prefijo: "001-",
                                  inicio: "04001",
                                  cantidad: it.cantidad || 500,
                                })
                              }
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                              title="Generar correlativos automáticos para talonarios de actas o guías"
                            >
                              <FileText size={13} className="text-amber-700" />
                              <span>⚡ Generar Rango Talonario</span>
                            </button>
                          )}

                          {/* Botón Pegar Series desde Excel */}
                          <button
                            type="button"
                            onClick={() => setModalPegarSeries({ isOpen: true, itemIndex: idx, textoPegado: "" })}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="Pegar lista de series copiada desde Excel o archivo de texto"
                          >
                            <ClipboardPaste size={13} />
                            <span>📋 Pegar desde Excel</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setItemIndexParaSeries(idx)}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                              itemIndexParaSeries === idx
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                            }`}
                          >
                            {itemIndexParaSeries === idx ? "⚡ Escáner Activo" : "Activar Pistola"}
                          </button>
                        </div>
                      </div>

                      {itemIndexParaSeries === idx && (
                        <div className="bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200 space-y-2.5 shadow-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                            <span className="text-[11px] font-black text-slate-800 flex items-center gap-1.5">
                              <span>⚡ Pistoleo y Registro de Equipos</span>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                {it.series.length} de {it.cantidad} ingresadas
                              </span>
                            </span>
                            <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={modoDoblePistola}
                                onChange={(e) => setModoDoblePistola(e.target.checked)}
                                className="w-3.5 h-3.5 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                              />
                              <span>⚡ Salto automático a ID Equipo al pistolear Serie</span>
                            </label>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                            {/* 1. Serie / MAC (Pistola o Manual) * */}
                            <div className="sm:col-span-4 flex flex-col">
                              <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <span>Serie / MAC (Pistola o Manual) *</span>
                              </span>
                              <input
                                ref={serieInputRef}
                                type="text"
                                placeholder={
                                  it.series.length >= it.cantidad
                                    ? `✅ Cupo completo (${it.cantidad} de ${it.cantidad})`
                                    : `Pistolear Serie (${it.series.length + 1} de ${it.cantidad})...`
                                }
                                disabled={it.series.length >= it.cantidad}
                                value={serieInput}
                                onChange={(e) => setSerieInput(e.target.value)}
                                onKeyDown={handlePistolearSerie}
                                className={`w-full p-2 rounded-xl text-xs font-mono font-bold focus:outline-none transition-all h-[38px] ${
                                  it.series.length >= it.cantidad
                                    ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                                    : "bg-white border border-emerald-400 text-slate-900 focus:ring-2 focus:ring-emerald-400 shadow-2xs"
                                }`}
                              />
                            </div>

                            {/* 2. ID Equipo (Pistola o Manual) */}
                            <div className="sm:col-span-4 flex flex-col">
                              <span className="text-[10px] font-black text-cyan-900 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <span>ID Equipo (Pistola o Manual)</span>
                              </span>
                              <input
                                ref={idEquipoInputRef}
                                type="text"
                                placeholder="Pistolear o digitar ID Equipo..."
                                disabled={it.series.length >= it.cantidad}
                                value={serieIdEquipoInput}
                                onChange={(e) => setSerieIdEquipoInput(e.target.value)}
                                onKeyDown={handlePistolearIdEquipo}
                                className="w-full p-2 rounded-xl text-xs font-mono font-bold bg-white border border-cyan-300 text-cyan-950 placeholder:text-cyan-400/60 focus:ring-2 focus:ring-cyan-400 focus:outline-none shadow-2xs h-[38px]"
                                title="ID de equipo único (código de operador WIN o ID de equipo). Se puede pistolear o digitar."
                              />
                            </div>

                            {/* 3. ID Modelo (Opcional) */}
                            <div className="sm:col-span-3 flex flex-col">
                              <span className="text-[10px] font-black text-purple-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <span>ID Modelo (Opcional)</span>
                              </span>
                              <input
                                type="text"
                                placeholder="Ej: ZTE-F670L..."
                                disabled={it.series.length >= it.cantidad}
                                value={serieProidInput}
                                onChange={(e) => setSerieProidInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    procesarAgregarSerie(serieInput, serieIdEquipoInput, serieProidInput);
                                  }
                                }}
                                className="w-full p-2 rounded-xl text-xs font-mono font-bold bg-white border border-purple-200 text-purple-950 placeholder:text-purple-300 focus:ring-2 focus:ring-purple-400 focus:outline-none shadow-2xs h-[38px]"
                                title="Código o ID Modelo de este equipo (ej: ZTE-F670L). Se mantiene fijo para todos los equipos de este lote."
                              />
                            </div>

                            {/* Botón Agregar */}
                            <div className="sm:col-span-1 flex items-end">
                              <button
                                type="button"
                                disabled={it.series.length >= it.cantidad || !serieInput.trim()}
                                onClick={() => procesarAgregarSerie(serieInput, serieIdEquipoInput, serieProidInput)}
                                className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition-all shrink-0 flex items-center gap-1 justify-center h-[38px]"
                                title={it.series.length >= it.cantidad ? "Cupo completo" : "Agregar este equipo"}
                              >
                                <Plus size={15} />
                                <span>Agregar</span>
                              </button>
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 flex-wrap pt-0.5">
                            <span className="text-emerald-600 font-bold">💡 Tip:</span>
                            <span>La <strong>Serie / MAC</strong> y el <strong>ID Equipo</strong> son únicos para cada equipo pistoleado. El <strong>ID Modelo</strong> se mantiene fijo para agilizar el ingreso.</span>
                          </div>
                        </div>
                      )}

                      {/* Series Tags con Serie, ID Equipo y Modelo */}
                      {it.series.length > 0 && (
                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pt-1">
                          {it.series.map((sObj, sIdx) => {
                            const sn = typeof sObj === "string" ? sObj : sObj.numero_serie;
                            const idEq = typeof sObj === "string" ? "" : (sObj.id_equipo || "");
                            const pId = typeof sObj === "string" ? "" : (sObj.proid || "");
                            const cSerie = typeof sObj === "string" ? "" : (sObj.codigo_serie || `${it.codigo || "EQP"}-S${String(sIdx + 1).padStart(3, "0")}`);
                            return (
                              <div
                                key={sIdx}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-mono font-bold shadow-2xs transition-all"
                              >
                                <span className="text-[10px] font-black text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1">
                                  🏷️ {cSerie}
                                </span>
                                <span className="text-slate-950 font-mono font-bold">
                                  SN: {sn}
                                </span>
                                {idEq && (
                                  <span className="text-cyan-900 bg-cyan-100 px-2 py-0.5 rounded-md border border-cyan-300 font-black text-[10px] flex items-center gap-1">
                                    ⚡ ID Eq: {idEq}
                                  </span>
                                )}
                                {pId ? (
                                  <span className="text-purple-800 bg-purple-100 px-2 py-0.5 rounded-md border border-purple-300 font-black text-[10px] flex items-center gap-1">
                                    🏷️ Mod: {pId}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-normal text-[10px] italic">
                                    (Sin Modelo)
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSerie(idx, sn)}
                                  className="text-slate-400 hover:text-rose-600 cursor-pointer ml-1 p-0.5 rounded hover:bg-rose-50 transition-colors"
                                  title="Eliminar este equipo de la compra"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              );
            })}
          </div>

          {/* Mensaje de Advertencia si faltan series por pistolear */}
          {items.some((it) => {
            const prod = localProductos.find((p) => p.id_producto === it.id_producto);
            const esSerializado = Boolean(
              it.maneja_serie ||
              it.categoria?.toUpperCase() === "EQUIPOS" ||
              it.categoria?.toUpperCase() === "TALONARIOS Y GUIAS" ||
              prod?.maneja_serie
            );
            return esSerializado && (it.series?.length || 0) !== it.cantidad;
          }) && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs text-rose-900 font-bold animate-pulse">
                <AlertCircle size={18} className="text-rose-600 shrink-0" />
                <span>
                  ⚠️  Para registrar la compra y garantizar el control de stock, debes ingresar la totalidad de las series.
                </span>
              </div>
            )}

          {/* Resumen Total y Submit */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <div>
              <span className="text-xs font-bold text-slate-400 block uppercase">Total de la Compra</span>
              <span className="text-2xl font-black text-slate-900 font-mono">
                S/ {totalGeneral.toFixed(2)}
              </span>
            </div>

            <button
              type="submit"
              disabled={guardando || items.length === 0}
              className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.01]"
            >
              {guardando ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              <span>Guardar Compra e Ingresar al Almacén</span>
            </button>
          </div>

        </div>

      </form>
      ) : (
        /* ─────────────────────────────────────────────────────────────
            VISTA B: HISTORIAL DE COMPRAS & AUDITORÍA DE ENTRADAS
        ───────────────────────────────────────────────────────────── */
        <div className="space-y-6 animate-fade-in font-sans">
          {/* Tarjetas de Métricas del Historial */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
                <ShoppingCart size={22} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Total Compras</span>
                <span className="text-2xl font-black text-slate-900">{comprasHistorial.length}</span>
                <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Entradas registradas</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 shadow-2xs">
                <DollarSign size={22} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Monto Invertido</span>
                <span className="text-2xl font-black text-emerald-600">
                  S/ {comprasHistorial.filter(c => c.estado !== 'ANULADA').reduce((acc, c) => acc + Number(c.total || 0), 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-emerald-700 font-medium block mt-0.5">Compras vigentes</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600 shrink-0 shadow-2xs">
                <Package size={22} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Total Productos</span>
                <span className="text-2xl font-black text-cyan-700">
                  {comprasHistorial.filter(c => c.estado !== 'ANULADA').reduce((acc, c) => acc + Number(c.total_items || 0), 0)}
                </span>
                <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Unidades y equipos</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0 shadow-2xs">
                <Ban size={22} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Compras Anuladas</span>
                <span className="text-2xl font-black text-rose-600">
                  {comprasHistorial.filter(c => c.estado === 'ANULADA').length}
                </span>
                <span className="text-[10px] text-rose-700 font-medium block mt-0.5">Revertidas de stock</span>
              </div>
            </div>
          </div>

          {/* Filtros y Buscador */}
          <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[260px] max-w-md bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={busquedaHistorial}
                onChange={(e) => setBusquedaHistorial(e.target.value)}
                placeholder="Buscar por comprobante, proveedor, RUC, serie o producto..."
                className="w-full bg-transparent text-xs font-medium text-slate-800 focus:outline-none placeholder-slate-400"
              />
              {busquedaHistorial && (
                <button
                  type="button"
                  onClick={() => setBusquedaHistorial("")}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFiltroEstadoHistorial("todos")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    filtroEstadoHistorial === "todos"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Todas ({comprasHistorial.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroEstadoHistorial("COMPLETADO")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    filtroEstadoHistorial === "COMPLETADO"
                      ? "bg-white text-emerald-700 shadow-2xs font-extrabold"
                      : "text-slate-600 hover:text-emerald-700"
                  }`}
                >
                  Vigentes ({comprasHistorial.filter(c => c.estado !== 'ANULADA').length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroEstadoHistorial("ANULADA")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    filtroEstadoHistorial === "ANULADA"
                      ? "bg-white text-rose-700 shadow-2xs font-extrabold"
                      : "text-slate-600 hover:text-rose-700"
                  }`}
                >
                  Anuladas ({comprasHistorial.filter(c => c.estado === 'ANULADA').length})
                </button>
              </div>

              <button
                type="button"
                onClick={cargarHistorial}
                disabled={cargandoHistorial}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Refrescar historial"
              >
                <RefreshCw size={14} className={cargandoHistorial ? "animate-spin" : ""} />
                <span>Refrescar</span>
              </button>
            </div>
          </div>

          {/* Tabla del Historial */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Comprobante / N°</th>
                    <th className="py-3.5 px-4">Fecha</th>
                    <th className="py-3.5 px-4">Proveedor / RUC</th>
                    <th className="py-3.5 px-4">Productos</th>
                    <th className="py-3.5 px-4 text-center">Series</th>
                    <th className="py-3.5 px-4 text-right">Total</th>
                    <th className="py-3.5 px-4 text-center">Estado</th>
                    <th className="py-3.5 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historialFiltrado.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                        {cargandoHistorial ? "Cargando historial de compras..." : "No se encontraron compras con los filtros seleccionados."}
                      </td>
                    </tr>
                  ) : (
                    historialFiltrado.map((compra) => {
                      const esAnulada = compra.estado === "ANULADA";
                      const totalSeries = (compra.items || []).reduce((acc, it) => acc + (it.series_array?.length || 0), 0);

                      return (
                        <tr
                          key={compra.id_compra}
                          className={`hover:bg-slate-50/60 transition-colors ${esAnulada ? "bg-rose-50/20 text-slate-400 opacity-80" : ""}`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-[10px] border border-indigo-100 shrink-0">
                                #{compra.id_compra}
                              </span>
                              <div>
                                <span className="font-extrabold text-slate-900 block">
                                  {compra.numero_comprobante || "S/N"}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 block font-mono">
                                  {compra.tipo_comprobante || "Nota de Ingreso"}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                              <Calendar size={13} className="text-slate-400" />
                              <span>{new Date(compra.fecha).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                              {new Date(compra.fecha_creacion).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-extrabold text-slate-800 block truncate max-w-[220px]">
                              {compra.proveedor_nombre || "INGRESO DIRECTO / SIN PROVEEDOR"}
                            </span>
                            {compra.proveedor_ruc && (
                              <span className="text-[10px] font-mono text-slate-400 font-bold">
                                RUC: {compra.proveedor_ruc}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-extrabold text-slate-700 block">
                              {compra.total_items} unid. ({compra.items?.length || 0} prod.)
                            </span>
                            <span
                              className="text-[10px] text-slate-400 truncate max-w-[220px] block"
                              title={compra.items?.map((it) => `${it.cantidad}x ${it.producto_nombre}`).join(', ')}
                            >
                              {compra.items?.map((it) => `${it.cantidad}x ${it.producto_nombre}`).slice(0, 2).join(', ')}
                              {(compra.items?.length || 0) > 2 ? '...' : ''}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center">
                            {totalSeries > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-50 text-cyan-800 border border-cyan-200">
                                <QrCode size={11} /> {totalSeries} series
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px] font-mono">-</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <span className={`font-black font-mono text-sm ${esAnulada ? "line-through text-slate-400" : "text-emerald-700"}`}>
                              S/ {Number(compra.total || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center">
                            {esAnulada ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                <Ban size={11} /> ANULADA
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 size={11} /> COMPLETADA
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setCompraDetalleModal(compra)}
                                className="p-1.5 rounded-xl text-indigo-600 hover:bg-indigo-50 border border-indigo-100 transition-all cursor-pointer"
                                title="Ver detalle completo de productos y series"
                              >
                                <Eye size={14} />
                              </button>

                              {!esAnulada && (
                                <button
                                  type="button"
                                  onClick={() => setModalAnular({
                                    isOpen: true,
                                    compra,
                                    motivo: "",
                                    guardando: false,
                                    error: null
                                  })}
                                  className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-100 transition-all cursor-pointer"
                                  title="Anular compra y revertir stock"
                                >
                                  <Ban size={14} />
                                </button>
                              )}
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
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. MODAL FLOTANTE: REGISTRAR NUEVO PRODUCTO EN CATÁLOGO
      ───────────────────────────────────────────────────────────── */}
      {modalNuevoProd.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl w-full max-w-md space-y-4 animate-scale-up">

            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Registrar Nuevo Producto
                  </h3>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase">
                    Categoría: {modalNuevoProd.categoria}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalNuevoProd((prev) => ({ ...prev, isOpen: false }))}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error si ocurre */}
            {modalNuevoProd.error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-600" />
                <span>{modalNuevoProd.error}</span>
              </div>
            )}

            {/* Formulario de Nuevo Producto */}
            <form onSubmit={handleGuardarNuevoProducto} className="space-y-3.5">

              {/* Categoría Seleccionada con opción de agregar rápida */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-600">Categoría</label>
                  {!creandoCategoriaRapida && (
                    <button
                      type="button"
                      onClick={() => {
                        setCreandoCategoriaRapida(true);
                        setNuevaCatNombre("");
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>Nueva Categoría</span>
                    </button>
                  )}
                </div>

                {creandoCategoriaRapida ? (
                  <div className="flex items-center gap-1.5 p-1.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <input
                      type="text"
                      autoFocus
                      placeholder="NOMBRE NUEVA CATEGORÍA..."
                      value={nuevaCatNombre}
                      onChange={(e) => setNuevaCatNombre(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-slate-900 uppercase focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleGuardarCategoriaRapida}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreandoCategoriaRapida(false)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <select
                    value={modalNuevoProd.categoria}
                    onChange={(e) => {
                      const cat = e.target.value.toUpperCase();
                      setModalNuevoProd((prev) => ({
                        ...prev,
                        categoria: cat,
                        maneja_serie: cat === "EQUIPOS",
                      }));
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-900"
                  >
                    {categorias.map((c) => (
                      <option key={c} value={c}>
                        📁 {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Nombre del Producto */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Nombre del Producto / Insumo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: ROSETA ÓPTICA 2 PUERTOS, ONT HUAWEI..."
                  value={modalNuevoProd.nombre}
                  onChange={(e) => setModalNuevoProd((prev) => ({ ...prev, nombre: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-400"
                  autoFocus
                />

                {/* Badge visual de código inteligente sugerido en tiempo real */}
                {modalNuevoProd.nombre.trim().length >= 2 && (
                  <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-xl">
                    <span className="flex items-center gap-1">
                      <span>🏷️ Código generado:</span>
                    </span>
                    <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-md text-[11px] font-black tracking-wider shadow-2xs">
                      {(() => {
                        const nom = modalNuevoProd.nombre.toUpperCase().trim();
                        let prefix = "";
                        if (nom.includes("ZTE")) prefix = "ZT";
                        else if (nom.includes("HUAWEI")) prefix = "HW";
                        else if (nom.includes("FIBERHOME")) prefix = "FH";
                        else if (nom.includes("WIN TV") || nom.includes("DECODIFICADOR") || nom.includes("DECO")) prefix = "WT";
                        else if (nom.includes("TP-LINK") || nom.includes("TPLINK")) prefix = "TP";
                        else if (nom.includes("MERCUSYS")) prefix = "MC";
                        else if (nom.includes("ROSETA")) prefix = "ROS";
                        else if (nom.includes("CONECTOR")) prefix = "CON";
                        else if (nom.includes("DROP") || nom.includes("CABLE")) prefix = "DRP";
                        else if (nom.includes("PATCH")) prefix = "PCH";
                        else if (modalNuevoProd.categoria.toUpperCase().includes("EQUIPO")) {
                          const palabras = nom.replace(/[^A-Z0-9\s]/g, "").split(/\s+/).filter((w) => w.length >= 2);
                          prefix = (palabras[0] || "EQ").slice(0, 2);
                        } else {
                          const palabras = nom.replace(/[^A-Z0-9\s]/g, "").split(/\s+/).filter((w) => w.length >= 2);
                          prefix = (palabras[0] || "PR").slice(0, 3);
                        }

                        const existentes = localProductos.filter((p) => p.codigo && p.codigo.startsWith(prefix));
                        const letrasUsadas = new Set(
                          existentes
                            .map((p) => p.codigo.slice(prefix.length).match(/^([A-Z])/)?.[1])
                            .filter(Boolean)
                        );

                        const abecedario = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                        let letra = "A";
                        for (let i = 0; i < abecedario.length; i++) {
                          if (!letrasUsadas.has(abecedario[i])) {
                            letra = abecedario[i];
                            break;
                          }
                        }

                        return `${prefix}${letra}001`;
                      })()}
                    </span>
                  </div>
                )}
              </div>

              {/* ID Modelo */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center justify-between">
                  <span>ID Modelo</span>
                  <span className="text-slate-400 font-normal text-[11px]">(Opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: ONT-HG8145V5 / Dejar en blanco si no tiene..."
                  value={modalNuevoProd.proid}
                  onChange={(e) => setModalNuevoProd((prev) => ({ ...prev, proid: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs text-slate-900 uppercase focus:bg-white focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              {/* Stock Mínimo y Precio Unitario */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Stock Mín. Alerta
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={modalNuevoProd.stock_minimo}
                    onChange={(e) => setModalNuevoProd((prev) => ({ ...prev, stock_minimo: Number(e.target.value) }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs text-center"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Precio Compra Ref. (S/)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={modalNuevoProd.precio_compra || ""}
                    onChange={(e) => setModalNuevoProd((prev) => ({ ...prev, precio_compra: Number(e.target.value) }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs text-right"
                  />
                </div>
              </div>

              {/* Ubicación Física en Almacén (Stand A-H, Fila 1-10) */}
              <div className="p-3 bg-sky-50/70 rounded-2xl border border-sky-200">
                <label className="block text-xs font-black text-sky-900 mb-2 flex items-center gap-1.5">
                  <Building2 size={14} className="text-sky-700" />
                  <span>Ubicación Inicial en Almacén (Stand y Fila)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[11px] font-bold text-sky-800 mb-1">Stand (Módulo):</span>
                    <select
                      value={modalNuevoProd.stand}
                      onChange={(e) => setModalNuevoProd((prev) => ({ ...prev, stand: e.target.value }))}
                      className="w-full p-2 bg-white border border-sky-300 rounded-xl font-black text-xs text-sky-950 shadow-2xs"
                    >
                      {STAND_OPTIONS.map((st) => (
                        <option key={st} value={st}>Stand {st}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold text-sky-800 mb-1">Fila (Nivel):</span>
                    <select
                      value={modalNuevoProd.fila}
                      onChange={(e) => setModalNuevoProd((prev) => ({ ...prev, fila: Number(e.target.value) }))}
                      className="w-full p-2 bg-white border border-sky-300 rounded-xl font-black text-xs text-sky-950 shadow-2xs"
                    >
                      {FILA_OPTIONS.map((fl) => (
                        <option key={fl} value={fl}>Fila {fl}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Switch Único: Maneja Número de Serie */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="font-bold text-slate-700">¿Maneja Número de Serie (Pistoleo)?</span>
                  <input
                    type="checkbox"
                    checked={modalNuevoProd.maneja_serie}
                    onChange={(e) => setModalNuevoProd((prev) => ({ ...prev, maneja_serie: e.target.checked }))}
                    className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                  />
                </label>
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNuevoProd((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={modalNuevoProd.guardando}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {modalNuevoProd.guardando ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  <span>Guardar y Seleccionar</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. MODAL FLOTANTE: PEGAR SERIES MASIVAS DESDE EXCEL
      ───────────────────────────────────────────────────────────── */}
      {modalPegarSeries.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl w-full max-w-lg space-y-4 animate-scale-up">

            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                  <ClipboardPaste size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Carga Masiva de Series desde Excel
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-700">
                    Para: {items[modalPegarSeries.itemIndex]?.nombre || "Equipo"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalPegarSeries({ isOpen: false, itemIndex: 0, textoPegado: "" })}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Instrucción y Textarea */}
            <div className="space-y-2">
              <p className="text-xs text-slate-600 leading-relaxed">
                Copia y pega las series desde tu hoja de <strong>Excel</strong> o <strong>CSV</strong>. Soporta pegar <strong>1, 2 o 3 columnas</strong>:
                <br />
                • <strong>3 columnas:</strong> Serie / MAC &nbsp;|&nbsp; ID Equipo &nbsp;|&nbsp; ID Modelo
                <br />
                • <strong>2 columnas:</strong> Serie / MAC &nbsp;|&nbsp; ID Equipo (o ID Modelo)
                <br />
                • <strong>1 columna:</strong> Solo Serie / MAC
              </p>

              <textarea
                rows={8}
                placeholder={"Ejemplo con 3 columnas desde Excel:\nSN2026ONT0001\tWIN-EQP-001\tZTE-F670L\nSN2026ONT0002\tWIN-EQP-002\tZTE-F670L\n\nEjemplo con 2 columnas (Serie + ID Equipo):\nSN2026ONT0001\tWIN-EQP-001\nSN2026ONT0002\tWIN-EQP-002\n\nO solo números de serie:\nSN2026ONT0001\nSN2026ONT0002..."}
                value={modalPegarSeries.textoPegado}
                onChange={(e) => setModalPegarSeries((prev) => ({ ...prev, textoPegado: e.target.value }))}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                autoFocus
              />

              {/* Estadísticas de Series en Tiempo Real */}
              {(() => {
                const lines = modalPegarSeries.textoPegado.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
                const detectedSN = lines.map((l) => l.split(/[\t,;]+/)[0]?.trim().toUpperCase()).filter((s) => s && s.length >= 3);
                const uniqueSN = Array.from(new Set(detectedSN));
                const duplicatesCount = detectedSN.length - uniqueSN.length;
                const withIdEquipo = lines.filter((l) => {
                  const parts = l.split(/[\t,;]+/);
                  return parts.length >= 2 && Boolean(parts[1]?.trim());
                }).length;

                return (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-100 rounded-xl text-[11px] font-mono">
                    <span className="text-slate-600">
                      Filas: <strong className="text-slate-900">{lines.length}</strong>
                    </span>
                    <span className="text-emerald-700">
                      ✨ Series únicas: <strong className="font-bold">{uniqueSN.length}</strong>
                    </span>
                    {withIdEquipo > 0 && (
                      <span className="text-cyan-800 font-bold bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                        ⚡ Con ID Equipo: {withIdEquipo}
                      </span>
                    )}
                    {duplicatesCount > 0 && (
                      <span className="text-amber-700">
                        ⚠️ Duplicadas omitidas: <strong>{duplicatesCount}</strong>
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Botones de Acción */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalPegarSeries({ isOpen: false, itemIndex: 0, textoPegado: "" })}
                className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleImportarSeriesMasivas}
                disabled={!modalPegarSeries.textoPegado.trim()}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <CheckCircle2 size={14} />
                <span>Importar Series al Ítem</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. MODAL FLOTANTE: GENERADOR DE RANGO DE TALONARIOS DE ACTAS
      ───────────────────────────────────────────────────────────── */}
      {modalRangoActas.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl w-full max-w-md space-y-4 animate-scale-up">

            {/* Cabecera */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black shadow-md shadow-amber-500/25">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Generador de Rango de Talonario
                  </h3>
                  <span className="text-[10px] font-bold text-amber-800">
                    Para: {items[modalRangoActas.itemIndex]?.nombre || "Actas / Guías"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalRangoActas((prev) => ({ ...prev, isOpen: false }))}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Inputs del Rango */}
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Indica la cantidad de actas compradas y el número inicial para generar e ingresar automáticamente todas las series al almacén central:
              </p>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Cantidad Total</label>
                  <input
                    type="number"
                    min="1"
                    value={modalRangoActas.cantidad}
                    onChange={(e) => setModalRangoActas((prev) => ({ ...prev, cantidad: Math.max(1, Number(e.target.value) || 1) }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-xs text-slate-900 text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Prefijo</label>
                  <input
                    type="text"
                    value={modalRangoActas.prefijo}
                    onChange={(e) => setModalRangoActas((prev) => ({ ...prev, prefijo: e.target.value }))}
                    placeholder="001-"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-xs text-slate-900 text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Número Inicial</label>
                  <input
                    type="text"
                    value={modalRangoActas.inicio}
                    onChange={(e) => setModalRangoActas((prev) => ({ ...prev, inicio: e.target.value.replace(/\D/g, "") }))}
                    placeholder="04001"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-xs text-slate-900 text-center"
                  />
                </div>
              </div>

              {/* Preview Rango */}
              {(() => {
                const parseIni = parseInt(modalRangoActas.inicio.replace(/\D/g, ""), 10) || 1;
                const padLen = Math.max(5, modalRangoActas.inicio.replace(/\D/g, "").length || 5);
                const parseFin = parseIni + Math.max(1, modalRangoActas.cantidad) - 1;
                const iniFmt = String(parseIni).padStart(padLen, "0");
                const finFmt = String(parseFin).padStart(padLen, "0");

                return (
                  <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-center space-y-1">
                    <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider block">
                      Rango de Correlativos a Generar:
                    </span>
                    <span className="text-sm font-black font-mono text-amber-950 block">
                      {modalRangoActas.prefijo}{iniFmt} → {modalRangoActas.prefijo}{finFmt}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-block mt-1">
                      Total: {modalRangoActas.cantidad} actas físicas
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Botones */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalRangoActas((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleGenerarRangoActasCompra}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl font-black text-xs shadow-md shadow-amber-500/25 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <CheckCircle2 size={14} />
                <span>Generar {modalRangoActas.cantidad} Actas</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. MODAL FLOTANTE: DETALLE DE COMPRA & SERIES INGRESADAS
      ───────────────────────────────────────────────────────────── */}
      {compraDetalleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl w-full max-w-3xl space-y-4 max-h-[90vh] flex flex-col animate-scale-up">
            
            {/* Cabecera */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black border border-indigo-100">
                  <ShoppingCart size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-slate-900 text-sm">
                      Compra #{compraDetalleModal.id_compra} - {compraDetalleModal.tipo_comprobante} {compraDetalleModal.numero_comprobante}
                    </h3>
                    {compraDetalleModal.estado === 'ANULADA' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                        ANULADA
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                        COMPLETADA
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    Fecha: <strong>{new Date(compraDetalleModal.fecha).toLocaleDateString("es-PE")}</strong> • Proveedor: <strong>{compraDetalleModal.proveedor_nombre || "Ingreso Directo"}</strong>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCompraDetalleModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Contenido con scroll */}
            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              {compraDetalleModal.observaciones && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                  <span className="font-bold text-slate-600 block mb-0.5">Observaciones:</span>
                  <span className="text-slate-700">{compraDetalleModal.observaciones}</span>
                </div>
              )}

              {/* Lista de Productos Comprados */}
              <div className="space-y-3">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Productos & Equipos Ingresados ({compraDetalleModal.items?.length || 0})
                </span>

                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Producto</th>
                        <th className="py-2.5 px-3">Categoría</th>
                        <th className="py-2.5 px-3 text-right">Cant.</th>
                        <th className="py-2.5 px-3 text-right">Precio U.</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {compraDetalleModal.items?.map((it, itIdx) => (
                        <tr key={itIdx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-800 block">{it.producto_nombre}</span>
                            <span className="text-[10px] font-mono text-slate-400">{it.producto_codigo}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-medium">
                            {it.categoria_nombre || "GENERAL"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                            {it.cantidad}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            S/ {Number(it.precio || 0).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            S/ {Number(it.subtotal || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Series Ingresadas Desglosadas */}
              {compraDetalleModal.items?.some(it => it.series_array && it.series_array.length > 0) && (
                <div className="space-y-2">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider block flex items-center gap-1.5">
                    <QrCode size={14} className="text-indigo-600" />
                    <span>Series de Equipos Cargadas</span>
                  </span>

                  <div className="space-y-2.5">
                    {compraDetalleModal.items
                      .filter(it => it.series_array && it.series_array.length > 0)
                      .map((it, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold text-slate-800">{it.producto_nombre}</span>
                            <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                              {it.series_array.length} series registradas
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                            {it.series_array.map((sn, sIdx) => (
                              <span
                                key={sIdx}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-mono text-[11px] font-bold shadow-2xs"
                              >
                                {sn}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pie del Modal */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold">Total de la Compra:</span>
                <span className="text-lg font-black font-mono text-emerald-700">
                  S/ {Number(compraDetalleModal.total || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {compraDetalleModal.estado !== 'ANULADA' && (
                  <button
                    type="button"
                    onClick={() => {
                      setModalAnular({
                        isOpen: true,
                        compra: compraDetalleModal,
                        motivo: "",
                        guardando: false,
                        error: null,
                      });
                    }}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Ban size={14} />
                    <span>Anular esta Compra</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setCompraDetalleModal(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs cursor-pointer transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. MODAL FLOTANTE: CONFIRMAR ANULACIÓN DE COMPRA
      ───────────────────────────────────────────────────────────── */}
      {modalAnular.isOpen && modalAnular.compra && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl w-full max-w-md space-y-4 animate-scale-up">
            
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-black border border-rose-100 shrink-0">
                <Ban size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Anular Compra #{modalAnular.compra.id_compra}
                </h3>
                <span className="text-xs text-slate-500">
                  {modalAnular.compra.tipo_comprobante} {modalAnular.compra.numero_comprobante}
                </span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs space-y-1">
              <span className="font-extrabold flex items-center gap-1">
                <AlertCircle size={14} className="text-amber-600" />
                <span>Advertencia de Seguridad:</span>
              </span>
              <p className="text-[11px] leading-relaxed">
                Al anular esta compra, se <strong>descontará automáticamente el stock</strong> de Almacén Central y se eliminarán las series ingresadas.
                Solo es posible si ningún equipo ha sido asignado a un técnico ni instalado.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Motivo de la anulación (obligatorio):
              </label>
              <textarea
                value={modalAnular.motivo}
                onChange={(e) => setModalAnular(prev => ({ ...prev, motivo: e.target.value, error: null }))}
                placeholder="Ej: Error al seleccionar el producto (se ingresó como Fono Win en lugar de ONT)..."
                rows={3}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>

            {modalAnular.error && (
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 text-rose-800 text-xs font-medium whitespace-pre-line">
                {modalAnular.error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={modalAnular.guardando}
                onClick={() => setModalAnular({ isOpen: false, compra: null, motivo: "", guardando: false, error: null })}
                className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs cursor-pointer transition-all"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={modalAnular.guardando || !modalAnular.motivo.trim()}
                onClick={handleConfirmarAnular}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs shadow-md shadow-rose-600/25 flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
              >
                {modalAnular.guardando ? <RefreshCw size={14} className="animate-spin" /> : <Ban size={14} />}
                <span>Confirmar Anulación</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
