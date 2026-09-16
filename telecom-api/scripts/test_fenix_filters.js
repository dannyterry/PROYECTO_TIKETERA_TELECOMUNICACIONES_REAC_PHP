const { loginWin, cargarGrillaWin, requestWin } = require('../services/fenixScraper');

async function testFenixFilters() {
  console.log("🔐 Iniciando sesión en Fénix...");
  await loginWin();

  // Probar con una fecha histórica conocida, por ejemplo Mayo 2026 o Abril 2026 o Agosto 2026
  const testFecha = "15/05/2026";

  const options = [
    { label: "tipoOrden: 1 (actual)", tipoOrden: 1 },
    { label: "tipoOrden: 0 (todos)", tipoOrden: 0 },
    { label: "tipoOrden: '0'", tipoOrden: "0" },
    { label: "tipoOrden: 2 (posible postventa)", tipoOrden: 2 },
    { label: "tipoProduc: '0'", tipoProduc: "0" }
  ];

  for (const opt of options) {
    console.log(`\n📡 Probando opción: ${opt.label}...`);
    const payload = {
      Empresa: "0",
      IdProyec: "",
      Motivo: "0",
      MotivosReproId: "0",
      Nombre: "",
      NumeDocu: "",
      OrdenId: "",
      Pais: "0",
      conexion: "0",
      cuadrilla: "0",
      estado: "0",
      fechaEstaDesde: "",
      fechaEstaHasta: "",
      fechaSoliDesde: "",
      fechaSoliHasta: "",
      fechaVisiDesde: testFecha,
      fechaVisiHasta: testFecha,
      idPage: 74,
      localidad: "0",
      pagiActu: 1,
      producto: null,
      provincia: "0",
      region: "0",
      suscrip: "",
      tipoOrden: opt.tipoOrden !== undefined ? opt.tipoOrden : 1,
      tipoProduc: "0",
      tipoTraba: "0",
      tipoUbi: "",
      ubi: "",
      zona: "0"
    };

    const res = await requestWin('https://winbo-phx.azurewebsites.net/Paginas/OperadoresBO/misOrdenes.aspx/cargarGrilla', payload, require('../services/fenixScraper').getCookieHeader ? require('../services/fenixScraper').getCookieHeader() : '');
    
    if (res && res.data && res.data.d) {
      try {
        const decoded = JSON.parse(Buffer.from(res.data.d, 'base64').toString('utf-8'));
        const html = Buffer.from(decoded.html, 'base64').toString('utf-8');
        
        // Extraer headers
        const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
        const headers = [];
        let m;
        while ((m = thRegex.exec(html)) !== null) {
          headers.push(m[1].replace(/<[^>]+>/g, '').trim());
        }

        // Extraer filas
        const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let rowCount = 0;
        const sampleRows = [];
        while ((m = trRegex.exec(html)) !== null) {
          const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
          const tds = [];
          let tdm;
          while ((tdm = tdRegex.exec(m[1])) !== null) {
            tds.push(tdm[1].replace(/<[^>]+>/g, '').trim());
          }
          if (tds.length > 5) {
            rowCount++;
            if (sampleRows.length < 3) {
              sampleRows.push(tds);
            }
          }
        }

        console.log(`   ✅ Total filas recibidas: ${rowCount}`);
        console.log(`   📌 Headers (${headers.length}):`, headers.join(' | '));
        if (sampleRows.length > 0) {
          console.log(`   📌 Muestra Fila 1 (${sampleRows[0].length} cols):`, sampleRows[0].join(' | '));
        }
      } catch (err) {
        console.error("   ❌ Error decodificando:", err.message);
      }
    } else {
      console.log("   ❌ Respuesta vacía o error");
    }
  }
}

testFenixFilters().catch(console.error);
