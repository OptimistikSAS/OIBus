import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import type { SouthItemSettings, SouthSettings } from '../../shared/model/connector/south-settings.model';

import type SouthConnector from '../south/south-connector';
import type { SouthExplore } from '../south/south-interface';
import { createMock, flushPromises, mockModule, reloadModule } from '../tests/utils/test-utils';
import type SouthExploreSessionManagerType from './south-explore-session-manager';

const nodeRequire = createRequire(import.meta.url);

// Mocked module exports: the same object for the whole file, its function is replaced before each test
const utilsExports = { generateRandomId: (): string => '' };

let SouthExploreSessionManager: typeof SouthExploreSessionManagerType;

const buildSouth = (hasExplore = true) =>
  createMock<SouthConnector<SouthSettings, SouthItemSettings> & SouthExplore>({
    hasExplore: () => hasExplore,
    explore: async () => [{ id: 'node1', name: 'Node 1', metadata: { type: 'Object' }, hasChildren: true }]
  });

describe('SouthExploreSessionManager', () => {
  before(() => {
    mockModule(nodeRequire, './utils', utilsExports);
    SouthExploreSessionManager = reloadModule<{ default: typeof SouthExploreSessionManagerType }>(
      nodeRequire,
      './south-explore-session-manager'
    ).default;
  });

  beforeEach(() => {
    let idCounter = 0;
    utilsExports.generateRandomId = () => `session-${(idCounter += 1)}`;
    mock.timers.enable({ apis: ['setTimeout'] });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('should start a session and return a generated id', async () => {
    const manager = new SouthExploreSessionManager();
    const south = buildSouth();

    const sessionId = await manager.start(south);

    assert.strictEqual(sessionId, 'session-1');
  });

  it('should browse an entry within a session', async () => {
    const manager = new SouthExploreSessionManager();
    const south = buildSouth();
    const sessionId = await manager.start(south);

    const entries = await manager.browse(sessionId, 'parent');

    assert.deepStrictEqual(entries, [{ id: 'node1', name: 'Node 1', metadata: { type: 'Object' }, hasChildren: true }]);
    assert.strictEqual(south.explore.mock.calls[0].arguments[0], 'parent');
  });

  it('should throw when browsing an unknown session', async () => {
    const manager = new SouthExploreSessionManager();
    await assert.rejects(() => manager.browse('missing', null), /Explore session "missing" not found/);
  });

  it('should throw when the connector does not support exploration', async () => {
    const manager = new SouthExploreSessionManager();
    const sessionId = await manager.start(buildSouth(false));

    await assert.rejects(() => manager.browse(sessionId, null), /does not support exploration/);
  });

  it('should close a session and stop the connector', async () => {
    const manager = new SouthExploreSessionManager();
    const south = buildSouth();
    const sessionId = await manager.start(south);

    await manager.close(sessionId);

    assert.strictEqual(south.stop.mock.calls.length, 1);
    await assert.rejects(() => manager.browse(sessionId, null), /not found/);
  });

  it('should close a session without stopping a borrowed connector', async () => {
    const manager = new SouthExploreSessionManager();
    const south = buildSouth();
    const sessionId = await manager.start(south, false);

    await manager.close(sessionId);

    assert.strictEqual(south.stop.mock.calls.length, 0);
    await assert.rejects(() => manager.browse(sessionId, null), /not found/);
  });

  it('should ignore closing an unknown session', async () => {
    const manager = new SouthExploreSessionManager();
    await assert.doesNotReject(() => manager.close('missing'));
  });

  it('should close all sessions', async () => {
    const manager = new SouthExploreSessionManager();
    const south1 = buildSouth();
    const south2 = buildSouth();
    await manager.start(south1);
    await manager.start(south2);

    await manager.closeAll();

    assert.strictEqual(south1.stop.mock.calls.length, 1);
    assert.strictEqual(south2.stop.mock.calls.length, 1);
  });

  it('should close a session after the idle timeout elapses', async () => {
    const manager = new SouthExploreSessionManager(1000, 20);
    const south = buildSouth();
    await manager.start(south);

    mock.timers.tick(1000);
    await flushPromises();

    assert.strictEqual(south.stop.mock.calls.length, 1);
  });

  it('should reset the idle timer on browse', async () => {
    const manager = new SouthExploreSessionManager(1000, 20);
    const south = buildSouth();
    const sessionId = await manager.start(south);

    mock.timers.tick(600);
    await manager.browse(sessionId, null);
    mock.timers.tick(600);
    await flushPromises();
    // still open because browse reset the timer
    assert.strictEqual(south.stop.mock.calls.length, 0);

    mock.timers.tick(400);
    await flushPromises();
    assert.strictEqual(south.stop.mock.calls.length, 1);
  });

  it('should evict the oldest session when the maximum is reached', async () => {
    const manager = new SouthExploreSessionManager(600_000, 1);
    const south1 = buildSouth();
    const south2 = buildSouth();
    await manager.start(south1);
    await manager.start(south2);

    // south1 was evicted (stopped) to make room for south2
    assert.strictEqual(south1.stop.mock.calls.length, 1);
    assert.strictEqual(south2.stop.mock.calls.length, 0);
  });

  it('should evict the least-recently-used session, not the oldest', async () => {
    const manager = new SouthExploreSessionManager(600_000, 2);
    const south1 = buildSouth();
    const south2 = buildSouth();
    const south3 = buildSouth();
    const session1 = await manager.start(south1);
    await manager.start(south2);
    // Touch session1 so session2 becomes the least-recently-used
    await manager.browse(session1, null);
    await manager.start(south3);

    // south2 (LRU) evicted; south1 (recently used) kept
    assert.strictEqual(south1.stop.mock.calls.length, 0);
    assert.strictEqual(south2.stop.mock.calls.length, 1);
    assert.strictEqual(south3.stop.mock.calls.length, 0);
  });
});
