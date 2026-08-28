const pool = require('../db');

const rawData = [
  { doc: '004406401', pat: 'AGUIN', mat: 'MONTOYA', nom: 'YOFRE DAVID', fnac: '17/05/1987', fing: '14/07/2025', sex: 'M' },
  { doc: '10652977', pat: 'JUAREZ', mat: 'CARAZAS', nom: 'ALDO ANTONIO', fnac: '09/02/1955', fing: '15/08/2025', sex: 'M' },
  { doc: '45432639', pat: 'VILLAVERDE', mat: 'PUCHURI', nom: 'EVER TELESFORO', fnac: '11/08/1988', fing: '03/12/2025', sex: 'M' },
  { doc: '41832708', pat: 'PUCHURE', mat: 'VILLAVERDE', nom: 'ROBERTO', fnac: '11/02/1983', fing: '03/12/2025', sex: 'M' },
  { doc: '72526231', pat: 'CAPCHA', mat: 'RIOS', nom: 'PAUL ALBERTO', fnac: '29/09/1999', fing: '05/01/2026', sex: 'M' },
  { doc: '007398233', pat: 'CANELON', mat: 'GONZALES', nom: 'BRAYAN JESUS', fnac: '30/07/2006', fing: '05/01/2026', sex: 'M' },
  { doc: '09024951', pat: 'RIOS', mat: 'LOZANO', nom: 'WILMER', fnac: '02/09/1976', fing: '24/02/2026', sex: 'M' },
  { doc: '47813232', pat: 'SANTIAGO', mat: 'DE LA CRUZ', nom: 'YOMAR', fnac: '10/04/1992', fing: '17/03/2026', sex: 'M' },
  { doc: '62816169', pat: 'YUIMACHI', mat: 'AREVALO', nom: 'JOSUE', fnac: '17/03/2005', fing: '01/04/2026', sex: 'M' },
  { doc: '61119682', pat: 'PADILLA', mat: 'YUIMACHI', nom: 'MAXIMO EDBAR', fnac: '30/09/2007', fing: '08/04/2026', sex: 'M' },
  { doc: '73447568', pat: 'YUIMACHI', mat: 'AREVALO', nom: 'MARCOS WILDER', fnac: '04/04/1999', fing: '22/05/2026', sex: 'M' },
  { doc: '41146758', pat: 'ALVARO', mat: 'ALARCON', nom: 'RICKY', fnac: '04/09/1981', fing: '22/07/2026', sex: 'M' },
  { doc: '42399794', pat: 'KARR', mat: 'CARREON', nom: 'JUAN JOSE', fnac: '23/05/1984', fing: '11/06/2026', sex: 'M' },
  { doc: '75002824', pat: 'BUSTILLOS', mat: 'HUALLPATUERO', nom: 'ELIAS', fnac: '31/01/2003', fing: '03/08/2026', sex: 'M' },
  { doc: '71259373', pat: 'GRADOS', mat: 'CACERES', nom: 'ALBERTO', fnac: '13/12/1991', fing: '20/06/2026', sex: 'M' },
  { doc: '73508896', pat: 'DIAZ', mat: 'CACERES', nom: 'CHRISTIAN MAGNO', fnac: '28/09/1992', fing: '20/06/2026', sex: 'M' },
  { doc: '48602056', pat: 'MARRUFO', mat: 'AGUILAR', nom: 'CARLOS EDUARDO', fnac: '26/04/1989', fing: '08/07/2026', sex: 'M' },
  { doc: '45170638', pat: 'LAGUNA', mat: 'SOTO', nom: 'JOSIMAR EDU', fnac: '03/04/1987', fing: '08/07/2026', sex: 'M' },
  { doc: '46184046', pat: 'PAREDES', mat: 'CAMPOS', nom: 'FERNANDO RAFAEL', fnac: '03/12/1989', fing: '20/03/2026', sex: 'M' },
  { doc: '45788817', pat: 'MENDOZA', mat: 'RIOS', nom: 'RAUL ANTONIO', fnac: '24/01/1989', fing: '05/08/2026', sex: 'M' },
  { doc: '27638593', pat: 'PEÑA', mat: 'GOMEZ', nom: 'KLEIBER NARCISO', fnac: '15/01/2001', fing: '06/08/2026', sex: 'M' },
  { doc: '74018355', pat: 'ZAVALA', mat: 'LAGUNA', nom: 'JOSEPMIR JOSHUA', fnac: '01/10/2007', fing: '08/08/2026', sex: 'M' },
  { doc: '46335626', pat: 'CESPEDES', mat: 'CHOQUE', nom: 'STUWART SHMIT', fnac: '22/05/1990', fing: '01/02/2026', sex: 'M' },
  { doc: '40124083', pat: 'CESPEDES', mat: 'CHOQUE', nom: 'MIGUEL MARTIN', fnac: '02/03/1979', fing: '01/10/2022', sex: 'M' },
  { doc: '00977775', pat: 'FLORES', mat: 'GUIZABALDO', nom: 'EDMUNDO', fnac: '27/06/1969', fing: '01/06/2022', sex: 'M' },
  { doc: '10092639', pat: 'PANIURA', mat: 'RAMIREZ', nom: 'KLINDER WALTER', fnac: '21/06/1975', fing: '19/12/2024', sex: 'M' },
  { doc: '71275373', pat: 'PANIURA', mat: 'RAMOS', nom: 'JOSUE KLINDER', fnac: '21/08/2003', fing: '19/12/2024', sex: 'M' },
  { doc: '45938014', pat: 'CARHUAZ', mat: 'FLORES', nom: 'WIL NELSON', fnac: '12/09/1988', fing: '08/04/2024', sex: 'M' },
  { doc: '72713188', pat: 'REYES', mat: 'ZUÑE', nom: 'BRIYITT WENDY', fnac: '20/01/1996', fing: '05/12/2024', sex: 'F' },
  { doc: '005324621', pat: 'PIÑERO', mat: 'OCHOA', nom: 'OSCAR', fnac: '15/11/1990', fing: '03/12/2024', sex: 'M' },
  { doc: '42500459', pat: 'MAR', mat: 'ALVARADO', nom: 'SANDY EFRAIN', fnac: '20/05/1983', fing: '04/04/2025', sex: 'M' },
  { doc: '40235377', pat: 'VELA', mat: 'PARRA', nom: 'MARCO ANTONIO', fnac: '23/03/1975', fing: '24/06/2026', sex: 'M' },
  { doc: '10126744', pat: 'VARA', mat: 'ARANGO', nom: 'DELIA SOLEDAD', fnac: '02/01/1977', fing: '24/06/2026', sex: 'F' },
  { doc: '10080735', pat: 'MEJIA', mat: 'MACHICA', nom: 'OSCAR GUILLERMO', fnac: '10/04/1974', fing: '15/07/2026', sex: 'M' },
  { doc: '72392409', pat: 'ILIZARBE', mat: 'BERROCAL', nom: 'SAITH ABRAHAM', fnac: '09/01/2003', fing: '04/08/2026', sex: 'M' },
  { doc: '007629775', pat: 'VILLALBA', mat: 'LUGO', nom: 'EDIXON RAFAEL', fnac: '05/02/1993', fing: '04/08/2026', sex: 'M' },
  { doc: '008248986', pat: 'QUINTERO', mat: 'FLORES', nom: 'MANUEL ALEJANDRO', fnac: '28/12/1997', fing: '22/04/2026', sex: 'M' },
  { doc: '003899391', pat: 'DAZA', mat: 'QUERALES', nom: 'SAMANTHA ESTHER', fnac: '16/10/1997', fing: '22/04/2026', sex: 'F' },
  { doc: '61074970', pat: 'CATASHUNGA', mat: 'ISUIZA', nom: 'JONATHAN ANGEL', fnac: '25/11/2001', fing: '26/08/2025', sex: 'M' },
  { doc: '63104715', pat: 'LOPEZ', mat: 'AREVALO', nom: 'JORGE LUIS', fnac: '15/01/2003', fing: '31/03/2026', sex: 'M' },
  { doc: '007513604', pat: 'RIVERA', mat: 'FIGUEROA', nom: 'BERNARDO ANDRES', fnac: '21/06/1990', fing: '15/04/2026', sex: 'M' },
  { doc: '48332696', pat: 'MELENDEZ', mat: 'MADUEÑO', nom: 'JOSUE JESUS', fnac: '08/06/1992', fing: '31/03/2026', sex: 'M' }
];

