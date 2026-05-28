import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { PinoLog } from '../../model/logs.model';
import { reloadModule } from '../../tests/utils/test-utils';

const nodeRequire = createRequire(import.meta.url);

type SqliteTransportOptions = { filename: string; maxNumberOfLogs: number };
type CreateTransport = (opts: SqliteTransportOptions) => unknown;

let createTransport: CreateTransport;

// Per-test mock handles set up in beforeEach and used by the mock constructors
let mockRepoCount: ReturnType<typeof mock.fn>;
let mockRepoSaveAll: ReturnType<typeof mock.fn>;
let mockRepoDelete: ReturnType<typeof mock.fn>;
let mockDbPragma: ReturnType<typeof mock.fn>;
let mockDbClose: ReturnType<typeof mock.fn>;

// Capture build() arguments so tests can drive the source and close handlers
let capturedSourceFn: ((source: AsyncIterable<PinoLog>) => Promise<void>) | null = null;
let capturedCloseFn: (() => Promise<void>) | null = null;

before(() => {
  // Mock LogRepository — constructor captures the current per-test mock functions
  class LogRepositoryMock {
    count: ReturnType<typeof mock.fn>;
    saveAll: ReturnType<typeof mock.fn>;
    delete: ReturnType<typeof mock.fn>;

    constructor(_db: unknown) {
      this.count = mockRepoCount;
      this.saveAll = mockRepoSaveAll;
      this.delete = mockRepoDelete;
    }
  }
  nodeRequire('../../repository/logs/log.repository');
  const logRepoPath = nodeRequire.resolve('../../repository/logs/log.repository');
  nodeRequire.cache[logRepoPath]!.exports = { __esModule: true, default: LogRepositoryMock };

  // Mock better-sqlite3 — returns an object with pragma/close captured per test
  const DatabaseMock = (_filename: string) => ({
    pragma: mockDbPragma,
    close: mockDbClose
  });
  nodeRequire('better-sqlite3');
  const sqlitePath = nodeRequire.resolve('better-sqlite3');
  nodeRequire.cache[sqlitePath]!.exports = DatabaseMock;

  // Mock pino-abstract-transport — captures the source and close handlers for test use
  const buildMock = (
    sourceFn: (source: AsyncIterable<PinoLog>) => Promise<void>,
    opts: { close: () => Promise<void> }
  ) => {
    capturedSourceFn = sourceFn;
    capturedCloseFn = opts.close;
    return {};
  };
  nodeRequire('pino-abstract-transport');
  const pinoAbstractPath = nodeRequire.resolve('pino-abstract-transport');
  nodeRequire.cache[pinoAbstractPath]!.exports = { __esModule: true, default: buildMock };

  createTransport = reloadModule<{ default: CreateTransport }>(nodeRequire, './sqlite-transport').default;
});

beforeEach(() => {
  mockRepoCount = mock.fn(() => 0);
  mockRepoSaveAll = mock.fn();
  mockRepoDelete = mock.fn(() => 0);
  mockDbPragma = mock.fn();
  mockDbClose = mock.fn();
  capturedSourceFn = null;
  capturedCloseFn = null;
  mock.timers.enable(['setTimeout', 'clearTimeout']);
});

afterEach(() => {
  mock.timers.reset();
  mock.restoreAll();
});

