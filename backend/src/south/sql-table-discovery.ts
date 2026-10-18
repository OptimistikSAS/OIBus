import { OIBusRecord } from '../../shared/model/common/content.model';
import { SouthConnectorExploreEntry } from '../../shared/model/domain/south-connector.model';

/** How a SQL connector writes the names of its tables and columns, and reads its date/time columns. */
export interface SqlDialect {
  /** The quoted reference of a table, from its explore entry id: `[dbo].[logs]`, `"logs"`... */
  quoteTable(tableId: string): string;
  quoteColumn(column: string): string;
  /** The date format of a column of this SQL type, as an item tracking instant reads it - null when it holds no date/time */
  dateTimeType(columnType: string): string | null;
}

interface SqlColumn {
  name: string;
  type: string | null;
}

/** Column names that usually hold the time of a row, preferred when a table has several date/time columns. */
const TIME_COLUMN_NAME = /^(timestamp|time|date|datetime)$|(_at|_time|_date|timestamp)$/i;

/**
 * Discovery of the tables and columns checked in the Explore modal of a SQL connector: one record per table, holding
 * the item that reads it - its query, and the time column that query reads from (see `SouthConfigurationDiscovery`).
 * A checked table reads all its columns, the checked columns of a table only these ones.
 *
 * The query reads the rows of the time range of each run (`@StartTime`/`@EndTime`) from a date/time column, also
 * the tracking instant, so that each run picks up where the last one stopped. The column is picked among the date/time
 * columns of the table, preferring a usual name (`timestamp`, `created_at`...), and read even when it was not checked
 * (the tracking instant is read from the rows). A table without any reads all its rows on each run, untracked.
 *
 * @param explore - the explore of the connector: the tables at the root, the columns of a table under it
 */
export async function discoverTables(
  explore: (parentId: string | null) => Promise<Array<SouthConnectorExploreEntry>>,
  nodeIds: Array<string>,
  dialect: SqlDialect
): Promise<Array<OIBusRecord>> {
  const tables = await explore(null);
  // Longest first: a column id is its table id and its name, joined by a dot - both can hold dots too
  const tableIds = tables.map(table => table.id).sort((a, b) => b.length - a.length);

  // The checked columns of each table, null for a whole table - in the order they were checked
  const selection = new Map<string, Set<string> | null>();
  for (const nodeId of nodeIds) {
    if (tableIds.includes(nodeId)) {
      selection.set(nodeId, null);
      continue;
    }
    const tableId = tableIds.find(candidate => nodeId.startsWith(`${candidate}.`));
    if (!tableId) {
      throw new Error(`"${nodeId}" is not a table or a column of the database`);
    }
    const columns = selection.get(tableId);
    if (columns === null) {
      continue;
    }
    selection.set(tableId, (columns ?? new Set()).add(nodeId.slice(tableId.length + 1)));
  }

  const records: Array<OIBusRecord> = [];
  for (const [tableId, checkedColumns] of selection) {
    const table = tables.find(candidate => candidate.id === tableId)!;
    const columns: Array<SqlColumn> = (await explore(tableId)).map(entry => ({
      name: entry.name,
      type: typeof entry.metadata.type === 'string' ? entry.metadata.type : null
    }));
    const timeColumn = pickTimeColumn(columns, dialect);
    const selected = checkedColumns ? columns.filter(column => checkedColumns.has(column.name)) : [];
    if (checkedColumns && timeColumn && !checkedColumns.has(timeColumn.name)) {
      selected.unshift(timeColumn);
    }
    let query = buildTableQuery(
      dialect,
      tableId,
      selected.map(column => column.name)
    );
    if (timeColumn) {
      const quotedTimeColumn = dialect.quoteColumn(timeColumn.name);
      query += ` WHERE ${quotedTimeColumn} > @StartTime AND ${quotedTimeColumn} <= @EndTime`;
    }
    records.push({
      id: tableId,
      name: table.name,
      query,
      trackInstant: !!timeColumn,
      timeColumn: timeColumn?.name ?? null,
      dateTimeType: timeColumn?.dateTimeType ?? null
    });
  }
  return records;
}

function pickTimeColumn(columns: Array<SqlColumn>, dialect: SqlDialect): (SqlColumn & { dateTimeType: string }) | null {
  const candidates = columns.flatMap(column => {
    const dateTimeType = column.type ? dialect.dateTimeType(column.type) : null;
    return dateTimeType ? [{ ...column, dateTimeType }] : [];
  });
  return candidates.find(column => TIME_COLUMN_NAME.test(column.name)) ?? candidates[0] ?? null;
}

/** A column of a table, as the explore of a SQL connector lists it under its table. */
export function toColumnExploreEntry(
  tableId: string,
  column: { name: string; type: string | null; nullable: boolean; primaryKey: boolean; defaultValue: string | number | null }
): SouthConnectorExploreEntry {
  const metadata: Record<string, string | number> = { nullable: column.nullable ? 'yes' : 'no' };
  if (column.type) {
    metadata.type = column.type;
  }
  if (column.primaryKey) {
    metadata.primaryKey = 'yes';
  }
  if (column.defaultValue !== null) {
    metadata.default = column.defaultValue;
  }
  return { id: `${tableId}.${column.name}`, name: column.name, metadata, hasChildren: false };
}

/** The query reading the given columns of a table, quoted in the dialect of its connector - all of them when none is given. */
export function buildTableQuery(dialect: SqlDialect, tableId: string, columns: Array<string>): string {
  const select = columns.length > 0 ? columns.map(column => dialect.quoteColumn(column)).join(', ') : '*';
  return `SELECT ${select} FROM ${dialect.quoteTable(tableId)}`;
}

/** The nodes checked in the Explore modal, when the discovery scope is made of them rather than a query. */
export function extractNodeIds(scope: Record<string, unknown>): Array<string> | null {
  return Array.isArray(scope.nodeIds) ? scope.nodeIds.filter((nodeId): nodeId is string => typeof nodeId === 'string') : null;
}

/** `"name"`, embedded quotes doubled - the ANSI SQL quoting of SQLite, PostgreSQL and Oracle. */
export function quoteAnsiIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/** A `schema.table` explore entry id, split on its first dot (a schema name rarely holds one). */
export function splitSchemaTable(tableId: string): { schema: string; table: string } {
  const dotIndex = tableId.indexOf('.');
  return dotIndex === -1 ? { schema: '', table: tableId } : { schema: tableId.slice(0, dotIndex), table: tableId.slice(dotIndex + 1) };
}
