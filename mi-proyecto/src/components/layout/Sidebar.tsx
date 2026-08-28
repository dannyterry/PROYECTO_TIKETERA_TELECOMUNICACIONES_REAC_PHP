import { Users, LayoutDashboard, UserCheck, ClipboardList } from "lucide-react";

interface SidebarProps {
  currentView: "ordenes" | "general" | "empleados";
  onViewChange: (view: "ordenes" | "general" | "empleados") => void;
}

export default function Sidebar({ currentView, onViewChange }: SidebarProps) {
  return (
    <aside className="w-56 bg-white border-r border-slate-200 min-h-screen p-3 flex flex-col shrink-0 shadow-xs">
      
      {/* SECCIÓN 1: MÓDULO DE ÓRDENES */}
      <div className="mb-3">
        <button
          onClick={() => onViewChange("ordenes")}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-bold transition-all shadow-xs ${
            currentView === "ordenes"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 ring-2 ring-indigo-300"
              : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100/80 border border-indigo-200"
          }`}
        >
          <ClipboardList size={18} className={currentView === "ordenes" ? "text-white" : "text-indigo-600"} />
          <span>Órdenes de Trabajo</span>
        </button>
      </div>

      {/* Cabecera del Módulo Personal */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-100 mb-2 bg-slate-50/80 rounded-xl">
        <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-xs shrink-0">
          <UserCheck size={16} />
        </div>
        <div className="truncate">
          <h2 className="text-xs font-bold text-slate-900 tracking-tight leading-tight">Módulo Personal</h2>
          <span className="text-[10px] font-semibold text-teal-700 uppercase tracking-wider">Recursos Humanos</span>
        </div>
      </div>

      {/* Navegación de Vistas de Personal */}
      <nav className="space-y-1.5 flex-1">
        {/* Botón 1: Directorio / Vista General */}
        <button
          onClick={() => onViewChange("general")}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            currentView === "general"
              ? "bg-teal-50 text-teal-700 font-bold border border-teal-200 shadow-xs"
              : "hover:bg-slate-100 text-slate-600"
          }`}
        >
          <LayoutDashboard size={18} className={currentView === "general" ? "text-teal-600" : "text-slate-400"} />
          <span>Directorio</span>
        </button>

        {/* Botón 2: Empleados (Ficha) */}
        <button
          onClick={() => onViewChange("empleados")}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            currentView === "empleados"
              ? "bg-teal-50 text-teal-700 font-bold border border-teal-200 shadow-xs"
              : "hover:bg-slate-100 text-slate-600"
          }`}
        >
          <Users size={18} className={currentView === "empleados" ? "text-teal-600" : "text-slate-400"} />
          <span>Ficha de Personal</span>
        </button>
      </nav>

      {/* Pie de Barra */}
      <div className="pt-3 border-t border-slate-100 px-2 text-center">
        <p className="text-[11px] font-medium text-slate-400">Telecom & Operaciones</p>
      </div>
    </aside>
  );
}