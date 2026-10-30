'use strict';
const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
const routes = [];
lines.forEach((line, i) => {
  const m = line.match(/^\s*app\.(get|post|put|delete|patch)\s*\(\s*[\['\`\"]/);
  if (m) {
    const urlMatch = line.match(/['"`\[](\/[^'"`\]]*)/);
    routes.push({ line: i+1, method: m[1].toUpperCase(), url: urlMatch ? urlMatch[1] : '?' });
  }
});
console.log('Total app routes:', routes.length);
routes.forEach(r => console.log(r.line, r.method, r.url));
