const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('d:/proyecrh/telecom-api/report_raw.json', 'utf8'));

const config = raw.reportConfig;
console.log('Report Title:', config?.name || config?.title);
console.log('Pages:', config?.pages?.map(p => ({ id: p.id, title: p.title || p.name })));

const components = config?.components || [];
console.log('Total Components:', components.length);

const tables = [];
for (const comp of components) {
  const type = comp.type || comp.displayType || comp.componentType;
  const id = comp.id;
  const name = comp.name || comp.title;
  console.log(`- Comp ID: ${id} | Type: ${type} | Name: ${name}`);
  if (JSON.stringify(comp).toLowerCase().includes('tabla') || JSON.stringify(comp).toLowerCase().includes('table') || JSON.stringify(comp).toLowerCase().includes('detalle')) {
    tables.push(comp);
  }
}

fs.writeFileSync('d:/proyecrh/telecom-api/components_list.json', JSON.stringify(components, null, 2));
console.log(`Saved ${components.length} components to components_list.json`);
