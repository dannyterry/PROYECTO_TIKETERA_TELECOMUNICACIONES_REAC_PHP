import { useState, useEffect, useCallback, useRef } from "react";
import { OrdersPage } from "./modules/orders/OrdersPage";
import { EmployeeList } from "./components/employee/EmployeeList";
import Dashboard from "./pages/Dashboard";
import { getEmpleados } from "./services/employeeService";
import { Employee } from "./components/employee/Employee";
import {
  Users,
  FileText,
  Briefcase,
  RefreshCw,
  Car,
  ClipboardList,
  Package,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Settings,
  Coins,
  LogOut,
  ChevronDown,
  User as UserIcon,
  LayoutDashboard,
  Menu,
  X,
  Radio,
  Bell,
  MessageSquare,
  Search,
} from "lucide-react";
import { MobilityPage } from "./modules/mobility/MobilityPage";
import { InventoryPage } from "./modules/inventory/InventoryPage";
import { TechnicianOrdersPortal } from "./modules/orders/components/TechnicianOrdersPortal";
import { ExecutiveDashboardPage } from "./modules/dashboard/ExecutiveDashboardPage";
import { SettingsPage } from "./modules/settings/SettingsPage";
import { PaymentsPage } from "./modules/payments/PaymentsPage";
import { RolesTab } from "./modules/employee/components/RolesTab";
import { AttendanceTab } from "./modules/employee/components/AttendanceTab";
import { SupervisionPage } from "./modules/supervision/SupervisionPage";
import { TeamChat } from "./components/chat/TeamChat";
import { authService, AuthUser } from "./services/authService";
import { LoginPage } from "./pages/LoginPage";
import { API_URL } from "./config/api";

