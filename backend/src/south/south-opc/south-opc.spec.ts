import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type { SouthItemSettings, SouthOPCItemSettings, SouthOPCSettings } from '../../../shared/model/south-settings.model';
import type { OIBusContent } from '../../../shared/model/engine.model';
import type SouthOpcClass from './south-opc';

const nodeRequire = createRequire(import.meta.url);

// Test doubles for @optimistik/opc-classic. The actual mock.fn instances live
// in module-level `agentFns` / `clientFns` so they survive across the multiple
// OpcClient instances the connector creates (e.g. testItem spawns a temp one).
// Class fields delegate to these so replacing clientFns.hdaRead in a test
// affects both current and future instances.
type ValuesHandler = { onValues: (values: Array<unknown>) => void | Promise<void> };

const agentFns = {
  start: mock.fn(() => undefined),
  stop: mock.fn(async () => 0 as number | null)
};

const clientFns = {
  connect: mock.fn(async (_p: unknown) => ({ connected: true as const })),
  disconnect: mock.fn(async (_id: string) => ({ disconnected: true as const })),
  status: mock.fn(async (_id: string) => ({
    vendorInfo: 'V',
    productVersion: '1.0',
    currentTime: '2024-01-01T00:00:00.000Z',
    startTime: '2024-01-01T00:00:00.000Z',
    serverState: 'Running',
    statusInfo: 'ok'
  })),
  daRead: mock.fn(async (_p: unknown, _h: ValuesHandler) => undefined),
  hdaRead: mock.fn(async (_p: unknown, _h: ValuesHandler) => undefined)
};

function resetMocks() {
  for (const fn of Object.values(agentFns)) fn.mock.resetCalls();
  for (const fn of Object.values(clientFns)) fn.mock.resetCalls();
}

class FakeOpcAgent {
  start = () => agentFns.start();
  stop = () => agentFns.stop();
}

class FakeOpcClient {
  connect = (p: unknown) => clientFns.connect(p);
  disconnect = (id: string) => clientFns.disconnect(id);
  status = (id: string) => clientFns.status(id);
  daRead = (p: unknown, h: ValuesHandler) => clientFns.daRead(p, h);
  hdaRead = (p: unknown, h: ValuesHandler) => clientFns.hdaRead(p, h);
}

