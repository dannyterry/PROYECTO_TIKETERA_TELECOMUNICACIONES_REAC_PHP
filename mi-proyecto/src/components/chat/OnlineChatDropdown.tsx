import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Users, Search, ChevronDown } from "lucide-react";
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

  // 🛡️ Identificación de Técnico (Ocultar chat si es técnico puro de campo)
  const isTecnico =
    userRol === "2" ||
    Boolean(
      rolNombre &&
        (rolNombre.toUpperCase().includes("TECNICO") ||
          rolNombre.toUpperCase().includes("TÉCNICO"))
    );

  const canUseGroupChat =
    !isTecnico &&
    (userRol === "1" ||
      userRol === "3" ||
      userRol === "5" ||
      (rolNombre &&
        (rolNombre.toUpperCase().includes("ADMIN") ||
          rolNombre.toUpperCase().includes("RECURSO") ||
          rolNombre.toUpperCase().includes("RRHH") ||
          rolNombre.toUpperCase().includes("ALMACEN") ||
          rolNombre.toUpperCase().includes("LOGISTICA"))));

  const [usuariosOnline, setUsuariosOnline] = useState<OnlineUser[]>([]);
  const [totalNoLeidos, setTotalNoLeidos] = useState(0);
  const [noLeidosPorUsuario, setNoLeidosPorUsuario] = useState<Record<number, number>>({});
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

  // Polling de usuarios online y mensajes no leídos
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

    const fetchNoLeidos = () => {
      if (document.hidden || !userId) return;
      fetch(`${API_URL}/api/chat/noleidos?id_usuario=${userId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data && typeof data.total === "number") {
            setTotalNoLeidos(data.total);
            setNoLeidosPorUsuario(data.por_usuario || {});
          }
        })
        .catch(() => {});
    };

    fetchOnline();
    fetchNoLeidos();

    const iOnline = setInterval(fetchOnline, 12000);
    const iNoLeidos = setInterval(fetchNoLeidos, 10000);

    return () => {
      clearInterval(iOnline);
      clearInterval(iNoLeidos);
    };
  }, [userId, isTecnico]);

  if (isTecnico) return null;

  const totalOnline = usuariosOnline.filter((u) => u.esta_online === 1).length;

  const handleOpenGroupChat = () => {
    window.dispatchEvent(new CustomEvent("openTeamChat", { detail: { tab: "general" } }));
    setIsOpen(false);
  };

  const handleOpenUserChat = (target: OnlineUser) => {
    window.dispatchEvent(new CustomEvent("openTeamChat", { detail: { tab: target.id_usuario, user: target } }));
    setIsOpen(false);
  };

  return (
    <div className={`relative shrink-0 ${className}`} ref={dropdownRef}>
      {/* Botón Indicador de En Línea y Chat */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs h-9 ${
          totalNoLeidos > 0
            ? "bg-emerald-500 text-white border-emerald-400 ring-2 ring-emerald-300 shadow-md animate-bounce"
            : isOpen
            ? "bg-sky-50 text-sky-900 border-sky-300 ring-1 ring-sky-200"
            : "bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-900 border-slate-200 hover:border-sky-300"
        }`}
        title="Personal en Línea y Chat de Equipo"
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          {totalOnline > 0 && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        <span className="font-mono font-black text-slate-900">{totalOnline}</span>
        <MessageSquare size={14} className="text-sky-600 shrink-0" />
        {totalNoLeidos > 0 && (
          <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full shadow-xs">
            {totalNoLeidos}
          </span>
        )}
        <ChevronDown
          size={12}
          className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Popover / Dropdown flotante */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-76 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header del dropdown */}
          <div className="p-3 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Users size={14} className="text-sky-600" />
              Equipo y Chat
            </span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              {totalOnline} en línea
            </span>
          </div>

          {/* Botón Acceso Rápido Canal Grupal */}
          {canUseGroupChat && (
            <div className="p-2 border-b border-slate-100 bg-sky-50/40">
              <button
                type="button"
                onClick={handleOpenGroupChat}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-98 text-white font-black text-xs transition-all shadow-xs cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <MessageSquare size={14} />
                  <span>Canal Grupal 24/7</span>
                </div>
                <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-mono">Abrir</span>
              </button>
            </div>
          )}

          {/* Barra de búsqueda */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar compañero..."
                className="w-full bg-slate-100 text-slate-800 text-xs pl-7 pr-2 py-1.5 rounded-lg border-none focus:ring-1 focus:ring-sky-500 outline-none"
              />
            </div>
          </div>

          {/* Lista de compañeros */}
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
            {usuariosOnline.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Cargando personal...
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
                  const cantNoLeidos = noLeidosPorUsuario[u.id_usuario] || 0;
                  const hasUnread = cantNoLeidos > 0 && !isMe;

                  return (
                    <button
                      key={u.id_usuario}
                      type="button"
                      disabled={isMe}
                      onClick={() => handleOpenUserChat(u)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                        isMe
                          ? "opacity-60 bg-slate-50 cursor-default"
                          : hasUnread
                          ? "bg-emerald-50 hover:bg-emerald-100 border border-emerald-300"
                          : "hover:bg-slate-100 cursor-pointer"
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
                            {u.nombre_completo} {isMe && "(Tú)"}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {u.rol_nombre || "Personal"} • {u.area || "Operaciones"}
                          </p>
                        </div>
                      </div>
                      {hasUnread ? (
                        <span className="bg-emerald-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse shrink-0">
                          {cantNoLeidos}
                        </span>
                      ) : (
                        !isMe && <MessageSquare size={13} className="text-slate-400 hover:text-sky-600 shrink-0" />
                      )}
                    </button>
                  );
                })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
