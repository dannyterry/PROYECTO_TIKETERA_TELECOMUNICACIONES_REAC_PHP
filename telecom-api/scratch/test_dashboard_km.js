async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/movilidad/dashboard-km');
    console.log('STATUS:', res.status);
    if (res.status === 200) {
      const data = await res.json();
      console.log('✅ RESPUESTA EXITOSA 200 OK');
      console.log('Keys:', Object.keys(data));
      console.log('Resumen:', data.resumen);
    } else {
      const text = await res.text();
      console.log('ERROR BODY:', text);
    }
  } catch (err) {
    console.log('Fetch error (server might be restarting):', err.message);
  }
}

test();
