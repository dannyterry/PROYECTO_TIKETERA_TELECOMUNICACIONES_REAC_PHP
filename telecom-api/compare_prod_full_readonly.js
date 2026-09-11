const mysql = require('mysql2/promise');

const localConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'corporacioncespe_cespedes',
};

const productionConfig = {
  host: 'corporacioncespedes.com',
  user: 'corporacioncespe_miguel',
  password: 'corporacioncespe_123',
  database: 'corporacioncespe_cespedes',
};

async function getMetadata(connection) {
  const [tables] = await connection.query('SHOW TABLES');
  const names = tables.map((row) => Object.values(row)[0]);
  const metadata = {};

  for (const table of names) {
    const [columns] = await connection.query(`SHOW FULL COLUMNS FROM \`${table}\``);
    const [indexes] = await connection.query(`SHOW INDEX FROM \`${table}\``);
    const [foreignKeys] = await connection.query(`
      SELECT kcu.CONSTRAINT_NAME, kcu.COLUMN_NAME, kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE kcu
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME = ?
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
    `, [table]);

    metadata[table] = {
      columns: columns.map((column) => ({
        name: column.Field,
        type: column.Type,
        nullable: column.Null,
        default: column.Default,
        extra: column.Extra,
        collation: column.Collation,
      })),
      indexes: indexes.map((index) => ({
        name: index.Key_name,
        column: index.Column_name,
        nonUnique: index.Non_unique,
        sequence: index.Seq_in_index,
      })),
      foreignKeys,
    };
  }

  return metadata;
}

function compare(local, production) {
  const report = { missingTables: [], missingColumns: [], changedColumns: [], missingIndexes: [], missingForeignKeys: [] };
  const localTables = Object.keys(local);
  const productionTables = new Set(Object.keys(production));

  for (const table of localTables) {
    if (!productionTables.has(table)) {
      report.missingTables.push(table);
      continue;
    }

    const remoteColumns = new Map(production[table].columns.map((column) => [column.name, column]));
    for (const column of local[table].columns) {
      const remote = remoteColumns.get(column.name);
      if (!remote) {
        report.missingColumns.push({ table, ...column });
      } else if (JSON.stringify(column) !== JSON.stringify(remote)) {
        report.changedColumns.push({ table, local: column, production: remote });
      }
    }

    const remoteIndexes = new Set(production[table].indexes.map((index) => `${index.name}|${index.column}|${index.sequence}`));
    for (const index of local[table].indexes) {
      const key = `${index.name}|${index.column}|${index.sequence}`;
      if (!remoteIndexes.has(key)) report.missingIndexes.push({ table, ...index });
    }

    const remoteForeignKeys = new Set(production[table].foreignKeys.map((key) => `${key.CONSTRAINT_NAME}|${key.COLUMN_NAME}|${key.REFERENCED_TABLE_NAME}|${key.REFERENCED_COLUMN_NAME}`));
    for (const key of local[table].foreignKeys) {
      const value = `${key.CONSTRAINT_NAME}|${key.COLUMN_NAME}|${key.REFERENCED_TABLE_NAME}|${key.REFERENCED_COLUMN_NAME}`;
      if (!remoteForeignKeys.has(value)) report.missingForeignKeys.push({ table, ...key });
    }
  }

  return report;
}

(async () => {
  const local = await mysql.createConnection(localConfig);
  const production = await mysql.createConnection(productionConfig);
  try {
    const [localMetadata, productionMetadata] = await Promise.all([
      getMetadata(local),
      getMetadata(production),
    ]);
    const report = compare(localMetadata, productionMetadata);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await local.end();
    await production.end();
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
