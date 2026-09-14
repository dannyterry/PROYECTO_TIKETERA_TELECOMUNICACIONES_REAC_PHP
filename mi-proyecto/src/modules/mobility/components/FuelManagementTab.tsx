import React, { useState, useEffect } from "react";
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
  Pencil,
  MapPin,
  History,
} from "lucide-react";
import { CargaCombustible, ResumenCombustible, Vehiculo, Tecnico } from "../types/mobilityTypes";
import {
  registrarCombustible,
  actualizarCombustible,
  eliminarCombustible,
  getGrifosHistorial,
  getImageUrl,
} from "../services/mobilityService";
import { PhotoViewerModal, PhotoItem } from "./PhotoViewerModal";

const GRIFOS_LIMA = [
  "Primax",
  "Repsol",
  "Petroperú",
  "Pecsa",
  "Shell",
  "Terpel",
  "AVA",
  "Gazel (GNV/GLP)",
  "Gesa (GNV/GLP)",
  "Otro / Particular",
];

const SEDES_COMUNES_LIMA = [
  "Javier Prado",
  "La Marina",
  "Av. Colonial",
  "Panamericana Norte",
  "Panamericana Sur",
  "Vía Expresa",
  "Av. Perú",
  "Av. Universitaria",
  "Av. Arequipa",
  "Surco",
  "San Isidro",
  "Ate",
  "Los Olivos",
  "Chorrillos",
  "San Miguel",
  "San Juan de Lurigancho",
  "Villa El Salvador",
];

interface Props {
  cargas: CargaCombustible[];
  resumen: ResumenCombustible;
  vehiculos: Vehiculo[];
  tecnicos: Tecnico[];
  loading: boolean;
  onRefresh: () => void;
}

const getNowLocalString = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

