async function testApiCreateProduct() {
  try {
    const res = await fetch('http://localhost:3000/api/almacen/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'ONT HUAWEI EG8145V5 DUAL BAND WIFI 6',
        categoria: 'EQUIPOS',
        stock_minimo: 5,
        maneja_serie: true,
        precio_compra: 135
      })
    });

    const data = await res.json();
    console.log("✅ Producto de prueba creado exitosamente:");
    console.log(data.producto);

    // Limpiar prueba
    const pool = require('./db.js');
    await pool.query("DELETE FROM productos WHERE id_producto = ?", [data.producto.id_producto]);
    console.log("🧹 Producto de prueba eliminado correctamente para mantener la BD limpia.");

    process.exit(0);
  } catch (err) {
    console.error("❌ Error al probar API:", err.message);
    process.exit(1);
  }
}

testApiCreateProduct();
