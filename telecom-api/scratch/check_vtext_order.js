const mysql = require('mysql2/promise');
const { loginWin, obtenerHistorialEstados, cargarGrillaWin, parsearHtmlFenix } = require('../services/fenixScraper');

async function checkOrder() {
  const code = 'VTEXT-48684674';
  const ticket = '3521137';

  console.log(`🔍 Consultando orden ${code} (Ticket ${ticket})...`);

  // 1. Consultar BD Local
  try {
    const localPool = mysql.createPool({ host: '127.0.0.1', user: 'root', password: '', database: 'corporacioncespe_cespedes' });
    const [localRows] = await localPool.query("SELECT * FROM ordenes WHERE codigo_seguimiento = ? OR numero = ? OR cod_seguimiento_cliente = ?", [code, ticket, code]);
    console.log('\n--- BD LOCAL ---');
    if (localRows.length > 0) {
      const o = localRows[0];
      console.log({
        numero: o.numero,
        cliente: o.cliente,
        estado: o.estado,
        fecha_visita: o.fecha_visita,
        hora_en_camino: o.hora_en_camino,
        inicio_visita: o.inicio_visita,
        fin_visita: o.fin_visita,
        cuadrilla: o.cuadrilla,
        tecnico_asignado: o.tecnico_asignado,
        motivo_regestion: o.motivo_regestion,
        motivo_cancelacion: o.motivo_cancelacion,
        motivo_finalizacion: o.motivo_finalizacion
      });
    } else {
      console.log('No encontrada en BD Local');
    }
    localPool.end();
  } catch (e) {
    console.error('Error Local:', e.message);
  }

  // 2. Consultar BD Producción
  try {
    const prodPool = mysql.createPool({ host: 'corporacioncespedes.com', user: 'corporacioncespe_miguel', password: 'corporacioncespe_123', database: 'corporacioncespe_cespedes' });
    const [prodRows] = await prodPool.query("SELECT * FROM ordenes WHERE codigo_seguimiento = ? OR numero = ? OR cod_seguimiento_cliente = ?", [code, ticket, code]);
    console.log('\n--- BD PRODUCCIÓN ---');
    if (prodRows.length > 0) {
      const o = prodRows[0];
      console.log({
        numero: o.numero,
        cliente: o.cliente,
        estado: o.estado,
        fecha_visita: o.fecha_visita,
        hora_en_camino: o.hora_en_camino,
        inicio_visita: o.inicio_visita,
        fin_visita: o.fin_visita,
        cuadrilla: o.cuadrilla,
        tecnico_asignado: o.tecnico_asignado,
        motivo_regestion: o.motivo_regestion,
        motivo_cancelacion: o.motivo_cancelacion,
        motivo_finalizacion: o.motivo_finalizacion
      });
    } else {
      console.log('No encontrada en BD Producción');
    }
    prodPool.end();
  } catch (e) {
    console.error('Error Producción:', e.message);
  }

  // 3. Consultar Fénix en vivo
  try {
    console.log('\n--- FÉNIX EN VIVO ---');
    await loginWin();
    const hist = await obtenerHistorialEstados(ticket);
    console.log(`Historial de Estados en Fénix (${hist?.length || 0} eventos):`);
    console.table(hist);

    // Consultar grilla de Fénix
    const resVisi = await cargarGrillaWin(1, '14/10/2026', '14/10/2026', 'VISI');
    if (resVisi && resVisi.d) {
      const decoded = Buffer.from(resVisi.d, 'base64').toString('utf-8');
      const json = JSON.parse(decoded);
      if (json.html) {
        const html = Buffer.from(json.html, 'base64').toString('utf-8');
        const ordenes = parsearHtmlFenix(html);
        const fenixOrder = ordenes.find(x => x.numero === ticket || x.codigo_seguimiento === code);
        console.log('En Grilla VISI Fénix:', fenixOrder ? {
          numero: fenixOrder.numero,
          cliente: fenixOrder.cliente,
          estado: fenixOrder.estado,
          cuadrilla: fenixOrder.cuadrilla,
          fechaVisita: fenixOrder.fecha_visita,
          inicioVisita: fenixOrder.inicio_visita,
          finVisita: fenixOrder.fin_visita,
          motivoRegestion: fenixOrder.motivo_regestion,
          motivoCancelacion: fenixOrder.motivo_cancelacion
        } : 'No en página 1 de VISI');
      }
    }
  } catch (e) {
    console.error('Error Fénix:', e.message);
  }

  process.exit(0);
}

checkOrder();
