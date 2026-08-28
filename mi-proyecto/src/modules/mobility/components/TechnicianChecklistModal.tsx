import React, { useState, useEffect } from "react";
import {
  Car,
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  Gauge,
  Droplet,
  Waves,
  X,
  Sparkles,
  Sun,
  Moon,
  User,
} from "lucide-react";
import { Vehiculo, Tecnico } from "../types/mobilityTypes";
import { registrarInspeccionInicio, registrarInspeccionFin, getTecnicos, getVehiculos } from "../services/mobilityService";
import { API_URL } from "../../../config/api";

interface Props {
  idTrabajadorInicial?: number | string;
  idVehiculoInicial?: number | string;
  nombreTecnicoInicial?: string;
  vehiculos?: Vehiculo[];
  tecnicos?: Tecnico[];
  onClose: () => void;
  onSuccess: () => void;
}

export const TechnicianChecklistModal: React.FC<Props> = ({
  idTrabajadorInicial,
  idVehiculoInicial,
  nombreTecnicoInicial,
  vehiculos: propVehiculos,
  tecnicos: propTecnicos,
  onClose,
  onSuccess,
}) => {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>(propVehiculos || []);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>(propTecnicos || []);
  const [tipoJornada, setTipoJornada] = useState<"inicio" | "fin">("inicio");
  const [guardando, setGuardando] = useState(false);

  // Form Fields
  const [idVehiculo, setIdVehiculo] = useState<string>(idVehiculoInicial ? String(idVehiculoInicial) : "");
  const [idTrabajador, setIdTrabajador] = useState<string>(idTrabajadorInicial ? String(idTrabajadorInicial) : "");
  const [kmInicio, setKmInicio] = useState("");
  const [kmFin, setKmFin] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // Cargar si no vienen por props
  useEffect(() => {
    if (!propTecnicos || propTecnicos.length === 0) {
      getTecnicos().then((data) => setTecnicos(data || [])).catch(console.error);
    }
    if (!propVehiculos || propVehiculos.length === 0) {
      getVehiculos().then((data) => setVehiculos(data || [])).catch(console.error);
    }
  }, [propTecnicos, propVehiculos]);

  // Detectar usuario de sesión desde URL o props si no está establecido
  useEffect(() => {
    if (idTrabajadorInicial) {
      setIdTrabajador(String(idTrabajadorInicial));
      if (idVehiculoInicial) setIdVehiculo(String(idVehiculoInicial));
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const urlUserId = params.get("userId") || params.get("user_id");
    const urlUserName = params.get("userName") || params.get("user_name") || nombreTecnicoInicial;

    if (urlUserId && tecnicos.length > 0) {
      const match = tecnicos.find((t) => String(t.id_usuario) === String(urlUserId));
      if (match) {
        setIdTrabajador(String(match.id_trabajador));
        if (match.id_vehiculo) setIdVehiculo(String(match.id_vehiculo));
        return;
      }
    }

    if (urlUserName && tecnicos.length > 0) {
      const match = tecnicos.find((t) => t.nombre_completo.toLowerCase().includes(decodeURIComponent(urlUserName).toLowerCase()));
      if (match) {
        setIdTrabajador(String(match.id_trabajador));
        if (match.id_vehiculo) setIdVehiculo(String(match.id_vehiculo));
        return;
      }
    }

    // Si no hay técnico fijado pero hay técnicos en la lista
    if (tecnicos.length > 0 && !idTrabajador) {
      const primerTec = tecnicos[0];
      setIdTrabajador(String(primerTec.id_trabajador));
      if (primerTec.id_vehiculo) {
        setIdVehiculo(String(primerTec.id_vehiculo));
      }
    }
  }, [tecnicos, idTrabajadorInicial, idVehiculoInicial, nombreTecnicoInicial]);

  // Al cambiar el técnico, auto-fijar su vehículo asignado automáticamente desde la BD
  useEffect(() => {
    if (idTrabajador) {
      const tec = tecnicos.find((t) => String(t.id_trabajador) === String(idTrabajador));
      if (tec?.id_vehiculo) {
        setIdVehiculo(String(tec.id_vehiculo));
      } else if (tec?.vehiculo_placa) {
        const placaBuscada = tec.vehiculo_placa.trim().toUpperCase();
        const matchVeh = vehiculos.find((v) => v.placa && v.placa.trim().toUpperCase() === placaBuscada);
        if (matchVeh) {
          setIdVehiculo(String(matchVeh.id_vehiculo));
        }
      } else {
        // Buscar en vehículos si en observaciones o técnico_asignado coincide el nombre
        const tecNombre = (tec?.nombre_completo || "").toLowerCase();
        const matchVeh = vehiculos.find((v) => {
          const obs = (v.observaciones || "").toLowerCase();
          const asignado = (v.tecnico_asignado || "").toLowerCase();
          return (
            (tecNombre && (obs.includes(tecNombre) || asignado.includes(tecNombre))) ||
            v.id_trabajador === Number(idTrabajador)
          );
        });
        if (matchVeh) {
          setIdVehiculo(String(matchVeh.id_vehiculo));
        }
      }
    }
  }, [idTrabajador, tecnicos, vehiculos]);

  const tecnicoSeleccionado = tecnicos.find((t) => String(t.id_trabajador) === idTrabajador);
  const vehiculoAsignado = vehiculos.find((v) => String(v.id_vehiculo) === idVehiculo);

  // Fotos
  const [fotoTableroInicio, setFotoTableroInicio] = useState<File | null>(null);
  const [fotoAceite, setFotoAceite] = useState<File | null>(null);
  const [fotoAgua, setFotoAgua] = useState<File | null>(null);
  const [fotoEstadoGeneral, setFotoEstadoGeneral] = useState<File | null>(null);
  const [fotoTableroFin, setFotoTableroFin] = useState<File | null>(null);

  // Función para capturar coordenadas GPS reales del teléfono del técnico
  const obtenerGpsActual = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 4000 }
      );
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idVehiculo || !idTrabajador) {
      alert("Por favor selecciona tu vehículo y tu nombre de técnico.");
      return;
    }

    try {
      setGuardando(true);
      const fd = new FormData();
      fd.append("id_vehiculo", idVehiculo);
      fd.append("id_trabajador", idTrabajador);
      fd.append("observaciones_tecnico", observaciones);

      // Capturar GPS en segundo plano
      const gps = await obtenerGpsActual();

      if (tipoJornada === "inicio") {
        if (!kmInicio) {
          alert("Ingresa el kilometraje inicial.");
          setGuardando(false);
          return;
        }
        fd.append("km_inicio", kmInicio);
        if (gps) {
          fd.append("lat_inicio", String(gps.lat));
          fd.append("lng_inicio", String(gps.lng));
        }
        if (fotoTableroInicio) fd.append("foto_tablero_inicio", fotoTableroInicio);
        if (fotoAceite) fd.append("foto_aceite", fotoAceite);
        if (fotoAgua) fd.append("foto_agua", fotoAgua);
        if (fotoEstadoGeneral) fd.append("foto_estado_general", fotoEstadoGeneral);

        await registrarInspeccionInicio(fd);
        alert("✅ ¡Inspección de inicio de jornada registrada exitosamente con ubicación GPS!");
      } else {
        if (!kmFin) {
          alert("Ingresa el kilometraje final.");
          setGuardando(false);
          return;
        }
        fd.append("km_fin", kmFin);
        if (gps) {
          fd.append("lat_fin", String(gps.lat));
          fd.append("lng_fin", String(gps.lng));
        }
        if (fotoTableroFin) fd.append("foto_tablero_fin", fotoTableroFin);

        const res = await registrarInspeccionFin(fd);
        alert(`✅ ¡Cierre de jornada registrado con éxito! Recorriste hoy: ${res.km_recorridos || 0} KM.`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      alert("Error al enviar checklist: " + (err.response?.data?.error || err.message));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 md:p-6 animate-fade-in">
      <div className="bg-white rounded-3xl p-5 md:p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4 max-h-[92vh] overflow-y-auto">
        
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5 text-cyan-600 font-black text-base">
            <Car size={22} />
            <span>Checklist Diario de Vehículo</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-xl"
          >
            <X size={20} />
          </button>
        </div>

        {/* SWITCH TIPO DE JORNADA */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setTipoJornada("inicio")}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              tipoJornada === "inicio"
                ? "bg-amber-500 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sun size={16} />
            🌅 Inicio de Jornada
          </button>

          <button
            type="button"
            onClick={() => setTipoJornada("fin")}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              tipoJornada === "fin"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Moon size={16} />
            🌙 Cierre de Jornada
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold text-slate-700">
          
          {/* Identificación del Técnico y Vehículo Asignado */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-700 font-bold">Técnico Conductor *</label>
                {tecnicoSeleccionado && (
                  <span className="text-[10px] font-mono text-cyan-700 font-bold">
                    DNI: {tecnicoSeleccionado.documento || "S/D"}
                  </span>
                )}
              </div>

              {idTrabajadorInicial && tecnicoSeleccionado ? (
                <div className="p-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 flex items-center justify-center font-black">
                      <User size={16} />
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-black text-indigo-300 tracking-wider block">
                        Técnico Identificado
                      </span>
                      <span className="font-extrabold text-xs text-white">
                        {tecnicoSeleccionado.nombre_completo}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                    {tecnicoSeleccionado.cuadrilla || "Cuadrilla"}
                  </span>
                </div>
              ) : (
                <select
                  value={idTrabajador}
                  onChange={(e) => setIdTrabajador(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-cyan-500 focus:outline-none cursor-pointer font-bold text-slate-800"
                >
                  <option value="">Selecciona tu nombre...</option>
                  {tecnicos.map((t) => (
                    <option key={t.id_trabajador} value={t.id_trabajador}>
                      {t.nombre_completo} {t.cuadrilla ? `(${t.cuadrilla})` : ""} {t.vehiculo_placa ? `• 🚗 ${t.vehiculo_placa}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Vehículo Asignado (Estrictamente controlado por la BD / Administrador) */}
            <div>
              <label className="block mb-1 text-slate-700 font-bold">Vehículo Asignado por Administración</label>
              {vehiculoAsignado ? (
                <div className="p-3 bg-gradient-to-r from-slate-50 via-cyan-50/40 to-slate-50 border border-cyan-300 rounded-2xl flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                      <Car size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-slate-900 tracking-wider">
                          {vehiculoAsignado.placa}
                        </span>
                        {vehiculoAsignado.anio && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800">
                            {vehiculoAsignado.anio}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 font-bold">
                        {vehiculoAsignado.marca || ""} {vehiculoAsignado.modelo || ""} {vehiculoAsignado.color ? `(${vehiculoAsignado.color})` : ""} &bull; {vehiculoAsignado.combustible || "Gasolina"}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 shrink-0">
                    🔒 Asignado por Admin
                  </span>
                </div>
              ) : (
                <div className="p-4 bg-amber-50/80 border border-amber-300 rounded-2xl space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs">
                    <AlertCircle size={18} className="text-amber-600 shrink-0" />
                    <span>Sin vehículo asignado</span>
                  </div>
                  <p className="text-[11px] text-amber-800 font-semibold leading-relaxed">
                    No tienes una placa o vehículo asignado en el sistema. La asignación de unidades es gestionada exclusivamente por el <b>Administrador de Flota</b>.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* MODO INICIO DE JORNADA */}
          {tipoJornada === "inicio" ? (
            <>
              {/* Odómetro Inicial */}
              <div>
                <label className="block mb-1 text-slate-600">Kilometraje de Entrada *</label>
                <div className="relative">
                  <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-600" size={17} />
                  <input
                    type="number"
                    placeholder="Ej: 124500"
                    value={kmInicio}
                    onChange={(e) => setKmInicio(e.target.value)}
                    required
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-cyan-500 focus:outline-none font-mono font-bold text-sm"
                  />
                </div>
              </div>

              {/* Subida de Fotos Obligatorias */}
              <div className="space-y-2.5">
                <span className="block text-slate-700 font-extrabold text-xs">
                  📸 Fotos Obligatorias de Inspección:
                </span>

                <div className="grid grid-cols-2 gap-2.5">
                  {/* Foto Tablero Inicio */}
                  <label className={`p-3 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    fotoTableroInicio ? "border-emerald-500 bg-emerald-50/50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  }`}>
                    <Gauge size={22} className={fotoTableroInicio ? "text-emerald-600" : "text-slate-400"} />
                    <span className="font-bold text-[11px] mt-1 text-slate-700">1. Foto Tablero</span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                      {fotoTableroInicio ? fotoTableroInicio.name : "Subir odómetro"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && setFotoTableroInicio(e.target.files[0])}
                      className="hidden"
                    />
                  </label>

                  {/* Foto Aceite */}
                  <label className={`p-3 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    fotoAceite ? "border-emerald-500 bg-emerald-50/50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  }`}>
                    <Droplet size={22} className={fotoAceite ? "text-emerald-600" : "text-slate-400"} />
                    <span className="font-bold text-[11px] mt-1 text-slate-700">2. Foto Aceite</span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                      {fotoAceite ? fotoAceite.name : "Varilla motor"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && setFotoAceite(e.target.files[0])}
                      className="hidden"
                    />
                  </label>

                  {/* Foto Agua / Refrigerante */}
                  <label className={`p-3 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    fotoAgua ? "border-emerald-500 bg-emerald-50/50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  }`}>
                    <Waves size={22} className={fotoAgua ? "text-emerald-600" : "text-slate-400"} />
                    <span className="font-bold text-[11px] mt-1 text-slate-700">3. Foto Refrigerante</span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                      {fotoAgua ? fotoAgua.name : "Nivel de agua"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && setFotoAgua(e.target.files[0])}
                      className="hidden"
                    />
                  </label>

                  {/* Foto Carrocería */}
                  <label className={`p-3 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    fotoEstadoGeneral ? "border-emerald-500 bg-emerald-50/50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  }`}>
                    <Camera size={22} className={fotoEstadoGeneral ? "text-emerald-600" : "text-slate-400"} />
                    <span className="font-bold text-[11px] mt-1 text-slate-700">4. Carrocería / Llantas</span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                      {fotoEstadoGeneral ? fotoEstadoGeneral.name : "Estado general"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && setFotoEstadoGeneral(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </>
          ) : (
            /* MODO CIERRE DE JORNADA */
            <>
              {/* Odómetro Final */}
              <div>
                <label className="block mb-1 text-slate-600">Kilometraje de Cierre *</label>
                <div className="relative">
                  <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600" size={17} />
                  <input
                    type="number"
                    placeholder="Ej: 124585"
                    value={kmFin}
                    onChange={(e) => setKmFin(e.target.value)}
                    required
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-none font-mono font-bold text-sm"
                  />
                </div>
              </div>

              {/* Foto Tablero Final */}
              <div>
                <label className="block mb-1 text-slate-600">Foto del Tablero Final *</label>
                <label className={`p-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  fotoTableroFin ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                }`}>
                  <Gauge size={24} className={fotoTableroFin ? "text-indigo-600" : "text-slate-400"} />
                  <span className="font-bold text-xs mt-1 text-slate-800">
                    {fotoTableroFin ? fotoTableroFin.name : "Subir foto de odómetro final"}
                  </span>
                  <span className="text-[10px] text-slate-400">Verifica que los números sean legibles</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && setFotoTableroFin(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              </div>
            </>
          )}

          {/* Observaciones */}
          <div>
            <label className="block mb-1 text-slate-600">Novedades o Estado Mecánico</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Ej: Freno con chirrido leve, llanta delantera derecha con baja presión..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {/* Botones Enviar */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || !vehiculoAsignado}
              className={`px-6 py-2.5 rounded-xl font-bold text-white shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                !vehiculoAsignado
                  ? "bg-slate-400"
                  : tipoJornada === "inicio"
                  ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                  : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20"
              }`}
            >
              {guardando
                ? "Enviando..."
                : !vehiculoAsignado
                ? "🔒 Requiere Asignación por Admin"
                : tipoJornada === "inicio"
                ? "🚀 Enviar Inicio de Jornada"
                : "🏁 Enviar Cierre de Jornada"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
