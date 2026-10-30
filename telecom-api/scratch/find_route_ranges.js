'use strict';
/**
 * Master extraction script - reads server.js and identifies exactly which lines
 * belong to each route (from route definition to closing });)
 */
const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');
const content = fs.readFileSync(serverPath, 'utf8');
const rawLines = content.split('\n');

// Remove \r from each line for processing
const lines = rawLines.map(l => l.replace(/\r$/, ''));

console.log('Total lines:', lines.length);

// Find all app.METHOD( lines
const routeStarts = [];
lines.forEach((line, i) => {
  const m = line.match(/^app\.(get|post|put|delete|patch|all)\s*\(/);
  if (m) {
    const urlMatch = line.match(/['"`\[](\/[^'"`\]]*)/);
    routeStarts.push({ 
      lineIdx: i, 
      lineNum: i + 1,
      method: m[1].toUpperCase(),
      url: urlMatch ? urlMatch[1] : '?'
    });
  }
});

console.log('\nFound', routeStarts.length, 'routes');

// For each route, find its end (closing }); at same indent)
function findRouteEnd(startIdx) {
  let depth = 0;
  let started = false;
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === '{' || ch === '(' || ch === '[') { depth++; started = true; }
      if (ch === '}' || ch === ')' || ch === ']') { depth--; }
    }
    if (started && depth === 0) {
      return i;
    }
  }
  return lines.length - 1;
}

// Build route ranges
const routeRanges = routeStarts.map(r => ({
  ...r,
  endIdx: findRouteEnd(r.lineIdx),
}));

// Print summary
routeRanges.forEach(r => {
  console.log(`L${r.lineNum}-L${r.endIdx+1} ${r.method} ${r.url}`);
});
