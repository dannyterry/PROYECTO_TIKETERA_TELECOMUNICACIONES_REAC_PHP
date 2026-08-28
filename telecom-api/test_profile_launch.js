const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const REAL_USER_DATA = path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data');
const SESSION_FILE = path.join(__dirname, 'looker_session.json');
const TARGET_URL = 'https://datastudio.google.com/u/0/reporting/15ece5ee-2129-40d6-8122-d83aebc89318/page/p_lfut5i1r5d';

async function testLaunch() {
  console.log('Testing launch with real profile:', REAL_USER_DATA);

  // Copiamos solo si es necesario o lanzamos directo
  let captured = false;

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    userDataDir: REAL_USER_DATA,
    headless: false,
    defaultViewport: null,
    args: [
      '--profile-directory=Default',
      '--disable-notifications'
    ]
  });

  const page = await browser.newPage();
  await page.setRequestInterception(true);

  page.on('request', async (req) => {
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
        console.log('🎉 ¡SESIÓN CAPTURADA AUTOMÁTICAMENTE DE TU CHROME HABITUAL!');
        setTimeout(async () => {
          try { await browser.close(); } catch {}
          process.exit(0);
        }, 2000);
      }
    }
    req.continue();
  });

  await page.goto(TARGET_URL);
}

testLaunch().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
