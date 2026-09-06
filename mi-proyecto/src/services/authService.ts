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
    // SuperAdmin o Rol 1 tiene acceso a todo
    if (user.id_rol === 1 || user.rol?.toUpperCase().includes("ADMIN")) return true;
    return user.permisos?.includes(clavePermiso) || false;
  },
};
