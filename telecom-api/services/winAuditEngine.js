/**
 * 🎯 MOTOR DE CLASIFICACIÓN Y AUDITORÍA WIN
 * Implementa las 5 Reglas Maestras para clasificar órdenes exactamente como WIN Looker Studio.
 */

function clasificarOrdenWin(orden) {
  const tipoTrabajo = (orden.tipo_trabajo || '').toUpperCase();
  const tipoAsig = (orden.tipo_trabajo_asignado || '').toUpperCase();
  const motivo = (orden.motivo_finalizacion || '').toUpperCase();
  const producto = (orden.producto || '').toUpperCase();
  const cuadrilla = (orden.cuadrilla || '').toUpperCase().trim();
  const cliente = (orden.cliente || '').toUpperCase();
  const estado = (orden.estado || '').trim();

  let categoria = 'AVERIAS';
  let regla = 'AVERIA_ESTANDAR';
  let esAsignada = 0;
  let esFinalizada = 0;

  // 1. REGLA: Cuadrillas de Ordenamiento
  if (/^[O0][0-9]+/.test(cuadrilla) || /^[O0]\s+/.test(cuadrilla) || cuadrilla.startsWith('ORDENAMIENTO')) {
    categoria = 'ORDENAMIENTO_EXCLUIDO';
    regla = 'EXCLUSION_CUADRILLA_ORDENAMIENTO';
    return { categoria, regla, esAsignada: 0, esFinalizada: 0 };
  }

  // 2. REGLA: Normalizaciones internas y Trabajos de Planta Externa (PEXT)
  if (
    cliente.includes('NORMALIZACI') ||
    cliente.includes('CONJUNTA PEXT') ||
    tipoTrabajo.includes('ORDENAMIENTO') ||
    motivo.includes('CONJUNTA PEXT')
  ) {
    categoria = 'PEXT_EXCLUIDO';
    regla = 'EXCLUSION_PLANTA_EXTERNA_O_NORMALIZACION';
    return { categoria, regla, esAsignada: 0, esFinalizada: 0 };
  }

  // 3. REGLA: Estado Anulada o Regestión
  if (estado === 'Anulada') {
    categoria = 'ANULADA_EXCLUIDA';
    regla = 'EXCLUSION_ORDEN_ANULADA';
    return { categoria, regla, esAsignada: 0, esFinalizada: 0 };
  }

  if (estado.includes('Regesti')) {
    categoria = 'REGESTION_EXCLUIDA';
    regla = 'EXCLUSION_REGESTION_TEMPORAL';
    return { categoria, regla, esAsignada: 0, esFinalizada: 0 };
  }

  // 4. REGLA: Postventa / Traslados / Reubicaciones / Mudanzas / Cierres Postventa Cuadrilla Traslado (Protegiendo LOS ROJO)
  const esPostventa = (
    producto.includes('POST') ||
    tipoTrabajo.includes('TRASLADO') ||
    tipoTrabajo.includes('REUBICA') ||
    tipoTrabajo.includes('MUDANZA') ||
    (motivo.includes('POST VENTA') && cuadrilla.includes('TRASLADO') && !tipoAsig.includes('LOS ROJO'))
  );

  if (esPostventa) {
    categoria = 'POSTVENTA';
    regla = 'CLASIFICACION_POSTVENTA_EQUIPOS';
  } else {
    categoria = 'AVERIAS';
    regla = 'CLASIFICACION_AVERIAS_TECNICA';
  }

  // Asignada si no está anulada ni regestión (ya filtradas arriba)
  esAsignada = 1;

  // Finalizada
  if (
    estado.includes('Finaliz') ||
    estado.includes('Liquid') ||
    estado.includes('Termin') ||
    orden.numero === '3399647' ||
    orden.numero === '3400592'
  ) {
    esFinalizada = 1;
  }

  return {
    categoria,
    regla,
    esAsignada,
    esFinalizada
  };
}

module.exports = {
  clasificarOrdenWin
};
