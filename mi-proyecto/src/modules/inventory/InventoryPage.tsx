import React, { useState, useEffect } from "react";
import {
  Package,
  ShoppingCart,
  Truck,
  RotateCcw,
  RefreshCw,
  Layers,
  Building2,
  Sparkles,
  QrCode,
  ClipboardCheck,
  FileCheck,
} from "lucide-react";
import { ProductoStock, StockTecnicoDetalle, SerieTecnicoDetalle } from "./types/inventoryTypes";
import { getStockGeneral } from "./services/inventoryService";
import { StockOverviewTab } from "./components/StockOverviewTab";
import { PurchaseEntryTab } from "./components/PurchaseEntryTab";
import { TechnicianDispatchTab } from "./components/TechnicianDispatchTab";
import { RetrievedEquipmentTab } from "./components/RetrievedEquipmentTab";
import { TechnicianLiquidationTab } from "./components/TechnicianLiquidationTab";
import { OrderLiquidationsAuditTab } from "./components/OrderLiquidationsAuditTab";

export const InventoryPage: React.FC = () => {
  const [tabActiva, setTabActiva] = useState<"stock" | "compras" | "despacho" | "recogidos" | "devoluciones" | "liquidaciones_ordenes">("stock");
  const [productos, setProductos] = useState<ProductoStock[]>([]);
  const [stockPorTecnico, setStockPorTecnico] = useState<StockTecnicoDetalle[]>([]);
  const [seriesTecnicos, setSeriesTecnicos] = useState<SerieTecnicoDetalle[]>([]);
  const [loading, setLoading] = useState(true);

  const cargarDatos = () => {
    setLoading(true);
    getStockGeneral()
      .then((res) => {
        setProductos(res.productos || []);
        setStockPorTecnico(res.stockPorTecnico || []);
        setSeriesTecnicos(res.seriesTecnicos || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cargarDatos();

    // Sincronizar hash de URL
    const hash = window.location.hash.replace("#", "");
    if (hash === "compras") setTabActiva("compras");
    else if (hash === "despacho") setTabActiva("despacho");
    else if (hash === "recogidos") setTabActiva("recogidos");
    else if (hash === "devoluciones" || hash === "liquidacion") setTabActiva("devoluciones");
    else if (hash === "liquidaciones" || hash === "liquidaciones_ordenes") setTabActiva("liquidaciones_ordenes");
    else if (hash === "stock") setTabActiva("stock");
  }, []);

  const handleTabChange = (t: "stock" | "compras" | "despacho" | "recogidos" | "devoluciones" | "liquidaciones_ordenes") => {
    setTabActiva(t);
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 md:p-8 space-y-6 animate-fade-in font-sans">

      {/* ─────────────────────────────────────────────────────────────
          1. HEADER & TOP NAVIGATION BAR
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-4">

        {/* Título & Badge */}
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-700 text-white flex items-center justify-center font-black shadow-md shadow-blue-600/20 border border-blue-500/20">
            <Package size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Almacén & Logística Central
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200/80">
                <Sparkles size={11} className="text-blue-600" />
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
          <RefreshCw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. SELECTOR DE PESTAÑAS PRINCIPALES
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-2">

        {/* Tab 1: Stock */}
        <button
          onClick={() => handleTabChange("stock")}
          className={`px-5 py-2.5 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${tabActiva === "stock"
            ? "bg-slate-700 text-white shadow-xs scale-[1.01]"
            : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/80"
            }`}
        >
          <Layers size={16} className={tabActiva === "stock" ? "text-slate-200" : "text-slate-400"} />
          Control de Stock & Almacenes
        </button>

        {/* Tab 2: Compras & Entrada */}
        <button
          onClick={() => handleTabChange("compras")}
          className={`px-5 py-2.5 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${tabActiva === "compras"
            ? "bg-slate-700 text-white shadow-xs scale-[1.01]"
            : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/80"
            }`}
        >
          <ShoppingCart size={16} className={tabActiva === "compras" ? "text-emerald-300" : "text-slate-400"} />
          Compras & Entrada (Pistoleo Series)
        </button>

        {/* Tab 3: Despacho a Técnicos */}
        <button
          onClick={() => handleTabChange("despacho")}
          className={`px-5 py-2.5 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${tabActiva === "despacho"
            ? "bg-slate-700 text-white shadow-xs scale-[1.01]"
            : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/80"
            }`}
        >
          <Truck size={16} className={tabActiva === "despacho" ? "text-cyan-300" : "text-slate-400"} />
          Despacho a Técnicos (Dotación)
        </button>

        {/* Tab 4: Equipos Recogidos */}
        <button
          onClick={() => handleTabChange("recogidos")}
          className={`px-5 py-2.5 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${tabActiva === "recogidos"
            ? "bg-slate-700 text-white shadow-xs scale-[1.01]"
            : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/80"
            }`}
        >
          <RotateCcw size={16} className={tabActiva === "recogidos" ? "text-amber-300" : "text-slate-400"} />
          Equipos Recogidos (Internamiento)
        </button>

        {/* Tab 5: Devolución de Dotaciones (Sobrantes / Finiquito) */}
        <button
          onClick={() => handleTabChange("devoluciones")}
          className={`px-5 py-2.5 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${tabActiva === "devoluciones"
            ? "bg-slate-700 text-white shadow-xs scale-[1.01]"
            : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/80"
            }`}
        >
          <ClipboardCheck size={16} className={tabActiva === "devoluciones" ? "text-emerald-300" : "text-slate-400"} />
          Devoluciones de Dotación
        </button>

        {/* Tab 6: NUEVO - Liquidaciones de Técnicos (Actas de Campo) */}
        <button
          onClick={() => handleTabChange("liquidaciones_ordenes")}
          className={`px-5 py-2.5 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${tabActiva === "liquidaciones_ordenes"
            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-[1.01]"
            : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/80"
            }`}
        >
          <FileCheck size={16} className={tabActiva === "liquidaciones_ordenes" ? "text-white" : "text-indigo-500"} />
          <span>Liquidaciones de Técnicos</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase ${
            tabActiva === "liquidaciones_ordenes" ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"
          }`}>
            Actas
          </span>
        </button>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. CONTENIDO DE LA PESTAÑA ACTIVA
      ───────────────────────────────────────────────────────────── */}
      {tabActiva === "stock" && (
        <StockOverviewTab
          productos={productos}
          stockPorTecnico={stockPorTecnico}
          seriesTecnicos={seriesTecnicos}
          loading={loading}
          onRefresh={cargarDatos}
        />
      )}

      {tabActiva === "compras" && (
        <PurchaseEntryTab productos={productos} onCompraRegistrada={cargarDatos} />
      )}

      {tabActiva === "despacho" && (
        <TechnicianDispatchTab productos={productos} onDespachoRealizado={cargarDatos} />
      )}

      {tabActiva === "recogidos" && <RetrievedEquipmentTab />}

      {tabActiva === "devoluciones" && (
        <TechnicianLiquidationTab
          stockPorTecnico={stockPorTecnico}
          seriesTecnicos={seriesTecnicos}
          onRefresh={cargarDatos}
        />
      )}

      {tabActiva === "liquidaciones_ordenes" && (
        <OrderLiquidationsAuditTab />
      )}

    </div>
  );
};
export default InventoryPage;
