import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import ScanModeRepository, { scanModeAliasedColumns, scanModeColumns, toScanMode, toScanModeFromPrefixedRow } from './scan-mode.repository';
import { ActivationWindow, ScanModeInterval } from '../../../shared/model/scan-mode.model';

const TEST_DB_PATH = 'src/tests/test-config-scan-mode.db';

const intervalCommand: ScanModeInterval = { value: 30, unit: 's' };
const activationWindowCommand: ActivationWindow = {
  dateRange: { start: '2026-08-01T00:00:00.000Z', end: '2026-08-31T00:00:00.000Z' },
  recurring: { timezone: 'Europe/Paris', daysOfWeek: [1, 2, 3], timeOfDay: { start: '22:00', end: '02:00' } }
};

let database: Database;
describe('ScanModeRepository with populated database', () => {
  before(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: ScanModeRepository;
  let createdId: string;

  beforeEach(() => {
    repository = new ScanModeRepository(database);
  });

  it('should properly get all scan modes', () => {
    assert.strictEqual(repository.findAll().length, testData.scanMode.list.length);
  });

  it('should properly get a scan mode', () => {
    assert.deepStrictEqual(
      stripAuditFields(repository.findById(testData.scanMode.list[0].id)),
      stripAuditFields(testData.scanMode.list[0])
    );
    assert.strictEqual(repository.findById('badId'), null);
  });

  it('should create a cron scan mode', () => {
    const created = repository.create(testData.scanMode.command, 'userTest');
    createdId = created.id;
    assert.ok(createdId);
    assert.strictEqual(created.createdBy, 'userTest');
    assert.strictEqual(created.updatedBy, 'userTest');
    assert.strictEqual(created.name, testData.scanMode.command.name);
    assert.strictEqual(created.description, testData.scanMode.command.description);
    assert.strictEqual(created.type, 'cron');
    assert.strictEqual(created.cron, testData.scanMode.command.cron);
    assert.strictEqual(created.interval, null);
    assert.strictEqual(created.activationWindow, null);
  });

  it('should create an interval scan mode, normalizing cron to an empty string', () => {
    const created = repository.create(
      { ...testData.scanMode.command, name: 'interval scan mode', type: 'interval', cron: '* * * * * *', interval: intervalCommand },
      'userTest'
    );
    assert.strictEqual(created.type, 'interval');
    assert.strictEqual(created.cron, '');
    assert.deepStrictEqual(created.interval, intervalCommand);

    const fetched = repository.findById(created.id)!;
    assert.deepStrictEqual(fetched.interval, intervalCommand);
    assert.strictEqual(fetched.cron, '');
  });

  it('should create a scan mode with an activation window', () => {
    const created = repository.create(
      { ...testData.scanMode.command, name: 'scan mode with activation window', activationWindow: activationWindowCommand },
      'userTest'
    );
    assert.deepStrictEqual(created.activationWindow, activationWindowCommand);

    const fetched = repository.findById(created.id)!;
    assert.deepStrictEqual(fetched.activationWindow, activationWindowCommand);
  });

  it('should not persist an interval when type is cron, even if interval is provided', () => {
    const created = repository.create(
      { ...testData.scanMode.command, name: 'cron scan mode with ignored interval', type: 'cron', interval: intervalCommand },
      'userTest'
    );
    assert.strictEqual(created.type, 'cron');
    assert.strictEqual(created.interval, null);
  });

  it('should update a scan mode', () => {
    repository.update(createdId, testData.scanMode.command, 'userTest');
    const result = repository.findById(createdId)!;
    assert.strictEqual(result.name, testData.scanMode.command.name);
    assert.strictEqual(result.updatedBy, 'userTest');
    assert.strictEqual(result.type, 'cron');
    assert.strictEqual(result.cron, testData.scanMode.command.cron);
    assert.strictEqual(result.interval, null);
    assert.strictEqual(result.activationWindow, null);
  });

  it('should update a scan mode to an interval type and back to cron', () => {
    repository.update(createdId, { ...testData.scanMode.command, type: 'interval', interval: intervalCommand }, 'userTest');
    const updatedToInterval = repository.findById(createdId)!;
    assert.strictEqual(updatedToInterval.type, 'interval');
    assert.strictEqual(updatedToInterval.cron, '');
    assert.deepStrictEqual(updatedToInterval.interval, intervalCommand);

    repository.update(createdId, testData.scanMode.command, 'userTest');
    const updatedToCron = repository.findById(createdId)!;
    assert.strictEqual(updatedToCron.type, 'cron');
    assert.strictEqual(updatedToCron.cron, testData.scanMode.command.cron);
    assert.strictEqual(updatedToCron.interval, null);
  });

  it('should update the activation window of a scan mode', () => {
    repository.update(createdId, { ...testData.scanMode.command, activationWindow: activationWindowCommand }, 'userTest');
    const updated = repository.findById(createdId)!;
    assert.deepStrictEqual(updated.activationWindow, activationWindowCommand);

    repository.update(createdId, testData.scanMode.command, 'userTest');
    const cleared = repository.findById(createdId)!;
    assert.strictEqual(cleared.activationWindow, null);
  });

  it('should delete a scan mode', () => {
    assert.notStrictEqual(repository.findById(createdId), null);
    repository.delete(createdId);
    assert.strictEqual(repository.findById(createdId), null);
  });
});

describe('ScanModeRepository with empty database', () => {
  before(async () => {
    database = await initDatabase('config', false, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  it('should properly init scan mode table with default scan modes', () => {
    const repository = new ScanModeRepository(database);
    // 7 default scan modes are created (6 with generated IDs + 1 with hardcoded 'subscription' id)
    const all = repository.findAll();
    assert.strictEqual(all.length, 7);
    assert.ok(all.every(scanMode => scanMode.type === 'cron'));
    assert.ok(all.every(scanMode => scanMode.interval === null));
    assert.ok(all.every(scanMode => scanMode.activationWindow === null));

    const subscription = repository.findById('subscription')!;
    assert.strictEqual(subscription.cron, '');
  });
});

describe('scan-mode column helpers', () => {
  it('should build a plain column list', () => {
    assert.strictEqual(
      scanModeColumns(),
      'id, name, description, type, cron, interval, activation_window, created_by, updated_by, created_at, updated_at'
    );
  });

  it('should build an aliased column list qualified with a table alias', () => {
    assert.strictEqual(
      scanModeColumns('sm'),
      'sm.id, sm.name, sm.description, sm.type, sm.cron, sm.interval, sm.activation_window, sm.created_by, sm.updated_by, sm.created_at, sm.updated_at'
    );
  });

  it('should build a column list aliased for a JOIN with a prefix', () => {
    assert.strictEqual(
      scanModeAliasedColumns('sm', 'sm_'),
      'sm.id AS sm_id, sm.name AS sm_name, sm.description AS sm_description, sm.type AS sm_type, sm.cron AS sm_cron, ' +
        'sm.interval AS sm_interval, sm.activation_window AS sm_activation_window, sm.created_by AS sm_created_by, ' +
        'sm.updated_by AS sm_updated_by, sm.created_at AS sm_created_at, sm.updated_at AS sm_updated_at'
    );
  });

  it('should hydrate a scan mode from a prefixed JOIN row', () => {
    const row = {
      other_column: 'ignored',
      sm_id: 'scanModeId1',
      sm_name: 'scanMode1',
      sm_description: 'my first scanMode',
      sm_type: 'interval',
      sm_cron: '',
      sm_interval: JSON.stringify(intervalCommand),
      sm_activation_window: JSON.stringify(activationWindowCommand),
      sm_created_by: 'system',
      sm_updated_by: 'system',
      sm_created_at: '2020-01-01T00:00:00.000Z',
      sm_updated_at: '2020-01-01T00:00:00.000Z'
    };

    assert.deepStrictEqual(toScanModeFromPrefixedRow(row, 'sm_'), {
      id: 'scanModeId1',
      name: 'scanMode1',
      description: 'my first scanMode',
      type: 'interval',
      cron: '',
      interval: intervalCommand,
      activationWindow: activationWindowCommand,
      createdBy: 'system',
      updatedBy: 'system',
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z'
    });
  });

  it('should default type to cron and leave interval/activation window null when columns are missing', () => {
    const row = {
      sm_id: 'scanModeId1',
      sm_name: 'scanMode1',
      sm_description: 'my first scanMode',
      sm_cron: '* * * * * *',
      sm_created_by: 'system',
      sm_updated_by: 'system',
      sm_created_at: '2020-01-01T00:00:00.000Z',
      sm_updated_at: '2020-01-01T00:00:00.000Z'
    };

    const scanMode = toScanModeFromPrefixedRow(row, 'sm_');
    assert.strictEqual(scanMode.type, 'cron');
    assert.strictEqual(scanMode.interval, null);
    assert.strictEqual(scanMode.activationWindow, null);
  });

  it('should default cron to an empty string when the row has no cron column', () => {
    const scanMode = toScanMode({
      id: 'scanModeId1',
      name: 'scanMode1',
      description: 'my first scanMode',
      type: 'cron',
      cron: null,
      interval: null,
      activation_window: null,
      created_by: 'system',
      updated_by: 'system',
      created_at: '2020-01-01T00:00:00.000Z',
      updated_at: '2020-01-01T00:00:00.000Z'
    });
    assert.strictEqual(scanMode.cron, '');
  });

  it('should default all prefixed columns to null when none are present on the row', () => {
    const scanMode = toScanModeFromPrefixedRow({ unrelated_column: 'ignored' }, 'sm_');
    assert.strictEqual(scanMode.cron, '');
    assert.strictEqual(scanMode.type, 'cron');
    assert.strictEqual(scanMode.interval, null);
    assert.strictEqual(scanMode.activationWindow, null);
  });
});
