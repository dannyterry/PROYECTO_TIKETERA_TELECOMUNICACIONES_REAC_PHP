import { API_URL } from "../config/api";

export interface AuthUser {
  id_usuario: number;
  id_rol: number;
  usuario: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  email: string;
  rol: string;
  area?: string;
  foto_personal?: string | null;
  permisos: string[];
}

export interface LoginResponse {
  success: boolean;
  user?: AuthUser;
  mensaje?: string;
}

const STORAGE_KEY = "telecom_auth_user";

export const authService = {
  async login(usuario: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, password }),
    });
    const data = await res.json();
    if (res.ok && data.success && data.user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
    }
    return data;
  },

  logout(): void {
    const user = this.getCurrentUser();
    if (user?.id_usuario) {
      fetch(`${API_URL}/api/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_usuario: user.id_usuario }),
      }).catch(() => {});
    }
    localStorage.removeItem(STORAGE_KEY);
    window.location.hash = "login";
  },

  getCurrentUser(): AuthUser | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  hasPermission(clavePermiso: string): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    // SuperAdmin o Rol 1 tiene acceso irrestricto a todo
    if (user.id_rol === 1 || user.rol?.toUpperCase().includes("ADMIN")) return true;
    return user.permisos?.includes(clavePermiso) || false;
  },

  hasAnyPermission(claves: string[]): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    if (user.id_rol === 1 || user.rol?.toUpperCase().includes("ADMIN")) return true;
    if (!user.permisos || !Array.isArray(user.permisos)) return false;
    return claves.some((c) => user.permisos.includes(c));
  },

  hasModulePermission(modulo: string): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    if (user.id_rol === 1 || user.rol?.toUpperCase().includes("ADMIN")) return true;
    if (!user.permisos || !Array.isArray(user.permisos)) return false;
    return user.permisos.some((p) => p.startsWith(`${modulo}.`) || p === modulo);
  },

  canAccessModule(moduleId: string): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    if (user.id_rol === 1 || user.rol?.toUpperCase().includes("ADMIN")) return true;

    switch (moduleId) {
      case "dashboard":
        return this.hasPermission("dashboard.ver");

      case "ordenes":
        return this.hasAnyPermission([
          "ordenes.ver",
          "ordenes.crear",
          "ordenes.editar",
          "ordenes.eliminar",
          "ordenes.liquidar",
          "ordenes.sincronizar",
        ]);

      case "portal-tecnico":
        return (
          user.id_rol === 2 ||
          user.rol?.toUpperCase().includes("TECNICO") ||
          this.hasAnyPermission(["liquidaciones.ver", "liquidaciones.crear"])
        );

      case "personal":
        return this.hasAnyPermission([
          "usuarios.ver",
          "usuarios.crear",
          "usuarios.editar",
          "trabajadores.ver",
          "trabajadores.crear",
          "roles.ver",
          "asistencias.ver",
          "horarios.ver",
          "permisos.ver",
        ]);

      case "inventario":
        return this.hasAnyPermission([
          "productos.ver",
          "stock.ver",
          "compras.ver",
          "almacenes.ver",
          "proveedores.ver",
          "movimientos.ver",
          "categorias.ver",
          "liquidaciones.ver",
        ]);

      case "movilidad":
        return this.hasAnyPermission([
          "vehiculos.ver",
          "vehiculos.crear",
          "vehiculos.editar",
          "combustibles.ver",
          "combustibles.crear",
        ]);

      case "pagos":
        return (
          user.id_rol !== 2 &&
          this.hasAnyPermission([
            "liquidaciones.ver",
            "liquidaciones.aprobar",
            "liquidaciones.exportar",
          ])
        );

      case "configuracion":
        return this.hasAnyPermission([
          "configuracion.ver",
          "configuracion.editar",
          "motivos.ver",
          "tipo_trabajo.ver",
          "permisos.ver",
        ]);

      default:
        return false;
    }
  },

  getDefaultView(): string {
    const user = this.getCurrentUser();
    if (!user) return "login";

    // Si es técnico de campo, su portal principal
    if (user.id_rol === 2 || user.rol?.toUpperCase().includes("TECNICO")) {
      return "portal-tecnico";
    }

    if (this.canAccessModule("dashboard")) return "dashboard";
    if (this.canAccessModule("ordenes")) return "ordenes";
    if (this.canAccessModule("inventario")) return "inventario";
    if (this.canAccessModule("personal")) return "personal";
    if (this.canAccessModule("movilidad")) return "movilidad";
    if (this.canAccessModule("pagos")) return "pagos";
    if (this.canAccessModule("configuracion")) return "configuracion";

    return "ordenes";
  },

  async refreshUserPermissions(): Promise<string[]> {
    const user = this.getCurrentUser();
    if (!user || !user.id_rol) return [];
    try {
      const res = await fetch(`${API_URL}/api/permisos/rol/${user.id_rol}`);
      if (!res.ok) return user.permisos || [];
      const data = await res.json();
      if (data && Array.isArray(data.claves)) {
        const freshUser: AuthUser = {
          ...user,
          permisos: data.claves,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(freshUser));
        return data.claves;
      }
    } catch (e) {
      console.error("Error al sincronizar permisos de usuario:", e);
    }
    return user.permisos || [];
  },
};