describe('SqliteTransport (createTransport)', () => {
  it('should initialise the database, set WAL pragmas, load log count, and schedule the first flush', () => {
    createTransport({ filename: 'test.db', maxNumberOfLogs: 100 });

    assert.ok(mockDbPragma.mock.calls.length >= 3, 'pragma should be called at least 3 times');
    assert.strictEqual(mockRepoCount.mock.calls.length, 1);
    assert.ok(capturedSourceFn !== null, 'build() source handler should be captured');
    assert.ok(capturedCloseFn !== null, 'build() close handler should be captured');
  });

  it('should delete old logs when count >= maxNumberOfLogs on construction', () => {
    mockRepoCount = mock.fn(() => 100);
    mockRepoDelete = mock.fn(() => 20);

    createTransport({ filename: 'test.db', maxNumberOfLogs: 100 });

    assert.strictEqual(mockRepoDelete.mock.calls.length, 1);
  });

  it('should catch and log errors thrown during construction', () => {
    mockRepoCount = mock.fn(() => {
      throw new Error('DB init error');
    });
    const consoleSpy = mock.method(console, 'error', () => undefined);

    createTransport({ filename: 'test.db', maxNumberOfLogs: 100 });

    assert.ok(consoleSpy.mock.calls.length > 0);
    mock.restoreAll();
  });

  it('source handler should push each log into the batch via log()', async () => {
    createTransport({ filename: 'test.db', maxNumberOfLogs: 1000 });

    const log: PinoLog = { msg: 'hello', level: '30', scopeType: 'internal', scopeId: null, scopeName: null, time: '2020-01-01T00:00:00.000Z' };

    async function* makeSource() {
      yield log;
    }

    await capturedSourceFn!(makeSource());

    // When the batch-write timer fires the log should be saved
    mock.timers.tick(700);
    assert.strictEqual(mockRepoSaveAll.mock.calls.length, 1);
    assert.deepStrictEqual(mockRepoSaveAll.mock.calls[0].arguments[0], [log]);
  });

  it('close handler should call writeLogs(true) and close the database', async () => {
    createTransport({ filename: 'test.db', maxNumberOfLogs: 1000 });

    const log: PinoLog = { msg: 'bye', level: '20', scopeType: 'internal', scopeId: null, scopeName: null, time: '2020-01-01T00:00:00.000Z' };

    async function* makeSource() {
      yield log;
    }
    await capturedSourceFn!(makeSource());

    await capturedCloseFn!();

    assert.strictEqual(mockRepoSaveAll.mock.calls.length, 1);
    assert.strictEqual(mockDbClose.mock.calls.length, 1);
  });

  it('writeLogs should not call saveAll when batch is empty', () => {
    createTransport({ filename: 'test.db', maxNumberOfLogs: 1000 });

    mock.timers.tick(700);

    assert.strictEqual(mockRepoSaveAll.mock.calls.length, 0);
    // Next interval should have been scheduled
    mock.timers.tick(700);
    assert.strictEqual(mockRepoSaveAll.mock.calls.length, 0);
  });

  it('writeLogs should call deleteOldLogs when total exceeds maxNumberOfLogs after flush', async () => {
    mockRepoCount = mock.fn(() => 90);
    mockRepoDelete = mock.fn(() => 10);

    createTransport({ filename: 'test.db', maxNumberOfLogs: 100 });

    // Add 15 logs (90 + 15 = 105 > 100)
    const logs = Array.from({ length: 15 }, (_, i) => ({
      msg: `log ${i}`,
      level: '30',
      scopeType: 'internal' as const,
      scopeId: null,
      scopeName: null,
      time: '2020-01-01T00:00:00.000Z'
    }));

    async function* makeSource() {
      for (const l of logs) yield l;
    }
    await capturedSourceFn!(makeSource());

    mock.timers.tick(700);

    assert.strictEqual(mockRepoSaveAll.mock.calls.length, 1);
    assert.strictEqual(mockRepoDelete.mock.calls.length, 1);
  });

  it('writeLogs should catch and log errors thrown by repository.saveAll', async () => {
    mockRepoSaveAll = mock.fn(() => {
      throw new Error('save error');
    });
    const consoleSpy = mock.method(console, 'error', () => undefined);

    createTransport({ filename: 'test.db', maxNumberOfLogs: 1000 });

    const log: PinoLog = { msg: 'err', level: '50', scopeType: 'internal', scopeId: null, scopeName: null, time: '2020-01-01T00:00:00.000Z' };

    async function* makeSource() {
      yield log;
    }
    await capturedSourceFn!(makeSource());

    mock.timers.tick(700);

    assert.ok(consoleSpy.mock.calls.length > 0);
    mock.restoreAll();
  });

  it('writeLogs with ending=true should not reschedule the interval', async () => {
    createTransport({ filename: 'test.db', maxNumberOfLogs: 1000 });

    const log: PinoLog = { msg: 'final', level: '30', scopeType: 'internal', scopeId: null, scopeName: null, time: '2020-01-01T00:00:00.000Z' };
    async function* makeSource() { yield log; }
    await capturedSourceFn!(makeSource());

    await capturedCloseFn!(); // calls writeLogs(ending=true)

    assert.strictEqual(mockRepoSaveAll.mock.calls.length, 1);
    // Ticking further should NOT trigger another saveAll (no rescheduled timer)
    mock.timers.tick(700);
    assert.strictEqual(mockRepoSaveAll.mock.calls.length, 1);
  });

  it('should use DEFAULT_MAX_NUMBER_OF_LOGS when maxNumberOfLogs is 0', () => {
    mockRepoCount = mock.fn(() => 0);

    createTransport({ filename: 'test.db', maxNumberOfLogs: 0 });

    assert.strictEqual(mockRepoCount.mock.calls.length, 1);
  });
});
