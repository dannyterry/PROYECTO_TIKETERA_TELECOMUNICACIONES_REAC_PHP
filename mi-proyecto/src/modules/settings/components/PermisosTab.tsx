import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Check,
  X,
  RotateCw,
  Search,
  Users,
  Edit2,
  Trash2,
  Lock,
  Layers,
  AlertCircle,
  FolderLock,
} from "lucide-react";
import {
  RolPermisoResumen,
  PermisoItem,
  getPermisosResumen,
  getPermisosRol,
  savePermisosRol,
  deletePermisosRol,
} from "../services/settingsService";

// Estructura oficial del Catálogo de Permisos por Áreas y Módulos
const CATALOGO_AREAS: Record<
  string,
  {
    nombre: string;
    modulos: Record<string, { nombre: string; acciones: string[] }>;
  }
> = {
  operaciones: {
    nombre: "Operaciones & Campo",
    modulos: {
      ordenes: {
        nombre: "Órdenes de Trabajo",
        acciones: ["ver", "crear", "editar", "eliminar", "liquidar", "sincronizar", "ver_stock"],
      },
      liquidaciones: {
        nombre: "Liquidaciones Técnicos",
        acciones: ["ver", "crear", "editar", "eliminar", "exportar"],
      },
    },
  },
  rrhh: {
    nombre: "Recursos Humanos & Personal",
    modulos: {
      usuarios: {
        nombre: "Directorio de Personal",
        acciones: ["ver", "crear", "editar", "eliminar"],
      },
      trabajadores: {
        nombre: "Ficha de Trabajador",
        acciones: ["ver", "crear", "editar", "eliminar"],
      },
      roles: {
        nombre: "Roles & Cargos",
        acciones: ["ver", "crear", "editar", "eliminar"],
      },
      asistencias: {
        nombre: "Control de Asistencias & Descansos",
        acciones: ["ver", "crear", "editar", "exportar"],
      },
      permisos: {
        nombre: "Matriz de Permisos",
        acciones: ["ver", "editar"],
      },
    },
  },
  inventario: {
    nombre: "Almacén & Logística",
    modulos: {
      productos: {
        nombre: "Productos & Materiales",
        acciones: ["ver", "crear", "editar", "eliminar", "exportar"],
      },
      stock: {
        nombre: "Control de Stock",
        acciones: ["ver", "editar", "exportar"],
      },
      compras: {
        nombre: "Compras a Proveedores",
        acciones: ["ver", "crear", "editar", "eliminar"],
      },
      almacenes: {
        nombre: "Almacenes",
        acciones: ["ver", "crear", "editar", "eliminar"],
      },
      proveedores: {
        nombre: "Proveedores",
        acciones: ["ver", "crear", "editar", "eliminar"],
      },
    },
  },
  movilidad: {
    nombre: "Movilidad & Vehículos",
    modulos: {
      vehiculos: {
        nombre: "Flota de Vehículos",
        acciones: ["ver", "crear", "editar", "eliminar"],
      },
      combustibles: {
        nombre: "Cargas de Combustible",
        acciones: ["ver", "crear", "editar", "eliminar", "exportar"],
      },
    },
  },
  configuracion: {
    nombre: "Configuración del Sistema",
    modulos: {
      motivos: {
        nombre: "Motivos de Liquidación",
        acciones: ["ver", "crear", "editar", "eliminar"],
      },
      tipo_trabajo: {
        nombre: "Tipos de Trabajo",
        acciones: ["ver", "crear", "editar", "eliminar"],
      },
      configuracion: {
        nombre: "Variables de Sistema & APIs",
        acciones: ["ver", "editar"],
      },
      dashboard: {
        nombre: "Dashboard Ejecutivo & Auditoría",
        acciones: ["ver"],
      },
    },
  },
};

const TODAS_ACCIONES = [
  "ver",
  "crear",
  "editar",
  "eliminar",
  "liquidar",
  "sincronizar",
  "exportar",
  "ver_stock",
];

