import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import * as bacnetJs from '@bacnet-js/client';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, flushPromises } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type SouthBACnetClass from './south-bacnet';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type { SouthBACnetItemSettings, SouthBACnetSettings } from '../../../shared/model/south-settings.model';
import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type { ScanMode } from '../../model/scan-mode.model';

const nodeRequire = createRequire(import.meta.url);

class BACnetClientMock extends EventEmitter {
  whoIs = mock.fn(() => undefined);
  whoIsThroughBBMD = mock.fn(() => undefined);
  readProperty = mock.fn(async () => ({
    len: 0,
    objectId: { type: 0, instance: 0 },
    property: { id: 85, index: 0xffffffff },
    values: [{ type: 2, value: 42 }]
  }));
  readPropertyMultiple = mock.fn(async () => ({ len: 0, values: [] as Array<unknown> }));
  subscribeCov = mock.fn(async () => undefined);
  registerForeignDevice = mock.fn(async () => undefined);
  close = mock.fn(() => undefined);

  constructor() {
    super();
    // Mirrors the real client, which starts listening asynchronously right after construction.
    queueMicrotask(() => this.emit('listening'));
  }
}

let lastCreatedClient: BACnetClientMock;
const bacnetExports = {
  ...bacnetJs,
  __esModule: true,
  default: mock.fn(function BACnetClientCtorMock() {
    lastCreatedClient = new BACnetClientMock();
    return lastCreatedClient;
  })
};

const pollScanMode: ScanMode = {
  id: 'scanMode1',
  name: 'every second',
  description: '',
  type: 'cron',
  cron: '* * * * * *',
  interval: null,
  activationWindow: null,
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
};

const subscriptionScanMode: ScanMode = {
  ...pollScanMode,
  id: 'subscription',
  name: 'subscription'
};

function buildItem(overrides: {
  id: string;
  name: string;
  settings: SouthBACnetItemSettings;
  scanMode?: ScanMode;
}): SouthConnectorItemEntity<SouthBACnetItemSettings> {
  return {
    id: overrides.id,
    name: overrides.name,
    enabled: true,
    settings: overrides.settings,
    scanMode: overrides.scanMode ?? pollScanMode,
    createdBy: '',
    updatedBy: '',
    createdAt: '',
    updatedAt: '',
    group: null,
    syncWithGroup: false,
    maxReadInterval: null,
    readDelay: null,
    startTimeOffset: null,
    endTimeOffset: null,
    recoveryStrategy: null,
    cachingStrategy: 'allValues',
    thresholdType: null,
    threshold: null,
    rangeLow: null,
    rangeHigh: null,
    maxCachingInterval: null
  };
}

