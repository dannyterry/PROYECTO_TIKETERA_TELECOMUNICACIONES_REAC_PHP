export interface Order {
  id: number;
  fecha: string;
  celular: string;
  inconcert: boolean | string;
  observacionLlamada?: string;
  tipoTrabajoAsignado?: string;
  dni?: string;
  acta?: string;
  ticket: string; // Número de Ticket (Ej. VTEXT-46622578, AT-46811549, VT-46635497)
  codigoPedido?: string; // Código de Pedido / Cod Seguimiento Cliente
  ot?: string; // OT (Ej. 3367633, 3367728)
  numeroOrden?: string;
  cliente: string;
  direccion?: string;
  distrito?: string;
  cto?: string;
  cajaPosicionPasivo?: string;
  tecnico?: string; // Nombre del técnico o "Seleccione"
  idTecnico?: number | string;
  idTecnicoReemplazo?: number | string;
  nombreTecnico2?: string;
  horaAsignacion?: string;
  horaEnCamino?: string;
  horaInicio?: string;
  horaFin?: string;
  tramo?: string;
  status: OrderStatus;
  cuadrilla?: string;
  observacionesAtencion?: string;
  motivoFinalizacion?: string;
  motivoCancelacion?: string;
  motivoRegestion?: string;
  motivoAnulacion?: string;
  tipoLiquidacion?: string;
  motivoLiquidacion?: string;
  tipoAveria?: string;
  tipoTrabajo?: string;
  totalDrop?: number | string;
  anchoBanda?: string;
  esReiterada?: boolean;
  totalOrdenesCliente?: number;
  esReiteradaTecnico?: boolean;
  totalOrdenesMismoTecnico?: number;
  georeferencia?: string;
  totalTareas?: number;
  tareasFinalizadas?: number;
  progresoPorcentaje?: number;
}

export type OrderStatus =
  // 🟡 AMARILLOS
  | "Cancelada"
  | "Cancelado"
  | "Observada"
  | "Observado"
  | "Regestion"
  | "Anulado"
  | "Anulados"
  // 🔵 AZULES
  | "Finalizada"
  | "Finalizados"
  | "Fenix"
  // 🟢 VERDES
  | "Iniciada"
  | "Iniciados"
  | "En camino"
  | "En proceso"
  | "Proceso"
  // ⚪ NEUTROS
  | "Agendada"
  | "Pendiente"
  | string;

export interface OrderFilters {
  fechaDesde: string;
  fechaHasta: string;
  status: string;
  tecnico: string;
  cuadrilla?: string;
  inconcert: string;
  search: string;
}
