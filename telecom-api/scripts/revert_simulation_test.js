const pool = require('../db');

async function revert() {
  const connection = await pool.getConnection();
  try {
    console.log("🧹 INICIANDO LIMPIEZA TOTAL DE LA SIMULACIÓN...");

    // 1. Obtener IDs de productos con prefijo [TEST]
    const [testProds] = await connection.query("SELECT id_producto FROM productos WHERE nombre LIKE '[TEST]%' OR codigo LIKE 'TEST-%'");
    const prodIds = testProds.map(p => p.id_producto);

    if (prodIds.length > 0) {
      console.log(`Encontrados ${prodIds.length} productos de prueba: [${prodIds.join(', ')}]`);

      // Eliminar series de técnicos
      await connection.query(`DELETE FROM trabajador_series WHERE id_producto IN (${prodIds.join(',')})`);
      // Eliminar series
      await connection.query(`DELETE FROM producto_series WHERE id_producto IN (${prodIds.join(',')})`);
      // Eliminar stock de técnicos
      await connection.query(`DELETE FROM trabajador_productos WHERE id_producto IN (${prodIds.join(',')})`);
      // Eliminar stock de almacén
      await connection.query(`DELETE FROM stock WHERE id_producto IN (${prodIds.join(',')})`);
      // Eliminar detalles de liquidación
      await connection.query(`DELETE FROM liquidacion_detalles WHERE id_producto IN (${prodIds.join(',')})`);
      // Eliminar productos
      await connection.query(`DELETE FROM productos WHERE id_producto IN (${prodIds.join(',')})`);
    }

    // 2. Eliminar liquidaciones de prueba
    const [delLiqs] = await connection.query("DELETE FROM liquidaciones_tecnicos WHERE motivo LIKE '%Prueba%' OR observaciones LIKE '%Simulación%'");
    console.log(`Eliminadas liquidaciones de prueba. Filas afectadas: ${delLiqs.affectedRows}`);

    console.log("✅ BASE DE DATOS RESTAURADA COMPLETAMENTE A SU ESTADO ORIGINAL.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error en la limpieza:", error);
    process.exit(1);
  } finally {
    connection.release();
  }
}

revert();
