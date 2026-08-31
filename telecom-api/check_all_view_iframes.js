const fs = require('fs');
const path = require('path');

function scanViews(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      scanViews(full);
    } else if (file.endsWith('.php')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('dist_react')) {
        const match = content.match(/src="[^"]*dist_react[^"]*"/);
        console.log(`File: ${full}`);
        console.log(`  -> Iframe: ${match ? match[0] : 'No match'}`);
      }
    }
  }
}

scanViews('C:\\xampp\\htdocs\\corporacionescepe\\app\\views');
