const db = require('./db');

const userListRaw = `CAMBIO DE EQUIPO ONT	VISITA EXTERNA
CAMBIO DE ONT ADICIONAL	VISITA EXTERNA
CAMBIO FONOWIN	VISITA EXTERNA
CAMBIO DE CONECTOR EN CTO/NAP	VISITA EXTERNA
SERVICIO DE ENTREGA Y CONFIGURACIÓN DE FONO WIN - POST VENTA	VISITA EXTERNA
SERVICIO DE ENTREGA Y CONFIGURACIÓN DE TV BOX - POST VENTA	VISITA EXTERNA
CAMBIO DE EQUIPO MESH	VISITA EXTERNA
SERVICIO DE ENTREGA Y CONFIGURACIÓN DE MESH - POST VENTA	VISITA EXTERNA
INSTALACIÓN DE MESH MAS CABLEADO CAT 6 - POST VENTA	VISITA EXTERNA
CAMBIO DE ACOPLADOR	VISITA EXTERNA
CAMBIO DE CABLE PACHTCORD	VISITA EXTERNA
ACOMODO DE FIBRA	VISITA EXTERNA
MIGRA XGSPON	VISITA EXTERNA
CAMBIO DE CONECTOR EN ROSETA	VISITA EXTERNA
ATENCIÓN DE AVERÍAS ULTIMA MILLA	VISITA EXTERNA
CAMBIO DE TV BOX	VISITA EXTERNA
CAMBIO DE FONO WIN	VISITA EXTERNA
CABLEADO CAT 6 Y CONFIGURACIÓN DE MESH DURANTE LA ATENCIÓN - VISITA TÉCNICA	VISITA EXTERNA
CAMBIO DE TELEFONO ADICIONAL	VISITA EXTERNA
INSTALACIÓN DE MESH MAS CABLEADO CAT 6 - POST VENTA	VISITA EXTERNA
CABLEADO UTP CAT 6 - POST VENTA	VISITA EXTERNA
CABLEADO UTP CAT 6 - POST VENTA	VISITA EXTERNA
CAMBIO DE ONT POR REPOSICION - POST VENTA	VISITA EXTERNA
RE-INSTALACIÓN DE ONT - CONDOMINIO	VISITA EXTERNA
RE-INSTALACIÓN DE ONT - RESIDENCIAL	VISITA EXTERNA
CAMBIO DE ONT POR REPOSICION ADICIONAL	VISITA EXTERNA
CABLEADO UTP CAT 6 ADICIONAL - POST VENTA	VISITA EXTERNA
CABLEADO UTP CAT 6 ADICIONAL - POST VENTA	VISITA EXTERNA
INSTALACIÓN DE MESH MAS CABLEADO CAT 6 DURANTE LA ATENCIÓN - POST VENTA	VISITA EXTERNA
SERVICIO DE ENTREGA Y CONFIGURACIÓN DE FONO WIN - ADICIONAL	VISITA EXTERNA
SERVICIO DE ENTREGA Y CONFIGURACIÓN DE TV BOX - ADICIONAL	VISITA EXTERNA
SERVICIOS DE ENTREGA Y CONFIGURACIÓN MESH - ADICIONAL	VISITA EXTERNA
TRASLADO DE SERVICIOS POR MUDANZA EN RESIDENCIALES - POST VENTA	TRASLADO
TRASLADO DE SERVICIOS POR MUDANZA EN CONDOMINIO - POST VENTA	TRASLADO
REUBICACION DE ROUTER SIN RESERVA - POST VENTA	REUBICACION SIN RESERVA
REUBICACION DE ROUTER CON RESERVA - POST VENTA	REUBICACION CON RESERVA
SERVICIO COMPLETO DE RECABLEADO EN ABONADO CONDOMINIO - VISITA TÉCNICA	RECABLEADO EN CONDOMINIO
SERVICIO COMPLETO DE RECABLEADO EN ABONADO RESIDENCIAL - VISITA TÉCNICA	RECABLEADO
SERVICIO COMPLETO DE RECABLEADO EN ABONADO RESIDENCIAL - POST VENTA	RECABLEADO
SERVICIO COMPLETO DE RECABLEADO EN ABONADO CONDOMINIO - POST VENTA	RECABLEADO
PRUEBAS DE SERVICIO	PEX
INSTALACION DE SPLITERS 1X2	ADICONAL
CAMBIO DE MESH ADICIONAL	ADICONAL
CAMBIO DE TV BOX ADICIONAL	ADICONAL`;

async function compare() {
  const lines = userListRaw.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const userItems = [];
  const userCount = {};
  const userMap = new Map();

  for (const line of lines) {
    const parts = line.split('\t');
    const nom = (parts[0] || '').trim();
    const tipo = (parts[1] || '').trim();
    userCount[nom] = (userCount[nom] || 0) + 1;
    userItems.push({ nom, tipo });
    userMap.set(nom.toUpperCase(), tipo);
  }

  const [dbMotivos] = await db.query('SELECT nombre, tipo_trabajo FROM motivos');
  const dbMap = new Map();
  for (const m of dbMotivos) {
    dbMap.set(m.nombre.trim().toUpperCase(), m.tipo_trabajo.trim().toUpperCase());
  }

  // 1. Duplicados en la lista enviada por el usuario
  console.log('--------------------------------------------------');
  console.log('🔁 1. ELEMENTOS DUPLICADOS EN EL TEXTO QUE ENVIASTE:');
  console.log('--------------------------------------------------');
  for (const [k, v] of Object.entries(userCount)) {
    if (v > 1) {
      console.log(`   ⚠️ "${k}" (está escrito ${v} veces en tu lista)`);
    }
  }

  // 2. Faltantes en la base de datos (Están en tu lista pero no en la BD actual)
  console.log('\n--------------------------------------------------');
  console.log('➕ 2. ESTÁN EN TU LISTA PERO FALTAN EN LA BD ACTUAL:');
  console.log('--------------------------------------------------');
  let faltanCount = 0;
  for (const [nom, tipo] of userMap.entries()) {
    if (!dbMap.has(nom)) {
      faltanCount++;
      console.log(`   [${faltanCount}] "${nom}" ➔ Tipo: "${tipo}"`);
    }
  }

  // 3. Sobrantes en la base de datos (Están en la BD pero no en tu lista)
  console.log('\n--------------------------------------------------');
  console.log('➖ 3. ESTÁN EN LA BD ACTUAL PERO NO EN TU LISTA:');
  console.log('--------------------------------------------------');
  let sobranCount = 0;
  for (const [nom, tipo] of dbMap.entries()) {
    if (!userMap.has(nom)) {
      sobranCount++;
      console.log(`   [${sobranCount}] "${nom}" ➔ Tipo: "${tipo}"`);
    }
  }

  // 4. Observaciones de ortografía / tipografía
  console.log('\n--------------------------------------------------');
  console.log('📝 4. CORRECCIONES / DETALLES DE ESCRITURA EN TU LISTA:');
  console.log('--------------------------------------------------');
  console.log('   - "CAMBIO DE CABLE PACHTCORD" tiene error tipográfico (debe ser "PATCH CORD").');
  console.log('   - "ADICONAL" en los últimos 3 items le falta la "I" (debe ser "ADICIONAL").');
  console.log('   - "INSTALACION DE SPLITERS 1X2" (Splitters se suele escribir con doble "t").');
  console.log('   - "CAMBIO DE FONO WIN" y "CAMBIO FONOWIN" son prácticamente el mismo motivo.');

  process.exit();
}

compare();
