import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, LogOut, User as UserIcon, Shield } from "lucide-react";
import { authService, AuthUser } from "../../services/authService";
import { API_URL } from "../../config/api";

interface UserProfileDropdownProps {
  user?: AuthUser | null;
  className?: string;
  compactOnMobile?: boolean;
}

export const UserProfileDropdown: React.FC<UserProfileDropdownProps> = ({
  user: propUser,
  className = "",
  compactOnMobile = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [avatarImgError, setAvatarImgError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentUser = propUser || authService.getCurrentUser();

  const userName =
    currentUser?.nombreCompleto ||
    `${currentUser?.nombres || ""} ${currentUser?.apellidos || ""}`.trim() ||
    "Usuario";

  const userSoloNombres =
    (currentUser?.nombres || currentUser?.nombreCompleto || "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .join(" ")
      .toUpperCase() || userName.toUpperCase();

  const rolNombre = (currentUser?.rol || "USUARIO").toUpperCase();

  const handleLogout = () => {
    authService.logout();
    window.location.hash = "";
    window.location.reload();
  };

  // Cerrar dropdown al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative shrink-0 ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 py-1 px-1.5 sm:px-2 rounded-2xl hover:bg-slate-100/90 active:scale-98 transition-all cursor-pointer border border-transparent hover:border-slate-200/80 text-left select-none group"
        title={`Cuenta de ${userName} (${rolNombre})`}
      >
        {/* Nombres y Rol (Estilo Corporativo) */}
        <div className={`text-right leading-tight ${compactOnMobile ? "hidden sm:block" : "block"}`}>
          <span className="text-[11px] sm:text-xs font-black text-slate-900 block truncate max-w-[140px] tracking-tight group-hover:text-sky-700 transition-colors">
            {userSoloNombres}
          </span>
          <span className="text-[9px] sm:text-[10px] font-black text-sky-600 uppercase tracking-wider block">
            {rolNombre}
          </span>
        </div>

        {/* Foto de Perfil o Avatar de Iniciales */}
        {currentUser?.foto_personal && !avatarImgError ? (
          <img
            src={`${API_URL}/uploads/${currentUser.foto_personal}`}
            alt={userName}
            className="w-8 h-8 rounded-full object-cover border-2 border-sky-500 shrink-0 shadow-xs group-hover:ring-2 group-hover:ring-sky-300 transition-all"
            onError={() => setAvatarImgError(true)}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-600 to-cyan-500 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs uppercase tracking-tighter border border-sky-400">
            {(userName || "US").slice(0, 2)}
          </div>
        )}

        {/* Flecha desplegable */}
        <ChevronDown
          size={13}
          className={`text-slate-400 group-hover:text-slate-600 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-sky-600" : ""
          }`}
        />
      </button>

      {/* Menú Desplegable Flotante (Limpio: Solo Cerrar Sesión como en el diseño original) */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-1.5 z-[999] animate-in fade-in zoom-in-95 duration-150">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full px-3.5 py-2.5 text-left text-xs font-black text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors"
          >
            <LogOut size={16} className="text-rose-600 shrink-0" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfileDropdown;
