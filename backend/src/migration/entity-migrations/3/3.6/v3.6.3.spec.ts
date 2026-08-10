import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Knex } from 'knex';
import { createMigrationSchemaHarness, buildSchemaBefore } from '../../../../tests/utils/migration-test-utils';
import { up, down } from './v3.6.3';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');

async function insertScanMode(db: Knex, id = 'scan-mode-1') {
  await db('scan_modes').insert({ id, name: `Scan ${id}`, description: '', cron: '* * * * * *' });
}

async function insertSouthConnector(db: Knex, overrides: Record<string, unknown> = {}) {
  const row = {
    id: 'south-1',
    name: 'South 1',
    type: 'opcua',
    description: '',
    enabled: 1,
    settings: '{}',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
  await db('south_connectors').insert(row);
  return row;
}

async function insertSouthItem(db: Knex, overrides: Record<string, unknown> = {}) {
  const row = {
    id: 'south-item-1',
    connector_id: 'south-1',
    scan_mode_id: 'scan-mode-1',
    name: 'Item 1',
    enabled: 1,
    settings: '{}',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
  await db('south_items').insert(row);
  return row;
}

describe('Entity migration v3.6.3', () => {
  // Builds the real pre-3.6.3 schema ONCE, then hands each test an isolated SQLite savepoint
  // (rolled back in afterEach) instead of replaying the whole migration history per test.
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.6.3.ts', db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await insertScanMode(db);
  });
  afterEach(() => harness.afterEach());

  it('runs end-to-end on a realistic pre-3.6.3 schema', async () => {
    await up(db); // must not throw
  });

  it('down is a no-op', async () => {
    await down(db); // must not throw, covers the no-op branch
  });

  describe('updateSouthOPCUAItemSettings', () => {
    it("adds timestampOrigin 'oibus' to a 'da' mode item of an opcua connector", async () => {
      await insertSouthConnector(db, { id: 'south-opcua', type: 'opcua' });
      await insertSouthItem(db, {
        id: 'item-da',
        connector_id: 'south-opcua',
        settings: JSON.stringify({ nodeId: 'ns=1;s=node', mode: 'da' })
      });

      await up(db);

      const row = await db('south_items').where('id', 'item-da').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.nodeId, 'ns=1;s=node', 'existing settings preserved');
      assert.strictEqual(settings.timestampOrigin, 'oibus');
    });

    it("leaves a 'ha' mode item of an opcua connector untouched", async () => {
      await insertSouthConnector(db, { id: 'south-opcua', type: 'opcua' });
      await insertSouthItem(db, {
        id: 'item-ha',
        connector_id: 'south-opcua',
        settings: JSON.stringify({ nodeId: 'ns=1;s=node', mode: 'ha', haMode: { aggregate: 'raw' } })
      });

      await up(db);

      const row = await db('south_items').where('id', 'item-ha').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.timestampOrigin, undefined, "'ha' mode items are not modified");
    });

    it("preserves extra existing fields (haMode) when converting a 'da' mode item", async () => {
      await insertSouthConnector(db, { id: 'south-opcua', type: 'opcua' });
      await insertSouthItem(db, {
        id: 'item-da-hamode',
        connector_id: 'south-opcua',
        settings: JSON.stringify({ nodeId: 'ns=1;s=node', mode: 'da', haMode: { aggregate: 'raw', resampling: '1min' } })
      });

      await up(db);

      const row = await db('south_items').where('id', 'item-da-hamode').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.timestampOrigin, 'oibus');
      assert.deepStrictEqual(settings.haMode, { aggregate: 'raw', resampling: '1min' }, 'unrelated fields preserved through the spread');
    });

    it('does not touch items belonging to a non-opcua connector', async () => {
      await insertSouthConnector(db, { id: 'south-mssql', type: 'mssql' });
      await insertSouthItem(db, {
        id: 'item-mssql',
        connector_id: 'south-mssql',
        settings: JSON.stringify({ nodeId: 'ns=1;s=node', mode: 'da' })
      });

      await up(db);

      const row = await db('south_items').where('id', 'item-mssql').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.timestampOrigin, undefined, 'non-opcua connector items are not modified');
    });
  });
});
