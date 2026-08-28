import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input"; 
import { createEmpleado, getDatosAFP, updateEmpleado } from "../../services/employeeService";
import { API_URL } from "../../config/api";
import { Employee } from "./Employee";

interface EmployeeFormProps {
  empleadoAEditar?: Employee | null;
  onSuccess?: () => void;
}

const distritosLima = [
  "Ancón", "Ate", "Barranco", "Bellavista", "Breña", "Callao", "Carabayllo", "Carmen de La Legua", 
  "Chaclacayo", "Chorrillos", "Cieneguilla", "Comas", "El Agustino", "Independencia", "Jesús María", 
  "La Molina", "La Perla", "La Punta", "La Victoria", "Lima", "Lince", "Los Olivos", "Lurigancho-Chosica", 
  "Lurín", "Magdalena del Mar", "Mi Perú", "Miraflores", "Pachacámac", "Pucusana", "Pueblo Libre", 
  "Puente Piedra", "Punta Hermosa", "Punta Negra", "Rímac", "San Bartolo", "San Borja", "San Isidro", 
  "San Juan de Lurigancho", "San Juan de Miraflores", "San Luis", "San Martín de Porres", "San Miguel", 
  "Santa Anita", "Santa María del Mar", "Santa Rosa", "Santiago de Surco", "Surquillo", "Ventanilla", 
  "Villa El Salvador", "Villa María del Triunfo"
];

