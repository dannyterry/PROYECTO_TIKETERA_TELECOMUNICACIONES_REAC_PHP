import React, { useState, useEffect } from "react";
import {
  Settings,
  ListChecks,
  Briefcase,
  Sliders,
  ShieldCheck,
  RotateCw,
  Mail,
} from "lucide-react";
import { MotivosTab } from "./components/MotivosTab";
import { TiposTrabajoTab } from "./components/TiposTrabajoTab";
import { SistemaTab } from "./components/SistemaTab";
import { PermisosTab } from "./components/PermisosTab";
import { CorreosTab } from "./components/CorreosTab";
import { authService } from "../../services/authService";

export const SettingsPage: React.FC = () => {
  // Configuración de permisos por pestaña
  const canMotivos = authService.hasAnyPermission(["motivos.ver", "motivos.crear", "motivos.editar"]);
  const canTipos = authService.hasAnyPermission(["tipo_trabajo.ver", "tipo_trabajo.crear", "tipo_trabajo.editar", "motivos.ver"]);
  const canPermisos = authService.hasAnyPermission(["permisos.ver", "permisos.editar"]);
  const canCorreos = authService.hasAnyPermission(["configuracion.ver", "configuracion.editar"]);
  const canSistema = authService.hasAnyPermission(["configuracion.ver", "configuracion.editar"]);

  const tabsDisponibles = [
    { id: "motivos" as const, label: "Motivos", icon: ListChecks, allowed: canMotivos },
    { id: "tipos" as const, label: "Tipos de Trabajo", icon: Briefcase, allowed: canTipos },
    { id: "permisos" as const, label: "Permisos", icon: ShieldCheck, allowed: canPermisos },
    { id: "correos" as const, label: "Correo / SMTP", icon: Mail, allowed: canCorreos },
    { id: "sistema" as const, label: "Sistema", icon: Sliders, allowed: canSistema },
  ].filter((t) => t.allowed);

  const getInitialTab = (): "motivos" | "tipos" | "sistema" | "permisos" | "correos" => {
    const hash = window.location.hash.toLowerCase();
    if ((hash.includes("tipo") || hash.includes("trabajo")) && canTipos) return "tipos";
    if ((hash.includes("correo") || hash.includes("email") || hash.includes("smtp")) && canCorreos) return "correos";
    if ((hash.includes("sistema") || hash.includes("general")) && canSistema) return "sistema";
    if (hash.includes("permis") && canPermisos) return "permisos";
    if (hash.includes("motivo") && canMotivos) return "motivos";
    return tabsDisponibles[0]?.id || "motivos";
  };

  const [activeTab, setActiveTab] = useState<"motivos" | "tipos" | "sistema" | "permisos" | "correos">(getInitialTab);

  // Escuchar cambios en la URL por hash
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if ((hash.includes("tipo") || hash.includes("trabajo")) && canTipos) setActiveTab("tipos");
      else if ((hash.includes("correo") || hash.includes("email") || hash.includes("smtp")) && canCorreos) setActiveTab("correos");
      else if ((hash.includes("sistema") || hash.includes("general")) && canSistema) setActiveTab("sistema");
      else if (hash.includes("permis") && canPermisos) setActiveTab("permisos");
      else if (hash.includes("motivo") && canMotivos) setActiveTab("motivos");
      else if (tabsDisponibles.length > 0 && !tabsDisponibles.some((t) => t.id === activeTab)) {
        setActiveTab(tabsDisponibles[0].id);
      }
    };

    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [canMotivos, canTipos, canPermisos, canCorreos, canSistema, tabsDisponibles, activeTab]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100/70 overflow-hidden font-sans">
      {/* Header General del Módulo */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center font-black shadow-xs">
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

        {/* Pestañas de Navegación del Módulo Filtradas por Permisos */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto max-w-full gap-1">
          {tabsDisponibles.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  window.location.hash = tab.id === "tipos" ? "tipos-trabajo" : tab.id;
                  setActiveTab(tab.id);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? "bg-sky-600 text-white shadow-sm shadow-sky-600/20"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido Dinámico de la Pestaña Activa */}
      <div className={`flex-1 min-h-0 ${activeTab === "motivos" || activeTab === "tipos" ? "p-4 md:p-6 flex flex-col overflow-hidden" : "p-4 md:p-6 overflow-y-auto"}`}>
        {activeTab === "motivos" && canMotivos && <MotivosTab />}
        {activeTab === "tipos" && canTipos && <TiposTrabajoTab />}
        {activeTab === "permisos" && canPermisos && <PermisosTab />}
        {activeTab === "correos" && canCorreos && <CorreosTab />}
        {activeTab === "sistema" && canSistema && <SistemaTab />}
      </div>
    </div>
  );
};
