const db = require('./db');

const CATALOGO_OFICIAL_MOTIVOS = [
  // ─── VISITA EXTERNA ──────────────────────────────────────────────
  { nombre: 'CAMBIO DE EQUIPO ONT', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'CAMBIO DE ONT ADICIONAL', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'CAMBIO FONOWIN', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'CAMBIO DE CONECTOR EN CTO/NAP', tipo_trabajo: 'VISITA EXTERNA', limiteConector: 1 },
  { nombre: 'CAMBIO DE CONECTOR EN ROSETA', tipo_trabajo: 'VISITA EXTERNA', limiteConector: 1 },
  { nombre: 'CAMBIO DE CABLE PATCH CORD', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'CAMBIO DE ACOPLADOR', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'ADAPTADOR ROSETA', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'ACOMODO DE FIBRA', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'CAMBIO DE EQUIPO MESH', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'CAMBIO DE TV BOX', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'MIGRA XGSPON', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'ATENCIÓN DE AVERÍAS ULTIMA MILLA', tipo_trabajo: 'VISITA EXTERNA', limiteConector: 1 },
  { nombre: 'SERVICIO DE ENTREGA Y CONFIGURACIÓN DE FONO WIN - POST VENTA', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'SERVICIO DE ENTREGA Y CONFIGURACIÓN DE TV BOX - POST VENTA', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'SERVICIO DE ENTREGA Y CONFIGURACIÓN DE MESH - POST VENTA', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'INSTALACIÓN DE MESH MAS CABLEADO CAT 6 - POST VENTA', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'CABLEADO CAT 6 Y CONFIGURACIÓN DE MESH DURANTE LA ATENCIÓN - VISITA TÉCNICA', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'CAMBIO DE TELEFONO ADICIONAL', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'CABLEADO UTP CAT 6 - POST VENTA', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'CAMBIO DE ONT POR REPOSICION - POST VENTA', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'RE-INSTALACIÓN DE ONT - CONDOMINIO', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'RE-INSTALACIÓN DE ONT - RESIDENCIAL', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'CAMBIO DE ONT POR REPOSICION ADICIONAL', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'CABLEADO UTP CAT 6 ADICIONAL - POST VENTA', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'INSTALACIÓN DE MESH MAS CABLEADO CAT 6 DURANTE LA ATENCIÓN - POST VENTA', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'SERVICIO DE ENTREGA Y CONFIGURACIÓN DE FONO WIN - ADICIONAL', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'SERVICIO DE ENTREGA Y CONFIGURACIÓN DE TV BOX - ADICIONAL', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'SERVICIOS DE ENTREGA Y CONFIGURACIÓN MESH - ADICIONAL', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'WINBOX - CONTROL DEFECT', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'ASISTENCIA WIN TV', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },
  { nombre: 'CONFIGURACION ONT', tipo_trabajo: 'VISITA EXTERNA', limiteConector: null },

  // ─── RECABLEADO ──────────────────────────────────────────────────
  { nombre: 'RECABLEADO', tipo_trabajo: 'RECABLEADO', limiteConector: 2 },
  { nombre: 'SERVICIO COMPLETO DE RECABLEADO EN ABONADO RESIDENCIAL - VISITA TÉCNICA', tipo_trabajo: 'RECABLEADO', limiteConector: 2 },
  { nombre: 'SERVICIO COMPLETO DE RECABLEADO EN ABONADO RESIDENCIAL - POST VENTA', tipo_trabajo: 'RECABLEADO', limiteConector: 2 },
  { nombre: 'SERVICIO COMPLETO DE RECABLEADO EN ABONADO CONDOMINIO - POST VENTA', tipo_trabajo: 'RECABLEADO', limiteConector: 2 },
  { nombre: 'RECABLEADO - AVERIADO POR TERCEROS', tipo_trabajo: 'RECABLEADO', limiteConector: 2 },
  { nombre: 'RECABLEADO - CLIENTE MIGRA A OTRA CTO', tipo_trabajo: 'RECABLEADO', limiteConector: 2 },
  { nombre: 'RECABLEADO - CAMBIO DE POSTE', tipo_trabajo: 'RECABLEADO', limiteConector: 2 },
  { nombre: 'RECABLEADO POR MANTENIMIENTO', tipo_trabajo: 'RECABLEADO', limiteConector: 2 },

  // ─── RECABLEADO EN CONDOMINIO ────────────────────────────────────
  { nombre: 'RECABLEADO EN CONDOMINIO', tipo_trabajo: 'RECABLEADO EN CONDOMINIO', limiteConector: 2 },
  { nombre: 'SERVICIO COMPLETO DE RECABLEADO EN ABONADO CONDOMINIO - VISITA TÉCNICA', tipo_trabajo: 'RECABLEADO EN CONDOMINIO', limiteConector: 2 },

  // ─── NORMALIZACIÓN ───────────────────────────────────────────────
  { nombre: 'NORMALIZACIÓN', tipo_trabajo: 'NORMALIZACIÓN', limiteConector: 2 },

  // ─── REUBICACIONES ───────────────────────────────────────────────
  { nombre: 'REUBICACION DE ROUTER SIN RESERVA - POST VENTA', tipo_trabajo: 'REUBICACIÓN SIN RESERVA', limiteConector: 2 },
  { nombre: 'REUBICACION SIN RESERVA', tipo_trabajo: 'REUBICACIÓN SIN RESERVA', limiteConector: 2 },
  { nombre: 'REUBICACION DE ROUTER CON RESERVA - POST VENTA', tipo_trabajo: 'REUBICACIÓN CON RESERVA', limiteConector: 1 },
  { nombre: 'REUBICACION CON RESERVA', tipo_trabajo: 'REUBICACIÓN CON RESERVA', limiteConector: 1 },

  // ─── TRASLADOS ───────────────────────────────────────────────────
  { nombre: 'TRASLADO DE SERVICIOS POR MUDANZA EN RESIDENCIALES - POST VENTA', tipo_trabajo: 'TRASLADO', limiteConector: 2 },
  { nombre: 'TRASLADO DE SERVICIOS POR MUDANZA EN CONDOMINIO - POST VENTA', tipo_trabajo: 'TRASLADO', limiteConector: 2 },
  { nombre: 'TRASLADO', tipo_trabajo: 'TRASLADO', limiteConector: 2 },

  // ─── ADICIONAL ───────────────────────────────────────────────────
  { nombre: 'INSTALACION DE SPLITTERS 1X2', tipo_trabajo: 'ADICIONAL', limiteConector: null },
  { nombre: 'CAMBIO DE MESH ADICIONAL', tipo_trabajo: 'ADICIONAL', limiteConector: null },
  { nombre: 'CAMBIO DE TV BOX ADICIONAL', tipo_trabajo: 'ADICIONAL', limiteConector: null },
  { nombre: 'KIT WIFI PRO (AL CONTADO)', tipo_trabajo: 'ADICIONAL', limiteConector: null },

  // ─── GARANTIA & PEX ──────────────────────────────────────────────
  { nombre: 'GARANTIA', tipo_trabajo: 'GARANTIA', limiteConector: 1 },
  { nombre: 'PRUEBAS DE SERVICIO', tipo_trabajo: 'PEX', limiteConector: null },
  { nombre: 'CONJUNTA FINALIZADA', tipo_trabajo: 'PEX', limiteConector: null }
];

async function deployOfficialMotivos() {
  console.log('🚀 Desplegando catálogo oficial consolidado en tabla motivos...');

  // 1. Limpiar tabla motivos
  await db.query('DELETE FROM motivos');

  let count = 0;
  for (const item of CATALOGO_OFICIAL_MOTIVOS) {
    const limites = item.limiteConector !== null 
      ? JSON.stringify([{ id_producto: 27, cantidad: item.limiteConector }])
      : null;

    await db.query(
      `INSERT INTO motivos (nombre, tipo_trabajo, precio_compra, precio_venta, limites_materiales, estado, fecha_creacion)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [item.nombre, item.tipo_trabajo, '90.00', '40.00', limites, 'Activo']
    );

    count++;
    console.log(`[${count}] ➕ "${item.nombre}" ➔ ${item.tipo_trabajo} (Límite Conectores: ${item.limiteConector ?? 'Ninguno'})`);
  }

  const [total] = await db.query('SELECT COUNT(*) AS c FROM motivos');
  console.log(`\n🎉 Catálogo oficial desplegado con éxito: Total ${total[0].c} motivos registrados y homologados.`);
  process.exit();
}

deployOfficialMotivos();
