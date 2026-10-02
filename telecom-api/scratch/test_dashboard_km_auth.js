const { signToken } = require('../middleware/requireAuth');

async function testWithToken() {
  const token = signToken({ id_usuario: 1, usuario: 'admin', rol: 'Administrador' });

  const res = await fetch('http://localhost:3000/api/movilidad/dashboard-km', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  console.log('STATUS CON TOKEN:', res.status);
  const data = await res.json();
  if (res.status === 200) {
    console.log('✅ 200 OK RESPUESTA COMPLETA Y FUNCIONANDO');
    console.log('Registros retornados:', data.registros?.length);
    console.log('Resumen general:', data.resumen);
  } else {
    console.log('ERROR:', data);
  }
}

testWithToken().catch(console.error);
