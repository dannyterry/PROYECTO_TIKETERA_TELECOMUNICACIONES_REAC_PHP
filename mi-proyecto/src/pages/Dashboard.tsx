import { useState, useEffect, useRef, useMemo } from "react";
import EmployeeForm from "../components/employee/EmployeeForm";
import { Employee } from "../components/employee/Employee";
import { getEmpleados , getHistorialEstados } from "../services/employeeService";
import { API_URL } from "../config/api";
import { useReactToPrint } from "react-to-print";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { authService } from "../services/authService";
import { Search, Filter, Check, ChevronDown, X, User } from "lucide-react";

interface DashboardProps {
  selectedEmpProp?: Employee | null;
  onDataUpdated?: () => void;
}

export default function Dashboard({ selectedEmpProp, onDataUpdated }: DashboardProps) {
  const canCrearEmpleado = authService.hasAnyPermission(["usuarios.crear", "trabajadores.crear"]);
  const canEditarEmpleado = authService.hasAnyPermission(["usuarios.editar", "trabajadores.editar"]);

  const [empleados, setEmpleados] = useState<Employee[]>([]);
  const [selectedEmpleado, setSelectedEmpleado] = useState<Employee | null>(selectedEmpProp || null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false); 
  const [historial, setHistorial] = useState<any[]>([]);
  const componentRef = useRef<HTMLDivElement>(null);

  // Filtros reactivos por Nombre/Apellido y Estado (Activos / Inactivos / Todos)
  const [busquedaTexto, setBusquedaTexto] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<"activos" | "inactivos" | "todos">("activos");
  const [dropdownEmpleadoAbierto, setDropdownEmpleadoAbierto] = useState<boolean>(false);
  const dropdownEmpleadoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownEmpleadoRef.current &&
        !dropdownEmpleadoRef.current.contains(event.target as Node)
      ) {
        setDropdownEmpleadoAbierto(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 1. Carga de datos principales
  useEffect(() => {
    const fetchDatos = async () => {
      try {
        const data = await getEmpleados();
        setEmpleados(data);

        if (selectedEmpProp) {
          const empleadoFresco = data.find(emp => emp.id === selectedEmpProp.id);
          setSelectedEmpleado(empleadoFresco || selectedEmpProp);
        } else if (data.length > 0) {
          setSelectedEmpleado(data[0]);
        }
      } catch (error) { 
        console.error("Error BD", error); 
      }
    };
    
    fetchDatos();
  }, [selectedEmpProp]);

  // 🚀 CORRECCIÓN: Este efecto se encarga EXCLUSIVAMENTE de traer el historial 
  // cada vez que cambias de empleado o actualizas el actual.
  useEffect(() => {
    if (selectedEmpleado && selectedEmpleado.id) {
      getHistorialEstados(selectedEmpleado.id)
        .then(data => setHistorial(Array.isArray(data) ? data : []))
        .catch(() => setHistorial([]));
    } else {
      setHistorial([]);
    }
  }, [selectedEmpleado?.id]); // Mira al ID del empleado seleccionado

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value);
    const empleado = empleados.find((emp) => emp.id === id) || null;
    setSelectedEmpleado(empleado);
  }; 

  const handlePrint = useReactToPrint({
    contentRef: componentRef, 
    documentTitle: selectedEmpleado ? `Ficha_${selectedEmpleado.nombres}_${selectedEmpleado.primerApellido}` : "Ficha",
    pageStyle: `
      @page {
        size: A4 portrait;
        margin: 15mm 12mm 15mm 12mm;
      }
      @media print {
        html, body {
          background-color: #ffffff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        * {
          box-shadow: none !important;
        }
      }
    `
  });

  const handleDelete = async () => {
    if (!selectedEmpleado) return;
    
    const confirmar = window.confirm(`¿Estás seguro de que deseas eliminar al empleado ${selectedEmpleado.nombres} ${selectedEmpleado.primerApellido}?`);
    if (!confirmar) return;

    try {
      const response = await fetch(`${API_URL}/empleados/${selectedEmpleado.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error("No se pudo eliminar el empleado desde el servidor.");
      }

      alert("¡Empleado eliminado correctamente!");
      window.location.reload(); 
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert("Hubo un error al intentar eliminar el empleado.");
    }
  };

  const handleSuccess = async () => {
    setIsModalOpen(false); // Cerramos el modal
    try {
      // Volvemos a traer toda la lista fresca de la base de datos
      const data = await getEmpleados();
      setEmpleados(data);
      
      let empActualizado = null;

      if (!modoEdicion && data.length > 0) {
        // MODO NUEVO: Si acabamos de crear uno, agarramos el último de la lista
        empActualizado = data[data.length - 1];
        setSelectedEmpleado(empActualizado);
      } else if (modoEdicion && selectedEmpleado) {
        // MODO EDICIÓN: Buscamos al empleado que estábamos editando en la lista FRESCA y lo repintamos
        empActualizado = data.find((emp) => emp.id === selectedEmpleado.id);
        if (empActualizado) {
          setSelectedEmpleado(empActualizado); 
        }
      }

      // Refrescamos el historial manualmente tras guardar
      if (empActualizado && empActualizado.id) {
        const nuevoHistorial = await getHistorialEstados(empActualizado.id);
        setHistorial(Array.isArray(nuevoHistorial) ? nuevoHistorial : []);
      }
      
      if (onDataUpdated) {
        onDataUpdated();
      }

    } catch (error) {
      console.error("Error actualizando la vista tras guardar:", error);
    }
  };

  const calcularProgreso = (emp: Employee) => {
    const camposClave = [
      emp.nombres, emp.primerApellido, emp.dni, emp.telefono, emp.correo,
      emp.fechaNacimiento, emp.sexo, emp.estadoCivil, emp.paisNacimiento, emp.direccion, emp.distrito, emp.sueldo,
      emp.ruc, emp.area, emp.fechaIngreso, emp.banco, emp.cuenta, emp.regimenPensionario,
      emp.contactoEmergencia, emp.telefonoEmergencia,
      emp.foto, emp.cv, emp.dni_pdf,
      emp.ultimoEmpleo1, emp.rolNombre
    ];
    
    const total = camposClave.length;
    const llenos = camposClave.filter(campo => campo && String(campo).trim() !== "").length;
    
    return Math.round((llenos / total) * 100);
  };

  // Filtrado reactivo de empleados por Estado y Texto (Nombre, Apellido, DNI, etc.)
  const empleadosFiltrados = useMemo(() => {
    let list = empleados;

    // Filtro por Estado
    if (filtroEstado === "activos") {
      list = list.filter((e) => (e.estado || "Activo").toLowerCase() === "activo");
    } else if (filtroEstado === "inactivos") {
      list = list.filter((e) => (e.estado || "").toLowerCase() !== "activo");
    }

    // Filtro por Texto: Nombre, Primer Apellido, Segundo Apellido, Nombre Completo, DNI, Cuadrilla
    if (busquedaTexto.trim()) {
      const q = busquedaTexto.toLowerCase().trim();
      list = list.filter((e) => {
        const nom = (e.nombres || "").toLowerCase();
        const ap1 = (e.primerApellido || "").toLowerCase();
        const ap2 = (e.segundoApellido || "").toLowerCase();
        const completo = `${nom} ${ap1} ${ap2}`.toLowerCase();
        const dni = (e.dni || "").toLowerCase();
        const cuad = (e.cuadrilla || "").toLowerCase();
        const area = (e.area || e.rolNombre || "").toLowerCase();

        return (
          nom.includes(q) ||
          ap1.includes(q) ||
          ap2.includes(q) ||
          completo.includes(q) ||
          dni.includes(q) ||
          cuad.includes(q) ||
          area.includes(q)
        );
      });
    }

    return list;
  }, [empleados, filtroEstado, busquedaTexto]);

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm print:hidden">
        
        {/* Selector de Empleado con Filtro de Estado y Buscador Reactivo */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* 1. Filtro por Estado: Activos / Inactivos / Todos */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs shadow-2xs">
            <Filter size={13} className="text-gray-400 shrink-0" />
            <span className="font-bold text-gray-500 text-[11px]">Estado:</span>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as any)}
              className="bg-transparent font-bold text-gray-800 text-xs focus:outline-none cursor-pointer"
            >
              <option value="activos">
                🟢 Activos ({empleados.filter((e) => (e.estado || "Activo").toLowerCase() === "activo").length})
              </option>
              <option value="inactivos">
                🔴 Inactivos / Cesados ({empleados.filter((e) => (e.estado || "").toLowerCase() !== "activo").length})
              </option>
              <option value="todos">Todos ({empleados.length})</option>
            </select>
          </div>

          {/* 2. Buscador y Selector de Empleado (Combobox con autocompletado en tiempo real) */}
          <div ref={dropdownEmpleadoRef} className="relative flex-1 sm:w-80 min-w-[260px]">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder={
                  selectedEmpleado
                    ? `${selectedEmpleado.nombres} ${selectedEmpleado.primerApellido}`
                    : "Escribe nombre, apellido o DNI..."
                }
                value={busquedaTexto}
                onFocus={(e) => {
                  setDropdownEmpleadoAbierto(true);
                  e.target.select();
                }}
                onChange={(e) => {
                  setBusquedaTexto(e.target.value);
                  setDropdownEmpleadoAbierto(true);
                }}
                className={`w-full pl-8 pr-16 py-2 bg-gray-50 hover:bg-gray-100/60 focus:bg-white border rounded-xl text-xs font-bold text-gray-800 placeholder:text-gray-700 placeholder:font-bold focus:outline-none transition-all ${
                  dropdownEmpleadoAbierto
                    ? "border-teal-500 ring-2 ring-teal-500/20 shadow-xs"
                    : "border-gray-300"
                }`}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {busquedaTexto && (
                  <button
                    type="button"
                    onClick={() => {
                      setBusquedaTexto("");
                      setDropdownEmpleadoAbierto(true);
                    }}
                    className="text-gray-400 hover:text-gray-600 p-1 text-xs font-bold cursor-pointer rounded-lg hover:bg-gray-200/50"
                    title="Limpiar búsqueda"
                  >
                    ✕
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDropdownEmpleadoAbierto(!dropdownEmpleadoAbierto)}
                  className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer rounded-lg hover:bg-gray-200/50"
                  tabIndex={-1}
                >
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${
                      dropdownEmpleadoAbierto ? "rotate-180 text-teal-600" : ""
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Menú Desplegable Flotante */}
            {dropdownEmpleadoAbierto && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 max-h-64 overflow-y-auto p-1.5 animate-in fade-in zoom-in-95 duration-100 divide-y divide-gray-50">
                {empleadosFiltrados.length > 0 ? (
                  empleadosFiltrados.map((emp) => {
                    const isSelected = selectedEmpleado?.id === emp.id;
                    const esActivo = (emp.estado || "Activo").toLowerCase() === "activo";
                    return (
                      <div
                        key={`dropdown-emp-${emp.id}`}
                        onClick={() => {
                          setSelectedEmpleado(emp);
                          setBusquedaTexto("");
                          setDropdownEmpleadoAbierto(false);
                        }}
                        className={`p-2 rounded-xl cursor-pointer flex items-center justify-between transition-colors text-xs ${
                          isSelected
                            ? "bg-teal-50 text-teal-900 font-bold border border-teal-200/60"
                            : "hover:bg-gray-100/80 text-gray-700"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <img
                            src={emp.foto ? `${API_URL}/uploads/${emp.foto}` : "https://i.pravatar.cc/150?img=12"}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover border border-gray-200 shrink-0"
                          />
                          <div className="truncate">
                            <p className="font-bold truncate text-gray-900 leading-tight">
                              {emp.nombres} {emp.primerApellido} {emp.segundoApellido || ""}
                            </p>
                            <p className="text-[10px] text-gray-400 truncate font-mono">
                              DNI: {emp.dni || "---"} {emp.cuadrilla ? `• ${emp.cuadrilla}` : ""} {emp.area ? `• ${emp.area}` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold ${
                              esActivo
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                            }`}
                          >
                            {emp.estado || "Activo"}
                          </span>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-teal-600 text-white flex items-center justify-center">
                              <Check size={10} className="stroke-[3]" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-4 px-3 text-center text-xs text-gray-400 font-medium">
                    No se encontraron empleados que coincidan con "{busquedaTexto}".
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-start xl:justify-end">
          
          {canCrearEmpleado && (
            <button
              onClick={() => { setModoEdicion(false); setIsModalOpen(true); }}
              className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              + Nuevo Empleado
            </button>
          )}

          <Dialog open={isModalOpen} onOpenChange={(isOpen) => { if (isOpen) setIsModalOpen(true); }}>
            <DialogContent showCloseButton={false} className="p-6 max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader className="mb-4">
                <DialogTitle className="flex items-center justify-between text-xl font-bold text-gray-800">
                  {modoEdicion ? "Editar Información del Empleado" : "Registro de Nuevo Empleado"}
                  <button onClick={() => setIsModalOpen(false)} className="text-sm text-red-500 hover:text-red-700 font-semibold">[ Cancelar ]</button>
                </DialogTitle>
              </DialogHeader>
              
              <EmployeeForm 
                key={modoEdicion && selectedEmpleado ? `edit-${selectedEmpleado.id}` : 'nuevo'}
                empleadoAEditar={modoEdicion ? selectedEmpleado : null} 
                onSuccess={handleSuccess} 
              />
            </DialogContent>
          </Dialog>

          {selectedEmpleado && (
            <>
              {canEditarEmpleado && (
                <button onClick={() => { setModoEdicion(true); setIsModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-blue-700 transition-colors cursor-pointer">
                  Editar Datos
                </button>
              )}

              <button onClick={handlePrint} className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-red-700 transition-colors cursor-pointer">
                Exportar a PDF
              </button>
            </>
          )}

        </div>
      </div>

      {selectedEmpleado ? (
        <div className="space-y-6">
          <div ref={componentRef} className="print:p-8 space-y-6 bg-transparent print:bg-white">
            
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm print:break-inside-avoid">
              <div className="flex items-center gap-8">
                <img src={selectedEmpleado.foto ? `${API_URL}/uploads/${selectedEmpleado.foto}` : "https://i.pravatar.cc/150?img=12"} alt="Perfil Empleado" className="h-32 w-32 rounded-full border-4 border-gray-50 object-cover shadow-sm" />
                <div className="flex-1">
                  <h2 className="text-3xl font-extrabold text-gray-900 uppercase tracking-tight">{selectedEmpleado.nombres} {selectedEmpleado.primerApellido} {selectedEmpleado.segundoApellido}</h2>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm text-gray-600">
                    <p><span className="font-semibold text-gray-800">DNI:</span> {selectedEmpleado.dni}</p>
                    <p><span className="font-semibold text-gray-800">Área:</span> {selectedEmpleado.rolNombre || selectedEmpleado.id_rol}</p>
                    <p><span className="font-semibold text-gray-800">Cargo:</span> {selectedEmpleado.area || "OPERACIONES"}</p>
                    {selectedEmpleado.tipo_servicio && (
                      <p><span className="font-semibold text-teal-700">Servicio:</span> <span className="font-bold text-teal-950 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md text-xs">{selectedEmpleado.tipo_servicio}</span></p>
                    )}
                    {selectedEmpleado.cuadrilla && (
                      <p><span className="font-semibold text-indigo-700">Cuadrilla:</span> <span className="font-bold text-indigo-950 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-xs font-mono">{selectedEmpleado.cuadrilla}</span></p>
                    )}
                  </div>
                  <div className="mt-3">
                    <span
                      className={`inline-block rounded-full px-3.5 py-1 text-xs font-bold tracking-wide print:border ${
                        selectedEmpleado.estado === "Activo"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : selectedEmpleado.estado === "Inactivo"
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : selectedEmpleado.estado === "Vacaciones"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : selectedEmpleado.estado === "Descanso Médico"
                          ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                          : selectedEmpleado.estado === "Cesado"
                          ? "bg-gray-100 text-gray-700 border border-gray-300"
                          : "bg-gray-50 text-gray-700 border border-gray-200"
                      }`}
                    >
                      {selectedEmpleado.estado || "Activo"}
                    </span>
                  </div>

                  <div className="mt-6 w-full max-w-md print:hidden">
                    <div className="flex justify-between items-end mb-1.5">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Compleción del Perfil</span>
                      <span className="text-xs font-extrabold text-gray-800">{calcularProgreso(selectedEmpleado)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden shadow-inner">
                      <div 
                        className={`h-2.5 rounded-full transition-all duration-1000 ease-out ${
                          calcularProgreso(selectedEmpleado) < 50 ? 'bg-red-500' : 
                          calcularProgreso(selectedEmpleado) < 80 ? 'bg-amber-400' : 
                          calcularProgreso(selectedEmpleado) < 100 ? 'bg-emerald-500' : 
                          'bg-blue-600'
                        }`}
                        style={{ width: `${calcularProgreso(selectedEmpleado)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4 print:grid-cols-2 print:gap-4">
              
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm print:shadow-none print:border-gray-300 print:break-inside-avoid">
                <h3 className="mb-4 text-base font-bold text-teal-700">Datos Personales</h3>
                <div className="space-y-2.5 text-sm text-gray-600">
                  <p><strong className="text-gray-800">DNI:</strong> {selectedEmpleado.dni}</p>
                  <p><strong className="text-gray-800">Sexo:</strong> {selectedEmpleado.sexo === "M" ? "Masculino (M)" : selectedEmpleado.sexo === "F" ? "Femenino (F)" : (selectedEmpleado.sexo || "N/A")}</p>
                  <p><strong className="text-gray-800">Estado Civil:</strong> {selectedEmpleado.estadoCivil || "N/A"}</p>
                  <p><strong className="text-gray-800">País Nacimiento:</strong> {selectedEmpleado.paisNacimiento || "Perú"}</p>
                  <p><strong className="text-gray-800">Fec. Nacimiento:</strong> {selectedEmpleado.fechaNacimiento ? selectedEmpleado.fechaNacimiento.substring(0, 10) : "N/A"}</p>
                  <p><strong className="text-gray-800">Correo:</strong> {selectedEmpleado.correo || "N/A"}</p>
                  <p><strong className="text-gray-800">Celular:</strong> {selectedEmpleado.telefono || "N/A"}</p>
                  <p><strong className="text-gray-800">Distrito:</strong> {selectedEmpleado.distrito || "N/A"}</p>
                  <p><strong className="text-gray-800">Dirección:</strong> {selectedEmpleado.direccion || "N/A"}</p>
                  <p><strong className="text-gray-800">Usuario:</strong> {selectedEmpleado.usuario || "N/A"}</p>
                  <p><strong className="text-gray-800">Contraseña:</strong> {selectedEmpleado.password || "N/A"}</p>
                </div>
              </div>
              
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm print:shadow-none print:border-gray-300 print:break-inside-avoid">
                <h3 className="mb-4 text-base font-bold text-teal-700">Información SUNAT</h3>
                <div className="space-y-2.5 text-sm text-gray-600">
                  <p><strong className="text-gray-800">RUC:</strong> {selectedEmpleado.ruc || "N/A"}</p>
                  <p><strong className="text-gray-800">Estado:</strong> {selectedEmpleado.estadoContribuyente || "N/A"}</p>
                  <p><strong className="text-gray-800">Condición:</strong> {selectedEmpleado.condicionContribuyente || "N/A"}</p>
                  <p className="line-clamp-2 print:line-clamp-none"><strong className="text-gray-800">Actividad:</strong> {selectedEmpleado.actividadEconomica || "N/A"}</p>
                </div>
              </div>
              
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm print:shadow-none print:border-gray-300 print:break-inside-avoid">
                <h3 className="mb-4 text-base font-bold text-teal-700">Datos Laborales</h3>
                <div className="space-y-2.5 text-sm text-gray-600">
                  <p><strong className="text-gray-800">Área:</strong> {selectedEmpleado.rolNombre || selectedEmpleado.id_rol || "N/A"}</p>
                  <p><strong className="text-gray-800">Cargo:</strong> {selectedEmpleado.area || "N/A"}</p>
                  <p><strong className="text-gray-800">Tipo de Servicio:</strong> {selectedEmpleado.tipo_servicio || "N/A"}</p>
                  <p><strong className="text-gray-800">Cuadrilla:</strong> {selectedEmpleado.cuadrilla || "No asignada"}</p>
                  <p><strong className="text-gray-800">Régimen:</strong> {selectedEmpleado.regimenPensionario || "N/A"}</p>
                  {selectedEmpleado.regimenPensionario?.includes("AFP") && (
                    <p><strong className="text-gray-800">CUSPP:</strong> {selectedEmpleado.cuspp || "N/A"}</p>
                  )}
                  <p><strong className="text-gray-800">Sueldo:</strong> {selectedEmpleado.sueldo ? `S/ ${selectedEmpleado.sueldo}` : "No registrado"}</p>
                </div>
              </div>
              
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm print:shadow-none print:border-gray-300 print:break-inside-avoid">
                <h3 className="mb-4 text-base font-bold text-teal-700">Datos Bancarios</h3>
                <div className="space-y-2.5 text-sm text-gray-600">
                  <p><strong className="text-gray-800">Banco:</strong> {selectedEmpleado.banco || "N/A"}</p>
                  <p><strong className="text-gray-800">Cuenta:</strong> {selectedEmpleado.cuenta || "N/A"}</p>
                  <p><strong className="text-gray-800">CCI:</strong> {selectedEmpleado.cci || "N/A"}</p>
                </div>
              </div>
              
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm print:shadow-none print:border-gray-300 print:break-inside-avoid">
                <h3 className="mb-4 text-base font-bold text-teal-700">Seguridad (SSOMA)</h3>
                <div className="space-y-2.5 text-sm text-gray-600">
                  <p><strong className="text-gray-800">Venc. SCTR:</strong> {selectedEmpleado.sctrVencimiento ? selectedEmpleado.sctrVencimiento.substring(0, 10) : "N/A"}</p>
                  <p><strong className="text-gray-800">Venc. EMO:</strong> {selectedEmpleado.emoVencimiento ? selectedEmpleado.emoVencimiento.substring(0, 10) : "N/A"}</p>
                  <p><strong className="text-gray-800">Licencia:</strong> {selectedEmpleado.licencia || "Sin Licencia"} {selectedEmpleado.fechaVencimientoLicencia && ` (Vence: ${selectedEmpleado.fechaVencimientoLicencia.substring(0, 10)})`}</p>
                </div>
              </div>
              
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm print:shadow-none print:border-gray-300 print:break-inside-avoid">
                <h3 className="mb-4 text-base font-bold text-teal-700">Experiencia Previa</h3>
                <div className="space-y-2.5 text-sm text-gray-600">
                  <p className="truncate print:truncate-none"><strong className="text-gray-800">1.</strong> {selectedEmpleado.ultimoEmpleo1 || "No registra"}</p>
                  <p className="truncate print:truncate-none"><strong className="text-gray-800">2.</strong> {selectedEmpleado.ultimoEmpleo2 || "No registra"}</p>
                  <p className="truncate print:truncate-none"><strong className="text-gray-800">3.</strong> {selectedEmpleado.ultimoEmpleo3 || "No registra"}</p>
                </div>
              </div>
              
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm print:shadow-none print:border-gray-300 print:break-inside-avoid">
                <h3 className="mb-4 text-base font-bold text-teal-700">Emergencia</h3>
                <div className="space-y-2.5 text-sm text-gray-600">
                  <p><strong className="text-gray-800">Nombre:</strong> {selectedEmpleado.contactoEmergencia || "N/A"}</p>
                  <p><strong className="text-gray-800">Parentesco:</strong> {selectedEmpleado.parentesco || "N/A"}</p>
                  <p><strong className="text-gray-800">Celular 1:</strong> {selectedEmpleado.telefonoEmergencia || "N/A"}</p>
                  <p><strong className="text-gray-800">Celular 2:</strong> {selectedEmpleado.telefonoAlternativo || "N/A"}</p>
                </div>
              </div>
              
              <div className="hidden xl:block print:hidden"></div>
              
              <div className="col-span-full rounded-2xl border border-gray-200 bg-white p-6 shadow-sm mt-2 print:shadow-none print:mt-0 print:border-t-2 print:break-inside-avoid">
                <h3 className="mb-4 text-lg font-bold text-teal-700">Derechohabientes (EsSalud)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm text-gray-600 print:gap-4">
                  <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200/80 print:border-gray-300 print:bg-white print:break-inside-avoid">
                    <h4 className="font-bold text-gray-800 border-b border-slate-200 pb-2.5 mb-3 uppercase text-xs tracking-wider">Cónyuge / Esposa</h4>
                    {selectedEmpleado.esposaNombres ? (<div className="space-y-2"><p><strong className="text-gray-800">Nombre Completo:</strong> {selectedEmpleado.esposaNombres} {selectedEmpleado.esposaPrimerApellido} {selectedEmpleado.esposaSegundoApellido}</p><p><strong className="text-gray-800">Fecha de Nacimiento:</strong> {selectedEmpleado.esposaNacimiento ? selectedEmpleado.esposaNacimiento.substring(0, 10) : 'N/A'}</p></div>) : (<div className="flex items-center justify-center h-16 text-gray-400 italic bg-white rounded-xl border border-dashed border-gray-300">No registra cónyuge</div>)}
                  </div>
                  <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200/80 print:border-gray-300 print:bg-white print:break-inside-avoid">
                    <h4 className="font-bold text-gray-800 border-b border-slate-200 pb-2.5 mb-3 uppercase text-xs tracking-wider">Hijos Registrados ({selectedEmpleado.hijos?.length || 0})</h4>
                    {selectedEmpleado.hijos && selectedEmpleado.hijos.length > 0 ? (<ul className="space-y-3">{selectedEmpleado.hijos.map((hijo, i) => (<li key={i} className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs flex flex-col gap-1 print:shadow-none print:border-gray-200 print:break-inside-avoid"><span className="font-bold text-gray-800">{hijo.nombres} {hijo.primerApellido} {hijo.segundoApellido}</span><span className="text-xs text-gray-500">Nacimiento: {hijo.nacimiento ? hijo.nacimiento.substring(0, 10) : 'N/A'}</span></li>))}</ul>) : (<div className="flex items-center justify-center h-16 text-gray-400 italic bg-white rounded-xl border border-dashed border-gray-300">No registra hijos</div>)}
                  </div>
                </div>
              </div>

              {/* DOCUMENTOS ADJUNTOS */}
              <div className="col-span-full md:col-span-2 xl:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm mt-2 print:shadow-none print:mt-0 print:border-t-2 print:break-inside-avoid print:p-4">
                <div className="flex items-center justify-between mb-4 print:mb-2">
                  <h3 className="text-lg font-bold text-teal-700 flex items-center gap-2">
                    📄 Documentos Adjuntos
                  </h3>
                  <span className="text-xs text-gray-500 font-medium">
                    13 documentos disponibles
                  </span>
                </div>
                
                <div className="divide-y divide-gray-100 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-x-6 print:divide-y-0 print:grid print:grid-cols-2 print:gap-x-12 print:gap-y-1 print:pt-2">
                  {[
                    { label: "📸 Foto de Perfil", archivo: selectedEmpleado.foto, tipo: "JPG/PNG" },
                    { label: "🪪 DNI - Frontal", archivo: selectedEmpleado.doc_delantera || selectedEmpleado.dni_pdf, tipo: "JPG/PNG" },
                    { label: "🪪 DNI - Posterior", archivo: selectedEmpleado.doc_trasera, tipo: "JPG/PNG" },
                    { label: "🚗 Brevete - Frontal", archivo: selectedEmpleado.brevete_delantera || selectedEmpleado.licencia_pdf, tipo: "JPG/PNG" },
                    { label: "🚗 Brevete - Posterior", archivo: selectedEmpleado.brevete_trasera, tipo: "JPG/PNG" },
                    { label: "🛠️ Rev. Técnica - Frontal", archivo: selectedEmpleado.revision_tecnica_frontal, tipo: "JPG/PNG" },
                    { label: "🛠️ Rev. Técnica - Posterior", archivo: selectedEmpleado.revision_tecnica_posterior, tipo: "JPG/PNG" },
                    { label: "📜 Tarjeta Propiedad - Frontal", archivo: selectedEmpleado.tarjeta_propiedad_frontal, tipo: "JPG/PNG" },
                    { label: "📜 Tarjeta Propiedad - Posterior", archivo: selectedEmpleado.tarjeta_propiedad_posterior, tipo: "JPG/PNG" },
                    { label: "💡 Recibo Agua/Luz", archivo: selectedEmpleado.recibo_servicio_pdf, tipo: "PDF" },
                    { label: "📄 CV (Curriculum)", archivo: selectedEmpleado.cv, tipo: "PDF" },
                    { label: "🎓 CertiJoven / Adulto", archivo: selectedEmpleado.certijoven_pdf, tipo: "PDF" },
                    { label: "📂 Otros Documentos", archivo: selectedEmpleado.otro_documento_pdf, tipo: "PDF / IMG" }
                  ].map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2.5 border-b border-gray-100 print:py-1.5 print:break-inside-avoid">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-xs font-semibold text-gray-800 truncate">{doc.label}</span>
                        <span className="text-[10px] text-gray-400">{doc.tipo}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        {doc.archivo ? (
                          <>
                            <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-700 print:border print:border-green-500 print:bg-white">
                              Sí
                            </span>
                            <a
                              href={`${API_URL}/uploads/${doc.archivo}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 rounded-md bg-teal-50 border border-teal-200 px-2.5 py-1 text-xs font-bold text-teal-700 hover:bg-teal-100 transition-colors print:hidden"
                              title="Ver documento"
                            >
                              Ver ↗
                            </a>
                          </>
                        ) : (
                          <span className="rounded-md bg-gray-100 border border-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-400 print:border print:border-gray-300 print:bg-white">
                            No
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 🚀 TARJETA VISUAL DE HISTORIAL */}
              <div className="col-span-full md:col-span-2 xl:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm mt-2 print:hidden">
                <h3 className="mb-4 text-lg font-bold text-teal-700 flex items-center gap-2">
                  ⏱️ Historial de Estados (Línea de Tiempo)
                </h3>
                
                {historial.length > 0 ? (
                  <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                    {historial.map((evento, idx) => (
                      <div key={idx} className="flex gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/70">
                        <div className="flex-shrink-0 mt-0.5">
                          <span className={`flex items-center justify-center w-7 h-7 rounded-full text-white font-bold text-xs ${
                            evento.estado_cambiado === "Activo" ? "bg-emerald-500" :
                            evento.estado_cambiado === "Vacaciones" ? "bg-blue-500" :
                            evento.estado_cambiado === "Descanso Médico" ? "bg-yellow-500" :
                            evento.estado_cambiado === "Cesado" ? "bg-gray-600" : "bg-red-500"
                          }`}>
                            {evento.estado_cambiado === "Activo" ? "✓" : "!"}
                          </span>
                        </div>

                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-gray-800 text-xs uppercase">
                              Estado: <span className={
                                evento.estado_cambiado === "Activo" ? "text-emerald-700 font-bold" : "text-orange-600 font-bold"
                              }>{evento.estado_cambiado}</span>
                            </h4>
                            <span className="text-[10px] text-gray-400 font-medium">
                              {evento.fecha_registro ? new Date(evento.fecha_registro).toLocaleDateString() : ""}
                            </span>
                          </div>
                          
                          <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-gray-600">
                            {evento.fecha_inicio && (
                              <p><strong>{evento.estado_cambiado === "Activo" ? "Retorno:" : "Desde:"}</strong> {evento.fecha_inicio.substring(0, 10)}</p>
                            )}
                            {evento.fecha_fin && (
                              <p><strong>Hasta:</strong> {evento.fecha_fin.substring(0, 10)}</p>
                            )}
                          </div>
                          
                          {evento.observacion && (
                            <p className="mt-1.5 text-xs text-gray-600 bg-white p-2 rounded-lg border border-gray-200">
                              "{evento.observacion}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-24 text-gray-400 italic bg-slate-50 rounded-xl border border-dashed border-gray-300 text-xs">
                    El empleado no registra cambios en su historial.
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm">
          <p className="text-lg font-medium">No hay empleados seleccionados</p>
        </div>
      )}
    </div>
  );
}