import React, { useState, useEffect } from "react";
import {
  Sliders,
  Check,
  RotateCw,
  Eye,
  EyeOff,
  Building,
  KeyRound,
  Coins,
  Globe,
  AlertCircle,
} from "lucide-react";
import {
  ConfigItem,
  getConfiguracionSistema,
  saveConfiguracionSistema,
} from "../services/settingsService";
import { API_URL } from "../../../config/api";

export const SistemaTab: React.FC = () => {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [conectarGoogleLoading, setConectarGoogleLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [mostrarPassword, setMostrarPassword] = useState(false);

  // Valores de formulario
  const [nameEmpresa, setNameEmpresa] = useState("Cespedes");
  const [moneda, setMoneda] = useState("S/");
  const [trUser, setTrUser] = useState("");
  const [trPassword, setTrPassword] = useState("");
  const [trCodSus, setTrCodSus] = useState("");

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const data = await getConfiguracionSistema();
      setConfigs(data || []);

      const map = new Map(data.map((c) => [c.clave, c.valor]));
      if (map.has("NAME_EMPRESA")) setNameEmpresa(map.get("NAME_EMPRESA") || "");
      if (map.has("MONEDA")) setMoneda(map.get("MONEDA") || "S/");
      if (map.has("TR_USER")) setTrUser(map.get("TR_USER") || "");
      if (map.has("TR_PASSWORD")) setTrPassword(map.get("TR_PASSWORD") || "");
      if (map.has("TR_COD_SUS")) setTrCodSus(map.get("TR_COD_SUS") || "");
    } catch (err: any) {
      console.error("Error al cargar configuración:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg("");
      setSuccessMsg("");

      await saveConfiguracionSistema({
        NAME_EMPRESA: nameEmpresa.trim(),
        MONEDA: moneda.trim(),
        TR_USER: trUser.trim(),
        TR_PASSWORD: trPassword.trim(),
        TR_COD_SUS: trCodSus.trim(),
      });

      setSuccessMsg("¡Configuración del sistema guardada con éxito!");
      setTimeout(() => setSuccessMsg(""), 3500);
      cargarDatos();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const handleConectarGoogle = async () => {
    try {
      setConectarGoogleLoading(true);
      const res = await fetch(`${API_URL}/api/looker/launch-login`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert("Ventana de inicio de sesión de Google abierta. Inicia sesión en la ventana de Chrome que apareció en tu pantalla.");
      } else {
        alert("Aviso: " + (data.error || data.mensaje));
      }
    } catch (err: any) {
      alert("Error al conectar con Google Looker: " + err.message);
    } finally {
      setConectarGoogleLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6 font-sans">
      <form onSubmit={handleGuardar} className="space-y-6">
        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2 text-xs font-bold animate-fade-in">
            <Check size={18} className="text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl flex items-center gap-2 text-xs font-bold animate-fade-in">
            <AlertCircle size={18} className="text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Información General */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Building size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Parámetros de la Empresa</h3>
              <p className="text-xs text-slate-500">Datos generales de cabecera y moneda para comprobantes</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nombre de la Empresa / Razón Comercial
              </label>
              <input
                type="text"
                value={nameEmpresa}
                onChange={(e) => setNameEmpresa(e.target.value)}
                placeholder="ej. Céspedes Telecomunicaciones"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Símbolo de Moneda
              </label>
              <input
                type="text"
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
                placeholder="S/ o $"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* 2. Conexión WIN & Credenciales */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Globe size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Credenciales del Servicio WIN (Tiempo Real)</h3>
              <p className="text-xs text-slate-500">Acceso a la plataforma de averías e importación de órdenes</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Usuario WIN
              </label>
              <input
                type="text"
                value={trUser}
                onChange={(e) => setTrUser(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Contraseña WIN
              </label>
              <div className="relative">
                <input
                  type={mostrarPassword ? "text" : "password"}
                  value={trPassword}
                  onChange={(e) => setTrPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {mostrarPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Código de Suscriptor
              </label>
              <input
                type="text"
                value={trCodSus}
                onChange={(e) => setTrCodSus(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* 3. Conexión Looker Studio */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <Globe size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Looker Studio / Google Analytics</h3>
              <p className="text-xs text-slate-500">Sesión en tiempo real para tarjetas y alertas de averías</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleConectarGoogle}
            disabled={conectarGoogleLoading}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {conectarGoogleLoading ? <RotateCw className="animate-spin" size={15} /> : <Globe size={15} />}
            <span>Conectar Cuenta Google (Looker Studio)</span>
          </button>
        </div>

        {/* Botón Guardar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
          >
            {saving ? <RotateCw className="animate-spin" size={16} /> : <Check size={16} />}
            <span>Guardar Configuración</span>
          </button>
        </div>
      </form>
    </div>
  );
};
