const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const USER_DATA_DIR = path.join(__dirname, 'chrome_looker_profile');
const SESSION_FILE = path.join(__dirname, 'looker_session.json');
const TARGET_URL = 'https://datastudio.google.com/u/0/reporting/15ece5ee-2129-40d6-8122-d83aebc89318/page/p_lfut5i1r5d';

async function setupLoginProfile() {
  console.log('🚀 Abriendo ventana de Chrome para iniciar sesión con liquidacionescorpces@gmail.com...');
  console.log('👉 Inicia sesión con tu cuenta de Google si te lo solicita.');
  console.log('👉 Una vez cargue el reporte de Looker Studio, la sesión quedará guardada de forma permanente.');

  let captured = false;

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    userDataDir: USER_DATA_DIR,
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized', '--disable-notifications']
  });

  const page = await browser.newPage();
  await page.setRequestInterception(true);

  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('batchedDataV2')) {
      const headers = req.headers();
      const cookie = headers['cookie'];
      const xsrf = headers['x-rap-xsrf-token'];

      if (cookie && xsrf && !captured) {
        captured = true;
        const urlObj = new URL(url);
        const appVersion = urlObj.searchParams.get('appVersion') || '20260823_0000';

        const sessionData = {
          appVersion: appVersion,
          url: url,
          x_rap_xsrf_token: xsrf,
          cookie: cookie,
          updated_at: new Date().toISOString()
        };

        fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2));
        console.log('\n======================================================');
        console.log('🎉 ¡SESIÓN DE GOOGLE GUARDADA EXITOSAMENTE EN DISCO!');
        console.log('✅ Tu perfil permanente está listo en:', USER_DATA_DIR);
        console.log('✅ Archivo looker_session.json actualizado.');
        console.log('======================================================\n');
      }
    }
    req.continue();
  });

  await page.goto(TARGET_URL);

  // Esperar a que el usuario termine de iniciar sesión y se capturen los datos
  console.log('⏳ Esperando inicio de sesión y carga del reporte...');
}

setupLoginProfile().catch(console.error);
