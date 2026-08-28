const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(__dirname, 'looker_session.json');

let db = null;
try {
  db = require('./db');
} catch (e) {}

/**
 * Obtiene la configuración de cabeceras y URL actualizadas desde la BD o looker_session.json
 */
async function getActiveSession() {
  let session = {
    url: 'https://datastudio.google.com/u/0/batchedDataV2?appVersion=20260823_0000',
    cookie: '',
    x_rap_xsrf_token: ''
  };

  // 1. Intentar leer desde la base de datos (tabla configuracion -> LOOKER_SESSION o TR_AUTH)
  if (db) {
    try {
      const [rows] = await db.query("SELECT valor FROM configuracion WHERE clave = 'LOOKER_SESSION' LIMIT 1");
      if (rows && rows.length > 0 && rows[0].valor && rows[0].valor.trim() !== '') {
        const val = rows[0].valor.trim();
        if (val.startsWith('{')) {
          const parsed = JSON.parse(val);
          if (parsed.cookie) session.cookie = parsed.cookie;
          if (parsed.x_rap_xsrf_token) session.x_rap_xsrf_token = parsed.x_rap_xsrf_token;
          if (parsed.url) session.url = parsed.url;
        } else {
          session.cookie = val;
          // Extraer xsrf token si viene dentro de la cookie
          const match = val.match(/RAP_XSRF_TOKEN=([^;]+)/);
          if (match) session.x_rap_xsrf_token = match[1];
        }
      }
    } catch (dbErr) {
      // Ignorar y seguir a archivo local
    }
  }

  // 2. Si no hay cookie en BD, leer desde looker_session.json
  if (!session.cookie && fs.existsSync(SESSION_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      if (data.cookie) session.cookie = data.cookie;
      if (data.x_rap_xsrf_token) session.x_rap_xsrf_token = data.x_rap_xsrf_token;
      if (data.url) session.url = data.url;
    } catch (e) {}
  }

  return session;
}

// Cabeceras y configuración base para Looker Studio
const LOOKER_CONFIG = {
  reportId: '15ece5ee-2129-40d6-8122-d83aebc89318',
  pageId: 'p_lfut5i1r5d',
  datasourceId: 'c7ce1418-b217-40bf-b71a-feca7098ee4a',
  componentId: 'cd-jfut5i1r5d',
  baseHeaders: {
    "accept": "application/json, text/plain, */*",
    "accept-language": "es-419,es;q=0.9",
    "content-type": "application/json",
    "origin": "https://datastudio.google.com",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Chromium\";v=\"152\", \"Not?A_Brand\";v=\"24\", \"Google Chrome\";v=\"152\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
    "x-browser-channel": "stable",
    "x-browser-copyright": "Copyright 2026 Google LLC. All Rights Reserved.",
    "x-browser-validation": "DD7V8Qhc96Al9nfPAmKmyHrwyTQ=",
    "x-browser-year": "2026",
    "x-client-data": "CKmdygEIlqHLAQiFoM0BCO7flDAIluKUMBi0s88BGKnYlDAYqN6UMBir35Qw",
    "Referer": "https://datastudio.google.com/u/0/reporting/15ece5ee-2129-40d6-8122-d83aebc89318/page/p_lfut5i1r5d"
  }
};

/**
 * Consulta Looker Studio y retorna las órdenes sin procesar
 */