describe('SouthBACnet', () => {
  let SouthBACnet: typeof SouthBACnetClass;
  let south: SouthBACnetClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn(async (_southId: string, _data: unknown, _queryTime: string, _items: unknown) => undefined);
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;

  const item1 = buildItem({
    id: 'id1',
    name: 'item1',
    settings: {
      deviceAddress: '192.168.1.10',
      deviceInstance: 10,
      objectType: 'analog-input',
      objectInstance: 1,
      propertyIdentifier: 'present-value'
    }
  });
  const item2 = buildItem({
    id: 'id2',
    name: 'item2',
    settings: {
      deviceAddress: '192.168.1.10',
      deviceInstance: 10,
      objectType: 'analog-input',
      objectInstance: 2,
      propertyIdentifier: 'present-value'
    }
  });
  const item3 = buildItem({
    id: 'id3',
    name: 'item3',
    settings: {
      deviceAddress: '192.168.1.11',
      deviceInstance: 11,
      objectType: 'binary-input',
      objectInstance: 1,
      propertyIdentifier: 'present-value'
    }
  });
  const subscriptionItem = buildItem({
    id: 'id4',
    name: 'item4',
    scanMode: subscriptionScanMode,
    settings: {
      deviceAddress: '192.168.1.10',
      deviceInstance: 10,
      objectType: 'analog-value',
      objectInstance: 5,
      propertyIdentifier: 'present-value'
    }
  });

  const configuration: SouthConnectorEntity<SouthBACnetSettings, SouthBACnetItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'bacnet',
    description: 'test bacnet connector',
    enabled: true,
    settings: {
      localInterface: '',
      port: 47809,
      apduTimeout: 100,
      broadcastAddress: '255.255.255.255',
      retryInterval: 1000,
      maxParallelRun: 1,
      covDefaultLifetime: 300,
      covRenewalMargin: 60,
      maxObjectsPerRequest: 2,
      maxNumberOfMessages: 1000,
      flushMessageTimeout: 1000,
      bbmd: { enabled: false }
    },
    groups: [],
    items: [item1, item2, item3, subscriptionItem],
    createdBy: '',
    updatedBy: '',
    createdAt: '',
    updatedAt: ''
  };

  before(() => {
    mockModule(nodeRequire, '@bacnet-js/client', bacnetExports);
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: mock.fn(() => logger) },
      default: class {}
    });

    SouthBACnet = reloadModule<{ default: typeof SouthBACnetClass }>(nodeRequire, './south-bacnet').default;
  });

  beforeEach(() => {
    bacnetExports.default.mock.resetCalls();
    addContentCallback.mock.resetCalls();
    (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.resetCalls();
    (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(() => new Map());
    (southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.resetCalls();
    (southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(() => undefined);
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthBACnet(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('connect / disconnect', () => {
    it('should properly connect and open a BACnet/IP client', async () => {
      const connectPromise = south.connect();
      await flushPromises();
      await connectPromise;

      assert.strictEqual(bacnetExports.default.mock.calls.length, 1);
      assert.deepStrictEqual(bacnetExports.default.mock.calls[0].arguments[0], {
        interface: undefined,
        port: 47809,
        apduTimeout: 100,
        broadcastAddress: '255.255.255.255'
      });
    });

    it('should register as a foreign device and schedule renewal when BBMD is enabled', async () => {
      const bbmdConfiguration: SouthConnectorEntity<SouthBACnetSettings, SouthBACnetItemSettings> = {
        ...configuration,
        settings: { ...configuration.settings, bbmd: { enabled: true, address: '10.0.0.1:47808', foreignDeviceTtl: 900 } }
      };
      south = new SouthBACnet(bbmdConfiguration, addContentCallback, southCacheRepository, 'cacheFolder');
      const connectPromise = south.connect();
      await flushPromises();
      await connectPromise;

      assert.strictEqual(lastCreatedClient.registerForeignDevice.mock.calls.length, 1);
      assert.deepStrictEqual(lastCreatedClient.registerForeignDevice.mock.calls[0].arguments, [{ address: '10.0.0.1:47808' }, 900]);

      lastCreatedClient.registerForeignDevice.mock.resetCalls();
      mock.timers.tick(900 * 500);
      await flushPromises();
      assert.strictEqual(lastCreatedClient.registerForeignDevice.mock.calls.length, 1);
    });

    it('should reconnect after a transport error', async () => {
      const connectPromise = south.connect();
      await flushPromises();
      await connectPromise;
      bacnetExports.default.mock.resetCalls();

      lastCreatedClient.emit('error', new Error('ENETUNREACH'));
      await flushPromises();
      mock.timers.tick(1000);
      await flushPromises();

      assert.strictEqual(bacnetExports.default.mock.calls.length, 1);
    });

    it('should close the client on disconnect', async () => {
      const connectPromise = south.connect();
      await flushPromises();
      await connectPromise;
      const client = lastCreatedClient;

      await south.disconnect();
      assert.strictEqual(client.close.mock.calls.length, 1);
    });
  });

  describe('testConnection', () => {
    it('should discover devices via whoIs and reuse a live client', async () => {
      const connectPromise = south.connect();
      await flushPromises();
      await connectPromise;
      const client = lastCreatedClient;

      const testPromise = south.testConnection();
      await flushPromises();
      client.emit('iAm', { payload: { address: '192.168.1.10', deviceId: 10, maxApdu: 1476, segmentation: 0, vendorId: 0 } });
      mock.timers.tick(3000);
      const result = await testPromise;

      assert.strictEqual(client.whoIs.mock.calls.length, 1);
      assert.strictEqual(client.close.mock.calls.length, 0);
      assert.deepStrictEqual(result.items[0], { key: 'DevicesFound', value: '1' });
    });

    it('should use whoIsThroughBBMD when BBMD is enabled', async () => {
      const bbmdConfiguration: SouthConnectorEntity<SouthBACnetSettings, SouthBACnetItemSettings> = {
        ...configuration,
        settings: { ...configuration.settings, bbmd: { enabled: true, address: '10.0.0.1:47808', foreignDeviceTtl: 900 } }
      };
      south = new SouthBACnet(bbmdConfiguration, addContentCallback, southCacheRepository, 'cacheFolder');

      const testPromise = south.testConnection();
      await flushPromises();
      const client = lastCreatedClient;
      mock.timers.tick(3000);
      await testPromise;

      assert.strictEqual(client.whoIsThroughBBMD.mock.calls.length, 1);
      assert.deepStrictEqual(client.whoIsThroughBBMD.mock.calls[0].arguments, [{ address: '10.0.0.1:47808' }]);
      // Not reused from a live connection: opened and closed just for the test.
      assert.strictEqual(client.close.mock.calls.length, 1);
    });
  });

  describe('testItem', () => {
    it('should read the configured property and return one time value', async () => {
      const result = await south.testItem(item1, { history: undefined as never });

      assert.strictEqual(result.result.type, 'time-values');
      assert.deepStrictEqual(
        (result.result as { content: Array<{ pointId: string; data: { value: unknown } }> }).content[0].data.value,
        42
      );
      assert.strictEqual(typeof result.connectionDuration, 'number');
      assert.strictEqual(typeof result.queryDuration, 'number');
      assert.strictEqual(lastCreatedClient.close.mock.calls.length, 1);
    });
  });

  describe('directQuery', () => {
    it('should batch reads per device, respecting maxObjectsPerRequest, and cache the results', async () => {
      const connectPromise = south.connect();
      await flushPromises();
      await connectPromise;
      const client = lastCreatedClient;
      client.readPropertyMultiple = mock.fn(async (_address: unknown, specs: Array<{ objectId: { type: number; instance: number } }>) => ({
        len: 0,
        values: specs.map(spec => ({
          objectId: spec.objectId,
          values: [{ id: 85, index: 0xffffffff, value: [{ type: 2, value: spec.objectId.instance }] }]
        }))
      }));

      await south.directQuery([item1, item2, item3]);

      // Two devices: 192.168.1.10 (item1, item2 - chunked into 1 request of 2 since maxObjectsPerRequest=2)
      // and 192.168.1.11 (item3 - 1 request).
      assert.strictEqual(client.readPropertyMultiple.mock.calls.length, 2);
      assert.strictEqual(addContentCallback.mock.calls.length, 1);
      const content = addContentCallback.mock.calls[0].arguments[1] as { content: Array<{ pointId: string }> };
      assert.strictEqual(content.content.length, 3);
    });

    it('should skip a device that returns a device-scoped error without affecting other devices', async () => {
      const connectPromise = south.connect();
      await flushPromises();
      await connectPromise;
      const client = lastCreatedClient;
      client.readPropertyMultiple = mock.fn(async (address: { address: string }) => {
        if (address.address === '192.168.1.10') {
          throw new Error('ERR_TIMEOUT');
        }
        return {
          len: 0,
          values: [{ objectId: { type: 3, instance: 1 }, values: [{ id: 85, index: 0xffffffff, value: [{ type: 2, value: 1 }] }] }]
        };
      });

      await south.directQuery([item1, item2, item3]);

      assert.strictEqual(addContentCallback.mock.calls.length, 1);
      const content = addContentCallback.mock.calls[0].arguments[1] as { content: Array<{ pointId: string }> };
      assert.strictEqual(content.content.length, 1);
      assert.strictEqual(content.content[0].pointId, 'item3');
    });

    it('should trigger a reconnect on a non-device-scoped error', async () => {
      const connectPromise = south.connect();
      await flushPromises();
      await connectPromise;
      const client = lastCreatedClient;
      client.readPropertyMultiple = mock.fn(async () => {
        throw new Error('ERR_CLOSED');
      });
      bacnetExports.default.mock.resetCalls();

      await assert.rejects(south.directQuery([item1]));
      await flushPromises();

      assert.strictEqual(client.close.mock.calls.length, 1);
    });
  });

  describe('subscribe / unsubscribe', () => {
    it('should subscribe with a fresh subscriberProcessId per item and schedule renewal', async () => {
      const connectPromise = south.connect();
      await flushPromises();
      await connectPromise;
      const client = lastCreatedClient;

      await south.subscribe([subscriptionItem]);

      assert.strictEqual(client.subscribeCov.mock.calls.length, 1);
      const [, , subscriberProcessId, cancel, issueConfirmed, lifetime] = client.subscribeCov.mock.calls[0].arguments as [
        unknown,
        unknown,
        number,
        boolean,
        boolean,
        number
      ];
      assert.strictEqual(cancel, false);
      assert.strictEqual(issueConfirmed, false);
      assert.strictEqual(lifetime, 300);
      assert.strictEqual(typeof subscriberProcessId, 'number');

      client.subscribeCov.mock.resetCalls();
      mock.timers.tick((300 - 60) * 1000);
      await flushPromises();
      assert.strictEqual(client.subscribeCov.mock.calls.length, 1);
    });

    it('should buffer and flush COV notifications', async () => {
      const connectPromise = south.connect();
      await flushPromises();
      await connectPromise;
      const client = lastCreatedClient;

      await south.subscribe([subscriptionItem]);
      const subscriberProcessId = client.subscribeCov.mock.calls[0].arguments[2] as number;

      client.emit('covNotifyUnconfirmed', {
        payload: {
          subscriberProcessId,
          initiatingDeviceId: 10,
          monitoredObjectId: { type: 2, instance: 5 },
          timeRemaining: 300,
          values: [{ property: { id: 85 }, value: [{ type: 2, value: 12.5 }] }]
        }
      });

      mock.timers.tick(1000);
      await flushPromises();

      assert.strictEqual(addContentCallback.mock.calls.length, 1);
      const content = addContentCallback.mock.calls[0].arguments[1] as { content: Array<{ pointId: string; data: { value: unknown } }> };
      assert.strictEqual(content.content[0].pointId, 'item4');
      assert.strictEqual(content.content[0].data.value, 12.5);
    });

    it('should cancel the COV subscription and clear bookkeeping on unsubscribe', async () => {
      const connectPromise = south.connect();
      await flushPromises();
      await connectPromise;
      const client = lastCreatedClient;

      await south.subscribe([subscriptionItem]);
      const subscriberProcessId = client.subscribeCov.mock.calls[0].arguments[2] as number;
      client.subscribeCov.mock.resetCalls();

      await south.unsubscribe([subscriptionItem]);

      assert.strictEqual(client.subscribeCov.mock.calls.length, 1);
      const [, , cancelledProcessId, cancel] = client.subscribeCov.mock.calls[0].arguments as [unknown, unknown, number, boolean];
      assert.strictEqual(cancelledProcessId, subscriberProcessId);
      assert.strictEqual(cancel, true);

      // No pending renewal timer left over: advancing time triggers no further calls.
      client.subscribeCov.mock.resetCalls();
      mock.timers.tick(3600 * 1000);
      await flushPromises();
      assert.strictEqual(client.subscribeCov.mock.calls.length, 0);
    });
  });

  describe('explore', () => {
    it('should list discovered devices at the root level', async () => {
      const explorePromise = south.explore(null);
      await flushPromises();
      const client = lastCreatedClient;
      client.emit('iAm', { payload: { address: '192.168.1.10', deviceId: 10, maxApdu: 1476, segmentation: 0, vendorId: 0 } });
      mock.timers.tick(3000);
      const entries = await explorePromise;

      assert.strictEqual(entries.length, 1);
      assert.strictEqual(entries[0].id, '192.168.1.10|10');
      assert.strictEqual(entries[0].hasChildren, true);
    });

    it('should list a device objects and degrade gracefully when enrichment fails', async () => {
      const connectPromise = south.connect();
      await flushPromises();
      await connectPromise;
      const client = lastCreatedClient;
      client.readProperty = mock.fn(async () => ({
        len: 0,
        objectId: { type: 8, instance: 10 },
        property: { id: 76, index: 0xffffffff },
        values: [
          { type: 12, value: { type: 0, instance: 1 } },
          { type: 12, value: { type: 3, instance: 2 } }
        ]
      }));
      client.readPropertyMultiple = mock.fn(async () => {
        throw new Error('BacnetAbort - Reason:0');
      });

      const entries = await south.explore('192.168.1.10|10');

      assert.strictEqual(entries.length, 2);
      assert.strictEqual(entries[0].hasChildren, false);
      assert.ok(entries[0].id.startsWith('192.168.1.10|10|'));
    });
  });
});
