const pool = require('../db');

async function testEquiposOnlyLogic() {
  const equiposFilterSql = `
    (
      c.nombre = 'EQUIPOS' 
      OR p.codigo IN ('HWA', 'ZTA', 'HWB', 'ZTB', 'WTA', 'TLA') 
      OR p.nombre LIKE '%ONT%' 
      OR p.nombre LIKE '%MESH%' 
      OR p.nombre LIKE '%SMART%' 
      OR p.nombre LIKE '%TV BOX%' 
      OR p.nombre LIKE '%FONO%' 
      OR p.nombre LIKE '%TELEF%'
    )
    AND p.nombre != 'ACTAS'
    AND p.codigo != 'MAT-ACT'
  `;

  // 1. Total counts for strictly equipments
  const [counts] = await pool.query(`
    SELECT 
      COUNT(*) AS total,
      SUM(CASE WHEN ps.estado = 'DISPONIBLE' THEN 1 ELSE 0 END) AS en_almacen,
      SUM(CASE WHEN ps.estado = 'RESERVADO' THEN 1 ELSE 0 END) AS en_tecnicos,
      SUM(CASE WHEN ps.estado = 'VENDIDO' THEN 1 ELSE 0 END) AS liquidados,
      SUM(CASE WHEN ps.estado = 'BAJA' THEN 1 ELSE 0 END) AS de_baja
    FROM producto_series ps
    JOIN productos p ON ps.id_producto = p.id_producto
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
    WHERE ${equiposFilterSql}
  `);
  console.log('Stats strictly for equipments:', counts[0]);

  // 2. Subtab counts strictly for equipments
  const [subcounts] = await pool.query(`
    SELECT 
      COUNT(*) AS total,
      SUM(CASE WHEN p.nombre LIKE '%ZTE%' AND (p.nombre LIKE '%ONT%' OR ps.proid LIKE '%ONT%' OR ps.proid LIKE '%F6600P%' OR p.codigo = 'ZTA') THEN 1 ELSE 0 END) AS zte_ont,
      SUM(CASE WHEN p.nombre LIKE '%HUAWEI%' AND (p.nombre LIKE '%ONT%' OR ps.proid LIKE '%ONT%' OR ps.proid LIKE '%EG8145%' OR p.codigo = 'HWA') THEN 1 ELSE 0 END) AS huawei_ont,
      SUM(CASE WHEN p.nombre LIKE '%ZTE%' AND (p.nombre LIKE '%MESH%' OR p.nombre LIKE '%SMART%' OR ps.proid LIKE '%MESH%' OR p.codigo = 'ZTB') THEN 1 ELSE 0 END) AS zte_mesh,
      SUM(CASE WHEN p.nombre LIKE '%HUAWEI%' AND (p.nombre LIKE '%MESH%' OR p.nombre LIKE '%SMART%' OR ps.proid LIKE '%MESH%' OR p.codigo = 'HWB') THEN 1 ELSE 0 END) AS huawei_mesh,
      SUM(CASE WHEN p.nombre LIKE '%TV%BOX%' OR p.nombre LIKE '%TV BOX%' OR p.codigo = 'WTA' THEN 1 ELSE 0 END) AS tv_box,
      SUM(CASE WHEN p.nombre LIKE '%TELEF%' OR p.nombre LIKE '%FONO%' OR p.codigo = 'TLA' THEN 1 ELSE 0 END) AS telef
    FROM producto_series ps
    JOIN productos p ON ps.id_producto = p.id_producto
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
    WHERE ${equiposFilterSql}
  `);
  console.log('Subcounts strictly for equipments:', subcounts[0]);

  process.exit(0);
}

testEquiposOnlyLogic().catch(err => {
  console.error(err);
  process.exit(1);
});
