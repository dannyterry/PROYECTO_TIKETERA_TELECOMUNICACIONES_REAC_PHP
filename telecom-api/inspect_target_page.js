const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('d:/proyecrh/telecom-api/report_raw.json', 'utf8'));

const pages = raw.reportConfig.page || [];
const targetPage = pages.find(p => p.pageId === 'p_lfut5i1r5d');

console.log('Target Page found:', !!targetPage);
if (targetPage) {
  const components = targetPage.page?.componentConfig || [];
  console.log(`Components on page p_lfut5i1r5d: ${components.length}`);
  
  for (const c of components) {
    const cid = c.componentId;
    const type = c.type;
    console.log(`\n🔹 Component: ${cid} | Type: ${type}`);
    
    // Look for data request / datasetSpec / queryFields / table
    const jsonStr = JSON.stringify(c);
    if (jsonStr.includes('DETALLE') || type.includes('table') || jsonStr.includes('queryFields')) {
      console.log('  -> MATCH for Table / Data:');
      console.log(JSON.stringify(c, null, 2));
    }
  }
}
