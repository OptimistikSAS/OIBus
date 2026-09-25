import Database from 'better-sqlite3';

const quote = (value: unknown): string => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`;
  return `'${String(value).replaceAll("'", "''")}'`;
};

/**
 * Dumps a whole SQLite database (schema, including the knex `migrations` tables, and every row) as a
 * plain SQL script that `loadSqliteDump` replays into an empty database — a text, diffable alternative
 * to committing binary database files as test fixtures.
 */
export function dumpSqliteDatabase(database: Database.Database): string {
  const objects = database
    .prepare(`SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid;`)
    .all() as Array<{ type: string; name: string; sql: string }>;
  const tables = objects.filter(object => object.type === 'table').map(object => object.name);
  if (database.prepare(`SELECT name FROM sqlite_master WHERE name = 'sqlite_sequence';`).get()) {
    tables.push('sqlite_sequence');
  }

  const lines = ['PRAGMA foreign_keys = OFF;', 'BEGIN TRANSACTION;'];
  for (const object of objects.filter(candidate => candidate.type === 'table')) {
    lines.push(`${object.sql};`);
  }
  for (const table of tables) {
    const rows = database.prepare(`SELECT * FROM "${table}";`).all() as Array<Record<string, unknown>>;
    for (const row of rows) {
      const columns = Object.keys(row);
      lines.push(
        `INSERT INTO "${table}" (${columns.map(column => `"${column}"`).join(', ')}) VALUES (${columns.map(column => quote(row[column])).join(', ')});`
      );
    }
  }
  for (const object of objects.filter(candidate => candidate.type !== 'table')) {
    lines.push(`${object.sql};`);
  }
  lines.push('COMMIT;', 'PRAGMA foreign_keys = ON;');
  return `${lines.join('\n')}\n`;
}

/** Replays a `dumpSqliteDatabase` script into the (new, empty) database file at `dbPath`. */
export function loadSqliteDump(dbPath: string, dump: string): void {
  const database = new Database(dbPath);
  try {
    database.exec(dump);
  } finally {
    database.close();
  }
}