function parseDate(dStr) {
  if (!dStr) return null;
  const parts = dStr.trim().split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return null;
}

async function run() {
  const [allUsers] = await pool.query('SELECT * FROM usuarios');
  const usedUserIds = new Set();
  let updatedCount = 0;
  let insertedCount = 0;

  for (const item of rawData) {
    const docClean = item.doc.trim();
    const patClean = item.pat.trim().toUpperCase();
    const matClean = item.mat.trim().toUpperCase();
    const nomClean = item.nom.trim().toUpperCase();
    const apellidos = `${patClean} ${matClean}`.trim();
    const fechaNac = parseDate(item.fnac);
    const fechaIng = parseDate(item.fing);
    const sexo = (item.sex || 'M').toUpperCase().trim();

    // 1. Buscar coincidencia exacta por DNI primero
    let match = allUsers.find(u => !usedUserIds.has(u.id_usuario) && (u.documento || '').trim() === docClean);
    
    // 2. Si no hay por DNI, buscar por apellidos y nombres
    if (!match) {
      match = allUsers.find(u => {
        if (usedUserIds.has(u.id_usuario)) return false;
        const uNom = (u.nombres || '').toUpperCase().trim();
        const uPat = (u.primer_apellido || '').toUpperCase().trim();
        const uMat = (u.segundo_apellido || '').toUpperCase().trim();
        const uApe = (u.apellidos || '').toUpperCase().trim();

        if (uPat === patClean || uApe.includes(patClean)) {
          if (uNom === nomClean) return true;
          const firstNom = nomClean.split(' ')[0];
          if (firstNom && uNom.includes(firstNom)) {
            if (uMat && matClean && (uMat === matClean || uApe.includes(matClean))) return true;
            if (!uMat && uNom.includes(firstNom)) return true;
          }
        }
        return false;
      });
    }

    if (match) {
      usedUserIds.add(match.id_usuario);
      await pool.query(`
        UPDATE usuarios 
        SET documento = ?,
            primer_apellido = ?,
            segundo_apellido = ?,
            apellidos = ?,
            nombres = ?,
            fecha_nacimiento = ?,
            fecha_ingreso = ?,
            sexo = ?,
            id_rol = COALESCE(NULLIF(id_rol, 0), 2)
        WHERE id_usuario = ?
      `, [docClean, patClean, matClean, apellidos, nomClean, fechaNac, fechaIng, sexo, match.id_usuario]);

      // Asegurar registro en trabajadores
      const [tExists] = await pool.query('SELECT id_trabajador FROM trabajadores WHERE id_usuario = ?', [match.id_usuario]);
      if (tExists.length === 0) {
        await pool.query(`
          INSERT INTO trabajadores (id_usuario, id_horario, fecha_ingreso, estado)
          VALUES (?, 1, ?, 'Activo')
        `, [match.id_usuario, fechaIng || '2026-08-01']);
      } else {
        await pool.query('UPDATE trabajadores SET fecha_ingreso = COALESCE(?, fecha_ingreso) WHERE id_usuario = ?', [fechaIng, match.id_usuario]);
      }

      console.log(`✅ ACTUALIZADO: ID ${match.id_usuario} - ${nomClean} ${apellidos} (DNI: ${docClean}, Nac: ${fechaNac}, Ing: ${fechaIng}, Sexo: ${sexo})`);
      updatedCount++;
    } else {
      // Insertar nuevo técnico
      const username = (nomClean.charAt(0) + patClean).toLowerCase().replace(/[^a-z0-9]/g, '') + Math.floor(100 + Math.random() * 900);
      const password = Math.random().toString(36).slice(-8);

      const [resIns] = await pool.query(`
        INSERT INTO usuarios (
          id_rol, tipo_documento, documento, nombres, primer_apellido, segundo_apellido, apellidos,
          email, usuario, password, estado, fecha_ingreso, fecha_nacimiento, sexo, opcion_personal, area
        ) VALUES (
          2, 'DNI', ?, ?, ?, ?, ?,
          ?, ?, ?, 'Activo', ?, ?, ?, 'directo', 'Operaciones'
        )
      `, [
        docClean, nomClean, patClean, matClean, apellidos,
        `${username}@gmail.com`, username, password, fechaIng, fechaNac, sexo
      ]);

      const newUserId = resIns.insertId;
      usedUserIds.add(newUserId);

      await pool.query(`
        INSERT INTO trabajadores (id_usuario, id_horario, fecha_ingreso, estado)
        VALUES (?, 1, ?, 'Activo')
      `, [newUserId, fechaIng || '2026-08-01']);

      console.log(`🆕 INSERTADO: ID ${newUserId} - ${nomClean} ${apellidos} (DNI: ${docClean}, User: ${username})`);
      insertedCount++;
    }
  }

  console.log('\n=============================================');
  console.log(`RESUMEN: ${updatedCount} técnicos actualizados, ${insertedCount} técnicos nuevos creados.`);
  console.log('=============================================');
  process.exit();
}

run();
