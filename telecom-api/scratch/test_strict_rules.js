const pool = require('../db');
const { obtenerHistorialEstados } = require('../services/fenixScraper');

function parseDateToMySQL(d) {
  if (!d) return null;
  const match = String(d).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})\s*(AM|PM)?/i);
  if (!match) return null;
  let [, m, day, y, h, min, s, ap] = match;
  let hour = parseInt(h, 10);
  if (ap) {
    if (ap.toUpperCase() === 'PM' && hour < 12) hour += 12;
    if (ap.toUpperCase() === 'AM' && hour === 12) hour = 0;
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function extraerTiemposDeHistorialEstricto(historial, techUsers = []) {
  let horaAsignacion = null;
  let horaEnCamino = null;
  let inicioVisita = null;
  let finVisita = null;
  let usuarioEjecutor = null;

  if (!historial || !Array.isArray(historial)) {
    return { horaAsignacion, horaEnCamino, inicioVisita, finVisita, usuarioEjecutor };
  }

  // 1. Extraer hitos de tiempo
  for (const h of historial) {
    const st = (h.estado || '').toUpperCase();
    const parsedDate = parseDateToMySQL(h.fecha);
    if (!parsedDate) continue;

    if (st.includes('CAMINO') && !horaEnCamino) horaEnCamino = parsedDate;
    if ((st.includes('INICIA') || st.includes('PROCESO')) && !inicioVisita) inicioVisita = parsedDate;
    if ((st.includes('FINALIZ') || st.includes('LIQUID') || st.includes('TERMIN')) && !finVisita) finVisita = parsedDate;
    if ((st.includes('ASIGNA') || st.includes('AGENDA')) && !horaAsignacion) horaAsignacion = parsedDate;
  }

  // 2. Extraer usuario ejecutor de campo REAL (ESTRICTAMENTE en estados operativos: En camino, Iniciada, Revisión)
  const filasCampo = historial.filter((h) => {
    const st = (h.estado || '').toUpperCase();
    const u = (h.usuario || '').trim();
    if (!u || /^(administrador|admin|sistema|central)$/i.test(u)) return false;
    return st.includes('CAMINO') || st.includes('INICIA') || st.includes('PROCESO') || st.includes('REVISI');
  });

  if (filasCampo.length > 0) {
    // Verificar si alguna fila de campo pertenece a un técnico de Céspedes (prioridad absoluta al técnico interno)
    const matchInterno = filasCampo.find(h => {
      const u = (h.usuario || '').trim().toUpperCase();
      return techUsers.some(tu => {
        const full1 = `${tu.nombres || ''} ${tu.apellidos || ''}`.toUpperCase().trim();
        const full2 = `${tu.nombres || ''} ${tu.primer_apellido || ''} ${tu.segundo_apellido || ''}`.toUpperCase().trim();
        if (full1 && (u === full1 || u.includes(full1) || full1.includes(u))) return true;
        if (full2 && (u === full2 || u.includes(full2) || full2.includes(u))) return true;
        const nameParts = (tu.nombres || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
        const apeParts = (tu.apellidos || tu.primer_apellido || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
        return nameParts.some(p => u.includes(p)) && apeParts.some(p => u.includes(p));
      });
    });

    if (matchInterno) {
      usuarioEjecutor = matchInterno.usuario.trim();
    } else {
      // Si nadie en las filas de campo es de Céspedes, el técnico ejecutor fue el externo que estuvo en camino/iniciada/revisión
      const opRow = filasCampo.find(h => {
        const st = (h.estado || '').toUpperCase();
        return st.includes('REVISI') || st.includes('INICIA') || st.includes('CAMINO');
      }) || filasCampo[0];
      usuarioEjecutor = opRow.usuario.trim();
    }
  }

  return {
    horaAsignacion,
    horaEnCamino,
    inicioVisita,
    finVisita,
    usuarioEjecutor
  };
}

async function runTest() {
  const [techUsers] = await pool.query(
    "SELECT id_usuario, nombres, apellidos, primer_apellido, segundo_apellido FROM usuarios"
  );

  const testOrders = ['3467354', '3471757', '3467741', '3468586', '3472647'];

  for (const num of testOrders) {
    console.log(`\n==================================================`);
    console.log(`🔍 Probando Orden #${num}...`);
    const historial = await obtenerHistorialEstados(num);
    const tiempos = extraerTiemposDeHistorialEstricto(historial, techUsers);
    console.log(`Tiempos extraídos:`, tiempos);

    if (!tiempos.usuarioEjecutor) {
      console.log(`ℹ️ [Resultado] NO HUBO TRABAJO DE CAMPO -> Se mantiene cuadrilla/técnico original (No es externo)`);
    } else {
      const u = tiempos.usuarioEjecutor.toUpperCase().trim();
      const found = techUsers.find(tu => {
        const full1 = `${tu.nombres || ''} ${tu.apellidos || ''}`.toUpperCase().trim();
        const full2 = `${tu.nombres || ''} ${tu.primer_apellido || ''} ${tu.segundo_apellido || ''}`.toUpperCase().trim();
        if (full1 && (u === full1 || u.includes(full1) || full1.includes(u))) return true;
        if (full2 && (u === full2 || u.includes(full2) || full2.includes(u))) return true;
        const nameParts = (tu.nombres || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
        const apeParts = (tu.apellidos || tu.primer_apellido || '').toUpperCase().split(/\s+/).filter(p => p.length > 2);
        return nameParts.some(p => u.includes(p)) && apeParts.some(p => u.includes(p));
      });

      if (found) {
        console.log(`✅ [Resultado] TÉCNICO INTERNO CÉSPEDES: ID ${found.id_usuario} (${found.nombres} ${found.apellidos || found.primer_apellido || ''})`);
      } else {
        console.log(`🏷️ [Resultado] TÉCNICO EXTERNO REAL: EXTERNO: ${tiempos.usuarioEjecutor}`);
      }
    }
  }

  process.exit(0);
}

runTest();
