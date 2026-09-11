import axios from "axios";
import { API_URL } from "../../../config/api";
import { authService } from "../../../services/authService";
import {
  ProductoStock,
  StockTecnicoDetalle,
  SerieTecnicoDetalle,
  Proveedor,
  CategoriaItem,
  CompraPayload,
  DespachoPayload,
  EquipoRetirado,
  ActaLiquidacionPayload,
  MotivoItem,
  ActaTecnicoResumen,
  CompraHistorialItem,
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

export const getProductos = async (): Promise<ProductoStock[]> => {
  const res = await api.get("/almacen/stock-general");
  return res.data?.productos || [];
};

export const getProveedores = async (): Promise<Proveedor[]> => {
  const res = await api.get("/almacen/proveedores");
  return res.data;
};

export const crearProveedor = async (payload: Partial<Proveedor>) => {
  const res = await api.post("/almacen/proveedores", payload);
  return res.data;
};

export const actualizarProveedor = async (id: number, payload: Partial<Proveedor>) => {
  const res = await api.put(`/almacen/proveedores/${id}`, payload);
  return res.data;
};

export const desactivarProveedor = async (id: number) => {
  const res = await api.delete(`/almacen/proveedores/${id}`);
  return res.data;
};

export const getCategorias = async (): Promise<CategoriaItem[]> => {
  const res = await api.get("/almacen/categorias");
  return res.data;
};

export const crearCategoria = async (payload: { nombre: string; descripcion?: string; estado?: string }) => {
  const res = await api.post("/almacen/categorias", payload);
  return res.data;
};

export const actualizarCategoria = async (id: number, payload: { nombre?: string; descripcion?: string; estado?: string }) => {
  const res = await api.put(`/almacen/categorias/${id}`, payload);
  return res.data;
};

export const desactivarCategoria = async (id: number) => {
  const res = await api.delete(`/almacen/categorias/${id}`);
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
  stand?: string;
  fila?: number;
  proid?: string;
}): Promise<{ success: boolean; message: string; producto: ProductoStock }> => {
  const res = await api.post("/almacen/productos", payload);
  return res.data;
};

export const actualizarProducto = async (
  id: number,
  payload: {
    nombre: string;
    id_categoria?: number;
    codigo?: string;
    descripcion?: string;
    stock_minimo?: number;
    estado?: string;
  }
): Promise<{ success: boolean; message: string; id_producto: number; nombre: string }> => {
  const res = await api.put(`/almacen/productos/${id}`, payload);
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

export const verificarSerieDespacho = async (serie: string, idProducto?: number) => {
  const res = await api.get(`/almacen/verificar-serie-despacho/${encodeURIComponent(serie)}`, {
    params: idProducto ? { id_producto: idProducto } : undefined,
  });
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

export const actualizarEquipoRecogido = async (id: number, payload: {
  guia_remision_win?: string;
  proid?: string;
  codigo_producto?: string;
  observaciones?: string;
}) => {
  const res = await api.put(`/almacen/equipos-recogidos/${id}`, payload);
  return res.data;
};

export const actualizarUbicacionProducto = async (id: number, payload: {
  stand?: string | null;
  fila?: number | null;
  proid?: string | null;
}) => {
  const user = authService.getCurrentUser();
  const res = await api.put(`/almacen/productos/${id}/ubicacion`, {
    ...payload,
    id_usuario: user?.id_usuario,
    usuario_nombre: user?.nombreCompleto || user?.usuario || user?.nombres,
  });
  return res.data;
};

export const actualizarPrecioProducto = async (id: number, precio_compra: number) => {
  const user = authService.getCurrentUser();
  const res = await api.put(`/almacen/productos/${id}/precio`, {
    precio_compra,
    id_usuario: user?.id_usuario,
    usuario_nombre: user?.nombreCompleto || user?.usuario || user?.nombres,
  });
  return res.data;
};

export const actualizarIdEquipoSerie = async (idProductoSerie: number, id_equipo: string) => {
  const res = await api.put(`/almacen/producto-series/${idProductoSerie}/id-equipo`, { id_equipo });
  return res.data;
};

export const actualizarProidSerie = async (idProductoSerie: number, proid: string) => {
  const res = await api.put(`/almacen/producto-series/${idProductoSerie}/proid`, { proid });
  return res.data;
};

export const actualizarStockSegundoUso = async (id: number, payload: {
  cantidad_segundo_uso: number;
  motivo?: string;
  tecnico_nombre?: string;
}) => {
  const res = await api.put(`/almacen/productos/${id}/stock-segundo-uso`, payload);
  return res.data;
};

export const internarEquipoRecogido = async (payload: {
  id_equipo_retirado: number;
  estado_destino: string;
  recibido_por?: string;
  observaciones?: string;
  guia_remision_win?: string;
  proid?: string;
  codigo_producto?: string;
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

// --- AUDITORÍA DE LIQUIDACIONES EN ÓRDENES DIARIAS (ALMACÉN) ---
export const getLiquidacionesOrdenesAudit = async (params: {
  desde?: string;
  hasta?: string;
  id_trabajador?: string;
  estado?: string;
}) => {
  const res = await api.get("/almacen/orden-liquidaciones", { params });
  return res.data;
};

export const aprobarLiquidacionOrden = async (idLiquidacion: number | string) => {
  const res = await api.post(`/almacen/orden-liquidaciones/${idLiquidacion}/aprobar`);
  return res.data;
};

export const rechazarLiquidacionOrden = async (idLiquidacion: number | string, motivo: string) => {
  const res = await api.post(`/almacen/orden-liquidaciones/${idLiquidacion}/rechazar`, { motivo });
  return res.data;
};

export const aprobarMasivoLiquidaciones = async (ids: number[]) => {
  const res = await api.post("/almacen/orden-liquidaciones/aprobar-masivo", { ids });
  return res.data;
};

export const getMetrajeSugerido = async (numeroOrden: string) => {
  try {
    const res = await axios.get(`${API_URL}/ordenes/${numeroOrden}/metraje-sugerido`);
    return res.data?.metraje || null;
  } catch {
    return null;
  }
};

// --- 📦 COMPRAS: HISTORIAL & ANULACIÓN ---
export const getCompras = async (): Promise<CompraHistorialItem[]> => {
  const res = await api.get("/almacen/compras");
  return res.data || [];
};

export const anularCompra = async (idCompra: number, motivo?: string) => {
  const res = await api.post(`/almacen/compras/${idCompra}/anular`, { motivo });
  return res.data;
};

// --- 🔄 SERIES: REASIGNAR PRODUCTO (CORRECCIÓN) ---
export const reasignarProductoSerie = async (
  idProductoSerie: number,
  nuevoIdProducto: number,
  motivo?: string
) => {
  const res = await api.post(`/almacen/producto-series/${idProductoSerie}/reasignar-producto`, {
    nuevo_id_producto: nuevoIdProducto,
    motivo,
  });
  return res.data;
};




