import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Order, OrderFilters } from "./types/Order";
import { OrdersToolbar } from "./components/OrdersToolbar";
import { OrdersTable } from "./components/OrdersTable";
import { OrderTasksModal } from "./components/OrderTasksModal";
import { ClientHistoryModal } from "./components/ClientHistoryModal";
import { OrderStatsModal } from "./components/OrderStatsModal";
import { TechnicalActModal } from "./components/TechnicalActModal";
import {
  getOrders,
  getTecnicos,
  getTiposTrabajo,
  updateOrderInconcert,
  updateOrderObservacionLlamada,
  updateOrderObservacionesAtencion,
  updateOrderTecnico,
  updateOrderTipoTrabajo,
  syncOrdersFromWin,
  registrarLogAuditoria,
  TecnicoOption,
  getStoredTasksProgressMap,
  saveTaskProgress,
} from "./services/orderService";
import { extractCuadrillaKey, getUniqueCuadrillas, getUniqueCuadrillasWithOptions, extractCuadrillaMemberName } from "./utils/cuadrillaUtils";
import { deduplicateTechnicians } from "./utils/nameNormalizer";
import { TIPOS_TRABAJO_CATALOGO } from "./utils/tipoTrabajoMapper";
import { API_URL } from "../../config/api";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

/**
 * Obtiene la fecha local actual de Perú (America/Lima) en formato YYYY-MM-DD
 */
const getTodayLocal = (): string => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
};

/**
 * Normaliza el texto de estado eliminando mayúsculas y tildes
 */
