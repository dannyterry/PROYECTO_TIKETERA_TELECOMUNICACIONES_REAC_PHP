import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Building2,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  RotateCw,
  AlertCircle,
  Search,
  Users,
} from "lucide-react";
import {
  RolItem,
  AreaItem,
  getRoles,
  createRol,
  updateRol,
  deleteRol,
  getAreas,
  createArea,
  updateArea,
  deleteArea,
} from "../../../services/employeeService";
import { authService } from "../../../services/authService";

export const RolesTab: React.FC = () => {
  const canCrearRol = authService.hasPermission("roles.crear");
  const canEditarRol = authService.hasPermission("roles.editar");
  const canEliminarRol = authService.hasPermission("roles.eliminar");

  const [activeSubTab, setActiveSubTab] = useState<"roles" | "areas">("roles");

  // --- Estado de Roles ---
  const [roles, setRoles] = useState<RolItem[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [filtroTextoRoles, setFiltroTextoRoles] = useState("");

  const [modalRolAbierto, setModalRolAbierto] = useState(false);
  const [rolEditando, setRolEditando] = useState<RolItem | null>(null);
  const [nombreRol, setNombreRol] = useState("");
  const [descripcionRol, setDescripcionRol] = useState("");
  const [estadoRol, setEstadoRol] = useState<"Activo" | "Inactivo">("Activo");
  const [guardandoRol, setGuardandoRol] = useState(false);
  const [errorRolMsg, setErrorRolMsg] = useState("");

  // --- Estado de Áreas ---
  const [areas, setAreas] = useState<AreaItem[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(true);
  const [filtroTextoAreas, setFiltroTextoAreas] = useState("");

  const [modalAreaAbierto, setModalAreaAbierto] = useState(false);
  const [areaEditando, setAreaEditando] = useState<AreaItem | null>(null);
  const [nombreArea, setNombreArea] = useState("");
  const [estadoArea, setEstadoArea] = useState<"Activo" | "Inactivo">("Activo");
  const [guardandoArea, setGuardandoArea] = useState(false);
  const [errorAreaMsg, setErrorAreaMsg] = useState("");

  // --- Cargas iniciales ---
  const cargarRoles = async () => {
    try {
      setLoadingRoles(true);
      const data = await getRoles();
      setRoles(data || []);
    } catch (err: any) {
      console.error("Error al cargar roles:", err);
    } finally {
      setLoadingRoles(false);
    }
  };

  const cargarAreas = async () => {
    try {
      setLoadingAreas(true);
      const data = await getAreas();
      setAreas(data || []);
    } catch (err: any) {
      console.error("Error al cargar áreas:", err);
    } finally {
      setLoadingAreas(false);
    }
  };

  useEffect(() => {
    cargarRoles();
    cargarAreas();
  }, []);

  // --- Handlers Roles ---
  const handleAbrirCrearRol = () => {
    setRolEditando(null);
    setNombreRol("");
    setDescripcionRol("");
    setEstadoRol("Activo");
    setErrorRolMsg("");
    setModalRolAbierto(true);
  };

  const handleAbrirEditarRol = (rol: RolItem) => {
    setRolEditando(rol);
    setNombreRol(rol.nombre);
    setDescripcionRol(rol.descripcion || "");
    setEstadoRol(rol.estado || "Activo");
    setErrorRolMsg("");
    setModalRolAbierto(true);
  };

  const handleSubmitRol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreRol.trim()) {
      setErrorRolMsg("El nombre del rol es requerido.");
      return;
    }

    try {
      setGuardandoRol(true);
      setErrorRolMsg("");

      if (rolEditando) {
        await updateRol(rolEditando.id_rol, {
          nombre: nombreRol.trim().toUpperCase(),
          descripcion: descripcionRol.trim() || undefined,
          estado: estadoRol,
        });
      } else {
        await createRol({
          nombre: nombreRol.trim().toUpperCase(),
          descripcion: descripcionRol.trim() || undefined,
          estado: estadoRol,
        });
      }

      setModalRolAbierto(false);
      cargarRoles();
    } catch (err: any) {
      setErrorRolMsg(err.message || "Error al guardar el rol");
    } finally {
      setGuardandoRol(false);
    }
  };

  const handleDesactivarRol = async (rol: RolItem) => {
    if (!window.confirm(`¿Estás seguro de desactivar el rol "${rol.nombre}"?`)) return;

    try {
      await deleteRol(rol.id_rol);
      cargarRoles();
    } catch (err: any) {
      alert("Error al desactivar: " + err.message);
    }
  };

  // --- Handlers Áreas ---
  const handleAbrirCrearArea = () => {
    setAreaEditando(null);
    setNombreArea("");
    setEstadoArea("Activo");
    setErrorAreaMsg("");
    setModalAreaAbierto(true);
  };

  const handleAbrirEditarArea = (area: AreaItem) => {
    setAreaEditando(area);
    setNombreArea(area.nombre);
    setEstadoArea(area.estado || "Activo");
    setErrorAreaMsg("");
    setModalAreaAbierto(true);
  };

  const handleSubmitArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreArea.trim()) {
      setErrorAreaMsg("El nombre del área es requerido.");
      return;
    }

    try {
      setGuardandoArea(true);
      setErrorAreaMsg("");

      if (areaEditando) {
        await updateArea(areaEditando.id_area, {
          nombre: nombreArea.trim(),
          estado: estadoArea,
        });
      } else {
        await createArea({
          nombre: nombreArea.trim(),
          estado: estadoArea,
        });
      }

      setModalAreaAbierto(false);
      cargarAreas();
    } catch (err: any) {
      setErrorAreaMsg(err.message || "Error al guardar el área");
    } finally {
      setGuardandoArea(false);
    }
  };

  const handleDesactivarArea = async (area: AreaItem) => {
    if (!window.confirm(`¿Estás seguro de desactivar el área "${area.nombre}"?`)) return;

    try {
      await deleteArea(area.id_area);
      cargarAreas();
    } catch (err: any) {
      alert("Error al desactivar área: " + err.message);
    }
  };

  // Filtros
  const rolesFiltrados = roles.filter((r) => {
    const txt = filtroTextoRoles.toLowerCase();
    return (
      !txt ||
      r.nombre.toLowerCase().includes(txt) ||
      (r.descripcion && r.descripcion.toLowerCase().includes(txt))
    );
  });

  const areasFiltradas = areas.filter((a) => {
    const txt = filtroTextoAreas.toLowerCase();
    return !txt || a.nombre.toLowerCase().includes(txt);
  });

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER CON TOGGLE ENTRE ROLES Y ÁREAS
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
            {activeSubTab === "roles" ? <ShieldCheck size={22} /> : <Building2 size={22} />}
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">
              {activeSubTab === "roles" ? "Roles y Perfiles de Personal" : "Departamentos y Áreas Laborales"}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {activeSubTab === "roles"
                ? "Administración de cargos operativos, técnicos, administrativos y de supervisión"
                : "Organización de departamentos de la empresa vinculados a la planilla de personal"}
            </p>
          </div>
        </div>

        {/* Pestañas Switcher: Roles vs Áreas */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveSubTab("roles")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === "roles"
                ? "bg-white text-teal-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ShieldCheck size={15} />
            <span>Roles ({roles.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("areas")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === "areas"
                ? "bg-white text-teal-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Building2 size={15} />
            <span>Áreas ({areas.length})</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. VISTA SUB-TAB: ROLES
      ───────────────────────────────────────────────────────────── */}
      {activeSubTab === "roles" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[220px] flex-1 sm:flex-initial">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por rol o función..."
                value={filtroTextoRoles}
                onChange={(e) => setFiltroTextoRoles(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 shadow-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={cargarRoles}
                disabled={loadingRoles}
                className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
                title="Actualizar roles"
              >
                <RotateCw size={16} className={loadingRoles ? "animate-spin text-teal-600" : ""} />
              </button>
              {canCrearRol && (
                <button
                  onClick={handleAbrirCrearRol}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-bold flex items-center gap-2 shadow-md shadow-teal-600/20 transition-all cursor-pointer active:scale-95"
                >
                  <Plus size={16} />
                  <span>Crear Rol</span>
                </button>
              )}
            </div>
          </div>

          {/* Tabla de Roles */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-4">ID</th>
                    <th className="py-3.5 px-4">Rol / Cargo</th>
                    <th className="py-3.5 px-4">Descripción</th>
                    <th className="py-3.5 px-4 text-center">Estado</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {loadingRoles ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <RotateCw className="animate-spin inline-block mr-2 text-teal-600" size={18} />
                        Cargando roles de personal...
                      </td>
                    </tr>
                  ) : rolesFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        No se encontraron roles que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    rolesFiltrados.map((rol) => {
                      const esActivo = rol.estado === "Activo" || !rol.estado;
                      return (
                        <tr key={rol.id_rol} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-400 font-bold">
                            #{rol.id_rol}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs">
                                {rol.nombre}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                            {rol.descripcion || <span className="text-slate-300 italic">Sin descripción</span>}
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
                              {rol.estado || "Activo"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              {canEditarRol && (
                                <button
                                  onClick={() => handleAbrirEditarRol(rol)}
                                  className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-all cursor-pointer"
                                  title="Editar Rol"
                                >
                                  <Edit2 size={14} />
                                </button>
                              )}
                              {canEliminarRol && esActivo && (
                                <button
                                  onClick={() => handleDesactivarRol(rol)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                  title="Desactivar Rol"
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
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. VISTA SUB-TAB: ÁREAS / DEPARTAMENTOS
      ───────────────────────────────────────────────────────────── */}
      {activeSubTab === "areas" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[220px] flex-1 sm:flex-initial">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por área o departamento..."
                value={filtroTextoAreas}
                onChange={(e) => setFiltroTextoAreas(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 shadow-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={cargarAreas}
                disabled={loadingAreas}
                className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
                title="Actualizar áreas"
              >
                <RotateCw size={16} className={loadingAreas ? "animate-spin text-teal-600" : ""} />
              </button>
              {canCrearRol && (
                <button
                  onClick={handleAbrirCrearArea}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-bold flex items-center gap-2 shadow-md shadow-teal-600/20 transition-all cursor-pointer active:scale-95"
                >
                  <Plus size={16} />
                  <span>Crear Área</span>
                </button>
              )}
            </div>
          </div>

          {/* Tabla de Áreas */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-4">ID</th>
                    <th className="py-3.5 px-4">Departamento / Área</th>
                    <th className="py-3.5 px-4 text-center">Colaboradores Asignados</th>
                    <th className="py-3.5 px-4 text-center">Estado</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {loadingAreas ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <RotateCw className="animate-spin inline-block mr-2 text-teal-600" size={18} />
                        Cargando áreas de la empresa...
                      </td>
                    </tr>
                  ) : areasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        No se encontraron áreas que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    areasFiltradas.map((area) => {
                      const esActivo = area.estado === "Activo" || !area.estado;
                      return (
                        <tr key={area.id_area} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-400 font-bold">
                            #{area.id_area}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Building2 size={16} className="text-teal-600" />
                              <span className="font-bold text-slate-900 text-xs">
                                {area.nombre}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">
                              <Users size={13} className="text-slate-500" />
                              {area.total_empleados || 0} personas
                            </span>
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
                              {area.estado || "Activo"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              {canEditarRol && (
                                <button
                                  onClick={() => handleAbrirEditarArea(area)}
                                  className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-all cursor-pointer"
                                  title="Editar Área"
                                >
                                  <Edit2 size={14} />
                                </button>
                              )}
                              {canEliminarRol && esActivo && (
                                <button
                                  onClick={() => handleDesactivarArea(area)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                  title="Desactivar Área"
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
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: CREAR / EDITAR ROL
      ───────────────────────────────────────────────────────────── */}
      {modalRolAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {rolEditando ? "Editar Rol" : "Nuevo Rol de Personal"}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Define la designación laboral para los usuarios
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalRolAbierto(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitRol} className="p-5 space-y-4">
              {errorRolMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{errorRolMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre del Rol <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nombreRol}
                  onChange={(e) => setNombreRol(e.target.value)}
                  placeholder="ej. SUPERVISOR, TECNICO, ASISTENTE RRHH..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 uppercase focus:outline-none focus:border-teal-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descripción
                </label>
                <textarea
                  rows={3}
                  value={descripcionRol}
                  onChange={(e) => setDescripcionRol(e.target.value)}
                  placeholder="Funciones o nivel jerárquico del rol..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Estado
                </label>
                <select
                  value={estadoRol}
                  onChange={(e) => setEstadoRol(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-teal-500 transition-all"
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalRolAbierto(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoRol}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-teal-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {guardandoRol ? <RotateCw className="animate-spin" size={15} /> : <Check size={15} />}
                  <span>{rolEditando ? "Guardar Cambios" : "Crear Rol"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: CREAR / EDITAR ÁREA
      ───────────────────────────────────────────────────────────── */}
      {modalAreaAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {areaEditando ? "Editar Área" : "Nueva Área o Departamento"}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Sector organizacional para clasificar al personal
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalAreaAbierto(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitArea} className="p-5 space-y-4">
              {errorAreaMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{errorAreaMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre del Área <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nombreArea}
                  onChange={(e) => setNombreArea(e.target.value)}
                  placeholder="ej. Operaciones, Almacén, Logística, Post Venta..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Estado
                </label>
                <select
                  value={estadoArea}
                  onChange={(e) => setEstadoArea(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-teal-500 transition-all"
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAreaAbierto(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoArea}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-teal-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {guardandoArea ? <RotateCw className="animate-spin" size={15} /> : <Check size={15} />}
                  <span>{areaEditando ? "Guardar Cambios" : "Crear Área"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
