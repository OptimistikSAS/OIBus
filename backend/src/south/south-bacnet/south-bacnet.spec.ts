import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import * as bacnetJs from '@bacnet-js/client';

import type { SouthBACnetItemSettings, SouthBACnetSettings } from '../../../shared/model/connector/south-settings.model';

import type { ScanMode } from '../../model/scan-mode.model';
import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, flushPromises, type Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import manifest from './manifest';
import type SouthBACnetClass from './south-bacnet';

const nodeRequire = createRequire(import.meta.url);

interface BACnetObjectId {
  type: number;
  instance: number;
}

class BACnetClientMock extends EventEmitter {
  whoIs = mock.fn(() => undefined);
  whoIsThroughBBMD = mock.fn(() => undefined);
  readProperty = mock.fn(
    async (
      _address: { address: string },
      _objectId: BACnetObjectId,
      _propertyId: number,
      _options?: { arrayIndex?: number }
    ): Promise<{
      len: number;
      objectId: BACnetObjectId;
      property: { id: number; index: number };
      values: Array<{ type: number; value: unknown }>;
    }> => ({
      len: 0,
      objectId: { type: 0, instance: 0 },
      property: { id: 85, index: 0xffffffff },
      values: [{ type: 2, value: 42 }]
    })
  );
  readPropertyMultiple = mock.fn(
    async (
      _address: { address: string },
      _specs: Array<{ objectId: BACnetObjectId; properties: Array<{ id: number; index: number }> }>
    ): Promise<{ len: number; values: Array<unknown> }> => ({ len: 0, values: [] })
  );
  subscribeCov = mock.fn(
    async (
      _address: { address: string },
      _objectId: BACnetObjectId,
      _subscriberProcessId: number,
      _cancel: boolean,
      _issueConfirmed: boolean,
      _lifetime: number,
      _options: unknown
    ): Promise<void> => undefined
  );
  readRange = mock.fn(
    async (
      _address: { address: string },
      _objectId: BACnetObjectId,
      _position: number,
      _count: number
    ): Promise<{ itemCount: number; values?: Array<{ timestamp: Date; value: unknown; isLogStatus?: boolean }> }> => ({
      itemCount: 0,
      values: []
    })
  );
  subscribeProperty = mock.fn(
    async (
      _address: { address: string },
      _objectId: BACnetObjectId,
      _monitoredProperty: { id: number; index: number },
      _subscriberProcessId: number,
      _cancel: boolean,
      _issueConfirmed: boolean,
      _options: unknown
    ): Promise<void> => undefined
  );
  registerForeignDevice = mock.fn(async () => undefined);
  close = mock.fn(() => undefined);

  constructor() {
    super();
    // Mirrors the real client, which starts listening asynchronously right after construction.
    queueMicrotask(() => this.emit('listening'));
  }
}

let lastCreatedClient: BACnetClientMock;
const createClientConstructor = () =>
  mock.fn(function BACnetClientCtorMock(_options: unknown) {
    lastCreatedClient = new BACnetClientMock();
    return lastCreatedClient;
  });
const bacnetExports = { ...bacnetJs, __esModule: true, default: createClientConstructor() };

/** Sets up the next client before it is created, for a request it sends before the test could reach it. */
function setUpNextClient(setUp: (client: BACnetClientMock) => void): void {
  bacnetExports.default.mock.mockImplementationOnce(function BACnetClientCtorMock(_options: unknown) {
    lastCreatedClient = new BACnetClientMock();
    setUp(lastCreatedClient);
    return lastCreatedClient;
  });
}

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

/**
 * An I-Am event as @bacnet-js/client really emits it: the sender address is in the message header,
 * the payload has none (despite the library's IAMResult typing).
 */
function iAm(address: string, deviceId: number, forwardedFrom: string | null = null) {
  return {
    header: { apduType: 0x10, expectingReply: false, sender: { address, forwardedFrom } },
    payload: { deviceId, maxApdu: 1476, segmentation: 0, vendorId: 0 }
  };
}

/** An I-Am from a device behind the router at `address` (127.0.0.1:47809 by default), on network 2. */
function routedIAm(adr: Array<number>, deviceId: number, address = '127.0.0.1:47809') {
  return {
    header: { apduType: 0x10, expectingReply: false, sender: { address, forwardedFrom: null, net: 2, adr } },
    payload: { deviceId, maxApdu: 480, segmentation: 3, vendorId: 0 }
  };
}

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

const item1 = buildItem({
  id: 'id1',
  name: 'item1',
  settings: {
    deviceAddress: '192.168.1.10',
    deviceInstance: 10,
    objectType: 'analog-input',
    objectInstance: 1,
    propertyIdentifier: 'present-value',
    routed: false
  }
});
const item2 = buildItem({ id: 'id2', name: 'item2', settings: { ...item1.settings, objectInstance: 2 } });
const item3 = buildItem({
  id: 'id3',
  name: 'item3',
  settings: { ...item1.settings, deviceAddress: '192.168.1.11', deviceInstance: 11, objectType: 'binary-input' }
});
const subscriptionItem = buildItem({
  id: 'id4',
  name: 'item4',
  scanMode: subscriptionScanMode,
  settings: { ...item1.settings, objectType: 'analog-value', objectInstance: 5 }
});
// A property that SubscribeCOV does not report
const reliabilityItem = buildItem({
  id: 'id7',
  name: 'item7',
  scanMode: subscriptionScanMode,
  settings: { ...subscriptionItem.settings, propertyIdentifier: 'reliability' }
});

// Two MS/TP devices behind the same BACnet router (192.168.1.20), on network 2.
const routedItem1 = buildItem({
  id: 'routed1',
  name: 'routed1',
  settings: {
    deviceAddress: '192.168.1.20',
    deviceInstance: 2005,
    objectType: 'analog-input',
    objectInstance: 1,
    propertyIdentifier: 'present-value',
    routed: true,
    networkNumber: 2,
    macAddress: '5'
  }
});
const routedItem2 = buildItem({
  id: 'routed2',
  name: 'routed2',
  settings: { ...routedItem1.settings, deviceInstance: 2006, macAddress: '6' }
});

