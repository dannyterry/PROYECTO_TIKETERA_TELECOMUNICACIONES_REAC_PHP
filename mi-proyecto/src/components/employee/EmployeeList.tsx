import React, { useState, useEffect, useRef } from "react";
import { Employee } from "./Employee";
import { API_URL } from "../../config/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

interface EmployeeListProps {
  empleados?: Employee[];
  onSelectEmployee: (emp: Employee) => void;
}

export const EmployeeList: React.FC<EmployeeListProps> = ({
  empleados = [],
  onSelectEmployee,
}) => {
  // Estados para nuestros filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Activo"); // Por defecto, es mejor ver a los activos
  const [filtroSCTR, setFiltroSCTR] = useState("Todos");
  const [mesVencimiento, setMesVencimiento] = useState(""); // Filtro por Mes
  const [copiadoId, setCopiadoId] = useState<number | null>(null);

  // 🎭 NUEVO: Filtro multiselección por Rol
  const [rolesSeleccionados, setRolesSeleccionados] = useState<string[]>([]);
  const [isOpenRoles, setIsOpenRoles] = useState(false);
  const [searchRol, setSearchRol] = useState("");
  const [rolesDisponibles, setRolesDisponibles] = useState<string[]>([]);
  const dropdownRolesRef = useRef<HTMLDivElement>(null);

  // Cargar lista de roles disponibles (desde la API de roles y desde la lista de empleados)
  useEffect(() => {
    const cargarRoles = async () => {
      try {
        const res = await fetch(`${API_URL}/roles`);
        let nombresApi: string[] = [];
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            nombresApi = data.map((r: any) => r.nombre).filter(Boolean);
          }
        }
        const nombresEmp: string[] = empleados.map((e) => e.rolNombre).filter(Boolean) as string[];
        const conjunto = Array.from(new Set([...nombresApi, ...nombresEmp])).sort();
        
        // Si hay empleados sin rol, agregamos la opción "Sin rol"
        const haySinRol = empleados.some(e => !e.rolNombre || e.rolNombre.trim() === "");
        if (haySinRol && !conjunto.includes("Sin rol")) {
          conjunto.push("Sin rol");
        }
        
        setRolesDisponibles(conjunto);
      } catch (e) {
        const nombresEmp = Array.from(new Set(empleados.map((e) => e.rolNombre).filter(Boolean) as string[])).sort();
        const haySinRol = empleados.some(e => !e.rolNombre || e.rolNombre.trim() === "");
        if (haySinRol && !nombresEmp.includes("Sin rol")) {
          nombresEmp.push("Sin rol");
        }
        setRolesDisponibles(nombresEmp);
      }
    };
    cargarRoles();
  }, [empleados]);

  // Listener para cerrar el menú desplegable de roles al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRolesRef.current && !dropdownRolesRef.current.contains(event.target as Node)) {
        setIsOpenRoles(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Función para alternar un rol en la selección múltiple
  const toggleRol = (rol: string) => {
    setRolesSeleccionados((prev) =>
      prev.includes(rol) ? prev.filter((r) => r !== rol) : [...prev, rol]
    );
  };

  const limpiarRoles = () => {
    setRolesSeleccionados([]);
  };

  // Conteo de empleados por rol
  const getCountPorRol = (rol: string) => {
    if (rol === "Sin rol") {
      return empleados.filter(e => !e.rolNombre || e.rolNombre.trim() === "").length;
    }
    return empleados.filter(e => e.rolNombre === rol).length;
  };

  // Función para copiar credenciales al portapapeles
  const copiarCredenciales = (e: React.MouseEvent, usuario?: string, password?: string, id?: number) => {
    e.stopPropagation();
    const texto = `Usuario: ${usuario || ""}\nContraseña: ${password || ""}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).catch(() => {});
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = texto;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    if (id !== undefined) {
      setCopiadoId(id);
      setTimeout(() => setCopiadoId(null), 2000);
    }
  };

  // Función para calcular si el SCTR está vencido o vence en 30 días
  const isVencidoOPorVencer = (fecha?: string) => {
    if (!fecha) return false;
    const hoy = new Date();
    const fVenc = new Date(fecha);
    const diffDias = (fVenc.getTime() - hoy.getTime()) / (1000 * 3600 * 24);
    return diffDias <= 30; // Vencido o por vencer en 30 días
  };

  // 1. LÓGICA DE FILTRADO AVANZADO MULTIPLE
  const filteredEmpleados = empleados.filter((emp) => {
    // A) Búsqueda por texto (Multicriterio: nombre completo, apellidos + nombres, palabras sueltas, DNI, etc.)
    const query = searchTerm.toLowerCase().trim();
    let matchSearch = true;

    if (query) {
      const fullText = [
        emp.nombres || "",
        emp.primerApellido || "",
        emp.segundoApellido || "",
        emp.dni || "",
        emp.usuario || "",
        emp.correo || "",
        emp.rolNombre || "",
        emp.area || "",
        emp.telefono || ""
      ].join(" ").toLowerCase();

      // Permite buscar por nombre completo, apellidos primero, o cualquier combinación de palabras
      const words = query.split(/\s+/).filter(Boolean);
      matchSearch = words.every((word) => fullText.includes(word));
    }

    // B) Filtro por Estado Laboral
    const matchEstado = filtroEstado === "Todos" || emp.estado === filtroEstado;

    // 🎭 C) Filtro por Rol (Multiselección)
    let matchRol = true;
    if (rolesSeleccionados.length > 0) {
      const rolActual = (emp.rolNombre || "").trim() || "Sin rol";
      matchRol = rolesSeleccionados.includes(rolActual);
    }

    // D) Filtro por Estado SCTR
    let matchSCTR = true;
    if (filtroSCTR === "Sin SCTR") matchSCTR = !emp.sctrVencimiento;
    if (filtroSCTR === "Con SCTR") matchSCTR = !!emp.sctrVencimiento;
    if (filtroSCTR === "Por Vencer / Vencido") matchSCTR = !!emp.sctrVencimiento && isVencidoOPorVencer(emp.sctrVencimiento);

    // E) Filtro por Mes de Vencimiento SCTR
    let matchMes = true;
    if (mesVencimiento) {
      matchMes = !!emp.sctrVencimiento && emp.sctrVencimiento.startsWith(mesVencimiento);
    }

    return matchSearch && matchEstado && matchRol && matchSCTR && matchMes;
  });

  // Lista de roles filtrada para el buscador interno del dropdown
  const rolesFiltrados = rolesDisponibles.filter(r => 
    r.toLowerCase().includes(searchRol.toLowerCase())
  );

  // Utilidad para formatear fechas a DD/MM/YYYY para el Excel
  const formatoFechaExcel = (fecha?: string) => {
    if (!fecha) return "";
    try {
      const [year, month, day] = fecha.split("T")[0].split("-");
      return `${day}/${month}/${year}`;
    } catch {
      return "";
    }
  };

  // EXPORTACIÓN 1: RECURSOS HUMANOS
  const exportarExcelRRHH = () => {
    if (filteredEmpleados.length === 0) return alert("No hay registros.");
    const headers = [
      "DNI", "NOMBRES", "PRIMER APELLIDO", "SEGUNDO APELLIDO", 
      "ESTADO", "ÁREA", "ROL", "CORREO ELECTRÓNICO", 
      "TELÉFONO", "SUELDO (S/)", "BANCO", "CUENTA", "CCI", 
      "FECHA INGRESO", "VENC. SCTR"
    ];
    
    const rows = filteredEmpleados.map((emp) => [
      `="${emp.dni || ""}"`,
      `"${emp.nombres || ""}"`,
      `"${emp.primerApellido || ""}"`,
      `"${emp.segundoApellido || ""}"`,
      `"${emp.estado || "Activo"}"`,
      `"${emp.area || "Sin área"}"`,
      `"${emp.rolNombre || emp.id_rol || "Sin rol"}"`,
      `"${emp.correo || ""}"`,
      `="${emp.telefono || ""}"`,
      `"${emp.sueldo || ""}"`,
      `"${emp.banco || ""}"`,
      `="${emp.cuenta || ""}"`,
      `="${emp.cci || ""}"`,
      `"${formatoFechaExcel(emp.fechaIngreso)}"`,
      `"${formatoFechaExcel(emp.sctrVencimiento)}"`
    ]);

    descargarCSV("Reporte_RRHH", headers, rows);
  };

  // EXPORTACIÓN 2: TRAMA SCTR 
  const exportarExcelSCTR = () => {
    if (filteredEmpleados.length === 0) return alert("No hay registros.");
    
    const headers = [
      "Nombres*", "ApPaterno*", "ApMaterno", "TipoTrabajador*", 
      "PaisNacimiento", "TipoIdent*", "NumIdent*", "Sexo*", 
      "FecNacimiento*", "Moneda*", "Remuneracion*", "EstadoCivil*", "Sede*"
    ];
    
    const rows = filteredEmpleados.map((emp) => [
      `"${emp.nombres || ""}"`,                                       
      `"${emp.primerApellido || ""}"`,                                
      `"${emp.segundoApellido || ""}"`,                               
      `"EMPLEADO"`,                                                   
      `"${(emp.paisNacimiento || "PERU").toUpperCase()}"`,                                                       
      `"${emp.tipoDocumento || ""}"`,                  
      `="${emp.dni || ""}"`,                                          
      `"${emp.sexo || ""}"`,                                                           
      `"${formatoFechaExcel(emp.fechaNacimiento)}"`,                  
      `"S/"`,                                                        
      `"1130"`,                                        
      `"${emp.estadoCivil || ""}"`,                                                           
      `"SEDE PRINCIPAL"`                                           
    ]);

    descargarCSV("Trama_SCTR", headers, rows);
  };

  // Función genérica para descargar CSV
  const descargarCSV = (nombreArchivo: string, headers: string[], rows: string[][]) => {
    const csvContent = "\ufeff" + [headers.join(";"), ...rows.map((e) => e.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${nombreArchivo}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 w-full">
      
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-5 py-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Directorio de Personal</h1>
          <p className="text-xs text-slate-500 mt-0.5">Gestiona, busca y exporta información de Recursos Humanos y SSOMA.</p>
        </div>
        <div className="bg-teal-50 border border-teal-200 px-3.5 py-1.5 rounded-xl text-teal-800 text-xs font-bold shadow-xs flex items-center gap-2 self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
          <span>{filteredEmpleados.length} Registros</span>
        </div>
      </div>

      {/* BLOQUE DE FILTROS AVANZADOS (GRID RESPONSIVO) */}
      <div className="flex flex-col gap-3.5 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 items-end">
          
          {/* 1. Buscador */}
          <div className="w-full">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Búsqueda rápida</label>
            <Input 
              placeholder="🔍 Nombre, DNI, correo, rol..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full bg-gray-50 border-gray-300" 
            />
          </div>
          
          {/* 2. Filtro Estado */}
          <div className="w-full">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Estado Laboral</label>
            <select 
              value={filtroEstado} 
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="Todos">👥 Todos los estados</option>
              <option value="Activo">🟢 Solo Activos</option>
              <option value="Vacaciones">🔵 Vacaciones</option>
              <option value="Descanso Médico">🟡 Descanso Médico</option>
              <option value="Inactivo">🔴 Inactivos</option>
            </select>
          </div>

          {/* 3. 🎭 NUEVO: Filtro Rol con Multiselección */}
          <div className="w-full relative" ref={dropdownRolesRef}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Rol / Cargo {rolesSeleccionados.length > 0 && `(${rolesSeleccionados.length})`}
              </label>
              {rolesSeleccionados.length > 0 && (
                <button 
                  type="button" 
                  onClick={limpiarRoles} 
                  className="text-[10px] text-teal-600 hover:text-red-500 font-semibold cursor-pointer"
                  title="Ver todos los roles"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Botón selector que abre el dropdown */}
            <button
              type="button"
              onClick={() => setIsOpenRoles(!isOpenRoles)}
              className={`w-full h-10 rounded-md border px-3 py-2 text-sm flex items-center justify-between bg-background transition-all cursor-pointer ${
                isOpenRoles ? "ring-2 ring-teal-500 border-teal-500" : "border-input hover:border-gray-400"
              } ${rolesSeleccionados.length > 0 ? "bg-teal-50/50 font-semibold text-teal-900 border-teal-300 shadow-2xs" : "text-gray-700"}`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-xs">🎭</span>
                <span className="truncate text-xs">
                  {rolesSeleccionados.length === 0
                    ? "Todos los roles"
                    : rolesSeleccionados.length === 1
                    ? rolesSeleccionados[0]
                    : `${rolesSeleccionados.length} roles seleccionados`}
                </span>
              </div>
              <span className={`text-[10px] text-gray-400 transition-transform duration-200 shrink-0 ml-1 ${isOpenRoles ? "rotate-180" : ""}`}>
                ▼
              </span>
            </button>

            {/* Dropdown flotante con buscador y checkboxes */}
            {isOpenRoles && (
              <div className="absolute left-0 top-full mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-3 space-y-2.5">
                
                {/* Buscador interno */}
                {rolesDisponibles.length > 4 && (
                  <input
                    type="text"
                    placeholder="Buscar rol en la lista..."
                    value={searchRol}
                    onChange={(e) => setSearchRol(e.target.value)}
                    className="w-full h-8 text-xs px-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    autoFocus
                  />
                )}

                {/* Acciones rápidas */}
                <div className="flex items-center justify-between text-[11px] pb-1.5 border-b border-gray-100 text-gray-500 font-semibold px-1">
                  <button
                    type="button"
                    onClick={limpiarRoles}
                    className={`hover:text-teal-700 transition-colors cursor-pointer ${rolesSeleccionados.length === 0 ? "text-teal-700 font-bold" : ""}`}
                  >
                    {rolesSeleccionados.length === 0 ? "✓ Mostrando todos" : "Mostrar todos"}
                  </button>
                  {rolesSeleccionados.length > 0 && (
                    <button
                      type="button"
                      onClick={limpiarRoles}
                      className="text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                    >
                      Deseleccionar ({rolesSeleccionados.length})
                    </button>
                  )}
                </div>

                {/* Lista de Checkboxes con scroll */}
                <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                  {rolesFiltrados.map((rol) => {
                    const isChecked = rolesSeleccionados.includes(rol);
                    const count = getCountPorRol(rol);
                    return (
                      <div
                        key={rol}
                        onClick={() => toggleRol(rol)}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                          isChecked
                            ? "bg-teal-50 text-teal-900 font-bold border border-teal-200"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // Manejado por onClick del div contenedor
                            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer accent-teal-600"
                          />
                          <span>{rol}</span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 font-semibold">
                          {count}
                        </span>
                      </div>
                    );
                  })}

                  {rolesFiltrados.length === 0 && (
                    <div className="text-center py-4 text-xs text-gray-400">
                      No se encontraron roles
                    </div>
                  )}
                </div>

                {/* Botón Aplicar / Cerrar */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">
                    {rolesSeleccionados.length === 0 ? "Todos seleccionados" : `${rolesSeleccionados.length} seleccionados`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsOpenRoles(false)}
                    className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    Listo
                  </button>
                </div>

              </div>
            )}
          </div>

          {/* 4. Filtro SCTR Status */}
          <div className="w-full">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Estado SCTR</label>
            <select 
              value={filtroSCTR} 
              onChange={(e) => setFiltroSCTR(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="Todos">🛡️ Mostrar Todos</option>
              <option value="Con SCTR">✅ Tienen SCTR asignado</option>
              <option value="Sin SCTR">❌ Sin SCTR registrado</option>
              <option value="Por Vencer / Vencido">⚠️ Vencido o por vencer (30 días)</option>
            </select>
          </div>

          {/* 5. Mes de Vencimiento SCTR */}
          <div className="w-full relative">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">
              Mes Vencimiento SCTR
            </label>
            <div className="flex gap-2">
              <Input 
                type="month" 
                value={mesVencimiento} 
                onChange={(e) => setMesVencimiento(e.target.value)} 
                className="w-full bg-white border-gray-300 focus:ring-teal-500" 
                title="Selecciona el mes y año de vencimiento"
              />
              {mesVencimiento && (
                <Button 
                  variant="outline" 
                  onClick={() => setMesVencimiento("")} 
                  className="px-3 border-gray-300 text-red-500 hover:bg-red-50"
                  title="Limpiar mes"
                >
                  ✕
                </Button>
              )}
            </div>
          </div>

        </div>

        {/* Chips de Roles seleccionados */}
        {rolesSeleccionados.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100 text-xs">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Filtro por roles activo:</span>
            {rolesSeleccionados.map((rol) => (
              <span
                key={rol}
                className="inline-flex items-center gap-1.5 bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-2xs"
              >
                <span>🎭 {rol}</span>
                <button
                  type="button"
                  onClick={() => toggleRol(rol)}
                  className="text-teal-600 hover:text-red-500 font-bold ml-0.5 cursor-pointer text-xs"
                  title={`Quitar rol ${rol}`}
                >
                  ✕
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={limpiarRoles}
              className="text-xs text-gray-400 hover:text-red-500 underline ml-2 cursor-pointer font-medium"
            >
              Limpiar filtro de roles
            </button>
          </div>
        )}

        {/* Fila inferior: Botones de Exportación */}
        <div className="flex flex-wrap items-center gap-2.5 pt-3 mt-0.5 border-t border-gray-100">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">Exportar Data:</span>
          
          <Button variant="outline" size="sm" onClick={exportarExcelRRHH} className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 shadow-sm font-bold">
            🟩 Excel (RRHH)
          </Button>
          
          <Button variant="outline" size="sm" onClick={exportarExcelSCTR} className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 shadow-sm font-bold">
            🟧 Trama SCTR
          </Button>
          
          <Button variant="outline" size="sm" onClick={() => alert("Función PDF en desarrollo...")} className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 shadow-sm font-bold">
            🟥 PDF General
          </Button>
        </div>
      </div>

      {/* LA TABLA */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="max-h-[calc(100vh-250px)] overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-30 bg-slate-100 shadow-xs">
              <tr className="bg-slate-100">
                <th className="sticky top-0 z-30 bg-slate-100 font-bold text-gray-700 uppercase text-[11px] tracking-wider py-3.5 px-6 border-b border-gray-200 text-left">
                  Área / Rol
                </th>
                <th className="sticky top-0 z-30 bg-slate-100 font-bold text-gray-700 uppercase text-[11px] tracking-wider py-3.5 px-6 border-b border-gray-200 text-left">
                  Nombres y Apellidos
                </th>
                <th className="sticky top-0 z-30 bg-slate-100 font-bold text-gray-700 uppercase text-[11px] tracking-wider py-3.5 px-6 border-b border-gray-200 text-left">
                  Credenciales de Acceso
                </th>
                <th className="sticky top-0 z-30 bg-slate-100 font-bold text-gray-700 uppercase text-[11px] tracking-wider py-3.5 px-6 text-center border-b border-gray-200">
                  Venc. SCTR
                </th>
                <th className="sticky top-0 z-30 bg-slate-100 font-bold text-gray-700 uppercase text-[11px] tracking-wider py-3.5 px-6 text-center border-b border-gray-200">
                  Estado
                </th>
              </tr>
            </thead>

            <tbody className="bg-white">
              {filteredEmpleados.length > 0 ? (
                filteredEmpleados.map((emp) => (
                  <tr key={emp.id} onClick={() => onSelectEmployee(emp)} className="cursor-pointer hover:bg-teal-50/50 transition-colors border-b border-gray-100">
                    
                    <td className="py-4 px-6 border-b border-gray-100">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="inline-block bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-md font-semibold border border-slate-200">
                          {emp.area || "Sin área"}
                        </span>
                        {emp.rolNombre ? (
                          <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[11px] px-2 py-0.5 rounded-md font-bold border border-indigo-200">
                            <span className="text-[10px]">🎭</span> {emp.rolNombre}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic px-1">Sin rol</span>
                        )}
                      </div>
                    </td>
                    
                    <td className="py-4 px-6 font-bold text-gray-900 border-b border-gray-100">
                      <div className="flex flex-col">
                        <span>{`${emp.nombres || ""} ${emp.primerApellido || ""} ${emp.segundoApellido || ""}`}</span>
                        <span className="text-[11px] font-normal text-gray-400 mt-0.5 font-mono">{emp.dni}</span>
                      </div>
                    </td>

                    <td className="py-4 px-6 border-b border-gray-100" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 min-w-[210px] max-w-[260px] shadow-2xs">
                        <div className="flex flex-col text-xs font-mono">
                          <div className="flex items-center gap-1.5 text-gray-700">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-sans">User:</span>
                            <span className="font-semibold text-gray-900 truncate">{emp.usuario || "N/A"}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-gray-700 mt-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-sans">Pass:</span>
                            <span className="font-semibold text-indigo-700 truncate">{emp.password || "N/A"}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => copiarCredenciales(e, emp.usuario, emp.password, emp.id)}
                          title="Copiar usuario y contraseña"
                          className={`p-2 rounded-lg border transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                            copiadoId === emp.id
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                              : "bg-white text-gray-500 border-gray-200 hover:bg-gray-100 hover:text-gray-900 shadow-2xs"
                          }`}
                        >
                          {copiadoId === emp.id ? (
                            <span className="text-[10px] font-sans font-bold px-1 text-white">✓ Copiado</span>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                    
                    <td className="py-4 px-6 text-center border-b border-gray-100">
                      {emp.sctrVencimiento ? (
                        <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                          isVencidoOPorVencer(emp.sctrVencimiento) ? "bg-red-100 text-red-700" : "text-gray-600"
                        }`}>
                          {emp.sctrVencimiento.substring(0, 10)}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-xs">Sin asignar</span>
                      )}
                    </td>
                    
                    <td className="py-4 px-6 text-center border-b border-gray-100">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide border ${
                        emp.estado === "Activo" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : 
                        emp.estado === "Inactivo" ? "bg-red-50 text-red-700 border-red-200" : 
                        emp.estado === "Vacaciones" ? "bg-blue-50 text-blue-700 border-blue-200" : 
                        emp.estado === "Descanso Médico" ? "bg-yellow-50 text-yellow-700 border-yellow-200" : 
                        emp.estado === "Cesado" ? "bg-gray-100 text-gray-700 border-gray-300" : 
                        "bg-gray-50 text-gray-700 border-gray-200"
                      }`}>
                        {emp.estado || "Activo"}
                      </span>
                    </td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-gray-400">
                    <div className="flex flex-col items-center space-y-2">
                      <span className="text-3xl">🔍</span>
                      <p className="text-sm font-medium text-gray-600">No hay registros que coincidan con los filtros aplicados.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};