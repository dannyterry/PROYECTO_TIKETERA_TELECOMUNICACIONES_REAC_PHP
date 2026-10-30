/**
 * Extractor de routers para server.js
 * Extrae bloques de rutas por prefijo /api/MODULO y crea routes/MODULO.js
 */
const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'telecom-api/server.js');
const routesDir = path.join(__dirname, 'telecom-api/routes');

// Asegurar carpeta routes/
if (!fs.existsSync(routesDir)) fs.mkdirSync(routesDir, { recursive: true });

const raw = fs.readFileSync(serverPath, 'utf8').replace(/\r\n/g, '\n');
const lines = raw.split('\n');

/**
 * Extrae todas las rutas de un módulo dado su prefijo de URL.
 * Para cada ruta app.METHOD('/api/PREFIX/...', ...) extrae el bloque completo.
 * Retorna { routerLines: string[], lineNumbers: number[] }
 */
function extractRouteBlocks(lines, urlPrefixes) {
  const results = [];
  const usedLines = new Set();
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Detectar inicio de ruta
    const isRouteStart = urlPrefixes.some(prefix => {
      return line.match(new RegExp(`^app\\.(get|post|put|delete|patch)\\(['"]${prefix.replace(/\//g, '\\/').replace(/\*/g, '.*')}`));
    });
    
    if (!isRouteStart) continue;
    
    // Encontrar el final del bloque (balancear llaves)
    let depth = 0;
    let blockStart = i;
    let blockEnd = i;
    let foundBlock = false;
    
    for (let j = i; j < Math.min(i + 1000, lines.length); j++) {
      const l = lines[j];
      for (const ch of l) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }
      if (depth > 0 || (depth === 0 && j > i && l.trim().startsWith('}'))) {
        if (depth === 0) {
          blockEnd = j;
          foundBlock = true;
          break;
        }
      }
    }
    
    if (!foundBlock) blockEnd = Math.min(i + 500, lines.length - 1);
    
    // Verificar que no está ya usado
    if (!usedLines.has(i)) {
      const block = lines.slice(blockStart, blockEnd + 1);
      results.push({ blockStart, blockEnd, block });
      for (let k = blockStart; k <= blockEnd; k++) usedLines.add(k);
      i = blockEnd; // saltar al final del bloque
    }
  }
  
  return results;
}

/**
 * Genera el contenido de un archivo router
 */
