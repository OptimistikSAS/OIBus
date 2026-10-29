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
  primaryKey: boolean;
}

/** A table of the selection, with its columns and the ones to read */
interface SelectedTable {
  id: string;
  name: string;
  columns: Array<SqlColumn>;
  /** The columns to read: all of them for a table checked as a whole */
  selected: Array<SqlColumn>;
  timeColumn: (SqlColumn & { dateTimeType: string }) | null;
}

/**
 * The fields of the record of each table discovered by `discoverTables()`: `query` is what an item reads (restricted to the
 * time range of each run when the table has a date/time column), `plainQuery` the same without that restriction - e.g. for
 * a metadata query, which is run as it is.
 */
export const SQL_TABLE_RECORD_FIELDS = ['id', 'name', 'query', 'plainQuery', 'trackInstant', 'timeColumn', 'dateTimeType'];

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
 * @param combine - whether several tables give one record, reading them together (see `buildJoinRecord`) rather than one each
 */
export async function discoverTables(
  explore: (parentId: string | null) => Promise<Array<SouthConnectorExploreEntry>>,
  nodeIds: Array<string>,
  dialect: SqlDialect,
  combine = false
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

  // The columns of the tables, all loaded at once: each explore may be a round trip to the database
  const columnEntries = await Promise.all(Array.from(selection.keys(), tableId => explore(tableId)));
  const selectedTables: Array<SelectedTable> = [];
  for (const [tableIndex, [tableId, checkedColumns]] of Array.from(selection).entries()) {
    const table = tables.find(candidate => candidate.id === tableId)!;
    const columns: Array<SqlColumn> = columnEntries[tableIndex].map(entry => ({
      name: entry.name,
      type: typeof entry.metadata.type === 'string' ? entry.metadata.type : null,
      primaryKey: entry.metadata.primaryKey === 'yes'
    }));
    const timeColumn = pickTimeColumn(columns, dialect);
    const selected = checkedColumns ? columns.filter(column => checkedColumns.has(column.name)) : [];
    if (checkedColumns && timeColumn && !checkedColumns.has(timeColumn.name)) {
      selected.unshift(timeColumn);
    }
    selectedTables.push({ id: tableId, name: table.name, columns, selected: checkedColumns ? selected : columns, timeColumn });
  }

  // Several tables are read by one query, joining them - when asked to: a record each otherwise
  if (combine && selectedTables.length > 1) {
    return [buildJoinRecord(selectedTables, dialect)];
  }
  return selectedTables.map(table => {
    const columnNames = table.selected === table.columns ? [] : table.selected.map(column => column.name);
    const plainQuery = buildTableQuery(dialect, table.id, columnNames);
    let query = plainQuery;
    if (table.timeColumn) {
      const quotedTimeColumn = dialect.quoteColumn(table.timeColumn.name);
      query += ` WHERE ${quotedTimeColumn} > @StartTime AND ${quotedTimeColumn} <= @EndTime`;
    }
    return {
      id: table.id,
      name: table.name,
      query,
      plainQuery,
      trackInstant: !!table.timeColumn,
      timeColumn: table.timeColumn?.name ?? null,
      dateTimeType: table.timeColumn?.dateTimeType ?? null
    };
  });
}

/**
 * The one record of several tables read together: their selected columns, each table joined to the ones before it on what
 * their names suggest (see `joinCondition`) - a suggestion the user completes. A column whose name is already taken is
 * renamed after its table, so that the rows have distinct fields. The time range is the one of the first table with a
 * date/time column.
 */
function buildJoinRecord(tables: Array<SelectedTable>, dialect: SqlDialect): OIBusRecord {
  // The name of a table, unqualified, tells its columns apart in the query: a number when two tables have the same name
  const aliases = tables.map((table, index) => {
    const { table: tableName } = splitSchemaTable(table.id);
    return tables.some((other, otherIndex) => otherIndex !== index && splitSchemaTable(other.id).table === tableName)
      ? `t${index + 1}`
      : tableName;
  });
  // A renamed column can't take the name of another one either, kept or renamed: a number makes it unique
  const columnNames = new Set(tables.flatMap(table => table.selected.map(column => column.name)));
  const usedFields = new Set<string>();
  const outputNames = tables.map((table, tableIndex) =>
    table.selected.map(column => {
      let fieldName = column.name;
      if (usedFields.has(fieldName)) {
        const renamed = `${aliases[tableIndex]}_${column.name}`;
        fieldName = renamed;
        for (let suffix = 2; usedFields.has(fieldName) || columnNames.has(fieldName); suffix++) {
          fieldName = `${renamed}_${suffix}`;
        }
      }
      usedFields.add(fieldName);
      return fieldName;
    })
  );
  const select = tables
    .flatMap((table, tableIndex) =>
      table.selected.map((column, columnIndex) => {
        const reference = `${dialect.quoteColumn(aliases[tableIndex])}.${dialect.quoteColumn(column.name)}`;
        const fieldName = outputNames[tableIndex][columnIndex];
        return fieldName === column.name ? reference : `${reference} AS ${dialect.quoteColumn(fieldName)}`;
      })
    )
    .join(', ');

  let plainQuery = `SELECT ${select} FROM ${dialect.quoteTable(tables[0].id)} ${dialect.quoteColumn(aliases[0])}`;
  for (let index = 1; index < tables.length; index++) {
    plainQuery += ` INNER JOIN ${dialect.quoteTable(tables[index].id)} ${dialect.quoteColumn(aliases[index])} ON ${joinCondition(tables, aliases, index, dialect)}`;
  }

  const timeTableIndex = tables.findIndex(table => table.timeColumn !== null);
  let query = plainQuery;
  let timeField: string | null = null;
  let dateTimeType: string | null = null;
  if (timeTableIndex !== -1) {
    const timeColumn = tables[timeTableIndex].timeColumn!;
    const reference = `${dialect.quoteColumn(aliases[timeTableIndex])}.${dialect.quoteColumn(timeColumn.name)}`;
    query += ` WHERE ${reference} > @StartTime AND ${reference} <= @EndTime`;
    const timeSelectedIndex = tables[timeTableIndex].selected.findIndex(column => column.name === timeColumn.name);
    timeField = outputNames[timeTableIndex][timeSelectedIndex];
    dateTimeType = timeColumn.dateTimeType;
  }
  return {
    id: tables.map(table => table.id).join(','),
    name: tables.map((table, index) => aliases[index]).join('_'),
    query,
    plainQuery,
    trackInstant: timeField !== null,
    timeColumn: timeField,
    dateTimeType
  };
}

