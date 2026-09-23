import React, { useState, useEffect, useMemo } from "react";
import {
  ClipboardCheck,
  Star,
  Search,
  Filter,
  Calendar,
  Eye,
  Trash2,
  FileSpreadsheet,
  Printer,
  X,
  TrendingUp,
  Award,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  User,
  Users,
  Building,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  FichaSupervisionCampo,
  AuditoriaCalidadCliente,
  SupervisionStats,
} from "../types/supervisionTypes";
import { supervisionService } from "../services/supervisionService";

export const SupervisionHistoryTab: React.FC = () => {
  const [subTab, setSubTab] = useState<"CAMPO" | "CLIENTE" | "RANKING">("CAMPO");

  // Data states
  const [campoList, setCampoList] = useState<FichaSupervisionCampo[]>([]);
  const [clienteList, setClienteList] = useState<AuditoriaCalidadCliente[]>([]);
  const [stats, setStats] = useState<SupervisionStats | null>(null);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDesde, setFilterDesde] = useState("");
  const [filterHasta, setFilterHasta] = useState("");
  const [filterTipo, setFilterTipo] = useState("TODOS");
  const [filterConformidad, setFilterConformidad] = useState("TODOS");

  // Modal Detail States
  const [selectedCampo, setSelectedCampo] = useState<FichaSupervisionCampo | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<AuditoriaCalidadCliente | null>(null);

  // Load Data
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [campoData, clienteData, statsData] = await Promise.all([
        supervisionService.getSupervisionesCampo({
          desde: filterDesde || undefined,
          hasta: filterHasta || undefined,
          tipo_inspeccion: filterTipo !== "TODOS" ? filterTipo : undefined,
        }),
        supervisionService.getAuditoriasCalidad({
          desde: filterDesde || undefined,
          hasta: filterHasta || undefined,
          estado_conformidad: filterConformidad !== "TODOS" ? filterConformidad : undefined,
        }),
        supervisionService.getSupervisionStats({
          desde: filterDesde || undefined,
          hasta: filterHasta || undefined,
        }),
      ]);

      setCampoList(campoData);
      setClienteList(clienteData);
      setStats(statsData);
    } catch (e) {
      console.error("Error cargando historial de supervisión:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [filterDesde, filterHasta, filterTipo, filterConformidad]);

  // Filtered Campo
  const filteredCampo = useMemo(() => {
    if (!searchTerm.trim()) return campoList;
    const q = searchTerm.toLowerCase();
    return campoList.filter(
      (c) =>
        c.tecnico.toLowerCase().includes(q) ||
        (c.cuadrilla && c.cuadrilla.toLowerCase().includes(q)) ||
        (c.dni && c.dni.includes(q)) ||
        c.supervisor.toLowerCase().includes(q)
    );
  }, [campoList, searchTerm]);

  // Filtered Cliente
  const filteredCliente = useMemo(() => {
    if (!searchTerm.trim()) return clienteList;
    const q = searchTerm.toLowerCase();
    return clienteList.filter(
      (c) =>
        c.tecnico.toLowerCase().includes(q) ||
        c.cliente.toLowerCase().includes(q) ||
        (c.cuadrilla && c.cuadrilla.toLowerCase().includes(q)) ||
        (c.numero_ticket && c.numero_ticket.toLowerCase().includes(q)) ||
        (c.distrito && c.distrito.toLowerCase().includes(q)) ||
        c.auditor.toLowerCase().includes(q)
    );
  }, [clienteList, searchTerm]);

  // Delete Campo
  const handleDeleteCampo = async (id: number) => {
    if (window.confirm("¿Seguro que deseas eliminar esta ficha de supervisión en campo?")) {
      const res = await supervisionService.deleteSupervisionCampo(id);
      if (res.success) {
        setCampoList((prev) => prev.filter((item) => item.id !== id));
      } else {
        alert(res.message || "Error al eliminar");
      }
    }
  };

  // Delete Cliente
  const handleDeleteCliente = async (id: number) => {
    if (window.confirm("¿Seguro que deseas eliminar esta auditoría de calidad al cliente?")) {
      const res = await supervisionService.deleteAuditoriaCalidad(id);
      if (res.success) {
        setClienteList((prev) => prev.filter((item) => item.id !== id));
      } else {
        alert(res.message || "Error al eliminar");
      }
    }
  };

  // Export List to Excel
  const handleExportCampoExcel = () => {
    const rows = filteredCampo.map((c) => ({
      ID: c.id,
      Fecha: c.fecha,
      Hora: c.hora || "",
      Técnico: c.tecnico,
      DNI: c.dni || "",
      Cuadrilla: c.cuadrilla || "",
      Tipo: c.tipo_inspeccion,
      Supervisor: c.supervisor,
      Cumplimiento: `${c.cumplimiento_porcentaje}%`,
      Semáforo: c.semaforo.toUpperCase(),
      Observaciones: c.observaciones || "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Supervisiones_Campo");
    XLSX.writeFile(wb, `Historial_Supervision_Campo_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleExportClienteExcel = () => {
    const rows = filteredCliente.map((c) => ({
      ID: c.id,
      Fecha_Auditoría: c.fecha_auditoria,
      Fecha_Atención: c.fecha_atencion || "",
      Ticket: c.numero_ticket || "",
      Técnico: c.tecnico,
      Cuadrilla: c.cuadrilla || "",
      Cliente: c.cliente,
      Teléfono: c.telefono || "",
      Distrito: c.distrito || "",
      Auditor: c.auditor,
      Puntaje: `${c.puntaje_porcentaje}%`,
      Estrellas: `${c.calificacion_estrellas} / 5`,
      Conformidad: c.estado_conformidad,
      Comentario_Cliente: c.comentario_cliente || "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditorias_Cliente");
    XLSX.writeFile(wb, `Historial_Auditorias_Cliente_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Campo Inspections */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Fichas en Campo
            </span>
            <div className="text-3xl font-extrabold text-slate-800 mt-1">
              {stats?.campo.total_inspecciones || 0}
            </div>
            <div className="text-xs text-emerald-600 font-bold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              {stats?.campo.promedio_cumplimiento || 0}% prom. cumplimiento
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Field Semaphores */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Semáforo de Campo
          </span>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-bold text-emerald-800">
                {stats?.campo.total_verdes || 0}
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span className="text-xs font-bold text-amber-800">
                {stats?.campo.total_amarillos || 0}
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span className="text-xs font-bold text-rose-800">
                {stats?.campo.total_rojos || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Quality Audits */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Auditorías a Clientes
            </span>
            <div className="text-3xl font-extrabold text-slate-800 mt-1">
              {stats?.cliente.total_auditorias || 0}
            </div>
            <div className="text-xs text-teal-600 font-bold mt-1 flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-teal-500 text-teal-500" />
              {stats?.cliente.promedio_estrellas || 0} / 5.0 satisfacción
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Star className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Client Conformity */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Conformidad Clientes
          </span>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1.5 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-800">
                {stats?.cliente.total_conformes || 0}
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-bold text-amber-800">
                {stats?.cliente.total_observaciones || 0}
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              <span className="text-xs font-bold text-rose-800">
                {stats?.cliente.total_no_conformes || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Toggle buttons */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl">
          <button
            type="button"
            onClick={() => setSubTab("CAMPO")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === "CAMPO"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ClipboardCheck className="w-4 h-4 text-blue-600" />
            Fichas en Campo ({filteredCampo.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("CLIENTE")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === "CLIENTE"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Star className="w-4 h-4 text-teal-600" />
            Auditorías Cliente ({filteredCliente.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("RANKING")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === "RANKING"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Award className="w-4 h-4 text-amber-500" />
            Ranking Calidad ({stats?.ranking.length || 0})
          </button>
        </div>

        {/* Search & Export */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por técnico, cliente..."
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          {subTab === "CAMPO" && (
            <button
              type="button"
              onClick={handleExportCampoExcel}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
          )}

          {subTab === "CLIENTE" && (
            <button
              type="button"
              onClick={handleExportClienteExcel}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {subTab === "CAMPO" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Fecha / Hora</th>
                  <th className="py-3 px-4">Técnico / Cuadrilla</th>
                  <th className="py-3 px-4">Tipo Inspección</th>
                  <th className="py-3 px-4">Supervisor</th>
                  <th className="py-3 px-4 text-center">Cumplimiento</th>
                  <th className="py-3 px-4 text-center">Semáforo</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCampo.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 font-medium">
                      No se encontraron registros de supervisión en campo.
                    </td>
                  </tr>
                ) : (
                  filteredCampo.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        <div>{c.fecha}</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {c.hora || "—"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{c.tecnico}</div>
                        <div className="text-[11px] text-slate-500">
                          {c.cuadrilla || "Sin Cuadrilla"} {c.dni ? `· DNI: ${c.dni}` : ""}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 font-semibold px-2 py-0.5 rounded text-[11px]">
                          {c.tipo_inspeccion}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {c.supervisor}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-black text-slate-800 text-sm">
                          {c.cumplimiento_porcentaje}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                            c.semaforo === "verde"
                              ? "bg-emerald-100 text-emerald-800"
                              : c.semaforo === "amarillo"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              c.semaforo === "verde"
                                ? "bg-emerald-600"
                                : c.semaforo === "amarillo"
                                ? "bg-amber-600"
                                : "bg-rose-600"
                            }`}
                          />
                          {c.semaforo}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedCampo(c)}
                            title="Ver Detalle / Checklist"
                            className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => c.id && handleDeleteCampo(c.id)}
                            title="Eliminar Registro"
                            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "CLIENTE" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Fecha Auditoría</th>
                  <th className="py-3 px-4">Técnico / Cuadrilla</th>
                  <th className="py-3 px-4">Cliente / Ticket</th>
                  <th className="py-3 px-4">Auditor</th>
                  <th className="py-3 px-4 text-center">Puntaje</th>
                  <th className="py-3 px-4 text-center">Satisfacción</th>
                  <th className="py-3 px-4 text-center">Conformidad</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCliente.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400 font-medium">
                      No se encontraron registros de encuestas de calidad a clientes.
                    </td>
                  </tr>
                ) : (
                  filteredCliente.map((cl) => (
                    <tr key={cl.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {cl.fecha_auditoria}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{cl.tecnico}</div>
                        <div className="text-[11px] text-slate-500">
                          {cl.cuadrilla || "Sin Cuadrilla"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{cl.cliente}</div>
                        <div className="text-[11px] text-slate-500">
                          {cl.numero_ticket ? `Ticket: ${cl.numero_ticket}` : ""} {cl.distrito ? `· ${cl.distrito}` : ""}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {cl.auditor}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-black text-slate-800 text-sm">
                          {cl.puntaje_porcentaje}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3 h-3 ${
                                star <= cl.calificacion_estrellas
                                  ? "text-amber-400 fill-amber-400"
                                  : "text-slate-300"
                              }`}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                            cl.estado_conformidad === "CONFORME"
                              ? "bg-emerald-100 text-emerald-800"
                              : cl.estado_conformidad === "CON_OBSERVACIONES"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {cl.estado_conformidad === "CONFORME"
                            ? "CONFORME"
                            : cl.estado_conformidad === "CON_OBSERVACIONES"
                            ? "CON OBS."
                            : "NO CONFORME"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedCliente(cl)}
                            title="Ver Detalle Encuesta"
                            className="p-1.5 hover:bg-teal-50 text-teal-600 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => cl.id && handleDeleteCliente(cl.id)}
                            title="Eliminar Registro"
                            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "RANKING" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Award className="w-7 h-7 text-amber-100" />
              <div>
                <h3 className="font-extrabold text-base">Ranking de Calidad de Técnicos</h3>
                <p className="text-xs text-amber-100">
                  Puntaje consolidado de Fichas de Campo y Encuestas de Satisfacción al Cliente.
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 text-center">Puesto</th>
                  <th className="py-3 px-4">Técnico</th>
                  <th className="py-3 px-4">Cuadrilla</th>
                  <th className="py-3 px-4 text-center">Total Superv.</th>
                  <th className="py-3 px-4 text-center">Score Campo</th>
                  <th className="py-3 px-4 text-center">Score Cliente</th>
                  <th className="py-3 px-4 text-center">Score Global</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!stats?.ranking || stats.ranking.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 font-medium">
                      Aún no hay suficientes datos registrados para generar el ranking.
                    </td>
                  </tr>
                ) : (
                  stats.ranking.map((r, index) => (
                    <tr
                      key={r.tecnico}
                      className={`hover:bg-slate-50 transition-colors ${
                        index === 0 ? "bg-amber-50/40 font-medium" : ""
                      }`}
                    >
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-black text-xs ${
                            index === 0
                              ? "bg-amber-400 text-amber-950 shadow-sm"
                              : index === 1
                              ? "bg-slate-300 text-slate-800"
                              : index === 2
                              ? "bg-amber-700 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">{r.tecnico}</td>
                      <td className="py-3 px-4 text-slate-600">{r.cuadrilla || "—"}</td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-700">
                        {r.total_supervisiones}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-blue-700">{r.score_campo}%</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-teal-700">{r.score_cliente}%</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-3 py-1 rounded-full font-black text-xs ${
                            r.score_global >= 85
                              ? "bg-emerald-100 text-emerald-800"
                              : r.score_global >= 70
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {r.score_global}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Detail Campo */}
      {selectedCampo && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="w-6 h-6 text-blue-400" />
                <div>
                  <h3 className="font-bold text-lg">
                    Ficha de Supervisión en Campo · {selectedCampo.tipo_inspeccion}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Fecha: {selectedCampo.fecha} {selectedCampo.hora || ""} · Supervisor: {selectedCampo.supervisor}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCampo(null)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold block">Técnico:</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedCampo.tecnico}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block">Cuadrilla / DNI:</span>
                  <span className="font-bold text-slate-800">
                    {selectedCampo.cuadrilla || "—"} / {selectedCampo.dni || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block">Cumplimiento:</span>
                  <span className="font-black text-slate-900 text-sm">
                    {selectedCampo.cumplimiento_porcentaje}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block">Semáforo:</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                      selectedCampo.semaforo === "verde"
                        ? "bg-emerald-100 text-emerald-800"
                        : selectedCampo.semaforo === "amarillo"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {selectedCampo.semaforo}
                  </span>
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 text-sm">
                  Detalle de Ítems Evaluados ({selectedCampo.items_json.length})
                </h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-80 overflow-y-auto">
                  {selectedCampo.items_json.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3 flex items-center justify-between text-xs hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            item.cumple
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {item.cumple ? "✓" : "✗"}
                        </span>
                        <div>
                          <span className="font-semibold text-slate-800">{item.nombre}</span>
                          <span className="text-[10px] text-slate-400 ml-2">
                            ({item.categoria})
                          </span>
                          {item.observacion && (
                            <p className="text-[11px] text-amber-700 mt-0.5">
                              Obs: {item.observacion}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.estado && (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                            {item.estado}
                          </span>
                        )}
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                            item.cumple
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {item.cumple ? "CUMPLE" : "NO CUMPLE"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Observations */}
              {selectedCampo.observaciones && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs">
                  <span className="font-bold text-amber-900 block mb-1">
                    Observaciones Generales del Supervisor:
                  </span>
                  <p className="text-amber-800">{selectedCampo.observaciones}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCampo(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Cliente */}
      {selectedCliente && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="bg-teal-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                <div>
                  <h3 className="font-bold text-lg">
                    Auditoría de Calidad · {selectedCliente.cliente}
                  </h3>
                  <p className="text-xs text-teal-300/80">
                    Fecha Auditoría: {selectedCliente.fecha_auditoria} · Auditor: {selectedCliente.auditor}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCliente(null)}
                className="p-1.5 hover:bg-teal-900 rounded-lg text-teal-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-teal-50/50 rounded-xl border border-teal-100 text-xs">
                <div>
                  <span className="text-teal-700 font-semibold block">Técnico Evaluado:</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedCliente.tecnico}</span>
                </div>
                <div>
                  <span className="text-teal-700 font-semibold block">Ticket / Distrito:</span>
                  <span className="font-bold text-slate-800">
                    {selectedCliente.numero_ticket || "S/T"} · {selectedCliente.distrito || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-teal-700 font-semibold block">Puntaje / Estrellas:</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="font-black text-slate-900 text-sm">
                      {selectedCliente.puntaje_porcentaje}%
                    </span>
                    <span className="text-amber-500 font-bold ml-1">
                      ({selectedCliente.calificacion_estrellas}★)
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-teal-700 font-semibold block">Dictamen:</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                      selectedCliente.estado_conformidad === "CONFORME"
                        ? "bg-emerald-100 text-emerald-800"
                        : selectedCliente.estado_conformidad === "CON_OBSERVACIONES"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {selectedCliente.estado_conformidad}
                  </span>
                </div>
              </div>

              {/* Questions Breakdown */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 text-sm">
                  Cuestionario de 4 Dimensiones ({selectedCliente.preguntas_json.length} preguntas)
                </h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-80 overflow-y-auto">
                  {selectedCliente.preguntas_json.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-slate-50"
                    >
                      <div className="flex-1">
                        <div className="text-[10px] text-teal-700 font-bold mb-0.5">
                          {q.dimension_titulo}
                        </div>
                        <p className="font-medium text-slate-800">{q.pregunta}</p>
                        {q.observacion && (
                          <p className="text-[11px] text-amber-700 mt-1">
                            Obs: {q.observacion}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <span
                          className={`font-bold px-3 py-1 rounded-lg text-xs ${
                            q.respuesta
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {q.respuesta ? "SÍ" : "NO"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Client Comments */}
              {selectedCliente.comentario_cliente && (
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl text-xs">
                  <span className="font-bold text-teal-900 block mb-1">
                    Comentarios del Abonado / Feedback:
                  </span>
                  <p className="text-teal-800">{selectedCliente.comentario_cliente}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCliente(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