const normStatus = (str?: string): string => {
  if (!str) return "";
  return str
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

export const OrdersPage: React.FC = () => {
  const todayStr = useMemo(() => getTodayLocal(), []);

  const [orders, setOrders] = useState<Order[]>([]);
  const [tecnicosList, setTecnicosList] = useState<TecnicoOption[]>([]);
  const [tiposTrabajoList, setTiposTrabajoList] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<string | null>(null);
  const [selectedOrderForStats, setSelectedOrderForStats] = useState<Order | null>(null);
  const [selectedOrderForActa, setSelectedOrderForActa] = useState<Order | null>(null);

  // 🚀 POR DEFECTO: Fechas vacías visualmente (pero consulta el día de hoy por defecto)
  const [filters, setFilters] = useState<OrderFilters>({
    fechaDesde: "",
    fechaHasta: "",
    status: "Todos",
    tecnico: "Todos",
    cuadrilla: "Todos",
    inconcert: "Todos",
    search: "",
  });

  // 🚀 CARGAR DATOS DESDE LA BASE DE DATOS A TRAVÉS DE LA API
  const loadData = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setLoading(true);
      setError(null);

      try {
        const isCustomDateRange = Boolean(filters.fechaDesde || filters.fechaHasta);
        const queryDesde = isCustomDateRange 
          ? (filters.fechaDesde || undefined) 
          : (!filters.search ? todayStr : undefined);
        const queryHasta = isCustomDateRange 
          ? (filters.fechaHasta || undefined) 
          : (!filters.search ? todayStr : undefined);

        const [ordersResult, tecnicosResult, tiposResult] = await Promise.allSettled([
          getOrders({
            fechaDesde: queryDesde,
            fechaHasta: queryHasta,
            search: filters.search ? filters.search.trim() : undefined,
          }),
          getTecnicos(),
          getTiposTrabajo(),
        ]);

        if (ordersResult.status === "fulfilled") {
          setOrders(ordersResult.value);
        } else {
          console.error("Error al cargar órdenes:", ordersResult.reason);
          setError("No se pudo conectar con el servidor para obtener las órdenes.");
        }

        if (tecnicosResult.status === "fulfilled") {
          setTecnicosList(tecnicosResult.value);
        }

        if (tiposResult.status === "fulfilled") {
          setTiposTrabajoList(tiposResult.value);
        }
      } catch (err: any) {
        console.error("Error general al cargar datos de órdenes:", err);
        setError(err?.message || "Error al conectar con la base de datos.");
      } finally {
        setLoading(false);
      }
    },
    [filters.fechaDesde, filters.fechaHasta, filters.search, todayStr]
  );

  // 👤 Datos del usuario / gestor actual desde sesión o URL (con soporte standalone)
  const isStandalone = typeof window !== "undefined" && window.self === window.top;

  const currentUserId = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("userId") || localStorage.getItem("userId") || (isStandalone ? "59" : "");
  }, [isStandalone]);

  const currentUserName = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("userName") || localStorage.getItem("userName") || (isStandalone ? "DANNY ALEJANDRO MAMANI TORRES" : "Gestor de Órdenes");
  }, [isStandalone]);

  const currentRolNombre = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("rolNombre") || localStorage.getItem("rolNombre") || (isStandalone ? "ADMINISTRACION" : "GESTION");
  }, [isStandalone]);

  // 🟢 Heartbeat en vivo para marcar usuario como ONLINE en el Dashboard
  useEffect(() => {
    if (!currentUserId && !currentUserName) return;
    const sendPulse = () => {
      if (document.hidden) return;
      fetch(`${API_URL}/api/auditoria/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_usuario: currentUserId || null,
          usuario_nombre: currentUserName || "Gestor de Órdenes",
          modulo: "ORDENES",
        }),
      }).catch(() => { });
    };
    sendPulse();
    const interval = setInterval(() => {
      if (!document.hidden) {
        sendPulse();
      }
    }, 60000); // ⚡ Cada 60 segundos
    return () => clearInterval(interval);
  }, [currentUserId, currentUserName]);

  // Carga inicial y cuando cambian las fechas o se ejecuta una búsqueda (se trae desde la base de datos)
  useEffect(() => {
    loadData(false);
  }, [filters.fechaDesde, filters.fechaHasta, filters.search]);

  // Recarga periódica segura en tiempo real cada 60s
  useEffect(() => {
    const intervaloOrdenes = setInterval(() => {
      if (!document.hidden) {
        loadData(true);
      }
    }, 60000); // Refresco cada 1 minuto
    return () => clearInterval(intervaloOrdenes);
  }, [loadData]);

  // Lista consolidada y homologada de técnicos (sin duplicados ni errores de tipeo de Fénix)
  const tecnicosDisponibles = useMemo(() => {
    const rawNames: string[] = [];
    const officialNames: string[] = [];

    tecnicosList.forEach((t) => {
      if (t.nombreCompleto && t.nombreCompleto.trim() !== "") {
        officialNames.push(t.nombreCompleto.trim());
      }
    });

    orders.forEach((o) => {
      if (o.tecnico && o.tecnico.trim() !== "") {
        const parts = o.tecnico.split(/\s*[\/,+]\s*|\s+y\s+/i);
        parts.forEach((p) => {
          const trimmed = p.trim();
          if (trimmed && trimmed !== "-" && trimmed !== "-- Seleccione --" && trimmed !== "-- Seleccionar --") {
            rawNames.push(trimmed);
          }
        });
      }
      if (o.cuadrilla) {
        const member = extractCuadrillaMemberName(o.cuadrilla);
        if (member && member.length > 3) {
          rawNames.push(member);
        }
      }
    });

    return deduplicateTechnicians(rawNames, officialNames);
  }, [tecnicosList, orders]);

  // Lista consolidada de tipos de trabajo para el selector del Grid (catálogo oficial de tabla tipos_trabajo)
  const tiposTrabajoDisponibles = useMemo(() => {
    const set = new Set<string>();

    // 1. Tipos cargados directamente desde la tabla MySQL `tipos_trabajo`
    tiposTrabajoList.forEach((tt) => {
      if (tt && tt.trim() !== "") {
        set.add(tt.trim());
      }
    });

    // 2. Tipos de trabajo del catálogo oficial
    TIPOS_TRABAJO_CATALOGO.forEach((t) => set.add(t));

    return Array.from(set);
  }, [tiposTrabajoList]);

  // Lista consolidada de cuadrillas únicas con su técnico formateado (ej: "K 1 CESPEDES - OSCAR PIÑERO OCHOA")
  const cuadrillasDisponibles = useMemo(() => {
    return getUniqueCuadrillasWithOptions(orders);
  }, [orders]);

  // 1. Filtrado base (Fechas + Búsqueda de Texto + Técnico + Cuadrilla + Inconcert)
  const baseFilteredOrders = useMemo(() => {
    const hasSearch = Boolean(filters.search && filters.search.trim().length > 0);

    return orders.filter((order) => {
      // A. Filtro de fecha
      let fechaTabla = (order.fecha || "").trim();
      if (fechaTabla) {
        fechaTabla = fechaTabla.split(" ")[0].split("T")[0];

        if (!filters.fechaDesde && !filters.fechaHasta) {
          if (!hasSearch && fechaTabla !== todayStr) {
            return false;
          }
        } else {
          if (filters.fechaDesde && fechaTabla < filters.fechaDesde) return false;
          if (filters.fechaHasta && fechaTabla > filters.fechaHasta) return false;
        }
      }

      // B. Buscador global de texto
      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        const match =
          (order.ticket || "").toLowerCase().includes(q) ||
          (order.cliente || "").toLowerCase().includes(q) ||
          (order.dni || "").toLowerCase().includes(q) ||
          (order.tecnico || "").toLowerCase().includes(q) ||
          (order.cuadrilla || "").toLowerCase().includes(q) ||
          (order.tipoAveria || "").toLowerCase().includes(q) ||
          (order.distrito || "").toLowerCase().includes(q) ||
          (order.direccion || "").toLowerCase().includes(q) ||
          (order.cto || "").toLowerCase().includes(q) ||
          (order.codigoPedido || "").toLowerCase().includes(q) ||
          (order.ot || "").toLowerCase().includes(q);
        if (!match) return false;
      }

      // C. Filtro Técnico Específico
      if (filters.tecnico && filters.tecnico !== "Todos") {
        if ((order.tecnico || "").trim() !== filters.tecnico.trim()) return false;
      }

      // D. Filtro Cuadrilla Específica (Diferenciando ej: K 5 CESPEDES vs K 5 TRASLADO)
      if (filters.cuadrilla && filters.cuadrilla !== "Todos") {
        const orderCuadKey = extractCuadrillaKey(order.cuadrilla);
        if (orderCuadKey !== filters.cuadrilla) return false;
      }

      // E. Filtro Inconcert
      if (filters.inconcert && filters.inconcert !== "Todos") {
        if (filters.inconcert === "Si" && !order.inconcert) return false;
        if (filters.inconcert === "No" && order.inconcert) return false;
      }

      return true;
    });
  }, [orders, filters.fechaDesde, filters.fechaHasta, filters.search, filters.tecnico, filters.cuadrilla, filters.inconcert, todayStr]);

  // 2. Estadísticas reactivas calculadas dinámicamente sobre los resultados filtrados
  const stats = useMemo(() => {
    let verdes = 0;
    let amarillos = 0;
    let azules = 0;
    let agendadas = 0;

    baseFilteredOrders.forEach((o) => {
      const s = normStatus(o.status);
      if (s.includes("INICIAD") || s.includes("PROCESO")) {
        verdes++;
      } else if (
        s.includes("FINALIZ") ||
        s.includes("LIQUID") ||
        s.includes("TERMIN") ||
        s.includes("CERRAD") ||
        s.includes("FENIX")
      ) {
        azules++;
      } else if (
        s.includes("CANCELAD") ||
        s.includes("OBSERVAD") ||
        s.includes("REGESTION") ||
        s.includes("ANULAD") ||
        s.includes("SUSPENDID")
      ) {
        amarillos++;
      } else {
        // ⚪ Gris: Agendada, Asignada, En camino, Pendiente
        agendadas++;
      }
    });

    return { verdes, azules, amarillos, agendadas };
  }, [baseFilteredOrders]);

  // 3. Filtrado final por Estado / Color (cuando se hace clic en una píldora de color)
  const filteredOrders = useMemo(() => {
    if (!filters.status || filters.status === "Todos") {
      return baseFilteredOrders;
    }

    return baseFilteredOrders.filter((order) => {
      const s = normStatus(order.status);
      if (filters.status === "Verdes") {
        return s.includes("INICIAD") || s.includes("PROCESO");
      }
      if (filters.status === "Azules" || filters.status === "Finalizadas" || filters.status === "Finalizada") {
        return (
          s.includes("FINALIZ") ||
          s.includes("LIQUID") ||
          s.includes("TERMIN") ||
          s.includes("CERRAD") ||
          s.includes("FENIX")
        );
      }
      if (filters.status === "Amarillos") {
        return (
          s.includes("CANCELAD") ||
          s.includes("OBSERVAD") ||
          s.includes("REGESTION") ||
          s.includes("ANULAD") ||
          s.includes("SUSPENDID")
        );
      }
      if (filters.status === "Agendadas" || filters.status === "Agendada") {
        const isVerde = s.includes("INICIAD") || s.includes("PROCESO");
        const isAzul =
          s.includes("FINALIZ") ||
          s.includes("LIQUID") ||
          s.includes("TERMIN") ||
          s.includes("CERRAD") ||
          s.includes("FENIX");
        const isAmarillo =
          s.includes("CANCELAD") ||
          s.includes("OBSERVAD") ||
          s.includes("REGESTION") ||
          s.includes("ANULAD") ||
          s.includes("SUSPENDID");
        return !isVerde && !isAzul && !isAmarillo;
      }
      return normStatus(order.status) === normStatus(filters.status);
    });
  }, [baseFilteredOrders, filters.status]);

  // Alternar Inconcert con persistencia en Base de Datos (Optimizado 0ms)
  const handleToggleInconcert = async (orderId: number) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;
    const nextVal = !targetOrder.inconcert;
    try {
      await updateOrderInconcert(targetOrder.id, nextVal ? "Si" : "No", targetOrder.numeroOrden);
      registrarLogAuditoria({
        id_usuario: currentUserId ? Number(currentUserId) : null,
        usuario_nombre: currentUserName || "Gestor de Órdenes",
        rol_nombre: currentRolNombre,
        modulo: "ORDENES",
        accion: "INCONCERT_TOGGLE",
        id_referencia: targetOrder.ticket || orderId,
        descripcion: `Marcó llamada Inconcert como '${nextVal ? "Sí" : "No"}' en Ticket ${targetOrder.ticket || orderId} (${targetOrder.cliente || "Cliente"})`,
      });
    } catch (err) {
      console.error("Error al actualizar Inconcert en BD:", err);
      targetOrder.inconcert = !nextVal;
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, inconcert: !nextVal } : o))
      );
    }
  };

  // Guardar Observación de Llamada directamente en BD
  const handleUpdateObservacionLlamada = async (orderId: number, value: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, observacionLlamada: value } : o))
    );

    try {
      await updateOrderObservacionLlamada(orderId, value, targetOrder?.numeroOrden);
      if (value && value.trim().length > 0) {
        registrarLogAuditoria({
          id_usuario: currentUserId ? Number(currentUserId) : null,
          usuario_nombre: currentUserName || "Gestor de Órdenes",
          rol_nombre: currentRolNombre,
          modulo: "ORDENES",
          accion: "OBSERVACION_LLAMADA",
          id_referencia: targetOrder?.ticket || orderId,
          descripcion: `Escribió obs. de llamada: "${value.trim()}" en Ticket ${targetOrder?.ticket || orderId}`,
        });
      }
    } catch (err) {
      console.error("Error al guardar Observación de Llamada en BD:", err);
    }
  };

  // Guardar Observaciones de la Atención directamente en BD
  const handleUpdateObservacionesAtencion = async (orderId: number, value: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, observacionesAtencion: value } : o))
    );

    try {
      await updateOrderObservacionesAtencion(orderId, value, targetOrder?.numeroOrden);
    } catch (err) {
      console.error("Error al guardar Observaciones de la Atención en BD:", err);
    }
  };

  // Asignar Técnico (1 o 2 técnicos / Pareja de Cuadrilla) con persistencia en Base de Datos
  const handleAssignTechnician = async (orderId: number, technicianName: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);

    // Si contiene múltiples técnicos (ej: "CARLOS MARRUFO / JUAN PEREZ"), buscar el T1 principal para el id_tecnico
    const firstTechName = technicianName.split(/\s*[\/,+]\s*|\s+y\s+/i)[0]?.trim() || technicianName.trim();
    const targetTech = tecnicosList.find(
      (t) => t.nombreCompleto.toLowerCase().trim() === firstTechName.toLowerCase().trim()
    );

    const newIdTecnico = targetTech?.idTecnico;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
            ...o,
            tecnico: technicianName,
            idTecnico: newIdTecnico,
            cuadrilla: targetTech?.cuadrilla || o.cuadrilla,
          }
          : o
      )
    );

    try {
      await updateOrderTecnico(orderId, technicianName, newIdTecnico, targetOrder?.numeroOrden);
      registrarLogAuditoria({
        id_usuario: currentUserId ? Number(currentUserId) : null,
        usuario_nombre: currentUserName || "Gestor de Órdenes",
        rol_nombre: currentRolNombre,
        modulo: "ORDENES",
        accion: "ASIGNACION_TECNICO",
        id_referencia: targetOrder?.ticket || orderId,
        descripcion: `Asignó técnico/cuadrilla: ${technicianName} en Ticket ${targetOrder?.ticket || orderId}`,
      });
    } catch (err) {
      console.error("Error al asignar técnico en BD:", err);
    }
  };

  // Actualizar Tipo de Trabajo con persistencia en Base de Datos (Mantiene tipoTrabajoAsignado estático)
  const handleUpdateTipoTrabajo = async (orderId: number, tipoTrabajo: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, tipoTrabajo: tipoTrabajo } : o
      )
    );

    try {
      await updateOrderTipoTrabajo(orderId, tipoTrabajo, targetOrder?.numeroOrden);
    } catch (err) {
      console.error("Error al actualizar Tipo de Trabajo en BD:", err);
    }
  };

  // Sincronización manual con Fénix
  const [isSyncingFenix, setIsSyncingFenix] = useState<boolean>(false);
  const isSyncingFenixRef = useRef<boolean>(false);

  const handleSync = useCallback(async () => {
    if (isSyncingFenixRef.current) return;
    isSyncingFenixRef.current = true;
    setIsSyncingFenix(true);
    try {
      // 1. Invoca el scraper en el backend usando el rango seleccionado o por defecto hoy
      const syncDesde = filters.fechaDesde || todayStr;
      const syncHasta = filters.fechaHasta || todayStr;
      await syncOrdersFromWin(syncDesde, syncHasta);
    } catch (err: any) {
      console.error("Aviso al sincronizar Fénix:", err.message);
    } finally {
      // 2. Recarga los datos actualizados desde MySQL según el filtro activo
      await loadData(true);
      isSyncingFenixRef.current = false;
      setIsSyncingFenix(false);
    }
  }, [loadData, filters.fechaDesde, filters.fechaHasta, todayStr]);

  // Estado para el modal de tareas en tiempo real de Fénix
  const [selectedOrderForTasks, setSelectedOrderForTasks] = useState<Order | null>(null);

  // ⚡ Tareas en vivo bajo demanda: el progreso de tareas se carga y persiste orden por orden al interactuar con el modal
  const [tasksProgressMap, setTasksProgressMap] = useState<Record<string, { total: number; done: number; pct: number }>>(
    () => getStoredTasksProgressMap()
  );

  const handleTaskProgressUpdate = useCallback((key: string, progress: { total: number; done: number; pct: number }) => {
    saveTaskProgress(key, progress);
    setTasksProgressMap((prev) => ({
      ...prev,
      [key]: progress,
    }));
  }, []);

  return (
    <div className="w-full h-full flex flex-col min-h-0 gap-2.5 overflow-hidden">
      {/* BARRA DE HERRAMIENTAS Y FILTROS */}
      <div className="shrink-0">
        <OrdersToolbar
          filters={filters}
          onFilterChange={setFilters}
          onSync={handleSync}
          totalCount={baseFilteredOrders.length}
          cuadrillas={cuadrillasDisponibles}
          stats={stats}
        />
      </div>

      {/* MENSAJE DE ERROR / AVISO SI FALLA LA CONEXIÓN */}
      {error && (
        <div className="shrink-0 flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadData()}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 transition-colors"
          >
            <RefreshCw size={12} />
            Reintentar
          </button>
        </div>
      )}

      {/* ESTADO DE CARGA O TABLA PRINCIPAL */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200 shadow-sm gap-3">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-700">
            Cargando órdenes del día ({filters.fechaDesde || todayStr})...
          </p>
          <p className="text-xs text-slate-400">
            Consultando registros en tiempo real en MySQL
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <OrdersTable
            orders={filteredOrders}
            isSearching={Boolean(filters.search && filters.search.trim() !== "")}
            tecnicosDisponibles={tecnicosDisponibles}
            tiposTrabajoDisponibles={tiposTrabajoDisponibles}
            tasksProgressMap={tasksProgressMap}
            onToggleInconcert={handleToggleInconcert}
            onUpdateObservacionLlamada={handleUpdateObservacionLlamada}
            onUpdateObservacionesAtencion={handleUpdateObservacionesAtencion}
            onAssignTechnician={handleAssignTechnician}
            onUpdateTipoTrabajo={handleUpdateTipoTrabajo}
            onViewTasks={(order) => setSelectedOrderForTasks(order)}
            onViewClientHistory={(clientName) => setSelectedClientForHistory(clientName)}
            onViewStats={(order) => setSelectedOrderForStats(order)}
            onOpenLiquidar={(order) => setSelectedOrderForActa(order)}
          />
        </div>
      )}

      {/* MODAL DEL ACTA DE SERVICIO TÉCNICO WIN (AUDITORÍA SOLO LECTURA ADMIN) */}
      {selectedOrderForActa && (
        <TechnicalActModal
          order={selectedOrderForActa}
          readOnly={true}
          onClose={() => setSelectedOrderForActa(null)}
          onSuccess={() => {
            setSelectedOrderForActa(null);
            loadData(true);
          }}
        />
      )}

      {/* MODAL DE HISTORIAL COMPLETO DEL CLIENTE */}
      {selectedClientForHistory && (
        <ClientHistoryModal
          isOpen={Boolean(selectedClientForHistory)}
          onClose={() => setSelectedClientForHistory(null)}
          clientName={selectedClientForHistory}
          orders={orders}
          onViewTasks={(order) => {
            setSelectedOrderForTasks(order);
          }}
        />
      )}

      {/* MODAL DE CONTROL DE TIEMPOS Y GESTIÓN DE CUADRILLA */}
      {selectedOrderForStats && (
        <OrderStatsModal
          isOpen={Boolean(selectedOrderForStats)}
          onClose={() => setSelectedOrderForStats(null)}
          order={selectedOrderForStats}
          allOrders={orders}
          initialTasksProgress={tasksProgressMap}
          onViewTasks={(order) => {
            setSelectedOrderForTasks(order);
          }}
        />
      )}

      {/* MODAL DE TAREAS EN TIEMPO REAL (FÉNIX - SIEMPRE POR ENCIMA) */}
      {selectedOrderForTasks && (
        <OrderTasksModal
          isOpen={Boolean(selectedOrderForTasks)}
          onClose={() => setSelectedOrderForTasks(null)}
          orderNumber={selectedOrderForTasks.numeroOrden || selectedOrderForTasks.ot || selectedOrderForTasks.ticket}
          orderClient={selectedOrderForTasks.cliente}
          orderCuadrilla={selectedOrderForTasks.cuadrilla}
          orderEstado={selectedOrderForTasks.status}
          onProgressUpdate={handleTaskProgressUpdate}
        />
      )}
    </div>
  );
};

export default OrdersPage;
