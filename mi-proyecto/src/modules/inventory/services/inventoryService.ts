import axios from "axios";
import { API_URL } from "../../../config/api";
import {
  ProductoStock,
  StockTecnicoDetalle,
  SerieTecnicoDetalle,
  Proveedor,
  CompraPayload,
  DespachoPayload,
  EquipoRetirado,
  ActaLiquidacionPayload,
  MotivoItem,
  ActaTecnicoResumen,
} from "../types/inventoryTypes";

const api = axios.create({
  baseURL: `${API_URL}/api`,
});

export const getStockGeneral = async (): Promise<{
  productos: ProductoStock[];
  stockPorTecnico: StockTecnicoDetalle[];
  seriesTecnicos: SerieTecnicoDetalle[];
}> => {
  const res = await api.get("/almacen/stock-general");
  return res.data;
};

export const getProveedores = async (): Promise<Proveedor[]> => {
  const res = await api.get("/almacen/proveedores");
  return res.data;
};

export const getCategorias = async (): Promise<{ id_categoria: number; nombre: string; descripcion?: string }[]> => {
  const res = await api.get("/almacen/categorias");
  return res.data;
};

export const crearProducto = async (payload: {
  nombre: string;
  categoria?: string;
  id_categoria?: number;
  codigo?: string;
  stock_minimo?: number;
  maneja_serie?: boolean | number;
  es_drop?: boolean | number;
  precio_compra?: number;
}): Promise<{ success: boolean; message: string; producto: ProductoStock }> => {
  const res = await api.post("/almacen/productos", payload);
  return res.data;
};

export const consultarSunatRuc = async (ruc: string) => {
  const res = await axios.get(`${API_URL}/sunat/ruc/${ruc.trim()}`);
  return res.data;
};

export const registrarCompra = async (payload: CompraPayload) => {
  const res = await api.post("/almacen/compras", payload);
  return res.data;
};

export const despacharATecnico = async (payload: DespachoPayload) => {
  const res = await api.post("/almacen/despacho-tecnico", payload);
  return res.data;
};

export const getTecnicoStock = async (idTrabajador: number | string) => {
  const res = await api.get(`/almacen/tecnico-stock/${idTrabajador}`);
  return res.data;
};

export const getTecnicoDotacionCompleta = async (idTrabajador: number | string) => {
  const res = await api.get(`/almacen/tecnico-dotacion-completa/${idTrabajador}`);
  return res.data;
};

export const liquidarActaOrden = async (idOrden: number | string, payload: ActaLiquidacionPayload) => {
  const res = await api.post(`/ordenes/${idOrden}/liquidar-acta`, payload);
  return res.data;
};

export const getActaLiquidacion = async (idOrden: number | string) => {
  const res = await api.get(`/ordenes/${idOrden}/acta-liquidacion`);
  return res.data;
};

export const getEquiposRecogidos = async (): Promise<EquipoRetirado[]> => {
  const res = await api.get("/almacen/equipos-recogidos");
  return res.data;
};

export const internarEquipoRecogido = async (payload: {
  id_equipo_retirado: number;
  estado_destino: string;
  recibido_por?: string;
  observaciones?: string;
}) => {
  const res = await api.post("/almacen/internar-equipo", payload);
  return res.data;
};

export const getTrazabilidadSerie = async (serie: string) => {
  const res = await api.get(`/almacen/trazabilidad-serie/${encodeURIComponent(serie)}`);
  return res.data;
};

export const getMotivos = async (): Promise<MotivoItem[]> => {
  const res = await api.get("/motivos");
  return res.data;
};

export const getActasTecnicos = async (): Promise<ActaTecnicoResumen[]> => {
  const res = await api.get("/almacen/actas-tecnicos");
  return res.data;
};

export const getProductoSeries = async (idProducto: number | string): Promise<any> => {
  const res = await api.get(`/almacen/producto-series/${idProducto}`);
  return res.data;
};

export const actualizarEstadoSerie = async (idProductoSerie: number | string, nuevoEstado: string) => {
  const res = await api.put(`/almacen/producto-series/${idProductoSerie}/estado`, { nuevo_estado: nuevoEstado });
  return res.data;
};

export const devolverMaterialTecnico = async (payload: {
  id_trabajador: number;
  id_producto?: number;
  cantidad?: number;
  series_devueltas?: string[];
  motivo?: string;
  devolver_todo?: boolean;
}) => {
  const res = await api.post("/almacen/devolucion-tecnico", payload);
  return res.data;
};

export const procesarLiquidacionTecnico = async (payload: any) => {
  const res = await api.post("/almacen/procesar-liquidacion", payload);
  return res.data;
};

export const getHistorialLiquidaciones = async () => {
  const res = await api.get("/almacen/historial-liquidaciones");
  return res.data;
};

export const getDetalleLiquidacion = async (idLiquidacion: number | string) => {
  const res = await api.get(`/almacen/liquidacion/${idLiquidacion}`);
  return res.data;
};




