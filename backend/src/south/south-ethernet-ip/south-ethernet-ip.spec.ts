import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { DiscoveredTag, PLCConnectOptions, TagValue } from 'ethernet-ip';

import type { SouthEtherNetIPItemSettings, SouthEtherNetIPSettings } from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import { OIBusExploreError } from '../../model/types';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, type Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type * as SouthEtherNetIPModule from './south-ethernet-ip';

const nodeRequire = createRequire(import.meta.url);
const ethernetIp = nodeRequire('ethernet-ip') as typeof import('ethernet-ip');
const { CIPDataType, ConnectionError, TagNotFoundError, TimeoutError } = ethernetIp;

const buildItem = (
  id: string,
  name: string,
  tagName: string,
  overrides: Partial<SouthConnectorItemEntity<SouthEtherNetIPItemSettings>> = {}
): SouthConnectorItemEntity<SouthEtherNetIPItemSettings> => ({
  id,
  name,
  description: null,
  enabled: true,
  settings: { tagName },
  scanMode: testData.scanMode.list[0],
  group: null,
  syncWithGroup: false,
  maxReadInterval: null,
  readDelay: null,
  startTimeOffset: null,
  endTimeOffset: null,
  recoveryStrategy: null,
  emptyIntervalStrategy: null,
  cachingStrategy: 'allValues',
  thresholdType: null,
  threshold: null,
  rangeLow: null,
  rangeHigh: null,
  maxCachingInterval: null,
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: '',
  ...overrides
});

const configuration: SouthConnectorEntity<SouthEtherNetIPSettings, SouthEtherNetIPItemSettings> = {
  id: 'southId',
  name: 'south',
  type: 'ethernet-ip',
  description: 'my test connector',
  enabled: true,
  settings: {
    host: '192.168.1.10',
    slot: 0,
    connectedMessaging: true,
    timeout: 10000,
    retryInterval: 10000
  },
  groups: [],
  items: [
    buildItem('id1', 'Temperature', 'Temperature'),
    buildItem('id2', 'Counter', 'Program:MainProgram.Counter'),
    buildItem('id3', 'Running', 'Running')
  ],
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
};

const buildTag = (name: string, program: string | null, code: number, overrides: Partial<DiscoveredTag['type']> = {}): DiscoveredTag => ({
  id: 1,
  name,
  type: { code, isStruct: false, isReserved: false, arrayDims: 0, dimSizes: [], ...overrides },
  program
});

const discoveredTags: Array<DiscoveredTag> = [
  buildTag('Temperature', null, CIPDataType.REAL),
  buildTag('Running', null, CIPDataType.BOOL),
  {
    ...buildTag('Recipe', null, 0x0f21, { isStruct: true }),
    template: { name: 'RecipeType', attributes: createRecipeAttributes(), members: [] }
  },
  buildTag('Levels', null, CIPDataType.DINT, { arrayDims: 2, dimSizes: [10, 5] }),
  buildTag('Counter', 'MainProgram', CIPDataType.DINT),
  buildTag('Step', 'Sequencer', CIPDataType.INT)
];

function createRecipeAttributes() {
  return { id: 0x0f21, objectDefinitionSize: 0, structureSize: 0, memberCount: 0, structureHandle: 0 };
}

const timeValue = (pointId: string, value: string | number) => ({ pointId, timestamp: testData.constants.dates.FAKE_NOW, value });

const logged = (logMock: Mock<(...args: Array<unknown>) => unknown>, message: string) =>
  logMock.mock.calls.some(c => (c.arguments[0] as string).includes(message));

