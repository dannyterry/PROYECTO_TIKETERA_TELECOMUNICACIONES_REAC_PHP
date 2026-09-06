import React, { useState, useEffect } from "react";
import {
  ListChecks,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  RotateCw,
  AlertCircle,
  Search,
  Tag,
  DollarSign,
  Package,
} from "lucide-react";
import {
  MotivoItem,
  TipoTrabajoItem,
  getMotivos,
  createMotivo,
  updateMotivo,
  deleteMotivo,
  getTiposTrabajo,
} from "../services/settingsService";
import { getProductos } from "../../inventory/services/inventoryService";

export const MotivosTab: React.FC = () => {
  const [motivos, setMotivos] = useState<MotivoItem[]>([]);
  const [tiposTrabajo, setTiposTrabajo] = useState<TipoTrabajoItem[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState("");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [motivoEditando, setMotivoEditando] = useState<MotivoItem | null>(null);

  // Campos Formulario
  const [nombre, setNombre] = useState("");
  const [tipoTrabajo, setTipoTrabajo] = useState("");
  const [precioCompra, setPrecioCompra] = useState("0.00");
  const [precioVenta, setPrecioVenta] = useState("0.00");
  const [estado, setEstado] = useState<"Activo" | "Inactivo">("Activo");
  const [limites, setLimites] = useState<{ id_producto: number; cantidad: number }[]>([]);

  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [mots, tps, prods] = await Promise.all([
        getMotivos(),
        getTiposTrabajo().catch(() => []),
        getProductos().catch(() => []),
      ]);
      setMotivos(mots || []);
      setTiposTrabajo(tps || []);
      setProductos(prods || []);
    } catch (err: any) {
      console.error("Error al cargar motivos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleAbrirCrear = () => {
    setMotivoEditando(null);
    setNombre("");
    setTipoTrabajo(tiposTrabajo[0]?.nombre || "VISITA EXTERNA");
    setPrecioCompra("0.00");
    setPrecioVenta("0.00");
    setEstado("Activo");
    setLimites([]);
    setErrorMsg("");
    setModalAbierto(true);
  };

  const handleAbrirEditar = (m: MotivoItem) => {
    setMotivoEditando(m);
    setNombre(m.nombre);
    setTipoTrabajo(m.tipo_trabajo || "");
    setPrecioCompra(String(m.precio_compra || "0.00"));
    setPrecioVenta(String(m.precio_venta || "0.00"));
    setEstado(m.estado || "Activo");
    try {
      const arr = m.limites_materiales ? JSON.parse(m.limites_materiales) : [];
      setLimites(Array.isArray(arr) ? arr : []);
    } catch {
      setLimites([]);
    }
    setErrorMsg("");
    setModalAbierto(true);
  };

  const handleAgregarLimite = () => {
    const primerProd = productos[0]?.id_producto || 1;
    setLimites([...limites, { id_producto: primerProd, cantidad: 1 }]);
  };

  const handleQuitarLimite = (idx: number) => {
    setLimites(limites.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setErrorMsg("El nombre del motivo es requerido.");
      return;
    }

    try {
      setGuardando(true);
      setErrorMsg("");

      const payload = {
        nombre: nombre.trim().toUpperCase(),
        tipo_trabajo: tipoTrabajo.trim() || undefined,
        precio_compra: parseFloat(precioCompra) || 0,
        precio_venta: parseFloat(precioVenta) || 0,
        limites_materiales: limites.length > 0 ? JSON.stringify(limites) : null,
        estado,
      };

      if (motivoEditando) {
        await updateMotivo(motivoEditando.id_motivo, payload);
      } else {
        await createMotivo(payload);
      }

      setModalAbierto(false);
      cargarDatos();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al guardar el motivo");
    } finally {
      setGuardando(false);
    }
  };

  const handleDesactivar = async (m: MotivoItem) => {
    if (!window.confirm(`¿Estás seguro de desactivar el motivo "${m.nombre}"?`)) return;
    try {
      await deleteMotivo(m.id_motivo);
      cargarDatos();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const motivosFiltrados = motivos.filter((m) => {
    const txt = filtroTexto.toLowerCase();
    return (
      !txt ||
      m.nombre.toLowerCase().includes(txt) ||
      (m.tipo_trabajo && m.tipo_trabajo.toLowerCase().includes(txt))
    );
  });

  return (
    <div className="space-y-4 font-sans">
      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative min-w-[240px] flex-1 sm:flex-initial">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar motivo o tipo de trabajo..."
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={cargarDatos}
            disabled={loading}
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            title="Recargar"
          >
            <RotateCw size={16} className={loading ? "animate-spin text-indigo-600" : ""} />
          </button>
          <button
            onClick={handleAbrirCrear}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer active:scale-95"
          >
            <Plus size={16} />
            <span>Nuevo Motivo</span>
          </button>
        </div>
      </div>

      {/* Tabla de Motivos */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">ID</th>
                <th className="py-3.5 px-4">Motivo de Liquidación</th>
                <th className="py-3.5 px-4">Tipo Trabajo</th>
                <th className="py-3.5 px-4 text-center">Compra</th>
                <th className="py-3.5 px-4 text-center">Venta</th>
                <th className="py-3.5 px-4 text-center">Límites Material</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RotateCw className="animate-spin inline-block mr-2 text-indigo-600" size={18} />
                    Cargando motivos de órdenes...
                  </td>
                </tr>
              ) : motivosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No se encontraron motivos registrados.
                  </td>
                </tr>
              ) : (
                motivosFiltrados.map((m) => {
                  const esActivo = m.estado === "Activo" || !m.estado;
                  let cantLimites = 0;
                  try {
                    const arr = m.limites_materiales ? JSON.parse(m.limites_materiales) : [];
                    cantLimites = Array.isArray(arr) ? arr.length : 0;
                  } catch {}

                  return (
                    <tr key={m.id_motivo} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 font-bold">
                        #{m.id_motivo}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 text-xs">{m.nombre}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                          {m.tipo_trabajo || "VISITA"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-600">
                        S/ {parseFloat(String(m.precio_compra || 0)).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                        S/ {parseFloat(String(m.precio_venta || 0)).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {cantLimites > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                            {cantLimites} material(es)
                          </span>
                        ) : (
                          <span className="text-slate-300 italic text-[11px]">Sin límite</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            esActivo
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${esActivo ? "bg-emerald-500" : "bg-rose-500"}`} />
                          {m.estado || "Activo"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleAbrirEditar(m)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer"
                            title="Editar Motivo"
                          >
                            <Edit2 size={14} />
                          </button>
                          {esActivo && (
                            <button
                              onClick={() => handleDesactivar(m)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                              title="Desactivar Motivo"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear/Editar Motivo */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <ListChecks size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {motivoEditando ? "Editar Motivo" : "Nuevo Motivo de Liquidación"}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Configura nombres, tipo de trabajo y límites de material
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalAbierto(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre del Motivo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="ej. CAMBIO DE EQUIPO ONT, RECABLEADO..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 uppercase focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tipo de Trabajo
                  </label>
                  <select
                    value={tipoTrabajo}
                    onChange={(e) => setTipoTrabajo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Seleccione...</option>
                    {tiposTrabajo.map((t) => (
                      <option key={t.id_tipo_trabajo} value={t.nombre}>
                        {t.nombre}
                      </option>
                    ))}
                    <option value="VISITA EXTERNA">VISITA EXTERNA</option>
                    <option value="POST VENTA">POST VENTA</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estado
                  </label>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Precio Compra (S/)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={precioCompra}
                    onChange={(e) => setPrecioCompra(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Precio Venta (S/)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={precioVenta}
                    onChange={(e) => setPrecioVenta(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Límites de Materiales */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                    <Package size={14} className="text-indigo-600" />
                    <span>Límites Máximos de Material por Orden</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAgregarLimite}
                    className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Agregar Material</span>
                  </button>
                </div>

                {limites.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">
                    Sin límites específicos para este motivo.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {limites.map((lim, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                        <select
                          value={lim.id_producto}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const updated = [...limites];
                            updated[idx].id_producto = val;
                            setLimites(updated);
                          }}
                          className="flex-1 bg-white border border-slate-200 rounded-lg text-xs py-1.5 px-2 font-medium"
                        >
                          {productos.map((p) => (
                            <option key={p.id_producto} value={p.id_producto}>
                              {p.nombre} {p.es_drop ? "(DROP)" : ""}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={lim.cantidad}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            const updated = [...limites];
                            updated[idx].cantidad = val;
                            setLimites(updated);
                          }}
                          className="w-16 bg-white border border-slate-200 rounded-lg text-xs py-1.5 px-2 text-center font-bold"
                          title="Cantidad Máxima Permitida"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuitarLimite(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {guardando ? <RotateCw className="animate-spin" size={15} /> : <Check size={15} />}
                  <span>{motivoEditando ? "Guardar Cambios" : "Crear Motivo"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
