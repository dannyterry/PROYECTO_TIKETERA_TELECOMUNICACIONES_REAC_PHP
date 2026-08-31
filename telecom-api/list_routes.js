const fs = require('fs');

const content = fs.readFileSync('d:/proyecrh/telecom-api/server.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('app.get') || line.includes('app.post') || line.includes('app.put') || line.includes('app.delete') || line.includes('app.patch')) {
    console.log(`L${idx + 1}: ${line.trim()}`);
  }
});
