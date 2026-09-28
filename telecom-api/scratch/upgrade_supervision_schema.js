const pool = require('../db');

async function upgradeSupervisionSchema() {
  console.log('🔄 Actualizando tabla supervision_campo con geolocalización y vinculación a órdenes...');
  const [cols] = await pool.query('DESCRIBE supervision_campo');
  const existing = cols.map(c => c.Field);

  const columns = [
    { name: 'id_orden', def: 'int(11) DEFAULT NULL' },
    { name: 'numero_ticket', def: 'varchar(50) DEFAULT NULL' },
    { name: 'cliente_orden', def: 'varchar(150) DEFAULT NULL' },
    { name: 'direccion_orden', def: 'varchar(255) DEFAULT NULL' },
    { name: 'coordenadas_orden', def: 'varchar(100) DEFAULT NULL' },
    { name: 'coordenadas_en_camino', def: 'varchar(100) DEFAULT NULL' },
    { name: 'coordenadas_inicio', def: 'varchar(100) DEFAULT NULL' },
    { name: 'coordenadas_fin', def: 'varchar(100) DEFAULT NULL' },
    { name: 'distancia_metros_inicio', def: 'int(11) DEFAULT NULL' },
    { name: 'hora_inicio', def: 'time DEFAULT NULL' },
    { name: 'hora_fin', def: 'time DEFAULT NULL' },
    { name: 'estado_operativo', def: "enum('EN_CAMINO','INICIADA','FINALIZADA') DEFAULT 'INICIADA'" }
  ];

  for (const col of columns) {
    if (!existing.includes(col.name)) {
      console.log(`+ Agregando columna: ${col.name}`);
      await pool.query(`ALTER TABLE supervision_campo ADD COLUMN ${col.name} ${col.def}`);
    } else {
      console.log(`✓ Columna ya existe: ${col.name}`);
    }
  }

  console.log('✅ Esquema de supervision_campo actualizado exitosamente.');
  process.exit(0);
}

upgradeSupervisionSchema().catch(err => {
  console.error('❌ Error actualizando esquema:', err);
  process.exit(1);
});
