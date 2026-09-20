const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function auditTablesAndRoutes() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'corporacioncespe_cespedes'
  });

  const [tRows] = await conn.query('SHOW TABLES');
  const existingTables = tRows.map(r => Object.values(r)[0]);
  const existingSet = new Set(existingTables.map(t => t.toLowerCase()));

  // 1. Extraer todas las tablas usadas en server.js
  const serverCode = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

  const tableKeywords = ['FROM', 'JOIN', 'INTO', 'UPDATE'];
  const regex = new RegExp(`(?:${tableKeywords.join('|')})\\s+\`?([a-zA-Z0-9_]+)\`?`, 'gi');

  const sqlKeywords = new Set([
    'select', 'where', 'set', 'order', 'group', 'left', 'right', 'inner', 'outer', 
    'join', 'values', 'if', 'exists', 'not', 'null', 'as', 'on', 'duplicate', 'key', 
    'limit', 'table', 'distinct', 'union', 'all', 'index', 'view', 'current_timestamp',
    'information_schema', 'show', 'columns', 'status', 'variables', 'full', 'temporary',
    'like', 'database', 'collation', 'dual', 'tables', 'modify', 'column', 'add', 'drop',
    'curdate', 'now', 'count', 'case', 'when', 'then', 'else', 'end', 'sum', 'coalesce',
    'avg', 'min', 'max', 'date', 'concat', 'coalesce'
  ]);

  const scannedTables = new Set();
  let match;
  while ((match = regex.exec(serverCode)) !== null) {
    const raw = match[1].toLowerCase();
    if (!sqlKeywords.has(raw) && isNaN(raw) && raw.length > 2) {
      scannedTables.add(raw);
    }
  }

  const validExisting = [];
  const missingTables = [];

  for (const t of Array.from(scannedTables).sort()) {
    if (existingSet.has(t)) {
      validExisting.push(t);
    } else {
      missingTables.push(t);
    }
  }

  console.log('====================================================');
  console.log('📊 AUDITORÍA EXHAUSTIVA DE TABLAS (API VS DB LOCAL)');
  console.log('====================================================');
  console.log(`✅ Total de tablas en tu Base de Datos Local: ${existingTables.length}`);
  console.log(`🔍 Tablas identificadas en el Backend: ${validExisting.length}`);
  console.log('Lista de tablas operativas:', validExisting);

  console.log('\n----------------------------------------------------');
  if (missingTables.length === 0) {
    console.log('🎉 ¡EXCELENTE! NO FALTA NINGUNA TABLA EN TU BASE DE DATOS LOCAL.');
  } else {
    console.log('⚠️ Tablas referenciadas pero que NO existen:', missingTables);
  }
  console.log('====================================================\n');

  // 2. Extraer rutas del frontend en /src para verificar que el API las soporte todas
  const frontendDir = path.join(__dirname, '..', '..', 'mi-proyecto', 'src');
  const endpointRegex = /['"`](\/api\/[a-zA-Z0-9_\-\/]+)['"`]/g;
  const frontendEndpoints = new Set();

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const fullPath = path.join(dir, e.name);
      if (e.isDirectory()) {
        scanDir(fullPath);
      } else if (/\.(tsx|ts|js|jsx)$/.test(e.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        let m;
        while ((m = endpointRegex.exec(content)) !== null) {
          frontendEndpoints.add(m[1]);
        }
      }
    }
  }

  scanDir(frontendDir);

  console.log(`🌐 Total de endpoints llamados por el Frontend: ${frontendEndpoints.size}`);

  const missingRoutes = [];
  for (const ep of Array.from(frontendEndpoints).sort()) {
    // Verificar si server.js contiene esta ruta o una con parámetros
    const baseEp = ep.replace(/\$\{[^}]+\}/g, '').replace(/\/+$/, '');
    if (!serverCode.includes(baseEp) && !serverCode.includes(baseEp.replace(/\/api/, ''))) {
      missingRoutes.push(ep);
    }
  }

  console.log('\n--- VERIFICACIÓN DE RUTAS FRONTEND VS BACKEND ---');
  if (missingRoutes.length === 0) {
    console.log('🎉 ¡TODAS LAS RUTAS DEL FRONTEND EXISTEN EN EL BACKEND!');
  } else {
    console.log('⚠️ Rutas del frontend que conviene revisar:', missingRoutes);
  }

  await conn.end();
}

auditTablesAndRoutes();
