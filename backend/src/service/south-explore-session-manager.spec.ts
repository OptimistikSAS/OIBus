import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mockModule, reloadModule, flushPromises } from '../tests/utils/test-utils';
import SouthConnectorMock from '../tests/__mocks__/south-connector.mock';
import testData from '../tests/utils/test-data';
import type SouthExploreSessionManagerType from './south-explore-session-manager';
import type SouthConnector from '../south/south-connector';
import type { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';

const nodeRequire = createRequire(import.meta.url);

let SouthExploreSessionManager: typeof SouthExploreSessionManagerType;

let idCounter = 0;
const utilsExports = {
  generateRandomId: mock.fn(() => `session-${(idCounter += 1)}`)
};

const buildSouth = (): SouthConnector<SouthSettings, SouthItemSettings> => {
  const south = new SouthConnectorMock(testData.south.list[0]) as unknown as SouthConnectorMock;
  south.hasExplore.mock.mockImplementation(() => true);
  south.explore.mock.mockImplementation(async () => [{ id: 'node1', name: 'Node 1', type: 'Object', hasChildren: true }]);
  return south as unknown as SouthConnector<SouthSettings, SouthItemSettings>;
};

describe('SouthExploreSessionManager', () => {
  before(() => {
    mockModule(nodeRequire, './utils', utilsExports);
    SouthExploreSessionManager = reloadModule<{ default: typeof SouthExploreSessionManagerType }>(
      nodeRequire,
      './south-explore-session-manager'
    ).default;
  });

  beforeEach(() => {
    idCounter = 0;
    utilsExports.generateRandomId.mock.resetCalls();
    utilsExports.generateRandomId.mock.mockImplementation(() => `session-${(idCounter += 1)}`);
    mock.timers.enable({ apis: ['setTimeout'] });
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
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

    assert.deepStrictEqual(entries, [{ id: 'node1', name: 'Node 1', type: 'Object', hasChildren: true }]);
    assert.strictEqual((south as unknown as SouthConnectorMock).explore.mock.calls[0].arguments[0], 'parent');
  });

  it('should throw when browsing an unknown session', async () => {
    const manager = new SouthExploreSessionManager();
    await assert.rejects(() => manager.browse('missing', null), /Explore session "missing" not found/);
  });

  it('should throw when the connector does not support exploration', async () => {
    const manager = new SouthExploreSessionManager();
    const south = new SouthConnectorMock(testData.south.list[0]);
    south.hasExplore.mock.mockImplementation(() => false);
    const sessionId = await manager.start(south as unknown as SouthConnector<SouthSettings, SouthItemSettings>);

    await assert.rejects(() => manager.browse(sessionId, null), /does not support exploration/);
  });

  it('should close a session and stop the connector', async () => {
    const manager = new SouthExploreSessionManager();
    const south = buildSouth();
    const sessionId = await manager.start(south);

    await manager.close(sessionId);

    assert.strictEqual((south as unknown as SouthConnectorMock).stop.mock.calls.length, 1);
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

    assert.strictEqual((south1 as unknown as SouthConnectorMock).stop.mock.calls.length, 1);
    assert.strictEqual((south2 as unknown as SouthConnectorMock).stop.mock.calls.length, 1);
  });

  it('should close a session after the idle timeout elapses', async () => {
    const manager = new SouthExploreSessionManager(1000, 20);
    const south = buildSouth();
    await manager.start(south);

    mock.timers.tick(1000);
    await flushPromises();

    assert.strictEqual((south as unknown as SouthConnectorMock).stop.mock.calls.length, 1);
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
    assert.strictEqual((south as unknown as SouthConnectorMock).stop.mock.calls.length, 0);

    mock.timers.tick(400);
    await flushPromises();
    assert.strictEqual((south as unknown as SouthConnectorMock).stop.mock.calls.length, 1);
  });

  it('should evict the oldest session when the maximum is reached', async () => {
    const manager = new SouthExploreSessionManager(600_000, 1);
    const south1 = buildSouth();
    const south2 = buildSouth();
    await manager.start(south1);
    await manager.start(south2);

    // south1 was evicted (stopped) to make room for south2
    assert.strictEqual((south1 as unknown as SouthConnectorMock).stop.mock.calls.length, 1);
    assert.strictEqual((south2 as unknown as SouthConnectorMock).stop.mock.calls.length, 0);
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
    assert.strictEqual((south1 as unknown as SouthConnectorMock).stop.mock.calls.length, 0);
    assert.strictEqual((south2 as unknown as SouthConnectorMock).stop.mock.calls.length, 1);
    assert.strictEqual((south3 as unknown as SouthConnectorMock).stop.mock.calls.length, 0);
  });
});