/** Two columns a join condition compares, and how likely they are to be the link between their tables */
interface JoinCandidate {
  earlierIndex: number;
  earlierColumn: string;
  column: string;
  score: number;
}

/**
 * What a table is joined to the ones before it on, from the names of their columns - the most likely link first:
 * 1. a foreign key named after the table it refers to: `measures.tag_id` → `tags.id` (the primary key of `tags`),
 * 2. a column both have, the primary key of one of them: `measures.tag_id` → `tags.tag_id`,
 * 3. a column both have, a key of neither.
 * The primary keys of both tables (`a.id = b.id`) are never compared: their values are unrelated. Without any link, the
 * condition is left to the user.
 */
function joinCondition(tables: Array<SelectedTable>, aliases: Array<string>, index: number, dialect: SqlDialect): string {
  const table = tables[index];
  const candidates: Array<JoinCandidate> = [];
  tables.slice(0, index).forEach((earlier, earlierIndex) => {
    const foreignKey = referencingColumn(table, earlier);
    if (foreignKey) {
      candidates.push({ earlierIndex, earlierColumn: foreignKey.primaryKey, column: foreignKey.column, score: 3 });
    }
    const reverseForeignKey = referencingColumn(earlier, table);
    if (reverseForeignKey) {
      candidates.push({ earlierIndex, earlierColumn: reverseForeignKey.column, column: reverseForeignKey.primaryKey, score: 3 });
    }
    for (const column of table.columns) {
      const shared = earlier.columns.find(earlierColumn => earlierColumn.name === column.name);
      if (shared && !(column.primaryKey && shared.primaryKey)) {
        candidates.push({
          earlierIndex,
          earlierColumn: shared.name,
          column: column.name,
          score: column.primaryKey || shared.primaryKey ? 2 : 1
        });
      }
    }
  });
  const match = candidates.reduce<JoinCandidate | null>(
    (best, candidate) => (!best || candidate.score > best.score ? candidate : best),
    null
  );
  if (!match) {
    return '1 = 1 /* join condition to complete */';
  }
  return `${dialect.quoteColumn(aliases[match.earlierIndex])}.${dialect.quoteColumn(match.earlierColumn)} = ${dialect.quoteColumn(aliases[index])}.${dialect.quoteColumn(match.column)}`;
}

/**
 * The column of a table that refers to the primary key of another one by name: `<other table>_<its key>`, the table name
 * singular or not (`tag_id` or `tags_id` for the `id` of `tags`). Null when there is none.
 */
function referencingColumn(table: SelectedTable, referenced: SelectedTable): { column: string; primaryKey: string } | null {
  const primaryKey = referenced.columns.find(column => column.primaryKey);
  if (!primaryKey) {
    return null;
  }
  const referencedName = splitSchemaTable(referenced.id).table.toLowerCase();
  const names = new Set([`${referencedName}_${primaryKey.name}`, `${referencedName.replace(/s$/, '')}_${primaryKey.name}`]);
  const column = table.columns.find(candidate => names.has(candidate.name.toLowerCase()));
  return column ? { column: column.name, primaryKey: primaryKey.name } : null;
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

/** Whether the tables checked give one record, joined, rather than one each - the `combine` of the discovery scope. */
export function extractCombine(scope: Record<string, unknown>): boolean {
  return scope.combine === true;
}

/**
 * The tables of an explore result with their SELECT query, which the user can copy to start a query of their own: all the
 * columns, in the dialect of the connector. The columns of a table are left as they are.
 */
export function withTableSelect(
  parentId: string | null,
  entries: Array<SouthConnectorExploreEntry>,
  dialect: SqlDialect
): Array<SouthConnectorExploreEntry> {
  return parentId === null
    ? entries.map(entry => ({ ...entry, metadata: { ...entry.metadata, select: buildTableQuery(dialect, entry.id, []) } }))
    : entries;
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
