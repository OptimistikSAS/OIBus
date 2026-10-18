import { OIBusSouthType } from '../../shared/model/connector/south-manifest.model';

import { quoteAnsiIdentifier, splitSchemaTable, SqlDialect } from './sql-table-discovery';

/** The date formats of the MSSQL date/time column types, as an item tracking instant reads them. */
const MSSQL_DATE_TIME_TYPES: Record<string, string> = {
  datetime: 'date-time',
  datetime2: 'date-time-2',
  datetimeoffset: 'date-time-offset',
  smalldatetime: 'small-date-time',
  date: 'date'
};

/** `[name]`, embedded closing brackets doubled. */
function quoteMSSQLIdentifier(identifier: string): string {
  return `[${identifier.replace(/]/g, ']]')}]`;
}

/** The tables of MSSQL are schema-qualified (`schema.table`, see `explore()`). */
export const MSSQL_DIALECT: SqlDialect = {
  quoteTable: tableId => {
    const { schema, table } = splitSchemaTable(tableId);
    return schema ? `${quoteMSSQLIdentifier(schema)}.${quoteMSSQLIdentifier(table)}` : quoteMSSQLIdentifier(table);
  },
  quoteColumn: quoteMSSQLIdentifier,
  dateTimeType: columnType => MSSQL_DATE_TIME_TYPES[columnType.toLowerCase()] ?? null
};

/** `` `name` ``, embedded backticks doubled. */
function quoteMySQLIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, '``')}\``;
}

/** The tables of the database the connector reads, by name (see `explore()`). */
export const MYSQL_DIALECT: SqlDialect = {
  quoteTable: quoteMySQLIdentifier,
  quoteColumn: quoteMySQLIdentifier,
  dateTimeType: columnType => (['datetime', 'timestamp'].includes(columnType.toLowerCase()) ? 'date-time' : null)
};

/** The date formats of the PostgreSQL date/time column types (as `information_schema` names them), as an item tracking instant reads them. */
const POSTGRESQL_DATE_TIME_TYPES: Record<string, string> = {
  'timestamp without time zone': 'timestamp',
  'timestamp with time zone': 'timestamptz'
};

/** The tables of PostgreSQL are schema-qualified (`schema.table`, see `explore()`). */
export const POSTGRESQL_DIALECT: SqlDialect = {
  quoteTable: tableId => {
    const { schema, table } = splitSchemaTable(tableId);
    return schema ? `${quoteAnsiIdentifier(schema)}.${quoteAnsiIdentifier(table)}` : quoteAnsiIdentifier(table);
  },
  quoteColumn: quoteAnsiIdentifier,
  dateTimeType: columnType => POSTGRESQL_DATE_TIME_TYPES[columnType.toLowerCase()] ?? null
};

/** The tables of the schema of the connected user, by name (see `explore()`): DATE and TIMESTAMP columns hold a date/time. */
export const ORACLE_DIALECT: SqlDialect = {
  quoteTable: quoteAnsiIdentifier,
  quoteColumn: quoteAnsiIdentifier,
  dateTimeType: columnType => (/^(DATE|TIMESTAMP)/i.test(columnType) ? 'date-time' : null)
};

/**
 * The tables and columns of SQLite. Its names are quoted for PRAGMA and COUNT statements too, which can't take a bind
 * variable. SQLite has no date type: a column declared as one (DATETIME, TIMESTAMP...) usually holds ISO 8601 text.
 */
export const SQLITE_DIALECT: SqlDialect = {
  quoteTable: quoteAnsiIdentifier,
  quoteColumn: quoteAnsiIdentifier,
  dateTimeType: columnType => (/DATE|TIME/i.test(columnType) ? 'iso-string' : null)
};

/** The SQL dialect of each SQL connector type that can be explored, to write the queries of its tables. */
export const SQL_DIALECTS: Partial<Record<OIBusSouthType, SqlDialect>> = {
  mssql: MSSQL_DIALECT,
  mysql: MYSQL_DIALECT,
  postgresql: POSTGRESQL_DIALECT,
  oracle: ORACLE_DIALECT,
  sqlite: SQLITE_DIALECT
};
