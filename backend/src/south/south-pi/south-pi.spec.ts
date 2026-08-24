import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type { SouthItemSettings, SouthPIItemSettings, SouthPISettings } from '../../../shared/model/south-settings.model';
import type { OIBusContent } from '../../../shared/model/engine.model';
import type SouthPiClass from './south-pi';
import type { PiRawValue, PiServerInfo } from '@oibus/pi-afsdk-windows';

const nodeRequire = createRequire(import.meta.url);

const FAKE_SERVER_INFO: PiServerInfo = { name: 'PIServer1', version: '3.4.400.1198', host: 'pi-server', port: 5450 };

/**
 * Stands in for the real `@oibus/pi-afsdk-windows` package (which spawns a native child process) —
 * south-pi.ts's own behavior is what's under test here, not the package's process-management or
 * multi-connection concurrency logic, which has its own dedicated spec
 * (native/pi-afsdk-windows/src/index.spec.ts).
 */
class FakePiConnection {
  static instances: Array<FakePiConnection> = [];
  static connectMock = mock.fn(async (): Promise<FakePiConnection> => {
    const instance = new FakePiConnection();
    FakePiConnection.instances.push(instance);
    return instance;
  });

  serverInfo: PiServerInfo = FAKE_SERVER_INFO;
  read = mock.fn(async (_startTime: string, _endTime: string, _points: Array<string>): Promise<Array<PiRawValue>> => []);
  disconnect = mock.fn(async () => undefined);

  static connect(): Promise<FakePiConnection> {
    return FakePiConnection.connectMock();
  }

  static latest(): FakePiConnection {
    return FakePiConnection.instances[FakePiConnection.instances.length - 1];
  }
}

