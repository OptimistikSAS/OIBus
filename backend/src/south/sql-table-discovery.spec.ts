import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { SouthConnectorExploreEntry } from '../../shared/model/domain/south-connector.model';

import {
  buildTableQuery,
  discoverTables,
  extractNodeIds,
  quoteAnsiIdentifier,
  splitSchemaTable,
  SqlDialect,
  toColumnExploreEntry
} from './sql-table-discovery';

const dialect: SqlDialect = {
  quoteTable: quoteAnsiIdentifier,
  quoteColumn: quoteAnsiIdentifier,
  dateTimeType: columnType => (columnType === 'timestamp' ? 'iso-string' : null)
};

function table(id: string): SouthConnectorExploreEntry {
  return { id, name: id, metadata: {}, hasChildren: true };
}

function column(tableId: string, name: string, type: string): SouthConnectorExploreEntry {
  return { id: `${tableId}.${name}`, name, metadata: { type }, hasChildren: false };
}

/** A database of a few tables: `production` with two time columns, `settings` without any, `a.b` with a dotted name. */
function fakeExplore() {
  const columns: Record<string, Array<SouthConnectorExploreEntry>> = {
    production: [
      column('production', 'id', 'int'),
      column('production', 'updated', 'timestamp'),
      column('production', 'produced_at', 'timestamp'),
      column('production', 'value', 'float')
    ],
    settings: [column('settings', 'key', 'text'), column('settings', 'value', 'text')],
    a: [column('a', 'x', 'int')],
    'a.b': [column('a.b', 'c.d', 'int'), column('a.b', 'time', 'timestamp')]
  };
  return mock.fn(async (parentId: string | null) => (parentId === null ? Object.keys(columns).map(table) : columns[parentId]));
}

describe('discoverTables', () => {
  it('should read all the columns of a checked table, from its time column, the one with a usual name first', async () => {
    const records = await discoverTables(fakeExplore(), ['production'], dialect);

    assert.deepStrictEqual(records, [
      {
        id: 'production',
        name: 'production',
        query: 'SELECT * FROM "production" WHERE "produced_at" > @StartTime AND "produced_at" <= @EndTime',
        trackInstant: true,
        timeColumn: 'produced_at',
        dateTimeType: 'iso-string'
      }
    ]);
  });

  it('should read the checked columns of a table only, and its time column, which the tracking instant reads', async () => {
    const records = await discoverTables(fakeExplore(), ['production.value', 'production.id'], dialect);

    assert.strictEqual(
      records[0].query,
      'SELECT "produced_at", "id", "value" FROM "production" WHERE "produced_at" > @StartTime AND "produced_at" <= @EndTime'
    );
  });

  it('should read all the rows of a table without time column, untracked', async () => {
    const records = await discoverTables(fakeExplore(), ['settings'], dialect);

    assert.deepStrictEqual(records, [
      { id: 'settings', name: 'settings', query: 'SELECT * FROM "settings"', trackInstant: false, timeColumn: null, dateTimeType: null }
    ]);
  });

  it('should give one record per table, in the order checked, a checked table reading all its columns', async () => {
    const records = await discoverTables(fakeExplore(), ['settings.key', 'production', 'production.value', 'settings.value'], dialect);

    assert.deepStrictEqual(
      records.map(record => record.query),
      ['SELECT "key", "value" FROM "settings"', 'SELECT * FROM "production" WHERE "produced_at" > @StartTime AND "produced_at" <= @EndTime']
    );
  });

  it('should tell the table of a column apart when names hold dots', async () => {
    const records = await discoverTables(fakeExplore(), ['a.b.c.d'], dialect);

    assert.deepStrictEqual(
      records.map(record => [record.id, record.query]),
      [['a.b', 'SELECT "time", "c.d" FROM "a.b" WHERE "time" > @StartTime AND "time" <= @EndTime']]
    );
  });

  it('should refuse a node that is not a table or a column of the database', async () => {
    await assert.rejects(
      discoverTables(fakeExplore(), ['unknown'], dialect),
      new Error('"unknown" is not a table or a column of the database')
    );
  });
});

describe('SQL table discovery helpers', () => {
  it('should quote ANSI identifiers, doubling embedded quotes', () => {
    assert.strictEqual(quoteAnsiIdentifier('my "table"'), '"my ""table"""');
  });

  it('should split a schema-qualified table id on its first dot', () => {
    assert.deepStrictEqual(splitSchemaTable('dbo.my.table'), { schema: 'dbo', table: 'my.table' });
    assert.deepStrictEqual(splitSchemaTable('table'), { schema: '', table: 'table' });
  });

  it('should list a column under its table, leaving out what it does not have', () => {
    assert.deepStrictEqual(toColumnExploreEntry('t', { name: 'c', type: null, nullable: true, primaryKey: false, defaultValue: null }), {
      id: 't.c',
      name: 'c',
      metadata: { nullable: 'yes' },
      hasChildren: false
    });
    assert.deepStrictEqual(toColumnExploreEntry('t', { name: 'id', type: 'int', nullable: false, primaryKey: true, defaultValue: 0 }), {
      id: 't.id',
      name: 'id',
      metadata: { nullable: 'no', type: 'int', primaryKey: 'yes', default: 0 },
      hasChildren: false
    });
  });

  it('should write the query reading the given columns of a table, or all of them', () => {
    assert.strictEqual(buildTableQuery(dialect, 'tags', ['tag', 'unit']), 'SELECT "tag", "unit" FROM "tags"');
    assert.strictEqual(buildTableQuery(dialect, 'tags', []), 'SELECT * FROM "tags"');
  });

  it('should extract the checked nodes of a discovery scope, if it has some', () => {
    assert.deepStrictEqual(extractNodeIds({ nodeIds: ['a', 1, 'b'] }), ['a', 'b']);
    assert.strictEqual(extractNodeIds({ query: 'SELECT 1' }), null);
  });
});
