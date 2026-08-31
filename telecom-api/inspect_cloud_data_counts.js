const fs = require('fs');
const readline = require('readline');

async function inspectData() {
  const fileStream = fs.createReadStream('d:/proyecrh/base_de_nube_28_08_2026.sql');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const tableRows = {};
  let currentTable = null;

  for await (const line of rl) {
    if (line.startsWith('INSERT INTO `')) {
      const match = line.match(/INSERT INTO `([^`]+)`/);
      if (match) {
        currentTable = match[1];
        tableRows[currentTable] = (tableRows[currentTable] || 0) + 1;
      }
    }
  }

  console.log('Tablas con datos en base_de_nube_28_08_2026.sql:');
  console.table(tableRows);
}

inspectData();
