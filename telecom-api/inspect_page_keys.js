const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('d:/proyecrh/telecom-api/report_raw.json', 'utf8'));

const pages = raw.reportConfig.page || [];
console.log('Page 0 keys:', Object.keys(pages[0] || {}));
console.log('Sample page:', JSON.stringify(pages[0], null, 2).substring(0, 500));
