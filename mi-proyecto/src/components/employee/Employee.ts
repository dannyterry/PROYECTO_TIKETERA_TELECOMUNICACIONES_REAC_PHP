export interface Employee {
  id: number;
  estado?: string;
  estadoFechaInicio?: string;
  estadoFechaFin?: string;
  estadoObservacion?: string;
  id_rol?: string | number;
  rolNombre?: string;
  tipoDocumento?: string;
  dni?: string;
  nombres: string;
  primerApellido: string;
  segundoApellido: string;
  correo?: string;
  usuario?: string;
  password?: string;
  telefono?: string;
  fechaNacimiento?: string;
  sexo?: string;
  estadoCivil?: string;
  paisNacimiento?: string;
  distrito?: string;
  direccion?: string;
  sueldo?: number | string;
  
  // SUNAT
  ruc?: string;
  estadoContribuyente?: string;
  condicionContribuyente?: string;
  actividadEconomica?: string;
  
  // Laborales y Planilla
  area?: string;
  fechaIngreso?: string;
  opcionPersonal?: string;
  cuadrilla?: string;
  regimenPensionario?: string;
  tipoComision?: string;
  cuspp?: string;
  banco?: string;
  cuenta?: string;
  cci?: string;
  
  // Derechohabientes (¡ESTOS FALTABAN EN LA IMAGEN!)
  esposaNombres?: string;
  esposaPrimerApellido?: string;
  esposaSegundoApellido?: string;
  esposaNacimiento?: string;
  hijos?: Array<{
    nombres: string;
    primerApellido: string;
    segundoApellido: string;
    nacimiento: string;
  }>;

  // SSOMA y Licencia (¡ESTOS TAMBIÉN!)
  sctrVencimiento?: string;
  emoVencimiento?: string;
  licencia?: string;
  numeroBrevete?: string;
  fechaEmisionLicencia?: string;
  fechaVencimientoLicencia?: string;
  tallaPolo?: string;
  tallaPantalon?: string;
  tallaCalzado?: string;
  
  // Experiencia y Emergencia
  ultimoEmpleo1?: string;
  ultimoEmpleo2?: string;
  ultimoEmpleo3?: string;
  contactoEmergencia?: string;
  parentesco?: string;
  telefonoEmergencia?: string;
  telefonoAlternativo?: string;
  direccionEmergencia?: string;

  // Archivos
  foto?: string;
  cv?: string;
  dni_pdf?: string;
  licencia_pdf?: string;
  recibo_servicio_pdf?: string;
  certijoven_pdf?: string;
}