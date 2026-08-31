const fs = require('fs');
const path = require('path');

function scan(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) scan(full);
    else if (f.endsWith('.php')) {
      const txt = fs.readFileSync(full, 'utf8');
      if (txt.includes('dist_react') || txt.includes('id="root"')) {
        console.log('React montado en:', full);
      }
    }
  }
}

scan('C:\\xampp\\htdocs\\corporacionescepe\\app\\views');
