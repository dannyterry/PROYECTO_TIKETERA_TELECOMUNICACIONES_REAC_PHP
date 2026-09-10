import React, { useState } from "react";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  RotateCw,
  ShieldCheck,
  AlertCircle,
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
    <div className="min-h-screen w-full flex bg-slate-100 font-sans overflow-hidden">
      {/* ─────────────────────────────────────────────────────────────
          COLUMNA IZQUIERDA: FORMULARIO CORPORATIVO (ESTILO HYPER ADMIN)
      ───────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-[480px] xl:w-[540px] shrink-0 flex flex-col justify-between p-8 sm:p-12 lg:p-16 z-10 bg-white shadow-2xl border-r border-slate-200">
        <div>
          {/* Logo Corporativo Oficial */}
          <div className="mb-8">
            <img
              src="/assets/images/LOGO_CORPORACION.png"
              alt="Corporación Céspedes S.A.C."
              className="h-20 sm:h-24 w-auto object-contain cursor-pointer"
            />
          </div>

          {/* Título y Subtítulo de bienvenida */}
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight mb-2">
              Iniciar sesión
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-normal leading-relaxed">
              Introduzca su dirección de correo electrónico y contraseña para acceder a la cuenta.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-3 text-xs font-semibold animate-in fade-in zoom-in duration-200">
              <AlertCircle size={18} className="text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">
                Usuario
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Ingrese su usuario"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  className="w-full px-4 py-2.5 bg-blue-50/40 border border-blue-200/90 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={mostrarPassword ? "text" : "password"}
                  required
                  placeholder="Ingrese su contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-blue-50/40 border border-blue-200/90 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all font-medium pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#5b73e8] hover:bg-[#4a63df] active:bg-[#3b53cf] text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RotateCw className="animate-spin" size={18} />
                    <span>Validando acceso...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    <span>Ingresar</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer del Formulario */}
        <div className="pt-8 mt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={15} className="text-emerald-500" />
            <span>Conexión Segura</span>
          </div>
          <span>© {new Date().getFullYear()} Corporación Céspedes</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          COLUMNA DERECHA: FOTO DE PRODUCCIÓN (bg-auth.jpg) + TESTIMONIAL
      ───────────────────────────────────────────────────────────── */}
      <div 
        className="hidden lg:flex flex-1 relative bg-cover bg-center items-end justify-center pb-20 px-8"
        style={{ backgroundImage: "url('/assets/images/bg-auth.jpg')" }}
      >
        {/* Sombreado sutil para legibilidad del texto blanco */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

        <div className="relative text-center text-white max-w-lg mx-auto z-10 select-none">
          <h2 className="text-3xl xl:text-4xl font-black mb-3 drop-shadow-lg tracking-tight">
            I love the color!
          </h2>
          <p className="text-sm sm:text-base font-medium italic opacity-95 mb-2 drop-shadow leading-relaxed">
            “ It's a elegant templete. I love it very much! . ”
          </p>
          <span className="text-xs sm:text-sm opacity-85 font-semibold drop-shadow block">
            - Hyper Admin User
          </span>
        </div>
      </div>
    </div>
  );
};
