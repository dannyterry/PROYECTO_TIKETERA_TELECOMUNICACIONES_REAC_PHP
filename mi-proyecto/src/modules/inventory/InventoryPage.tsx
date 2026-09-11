import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Package,
  ShoppingCart,
  Truck,
  RotateCcw,
  RefreshCw,
  Layers,
  Building2,
  Sparkles,
  ClipboardCheck,
  FileCheck,
  Tag,
} from "lucide-react";
import { ProductoStock, StockTecnicoDetalle, SerieTecnicoDetalle } from "./types/inventoryTypes";
import { getStockGeneral } from "./services/inventoryService";
import { StockOverviewTab } from "./components/StockOverviewTab";
import { PurchaseEntryTab } from "./components/PurchaseEntryTab";
import { TechnicianDispatchTab } from "./components/TechnicianDispatchTab";
import { RetrievedEquipmentTab } from "./components/RetrievedEquipmentTab";
import { TechnicianLiquidationTab } from "./components/TechnicianLiquidationTab";
import { OrderLiquidationsAuditTab } from "./components/OrderLiquidationsAuditTab";
import { CategoriesTab } from "./components/CategoriesTab";
import { SuppliersTab } from "./components/SuppliersTab";
import { authService } from "../../services/authService";

export const InventoryPage: React.FC = () => {
  // Permisos por sub-pestaña de Almacén
  const canStock = authService.hasAnyPermission(["stock.ver", "productos.ver"]);
  const canCompras = authService.hasAnyPermission(["compras.ver", "compras.crear"]);
  const canDespacho = authService.hasAnyPermission(["almacenes.ver", "movimientos.ver", "stock.ver"]);
  const canRecogidos = authService.hasAnyPermission(["almacenes.ver", "movimientos.ver", "stock.ver"]);
  const canDevoluciones = authService.hasAnyPermission(["almacenes.ver", "movimientos.ver", "stock.ver"]);
  const canLiquidaciones = authService.hasAnyPermission(["liquidaciones.ver"]);
  const canCategorias = authService.hasAnyPermission(["categorias.ver", "productos.ver"]);
  const canProveedores = authService.hasAnyPermission(["proveedores.ver"]);

  type InventoryTabType =
    | "stock"
    | "compras"
    | "despacho"
    | "recogidos"
    | "devoluciones"
    | "liquidaciones_ordenes"
    | "categorias"
    | "proveedores";

  const tabsConfig = useMemo(() => [
    { id: "stock" as InventoryTabType, label: "Control de Stock & Almacenes", icon: Layers, allowed: canStock },
    { id: "compras" as InventoryTabType, label: "Compras & Entrada (Series)", icon: ShoppingCart, allowed: canCompras },
    { id: "despacho" as InventoryTabType, label: "Despacho a Técnicos", icon: Truck, allowed: canDespacho },
    { id: "recogidos" as InventoryTabType, label: "Equipos Recogidos", icon: RotateCcw, allowed: canRecogidos },
    { id: "devoluciones" as InventoryTabType, label: "Devoluciones de Dotación", icon: ClipboardCheck, allowed: canDevoluciones },
    { id: "liquidaciones_ordenes" as InventoryTabType, label: "Liquidaciones de Técnicos", badge: "Actas", icon: FileCheck, allowed: canLiquidaciones },
    { id: "categorias" as InventoryTabType, label: "Categorías", icon: Tag, allowed: canCategorias },
    { id: "proveedores" as InventoryTabType, label: "Proveedores", icon: Building2, allowed: canProveedores },
  ], [canStock, canCompras, canDespacho, canRecogidos, canDevoluciones, canLiquidaciones, canCategorias, canProveedores]);

  const tabsDisponibles = useMemo(() => tabsConfig.filter((t) => t.allowed), [tabsConfig]);

  const getInitialTab = (): InventoryTabType => {
    const hash = window.location.hash.toLowerCase().replace("#", "");
    if (hash.includes("categoria") && canCategorias) return "categorias";
    if (hash.includes("proveedor") && canProveedores) return "proveedores";
    if (hash.includes("compra") && canCompras) return "compras";
    if (hash.includes("despacho") && canDespacho) return "despacho";
    if (hash.includes("recogido") && canRecogidos) return "recogidos";
    if ((hash.includes("devolucion") || hash.includes("liquidacion_tecnico")) && canDevoluciones) return "devoluciones";
    if ((hash.includes("liquidaciones") || hash.includes("liquidaciones_ordenes")) && canLiquidaciones) return "liquidaciones_ordenes";
    if ((hash.includes("stock") || hash.includes("inventario") || hash.includes("producto")) && canStock) return "stock";
    return tabsDisponibles[0]?.id || "stock";
  };

  const [tabActiva, setTabActiva] = useState<InventoryTabType>(getInitialTab);
  const [productos, setProductos] = useState<ProductoStock[]>([]);
  const [stockPorTecnico, setStockPorTecnico] = useState<StockTecnicoDetalle[]>([]);
  const [seriesTecnicos, setSeriesTecnicos] = useState<SerieTecnicoDetalle[]>([]);
  const [loading, setLoading] = useState(true);
  const isFetchingRef = useRef(false);

  const cargarDatos = useCallback(() => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    getStockGeneral()
      .then((res) => {
        setProductos(res.productos || []);
        setStockPorTecnico(res.stockPorTecnico || []);
        setSeriesTecnicos(res.seriesTecnicos || []);
      })
      .catch(console.error)
      .finally(() => {
        isFetchingRef.current = false;
        setLoading(false);
      });
  }, []);

  // Carga inicial controlada (solo 1 vez al montar)
  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Sincronización con el hash de la URL
  useEffect(() => {
    const sincronizarHash = () => {
      const hash = window.location.hash.toLowerCase().replace("#", "");
      if (hash.includes("categoria") && canCategorias) setTabActiva("categorias");
      else if (hash.includes("proveedor") && canProveedores) setTabActiva("proveedores");
      else if (hash.includes("compra") && canCompras) setTabActiva("compras");
      else if (hash.includes("despacho") && canDespacho) setTabActiva("despacho");
      else if (hash.includes("recogido") && canRecogidos) setTabActiva("recogidos");
      else if ((hash.includes("devolucion") || hash.includes("liquidacion_tecnico")) && canDevoluciones) setTabActiva("devoluciones");
      else if ((hash.includes("liquidaciones") || hash.includes("liquidaciones_ordenes")) && canLiquidaciones) setTabActiva("liquidaciones_ordenes");
      else if ((hash.includes("stock") || hash.includes("inventario") || hash.includes("producto")) && canStock) setTabActiva("stock");
    };

    sincronizarHash();
    window.addEventListener("hashchange", sincronizarHash);
    return () => window.removeEventListener("hashchange", sincronizarHash);
  }, [canCategorias, canProveedores, canCompras, canDespacho, canRecogidos, canDevoluciones, canLiquidaciones, canStock]);

  // Fallback si la pestaña activa deja de ser permitida
  useEffect(() => {
    if (tabsDisponibles.length > 0 && !tabsDisponibles.some((t) => t.id === tabActiva)) {
      setTabActiva(tabsDisponibles[0].id);
    }
  }, [tabsDisponibles, tabActiva]);

  const handleTabChange = (t: InventoryTabType) => {
    setTabActiva(t);
    window.location.hash = t;
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 md:p-8 space-y-6 animate-fade-in font-sans">

      {/* ─────────────────────────────────────────────────────────────
          1. HEADER & TOP NAVIGATION BAR
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-4">

        {/* Título & Badge */}
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-500 text-white flex items-center justify-center font-black shadow-md shadow-sky-600/20 border border-sky-500/20">
            <Package size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Almacén & Logística Central
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-50 text-sky-700 border border-sky-200/80">
                <Sparkles size={11} className="text-sky-600" />
                Control de Inventario
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Control de stock central, dotación en camionetas, trazabilidad de series ONT/Mesh y auditoría de actas.
            </p>
          </div>
        </div>

        {/* Botón Refrescar */}
        <button
          onClick={cargarDatos}
          disabled={loading}
          className="p-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
        >
          <RefreshCw size={15} className={loading ? "animate-spin text-sky-600" : ""} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. SELECTOR DE PESTAÑAS PRINCIPALES
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-2">
        {tabsDisponibles.map((tab) => {
          const Icon = tab.icon;
          const isSelected = tabActiva === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2.5 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${
                isSelected
                  ? "bg-sky-600 text-white shadow-sm shadow-sky-600/20"
                  : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/80"
              }`}
            >
              <Icon size={16} className={isSelected ? "text-white" : "text-sky-600"} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase ${
                    isSelected ? "bg-white/20 text-white" : "bg-sky-100 text-sky-700"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. CONTENIDO DE LA PESTAÑA ACTIVA (VALIDADO POR PERMISOS)
      ───────────────────────────────────────────────────────────── */}
      {tabActiva === "stock" && canStock && (
        <StockOverviewTab
          productos={productos}
          stockPorTecnico={stockPorTecnico}
          seriesTecnicos={seriesTecnicos}
          loading={loading}
          onRefresh={cargarDatos}
          onNavigateToTab={handleTabChange}
        />
      )}

      {tabActiva === "compras" && canCompras && (
        <PurchaseEntryTab productos={productos} onCompraRegistrada={cargarDatos} />
      )}

      {tabActiva === "despacho" && canDespacho && (
        <TechnicianDispatchTab productos={productos} onDespachoRealizado={cargarDatos} />
      )}

      {tabActiva === "recogidos" && canRecogidos && <RetrievedEquipmentTab />}

      {tabActiva === "devoluciones" && canDevoluciones && (
        <TechnicianLiquidationTab
          stockPorTecnico={stockPorTecnico}
          seriesTecnicos={seriesTecnicos}
          onRefresh={cargarDatos}
        />
      )}

      {tabActiva === "liquidaciones_ordenes" && canLiquidaciones && (
        <OrderLiquidationsAuditTab />
      )}

      {tabActiva === "categorias" && canCategorias && (
        <CategoriesTab />
      )}

      {tabActiva === "proveedores" && canProveedores && (
        <SuppliersTab />
      )}

    </div>
  );
};
export default InventoryPage;
