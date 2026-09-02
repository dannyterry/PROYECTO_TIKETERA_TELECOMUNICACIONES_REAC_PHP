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
} from "lucide-react";
import { ProductoStock, StockTecnicoDetalle, SerieTecnicoDetalle } from "./types/inventoryTypes";
import { getStockGeneral } from "./services/inventoryService";
import { StockOverviewTab } from "./components/StockOverviewTab";
import { PurchaseEntryTab } from "./components/PurchaseEntryTab";
import { TechnicianDispatchTab } from "./components/TechnicianDispatchTab";
import { RetrievedEquipmentTab } from "./components/RetrievedEquipmentTab";

export const InventoryPage: React.FC = () => {
  const [tabActiva, setTabActiva] = useState<"stock" | "compras" | "despacho" | "recogidos">("stock");
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
    else if (hash === "stock") setTabActiva("stock");
  }, []);

  const handleTabChange = (t: "stock" | "compras" | "despacho" | "recogidos") => {
    setTabActiva(t);
    window.location.hash = t;
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 md:p-8 space-y-6 animate-fade-in font-sans">

      {/* ─────────────────────────────────────────────────────────────
          1. HEADER & TOP NAVIGATION BAR
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">

        {/* Título & Badge */}
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 text-white flex items-center justify-center font-black shadow-lg shadow-indigo-600/25">
            <Package size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Almacén & Logística
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Sparkles size={11} />
                Sistema Centralizado
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Control de stock central, dotación en camionetas, pistoleo de series ONT/Mesh e internamiento de equipos recogidos.
            </p>
          </div>
        </div>

        {/* Botón Refrescar */}
        <button
          onClick={cargarDatos}
          disabled={loading}
          className="p-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
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
          className={`px-5 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${tabActiva === "stock"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/20 scale-[1.02]"
              : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80"
            }`}
        >
          <Layers size={16} />
          Control de Stock & Almacenes
        </button>

        {/* Tab 2: Compras & Entrada */}
        <button
          onClick={() => handleTabChange("compras")}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${tabActiva === "compras"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20 scale-[1.02]"
              : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80"
            }`}
        >
          <ShoppingCart size={16} />
          Compras & Entrada (Pistoleo Series)
        </button>

        {/* Tab 3: Despacho a Técnicos */}
        <button
          onClick={() => handleTabChange("despacho")}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${tabActiva === "despacho"
              ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/20 scale-[1.02]"
              : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80"
            }`}
        >
          <Truck size={16} />
          Despacho a Técnicos (Dotación)
        </button>

        {/* Tab 4: Equipos Recogidos */}
        <button
          onClick={() => handleTabChange("recogidos")}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${tabActiva === "recogidos"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/20 scale-[1.02]"
              : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80"
            }`}
        >
          <RotateCcw size={16} />
          Equipos Recogidos (Internamiento)
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

    </div>
  );
};
export default InventoryPage;
