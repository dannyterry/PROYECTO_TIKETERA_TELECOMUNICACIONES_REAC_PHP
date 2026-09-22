import React, { useState, useEffect, useRef } from "react";
import { OrderFilters } from "../types/Order";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import {
  RotateCw,
  Search,
  Calendar,
  Filter,
  X,
  Layers,
  Bell,
  Radio,
  MessageSquare,
  ChevronDown,
  Users,
  LogOut,
  User,
} from "lucide-react";
import { authService } from "../../../services/authService";
import { API_URL } from "../../../config/api";

interface OnlineUser {
  id_usuario: number;
  nombre_completo: string;
  rol_nombre: string;
  area: string;
  distrito?: string | null;
  distrito_conexion?: string | null;
  esta_online: number;
  ultimo_acceso: string | null;
}

interface OrdersToolbarProps {
  filters: OrderFilters;
  onFilterChange: (filters: OrderFilters) => void;
  onSync: () => void;
  totalCount: number;
  cuadrillas?: (string | { key: string; label: string })[];
  tecnicos?: string[];
  stats?: {
    verdes: number;
    azules: number;
    amarillos: number;
    agendadas: number;
    ordenamientos: number;
  };
  alertsCount?: number;
  onOpenAlerts?: () => void;
}

export const OrdersToolbar: React.FC<OrdersToolbarProps> = ({
  filters,
  onFilterChange,
  onSync,
  totalCount,
  cuadrillas = [],
  tecnicos = [],
  stats = { verdes: 0, azules: 0, amarillos: 0, agendadas: 0, ordenamientos: 0 },
  alertsCount = 0,
  onOpenAlerts,
}) => {
  // Datos del Usuario Activo
  const currentUser = authService.getCurrentUser();
  const userId = currentUser ? String(currentUser.id_usuario) : "";
  const userName = currentUser?.nombreCompleto || `${currentUser?.nombres || ""} ${currentUser?.apellidos || ""}`.trim() || "Usuario";
  const userSoloNombres = (currentUser?.nombres || currentUser?.nombreCompleto || "").trim().split(/\s+/).slice(0, 2).join(" ") || userName;
  const userRol = currentUser ? String(currentUser.id_rol) : "";
  const rolNombre = currentUser?.rol || "Gestión";

  // 🛡️ Identificación de Técnico (Ocultar chat completamente a técnicos)
  const isTecnico =
    userRol === "2" ||
    Boolean(rolNombre && (rolNombre.toUpperCase().includes("TECNICO") || rolNombre.toUpperCase().includes("TÉCNICO")));

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

  // Estados para Chat y Usuarios Online
  const [usuariosOnline, setUsuariosOnline] = useState<OnlineUser[]>([]);
  const [totalNoLeidos, setTotalNoLeidos] = useState(0);
  const [noLeidosPorUsuario, setNoLeidosPorUsuario] = useState<Record<number, number>>({});
  const [onlineDropdownOpen, setOnlineDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [avatarImgError, setAvatarImgError] = useState(false);

  const onlineDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  // Cerrar dropdowns al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (onlineDropdownRef.current && !onlineDropdownRef.current.contains(e.target as Node)) {
        setOnlineDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Polling de usuarios online y mensajes no leídos (Solo para personal que no sea técnico)
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

    const iOnline = setInterval(fetchOnline, 15000);
    const iNoLeidos = setInterval(fetchNoLeidos, 25000);

    return () => {
      clearInterval(iOnline);
      clearInterval(iNoLeidos);
    };
  }, [userId]);

  const totalOnline = usuariosOnline.filter((u) => u.esta_online === 1).length;

  const handleOpenGroupChat = () => {
    window.dispatchEvent(new CustomEvent("openTeamChat", { detail: { tab: "general" } }));
    setOnlineDropdownOpen(false);
  };

  const handleOpenUserChat = (target: OnlineUser) => {
    window.dispatchEvent(new CustomEvent("openTeamChat", { detail: { tab: target.id_usuario, user: target } }));
    setOnlineDropdownOpen(false);
  };

  const handleLogout = () => {
    authService.logout();
    window.location.reload();
  };
  // Temporizador regresivo de sincronización en vivo (ej. 60s)
  const [countdown, setCountdown] = useState(60);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden) return;
      setCountdown((prev) => {
        if (prev <= 1) {
          setTimeout(() => {
            onSync();
          }, 0);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onSync]);

  const handleManualSync = () => {
    setIsSyncing(true);
    setCountdown(60);
    onSync();
    setTimeout(() => setIsSyncing(false), 800);
  };

  const getTodayStr = () => {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Lima",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  };

  // Estado local para el texto del buscador (permite escribir con 0 lag y sin congelamientos)
  const [localSearch, setLocalSearch] = useState(filters.search || "");

  // Sincronizar si filters.search cambia externamente (ej: al presionar Limpiar Filtros)
  useEffect(() => {
    setLocalSearch(filters.search || "");
  }, [filters.search]);

  // Ejecutar búsqueda explícita
  const handleExecuteSearch = (valToSearch?: string) => {
    const term = valToSearch !== undefined ? valToSearch : localSearch;
    onFilterChange({ ...filters, search: term });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleExecuteSearch();
    }
  };

  const handleClearSearch = () => {
    setLocalSearch("");
    onFilterChange({ ...filters, search: "" });
  };

  // 🎯 HELPERS PARA FILTRADO MULTI-SELECCIÓN ACUMULATIVO DE ESTADOS
  const getActiveStatuses = (): string[] => {
    if (filters.statuses && filters.statuses.length > 0) {
      return filters.statuses.filter((s) => s !== "Todos");
    }
    if (filters.status && filters.status !== "Todos") {
      return [filters.status];
    }
    return [];
  };

  const isStatusActive = (statusKey: string): boolean => {
    const active = getActiveStatuses();
    if (statusKey === "Todos") {
      return active.length === 0;
    }
    return active.includes(statusKey);
  };

  // Alternar o sumar un estado a la selección actual
  const handleToggleStatus = (statusKey: string) => {
    if (statusKey === "Todos") {
      onFilterChange({
        ...filters,
        statuses: [],
        status: "Todos",
      });
      return;
    }
    const current = getActiveStatuses();
    let next: string[];
    if (current.includes(statusKey)) {
      next = current.filter((s) => s !== statusKey);
    } else {
      next = [...current, statusKey];
    }
    onFilterChange({
      ...filters,
      statuses: next,
      status: next.length === 1 ? next[0] : (next.length === 0 ? "Todos" : next.join(",")),
    });
  };

  const STATUS_OPTIONS = [
    { key: "Verdes", label: "Verde (Iniciada / Proceso)", colorDot: "bg-[#70ad47]", borderDot: "border-[#568735]", count: stats.verdes },
    { key: "Finalizadas", label: "Celeste (Finalizada)", colorDot: "bg-[#5b9bd5]", borderDot: "border-[#3c78b0]", count: stats.azules },
    { key: "Amarillos", label: "Amarillo (Regestión / Cancelada)", colorDot: "bg-amber-500", borderDot: "border-amber-600", count: stats.amarillos },
    { key: "Agendadas", label: "Gris (Agendada / Asignada / En camino)", colorDot: "bg-slate-200", borderDot: "border-slate-400", count: stats.agendadas },
    { key: "Ordenamientos", label: "Ordenamientos (Cuadrillas O)", colorDot: "bg-violet-600", borderDot: "border-violet-700", count: stats.ordenamientos },
  ];

  const handleClearFilters = () => {
    setLocalSearch("");
    onFilterChange({
      fechaDesde: "",
      fechaHasta: "",
      status: "Todos",
      statuses: [],
      tecnico: "Todos",
      cuadrilla: "Todos",
      inconcert: "Todos",
      search: "",
    });
  };

  const handleSetToday = () => {
    const today = getTodayStr();
    onFilterChange({
      ...filters,
      fechaDesde: today,
      fechaHasta: today,
    });
  };

  const handleToggleMenu = () => {
    window.dispatchEvent(new CustomEvent("toggleSidebar"));
  };

  // Estado para desplegar filtros en pantalla pequeña/celular
  const [filtrosAbiertosMobile, setFiltrosAbiertosMobile] = useState(false);

  const activeFiltersCount = [
    Boolean(filters.fechaDesde),
    Boolean(filters.fechaHasta),
    getActiveStatuses().length > 0,
    Boolean(filters.tecnico && filters.tecnico !== "Todos"),
    Boolean(filters.cuadrilla && filters.cuadrilla !== "Todos"),
    Boolean(filters.inconcert && filters.inconcert !== "Todos"),
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-1 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200/90 shadow-2xs">

      {/* ─────────────────────────────────────────────────────────────
          FILA 1: TÍTULO, BOTÓN MENÚ Y ACCIONES (RESPONSIVE)
      ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-slate-100">

        {/* Lado Izquierdo: Icono Menú + Título */}
        <div className="flex items-center gap-1.5 min-w-0 shrink-0">
          <button
            type="button"
            onClick={handleToggleMenu}
            className="p-1 rounded-lg bg-sky-50 hover:bg-sky-100 active:scale-95 border border-sky-200 hover:border-sky-300 text-sky-700 hover:text-sky-900 transition-all cursor-pointer shadow-2xs group flex items-center justify-center shrink-0"
            title="📋 Clic para abrir el menú lateral"
          >
            <Layers size={15} className="group-hover:scale-110 transition-transform" />
          </button>
          <div className="flex items-baseline gap-1 min-w-0">
            <h1
              onClick={handleToggleMenu}
              className="text-xs sm:text-sm font-black text-slate-900 tracking-tight whitespace-nowrap cursor-pointer hover:text-sky-700 transition-colors truncate"
              title="📋 Clic para abrir el menú lateral"
            >
              Órdenes de Trabajo
            </h1>
            <span className="hidden xl:inline text-[9.5px] text-slate-400 font-semibold shrink-0">
              Monitoreo Fénix
            </span>
          </div>
        </div>

        {/* Lado Derecho: Alertas, Sincronizar, Chat y Perfil Usuario */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* 1. Alertas */}
          {onOpenAlerts && (
            <button
              type="button"
              onClick={onOpenAlerts}
              className={`relative flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg text-xs font-black border transition-all cursor-pointer shadow-2xs h-7.5 ${alertsCount > 0
                ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-amber-500/25 ring-2 ring-amber-300"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                }`}
              title="Centro de Alertas Operativas"
            >
              <Bell size={12} className={alertsCount > 0 ? "animate-bounce" : ""} />
              <span className="hidden md:inline">Alertas</span>
              {alertsCount > 0 && (
                <span className="px-1 py-0.2 rounded-full text-[9px] font-black bg-red-600 text-white animate-pulse">
                  {alertsCount}
                </span>
              )}
            </button>
          )}

          {/* 2. Sincronización */}
          <Button
            onClick={handleManualSync}
            className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-1.5 sm:px-2 py-1 rounded-lg shadow-2xs flex items-center gap-1 text-xs transition-all cursor-pointer h-7.5"
            title="Sincronizar órdenes con Fénix"
          >
            <RotateCw size={12} className={isSyncing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Sincronizar</span>
            <span className="font-mono text-[11px]">({countdown}s)</span>
          </Button>

          {/* 3. Desplegable de En Línea y Chat (Oculto estrictamente para Técnicos) */}
          {!isTecnico && (
            <div className="relative shrink-0" ref={onlineDropdownRef}>
              <button
                type="button"
                onClick={() => setOnlineDropdownOpen(!onlineDropdownOpen)}
                className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-2xs h-7.5 ${
                  totalNoLeidos > 0
                    ? "bg-emerald-500 text-white border-emerald-400 ring-2 ring-emerald-300 shadow-md animate-bounce"
                    : onlineDropdownOpen
                    ? "bg-sky-50 text-sky-900 border-sky-300 ring-1 ring-sky-200"
                    : "bg-slate-50 hover:bg-sky-50 text-slate-700 hover:text-sky-900 border-slate-200 hover:border-sky-300"
                }`}
                title="Personal en Línea y Chat de Equipo"
              >
                <span className="relative flex h-2 w-2">
                  {totalOnline > 0 && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-mono font-black text-slate-900">{totalOnline}</span>
                <span className="text-[10px] text-slate-600 font-semibold hidden md:inline">En Línea</span>
                <MessageSquare size={12} className="text-sky-600 shrink-0" />
                {totalNoLeidos > 0 && (
                  <span className="bg-red-600 text-white text-[9px] font-black px-1 py-0.2 rounded-full shadow-xs">
                    {totalNoLeidos}
                  </span>
                )}
                <ChevronDown size={11} className={`text-slate-400 transition-transform ${onlineDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {/* DROPDOWN FLOTANTE DE CHAT & EQUIPO */}
              {onlineDropdownOpen && (
                <div className="absolute right-0 mt-1 w-72 max-w-[90vw] bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="p-2.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Users size={13} className="text-sky-600" />
                      Equipo y Chat
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
                      {totalOnline} en línea
                    </span>
                  </div>

                  {canUseGroupChat && (
                    <div className="p-2 border-b border-slate-100 bg-sky-50/40">
                      <button
                        type="button"
                        onClick={handleOpenGroupChat}
                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs transition-all shadow-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5">
                          <MessageSquare size={13} />
                          <span>Canal Grupal 24/7</span>
                        </div>
                        <span className="bg-white/20 px-1.5 py-0.2 rounded text-[9px] font-mono">Abrir</span>
                      </button>
                    </div>
                  )}

                  <div className="p-2 border-b border-slate-100">
                    <div className="relative">
                      <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        placeholder="Buscar compañero..."
                        className="w-full bg-slate-100 text-slate-800 text-xs pl-7 pr-2 py-1 rounded-lg border-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                    {usuariosOnline
                      .filter(
                        (u) =>
                          !userSearchTerm ||
                          u.nombre_completo.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                          (u.rol_nombre && u.rol_nombre.toLowerCase().includes(userSearchTerm.toLowerCase()))
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
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. Menú de Usuario y Cerrar Sesión */}
          <div className="relative shrink-0 pl-1 border-l border-slate-200" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-1.5 py-0.5 px-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200 text-left h-7.5"
              title="Cuenta de Usuario"
            >
              <div className="text-right hidden xl:block leading-none">
                <span className="text-[11px] font-black text-slate-900 block truncate max-w-[130px]">
                  {userSoloNombres}
                </span>
                <span className="text-[9px] font-bold text-sky-600 uppercase tracking-wider block">
                  {rolNombre}
                </span>
              </div>

              {currentUser?.foto_personal && !avatarImgError ? (
                <img
                  src={`${API_URL}/uploads/${currentUser.foto_personal}`}
                  alt={userName}
                  className="w-6 h-6 rounded-full object-cover border border-sky-500 shrink-0 shadow-2xs"
                  onError={() => setAvatarImgError(true)}
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center font-black text-[10px] shrink-0 shadow-2xs uppercase">
                  {(userName || "US").slice(0, 2)}
                </div>
              )}

              <ChevronDown size={11} className={`text-slate-400 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown de Usuario */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200/90 z-50 p-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-2.5 py-2 border-b border-slate-100 mb-1">
                  <p className="text-xs font-black text-slate-900 truncate">{userName}</p>
                  <p className="text-[10px] text-sky-600 font-bold uppercase tracking-wider">{rolNombre}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <LogOut size={13} />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          FILA 2: BADGES DE ESTADOS (MÓVIL: CUADRÍCULA 2 FILAS | PC: TIRA ÚNICA)
      ───────────────────────────────────────────────────────────── */}
      {/* 📱 En Celular / Tablet: Cuadrícula compacta 3x2 (Ordenamientos 100% visible sin cortes) */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 py-0.5 lg:hidden">
        <button
          type="button"
          onClick={() => handleToggleStatus("Todos")}
          className={`flex items-center justify-between px-1.5 py-1 rounded-md text-[10.5px] font-bold border cursor-pointer transition-all ${
            isStatusActive("Todos")
              ? "bg-slate-900 text-white border-slate-950 ring-2 ring-slate-400 shadow-2xs"
              : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
          }`}
          title={`Total en Fénix: ${stats.agendadas + stats.verdes + stats.azules + stats.amarillos + (stats.ordenamientos || 0)}`}
        >
          <span className="truncate">Total:</span>
          <span className="font-mono font-black ml-1">
            {stats.agendadas + stats.verdes + stats.azules + stats.amarillos + (stats.ordenamientos || 0)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleToggleStatus("Agendadas")}
          className={`flex items-center justify-between px-1.5 py-1 rounded-md text-[10.5px] font-bold border cursor-pointer transition-all ${
            isStatusActive("Agendadas")
              ? "bg-slate-800 text-white border-slate-900 ring-2 ring-slate-400 shadow-2xs font-black"
              : "bg-white text-slate-800 border-slate-300 hover:bg-slate-100"
          }`}
          title="Sumar/Filtrar Asignadas"
        >
          <div className="flex items-center gap-1 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-white border border-slate-400 shrink-0"></span>
            <span className="truncate">Asign.:</span>
          </div>
          <span className="font-mono font-black ml-1">{stats.agendadas}</span>
        </button>

        <button
          type="button"
          onClick={() => handleToggleStatus("Verdes")}
          className={`flex items-center justify-between px-1.5 py-1 rounded-md text-[10.5px] font-bold border cursor-pointer transition-all ${
            isStatusActive("Verdes")
              ? "bg-[#70ad47] text-white border-[#568735] ring-2 ring-emerald-300 shadow-2xs font-black"
              : "bg-[#70ad47]/15 text-emerald-950 border-[#70ad47]/30 hover:bg-[#70ad47]/25"
          }`}
          title="Sumar/Filtrar Iniciadas"
        >
          <div className="flex items-center gap-1 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#70ad47] border border-[#568735] shrink-0"></span>
            <span className="truncate">Inic.:</span>
          </div>
          <span className="font-mono font-black ml-1">{stats.verdes}</span>
        </button>

        <button
          type="button"
          onClick={() => handleToggleStatus("Finalizadas")}
          className={`flex items-center justify-between px-1.5 py-1 rounded-md text-[10.5px] font-bold border cursor-pointer transition-all ${
            isStatusActive("Finalizadas")
              ? "bg-[#5b9bd5] text-white border-[#3c78b0] ring-2 ring-sky-300 shadow-2xs font-black"
              : "bg-[#5b9bd5]/20 text-sky-950 border-[#5b9bd5]/35 hover:bg-[#5b9bd5]/30"
          }`}
          title="Sumar/Filtrar Finalizadas"
        >
          <div className="flex items-center gap-1 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5b9bd5] border border-[#3c78b0] shrink-0"></span>
            <span className="truncate">Fin.:</span>
          </div>
          <span className="font-mono font-black ml-1">{stats.azules}</span>
        </button>

        <button
          type="button"
          onClick={() => handleToggleStatus("Amarillos")}
          className={`flex items-center justify-between px-1.5 py-1 rounded-md text-[10.5px] font-bold border cursor-pointer transition-all ${
            isStatusActive("Amarillos")
              ? "bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300 shadow-2xs font-black"
              : "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
          }`}
          title="Sumar/Filtrar Regestión / Canceladas"
        >
          <div className="flex items-center gap-1 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
            <span className="truncate">Regest.:</span>
          </div>
          <span className="font-mono font-black ml-1">{stats.amarillos}</span>
        </button>

        {/* 🟣 ORDENAMIENTOS DESTACADO EN CELULAR */}
        <button
          type="button"
          onClick={() => handleToggleStatus("Ordenamientos")}
          className={`flex items-center justify-between px-1.5 py-1 rounded-md text-[10.5px] font-bold border cursor-pointer transition-all ${
            isStatusActive("Ordenamientos")
              ? "bg-violet-600 text-white border-violet-700 ring-2 ring-violet-400 shadow-xs scale-102 font-black"
              : "bg-violet-100 text-violet-950 border-violet-300 hover:bg-violet-200"
          }`}
          title="Sumar/Mostrar órdenes de ordenamiento"
        >
          <div className="flex items-center gap-1 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-600 shrink-0"></span>
            <span className="truncate font-black text-violet-900">Ordenam.:</span>
          </div>
          <span className="font-mono font-black ml-1 bg-violet-700 text-white px-1 py-0 rounded text-[9.5px]">
            {stats.ordenamientos}
          </span>
        </button>
      </div>

      {/* 💻 En PC / Pantalla Grande: Tira Horizontal Continua con Multi-Selección */}
      <div className="hidden lg:flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5 whitespace-nowrap min-w-0 max-w-full">
        <span
          onClick={() => handleToggleStatus("Todos")}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border cursor-pointer transition-all shrink-0 ${
            isStatusActive("Todos")
              ? "bg-slate-900 text-white border-slate-950 ring-2 ring-slate-400 shadow-2xs scale-102"
              : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
          }`}
          title={`Total en Fénix: ${stats.agendadas + stats.verdes + stats.azules + stats.amarillos + (stats.ordenamientos || 0)}`}
        >
          <span>Total:</span>
          <span className="font-mono font-black">{stats.agendadas + stats.verdes + stats.azules + stats.amarillos + (stats.ordenamientos || 0)}</span>
          <span className={`text-[9.5px] font-semibold px-1 py-0 rounded ${isStatusActive("Todos") ? "bg-slate-800 text-sky-200" : "bg-slate-200 text-slate-800"}`}>
            ({stats.agendadas + stats.verdes + stats.azules + stats.amarillos} Op + {stats.ordenamientos || 0} Ord)
          </span>
        </span>

        <span
          onClick={() => handleToggleStatus("Agendadas")}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border cursor-pointer transition-all shrink-0 ${
            isStatusActive("Agendadas")
              ? "bg-slate-800 text-white border-slate-900 ring-2 ring-slate-400 shadow-2xs scale-102 font-black"
              : "bg-white text-slate-800 border-slate-300 hover:bg-slate-100"
          }`}
          title="Sumar/Filtrar Agendadas / Asignadas / En camino (Clic para sumar/quitar)"
        >
          <span className="w-2 h-2 rounded-full bg-white border border-slate-400"></span>
          <span>Asignadas:</span>
          <span className="font-mono font-black">{stats.agendadas}</span>
        </span>

        <span
          onClick={() => handleToggleStatus("Verdes")}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border cursor-pointer transition-all shrink-0 ${
            isStatusActive("Verdes")
              ? "bg-[#70ad47] text-white border-[#568735] ring-2 ring-emerald-300 shadow-2xs scale-102 font-black"
              : "bg-[#70ad47]/15 text-emerald-950 border-[#70ad47]/30 hover:bg-[#70ad47]/25"
          }`}
          title="Sumar/Filtrar Iniciadas / Proceso (Clic para sumar/quitar)"
        >
          <span className="w-2 h-2 rounded-full bg-[#70ad47] border border-[#568735]"></span>
          <span>Iniciadas:</span>
          <span className="font-mono font-black">{stats.verdes}</span>
        </span>

        <span
          onClick={() => handleToggleStatus("Finalizadas")}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border cursor-pointer transition-all shrink-0 ${
            isStatusActive("Finalizadas")
              ? "bg-[#5b9bd5] text-white border-[#3c78b0] ring-2 ring-sky-300 shadow-2xs scale-102 font-black"
              : "bg-[#5b9bd5]/20 text-sky-950 border-[#5b9bd5]/35 hover:bg-[#5b9bd5]/30"
          }`}
          title="Sumar/Filtrar Finalizadas / Liquidadas (Clic para sumar/quitar)"
        >
          <span className="w-2 h-2 rounded-full bg-[#5b9bd5] border border-[#3c78b0]"></span>
          <span>Finalizadas:</span>
          <span className="font-mono font-black">{stats.azules}</span>
        </span>

        <span
          onClick={() => handleToggleStatus("Amarillos")}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border cursor-pointer transition-all shrink-0 ${
            isStatusActive("Amarillos")
              ? "bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300 shadow-2xs scale-102 font-black"
              : "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
          }`}
          title="Sumar/Filtrar Regestión / Canceladas / Observadas / Anuladas (Clic para sumar/quitar)"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          <span>Regestión / Canceladas:</span>
          <span className="font-mono font-black">{stats.amarillos}</span>
        </span>

        <span
          onClick={() => handleToggleStatus("Ordenamientos")}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border cursor-pointer transition-all shrink-0 ${
            isStatusActive("Ordenamientos")
              ? "bg-violet-600 text-white border-violet-700 ring-2 ring-violet-300 shadow-2xs scale-102 font-black"
              : "bg-violet-50 text-violet-900 border-violet-200 hover:bg-violet-100"
          }`}
          title="Sumar/Mostrar únicamente órdenes de ordenamiento (Clic para sumar/quitar)"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
          <span>Ordenamientos:</span>
          <span className="font-mono font-black">{stats.ordenamientos}</span>
        </span>
      </div>

      {/* 🟣 BANNER INFORMATIVO CUANDO EL FILTRO DE ORDENAMIENTOS ESTÁ ACTIVO */}
      {isStatusActive("Ordenamientos") && (
        <div className="flex items-center justify-between px-2.5 py-1 bg-violet-50 border border-violet-300 rounded-lg text-xs text-violet-900 animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 rounded-full bg-violet-600 animate-pulse"></span>
            <span>Viendo {stats.ordenamientos} órdenes de Ordenamiento (Cuadrillas O)</span>
          </div>
          <button
            type="button"
            onClick={() => handleToggleStatus("Ordenamientos")}
            className="text-[10.5px] font-bold text-violet-700 hover:text-violet-950 underline cursor-pointer"
          >
            Quitar ordenamientos
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          FILA 3: BUSCADOR & FILTROS (MÓVIL / TABLET: lg:hidden)
      ───────────────────────────────────────────────────────────── */}
      <div className="lg:hidden flex flex-col gap-1 pt-0.5">
        <div className="flex items-center gap-1">
          <div className="relative flex-1">
            <Input
              placeholder="Ticket, Cliente, DNI, CTO..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-7.5 bg-slate-50 border-slate-300 text-xs pl-2.5 pr-6 focus:ring-sky-500 font-medium py-0.5 rounded-md"
            />
            {localSearch && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs p-0.5 cursor-pointer"
                title="Borrar búsqueda"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleExecuteSearch()}
            className="h-7.5 px-2 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white rounded-md text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer shrink-0"
            title="Buscar"
          >
            <Search size={12} />
            <span className="hidden sm:inline">Buscar</span>
          </button>

          <button
            type="button"
            onClick={() => setFiltrosAbiertosMobile(!filtrosAbiertosMobile)}
            className={`h-7.5 px-2 rounded-md text-xs font-bold flex items-center gap-1 border transition-all cursor-pointer shrink-0 ${
              filtrosAbiertosMobile || activeFiltersCount > 0
                ? "bg-sky-50 text-sky-800 border-sky-300 ring-1 ring-sky-200"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
            }`}
            title="Mostrar / Ocultar filtros avanzados"
          >
            <Filter size={12} className={activeFiltersCount > 0 ? "text-sky-600" : ""} />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="px-1 py-0.2 rounded-full text-[9px] font-black bg-sky-600 text-white">
                {activeFiltersCount}
              </span>
            )}
            <ChevronDown size={11} className={`transition-transform ${filtrosAbiertosMobile ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Panel Desplegable de Filtros en Celular */}
        {filtrosAbiertosMobile && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1.5 pb-0.5 border-t border-slate-100 animate-in fade-in slide-in-from-top-1 duration-150">
            {/* 1. Desde */}
            <div className="w-full">
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                  Desde
                </label>
                <button
                  type="button"
                  onClick={handleSetToday}
                  className="text-[9px] font-bold text-sky-600 hover:text-sky-800 cursor-pointer"
                >
                  📅 Hoy
                </button>
              </div>
              <Input
                type="date"
                value={filters.fechaDesde}
                onChange={(e) => onFilterChange({ ...filters, fechaDesde: e.target.value })}
                className="w-full h-7.5 bg-slate-50 border-slate-300 text-xs py-0.5 px-2 rounded-md"
              />
            </div>

            {/* 2. Hasta */}
            <div className="w-full">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 block">
                Hasta
              </label>
              <Input
                type="date"
                value={filters.fechaHasta}
                onChange={(e) => onFilterChange({ ...filters, fechaHasta: e.target.value })}
                className="w-full h-7.5 bg-slate-50 border-slate-300 text-xs py-0.5 px-2 rounded-md"
              />
            </div>

            {/* 3. Estado */}
            <div className="w-full">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 block truncate">
                Estado {getActiveStatuses().length > 0 && `(${getActiveStatuses().length} selec.)`}
              </label>
              <select
                value={getActiveStatuses().length === 1 ? getActiveStatuses()[0] : (getActiveStatuses().length === 0 ? "Todos" : "Multiples")}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "Todos") {
                    handleToggleStatus("Todos");
                  } else if (val !== "Multiples") {
                    handleToggleStatus(val);
                  }
                }}
                className={`w-full h-7.5 rounded-md border px-1.5 py-0.5 text-xs font-medium truncate ${
                  getActiveStatuses().length > 0 ? "bg-sky-50 border-sky-400 text-sky-900 font-bold" : "bg-slate-50 border-slate-300"
                }`}
              >
                <option value="Todos">🌐 Todos ({stats.agendadas + stats.verdes + stats.azules + stats.amarillos + (stats.ordenamientos || 0)})</option>
                {getActiveStatuses().length > 1 && (
                  <option value="Multiples" disabled>
                    🏷️ {getActiveStatuses().length} estados sumados
                  </option>
                )}
                <option value="Verdes">🟢 {isStatusActive("Verdes") ? "✓ " : ""}Iniciadas ({stats.verdes})</option>
                <option value="Finalizadas">🔵 {isStatusActive("Finalizadas") ? "✓ " : ""}Finalizadas ({stats.azules})</option>
                <option value="Amarillos">🟡 {isStatusActive("Amarillos") ? "✓ " : ""}Regestión / Canc. ({stats.amarillos})</option>
                <option value="Agendadas">⚪ {isStatusActive("Agendadas") ? "✓ " : ""}Asignadas ({stats.agendadas})</option>
                <option value="Ordenamientos">🟣 {isStatusActive("Ordenamientos") ? "✓ " : ""}Ordenamientos ({stats.ordenamientos})</option>
              </select>
            </div>

            {/* 4. Técnico */}
            <div className="w-full">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 block truncate">
                👷 Técnico
              </label>
              <select
                value={filters.tecnico || "Todos"}
                onChange={(e) => onFilterChange({ ...filters, tecnico: e.target.value })}
                className="w-full h-7.5 rounded-md border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs font-bold truncate"
              >
                <option value="Todos">👷 Todos ({tecnicos.length})</option>
                {tecnicos.map((tec) => (
                  <option key={tec} value={tec}>
                    {tec}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Cuadrilla */}
            <div className="w-full">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 block truncate">
                👥 Cuadrilla
              </label>
              <select
                value={filters.cuadrilla || "Todos"}
                onChange={(e) => onFilterChange({ ...filters, cuadrilla: e.target.value })}
                className="w-full h-7.5 rounded-md border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs font-bold truncate"
              >
                <option value="Todos">👥 Todas ({cuadrillas.length})</option>
                {cuadrillas.map((c) => {
                  const key = typeof c === "string" ? c : c.key;
                  const label = typeof c === "string" ? c : c.label;
                  return (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 6. Inconcert */}
            <div className="w-full">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 block">
                Inconcert
              </label>
              <select
                value={filters.inconcert}
                onChange={(e) => onFilterChange({ ...filters, inconcert: e.target.value })}
                className="w-full h-7.5 rounded-md border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs font-medium"
              >
                <option value="Todos">📞 Todos</option>
                <option value="Si">✅ Con llamada</option>
                <option value="No">❌ Sin llamada</option>
              </select>
            </div>

            {/* Botones de Acción en Filtros Móvil */}
            <div className="col-span-2 sm:col-span-3 pt-1 border-t border-slate-200/70 flex items-center justify-between gap-2">
              {activeFiltersCount > 0 ? (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-2 py-1 rounded-md text-[10px] text-rose-600 hover:bg-rose-50 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <X size={11} />
                  <span>Limpiar Filtros ({activeFiltersCount})</span>
                </button>
              ) : (
                <span className="text-[10px] text-slate-400 font-medium">Sin filtros aplicados</span>
              )}

              <button
                type="button"
                onClick={() => setFiltrosAbiertosMobile(false)}
                className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-[11px] font-bold shadow-2xs cursor-pointer transition-colors"
              >
                Cerrar Filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          FILA 3: FILTROS DE ESCRITORIO (DESKTOP / LAPTOP: hidden lg:grid)
      ───────────────────────────────────────────────────────────── */}
      <div className="hidden lg:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2 items-end pt-0.5">

        {/* 1. Fecha Desde */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-0.5">
            <label className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider block">
              Desde
            </label>
            <button
              type="button"
              onClick={handleSetToday}
              className="text-[9.5px] font-bold text-sky-600 hover:text-sky-800 cursor-pointer"
              title="Filtrar solo el día de hoy"
            >
              📅 Hoy
            </button>
          </div>
          <div className="relative">
            <Input
              type="date"
              value={filters.fechaDesde}
              onChange={(e) => onFilterChange({ ...filters, fechaDesde: e.target.value })}
              className="w-full h-7.5 bg-slate-50 border-slate-300 text-xs py-0.5 px-2 rounded-md focus:ring-sky-500"
            />
          </div>
        </div>

        {/* 2. Fecha Hasta */}
        <div className="w-full">
          <label className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 block">
            Hasta
          </label>
          <div className="relative">
            <Input
              type="date"
              value={filters.fechaHasta}
              onChange={(e) => onFilterChange({ ...filters, fechaHasta: e.target.value })}
              className="w-full h-7.5 bg-slate-50 border-slate-300 text-xs py-0.5 px-2 rounded-md focus:ring-sky-500"
            />
          </div>
        </div>

        {/* 3. Filtro de Estado (Multi-Selección Acumulativo) */}
        <div className="w-full relative" ref={statusDropdownRef}>
          <label className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 block truncate">
            Estado / Color {getActiveStatuses().length > 0 && `(${getActiveStatuses().length} selec.)`}
          </label>
          <button
            type="button"
            onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
            className={`w-full h-7.5 rounded-md border px-2 py-0.5 text-xs font-bold flex items-center justify-between cursor-pointer transition-all ${
              getActiveStatuses().length > 0
                ? "bg-sky-50 border-sky-400 text-sky-900 ring-1 ring-sky-200"
                : "bg-slate-50 border-slate-300 text-slate-800 hover:bg-slate-100"
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              {getActiveStatuses().length === 0 ? (
                <>
                  <span>🌐</span>
                  <span className="truncate">Todos los Estados</span>
                </>
              ) : getActiveStatuses().length === 1 ? (
                <>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    getActiveStatuses()[0] === "Verdes" ? "bg-[#70ad47]" :
                    getActiveStatuses()[0] === "Finalizadas" ? "bg-[#5b9bd5]" :
                    getActiveStatuses()[0] === "Amarillos" ? "bg-amber-500" :
                    getActiveStatuses()[0] === "Ordenamientos" ? "bg-violet-600" : "bg-slate-400"
                  }`} />
                  <span className="truncate">
                    {STATUS_OPTIONS.find(o => o.key === getActiveStatuses()[0])?.label.split(" (")[0] || getActiveStatuses()[0]}
                  </span>
                </>
              ) : (
                <>
                  <span className="bg-sky-600 text-white text-[9.5px] px-1 py-0.2 rounded-full font-black shrink-0">
                    {getActiveStatuses().length}
                  </span>
                  <span className="truncate font-black text-sky-900">
                    {getActiveStatuses().map(k => k === "Verdes" ? "Inic." : k === "Finalizadas" ? "Fin." : k === "Amarillos" ? "Regest." : k === "Agendadas" ? "Asign." : "Ord.").join(" + ")}
                  </span>
                </>
              )}
            </div>
            <ChevronDown size={11} className={`text-slate-400 shrink-0 transition-transform ${statusDropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {/* Menú Desplegable con Checkboxes y Conteo */}
          {statusDropdownOpen && (
            <div className="absolute left-0 top-full mt-1 w-72 max-w-[90vw] bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-100 px-1.5">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Sumar Estados ({getActiveStatuses().length} activos)
                </span>
                {getActiveStatuses().length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      handleToggleStatus("Todos");
                    }}
                    className="text-[9.5px] font-bold text-sky-600 hover:text-sky-800 cursor-pointer"
                  >
                    Marcar Todos
                  </button>
                )}
              </div>

              {/* Opción: Todos */}
              <button
                type="button"
                onClick={() => {
                  handleToggleStatus("Todos");
                  setStatusDropdownOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-bold transition-all mb-1 ${
                  isStatusActive("Todos")
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "hover:bg-slate-100 text-slate-700 cursor-pointer"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>🌐</span>
                  <span>Todos los Estados</span>
                </div>
                <span className="font-mono text-[11px] opacity-80">
                  {stats.agendadas + stats.verdes + stats.azules + stats.amarillos + (stats.ordenamientos || 0)}
                </span>
              </button>

              {/* Lista de Estados Individuales para Sumar */}
              <div className="space-y-0.5">
                {STATUS_OPTIONS.map((opt) => {
                  const active = isStatusActive(opt.key);
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleToggleStatus(opt.key)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        active
                          ? "bg-sky-50 text-sky-950 border border-sky-300 shadow-2xs"
                          : "hover:bg-slate-50 text-slate-800 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] font-black shrink-0 ${
                          active ? "bg-sky-600 border-sky-600 text-white" : "border-slate-300 bg-white"
                        }`}>
                          {active ? "✓" : ""}
                        </div>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${opt.colorDot} ${opt.borderDot ? `border ${opt.borderDot}` : ""}`} />
                        <span className="truncate">{opt.label}</span>
                      </div>
                      <span className="font-mono text-[11px] ml-1.5 font-bold text-slate-600">
                        {opt.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 4. Filtro de Técnico Específico */}
        <div className="w-full">
          <label className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 block">
            👷 Técnico
          </label>
          <select
            value={filters.tecnico || "Todos"}
            onChange={(e) => onFilterChange({ ...filters, tecnico: e.target.value })}
            className={`w-full h-7.5 rounded-md border px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer font-bold truncate ${filters.tecnico && filters.tecnico !== "Todos"
              ? "bg-amber-50 border-amber-400 text-amber-900"
              : "bg-slate-50 border-slate-300 text-slate-800"
              }`}
          >
            <option value="Todos">👷 Todos los Técnicos ({tecnicos.length})</option>
            {tecnicos.map((tec) => (
              <option key={tec} value={tec}>
                {tec}
              </option>
            ))}
          </select>
        </div>

        {/* 5. Filtro de Cuadrilla */}
        <div className="w-full">
          <label className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 block">
            👥 Cuadrilla
          </label>
          <select
            value={filters.cuadrilla || "Todos"}
            onChange={(e) => onFilterChange({ ...filters, cuadrilla: e.target.value })}
            className={`w-full h-7.5 rounded-md border px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer font-bold truncate ${filters.cuadrilla && filters.cuadrilla !== "Todos"
              ? "bg-sky-50 border-sky-400 text-sky-900"
              : "bg-slate-50 border-slate-300 text-slate-800"
              }`}
          >
            <option value="Todos">👥 Todas las Cuadrillas ({cuadrillas.length})</option>
            {cuadrillas.map((c) => {
              const key = typeof c === "string" ? c : c.key;
              const label = typeof c === "string" ? c : c.label;
              return (
                <option key={key} value={key}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>

        {/* 6. Filtro Inconcert */}
        <div className="w-full">
          <label className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 block">
            Inconcert
          </label>
          <select
            value={filters.inconcert}
            onChange={(e) => onFilterChange({ ...filters, inconcert: e.target.value })}
            className="w-full h-7.5 rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer font-medium"
          >
            <option value="Todos">📞 Inconcert: Todos</option>
            <option value="Si">✅ Con llamada Inconcert (Sí)</option>
            <option value="No">❌ Sin llamada (No)</option>
          </select>
        </div>

        {/* 7. Buscador General con Botón Buscar y ENTER */}
        <div className="w-full sm:col-span-2 lg:col-span-1 xl:col-span-1">
          <div className="flex items-center justify-between mb-0.5">
            <label className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider block">
              Búsqueda Rápida
            </label>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-[9.5px] text-red-500 hover:text-red-700 font-semibold cursor-pointer flex items-center gap-0.5"
              >
                <X size={9} />
                <span>Limpiar filtros</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <div className="relative flex-1">
              <Input
                placeholder="Ticket, Cliente, DNI, CTO..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-7.5 bg-slate-50 border-slate-300 text-xs pl-2.5 pr-6 focus:ring-sky-500 font-medium py-0.5 rounded-md"
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs p-0.5 cursor-pointer"
                  title="Borrar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleExecuteSearch()}
              className="h-7.5 px-2.5 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white rounded-md text-xs font-bold flex items-center gap-1 shadow-2xs shadow-sky-600/20 transition-all cursor-pointer shrink-0"
              title="Buscar (o presiona ENTER)"
            >
              <Search size={12} />
              <span>Buscar</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
