const { signToken } = require('../middleware/requireAuth');

async function testAll() {
  const token = signToken({ id_usuario: 1, usuario: 'admin', id_rol: 1 });

  const res1 = await fetch('http://localhost:3000/api/almacen/stock-general', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Stock-General Status:', res1.status);
  const data1 = await res1.json();
  console.log('-> Productos:', data1.productos?.length);
  console.log('-> StockPorTecnico:', data1.stockPorTecnico?.length);
  console.log('-> SeriesTecnicos:', data1.seriesTecnicos?.length);

  const res2 = await fetch('http://localhost:3000/api/almacen/kardex-movimientos', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Kardex Status:', res2.status);
  const data2 = await res2.json();
  console.log('-> Kardex Movimientos:', data2.movimientos?.length);
  console.log('-> Kardex KPIs:', data2.kpis);
}

testAll().catch(console.error);
