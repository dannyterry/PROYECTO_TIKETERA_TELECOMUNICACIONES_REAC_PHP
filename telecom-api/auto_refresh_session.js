const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const USER_DATA_DIR = path.join(__dirname, 'chrome_looker_profile');
const SESSION_FILE = path.join(__dirname, 'looker_session.json');
const TARGET_URL = 'https://datastudio.google.com/u/0/reporting/15ece5ee-2129-40d6-8122-d83aebc89318/page/p_lfut5i1r5d';

/**
 * Abre el navegador en segundo plano (Headless), extrae los tokens frescos de Looker Studio
 * y actualiza looker_session.json automáticamente.
 */
async function autoRefreshLookerSession(headless = true) {
  console.log(`🤖 Iniciando robot de renovación de sesión Looker (Headless: ${headless})...`);

  let captured = null;

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    userDataDir: USER_DATA_DIR,
    headless: headless,
    defaultViewport: { width: 1366, height: 768 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-notifications'
    ]
  });

  try {
    const page = await browser.newPage();

    // Interceptar peticiones de red para capturar los headers de batchedDataV2
    await page.setRequestInterception(true);

    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('batchedDataV2')) {
        const headers = req.headers();
        const cookie = headers['cookie'];
        const xsrf = headers['x-rap-xsrf-token'];

        if (cookie && xsrf && !captured) {
          const urlObj = new URL(url);
          const appVersion = urlObj.searchParams.get('appVersion') || '20260823_0000';

          captured = {
            appVersion: appVersion,
            url: url,
            x_rap_xsrf_token: xsrf,
            cookie: cookie,
            updated_at: new Date().toISOString()
          };

          console.log('🎉 ¡Tokens capturados en tiempo real desde Google Looker Studio!');
        }
      }
      req.continue();
    });

    console.log(`🌐 Navegando a Looker Studio...`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});

    // Esperar unos segundos para que se carguen los gráficos y lance batchedDataV2
    let waited = 0;
    while (!captured && waited < 10000) {
      await new Promise(r => setTimeout(r, 1000));
      waited += 1000;
    }

    if (captured) {
      fs.writeFileSync(SESSION_FILE, JSON.stringify(captured, null, 2));
      console.log('✅ looker_session.json actualizado con éxito.');
      return { success: true, session: captured };
    } else {
      // Verificar si la página está en la pantalla de inicio de sesión de Google
      const currentUrl = page.url();
      if (currentUrl.includes('accounts.google.com') || currentUrl.includes('signin')) {
        console.warn('⚠️ Se requiere iniciar sesión con la cuenta liquidacionescorpces@gmail.com.');
        return { success: false, needLogin: true };
      }
      return { success: false, error: 'No se detectaron peticiones batchedDataV2 en el tiempo esperado.' };
    }
  } catch (err) {
    console.error('❌ Error en autoRefreshLookerSession:', err.message);
    return { success: false, error: err.message };
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  const isHeadless = !process.argv.includes('--visible');
  autoRefreshLookerSession(isHeadless).then((res) => {
    console.log('Resultado:', res);
  });
}

module.exports = {
  autoRefreshLookerSession
};
