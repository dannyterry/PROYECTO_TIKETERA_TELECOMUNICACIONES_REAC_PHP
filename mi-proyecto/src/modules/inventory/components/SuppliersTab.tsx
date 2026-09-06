import React, { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  RotateCw,
  AlertCircle,
  Search,
  Phone,
  Mail,
  MapPin,
  FileText,
  Sparkles,
  SearchCode,
} from "lucide-react";
import { Proveedor } from "../types/inventoryTypes";
import {
  getProveedores,
  crearProveedor,
  actualizarProveedor,
  desactivarProveedor,
  consultarSunatRuc,
} from "../services/inventoryService";

export const SuppliersTab: React.FC = () => {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState("");

  // Modal Crear / Editar
  const [modalAbierto, setModalAbierto] = useState(false);
  const [proveedorEditando, setProveedorEditando] = useState<Proveedor | null>(null);

  const [ruc, setRuc] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [nombreComercial, setNombreComercial] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [direccion, setDireccion] = useState("");
  const [estado, setEstado] = useState<"Activo" | "Inactivo">("Activo");

  const [consultandoSunat, setConsultandoSunat] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const cargarProveedores = async () => {
    try {
      setLoading(true);
      const data = await getProveedores();
      setProveedores(data || []);
    } catch (err: any) {
      console.error("Error al cargar proveedores:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarProveedores();
  }, []);

  const handleAbrirCrear = () => {
    setProveedorEditando(null);
    setRuc("");
    setRazonSocial("");
    setNombreComercial("");
    setTelefono("");
    setEmail("");
    setDireccion("");
    setEstado("Activo");
    setErrorMsg("");
    setModalAbierto(true);
  };

  const handleAbrirEditar = (p: Proveedor) => {
    setProveedorEditando(p);
    setRuc(p.ruc || "");
    setRazonSocial(p.razon_social);
    setNombreComercial(p.nombre_comercial || "");
    setTelefono(p.telefono || "");
    setEmail(p.email || "");
    setDireccion(p.direccion || "");
    setEstado(p.estado || "Activo");
    setErrorMsg("");
    setModalAbierto(true);
  };

  const handleConsultarSunat = async () => {
    if (!ruc.trim() || ruc.trim().length !== 11) {
      setErrorMsg("Ingrese un número de RUC válido de 11 dígitos.");
      return;
    }

    try {
      setConsultandoSunat(true);
      setErrorMsg("");
      const res = await consultarSunatRuc(ruc.trim());
      if (res && res.razonSocial) {
        setRazonSocial(res.razonSocial);
        if (res.direccion) setDireccion(res.direccion);
      } else {
        setErrorMsg("No se encontraron datos para este RUC en SUNAT.");
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || "Error al conectar con SUNAT");
    } finally {
      setConsultandoSunat(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!razonSocial.trim()) {
      setErrorMsg("La Razón Social es obligatoria.");
      return;
    }

    try {
      setGuardando(true);
      setErrorMsg("");

      const payload = {
        ruc: ruc.trim() || undefined,
        razon_social: razonSocial.trim().toUpperCase(),
        nombre_comercial: nombreComercial.trim() || undefined,
        telefono: telefono.trim() || undefined,
        email: email.trim() || undefined,
        direccion: direccion.trim() || undefined,
        estado,
      };

      if (proveedorEditando) {
        await actualizarProveedor(proveedorEditando.id_proveedor, payload);
      } else {
        await crearProveedor(payload);
      }

      setModalAbierto(false);
      cargarProveedores();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleDesactivar = async (p: Proveedor) => {
    if (!window.confirm(`¿Estás seguro de desactivar al proveedor "${p.razon_social}"?`)) return;

    try {
      await desactivarProveedor(p.id_proveedor);
      cargarProveedores();
    } catch (err: any) {
      alert("Error al desactivar: " + (err.response?.data?.error || err.message));
    }
  };

  const proveedoresFiltrados = proveedores.filter((p) => {
    const txt = filtroTexto.toLowerCase();
    return (
      !txt ||
      p.razon_social.toLowerCase().includes(txt) ||
      (p.nombre_comercial && p.nombre_comercial.toLowerCase().includes(txt)) ||
      (p.ruc && p.ruc.includes(txt)) ||
      (p.direccion && p.direccion.toLowerCase().includes(txt))
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER & BUSCADOR
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
            <Building2 size={22} />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">
              Proveedores de Equipos & Materiales
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Empresas proveedoras, importadores y compras con consulta RUC directa
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-1 sm:flex-initial justify-end">
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Buscar por RUC o Razón Social..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-500 transition-all"
            />
          </div>

          <button
            type="button"
            onClick={handleAbrirCrear}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-teal-600/20 transition-all cursor-pointer shrink-0"
          >
            <Plus size={16} />
            <span>Nuevo Proveedor</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. TABLA DE PROVEEDORES
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs font-semibold text-slate-400">
            Cargando proveedores...
          </div>
        ) : proveedoresFiltrados.length === 0 ? (
          <div className="p-12 text-center text-xs font-medium text-slate-400">
            No se encontraron proveedores registrados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">Razón Social & Comercial</th>
                  <th className="py-3.5 px-5">RUC</th>
                  <th className="py-3.5 px-5">Teléfono / Correo</th>
                  <th className="py-3.5 px-5">Dirección</th>
                  <th className="py-3.5 px-5 text-center">Estado</th>
                  <th className="py-3.5 px-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {proveedoresFiltrados.map((p) => (
                  <tr key={p.id_proveedor} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-5">
                      <div>
                        <span className="font-extrabold text-slate-900 block tracking-wide">
                          {p.razon_social}
                        </span>
                        {p.nombre_comercial && (
                          <span className="text-[10px] text-teal-700 font-bold block">
                            {p.nombre_comercial}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {p.ruc || "S/RUC"}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="space-y-0.5 text-[11px]">
                        {p.telefono && (
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Phone size={12} className="text-teal-600 shrink-0" />
                            <span>{p.telefono}</span>
                          </div>
                        )}
                        {p.email && (
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Mail size={12} className="text-slate-400 shrink-0" />
                            <span className="truncate max-w-[160px]">{p.email}</span>
                          </div>
                        )}
                        {!p.telefono && !p.email && (
                          <span className="text-slate-300 italic">Sin contacto</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-slate-500 max-w-[200px] truncate">
                      {p.direccion ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{p.direccion}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 italic">No registrada</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          p.estado === "Activo" || !p.estado
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {p.estado || "Activo"}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleAbrirEditar(p)}
                          className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all cursor-pointer"
                          title="Editar proveedor"
                        >
                          <Edit2 size={15} />
                        </button>
                        {p.estado !== "Inactivo" && (
                          <button
                            type="button"
                            onClick={() => handleDesactivar(p)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                            title="Desactivar"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
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
          3. MODAL CREAR / EDITAR PROVEEDOR
      ───────────────────────────────────────────────────────────── */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {proveedorEditando ? "Editar Proveedor" : "Nuevo Proveedor"}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Datos fiscales y de contacto del proveedor
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

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* RUC con botón SUNAT */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  RUC (11 dígitos)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={11}
                    value={ruc}
                    onChange={(e) => setRuc(e.target.value.replace(/\D/g, ""))}
                    placeholder="20XXXXXXXXX"
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-teal-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleConsultarSunat}
                    disabled={consultandoSunat || ruc.length !== 11}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {consultandoSunat ? (
                      <RotateCw className="animate-spin" size={14} />
                    ) : (
                      <SearchCode size={14} />
                    )}
                    <span>SUNAT</span>
                  </button>
                </div>
              </div>

              {/* Razón Social */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Razón Social <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                  placeholder="NOMBRE LEGAL DE LA EMPRESA S.A.C."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 uppercase focus:outline-none focus:border-teal-500 transition-all"
                />
              </div>

              {/* Nombre Comercial */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre Comercial
                </label>
                <input
                  type="text"
                  value={nombreComercial}
                  onChange={(e) => setNombreComercial(e.target.value)}
                  placeholder="Nombre de marca o fantasía..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-teal-500 transition-all"
                />
              </div>

              {/* Teléfono y Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Teléfono / Celular
                  </label>
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="999 999 999"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-teal-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ventas@proveedor.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-teal-500 transition-all"
                  />
                </div>
              </div>

              {/* Dirección */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Dirección Fiscal
                </label>
                <input
                  type="text"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Av. Principal 123, Lima..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-teal-500 transition-all"
                />
              </div>

              {/* Estado */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Estado
                </label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-teal-500 transition-all"
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
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
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-teal-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {guardando ? <RotateCw className="animate-spin" size={15} /> : <Check size={15} />}
                  <span>{proveedorEditando ? "Guardar Cambios" : "Crear Proveedor"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
