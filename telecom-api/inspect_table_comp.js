const fs = require('fs');

const rawReport = JSON.parse(fs.readFileSync('d:/proyecrh/telecom-api/report_raw.json', 'utf8'));
const targetPage = rawReport.reportConfig.page.find(p => p.pageId === 'p_lfut5i1r5d');
const tableComp = targetPage.page.componentConfig.find(c => c.componentId === 'cd-jfut5i1r5d');

fs.writeFileSync('d:/proyecrh/telecom-api/table_component_full.json', JSON.stringify(tableComp, null, 2));
console.log('Saved cd-jfut5i1r5d to table_component_full.json');

// Check chartConditions or filters on report level
console.log('chartCondition on report:', rawReport.reportConfig.chartCondition);
