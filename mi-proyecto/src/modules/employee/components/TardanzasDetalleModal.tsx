import React, { useState, useMemo } from "react";
import {
  X,
  Clock,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
  Search,
  User,
  ShieldAlert,
  Download,
  Building,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import * as XLSX from "xlsx";

export interface TardanzaItem {
  id_asistencia?: number;
  id_trabajador?: number;
  id_usuario?: number;
  fecha: string;
  hora_entrada?: string;
  estado: string;
  minutos_tarde?: number;
  observacion?: string;
  tipo?: string;
  id_orden?: number;
  numero_orden?: string;
  cliente?: string;
  hora_asignacion?: string;
  hora_en_camino?: string;
  inicio_visita?: string;
  fin_visita?: string;
}

interface TardanzasDetalleModalProps {
  isOpen: boolean;
  onClose: () => void;
  trabajador: {
    id_usuario?: number;
    id_trabajador?: number;
    nombre_completo: string;
    documento?: string;
    cuadrilla?: string;
    rol_nombre?: string;
    cargo?: string;
    tipo_trabajo?: string;
    opcion_personal?: string;
  } | null;
  tardanzas: TardanzaItem[];
  periodoTexto: string;
  canVerDetallesPersonal?: boolean;
}

const formatHora = (horaStr?: string | null): string => {
  if (!horaStr) return "--:--";
  let s = String(horaStr).trim();
  if (s.includes("T")) {
    s = s.split("T")[1];
  } else if (s.includes(" ")) {
    s = s.split(" ")[1];
  }
  return s.slice(0, 8);
};

const formatFechaBonita = (fechaStr: string): string => {
  try {
    const [y, m, d] = fechaStr.slice(0, 10).split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const diasSemana = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return `${diasSemana[date.getDay()]}, ${d} ${meses[date.getMonth()]} ${y}`;
  } catch {
    return fechaStr.slice(0, 10);
  }
};

export const TardanzasDetalleModal: React.FC<TardanzasDetalleModalProps> = ({
  isOpen,
  onClose,
  trabajador,
  tardanzas,
  periodoTexto,
  canVerDetallesPersonal = true,
}) => {
  const [filtroTexto, setFiltroTexto] = useState("");

  const tardanzasOrdenadas = useMemo(() => {
    return [...tardanzas].sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [tardanzas]);

  const tardanzasFiltradas = useMemo(() => {
    if (!filtroTexto.trim()) return tardanzasOrdenadas;
    const txt = filtroTexto.toLowerCase();
    return tardanzasOrdenadas.filter(
      (t) =>
        t.fecha.toLowerCase().includes(txt) ||
        (t.numero_orden && t.numero_orden.toLowerCase().includes(txt)) ||
        (t.cliente && t.cliente.toLowerCase().includes(txt)) ||
        (t.observacion && t.observacion.toLowerCase().includes(txt)) ||
        (t.hora_asignacion && t.hora_asignacion.toLowerCase().includes(txt)) ||
        (t.hora_entrada && t.hora_entrada.toLowerCase().includes(txt)) ||
        (t.inicio_visita && t.inicio_visita.toLowerCase().includes(txt))
    );
  }, [tardanzasOrdenadas, filtroTexto]);

  const stats = useMemo(() => {
    const totalTardanzas = tardanzas.length;
    const totalMinutos = tardanzas.reduce((acc, curr) => acc + (Number(curr.minutos_tarde) || 0), 0);
    const promedioMinutos = totalTardanzas > 0 ? Math.round(totalMinutos / totalTardanzas) : 0;
    const maxTardanza = tardanzas.reduce((max, curr) => Math.max(max, Number(curr.minutos_tarde) || 0), 0);
    return { totalTardanzas, totalMinutos, promedioMinutos, maxTardanza };
  }, [tardanzas]);

  // 📊 EXPORTAR A EXCEL ELEGANTE Y COLOREADO (SOLO NOMBRE DEL TÉCNICO Y HORAS DE INICIO)
  const handleExportarExcel = () => {
    if (!trabajador || tardanzas.length === 0) return;

    const nombreTecnico = trabajador.nombre_completo || "Técnico";

    // Formato HTML compatible con Microsoft Excel: tabla limpia y directa con cabecera coloreada
    const htmlTable = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <style>
          body { font-family: Calibri, Arial, sans-serif; }
          .th-col { background-color: #D97706; color: #FFFFFF; font-weight: bold; text-align: center; border: 1px solid #B45309; height: 32px; font-size: 11pt; }
          .td-cell { border: 1px solid #CBD5E1; padding: 8px 12px; font-size: 10pt; vertical-align: middle; }
          .td-center { border: 1px solid #CBD5E1; text-align: center; padding: 8px 12px; font-size: 10pt; vertical-align: middle; }
          .td-time { border: 1px solid #CBD5E1; text-align: center; padding: 8px 12px; font-weight: bold; color: #B45309; background-color: #FFFBEB; font-size: 11pt; vertical-align: middle; }
          .td-badge { border: 1px solid #CBD5E1; text-align: center; padding: 8px 12px; font-weight: bold; color: #9A3412; background-color: #FFEDD5; font-size: 10pt; vertical-align: middle; }
        </style>
      </head>
      <body>
        <table border="0" cellpadding="0" cellspacing="0">
          <thead>
            <tr>
              <th class="th-col" width="50">N°</th>
              <th class="th-col" width="280">TÉCNICO</th>
              <th class="th-col" width="160">FECHA</th>
              <th class="th-col" width="160">HORA ASIGNADA</th>
              <th class="th-col" width="160">HORA 1RA OT / INICIO</th>
              <th class="th-col" width="140">TARDANZA (T)</th>
            </tr>
          </thead>
          <tbody>
            ${tardanzasOrdenadas
              .map(
                (item, idx) => {
                  const matchAsig = (item.observacion || "").match(/Asig\s+(\d{1,2}:\d{2})/i);
                  const hAsigDisplay = matchAsig ? `${matchAsig[1]}:00` : (item.hora_asignacion ? formatHora(item.hora_asignacion) : (item.hora_entrada ? formatHora(item.hora_entrada) : "--:--"));
                  return `
              <tr style="background-color: ${idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC"};">
                <td class="td-center">${idx + 1}</td>
                <td class="td-cell"><b>${nombreTecnico}</b></td>
                <td class="td-center">${formatFechaBonita(item.fecha)}</td>
                <td class="td-center"><b>${hAsigDisplay}</b></td>
                <td class="td-time">${formatHora(item.hora_entrada || item.inicio_visita)}</td>
                <td class="td-badge">T (+${item.minutos_tarde || 0} min)</td>
              </tr>
            `;
                }
              )
              .join("")}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlTable], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const cleanName = nombreTecnico.replace(/[^a-zA-Z0-9]/g, "_");
    link.download = `Tardanzas_${cleanName}_${periodoTexto.replace(/[^a-zA-Z0-9]/g, "_")}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen || !trabajador) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        {/* Cabecera Principal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/25">
              <Clock size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Desglose de Tardanzas & Horas de Inicio
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
                  {stats.totalTardanzas} {stats.totalTardanzas === 1 ? "Tardanza" : "Tardanzas"}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Auditoría detallada de llegadas fuera de tolerancia para <strong className="text-slate-800">{periodoTexto}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportarExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              title="Descargar reporte Excel con cabeceras y diseño para imprimir o compartir"
            >
              <FileSpreadsheet size={15} />
              <span className="hidden sm:inline">Exportar Excel</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
              title="Cerrar modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Ficha del Técnico & KPIs Rápidos */}
        <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-200/70 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-extrabold text-slate-900">{trabajador.nombre_completo}</h4>
                {trabajador.cuadrilla && (
                  <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-mono text-[11px] font-bold border border-teal-200">
                    {trabajador.cuadrilla}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                {canVerDetallesPersonal && trabajador.documento && (
                  <span className="font-mono font-semibold text-slate-600">DNI: {trabajador.documento}</span>
                )}
                {trabajador.rol_nombre && (
                  <span className="px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-700 text-[10px] font-bold uppercase">
                    {trabajador.rol_nombre}
                  </span>
                )}
                {trabajador.opcion_personal && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                    {trabajador.opcion_personal}
                  </span>
                )}
              </div>
            </div>

            {/* Selector de Búsqueda Rápida */}
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                placeholder="Buscar fecha u OT..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-amber-500 transition-all shadow-2xs"
              />
            </div>
          </div>

          {/* Tarjetas KPI de Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Total Tardanzas</span>
              <span className="text-lg font-black font-mono text-amber-600 block">{stats.totalTardanzas}</span>
              <span className="text-[10px] text-slate-400">Días en el período</span>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Retraso Acumulado</span>
              <span className="text-lg font-black font-mono text-rose-600 block">+{stats.totalMinutos} min</span>
              <span className="text-[10px] text-slate-400">Total tiempo perdido</span>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Promedio x Tardanza</span>
              <span className="text-lg font-black font-mono text-slate-800 block">+{stats.promedioMinutos} min</span>
              <span className="text-[10px] text-slate-400">Media por día tarde</span>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Horario Oficial</span>
              <span className="text-lg font-black font-mono text-teal-700 block">07:45 AM</span>
              <span className="text-[10px] text-slate-400">Límite máx: 07:47 AM</span>
            </div>
          </div>
        </div>

        {/* Listado de Tardanzas / Tabla */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {tardanzasFiltradas.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500 opacity-70" />
              <p className="text-xs font-semibold">
                {tardanzas.length === 0
                  ? "Este técnico no tiene tardanzas registradas en este período."
                  : "No se encontraron tardanzas para la búsqueda realizada."}
              </p>
            </div>
          ) : (
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/90 text-[10px] font-black uppercase text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 text-center w-10">#</th>
                    <th className="py-3 px-3">Fecha</th>
                    <th className="py-3 px-3 text-center">Hora Asignada</th>
                    <th className="py-3 px-3 text-center">Hora 1ra OT / Inicio</th>
                    <th className="py-3 px-3 text-center">Retraso</th>
                    <th className="py-3 px-3 text-center">N° Orden (OT)</th>
                    <th className="py-3 px-4">Observación / Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {tardanzasFiltradas.map((item, idx) => {
                    const delay = Number(item.minutos_tarde) || 0;
                    
                    // Extraer hora y orden de asignación efectiva (de la observación si fue calculada explícitamente)
                    const matchAsigObs = (item.observacion || "").match(/Asig\s+(\d{1,2}:\d{2})/i);
                    const matchOtObs = (item.observacion || "").match(/OT\s*#?(\d+)/i);

                    const horaAsigEfectiva = matchAsigObs
                      ? `${matchAsigObs[1]}:00`
                      : item.hora_asignacion;
                    const otEfectiva = (matchOtObs && matchOtObs[1])
                      ? matchOtObs[1]
                      : item.numero_orden;

                    // Extraer hora y fecha de asignación para determinar si realmente fue asignada en la noche previa
                    let asigHoraNum = 0;
                    if (horaAsigEfectiva) {
                      const hPart = formatHora(horaAsigEfectiva);
                      asigHoraNum = parseInt(hPart.slice(0, 2) || "0", 10);
                    }
                    const asigFecha = horaAsigEfectiva ? String(horaAsigEfectiva).slice(0, 10) : "";
                    const itemFecha = item.fecha ? String(item.fecha).slice(0, 10) : "";
                    
                    // Manejar posible día/mes invertido (ej: 2026-01-10 vs 2026-10-01)
                    const partesF = itemFecha.split("-");
                    const fInvertida = `${partesF[0]}-${partesF[2]}-${partesF[1]}`;
                    const esMismoDia = asigFecha === itemFecha || asigFecha === fInvertida;

                    // Solo marcar como "Noche previa" si NO es el mismo día y la hora fue nocturna (>= 17:00 o <= 04:00)
                    const esNochePrevia = !esMismoDia && (asigHoraNum >= 17 || asigHoraNum <= 4);

                    return (
                      <tr key={item.id_asistencia || idx} className="hover:bg-amber-50/40 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-medium font-sans">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-900 whitespace-nowrap">
                          {formatFechaBonita(item.fecha)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {horaAsigEfectiva ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-900 font-black text-xs border border-slate-200">
                                <Clock size={12} className="text-amber-600" />
                                {formatHora(horaAsigEfectiva)}
                              </span>
                              {esNochePrevia && (
                                <span className="text-[9px] font-sans text-amber-700 font-bold tracking-tight">
                                  Noche previa
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-500 font-medium text-xs border border-slate-200">
                              {item.hora_entrada ? formatHora(item.hora_entrada) : "--:--"}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {(item.hora_entrada || item.inicio_visita) ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-900 font-black text-xs border border-teal-200">
                              <Clock size={12} className="text-teal-600" />
                              {formatHora(item.hora_entrada || item.inicio_visita)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-sans text-xs">--:--</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center justify-center min-w-[50px] px-2 py-0.5 rounded-full text-xs font-black ${
                              delay > 30
                                ? "bg-rose-100 text-rose-800 border border-rose-300"
                                : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}
                          >
                            +{delay} min
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          {otEfectiva ? (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono font-bold text-[11px] border border-slate-200">
                              OT #{otEfectiva}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-[11px] text-slate-600 max-w-[260px] truncate" title={item.observacion || ""}>
                          {item.cliente && (
                            <span className="block font-bold text-slate-800 truncate mb-0.5">
                              {item.cliente}
                            </span>
                          )}
                          <span className="text-slate-500 font-mono text-[10px]">
                            {item.observacion || "Registro automático de tardanza"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pie Modal */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldAlert size={14} className="text-amber-500" />
            <span>Tolerancia base: <strong>07:47 AM</strong> (o asignación + 32 min si fue asignada después de las 07:15 AM).</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
