import { API_URL } from "../../../config/api";
import {
  FichaSupervisionCampo,
  AuditoriaCalidadCliente,
  TecnicoCombo,
  SupervisionStats,
} from "../types/supervisionTypes";

export const supervisionService = {
  // 1. Obtener lista de técnicos con DNI y cuadrilla para selector
  async getTecnicosCombo(): Promise<TecnicoCombo[]> {
    try {
      const res = await fetch(`${API_URL}/api/supervision/tecnicos-combo`);
      const data = await res.json();
      return data.success && Array.isArray(data.data) ? data.data : [];
    } catch (e) {
      console.error("Error al obtener técnicos combo:", e);
      return [];
    }
  },

  // 1.1 Obtener lista de supervisores y coordinadores
  async getSupervisoresCombo(): Promise<SupervisorCombo[]> {
    try {
      const res = await fetch(`${API_URL}/api/supervision/supervisores-combo`);
      const data = await res.json();
      return data.success && Array.isArray(data.data) ? data.data : [];
    } catch (e) {
      console.error("Error al obtener supervisores combo:", e);
      return [];
    }
  },

  // 1.2 Buscar órdenes por OT, Ticket, Código de Pedido o Cliente
  async buscarOrdenes(query: string): Promise<OrdenBusqueda[]> {
    if (!query || !query.trim()) return [];
    try {
      const res = await fetch(`${API_URL}/api/supervision/buscar-orden?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      return data.success && Array.isArray(data.data) ? data.data : [];
    } catch (e) {
      console.error("Error al buscar órdenes:", e);
      return [];
    }
  },

  // 2. Fichas de Supervisión en Campo
  async getSupervisionesCampo(filters?: {
    desde?: string;
    hasta?: string;
    tecnico?: string;
    tipo_inspeccion?: string;
    supervisor?: string;
  }): Promise<FichaSupervisionCampo[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.desde) params.append("desde", filters.desde);
      if (filters?.hasta) params.append("hasta", filters.hasta);
      if (filters?.tecnico) params.append("tecnico", filters.tecnico);
      if (filters?.tipo_inspeccion && filters.tipo_inspeccion !== "TODOS")
        params.append("tipo_inspeccion", filters.tipo_inspeccion);
      if (filters?.supervisor) params.append("supervisor", filters.supervisor);

      const res = await fetch(`${API_URL}/api/supervision/campo?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        return data.data.map((item: any) => ({
          ...item,
          items_json: typeof item.items_json === "string" ? JSON.parse(item.items_json) : (item.items_json || []),
        }));
      }
      return [];
    } catch (e) {
      console.error("Error al obtener supervisiones en campo:", e);
      return [];
    }
  },

  async saveSupervisionCampo(ficha: FichaSupervisionCampo): Promise<{ success: boolean; id?: number; message?: string }> {
    try {
      const res = await fetch(`${API_URL}/api/supervision/campo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ficha),
      });
      return await res.json();
    } catch (e: any) {
      console.error("Error al guardar supervisión en campo:", e);
      return { success: false, message: e.message || "Error al guardar" };
    }
  },

  async deleteSupervisionCampo(id: number): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${API_URL}/api/supervision/campo/${id}`, {
        method: "DELETE",
      });
      return await res.json();
    } catch (e: any) {
      console.error("Error al eliminar supervisión:", e);
      return { success: false, message: e.message };
    }
  },

  // 3. Auditorías de Calidad al Cliente (Encuestas)
  async getAuditoriasCalidad(filters?: {
    desde?: string;
    hasta?: string;
    tecnico?: string;
    estado_conformidad?: string;
    auditor?: string;
  }): Promise<AuditoriaCalidadCliente[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.desde) params.append("desde", filters.desde);
      if (filters?.hasta) params.append("hasta", filters.hasta);
      if (filters?.tecnico) params.append("tecnico", filters.tecnico);
      if (filters?.estado_conformidad && filters.estado_conformidad !== "TODOS")
        params.append("estado_conformidad", filters.estado_conformidad);
      if (filters?.auditor) params.append("auditor", filters.auditor);

      const res = await fetch(`${API_URL}/api/supervision/calidad-cliente?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        return data.data.map((item: any) => ({
          ...item,
          preguntas_json: typeof item.preguntas_json === "string" ? JSON.parse(item.preguntas_json) : (item.preguntas_json || []),
        }));
      }
      return [];
    } catch (e) {
      console.error("Error al obtener auditorías de calidad:", e);
      return [];
    }
  },

  async saveAuditoriaCalidad(auditoria: AuditoriaCalidadCliente): Promise<{ success: boolean; id?: number; message?: string }> {
    try {
      const res = await fetch(`${API_URL}/api/supervision/calidad-cliente`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auditoria),
      });
      return await res.json();
    } catch (e: any) {
      console.error("Error al guardar auditoría de calidad:", e);
      return { success: false, message: e.message || "Error al guardar" };
    }
  },

  async deleteAuditoriaCalidad(id: number): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${API_URL}/api/supervision/calidad-cliente/${id}`, {
        method: "DELETE",
      });
      return await res.json();
    } catch (e: any) {
      console.error("Error al eliminar auditoría de calidad:", e);
      return { success: false, message: e.message };
    }
  },

  // 4. Estadísticas Globales
  async getSupervisionStats(filters?: { desde?: string; hasta?: string }): Promise<SupervisionStats | null> {
    try {
      const params = new URLSearchParams();
      if (filters?.desde) params.append("desde", filters.desde);
      if (filters?.hasta) params.append("hasta", filters.hasta);

      const res = await fetch(`${API_URL}/api/supervision/stats?${params.toString()}`);
      const data = await res.json();
      return data.success ? data : null;
    } catch (e) {
      console.error("Error al obtener estadísticas de supervisión:", e);
      return null;
    }
  },
};
