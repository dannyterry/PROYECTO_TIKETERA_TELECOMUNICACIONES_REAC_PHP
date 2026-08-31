const fs = require('fs');
const readline = require('readline');

async function inspectCloudSql() {
  const fileStream = fs.createReadStream('d:/proyecrh/base_de_nube_28_08_2026.sql');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let insertCount = 0;
  let tables = [];

  for await (const line of rl) {
    if (line.startsWith('CREATE TABLE')) {
      const match = line.match(/`([^`]+)`/);
      if (match) tables.push(match[1]);
    }
    if (line.startsWith('INSERT INTO `ordenes`')) {
      insertCount++;
    }
  }

  console.log('Tablas en el SQL de la nube:', tables.length, tables);
  console.log('Inserts de ordenes en el SQL de la nube:', insertCount);
}

inspectCloudSql();