function generateRouterFile(moduleName, routeBlocks, urlPrefixes) {
  const lines = [];
  lines.push(`'use strict';`);
  lines.push(`const express = require('express');`);
  lines.push(`const router = express.Router();`);
  lines.push(`const pool = require('../db');`);
  lines.push(`const { requireAuth, signToken } = require('../middleware/requireAuth');`);
  lines.push(`const { uploadFileToS3, uploadBufferToS3, getS3ObjectStream, checkS3ObjectExists, getS3SignedUrl } = require('../services/s3Service');`);
  lines.push(`const path = require('path');`);
  lines.push(`const fs = require('fs');`);
  lines.push(``);
  
  // Agregar imports específicos según módulo
  if (['almacen', 'movilidad', 'supervision', 'dashboard'].includes(moduleName)) {
    lines.push(`const { sincronizarTareasOrdenSeguro, getTareasDeBD, sincronizarTareasOrdenesActivas, guardarDetalleTareaEnBD, getMetrajeDeclaradoFenix } = require('../services/taskSyncService');`);
    lines.push(`const { getMotivosCatalogo, resolverTipoTrabajoConCatalogo, resolverTipoTrabajoOficial, normalizeText } = require('../services/tipoTrabajoHelper');`);
  }
  if (moduleName === 'dashboard') {
    lines.push(`const { scrapeOrdenesFromFenix } = require('../services/fenixScraper');`);
  }
  lines.push(``);
  lines.push(`// ─── RUTAS MÓDULO: ${moduleName.toUpperCase()} ───────────────────────────────────────`);
  lines.push(``);
  
  // Prefijos a reemplazar (ej: '/api/almacen/' → '/')
  const prefixesToReplace = urlPrefixes.map(p => p.replace(/\/$/, ''));
  
  for (const { block } of routeBlocks) {
    let blockStr = block.join('\n');
    
    // Reemplazar app. → router.
    blockStr = blockStr.replace(/^app\.(get|post|put|delete|patch)\(/gm, 'router.$1(');
    
    // Reemplazar las URLs: '/api/almacen/foo' → '/foo', '/api/almacen' → '/'
    for (const prefix of prefixesToReplace) {
      // Con barra al final
      blockStr = blockStr.replace(
        new RegExp(`(['"])${prefix.replace(/\//g, '\\/').replace(/\*/g, '\\*')}/`, 'g'),
        `$1/`
      );
      // Sin barra al final (ruta exacta del módulo)
      blockStr = blockStr.replace(
        new RegExp(`(['"])${prefix.replace(/\//g, '\\/').replace(/\*/g, '\\*')}(['"])`, 'g'),
        `$1/$2`
      );
    }
    
    lines.push(blockStr);
    lines.push(``);
  }
  
  lines.push(`module.exports = router;`);
  return lines.join('\n');
}

// ── CONFIGURACIÓN DE MÓDULOS A EXTRAER ────────────────────────────────────────
const modules = [
  { name: 'almacen',    prefixes: ["/api/almacen/", "/api/almacen'", '/api/almacen"'] },
  { name: 'movilidad',  prefixes: ["/api/movilidad/", "/api/movilidad'", '/api/movilidad"'] },
  { name: 'supervision',prefixes: ["/api/supervision/", "/api/supervision'"] },
  { name: 'dashboard',  prefixes: ["/api/dashboard/", "/api/dashboard'", "/api/looker/", "/api/win-audit/"] },
  { name: 'empleados',  prefixes: ["/api/empleados/", "/api/empleados'", "/api/roles/", "/api/areas/", "/api/subcontratas/", "/api/permisos/", "/api/cuadrillas/"] },
  { name: 'configuracion', prefixes: ["/api/configuracion/", "/api/configuracion'", "/api/motivos/", "/api/motivos'", "/api/tipos-trabajo/"] },
  { name: 'asistencias', prefixes: ["/api/asistencias/", "/api/asistencias'"] },
  { name: 'correos',    prefixes: ["/api/correos/", "/api/correos'"] },
  { name: 'pagos',      prefixes: ["/api/pagos/", "/api/pagos'"] },
  { name: 'inventario', prefixes: ["/api/inventario/"] },
  { name: 'auditoria',  prefixes: ["/api/auditoria/", "/api/chat/"] },
];

// ── REGEX para detección de inicio de ruta ────────────────────────────────────
function isRouteStart(line, prefixes) {
  if (!line.match(/^app\.(get|post|put|delete|patch)\(/)) return false;
  return prefixes.some(prefix => line.includes(prefix));
}

// ── EXTRACTOR PRINCIPAL ───────────────────────────────────────────────────────
function extractModuleRoutes(lines, prefixes) {
  const results = [];
  let i = 0;
  
  while (i < lines.length) {
    if (!isRouteStart(lines[i], prefixes)) { i++; continue; }
    
    const blockStart = i;
    let depth = 0;
    let j = i;
    
    while (j < lines.length) {
      for (const ch of lines[j]) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }
      j++;
      if (depth === 0 && j > blockStart + 1) break;
      if (j - blockStart > 1500) break; // safety
    }
    
    results.push(lines.slice(blockStart, j));
    i = j;
  }
  
  return results;
}

// ── PROCESAR CADA MÓDULO ──────────────────────────────────────────────────────
let totalExtracted = 0;
const extractedLineRanges = []; // para luego saber qué quitar de server.js

for (const mod of modules) {
  console.log(`\n📦 Extrayendo ${mod.name}...`);
  
  const blocks = extractModuleRoutes(lines, mod.prefixes);
  console.log(`   ${blocks.length} rutas encontradas`);
  
  if (blocks.length === 0) {
    console.warn(`   ⚠️  Sin rutas para ${mod.name}`);
    continue;
  }
  
  const routerContent = generateRouterFile(mod.name, blocks.map(b => ({ block: b })), mod.prefixes);
  const outPath = path.join(routesDir, `${mod.name}.js`);
  fs.writeFileSync(outPath, routerContent.replace(/\n/g, '\r\n'), 'utf8');
  
  const routerLines = routerContent.split('\n').length;
  console.log(`   ✅ Escrito: routes/${mod.name}.js (${routerLines} líneas)`);
  totalExtracted += blocks.length;
}

console.log(`\n✅ Total rutas extraídas: ${totalExtracted}`);
console.log(`📁 Archivos creados en: telecom-api/routes/`);
console.log(`\nNota: Revisar y limpiar server.js manualmente o con patch script`);