async function fetchLookerOrders(customHeaders = null, retry = true) {
  const session = await getActiveSession();
  const headers = customHeaders || {
    ...LOOKER_CONFIG.baseHeaders,
    "cookie": session.cookie,
    "x-rap-xsrf-token": session.x_rap_xsrf_token
  };
  const targetUrl = session.url || 'https://datastudio.google.com/u/0/batchedDataV2?appVersion=20260823_0000';

  const queryFields = [
    { name: "qt_2d9467as5d", datasetNs: "d0", tableNs: "t0", dataTransformation: { sourceFieldName: "_3355_" } }, // Ticket
    { name: "qt_uejyhabs5d", datasetNs: "d0", tableNs: "t0", dataTransformation: { sourceFieldName: "_353606072_" } }, // Distrito
    { name: "qt_rgjh6qau5d", datasetNs: "d0", tableNs: "t0", dataTransformation: { sourceFieldName: "_n1389458739_" } }, // Dirección
    { name: "qt_f97ye78r5d", datasetNs: "d0", tableNs: "t0", dataTransformation: { sourceFieldName: "_2791368_" } }, // Zona
    { name: "qt_hh7ye78r5d", datasetNs: "d0", tableNs: "t0", dataTransformation: { sourceFieldName: "_n1522618073_" } }, // Franja horaria
    { name: "qt_hzrit9as5d", datasetNs: "d0", tableNs: "t0", dataTransformation: { sourceFieldName: "_2091842744_" } }, // Motivo
    { name: "qt_ybyxfc7t5d", datasetNs: "d0", tableNs: "t0", dataTransformation: { sourceFieldName: "_n350971185_" } }, // Vehículo sugerido / Tipo
    { name: "qt_op6ye78r5d", datasetNs: "d0", tableNs: "t0", dataTransformation: { sourceFieldName: "_82184_" } }, // SLA
    { name: "qt_n5zpfvau5d", datasetNs: "d0", tableNs: "t0", dataTransformation: { sourceFieldName: "_98846_" } } // WN
  ];

  const body = {
    dataRequest: [
      {
        requestContext: {
          reportContext: {
            reportId: LOOKER_CONFIG.reportId,
            pageId: LOOKER_CONFIG.pageId,
            mode: 1,
            componentId: LOOKER_CONFIG.componentId,
            displayType: "simple-table"
          },
          requestMode: 0
        },
        datasetSpec: {
          dataset: [
            {
              datasourceId: LOOKER_CONFIG.datasourceId,
              revisionNumber: 0,
              parameterOverrides: []
            }
          ],
          queryFields: queryFields,
          sortData: [],
          includeRowsCount: false,
          relatedDimensionMask: {
            addDisplay: false,
            addUniqueId: false,
            addLatLong: false
          },
          dsFilterOverrides: [],
          filters: [
            {
              filterDefinition: {
                filterExpression: {
                  include: true,
                  conceptType: 0,
                  concept: { ns: "t0", name: "qt_8526ao2r5d" },
                  filterConditionType: "IN",
                  stringValues: ["REGULARIZAR", "PROGRAMAR"],
                  numberValues: [],
                  queryTimeTransformation: {
                    dataTransformation: { sourceFieldName: "_1438922942_" }
                  }
                }
              },
              dataSubsetNs: { datasetNs: "d0", tableNs: "t0", contextNs: "c0" },
              version: 3
            },
            {
              filterDefinition: {
                filterExpression: {
                  include: true,
                  conceptType: 0,
                  concept: { ns: "t0", name: "qt_k3wtbg595d" },
                  filterConditionType: "IN",
                  stringValues: ["Pendiente"],
                  numberValues: [],
                  queryTimeTransformation: {
                    dataTransformation: { sourceFieldName: "_n1808614382_" }
                  }
                }
              },
              dataSubsetNs: { datasetNs: "d0", tableNs: "t0", contextNs: "c0" },
              version: 3
            }
          ],
          features: [],
          dateRanges: [],
          contextNsCount: 1,
          dateRangeDimensions: [
            {
              name: "qt_zlkze78r5d",
              datasetNs: "d0",
              tableNs: "t0",
              dataTransformation: { sourceFieldName: "_14122113_" }
            }
          ],
          calculatedField: [],
          needGeocoding: false,
          geoFieldMask: [],
          multipleGeocodeFields: [],
          timezone: "America/Lima"
        },
        role: "main",
        retryHints: {
          useClientControlledRetry: true,
          isLastRetry: false,
          retryCount: 0,
          originalRequestId: `${LOOKER_CONFIG.componentId}_0_0`
        }
      }
    ]
  };

  let res = await fetch(targetUrl, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  });

  // Si recibimos 401 o 403 y retry está habilitado, intentar renovar la sesión automáticamente
  if ((res.status === 401 || res.status === 403) && retry) {
    console.warn(`⚠️ Sesión expirada (Status ${res.status}). Intentando auto-renovar con Puppeteer...`);
    try {
      const { autoRefreshLookerSession } = require('./auto_refresh_session');
      const refreshed = await autoRefreshLookerSession(true);
      if (refreshed && refreshed.success) {
        return await fetchLookerOrders(null, false);
      }
    } catch (e) {
      console.error('Error al auto-renovar sesión:', e.message);
    }
  }

  if (!res.ok) {
    throw new Error(`Error en petición a Looker Studio: Status ${res.status}`);
  }

  let text = await res.text();
  if (text.startsWith(")]}'")) text = text.substring(4);
  const data = JSON.parse(text);

  const dataSubset = data.dataResponse?.[0]?.dataSubset?.[0]?.dataset?.tableDataset;
  if (!dataSubset) {
    throw new Error('Respuesta inválida o sin dataset de Looker Studio');
  }

  const colsData = dataSubset.column || [];
  const rowCount = dataSubset.size || colsData[0]?.stringColumn?.values?.length || 0;

  const orders = [];
  for (let r = 0; r < rowCount; r++) {
    orders.push({
      ticket: colsData[0]?.stringColumn?.values[r] || '',
      distrito: colsData[1]?.stringColumn?.values[r] || '',
      direccion: colsData[2]?.stringColumn?.values[r] || '',
      zona_nodo: colsData[3]?.stringColumn?.values[r] || '',
      franja_horaria: colsData[4]?.stringColumn?.values[r] || '',
      motivo: colsData[5]?.stringColumn?.values[r] || '',
      vehiculo_tipo: colsData[6]?.stringColumn?.values[r] || '',
      sla: colsData[7]?.stringColumn?.values[r] || '',
      orden_wn: colsData[8]?.stringColumn?.values[r] || ''
    });
  }

  return orders;
}

/**
 * Agrupa las órdenes en las 3 tarjetas grandes y genera las alertas de Zona Sur
 */
