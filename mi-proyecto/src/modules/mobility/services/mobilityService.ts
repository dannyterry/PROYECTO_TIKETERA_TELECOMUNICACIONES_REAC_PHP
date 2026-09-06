import axios from "axios";
import { API_URL } from "@/config/api";
import {
  Vehiculo,
  Tecnico,
  Inspeccion,
  CargaCombustible,
  ResumenCombustible,
  DashboardKmResumen,
  CatalogosFlota,
  Marca,
  Modelo,
  TipoVehiculo,
} from "../types/mobilityTypes";

export const getVehiculos = async (): Promise<Vehiculo[]> => {
  const res = await axios.get(`${API_URL}/api/movilidad/vehiculos`);
  return res.data;
};

export const getCatalogosFlota = async (): Promise<CatalogosFlota> => {
  const res = await axios.get(`${API_URL}/api/movilidad/catalogos`);
  return res.data;
};

export const crearVehiculo = async (data: Partial<Vehiculo>) => {
  const res = await axios.post(`${API_URL}/api/movilidad/vehiculos`, data);
  return res.data;
};

export const actualizarVehiculo = async (id: number, data: Partial<Vehiculo>) => {
  const res = await axios.put(`${API_URL}/api/movilidad/vehiculos/${id}`, data);
  return res.data;
};

// CRUD Marcas
export const crearMarca = async (data: { nombre: string; estado?: string }) => {
  const res = await axios.post(`${API_URL}/api/movilidad/marcas`, data);
  return res.data;
};

export const actualizarMarca = async (id: number, data: { nombre?: string; estado?: string }) => {
  const res = await axios.put(`${API_URL}/api/movilidad/marcas/${id}`, data);
  return res.data;
};

export const desactivarMarca = async (id: number) => {
  const res = await axios.delete(`${API_URL}/api/movilidad/marcas/${id}`);
  return res.data;
};

// CRUD Modelos
export const crearModelo = async (data: { nombre: string; estado?: string }) => {
  const res = await axios.post(`${API_URL}/api/movilidad/modelos`, data);
  return res.data;
};

export const actualizarModelo = async (id: number, data: { nombre?: string; estado?: string }) => {
  const res = await axios.put(`${API_URL}/api/movilidad/modelos/${id}`, data);
  return res.data;
};

export const desactivarModelo = async (id: number) => {
  const res = await axios.delete(`${API_URL}/api/movilidad/modelos/${id}`);
  return res.data;
};

// CRUD Tipos de Vehículo
export const crearTipoVehiculo = async (data: { nombre: string; estado?: string }) => {
  const res = await axios.post(`${API_URL}/api/movilidad/tipos-vehiculo`, data);
  return res.data;
};

export const actualizarTipoVehiculo = async (id: number, data: { nombre?: string; estado?: string }) => {
  const res = await axios.put(`${API_URL}/api/movilidad/tipos-vehiculo/${id}`, data);
  return res.data;
};

export const desactivarTipoVehiculo = async (id: number) => {
  const res = await axios.delete(`${API_URL}/api/movilidad/tipos-vehiculo/${id}`);
  return res.data;
};

export const getTecnicos = async (): Promise<Tecnico[]> => {
  const res = await axios.get(`${API_URL}/api/movilidad/tecnicos`);
  return res.data;
};

export const reasignarVehiculo = async (data: {
  id_vehiculo: number;
  id_trabajador: number | null;
  motivo_cambio?: string;
}) => {
  const res = await axios.put(`${API_URL}/api/movilidad/reasignar-vehiculo`, data);
  return res.data;
};

export const registrarInspeccionInicio = async (formData: FormData) => {
  const res = await axios.post(`${API_URL}/api/movilidad/inspeccion/inicio`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const registrarInspeccionFin = async (formData: FormData) => {
  const res = await axios.post(`${API_URL}/api/movilidad/inspeccion/fin`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const getInspecciones = async (params?: {
  fecha_desde?: string;
  fecha_hasta?: string;
  id_vehiculo?: number;
  id_trabajador?: number;
  estado?: string;
}): Promise<Inspeccion[]> => {
  const res = await axios.get(`${API_URL}/api/movilidad/inspecciones`, { params });
  return res.data;
};

export const auditarInspeccion = async (
  id_inspeccion: number,
  data: { estado_auditoria: "Aprobado" | "Observado"; observaciones_admin?: string }
) => {
  const res = await axios.put(`${API_URL}/api/movilidad/inspecciones/${id_inspeccion}/auditar`, data);
  return res.data;
};

export const registrarCombustible = async (formData: FormData) => {
  const res = await axios.post(`${API_URL}/api/movilidad/combustible`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const getCombustibles = async (params?: {
  fecha_desde?: string;
  fecha_hasta?: string;
  id_vehiculo?: number;
}): Promise<{ registros: CargaCombustible[]; resumen: ResumenCombustible }> => {
  const res = await axios.get(`${API_URL}/api/movilidad/combustible`, { params });
  return res.data;
};

export const eliminarCombustible = async (id: number) => {
  const res = await axios.delete(`${API_URL}/api/movilidad/combustible/${id}`);
  return res.data;
};

export const getDashboardKm = async (params?: {
  fecha_desde?: string;
  fecha_hasta?: string;
}): Promise<{
  inspecciones: Inspeccion[];
  resumen: DashboardKmResumen;
  alertasDesvio: Inspeccion[];
}> => {
  const res = await axios.get(`${API_URL}/api/movilidad/dashboard-km`, { params });
  return res.data;
};

export const registrarLogGps = async (data: {
  id_trabajador: number;
  id_vehiculo?: number;
  lat: number;
  lng: number;
  tipo_evento?: string;
  referencia_id?: string;
  descripcion?: string;
}) => {
  try {
    const res = await axios.post(`${API_URL}/api/movilidad/gps-log`, data);
    return res.data;
  } catch (err: any) {
    console.warn("Aviso al guardar log GPS:", err.message);
    return null;
  }
};

export const getRecorridoTecnico = async (
  idTrabajador: number,
  fecha?: string
) => {
  const res = await axios.get(`${API_URL}/api/movilidad/recorrido-tecnico/${idTrabajador}`, {
    params: { fecha },
  });
  return res.data;
};

export const getImageUrl = (filename?: string): string => {
  if (!filename) return "";
  if (filename.startsWith("http")) return filename;
  return `${API_URL}/uploads/${filename}`;
};
