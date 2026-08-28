const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('d:/proyecrh/telecom-api/table_data_result.json', 'utf8'));

const dataSubset = raw.dataResponse[0]?.dataSubset[0]?.dataset?.tableDataset;
if (!dataSubset) {
  console.log('No dataSubset found');
  process.exit(0);
}

const colsInfo = dataSubset.columnInfo || [];
const colsData = dataSubset.column || [];
const rowCount = dataSubset.size || colsData[0]?.stringColumn?.values?.length || 0;

console.log(`\n🎉 EXTRAÍDOS EXITOSAMENTE ${rowCount} REGISTROS DE GOOGLE LOOKER STUDIO!\n`);

const rows = [];
for (let r = 0; r < rowCount; r++) {
  const row = {
    ticket: colsData[0]?.stringColumn?.values[r] || '',
    distrito: colsData[1]?.stringColumn?.values[r] || '',
    direccion: colsData[2]?.stringColumn?.values[r] || '',
    zona_nodo: colsData[3]?.stringColumn?.values[r] || '',
    franja_horaria: colsData[4]?.stringColumn?.values[r] || '',
    motivo: colsData[5]?.stringColumn?.values[r] || '',
    vehiculo_tipo: colsData[6]?.stringColumn?.values[r] || '',
    sla: colsData[7]?.stringColumn?.values[r] || '',
    orden_wn: colsData[8]?.stringColumn?.values[r] || ''
  };
  rows.push(row);
}

console.table(rows);
fs.writeFileSync('d:/proyecrh/telecom-api/looker_orders_parsed.json', JSON.stringify(rows, null, 2));
