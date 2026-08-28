const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('d:/proyecrh/telecom-api/report_raw.json', 'utf8'));

const pages = raw.reportConfig.page || [];
console.log(`Found ${pages.length} pages:`);

for (const p of pages) {
  console.log(`\n📄 Page ID: ${p.id} | Name: ${p.name || p.title}`);
  const components = p.component || [];
  console.log(`  Components: ${components.length}`);
  
  for (const c of components) {
    const cid = c.id;
    const type = c.type;
    const spec = c.datasetSpec;
    const isTable = JSON.stringify(c).toLowerCase().includes('table') || type === 'table' || type === 'TABLE';
    console.log(`   - [${cid}] Type: ${type} | isTable: ${isTable}`);
    
    // Check if this component has queryFields or is the table "DETALLE ADICIONALES LIMA"
    if (JSON.stringify(c).includes('DETALLE') || isTable || c.datasetSpec) {
      console.log(`     DatasetSpec:`, JSON.stringify(c.datasetSpec || {}, null, 2));
    }
  }
}
