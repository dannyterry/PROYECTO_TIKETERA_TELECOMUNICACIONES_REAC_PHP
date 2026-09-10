import React, { useState, useEffect } from "react";
import {
  RotateCcw,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Truck,
  Building2,
  RefreshCw,
  Search,
  ArrowDownLeft,
  Calendar,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  Save,
  Check,
  Tag,
  FileText,
} from "lucide-react";
import * as XLSX from "xlsx";
import { EquipoRetirado } from "../types/inventoryTypes";
import {
  getEquiposRecogidos,
  internarEquipoRecogido,
  actualizarEquipoRecogido,
} from "../services/inventoryService";

export const RetrievedEquipmentTab: React.FC = () => {
  const [equipos, setEquipos] = useState<EquipoRetirado[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("Todos");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState<string>("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState<string>("");

  // Edición en línea de Guía de Remisión WIN y PROID
  const [guiasEditadas, setGuiasEditadas] = useState<{ [id: number]: string }>({});
  const [proidsEditados, setProidsEditados] = useState<{ [id: number]: string }>({});
  const [guardandoId, setGuardandoId] = useState<number | null>(null);
  const [guardadoExitoId, setGuardadoExitoId] = useState<number | null>(null);

  const cargarEquipos = () => {
    setLoading(true);
    getEquiposRecogidos()
      .then((data) => {
        setEquipos(data || []);
        // Inicializar mapas de edición
        const initialGuias: { [id: number]: string } = {};
        const initialProids: { [id: number]: string } = {};
        (data || []).forEach((e) => {
          initialGuias[e.id_equipo_retirado] = e.guia_remision_win || "";
          initialProids[e.id_equipo_retirado] = e.proid || "";
        });
        setGuiasEditadas(initialGuias);
        setProidsEditados(initialProids);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cargarEquipos();
  }, []);

  const handleGuardarDatosEquipo = async (id: number) => {
    try {
      setGuardandoId(id);
      const guia = guiasEditadas[id] || "";
      const proidVal = proidsEditados[id] || "";
      await actualizarEquipoRecogido(id, {
        guia_remision_win: guia,
        proid: proidVal,
      });

      setEquipos((prev) =>
        prev.map((e) =>
          e.id_equipo_retirado === id
            ? { ...e, guia_remision_win: guia, proid: proidVal }
            : e
        )
      );

      setGuardadoExitoId(id);
      setTimeout(() => setGuardadoExitoId(null), 2500);
    } catch (err: any) {
      alert("Error al guardar: " + (err.response?.data?.error || err.message));
    } finally {
      setGuardandoId(null);
    }
  };

  const handleExportarExcel = () => {
    if (equiposFiltrados.length === 0) {
      alert("No hay equipos para exportar con los filtros seleccionados.");
      return;
    }

    const dataToExport = equiposFiltrados.map((e, idx) => ({
      "N°": idx + 1,
      "Acta / Ticket": e.ticket || `REQ-${e.id_orden}`,
      "Cliente": e.cliente || "S/D",
      "Dirección": e.direccion || "S/D",
      "Distrito": e.distrito || "S/D",
      "Código Producto": e.codigo_producto || "ONT/MESH",
      "Tipo de Equipo": e.tipo_equipo || "ONT",
      "Número de Serie (S/N)": e.numero_serie,
      "ID Modelo": proidsEditados[e.id_equipo_retirado] ?? e.proid ?? "S/P",
      "Guía de Remisión WIN": guiasEditadas[e.id_equipo_retirado] ?? e.guia_remision_win ?? "PENDIENTE",
      "Técnico que Retiró": e.tecnico_nombre || "S/N",
      "Cuadrilla": e.cuadrilla || "S/C",
      "Fecha de Recojo": e.fecha_recojo ? e.fecha_recojo.slice(0, 19).replace("T", " ") : "-",
      "Fecha Internado en Almacén": e.fecha_internamiento ? e.fecha_internamiento.slice(0, 19).replace("T", " ") : "-",
      "Recibido Por": e.recibido_por || "-",
      "Motivo de Retiro": e.motivo_retiro || "Avería / Retiro",
      "Estado": e.estado === "En_Poder_Tecnico" ? "En Poder del Técnico" : "Internado en Almacén",
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Equipos Recogidos");
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Equipos_Recogidos_WIN_${fecha}.xlsx`);
  };

  const handleInternar = async (
    id_equipo_retirado: number,
    estado_destino: string
  ) => {
    try {
      await internarEquipoRecogido({
        id_equipo_retirado,
        estado_destino,
        recibido_por: "Almacén Central Céspedes",
        observaciones: "Recepción e internamiento confirmado",
      });
      alert("✅ Equipo internado en Almacén Central con éxito.");
      cargarEquipos();
    } catch (err: any) {
      alert("Error al internar: " + (err.response?.data?.error || err.message));
    }
  };

  const equiposFiltrados = equipos.filter((e) => {
    const txt = filtroTexto.toLowerCase();
    const matchTxt =
      !txt ||
      e.numero_serie.toLowerCase().includes(txt) ||
      (e.proid || "").toLowerCase().includes(txt) ||
      (proidsEditados[e.id_equipo_retirado] || "").toLowerCase().includes(txt) ||
      (e.guia_remision_win || "").toLowerCase().includes(txt) ||
      e.ticket?.toLowerCase().includes(txt) ||
      e.cliente?.toLowerCase().includes(txt) ||
      e.tecnico_nombre?.toLowerCase().includes(txt);

    const matchEst =
      filtroEstado === "Todos" ||
      (filtroEstado === "Pendiente" && e.estado === "En_Poder_Tecnico") ||
      (filtroEstado === "Internado" && e.estado !== "En_Poder_Tecnico");

    const fechaRef = (e.fecha_recojo || e.fecha_internamiento || "").slice(0, 10);
    const matchFechaDesde = !filtroFechaDesde || (fechaRef && fechaRef >= filtroFechaDesde);
    const matchFechaHasta = !filtroFechaHasta || (fechaRef && fechaRef <= filtroFechaHasta);

    return matchTxt && matchEst && matchFechaDesde && matchFechaHasta;
  });

  const totalPendientes = equipos.filter((e) => e.estado === "En_Poder_Tecnico").length;
  const totalInternados = equipos.filter((e) => e.estado !== "En_Poder_Tecnico").length;

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* ─────────────────────────────────────────────────────────────
          1. KPIS DE CONTROL DE EQUIPOS RETIRADOS
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
            <Truck size={24} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
              En Poder del Técnico
            </span>
            <h3 className="text-xl font-black text-amber-600 font-mono">
              {totalPendientes}
            </h3>
            <span className="text-[10px] text-amber-600 font-bold">Por entregar a Almacén</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
            <Building2 size={24} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Internados en Almacén
            </span>
            <h3 className="text-xl font-black text-emerald-600 font-mono">
              {totalInternados}
            </h3>
            <span className="text-[10px] text-emerald-600 font-bold">Recepcionados físicamente</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
            <RotateCcw size={24} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Total Retirados
            </span>
            <h3 className="text-xl font-black text-slate-900 font-mono">
              {equipos.length}
            </h3>
            <span className="text-[10px] text-indigo-600 font-bold">Cambios y postventa</span>
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. FILTROS & BÚSQUEDA
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFiltroEstado("Todos")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filtroEstado === "Todos" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            Todos ({equipos.length})
          </button>
          <button
            onClick={() => setFiltroEstado("Pendiente")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filtroEstado === "Pendiente" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            Por Internar ({totalPendientes})
          </button>
          <button
            onClick={() => setFiltroEstado("Internado")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filtroEstado === "Internado" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            Internados ({totalInternados})
          </button>
        </div>

        {/* Filtro Rango de Fechas & Buscador */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <Calendar size={14} className="text-slate-400 shrink-0" />
            <span className="text-[11px] font-bold text-slate-500">Fecha:</span>
            <input
              type="date"
              value={filtroFechaDesde}
              onChange={(e) => setFiltroFechaDesde(e.target.value)}
              className="bg-transparent border-0 text-xs font-mono font-medium p-0 text-slate-700 focus:ring-0"
              title="Fecha desde"
            />
            <span className="text-slate-400 font-bold">-</span>
            <input
              type="date"
              value={filtroFechaHasta}
              onChange={(e) => setFiltroFechaHasta(e.target.value)}
              className="bg-transparent border-0 text-xs font-mono font-medium p-0 text-slate-700 focus:ring-0"
              title="Fecha hasta"
            />
            {(filtroFechaDesde || filtroFechaHasta) && (
              <button
                type="button"
                onClick={() => {
                  setFiltroFechaDesde("");
                  setFiltroFechaHasta("");
                }}
                className="text-[10px] text-rose-600 hover:text-rose-800 font-bold ml-1 cursor-pointer"
                title="Limpiar fechas"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              const hoy = new Date().toISOString().slice(0, 10);
              setFiltroFechaDesde(hoy);
              setFiltroFechaHasta(hoy);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              filtroFechaDesde === new Date().toISOString().slice(0, 10) && filtroFechaHasta === new Date().toISOString().slice(0, 10)
                ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-white"
            }`}
          >
            📅 Hoy
          </button>

          <div className="relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Buscar S/N, ID de modelo, ticket, cliente..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
            />
          </div>

          {/* Botón Exportar a Excel */}
          <button
            type="button"
            onClick={handleExportarExcel}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-xs cursor-pointer shrink-0"
            title="Exportar listado completo a Excel (.xlsx) con Cliente, Acta, Código, Serie, ID Modelo y Guía WIN"
          >
            <FileSpreadsheet size={15} />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. TABLA DE EQUIPOS RECOGIDOS CON GUÍA WIN & ID DE MODELO
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
            <tr>
              <th className="py-3.5 px-4">Equipo & Serie (S/N)</th>
              <th className="py-3.5 px-4">ID Modelo</th>
              <th className="py-3.5 px-4">Guía Remisión WIN</th>
              <th className="py-3.5 px-4">Cliente & Ticket / Acta</th>
              <th className="py-3.5 px-4">Técnico que Retiró</th>
              <th className="py-3.5 px-4">Motivo Retiro</th>
              <th className="py-3.5 px-4">Fecha Recojo</th>
              <th className="py-3.5 px-4">Fecha Internado</th>
              <th className="py-3.5 px-4 text-center">Estado</th>
              <th className="py-3.5 px-4 text-right">Acción Almacén</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {equiposFiltrados.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-slate-400 font-bold">
                  No hay equipos recogidos registrados con los filtros actuales.
                </td>
              </tr>
            ) : (
              equiposFiltrados.map((eq) => {
                const esPendiente = eq.estado === "En_Poder_Tecnico";
                const horasDesdeRecojo = eq.fecha_recojo
                  ? (new Date().getTime() - new Date(eq.fecha_recojo).getTime()) / (1000 * 3600)
                  : 0;
                const alertaDemora = esPendiente && horasDesdeRecojo > 48;

                return (
                  <tr key={eq.id_equipo_retirado} className="hover:bg-slate-50/60 transition-colors">
                    
                    {/* 1. Equipo & Serie & Código */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <ArrowDownLeft size={16} />
                        </div>
                        <div>
                          <span className="font-extrabold text-slate-900 block font-mono text-xs">
                            {eq.numero_serie}
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold">
                            <span>{eq.tipo_equipo}</span>
                            {eq.codigo_producto && (
                              <>
                                <span>•</span>
                                <span className="text-sky-700 font-mono font-black">{eq.codigo_producto}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. ID Modelo */}
                    <td className="py-3.5 px-4">
                      <div className="min-w-[110px]">
                        <input
                          type="text"
                          placeholder="ID Modelo..."
                          title="ID Modelo de la caja"
                          value={proidsEditados[eq.id_equipo_retirado] ?? eq.proid ?? ""}
                          onChange={(e) =>
                            setProidsEditados((prev) => ({
                              ...prev,
                              [eq.id_equipo_retirado]: e.target.value.toUpperCase(),
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleGuardarDatosEquipo(eq.id_equipo_retirado);
                          }}
                          className="w-full px-2 py-1 bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 uppercase focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                    </td>

                    {/* 3. Guía de Remisión WIN (Editable con Guardado Rápido) */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 min-w-[160px]">
                        <input
                          type="text"
                          placeholder="Digitar Guía WIN..."
                          value={guiasEditadas[eq.id_equipo_retirado] ?? eq.guia_remision_win ?? ""}
                          onChange={(e) =>
                            setGuiasEditadas((prev) => ({
                              ...prev,
                              [eq.id_equipo_retirado]: e.target.value.toUpperCase(),
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleGuardarDatosEquipo(eq.id_equipo_retirado);
                          }}
                          className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-black text-indigo-950 placeholder:text-slate-400 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 shadow-2xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleGuardarDatosEquipo(eq.id_equipo_retirado)}
                          disabled={guardandoId === eq.id_equipo_retirado}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer shrink-0 shadow-2xs ${
                            guardadoExitoId === eq.id_equipo_retirado
                              ? "bg-emerald-500 text-white border-emerald-600 animate-pulse"
                              : "bg-sky-50 hover:bg-sky-600 text-sky-700 hover:text-white border-sky-200"
                          }`}
                          title="Guardar Guía y PROID en Almacén"
                        >
                          {guardadoExitoId === eq.id_equipo_retirado ? (
                            <Check size={13} />
                          ) : (
                            <Save size={13} />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* 4. Cliente & Ticket / N° Acta */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 truncate max-w-[170px]">{eq.cliente}</div>
                      <span className="text-[10px] font-mono text-indigo-700 font-bold block">
                        Ticket / Acta: #{eq.ticket}
                      </span>
                    </td>

                    {/* Técnico */}
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-800 block">{eq.tecnico_nombre}</span>
                      <span className="text-[10px] text-slate-400">{eq.cuadrilla}</span>
                    </td>

                    {/* Motivo */}
                    <td className="py-3.5 px-4 text-slate-600 text-[11px] max-w-[180px] truncate">
                      {eq.motivo_retiro || "Cambio por avería"}
                    </td>

                    {/* Fecha de Recojo (En casa de cliente) */}
                    <td className="py-3.5 px-4">
                      <div className="text-xs font-mono font-bold text-slate-700">
                        {eq.fecha_recojo
                          ? new Date(eq.fecha_recojo).toLocaleDateString("es-PE", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </div>
                      {alertaDemora && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200 mt-1">
                          <AlertTriangle size={10} className="text-rose-600" />
                          Demora (+{Math.floor(horasDesdeRecojo / 24)}d en ruta)
                        </span>
                      )}
                    </td>

                    {/* Fecha de Internado (En Almacén) */}
                    <td className="py-3.5 px-4">
                      {eq.fecha_internamiento ? (
                        <div className="space-y-0.5">
                          <span className="text-xs font-mono font-bold text-emerald-800 block">
                            {new Date(eq.fecha_internamiento).toLocaleDateString("es-PE", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium block">
                            Por: {eq.recibido_por || "Almacén Central"}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          <Clock size={10} />
                          Pendiente entrega
                        </span>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="py-3.5 px-4 text-center">
                      {esPendiente ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <Truck size={12} />
                          En Carro Técnico
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Building2 size={12} />
                          Internado en Almacén
                        </span>
                      )}
                    </td>

                    {/* Acción */}
                    <td className="py-3.5 px-4 text-right">
                      {esPendiente ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleInternar(eq.id_equipo_retirado, "Internado_Almacen")}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition-all cursor-pointer shadow-xs"
                          >
                            Internar
                          </button>
                          <button
                            onClick={() => handleInternar(eq.id_equipo_retirado, "Defectuoso")}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                          >
                            Defectuoso
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          ✓ Custodia OK
                        </span>
                      )}
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
