import React from "react";
import { OnlineChatDropdown } from "./OnlineChatDropdown";
import { authService } from "../../services/authService";

interface TeamChatProps {
  userId?: string;
  userName?: string;
  userRol?: string;
  rolNombre?: string;
  hideBar?: boolean;
  compactMode?: boolean;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export const TeamChat: React.FC<TeamChatProps> = ({
  userRol,
  rolNombre,
  hideBar = false,
  leftSlot,
  rightSlot,
}) => {
  const currentUser = authService.getCurrentUser();
  const activeRol = userRol || (currentUser?.id_rol ? String(currentUser.id_rol) : "");
  const activeRolNombre = rolNombre || currentUser?.rol || "";

  // 🛡️ Identificación de Técnico (Ocultar monitor de usuarios si es técnico puro de campo)
  const isTecnico =
    activeRol === "2" ||
    Boolean(
      activeRolNombre &&
        (activeRolNombre.toUpperCase().includes("TECNICO") ||
          activeRolNombre.toUpperCase().includes("TÉCNICO"))
    );

  return (
    <header className="h-14 bg-white border-b border-slate-200/80 px-3 sm:px-5 flex items-center justify-between gap-3 shrink-0 z-20 shadow-2xs">
      {/* 1. Lado Izquierdo: Botón Menú (3 rayitas) */}
      <div className="flex items-center gap-3 min-w-0">
        {leftSlot}
      </div>

      {/* 2. Centro: Monitor de Personal en Línea (Solo roles de oficina) */}
      {!hideBar && !isTecnico && (
        <div className="flex items-center gap-2">
          <OnlineChatDropdown />
        </div>
      )}

      {/* 3. Lado Derecho: Menú de Perfil de Usuario y Cerrar Sesión */}
      <div className="flex items-center gap-2">
        {rightSlot}
      </div>
    </header>
  );
};
