const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'telecom-api/server.js');
let content = fs.readFileSync(serverPath, 'utf8').replace(/\r\n/g, '\n');

// Detectar si ya tiene los requires de routers
if (content.includes("require('./routes/almacen')")) {
  console.log('ℹ️  server.js ya tiene los routers montados');
  process.exit(0);
}

// Encontrar dónde insertar los requires de routers
// Los insertamos justo antes de la primera ruta de almacen (app.get('/api/almacen/...'))
const firstAlmacenRoute = content.indexOf("app.get('/api/almacen/");
if (firstAlmacenRoute < 0) {
  console.error('❌ No se encontró la primera ruta de almacen');
  process.exit(1);
}

// Retroceder al inicio de la línea
let insertPoint = firstAlmacenRoute;
while (insertPoint > 0 && content[insertPoint - 1] !== '\n') insertPoint--;

// El bloque de routers a insertar
const routersBlock = `
// ═══════════════════════════════════════════════════════════════════════════════
// 🗂️  ROUTERS MODULARES — Las rutas están organizadas por módulo en /routes/
// ═══════════════════════════════════════════════════════════════════════════════
app.use('/api/almacen',         require('./routes/almacen'));
app.use('/api/movilidad',       require('./routes/movilidad'));
app.use('/api/supervision',     require('./routes/supervision'));
app.use('/api/dashboard',       require('./routes/dashboard'));
app.use('/api/looker',          require('./routes/dashboard'));   // mismo router
app.use('/api/win-audit',       require('./routes/dashboard'));   // mismo router
app.use('/api/empleados',       require('./routes/empleados'));
app.use('/api/roles',           require('./routes/empleados'));   // mismo router
app.use('/api/areas',           require('./routes/empleados'));
app.use('/api/subcontratas',    require('./routes/empleados'));
app.use('/api/permisos',        require('./routes/empleados'));
app.use('/api/cuadrillas',      require('./routes/empleados'));
app.use('/api/configuracion',   require('./routes/configuracion'));
app.use('/api/motivos',         require('./routes/configuracion'));
app.use('/api/tipos-trabajo',   require('./routes/configuracion'));
app.use('/api/asistencias',     require('./routes/asistencias'));
app.use('/api/correos',         require('./routes/correos'));
app.use('/api/pagos',           require('./routes/pagos'));
app.use('/api/inventario',      require('./routes/inventario'));
app.use('/api/auditoria',       require('./routes/auditoria'));
app.use('/api/chat',            require('./routes/auditoria'));   // mismo router

`;

content = content.slice(0, insertPoint) + routersBlock + content.slice(insertPoint);
fs.writeFileSync(serverPath, content.replace(/\n/g, '\r\n'), 'utf8');

const newLineCount = content.split('\n').length;
console.log(`✅ server.js actualizado con routers modulares`);
console.log(`   Líneas ahora: ${newLineCount} (era 18706 — las rutas originales siguen ahí, en paralelo)`);
console.log(`\n📌 NOTA: Las rutas ORIGINALES siguen en server.js pero ahora los routers`);
console.log(`         responden PRIMERO (Express usa el primer match). Esto permite`);
console.log(`         verificar que todo funciona antes de eliminar las rutas originales.`);

