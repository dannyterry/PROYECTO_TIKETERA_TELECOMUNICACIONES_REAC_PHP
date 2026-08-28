const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('d:/proyecrh/telecom-api/report_raw.json', 'utf8'));

console.log('Top keys in raw:', Object.keys(raw));
console.log('Keys in reportConfig:', Object.keys(raw.reportConfig || {}));

if (raw.reportConfig?.pages) {
  console.log('pages:', raw.reportConfig.pages);
} else {
  // Search for pageId 'p_lfut5i1r5d' or 'DETALLE'
  const str = JSON.stringify(raw);
  console.log('Contains p_lfut5i1r5d?', str.includes('p_lfut5i1r5d'));
  console.log('Contains DETALLE?', str.includes('DETALLE'));
  console.log('Contains c7ce1418?', str.includes('c7ce1418'));
  
  // Print some keys
  for (const k of Object.keys(raw.reportConfig || {})) {
    console.log(`- ${k}: type=${typeof raw.reportConfig[k]} isArray=${Array.isArray(raw.reportConfig[k])}`);
  }
}
