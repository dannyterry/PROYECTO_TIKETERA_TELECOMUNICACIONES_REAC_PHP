import React, { useState, useEffect } from "react";
import { Employee } from "../components/employee/Employee";
import { EmployeeList } from "../components/employee/EmployeeList";
import Dashboard from "./Dashboard"; 
import Sidebar from "../components/layout/Sidebar"; 
import Header from "../components/layout/Header";   
import { getEmpleados } from "../services/employeeService";

interface EmpleadosPageProps {
  empleados: Employee[];
}

export const EmpleadosPage: React.FC<EmpleadosPageProps> = ({ empleados }) => {
  const [vista, setVista] = useState<"general" | "empleados">("general");
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<Employee | null>(null);

  const [listaViva, setListaViva] = useState<Employee[]>(empleados);

  useEffect(() => {
    setListaViva(empleados);
  }, [empleados]);

  // 1. FUNCIÓN QUE VA A LA BASE DE DATOS POR INFO FRESCA
  const recargarDatosFrescos = async () => {
    try {
      const nuevaData = await getEmpleados();
      setListaViva(nuevaData); 
      
      if (empleadoSeleccionado) {
        const actualizado = nuevaData.find(e => e.id === empleadoSeleccionado.id);
        if (actualizado) setEmpleadoSeleccionado(actualizado);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 🚀 2. EL INTERCEPTOR MÁGICO
  // Antes de cambiar a la vista general, forzamos la recarga de datos
  const cambiarVistaYRecargar = async (nuevaVista: "general" | "empleados" | "ordenes") => {
    if (nuevaVista === "general") {
      await recargarDatosFrescos(); // Esperamos a que lleguen los datos frescos
    }
    if (nuevaVista === "general" || nuevaVista === "empleados") {
      setVista(nuevaVista); // ¡Ahora sí cambiamos de pantalla!
    }
  };

  const handleSeleccionarEmpleado = (emp: Employee) => {
    setEmpleadoSeleccionado(emp);
    setVista("empleados"); 
  };

  if (!listaViva) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-lg font-medium text-gray-500">Cargando registros...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      
      {/* 🚀 3. Conectamos el Sidebar al interceptor */}
      <Sidebar currentView={vista} onViewChange={cambiarVistaYRecargar} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        
        <main className="p-8 max-w-[1600px] w-full mx-auto">
          {vista === "general" ? (
            <EmployeeList 
              empleados={listaViva} 
              onSelectEmployee={handleSeleccionarEmpleado} 
            />
          ) : (
            <div className="space-y-6">
              {/* 🚀 4. Conectamos el botón de volver al interceptor */}
              <button 
                onClick={() => cambiarVistaYRecargar("general")}
                className="inline-flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-5 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 hover:text-teal-700 transition-colors shadow-sm"
              >
                ← Volver a la Lista General
              </button>
              
              <Dashboard 
                selectedEmpProp={empleadoSeleccionado} 
                onDataUpdated={recargarDatosFrescos} 
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};