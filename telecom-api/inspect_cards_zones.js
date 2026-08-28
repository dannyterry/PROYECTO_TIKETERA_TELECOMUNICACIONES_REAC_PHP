const fs = require('fs');
const orders = JSON.parse(fs.readFileSync('d:/proyecrh/telecom-api/looker_orders_parsed.json', 'utf8'));

console.log('Total de órdenes extraídas:', orders.length);

const grouped = {
  'AVERIAS PREFERENTE': [],
  'AVERIAS ALTO VALOR': [],
  'MOTOWIN ZONAS': [],
  'OTROS': []
};

orders.forEach(o => {
  const type = (o.vehiculo_tipo || '').toUpperCase().trim();
  if (type.includes('ALTO VALOR')) {
    grouped['AVERIAS ALTO VALOR'].push(o);
  } else if (type.includes('MOTOWIN')) {
    grouped['MOTOWIN ZONAS'].push(o);
  } else if (type.includes('AVERIA')) {
    grouped['AVERIAS PREFERENTE'].push(o);
  } else {
    grouped['OTROS'].push(o);
  }
});

const summary = {};
const alertasSur = [];

for (const [cat, list] of Object.entries(grouped)) {
  const byZona = {};
  list.forEach(o => {
    const z = (o.zona_nodo || 'SIN ZONA').trim();
    if (!byZona[z]) {
      byZona[z] = {
        total: 0,
        esSur: z.toUpperCase().startsWith('SUR'),
        distritos: {},
        franjas: {},
        ordenes: []
      };
    }
    byZona[z].total++;
    byZona[z].distritos[o.distrito] = (byZona[z].distritos[o.distrito] || 0) + 1;
    byZona[z].franjas[o.franja_horaria] = (byZona[z].franjas[o.franja_horaria] || 0) + 1;
    byZona[z].ordenes.push(o);

    if (byZona[z].esSur) {
      alertasSur.push({
        categoria: cat,
        zona: z,
        distrito: o.distrito,
        ticket: o.ticket,
        direccion: o.direccion,
        franja: o.franja_horaria,
        motivo: o.motivo,
        sla: o.sla
      });
    }
  });

  summary[cat] = {
    total: list.length,
    zonas: byZona
  };
}

console.log('\n======================================================');
console.log('📌 RESUMEN DE LAS 3 TARJETAS GRANDES Y SUS ZONAS:');
console.log('======================================================');

for (const [cat, data] of Object.entries(summary)) {
  console.log(`\n🏷️ ${cat} (TOTAL: ${data.total})`);
  console.log('------------------------------------------------------');
  if (data.total === 0) {
    console.log('  (Sin datos)');
    continue;
  }
  for (const [zona, zData] of Object.entries(data.zonas)) {
    const prefix = zData.esSur ? '🚨 [ZONA SUR]' : '📍';
    console.log(`  ${prefix} Zona: ${zona.padEnd(10)} | Total: ${zData.total} | Franjas: ${JSON.stringify(zData.franjas)} | Distritos: ${JSON.stringify(zData.distritos)}`);
  }
}

console.log('\n======================================================');
console.log(`🚨 ALERTAS DE ZONA SUR DETECTADAS (${alertasSur.length} ÓRDENES):`);
console.log('======================================================');
console.table(alertasSur);

fs.writeFileSync('d:/proyecrh/telecom-api/looker_cards_summary.json', JSON.stringify({ summary, alertasSur }, null, 2));
