import React, { useState, useEffect, useRef } from "react";
import { Users, Search, ChevronDown } from "lucide-react";
import { API_URL } from "../../config/api";
import { authService, AuthUser } from "../../services/authService";

export interface OnlineUser {
  id_usuario: number;
  nombre_completo: string;
  rol_nombre: string;
  area: string;
  distrito?: string | null;
  distrito_conexion?: string | null;
  esta_online: number;
  ultimo_acceso: string | null;
}

interface OnlineChatDropdownProps {
  currentUser?: AuthUser | null;
  className?: string;
}

export const OnlineChatDropdown: React.FC<OnlineChatDropdownProps> = ({
  currentUser: propUser,
  className = "",
}) => {
  const user = propUser || authService.getCurrentUser();
  const userId = user?.id_usuario;
  const userRol = user?.id_rol ? String(user.id_rol) : "";
  const rolNombre = user?.rol || "";

  // 🛡️ Identificación de Técnico (Ocultar si es técnico puro de campo)
  const isTecnico =
    userRol === "2" ||
    Boolean(
      rolNombre &&
        (rolNombre.toUpperCase().includes("TECNICO") ||
          rolNombre.toUpperCase().includes("TÉCNICO"))
    );

  const [usuariosOnline, setUsuariosOnline] = useState<OnlineUser[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Polling ligero de usuarios online (cada 40 segundos)
  useEffect(() => {
    if (isTecnico) return;

    const fetchOnline = () => {
      if (document.hidden) return;
      fetch(`${API_URL}/api/auditoria/usuarios-online`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setUsuariosOnline(data);
        })
        .catch(() => {});
    };

    fetchOnline();

    const interval = setInterval(fetchOnline, 40000);
    return () => clearInterval(interval);
  }, [isTecnico]);

  if (isTecnico) return null;

  const totalOnline = usuariosOnline.filter((u) => u.esta_online === 1).length;

  return (
    <div className={`relative shrink-0 ${className}`} ref={dropdownRef}>
      {/* Botón Indicador de Personal Activo en Línea (Solo punto verde + número + texto) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs h-8.5 ${
          isOpen
            ? "bg-emerald-50 text-emerald-900 border-emerald-300 ring-1 ring-emerald-200"
            : "bg-white hover:bg-emerald-50/60 text-slate-700 hover:text-emerald-900 border-slate-200 hover:border-emerald-300"
        }`}
        title="Ver personal activo en línea"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {totalOnline > 0 && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="font-mono font-black text-slate-900">{totalOnline}</span>
        <span className="text-slate-600 font-bold text-[11px] hidden sm:inline">En Línea</span>
        <ChevronDown
          size={12}
          className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Popover / Dropdown flotante de usuarios conectados */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-76 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header del dropdown */}
          <div className="p-3 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Users size={14} className="text-emerald-600" />
              Personal en Línea
            </span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {totalOnline} conectados
            </span>
          </div>

          {/* Barra de búsqueda */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar compañero..."
                className="w-full bg-slate-100 text-slate-800 text-xs pl-7 pr-2 py-1.5 rounded-lg border-none focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Lista de compañeros conectados */}
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
            {usuariosOnline.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 font-medium">
                No hay usuarios conectados actualmente.
              </div>
            ) : (
              usuariosOnline
                .filter(
                  (u) =>
                    !searchTerm ||
                    u.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (u.rol_nombre && u.rol_nombre.toLowerCase().includes(searchTerm.toLowerCase()))
                )
                .map((u) => {
                  const isOnline = u.esta_online === 1;
                  const isMe = String(u.id_usuario) === String(userId);

                  return (
                    <div
                      key={u.id_usuario}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                        isMe
                          ? "bg-emerald-50/40 border border-emerald-100"
                          : "hover:bg-slate-50 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="relative flex h-2 w-2 shrink-0">
                          {isOnline && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          )}
                          <span
                            className={`relative inline-flex rounded-full h-2 w-2 ${
                              isOnline ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                          ></span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {u.nombre_completo} {isMe && <span className="text-emerald-700 font-normal">(Tú)</span>}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">
                            {u.rol_nombre || "Personal"} • {u.area || "Operaciones"}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className={`text-[10px] font-bold ${isOnline ? "text-emerald-600" : "text-slate-400"}`}>
                          {isOnline ? "Activo" : "Desconectado"}
                        </span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
