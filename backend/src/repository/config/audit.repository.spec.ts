import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import AuditRepository from './audit.repository';
import { AuditLog } from '../../model/audit.model';

const TEST_DB_PATH = 'src/tests/test-config-audit.db';

let database: Database;
describe('AuditRepository', () => {
  before(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: AuditRepository;

  beforeEach(() => {
    database.prepare('DELETE FROM audit_logs;').run();
    repository = new AuditRepository(database);
  });

  function insertRaw(row: {
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    previousState: string | null;
    newState: string | null;
    userId: string;
    createdAt: string;
  }): void {
    database
      .prepare(
        `INSERT INTO audit_logs (id, entity_type, entity_id, action, previous_state, new_state, user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`
      )
      .run(row.id, row.entityType, row.entityId, row.action, row.previousState, row.newState, row.userId, row.createdAt);
  }

  describe('record()', () => {
    it('should insert a CREATE audit log with a null previous state', () => {
      repository.record('south_connector', 'south1', 'CREATE', null, { name: 'my south' }, 'userTest', 'audit1');

      const result = repository.findByEntity('south_connector', 'south1');
      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0], {
        id: 'audit1',
        entityType: 'south_connector',
        entityId: 'south1',
        action: 'CREATE',
        previousState: null,
        newState: { name: 'my south' },
        userId: 'userTest',
        createdAt: result[0].createdAt
      });
      assert.ok(result[0].createdAt);
    });

    it('should insert a DELETE audit log with a null new state', () => {
      repository.record('north_connector', 'north1', 'DELETE', { name: 'my north' }, null, 'userTest', 'audit2');

      const result = repository.findByEntity('north_connector', 'north1');
      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0].previousState, { name: 'my north' });
      assert.strictEqual(result[0].newState, null);
      assert.strictEqual(result[0].action, 'DELETE');
    });

    it('should insert an UPDATE audit log with both states populated and round-trip the JSON', () => {
      const previousState = { name: 'old name', settings: { port: 502 } };
      const newState = { name: 'new name', settings: { port: 503 } };
      repository.record('south_connector', 'south2', 'UPDATE', previousState, newState, 'userTest', 'audit3');

      const result = repository.findByEntity('south_connector', 'south2');
      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0].previousState, previousState);
      assert.deepStrictEqual(result[0].newState, newState);
      assert.strictEqual(result[0].userId, 'userTest');
    });

    it('should generate a random id when none is provided', () => {
      repository.record('scan_mode', 'scan1', 'CREATE', null, { name: 'my scan mode' }, 'userTest');

      const result = repository.findByEntity('scan_mode', 'scan1');
      assert.strictEqual(result.length, 1);
      assert.ok(result[0].id);
    });
  });

  describe('search()', () => {
    beforeEach(() => {
      insertRaw({
        id: 'audit1',
        entityType: 'south_connector',
        entityId: 'south1',
        action: 'CREATE',
        previousState: null,
        newState: JSON.stringify({ name: 'south1' }),
        userId: 'user1',
        createdAt: '2020-01-01T00:00:00.000Z'
      });
      insertRaw({
        id: 'audit2',
        entityType: 'south_connector',
        entityId: 'south1',
        action: 'UPDATE',
        previousState: JSON.stringify({ name: 'south1' }),
        newState: JSON.stringify({ name: 'south1-renamed' }),
        userId: 'user2',
        createdAt: '2021-06-15T00:00:00.000Z'
      });
      insertRaw({
        id: 'audit3',
        entityType: 'north_connector',
        entityId: 'north1',
        action: 'DELETE',
        previousState: JSON.stringify({ name: 'north1' }),
        newState: null,
        userId: 'user1',
        createdAt: '2022-01-01T00:00:00.000Z'
      });
    });

    it('should return all elements with the correct page shape when no filter is applied', () => {
      const result = repository.search({ page: 0 });
      assert.strictEqual(result.totalElements, 3);
      assert.strictEqual(result.totalPages, 1);
      assert.strictEqual(result.size, 50);
      assert.strictEqual(result.number, 0);
      assert.strictEqual(result.content.length, 3);
      // ordered newest first
      assert.deepStrictEqual(
        result.content.map(element => element.id),
        ['audit3', 'audit2', 'audit1']
      );
    });

    it('should filter by entityType', () => {
      const result = repository.search({ entityType: 'north_connector', page: 0 });
      assert.strictEqual(result.totalElements, 1);
      assert.strictEqual(result.content[0].id, 'audit3');
    });

    it('should filter by entityId', () => {
      const result = repository.search({ entityId: 'south1', page: 0 });
      assert.strictEqual(result.totalElements, 2);
      assert.deepStrictEqual(
        result.content.map(element => element.id),
        ['audit2', 'audit1']
      );
    });

    it('should filter by action', () => {
      const result = repository.search({ action: 'UPDATE', page: 0 });
      assert.strictEqual(result.totalElements, 1);
      assert.strictEqual(result.content[0].id, 'audit2');
    });

    it('should filter by start date', () => {
      const result = repository.search({ start: '2021-01-01T00:00:00.000Z', page: 0 });
      assert.strictEqual(result.totalElements, 2);
      assert.deepStrictEqual(
        result.content.map(element => element.id),
        ['audit3', 'audit2']
      );
    });

    it('should filter by end date', () => {
      const result = repository.search({ end: '2021-01-01T00:00:00.000Z', page: 0 });
      assert.strictEqual(result.totalElements, 1);
      assert.strictEqual(result.content[0].id, 'audit1');
    });

    it('should filter by a start/end date range combined', () => {
      const result = repository.search({
        start: '2020-06-01T00:00:00.000Z',
        end: '2021-12-31T00:00:00.000Z',
        page: 0
      });
      assert.strictEqual(result.totalElements, 1);
      assert.strictEqual(result.content[0].id, 'audit2');
    });

    it('should combine multiple filters', () => {
      const result = repository.search({ entityType: 'south_connector', entityId: 'south1', action: 'CREATE', page: 0 });
      assert.strictEqual(result.totalElements, 1);
      assert.strictEqual(result.content[0].id, 'audit1');
    });

    it('should return 0 results for an out-of-range filter', () => {
      const result = repository.search({ entityType: 'south_connector', entityId: 'unknown-entity', page: 0 });
      assert.strictEqual(result.totalElements, 0);
      assert.strictEqual(result.totalPages, 0);
      assert.strictEqual(result.content.length, 0);
    });
  });

  describe('findByEntity()', () => {
    it('should return only rows for the given entity, ordered newest first', () => {
      insertRaw({
        id: 'audit1',
        entityType: 'south_connector',
        entityId: 'south1',
        action: 'CREATE',
        previousState: null,
        newState: JSON.stringify({ name: 'south1' }),
        userId: 'user1',
        createdAt: '2020-01-01T00:00:00.000Z'
      });
      insertRaw({
        id: 'audit2',
        entityType: 'south_connector',
        entityId: 'south1',
        action: 'UPDATE',
        previousState: JSON.stringify({ name: 'south1' }),
        newState: JSON.stringify({ name: 'south1-renamed' }),
        userId: 'user2',
        createdAt: '2021-06-15T00:00:00.000Z'
      });
      insertRaw({
        id: 'audit3',
        entityType: 'north_connector',
        entityId: 'north1',
        action: 'DELETE',
        previousState: JSON.stringify({ name: 'north1' }),
        newState: null,
        userId: 'user1',
        createdAt: '2022-01-01T00:00:00.000Z'
      });

      const result: Array<AuditLog> = repository.findByEntity('south_connector', 'south1');
      assert.deepStrictEqual(
        result.map(element => element.id),
        ['audit2', 'audit1']
      );
    });

    it('should return an empty array when no audit log exists for the entity', () => {
      const result = repository.findByEntity('south_connector', 'unknown-entity');
      assert.deepStrictEqual(result, []);
    });
  });

  describe('deleteOlderThan()', () => {
    it('should delete only rows strictly older than the cutoff', () => {
      insertRaw({
        id: 'audit1',
        entityType: 'south_connector',
        entityId: 'south1',
        action: 'CREATE',
        previousState: null,
        newState: JSON.stringify({ name: 'south1' }),
        userId: 'user1',
        createdAt: '2020-01-01T00:00:00.000Z'
      });
      insertRaw({
        id: 'audit2',
        entityType: 'south_connector',
        entityId: 'south1',
        action: 'UPDATE',
        previousState: JSON.stringify({ name: 'south1' }),
        newState: JSON.stringify({ name: 'south1-renamed' }),
        userId: 'user2',
        createdAt: '2021-06-15T00:00:00.000Z'
      });
      insertRaw({
        id: 'audit3',
        entityType: 'north_connector',
        entityId: 'north1',
        action: 'DELETE',
        previousState: JSON.stringify({ name: 'north1' }),
        newState: null,
        userId: 'user1',
        createdAt: '2021-06-15T00:00:00.000Z'
      });

      repository.deleteOlderThan('2021-06-15T00:00:00.000Z');

      const remaining = repository.search({ page: 0 });
      assert.deepStrictEqual(remaining.content.map(element => element.id).sort(), ['audit2', 'audit3']);
    });
  });
});
