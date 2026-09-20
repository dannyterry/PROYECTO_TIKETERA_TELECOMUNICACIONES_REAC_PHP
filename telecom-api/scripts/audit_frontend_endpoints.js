const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', '..', 'mi-proyecto', 'src');
const serverCode = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

const endpoints = new Set();

function walk(d) {
  for (const item of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, item.name);
    if (item.isDirectory()) walk(p);
    else if (/\.(tsx|ts|js|jsx)$/.test(item.name)) {
      const code = fs.readFileSync(p, 'utf8');
      
      // Buscar llamadas con API_URL
      const r1 = /API_URL\s*(\+|`)\s*(\/api\/[a-zA-Z0-9_\-\/]+)/g;
      let m;
      while ((m = r1.exec(code)) !== null) {
        endpoints.add(m[2]);
      }

      // Buscar llamadas a axios.get('/api/...') o fetch('/api/...')
      const r2 = /(?:axios|fetch)\s*\.\s*(?:get|post|put|delete|patch)\s*\(\s*[`'"](\/api\/[a-zA-Z0-9_\-\/]+)/g;
      while ((m = r2.exec(code)) !== null) {
        endpoints.add(m[1]);
      }

      // Buscar template literals con ${API_URL}/api/...
      const r3 = /\${API_URL}(\/api\/[a-zA-Z0-9_\-\/]+)/g;
      while ((m = r3.exec(code)) !== null) {
        endpoints.add(m[1]);
      }
    }
  }
}

walk(srcDir);

console.log('====================================================');
console.log(`🌐 Total de endpoints detectados en Frontend: ${endpoints.size}`);
console.log('====================================================');

const missing = [];
for (const ep of Array.from(endpoints).sort()) {
  const cleanEp = ep.split('?')[0];
  if (!serverCode.includes(cleanEp) && !serverCode.includes(cleanEp.replace('/api', ''))) {
    missing.push(cleanEp);
  }
}

if (missing.length === 0) {
  console.log('🎉 ¡TODOS LOS ENLACES/RUTAS DEL FRONTEND EXISTEN EN EL BACKEND!');
} else {
  console.log('⚠️ Rutas posiblemente faltantes en el API:', missing);
}
