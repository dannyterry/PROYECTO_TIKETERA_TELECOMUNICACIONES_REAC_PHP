import React, { useState, useEffect } from "react";
import {
  Settings,
  ListChecks,
  Briefcase,
  Sliders,
  ShieldCheck,
  RotateCw,
} from "lucide-react";
import { MotivosTab } from "./components/MotivosTab";
import { TiposTrabajoTab } from "./components/TiposTrabajoTab";
import { SistemaTab } from "./components/SistemaTab";
import { PermisosTab } from "./components/PermisosTab";
import { CorreosTab } from "./components/CorreosTab";
import { Mail } from "lucide-react";

export const SettingsPage: React.FC = () => {
  const getInitialTab = (): "motivos" | "tipos" | "sistema" | "permisos" | "correos" => {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes("tipo") || hash.includes("trabajo")) return "tipos";
    if (hash.includes("correo") || hash.includes("email") || hash.includes("smtp")) return "correos";
    if (hash.includes("sistema") || hash.includes("general")) return "sistema";
    if (hash.includes("permis")) return "permisos";
    return "motivos";
  };

  const [activeTab, setActiveTab] = useState<"motivos" | "tipos" | "sistema" | "permisos" | "correos">(getInitialTab);

  // Escuchar cambios en la URL por hash
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes("tipo") || hash.includes("trabajo")) setActiveTab("tipos");
      else if (hash.includes("correo") || hash.includes("email") || hash.includes("smtp")) setActiveTab("correos");
      else if (hash.includes("sistema") || hash.includes("general")) setActiveTab("sistema");
      else if (hash.includes("permis")) setActiveTab("permisos");
      else if (hash.includes("motivo") || hash.includes("configuracion")) setActiveTab("motivos");
    };

    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100/70 overflow-hidden font-sans">
      {/* Header General del Módulo */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black shadow-xs">
            <Settings size={22} />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Configuración del Sistema</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Gestión centralizada de motivos, tipos de trabajo, variables de plataforma y matriz de permisos
            </p>
          </div>
        </div>

        {/* Pestañas de Navegación del Módulo */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => {
              window.location.hash = "motivos";
              setActiveTab("motivos");
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "motivos"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ListChecks size={15} />
            <span>Motivos</span>
          </button>

          <button
            type="button"
            onClick={() => {
              window.location.hash = "tipos-trabajo";
              setActiveTab("tipos");
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "tipos"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Briefcase size={15} />
            <span>Tipos de Trabajo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              window.location.hash = "permisos";
              setActiveTab("permisos");
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "permisos"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ShieldCheck size={15} />
            <span>Permisos</span>
          </button>

          <button
            type="button"
            onClick={() => {
              window.location.hash = "correos";
              setActiveTab("correos");
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "correos"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Mail size={15} />
            <span>Correo / SMTP</span>
          </button>

          <button
            type="button"
            onClick={() => {
              window.location.hash = "sistema";
              setActiveTab("sistema");
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "sistema"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sliders size={15} />
            <span>Sistema</span>
          </button>
        </div>
      </div>

      {/* Contenido Dinámico de la Pestaña Activa */}
      <div className="flex-1 p-4 md:p-6 overflow-y-auto min-h-0">
        {activeTab === "motivos" && <MotivosTab />}
        {activeTab === "tipos" && <TiposTrabajoTab />}
        {activeTab === "permisos" && <PermisosTab />}
        {activeTab === "correos" && <CorreosTab />}
        {activeTab === "sistema" && <SistemaTab />}
      </div>
    </div>
  );
};
