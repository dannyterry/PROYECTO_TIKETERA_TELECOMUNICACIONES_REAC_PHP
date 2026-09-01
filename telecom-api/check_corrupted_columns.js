const pool = require('./db.js');

async function main() {
  console.log('--- REVISIÓN DE COLUMNAS CON COORDENADAS O VALORES INCORRECTOS ---');

  // 1. Columnas a revisar
  const columns = [
    'tipo_trabajo',
    'tipo_trabajo_asignado',
    'motivo_trabajo',
    'motivo_finalizacion',
    'motivo_cancelacion',
    'motivo_regestion',
    'motivo_anulacion',
    'datos_tecnicos',
    'tipo_orden',
    'producto'
  ];

  for (const col of columns) {
    try {
      const [rows] = await pool.query(
        `SELECT COUNT(*) as count FROM ordenes WHERE ${col} REGEXP '^-?[0-9]{1,3}\\\\.[0-9]+'`
      );
      console.log(`Columna '${col}' con coordenadas GPS:`, rows[0].count);
    } catch (e) {
      console.log(`Error checking ${col}:`, e.message);
    }
  }

  // 2. Verificar 'Técnica' / 'Tecnica' en motivos
  const [tecReg] = await pool.query(
    `SELECT COUNT(*) as count FROM ordenes WHERE motivo_regestion IN ('Técnica', 'Tecnica', 'Comercial')`
  );
  console.log("motivo_regestion con 'Técnica/Comercial':", tecReg[0].count);

  const [tecLiq] = await pool.query(
    `SELECT COUNT(*) as count FROM ordenes WHERE motivo_finalizacion IN ('Técnica', 'Tecnica', 'Comercial')`
  );
  console.log("motivo_finalizacion con 'Técnica/Comercial':", tecLiq[0].count);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
