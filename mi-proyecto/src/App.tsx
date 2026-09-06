import { useState, useEffect } from "react";
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
} from "lucide-react";
import { MobilityPage } from "./modules/mobility/MobilityPage";
import { InventoryPage } from "./modules/inventory/InventoryPage";
import { TechnicianOrdersPortal } from "./modules/orders/components/TechnicianOrdersPortal";
import { ExecutiveDashboardPage } from "./modules/dashboard/ExecutiveDashboardPage";
import { SettingsPage } from "./modules/settings/SettingsPage";
import { PaymentsPage } from "./modules/payments/PaymentsPage";
import { RolesTab } from "./modules/employee/components/RolesTab";
import { AttendanceTab } from "./modules/employee/components/AttendanceTab";
import { TeamChat } from "./components/chat/TeamChat";
import { authService, AuthUser } from "./services/authService";
import { LoginPage } from "./pages/LoginPage";
import { API_URL } from "./config/api";

export default function App() {
  // ── ESTADO DE AUTENTICACIÓN CENTRALIZADO ──
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    // Si viene por sesión previa o parámetros de URL
    const searchParams = new URLSearchParams(window.location.search);
    const uId = searchParams.get("userId");
    const uName = searchParams.get("userName");
    const uRol = searchParams.get("userRol") || searchParams.get("idRol");
    const rNom = searchParams.get("rolNombre");

    if (uId && uName) {
      return {
        id_usuario: Number(uId),
        id_rol: Number(uRol) || 1,
        usuario: uName.toLowerCase().replace(/\s+/g, ""),
        nombres: uName.split(" ")[0] || uName,
        apellidos: uName.split(" ").slice(1).join(" ") || "",
        nombreCompleto: uName,
        email: "",
        rol: rNom || "ADMINISTRACION",
        permisos: [],
      };
    }

    return authService.getCurrentUser();
  });

  const [sidebarColapsado, setSidebarColapsado] = useState(false);
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);
  const [avatarImgError, setAvatarImgError] = useState(false);

  // 1. Detección de vista flexible según el hash o parámetro
  const getViewFromLocation = () => {
    const params = new URLSearchParams(window.location.search);
    const paramView = params.get("view") || params.get("modulo") || params.get("tab");
    const hashView = window.location.hash.replace("#", "").split("?")[0];
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
    setCurrentView("login");
  };

  // Si no está autenticado, mostrar la pantalla de Login ejecutiva
  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          // Si es técnico de campo, enviarlo directo a su portal
          if (user.id_rol === 2 || user.rol?.toUpperCase().includes("TECNICO")) {
            window.location.hash = "portal-tecnico";
            setCurrentView("portal-tecnico");
          } else {
            window.location.hash = "dashboard";
            setCurrentView("dashboard");
          }
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
    currentView === "inspecciones" ||
    currentView === "checklist-tecnico";

  const isInventoryView =
    currentView === "almacen" ||
    currentView === "inventario" ||
    currentView === "stock" ||
    currentView === "compras" ||
    currentView === "despacho" ||
    currentView === "recogidos" ||
    currentView === "liquidacion" ||
    currentView === "liquidaciones" ||
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

  const isOrdersView =
    !isPersonalView &&
    !isMobilityView &&
    !isInventoryView &&
    !isSettingsView &&
    !isPaymentsView &&
    !isExecutiveDashboard &&
    !isTechnicianPortal;

  // Lista de Módulos del Sidebar
  const modulosNav = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, activo: isExecutiveDashboard },
    { id: "ordenes", label: "Órdenes", icon: ClipboardList, activo: isOrdersView },
    { id: "portal-tecnico", label: "Portal Técnico", icon: Car, activo: isTechnicianPortal },
    { id: "personal", label: "Personal", icon: Users, activo: isPersonalView },
    { id: "inventario", label: "Inventario", icon: Package, activo: isInventoryView },
    { id: "movilidad", label: "Movilidad", icon: Car, activo: isMobilityView },
    { id: "pagos", label: "Pagos", icon: Coins, activo: isPaymentsView },
    { id: "configuracion", label: "Configuración", icon: Settings, activo: isSettingsView },
  ];

  return (
    <div className="w-full h-screen bg-slate-100 flex overflow-hidden font-sans">
      {/* ─────────────────────────────────────────────────────────────
          🏢 SIDEBAR LATERAL EJECUTIVO (ESTILO SAAS / MODERNO)
      ───────────────────────────────────────────────────────────── */}
      <aside
        className={`${
          sidebarColapsado ? "w-20" : "w-64"
        } bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 transition-all duration-200 border-r border-slate-800 z-30 select-none`}
      >
        <div>
          {/* Logo y Encabezado del Menú */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-teal-400 flex items-center justify-center text-white font-black shrink-0 shadow-md shadow-indigo-500/20">
                <Radio size={20} />
              </div>
              {!sidebarColapsado && (
                <div className="leading-tight truncate">
                  <span className="text-xs font-black text-white uppercase tracking-wider block truncate">
                    Corporación Céspedes
                  </span>
                  <span className="text-[10px] text-teal-400 font-bold tracking-widest uppercase block">
                    Telecomunicaciones
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSidebarColapsado(!sidebarColapsado)}
              className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title={sidebarColapsado ? "Expandir menú" : "Colapsar menú"}
            >
              <Menu size={16} />
            </button>
          </div>

          {/* Menú de Navegación de Módulos */}
          <nav className="p-3 space-y-1.5 overflow-y-auto max-h-[calc(100vh-140px)]">
            <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
              {!sidebarColapsado ? "SISTEMA" : "•••"}
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
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    m.activo
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/70"
                  }`}
                  title={sidebarColapsado ? m.label : undefined}
                >
                  <Icon size={18} className="shrink-0" />
                  {!sidebarColapsado && <span className="truncate">{m.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Perfil del Usuario en la Parte Inferior del Sidebar */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            {currentUser.foto_personal && !avatarImgError ? (
              <img
                src={`${API_URL}/uploads/${currentUser.foto_personal}`}
                alt={userName}
                className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0"
                onError={() => setAvatarImgError(true)}
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-black text-xs shrink-0 uppercase">
                {userName.slice(0, 2)}
              </div>
            )}

            {!sidebarColapsado && (
              <div className="min-w-0 flex-1 leading-tight">
                <span className="text-xs font-black text-white truncate block">{userSoloNombres}</span>
                <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider truncate block">
                  {rolNombre}
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          ÁREA PRINCIPAL DE CONTENIDO + TOPBAR CORPORATIVO
      ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* TOPBAR HEADER MODERNO */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
              <span>{modulosNav.find((m) => m.activo)?.label || "Telecom"}</span>
            </span>
          </div>

          {/* Acciones de la Derecha: Notificaciones, Personal Online y Usuario */}
          <div className="flex items-center gap-4">
            {/* Widget de Usuario Estilo Moderno */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuUsuarioAbierto(!menuUsuarioAbierto)}
                className="flex items-center gap-3 py-1.5 px-3 rounded-2xl hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
              >
                <div className="text-right hidden sm:block leading-tight">
                  <span className="text-xs font-black text-slate-900 block truncate max-w-[200px]">
                    {userSoloNombres}
                  </span>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                    {rolNombre}
                  </span>
                </div>

                {currentUser.foto_personal && !avatarImgError ? (
                  <img
                    src={`${API_URL}/uploads/${currentUser.foto_personal}`}
                    alt={userName}
                    className="w-9 h-9 rounded-full object-cover border-2 border-indigo-600 shrink-0 shadow-xs"
                    onError={() => setAvatarImgError(true)}
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-teal-500 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs uppercase">
                    {userName.slice(0, 2)}
                  </div>
                )}

                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {/* Menú Desplegable de Usuario (Solo Cerrar Sesión) */}
              {menuUsuarioAbierto && (
                <div className="absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-1.5 z-[999] animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full px-3 py-2.5 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <LogOut size={16} />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* BARRA DE CHAT DE EQUIPO 24/7 */}
        {!isTechnicianPortal && (
          <TeamChat userId={userId} userName={userName} userRol={userRol} rolNombre={rolNombre} />
        )}

        {/* ─────────────────────────────────────────────────────────────
            VISTAS DE LOS MÓDULOS DE REACT
        ───────────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-hidden flex flex-col min-h-0 bg-slate-100/70">
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
              <PaymentsPage />
            </div>
          )}

          {/* 6. Órdenes de Trabajo */}
          {isOrdersView && (
            <div className="flex-1 w-full overflow-hidden min-h-0 p-2 md:p-3 flex flex-col">
              <OrdersPage />
            </div>
          )}

          {/* 7. Recursos Humanos (Personal) */}
          {isPersonalView && (
            <div className="flex-1 flex w-full min-h-0 overflow-hidden">
              <aside className="w-60 bg-white border-r border-slate-200 p-4 shrink-0 flex flex-col gap-2 shadow-xs overflow-y-auto">
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider text-teal-800 bg-teal-50 rounded-xl border border-teal-200/60 mb-2">
                  <Briefcase size={15} className="text-teal-600" />
                  <span>Personal (RRHH)</span>
                </div>

                <button
                  type="button"
                  onClick={() => setRhTab("directorio")}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
                    rhTab === "directorio"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Users size={16} />
                  <span>Directorio</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRhTab("ficha")}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
                    rhTab === "ficha"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <FileText size={16} />
                  <span>Ficha de Personal</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRhTab("roles")}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
                    rhTab === "roles"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <ShieldCheck size={16} />
                  <span>Roles</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRhTab("asistencias")}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
                    rhTab === "asistencias"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Clock size={16} />
                  <span>Asistencias</span>
                </button>
              </aside>

              <main className="flex-1 p-4 md:p-6 overflow-y-auto min-w-0">
                {rhTab === "directorio" && (
                  <EmployeeList
                    empleados={empleados}
                    onSelectEmployee={handleSeleccionarEmpleado}
                  />
                )}
                {rhTab === "ficha" && (
                  <Dashboard
                    selectedEmpProp={empleadoSeleccionado}
                    onDataUpdated={cargarEmpleados}
                  />
                )}
                {rhTab === "roles" && <RolesTab />}
                {rhTab === "asistencias" && <AttendanceTab />}
              </main>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}