const configuration: SouthConnectorEntity<SouthBACnetSettings, SouthBACnetItemSettings> = {
  id: 'southId',
  name: 'south',
  type: 'bacnet',
  description: 'test bacnet connector',
  enabled: true,
  settings: {
    localInterface: '',
    discoveryMode: 'broadcast',
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
const withSettings = (
  settings: Partial<SouthBACnetSettings>,
  baseConfiguration = configuration
): SouthConnectorEntity<SouthBACnetSettings, SouthBACnetItemSettings> => ({
  ...baseConfiguration,
  settings: { ...baseConfiguration.settings, ...settings }
});
const withBbmd = (baseConfiguration = configuration) =>
  withSettings({ bbmd: { enabled: true, address: '10.0.0.1:47808', foreignDeviceTtl: 900 } }, baseConfiguration);
const targetDeviceConfiguration = withSettings({
  discoveryMode: 'target-device',
  discoveryTargetAddress: '172.16.32.20',
  discoveryTargetDeviceInstance: 201
});
const routerConfiguration = withSettings({ discoveryMode: 'router', discoveryRouterAddress: '127.0.0.1:47809' });

const noHistory = { history: undefined as never };

/** Whether `logMock` logged a message (second argument, after the log context) containing all `texts` */
const logged = (logMock: Mock<(...args: Array<unknown>) => unknown>, ...texts: Array<string>) =>
  logMock.mock.calls.some(
    call => typeof call.arguments[1] === 'string' && texts.every(text => (call.arguments[1] as string).includes(text))
  );

describe('SouthBACnet', () => {
  let SouthBACnet: typeof SouthBACnetClass;
  let south: SouthBACnetClass;
  let logger: PinoLogger;
  let addContentCallback: Mock<(southId: string, data: unknown, queryTime: string, items: unknown) => Promise<void>>;
  let southCacheRepository: Mocked<SouthCacheRepository>;

  before(() => {
    mockModule(nodeRequire, '@bacnet-js/client', bacnetExports);
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthBACnet = reloadModule<{ default: typeof SouthBACnetClass }>(nodeRequire, './south-bacnet').default;
  });

  const createSouth = (southConfiguration = configuration) =>
    new SouthBACnet(southConfiguration, addContentCallback, southCacheRepository, 'cacheFolder');

  beforeEach(() => {
    logger = new PinoLogger();
    bacnetExports.default = createClientConstructor();
    addContentCallback = mock.fn(async () => undefined);
    southCacheRepository = createMock<SouthCacheRepository>({ getItemsLastValues: () => new Map() });
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = createSouth();
  });

  afterEach(async () => {
    // Releases the shared socket, so that the next test opens its own client
    await south.disconnect();
    mock.timers.reset();
    mock.restoreAll();
  });

  async function connectSouth(): Promise<BACnetClientMock> {
    const connectPromise = south.connect();
    await flushPromises();
    await connectPromise;
    return lastCreatedClient;
  }

  /** The time values sent to the engine by the first addContent call */
  const publishedValues = () =>
    (addContentCallback.mock.calls[0].arguments[1] as { content: Array<{ pointId: string; timestamp: string; value: unknown }> }).content;

  describe('connect / disconnect', () => {
    it('should properly connect and open a BACnet/IP client', async () => {
      await connectSouth();

      assert.strictEqual(bacnetExports.default.mock.calls.length, 1);
      assert.deepStrictEqual(bacnetExports.default.mock.calls[0].arguments[0], {
        interface: undefined,
        port: 47809,
        apduTimeout: 100,
        broadcastAddress: '255.255.255.255'
      });
    });

    it('should register as a foreign device and schedule renewal when BBMD is enabled', async () => {
      south = createSouth(withBbmd());
      const client = await connectSouth();

      assert.strictEqual(client.registerForeignDevice.mock.calls.length, 1);
      assert.deepStrictEqual(client.registerForeignDevice.mock.calls[0].arguments, [{ address: '10.0.0.1:47808' }, 900]);

      mock.timers.tick(900 * 500);
      await flushPromises();
      assert.strictEqual(client.registerForeignDevice.mock.calls.length, 2);
    });

    it('should reconnect after a transport error', async () => {
      const client = await connectSouth();

      client.emit('error', new Error('ENETUNREACH'));
      await flushPromises();
      mock.timers.tick(1000);
      await flushPromises();

      assert.strictEqual(bacnetExports.default.mock.calls.length, 2);
    });

    it('should close the client on disconnect', async () => {
      const client = await connectSouth();

      await south.disconnect();
      assert.strictEqual(client.close.mock.calls.length, 1);
    });

    it('should retry a failed BBMD registration renewal every retryInterval', async () => {
      south = createSouth(withBbmd());
      const client = await connectSouth();
      client.registerForeignDevice.mock.mockImplementation(async () => {
        throw new Error('ERR_TIMEOUT');
      });

      // The first call is the registration on connect
      mock.timers.tick(900 * 500);
      await flushPromises();
      assert.strictEqual(client.registerForeignDevice.mock.calls.length, 2);

      client.registerForeignDevice.mock.mockImplementation(async () => undefined);
      mock.timers.tick(1000);
      await flushPromises();
      assert.strictEqual(client.registerForeignDevice.mock.calls.length, 3);
    });
  });

  describe('testConnection', () => {
    it('should discover devices via whoIs and reuse a live client', async () => {
      const client = await connectSouth();

      const testPromise = south.testConnection();
      await flushPromises();
      client.emit('iAm', iAm('192.168.1.10', 10));
      mock.timers.tick(3000);
      const result = await testPromise;

      assert.strictEqual(client.whoIs.mock.calls.length, 1);
      assert.strictEqual(client.close.mock.calls.length, 0);
      assert.deepStrictEqual(result.items[0], { key: 'DevicesFound', value: '1' });
    });

    it('should send a global Who-Is broadcast, so that routers forward it to the networks behind them', async () => {
      const client = await connectSouth();

      const testPromise = south.testConnection();
      await flushPromises();
      client.emit('iAm', iAm('192.168.1.20', 1000));
      client.emit('iAm', routedIAm([5], 2005, '192.168.1.20'));
      mock.timers.tick(3000);
      const result = await testPromise;

      assert.deepStrictEqual(client.whoIs.mock.calls[0].arguments, [{ net: 0xffff }]);
      assert.deepStrictEqual(result.items, [
        { key: 'DevicesFound', value: '2' },
        { key: 'Device 1000', value: '192.168.1.20' },
        { key: 'Device 2005', value: '192.168.1.20, network 2, MAC 5' }
      ]);
    });

    it('should report each device address from the I-Am sender, using the original sender of a BBMD-forwarded reply', async () => {
      const client = await connectSouth();

      const testPromise = south.testConnection();
      await flushPromises();
      client.emit('iAm', iAm('192.168.1.10', 10));
      client.emit('iAm', iAm('10.0.0.1', 20, '172.16.0.5:47809'));
      client.emit('iAm', iAm('192.168.1.10', 10));
      mock.timers.tick(3000);
      const result = await testPromise;

      assert.deepStrictEqual(result.items, [
        { key: 'DevicesFound', value: '2' },
        { key: 'Device 10', value: '192.168.1.10' },
        { key: 'Device 20', value: '172.16.0.5:47809' }
      ]);
    });

    it('should register as a foreign device, then use whoIsThroughBBMD when BBMD is enabled', async () => {
      south = createSouth(withBbmd());
      let registrationsBeforeWhoIs: number | null = null;
      setUpNextClient(created =>
        created.whoIsThroughBBMD.mock.mockImplementation(() => {
          registrationsBeforeWhoIs = created.registerForeignDevice.mock.calls.length;
        })
      );

      const testPromise = south.testConnection();
      await flushPromises();
      const client = lastCreatedClient;
      mock.timers.tick(3000);
      await testPromise;

      assert.deepStrictEqual(client.registerForeignDevice.mock.calls[0].arguments, [{ address: '10.0.0.1:47808' }, 900]);
      assert.strictEqual(registrationsBeforeWhoIs, 1);
      assert.strictEqual(client.whoIsThroughBBMD.mock.calls.length, 1);
      assert.deepStrictEqual(client.whoIsThroughBBMD.mock.calls[0].arguments, [{ address: '10.0.0.1:47808' }]);
      // Not reused from a live connection: opened and closed just for the test, and never renewed.
      assert.strictEqual(client.close.mock.calls.length, 1);
      mock.timers.tick(900 * 500);
      await flushPromises();
      assert.strictEqual(client.registerForeignDevice.mock.calls.length, 1);
    });

    it('should fail the test when the BBMD refuses the foreign device registration', async () => {
      south = createSouth(withBbmd());
      setUpNextClient(created =>
        created.registerForeignDevice.mock.mockImplementation(async () => {
          throw new Error('BacnetError - Class:7 - Code:0 - Result:48');
        })
      );

      await assert.rejects(south.testConnection(), {
        message: 'Could not register as a foreign device with BBMD 10.0.0.1:47808: BacnetError - Class:7 - Code:0 - Result:48'
      });
      assert.strictEqual(lastCreatedClient.whoIsThroughBBMD.mock.calls.length, 0);
      assert.strictEqual(lastCreatedClient.close.mock.calls.length, 1);
    });

    it('should read the target device directly, without any Who-Is', async () => {
      south = createSouth(targetDeviceConfiguration);

      const result = await south.testConnection();

      const client = lastCreatedClient;
      assert.strictEqual(client.whoIs.mock.calls.length, 0);
      assert.strictEqual(client.whoIsThroughBBMD.mock.calls.length, 0);
      assert.deepStrictEqual(client.readProperty.mock.calls[0].arguments.slice(0, 3), [
        { address: '172.16.32.20' },
        { type: 8, instance: 201 },
        77
      ]);
      assert.deepStrictEqual(result.items, [
        { key: 'DevicesFound', value: '1' },
        { key: 'Device 201', value: '172.16.32.20' }
      ]);
      assert.strictEqual(client.close.mock.calls.length, 1);
    });

    it('should fail the test when the target device does not answer', async () => {
      south = createSouth(targetDeviceConfiguration);
      setUpNextClient(client =>
        client.readProperty.mock.mockImplementation(async () => {
          throw new Error('ERR_TIMEOUT');
        })
      );

      await assert.rejects(south.testConnection(), { message: 'Device 201 at 172.16.32.20 did not answer: ERR_TIMEOUT' });
      assert.strictEqual(lastCreatedClient.close.mock.calls.length, 1);
    });

    it('should decode the refusal when the target device is not the configured device instance', async () => {
      south = createSouth(targetDeviceConfiguration);
      setUpNextClient(client =>
        client.readProperty.mock.mockImplementation(async () => {
          throw new Error('BacnetError - Class:1 - Code:31');
        })
      );

      await assert.rejects(south.testConnection(), { message: 'Device 201 at 172.16.32.20 did not answer: OBJECT/UNKNOWN_OBJECT' });
    });

    it('should still register with the BBMD, but not discover through it, when a target device is set', async () => {
      south = createSouth(withBbmd(targetDeviceConfiguration));

      await south.testConnection();

      const client = lastCreatedClient;
      assert.strictEqual(client.registerForeignDevice.mock.calls.length, 1);
      assert.strictEqual(client.whoIsThroughBBMD.mock.calls.length, 0);
      assert.strictEqual(client.whoIs.mock.calls.length, 0);
    });
  });

  describe('shared socket', () => {
    it('should test other settings through the socket of a connector running on the same port', async () => {
      const liveClient = await connectSouth();
      const tested = createSouth(routerConfiguration);

      const testPromise = tested.testConnection();
      await flushPromises();
      liveClient.emit('iAm', iAm('127.0.0.1:47809', 1001));
      mock.timers.tick(3000);
      const result = await testPromise;

      assert.strictEqual(bacnetExports.default.mock.calls.length, 1);
      assert.deepStrictEqual(liveClient.whoIs.mock.calls.at(-1)!.arguments, [{ address: '127.0.0.1:47809', net: 0xffff }]);
      assert.deepStrictEqual(result.items, [
        { key: 'DevicesFound', value: '1' },
        { key: 'Device 1001', value: '127.0.0.1:47809' }
      ]);
      // Still used by the running connector
      assert.strictEqual(liveClient.close.mock.calls.length, 0);
    });

    it('should close the socket when its last connector releases it', async () => {
      const liveClient = await connectSouth();
      const explorer = createSouth(targetDeviceConfiguration);
      await explorer.connect();

      await south.disconnect();
      assert.strictEqual(liveClient.close.mock.calls.length, 0);
      await explorer.disconnect();
      assert.strictEqual(liveClient.close.mock.calls.length, 1);
      assert.strictEqual(bacnetExports.default.mock.calls.length, 1);
    });

    it('should open one socket per port', async () => {
      await connectSouth();
      const otherPort = createSouth(withSettings({ port: 47810 }));
      await otherPort.connect();

      assert.deepStrictEqual(
        bacnetExports.default.mock.calls.map(call => (call.arguments[0] as { port: number }).port),
        [47809, 47810]
      );
      await otherPort.disconnect();
    });

    it('should open a new socket after a transport error', async () => {
      const failedClient = await connectSouth();
      failedClient.emit('error', new Error('socket failure'));
      await flushPromises();

      const tested = createSouth(targetDeviceConfiguration);
      await tested.testConnection();

      assert.strictEqual(bacnetExports.default.mock.calls.length, 2);
      assert.notStrictEqual(lastCreatedClient, failedClient);
      assert.strictEqual(failedClient.close.mock.calls.length, 1);
    });
  });

  describe('testConnection with a router', () => {
    it('should send a global Who-Is to the router alone, and list the router and the devices behind it', async () => {
      south = createSouth(routerConfiguration);

      const testPromise = south.testConnection();
      await flushPromises();
      const client = lastCreatedClient;
      client.emit('iAm', iAm('127.0.0.1:47809', 1001));
      client.emit('iAm', routedIAm([5], 1002));
      mock.timers.tick(3000);
      const result = await testPromise;

      assert.deepStrictEqual(
        client.whoIs.mock.calls.map(call => call.arguments),
        [[{ address: '127.0.0.1:47809', net: 0xffff }]]
      );
      assert.deepStrictEqual(result.items, [
        { key: 'DevicesFound', value: '2' },
        { key: 'Device 1001', value: '127.0.0.1:47809' },
        { key: 'Device 1002', value: '127.0.0.1:47809, network 2, MAC 5' }
      ]);
    });

    it('should send the Who-Is to the router, not through the BBMD, when BBMD is enabled', async () => {
      south = createSouth(withBbmd(routerConfiguration));

      const testPromise = south.testConnection();
      await flushPromises();
      const client = lastCreatedClient;
      mock.timers.tick(3000);
      await testPromise;

      assert.strictEqual(client.registerForeignDevice.mock.calls.length, 1);
      assert.strictEqual(client.whoIsThroughBBMD.mock.calls.length, 0);
      assert.deepStrictEqual(client.whoIs.mock.calls[0].arguments, [{ address: '127.0.0.1:47809', net: 0xffff }]);
    });
  });

  describe('testItem', () => {
    it('should read the configured property and return one time value', async () => {
      const testPromise = south.testItem(item1, noHistory);
      await flushPromises();
      const result = await testPromise;

      assert.ok(result.result.type === 'record-list');
      assert.deepStrictEqual(result.result.content[0].value, 42);
      assert.strictEqual(typeof result.connectionDuration, 'number');
      assert.strictEqual(typeof result.queryDuration, 'number');
      assert.strictEqual(lastCreatedClient.close.mock.calls.length, 1);
    });

    it('should register as a foreign device before testing an item when BBMD is enabled', async () => {
      south = createSouth(withBbmd());

      const testPromise = south.testItem(item1, noHistory);
      await flushPromises();
      const client = lastCreatedClient;
      mock.timers.tick(3000);
      await testPromise;

      assert.strictEqual(client.registerForeignDevice.mock.calls.length, 1);
      assert.strictEqual(client.close.mock.calls.length, 1);
    });

    it('should read the item device directly, without any Who-Is', async () => {
      await south.testItem(item1, noHistory);

      const client = lastCreatedClient;
      assert.strictEqual(client.whoIs.mock.calls.length, 0);
      assert.deepStrictEqual(client.readProperty.mock.calls[0].arguments.slice(0, 2), [
        { address: item1.settings.deviceAddress },
        { type: 0, instance: 1 }
      ]);
    });

    it('should read a routed item through its router', async () => {
      await south.testItem(routedItem1, noHistory);

      assert.deepStrictEqual(lastCreatedClient.readProperty.mock.calls[0].arguments[0], { address: '192.168.1.20', net: 2, adr: [5] });
    });

    it('should name the item read and decode the error when the device refuses it', async () => {
      setUpNextClient(client =>
        client.readProperty.mock.mockImplementation(async () => {
          throw new Error('BacnetError - Class:1 - Code:31');
        })
      );

      await assert.rejects(south.testItem(item1, noHistory), {
        message: 'Device 192.168.1.10 refused to read present-value of analog-input 1: OBJECT/UNKNOWN_OBJECT'
      });
      assert.strictEqual(lastCreatedClient.close.mock.calls.length, 1);
    });

    it('should not rewrite errors other than device refusals', async () => {
      setUpNextClient(client =>
        client.readProperty.mock.mockImplementation(async () => {
          throw new Error('ERR_TIMEOUT');
        })
      );

      await assert.rejects(south.testItem(item1, noHistory), { message: 'ERR_TIMEOUT' });
    });
  });

  describe('directQuery', () => {
    it('should run up to maxParallelRun work-units in parallel, within the manifest ceiling', () => {
      for (const [maxParallelRun, expected] of [
        [4, 4],
        [50, 16],
        [0, 1]
      ]) {
        const parallel = createSouth(withSettings({ maxParallelRun }));
        assert.strictEqual(parallel['getMaxParallelRun'](), expected);
      }
    });

    it('should send one request at a time to a device, while reading different devices in parallel', async () => {
      const client = await connectSouth();
      const inFlight = new Map<string, number>();
      const maxInFlight = new Map<string, number>();
      let maxDevicesInFlight = 0;
      const pending: Array<() => void> = [];
      client.readPropertyMultiple.mock.mockImplementation(async address => {
        inFlight.set(address.address, (inFlight.get(address.address) ?? 0) + 1);
        maxInFlight.set(address.address, Math.max(maxInFlight.get(address.address) ?? 0, inFlight.get(address.address)!));
        maxDevicesInFlight = Math.max(maxDevicesInFlight, Array.from(inFlight.values()).filter(count => count > 0).length);
        await new Promise<void>(resolve => pending.push(resolve));
        inFlight.set(address.address, inFlight.get(address.address)! - 1);
        if (address.address === '192.168.1.10' && client.readPropertyMultiple.mock.calls.length === 1) {
          // A failed read must still let the next read of the device go.
          throw new Error('ERR_TIMEOUT');
        }
        return { len: 0, values: [] };
      });

      const queries = [south.directQuery([item1]), south.directQuery([item2]), south.directQuery([item3])];
      for (let i = 0; i < 5; i++) {
        await flushPromises();
        pending.shift()?.();
      }
      await Promise.all(queries);

      assert.strictEqual(client.readPropertyMultiple.mock.calls.length, 3);
      assert.strictEqual(maxInFlight.get('192.168.1.10'), 1);
      assert.strictEqual(maxInFlight.get('192.168.1.11'), 1);
      assert.strictEqual(maxDevicesInFlight, 2);
    });

    it('should batch reads per device, respecting maxObjectsPerRequest, and cache the results', async () => {
      const client = await connectSouth();
      client.readPropertyMultiple.mock.mockImplementation(
        async (_address: unknown, specs: Array<{ objectId: { type: number; instance: number } }>) => ({
          len: 0,
          values: specs.map(spec => ({
            objectId: spec.objectId,
            values: [{ id: 85, index: 0xffffffff, value: [{ type: 2, value: spec.objectId.instance }] }]
          }))
        })
      );

      await south.directQuery([item1, item2, item3]);

      // Two devices: 192.168.1.10 (item1, item2 - chunked into 1 request of 2 since maxObjectsPerRequest=2)
      // and 192.168.1.11 (item3 - 1 request).
      assert.strictEqual(client.readPropertyMultiple.mock.calls.length, 2);
      assert.strictEqual(addContentCallback.mock.calls.length, 1);
      const content = publishedValues();
      assert.strictEqual(content.length, 3);
    });

    it('should skip a device that returns a device-scoped error without affecting other devices', async () => {
      const client = await connectSouth();
      client.readPropertyMultiple.mock.mockImplementation(async (address: { address: string }) => {
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
      const content = publishedValues();
      assert.strictEqual(content.length, 1);
      assert.strictEqual(content[0].pointId, 'item3');
    });

    it('should trigger a reconnect on a non-device-scoped error', async () => {
      const client = await connectSouth();
      client.readPropertyMultiple.mock.mockImplementation(async () => {
        throw new Error('ERR_CLOSED');
      });

      await assert.rejects(south.directQuery([item1]));
      await flushPromises();

      assert.strictEqual(client.close.mock.calls.length, 1);
    });

    it('should read routed devices through their router, each device on its own', async () => {
      const hexItem = buildItem({
        id: 'routed3',
        name: 'routed3',
        settings: { ...routedItem1.settings, macAddress: '0a:00:00:05:BA:C0' }
      });
      const client = await connectSouth();
      client.readPropertyMultiple.mock.mockImplementation(async (_address, specs) => ({
        len: 0,
        values: specs.map(spec => ({
          objectId: spec.objectId,
          values: [{ id: 85, index: bacnetJs.ASN1_ARRAY_ALL, value: [{ type: 4, value: 21.5 }] }]
        }))
      }));

      await south.directQuery([routedItem1, routedItem2, hexItem, item1]);

      assert.deepStrictEqual(
        client.readPropertyMultiple.mock.calls.map(call => call.arguments[0]),
        [
          { address: '192.168.1.20', net: 2, adr: [5] },
          { address: '192.168.1.20', net: 2, adr: [6] },
          { address: '192.168.1.20', net: 2, adr: [0x0a, 0x00, 0x00, 0x05, 0xba, 0xc0] },
          { address: '192.168.1.10' }
        ]
      );
      const content = publishedValues();
      assert.deepStrictEqual(
        content.map(value => value.pointId),
        ['routed1', 'routed2', 'routed3', 'item1']
      );
    });

    it('should log a property the device answered with an error instead of publishing it', async () => {
      const client = await connectSouth();
      client.readPropertyMultiple.mock.mockImplementation(async () => ({
        len: 0,
        values: [
          { objectId: { type: 0, instance: 1 }, values: [{ id: 85, index: bacnetJs.ASN1_ARRAY_ALL, value: [{ type: 4, value: 21.5 }] }] },
          {
            objectId: { type: 0, instance: 2 },
            values: [{ id: 85, index: bacnetJs.ASN1_ARRAY_ALL, value: [{ type: 105, value: { errorClass: 1, errorCode: 31 } }] }]
          }
        ]
      }));

      await south.directQuery([item1, item2]);

      const content = publishedValues();
      assert.deepStrictEqual(
        content.map(value => [value.pointId, value.value]),
        [['item1', 21.5]]
      );
      assert.ok(logged(logger.warn, '"item2"', 'OBJECT/UNKNOWN_OBJECT'));
    });

    it('should read several properties of the same object into their own items', async () => {
      const statusFlagsItem = buildItem({ id: 'id5', name: 'item5', settings: { ...item1.settings, propertyIdentifier: 'status-flags' } });
      const client = await connectSouth();
      client.readPropertyMultiple.mock.mockImplementation(async (_address, specs) => ({
        len: 0,
        values: specs.map(spec => ({
          objectId: spec.objectId,
          values: spec.properties.map(property => ({
            id: property.id,
            index: property.index,
            value: property.id === 85 ? [{ type: 4, value: 21.5 }] : [{ type: 8, value: { bitsUsed: 4, value: [0b1001] } }]
          }))
        }))
      }));

      await south.directQuery([item1, statusFlagsItem]);

      assert.strictEqual(client.readPropertyMultiple.mock.calls.length, 1);
      assert.deepStrictEqual(client.readPropertyMultiple.mock.calls[0].arguments[1], [
        {
          objectId: { type: 0, instance: 1 },
          properties: [
            { id: 85, index: bacnetJs.ASN1_ARRAY_ALL },
            { id: 111, index: bacnetJs.ASN1_ARRAY_ALL }
          ]
        }
      ]);
      const content = publishedValues();
      assert.deepStrictEqual(
        content.map(value => [value.pointId, value.value]),
        [
          ['item1', 21.5],
          ['item5', '1001']
        ]
      );
    });

    it('should fall back to ReadProperty when a device refuses ReadPropertyMultiple', async () => {
      const client = await connectSouth();
      client.readPropertyMultiple.mock.mockImplementation(async () => {
        throw new Error('BacnetAbort - Reason:9');
      });
      client.readProperty.mock.mockImplementation(async (_address, objectId) => {
        if (objectId.instance === 2) throw new Error('BacnetError - Class:1 - Code:31');
        return { len: 0, objectId, property: { id: 85, index: bacnetJs.ASN1_ARRAY_ALL }, values: [{ type: 4, value: 21.5 }] };
      });

      await south.directQuery([item1, item2]);

      assert.strictEqual(client.readProperty.mock.calls.length, 2);
      const content = publishedValues();
      assert.deepStrictEqual(
        content.map(value => [value.pointId, value.value]),
        [['item1', 21.5]]
      );
      assert.ok(logged(logger.warn, '"item2"', 'OBJECT/UNKNOWN_OBJECT'));
    });

    it('should skip the device when ReadProperty times out during the fallback', async () => {
      const client = await connectSouth();
      client.readPropertyMultiple.mock.mockImplementation(async () => {
        throw new Error('BacnetAbort - Reason:9');
      });
      client.readProperty.mock.mockImplementation(async () => {
        throw new Error('ERR_TIMEOUT');
      });

      await south.directQuery([item1, item2]);

      assert.strictEqual(client.readProperty.mock.calls.length, 1);
      assert.strictEqual(addContentCallback.mock.calls.length, 0);
      assert.strictEqual(client.close.mock.calls.length, 0);
    });
  });

  describe('historyQuery', () => {
    const trendLogItem = buildItem({
      id: 'trendLog1',
      name: 'trendLog1',
      settings: {
        deviceAddress: '192.168.1.10',
        deviceInstance: 10,
        objectType: 'trend-log',
        objectInstance: 1,
        timezone: 'UTC',
        routed: false
      }
    });

    /** Serves a log buffer by position, as a device does: count < 0 reads the records before the position. */
    function serveLogBuffer(client: BACnetClientMock, records: Array<{ timestamp: Date; value: unknown; isLogStatus?: boolean }>) {
      client.readProperty.mock.mockImplementation(async (_address, objectId, propertyId) => ({
        len: 0,
        objectId,
        property: { id: propertyId, index: bacnetJs.ASN1_ARRAY_ALL },
        values: [{ type: 2, value: records.length }]
      }));
      client.readRange.mock.mockImplementation(async (_address, _objectId, position, count) => {
        const values =
          count < 0 ? records.slice(Math.max(0, position + count), position) : records.slice(position - 1, position - 1 + count);
        return { itemCount: values.length, values };
      });
    }

    it('should read a trend log backwards by position until the start of the window', async () => {
      const client = await connectSouth();
      // Positions 1 to 6, one record a minute; the 4th is a log status record, without value.
      serveLogBuffer(client, [
        { timestamp: new Date(2026, 9, 14, 11, 56), value: 18 },
        { timestamp: new Date(2026, 9, 14, 11, 57), value: 19 },
        { timestamp: new Date(2026, 9, 14, 11, 58), value: 20 },
        { timestamp: new Date(2026, 9, 14, 11, 58, 30), value: null, isLogStatus: true },
        { timestamp: new Date(2026, 9, 14, 11, 59), value: 21 },
        { timestamp: new Date(2026, 9, 14, 12, 0), value: 22 }
      ]);

      const result = await south.historyQuery([trendLogItem], '2026-10-14T11:57:00.000Z', '2026-10-14T11:59:30.000Z');

      // maxObjectsPerRequest is 2: positions 5-6, 3-4, then 1-2, where 11:57 reaches the (excluded) start.
      assert.deepStrictEqual(
        client.readRange.mock.calls.map(call => call.arguments.slice(1)),
        [
          [{ type: 20, instance: 1 }, 6, -2],
          [{ type: 20, instance: 1 }, 4, -2],
          [{ type: 20, instance: 1 }, 2, -2]
        ]
      );
      const content = publishedValues();
      assert.deepStrictEqual(
        content.map(value => [value.pointId, value.timestamp, value.value]),
        [
          ['trendLog1', '2026-10-14T11:58:00.000Z', 20],
          ['trendLog1', '2026-10-14T11:59:00.000Z', 21]
        ]
      );
      assert.strictEqual(result.trackedInstant, '2026-10-14T11:59:00.000Z');
    });

    it('should not read the log buffer of an empty trend log', async () => {
      const client = await connectSouth();
      serveLogBuffer(client, []);

      const result = await south.historyQuery([trendLogItem], '2026-10-14T11:00:00.000Z', '2026-10-14T12:00:00.000Z');

      assert.strictEqual(client.readRange.mock.calls.length, 0);
      assert.strictEqual(addContentCallback.mock.calls.length, 0);
      assert.deepStrictEqual(result, { trackedInstant: null, value: null });
    });

    it('should skip a trend log whose device fails, and keep reading the others', async () => {
      const otherTrendLog = buildItem({
        id: 'trendLog2',
        name: 'trendLog2',
        settings: { ...trendLogItem.settings, deviceAddress: '192.168.1.11' }
      });
      const client = await connectSouth();
      serveLogBuffer(client, [{ timestamp: new Date(2026, 9, 14, 11, 30), value: 1 }]);
      client.readProperty.mock.mockImplementation(async (address, objectId, propertyId) => {
        if (address.address === '192.168.1.10') throw new Error('ERR_TIMEOUT');
        return { len: 0, objectId, property: { id: propertyId, index: bacnetJs.ASN1_ARRAY_ALL }, values: [{ type: 2, value: 1 }] };
      });

      await south.historyQuery([trendLogItem, otherTrendLog], '2026-10-14T11:00:00.000Z', '2026-10-14T12:00:00.000Z');

      const content = publishedValues();
      assert.deepStrictEqual(
        content.map(value => value.pointId),
        ['trendLog2']
      );
      assert.ok(logged(logger.warn, '"trendLog1"'));
    });

    it("should read record timestamps in the item's time zone", async () => {
      const parisTrendLog = buildItem({
        id: trendLogItem.id,
        name: trendLogItem.name,
        settings: { ...trendLogItem.settings, timezone: 'Europe/Paris' }
      });
      setUpNextClient(client => serveLogBuffer(client, [{ timestamp: new Date(2026, 9, 14, 12, 0), value: 21.5 }]));
      const result = await south.testItem(parisTrendLog, {
        history: { startTime: '2026-10-14T09:00:00.000Z', endTime: '2026-10-14T11:00:00.000Z' }
      } as never);

      // 12:00 in Paris (summer time) is 10:00 UTC
      assert.deepStrictEqual((result.result as { content: Array<unknown> }).content, [
        { pointId: 'trendLog1', timestamp: '2026-10-14T10:00:00.000Z', value: 21.5 }
      ]);
    });

    it('should read each trend log in the time zone of its own item', async () => {
      const parisTrendLog = buildItem({
        id: 'trendLog2',
        name: 'trendLog2',
        settings: { ...trendLogItem.settings, deviceAddress: '192.168.1.11', timezone: 'Europe/Paris' }
      });
      const client = await connectSouth();
      // Both devices logged a record at 12:00 on their own clock
      serveLogBuffer(client, [{ timestamp: new Date(2026, 9, 14, 12, 0), value: 1 }]);

      await south.historyQuery([trendLogItem, parisTrendLog], '2026-10-14T09:00:00.000Z', '2026-10-14T13:00:00.000Z');

      const content = publishedValues();
      assert.deepStrictEqual(
        content.map(value => [value.pointId, value.timestamp]),
        [
          ['trendLog1', '2026-10-14T12:00:00.000Z'],
          ['trendLog2', '2026-10-14T10:00:00.000Z']
        ]
      );
    });

    it('should leave trend logs out of polling and COV subscriptions', async () => {
      const client = await connectSouth();

      assert.strictEqual(await south.directQuery([trendLogItem]), null);
      await south.subscribe([buildItem({ ...trendLogItem, scanMode: subscriptionScanMode, settings: trendLogItem.settings })]);

      assert.deepStrictEqual(south.filterDirectItems([trendLogItem, item1]), [item1]);
      assert.deepStrictEqual(south.filterHistoryItems([trendLogItem, item1]), [trendLogItem]);
      assert.strictEqual(client.readPropertyMultiple.mock.calls.length, 0);
      assert.strictEqual(client.subscribeCov.mock.calls.length, 0);
      assert.ok(logged(logger.warn, 'cannot be subscribed'));
    });
  });

  describe('subscribe / unsubscribe', () => {
    it('should subscribe with a fresh subscriberProcessId per item and schedule renewal', async () => {
      const client = await connectSouth();

      await south.subscribe([subscriptionItem]);

      assert.strictEqual(client.subscribeCov.mock.calls.length, 1);
      const [, , subscriberProcessId, cancel, issueConfirmed, lifetime] = client.subscribeCov.mock.calls[0].arguments;
      assert.strictEqual(cancel, false);
      assert.strictEqual(issueConfirmed, false);
      assert.strictEqual(lifetime, 300);
      assert.strictEqual(typeof subscriberProcessId, 'number');

      mock.timers.tick((300 - 60) * 1000);
      await flushPromises();
      assert.strictEqual(client.subscribeCov.mock.calls.length, 2);
    });

    it('should buffer and flush COV notifications', async () => {
      const client = await connectSouth();

      await south.subscribe([subscriptionItem]);
      const subscriberProcessId = client.subscribeCov.mock.calls[0].arguments[2];

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
      const content = publishedValues();
      assert.strictEqual(content[0].pointId, 'item4');
      assert.strictEqual(content[0].value, 12.5);
    });

    it('should publish status flags from a SubscribeCOV notification for a status-flags item', async () => {
      const statusFlagsItem = buildItem({
        id: 'id6',
        name: 'item6',
        scanMode: subscriptionScanMode,
        settings: { ...subscriptionItem.settings, propertyIdentifier: 'status-flags' }
      });
      const client = await connectSouth();

      await south.subscribe([statusFlagsItem]);
      assert.strictEqual(client.subscribeCov.mock.calls.length, 1);
      assert.strictEqual(client.subscribeProperty.mock.calls.length, 0);

      client.emit('covNotifyUnconfirmed', {
        payload: {
          subscriberProcessId: client.subscribeCov.mock.calls[0].arguments[2],
          initiatingDeviceId: 10,
          monitoredObjectId: { type: 2, instance: 5 },
          timeRemaining: 300,
          values: [
            { property: { id: 85 }, value: [{ type: 4, value: 12.5 }] },
            { property: { id: 111 }, value: [{ type: 8, value: { bitsUsed: 4, value: [0b0010] } }] }
          ]
        }
      });
      mock.timers.tick(1000);
      await flushPromises();

      const content = publishedValues();
      assert.deepStrictEqual(
        content.map(value => [value.pointId, value.value]),
        [['item6', '0100']]
      );
    });

    it('should use SubscribeCOVProperty for a property that SubscribeCOV does not report', async () => {
      const client = await connectSouth();

      await south.subscribe([reliabilityItem]);

      assert.strictEqual(client.subscribeCov.mock.calls.length, 0);
      assert.strictEqual(client.subscribeProperty.mock.calls.length, 1);
      const [address, objectId, monitoredProperty, subscriberProcessId, cancel, issueConfirmed] =
        client.subscribeProperty.mock.calls[0].arguments;
      assert.deepStrictEqual(address, { address: '192.168.1.10' });
      assert.deepStrictEqual(objectId, { type: 2, instance: 5 });
      assert.deepStrictEqual(monitoredProperty, { id: 103, index: bacnetJs.ASN1_ARRAY_ALL });
      assert.strictEqual(cancel, false);
      assert.strictEqual(issueConfirmed, false);

      const notify = (values: Array<{ property: { id: number }; value: Array<{ type: number; value: unknown }> }>) =>
        client.emit('covNotifyUnconfirmed', {
          payload: { subscriberProcessId, initiatingDeviceId: 10, monitoredObjectId: { type: 2, instance: 5 }, timeRemaining: 0, values }
        });
      // Without the item's property, a notification publishes nothing.
      notify([{ property: { id: 85 }, value: [{ type: 4, value: 12.5 }] }]);
      notify([
        { property: { id: 103 }, value: [{ type: 9, value: 7 }] },
        { property: { id: 111 }, value: [{ type: 8, value: { bitsUsed: 4, value: [0b0010] } }] }
      ]);
      mock.timers.tick(1000);
      await flushPromises();

      const content = publishedValues();
      assert.deepStrictEqual(
        content.map(value => [value.pointId, value.value]),
        [['item7', 7]]
      );

      // Renewed on the usual schedule, then cancelled with SubscribeCOVProperty too.
      mock.timers.tick((300 - 60) * 1000);
      await flushPromises();
      assert.strictEqual(client.subscribeProperty.mock.calls.length, 2);
      await south.unsubscribe([reliabilityItem]);
      assert.strictEqual(client.subscribeProperty.mock.calls.length, 3);
      assert.strictEqual(client.subscribeProperty.mock.calls[2].arguments[3], subscriberProcessId);
      assert.strictEqual(client.subscribeProperty.mock.calls[2].arguments[4], true);
      assert.strictEqual(client.subscribeCov.mock.calls.length, 0);
    });

    it('should cancel SubscribeCOVProperty subscriptions on disconnect', async () => {
      const client = await connectSouth();
      await south.subscribe([reliabilityItem, subscriptionItem]);

      await south.disconnect();

      assert.strictEqual(client.subscribeProperty.mock.calls.length, 2);
      assert.strictEqual(client.subscribeProperty.mock.calls[1].arguments[4], true);
      assert.strictEqual(client.subscribeCov.mock.calls.length, 2);
      assert.strictEqual(client.subscribeCov.mock.calls[1].arguments[3], true);
    });

    it('should hint at polling when a COV subscription to a routed device times out', async () => {
      const routedSubscription = buildItem({ ...routedItem1, scanMode: subscriptionScanMode, settings: routedItem1.settings });
      const client = await connectSouth();
      client.subscribeCov.mock.mockImplementation(async () => {
        throw new Error('ERR_TIMEOUT');
      });

      await south.subscribe([routedSubscription]);

      assert.deepStrictEqual(client.subscribeCov.mock.calls[0].arguments[0], { address: '192.168.1.20', net: 2, adr: [5] });
      assert.ok(logged(logger.warn, 'devices behind a router are not supported yet'));
    });

    it('should hint at polling when a device refuses SubscribeCOVProperty', async () => {
      const client = await connectSouth();
      client.subscribeProperty.mock.mockImplementation(async () => {
        throw new Error('BacnetAbort - Reason:9');
      });

      await south.subscribe([reliabilityItem]);

      assert.ok(logged(logger.warn, 'may not support SubscribeCOVProperty'));
    });

    it('should cancel the COV subscription and clear bookkeeping on unsubscribe', async () => {
      const client = await connectSouth();

      await south.subscribe([subscriptionItem]);
      const subscriberProcessId = client.subscribeCov.mock.calls[0].arguments[2];

      await south.unsubscribe([subscriptionItem]);

      assert.strictEqual(client.subscribeCov.mock.calls.length, 2);
      const [, , cancelledProcessId, cancel] = client.subscribeCov.mock.calls[1].arguments;
      assert.strictEqual(cancelledProcessId, subscriberProcessId);
      assert.strictEqual(cancel, true);

      // No pending renewal timer left over: advancing time triggers no further calls.
      mock.timers.tick(3600 * 1000);
      await flushPromises();
      assert.strictEqual(client.subscribeCov.mock.calls.length, 2);
    });

    it('should ignore a COV notification whose monitored object does not match the subscription', async () => {
      const client = await connectSouth();
      await south.subscribe([subscriptionItem]);
      const subscriberProcessId = client.subscribeCov.mock.calls[0].arguments[2];

      client.emit('covNotifyUnconfirmed', {
        payload: {
          subscriberProcessId,
          initiatingDeviceId: 12,
          monitoredObjectId: { type: 2, instance: 6 },
          timeRemaining: 300,
          values: [{ property: { id: 85 }, value: [{ type: 4, value: 12.5 }] }]
        }
      });
      mock.timers.tick(1000);
      await flushPromises();

      assert.strictEqual(addContentCallback.mock.calls.length, 0);
    });

    it('should retry a failed COV subscription every retryInterval, then renew it', async () => {
      const client = await connectSouth();
      client.subscribeCov.mock.mockImplementationOnce(async () => {
        throw new Error('ERR_TIMEOUT');
      });

      await south.subscribe([subscriptionItem]);
      assert.strictEqual(client.subscribeCov.mock.calls.length, 1);

      mock.timers.tick(1000);
      await flushPromises();
      assert.strictEqual(client.subscribeCov.mock.calls.length, 2);
      assert.strictEqual(client.subscribeCov.mock.calls[1].arguments[2], client.subscribeCov.mock.calls[0].arguments[2]);

      mock.timers.tick((300 - 60) * 1000);
      await flushPromises();
      assert.strictEqual(client.subscribeCov.mock.calls.length, 3);
    });

    it('should retry a failing COV subscription less and less often, warning only once', async () => {
      const client = await connectSouth();
      client.subscribeCov.mock.mockImplementation(async () => {
        throw new Error('BacnetError - Class:5 - Code:29');
      });

      await south.subscribe([subscriptionItem]);
      for (const [delayMs, expectedCalls] of [
        [1000, 2],
        [2000, 3],
        [4000, 4]
      ]) {
        mock.timers.tick(delayMs - 1);
        await flushPromises();
        assert.strictEqual(client.subscribeCov.mock.calls.length, expectedCalls - 1);
        mock.timers.tick(1);
        await flushPromises();
        assert.strictEqual(client.subscribeCov.mock.calls.length, expectedCalls);
      }
      const covWarnings = logger.warn.mock.calls.filter(
        call => typeof call.arguments[1] === 'string' && call.arguments[1].includes('Error subscribing to COV')
      );
      assert.strictEqual(covWarnings.length, 1);
      assert.ok((covWarnings[0].arguments[1] as string).includes('SERVICES/SERVICE_REQUEST_DENIED'));
      assert.ok(logged(logger.debug, 'attempt 3 failed'));

      // Back on its feet: logged once, then renewed on the usual schedule.
      client.subscribeCov.mock.mockImplementation(async () => undefined);
      mock.timers.tick(8000);
      await flushPromises();
      assert.strictEqual(client.subscribeCov.mock.calls.length, 5);
      assert.ok(logged(logger.info, 'after 4 failed'));
      mock.timers.tick((300 - 60) * 1000);
      await flushPromises();
      assert.strictEqual(client.subscribeCov.mock.calls.length, 6);
    });

    it('should never renew a COV subscription sooner than halfway through its lifetime', async () => {
      south = createSouth(withSettings({ covDefaultLifetime: 100, covRenewalMargin: 80 }));
      const client = await connectSouth();
      await south.subscribe([subscriptionItem]);

      mock.timers.tick(49_999);
      await flushPromises();
      assert.strictEqual(client.subscribeCov.mock.calls.length, 1);
      mock.timers.tick(1);
      await flushPromises();
      assert.strictEqual(client.subscribeCov.mock.calls.length, 2);
    });

    it('should retry a failed COV renewal every retryInterval', async () => {
      const client = await connectSouth();
      await south.subscribe([subscriptionItem]);
      client.subscribeCov.mock.mockImplementationOnce(async () => {
        throw new Error('ERR_TIMEOUT');
      }, 1);

      mock.timers.tick((300 - 60) * 1000);
      await flushPromises();
      assert.strictEqual(client.subscribeCov.mock.calls.length, 2);

      mock.timers.tick(1000);
      await flushPromises();
      assert.strictEqual(client.subscribeCov.mock.calls.length, 3);
    });

    it('should stop retrying a failed COV subscription once the item is unsubscribed', async () => {
      const client = await connectSouth();
      client.subscribeCov.mock.mockImplementationOnce(async () => {
        throw new Error('ERR_TIMEOUT');
      });
      await south.subscribe([subscriptionItem]);
      await south.unsubscribe([subscriptionItem]);
      const callsAfterUnsubscribe = client.subscribeCov.mock.calls.length;

      mock.timers.tick(3600 * 1000);
      await flushPromises();
      assert.strictEqual(client.subscribeCov.mock.calls.length, callsAfterUnsubscribe);
    });

    it('should keep the subscriber process id of an item across a reconnect, without cancelling on the device', async () => {
      const firstClient = await connectSouth();
      await south.subscribe([subscriptionItem]);
      const subscriberProcessId = firstClient.subscribeCov.mock.calls[0].arguments[2];

      firstClient.emit('error', new Error('ENETUNREACH'));
      await flushPromises();
      mock.timers.tick(1000);
      await flushPromises();
      const secondClient = lastCreatedClient;
      assert.notStrictEqual(secondClient, firstClient);
      assert.strictEqual(firstClient.subscribeCov.mock.calls.length, 1);

      await south.subscribe([subscriptionItem]);
      assert.strictEqual(secondClient.subscribeCov.mock.calls[0].arguments[2], subscriberProcessId);
    });

    it('should cancel COV subscriptions on the devices on disconnect', async () => {
      const client = await connectSouth();
      await south.subscribe([subscriptionItem]);
      const subscriberProcessId = client.subscribeCov.mock.calls[0].arguments[2];

      await south.disconnect();

      assert.strictEqual(client.subscribeCov.mock.calls.length, 2);
      const [, , cancelledProcessId, cancel] = client.subscribeCov.mock.calls[1].arguments;
      assert.strictEqual(cancelledProcessId, subscriberProcessId);
      assert.strictEqual(cancel, true);
      assert.strictEqual(client.close.mock.calls.length, 1);
    });

    it('should not wait more than one APDU timeout for COV cancellations on disconnect', async () => {
      const client = await connectSouth();
      await south.subscribe([subscriptionItem]);
      client.subscribeCov.mock.mockImplementation(() => new Promise<void>(() => undefined));

      const disconnectPromise = south.disconnect();
      await flushPromises();
      assert.strictEqual(client.close.mock.calls.length, 0);
      mock.timers.tick(100);
      await disconnectPromise;

      assert.strictEqual(client.close.mock.calls.length, 1);
    });
  });

  describe('explore', () => {
    it('should list discovered devices at the root level', async () => {
      const explorePromise = south.explore(null);
      await flushPromises();
      const client = lastCreatedClient;
      client.emit('iAm', iAm('192.168.1.10', 10));
      mock.timers.tick(3000);
      const entries = await explorePromise;

      assert.strictEqual(entries.length, 1);
      assert.strictEqual(entries[0].id, '192.168.1.10|||10');
      assert.strictEqual(entries[0].hasChildren, true);
    });

    it('should list the router and the devices behind it, with the item settings to reach them', async () => {
      south = createSouth(routerConfiguration);

      const explorePromise = south.explore(null);
      await flushPromises();
      lastCreatedClient.emit('iAm', iAm('127.0.0.1:47809', 1001));
      lastCreatedClient.emit('iAm', routedIAm([5], 1002));
      mock.timers.tick(3000);
      const entries = await explorePromise;

      assert.deepStrictEqual(
        entries.map(entry => [entry.id, entry.metadata]),
        [
          ['127.0.0.1:47809|||1001', { address: '127.0.0.1:47809', deviceInstance: 1001 }],
          ['127.0.0.1:47809|2|5|1002', { address: '127.0.0.1:47809', deviceInstance: 1002, networkNumber: 2, macAddress: '5' }]
        ]
      );
    });

    it('should list the target device without any Who-Is', async () => {
      south = createSouth(targetDeviceConfiguration);
      setUpNextClient(client =>
        client.readProperty.mock.mockImplementation(async (_address, objectId, propertyId) => ({
          len: 0,
          objectId,
          property: { id: propertyId, index: bacnetJs.ASN1_ARRAY_ALL },
          values: [{ type: 7, value: 'Remote controller' }]
        }))
      );

      const entries = await south.explore(null);

      assert.strictEqual(lastCreatedClient.whoIs.mock.calls.length, 0);
      assert.deepStrictEqual(entries, [
        {
          id: '172.16.32.20|||201',
          name: 'Remote controller',
          metadata: { address: '172.16.32.20', deviceInstance: 201 },
          hasChildren: true
        }
      ]);
    });

    it('should list routed devices with the item settings to reach them, and browse them through their router', async () => {
      const explorePromise = south.explore(null);
      await flushPromises();
      const client = lastCreatedClient;
      client.emit('iAm', routedIAm([5], 2005, '192.168.1.20'));
      mock.timers.tick(3000);
      const [device] = await explorePromise;

      assert.deepStrictEqual(device, {
        id: '192.168.1.20|2|5|2005',
        name: 'Device 2005',
        metadata: { address: '192.168.1.20', deviceInstance: 2005, networkNumber: 2, macAddress: '5' },
        hasChildren: true
      });

      client.readProperty.mock.mockImplementation(async (_address, objectId, propertyId) => ({
        len: 0,
        objectId,
        property: { id: propertyId, index: bacnetJs.ASN1_ARRAY_ALL },
        values: [{ type: 12, value: { type: 0, instance: 1 } }]
      }));
      const entries = await south.explore(device.id);

      assert.deepStrictEqual(client.readProperty.mock.calls.at(-1)!.arguments.slice(0, 2), [
        { address: '192.168.1.20', net: 2, adr: [5] },
        { type: 8, instance: 2005 }
      ]);
      assert.deepStrictEqual(client.readPropertyMultiple.mock.calls[0].arguments[0], { address: '192.168.1.20', net: 2, adr: [5] });
      assert.strictEqual(entries[0].id, '192.168.1.20|2|5|2005|0|1');
    });

    it('should list a device objects but the device itself, and degrade gracefully when enrichment fails', async () => {
      const client = await connectSouth();
      client.readProperty.mock.mockImplementation(async () => ({
        len: 0,
        objectId: { type: 8, instance: 10 },
        property: { id: 76, index: 0xffffffff },
        values: [
          // the object list of a device holds the device object itself
          { type: 12, value: { type: 8, instance: 10 } },
          { type: 12, value: { type: 0, instance: 1 } },
          { type: 12, value: { type: 3, instance: 2 } }
        ]
      }));
      client.readPropertyMultiple.mock.mockImplementation(async () => {
        throw new Error('ERR_TIMEOUT');
      });

      const entries = await south.explore('192.168.1.10|||10');

      assert.deepStrictEqual(
        entries.map(entry => [entry.id, entry.name, entry.hasChildren]),
        [
          ['192.168.1.10|||10|0|1', 'ANALOG_INPUT 1', false],
          ['192.168.1.10|||10|3|2', 'BINARY_INPUT 2', false]
        ]
      );
    });

    it('should read the object list entry by entry when the device refuses to send it whole', async () => {
      const client = await connectSouth();
      client.readProperty.mock.mockImplementation(async (_address, objectId, propertyId, options) => {
        if (options?.arrayIndex !== 0) throw new Error('BacnetAbort - Reason:4');
        return { len: 0, objectId, property: { id: propertyId, index: 0 }, values: [{ type: 2, value: 2 }] };
      });
      client.readPropertyMultiple.mock.mockImplementation(async (_address, specs) => ({
        len: 0,
        values: specs.map(spec => ({
          objectId: spec.objectId,
          values: spec.properties.map(property => {
            if (property.id === 76) {
              return {
                id: 76,
                index: property.index,
                value: [{ type: 12, value: { type: property.index === 1 ? 0 : 3, instance: property.index } }]
              };
            }
            if (property.id === 77) {
              return { id: 77, index: property.index, value: [{ type: 7, value: `Point ${spec.objectId.instance}` }] };
            }
            return spec.objectId.type === 0
              ? { id: 85, index: property.index, value: [{ type: 4, value: 21.5 }] }
              : { id: 85, index: property.index, value: [{ type: 105, value: { errorClass: 2, errorCode: 32 } }] };
          })
        }))
      }));

      const entries = await south.explore('192.168.1.10|||10');

      assert.deepStrictEqual(client.readProperty.mock.calls[1].arguments[3], { arrayIndex: 0 });
      assert.deepStrictEqual(client.readPropertyMultiple.mock.calls[0].arguments[1], [
        {
          objectId: { type: 8, instance: 10 },
          properties: [
            { id: 76, index: 1 },
            { id: 76, index: 2 }
          ]
        }
      ]);
      assert.deepStrictEqual(
        entries.map(entry => [entry.id, entry.name, entry.metadata]),
        [
          ['192.168.1.10|||10|0|1', 'Point 1', { objectType: 'ANALOG_INPUT', objectInstance: 1, value: 21.5 }],
          ['192.168.1.10|||10|3|2', 'Point 2', { objectType: 'BINARY_INPUT', objectInstance: 2 }]
        ]
      );
    });
  });

  describe('discover', () => {
    interface FakeObject {
      type: number;
      instance: number;
      name?: string;
      description?: string;
      units?: number;
    }

    /** The device answers its object list with ReadProperty, and the object properties with ReadPropertyMultiple. */
    function mockDevice(client: BACnetClientMock, deviceName: string, objects: Array<FakeObject>) {
      client.readProperty.mock.mockImplementation(async (_address, objectId, propertyId) => ({
        len: 0,
        objectId,
        property: { id: propertyId, index: bacnetJs.ASN1_ARRAY_ALL },
        values: objects.map(object => ({ type: 12, value: { type: object.type, instance: object.instance } }))
      }));
      const unknownProperty = [{ type: 105, value: { errorClass: 2, errorCode: 32 } }];
      client.readPropertyMultiple.mock.mockImplementation(async (_address, specs) => ({
        len: 0,
        values: specs.map(spec => {
          const object = objects.find(candidate => candidate.type === spec.objectId.type && candidate.instance === spec.objectId.instance);
          return {
            objectId: spec.objectId,
            values: spec.properties.map(property => {
              if (spec.objectId.type === bacnetJs.ObjectType.DEVICE) {
                return { id: property.id, index: property.index, value: [{ type: 7, value: deviceName }] };
              }
              const value = {
                [bacnetJs.PropertyIdentifier.OBJECT_NAME]: object?.name,
                [bacnetJs.PropertyIdentifier.DESCRIPTION]: object?.description,
                [bacnetJs.PropertyIdentifier.UNITS]: object?.units
              }[property.id];
              return {
                id: property.id,
                index: property.index,
                value: value === undefined ? unknownProperty : [{ type: typeof value === 'number' ? 9 : 7, value }]
              };
            })
          };
        })
      }));
    }

    it('should record the readable objects of every discovered device, with the settings to read them', async () => {
      const discoverPromise = south.discover({});
      await flushPromises();
      const client = lastCreatedClient;
      mockDevice(client, 'AHU controller', [
        { type: bacnetJs.ObjectType.DEVICE, instance: 10 },
        {
          type: bacnetJs.ObjectType.ANALOG_INPUT,
          instance: 1,
          name: 'Supply temperature',
          description: 'Supply air',
          units: bacnetJs.EngineeringUnits.DEGREES_CELSIUS
        },
        { type: bacnetJs.ObjectType.BINARY_OUTPUT, instance: 2 },
        { type: bacnetJs.ObjectType.NOTIFICATION_CLASS, instance: 3, name: 'Alarms' }
      ]);
      client.emit('iAm', iAm('192.168.1.10', 10));
      mock.timers.tick(3000);
      const records = await discoverPromise;

      assert.deepStrictEqual(records, [
        {
          id: '192.168.1.10|||10|0|1',
          name: 'Supply temperature',
          deviceName: 'AHU controller',
          deviceAddress: '192.168.1.10',
          deviceInstance: 10,
          routed: false,
          networkNumber: null,
          macAddress: null,
          objectType: 'analog-input',
          objectInstance: 1,
          description: 'Supply air',
          units: 'degrees-celsius'
        },
        {
          id: '192.168.1.10|||10|4|2',
          name: 'binary-output 2',
          deviceName: 'AHU controller',
          deviceAddress: '192.168.1.10',
          deviceInstance: 10,
          routed: false,
          networkNumber: null,
          macAddress: null,
          objectType: 'binary-output',
          objectInstance: 2,
          description: null,
          units: null
        }
      ]);
      // static metadata only: the present value changes on every run
      const readProperties = client.readPropertyMultiple.mock.calls.flatMap(call =>
        call.arguments[1].flatMap(spec => spec.properties.map(property => property.id))
      );
      assert.ok(!readProperties.includes(bacnetJs.PropertyIdentifier.PRESENT_VALUE));
    });

    it('should only discover the device picked as root, through its router, without any Who-Is', async () => {
      const client = await connectSouth();
      mockDevice(client, 'VAV 2005', [{ type: bacnetJs.ObjectType.ANALOG_VALUE, instance: 7, name: 'Setpoint' }]);

      const records = await south.discover({ rootNodeId: '192.168.1.20|2|5|2005' });

      assert.strictEqual(client.whoIs.mock.calls.length, 0);
      assert.deepStrictEqual(client.readProperty.mock.calls[0].arguments.slice(0, 2), [
        { address: '192.168.1.20', net: 2, adr: [5] },
        { type: bacnetJs.ObjectType.DEVICE, instance: 2005 }
      ]);
      assert.deepStrictEqual(records, [
        {
          id: '192.168.1.20|2|5|2005|2|7',
          name: 'Setpoint',
          deviceName: 'VAV 2005',
          deviceAddress: '192.168.1.20',
          deviceInstance: 2005,
          routed: true,
          networkNumber: 2,
          macAddress: '5',
          objectType: 'analog-value',
          objectInstance: 7,
          description: null,
          units: null
        }
      ]);
      // The fields the manifest tells the user about
      assert.deepStrictEqual(Object.keys(records[0]).sort(), [...manifest.discovery!.recordFields!].sort());
    });

    it('should discover the picked devices whole and the picked objects alone, each device read once', async () => {
      const client = await connectSouth();
      mockDevice(client, 'AHU controller', [
        { type: bacnetJs.ObjectType.ANALOG_INPUT, instance: 1, name: 'Supply temperature' },
        { type: bacnetJs.ObjectType.ANALOG_VALUE, instance: 7, name: 'Setpoint' },
        { type: bacnetJs.ObjectType.BINARY_INPUT, instance: 3, name: 'Alarm' },
        { type: bacnetJs.ObjectType.NOTIFICATION_CLASS, instance: 9, name: 'Alarms' }
      ]);

      const records = await south.discover({
        nodeIds: [
          '192.168.1.10|||10',
          '192.168.1.10|||10|0|1',
          '192.168.1.20|2|5|2005|2|7',
          '192.168.1.20|2|5|2005|15|9',
          '192.168.1.20|2|5|2005|3|3'
        ]
      });

      // the object list of the whole device only, the picked objects of the other one are read directly
      assert.strictEqual(client.readProperty.mock.calls.length, 1);
      assert.deepStrictEqual(client.readProperty.mock.calls[0].arguments[0], { address: '192.168.1.10' });
      assert.deepStrictEqual(
        records.map(record => [record.id, record.name]),
        [
          ['192.168.1.10|||10|0|1', 'Supply temperature'],
          ['192.168.1.10|||10|2|7', 'Setpoint'],
          ['192.168.1.10|||10|3|3', 'Alarm'],
          ['192.168.1.20|2|5|2005|2|7', 'Setpoint'],
          ['192.168.1.20|2|5|2005|3|3', 'Alarm']
        ]
      );
    });

    it('should refuse a picked node that is not a device or an object', async () => {
      await connectSouth();

      await assert.rejects(south.discover({ nodeIds: ['192.168.1.10'] }), new Error('"192.168.1.10" is not a BACnet device or object'));
    });

    it('should refuse an object as root', async () => {
      await connectSouth();

      await assert.rejects(
        south.discover({ rootNodeId: '192.168.1.10|||10|0|1' }),
        new Error('"192.168.1.10|||10|0|1" is not a BACnet device')
      );
    });

    it('should fail the run when a device does not answer, rather than return its objects as missing', async () => {
      const client = await connectSouth();
      client.readProperty.mock.mockImplementation(async () => {
        throw new Error('ERR_TIMEOUT');
      });

      await assert.rejects(
        south.discover({ rootNodeId: '192.168.1.10|||10' }),
        new Error('Device 10 at 192.168.1.10 could not be discovered: ERR_TIMEOUT')
      );
    });
  });
});
