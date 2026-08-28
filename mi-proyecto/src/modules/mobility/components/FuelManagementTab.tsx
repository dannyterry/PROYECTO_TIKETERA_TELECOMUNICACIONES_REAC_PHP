import React, { useState } from "react";
import {
  Fuel,
  Plus,
  Receipt,
  DollarSign,
  TrendingUp,
  Search,
  Calendar,
  Car,
  User,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  X,
  Upload,
} from "lucide-react";
import { CargaCombustible, ResumenCombustible, Vehiculo, Tecnico } from "../types/mobilityTypes";
import { registrarCombustible, eliminarCombustible, getImageUrl } from "../services/mobilityService";
import { PhotoViewerModal, PhotoItem } from "./PhotoViewerModal";

interface Props {
  cargas: CargaCombustible[];
  resumen: ResumenCombustible;
  vehiculos: Vehiculo[];
  tecnicos: Tecnico[];
  loading: boolean;
  onRefresh: () => void;
}

export const FuelManagementTab: React.FC<Props> = ({
  cargas,
  resumen,
  vehiculos,
  tecnicos,
  loading,
  onRefresh,
}) => {
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroVehiculo, setFiltroVehiculo] = useState("");

  // Modal para agregar carga
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Formulario nueva carga
  const [idVehiculo, setIdVehiculo] = useState("");
  const [idTrabajador, setIdTrabajador] = useState("");
  const [fechaCarga, setFechaCarga] = useState(new Date().toISOString().slice(0, 16));
  const [tipoCombustible, setTipoCombustible] = useState("Gasolina");
  const [montoTotal, setMontoTotal] = useState("");
  const [galonesM3, setGalonesM3] = useState("");
  const [kmMomentoCarga, setKmMomentoCarga] = useState("");
  const [grifoEstacion, setGrifoEstacion] = useState("Repsol / Primax");
  const [numeroComprobante, setNumeroComprobante] = useState("");
  const [tipoComprobante, setTipoComprobante] = useState("Factura");
  const [observaciones, setObservaciones] = useState("");
  const [archivoFoto, setArchivoFoto] = useState<File | null>(null);

  // Visor de foto comprobante
  const [viewerPhoto, setViewerPhoto] = useState<PhotoItem[] | null>(null);

  const cargasFiltradas = cargas.filter((c) => {
    const txt = filtroTexto.toLowerCase();
    const coincideTexto =
      !txt ||
      (c.placa && c.placa.toLowerCase().includes(txt)) ||
      (c.nombre_tecnico && c.nombre_tecnico.toLowerCase().includes(txt)) ||
      (c.grifo_estacion && c.grifo_estacion.toLowerCase().includes(txt)) ||
      (c.numero_comprobante && c.numero_comprobante.toLowerCase().includes(txt));

    const coincideVehiculo = !filtroVehiculo || String(c.id_vehiculo) === filtroVehiculo;

    return coincideTexto && coincideVehiculo;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idVehiculo || !montoTotal || !galonesM3 || !kmMomentoCarga) {
      alert("Por favor completa los campos obligatorios: Vehículo, Monto, Galones y Kilometraje.");
      return;
    }

    try {
      setGuardando(true);
      const fd = new FormData();
      fd.append("id_vehiculo", idVehiculo);
      if (idTrabajador) fd.append("id_trabajador", idTrabajador);
      fd.append("fecha_carga", fechaCarga);
      fd.append("tipo_combustible", tipoCombustible);
      fd.append("monto_total", montoTotal);
      fd.append("galones_m3", galonesM3);
      fd.append("km_momento_carga", kmMomentoCarga);
      fd.append("grifo_estacion", grifoEstacion);
      fd.append("numero_comprobante", numeroComprobante);
      fd.append("tipo_comprobante", tipoComprobante);
      fd.append("observaciones", observaciones);
      if (archivoFoto) {
        fd.append("foto_comprobante", archivoFoto);
      }

      await registrarCombustible(fd);
      setModalAbierto(false);
      // Reset
      setIdVehiculo("");
      setIdTrabajador("");
      setMontoTotal("");
      setGalonesM3("");
      setKmMomentoCarga("");
      setNumeroComprobante("");
      setObservaciones("");
      setArchivoFoto(null);
      onRefresh();
    } catch (err: any) {
      alert("Error al registrar carga: " + (err.response?.data?.error || err.message));
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id: number) => {
    if (!window.confirm("¿Seguro que deseas eliminar este registro de combustible?")) return;
    try {
      await eliminarCombustible(id);
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          1. RESUMEN FINANCIERO DE COMBUSTIBLE (CARDS SUPERIORES)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Gasto */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 shrink-0">
            <DollarSign size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Gasto Total Combustible
            </span>
            <h3 className="text-2xl font-black text-slate-900 font-mono">
              S/ {(resumen.totalGasto || 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
            </h3>
            <span className="text-[10px] text-slate-500 font-medium">Facturado y comprobado</span>
          </div>
        </div>

        {/* Galones / M3 Totales */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-600 shrink-0">
            <Fuel size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Volumen Total Cargado
            </span>
            <h3 className="text-2xl font-black text-slate-900 font-mono">
              {(resumen.totalGalones || 0).toLocaleString()}{" "}
              <span className="text-xs font-bold text-slate-400">GLS / M³</span>
            </h3>
            <span className="text-[10px] text-blue-600 font-bold">Total suministrado a la flota</span>
          </div>
        </div>

        {/* Precio Promedio Galón */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 shrink-0">
            <Receipt size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Precio Promedio Galón
            </span>
            <h3 className="text-2xl font-black text-slate-900 font-mono">
              S/ {(resumen.precioPromedioGalon || 0).toFixed(2)}
            </h3>
            <span className="text-[10px] text-slate-500 font-medium">Costo promedio por galón</span>
          </div>
        </div>

        {/* Total Registros */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Cargas Registradas
            </span>
            <h3 className="text-2xl font-black text-slate-900 font-mono">
              {cargas.length}
            </h3>
            <span className="text-[10px] text-purple-600 font-bold">Comprobantes auditados</span>
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. BARRA DE CONTROL Y ACCIÓN DE NUEVA CARGA
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        
        {/* Buscador */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            type="text"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="Buscar por placa, técnico, grifo o factura..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 text-xs font-medium text-slate-800 placeholder-slate-400 rounded-2xl border border-slate-200 focus:border-cyan-500 focus:outline-none transition-all"
          />
        </div>

        {/* Filtro Vehículo y Botón Agregar */}
        <div className="flex items-center gap-3">
          <select
            value={filtroVehiculo}
            onChange={(e) => setFiltroVehiculo(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="">🚗 Todos los Vehículos</option>
            {vehiculos.map((v) => (
              <option key={v.id_vehiculo} value={v.id_vehiculo}>
                {v.placa} ({v.modelo || "S/M"})
              </option>
            ))}
          </select>

          <button
            onClick={() => setModalAbierto(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus size={16} />
            + Registrar Carga de Gasolina
          </button>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. TABLA DE REGISTROS DE COMBUSTIBLE
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm font-semibold">
            Cargando historial de combustible...
          </div>
        ) : cargasFiltradas.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No se han registrado cargas de combustible con los filtros aplicados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 uppercase font-black text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-4">Fecha / Hora</th>
                  <th className="py-3 px-4">Vehículo</th>
                  <th className="py-3 px-4">Técnico</th>
                  <th className="py-3 px-4">Combustible</th>
                  <th className="py-3 px-4 text-center">KM Carga</th>
                  <th className="py-3 px-4 text-center">Galones</th>
                  <th className="py-3 px-4 text-center">Monto Total</th>
                  <th className="py-3 px-4 text-center">Rendimiento (KM/Gal)</th>
                  <th className="py-3 px-4 text-center">Comprobante</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cargasFiltradas.map((c) => (
                  <tr key={c.id_combustible_registro} className="hover:bg-slate-50/80 transition-colors">
                    {/* Fecha */}
                    <td className="py-3.5 px-4 font-bold text-slate-700 font-mono whitespace-nowrap">
                      {c.fecha_carga ? new Date(c.fecha_carga).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }) : "--"}
                    </td>

                    {/* Vehículo */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <Car size={14} className="text-amber-600 shrink-0" />
                        <span className="font-extrabold text-slate-900 font-mono tracking-wider">
                          {c.placa || "S/P"}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ({c.modelo || "S/M"})
                        </span>
                      </div>
                    </td>

                    {/* Técnico */}
                    <td className="py-3.5 px-4 text-slate-700 font-semibold truncate max-w-[150px]">
                      {c.nombre_tecnico || "Administración"}
                    </td>

                    {/* Tipo Combustible & Grifo */}
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-800 block">{c.tipo_combustible}</span>
                      <span className="text-[10px] text-slate-400">{c.grifo_estacion || "Grifo"}</span>
                    </td>

                    {/* KM Carga */}
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                      {Number(c.km_momento_carga).toLocaleString()} km
                    </td>

                    {/* Galones */}
                    <td className="py-3.5 px-4 text-center font-mono font-black text-blue-700">
                      {Number(c.galones_m3).toFixed(2)} gls
                    </td>

                    {/* Monto Total */}
                    <td className="py-3.5 px-4 text-center font-mono font-black text-emerald-700 bg-emerald-50/40">
                      S/ {Number(c.monto_total).toFixed(2)}
                    </td>

                    {/* Rendimiento */}
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                      {c.rendimiento_km_galon ? (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 text-[11px]">
                          {c.rendimiento_km_galon} km/gl
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[10px]">1ra carga</span>
                      )}
                    </td>

                    {/* Foto Comprobante */}
                    <td className="py-3.5 px-4 text-center">
                      {c.foto_comprobante ? (
                        <button
                          onClick={() =>
                            setViewerPhoto([
                              {
                                url: c.foto_comprobante!,
                                title: `Comprobante ${c.tipo_comprobante || "Factura"} #${c.numero_comprobante || ""}`,
                                subtitle: `Placa: ${c.placa || ""} | Monto: S/ ${c.monto_total} | Grifo: ${c.grifo_estacion || ""}`,
                              },
                            ])
                          }
                          className="p-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-all cursor-pointer inline-flex items-center gap-1 font-bold text-[11px]"
                        >
                          <ImageIcon size={13} />
                          Ver Foto
                        </button>
                      ) : (
                        <span className="text-slate-300 text-[10px]">Sin foto</span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleEliminar(c.id_combustible_registro)}
                        className="p-1.5 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all cursor-pointer"
                        title="Eliminar registro"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. MODAL: REGISTRAR CARGA DE COMBUSTIBLE
      ───────────────────────────────────────────────────────────── */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-100 space-y-4 max-h-[92vh] overflow-y-auto">
            
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 text-amber-600 font-extrabold text-base">
                <Fuel size={22} />
                <span>Registrar Carga de Combustible</span>
              </div>
              <button
                onClick={() => setModalAbierto(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold text-slate-700">
              
              {/* Vehículo y Técnico */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-600">Vehículo (Placa) *</label>
                  <select
                    value={idVehiculo}
                    onChange={(e) => {
                      setIdVehiculo(e.target.value);
                      const veh = vehiculos.find((v) => String(v.id_vehiculo) === e.target.value);
                      if (veh?.id_trabajador) {
                        setIdTrabajador(String(veh.id_trabajador));
                      }
                      if (veh?.ultimo_km) {
                        setKmMomentoCarga(String(veh.ultimo_km));
                      }
                    }}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">Selecciona vehículo...</option>
                    {vehiculos.map((v) => (
                      <option key={v.id_vehiculo} value={v.id_vehiculo}>
                        {v.placa} - {v.marca || ""} {v.modelo || "Vehículo"} [{v.combustible || "Gasolina"}]
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-1 text-slate-600">Técnico Conductor</label>
                  <select
                    value={idTrabajador}
                    onChange={(e) => setIdTrabajador(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">Selecciona técnico (opcional)...</option>
                    {tecnicos.map((t) => (
                      <option key={t.id_trabajador} value={t.id_trabajador}>
                        {t.nombre_completo} ({t.cuadrilla || "S/C"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fecha y Tipo Combustible */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-600">Fecha y Hora de Carga *</label>
                  <input
                    type="datetime-local"
                    value={fechaCarga}
                    onChange={(e) => setFechaCarga(e.target.value)}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-slate-600">Tipo de Combustible</label>
                  <select
                    value={tipoCombustible}
                    onChange={(e) => setTipoCombustible(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Gasolina Regular 90">Gasolina Regular 90</option>
                    <option value="Gasolina Premium 95">Gasolina Premium 95</option>
                    <option value="GLP">GLP (Gas Licuado)</option>
                    <option value="GNV">GNV (Gas Natural)</option>
                    <option value="Diesel / Petróleo">Diesel / Petróleo</option>
                  </select>
                </div>
              </div>

              {/* Monto S/., Galones y Kilometraje */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block mb-1 text-slate-600">Monto Total (S/.) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ej: 80.00"
                    value={montoTotal}
                    onChange={(e) => setMontoTotal(e.target.value)}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-slate-600">Galones o M³ *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ej: 4.85"
                    value={galonesM3}
                    onChange={(e) => setGalonesM3(e.target.value)}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-slate-600">KM Odómetro al Tanquear *</label>
                  <input
                    type="number"
                    placeholder="Ej: 124550"
                    value={kmMomentoCarga}
                    onChange={(e) => setKmMomentoCarga(e.target.value)}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none font-mono font-bold"
                  />
                </div>
              </div>

              {/* Grifo y Factura */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-600">Estación de Servicio / Grifo</label>
                  <input
                    type="text"
                    placeholder="Ej: Primax Javier Prado / Repsol"
                    value={grifoEstacion}
                    onChange={(e) => setGrifoEstacion(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-slate-600">N° Factura / Boleta</label>
                  <input
                    type="text"
                    placeholder="Ej: F001-004523"
                    value={numeroComprobante}
                    onChange={(e) => setNumeroComprobante(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Subir Foto de Factura / Voucher */}
              <div>
                <label className="block mb-1 text-slate-600">Foto del Comprobante / Voucher</label>
                <label className="w-full p-3 border-2 border-dashed border-slate-200 hover:border-amber-500 rounded-2xl bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center cursor-pointer transition-all">
                  <Upload size={20} className="text-amber-600 mb-1" />
                  <span className="text-slate-600 font-bold">
                    {archivoFoto ? archivoFoto.name : "Subir foto de factura o voucher"}
                  </span>
                  <span className="text-[10px] text-slate-400">PNG, JPG hasta 10MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && setArchivoFoto(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block mb-1 text-slate-600">Observaciones adicionales</label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={2}
                  placeholder="Detalles sobre la recarga..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Botones */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {guardando ? "Guardando..." : "Guardar Carga de Combustible"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Visor de Comprobante */}
      {viewerPhoto && (
        <PhotoViewerModal
          photos={viewerPhoto}
          initialIndex={0}
          onClose={() => setViewerPhoto(null)}
        />
      )}
    </div>
  );
};
