const fs = require('fs');
const path = require('path');

function searchDir(dir, pattern) {
  const results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const item of list) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory() && item !== 'node_modules' && item !== '.git') {
        results.push(...searchDir(fullPath, pattern));
      } else if (stat.isFile() && (item.endsWith('.php') || item.endsWith('.js'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes(pattern)) {
          results.push(fullPath);
        }
      }
    }
  } catch (e) {}
  return results;
}

const found = searchDir('C:/xampp/htdocs/corporacionescepe/app', 'roles_permisos');
console.log('Archivos con roles_permisos en app:', found);

const foundPerm = searchDir('C:/xampp/htdocs/corporacionescepe/app', 'permisos');
console.log('Archivos con permisos en app:', foundPerm);

const foundPublic = searchDir('C:/xampp/htdocs/corporacionescepe/public', 'permisos');
console.log('Archivos con permisos en public:', foundPublic);
