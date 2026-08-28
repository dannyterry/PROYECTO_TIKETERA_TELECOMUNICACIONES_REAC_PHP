const fs = require('fs');
const rawReport = JSON.parse(fs.readFileSync('d:/proyecrh/telecom-api/report_raw.json', 'utf8'));

// Search for filters in reportConfig
function findFilters(obj, path = '') {
  if (!obj || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase().includes('filter') || k.includes('5qiqso2r5d') || k.includes('igdegr7r5d')) {
      console.log(`Found filter at ${path}.${k}:`, JSON.stringify(obj[k], null, 2).substring(0, 500));
    }
    findFilters(obj[k], `${path}.${k}`);
  }
}

findFilters(rawReport);
