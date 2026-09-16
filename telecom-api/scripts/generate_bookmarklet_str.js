const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'looker_bookmarklet_clean.js'), 'utf8');

// Replace single-line comments only if at start of line or preceded by whitespace, not in strings
const lines = code.split('\n')
  .map(l => l.trim())
  .filter(l => l.length > 0 && !l.startsWith('//'))
  .join(' ');

const bookmarklet = 'javascript:' + encodeURI(lines);

console.log("=== BOOKMARKLET GENERADO (LONGITUD " + bookmarklet.length + " CARACTERES) ===");

fs.writeFileSync(path.join(__dirname, 'bookmarklet_output.txt'), bookmarklet, 'utf8');
