import { useState, useEffect } from "react";
import { OrdersPage } from "./modules/orders/OrdersPage";
import { EmployeeList } from "./components/employee/EmployeeList";
import Dashboard from "./pages/Dashboard";
import { getEmpleados } from "./services/employeeService";
import { Employee } from "./components/employee/Employee";
import { Users, FileText, Briefcase, RefreshCw, Car, ClipboardList, Package } from "lucide-react";
import { MobilityPage } from "./modules/mobility/MobilityPage";
import { InventoryPage } from "./modules/inventory/InventoryPage";
import { TechnicianOrdersPortal } from "./modules/orders/components/TechnicianOrdersPortal";
import { ExecutiveDashboardPage } from "./modules/dashboard/ExecutiveDashboardPage";
import { TeamChat } from "./components/chat/TeamChat";
import { API_URL } from "./config/api";

export default function App() {
  // 1. Detección de vista flexible según el hash o parámetro (?view=... o #...)
  const getViewFromLocation = () => {
    const params = new URLSearchParams(window.location.search);
    const paramView = params.get("view") || params.get("modulo") || params.get("tab");
    const hashView = window.location.hash.replace("#", "").split("?")[0];
    return hashView || paramView || "ordenes";
  };

  const [currentView, setCurrentView] = useState<string>(getViewFromLocation);

  // Detección de modo independiente (para pruebas directas en navegador)
  const isStandalone = typeof window !== "undefined" && window.self === window.top;

  // Parámetros de sesión pasados por URL
  const searchParams = new URLSearchParams(window.location.search);
  const userId = searchParams.get("userId") || undefined;
  const userName = searchParams.get("userName") || undefined;
  const userRol = searchParams.get("userRol") || searchParams.get("idRol") || "";
  const rolNombre = searchParams.get("rolNombre") || "";

  // 🔒 CHAT DE EQUIPO EXCLUSIVO: Solo Administrador (id_rol = 1) y Recursos Humanos (id_rol = 5)
  const canAccessChat =
    userRol === "1" ||
    userRol === "5" ||
    rolNombre.toUpperCase().includes("ADMIN") ||
    rolNombre.toUpperCase().includes("RECURSO") ||
    rolNombre.toUpperCase().includes("RRHH");

  // 2. Sub-pestaña activa dentro de Recursos Humanos (Directorio o Ficha/Dashboard)
  const [rhTab, setRhTab] = useState<"directorio" | "ficha">("directorio");

  const [empleados, setEmpleados] = useState<Employee[]>([]);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<Employee | null>(null);

  // Escuchar cambios de hash o popstate en la URL
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentView(getViewFromLocation());
    };

    window.addEventListener("hashchange", handleLocationChange);
    window.addEventListener("popstate", handleLocationChange);
    return () => {
      window.removeEventListener("hashchange", handleLocationChange);
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  // 🛰️ Detección en vivo de Ubicación / Distrito de Conexión (GPS / IP)
  useEffect(() => {
    const detectLocation = async () => {
      // 1. Intentar Geolocation GPS del navegador
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            localStorage.setItem("user_lat_conexion", String(lat));
            localStorage.setItem("user_lng_conexion", String(lng));

            try {
              const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
              );
              const data = await res.json();
              const dist =
                data.address?.suburb ||
                data.address?.city_district ||
                data.address?.town ||
                data.address?.county ||
                data.address?.city ||
                "Lima";
              localStorage.setItem("user_distrito_conexion", dist);
            } catch {}
          },
          async () => {
            // 2. Si rechaza o no tiene GPS (PC escritorio), detectar por IP pública
            try {
              const res = await fetch("https://ipwho.is/");
              const data = await res.json();
              if (data.success && (data.city || data.region)) {
                localStorage.setItem("user_distrito_conexion", data.city || data.region || "Lima");
              }
            } catch {}
          },
          { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
        );
      }
    };
    detectLocation();
  }, []);

  // 🟢 Heartbeat Global de Presencia (mantiene a Abigail, Jack, Almacén y Admin Online con Ubicación)
  useEffect(() => {
    if (!userId && !userName) return;
    const sendPulse = () => {
      fetch(`${API_URL}/api/auditoria/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_usuario: userId || null,
          usuario_nombre: userName || null,
          modulo: currentView.toUpperCase(),
          distrito_conexion: localStorage.getItem("user_distrito_conexion") || null,
          lat_conexion: localStorage.getItem("user_lat_conexion") || null,
          lng_conexion: localStorage.getItem("user_lng_conexion") || null,
        }),
      }).catch(() => {});
    };
    sendPulse();
    const interval = setInterval(() => {
      if (!document.hidden) {
        sendPulse();
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [userId, userName, currentView]);

  // Cargar lista de empleados cuando se entra a Personal
  const cargarEmpleados = async () => {
    try {
      const data = await getEmpleados();
      setEmpleados(data);

      setEmpleadoSeleccionado((prev) => {
        if (!prev) return null;
        const empleadoFresco = data.find((e) => e.id === prev.id);
        return empleadoFresco || prev;
      });
    } catch (err) {
      console.error("Error al cargar empleados:", err);
    }
  };

  useEffect(() => {
    if (currentView === "personal" || currentView === "empleados" || currentView === "general") {
      cargarEmpleados();
    }
  }, [currentView]);

  const handleSeleccionarEmpleado = (emp: Employee) => {
    setEmpleadoSeleccionado(emp);
    setRhTab("ficha");
  };

  // Vistas activas
  const isTechnicianPortal =
    currentView === "portal-tecnico" ||
    currentView === "mis-ordenes" ||
    currentView === "tecnico" ||
    currentView === "formulario-tecnico";

  const isExecutiveDashboard =
    currentView === "dashboard" ||
    currentView === "dashboard-ejecutivo" ||
    currentView === "reportes" ||
    currentView === "auditoria" ||
    currentView === "torre-control";

  const isPersonalView =
    currentView === "personal" || currentView === "empleados" || currentView === "general";

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
    currentView === "productos";

  return (
    <div className="w-full h-screen bg-slate-100/80 flex flex-col overflow-hidden">
      
      {/* ─────────────────────────────────────────────────────────────
          🧭 BARRA DE NAVEGACIÓN RÁPIDA (Solo visible al probar React directo en navegador)
      ───────────────────────────────────────────────────────────── */}
      {isStandalone && (
        <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between border-b border-slate-800 shrink-0 z-50 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>🚀 Modo Vista Directa</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => { window.location.hash = "dashboard"; setCurrentView("dashboard"); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isExecutiveDashboard ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              📊 Dashboard
            </button>
            <button
              onClick={() => { window.location.hash = "ordenes"; setCurrentView("ordenes"); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !isPersonalView && !isMobilityView && !isInventoryView && !isExecutiveDashboard && !isTechnicianPortal
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              📋 Órdenes
            </button>
            <button
              onClick={() => { window.location.hash = "portal-tecnico"; setCurrentView("portal-tecnico"); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isTechnicianPortal ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              🚗 Portal Técnico
            </button>
            <button
              onClick={() => { window.location.hash = "personal"; setCurrentView("personal"); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isPersonalView ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              👥 Personal
            </button>
            <button
              onClick={() => { window.location.hash = "inventario"; setCurrentView("inventario"); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isInventoryView ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              📦 Almacén
            </button>
            <button
              onClick={() => { window.location.hash = "movilidad"; setCurrentView("movilidad"); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isMobilityView ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              🚙 Movilidad
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          💬 BARRA SUPERIOR DE PERSONAL ONLINE Y CHAT DE EQUIPO 24/7
      ───────────────────────────────────────────────────────────── */}
      {!isTechnicianPortal && (
        <TeamChat userId={userId} userName={userName} userRol={userRol} rolNombre={rolNombre} />
      )}

      {/* ─────────────────────────────────────────────────────────────
          0. VISTA EXCLUSIVA MÓVIL DEL TÉCNICO DE CAMPO
      ───────────────────────────────────────────────────────────── */}
      {isTechnicianPortal && (
        <div className="flex-1 w-full overflow-y-auto min-h-0">
          <TechnicianOrdersPortal userId={userId} userName={userName} userRol={userRol} />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          1. VISTA DE MOVILIDAD Y CONTROL DE VEHÍCULOS
      ───────────────────────────────────────────────────────────── */}
      {isMobilityView && !isTechnicianPortal && (
        <div className="flex-1 w-full overflow-y-auto min-h-0 p-3 md:p-6">
          <MobilityPage />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. VISTA DE ALMACÉN & INVENTARIO
      ───────────────────────────────────────────────────────────── */}
      {isInventoryView && !isTechnicianPortal && (
        <div className="flex-1 w-full overflow-y-auto min-h-0">
          <InventoryPage />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. VISTA DE DASHBOARD EJECUTIVO & AUDITORÍA 24/7
      ───────────────────────────────────────────────────────────── */}
      {isExecutiveDashboard && !isTechnicianPortal && (
        <div className="flex-1 w-full overflow-y-auto min-h-0">
          <ExecutiveDashboardPage />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. VISTA DE ÓRDENES DE TRABAJO (PANEL DE ADMINISTRACIÓN)
      ───────────────────────────────────────────────────────────── */}
      {!isPersonalView && !isMobilityView && !isInventoryView && !isExecutiveDashboard && !isTechnicianPortal && (
        <div className="flex-1 w-full overflow-hidden min-h-0 p-2 md:p-3 flex flex-col">
          <OrdersPage />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. VISTA DE RECURSOS HUMANOS (Con menú lateral exclusivo)
      ───────────────────────────────────────────────────────────── */}
      {isPersonalView && (
        <div className="flex-1 flex w-full min-h-0 overflow-hidden">
          
          {/* Barra lateral exclusiva de Recursos Humanos */}
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
          </aside>

          {/* Contenido de Recursos Humanos */}
          <main className="flex-1 p-4 md:p-6 overflow-y-auto min-w-0">
            {rhTab === "directorio" ? (
              <EmployeeList
                empleados={empleados}
                onSelectEmployee={handleSeleccionarEmpleado}
              />
            ) : (
              <Dashboard
                selectedEmpProp={empleadoSeleccionado}
                onDataUpdated={cargarEmpleados}
              />
            )}
          </main>

        </div>
      )}

    </div>
  );
}