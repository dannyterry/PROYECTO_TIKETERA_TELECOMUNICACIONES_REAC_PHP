import React, { useState } from "react";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  RotateCw,
  ShieldCheck,
  AlertCircle,
  Radio,
} from "lucide-react";
import { authService, AuthUser } from "../services/authService";

interface LoginProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginPage: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !password.trim()) {
      setErrorMsg("Por favor ingrese su usuario y contraseña.");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg("");
      const res = await authService.login(usuario, password);

      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMsg(res.mensaje || "Credenciales incorrectas.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-950 text-white font-sans overflow-hidden">
      {/* Columna Izquierda: Formulario de Login */}
      <div className="w-full lg:w-[480px] xl:w-[520px] shrink-0 flex flex-col justify-between p-8 sm:p-12 lg:p-16 z-10 bg-slate-900/90 backdrop-blur-xl border-r border-slate-800/80">
        <div>
          {/* Logo Corporativo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-teal-400 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/25">
              <Radio size={24} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white uppercase">
                Corporación Céspedes
              </h1>
              <span className="text-[11px] font-bold text-teal-400 tracking-wider uppercase block">
                Telecomunicaciones & Redes
              </span>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-white tracking-tight">
              Bienvenido de nuevo
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-1.5">
              Ingrese sus credenciales corporativas para acceder a la plataforma unificada.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 bg-rose-950/50 border border-rose-800/60 text-rose-300 rounded-2xl flex items-center gap-3 text-xs font-bold animate-in fade-in zoom-in duration-200">
              <AlertCircle size={18} className="text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                Usuario
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                  <User size={17} />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Ingrese su usuario"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                  <Lock size={17} />
                </div>
                <input
                  type={mostrarPassword ? "text" : "password"}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer transition-colors"
                >
                  {mostrarPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 via-indigo-500 to-teal-500 hover:from-indigo-500 hover:to-teal-400 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98] mt-6"
            >
              {loading ? (
                <>
                  <RotateCw className="animate-spin" size={16} />
                  <span>Validando acceso...</span>
                </>
              ) : (
                <>
                  <span>Ingresar a la Plataforma</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer del Formulario */}
        <div className="pt-8 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-teal-400" />
            <span>Sistema Seguro 256-bit</span>
          </div>
          <span>© {new Date().getFullYear()} Céspedes</span>
        </div>
      </div>

      {/* Columna Derecha: Ilustración y Branding Ejecutivo */}
      <div className="hidden lg:flex flex-1 relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 items-center justify-center p-12 overflow-hidden">
        {/* Glows Decorativos de fondo */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-xl text-center space-y-6 z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 text-xs font-bold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Sistema Integral de Telecomunicaciones</span>
          </div>

          <h2 className="text-3xl xl:text-4xl font-black text-white tracking-tight leading-tight">
            Gestión Operativa, Liquidaciones e Inventario en Tiempo Real
          </h2>

          <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-md mx-auto">
            Plataforma React de alta disponibilidad para despacho técnico, control de almacén, liquidaciones con WIN y auditoría 24/7.
          </p>

          <div className="grid grid-cols-3 gap-4 pt-6 max-w-md mx-auto">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 backdrop-blur-xs">
              <span className="text-xl font-black text-white block">100%</span>
              <span className="text-[11px] text-slate-400 font-semibold">En la Nube</span>
            </div>
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 backdrop-blur-xs">
              <span className="text-xl font-black text-teal-400 block">WIN</span>
              <span className="text-[11px] text-slate-400 font-semibold">Integración</span>
            </div>
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 backdrop-blur-xs">
              <span className="text-xl font-black text-indigo-400 block">GPS</span>
              <span className="text-[11px] text-slate-400 font-semibold">Auditoría 24/7</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
