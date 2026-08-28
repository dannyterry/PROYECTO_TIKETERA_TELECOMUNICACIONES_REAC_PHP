import React, { useState, useEffect } from "react";
import {
  Car,
  ClipboardCheck,
  Gauge,
  Fuel,
  RotateCw,
  Plus,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import {
  Vehiculo,
  Tecnico,
  Inspeccion,
  CargaCombustible,
  ResumenCombustible,
  DashboardKmResumen,
} from "./types/mobilityTypes";
import {
  getVehiculos,
  getTecnicos,
  getInspecciones,
  getCombustibles,
  getDashboardKm,
} from "./services/mobilityService";
import { InspectionAuditTab } from "./components/InspectionAuditTab";
import { KmDashboardTab } from "./components/KmDashboardTab";
import { FuelManagementTab } from "./components/FuelManagementTab";
import { FleetManagementTab } from "./components/FleetManagementTab";
import { TechnicianChecklistModal } from "./components/TechnicianChecklistModal";

export const MobilityPage: React.FC = () => {
  const getInitialTab = (): "inspecciones" | "dashboard" | "combustible" | "flota" => {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes("combustible")) return "combustible";
    if (hash.includes("vehiculo") || hash.includes("flota")) return "flota";
    if (hash.includes("dashboard") || hash.includes("kilometraje") || hash.includes("rutas")) return "dashboard";
    return "inspecciones";
  };

  const [activeTab, setActiveTab] = useState<"inspecciones" | "dashboard" | "combustible" | "flota">(getInitialTab);
  const [loading, setLoading] = useState(true);

  // Escuchar cambios de hash dinámicos desde PHP o navegación
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes("combustible")) setActiveTab("combustible");
      else if (hash.includes("vehiculo") || hash.includes("flota")) setActiveTab("flota");
      else if (hash.includes("dashboard") || hash.includes("kilometraje") || hash.includes("rutas")) setActiveTab("dashboard");
      else if (hash.includes("inspeccion") || hash.includes("movilidad")) setActiveTab("inspecciones");
      if (hash.includes("checklist")) setModalChecklistAbierto(true);
    };

    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  // Estados de datos
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [inspecciones, setInspecciones] = useState<Inspeccion[]>([]);
  const [cargasCombustible, setCargasCombustible] = useState<CargaCombustible[]>([]);
  const [resumenCombustible, setResumenCombustible] = useState<ResumenCombustible>({
    totalGasto: 0,
    totalGalones: 0,
    precioPromedioGalon: 0,
  });
  const [dashboardKmResumen, setDashboardKmResumen] = useState<DashboardKmResumen>({
    totalKmDeclarados: 0,
    totalKmEstimados: 0,
    diferenciaTotal: 0,
    totalInspecciones: 0,
    aprobadas: 0,
    pendientes: 0,
    observadas: 0,
    alertasDesvioCount: 0,
  });
  const [alertasDesvio, setAlertasDesvio] = useState<Inspeccion[]>([]);

  // Modal Checklist Técnico
  const [modalChecklistAbierto, setModalChecklistAbierto] = useState(false);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [vData, tData, iData, cData, kmData] = await Promise.all([
        getVehiculos().catch(() => []),
        getTecnicos().catch(() => []),
        getInspecciones().catch(() => []),
        getCombustibles().catch(() => ({ registros: [], resumen: { totalGasto: 0, totalGalones: 0, precioPromedioGalon: 0 } })),
        getDashboardKm().catch(() => ({
          inspecciones: [],
          resumen: {
            totalKmDeclarados: 0,
            totalKmEstimados: 0,
            diferenciaTotal: 0,
            totalInspecciones: 0,
            aprobadas: 0,
            pendientes: 0,
            observadas: 0,
            alertasDesvioCount: 0,
          },
          alertasDesvio: [],
        })),
      ]);

      setVehiculos(vData);
      setTecnicos(tData);
      setInspecciones(iData);
      setCargasCombustible(cData.registros || []);
      setResumenCombustible(cData.resumen);
      setDashboardKmResumen(kmData.resumen);
      setAlertasDesvio(kmData.alertasDesvio || []);
    } catch (err) {
      console.error("Error al cargar datos de movilidad:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const pendientesCount = inspecciones.filter((i) => i.estado_auditoria === "Pendiente").length;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12 animate-fade-in">
      
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER PRINCIPAL DEL MÓDULO DE MOVILIDAD
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-cyan-500/25 shrink-0">
            <Car size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Control de Movilidad y Flota
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-cyan-50 text-cyan-700 border border-cyan-200/60 font-mono">
                {vehiculos.length} Vehículos
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-500 font-medium mt-0.5">
              Checklist diario con fotos (tablero, aceite, agua), auditoría de kilometraje vs órdenes y control de combustible.
            </p>
          </div>
        </div>

        {/* Botones de Acción Superior */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={cargarDatos}
            disabled={loading}
            title="Recargar datos"
            className="p-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all cursor-pointer"
          >
            <RefreshCw size={17} className={loading ? "animate-spin text-cyan-600" : ""} />
          </button>

          <button
            onClick={() => setModalChecklistAbierto(true)}
            className="flex-1 md:flex-none px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white font-bold text-xs rounded-2xl shadow-md shadow-cyan-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus size={16} />
            <span>Checklist Diario (Técnico)</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. NAVEGACIÓN DE PESTAÑAS
      ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200/80">
        
        {/* Pestaña 1: Auditoría de Inspecciones */}
        <button
          onClick={() => setActiveTab("inspecciones")}
          className={`px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer shrink-0 ${
            activeTab === "inspecciones"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/15"
              : "text-slate-600 hover:bg-white hover:text-slate-900"
          }`}
        >
          <ClipboardCheck size={16} className={activeTab === "inspecciones" ? "text-cyan-400" : "text-slate-400"} />
          <span>Auditoría de Inspecciones</span>
          {pendientesCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
              {pendientesCount} por revisar
            </span>
          )}
        </button>

        {/* Pestaña 2: Dashboard de Kilometraje & Cruce de Rutas */}
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer shrink-0 ${
            activeTab === "dashboard"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/15"
              : "text-slate-600 hover:bg-white hover:text-slate-900"
          }`}
        >
          <Gauge size={16} className={activeTab === "dashboard" ? "text-teal-400" : "text-slate-400"} />
          <span>Dashboard & Cruce con Órdenes</span>
          {dashboardKmResumen.alertasDesvioCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
              {dashboardKmResumen.alertasDesvioCount} alertas
            </span>
          )}
        </button>

        {/* Pestaña 3: Control de Combustible */}
        <button
          onClick={() => setActiveTab("combustible")}
          className={`px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer shrink-0 ${
            activeTab === "combustible"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/15"
              : "text-slate-600 hover:bg-white hover:text-slate-900"
          }`}
        >
          <Fuel size={16} className={activeTab === "combustible" ? "text-amber-400" : "text-slate-400"} />
          <span>Control de Combustible</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 font-mono">
            S/ {resumenCombustible.totalGasto.toLocaleString()}
          </span>
        </button>

        {/* Pestaña 4: Flota de Vehículos */}
        <button
          onClick={() => setActiveTab("flota")}
          className={`px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer shrink-0 ${
            activeTab === "flota"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/15"
              : "text-slate-600 hover:bg-white hover:text-slate-900"
          }`}
        >
          <Car size={16} className={activeTab === "flota" ? "text-cyan-400" : "text-slate-400"} />
          <span>Gestión de Flota ({vehiculos.length})</span>
        </button>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. CONTENIDO DE LA PESTAÑA ACTIVA
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "inspecciones" && (
        <InspectionAuditTab
          inspecciones={inspecciones}
          vehiculos={vehiculos}
          tecnicos={tecnicos}
          loading={loading}
          onRefresh={cargarDatos}
        />
      )}

      {activeTab === "dashboard" && (
        <KmDashboardTab
          inspecciones={inspecciones}
          resumen={dashboardKmResumen}
          alertasDesvio={alertasDesvio}
          loading={loading}
        />
      )}

      {activeTab === "combustible" && (
        <FuelManagementTab
          cargas={cargasCombustible}
          resumen={resumenCombustible}
          vehiculos={vehiculos}
          tecnicos={tecnicos}
          loading={loading}
          onRefresh={cargarDatos}
        />
      )}

      {activeTab === "flota" && (
        <FleetManagementTab
          vehiculos={vehiculos}
          tecnicos={tecnicos}
          loading={loading}
          onRefresh={cargarDatos}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. MODAL CHECKLIST TÉCNICO (MÓVIL / CAMPO)
      ───────────────────────────────────────────────────────────── */}
      {modalChecklistAbierto && (
        <TechnicianChecklistModal
          vehiculos={vehiculos}
          tecnicos={tecnicos}
          onClose={() => setModalChecklistAbierto(false)}
          onSuccess={cargarDatos}
        />
      )}

    </div>
  );
};

export default MobilityPage;
