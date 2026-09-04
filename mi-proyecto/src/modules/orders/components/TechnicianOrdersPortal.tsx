import React, { useState, useEffect } from "react";
import {
  FileText,
  MapPin,
  Clock,
  Phone,
  CheckCircle2,
  Navigation,
  Car,
  Package,
  Layers,
  Sparkles,
  RefreshCw,
  LogOut,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Lock,
  User,
  Copy,
  Check,
  TrendingUp,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Order } from "../types/Order";
import { getOrders } from "../services/orderService";
import { getTecnicoStock } from "../../inventory/services/inventoryService";
import { TechnicalActModal } from "./TechnicalActModal";
import { TechnicianChecklistModal } from "../../mobility/components/TechnicianChecklistModal";
import { TechnicianDashboardTab } from "./TechnicianDashboardTab";
import { registrarLogGps } from "../../mobility/services/mobilityService";
import { extractCuadrillaKey } from "../utils/cuadrillaUtils";
import axios from "axios";
import { API_URL } from "../../../config/api";

interface Props {
  userId?: string | number;
  userName?: string;
  userRol?: string;
}

export const TechnicianOrdersPortal: React.FC<Props> = ({ userId, userName, userRol }) => {
  // Solo se muestra el selector de cambio de técnico en modo prueba (sin userId) o si es Administrador (Rol 1)
  const esAdminOSimulador = !userId || userRol === "1" || String(userRol).toLowerCase().includes("admin");
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [trabajadorActual, setTrabajadorActual] = useState<any>(null);
  const [ordenes, setOrdenes] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [vistaActual, setVistaActual] = useState<"hoy" | "dashboard">("hoy");
  const [copiadoMsg, setCopiadoMsg] = useState<string | null>(null);

  const copiarAlPortapapeles = (texto?: string, label?: string) => {
    if (!texto) return;
    navigator.clipboard.writeText(texto.trim());
    setCopiadoMsg(`¡${label || "Texto"} copiado!`);
    setTimeout(() => setCopiadoMsg(null), 2000);
  };

  // Modales
  const [ordenParaActa, setOrdenParaActa] = useState<Order | null>(null);
  const [mostrarChecklist, setMostrarChecklist] = useState(false);
  const [mostrarStock, setMostrarStock] = useState(false);
  const [permiteVerStock, setPermiteVerStock] = useState(true);

  // Stock en Carro
  const [miStock, setMiStock] = useState<any[]>([]);
  const [misSeries, setMisSeries] = useState<any[]>([]);
  const [cargandoStock, setCargandoStock] = useState(false);

  // Vehículo asignado
  const [vehiculoAsignado, setVehiculoAsignado] = useState<any>(null);

  // Estado para expandir/ocultar dirección por orden
  const [direccionesVisibles, setDireccionesVisibles] = useState<Record<string | number, boolean>>({});
  const [isFullScreen, setIsFullScreen] = useState(false);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullScreen(false);
    }
  };

  const toggleDireccion = (orderId: string | number) => {
    setDireccionesVisibles((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  // 📱 MANEJADORES DE NAVEGACIÓN (Para que el botón "Atrás" del celular cierre modales en vez de salir de la web)
  const abrirActa = (ord: Order) => {
    window.history.pushState({ modal: "acta" }, "");
    setOrdenParaActa(ord);
  };

  const abrirChecklist = () => {
    window.history.pushState({ modal: "checklist" }, "");
    setMostrarChecklist(true);
  };

  const alternarStock = () => {
    if (!mostrarStock) {
      window.history.pushState({ modal: "stock" }, "");
      setMostrarStock(true);
    } else {
      setMostrarStock(false);
    }
  };

  const cambiarVista = (vista: "hoy" | "dashboard") => {
    if (vista === "dashboard") {
      window.history.pushState({ tab: "dashboard" }, "");
    }
    setVistaActual(vista);
  };

  // 📱 INTERCEPTOR DEL BOTÓN "ATRÁS" DEL CELULAR (Hardware / Gesture Back Button)
  useEffect(() => {
    // Empujar estado inicial para que el primer botón "atrás" no cierre la página
    window.history.pushState({ page: "portal-tecnico" }, "", window.location.href);

    const handlePopState = () => {
      // 1. Si el modal de Acta WIN está abierto, cerrarlo
      if (ordenParaActa) {
        setOrdenParaActa(null);
        return;
      }
      // 2. Si el Checklist diario está abierto, cerrarlo
      if (mostrarChecklist) {
        setMostrarChecklist(false);
        return;
      }
      // 3. Si el desplegable de stock está abierto, cerrarlo
      if (mostrarStock) {
        setMostrarStock(false);
        return;
      }
      // 4. Si está en Dashboard, volver a Hoy
      if (vistaActual === "dashboard") {
        setVistaActual("hoy");
        return;
      }

      // 5. Si ya está en la pantalla principal sin modales abiertos:
      // Re-empujamos el estado para evitar que el botón atrás del celular lo saque de la web
      window.history.pushState({ page: "portal-tecnico" }, "", window.location.href);
      setCopiadoMsg("ℹ️ Para salir de la app, usa la opción de Cerrar Sesión");
      setTimeout(() => setCopiadoMsg(null), 2500);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [ordenParaActa, mostrarChecklist, mostrarStock, vistaActual]);

  // 1. Cargar Técnicos & Asociar Usuario Actual
  useEffect(() => {
    axios
      .get(`${API_URL}/api/movilidad/tecnicos`)
      .then((res) => {
        setTecnicos(res.data);
        if (res.data.length > 0) {
          let matched = null;
          // Prioridad 0: Parámetro URL explícito (ej: ?tecnico=65 o #portal-tecnico?tecnico=65)
          const searchParams = new URLSearchParams(window.location.search || "");
          const hashQuery = window.location.hash.includes("?") ? window.location.hash.split("?")[1] : "";
          const hashParams = new URLSearchParams(hashQuery);
          const paramTech = searchParams.get("tecnico") || searchParams.get("tech") || searchParams.get("id") || hashParams.get("tecnico") || hashParams.get("tech") || hashParams.get("id");

          if (paramTech) {
            matched = res.data.find((t: any) =>
              String(t.id_usuario) === String(paramTech) ||
              String(t.id_trabajador) === String(paramTech) ||
              (t.nombre_completo || "").toLowerCase().includes(paramTech.toLowerCase())
            );
          }

          // Prioridad 1: Match EXACTO por id_usuario (Clave primaria única de usuarios)
          if (!matched && userId) {
            matched = res.data.find((t: any) => String(t.id_usuario) === String(userId));
          }
          // Prioridad 2: Match por nombre de usuario o cuadrilla
          if (!matched && userName) {
            const uNameClean = userName.toLowerCase().trim();
            matched = res.data.find((t: any) => {
              const fullClean = (t.nombre_completo || "").toLowerCase();
              return (
                fullClean === uNameClean ||
                fullClean.includes(uNameClean) ||
                (t.cuadrilla && t.cuadrilla.toLowerCase().includes(uNameClean))
              );
            });
          }

          if (matched) {
            setTrabajadorActual(matched);
          } else if (userId || userName) {
            // Usuario con sesión pero sin cuadrilla o vehículo asignado
            setTrabajadorActual({
              id_usuario: Number(userId) || 0,
              nombre_completo: userName || "Técnico de Campo",
              cuadrilla: "",
              vehiculo_placa: "",
            });
          } else {
            setTrabajadorActual(res.data[0]);
          }
        }
      })
      .catch(console.error);
  }, [userId, userName]);

  // 2. Cargar datos del técnico y sus órdenes de trabajo de HOY
  const cargarDatosTecnico = () => {
    if (!trabajadorActual) return;
    setLoading(true);

    if (trabajadorActual.vehiculo_placa) {
      setVehiculoAsignado({
        id_vehiculo: trabajadorActual.id_vehiculo,
        placa: trabajadorActual.vehiculo_placa,
        marca: trabajadorActual.vehiculo_marca,
        modelo: trabajadorActual.vehiculo_modelo,
      });
    }

    // Fecha de hoy en hora local (YYYY-MM-DD)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    getOrders({ fechaDesde: todayStr, fechaHasta: todayStr })
      .then((allOrders) => {
        const targetId = Number(trabajadorActual.id_usuario || trabajadorActual.id_trabajador);
        const targetName = (trabajadorActual.nombre_completo || "").toLowerCase().trim();

        const misOrdenes = allOrders.filter((ord) => {
          // 1. Filtrar estrictamente por fecha de hoy
          const fechaOrd = (ord.fecha || "").slice(0, 10);
          if (fechaOrd && fechaOrd !== todayStr) return false;

          // 2. Filtrar por ID de técnico (Titular T1 o Acompañante T2)
          const ordId1 = Number(ord.idTecnico);
          const ordId2 = Number(ord.idTecnicoReemplazo);

          if (targetId && (ordId1 === targetId || ordId2 === targetId)) {
            return true;
          }

          // Fallback por coincidencia de nombre exacto si el ID no vino poblado en la orden
          const tecName = (ord.tecnico || "").toLowerCase();
          if (targetName && tecName && (tecName === targetName || tecName.includes(targetName))) {
            return true;
          }

          return false;
        });

        setOrdenes(misOrdenes);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    setCargandoStock(true);
    getTecnicoStock(trabajadorActual.id_trabajador)
      .then((res) => {
        if (res && res.permitido === false) {
          setPermiteVerStock(false);
          setMostrarStock(false);
        } else {
          setPermiteVerStock(true);
        }
        // Siempre almacenamos los materiales y series para que el modal de liquidación pueda descontar
        setMiStock(res.materiales || []);
        setMisSeries(res.seriesAsignadas || []);
      })
      .catch(console.error)
      .finally(() => setCargandoStock(false));
  };

  useEffect(() => {
    cargarDatosTecnico();
  }, [trabajadorActual]);

  // 📍 RASTREO GPS AUTOMÁTICO DISCRETO EN SEGUNDO PLANO (MIGAS DE PAN CADA 5 MINUTOS)
  useEffect(() => {
    if (!trabajadorActual?.id_trabajador || !navigator.geolocation) return;

    // Primer ping al abrir el portal
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        registrarLogGps({
          id_trabajador: trabajadorActual.id_trabajador,
          id_vehiculo: vehiculoAsignado?.id_vehiculo,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          tipo_evento: "APP_OPEN",
          descripcion: `Portal abierto por técnico ${trabajadorActual.nombre_completo}`,
        });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 5000 }
    );

    // Temporizador periódico de migas de pan
    const interval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          registrarLogGps({
            id_trabajador: trabajadorActual.id_trabajador,
            id_vehiculo: vehiculoAsignado?.id_vehiculo,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            tipo_evento: "APP_PING",
            descripcion: "Punto de recorrido en ruta",
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [trabajadorActual, vehiculoAsignado]);

  const getPortalStatusBadge = (status?: string) => {
    const s = (status || "").toUpperCase().trim();
    // 🔵 Celeste: Finalizada, Liquidada, Fenix, Cerrada
    if (s.includes("FINALIZ") || s.includes("LIQUID") || s.includes("TERMIN") || s.includes("CERRAD") || s.includes("FENIX")) {
      return "bg-sky-50 text-sky-800 border border-sky-300";
    }
    // 🟢 Verde: Iniciada, En proceso, Proceso, Inicio
    if (s.includes("INICIAD") || s.includes("PROCESO")) {
      return "bg-emerald-50 text-emerald-800 border border-emerald-300";
    }
    // 🟡 Amarillo: Cancelada, Regestión, Observada, Anulada
    if (s.includes("CANCELAD") || s.includes("OBSERVAD") || s.includes("REGESTION") || s.includes("ANULAD") || s.includes("SUSPENDID")) {
      return "bg-yellow-100 text-yellow-900 border border-yellow-300";
    }
    // ⚪ Gris: Agendada, Asignada, En camino, Pendiente
    return "bg-slate-100 text-slate-700 border border-slate-300";
  };

  const extraerCoordenadas = (order?: Order, direccion?: string): { lat: string; lng: string } | null => {
    // 1. Probar campo georeferencia directo (ej. "-12.3644620,-76.7952380")
    const georef = (order?.georeferencia || "").trim();
    if (georef && georef.includes(",")) {
      const parts = georef.split(",").map((s) => s.trim());
      if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
        return { lat: parts[0], lng: parts[1] };
      }
    }

    // 2. Extraer coordenadas dentro del texto de la dirección o referencias (ej: "-12.16199169, -76.95221459")
    const fullText = `${direccion || ""} ${order?.direccion || ""} ${order?.observacionesAtencion || ""}`;
    const match = fullText.match(/(-?\d{1,2}\.\d{4,8})\s*,\s*(-?\d{1,3}\.\d{4,8})/);
    if (match && !isNaN(Number(match[1])) && !isNaN(Number(match[2]))) {
      return { lat: match[1], lng: match[2] };
    }

    return null;
  };

  const abrirWazeOMaps = (direccion: string, distrito: string, order?: Order) => {
    // 1. Guardar log GPS exacto en el momento que el técnico abre el GPS
    if (trabajadorActual?.id_trabajador && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          registrarLogGps({
            id_trabajador: trabajadorActual.id_trabajador,
            id_vehiculo: vehiculoAsignado?.id_vehiculo,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            tipo_evento: "GPS_CLICK_ORDEN",
            referencia_id: String(order?.ticket || order?.id || ""),
            descripcion: `Rumbo a cliente: ${order?.cliente || "Cliente"} (${distrito})`,
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 4000 }
      );
    }

    // 2. Abrir Google Maps con coordenadas satelitales exactas
    const coords = extraerCoordenadas(order, direccion);

    if (coords) {
      // Abre directamente la ruta satelital exacta al punto del cliente en Lima, Perú
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
      window.open(mapsUrl, "_blank");
    } else {
      // Si no hay coordenadas numéricas, limpiar el texto eliminando referencias largas y piso/interior
      const dirLimpia = (direccion || "")
        .split("||")[0]
        .split("Piso")[0]
        .split("piso")[0]
        .split("dpto")[0]
        .split("Interior")[0]
        .trim();
      const query = encodeURIComponent(`${dirLimpia}, ${distrito}, Lima, Peru`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
    }
  };

  return (
    <div 
      className="min-h-screen bg-slate-100/90 p-3 sm:p-5 max-w-lg mx-auto space-y-4 font-sans text-slate-800"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom, 24px), 140px)",
        paddingTop: "max(env(safe-area-inset-top, 8px), 12px)",
      }}
    >
      
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER MÓVIL DEL TÉCNICO
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-3.5 sm:p-4.5 shadow-xl border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Lado izquierdo: Avatar + Nombre con min-w-0 para evitar empujar la derecha */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 flex items-center justify-center font-black shrink-0">
              <Car size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] sm:text-[10px] uppercase font-bold text-indigo-300 tracking-wider block">
                  Portal de Campo • Técnico
                </span>
                {esAdminOSimulador && tecnicos.length > 1 && (
                  <select
                    value={trabajadorActual?.id_usuario || ""}
                    onChange={(e) => {
                      const sel = tecnicos.find((t: any) => String(t.id_usuario) === String(e.target.value));
                      if (sel) {
                        setTrabajadorActual(sel);
                      }
                    }}
                    className="bg-indigo-900/60 text-amber-300 text-[10px] font-bold rounded-lg px-1.5 py-0.5 border border-indigo-400/40 cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-400"
                    title="Cambiar técnico de prueba (Solo Administrador / Modo Prueba)"
                  >
                    {tecnicos.map((t: any) => (
                      <option key={t.id_usuario} value={t.id_usuario} className="bg-slate-900 text-white">
                        🔄 Probar: {t.nombre_completo}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <h1 className="text-xs sm:text-sm font-black text-white truncate">
                {trabajadorActual?.nombre_completo || "Técnico de Campo"}
              </h1>
            </div>
          </div>

          {/* Lado derecho: Botón fullscreen + Placa compacta protegida con shrink-0 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleFullScreen}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-indigo-200 border border-white/15 text-xs font-bold flex items-center justify-center cursor-pointer transition-all shrink-0"
              title={isFullScreen ? "Salir de pantalla completa" : "Pantalla completa (Modo App)"}
            >
              {isFullScreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>

            <span className="px-2 py-1 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[11px] font-mono font-bold whitespace-nowrap shrink-0">
              🚗 {trabajadorActual?.vehiculo_placa || "Sin auto"}
            </span>
          </div>
        </div>

        {(ordenes.length > 0 && ordenes[0]?.cuadrilla) || trabajadorActual?.cuadrilla ? (
          <div className="pt-0.5">
            <span className="text-[10px] sm:text-[11px] font-bold text-indigo-200 bg-indigo-900/40 px-2.5 py-1 rounded-xl border border-indigo-400/20 inline-block truncate max-w-full">
              📍 Cuadrilla: {(() => {
                if (ordenes.length > 0 && ordenes[0]?.cuadrilla) {
                  const key = extractCuadrillaKey(ordenes[0].cuadrilla);
                  if (key) return key;
                }
                const c = (trabajadorActual?.cuadrilla || "").trim();
                const n = (trabajadorActual?.nombre_completo || "").trim();
                let clean = c;
                if (n && clean.toUpperCase().includes(n.toUpperCase())) {
                  clean = clean.replace(new RegExp(n, "gi"), "").trim();
                } else if (n) {
                  n.split(" ").forEach((p: string) => {
                    if (p.length >= 3) {
                      clean = clean.replace(new RegExp(`\\b${p}\\b`, "gi"), "").trim();
                    }
                  });
                }
                clean = clean.replace(/\s+/g, " ").replace(/^[-–—:\s]+|[-–—:\s]+$/g, "").trim();
                return clean || c || "Sin cuadrilla";
              })()}
            </span>
          </div>
        ) : null}

        {/* Acciones Rápidas del Técnico: 1 columna si solo está checklist, 2 si tiene stock */}
        <div className={`grid gap-2 pt-0.5 ${permiteVerStock ? "grid-cols-2" : "grid-cols-1"}`}>
          <button
            onClick={abrirChecklist}
            className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-2xl font-black text-xs shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileText size={15} />
            Checklist Diario
          </button>

          {permiteVerStock && (
            <button
              onClick={alternarStock}
              className={`w-full py-2.5 px-3 rounded-2xl font-bold text-xs border transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                mostrarStock
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30"
                  : "bg-white/10 hover:bg-white/20 text-white border-white/15"
              }`}
            >
              <Package size={15} />
              Mi Stock ({miStock.filter((m) => (m.categoria || "").toUpperCase() === "MATERIALES").length + misSeries.filter((s) => !s.equipo_nombre?.toUpperCase().includes("ACTA") && !s.categoria?.toUpperCase().includes("TALONARIO")).length})
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. DESGLOSE DE MI STOCK: MATERIALES & EQUIPOS CON SERIES EN CARRO
      ───────────────────────────────────────────────────────────── */}
      {permiteVerStock && mostrarStock && (
        <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm space-y-3.5 animate-fade-in text-xs">
          
          {/* Cabecera del Stock */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-black text-slate-900 flex items-center gap-1.5">
              <Package size={16} className="text-indigo-600" />
              Stock Asignado en mi Camioneta:
            </span>
            <button
              onClick={() => setMostrarStock(false)}
              className="text-[11px] text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
            >
              Ocultar
            </button>
          </div>

          {(() => {
            const materialesSolamente = miStock.filter((m) => {
              const c = (m.categoria || "").toUpperCase();
              return c === "MATERIALES" || (!c.includes("HERRAMIENTA") && !c.includes("UNIFORME") && !c.includes("VEHICULO") && !c.includes("TALONARIO") && !c.includes("EQUIPO"));
            });

            const equiposSeriesSolamente = misSeries.filter((s) => {
              const nom = (s.equipo_nombre || "").toUpperCase();
              const cat = (s.categoria || "").toUpperCase();
              return !nom.includes("ACTA") && !cat.includes("TALONARIO") && !cat.includes("HERRAMIENTA");
            });

            // Agrupar equipos por modelo
            const equiposAgrupados = equiposSeriesSolamente.reduce((acc: Record<string, any[]>, curr: any) => {
              const modelo = curr.equipo_nombre || "Equipo";
              if (!acc[modelo]) acc[modelo] = [];
              acc[modelo].push(curr);
              return acc;
            }, {});

            if (cargandoStock) {
              return (
                <div className="py-4 text-center text-slate-400 font-bold text-xs flex items-center justify-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-indigo-600" />
                  Cargando stock en vehículo...
                </div>
              );
            }

            if (materialesSolamente.length === 0 && equiposSeriesSolamente.length === 0) {
              return (
                <div className="py-4 text-center text-slate-400 font-semibold text-xs space-y-1">
                  <Package size={24} className="mx-auto text-slate-300" />
                  <p>No tienes materiales ni equipos asignados en tu camioneta actualmente.</p>
                </div>
              );
            }

            return (
              <div className="space-y-4">
                
                {/* SECCIÓN A: MATERIALES CONSUMIBLES */}
                {materialesSolamente.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers size={13} className="text-indigo-600" />
                        <span>Insumos & Materiales ({materialesSolamente.length}):</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {materialesSolamente.map((m, i) => (
                        <div key={i} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between hover:border-indigo-300 transition-colors">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] text-slate-700 font-extrabold truncate" title={m.nombre}>
                              {m.nombre}
                            </span>
                            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
                              MATERIAL
                            </span>
                          </div>
                          <span className="text-base font-black text-slate-900 font-mono">
                            {m.stock} {m.es_drop ? "m" : "und"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SECCIÓN B: EQUIPOS SERIALIZADOS (ONT, MESH, DECOS) */}
                {equiposSeriesSolamente.length > 0 && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                        <Package size={13} className="text-emerald-600" />
                        <span>Equipos con Series ({equiposSeriesSolamente.length} unidades en mano):</span>
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {Object.entries(equiposAgrupados).map(([nombreEquipo, seriesList]: [string, any[]], idx) => (
                        <div key={idx} className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-xs text-emerald-950 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                              <span>{nombreEquipo}</span>
                            </span>
                            <span className="text-[10px] font-black font-mono px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200">
                              {seriesList.length} und
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {seriesList.map((s: any, sIdx: number) => (
                              <button
                                key={sIdx}
                                type="button"
                                onClick={() => copiarAlPortapapeles(s.numero_serie, "Serie del Equipo")}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-emerald-300 hover:border-emerald-500 text-emerald-950 rounded-xl font-mono text-[11px] font-bold shadow-2xs cursor-pointer transition-all active:scale-95 group"
                                title="Toca para copiar serie"
                              >
                                <span>{s.numero_serie}</span>
                                <Copy size={11} className="text-emerald-400 group-hover:text-emerald-700 transition-colors" />
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            );
          })()}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SELECTOR DE PESTAÑAS: ÓRDENES DE HOY vs MI DASHBOARD
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-1.5 bg-slate-200/90 p-1.5 rounded-2xl border border-slate-300/60 shadow-2xs">
        <button
          type="button"
          onClick={() => cambiarVista("hoy")}
          className={`py-2 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            vistaActual === "hoy"
               ? "bg-white text-indigo-950 shadow-sm"
               : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Clock size={14} className={vistaActual === "hoy" ? "text-indigo-600" : "text-slate-400"} />
          <span>Órdenes de Hoy ({ordenes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => cambiarVista("dashboard")}
          className={`py-2 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            vistaActual === "dashboard"
              ? "bg-white text-indigo-950 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <TrendingUp size={14} className={vistaActual === "dashboard" ? "text-indigo-600" : "text-slate-400"} />
          <span>Mi Dashboard</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          VISTA 1: ÓRDENES DE HOY
      ───────────────────────────────────────────────────────────── */}
      {vistaActual === "hoy" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="font-black text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} className="text-indigo-600" />
              Mis Órdenes de Hoy ({ordenes.length})
            </span>
            <button
              onClick={cargarDatosTecnico}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {ordenes.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center text-slate-400 border border-slate-200 font-bold text-xs space-y-2">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
              <p>¡No tienes órdenes pendientes asignadas para hoy!</p>
            </div>
          ) : (
            ordenes.map((ord) => {
              const s = (ord.status || "").toUpperCase().trim();
              const isFinalizada = s.includes("FINALIZ") || s.includes("LIQUID") || s.includes("TERMIN") || s.includes("CERRAD") || s.includes("FENIX");
              const esReiterada = Boolean(ord.esReiterada || (ord.totalOrdenesCliente && ord.totalOrdenesCliente > 1));
              // Tipo de liquidación / motivo de finalización
              const tipoLiq = (ord.tipoLiquidacion || ord.motivoLiquidacion || ord.motivoFinalizacion || ord.tipoTrabajo || "").trim();
              // Solo mostrar tipo de liquidación/trabajo si existe y la orden está finalizada (o tiene liquidación real)
              const mostrarTipoLiq = isFinalizada && tipoLiq && tipoLiq !== "-";

              return (
                <div
                  key={ord.id}
                  className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-xs space-y-2.5 hover:border-indigo-300 transition-all"
                >
                  {/* Fila Principal: Cliente + Badge de Estado */}
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      
                      {/* Nombre del Cliente */}
                      <button
                        type="button"
                        onClick={() => copiarAlPortapapeles(ord.cliente, "Nombre del Cliente")}
                        className="text-left group cursor-pointer flex-1 min-w-0"
                        title="Toca para copiar nombre del cliente"
                      >
                        <div className="flex items-start gap-1.5">
                          <User size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                          <h3 className="font-extrabold text-sm text-slate-900 leading-snug group-hover:text-indigo-700 transition-colors break-words">
                            {ord.cliente || "Cliente"}
                          </h3>
                        </div>
                      </button>

                      {/* Badges: Reiterada + Estado */}
                      <div className="flex items-center gap-1 shrink-0">
                        {esReiterada && (
                          <span className="text-[9px] font-black text-rose-700 font-sans bg-rose-100 px-2 py-0.5 rounded-md border border-rose-300 shadow-2xs">
                            🚨 REITERADA
                          </span>
                        )}

                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 ${getPortalStatusBadge(ord.status)}`}
                        >
                          {ord.status || "Agendada"}
                        </span>
                      </div>
                    </div>

                    {/* DNI y Teléfono */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium pl-5">
                      {ord.dni ? (
                        <button
                          type="button"
                          onClick={() => copiarAlPortapapeles(ord.dni, "DNI")}
                          className="hover:text-indigo-600 cursor-pointer transition-colors"
                          title="Toca para copiar DNI"
                        >
                          DNI: <strong className="text-slate-800 font-mono underline decoration-dotted">{ord.dni}</strong>
                        </button>
                      ) : (
                        <span>DNI: <strong className="text-slate-700 font-mono">-</strong></span>
                      )}
                      {ord.celular && (
                        <span>
                          • Tel: <a href={`tel:${ord.celular}`} className="text-indigo-600 font-mono font-bold hover:underline">{ord.celular}</a>
                        </span>
                      )}
                    </div>

                    {/* Fila Dedicada: Tipo de Liquidación de la Orden */}
                    {mostrarTipoLiq && (
                      <div className="mt-1 p-2 bg-sky-50/90 rounded-xl border border-sky-200 text-sky-950 flex items-center justify-between gap-2 text-xs font-bold shadow-2xs">
                        <span className="flex items-center gap-1.5 truncate">
                          <Sparkles size={13} className="text-sky-600 shrink-0" />
                          <span className="text-[10px] uppercase font-black text-sky-700 tracking-wider">Tipo Liq:</span>
                          <span className="truncate">{tipoLiq}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 3. Dirección Oculta con Botón para Expandir/Ocultar con un solo clic */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => toggleDireccion(ord.id)}
                      className={`w-full py-2 px-3 rounded-2xl flex items-center justify-between text-xs font-bold transition-all cursor-pointer border ${
                        direccionesVisibles[ord.id]
                          ? "bg-indigo-50/70 border-indigo-200 text-indigo-950"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <MapPin size={15} className={direccionesVisibles[ord.id] ? "text-indigo-600" : "text-rose-500"} />
                        <span className="truncate max-w-[200px] sm:max-w-xs">
                          {direccionesVisibles[ord.id] ? "Ocultar Dirección" : `Ver Dirección (${ord.distrito || "Ubicación"})`}
                        </span>
                      </span>
                      <span className="text-[10px] font-black text-indigo-700 bg-white border border-indigo-200/60 px-2 py-0.5 rounded-lg shadow-2xs">
                        {direccionesVisibles[ord.id] ? "Ocultar ▲" : "Ver 📍 ▼"}
                      </span>
                    </button>

                    {direccionesVisibles[ord.id] && (
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/90 flex items-center justify-between gap-2 text-xs animate-fade-in">
                        <button
                          type="button"
                          onClick={() => copiarAlPortapapeles(`${ord.direccion}, ${ord.distrito}`, "Dirección")}
                          className="flex items-start gap-2 min-w-0 flex-1 text-left cursor-pointer group"
                          title="Toca para copiar dirección"
                        >
                          <MapPin size={15} className="text-rose-500 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-slate-800 block text-xs group-hover:text-indigo-600 transition-colors">
                              {ord.direccion}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">{ord.distrito}</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => abrirWazeOMaps(ord.direccion || "", ord.distrito || "", ord)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[11px] flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95"
                        >
                          <Navigation size={13} />
                          GPS
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 4. Botón Principal: Llenar Acta WIN / Liquidar (Habilitado SOLO cuando está Finalizada) */}
                  {isFinalizada ? (
                    <button
                      onClick={() => abrirActa(ord)}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-black text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      <FileText size={16} />
                      <span>📝 Llenar Acta WIN & Liquidar Materiales</span>
                    </button>
                  ) : (
                    <div
                      className="w-full py-2.5 px-4 bg-slate-100 border border-slate-200 text-slate-400 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed select-none"
                      title="La orden debe estar en estado Finalizada para registrar el Acta WIN y liquidar materiales"
                    >
                      <Lock size={15} className="text-slate-400" />
                      <span>🔒 Liquidación habilitada al finalizar ({ord.status || "En proceso"})</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VISTA 2: MI DASHBOARD (DÍAS, SEMANAS, MESES)
      ───────────────────────────────────────────────────────────── */}
      {vistaActual === "dashboard" && (
        <TechnicianDashboardTab
          trabajador={trabajadorActual}
          onSelectOrderForActa={(ord) => abrirActa(ord)}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. MODAL DEL ACTA WIN DIGITAL
      ───────────────────────────────────────────────────────────── */}
      {ordenParaActa && (
        <TechnicalActModal
          order={ordenParaActa}
          idTrabajadorActual={trabajadorActual?.id_trabajador}
          onClose={() => setOrdenParaActa(null)}
          onSuccess={() => {
            setOrdenParaActa(null);
            cargarDatosTecnico();
          }}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. MODAL DE CHECKLIST DIARIO
      ───────────────────────────────────────────────────────────── */}
      {mostrarChecklist && (
        <TechnicianChecklistModal
          idTrabajadorInicial={trabajadorActual?.id_trabajador}
          idVehiculoInicial={trabajadorActual?.id_vehiculo}
          nombreTecnicoInicial={trabajadorActual?.nombre_completo}
          onClose={() => setMostrarChecklist(false)}
          onSuccess={() => {
            setMostrarChecklist(false);
            cargarDatosTecnico();
          }}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. TOAST NOTIFICACIÓN COPIADO AL PORTAPAPELES
      ───────────────────────────────────────────────────────────── */}
      {copiadoMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-950 text-emerald-400 text-xs font-black px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-800 flex items-center gap-2 animate-bounce select-none">
          <Check size={15} className="text-emerald-400" />
          <span>{copiadoMsg}</span>
        </div>
      )}

    </div>
  );
};
export default TechnicianOrdersPortal;
