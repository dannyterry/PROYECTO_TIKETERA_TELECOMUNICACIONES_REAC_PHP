import React, { useState, useEffect } from "react";
import { OrderFilters } from "../types/Order";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { RotateCw, Search, Calendar, Filter, X, Layers } from "lucide-react";

interface OrdersToolbarProps {
  filters: OrderFilters;
  onFilterChange: (filters: OrderFilters) => void;
  onSync: () => void;
  totalCount: number;
  cuadrillas?: (string | { key: string; label: string })[];
  stats?: {
    verdes: number;
    azules: number;
    amarillos: number;
    agendadas: number;
  };
}

export const OrdersToolbar: React.FC<OrdersToolbarProps> = ({
  filters,
  onFilterChange,
  onSync,
  totalCount,
  cuadrillas = [],
  stats = { verdes: 0, azules: 0, amarillos: 0, agendadas: 0 },
}) => {
  // Temporizador regresivo de sincronización en vivo (ej. 60s)
  const [countdown, setCountdown] = useState(60);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onSync();
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
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

  const handleClearFilters = () => {
    setLocalSearch("");
    onFilterChange({
      fechaDesde: "",
      fechaHasta: "",
      status: "Todos",
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

  return (
    <div className="flex flex-col gap-3 bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm">
      
      {/* FILA SUPERIOR: TÍTULO, ESTADÍSTICAS Y BOTÓN DE SINCRONIZACIÓN */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        
        {/* TÍTULO Y CONTADORES POR COLOR */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700">
              <Layers size={20} />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                Órdenes de Trabajo
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                Monitoreo y liquidación de servicios técnicos en tiempo real
              </p>
            </div>
          </div>

          {/* Badges de estados con conteos */}
          <div className="flex flex-wrap items-center gap-1.5 ml-0 lg:ml-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
              <span>Total:</span>
              <span className="font-mono">{totalCount}</span>
            </span>

            <span 
              onClick={() => onFilterChange({ ...filters, status: filters.status === "Agendadas" ? "Todos" : "Agendadas" })}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                filters.status === "Agendadas" 
                  ? "bg-slate-800 text-white border-slate-900 ring-2 ring-slate-400 shadow-xs" 
                  : "bg-white text-slate-800 border-slate-300 hover:bg-slate-100 shadow-2xs"
              }`}
              title="Filtrar Agendadas / Asignadas / En camino"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-400 shadow-2xs"></span>
              <span>Agendadas / Asignadas:</span>
              <span className="font-mono font-black">{stats.agendadas}</span>
            </span>
            
            <span 
              onClick={() => onFilterChange({ ...filters, status: filters.status === "Verdes" ? "Todos" : "Verdes" })}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                filters.status === "Verdes" 
                  ? "bg-[#70ad47] text-white border-[#568735] ring-2 ring-emerald-300 shadow-xs" 
                  : "bg-[#70ad47]/20 text-emerald-950 border-[#70ad47]/40 hover:bg-[#70ad47]/30"
              }`}
              title="Filtrar Iniciadas / Proceso"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#70ad47] border border-[#568735]"></span>
              <span>Iniciadas / Proceso:</span>
              <span className="font-mono font-black">{stats.verdes}</span>
            </span>

            <span 
              onClick={() => onFilterChange({ ...filters, status: filters.status === "Finalizadas" ? "Todos" : "Finalizadas" })}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                filters.status === "Finalizadas" 
                  ? "bg-[#5b9bd5] text-white border-[#3c78b0] ring-2 ring-sky-300 shadow-xs" 
                  : "bg-[#5b9bd5]/25 text-sky-950 border-[#5b9bd5]/40 hover:bg-[#5b9bd5]/35"
              }`}
              title="Filtrar Finalizadas / Liquidadas"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#5b9bd5] border border-[#3c78b0]"></span>
              <span>Finalizadas:</span>
              <span className="font-mono font-black">{stats.azules}</span>
            </span>

            <span 
              onClick={() => onFilterChange({ ...filters, status: filters.status === "Amarillos" ? "Todos" : "Amarillos" })}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                filters.status === "Amarillos" 
                  ? "bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300" 
                  : "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
              }`}
              title="Filtrar Regestión / Canceladas / Observadas / Anuladas"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Regestión / Canceladas:</span>
              <span className="font-mono">{stats.amarillos}</span>
            </span>
          </div>
        </div>

        {/* BOTÓN DE SINCRONIZACIÓN CON TEMPORIZADOR REGRESIVO */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          <Button
            onClick={handleManualSync}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-2 text-xs transition-all cursor-pointer"
          >
            <RotateCw size={14} className={isSyncing ? "animate-spin" : ""} />
            <span>Sincronizar ({countdown}s)</span>
          </Button>
        </div>

      </div>

      {/* FILA INFERIOR: FILTROS DE FECHA, ESTADO Y BUSCADOR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2.5 items-end pt-1">
        
        {/* 1. Fecha Desde */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
              Desde
            </label>
            <button
              type="button"
              onClick={handleSetToday}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
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
              className="w-full bg-slate-50 border-slate-300 text-xs focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* 2. Fecha Hasta */}
        <div className="w-full">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">
            Hasta
          </label>
          <div className="relative">
            <Input
              type="date"
              value={filters.fechaHasta}
              onChange={(e) => onFilterChange({ ...filters, fechaHasta: e.target.value })}
              className="w-full bg-slate-50 border-slate-300 text-xs focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* 3. Filtro de Estado */}
        <div className="w-full">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">
            Estado / Color
          </label>
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
            className="w-full h-9 rounded-md border border-slate-300 bg-slate-50 px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium"
          >
            <option value="Todos">🌐 Todos los Estados</option>
            <option value="Verdes">🟢 Verde (Iniciada / Proceso)</option>
            <option value="Finalizadas">🔵 Celeste (Finalizada)</option>
            <option value="Amarillos">🟡 Amarillo (Regestión / Cancelada)</option>
            <option value="Agendadas">⚪ Gris (Agendada / Asignada / En camino)</option>
          </select>
        </div>

        {/* 4. Filtro de Cuadrilla (Diferenciando prefijo + descriptor: K 5 CESPEDES vs K 5 TRASLADO) */}
        <div className="w-full">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">
            👥 Cuadrilla
          </label>
          <select
            value={filters.cuadrilla || "Todos"}
            onChange={(e) => onFilterChange({ ...filters, cuadrilla: e.target.value })}
            className={`w-full h-9 rounded-md border px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-bold ${
              filters.cuadrilla && filters.cuadrilla !== "Todos"
                ? "bg-indigo-50 border-indigo-400 text-indigo-900"
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

        {/* 5. Filtro Inconcert */}
        <div className="w-full">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">
            Inconcert
          </label>
          <select
            value={filters.inconcert}
            onChange={(e) => onFilterChange({ ...filters, inconcert: e.target.value })}
            className="w-full h-9 rounded-md border border-slate-300 bg-slate-50 px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium"
          >
            <option value="Todos">📞 Inconcert: Todos</option>
            <option value="Si">✅ Con llamada Inconcert (Sí)</option>
            <option value="No">❌ Sin llamada (No)</option>
          </select>
        </div>

        {/* 6. Buscador General con Botón Buscar y ENTER */}
        <div className="w-full sm:col-span-2 lg:col-span-1 xl:col-span-1">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
              Búsqueda Rápida
            </label>
            {(filters.search || filters.fechaDesde || filters.fechaHasta || filters.status !== "Todos" || (filters.cuadrilla && filters.cuadrilla !== "Todos") || filters.inconcert !== "Todos") && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-[10px] text-red-500 hover:text-red-700 font-semibold cursor-pointer flex items-center gap-0.5"
              >
                <X size={10} />
                <span>Limpiar filtros</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Input
                placeholder="Ticket, Cliente, DNI, Técnico, CTO..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-slate-50 border-slate-300 text-xs pl-3 pr-7 focus:ring-indigo-500 font-medium"
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs p-0.5 cursor-pointer"
                  title="Borrar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleExecuteSearch()}
              className="h-9 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-md text-xs font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer shrink-0"
              title="Buscar (o presiona ENTER)"
            >
              <Search size={13} />
              <span>Buscar</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
