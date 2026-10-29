import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { SouthConnectorExploreEntry } from '../../shared/model/domain/south-connector.model';

import {
  buildTableQuery,
  discoverTables,
  extractCombine,
  extractNodeIds,
  quoteAnsiIdentifier,
  splitSchemaTable,
  SQL_TABLE_RECORD_FIELDS,
  SqlDialect,
  toColumnExploreEntry,
  withTableSelect
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
        plainQuery: 'SELECT * FROM "production"',
        trackInstant: true,
        timeColumn: 'produced_at',
        dateTimeType: 'iso-string'
      }
    ]);
    // The fields the manifests tell the user about
    assert.deepStrictEqual(Object.keys(records[0]).sort(), [...SQL_TABLE_RECORD_FIELDS].sort());
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
      {
        id: 'settings',
        name: 'settings',
        query: 'SELECT * FROM "settings"',
        plainQuery: 'SELECT * FROM "settings"',
        trackInstant: false,
        timeColumn: null,
        dateTimeType: null
      }
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

/** A database to join: `measures` read over time, `tags` it refers to by `tag_id`, and `sites`, which has nothing in common with them. */
function fakeJoinExplore() {
  const withKey = (tableId: string, name: string, type: string, primaryKey: boolean): SouthConnectorExploreEntry => ({
    id: `${tableId}.${name}`,
    name,
    metadata: primaryKey ? { type, primaryKey: 'yes' } : { type },
    hasChildren: false
  });
  const columns: Record<string, Array<SouthConnectorExploreEntry>> = {
    measures: [
      withKey('measures', 'id', 'int', true),
      withKey('measures', 'tag_id', 'int', false),
      withKey('measures', 'ts', 'timestamp', false),
      withKey('measures', 'value', 'float', false)
    ],
    tags: [withKey('tags', 'tag_id', 'int', true), withKey('tags', 'name', 'text', false), withKey('tags', 'value', 'text', false)],
    sites: [withKey('sites', 'code', 'text', true), withKey('sites', 'label', 'text', false)]
  };
  return mock.fn(async (parentId: string | null) => (parentId === null ? Object.keys(columns).map(table) : columns[parentId]));
}

describe('discoverTables of several tables read together', () => {
  it('should keep one record per table unless asked to combine them', async () => {
    const records = await discoverTables(fakeJoinExplore(), ['measures', 'tags'], dialect);

    assert.deepStrictEqual(
      records.map(record => record.id),
      ['measures', 'tags']
    );
  });

  it('should read the tables together, joined on the column they share, with the time range of the first one', async () => {
    const records = await discoverTables(fakeJoinExplore(), ['measures', 'tags'], dialect, true);

    assert.strictEqual(records.length, 1);
    assert.deepStrictEqual(records[0], {
      id: 'measures,tags',
      name: 'measures_tags',
      plainQuery:
        'SELECT "measures"."id", "measures"."tag_id", "measures"."ts", "measures"."value", "tags"."tag_id" AS "tags_tag_id", "tags"."name", "tags"."value" AS "tags_value" ' +
        'FROM "measures" "measures" INNER JOIN "tags" "tags" ON "measures"."tag_id" = "tags"."tag_id"',
      query:
        'SELECT "measures"."id", "measures"."tag_id", "measures"."ts", "measures"."value", "tags"."tag_id" AS "tags_tag_id", "tags"."name", "tags"."value" AS "tags_value" ' +
        'FROM "measures" "measures" INNER JOIN "tags" "tags" ON "measures"."tag_id" = "tags"."tag_id" ' +
        'WHERE "measures"."ts" > @StartTime AND "measures"."ts" <= @EndTime',
      trackInstant: true,
      timeColumn: 'ts',
      dateTimeType: 'iso-string'
    });
  });

  it('should read only the columns checked, and the time column of a table whose columns are checked', async () => {
    const records = await discoverTables(
      fakeJoinExplore(),
      ['tags.name', 'measures.value', 'tags.tag_id', 'measures.tag_id'],
      dialect,
      true
    );

    assert.strictEqual(
      records[0].plainQuery,
      'SELECT "tags"."tag_id", "tags"."name", "measures"."ts", "measures"."tag_id" AS "measures_tag_id", "measures"."value" ' +
        'FROM "tags" "tags" INNER JOIN "measures" "measures" ON "tags"."tag_id" = "measures"."tag_id"'
    );
    // the time column is read, though not checked, and tracked under its own name
    assert.strictEqual(records[0].timeColumn, 'ts');
    assert.ok((records[0].query as string).endsWith('WHERE "measures"."ts" > @StartTime AND "measures"."ts" <= @EndTime'));
  });

  it('should leave a join condition to complete when the tables have no column in common', async () => {
    const records = await discoverTables(fakeJoinExplore(), ['tags', 'sites'], dialect, true);

    assert.ok((records[0].plainQuery as string).endsWith('INNER JOIN "sites" "sites" ON 1 = 1 /* join condition to complete */'));
    assert.strictEqual(records[0].trackInstant, false);
    assert.strictEqual(records[0].timeColumn, null);
    assert.strictEqual(records[0].query, records[0].plainQuery);
  });

  it('should join each table to the ones before it', async () => {
    const records = await discoverTables(fakeJoinExplore(), ['measures', 'tags', 'sites'], dialect, true);

    assert.ok(
      (records[0].plainQuery as string).includes(
        'INNER JOIN "tags" "tags" ON "measures"."tag_id" = "tags"."tag_id" INNER JOIN "sites" "sites" ON 1 = 1'
      )
    );
  });

  it('should tell two tables of the same name apart by a number', async () => {
    const explore = mock.fn(async (parentId: string | null) =>
      parentId === null ? [table('a.logs'), table('b.logs')] : [column(parentId, 'id', 'int')]
    );

    const records = await discoverTables(explore, ['a.logs', 'b.logs'], dialect, true);

    assert.strictEqual(
      records[0].plainQuery,
      'SELECT "t1"."id", "t2"."id" AS "t2_id" FROM "a.logs" "t1" INNER JOIN "b.logs" "t2" ON "t1"."id" = "t2"."id"'
    );
  });

  it('should combine a single table as any other', async () => {
    const records = await discoverTables(fakeJoinExplore(), ['tags'], dialect, true);

    assert.strictEqual(records[0].plainQuery, 'SELECT * FROM "tags"');
  });

  it('should know whether the scope asks to combine the tables', () => {
    assert.strictEqual(extractCombine({ nodeIds: ['a'], combine: true }), true);
    assert.strictEqual(extractCombine({ nodeIds: ['a'] }), false);
  });

  it('should give the tables of an explore their SELECT query, and leave the columns as they are', () => {
    const tables = [{ id: 'logs', name: 'logs', metadata: { columns: 2 }, hasChildren: true }];

    assert.deepStrictEqual(withTableSelect(null, tables, dialect), [
      { id: 'logs', name: 'logs', metadata: { columns: 2, select: 'SELECT * FROM "logs"' }, hasChildren: true }
    ]);
    assert.strictEqual(withTableSelect('logs', tables, dialect), tables);
  });
});
