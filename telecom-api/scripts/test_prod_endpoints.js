async function testProd() {
  const urls = [
    'https://corporacioncespedes.com/',
    'https://api.corporacioncespedes.com/',
    'https://api.corporacioncespedes.com/api/motivos',
    'https://api.corporacioncespedes.com/api/settings/sistema'
  ];

  for (const u of urls) {
    try {
      console.log(`📡 Probando: ${u}...`);
      const res = await fetch(u, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(10000)
      });
      console.log(`   Status: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.log(`   Body preview (primero 120 chars): ${text.substring(0, 120)}...\n`);
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}\n`);
    }
  }
}

testProd();
