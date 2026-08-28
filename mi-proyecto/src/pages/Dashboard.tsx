import { useState, useEffect, useRef } from "react";
import EmployeeForm from "../components/employee/EmployeeForm";
import { Employee } from "../components/employee/Employee";
import { getEmpleados , getHistorialEstados } from "../services/employeeService";
import { API_URL } from "../config/api";
import { useReactToPrint } from "react-to-print";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";

interface DashboardProps {
  selectedEmpProp?: Employee | null;
  onDataUpdated?: () => void;
}

export default function Dashboard({ selectedEmpProp, onDataUpdated }: DashboardProps) {
  const [empleados, setEmpleados] = useState<Employee[]>([]);
  const [selectedEmpleado, setSelectedEmpleado] = useState<Employee | null>(selectedEmpProp || null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false); 
  const [historial, setHistorial] = useState<any[]>([]);
  const componentRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm print:hidden">
        
        <div className="flex items-center gap-4 w-full xl:w-auto">
          <label className="font-semibold text-gray-700 text-sm whitespace-nowrap">Seleccionar Empleado:</label>
          <select 
            className="rounded-xl border border-gray-300 bg-gray-50/50 px-4 py-2.5 w-full sm:w-auto min-w-[240px] text-sm shadow-2xs font-medium focus:bg-white transition-all" 
            value={selectedEmpleado?.id || ""} 
            onChange={handleSelectChange}
          >
            {empleados.length === 0 ? <option value="">Cargando...</option> : empleados.map((emp) => (<option key={emp.id} value={emp.id}>{emp.nombres} {emp.primerApellido}</option>))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-start xl:justify-end">
          
          <Dialog open={isModalOpen} onOpenChange={(isOpen) => { if (isOpen) setIsModalOpen(true); }}>
            {/* @ts-ignore */}
            <DialogTrigger asChild>
              <button onClick={() => { setModoEdicion(false); setIsModalOpen(true); }} className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-700 transition-colors whitespace-nowrap">
                + Nuevo Empleado
              </button>
            </DialogTrigger>
            {/* @ts-ignore */}
            <DialogContent showCloseButton={false} onPointerDownOutside={(e: any) => e.preventDefault()} onEscapeKeyDown={(e: any) => e.preventDefault()} className="p-6 max-w-4xl max-h-[90vh] overflow-y-auto">
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
              <button onClick={() => { setModoEdicion(true); setIsModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-blue-700 transition-colors">
                Editar Datos
              </button>

              <button onClick={handlePrint} className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-red-700 transition-colors">
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
                    <p><span className="font-semibold text-gray-800">Rol:</span> {selectedEmpleado.rolNombre || selectedEmpleado.id_rol}</p>
                    <p><span className="font-semibold text-gray-800">Área:</span> {selectedEmpleado.area || "OPERACIONES"}</p>
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
                  <p><strong className="text-gray-800">Rol:</strong> {selectedEmpleado.rolNombre || selectedEmpleado.id_rol || "N/A"}</p>
                  <p><strong className="text-gray-800">Área:</strong> {selectedEmpleado.area || "N/A"}</p>
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
                <h3 className="mb-4 text-lg font-bold text-teal-700 flex items-center gap-2 print:mb-2">
                  📄 Documentos Adjuntos
                </h3>
                
                <div className="divide-y divide-gray-100 border-t border-gray-100 print:divide-y-0 print:grid print:grid-cols-2 print:gap-x-12 print:gap-y-1 print:pt-2">
                  {[
                    { label: "Foto de perfil", archivo: selectedEmpleado.foto },
                    { label: "Licencia (PDF)", archivo: selectedEmpleado.licencia_pdf },
                    { label: "CV (PDF)", archivo: selectedEmpleado.cv },
                    { label: "DNI (PDF)", archivo: selectedEmpleado.dni_pdf },
                    { label: "Recibo de servicio (PDF)", archivo: selectedEmpleado.recibo_servicio_pdf },
                    { label: "Certificado (PDF)", archivo: selectedEmpleado.certijoven_pdf }
                  ].map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between py-3.5 print:py-2 print:border-b print:border-gray-100 print:break-inside-avoid">
                      <span className="text-sm font-medium text-gray-700">{doc.label}</span>
                      
                      <div className="flex items-center gap-3">
                        {doc.archivo ? (
                          <>
                            <span className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 print:border print:border-green-500 print:bg-white">
                              Sí
                            </span>
                            <a
                              href={`${API_URL}/uploads/${doc.archivo}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 rounded-lg bg-teal-50 border border-teal-200 px-3.5 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-100 transition-colors print:hidden"
                              title="Ver documento"
                            >
                               Ver
                            </a>
                          </>
                        ) : (
                          <span className="rounded-md bg-gray-100 border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-500 print:border print:border-gray-300 print:bg-white">
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