export default function EmployeeForm({ empleadoAEditar, onSuccess }: EmployeeFormProps) {
  const fechaHoy = new Date().toISOString().split("T")[0];
  const esModoEdicion = !!empleadoAEditar;

  const [formData, setFormData] = useState({
    // Personales y Credenciales
    estado: "Activo",
    estadoFechaInicio: "", // 🚀 NUEVO
    estadoFechaFin: "",    // 🚀 NUEVO
    estadoObservacion: "", // 🚀 NUEVO
    id_rol: "",
    tipoDocumento: "DNI",
    dni: "", 
    nombres: "", 
    primerApellido: "", 
    segundoApellido: "", 
    correo: "", 
    usuario: "",
    password: "",
    telefono: "", 
    fechaNacimiento: "",
    sexo: "",
    estadoCivil: "",
    paisNacimiento: "Perú",
    distrito: "",
    sueldo: "",
    direccion: "",
    
    // SUNAT
    ruc: "",
    estadoContribuyente: "",
    condicionContribuyente: "",
    actividadEconomica: "",
    
    // Laborales y Planilla
    area: "", 
    fechaIngreso: "",
    opcionPersonal: "", 
    cuadrilla: "",      
    regimenPensionario: "", 
    tipoComision: "", 
    cuspp: "", 
    banco: "", 
    cuenta: "", 
    cci: "", 
    
    // DERECHOHABIENTES
    esposaNombres: "",
    esposaPrimerApellido: "",
    esposaSegundoApellido: "",
    esposaNacimiento: "",
    hijos: [{ nombres: "", primerApellido: "", segundoApellido: "", nacimiento: "" }], 

    // Licencia
    licencia: "Sin Licencia", 
    numeroBrevete: "",
    fechaEmisionLicencia: "", 
    fechaVencimientoLicencia: "",
    
    // SSOMA / Logística
    sctrVencimiento: "", 
    emoVencimiento: "", 
    tallaPolo: "", 
    tallaPantalon: "", 
    tallaCalzado: "",
    
    // Experiencia
    ultimoEmpleo1: "", 
    ultimoEmpleo2: "", 
    ultimoEmpleo3: "",
    
    // Emergencia
    contactoEmergencia: "", 
    parentesco: "", 
    telefonoEmergencia: "", 
    telefonoAlternativo: "", 
    direccionEmergencia: "",

    // Archivos (Guardan el nombre en estado solo para mostrar en UI)
    foto: "", cv: "", dni_pdf: "", licencia_pdf: "", recibo_servicio_pdf: "", certijoven_pdf: ""
  });

  const [loading, setLoading] = useState(false);
  const [tasasAfp, setTasasAfp] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]); 

  // Generamos un sufijo numérico y una contraseña aleatoria una sola vez al cargar
  const [credencialesAuto] = useState(() => {
    const sufijo = Math.floor(100 + Math.random() * 900); 
    const passRandom = Math.random().toString(36).slice(-8); 
    return { sufijo, passRandom };
  });

  // 1. CARGAR TASAS DE LA SBS Y ROLES DESDE MYSQL
  useEffect(() => {
    const cargarDatosIniciales = async () => {
      try {
        const [tasas, rolesRes] = await Promise.all([
          getDatosAFP(),
          fetch(`${API_URL}/roles`).then(res => res.json())
        ]);
        setTasasAfp(tasas);
        setRoles(rolesRes);
      } catch (error) {
        console.error("Error al cargar datos iniciales:", error);
      }
    };
    cargarDatosIniciales();
  }, []);

  // 2. EFECTO DE EDICIÓN: MAPEO CORRECTO ENTRE MYSQL Y REACT
  useEffect(() => {
    if (empleadoAEditar) {
      const e = empleadoAEditar as any;
      setFormData(prev => ({
        ...prev,
        estado: e.estado || "Activo",
        estadoFechaInicio: e.estadoFechaInicio || "", // 🚀 NUEVO
        estadoFechaFin: e.estadoFechaFin || "",       // 🚀 NUEVO
        estadoObservacion: e.estadoObservacion || "", // 🚀 NUEVO
        id_rol: e.id_rol ? e.id_rol.toString() : "",
        tipoDocumento: e.tipoDocumento || "DNI",
        dni: e.dni || "", 
        nombres: e.nombres || "",
        primerApellido: e.primerApellido || "", 
        segundoApellido: e.segundoApellido || "", 
        correo: e.correo || "", 
        usuario: e.usuario || "",
        password: "", 
        telefono: e.telefono || "",
        fechaNacimiento: e.fechaNacimiento || "",
        sexo: e.sexo || "",
        estadoCivil: e.estadoCivil || "",
        paisNacimiento: e.paisNacimiento || "Perú",
        distrito: e.distrito || "",
        sueldo: e.sueldo ? e.sueldo.toString() : "",
        direccion: e.direccion || "",
        
        ruc: e.ruc || "",
        estadoContribuyente: e.estadoContribuyente || "",
        condicionContribuyente: e.condicionContribuyente || "",
        actividadEconomica: e.actividadEconomica || "",
        
        area: e.area || "",
        fechaIngreso: e.fechaIngreso || "",
        opcionPersonal: e.opcionPersonal || "", 
        cuadrilla: e.cuadrilla || "",            
        regimenPensionario: e.regimenPensionario || "",
        tipoComision: e.tipoComision || "",
        cuspp: e.cuspp || "",
        banco: e.banco || "",
        cuenta: e.cuenta || "", 
        cci: e.cci || "",
        
        licencia: e.licencia || "Sin Licencia",
        numeroBrevete: e.numeroBrevete || "", 
        fechaEmisionLicencia: e.fechaEmisionLicencia || "",
        fechaVencimientoLicencia: e.fechaVencimientoLicencia || "",
        sctrVencimiento: e.sctrVencimiento || "",
        emoVencimiento: e.emoVencimiento || "",
        tallaPolo: e.tallaPolo || "",
        tallaPantalon: e.tallaPantalon || "",
        tallaCalzado: e.tallaCalzado || "",
        
        ultimoEmpleo1: e.ultimoEmpleo1 || "",
        ultimoEmpleo2: e.ultimoEmpleo2 || "",
        ultimoEmpleo3: e.ultimoEmpleo3 || "",
        
        contactoEmergencia: e.contactoEmergencia || "",
        parentesco: e.parentesco || "",
        telefonoEmergencia: e.telefonoEmergencia || "", 
        telefonoAlternativo: e.telefonoAlternativo || "",
        direccionEmergencia: e.direccionEmergencia || "",
        
        esposaNombres: e.esposaNombres || "",
        esposaPrimerApellido: e.esposaPrimerApellido || "",
        esposaSegundoApellido: e.esposaSegundoApellido || "",
        esposaNacimiento: e.esposaNacimiento || "",

        foto: e.foto || "",
        cv: e.cv || "",
        dni_pdf: e.dni_pdf || "",
        licencia_pdf: e.licencia_pdf || "",
        recibo_servicio_pdf: e.recibo_servicio_pdf || "",
        certijoven_pdf: e.certijoven_pdf || "",
        
        hijos: e.hijos && e.hijos.length > 0 
          ? e.hijos 
          : [{ nombres: "", primerApellido: "", segundoApellido: "", nacimiento: "" }]
      }));
    }
  }, [empleadoAEditar]);

  // 3. EFECTO DE AUTOGENERACIÓN: Crea usuario y contraseña solo en Modo Creación
  useEffect(() => {
    if (!esModoEdicion) {
      const inicialNombre = formData.nombres ? formData.nombres.charAt(0).toLowerCase() : "";
      const apellido = formData.primerApellido ? formData.primerApellido.split(" ")[0].toLowerCase() : "";
      
      if (inicialNombre || apellido) {
        const usuarioGenerado = `${inicialNombre}${apellido}${credencialesAuto.sufijo}`;
        
        if (formData.usuario !== usuarioGenerado || formData.password !== credencialesAuto.passRandom) {
          setFormData(prev => ({
            ...prev,
            usuario: usuarioGenerado,
            password: credencialesAuto.passRandom
          }));
        }
      }
    }
  }, [formData.nombres, formData.primerApellido, esModoEdicion, credencialesAuto]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    let { name, value } = e.target;

    if (["dni", "telefono", "telefonoEmergencia", "telefonoAlternativo", "cuenta", "cci"].includes(name)) {
      value = value.replace(/\D/g, ""); 
    }

    if (name === "dni" && value.length > 8) return;
    if (["telefono", "telefonoEmergencia", "telefonoAlternativo"].includes(name) && value.length > 9) return;

    const camposMayusculas = [
      "nombres", "primerApellido", "segundoApellido", "paisNacimiento",
      "esposaNombres", "esposaPrimerApellido", "esposaSegundoApellido",
      "direccion", "distrito", "direccionEmergencia", "contactoEmergencia",
      "ultimoEmpleo1", "ultimoEmpleo2", "ultimoEmpleo3", "cuspp", "cuadrilla", "numeroBrevete"
    ];
    if (camposMayusculas.includes(name)) {
      value = value.toUpperCase();
    }
    
    if (name === "usuario") {
      value = value.toLowerCase().replace(/\s/g, '');
    }

    setFormData({ ...formData, [name]: value });
  };

  const handleHijoChange = (index: number, field: "nombres" | "primerApellido" | "segundoApellido" | "nacimiento", value: string) => {
    const nuevosHijos = [...formData.hijos];
    if (field !== "nacimiento") {
      value = value.toUpperCase();
    }
    nuevosHijos[index][field] = value;
    setFormData({ ...formData, hijos: nuevosHijos });
  };

  const agregarHijo = () => setFormData({ ...formData, hijos: [...formData.hijos, { nombres: "", primerApellido: "", segundoApellido: "", nacimiento: "" }] });
  const eliminarHijo = (index: number) => setFormData({ ...formData, hijos: formData.hijos.filter((_, i) => i !== index) });

  // =============== NUEVO HANDLE SUBMIT (FORM DATA FÍSICO) ===============
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formElement = e.target as HTMLFormElement;
      const formFisico = new FormData();

      // 1. Agregar todos los textos al FormData
      Object.keys(formData).forEach(key => {
        if (!["hijos", "foto", "cv", "dni_pdf", "licencia_pdf", "recibo_servicio_pdf", "certijoven_pdf"].includes(key)) {
          formFisico.append(key, (formData as any)[key] || "");
        }
      });

      // 2. Apellidos unidos y Familiares
      formFisico.append("apellidos", `${formData.primerApellido} ${formData.segundoApellido}`.trim());
      formFisico.append("derechohabientes", JSON.stringify({
        esposa: { 
          nombres: formData.esposaNombres, 
          primerApellido: formData.esposaPrimerApellido,
          segundoApellido: formData.esposaSegundoApellido,
          nacimiento: formData.esposaNacimiento 
        },
        hijos: formData.hijos
      }));

      // 3. Capturar Archivos Físicos desde los inputs del formulario
      const addFileToForm = (inputName: string, appendName: string) => {
        const fileInput = formElement.elements.namedItem(inputName) as HTMLInputElement;
        if (fileInput && fileInput.files && fileInput.files[0]) {
          formFisico.append(appendName, fileInput.files[0]);
        }
      };

      addFileToForm("foto", "foto_personal");
      addFileToForm("cv", "cv_pdf");
      addFileToForm("dni_pdf", "dni_pdf");
      addFileToForm("licencia_pdf", "licencia_pdf");
      addFileToForm("recibo_servicio_pdf", "recibo_servicio_pdf");
      addFileToForm("certijoven_pdf", "certificado_pdf");

      // 4. Enviar a tu servicio
      if (esModoEdicion && empleadoAEditar) {
        await updateEmpleado(empleadoAEditar.id, formFisico as any);
        alert("¡Empleado actualizado exitosamente!");
      } else {
        await createEmpleado(formFisico as any);
        alert("¡Empleado guardado exitosamente!");
      }
      
      if (onSuccess) onSuccess();
      
    } catch (error: any) {
      alert(error.message || "Error al guardar el empleado. Revisa la consola.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const consultarSunat = async () => {
    try {
      if (formData.dni.length !== 8) return alert("Ingrese un DNI válido de 8 dígitos");
      
      const response = await fetch(`${API_URL}/sunat/${formData.dni}`);
      const resultado = await response.json();

      if (!response.ok || resultado.error) {
        console.error("Error del backend:", resultado.error);
        return alert(resultado.error || "Error en el servidor al consultar SUNAT o la página de la SUNAT está bloqueando la consulta.");
      }

      const datosSunat = resultado.datos;

      if (datosSunat && (datosSunat.ruc || datosSunat.nombres || datosSunat.razonSocial)) {
        if (esModoEdicion) {
          setFormData(prev => ({
            ...prev,
            ruc: datosSunat.ruc || prev.ruc, 
            estadoContribuyente: datosSunat.estado || prev.estadoContribuyente,
            condicionContribuyente: datosSunat.condicion || prev.condicionContribuyente, 
            actividadEconomica: datosSunat.actividadesEconomicas || prev.actividadEconomica
          }));
          alert("¡Datos de SUNAT actualizados correctamente!");
        } else {
          const partes = (datosSunat.razonSocial || "").trim().split(/\s+/);
          const primerAp = datosSunat.primerApellido || partes[0] || "";
          const segundoAp = datosSunat.segundoApellido || partes[1] || "";
          const nombresRestantes = datosSunat.nombres || (partes.length > 2 ? partes.slice(2).join(' ') : "");

          setFormData(prev => ({
            ...prev,
            nombres: nombresRestantes || prev.nombres, 
            primerApellido: primerAp || prev.primerApellido, 
            segundoApellido: segundoAp || prev.segundoApellido,
            ruc: datosSunat.ruc || prev.ruc, 
            estadoContribuyente: datosSunat.estado || prev.estadoContribuyente,
            condicionContribuyente: datosSunat.condicion || prev.condicionContribuyente, 
            actividadEconomica: datosSunat.actividadesEconomicas || prev.actividadEconomica
          }));
        }
      } else {
        alert("No se encontraron datos para este DNI en SUNAT o la página no respondió.");
      }
    } catch (error) { 
      console.error(error); 
      alert("Error de conexión al intentar consultar SUNAT."); 
    }
  };

  const tasaActual = (() => {
    if (!formData.regimenPensionario.includes("AFP")) return null;
    return tasasAfp.find(tasa => tasa.afp === formData.regimenPensionario.replace("AFP ", "").toUpperCase());
  })();

  const esAFP = formData.regimenPensionario.includes("AFP");
  const esONP = formData.regimenPensionario === "ONP";

  const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-8 overflow-hidden text-ellipsis disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed";
  const inputDisabledClass = "bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200";

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-5 p-2 items-end">

      {/* --- 1. DATOS PERSONALES --- */}
      <div className="col-span-full mb-1"><h3 className="text-sm font-bold text-emerald-700 uppercase">1. Datos Personales</h3></div>

      {/* 🚀 SELECTOR DE ESTADO CON LIMPIEZA AUTOMÁTICA DE FECHAS */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-700">Estado *</label>
        <select 
          name="estado" 
          value={formData.estado} 
          onChange={(e) => {
            const { value } = e.target;
            setFormData(prev => ({
              ...prev,
              estado: value,
              estadoFechaInicio: "",
              estadoFechaFin: "",
              estadoObservacion: ""
            }));
          }} 
          className={selectClass}
        >
          <option value="Activo">Activo</option>
          <option value="Inactivo">Inactivo</option>
          <option value="Vacaciones">Vacaciones</option>
          <option value="Descanso Médico">Descanso Médico</option>
          <option value="Cesado">Cesado</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Rol *</label><select name="id_rol" value={formData.id_rol} onChange={handleChange} className={selectClass} required><option value="">Seleccione un rol</option>{roles.map((rol) => (<option key={rol.id_rol} value={rol.id_rol}>{rol.nombre}</option>))}</select></div>
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Tipo Documento *</label><select name="tipoDocumento" value={formData.tipoDocumento} onChange={handleChange} className={selectClass}><option value="DNI">DNI</option><option value="CE">Carné de Extranjería</option></select></div>
      

        {/* 🚀 CAJA DINÁMICA DE DETALLES DEL ESTADO */}
      {(formData.estado !== "Activo" || (esModoEdicion && empleadoAEditar?.estado !== "Activo" && formData.estado === "Activo")) && (
        <div className={`col-span-full grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl border mt-1 mb-2 animate-in fade-in zoom-in duration-300 shadow-sm ${
          formData.estado === "Activo" ? "bg-emerald-50/80 border-emerald-200" : "bg-orange-50/80 border-orange-200"
        }`}>
          <h4 className={`col-span-full text-[11px] font-bold uppercase tracking-wider border-b pb-1.5 flex items-center gap-2 ${
            formData.estado === "Activo" ? "text-emerald-800 border-emerald-200" : "text-orange-800 border-orange-200"
          }`}>
            {formData.estado === "Activo" ? "✅ DETALLES DE REINGRESO / RETORNO" : `⚠️ Detalles de ${formData.estado}`}
          </h4>

          {/* FECHA INICIO / RETORNO */}
          {["Activo", "Inactivo", "Vacaciones", "Descanso Médico"].includes(formData.estado) && (
            <div className="flex flex-col gap-1.5">
              <label className={`text-xs font-bold ${formData.estado === "Activo" ? "text-emerald-900" : "text-orange-900"}`}>
                {formData.estado === "Activo" ? "Fecha de Retorno" : "Fecha Inicio / Desde"}
              </label>
              <Input type="date" name="estadoFechaInicio" value={formData.estadoFechaInicio} onChange={handleChange} className={`bg-white ${formData.estado === "Activo" ? "border-emerald-300 focus:ring-emerald-500" : "border-orange-300 focus:ring-orange-500"}`} />
            </div>
          )}

          {/* FECHA FIN: Vacaciones, Descanso Médico, Cesado */}
          {["Vacaciones", "Descanso Médico", "Cesado"].includes(formData.estado) && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-orange-900">{formData.estado === "Cesado" ? "Fecha de Cese" : "Fecha Fin / Hasta"}</label>
              <Input type="date" name="estadoFechaFin" value={formData.estadoFechaFin} onChange={handleChange} className="bg-white border-orange-300 focus:ring-orange-500" />
            </div>
          )}

          {/* OBSERVACIÓN */}
          <div className={`flex flex-col gap-1.5 ${formData.estado === "Inactivo" || formData.estado === "Cesado" || formData.estado === "Activo" ? "md:col-span-2" : "md:col-span-1"}`}>
            <label className={`text-xs font-bold ${formData.estado === "Activo" ? "text-emerald-900" : "text-orange-900"}`}>
              Observación / Motivo
            </label>
            <Input name="estadoObservacion" value={formData.estadoObservacion} onChange={handleChange} placeholder={formData.estado === "Activo" ? "Ej. Reingreso por nueva campaña, Retorno de vacaciones..." : "Escriba un comentario o motivo..."} className={`bg-white ${formData.estado === "Activo" ? "border-emerald-300 focus:ring-emerald-500" : "border-orange-300 focus:ring-orange-500"}`} />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-700">N° Documento (DNI) *</label>
        <div className="flex gap-2">
          <Input 
            name="dni" 
            value={formData.dni} 
            onChange={handleChange} 
            placeholder="DNI" 
            maxLength={8} 
            required 
            disabled={esModoEdicion} 
            className={esModoEdicion ? inputDisabledClass : ""} 
          />
          <button 
            type="button" 
            onClick={consultarSunat} 
            className="px-3 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-bold transition-colors shadow-sm"
          >
            SUNAT
          </button>
        </div>
      </div>
      
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Nombres *</label><Input name="nombres" value={formData.nombres} onChange={handleChange} placeholder="Nombres" required disabled={esModoEdicion} className={`w-full ${esModoEdicion ? inputDisabledClass : ""}`} /></div>
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Primer Apellido *</label><Input name="primerApellido" value={formData.primerApellido} onChange={handleChange} placeholder="Primer Apellido" required disabled={esModoEdicion} className={`w-full ${esModoEdicion ? inputDisabledClass : ""}`} /></div>
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Segundo Apellido *</label><Input name="segundoApellido" value={formData.segundoApellido} onChange={handleChange} placeholder="Segundo Apellido" required disabled={esModoEdicion} className={`w-full ${esModoEdicion ? inputDisabledClass : ""}`} /></div>
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Correo Electrónico</label><Input name="correo" value={formData.correo} onChange={handleChange} placeholder="correo@telecom.com" type="email" className="w-full" /></div>

      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Usuario *</label><Input name="usuario" value={formData.usuario} readOnly placeholder="Se genera automáticamente" className="w-full bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200" /></div>
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Contraseña {!esModoEdicion && "*"}</label><Input name="password" type={esModoEdicion ? "password" : "text"} value={formData.password} onChange={handleChange} placeholder={esModoEdicion ? "Dejar en blanco para no cambiar" : "Contraseña autogenerada"} required={!esModoEdicion} className={`w-full ${!esModoEdicion ? "bg-emerald-50 border-emerald-200 font-medium" : ""}`} /></div>
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Teléfono Celular</label><Input name="telefono" value={formData.telefono} onChange={handleChange} placeholder="Número de 9 dígitos" maxLength={9} className="w-full" /></div>
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Fecha de Nacimiento</label><Input type="date" name="fechaNacimiento" value={formData.fechaNacimiento} onChange={handleChange} max={fechaHoy} className="w-full" /></div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-700">Sexo</label>
        <select name="sexo" value={formData.sexo} onChange={handleChange} className={selectClass}>
          <option value="">Seleccionar...</option>
          <option value="M">Masculino (M)</option>
          <option value="F">Femenino (F)</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-700">Estado Civil</label>
        <select name="estadoCivil" value={formData.estadoCivil} onChange={handleChange} className={selectClass}>
          <option value="">Seleccionar...</option>
          <option value="Soltero(a)">Soltero(a)</option>
          <option value="Casado(a)">Casado(a)</option>
          <option value="Conviviente">Conviviente</option>
          <option value="Divorciado(a)">Divorciado(a)</option>
          <option value="Viudo(a)">Viudo(a)</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-700">País de Nacimiento</label>
        <Input 
          name="paisNacimiento" 
          value={formData.paisNacimiento} 
          onChange={handleChange} 
          placeholder="Perú" 
          className="w-full" 
        />
      </div>

      <div className="col-span-full grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-700">Distrito</label>
          <select name="distrito" value={formData.distrito} onChange={handleChange} className={selectClass}>
            <option value="">Seleccione Distrito...</option>
            {distritosLima.map(d => (<option key={d} value={d.toUpperCase()}>{d}</option>))}
          </select>
        </div>


        {/* NUEVA CAJA DE SUELDO */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-700">Sueldo (S/)</label>
          <Input 
            type="number" 
            step="0.01" 
            name="sueldo" 
            value={formData.sueldo} 
            onChange={handleChange} 
            placeholder="0.00" 
            className="w-full" 
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-700">Dirección de Residencia</label>
          <Input name="direccion" value={formData.direccion} onChange={handleChange} placeholder="Dirección actual" className="w-full" />
        </div>
      </div>



      {/* INFORMACIÓN SUNAT */}
      <div className="col-span-full border-t pt-4"><h3 className="text-sm font-bold text-blue-700 uppercase">Información SUNAT</h3></div>
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">RUC</label><Input value={formData.ruc} readOnly className="bg-gray-50 text-gray-500 cursor-not-allowed" /></div>
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Estado Contribuyente</label><Input value={formData.estadoContribuyente} readOnly className="bg-gray-50 text-gray-500 cursor-not-allowed" /></div>
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Condición Contribuyente</label><Input value={formData.condicionContribuyente} readOnly className="bg-gray-50 text-gray-500 cursor-not-allowed" /></div>
      <div className="flex flex-col gap-1.5 col-span-full">
        <label className="text-xs font-medium text-gray-700">Actividad Económica</label>
        <textarea 
          name="actividadEconomica"
          value={formData.actividadEconomica} 
          onChange={handleChange}
          placeholder="Actividad económica registrada en SUNAT" 
          className="min-h-[80px] w-full rounded-md border px-3 py-2 bg-gray-50 text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
        />
      </div>

      {/* --- DERECHOHABIENTES (ESPOSA E HIJOS) --- */}
      <div className="col-span-full border-t pt-4 mb-1 mt-2"><h3 className="text-sm font-bold text-emerald-700 uppercase">Derechohabientes (EsSalud)</h3></div>
      <div className="col-span-full bg-gray-50 p-4 rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4">
        <h4 className="col-span-full text-xs font-bold text-gray-600 uppercase">Datos de la Cónyuge / Esposa (Opcional)</h4>
        <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Nombres</label><Input name="esposaNombres" value={formData.esposaNombres} onChange={handleChange} /></div>
        <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Primer Apellido</label><Input name="esposaPrimerApellido" value={formData.esposaPrimerApellido} onChange={handleChange} /></div>
        <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Segundo Apellido</label><Input name="esposaSegundoApellido" value={formData.esposaSegundoApellido} onChange={handleChange} /></div>
        <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Fecha de Nacimiento</label><Input type="date" name="esposaNacimiento" value={formData.esposaNacimiento} onChange={handleChange} max={fechaHoy} /></div>
      </div>

      <div className="col-span-full bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center mb-3"><h4 className="text-xs font-bold text-gray-600 uppercase">Hijos (Opcional)</h4><button type="button" onClick={agregarHijo} className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 transition-colors">+ Agregar Hijo</button></div>
        {formData.hijos.map((hijo, index) => (
          <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end mb-3 pb-3 border-b border-gray-200 last:border-0 last:mb-0 last:pb-0">
            <div className="flex flex-col gap-1.5 md:col-span-3"><label className="text-xs font-medium text-gray-700">Nombres del Hijo {index + 1}</label><Input value={hijo.nombres} onChange={(e) => handleHijoChange(index, 'nombres', e.target.value)} /></div>
            <div className="flex flex-col gap-1.5 md:col-span-3"><label className="text-xs font-medium text-gray-700">Primer Apellido</label><Input value={hijo.primerApellido} onChange={(e) => handleHijoChange(index, 'primerApellido', e.target.value)} /></div>
            <div className="flex flex-col gap-1.5 md:col-span-3"><label className="text-xs font-medium text-gray-700">Segundo Apellido</label><Input value={hijo.segundoApellido} onChange={(e) => handleHijoChange(index, 'segundoApellido', e.target.value)} /></div>
            <div className="flex flex-col gap-1.5 md:col-span-2"><label className="text-xs font-medium text-gray-700">Fecha de Nacimiento</label><Input type="date" value={hijo.nacimiento} onChange={(e) => handleHijoChange(index, 'nacimiento', e.target.value)} max={fechaHoy} /></div>
            <div className="md:col-span-1 flex justify-end">{formData.hijos.length > 1 && (<button type="button" onClick={() => eliminarHijo(index)} className="px-3 py-2 bg-red-500 text-white text-xs rounded hover:bg-red-600">✕</button>)}</div>
          </div>
        ))}
      </div>

      {/* --- 2. DATOS LABORALES Y PLANILLA --- */}
      <div className="col-span-full border-t pt-4 mb-1 mt-2"><h3 className="text-sm font-bold text-emerald-700 uppercase">2. Laboral y Planilla</h3></div>
      
      {/* ÁREA ACTUALIZADA CON LAS NUEVAS OPCIONES */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-700">Área</label>
        <select name="area" value={formData.area} onChange={handleChange} className={selectClass}>
          <option value="">Elegir Área</option>
          <option value="Operaciones">Operaciones</option>
          <option value="RRHH">RRHH</option>
          <option value="Tecnología">Tecnología</option>
          <option value="Logística">Logística</option>
          <option value="Almacén">Almacén</option>
          <option value="Post venta">Post venta</option>
          <option value="Moto win">Moto win</option>
          <option value="Ordenamiento">Ordenamiento</option>
          <option value="Visita técnica">Visita técnica</option>
          <option value="Tecnico 2">Tecnico 2</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Fecha Ingreso</label><Input name="fechaIngreso" value={formData.fechaIngreso} onChange={handleChange} type="date" className="w-full" /></div>
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Opción personal</label><select name="opcionPersonal" value={formData.opcionPersonal} onChange={handleChange} className={selectClass}><option value="">Seleccione</option><option value="autonomo">Autónomo</option><option value="directo">Directo</option></select></div>
      
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Régimen Pensionario (AFP/ONP)</label><select name="regimenPensionario" value={formData.regimenPensionario} onChange={(e) => { handleChange(e); if (!e.target.value.includes("AFP")) { setFormData(prev => ({ ...prev, regimenPensionario: e.target.value, tipoComision: "", cuspp: "" })); } }} className={selectClass}><option value="">Elegir Régimen</option><option value="ONP">ONP</option><option value="AFP Integra">AFP Integra</option><option value="AFP Prima">AFP Prima</option><option value="AFP Habitat">AFP Habitat</option><option value="AFP Profuturo">AFP Profuturo</option></select></div>
      {esAFP && (<div className="flex flex-col gap-1.5 animate-in fade-in zoom-in duration-300"><label className="text-xs font-bold text-emerald-700">Tipo de Comisión AFP</label><select name="tipoComision" value={formData.tipoComision} onChange={handleChange} className={`${selectClass} border-emerald-400 bg-emerald-50`}><option value="">Seleccione Comisión...</option><option value="flujo">Comisión sobre Flujo</option><option value="saldo">Comisión Anual sobre Saldo</option></select></div>)}
      {esAFP && (<div className="flex flex-col gap-1.5 animate-in fade-in duration-300"><label className="text-xs font-medium text-gray-700">CUSPP (Código AFP)</label><Input name="cuspp" value={formData.cuspp} onChange={handleChange} placeholder="Ej. 123456FHTWA1" className="w-full" /></div>)}

      {esAFP && formData.tipoComision && tasaActual && (
        <div className="col-span-full bg-emerald-50 p-4 rounded-lg border border-emerald-200 grid grid-cols-1 md:grid-cols-3 gap-4 mb-2 animate-in fade-in slide-in-from-top-4 duration-300">
          <h4 className="col-span-full text-xs font-bold text-emerald-800 uppercase border-b border-emerald-200 pb-1">Tasas SBS Actualizadas - {tasaActual.afp}</h4>
          <div className="flex flex-col"><span className="text-[10px] text-gray-500 font-semibold">COMISIÓN ({formData.tipoComision.toUpperCase()})</span><span className="text-sm font-bold text-gray-800">{formData.tipoComision === 'flujo' ? tasaActual.flujo : tasaActual.saldo}</span></div>
          <div className="flex flex-col"><span className="text-[10px] text-gray-500 font-semibold">PRIMA DE SEGUROS (%) 3/</span><span className="text-sm font-bold text-gray-800">{tasaActual.prima}</span></div>
          <div className="flex flex-col"><span className="text-[10px] text-gray-500 font-semibold">APORTE OBLIGATORIO</span><span className="text-sm font-bold text-gray-800">{tasaActual.aporte}</span></div>
        </div>
      )}

      {esONP && (
        <div className="col-span-full bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 mb-2 animate-in fade-in slide-in-from-top-4 duration-300">
          <h4 className="col-span-full text-xs font-bold text-slate-800 uppercase border-b border-slate-200 pb-1">Tasa ONP (Sistema Nacional de Pensiones)</h4>
          <div className="flex flex-col"><span className="text-[10px] text-gray-500 font-semibold">APORTE OBLIGATORIO ÚNICO</span><span className="text-sm font-bold text-gray-800">13.00%</span></div>
          <div className="flex flex-col md:col-span-2"><span className="text-[10px] text-gray-500 font-semibold">INFORMACIÓN</span><span className="text-xs text-gray-600">La ONP aplica una retención única del 13% sobre la remuneración bruta. No incluye cobro de comisiones ni primas de seguro por separado.</span></div>
        </div>
      )}

      <div className="col-span-full grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Cuadrilla</label><Input name="cuadrilla" value={formData.cuadrilla} onChange={handleChange} placeholder="Cuadrilla" className="w-full" /></div>
        
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-700">Banco</label>
          <select name="banco" value={formData.banco} onChange={handleChange} className={selectClass}>
            <option value="">Elegir Banco</option>
            <optgroup label="Bancos Principales">
              <option value="BCP">BCP</option>
              <option value="BBVA">BBVA</option>
              <option value="Interbank">Interbank</option>
              <option value="Scotiabank">Scotiabank</option>
              <option value="Banco de la Nación">Banco de la Nación</option>
            </optgroup>
            <optgroup label="Otros Bancos">
              <option value="BanBif">BanBif</option>
              <option value="Banco Pichincha">Banco Pichincha</option>
              <option value="MiBanco">MiBanco</option>
              <option value="Banco Falabella">Banco Falabella</option>
              <option value="Banco Ripley">Banco Ripley</option>
            </optgroup>
            <optgroup label="Cajas Principales">
              <option value="Caja Arequipa">Caja Arequipa</option>
              <option value="Caja Huancayo">Caja Huancayo</option>
              <option value="Caja Piura">Caja Piura</option>
            </optgroup>
          </select>
        </div>

        <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">N° Cuenta</label><Input name="cuenta" value={formData.cuenta} onChange={handleChange} placeholder="N° Cuenta" className="w-full" /></div>
        <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">CCI</label><Input name="cci" value={formData.cci} onChange={handleChange} placeholder="Código CCI" className="w-full" /></div>
      </div>

      {/* --- 3. SSOMA --- */}
      <div className="col-span-full border-t pt-4 mb-1 mt-2"><h3 className="text-sm font-bold text-emerald-700 uppercase">3. Seguridad (SSOMA)</h3></div>
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Vencimiento SCTR</label><Input name="sctrVencimiento" value={formData.sctrVencimiento} onChange={handleChange} type="date" className="w-full" /></div>
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Vencimiento EMO (Médico)</label><Input name="emoVencimiento" value={formData.emoVencimiento} onChange={handleChange} type="date" className="w-full" /></div>

      <div className="col-span-full grid grid-cols-1 md:grid-cols-4 gap-5 bg-gray-50 p-3 rounded-lg border border-gray-200 mt-2 mb-2">
        <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Licencia de Conducir</label><select name="licencia" value={formData.licencia} onChange={handleChange} className={selectClass}><option value="Sin Licencia">Sin Licencia</option><option value="A-I">A-I</option><option value="A-IIA">A-IIA</option><option value="A-IIB">A-IIB</option><option value="A-IIIA">A-IIIA</option></select></div>
        <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Número Brevete</label><Input name="numeroBrevete" value={formData.numeroBrevete} onChange={handleChange} placeholder="Ej. Q12345678" /></div>
        <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Emisión Licencia</label><Input name="fechaEmisionLicencia" value={formData.fechaEmisionLicencia} onChange={handleChange} type="date" className="w-full" /></div>
        <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Venc. Licencia</label><Input name="fechaVencimientoLicencia" value={formData.fechaVencimientoLicencia} onChange={handleChange} type="date" className="w-full" /></div>
      </div>

      {/* --- 4. EXPERIENCIA --- */}
      <div className="col-span-full border-t pt-4 mb-1 mt-2"><h3 className="text-sm font-bold text-emerald-700 uppercase">4. Experiencia Previa (Últimos Empleos)</h3></div>
      <div className="flex flex-col gap-1.5 col-span-full"><label className="text-xs font-medium text-gray-700">Último Empleo 1</label><Input name="ultimoEmpleo1" value={formData.ultimoEmpleo1} onChange={handleChange} placeholder="Empresa - Cargo - Fechas" className="w-full" /></div>
      <div className="flex flex-col gap-1.5 col-span-full"><label className="text-xs font-medium text-gray-700">Último Empleo 2</label><Input name="ultimoEmpleo2" value={formData.ultimoEmpleo2} onChange={handleChange} placeholder="Empresa - Cargo - Fechas" className="w-full" /></div>
      <div className="flex flex-col gap-1.5 col-span-full"><label className="text-xs font-medium text-gray-700">Último Empleo 3</label><Input name="ultimoEmpleo3" value={formData.ultimoEmpleo3} onChange={handleChange} placeholder="Empresa - Cargo - Fechas" className="w-full" /></div>

      {/* --- 5. EMERGENCIA --- */}
      <div className="col-span-full border-t pt-4 mb-1 mt-2"><h3 className="text-sm font-bold text-emerald-700 uppercase">5. Contacto de Emergencia</h3></div>
      <div className="flex flex-col gap-1.5 md:col-span-2 xl:col-span-2"><label className="text-xs font-medium text-gray-700">Nombre Contacto Emergencia</label><Input name="contactoEmergencia" value={formData.contactoEmergencia} onChange={handleChange} placeholder="Nombre completo" className="w-full" /></div>
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Parentesco</label><select name="parentesco" value={formData.parentesco} onChange={handleChange} className={selectClass}><option value="">Elegir Parentesco</option><option value="Cónyuge">Cónyuge</option><option value="Padre/Madre">Padre/Madre</option><option value="Hermano(a)">Hermano(a)</option><option value="Hijo(a)">Hijo(a)</option><option value="Otro">Otro</option></select></div>
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Teléfono Principal</label><Input name="telefonoEmergencia" value={formData.telefonoEmergencia} onChange={handleChange} placeholder="Teléfono de 9 dígitos" maxLength={9} className="w-full" /></div>
      <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-700">Teléfono Alternativo</label><Input name="telefonoAlternativo" value={formData.telefonoAlternativo} onChange={handleChange} placeholder="Teléfono 2" maxLength={9} className="w-full" /></div>
      <div className="flex flex-col gap-1.5 col-span-1 md:col-span-2 xl:col-span-1"><label className="text-xs font-medium text-gray-700">Dirección Emergencia</label><Input name="direccionEmergencia" value={formData.direccionEmergencia} onChange={handleChange} placeholder="Dirección" className="w-full" /></div>

      {/* --- 6. DOCUMENTOS ADJUNTOS --- */}
      <div className="col-span-full border-t border-gray-200 pt-6 mt-4"><h3 className="text-sm font-bold text-emerald-700 uppercase flex items-center gap-2"><span className="bg-emerald-100 p-1.5 rounded-full text-emerald-700">📄</span> 6. Documentos Adjuntos</h3></div>
      
      <div className="col-span-full bg-white p-6 rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {[
          { label: "Foto Perfil (JPG/PNG)", name: "foto" },
          { label: "Licencia (PDF Cara/Sello)", name: "licencia_pdf" },
          { label: "CV (PDF)", name: "cv" },
          { label: "DNI (PDF)", name: "dni_pdf" },
          { label: "Recibo Agua/Luz (PDF)", name: "recibo_servicio_pdf" },
          { label: "CertiJoven/Adulto (PDF)", name: "certijoven_pdf" }
        ].map((file) => {
          
          const valorActual = (formData as any)[file.name];
          const tieneArchivo = !!valorActual;

          return (
            <div key={file.name} className="flex flex-col gap-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{file.label}</label>
              <div className="relative group">
                
                {tieneArchivo && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData({...formData, [file.name]: ""});
                      const formElement = document.querySelector('form');
                      const fileInput = formElement?.elements.namedItem(file.name) as HTMLInputElement;
                      if(fileInput) fileInput.value = '';
                    }}
                    className="absolute -top-2 -right-2 z-10 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold hover:bg-red-600 shadow-sm transition-transform hover:scale-110"
                    title="Quitar archivo"
                  >
                    ✕
                  </button>
                )}

                <input 
                  type="file" 
                  name={file.name} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0"
                  onChange={(e) => {
                    if(e.target.files && e.target.files[0]) {
                      setFormData({...formData, [file.name]: e.target.files[0].name});
                    }
                  }}
                />
                
                <div className={`flex items-center gap-3 border-2 border-dashed rounded-lg p-3 transition-all duration-300 ${tieneArchivo ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 bg-gray-50 group-hover:border-emerald-500 group-hover:bg-emerald-50'}`}>
                  <span className="text-xl">{tieneArchivo ? "✅" : "📁"}</span>
                  <div className="flex-1 truncate">
                    <p className={`text-xs font-bold truncate ${tieneArchivo ? 'text-emerald-700' : 'text-gray-700'}`}>
                      {tieneArchivo ? valorActual : "Seleccionar archivo"}
                    </p>
                    <p className={`text-[10px] ${tieneArchivo ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>
                      {tieneArchivo ? "Documento ya cargado" : "Haz clic para buscar"}
                    </p>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      <button type="submit" disabled={loading} className="col-span-full mt-6 rounded-lg bg-emerald-600 py-3.5 font-bold tracking-wide text-white shadow-md hover:bg-emerald-700 disabled:bg-gray-400 transition-all duration-200 focus:ring-4 focus:ring-emerald-300">
        {loading ? "PROCESANDO..." : esModoEdicion ? "ACTUALIZAR EMPLEADO" : "GUARDAR EMPLEADO"}
      </button>

    </form>
  );
}