describe('South PI', () => {
  let SouthPi: typeof SouthPiClass;
  let south: SouthPiClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn(
    async (_southId: string, _data: OIBusContent, _queryTime: string, _items: Array<SouthConnectorItemEntity<SouthItemSettings>>) =>
      undefined
  );
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;

  const utilsExports = {
    delay: mock.fn(async () => undefined),
    generateIntervals: mock.fn(() => []),
    groupItemsByGroup: mock.fn(() => []),
    validateCronExpression: mock.fn(() => ({ expression: '' })),
    getErrorMessage: mock.fn((error: unknown) => {
      if (error instanceof Error) return error.message;
      if (typeof error === 'string') return error;
      if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
        return (error as { message: string }).message;
      }
      return String(error);
    }),
    // Mirrors the real implementation in service/utils.ts — kept in sync manually since it's a
    // handful of lines and some tests assert the exact { itemId/itemName } / { groupId/groupName } shape.
    workUnitLogCtx: mock.fn((items: Array<{ id: string; name: string; group?: { id: string; name: string } | null }>) => {
      if (items.length === 0) return {};
      if (items.length === 1) return { itemId: items[0].id, itemName: items[0].name };
      const lead = items[0];
      return lead.group ? { groupId: lead.group.id, groupName: lead.group.name } : {};
    })
  };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '@oibus/pi-afsdk-windows', { PiConnection: FakePiConnection });
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: mock.fn(() => logger) },
      default: class {}
    });

    SouthPi = reloadModule<{ default: typeof SouthPiClass }>(nodeRequire, './south-pi').default;
  });

  const configuration: SouthConnectorEntity<SouthPISettings, SouthPIItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'osisoft-pi',
    description: 'my test connector',
    enabled: true,
    settings: {
      retryInterval: 1000
    },
    groups: [],
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: { piPoint: 'FACTORY.WORKSHOP.POINT.ID1' },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 0,
        startTimeOffset: 0,
        endTimeOffset: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: { piPoint: 'sinu*' },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 0,
        startTimeOffset: 0,
        endTimeOffset: null,
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
    FakePiConnection.instances = [];
    FakePiConnection.connectMock = mock.fn(async () => {
      const instance = new FakePiConnection();
      FakePiConnection.instances.push(instance);
      return instance;
    });
    addContentCallback.mock.resetCalls();
    for (const fn of [logger.trace, logger.debug, logger.info, logger.warn, logger.error]) {
      fn.mock.resetCalls();
    }
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthPi(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('connects and disconnects the live connection', async () => {
    await south.connect();
    assert.strictEqual(FakePiConnection.connectMock.mock.calls.length, 1);
    const connection = FakePiConnection.latest();

    await south.disconnect();
    assert.strictEqual(connection.disconnect.mock.calls.length, 1);
  });

  it('reconnects after retryInterval when the connection fails', async () => {
    let callCount = 0;
    FakePiConnection.connectMock = mock.fn(async () => {
      callCount++;
      throw new Error('connection failed');
    });

    await south.connect();
    assert.strictEqual(callCount, 1);

    mock.timers.tick(configuration.settings.retryInterval);
    await Promise.resolve();
    await Promise.resolve();
    assert.strictEqual(callCount, 2);
  });

  it('does not reconnect when disconnecting', async () => {
    FakePiConnection.connectMock = mock.fn(async () => {
      throw new Error('connection failed');
    });
    (south as unknown as Record<string, unknown>)['disconnecting'] = true;
    const disconnectMock1 = mock.fn(async () => undefined);
    south.disconnect = disconnectMock1;

    await south.connect();

    assert.strictEqual(disconnectMock1.mock.calls.length, 0);
    mock.timers.tick(configuration.settings.retryInterval);
    await Promise.resolve();
    assert.strictEqual(FakePiConnection.connectMock.mock.calls.length, 1);
  });

  it('clears the reconnect timeout on disconnect when never connected', async () => {
    FakePiConnection.connectMock = mock.fn(async () => {
      throw new Error('connection failed');
    });

    await south.connect();
    assert.strictEqual(FakePiConnection.connectMock.mock.calls.length, 1);

    await south.disconnect();
    mock.timers.tick(configuration.settings.retryInterval);
    await Promise.resolve();
    assert.strictEqual(FakePiConnection.connectMock.mock.calls.length, 1, 'no reconnect attempt after disconnect cleared the timer');
    assert.ok(
      logger.error.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes('Error while connecting to the PI server') &&
          (c.arguments[0] as string).includes(`${configuration.settings.retryInterval} ms`)
      )
    );
  });

  it('clears the reconnect timeout on disconnect when connected, logging a disconnect failure', async () => {
    await south.connect();
    const connection = FakePiConnection.latest();
    connection.disconnect = mock.fn(async () => {
      throw new Error('disconnection failed');
    });

    await south.disconnect();
    mock.timers.tick(configuration.settings.retryInterval);
    await Promise.resolve();
    assert.strictEqual(FakePiConnection.connectMock.mock.calls.length, 1, 'no reconnect attempt scheduled by an explicit disconnect');
    assert.ok(
      logger.error.mock.calls.some((c: { arguments: Array<unknown> }) =>
        (c.arguments[0] as string).includes('Error while disconnecting from the PI server')
      )
    );
  });

  it('uses an isolated connection for testConnection, never the live one', async () => {
    await assert.doesNotReject(south.testConnection());

    assert.strictEqual((south as unknown as Record<string, unknown>)['connection'], null);
    const connection = FakePiConnection.latest();
    assert.strictEqual(connection.disconnect.mock.calls.length, 1);
  });

  it('returns PI server info from testConnection', async () => {
    const result = await south.testConnection();

    assert.deepStrictEqual(result, {
      items: [
        { key: 'Name', value: FAKE_SERVER_INFO.name },
        { key: 'Version', value: FAKE_SERVER_INFO.version },
        { key: 'Host', value: `${FAKE_SERVER_INFO.host}:${FAKE_SERVER_INFO.port}` }
      ]
    });
  });

  it('propagates a connection failure from testConnection', async () => {
    FakePiConnection.connectMock = mock.fn(async () => {
      throw new Error('AF SDK not installed');
    });
    await assert.rejects(south.testConnection(), { message: 'AF SDK not installed' });
  });

  it('leaves a live connection untouched by testConnection()', async () => {
    await south.connect();
    const liveConnection = FakePiConnection.latest();

    await assert.doesNotReject(south.testConnection());

    assert.strictEqual((south as unknown as Record<string, unknown>)['connection'], liveConnection);
    assert.strictEqual(liveConnection.disconnect.mock.calls.length, 0);
    // A separate throwaway connection was created and disconnected for the test.
    assert.strictEqual(FakePiConnection.instances.length, 2);
    assert.strictEqual(FakePiConnection.instances[1].disconnect.mock.calls.length, 1);
  });

  it('throws from historyQuery when not connected', async () => {
    await assert.rejects(south.historyQuery(configuration.items, '2020-01-01', '2020-01-02'), { message: 'PI server is not connected' });
  });

  it('reads all items in one bulk call and adds time-values content', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';
    await south.connect();
    const connection = FakePiConnection.latest();
    const addContentMock = mock.method(
      south,
      'addContent',
      mock.fn(async () => undefined)
    );
    connection.read = mock.fn(async () => [
      // Raw PI point names as the helper returns them — 'FACTORY.WORKSHOP.POINT.ID1' is item1's
      // configured `piPoint`, mapped back to item1's own `name`; 'query.result.point' has no
      // configured mapping (it's a wildcard-mask match) and passes through as-is.
      { pointId: 'FACTORY.WORKSHOP.POINT.ID1', timestamp: '2020-02-01T00:00:00.000Z', value: '1' },
      { pointId: 'query.result.point', timestamp: '2020-03-01T00:00:00.000Z', value: '2' }
    ]);

    const result = await south.historyQuery(configuration.items, startTime, endTime);

    assert.strictEqual(connection.read.mock.calls.length, 1);
    assert.deepStrictEqual(connection.read.mock.calls[0].arguments, [startTime, endTime, ['FACTORY.WORKSHOP.POINT.ID1', 'sinu*']]);
    assert.deepStrictEqual(result, {
      trackedInstant: '2020-03-01T00:00:00.001Z',
      value: { pointId: 'query.result.point', timestamp: '2020-03-01T00:00:00.000Z', data: { value: '2' } }
    });
    assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[0], {
      type: 'time-values',
      content: [
        { pointId: 'item1', timestamp: '2020-02-01T00:00:00.000Z', data: { value: '1' } },
        { pointId: 'query.result.point', timestamp: '2020-03-01T00:00:00.000Z', data: { value: '2' } }
      ]
    });
    assert.strictEqual(addContentMock.mock.calls[0].arguments[1], testData.constants.dates.FAKE_NOW);
    assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[2], [configuration.items[0], configuration.items[1]]);
  });

  it('logs and returns null trackedInstant when no records are found', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';
    await south.connect();
    const connection = FakePiConnection.latest();
    connection.read = mock.fn(async () => []);

    const result = await south.historyQuery(configuration.items, startTime, endTime);

    assert.deepStrictEqual(result, { trackedInstant: null, value: null });
    assert.ok(
      logger.debug.mock.calls.some(
        (c: { arguments: Array<unknown> }) => typeof c.arguments[1] === 'string' && c.arguments[1].includes('No result found')
      )
    );
  });

  it('propagates a query error from historyQuery', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';
    await south.connect();
    const connection = FakePiConnection.latest();
    connection.read = mock.fn(async () => {
      throw new Error('PI RPC broken');
    });

    await assert.rejects(south.historyQuery(configuration.items, startTime, endTime), { message: 'PI RPC broken' });
    assert.ok(
      logger.error.mock.calls.some((c: { arguments: Array<unknown> }) =>
        (c.arguments[1] as string).includes('Error while querying the PI server: PI RPC broken')
      )
    );
  });

  it('tests an item through an isolated connection, disconnecting it afterward', async () => {
    const { startTime, endTime } = testData.south.itemTestingSettings.history!;

    const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
    const connection = FakePiConnection.latest();

    assert.strictEqual(connection.read.mock.calls.length, 1);
    assert.deepStrictEqual(connection.read.mock.calls[0].arguments, [startTime, endTime, ['FACTORY.WORKSHOP.POINT.ID1']]);
    assert.strictEqual(connection.disconnect.mock.calls.length, 1);
    assert.deepStrictEqual(result.result, { type: 'time-values', content: [] });
  });

  it('still disconnects the isolated connection when the read fails', async () => {
    FakePiConnection.connectMock = mock.fn(async () => {
      const instance = new FakePiConnection();
      instance.read = mock.fn(async () => {
        throw new Error('bad point');
      });
      FakePiConnection.instances.push(instance);
      return instance;
    });

    await assert.rejects(south.testItem(configuration.items[0], testData.south.itemTestingSettings), { message: 'bad point' });
    assert.strictEqual(FakePiConnection.latest().disconnect.mock.calls.length, 1);
  });

  it('leaves a live connection untouched by testItem()', async () => {
    await south.connect();
    const liveConnection = FakePiConnection.latest();

    await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

    assert.strictEqual((south as unknown as Record<string, unknown>)['connection'], liveConnection);
    assert.strictEqual(liveConnection.read.mock.calls.length, 0);
    assert.strictEqual(liveConnection.disconnect.mock.calls.length, 0);
  });
});