const formatearFechaHora = (fechaStr?: string) => {
  if (!fechaStr) return "--";
  try {
    const clean = String(fechaStr).replace("T", " ").split(".")[0];
    const parts = clean.split(" ");
    if (parts.length >= 2) {
      const [year, month, day] = parts[0].split("-");
      const [hourStr, minStr] = parts[1].split(":");
      let hour = parseInt(hourStr, 10);
      const minute = minStr;
      const ampm = hour >= 12 ? "p. m." : "a. m.";
      hour = hour % 12 || 12;
      return `${day}/${month}/${year.slice(2)}, ${hour}:${minute} ${ampm}`;
    }
  } catch {
    // fallback
  }
  return String(fechaStr);
};

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

  // Modal para agregar/editar carga
  const [modalAbierto, setModalAbierto] = useState(false);
  const [registroEditando, setRegistroEditando] = useState<CargaCombustible | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Formulario carga
  const [idVehiculo, setIdVehiculo] = useState("");
  const [idTrabajador, setIdTrabajador] = useState("");
  const [fechaCarga, setFechaCarga] = useState(getNowLocalString());
  const [tipoCombustible, setTipoCombustible] = useState("Gasolina");
  const [montoTotal, setMontoTotal] = useState("");
  const [galonesM3, setGalonesM3] = useState("");
  const [kmMomentoCarga, setKmMomentoCarga] = useState("");
  
  // Grifo y Estación
  const [cadenaGrifo, setCadenaGrifo] = useState("");
  const [sedeGrifo, setSedeGrifo] = useState("");
  const [grifoEstacion, setGrifoEstacion] = useState("");
  const [grifosHistorial, setGrifosHistorial] = useState<string[]>([]);

  const [numeroComprobante, setNumeroComprobante] = useState("");
  const [tipoComprobante, setTipoComprobante] = useState("Factura");
  const [observaciones, setObservaciones] = useState("");
  const [archivoFoto, setArchivoFoto] = useState<File | null>(null);

  // Visor de foto comprobante
  const [viewerPhoto, setViewerPhoto] = useState<PhotoItem[] | null>(null);

  // Cargar grifos registrados previamente desde la BD y desde cargas actuales
  const cargarHistorialGrifos = async () => {
    try {
      const desdeApi = await getGrifosHistorial();
      const desdeCargas = cargas
        .map((c) => c.grifo_estacion?.trim())
        .filter((g): g is string => Boolean(g));
      const unicos = Array.from(new Set([...(desdeApi || []), ...desdeCargas])).sort();
      setGrifosHistorial(unicos);
    } catch {
      const desdeCargas = Array.from(
        new Set(
          cargas
            .map((c) => c.grifo_estacion?.trim())
            .filter((g): g is string => Boolean(g))
        )
      ).sort();
      setGrifosHistorial(desdeCargas);
    }
  };

  useEffect(() => {
    cargarHistorialGrifos();
  }, [cargas]);

  const actualizarGrifoCompuesto = (nuevaCadena: string, nuevaSede: string) => {
    setCadenaGrifo(nuevaCadena);
    setSedeGrifo(nuevaSede);
    const sedeLimpia = nuevaSede.trim();
    if (!nuevaCadena || nuevaCadena === "Otro / Particular") {
      setGrifoEstacion(sedeLimpia);
    } else if (sedeLimpia) {
      if (sedeLimpia.toLowerCase().startsWith(nuevaCadena.toLowerCase())) {
        setGrifoEstacion(sedeLimpia);
      } else {
        setGrifoEstacion(`${nuevaCadena} - ${sedeLimpia}`);
      }
    } else {
      setGrifoEstacion(nuevaCadena);
    }
  };

  const aplicarGrifoDeHistorial = (valor: string) => {
    if (!valor) return;
    const limpio = valor.trim();
    setGrifoEstacion(limpio);

    // Si tiene formato "Cadena - Sede"
    if (limpio.includes(" - ")) {
      const [cad, ...resto] = limpio.split(" - ");
      const sed = resto.join(" - ");
      const cadCoincidente = GRIFOS_LIMA.find(
        (g) => g.toLowerCase() === cad.toLowerCase() || g.toLowerCase().startsWith(cad.toLowerCase())
      );
      if (cadCoincidente) {
        setCadenaGrifo(cadCoincidente);
        setSedeGrifo(sed);
        return;
      }
    }

    // Buscar si inicia con alguna cadena conocida
    const cadEncontrada = GRIFOS_LIMA.find((g) => {
      const nombreBase = g.split(" ")[0].toLowerCase();
      return limpio.toLowerCase().startsWith(nombreBase);
    });

    if (cadEncontrada) {
      setCadenaGrifo(cadEncontrada);
      const nombreBase = cadEncontrada.split(" ")[0];
      const resto = limpio.slice(nombreBase.length).replace(/^[\s\-/]+/, "").trim();
      setSedeGrifo(resto);
    } else {
      setCadenaGrifo("Otro / Particular");
      setSedeGrifo(limpio);
    }
  };

  const handleCerrarModal = () => {
    setModalAbierto(false);
    setRegistroEditando(null);
    setIdVehiculo("");
    setIdTrabajador("");
    setFechaCarga(getNowLocalString());
    setTipoCombustible("Gasolina Regular 90");
    setMontoTotal("");
    setGalonesM3("");
    setKmMomentoCarga("");
    setCadenaGrifo("");
    setSedeGrifo("");
    setGrifoEstacion("");
    setNumeroComprobante("");
    setTipoComprobante("Factura");
    setObservaciones("");
    setArchivoFoto(null);
  };

  const handleAbrirCrear = () => {
    handleCerrarModal();
    setModalAbierto(true);
  };

  const handleAbrirEditar = (c: CargaCombustible) => {
    setRegistroEditando(c);
    setIdVehiculo(String(c.id_vehiculo));
    setIdTrabajador(c.id_trabajador ? String(c.id_trabajador) : "");
    if (c.fecha_carga) {
      // Formato requerido por input datetime-local: "YYYY-MM-DDTHH:mm"
      const str = String(c.fecha_carga).replace(" ", "T").slice(0, 16);
      setFechaCarga(str);
    } else {
      setFechaCarga(getNowLocalString());
    }
    setTipoCombustible(c.tipo_combustible || "Gasolina Regular 90");
    setMontoTotal(String(c.monto_total || ""));
    setGalonesM3(String(c.galones_m3 || ""));
    setKmMomentoCarga(String(c.km_momento_carga || ""));
    
    // Cargar estación y desglose
    aplicarGrifoDeHistorial(c.grifo_estacion || "");

    setNumeroComprobante(c.numero_comprobante || "");
    setTipoComprobante(c.tipo_comprobante || "Factura");
    setObservaciones(c.observaciones || "");
    setArchivoFoto(null);
    setModalAbierto(true);
  };

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

      if (registroEditando) {
        await actualizarCombustible(registroEditando.id_combustible_registro, fd);
        alert("✅ ¡Carga de combustible actualizada con éxito!");
      } else {
        await registrarCombustible(fd);
        alert("✅ ¡Carga de combustible registrada con éxito!");
      }
      handleCerrarModal();
      onRefresh();
    } catch (err: any) {
      alert("Error al guardar carga: " + (err.response?.data?.error || err.message));
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
            onClick={handleAbrirCrear}
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
                      {formatearFechaHora(c.fecha_carga)}
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
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleAbrirEditar(c)}
                          className="p-1.5 rounded-xl hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-all cursor-pointer"
                          title="Editar registro de combustible"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleEliminar(c.id_combustible_registro)}
                          className="p-1.5 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all cursor-pointer"
                          title="Eliminar registro"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
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
                <span>{registroEditando ? "Editar Carga de Combustible" : "Registrar Carga de Combustible"}</span>
              </div>
              <button
                onClick={handleCerrarModal}
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
                    step="1"
                    min="0"
                    placeholder="Ej: 135800"
                    value={kmMomentoCarga}
                    onKeyDown={(e) => {
                      if (e.key === "." || e.key === "," || e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
                        e.preventDefault();
                      }
                    }}
                    onChange={(e) => {
                      const cleanVal = e.target.value.replace(/[.,eE+-]/g, "");
                      setKmMomentoCarga(cleanVal);
                    }}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none font-mono font-bold"
                  />
                  {kmMomentoCarga && Number(kmMomentoCarga) > 0 ? (
                    <div className="mt-1 text-[11px] font-bold font-mono text-amber-700 flex items-center gap-1">
                      <span>🚘 Visual:</span>
                      <span className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        {Number(kmMomentoCarga).toLocaleString("es-PE")} km
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Ingresa el kilometraje corrido (sin puntos)</span>
                  )}
                </div>
              </div>

              {/* ⛽ Estación de Servicio / Grifo */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-700 font-bold flex items-center gap-1.5 text-xs">
                    <Fuel size={15} className="text-amber-600" />
                    <span>Estación de Servicio / Grifo</span>
                  </label>
                  {grifosHistorial.length > 0 && (
                    <span className="text-[10px] text-amber-700 bg-amber-100/70 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <History size={11} /> {grifosHistorial.length} guardados en BD
                    </span>
                  )}
                </div>

                {/* 1. Desplegable de Cadena (Lima) + Nombre / Sede al costado */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <span className="block text-[11px] text-slate-500 font-medium mb-1">Cadena común (Lima)</span>
                    <select
                      value={cadenaGrifo}
                      onChange={(e) => actualizarGrifoCompuesto(e.target.value, sedeGrifo)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:border-amber-500 focus:outline-none cursor-pointer font-semibold text-xs text-slate-800"
                    >
                      <option value="">Selecciona Cadena...</option>
                      {GRIFOS_LIMA.map((g) => (
                        <option key={g} value={g}>
                          ⛽ {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="block text-[11px] text-slate-500 font-medium mb-1">Sede / Ubicación / Detalle</span>
                    <input
                      type="text"
                      list="datalist-grifos-historial"
                      placeholder="Ej: Javier Prado, Surco, Colonial..."
                      value={sedeGrifo}
                      onChange={(e) => actualizarGrifoCompuesto(cadenaGrifo, e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:border-amber-500 focus:outline-none font-semibold text-xs"
                    />
                    <datalist id="datalist-grifos-historial">
                      {grifosHistorial.map((g, idx) => (
                        <option key={`hist-${idx}`} value={g} />
                      ))}
                      {SEDES_COMUNES_LIMA.map((s, idx) => (
                        <option key={`sede-${idx}`} value={s} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* 2. Selector rápido de Grifos ya registrados anteriormente en BD */}
                {grifosHistorial.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60">
                    <span className="text-[11px] text-slate-500 font-medium shrink-0 flex items-center gap-1">
                      <MapPin size={12} className="text-amber-600" />
                      O cargar del historial:
                    </span>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          aplicarGrifoDeHistorial(e.target.value);
                          e.target.value = "";
                        }
                      }}
                      defaultValue=""
                      className="flex-1 min-w-[200px] text-xs py-1.5 px-2.5 bg-white border border-amber-300 text-amber-900 rounded-xl focus:outline-none cursor-pointer font-bold shadow-2xs"
                    >
                      <option value="">-- Elige un grifo ya registrado en la BD --</option>
                      {grifosHistorial.map((g, idx) => (
                        <option key={`sel-${idx}`} value={g}>
                          ⛽ {g}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Vista previa de cómo se guardará */}
                {grifoEstacion && (
                  <div className="text-[11px] text-slate-600 flex items-center gap-1.5 pt-0.5">
                    <span className="text-slate-400">Se guardará como:</span>
                    <span className="font-extrabold text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded-lg border border-amber-200">
                      {grifoEstacion}
                    </span>
                  </div>
                )}
              </div>

              {/* Comprobante: Tipo y Número */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-600">Tipo de Comprobante</label>
                  <select
                    value={tipoComprobante}
                    onChange={(e) => setTipoComprobante(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Factura">Factura</option>
                    <option value="Boleta">Boleta</option>
                    <option value="Ticket / Voucher">Ticket / Voucher</option>
                    <option value="Sin comprobante">Sin comprobante</option>
                  </select>
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
                  onClick={handleCerrarModal}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {guardando ? "Guardando..." : registroEditando ? "Actualizar Carga" : "Guardar Carga de Combustible"}
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
