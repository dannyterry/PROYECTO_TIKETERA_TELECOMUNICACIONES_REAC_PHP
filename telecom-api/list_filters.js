const fs = require('fs');
const rawReport = JSON.parse(fs.readFileSync('d:/proyecrh/telecom-api/report_raw.json', 'utf8'));

const filterEntries = rawReport.reportConfig.report.resource?.filter?.entry || [];
console.log(`Total filter entries in report: ${filterEntries.length}`);

for (const entry of filterEntries) {
  console.log(`- Filter Key: ${entry.key}`);
  console.log(JSON.stringify(entry.value, null, 2));
}
