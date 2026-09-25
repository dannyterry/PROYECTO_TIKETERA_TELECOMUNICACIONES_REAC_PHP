const mysql = require('mysql2/promise');

const REMOTE_CONFIG = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
  dateStrings: true,
  connectTimeout: 60000
};

async function applyProductionMigration() {
  console.log('================================================================');
  console.log('🚀 APLICANDO MIGRACIÓN SEGURA A BASE DE DATOS DE PRODUCCIÓN');
  console.log('Servidor: corporacioncespedes.com | BD: corporacioncespe_cespedes');
  console.log('================================================================\n');

  const conn = await mysql.createConnection(REMOTE_CONFIG);

  try {
    // 1. Crear tabla supervision_campo
    console.log('1. Creando / Verificando tabla supervision_campo...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS supervision_campo (
        id int(11) NOT NULL AUTO_INCREMENT,
        id_tecnico int(11) DEFAULT NULL,
        tecnico varchar(150) NOT NULL,
        dni varchar(20) DEFAULT NULL,
        cuadrilla varchar(50) DEFAULT NULL,
        tipo_inspeccion enum('CAMPO_GENERAL','AVERIAS','ORDENAMIENTO','ALTAS') NOT NULL DEFAULT 'CAMPO_GENERAL',
        fecha date NOT NULL,
        hora time DEFAULT NULL,
        lugar_inspeccion varchar(255) DEFAULT NULL,
        supervisor varchar(150) NOT NULL,
        cumplimiento_porcentaje decimal(5,2) NOT NULL DEFAULT 0.00,
        semaforo enum('verde','amarillo','rojo') NOT NULL DEFAULT 'verde',
        items_json longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        observaciones text DEFAULT NULL,
        firma_supervisor longtext DEFAULT NULL,
        foto_epp_uniforme longtext DEFAULT NULL,
        foto_herramientas longtext DEFAULT NULL,
        foto_carro_limpio longtext DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (id),
        KEY idx_sup_campo_tecnico (id_tecnico),
        KEY idx_sup_campo_fecha (fecha),
        KEY idx_sup_campo_semaforo (semaforo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    console.log('✅ Tabla supervision_campo verificada.');

    // 2. Crear tabla supervision_calidad_cliente
    console.log('2. Creando / Verificando tabla supervision_calidad_cliente...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS supervision_calidad_cliente (
        id int(11) NOT NULL AUTO_INCREMENT,
        id_orden int(11) DEFAULT NULL,
        numero_ticket varchar(50) DEFAULT NULL,
        id_tecnico int(11) DEFAULT NULL,
        tecnico varchar(150) NOT NULL,
        cuadrilla varchar(50) DEFAULT NULL,
        cliente varchar(200) NOT NULL,
        telefono varchar(50) DEFAULT NULL,
        distrito varchar(100) DEFAULT NULL,
        fecha_atencion date DEFAULT NULL,
        fecha_auditoria date NOT NULL,
        auditor varchar(150) NOT NULL,
        preguntas_json longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        puntaje_porcentaje decimal(5,2) NOT NULL DEFAULT 0.00,
        calificacion_estrellas tinyint(4) NOT NULL DEFAULT 5,
        comentario_cliente text DEFAULT NULL,
        estado_conformidad enum('CONFORME','CON_OBSERVACIONES','NO_CONFORME') NOT NULL DEFAULT 'CONFORME',
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (id),
        KEY idx_calidad_orden (id_orden),
        KEY idx_calidad_tecnico (id_tecnico),
        KEY idx_calidad_fecha (fecha_auditoria),
        KEY idx_calidad_estado (estado_conformidad)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    console.log('✅ Tabla supervision_calidad_cliente verificada.');

    // 3. Aplicar Reincorporaciones de saldos al Almacén Central
    console.log('\n3. Verificando y aplicando reincorporaciones de inventario al Almacén Central...');

    const adjustments = [
      { codigo: 'MAT-TEM', nombre: 'TEMPLADORES', cantidad: 80, ref: 'Movs #160 y #202' },
      { codigo: 'MAT-DRP', nombre: 'DROP', cantidad: 5000, ref: 'Movs #171, #177, #183, #189, #195' },
      { codigo: 'MAT-HEB', nombre: 'HEBILLAS 1/2', cantidad: 60, ref: 'Movs #168, #174, #180, #186, #192, #210' },
      { codigo: 'CONA', nombre: 'CONECTOR WIN', cantidad: 45, ref: 'Movs #158 y #199' },
      { codigo: 'MAT-ANC', nombre: 'ANCLAJE T/P', cantidad: 30, ref: 'Movs #167, #173, #179, #185, #191, #208' },
      { codigo: 'MAT-BAN', nombre: 'C. BANDIX', cantidad: 30, ref: 'Movs #169, #175, #181, #187, #193' },
      { codigo: 'MAT-CLE', nombre: 'CLEVIS', cantidad: 30, ref: 'Movs #166, #172, #178, #184, #190, #209' },
      { codigo: 'MAT-PCO', nombre: 'PATCH COR', cantidad: 14, ref: 'Movs #159 y #200' },
      { codigo: 'MAT-ACO', nombre: 'ACOPLES', cantidad: 7, ref: 'Movs #162 y #204' },
      { codigo: 'MAT-ROS', nombre: 'ROSETAS', cantidad: 7, ref: 'Movs #161 y #203' },
      { codigo: 'MAT-DCO', nombre: 'C. DOBLE CONTACTO', cantidad: 5, ref: 'Movs #170, #176, #182, #188, #194' },
      { codigo: 'AMAA', nombre: 'AMARRE CINTILLO #150', cantidad: 2, ref: 'Movs #164 y #206' },
      { codigo: 'MAT-ROT', nombre: 'ROTULADOR', cantidad: 2, ref: 'Movs #165 y #207' },
      { codigo: 'GRAC', nombre: 'GRAPAS #6', cantidad: 2, ref: 'Movs #163 y #205' },
      { codigo: 'MAT-PCA', nombre: 'PATCH COR AZUL VERDE', cantidad: 1, ref: 'Mov #201' }
    ];

    await conn.beginTransaction();

    for (const adj of adjustments) {
      const [pRows] = await conn.execute(`SELECT id_producto, codigo, nombre FROM productos WHERE codigo = ?`, [adj.codigo]);
      if (pRows.length === 0) {
        console.warn(`⚠️ Producto no encontrado: ${adj.codigo}`);
        continue;
      }
      const prod = pRows[0];

      // Verificar si ya se aplicó este ajuste previamente
      const [existingMov] = await conn.execute(`
        SELECT id_movimiento FROM movimientos 
        WHERE id_producto = ? AND tipo = 'ENTRADA' 
          AND referencia LIKE '%Reincorporación por asignaciones eliminadas%'
      `, [prod.id_producto]);

      if (existingMov.length > 0) {
        console.log(`ℹ️ [${prod.codigo}] ${prod.nombre}: Ajuste ya aplicado previamente (Mov #${existingMov[0].id_movimiento}). Omitiendo duplicado.`);
        continue;
      }

      // Obtener stock actual
      const [stkRows] = await conn.execute(`
        SELECT id_stock, cantidad FROM stock WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)
      `, [prod.id_producto]);

      let antes = 0;
      if (stkRows.length > 0) {
        antes = Number(stkRows[0].cantidad);
        await conn.execute(`
          UPDATE stock SET cantidad = cantidad + ? WHERE id_producto = ? AND (id_almacen = 1 OR id_almacen IS NULL)
        `, [adj.cantidad, prod.id_producto]);
      } else {
        await conn.execute(`
          INSERT INTO stock (id_producto, id_almacen, cantidad, cantidad_segundo_uso)
          VALUES (?, 1, ?, 0)
        `, [prod.id_producto, adj.cantidad]);
      }

      const despues = antes + adj.cantidad;

      // Registrar movimiento oficial en Kardex
      await conn.execute(`
        INSERT INTO movimientos (id_producto, id_almacen, tipo, cantidad, referencia, fecha_creacion)
        VALUES (?, 1, 'ENTRADA', ?, ?, NOW())
      `, [prod.id_producto, adj.cantidad, `Ajuste de inventario: Reincorporación por asignaciones eliminadas (${adj.ref})`]);

      console.log(`✅ [${prod.codigo}] ${prod.nombre}: Stock Central ${antes} -> ${despues} (+${adj.cantidad})`);
    }

    await conn.commit();
    console.log('\n🎉 ¡MIGRACIÓN DE BASE DE DATOS EN PRODUCCIÓN APLICADA CON ÉXITO!');

  } catch (err) {
    await conn.rollback();
    console.error('❌ Error al aplicar migración en producción:', err);
  } finally {
    await conn.end();
  }
}

applyProductionMigration().catch(console.error);