describe('South OPC', () => {
  let SouthOpc: typeof SouthOpcClass;
  let south: SouthOpcClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn(
    async (
      _southId: string,
      _data: OIBusContent,
      _queryTime: string,
      _items: Array<SouthConnectorItemEntity<SouthItemSettings>>
    ) => undefined
  );
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
  let southCacheService: SouthCacheServiceMock;

  const utilsExports = {
    delay: mock.fn(async () => undefined),
    generateIntervals: mock.fn(() => []),
    groupItemsByGroup: mock.fn(() => []),
    validateCronExpression: mock.fn(() => ({ expression: '' }))
  };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '@optimistik/opc-classic', { OpcAgent: FakeOpcAgent, OpcClient: FakeOpcClient });
    mockModule(nodeRequire, '../../service/south-cache.service', {
      __esModule: true,
      default: function () {
        return southCacheService;
      }
    });
    SouthOpc = reloadModule<{ default: typeof SouthOpcClass }>(nodeRequire, './south-opc').default;
  });

  const configuration: SouthConnectorEntity<SouthOPCSettings, SouthOPCItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'opc',
    description: 'my test connector',
    enabled: true,
    settings: {
      retryInterval: 1000,
      host: 'localhost',
      serverName: 'Matrikon.OPC.Simulation',
      mode: 'hda'
    },
    groups: [],
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: { nodeId: 'ns=3;s=Random', aggregate: 'raw', resampling: 'none' },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: { nodeId: 'ns=3;s=Counter', aggregate: 'raw' },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: { nodeId: 'ns=3;s=Triangle', aggregate: 'average', resampling: '10s' },
        scanMode: testData.scanMode.list[1],
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ],
    createdBy: '',
    updatedBy: '',
    createdAt: '',
    updatedAt: ''
  };

  beforeEach(() => {
    southCacheService = new SouthCacheServiceMock();
    addContentCallback.mock.resetCalls();
    resetMocks();
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthOpc(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('connects through the spawned agent and disconnects cleanly', async () => {
    await south.connect();

    assert.strictEqual(agentFns.start.mock.calls.length, 1);
    assert.strictEqual(clientFns.connect.mock.calls.length, 1);
    assert.deepStrictEqual(clientFns.connect.mock.calls[0].arguments[0], {
      connectorId: configuration.id,
      host: configuration.settings.host,
      serverName: configuration.settings.serverName,
      mode: 'hda'
    });

    await south.disconnect();
    assert.strictEqual(clientFns.disconnect.mock.calls.length, 1);
    assert.strictEqual(clientFns.disconnect.mock.calls[0].arguments[0], configuration.id);
    assert.strictEqual(agentFns.stop.mock.calls.length, 1);
  });

  it('reconnects when the initial connect call fails', async () => {
    let attempt = 0;
    const originalConnect = clientFns.connect;
    clientFns.connect = mock.fn(async (_p: unknown) => {
      attempt++;
      if (attempt === 1) throw new Error('connect failed');
      return { connected: true as const };
    });

    try {
      await south.connect();
      assert.strictEqual(attempt, 1);
      mock.timers.tick(configuration.settings.retryInterval);
      // After the timer fires the bound connect runs again.
      await new Promise(r => setImmediate(r));
      assert.strictEqual(attempt, 2);
    } finally {
      clientFns.connect = originalConnect;
    }
  });

  it('does not reconnect when disconnecting', async () => {
    const originalConnect = clientFns.connect;
    clientFns.connect = mock.fn(async () => {
      throw new Error('connect failed');
    });
    (south as unknown as Record<string, unknown>)['disconnecting'] = true;
    const disconnectSpy = mock.fn(async () => undefined);
    south.disconnect = disconnectSpy;

    try {
      await south.connect();
      assert.strictEqual(disconnectSpy.mock.calls.length, 0);
      mock.timers.tick(configuration.settings.retryInterval);
    } finally {
      clientFns.connect = originalConnect;
    }
  });

  it('testConnection spawns a temp agent, calls status, then tears down', async () => {
    await assert.doesNotReject(south.testConnection());

    assert.strictEqual(clientFns.connect.mock.calls.length, 1);
    assert.strictEqual((clientFns.connect.mock.calls[0].arguments[0] as { connectorId: string }).connectorId, `${configuration.id}-test`);
    assert.strictEqual(clientFns.status.mock.calls.length, 1);
    assert.strictEqual(clientFns.disconnect.mock.calls.length, 1);
    assert.strictEqual(agentFns.stop.mock.calls.length, 1);
  });

  it('testConnection surfaces connect failures', async () => {
    const originalConnect = clientFns.connect;
    clientFns.connect = mock.fn(async () => {
      throw new Error('server not running');
    });
    try {
      await assert.rejects(south.testConnection(), /server not running/);
    } finally {
      clientFns.connect = originalConnect;
    }
  });

  it('historyQuery groups items by aggregate+resampling and streams batches via addContent', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    const addContentMock = mock.method(south, 'addContent', mock.fn(async () => undefined));

    // First group (aggregate=raw, resampling=none) → two items, one batch of values.
    // Second group (aggregate=average, resampling=10s) → one item, no values.
    clientFns.hdaRead = mock.fn(async (_p: unknown, h: ValuesHandler) => {
      const params = _p as { aggregateId: number };
      if (params.aggregateId === 0) {
        await h.onValues([
          { pointId: 'item1', timestamp: '2020-02-01T00:00:00.000Z', value: '1', quality: '0x0' },
          { pointId: 'item2', timestamp: '2020-03-01T00:00:00.000Z', value: '2', quality: '0x0' }
        ]);
      }
    });

    await south.connect();
    const result = await south.historyQuery(configuration.items, startTime, endTime);

    // Two distinct group calls.
    const hdaCalls = clientFns.hdaRead.mock.calls;
    assert.strictEqual(hdaCalls.length, 2);

    // Aggregate string → native int translation happens in the connector.
    const firstParams = hdaCalls[0].arguments[0] as {
      aggregateId: number;
      resamplingInterval: number;
      items: Array<{ name: string }>;
    };
    assert.strictEqual(firstParams.aggregateId, 0); // 'raw'
    assert.strictEqual(firstParams.resamplingInterval, 0); // 'none'
    assert.deepStrictEqual(
      firstParams.items.map(i => i.name),
      ['item1', 'item2']
    );

    const secondParams = hdaCalls[1].arguments[0] as {
      aggregateId: number;
      resamplingInterval: number;
      items: Array<{ name: string }>;
    };
    assert.strictEqual(secondParams.aggregateId, 3); // 'average'
    assert.strictEqual(secondParams.resamplingInterval, 10); // '10s'

    // addContent was called once for the non-empty batch.
    assert.strictEqual(addContentMock.mock.calls.length, 1);
    const addArgs = addContentMock.mock.calls[0].arguments as [OIBusContent, string, unknown];
    assert.strictEqual((addArgs[0] as { type: string }).type, 'time-values');
    assert.strictEqual(addArgs[1], testData.constants.dates.FAKE_NOW);

    // trackedInstant = max timestamp + 1ms.
    assert.strictEqual(result.trackedInstant, '2020-03-01T00:00:00.001Z');
    assert.deepStrictEqual(result.value, { recordCount: 2, maxInstantRetrieved: '2020-03-01T00:00:00.000Z' });
  });

  it('historyQuery in DA mode dispatches daRead with all items in one batch', async () => {
    const daConfiguration = {
      ...configuration,
      settings: { ...configuration.settings, mode: 'da' as const }
    };
    south = new SouthOpc(daConfiguration, addContentCallback, southCacheRepository, logger, 'cacheFolder');

    const addContentMock = mock.method(south, 'addContent', mock.fn(async () => undefined));
    clientFns.daRead = mock.fn(async (_p: unknown, h: ValuesHandler) => {
      await h.onValues([{ pointId: 'item1', timestamp: '2024-06-01T00:00:00.000Z', value: '42', quality: '0x0' }]);
    });

    await south.connect();
    const result = await south.historyQuery(daConfiguration.items, '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

    assert.strictEqual(clientFns.daRead.mock.calls.length, 1);
    assert.strictEqual(clientFns.hdaRead.mock.calls.length, 0);
    assert.strictEqual(addContentMock.mock.calls.length, 1);
    assert.strictEqual(result.trackedInstant, '2024-06-01T00:00:00.001Z');
  });

  it('historyQuery surfaces errors and reconnects', async () => {
    await south.connect();
    clientFns.hdaRead = mock.fn(async () => {
      throw new Error('hda read blew up');
    });
    const disconnectSpy = mock.method(south, 'disconnect', mock.fn(async () => undefined));
    const connectSpy = mock.method(south, 'connect', mock.fn(async () => undefined));

    await assert.rejects(south.historyQuery(configuration.items, '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z'), /hda read blew up/);
    assert.ok(disconnectSpy.mock.calls.length >= 1);
    assert.ok(connectSpy.mock.calls.length >= 1);
  });

  it('testItem in HDA mode reads one item and returns the collected values', async () => {
    clientFns.hdaRead = mock.fn(async (_p: unknown, h: ValuesHandler) => {
      await h.onValues([
        { pointId: 'item1', timestamp: '2020-02-01T00:00:00.000Z', value: '1', quality: '0x0' },
        { pointId: 'item1', timestamp: '2020-03-01T00:00:00.000Z', value: '2', quality: '0x0' }
      ]);
    });

    const content = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

    assert.strictEqual(clientFns.hdaRead.mock.calls.length, 1);
    const params = clientFns.hdaRead.mock.calls[0].arguments[0] as { connectorId: string; aggregateId: number };
    assert.strictEqual(params.connectorId, `${configuration.id}-test`);
    assert.strictEqual(params.aggregateId, 0);

    assert.strictEqual(content.type, 'time-values');
    if (content.type === 'time-values') {
      assert.strictEqual(content.content.length, 2);
    }
  });

  it('testItem in DA mode dispatches daRead instead of hdaRead', async () => {
    const daConfig = { ...configuration, settings: { ...configuration.settings, mode: 'da' as const } };
    south = new SouthOpc(daConfig, addContentCallback, southCacheRepository, logger, 'cacheFolder');

    clientFns.daRead = mock.fn(async (_p: unknown, h: ValuesHandler) => {
      await h.onValues([{ pointId: 'item1', timestamp: '2024-06-01T00:00:00.000Z', value: '42', quality: '0x0' }]);
    });

    const content = await south.testItem(daConfig.items[0], testData.south.itemTestingSettings);

    assert.strictEqual(clientFns.daRead.mock.calls.length, 1);
    assert.strictEqual(clientFns.hdaRead.mock.calls.length, 0);
    assert.strictEqual(content.type, 'time-values');
  });
});
