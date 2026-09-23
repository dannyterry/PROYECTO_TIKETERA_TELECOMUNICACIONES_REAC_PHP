import React, { useState } from "react";
import {
  ClipboardCheck,
  Star,
  History,
  ShieldCheck,
  Building2,
  Sparkles,
  Menu,
  ChevronRight,
} from "lucide-react";
import { FieldSupervisionTab } from "./components/FieldSupervisionTab";
import { CustomerQualitySurveyTab } from "./components/CustomerQualitySurveyTab";
import { SupervisionHistoryTab } from "./components/SupervisionHistoryTab";

export const SupervisionPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"CAMPO" | "CLIENTE" | "HISTORIAL">("CAMPO");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSavedRecord = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleToggleSidebar = () => {
    window.dispatchEvent(new CustomEvent("toggleSidebar"));
  };

  return (
    <div className="min-h-screen bg-slate-100/70 p-3 sm:p-5 md:p-6 lg:p-8 space-y-4 md:space-y-6">
      {/* Top Header Card - Fully Mobile Responsive & Sidebar Trigger */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Interactive Shield Button that opens the Navigation Sidebar */}
          <button
            type="button"
            onClick={handleToggleSidebar}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-teal-500 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer shrink-0 group relative"
            title="📋 Clic para abrir/cerrar el menú lateral de navegación"
          >
            <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7 group-hover:scale-110 transition-transform" />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white border border-slate-200 text-slate-800 flex items-center justify-center shadow-xs">
              <Menu className="w-2.5 h-2.5 text-blue-700" />
            </span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-[11px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Corporación Céspedes
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400">· WIN Partner</span>
            </div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-0.5 truncate">
              Supervisión & Control de Calidad
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 hidden sm:block">
              Fichas técnicas en campo, encuestas post-servicio y ranking operativo.
            </p>
          </div>
        </div>

        {/* Tab Navigation Pill - Horizontally scrollable on mobile */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-stretch sm:self-start md:self-auto overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab("CAMPO")}
            className={`flex-1 sm:flex-none px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === "CAMPO"
                ? "bg-white text-blue-700 shadow-md scale-102 font-black"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Supervisión Campo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("CLIENTE")}
            className={`flex-1 sm:flex-none px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === "CLIENTE"
                ? "bg-white text-teal-700 shadow-md scale-102 font-black"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Calidad Cliente (4D)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("HISTORIAL")}
            className={`flex-1 sm:flex-none px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === "HISTORIAL"
                ? "bg-white text-indigo-700 shadow-md scale-102 font-black"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Historial & Ranking</span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === "CAMPO" && (
        <FieldSupervisionTab onSaved={handleSavedRecord} />
      )}

      {activeTab === "CLIENTE" && (
        <CustomerQualitySurveyTab onSaved={handleSavedRecord} />
      )}

      {activeTab === "HISTORIAL" && (
        <SupervisionHistoryTab key={refreshKey} />
      )}
    </div>
  );
};
