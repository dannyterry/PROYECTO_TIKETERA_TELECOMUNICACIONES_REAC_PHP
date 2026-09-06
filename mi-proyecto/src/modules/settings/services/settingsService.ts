import { API_URL } from "../../../config/api";

// --- Tipos para Motivos ---
export interface MotivoItem {
  id_motivo: number;
  nombre: string;
  tipo_trabajo: string;
  precio_compra: number | string;
  precio_venta: number | string;
  limites_materiales: string | null;
  estado: "Activo" | "Inactivo";
  fecha_creacion?: string;
}

// --- Tipos para Tipos de Trabajo ---
export interface TipoTrabajoItem {
  id_tipo_trabajo: number;
  nombre: string;
  estado: "Activo" | "Inactivo";
}

// --- Tipos para Sistema / Variables ---
export interface ConfigItem {
  id: number;
  clave: string;
  valor: string;
  descripcion: string;
  grupo: string;
  updated_at?: string;
}

// --- Tipos para Permisos ---
export interface PermisoItem {
  id_permiso: number;
  nombre: string;
  clave: string;
  modulo: string;
  estado: string;
}

export interface RolPermisoResumen {
  id_rol: number;
  nombre_rol: string;
  estado: string;
  total_permisos: number;
  modulos_activos: string | null;
}

// --- API MOTIVOS ---
export const getMotivos = async (): Promise<MotivoItem[]> => {
  const res = await fetch(`${API_URL}/api/motivos`);
  if (!res.ok) throw new Error("Error al obtener motivos");
  return res.json();
};

export const createMotivo = async (data: Partial<MotivoItem>) => {
  const res = await fetch(`${API_URL}/api/motivos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al crear motivo");
  }
  return res.json();
};

export const updateMotivo = async (id: number, data: Partial<MotivoItem>) => {
  const res = await fetch(`${API_URL}/api/motivos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al actualizar motivo");
  }
  return res.json();
};

export const deleteMotivo = async (id: number) => {
  const res = await fetch(`${API_URL}/api/motivos/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al desactivar motivo");
  }
  return res.json();
};

// --- API TIPOS DE TRABAJO ---
export const getTiposTrabajo = async (): Promise<TipoTrabajoItem[]> => {
  const res = await fetch(`${API_URL}/api/tipos-trabajo`);
  if (!res.ok) throw new Error("Error al obtener tipos de trabajo");
  return res.json();
};

export const createTipoTrabajo = async (data: { nombre: string; estado?: string }) => {
  const res = await fetch(`${API_URL}/api/tipos-trabajo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al crear tipo de trabajo");
  }
  return res.json();
};

export const updateTipoTrabajo = async (id: number, data: { nombre?: string; estado?: string }) => {
  const res = await fetch(`${API_URL}/api/tipos-trabajo/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al actualizar tipo de trabajo");
  }
  return res.json();
};

export const deleteTipoTrabajo = async (id: number) => {
  const res = await fetch(`${API_URL}/api/tipos-trabajo/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al desactivar tipo de trabajo");
  }
  return res.json();
};

// --- API CONFIGURACIÓN DEL SISTEMA ---
export const getConfiguracionSistema = async (): Promise<ConfigItem[]> => {
  const res = await fetch(`${API_URL}/api/configuracion/sistema`);
  if (!res.ok) throw new Error("Error al obtener configuraciones del sistema");
  return res.json();
};

export const saveConfiguracionSistema = async (data: Record<string, any>) => {
  const res = await fetch(`${API_URL}/api/configuracion/sistema`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al guardar configuración");
  }
  return res.json();
};

// --- API PERMISOS ---
export const getPermisosResumen = async (): Promise<{ roles: RolPermisoResumen[]; permisos: PermisoItem[] }> => {
  const res = await fetch(`${API_URL}/api/permisos/resumen`);
  if (!res.ok) throw new Error("Error al obtener resumen de permisos");
  return res.json();
};

export const getPermisosRol = async (id_rol: number | string): Promise<{ claves: string[]; permisos: PermisoItem[] }> => {
  const res = await fetch(`${API_URL}/api/permisos/rol/${id_rol}`);
  if (!res.ok) throw new Error("Error al obtener permisos del rol");
  return res.json();
};

export const savePermisosRol = async (id_rol: number | string, claves: string[]) => {
  const res = await fetch(`${API_URL}/api/permisos/guardar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_rol, claves }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al guardar permisos");
  }
  return res.json();
};

export const deletePermisosRol = async (id_rol: number | string) => {
  const res = await fetch(`${API_URL}/api/permisos/rol/${id_rol}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al limpiar permisos");
  }
  return res.json();
};

// --- API CORREOS / SMTP ---
export interface SmtpConfig {
  EMAIL_HOST: string;
  EMAIL_PORT: string;
  EMAIL_USER: string;
  EMAIL_PASSWORD?: string;
  EMAIL_SECURE: 'tls' | 'ssl' | '';
  EMAIL_FROM_NAME: string;
  EMAIL_PRUEBA: string;
}

export interface TecnicoCorreoItem {
  id_trabajador: number;
  tecnico: string;
  email: string;
}

export const getSmtpConfig = async (): Promise<SmtpConfig> => {
  const res = await fetch(`${API_URL}/api/correos/config`);
  if (!res.ok) throw new Error("Error al obtener configuración de correo");
  return res.json();
};

export const saveSmtpConfig = async (data: SmtpConfig) => {
  const res = await fetch(`${API_URL}/api/correos/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al guardar configuración SMTP");
  }
  return res.json();
};

export const getTecnicosConCorreo = async (): Promise<TecnicoCorreoItem[]> => {
  const res = await fetch(`${API_URL}/api/correos/tecnicos`);
  if (!res.ok) throw new Error("Error al obtener técnicos con correo");
  return res.json();
};

export const enviarCorreoPrueba = async (email?: string) => {
  const res = await fetch(`${API_URL}/api/correos/enviar-prueba`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.mensaje || "Error al enviar correo de prueba");
  }
  return data;
};