export const PermisosTab: React.FC = () => {
  const [roles, setRoles] = useState<RolPermisoResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolSeleccionado, setRolSeleccionado] = useState<RolPermisoResumen | null>(null);

  // Claves activas en el modal (ej: ["ordenes.ver", "ordenes.crear", ...])
  const [clavesActivas, setClavesActivas] = useState<Set<string>>(new Set());
  const [cargandoRol, setCargandoRol] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [filtroModulo, setFiltroModulo] = useState("");

  const cargarResumen = async () => {
    try {
      setLoading(true);
      const res = await getPermisosResumen();
      setRoles(res.roles || []);
    } catch (err: any) {
      console.error("Error al cargar resumen de permisos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarResumen();
  }, []);

  const handleAbrirPermisos = async (rol: RolPermisoResumen) => {
    setRolSeleccionado(rol);
    try {
      setCargandoRol(true);
      const res = await getPermisosRol(rol.id_rol);
      setClavesActivas(new Set(res.claves || []));
    } catch (err: any) {
      alert("Error al cargar permisos: " + err.message);
      setClavesActivas(new Set());
    } finally {
      setCargandoRol(false);
    }
  };

  const handleToggleClave = (clave: string) => {
    const next = new Set(clavesActivas);
    if (next.has(clave)) next.delete(clave);
    else next.add(clave);
    setClavesActivas(next);
  };

  const handleToggleModulo = (modulo: string, acciones: string[]) => {
    const clavesMod = acciones.map((a) => `${modulo}.${a}`);
    const todasMarcadas = clavesMod.every((c) => clavesActivas.has(c));

    const next = new Set(clavesActivas);
    if (todasMarcadas) {
      clavesMod.forEach((c) => next.delete(c));
    } else {
      clavesMod.forEach((c) => next.add(c));
    }
    setClavesActivas(next);
  };

  const handleToggleGrupo = (modulos: Record<string, { acciones: string[] }>) => {
    let clavesGrupo: string[] = [];
    Object.entries(modulos).forEach(([mod, info]) => {
      info.acciones.forEach((a) => clavesGrupo.push(`${mod}.${a}`));
    });

    const todasMarcadas = clavesGrupo.every((c) => clavesActivas.has(c));
    const next = new Set(clavesActivas);
    if (todasMarcadas) {
      clavesGrupo.forEach((c) => next.delete(c));
    } else {
      clavesGrupo.forEach((c) => next.add(c));
    }
    setClavesActivas(next);
  };

  const handleMarcarTodo = () => {
    const next = new Set<string>();
    Object.values(CATALOGO_AREAS).forEach((grupo) => {
      Object.entries(grupo.modulos).forEach(([mod, info]) => {
        info.acciones.forEach((a) => next.add(`${mod}.${a}`));
      });
    });
    setClavesActivas(next);
  };

  const handleDesmarcarTodo = () => {
    setClavesActivas(new Set());
  };

  const handleGuardar = async () => {
    if (!rolSeleccionado) return;
    try {
      setGuardando(true);
      await savePermisosRol(rolSeleccionado.id_rol, Array.from(clavesActivas));
      setRolSeleccionado(null);
      cargarResumen();
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleLimpiarRol = async (rol: RolPermisoResumen) => {
    if (!window.confirm(`¿Quitar todos los permisos del rol "${rol.nombre_rol}"?`)) return;
    try {
      await deletePermisosRol(rol.id_rol);
      cargarResumen();
    } catch (err: any) {
      alert("Error al limpiar permisos: " + err.message);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Encabezado descriptivo */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <FolderLock className="text-indigo-600" size={20} />
            <span>Matriz de Permisos por Rol</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Define los privilegios de visualización, creación, edición y liquidación para cada rol
          </p>
        </div>
        <button
          onClick={cargarResumen}
          disabled={loading}
          className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          title="Recargar"
        >
          <RotateCw size={16} className={loading ? "animate-spin text-indigo-600" : ""} />
        </button>
      </div>

      {/* Grid de Cards por Rol */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((rol) => {
          const modulos = rol.modulos_activos
            ? rol.modulos_activos.split(",").filter(Boolean)
            : [];

          return (
            <div
              key={rol.id_rol}
              className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-slate-400 font-bold">
                    ROL #{rol.id_rol}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {rol.total_permisos || 0} permisos
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-black text-slate-900">{rol.nombre_rol}</h4>
                  <p className="text-[11px] text-slate-500">
                    Estado: <strong className="text-slate-700">{rol.estado}</strong>
                  </p>
                </div>

                {/* Módulos accesibles */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">
                    Módulos Autorizados:
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {modulos.length > 0 ? (
                      modulos.map((m, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-200"
                        >
                          {m}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-300 italic">
                        Sin permisos asignados
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleLimpiarRol(rol)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Quitar todos los permisos"
                >
                  <Trash2 size={15} />
                </button>
                <button
                  onClick={() => handleAbrirPermisos(rol)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer active:scale-95"
                >
                  <Edit2 size={14} />
                  <span>Configurar Permisos</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Matriz de Asignación de Permisos */}
      {rolSeleccionado && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Permisos de Rol: {rolSeleccionado.nombre_rol}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {clavesActivas.size} permisos seleccionados para este perfil
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRolSeleccionado(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Controles rápidos */}
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleMarcarTodo}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  ✓ Marcar Todo
                </button>
                <button
                  type="button"
                  onClick={handleDesmarcarTodo}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  ✕ Desmarcar Todo
                </button>
              </div>

              <div className="relative min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Filtrar módulos..."
                  value={filtroModulo}
                  onChange={(e) => setFiltroModulo(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Tabla Matriz de Permisos */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cargandoRol ? (
                <div className="py-20 text-center text-slate-400">
                  <RotateCw className="animate-spin inline-block mr-2 text-indigo-600" size={22} />
                  Cargando privilegios del rol...
                </div>
              ) : (
                Object.entries(CATALOGO_AREAS).map(([grupoKey, grupo]) => {
                  return (
                    <div
                      key={grupoKey}
                      className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs"
                    >
                      {/* Cabecera de Área */}
                      <div className="bg-slate-900 text-white p-3 px-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Layers size={16} className="text-indigo-400" />
                          <span className="text-xs font-black uppercase tracking-wider">
                            {grupo.nombre}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleGrupo(grupo.modulos)}
                          className="text-[11px] font-bold text-indigo-300 hover:text-white underline cursor-pointer"
                        >
                          Alternar Área
                        </button>
                      </div>

                      {/* Tabla interna */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-400">
                              <th className="py-2.5 px-3">Módulo</th>
                              {TODAS_ACCIONES.map((acc) => (
                                <th key={acc} className="py-2.5 px-2 text-center">
                                  {acc.replace("_", " ")}
                                </th>
                              ))}
                              <th className="py-2.5 px-2 text-center">Todos</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {Object.entries(grupo.modulos)
                              .filter(([mod, info]) => {
                                const q = filtroModulo.toLowerCase();
                                return (
                                  !q ||
                                  mod.toLowerCase().includes(q) ||
                                  info.nombre.toLowerCase().includes(q)
                                );
                              })
                              .map(([modulo, info]) => {
                                const clavesMod = info.acciones.map((a) => `${modulo}.${a}`);
                                const todasMarcadas =
                                  clavesMod.length > 0 &&
                                  clavesMod.every((c) => clavesActivas.has(c));

                                return (
                                  <tr key={modulo} className="hover:bg-slate-50/60">
                                    <td className="py-2.5 px-3 font-bold text-slate-800">
                                      {info.nombre}
                                    </td>
                                    {TODAS_ACCIONES.map((accion) => {
                                      const permiteAccion = info.acciones.includes(accion);
                                      if (!permiteAccion) {
                                        return (
                                          <td
                                            key={accion}
                                            className="py-2.5 px-2 text-center text-slate-300 select-none"
                                          >
                                            —
                                          </td>
                                        );
                                      }

                                      const clave = `${modulo}.${accion}`;
                                      const checked = clavesActivas.has(clave);

                                      return (
                                        <td key={accion} className="py-2.5 px-2 text-center">
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => handleToggleClave(clave)}
                                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                          />
                                        </td>
                                      );
                                    })}
                                    <td className="py-2.5 px-2 text-center">
                                      <input
                                        type="checkbox"
                                        checked={todasMarcadas}
                                        onChange={() =>
                                          handleToggleModulo(modulo, info.acciones)
                                        }
                                        className="w-4 h-4 rounded border-slate-300 text-slate-800 focus:ring-slate-900 cursor-pointer"
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-xs font-bold text-slate-500">
                {clavesActivas.size} permisos seleccionados
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRolSeleccionado(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGuardar}
                  disabled={guardando}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {guardando ? <RotateCw className="animate-spin" size={15} /> : <Check size={15} />}
                  <span>Guardar Permisos</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