function processCardsAndAlerts(orders) {
  const cards = {
    'AVERIAS PREFERENTE': { total: 0, zonas: {}, ordenes: [] },
    'AVERIAS ALTO VALOR': { total: 0, zonas: {}, ordenes: [] },
    'MOTOWIN ZONAS': { total: 0, zonas: {}, ordenes: [] }
  };

  const alertasSur = [];

  orders.forEach(o => {
    const tipo = (o.vehiculo_tipo || '').toUpperCase().trim();
    let targetCard = 'AVERIAS PREFERENTE';

    if (tipo.includes('ALTO VALOR')) {
      targetCard = 'AVERIAS ALTO VALOR';
    } else if (tipo.includes('MOTOWIN')) {
      targetCard = 'MOTOWIN ZONAS';
    } else if (tipo.includes('AVERIA')) {
      targetCard = 'AVERIAS PREFERENTE';
    }

    const card = cards[targetCard];
    card.total++;
    card.ordenes.push(o);

    const zona = (o.zona_nodo || 'SIN ZONA').trim();
    const esSur = zona.toUpperCase().startsWith('SUR');

    if (!card.zonas[zona]) {
      card.zonas[zona] = {
        zona: zona,
        total: 0,
        esSur: esSur,
        franjas: { '08:00-11:59': 0, '12:00-15:59': 0, '16:00-20:00': 0, 'otros': 0 },
        distritos: {},
        ordenes: []
      };
    }

    const zObj = card.zonas[zona];
    zObj.total++;
    zObj.ordenes.push(o);

    // Franja horaria
    const franja = o.franja_horaria || '';
    if (franja.includes('08:00')) zObj.franjas['08:00-11:59']++;
    else if (franja.includes('12:00')) zObj.franjas['12:00-15:59']++;
    else if (franja.includes('16:00')) zObj.franjas['16:00-20:00']++;
    else zObj.franjas['otros']++;

    // Distritos
    zObj.distritos[o.distrito] = (zObj.distritos[o.distrito] || 0) + 1;

    // ALERTA ZONA SUR
    if (esSur) {
      alertasSur.push({
        alerta: `🚨 NUEVA ORDEN EN ${zona}`,
        tarjeta: targetCard,
        zona: zona,
        distrito: o.distrito,
        ticket: o.ticket,
        orden_wn: o.orden_wn,
        direccion: o.direccion,
        franja_horaria: o.franja_horaria,
        motivo: o.motivo,
        sla: o.sla
      });
    }
  });

  return {
    timestamp: new Date().toISOString(),
    totalGeneral: orders.length,
    totalAlertasSur: alertasSur.length,
    cards: cards,
    alertasSur: alertasSur
  };
}

// Ejecución directa si se invoca por línea de comandos
if (require.main === module) {
  (async () => {
    try {
      console.log('📡 Consultando Looker Studio en tiempo real...');
      const orders = await fetchLookerOrders();
      console.log(`✅ ${orders.length} órdenes recibidas.`);

      const result = processCardsAndAlerts(orders);

      console.log('\n===============================================================');
      console.log('📊 TARJETAS PRINCIPALES (ZONAS Y TOTALES)');
      console.log('===============================================================');

      for (const [cardName, cardData] of Object.entries(result.cards)) {
        console.log(`\n🎴 [${cardName}] ➔ TOTAL: ${cardData.total}`);
        console.log('───────────────────────────────────────────────────────────────');
        if (cardData.total === 0) {
          console.log('  (Sin datos)');
          continue;
        }

        const tableZonas = Object.values(cardData.zonas).map(z => ({
          'Zona': z.esSur ? `🚨 ${z.zona}` : z.zona,
          '08:00-11:59': z.franjas['08:00-11:59'],
          '12:00-15:59': z.franjas['12:00-15:59'],
          '16:00-20:00': z.franjas['16:00-20:00'],
          'Total Zona': z.total,
          'Distritos': Object.entries(z.distritos).map(([d, c]) => `${d} (${c})`).join(', ')
        }));

        console.table(tableZonas);
      }

      console.log('\n===============================================================');
      console.log(`🚨 ALERTAS DE ZONA SUR DETECTADAS (${result.totalAlertasSur} ÓRDENES)`);
      console.log('===============================================================');
      if (result.totalAlertasSur > 0) {
        console.table(result.alertasSur.map(a => ({
          'Alerta': a.alerta,
          'Tarjeta': a.tarjeta,
          'Ticket': a.ticket,
          'Distrito': a.distrito,
          'Dirección': a.direccion,
          'Franja': a.franja_horaria,
          'Motivo': a.motivo
        })));
      } else {
        console.log('✅ No hay órdenes pendientes en Zona Sur.');
      }

      fs.writeFileSync('d:/proyecrh/telecom-api/cards_and_alerts.json', JSON.stringify(result, null, 2));
      console.log('\n💾 Datos guardados en cards_and_alerts.json');
    } catch (err) {
      console.error('❌ Error al procesar:', err.message);
    }
  })();
}

module.exports = {
  LOOKER_CONFIG,
  fetchLookerOrders,
  processCardsAndAlerts
};