export default function App() {
  // ── ESTADO DE AUTENTICACIÓN CENTRALIZADO ──
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    return authService.getCurrentUser();
  });

  // Sincronizar permisos en vivo del rol autenticado desde la API
  useEffect(() => {
    if (currentUser?.id_rol) {
      authService.refreshUserPermissions().then((claves) => {
        if (claves && Array.isArray(claves)) {
          setCurrentUser((prev) => (prev ? { ...prev, permisos: claves } : null));
        }
      });
    }
  }, [currentUser?.id_rol]);

  // Escuchar eventos cuando se actualicen permisos en la Matriz
  useEffect(() => {
    const handlePermsUpdated = () => {
      authService.refreshUserPermissions().then((claves) => {
        if (claves && Array.isArray(claves)) {
          setCurrentUser((prev) => (prev ? { ...prev, permisos: claves } : null));
        }
      });
    };
    window.addEventListener("permissionsUpdated", handlePermsUpdated);
    return () => window.removeEventListener("permissionsUpdated", handlePermsUpdated);
  }, []);

  const [sidebarColapsado, setSidebarColapsado] = useState(true);
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);
  const [avatarImgError, setAvatarImgError] = useState(false);

  // Escuchar eventos globales para abrir/cerrar el menú lateral desde cualquier componente
  useEffect(() => {
    const handleToggleSidebar = () => setSidebarColapsado((prev) => !prev);
    const handleOpenSidebar = () => setSidebarColapsado(false);
    window.addEventListener("toggleSidebar", handleToggleSidebar);
    window.addEventListener("openSidebar", handleOpenSidebar);
    return () => {
      window.removeEventListener("toggleSidebar", handleToggleSidebar);
      window.removeEventListener("openSidebar", handleOpenSidebar);
    };
  }, []);

  // 1. Detección de vista flexible según el hash o parámetro
  const getViewFromLocation = () => {
    const params = new URLSearchParams(window.location.search);
    const paramView = params.get("view") || params.get("modulo") || params.get("tab");
    const hashView = window.location.hash.replace(/^#\/?/, "").split("?")[0];
    return hashView || paramView || "dashboard";
  };

  const [currentView, setCurrentView] = useState<string>(getViewFromLocation);

  // 2. Sub-pestaña de Recursos Humanos
  const getRhTabFromLocation = (): "directorio" | "ficha" | "roles" | "asistencias" => {
    const view = getViewFromLocation().toLowerCase();
    if (view.includes("rol")) return "roles";
    if (view.includes("asistenc")) return "asistencias";
    if (view.includes("ficha") || view.includes("detalle")) return "ficha";
    return "directorio";
  };

  const [rhTab, setRhTab] = useState<"directorio" | "ficha" | "roles" | "asistencias">(getRhTabFromLocation);
  const [empleados, setEmpleados] = useState<Employee[]>([]);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<Employee | null>(null);

  // Escuchar cambios de hash en la URL
  useEffect(() => {
    const handleLocationChange = () => {
      const view = getViewFromLocation();
      setCurrentView(view);
      const vLower = view.toLowerCase();
      if (vLower.includes("rol")) setRhTab("roles");
      else if (vLower.includes("asistenc")) setRhTab("asistencias");
    };

    window.addEventListener("hashchange", handleLocationChange);
    window.addEventListener("popstate", handleLocationChange);
    return () => {
      window.removeEventListener("hashchange", handleLocationChange);
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  // Estados para Chat y Usuarios Online (para barras integradas)
  const [usuariosOnline, setUsuariosOnline] = useState<any[]>([]);
  const [totalNoLeidos, setTotalNoLeidos] = useState(0);
  const [noLeidosPorUsuario, setNoLeidosPorUsuario] = useState<Record<number, number>>({});
  const [onlineDropdownOpen, setOnlineDropdownOpen] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const onlineDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (onlineDropdownRef.current && !onlineDropdownRef.current.contains(e.target as Node)) {
        setOnlineDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setMenuUsuarioAbierto(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cargar lista de empleados
  const cargarEmpleados = async () => {
    try {
      const data = await getEmpleados();
      setEmpleados(data);
    } catch (err) {
      console.error("Error al cargar empleados:", err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      cargarEmpleados();
    }
  }, [currentUser]);

  const handleSeleccionarEmpleado = (emp: Employee) => {
    setEmpleadoSeleccionado(emp);
    setRhTab("ficha");
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    window.location.hash = "login";
    window.location.reload();
  };

  // Si no está autenticado o la ruta es #login, mostrar la pantalla de Login ejecutiva
  if (!currentUser || currentView === "login") {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          // Redirigir al módulo permitido por defecto para este rol
          const targetView = authService.getDefaultView();
          window.location.hash = targetView;
          window.location.reload();
        }}
      />
    );
  }

  // Permisos y Roles
  const userId = String(currentUser.id_usuario);
  const userName = currentUser.nombreCompleto || `${currentUser.nombres} ${currentUser.apellidos}`.trim();
  const userSoloNombres = (currentUser.nombres || currentUser.nombreCompleto || "").trim().split(/\s+/).slice(0, 2).join(" ") || userName;
  const userRol = String(currentUser.id_rol);
  const rolNombre = currentUser.rol || "Usuario";

  // Identificación de Vistas
  const isTechnicianPortal = currentView === "portal-tecnico";
  const esTecnico =
    userRol === "2" ||
    Boolean(rolNombre && (rolNombre.toUpperCase().includes("TECNICO") || rolNombre.toUpperCase().includes("TÉCNICO")));

  const isExecutiveDashboard =
    currentView === "dashboard" ||
    currentView === "inicio" ||
    currentView === "reportes" ||
    currentView === "auditoria" ||
    currentView === "torre-control";

  const isPersonalView =
    currentView === "personal" ||
    currentView === "empleados" ||
    currentView === "general" ||
    currentView === "roles" ||
    currentView === "rol" ||
    currentView === "asistencia" ||
    currentView === "asistencias";

  const isMobilityView =
    currentView === "movilidad" ||
    currentView === "vehiculos" ||
    currentView === "combustibles" ||
    currentView === "combustible" ||
    currentView === "flota" ||
    currentView === "inspecciones" ||
    currentView === "checklist-tecnico";

  const isInventoryView =
    currentView === "almacen" ||
    currentView === "inventario" ||
    currentView === "stock" ||
    currentView === "kardex" ||
    currentView === "movimientos" ||
    currentView === "kardex-movimientos" ||
    currentView === "kardex_movimientos" ||
    currentView === "kardex-general" ||
    currentView === "compras" ||
    currentView === "despacho" ||
    currentView === "historial_despachos" ||
    currentView === "historial-despachos" ||
    currentView === "historial" ||
    currentView === "recogidos" ||
    currentView === "devolucion" ||
    currentView === "devoluciones" ||
    currentView === "liquidacion" ||
    currentView === "liquidaciones" ||
    currentView === "liquidaciones_ordenes" ||
    currentView === "liquidaciones-ordenes" ||
    currentView === "productos" ||
    currentView === "categorias" ||
    currentView === "proveedores";

  const isSettingsView =
    currentView === "configuracion" ||
    currentView === "motivos" ||
    currentView === "tipos-trabajo" ||
    currentView === "tipo_trabajo" ||
    currentView === "sistema" ||
    currentView === "permisos" ||
    currentView === "correos" ||
    currentView === "email";

  const isPaymentsView =
    currentView === "pagos" ||
    currentView === "pago" ||
    currentView === "finanzas" ||
    currentView === "liquidaciones-tecnicos";

  const isSupervisionView =
    currentView === "supervision" ||
    currentView === "calidad" ||
    currentView === "auditoria-calidad";

  const isOrdersView =
    !isPersonalView &&
    !isMobilityView &&
    !isInventoryView &&
    !isSettingsView &&
    !isPaymentsView &&
    !isSupervisionView &&
    !isExecutiveDashboard &&
    !isTechnicianPortal;

  // 🛡️ Ocultar Chat completamente a Técnicos y en módulos con barra integrada (Órdenes, Dashboard/Análisis, Personal, etc.)
  const ocultarBarraChat = Boolean(
    isTechnicianPortal ||
    esTecnico ||
    isOrdersView ||
    isExecutiveDashboard ||
    isPersonalView ||
    isInventoryView ||
    isMobilityView ||
    isSettingsView ||
    isPaymentsView ||
    isSupervisionView
  );

  const canUseGroupChat =
    !esTecnico &&
    (userRol === "1" ||
      userRol === "3" ||
      userRol === "5" ||
      (rolNombre &&
        (rolNombre.toUpperCase().includes("ADMIN") ||
          rolNombre.toUpperCase().includes("RECURSO") ||
          rolNombre.toUpperCase().includes("RRHH") ||
          rolNombre.toUpperCase().includes("ALMACEN") ||
          rolNombre.toUpperCase().includes("LOGISTICA"))));

  useEffect(() => {
    if (esTecnico) return;
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
    const intervalOnline = setInterval(fetchOnline, 10000);
    const intervalChat = setInterval(fetchNoLeidos, 4000);

    return () => {
      clearInterval(intervalOnline);
      clearInterval(intervalChat);
    };
  }, [esTecnico, userId]);

  const handleOpenGroupChat = () => {
    window.dispatchEvent(new CustomEvent("openTeamChat", { detail: { tab: "general" } }));
    setOnlineDropdownOpen(false);
  };

  const handleOpenUserChat = (target: any) => {
    window.dispatchEvent(new CustomEvent("openTeamChat", { detail: { tab: target.id_usuario, user: target } }));
    setOnlineDropdownOpen(false);
  };

  // 🛡️ FILTRO ESTRICTO DE MÓDULOS SEGÚN MATRIZ DE PERMISOS POR ROL
  const todosLosModulos = [
    { id: "dashboard", label: "Análisis & Visualización", icon: LayoutDashboard, activo: isExecutiveDashboard },
    { id: "ordenes", label: "Órdenes", icon: ClipboardList, activo: isOrdersView },
    { id: "supervision", label: "Supervisión & Calidad", icon: ShieldCheck, activo: isSupervisionView },
    { id: "portal-tecnico", label: "Portal Técnico", icon: Car, activo: isTechnicianPortal },
    { id: "personal", label: "Personal", icon: Users, activo: isPersonalView },
    { id: "inventario", label: "Inventario", icon: Package, activo: isInventoryView },
    { id: "movilidad", label: "Movilidad", icon: Car, activo: isMobilityView },
    { id: "pagos", label: "Pagos", icon: Coins, activo: isPaymentsView },
    { id: "configuracion", label: "Configuración", icon: Settings, activo: isSettingsView },
  ];

  // El sidebar solo muestra módulos a los que el rol tiene acceso real
  const modulosNav = todosLosModulos.filter((m) => authService.canAccessModule(m.id));

  // Validación de seguridad para la vista actual
  const isCurrentViewAllowed = (): boolean => {
    if (!currentUser) return false;
    if (currentUser.id_rol === 1 || currentUser.rol?.toUpperCase().includes("ADMIN")) return true;

    if (isTechnicianPortal) return authService.canAccessModule("portal-tecnico");
    if (isMobilityView) return authService.canAccessModule("movilidad");
    if (isInventoryView) return authService.canAccessModule("inventario");
    if (isExecutiveDashboard) return authService.canAccessModule("dashboard");
    if (isSupervisionView) return authService.canAccessModule("supervision");
    if (isSettingsView) return authService.canAccessModule("configuracion");
    if (isPaymentsView) return authService.canAccessModule("pagos");
    if (isPersonalView) return authService.canAccessModule("personal");
    if (isOrdersView) return authService.canAccessModule("ordenes");

    return true;
  };

  // Si el usuario navegó por URL hash a un módulo sin permiso, redirigir a su vista autorizada
  useEffect(() => {
    if (currentUser && !isCurrentViewAllowed()) {
      const defaultView = authService.getDefaultView();
      window.location.hash = defaultView;
      setCurrentView(defaultView);
    }
  }, [currentUser, currentView, isCurrentViewAllowed]);

  // Permisos para subpestañas de Personal
  const canDirectorio = authService.hasAnyPermission(["usuarios.ver", "usuarios.crear", "usuarios.editar"]);
  const canFicha = authService.hasAnyPermission(["trabajadores.ver", "trabajadores.crear", "usuarios.ver"]);
  const canRoles = authService.hasAnyPermission(["roles.ver", "roles.crear", "roles.editar"]);
  const canAsistencias = authService.hasAnyPermission(["asistencias.ver", "horarios.ver", "asistencias.crear"]);

  useEffect(() => {
    if (isPersonalView) {
      if (rhTab === "directorio" && !canDirectorio) {
        if (canFicha) setRhTab("ficha");
        else if (canRoles) setRhTab("roles");
        else if (canAsistencias) setRhTab("asistencias");
      } else if (rhTab === "roles" && !canRoles) {
        if (canDirectorio) setRhTab("directorio");
        else if (canFicha) setRhTab("ficha");
        else if (canAsistencias) setRhTab("asistencias");
      } else if (rhTab === "asistencias" && !canAsistencias) {
        if (canDirectorio) setRhTab("directorio");
        else if (canFicha) setRhTab("ficha");
        else if (canRoles) setRhTab("roles");
      }
    }
  }, [isPersonalView, rhTab, canDirectorio, canFicha, canRoles, canAsistencias]);

  return (
    <div className="w-full h-screen bg-slate-100 flex overflow-hidden font-sans relative">
      {/* ─────────────────────────────────────────────────────────────
          🏢 SIDEBAR LATERAL FLOTANTE (OCULTO POR COMPLETO AUTOMÁTICO)
      ───────────────────────────────────────────────────────────── */}
      {/* Backdrop oscuro al desplegar el menú lateral */}
      {!sidebarColapsado && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-[1px] transition-opacity animate-in fade-in duration-150"
          onClick={() => setSidebarColapsado(true)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[55] w-72 bg-slate-50 text-slate-700 flex flex-col justify-between transition-transform duration-200 ease-in-out border-r border-slate-200 shadow-2xl select-none ${
          sidebarColapsado ? "-translate-x-full pointer-events-none" : "translate-x-0"
        }`}
      >
        <div>
          {/* Logo y Encabezado del Menú Drawer */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200/80 bg-white">
            <img
              src="/assets/images/LOGO_CORPORACION.png"
              alt="Corporación Céspedes"
              className="h-9 w-auto max-w-[160px] object-contain"
            />
            <button
              type="button"
              onClick={() => setSidebarColapsado(true)}
              className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer border border-slate-200"
              title="Cerrar menú lateral"
            >
              <X size={17} />
            </button>
          </div>

          {/* Menú de Navegación de Módulos */}
          <nav className="p-3 space-y-1.5 overflow-y-auto max-h-[calc(100vh-140px)]">
            <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
              SISTEMA & MÓDULOS
            </div>

            {modulosNav.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    window.location.hash = m.id;
                    setCurrentView(m.id);
                    setSidebarColapsado(true); // Ocultar por completo automáticamente al cambiar de pestaña/módulo
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    m.activo
                      ? "bg-sky-600 text-white shadow-sm shadow-sky-600/30"
                      : "text-slate-600 hover:text-sky-700 hover:bg-sky-50/80"
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="truncate">{m.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Perfil del Usuario en la Parte Inferior del Sidebar */}
        <div className="p-3 border-t border-slate-200/90 bg-white/80">
          <div className="flex items-center gap-2.5">
            {currentUser.foto_personal && !avatarImgError ? (
              <img
                src={`${API_URL}/uploads/${currentUser.foto_personal}`}
                alt={userName}
                className="w-9 h-9 rounded-full object-cover border-2 border-sky-500 shrink-0 shadow-2xs"
                onError={() => setAvatarImgError(true)}
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-700 border border-sky-200 flex items-center justify-center font-black text-xs shrink-0 uppercase">
                {userName.slice(0, 2)}
              </div>
            )}

            <div className="min-w-0 flex-1 leading-tight">
              <span className="text-xs font-black text-slate-800 truncate block">{userSoloNombres}</span>
              <span className="text-[10px] text-sky-600 font-bold uppercase tracking-wider truncate block">
                {rolNombre}
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
              title="Cerrar Sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          ÁREA PRINCIPAL DE CONTENIDO + TOPBAR CORPORATIVO
      ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* 1. TOPBAR INTEGRADO UNIFICADO: MENÚ (3 RAYITAS), LOGO, CHAT 24/7, EN LÍNEA, USUARIO & CERRAR SESIÓN */}
        <TeamChat
          userId={userId}
          userName={userName}
          userRol={userRol}
          rolNombre={rolNombre}
          hideBar={ocultarBarraChat}
          compactMode={isOrdersView}
          leftSlot={
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setSidebarColapsado(!sidebarColapsado)}
                className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 flex items-center justify-center transition-colors cursor-pointer shadow-2xs shrink-0"
                title={sidebarColapsado ? "Mostrar menú lateral (3 rayitas)" : "Ocultar menú"}
              >
                <Menu size={16} />
              </button>
            </div>
          }
          rightSlot={
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuUsuarioAbierto(!menuUsuarioAbierto)}
                className="flex items-center gap-2.5 py-1 px-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
              >
                <div className="text-right hidden sm:block leading-tight">
                  <span className="text-xs font-black text-slate-900 block truncate max-w-[170px]">
                    {userSoloNombres}
                  </span>
                  <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">
                    {rolNombre}
                  </span>
                </div>

                {currentUser.foto_personal && !avatarImgError ? (
                  <img
                    src={`${API_URL}/uploads/${currentUser.foto_personal}`}
                    alt={userName}
                    className="w-8 h-8 rounded-full object-cover border-2 border-sky-500 shrink-0 shadow-xs"
                    onError={() => setAvatarImgError(true)}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs uppercase">
                    {userName.slice(0, 2)}
                  </div>
                )}

                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {/* Menú Desplegable de Usuario (Solo Cerrar Sesión) */}
              {menuUsuarioAbierto && (
                <>
                  <div
                    className="fixed inset-0 z-[998]"
                    onClick={() => setMenuUsuarioAbierto(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-1.5 z-[999] animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuUsuarioAbierto(false);
                        handleLogout();
                      }}
                      className="w-full px-3 py-2.5 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <LogOut size={15} />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          }
        />

        {/* ─────────────────────────────────────────────────────────────
            VISTAS DE LOS MÓDULOS DE REACT (CON PROTECCIÓN DE RUTAS)
        ───────────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-hidden flex flex-col min-h-0 bg-slate-100/70">
          {!isCurrentViewAllowed() ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4 shadow-lg shadow-rose-600/10">
                <ShieldAlert size={34} />
              </div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Acceso No Autorizado</h2>
              <p className="text-xs text-slate-500 max-w-md mt-1.5 mb-6 leading-relaxed">
                Tu rol <span className="font-bold text-sky-700 uppercase">"{rolNombre}"</span> no cuenta con privilegios autorizados en la <strong>Matriz de Permisos</strong> para visualizar este módulo.
              </p>
              <button
                type="button"
                onClick={() => {
                  const def = authService.getDefaultView();
                  window.location.hash = def;
                  setCurrentView(def);
                }}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-md shadow-sky-600/20 transition-all cursor-pointer"
              >
                Ir a mi módulo autorizado
              </button>
            </div>
          ) : (
            <>
              {/* 0. Portal Técnico */}
              {isTechnicianPortal && (
                <div className="flex-1 w-full overflow-y-auto min-h-0">
                  <TechnicianOrdersPortal userId={userId} userName={userName} userRol={userRol} />
                </div>
              )}

              {/* 1. Movilidad */}
              {isMobilityView && !isTechnicianPortal && (
                <div className="flex-1 w-full overflow-y-auto min-h-0 p-3 md:p-6">
                  <MobilityPage />
                </div>
              )}

              {/* 2. Inventario & Almacén */}
              {isInventoryView && !isTechnicianPortal && (
                <div className="flex-1 w-full overflow-y-auto min-h-0">
                  <InventoryPage />
                </div>
              )}

              {/* 3. Dashboard Ejecutivo */}
              {isExecutiveDashboard && !isTechnicianPortal && (
                <div className="flex-1 w-full overflow-y-auto min-h-0">
                  <ExecutiveDashboardPage />
                </div>
              )}

              {/* 4. Configuración del Sistema */}
              {isSettingsView && !isTechnicianPortal && (
                <div className="flex-1 w-full overflow-hidden min-h-0 flex flex-col">
                  <SettingsPage />
                </div>
              )}

              {/* 5. Pagos y Finanzas a Técnicos */}
              {isPaymentsView && !isTechnicianPortal && (
                <div className="flex-1 w-full overflow-hidden min-h-0 flex flex-col">
                  <PaymentsPage currentUserId={currentUser?.id_usuario} />
                </div>
              )}

              {/* 5.1 Supervisión y Calidad */}
              {isSupervisionView && !isTechnicianPortal && (
                <div className="flex-1 w-full overflow-y-auto min-h-0">
                  <SupervisionPage />
                </div>
              )}

              {/* 6. Órdenes de Trabajo */}
              {isOrdersView && (
                <div className="flex-1 w-full overflow-hidden min-h-0 px-1 sm:px-2 pt-1 pb-1 sm:pb-1.5 flex flex-col">
                  <OrdersPage />
                </div>
              )}

              {/* 7. Recursos Humanos (Personal) */}
              {isPersonalView && (
                <div className="flex-1 flex flex-col w-full min-h-0 overflow-hidden bg-slate-100/60">
                  {/* Barra superior de Pestañas horizontales (Estilo Corporativo) */}
                  <div className="bg-white border-b border-slate-200/80 px-4 md:px-6 pt-3 shrink-0 shadow-2xs">
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setSidebarColapsado(!sidebarColapsado)}
                          className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-500 hover:from-sky-700 hover:to-cyan-600 active:scale-95 text-white flex items-center justify-center shadow-md shadow-sky-600/20 cursor-pointer shrink-0 transition-all group"
                          title="📋 Clic para abrir el menú lateral"
                        >
                          <Briefcase size={20} className="group-hover:scale-110 transition-transform" />
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <h1 className="text-base md:text-lg font-black text-slate-900 tracking-tight">
                              Recursos Humanos & Personal
                            </h1>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-50 text-sky-700 border border-sky-200/80 font-mono">
                              {empleados.length} Registrados
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium hidden sm:block">
                            Directorio de empleados, legajos digitales, asignación de roles y control de asistencia laboral.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* 💬 Desplegable En Línea / Chat (Oculto a Técnicos) */}
                        {!esTecnico && (
                          <div className="relative shrink-0" ref={onlineDropdownRef}>
                            <button
                              type="button"
                              onClick={() => setOnlineDropdownOpen(!onlineDropdownOpen)}
                              className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs h-8.5 ${
                                totalNoLeidos > 0
                                  ? "bg-emerald-500 text-white border-emerald-400 ring-2 ring-emerald-300 shadow-md animate-bounce"
                                  : onlineDropdownOpen
                                  ? "bg-sky-50 text-sky-900 border-sky-300 ring-1 ring-sky-200"
                                  : "bg-slate-50 hover:bg-sky-50 text-slate-700 hover:text-sky-900 border-slate-200 hover:border-sky-300"
                              }`}
                              title="Personal en Línea y Chat de Equipo"
                            >
                              <span className="relative flex h-2 w-2">
                                {usuariosOnline.filter((u) => u.esta_online === 1).length > 0 && (
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                )}
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              <span className="font-mono font-black text-slate-900">
                                {usuariosOnline.filter((u) => u.esta_online === 1).length}
                              </span>
                              <MessageSquare size={13} className="text-sky-600 shrink-0" />
                              {totalNoLeidos > 0 && (
                                <span className="bg-red-600 text-white text-[9px] font-black px-1 py-0.2 rounded-full shadow-xs">
                                  {totalNoLeidos}
                                </span>
                              )}
                              <ChevronDown size={12} className={`text-slate-400 transition-transform ${onlineDropdownOpen ? "rotate-180" : ""}`} />
                            </button>

                            {onlineDropdownOpen && (
                              <div className="absolute right-0 mt-1.5 w-72 max-w-[90vw] bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
                                <div className="p-2.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
                                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                    <Users size={13} className="text-sky-600" />
                                    Equipo y Chat
                                  </span>
                                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
                                    {usuariosOnline.filter((u) => u.esta_online === 1).length} en línea
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

                        <button
                          onClick={cargarEmpleados}
                          title="Recargar empleados"
                          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all cursor-pointer shrink-0 h-8.5"
                        >
                          <RefreshCw size={16} />
                        </button>

                        {/* 👤 Menú de Usuario y Cerrar Sesión */}
                        <div className="relative shrink-0 pl-1 border-l border-slate-200" ref={userMenuRef}>
                          <button
                            type="button"
                            onClick={() => setMenuUsuarioAbierto(!menuUsuarioAbierto)}
                            className="flex items-center gap-1.5 py-0.5 px-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200 text-left h-8.5"
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
                                className="w-7 h-7 rounded-full object-cover border border-sky-500 shrink-0 shadow-2xs"
                                onError={() => setAvatarImgError(true)}
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-sky-600 text-white flex items-center justify-center font-black text-[11px] shrink-0 shadow-2xs uppercase">
                                {(userName || "US").slice(0, 2)}
                              </div>
                            )}

                            <ChevronDown size={12} className={`text-slate-400 transition-transform ${menuUsuarioAbierto ? "rotate-180" : ""}`} />
                          </button>

                          {menuUsuarioAbierto && (
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
                                <LogOut size={14} />
                                <span>Cerrar Sesión</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Pestañas Horizontales filtradas por permisos */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                      {canDirectorio && (
                        <button
                          type="button"
                          onClick={() => setRhTab("directorio")}
                          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                            rhTab === "directorio"
                              ? "bg-sky-600 text-white shadow-sm shadow-sky-600/20"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          }`}
                        >
                          <Users size={15} className={rhTab === "directorio" ? "text-white" : "text-sky-600"} />
                          <span>Directorio de Personal</span>
                          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md ${
                            rhTab === "directorio" ? "bg-white/20 text-white" : "bg-sky-100 text-sky-700"
                          }`}>
                            {empleados.length}
                          </span>
                        </button>
                      )}

                      {canFicha && (
                        <button
                          type="button"
                          onClick={() => setRhTab("ficha")}
                          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                            rhTab === "ficha"
                              ? "bg-sky-600 text-white shadow-sm shadow-sky-600/20"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          }`}
                        >
                          <FileText size={15} className={rhTab === "ficha" ? "text-white" : "text-sky-600"} />
                          <span>Ficha de Personal</span>
                          {empleadoSeleccionado && (
                            <span className={`max-w-[130px] truncate px-1.5 py-0.5 text-[10px] font-bold rounded-md ${
                              rhTab === "ficha" ? "bg-white/20 text-white" : "bg-sky-100 text-sky-700"
                            }`}>
                              {empleadoSeleccionado.nombres}
                            </span>
                          )}
                        </button>
                      )}

                      {canRoles && (
                        <button
                          type="button"
                          onClick={() => setRhTab("roles")}
                          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                            rhTab === "roles"
                              ? "bg-sky-600 text-white shadow-sm shadow-sky-600/20"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          }`}
                        >
                          <ShieldCheck size={15} className={rhTab === "roles" ? "text-white" : "text-sky-600"} />
                          <span>Roles</span>
                        </button>
                      )}

                      {canAsistencias && (
                        <button
                          type="button"
                          onClick={() => setRhTab("asistencias")}
                          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                            rhTab === "asistencias"
                              ? "bg-sky-600 text-white shadow-sm shadow-sky-600/20"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          }`}
                        >
                          <Clock size={15} className={rhTab === "asistencias" ? "text-white" : "text-sky-600"} />
                          <span>Asistencias</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Área de Contenido Principal a Ancho Completo */}
                  <main className="flex-1 p-4 md:p-6 overflow-y-auto min-w-0">
                    {rhTab === "directorio" && canDirectorio && (
                      <EmployeeList
                        empleados={empleados}
                        onSelectEmployee={handleSeleccionarEmpleado}
                        onEmployeeUpdated={cargarEmpleados}
                      />
                    )}
                    {rhTab === "ficha" && canFicha && (
                      <Dashboard
                        selectedEmpProp={empleadoSeleccionado}
                        onDataUpdated={cargarEmpleados}
                      />
                    )}
                    {rhTab === "roles" && canRoles && <RolesTab />}
                    {rhTab === "asistencias" && canAsistencias && <AttendanceTab />}
                  </main>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}