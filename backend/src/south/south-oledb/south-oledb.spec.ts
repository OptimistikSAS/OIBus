import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { OIBusContent } from '../../../shared/model/common/content.model';
import type { SouthItemSettings, SouthOLEDBItemSettings, SouthOLEDBSettings } from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type { ReqResponse } from '../../service/http-request.utils';
import type * as Utils from '../../service/utils';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import testData from '../../tests/utils/test-data';
import { assertContains, createMock, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type SouthOLEDBClass from './south-oledb';

const nodeRequire = createRequire(import.meta.url);

const trackingInstant: SouthOLEDBItemSettings['trackingInstant'] = {
  trackInstant: true,
  fieldName: 'timestamp',
  dateTimeInput: { type: 'string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd HH:mm:ss.SSS', locale: 'en-US' }
};

const buildItem = (
  id: string,
  query: string,
  itemTrackingInstant: SouthOLEDBItemSettings['trackingInstant'],
  scanMode = testData.scanMode.list[0]
): SouthConnectorItemEntity<SouthOLEDBItemSettings> => ({
  id,
  name: id.replace('id', 'item'),
  description: null,
  enabled: true,
  settings: { query, trackingInstant: itemTrackingInstant },
  scanMode,
  group: null,
  syncWithGroup: false,
  maxReadInterval: 3600,
  readDelay: 0,
  startTimeOffset: 0,
  endTimeOffset: null,
  recoveryStrategy: null,
  emptyIntervalStrategy: null,
  cachingStrategy: null,
  thresholdType: null,
  threshold: null,
  rangeLow: null,
  rangeHigh: null,
  maxCachingInterval: null,
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
});

const configuration: SouthConnectorEntity<SouthOLEDBSettings, SouthOLEDBItemSettings> = {
  id: 'southId',
  name: 'south',
  type: 'oledb',
  description: 'my test connector',
  enabled: true,
  settings: {
    agentUrl: 'http://localhost:2224',
    connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
    password: 'encrypted-password',
    connectionTimeout: 1000,
    retryInterval: 1000,
    requestTimeout: 1000
  },
  groups: [],
  items: [
    buildItem('id1', 'SELECT * FROM logs WHERE timestamp > @StartTime AND timestamp <= @EndTime', trackingInstant),
    buildItem('id2', 'query2', null),
    buildItem('id3', 'query3', trackingInstant, testData.scanMode.list[1])
  ],
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
};

const connectionStringWithPassword = 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes;Password=encrypted-password;';

describe('SouthOLEDB', () => {
  let SouthOLEDB: typeof SouthOLEDBClass;
  let south: SouthOLEDBClass;

  let logger: PinoLogger;
  let addContentCallback: Mock<
    (southId: string, data: OIBusContent, queryTime: string, items: Array<SouthConnectorItemEntity<SouthItemSettings>>) => Promise<void>
  >;
  let HTTPRequest: Mock<(url: URL | string, options?: unknown) => Promise<ReqResponse>>;

  const httpRequestExports: Record<string, unknown> = {};

  const realUtils: typeof Utils = nodeRequire('../../service/utils');
  const createUtilsMocks = () => ({
    convertDateTimeToInstant: mock.fn((instant: unknown, _options: unknown) => instant),
    formatInstant: mock.fn((instant: unknown, _options: unknown) => `formatted ${instant}`),
    logQuery: mock.fn()
  });
  const utilsExports = { ...realUtils, ...createUtilsMocks() };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/http-request.utils', httpRequestExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: new EncryptionServiceMock('', '')
    });
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthOLEDB = reloadModule<{ default: typeof SouthOLEDBClass }>(nodeRequire, './south-oledb').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    addContentCallback = mock.fn(async () => undefined);
    HTTPRequest = mock.fn(async () => createMockResponse(200));
    httpRequestExports.HTTPRequest = HTTPRequest;
    Object.assign(utilsExports, createUtilsMocks());
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthOLEDB(configuration, addContentCallback, createMock<SouthCacheRepository>(), 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should properly connect to remote agent and disconnect', async () => {
    await south.connect();
    assertContains(HTTPRequest.mock.calls[0].arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/ole/${configuration.id}/connect`
    });
    assert.deepStrictEqual(HTTPRequest.mock.calls[0].arguments[1], {
      method: 'PUT',
      body: JSON.stringify({
        connectionString: connectionStringWithPassword,
        connectionTimeout: configuration.settings.connectionTimeout
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    await south.disconnect();
    assertContains(HTTPRequest.mock.calls[1].arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/ole/${configuration.id}/disconnect`
    });
    assert.deepStrictEqual(HTTPRequest.mock.calls[1].arguments[1], { method: 'DELETE' });
  });

  it('should connect without password when not provided', async () => {
    const configurationWithoutPassword = { ...configuration, settings: { ...configuration.settings, password: null } };
    const southWithoutPassword = new SouthOLEDB(configurationWithoutPassword, addContentCallback, createMock(), 'cacheFolder');

    await southWithoutPassword.connect();
    assertContains(HTTPRequest.mock.calls[0].arguments[0] as object, {
      href: `${configurationWithoutPassword.settings.agentUrl}/api/ole/${configurationWithoutPassword.id}/connect`
    });
    assert.deepStrictEqual(HTTPRequest.mock.calls[0].arguments[1], {
      method: 'PUT',
      body: JSON.stringify({
        connectionString: configurationWithoutPassword.settings.connectionString,
        connectionTimeout: configurationWithoutPassword.settings.connectionTimeout
      }),
      headers: { 'Content-Type': 'application/json' }
    });
  });

  it('should avoid adding duplicate semicolons when password is provided', async () => {
    const configurationWithTrailingSemicolon = {
      ...configuration,
      settings: { ...configuration.settings, connectionString: `${configuration.settings.connectionString};` }
    };
    const southWithTrailingSemicolon = new SouthOLEDB(configurationWithTrailingSemicolon, addContentCallback, createMock(), 'cacheFolder');
    const expectedConnectionString = `${configurationWithTrailingSemicolon.settings.connectionString}Password=encrypted-password;`;

    await southWithTrailingSemicolon.connect();
    assertContains(HTTPRequest.mock.calls[0].arguments[0] as object, {
      href: `${configurationWithTrailingSemicolon.settings.agentUrl}/api/ole/${configurationWithTrailingSemicolon.id}/connect`
    });
    assert.deepStrictEqual(HTTPRequest.mock.calls[0].arguments[1], {
      method: 'PUT',
      body: JSON.stringify({
        connectionString: expectedConnectionString,
        connectionTimeout: configurationWithTrailingSemicolon.settings.connectionTimeout
      }),
      headers: { 'Content-Type': 'application/json' }
    });
  });

  it('should properly reconnect when connection fails', async () => {
    HTTPRequest.mock.mockImplementationOnce(async () => {
      throw new Error('connection failed');
    });

    await south.connect();
    assert.strictEqual(HTTPRequest.mock.calls.length, 1);

    mock.timers.tick(configuration.settings.retryInterval);
    // flush microtasks so the async connect callback can reach HTTPRequest
    await Promise.resolve();
    await Promise.resolve();
    assert.strictEqual(HTTPRequest.mock.calls.length, 2);
  });

  it('should properly clear reconnect timeout on disconnect', async () => {
    HTTPRequest.mock.mockImplementationOnce(async () => {
      throw new Error('connection failed');
    }, 0);
    HTTPRequest.mock.mockImplementationOnce(async () => {
      throw new Error('disconnection failed');
    }, 2);

    await south.connect();
    assert.strictEqual(HTTPRequest.mock.calls.length, 1);

    await south.connect();
    await south.disconnect();
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(HTTPRequest.mock.calls.length, 3);
    assert.ok(
      logger.error.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes('Error while sending connection HTTP request') &&
          (c.arguments[0] as string).includes(`${configuration.settings.retryInterval} ms`)
      )
    );
    assert.ok(
      logger.error.mock.calls.some((c: { arguments: Array<unknown> }) =>
        (c.arguments[0] as string).includes('Error while sending disconnection HTTP request')
      )
    );
  });

  it('should send the records of historyQuery and track the max instant from the ISO strings of the agent', async () => {
    const records = [
      { value: '1', timestamp: '2020-02-01T00:00:00.000Z' },
      { value: '2', timestamp: '2020-03-01T00:00:00.000Z' },
      { value: '3', timestamp: null }
    ];
    const queryMock = mock.method(south, 'queryRemoteAgentData', async () => records);

    const result = await south.historyQuery([configuration.items[0]], testData.constants.dates.DATE_1, testData.constants.dates.FAKE_NOW);

    assert.deepStrictEqual(queryMock.mock.calls[0].arguments, [
      configuration.items[0],
      testData.constants.dates.DATE_1,
      testData.constants.dates.FAKE_NOW
    ]);
    assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments.slice(0, 4), [
      'southId',
      { type: 'record-list', content: records },
      testData.constants.dates.FAKE_NOW,
      [configuration.items[0]]
    ]);
    assert.deepStrictEqual(utilsExports.convertDateTimeToInstant.mock.calls[0].arguments, [
      '2020-02-01T00:00:00.000Z',
      { type: 'iso-string' }
    ]);
    assert.deepStrictEqual(result, { trackedInstant: '2020-03-01T00:00:00.000Z', value: records[2] });
  });

  it('should not track an instant without tracking field', async () => {
    mock.method(south, 'queryRemoteAgentData', async () => [{ value: '1' }]);

    const result = await south.historyQuery([configuration.items[1]], testData.constants.dates.DATE_1, testData.constants.dates.FAKE_NOW);

    assert.deepStrictEqual(result, { trackedInstant: null, value: { value: '1' } });
  });

  it('should not send anything when there is no result', async () => {
    mock.method(south, 'queryRemoteAgentData', async () => []);

    const result = await south.historyQuery([configuration.items[0]], testData.constants.dates.DATE_1, testData.constants.dates.FAKE_NOW);

    assert.deepStrictEqual(result, { trackedInstant: null, value: null });
    assert.strictEqual(addContentCallback.mock.calls.length, 0);
    assert.ok(
      logger.debug.mock.calls.some(
        (c: { arguments: Array<unknown> }) => typeof c.arguments[1] === 'string' && c.arguments[1].includes('No result found')
      )
    );
  });

  it('should get data from the remote agent', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';
    const content = ['value\u001Ftimestamp', '1\u001F2020-02-01T00:00:00.000Z', ''].join('\r\n');
    HTTPRequest.mock.mockImplementation(async () =>
      createMockResponse(200, { recordCount: 1, content, maxInstant: '2020-02-01T00:00:00Z' })
    );

    const result = await south.queryRemoteAgentData(configuration.items[0], startTime, endTime);

    const adaptedQuery = `SELECT * FROM logs WHERE timestamp > formatted ${startTime} AND timestamp <= formatted ${endTime}`;
    assert.deepStrictEqual(utilsExports.formatInstant.mock.calls[0].arguments, [startTime, trackingInstant!.dateTimeInput]);
    assert.deepStrictEqual(utilsExports.logQuery.mock.calls[0].arguments.slice(0, 3), [
      adaptedQuery,
      `formatted ${startTime}`,
      `formatted ${endTime}`
    ]);
    assert.strictEqual(
      (HTTPRequest.mock.calls[0].arguments[0] as URL).href,
      `${configuration.settings.agentUrl}/api/ole/${configuration.id}/read`
    );
    assert.deepStrictEqual(HTTPRequest.mock.calls[0].arguments[1], {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectionString: connectionStringWithPassword,
        sql: adaptedQuery,
        readTimeout: configuration.settings.requestTimeout,
        timeColumn: 'timestamp',
        datasourceTimestampFormat: trackingInstant!.dateTimeInput!.format,
        datasourceTimezone: trackingInstant!.dateTimeInput!.timezone,
        delimiter: '\u001F',
        outputTimestampFormat: "uuuu'-'MM'-'dd'T'HH':'mm':'ss'.'fff'Z'",
        outputTimezone: 'UTC'
      })
    });
    assert.deepStrictEqual(result, [{ value: '1', timestamp: '2020-02-01T00:00:00.000Z' }]);
  });

  it('should not send the time column to the remote agent without tracking field', async () => {
    HTTPRequest.mock.mockImplementation(async () => createMockResponse(200, { recordCount: 0, content: 'value', maxInstant: '' }));

    const result = await south.queryRemoteAgentData(configuration.items[1], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

    assert.strictEqual(utilsExports.formatInstant.mock.calls.length, 0);
    assert.deepStrictEqual(JSON.parse((HTTPRequest.mock.calls[0].arguments[1] as { body: string }).body), {
      connectionString: connectionStringWithPassword,
      sql: 'query2',
      readTimeout: configuration.settings.requestTimeout,
      delimiter: '\u001F',
      outputTimestampFormat: "uuuu'-'MM'-'dd'T'HH':'mm':'ss'.'fff'Z'",
      outputTimezone: 'UTC'
    });
    assert.deepStrictEqual(result, []);
  });

  it('should manage query error', async () => {
    HTTPRequest.mock.mockImplementation(async () => createMockResponse(500));
    HTTPRequest.mock.mockImplementationOnce(async () => createMockResponse(400, 'bad request'));

    await assert.rejects(south.queryRemoteAgentData(configuration.items[1], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z'), {
      message: 'Error occurred when querying remote agent with status 400: bad request'
    });
    await assert.rejects(south.queryRemoteAgentData(configuration.items[1], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z'), {
      message: 'Error occurred when querying remote agent with status 500'
    });
  });

  it('should test an item', async () => {
    const records = [{ value: '1' }];
    const queryMock = mock.method(south, 'queryRemoteAgentData', async () => {
      mock.timers.tick(25);
      return records;
    });

    const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

    assert.deepStrictEqual(queryMock.mock.calls[0].arguments, [
      configuration.items[0],
      testData.south.itemTestingSettings.history!.startTime,
      testData.south.itemTestingSettings.history!.endTime
    ]);
    assert.deepStrictEqual(result, { result: { type: 'record-list', content: records }, connectionDuration: 0, queryDuration: 25 });
    assert.strictEqual(addContentCallback.mock.calls.length, 0);
  });

  it('should test connection successfully', async () => {
    await assert.doesNotReject(south.testConnection());
    assert.ok(
      logger.info.mock.calls.some((c: { arguments: Array<unknown> }) => (c.arguments[0] as string).includes('Connected to OLE agent'))
    );
  });

  it('should test connection fail', async () => {
    HTTPRequest.mock.mockImplementation(async () => createMockResponse(500, 'another error'));
    HTTPRequest.mock.mockImplementationOnce(async () => createMockResponse(400, 'bad request'));

    await assert.rejects(
      south.testConnection(),
      new Error('Error occurred when sending connect command to remote agent with status 400: bad request')
    );
    await assert.rejects(south.testConnection(), new Error('Error occurred when sending connect command to remote agent with status 500'));
  });

  it('should disconnect without fetch when not connected', async () => {
    await south.disconnect();
    assert.strictEqual(HTTPRequest.mock.calls.length, 0);
  });
});
