const fs = require('fs');

function scan(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = dir + '/' + f;
    if (fs.statSync(full).isDirectory()) scan(full);
    else if (f.endsWith('.php')) {
      const t = fs.readFileSync(full, 'utf8');
      if (t.includes('date_default_timezone_set')) {
        console.log('Timezone en:', full);
      }
    }
  }
}

scan('C:/xampp/htdocs/corporacionescepe/app');
