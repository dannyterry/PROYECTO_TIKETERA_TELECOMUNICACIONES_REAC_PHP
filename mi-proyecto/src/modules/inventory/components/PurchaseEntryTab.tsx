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
} from "lucide-react";
import { ProductoStock, Proveedor, CompraPayload } from "../types/inventoryTypes";
import { getProveedores, registrarCompra, consultarSunatRuc, crearProducto, getCategorias } from "../services/inventoryService";

interface Props {
  productos: ProductoStock[];
  onCompraRegistrada: () => void;
}

interface ItemRow {
  id_producto: number;
  nombre: string;
  categoria: string;
  cantidad: number;
  precio: number;
  maneja_serie: boolean;
  series: string[];
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Datos Comprobante & Proveedor
  const [tipoComprobante, setTipoComprobante] = useState<"Factura" | "Boleta">("Factura");
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

    const generated: string[] = [];
    for (let i = parseInicio; i <= parseFin; i++) {
      generated.push(`${prefijo}${String(i).padStart(padLen, "0")}`);
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
      nombre: "ONT",
      categoria: "EQUIPOS",
      maneja_serie: true,
      precio_compra: 145.0,
    };
    return [
      {
        id_producto: defaultProd.id_producto,
        nombre: defaultProd.nombre,
        categoria: (defaultProd.categoria || "EQUIPOS").toUpperCase(),
        cantidad: 10,
        precio: Number(defaultProd.precio_compra) || 145.0,
        maneja_serie: Boolean(defaultProd.maneja_serie || defaultProd.categoria === "EQUIPOS"),
        series: [],
      },
    ];
  });

  // 5. Pistoleo temporal
  const [serieInput, setSerieInput] = useState("");
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
  const handlePistolearSerie = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && serieInput.trim()) {
      e.preventDefault();
      const clean = serieInput.trim().toUpperCase();
      const currentItem = items[itemIndexParaSeries];
      if (!currentItem) return;

      // 1. Validar si ya se completó el cupo de la cantidad indicada
      if (currentItem.series.length >= currentItem.cantidad) {
        alert(
          `⚠️ LÍMITE DE CANTIDAD ALCANZADO:\n\nYa ingresaste las ${currentItem.cantidad} series para "${currentItem.nombre}".\n\nSi deseas pistolear más unidades, primero aumenta la casilla "Cantidad".`
        );
        setSerieInput("");
        return;
      }

      // 2. Validar duplicados dentro de toda la compra actual
      const existeEnOtro = items.some((it, idx) => idx !== itemIndexParaSeries && it.series.includes(clean));
      if (currentItem.series.includes(clean) || existeEnOtro) {
        alert(`⚠️ SERIE DUPLICADA:\n\nLa serie "${clean}" ya fue ingresada en esta compra.\n\nCada equipo debe tener un número de serie único e irrepetible.`);
        setSerieInput("");
        return;
      }

      const nuevasSeries = [...currentItem.series, clean];
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === itemIndexParaSeries
            ? { ...it, series: nuevasSeries }
            : it
        )
      );
      setSerieInput("");
    }
  };

  const handleRemoveSerie = (itemIdx: number, serieAEliminar: string) => {
    setItems((prev) =>
      prev.map((it, idx) =>
        idx === itemIdx
          ? { ...it, series: it.series.filter((s) => s !== serieAEliminar) }
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
        nombre: prodDefault?.nombre || "Seleccione producto...",
        categoria: catDefault,
        cantidad: 1,
        precio: Number(prodDefault?.precio_compra) || 0,
        maneja_serie: Boolean(prodDefault?.maneja_serie || catDefault === "EQUIPOS"),
        series: [],
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
              nombre: firstProd.nombre,
              precio: Number(firstProd.precio_compra) || it.precio || 0,
              maneja_serie: Boolean(firstProd.maneja_serie || catUpper === "EQUIPOS"),
              series: [],
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
            nombre: prod.nombre,
            categoria: (prod.categoria || it.categoria || "GENERAL").toUpperCase(),
            precio: Number(prod.precio_compra) || it.precio || 0,
            maneja_serie: Boolean(prod.maneja_serie || prod.categoria === "EQUIPOS"),
            series: it.id_producto === prod.id_producto ? it.series : [],
          }
          : it
      )
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
                nombre: nuevoProd.nombre,
                categoria: nuevoProd.categoria,
                precio: Number(nuevoProd.precio_compra) || it.precio || 0,
                maneja_serie: Boolean(nuevoProd.maneja_serie || nuevoProd.categoria === "EQUIPOS"),
                series: [],
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

  // Procesar Pegado Masivo de Series desde Excel / Portapapeles
  const handleImportarSeriesMasivas = () => {
    const raw = modalPegarSeries.textoPegado;
    if (!raw.trim()) return;

    // Dividir por saltos de línea, tabulaciones o comas
    const lines = raw
      .split(/[\r\n,\t]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length >= 3);

    const rowIdx = modalPegarSeries.itemIndex;
    const currentItem = items[rowIdx];
    if (!currentItem) return;

    // Unir series existentes con las nuevas ignorando duplicados
    const seriesUnicas = Array.from(new Set([...currentItem.series, ...lines]));

    if (seriesUnicas.length > currentItem.cantidad) {
      const confirmActualizar = confirm(
        `Has pegado ${seriesUnicas.length} series únicas, pero la cantidad configurada en la fila es de ${currentItem.cantidad} unidades.\n\n¿Deseas actualizar la cantidad de compra a ${seriesUnicas.length} unidades para que coincida exactamente?`
      );
      if (confirmActualizar) {
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === rowIdx
              ? { ...it, series: seriesUnicas, cantidad: seriesUnicas.length }
              : it
          )
        );
      } else {
        const recortadas = seriesUnicas.slice(0, currentItem.cantidad);
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === rowIdx ? { ...it, series: recortadas } : it
          )
        );
      }
    } else {
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === rowIdx ? { ...it, series: seriesUnicas } : it
        )
      );
    }

    setModalPegarSeries({ isOpen: false, itemIndex: 0, textoPegado: "" });
  };

  const totalGeneral = items.reduce((acc, it) => acc + it.cantidad * it.precio, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numeroComprobante.trim()) {
      alert("Por favor ingresa el número de factura o boleta.");
      return;
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
        ruc_proveedor: ruc,
        razon_social_proveedor: razonSocial,
        direccion_proveedor: direccion,
        telefono_proveedor: telefono,
        tipo_comprobante: tipoComprobante,
        numero_comprobante: numeroComprobante,
        fecha,
        items: items.map((it) => ({
          id_producto: it.id_producto,
          cantidad: it.cantidad,
          precio: it.precio,
          series: it.series,
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

  return (
    <>
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
              <label className="block text-xs font-bold text-slate-600 mb-1">Tipo Comprobante</label>
              <select
                value={tipoComprobante}
                onChange={(e: any) => setTipoComprobante(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs"
              >
                <option value="Factura">Factura Electrónica</option>
                <option value="Boleta">Boleta de Venta</option>
              </select>
            </div>

            {/* N° Comprobante */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">N° Comprobante *</label>
              <input
                type="text"
                required
                placeholder="Ej: F001-0008472"
                value={numeroComprobante}
                onChange={(e) => setNumeroComprobante(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs"
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
                  placeholder="Digita RUC (11 dígitos)..."
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
              <label className="block text-xs font-bold text-slate-600 mb-1">Razón Social / Proveedor</label>
              <input
                type="text"
                placeholder="Nombre del proveedor..."
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
              const prodsDeCat = getProductosPorCategoria(it.categoria);

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border transition-all space-y-3 ${itemIndexParaSeries === idx && esEquipo
                      ? "bg-emerald-50/40 border-emerald-300 ring-2 ring-emerald-100"
                      : "bg-slate-50/60 border-slate-200/90"
                    }`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">

                    {/* 1. Selector de Categoría (Paso 1) */}
                    <div className="sm:col-span-3">
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

                    {/* 2. Selector de Producto de esa Categoría (Paso 2) + Botón "+ Nuevo" */}
                    <div className="sm:col-span-4">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                          <Package size={13} className="text-slate-600" />
                          <span>2. Producto</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => abrirModalNuevoProducto(it.categoria, idx)}
                          className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                          title="Crear un nuevo producto en esta categoría"
                        >
                          <Plus size={11} />
                          <span>+ Crear Nuevo</span>
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
                              {p.nombre} ({p.codigo}) {p.maneja_serie ? "• 🏷️ Serie" : ""}
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

                    {/* 3. Cantidad */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        Cantidad
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

                    {/* 4. Precio Unitario */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        Precio Unit. (S/)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.precio}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setItems((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, precio: val } : item))
                          );
                        }}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold font-mono text-xs text-slate-900 text-right shadow-2xs"
                      />
                    </div>

                    {/* 5. Subtotal */}
                    <div className="sm:col-span-1 text-right">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">Subtotal</span>
                      <span className="text-xs font-black text-slate-900 font-mono block truncate">
                        S/ {(it.cantidad * it.precio).toFixed(2)}
                      </span>
                    </div>

                    {/* Eliminar Ítem */}
                    <div className="sm:col-span-12 lg:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length === 1}
                        className="p-2 text-slate-400 hover:text-rose-600 disabled:opacity-20 transition-colors cursor-pointer"
                        title="Eliminar ítem"
                      >
                        <Trash2 size={16} />
                      </button>
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
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${itemIndexParaSeries === idx
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                              }`}
                          >
                            {itemIndexParaSeries === idx ? "⚡ Escáner Activo" : "Activar Pistola"}
                          </button>
                        </div>
                      </div>

                      {itemIndexParaSeries === idx && (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder={
                              it.series.length >= it.cantidad
                                ? `✅ Cupo completo (${it.cantidad} de ${it.cantidad} ingresadas). Aumenta cantidad si deseas agregar más.`
                                : `Apunta la pistola o digita la serie (${it.series.length + 1} de ${it.cantidad}) y presiona ENTER...`
                            }
                            disabled={it.series.length >= it.cantidad}
                            value={serieInput}
                            onChange={(e) => setSerieInput(e.target.value)}
                            onKeyDown={handlePistolearSerie}
                            className={`flex-1 p-2 rounded-xl text-xs font-mono font-bold focus:outline-none transition-all ${it.series.length >= it.cantidad
                                ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                                : "bg-emerald-50/30 border border-emerald-300 text-slate-900 focus:ring-2 focus:ring-emerald-400"
                              }`}
                          />
                          <button
                            type="button"
                            disabled={it.series.length >= it.cantidad}
                            onClick={() => {
                              if (serieInput.trim()) {
                                const clean = serieInput.trim().toUpperCase();
                                if (it.series.length >= it.cantidad) {
                                  alert(
                                    `⚠️ LÍMITE DE CANTIDAD ALCANZADO:\n\nYa ingresaste las ${it.cantidad} series para "${it.nombre}".\n\nSi deseas agregar más unidades, primero aumenta la casilla "Cantidad".`
                                  );
                                  setSerieInput("");
                                  return;
                                }
                                const existeEnOtro = items.some((otherIt, otherIdx) => otherIdx !== idx && otherIt.series.includes(clean));
                                if (it.series.includes(clean) || existeEnOtro) {
                                  alert(`⚠️ SERIE DUPLICADA:\n\nLa serie "${clean}" ya fue ingresada en esta compra.\n\nCada equipo debe tener un número de serie único e irrepetible.`);
                                  setSerieInput("");
                                  return;
                                }
                                const nuevas = [...it.series, clean];
                                setItems((prev) =>
                                  prev.map((item, i) =>
                                    i === idx
                                      ? { ...item, series: nuevas }
                                      : item
                                  )
                                );
                                setSerieInput("");
                              }
                            }}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition-all"
                            title={it.series.length >= it.cantidad ? "Cupo de series completo" : "Agregar serie"}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      )}

                      {/* Series Tags */}
                      {it.series.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pt-1">
                          {it.series.map((sn) => (
                            <span
                              key={sn}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-300 rounded-md text-[10px] font-mono font-bold shadow-2xs"
                            >
                              <span>{sn}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveSerie(idx, sn)}
                                className="text-slate-400 hover:text-rose-600 cursor-pointer"
                              >
                                <X size={11} />
                              </button>
                            </span>
                          ))}
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

              {/* Categoría Seleccionada */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Categoría</label>
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
              <p className="text-xs text-slate-600">
                Copia la columna de números de serie desde tu hoja de <strong>Excel</strong>, <strong>CSV</strong> o bloc de notas y pégala directamente en el cuadro:
              </p>

              <textarea
                rows={8}
                placeholder="Ejemplo:&#10;SN2026ONT0001&#10;SN2026ONT0002&#10;SN2026ONT0003&#10;SN2026ONT0004..."
                value={modalPegarSeries.textoPegado}
                onChange={(e) => setModalPegarSeries((prev) => ({ ...prev, textoPegado: e.target.value }))}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                autoFocus
              />

              {/* Estadísticas de Series en Tiempo Real */}
              {(() => {
                const detected = modalPegarSeries.textoPegado
                  .split(/[\r\n,\t]+/)
                  .map((s) => s.trim().toUpperCase())
                  .filter((s) => s.length >= 3);
                const unique = Array.from(new Set(detected));
                const duplicatesCount = detected.length - unique.length;

                return (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-100 rounded-xl text-[11px] font-mono">
                    <span className="text-slate-600">
                      Total detectadas: <strong className="text-slate-900">{detected.length}</strong>
                    </span>
                    <span className="text-emerald-700">
                      ✨ Válidas únicas: <strong className="font-bold">{unique.length}</strong>
                    </span>
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
    </>
  );
};
