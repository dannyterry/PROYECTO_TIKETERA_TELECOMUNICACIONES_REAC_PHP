const pool = require('./db.js');

async function generarCodigoInteligente(nombre, catNombre) {
  const nom = String(nombre || '').toUpperCase().trim();
  const cat = String(catNombre || '').toUpperCase().trim();

  // 1. Detectar prefijo de Marca / Familia
  let prefix = '';
  if (nom.includes('ZTE')) {
    prefix = 'ZT';
  } else if (nom.includes('HUAWEI')) {
    prefix = 'HW';
  } else if (nom.includes('FIBERHOME')) {
    prefix = 'FH';
  } else if (nom.includes('WIN TV') || nom.includes('DECODIFICADOR') || nom.includes('DECO')) {
    prefix = 'WT';
  } else if (nom.includes('TP-LINK') || nom.includes('TPLINK')) {
    prefix = 'TP';
  } else if (nom.includes('MERCUSYS')) {
    prefix = 'MC';
  } else if (nom.includes('ROSETA')) {
    prefix = 'ROS';
  } else if (nom.includes('CONECTOR')) {
    prefix = 'CON';
  } else if (nom.includes('DROP') || nom.includes('CABLE')) {
    prefix = 'DRP';
  } else if (nom.includes('PATCH')) {
    prefix = 'PCH';
  } else if (cat.includes('EQUIPO')) {
    // Si es equipo de otra marca, tomar las 2 primeras consonantes o letras
    const palabras = nom.replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(w => w.length >= 2);
    prefix = (palabras[0] || 'EQ').slice(0, 2);
  } else {
    // Para otros materiales/herramientas
    const palabras = nom.replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(w => w.length >= 2);
    prefix = (palabras[0] || 'PR').slice(0, 3);
  }

  // 2. Consultar productos existentes con ese prefijo para calcular la siguiente letra (A, B, C...)
  const [existentes] = await pool.query(
    "SELECT codigo, nombre FROM productos WHERE codigo LIKE ?",
    [`${prefix}%`]
  );

  const letrasUsadas = new Set();
  existentes.forEach(p => {
    // Extraer la letra inmediatamente después del prefijo
    const resto = p.codigo.slice(prefix.length);
    const letraMatch = resto.match(/^([A-Z])/);
    if (letraMatch) {
      letrasUsadas.add(letraMatch[1]);
    }
  });

  const abecedario = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let letraAsignada = 'A';

  for (let i = 0; i < abecedario.length; i++) {
    if (!letrasUsadas.has(abecedario[i])) {
      letraAsignada = abecedario[i];
      break;
    }
  }

  // Código resultante con formato: PREFIJO + LETRA + 001
  const nuevoCodigo = `${prefix}${letraAsignada}001`;
  return nuevoCodigo;
}

async function test() {
  const ejemplos = [
    { nombre: 'ONT ZTE F670L DUAL BAND WIFI 6', cat: 'EQUIPOS' },
    { nombre: 'ROUTER REPETIDOR MESH ZTE H196A', cat: 'EQUIPOS' },
    { nombre: 'ONT ZTE F680 GPON WIFI', cat: 'EQUIPOS' },
    { nombre: 'ONT HUAWEI EG8145V5 DUAL BAND', cat: 'EQUIPOS' },
    { nombre: 'ROUTER MESH HUAWEI WS5200', cat: 'EQUIPOS' },
    { nombre: 'DECODIFICADOR WIN TV 4K ANDROID', cat: 'EQUIPOS' },
    { nombre: 'ONT FIBERHOME AN5506-04', cat: 'EQUIPOS' },
    { nombre: 'ROSETA OPTICA 2 PUERTOS CON ADAPTADOR', cat: 'MATERIALES' },
    { nombre: 'CONECTOR SC/APC FAST CONNECTOR', cat: 'MATERIALES' },
  ];

  console.log("--------------------------------------------------");
  console.log("🧪 SIMULACIÓN DE CÓDIGOS INTELIGENTES");
  console.log("--------------------------------------------------");
  for (const ej of ejemplos) {
    const cod = await generarCodigoInteligente(ej.nombre, ej.cat);
    console.log(`📌 "${ej.nombre}" -> CÓDIGO GENERADO: ${cod}`);
  }

  process.exit(0);
}

test().catch(console.error);
