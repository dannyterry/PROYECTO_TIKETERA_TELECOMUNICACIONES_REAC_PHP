const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'telecom-api/routes');

// Routers que necesitan upload
const uploadFixes = [
  {
    file: 'movilidad.js',
    // Necesita uploadInspeccion
    addImport: `const { uploadInspeccion } = require('../middleware/upload');`,
    marker: `const pool = require('../db');`
  },
  {
    file: 'empleados.js',
    // Necesita upload (general)
    addImport: `const { upload } = require('../middleware/upload');`,
    marker: `const pool = require('../db');`
  },
  {
    file: 'almacen.js',
    // Necesita uploadFotoActa
    addImport: `const { uploadFotoActa } = require('../middleware/upload');`,
    marker: `const pool = require('../db');`
  },
];

for (const fix of uploadFixes) {
  const filePath = path.join(routesDir, fix.file);
  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  
  if (!content.includes(fix.addImport)) {
    content = content.replace(fix.marker, fix.marker + '\n' + fix.addImport);
    fs.writeFileSync(filePath, content.replace(/\n/g, '\r\n'), 'utf8');
    console.log(`✅ ${fix.file}: import de upload añadido`);
  } else {
    console.log(`ℹ️  ${fix.file}: ya tiene el import`);
  }
}

// Verificar que los routers no tienen referencias a variables no definidas
console.log('\n📋 Verificando variables no definidas en routers...');
const routerFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
for (const f of routerFiles) {
  const content = fs.readFileSync(path.join(routesDir, f), 'utf8');
  const issues = [];
  
  // Buscar referencias a upload sin definir
  if (content.includes('uploadInspeccion') && !content.includes("require('../middleware/upload')")) {
    issues.push('uploadInspeccion sin importar');
  }
  if (content.includes('uploadFotoActa') && !content.includes("require('../middleware/upload')")) {
    issues.push('uploadFotoActa sin importar');
  }
  if (/\bupload\b/.test(content) && !content.includes("require('../middleware/upload')") && !content.includes('uploadInspeccion') && !content.includes('uploadFotoActa')) {
    // Ignorar si es parte de "upload" en nombres de variables como "uploadDir"
    const uploadMatches = content.match(/[^a-zA-Z]upload[^a-zA-Z(]/g);
    if (uploadMatches && uploadMatches.length > 0) {
      issues.push('upload sin importar (posible)');
    }
  }
  
  if (issues.length > 0) {
    console.log(`⚠️  ${f}: ${issues.join(', ')}`);
  }
}

console.log('\n✅ Fix de imports completado');

