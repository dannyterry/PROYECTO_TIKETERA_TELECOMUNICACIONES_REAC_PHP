import { Employee } from "../components/employee/Employee";
import { API_URL } from "../config/api";

export const getEmpleados = async (): Promise<Employee[]> => {
  try {
    // 🚀 TRUCO ANTICACHÉ: Le pasamos un timestamp y le ordenamos no guardar en caché
    const response = await fetch(`${API_URL}/empleados?t=${new Date().getTime()}`, {
      cache: 'no-store'
    });
    
    if (!response.ok) throw new Error("Error al obtener la lista de empleados");
    const data = await response.json();

    const formatFecha = (f: any) => {
      if (!f) return "";
      try {
        if (typeof f === "string") return f.substring(0, 10);
        return new Date(f).toISOString().substring(0, 10);
      } catch { return ""; }
    };

    return data.map((emp: any): Employee => ({
      id: emp.id_usuario || emp.id, 
      estado: emp.estado || "Activo",

      estadoFechaInicio: emp.estadoFechaInicio ? formatFecha(emp.estadoFechaInicio) : "",
      estadoFechaFin: emp.estadoFechaFin ? formatFecha(emp.estadoFechaFin) : "",
      estadoObservacion: emp.estadoObservacion || "",

      id_rol: emp.id_rol || "",
      rolNombre: emp.nombre_rol || "",
      tipoDocumento: emp.tipo_documento || "DNI", 
      dni: emp.documento || "", 
      nombres: emp.nombres || "",
      primerApellido: emp.primer_apellido || "",
      segundoApellido: emp.segundo_apellido || "",
      correo: emp.email || "", 
      usuario: emp.usuario || "",
      password: (emp.password !== undefined && emp.password !== null && String(emp.password).trim() !== "") ? String(emp.password) : (emp.documento || ""),
      telefono: emp.telefono || "",
      fechaNacimiento: formatFecha(emp.fecha_nacimiento),
      sexo: emp.sexo || "",
      estadoCivil: emp.estado_civil || "",
      paisNacimiento: emp.pais_nacimiento || "Perú",
      distrito: emp.distrito || "",
      direccion: emp.direccion || "",
      sueldo: emp.sueldo || "",
      ruc: emp.ruc || "",
      estadoContribuyente: emp.sunat_estado || "",
      condicionContribuyente: emp.sunat_condicion || "",
      actividadEconomica: emp.sunat_actividad || "",
      area: emp.area || "",
      fechaIngreso: formatFecha(emp.fecha_ingreso),
      opcionPersonal: emp.opcion_personal || "",
      cuadrilla: emp.cuadrilla || "",
      regimenPensionario: emp.regimen_pensionario || "",
      tipoComision: emp.tipo_comision_afp || "",
      cuspp: emp.cuspp || "",
      banco: emp.banco || "",
      cuenta: emp.cuenta_bancaria || "",
      cci: emp.cci || "",
      esposaNombres: emp.conyuge_nombres || "",
      esposaPrimerApellido: emp.conyuge_apellido1 || "",
      esposaSegundoApellido: emp.conyuge_apellido2 || "",
      esposaNacimiento: formatFecha(emp.conyuge_fecha_nacimiento),
      hijos: emp.hijos && emp.hijos.length > 0 ? emp.hijos.map((h: any) => ({
        nombres: h.nombres || "", primerApellido: h.apellido1 || "", segundoApellido: h.apellido2 || "", nacimiento: formatFecha(h.fecha_nacimiento)
      })) : [],
      sctrVencimiento: formatFecha(emp.vencimiento_sctr),
      emoVencimiento: formatFecha(emp.vencimiento_emo),
      licencia: emp.categoria_licencia || "Sin Licencia",
      numeroBrevete: emp.numero_brevete || "",
      fechaEmisionLicencia: formatFecha(emp.emision_brevete),
      fechaVencimientoLicencia: formatFecha(emp.fecha_vencimiento_brevete),
      tallaPolo: emp.talla_polo || "",
      tallaPantalon: emp.talla_pantalon || "",
      tallaCalzado: emp.talla_calzado || "",
      ultimoEmpleo1: emp.ultimo_empleo_1 || "",
      ultimoEmpleo2: emp.ultimo_empleo_2 || "",
      ultimoEmpleo3: emp.ultimo_empleo_3 || "",
      contactoEmergencia: emp.emergencia_nombre || "",
      parentesco: emp.emergencia_parentesco || "",
      telefonoEmergencia: emp.numero_emergencia || "",
      telefonoAlternativo: emp.emergencia_telefono_2 || "",
      direccionEmergencia: emp.emergencia_direccion || "",
      foto: emp.foto_personal || "", cv: emp.cv_pdf || "", dni_pdf: emp.dni_pdf || "", licencia_pdf: emp.licencia_pdf || "", recibo_servicio_pdf: emp.recibo_servicio_pdf || "", certijoven_pdf: emp.certificado_pdf || ""
    }));
  } catch (error) { return []; }
};



export const getHistorialEstados = async (id: number) => {
  try {
    const r = await fetch(`${API_URL}/empleados/${id}/historial`);
    if (!r.ok) throw new Error("Error obteniendo historial");
    return await r.json();
  } catch {
    return [];
  }
};

export const createEmpleado = async (d: any) => { 
  const r = await fetch(`${API_URL}/empleados`, { method: "POST", body: d }); 
  if (!r.ok) {
    const errData = await r.json().catch(() => ({}));
    throw new Error(errData.error || `Error en el servidor al crear empleado (${r.status})`);
  }
  return await r.json(); 
};

export const updateEmpleado = async (id: number, d: any) => { 
  const r = await fetch(`${API_URL}/empleados/${id}`, { method: "PUT", body: d }); 
  if (!r.ok) {
    const errData = await r.json().catch(() => ({}));
    throw new Error(errData.error || `Error en el servidor al actualizar empleado (${r.status})`);
  }
  return await r.json(); 
};

export const getDatosSunat = async (dni: string) => { const r = await fetch(`${API_URL}/sunat/${dni}`); if (!r.ok) throw new Error("Error en SUNAT"); return await r.json(); };
export const getDatosAFP = async () => { try { const r = await fetch(`${API_URL}/sbs/comisiones`); if (!r.ok) throw new Error("Error en SBS"); return await r.json(); } catch { return []; } };