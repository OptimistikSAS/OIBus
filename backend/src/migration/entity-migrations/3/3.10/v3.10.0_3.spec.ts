import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { buildPreMigrationSchema } from '../../../../tests/utils/test-utils';
import { down, up } from './v3.10.0_3';

const NOW = '2024-01-01T00:00:00.000Z';

const OLD_PI_SETTINGS = {
  agentUrl: 'http://ip-adress-or-host:2224',
  retryInterval: 10000
};

describe('Entity migration v3.10.0_3', () => {
  let db: Knex;

  after(async () => {
    await db?.destroy();
  });

  beforeEach(async () => {
    await db?.destroy();
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
    await buildPreMigrationSchema(db, 'v3.10.0_3');
  });

  it('runs end-to-end on a realistic pre-3.10.0_3 schema', async () => {
    await up(db); // must not throw
  });

  it('drops agentUrl from a PI south connector, preserving retryInterval', async () => {
    await db('south_connectors').insert({
      id: 'pi1',
      name: 'PI 1',
      type: 'osisoft-pi',
      enabled: true,
      settings: JSON.stringify(OLD_PI_SETTINGS)
    });

    await up(db);

    const row = await db('south_connectors').where('id', 'pi1').first();
    assert.deepStrictEqual(JSON.parse(row.settings), { retryInterval: 10000 });
  });

  it('drops agentUrl from a history query with a PI south', async () => {
    await db('scan_modes').insert({ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' });
    await db('history_queries').insert({
      id: 'hq-pi',
      name: 'HQ PI',
      start_time: NOW,
      end_time: NOW,
      south_type: 'osisoft-pi',
      north_type: 'file-writer',
      south_settings: JSON.stringify(OLD_PI_SETTINGS),
      north_settings: JSON.stringify({}),
      caching_trigger_schedule: 'sm1',
      caching_trigger_number_of_elements: 1000,
      caching_trigger_number_of_files: 1,
      caching_throttling_cache_max_size: 0,
      caching_throttling_max_number_of_elements: 10_000,
      caching_error_retry_interval: 5000,
      caching_error_retry_count: 3,
      caching_archive_enabled: false,
      caching_archive_retention_duration: 0
    });

    await up(db);

    const row = await db('history_queries').where('id', 'hq-pi').first();
    assert.deepStrictEqual(JSON.parse(row.south_settings), { retryInterval: 10000 });
  });

  it('converts point-id and point-query south items to a single piPoint field', async () => {
    await db('scan_modes').insert({ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' });
    await db('south_connectors').insert({
      id: 'pi3',
      name: 'PI 3',
      type: 'osisoft-pi',
      enabled: true,
      settings: JSON.stringify(OLD_PI_SETTINGS)
    });
    await db('south_items').insert([
      {
        id: 'item-id',
        connector_id: 'pi3',
        scan_mode_id: 'sm1',
        name: 'item-id',
        enabled: true,
        settings: JSON.stringify({ type: 'point-id', piPoint: 'FACTORY.WORKSHOP.POINT.ID1' })
      },
      {
        id: 'item-query',
        connector_id: 'pi3',
        scan_mode_id: 'sm1',
        name: 'item-query',
        enabled: true,
        settings: JSON.stringify({ type: 'point-query', piQuery: 'sinu*' })
      }
    ]);

    await up(db);

    const idRow = await db('south_items').where('id', 'item-id').first();
    const queryRow = await db('south_items').where('id', 'item-query').first();
    assert.deepStrictEqual(JSON.parse(idRow.settings), { piPoint: 'FACTORY.WORKSHOP.POINT.ID1' });
    assert.deepStrictEqual(JSON.parse(queryRow.settings), { piPoint: 'sinu*' });
  });

  it('converts point-id and point-query history items to a single piPoint field', async () => {
    await db('scan_modes').insert({ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' });
    await db('history_queries').insert({
      id: 'hq-pi2',
      name: 'HQ PI 2',
      start_time: NOW,
      end_time: NOW,
      south_type: 'osisoft-pi',
      north_type: 'file-writer',
      south_settings: JSON.stringify(OLD_PI_SETTINGS),
      north_settings: JSON.stringify({}),
      caching_trigger_schedule: 'sm1',
      caching_trigger_number_of_elements: 1000,
      caching_trigger_number_of_files: 1,
      caching_throttling_cache_max_size: 0,
      caching_throttling_max_number_of_elements: 10_000,
      caching_error_retry_interval: 5000,
      caching_error_retry_count: 3,
      caching_archive_enabled: false,
      caching_archive_retention_duration: 0
    });
    await db('history_items').insert([
      {
        id: 'hitem-id',
        history_id: 'hq-pi2',
        name: 'hitem-id',
        enabled: true,
        settings: JSON.stringify({ type: 'point-id', piPoint: 'FACTORY.WORKSHOP.POINT.ID1' })
      },
      {
        id: 'hitem-query',
        history_id: 'hq-pi2',
        name: 'hitem-query',
        enabled: true,
        settings: JSON.stringify({ type: 'point-query', piQuery: 'sinu*' })
      }
    ]);

    await up(db);

    const idRow = await db('history_items').where('id', 'hitem-id').first();
    const queryRow = await db('history_items').where('id', 'hitem-query').first();
    assert.deepStrictEqual(JSON.parse(idRow.settings), { piPoint: 'FACTORY.WORKSHOP.POINT.ID1' });
    assert.deepStrictEqual(JSON.parse(queryRow.settings), { piPoint: 'sinu*' });
  });

  it('does not touch items of south connectors of other types', async () => {
    await db('scan_modes').insert({ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' });
    await db('south_connectors').insert({
      id: 'mysql2',
      name: 'MySQL 2',
      type: 'mysql',
      enabled: true,
      settings: JSON.stringify({ host: 'h', port: 1, database: 'd', connectionTimeout: 1000 })
    });
    const otherSettings = { query: 'SELECT * FROM t1' };
    await db('south_items').insert({
      id: 'mysql-item',
      connector_id: 'mysql2',
      scan_mode_id: 'sm1',
      name: 'mysql-item',
      enabled: true,
      settings: JSON.stringify(otherSettings)
    });

    await up(db);

    const row = await db('south_items').where('id', 'mysql-item').first();
    assert.deepStrictEqual(JSON.parse(row.settings), otherSettings);
  });

  it('does not touch settings of south connectors of other types', async () => {
    const oldSettings = { host: 'h', port: 1, database: 'd', connectionTimeout: 1000 };
    await db('south_connectors').insert({
      id: 'mysql1',
      name: 'MySQL 1',
      type: 'mysql',
      enabled: true,
      settings: JSON.stringify(oldSettings)
    });

    await up(db);

    const row = await db('south_connectors').where('id', 'mysql1').first();
    assert.deepStrictEqual(JSON.parse(row.settings), oldSettings);
  });

  it('down is a no-op', async () => {
    await db('south_connectors').insert({
      id: 'pi2',
      name: 'PI 2',
      type: 'osisoft-pi',
      enabled: true,
      settings: JSON.stringify(OLD_PI_SETTINGS)
    });
    await up(db);
    await down(db);
    const row = await db('south_connectors').where('id', 'pi2').first();
    assert.strictEqual(JSON.parse(row.settings).agentUrl, undefined, 'down does not revert the up() migration');
  });
});
