import React, { useState, useEffect } from "react";
import {
  Mail,
  Server,
  Send,
  Save,
  RotateCw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Users,
  Info,
} from "lucide-react";
import {
  SmtpConfig,
  TecnicoCorreoItem,
  getSmtpConfig,
  saveSmtpConfig,
  getTecnicosConCorreo,
  enviarCorreoPrueba,
} from "../services/settingsService";
import { API_URL } from "../../../config/api";

export const CorreosTab: React.FC = () => {
  const [smtp, setSmtp] = useState<SmtpConfig>({
    EMAIL_HOST: "",
    EMAIL_PORT: "587",
    EMAIL_USER: "",
    EMAIL_PASSWORD: "",
    EMAIL_SECURE: "tls",
    EMAIL_FROM_NAME: "Sistema Telecom",
    EMAIL_PRUEBA: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [msgExito, setMsgExito] = useState("");
  const [msgError, setMsgError] = useState("");

  // Técnicos
  const [tecnicos, setTecnicos] = useState<TecnicoCorreoItem[]>([]);
  const [seleccionados, setSeleccionados] = useState<number[]>([]);
  const [mesReporte, setMesReporte] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [configData, tecnicosData] = await Promise.all([
        getSmtpConfig(),
        getTecnicosConCorreo(),
      ]);
      setSmtp(configData);
      setTecnicos(tecnicosData);
      setSeleccionados(tecnicosData.map((t) => t.id_trabajador));
    } catch (err: any) {
      console.error(err);
      setMsgError("Error al cargar datos del módulo de correo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleGuardarConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMsgExito("");
      setMsgError("");
      await saveSmtpConfig(smtp);
      setMsgExito("Configuración SMTP guardada correctamente.");
      setTimeout(() => setMsgExito(""), 4000);
    } catch (err: any) {
      setMsgError(err.message || "Error al guardar configuración SMTP");
    } finally {
      setSaving(false);
    }
  };

  const handleProbarConexion = async () => {
    try {
      setTesting(true);
      setMsgExito("");
      setMsgError("");
      const res = await enviarCorreoPrueba(smtp.EMAIL_PRUEBA);
      setMsgExito(res.mensaje || "Correo de prueba enviado con éxito.");
      setTimeout(() => setMsgExito(""), 5000);
    } catch (err: any) {
      setMsgError(err.message || "Fallo en la prueba de correo");
    } finally {
      setTesting(false);
    }
  };

  const toggleTodos = () => {
    if (seleccionados.length === tecnicos.length) {
      setSeleccionados([]);
    } else {
      setSeleccionados(tecnicos.map((t) => t.id_trabajador));
    }
  };

  const toggleTecnico = (id: number) => {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Notificaciones */}
      {msgExito && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-xs">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{msgExito}</span>
        </div>
      )}

      {msgError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-xs">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span>{msgError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ─────────────────────────────────────────────────────────────
            1. CONFIGURACIÓN SMTP (5 COLS)
        ───────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-5 space-y-5">
          <form
            onSubmit={handleGuardarConfig}
            className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Server size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Configuración SMTP</h3>
                  <p className="text-xs text-slate-500">Servidor para despacho de correos</p>
                </div>
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Servidor SMTP (Host)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="smtp.gmail.com"
                    value={smtp.EMAIL_HOST}
                    onChange={(e) => setSmtp({ ...smtp, EMAIL_HOST: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Puerto</label>
                  <input
                    type="number"
                    required
                    placeholder="587"
                    value={smtp.EMAIL_PORT}
                    onChange={(e) => setSmtp({ ...smtp, EMAIL_PORT: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Correo Usuario
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="notificaciones@empresa.com"
                    value={smtp.EMAIL_USER}
                    onChange={(e) => setSmtp({ ...smtp, EMAIL_USER: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Seguridad</label>
                  <select
                    value={smtp.EMAIL_SECURE}
                    onChange={(e) => setSmtp({ ...smtp, EMAIL_SECURE: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="tls">TLS (587)</option>
                    <option value="ssl">SSL (465)</option>
                    <option value="">Sin cifrado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contraseña / Clave de Aplicación
                </label>
                <div className="relative">
                  <input
                    type={mostrarPassword ? "text" : "password"}
                    placeholder="••••••••••••••••"
                    value={smtp.EMAIL_PASSWORD || ""}
                    onChange={(e) => setSmtp({ ...smtp, EMAIL_PASSWORD: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword(!mostrarPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {mostrarPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre Visible del Remitente
                </label>
                <input
                  type="text"
                  placeholder="Sistema Telecom"
                  value={smtp.EMAIL_FROM_NAME}
                  onChange={(e) => setSmtp({ ...smtp, EMAIL_FROM_NAME: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Correo de Prueba Destino
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="tucorreo@empresa.com"
                    value={smtp.EMAIL_PRUEBA}
                    onChange={(e) => setSmtp({ ...smtp, EMAIL_PRUEBA: e.target.value })}
                    className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleProbarConexion}
                    disabled={testing}
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {testing ? <RotateCw className="animate-spin" size={14} /> : <Send size={14} />}
                    <span>Probar</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {saving ? <RotateCw className="animate-spin" size={15} /> : <Save size={15} />}
                <span>Guardar Configuración</span>
              </button>
            </div>
          </form>

          {/* Tarjeta de Guía Rápida */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-slate-800 text-xs font-black">
              <Info size={16} className="text-indigo-600" />
              <span>Valores Típicos Recomendados</span>
            </div>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-5 font-medium">
              <li>
                <b>Gmail:</b> smtp.gmail.com · Puerto 465 (SSL) o 587 (TLS) · Contraseña de aplicación de 16 dígitos.
              </li>
              <li>
                <b>Outlook / Office365:</b> smtp.office365.com · Puerto 587 (TLS).
              </li>
              <li>
                <b>cPanel Webmail:</b> mail.tudominio.com · Puerto 465 (SSL) · Usuario completo y clave de cuenta.
              </li>
            </ul>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            2. ENVÍO DE REPORTES A TÉCNICOS (7 COLS)
        ───────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Despacho de Reportes a Técnicos</h3>
                  <p className="text-xs text-slate-500">Envío masivo o individual de liquidaciones en PDF</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="month"
                  value={mesReporte}
                  onChange={(e) => setMesReporte(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            {/* Acciones de Despacho Masivo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => {
                  alert("Generando y despachando reportes diarios a los técnicos seleccionados...");
                }}
                disabled={seleccionados.length === 0}
                className="p-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer disabled:opacity-40"
              >
                <div className="flex items-center gap-1.5 text-xs font-black text-indigo-900">
                  <Calendar size={15} />
                  <span>Reporte Diario (Hoy)</span>
                </div>
                <span className="text-[10px] text-indigo-600 font-semibold mt-0.5">Órdenes de hoy</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  alert(`Generando y despachando reportes del mes (${mesReporte}) a los técnicos seleccionados...`);
                }}
                disabled={seleccionados.length === 0}
                className="p-3 bg-teal-50 hover:bg-teal-100 border border-teal-200/80 rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer disabled:opacity-40"
              >
                <div className="flex items-center gap-1.5 text-xs font-black text-teal-900">
                  <FileText size={15} />
                  <span>Reporte Mensual</span>
                </div>
                <span className="text-[10px] text-teal-600 font-semibold mt-0.5">Mes {mesReporte}</span>
              </button>

              <button
                type="button"
                onClick={toggleTodos}
                className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer"
              >
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                  <Users size={15} />
                  <span>Marcar / Desmarcar</span>
                </div>
                <span className="text-[10px] text-slate-500 font-semibold mt-0.5">
                  {seleccionados.length} de {tecnicos.length} seleccionados
                </span>
              </button>
            </div>

            {/* Tabla de Técnicos con Correo */}
            <div className="overflow-hidden border border-slate-100 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={tecnicos.length > 0 && seleccionados.length === tecnicos.length}
                        onChange={toggleTodos}
                        className="rounded accent-indigo-600 cursor-pointer"
                      />
                    </th>
                    <th className="p-3">Técnico Asignado</th>
                    <th className="p-3">Correo Electrónico</th>
                    <th className="p-3 text-center">Previsualizar PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 font-bold">
                        <RotateCw className="animate-spin inline-block mr-2" size={16} />
                        Cargando personal técnico...
                      </td>
                    </tr>
                  ) : tecnicos.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400">
                        No se encontraron técnicos con correo registrado. Puedes asignarlos en el módulo Personal.
                      </td>
                    </tr>
                  ) : (
                    tecnicos.map((t) => {
                      const isChecked = seleccionados.includes(t.id_trabajador);
                      return (
                        <tr key={t.id_trabajador} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleTecnico(t.id_trabajador)}
                              className="rounded accent-indigo-600 cursor-pointer"
                            />
                          </td>
                          <td className="p-3 font-bold text-slate-900">{t.tecnico}</td>
                          <td className="p-3 text-slate-600">{t.email}</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <a
                                href={`/corporacionescepe/public/correos/previsualizar?id=${t.id_trabajador}&tipo=d`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-black transition-all cursor-pointer"
                                title="Ver reporte diario en PDF"
                              >
                                Hoy
                              </a>
                              <a
                                href={`/corporacionescepe/public/correos/previsualizar?id=${t.id_trabajador}&tipo=m&mes=${mesReporte}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-[11px] font-black transition-all cursor-pointer"
                                title="Ver reporte mensual en PDF"
                              >
                                Mes
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