// Flushes the async unexpected-disconnect handler (it awaits disconnect())
const flushDisconnectHandler = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('South EtherNet/IP', () => {
  let module: typeof SouthEtherNetIPModule;
  let south: SouthEtherNetIPModule.default;
  let logger: PinoLogger;
  let southCacheRepository: Mocked<SouthCacheRepository>;
  let addContent: Mock<SouthEtherNetIPModule.default['addContent']>;
  let latestPlc: FakePLC;
  let tagValues: Record<string, TagValue>;

  // Reads the values of tagValues by tag name, failing like the PLC for an unknown tag
  const readTag = (tagName: string): TagValue => {
    if (!(tagName in tagValues)) throw new TagNotFoundError(tagName);
    return tagValues[tagName];
  };
  const fakeRead = async (tags: string | Array<string>): Promise<TagValue | Array<TagValue>> =>
    Array.isArray(tags) ? tags.map(readTag) : readTag(tags);

  class FakePLC extends EventEmitter {
    connect = mock.fn(async (_ip: string, _options?: PLCConnectOptions): Promise<void> => undefined);
    disconnect = mock.fn(async (): Promise<void> => undefined);
    read = mock.fn(fakeRead);
    discover = mock.fn(async (): Promise<Array<DiscoveredTag>> => discoveredTags);
    isConnected = true;
  }

  // Builds a PLC constructor implementation, `customize` changing the behaviour of the created PLC
  const plcFactory = (customize: (plc: FakePLC) => void = () => undefined) =>
    function () {
      latestPlc = new FakePLC();
      customize(latestPlc);
      return latestPlc;
    };

  // SUT does `new PLC(...)`: a regular function is required
  const ethernetIpExports = { ...ethernetIp, PLC: mock.fn(plcFactory()) };

  before(() => {
    mockModule(nodeRequire, 'ethernet-ip', ethernetIpExports);
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });
    module = reloadModule<typeof SouthEtherNetIPModule>(nodeRequire, './south-ethernet-ip');
  });

  beforeEach(() => {
    logger = new PinoLogger();
    tagValues = { Temperature: 21.5, 'Program:MainProgram.Counter': 7, Running: true };
    ethernetIpExports.PLC = mock.fn(plcFactory());
    southCacheRepository = createMock<SouthCacheRepository>({ getItemsLastValues: () => new Map() });
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new module.default(
      configuration,
      mock.fn(async () => undefined),
      southCacheRepository,
      'cacheFolder'
    );
    addContent = mock.method(south, 'addContent', async () => undefined);
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('connection', () => {
    it('should connect to the PLC with the connector settings', async () => {
      await south.connect();

      assert.strictEqual(ethernetIpExports.PLC.mock.calls.length, 1);
      assert.deepStrictEqual(latestPlc.connect.mock.calls[0].arguments, [
        '192.168.1.10',
        { slot: 0, timeout: 10000, connected: true, autoReconnect: false }
      ]);
      assert.ok(logged(logger.info, 'EtherNet/IP client connected to 192.168.1.10 (slot 0)'));
    });

    it('should log the transport errors instead of throwing them', async () => {
      await south.connect();

      latestPlc.emit('error', new Error('socket hang up'));

      assert.ok(logged(logger.debug, 'EtherNet/IP transport error: socket hang up'));
    });

    it('should reconnect when the connection is lost', async () => {
      await south.connect();
      const firstPlc = latestPlc;

      firstPlc.emit('disconnected');
      await flushDisconnectHandler();

      assert.ok(logged(logger.warn, 'EtherNet/IP connection lost. Reconnecting in 10000 ms'));
      assert.strictEqual(firstPlc.disconnect.mock.calls.length, 1);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(ethernetIpExports.PLC.mock.calls.length, 2);
    });

    it('should not reconnect when the connection is lost while the connector is disabled', async () => {
      south['connector'] = { ...configuration, enabled: false };
      await south.connect();

      latestPlc.emit('disconnected');
      await flushDisconnectHandler();

      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(ethernetIpExports.PLC.mock.calls.length, 1);
    });

    it('should close the session and retry when the connection fails', async () => {
      ethernetIpExports.PLC.mock.mockImplementationOnce(
        plcFactory(plc =>
          plc.connect.mock.mockImplementation(async () => {
            throw new ConnectionError('TCP connect failed: connect ECONNREFUSED 192.168.1.10:44818');
          })
        )
      );

      await south.connect();

      assert.strictEqual(latestPlc.disconnect.mock.calls.length, 1);
      assert.ok(logged(logger.error, 'EtherNet/IP connection error: TCP connect failed: connect ECONNREFUSED'));
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(ethernetIpExports.PLC.mock.calls.length, 2);
    });

    it('should not retry a failed connection when the connector is disabled', async () => {
      south['connector'] = { ...configuration, enabled: false };
      ethernetIpExports.PLC.mock.mockImplementationOnce(
        plcFactory(plc =>
          plc.connect.mock.mockImplementation(async () => {
            throw new Error('connect error');
          })
        )
      );

      await south.connect();

      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(ethernetIpExports.PLC.mock.calls.length, 1);
    });

    it('should disconnect and cancel a pending reconnection', async () => {
      await south.connect();
      const plc = latestPlc;
      south['reconnectTimeout'] = setTimeout(() => null, 1000);

      await south.disconnect();

      assert.strictEqual(plc.disconnect.mock.calls.length, 1);
      assert.strictEqual(plc.listenerCount('disconnected'), 0);
      assert.strictEqual(south['reconnectTimeout'], null);
      assert.strictEqual(south['plc'], null);
    });

    it('should log a disconnection error', async () => {
      await south.connect();
      latestPlc.disconnect.mock.mockImplementation(async () => {
        throw new Error('disconnect error');
      });

      await assert.doesNotReject(south.disconnect());

      assert.ok(logged(logger.error, 'Error while disconnecting EtherNet/IP client: disconnect error'));
    });
  });

  describe('directQuery', () => {
    it('should throw when the PLC is not connected', async () => {
      await assert.rejects(south.directQuery(configuration.items), new Error('Could not read tags: EtherNet/IP client not connected'));

      await south.connect();
      latestPlc.isConnected = false;
      await assert.rejects(south.directQuery(configuration.items), new Error('Could not read tags: EtherNet/IP client not connected'));
    });

    it('should read the tags in one batch and add their values', async () => {
      await south.connect();

      const result = await south.directQuery(configuration.items);

      assert.strictEqual(latestPlc.read.mock.calls.length, 1);
      assert.deepStrictEqual(latestPlc.read.mock.calls[0].arguments[0], ['Temperature', 'Program:MainProgram.Counter', 'Running']);
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, [
        timeValue('Temperature', 21.5),
        timeValue('Counter', 7),
        timeValue('Running', 1)
      ]);
      assert.strictEqual(addContent.mock.calls[0].arguments[1], testData.constants.dates.FAKE_NOW);
      assert.deepStrictEqual(result, timeValue('Running', 1));
    });

    it('should read the tags one by one when the batch fails on a tag', async () => {
      await south.connect();
      const items = [...configuration.items, buildItem('id4', 'Unknown', 'DoesNotExist')];

      await south.directQuery(items);

      assert.strictEqual(latestPlc.read.mock.calls.length, 5);
      assert.ok(logged(logger.error, 'Could not read item "Unknown" with tag "DoesNotExist"'));
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, [
        timeValue('Temperature', 21.5),
        timeValue('Counter', 7),
        timeValue('Running', 1)
      ]);
    });

    it('should disconnect and reconnect on a session error', async () => {
      await south.connect();
      const plc = latestPlc;
      plc.read.mock.mockImplementation(async () => {
        throw new TimeoutError('Request timed out', 10000);
      });

      await assert.rejects(south.directQuery(configuration.items), /Request timed out/);

      assert.strictEqual(plc.disconnect.mock.calls.length, 1);
      assert.strictEqual(addContent.mock.calls.length, 0);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(ethernetIpExports.PLC.mock.calls.length, 2);
    });

    it('should stop reading the tags one by one on a session error', async () => {
      await south.connect();
      latestPlc.read.mock.mockImplementation(async (tags: string | Array<string>) => {
        if (Array.isArray(tags)) throw new TagNotFoundError('DoesNotExist');
        throw new ConnectionError('Connection closed');
      });

      await assert.rejects(south.directQuery(configuration.items), /Connection closed/);

      assert.strictEqual(latestPlc.read.mock.calls.length, 2);
    });

    it('should return null without reading when there is no item', async () => {
      await south.connect();

      assert.strictEqual(await south.directQuery([]), null);
      assert.strictEqual(latestPlc.read.mock.calls.length, 0);
    });
  });

  describe('tests', () => {
    it('should test the connection by listing the tags', async () => {
      const result = await south.testConnection();

      assert.deepStrictEqual(result, {
        items: [
          { key: 'Host', value: '192.168.1.10' },
          { key: 'Slot', value: '0' },
          { key: 'Tags', value: '6' }
        ]
      });
      assert.strictEqual(latestPlc.disconnect.mock.calls.length, 1);
    });

    it('should tell to check the host and the slot when the test connection fails', async () => {
      ethernetIpExports.PLC.mock.mockImplementationOnce(
        plcFactory(plc =>
          plc.connect.mock.mockImplementation(async () => {
            throw new ConnectionError('Forward Open failed');
          })
        )
      );

      await assert.rejects(south.testConnection(), new Error('Please check the host and the slot: Forward Open failed'));
    });

    it('should test an item by reading its tag', async () => {
      const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

      assert.deepStrictEqual(result, {
        result: { type: 'record-list', content: [timeValue('Temperature', 21.5)] },
        connectionDuration: 0,
        queryDuration: 0
      });
      assert.strictEqual(latestPlc.disconnect.mock.calls.length, 1);
    });

    it('should tell which tag could not be read when testing an item', async () => {
      await assert.rejects(
        south.testItem(buildItem('id4', 'Unknown', 'DoesNotExist'), testData.south.itemTestingSettings),
        /Could not read tag "DoesNotExist"/
      );
      assert.strictEqual(latestPlc.disconnect.mock.calls.length, 1);
    });
  });

  describe('explore and discover', () => {
    it('should list the programs and the controller tags at the root level', async () => {
      const entries = await south.explore(null);

      assert.deepStrictEqual(entries, [
        { id: 'Program:MainProgram', name: 'Program:MainProgram', metadata: {}, hasChildren: true },
        { id: 'Program:Sequencer', name: 'Program:Sequencer', metadata: {}, hasChildren: true },
        { id: 'Temperature', name: 'Temperature', metadata: { dataType: 'REAL' }, hasChildren: false },
        { id: 'Running', name: 'Running', metadata: { dataType: 'BOOL' }, hasChildren: false },
        { id: 'Recipe', name: 'Recipe', metadata: { dataType: 'RecipeType' }, hasChildren: false },
        { id: 'Levels', name: 'Levels', metadata: { dataType: 'DINT', arrayDimensions: '10x5' }, hasChildren: false }
      ]);
    });

    it('should list the tags of a program from the tags listed for the root level', async () => {
      await south.explore(null);

      const entries = await south.explore('Program:MainProgram');

      assert.deepStrictEqual(entries, [
        { id: 'Program:MainProgram.Counter', name: 'Counter', metadata: { dataType: 'DINT' }, hasChildren: false }
      ]);
      assert.strictEqual(latestPlc.discover.mock.calls.length, 1);
      assert.strictEqual(ethernetIpExports.PLC.mock.calls.length, 1);
    });

    it('should explore with the live session', async () => {
      await south.connect();

      await south.explore('Program:Sequencer');

      assert.strictEqual(ethernetIpExports.PLC.mock.calls.length, 1);
      assert.strictEqual(latestPlc.discover.mock.calls.length, 1);
    });

    it('should tell a connection error when the PLC cannot be explored', async () => {
      ethernetIpExports.PLC.mock.mockImplementationOnce(
        plcFactory(plc =>
          plc.connect.mock.mockImplementation(async () => {
            throw new ConnectionError('TCP connect failed: timeout');
          })
        )
      );

      await assert.rejects(
        south.explore(null),
        (error: unknown) =>
          error instanceof OIBusExploreError && error.kind === 'connection' && error.message === 'TCP connect failed: timeout'
      );
    });

    it('should discover every tag', async () => {
      const records = await south.discover({});

      assert.strictEqual(records.length, 6);
      assert.deepStrictEqual(records[2], {
        id: 'Recipe',
        name: 'Recipe',
        tagName: 'Recipe',
        program: null,
        dataType: 'RecipeType',
        structure: true,
        arrayDimensions: null
      });
      assert.deepStrictEqual(records[4], {
        id: 'Program:MainProgram.Counter',
        name: 'Counter',
        tagName: 'Program:MainProgram.Counter',
        program: 'MainProgram',
        dataType: 'DINT',
        structure: false,
        arrayDimensions: null
      });
    });

    it('should discover the tags of a root program', async () => {
      const records = await south.discover({ rootNodeId: 'Program:Sequencer' });

      assert.deepStrictEqual(
        records.map(record => record.id),
        ['Program:Sequencer.Step']
      );
    });

    it('should discover the picked tags and the tags of the picked programs', async () => {
      const records = await south.discover({ nodeIds: ['Levels', 'Program:MainProgram', 42] });

      assert.deepStrictEqual(
        records.map(record => [record.id, record.arrayDimensions]),
        [
          ['Levels', '10x5'],
          ['Program:MainProgram.Counter', null]
        ]
      );
    });
  });

  describe('formatTagValue', () => {
    it('should format the tag values as point values', () => {
      const { formatTagValue } = module;
      assert.strictEqual(formatTagValue(12.5), 12.5);
      assert.strictEqual(formatTagValue('text'), 'text');
      assert.strictEqual(formatTagValue(true), 1);
      assert.strictEqual(formatTagValue(false), 0);
      assert.strictEqual(formatTagValue(9007199254740993n), '9007199254740993');
      assert.strictEqual(formatTagValue(Buffer.from([0x01, 0xab])), '01ab');
      assert.strictEqual(formatTagValue([1, 2, 3]), '[1,2,3]');
      assert.strictEqual(
        formatTagValue({ speed: 1.5, total: 10n, raw: Buffer.from([0xff]), nested: { on: true } }),
        '{"speed":1.5,"total":"10","raw":"ff","nested":{"on":true}}'
      );
    });
  });
});
