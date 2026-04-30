import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import testData from '../../tests/utils/test-data';
import {mockModule, reloadModule, assertContains} from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import type { SouthConnectorEntity } from '../../model/south-connector.model';
import type {
  SouthOLEDBItemSettings,
  SouthOLEDBItemSettingsDateTimeFields,
  SouthOLEDBSettings
} from '../../../shared/model/south-settings.model';
import type SouthOLEDBClass from './south-oledb';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';

const nodeRequire = createRequire(import.meta.url);

describe('SouthOLEDB', () => {
  let SouthOLEDB: typeof SouthOLEDBClass;
  let south: SouthOLEDBClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn();
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
  let southCacheService: SouthCacheServiceMock;

  const httpRequestExports = {
    HTTPRequest: mock.fn(async () => createMockResponse(200))
  };

  const utilsExports = {
    convertDelimiter: mock.fn((value: unknown) => value),
    formatInstant: mock.fn((value: unknown) => value),
    generateFilenameForSerialization: mock.fn(() => 'filename.csv'),
    logQuery: mock.fn(),
    persistResults: mock.fn(async () => undefined)
  };

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
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          query: 'query1',
          dateTimeFields: [
            {
              fieldName: 'anotherTimestamp',
              useAsReference: false,
              type: 'unix-epoch-ms',
              timezone: null,
              format: null,
              locale: null
            } as unknown as SouthOLEDBItemSettingsDateTimeFields,
            {
              fieldName: 'timestamp',
              useAsReference: true,
              type: 'string',
              timezone: 'Europe/Paris',
              format: 'yyyy-MM-dd HH:mm:ss.SSS',
              locale: 'en-US'
            }
          ],
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
            outputTimezone: 'Europe/Paris'
          }
        },
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
        settings: {
          query: 'query2',
          dateTimeFields: null,
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
            outputTimezone: 'Europe/Paris'
          }
        },
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
        settings: {
          query: 'query3',
          dateTimeFields: [
            {
              fieldName: 'anotherTimestamp',
              useAsReference: false,
              type: 'unix-epoch-ms',
              timezone: null,
              format: null,
              locale: null
            } as unknown as SouthOLEDBItemSettingsDateTimeFields,
            {
              fieldName: 'timestamp',
              useAsReference: true,
              type: 'string',
              timezone: 'Europe/Paris',
              format: 'yyyy-MM-dd HH:mm:ss.SSS',
              locale: 'en-US'
            }
          ],
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
            outputTimezone: 'Europe/Paris'
          }
        },
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

  const connectionStringWithPassword = 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes;Password=encrypted-password;';

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/http-request.utils', httpRequestExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: new EncryptionServiceMock('', '')
    });
    mockModule(nodeRequire, '../../service/south-cache.service', {
      __esModule: true,
      default: function () {
        return southCacheService;
      }
    });
    SouthOLEDB = reloadModule<{ default: typeof SouthOLEDBClass }>(nodeRequire, './south-oledb').default;
  });

  beforeEach(() => {
    southCacheService = new SouthCacheServiceMock();
    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200));
    utilsExports.convertDelimiter = mock.fn((value: unknown) => value);
    utilsExports.formatInstant = mock.fn((value: unknown) => value);
    utilsExports.generateFilenameForSerialization = mock.fn(() => 'filename.csv');
    utilsExports.logQuery = mock.fn();
    utilsExports.persistResults = mock.fn(async () => undefined);
    addContentCallback.mock.resetCalls();
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthOLEDB(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should properly connect to remote agent and disconnect', async () => {
    await south.connect();
    assertContains(httpRequestExports.HTTPRequest.mock.calls[0].arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/ole/${configuration.id}/connect`
    });
    assert.deepStrictEqual(httpRequestExports.HTTPRequest.mock.calls[0].arguments[1], {
      method: 'PUT',
      body: JSON.stringify({
        connectionString: connectionStringWithPassword,
        connectionTimeout: configuration.settings.connectionTimeout
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    await south.disconnect();
    assertContains(httpRequestExports.HTTPRequest.mock.calls[1].arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/ole/${configuration.id}/disconnect`
    });
    assert.deepStrictEqual(httpRequestExports.HTTPRequest.mock.calls[1].arguments[1], { method: 'DELETE' });
  });

  it('should connect without password when not provided', async () => {
    const configurationWithoutPassword: SouthConnectorEntity<SouthOLEDBSettings, SouthOLEDBItemSettings> = {
      ...configuration,
      settings: { ...configuration.settings, password: null }
    };
    const southWithoutPassword = new SouthOLEDB(
      configurationWithoutPassword,
      addContentCallback,
      southCacheRepository,
      logger,
      'cacheFolder'
    );

    await southWithoutPassword.connect();
    assertContains(httpRequestExports.HTTPRequest.mock.calls[0].arguments[0] as object, {
      href: `${configurationWithoutPassword.settings.agentUrl}/api/ole/${configurationWithoutPassword.id}/connect`
    });
    assert.deepStrictEqual(httpRequestExports.HTTPRequest.mock.calls[0].arguments[1], {
      method: 'PUT',
      body: JSON.stringify({
        connectionString: configurationWithoutPassword.settings.connectionString,
        connectionTimeout: configurationWithoutPassword.settings.connectionTimeout
      }),
      headers: { 'Content-Type': 'application/json' }
    });
  });

  it('should avoid adding duplicate semicolons when password is provided', async () => {
    const configurationWithTrailingSemicolon: SouthConnectorEntity<SouthOLEDBSettings, SouthOLEDBItemSettings> = {
      ...configuration,
      settings: { ...configuration.settings, connectionString: `${configuration.settings.connectionString};` }
    };
    const southWithTrailingSemicolon = new SouthOLEDB(
      configurationWithTrailingSemicolon,
      addContentCallback,
      southCacheRepository,
      logger,
      'cacheFolder'
    );
    const expectedConnectionString = `${configurationWithTrailingSemicolon.settings.connectionString}Password=encrypted-password;`;

    await southWithTrailingSemicolon.connect();
    assertContains(httpRequestExports.HTTPRequest.mock.calls[0].arguments[0] as object, {
      href: `${configurationWithTrailingSemicolon.settings.agentUrl}/api/ole/${configurationWithTrailingSemicolon.id}/connect`
    });
    assert.deepStrictEqual(httpRequestExports.HTTPRequest.mock.calls[0].arguments[1], {
      method: 'PUT',
      body: JSON.stringify({
        connectionString: expectedConnectionString,
        connectionTimeout: configurationWithTrailingSemicolon.settings.connectionTimeout
      }),
      headers: { 'Content-Type': 'application/json' }
    });
  });

  it('should properly reconnect when connection fails', async () => {
    let callCount = 0;
    httpRequestExports.HTTPRequest = mock.fn(async () => {
      callCount++;
      if (callCount === 1) throw new Error('connection failed');
      return createMockResponse(200);
    });

    await south.connect();
    assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);

    mock.timers.tick(configuration.settings.retryInterval);
    // flush microtasks so the async connect callback can reach HTTPRequest
    await Promise.resolve();
    await Promise.resolve();
    assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 2);
  });

  it('should properly clear reconnect timeout on disconnect', async () => {
    let callCount = 0;
    httpRequestExports.HTTPRequest = mock.fn(async () => {
      callCount++;
      if (callCount === 1) throw new Error('connection failed');
      if (callCount === 2) return createMockResponse(200);
      throw new Error('disconnection failed');
    });

    await south.connect();
    assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);

    await south.connect();
    await south.disconnect();
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 3);
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

  it('should properly run historyQuery', async () => {
    const startTime = testData.constants.dates.DATE_1;
    const queryRemoteAgentDataMock = mock.method(
      south,
      'queryRemoteAgentData',
      mock.fn(async () => ({
        trackedInstant: '2020-03-01T00:00:00.000Z',
        value: { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 }
      }))
    );

    const result = await south.historyQuery(configuration.items, startTime, testData.constants.dates.FAKE_NOW);
    assert.strictEqual(queryRemoteAgentDataMock.mock.calls.length, 1);
    assert.deepStrictEqual(queryRemoteAgentDataMock.mock.calls[0].arguments, [
      configuration.items[0],
      testData.constants.dates.DATE_1,
      testData.constants.dates.FAKE_NOW
    ]);
    assert.deepStrictEqual(result, {
      trackedInstant: '2020-03-01T00:00:00.000Z',
      value: { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 }
    });
  });

  it('should get data from Remote agent', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    let callCount = 0;
    httpRequestExports.HTTPRequest = mock.fn(async () => {
      callCount++;
      if (callCount === 1)
        return createMockResponse(200, {
          recordCount: 2,
          content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
          maxInstant: '2020-03-01T00:00:00.000Z'
        });
      return createMockResponse(200, { recordCount: 0, content: [], maxInstant: '2020-03-01T00:00:00.000Z' });
    });

    const result = await south.queryRemoteAgentData(configuration.items[0], startTime, endTime);

    assert.strictEqual((utilsExports.logQuery as ReturnType<typeof mock.fn>).mock.calls.length, 1);
    assert.deepStrictEqual(
      (utilsExports.logQuery as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0],
      configuration.items[0].settings.query
    );

    assertContains(httpRequestExports.HTTPRequest.mock.calls[0].arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/ole/${configuration.id}/read`
    });
    assert.deepStrictEqual(httpRequestExports.HTTPRequest.mock.calls[0].arguments[1], {
      method: 'PUT',
      body: JSON.stringify({
        connectionString: connectionStringWithPassword,
        sql: 'query1',
        readTimeout: 1000,
        timeColumn: 'timestamp',
        datasourceTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
        datasourceTimezone: 'Europe/Paris',
        delimiter: 'COMMA',
        outputTimestampFormat: configuration.items[0].settings.serialization.outputTimestampFormat,
        outputTimezone: configuration.items[0].settings.serialization.outputTimezone
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    assert.deepStrictEqual(result, {
      trackedInstant: '2020-03-01T00:00:00.000Z',
      value: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]
    });

    const persistCall = (utilsExports.persistResults as ReturnType<typeof mock.fn>).mock.calls[0];
    assert.deepStrictEqual(persistCall.arguments[0], [
      { timestamp: '2020-02-01T00:00:00.000Z' },
      { timestamp: '2020-03-01T00:00:00.000Z' }
    ]);
    assert.deepStrictEqual(persistCall.arguments[1], {
      type: 'file',
      filename: configuration.items[0].settings.serialization.filename,
      compression: configuration.items[0].settings.serialization.compression
    });
    assert.strictEqual(persistCall.arguments[2], configuration.name);
    assert.strictEqual(persistCall.arguments[3], configuration.items[0]);
    assert.strictEqual(persistCall.arguments[4], testData.constants.dates.FAKE_NOW);
    assert.strictEqual(persistCall.arguments[5], path.resolve('cacheFolder', 'tmp'));
    assert.ok(typeof persistCall.arguments[6] === 'function');

    await south.queryRemoteAgentData(configuration.items[0], startTime, endTime);
    assert.ok(
      logger.debug.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes('No result found') && (c.arguments[0] as string).includes(configuration.items[0].name)
      )
    );
  });

  it('should get data from Remote agent without datetime reference', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    httpRequestExports.HTTPRequest = mock.fn(async () =>
      createMockResponse(200, {
        recordCount: 2,
        content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
        maxInstant: startTime
      })
    );

    const result = await south.queryRemoteAgentData(configuration.items[1], startTime, endTime);

    assert.strictEqual((utilsExports.logQuery as ReturnType<typeof mock.fn>).mock.calls.length, 1);
    assertContains(httpRequestExports.HTTPRequest.mock.calls[0].arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/ole/${configuration.id}/read`
    });
    assert.deepStrictEqual(httpRequestExports.HTTPRequest.mock.calls[0].arguments[1], {
      method: 'PUT',
      body: JSON.stringify({
        connectionString: connectionStringWithPassword,
        sql: 'query2',
        readTimeout: 1000,
        delimiter: 'COMMA',
        outputTimestampFormat: configuration.items[1].settings.serialization.outputTimestampFormat,
        outputTimezone: configuration.items[1].settings.serialization.outputTimezone
      }),
      headers: { 'Content-Type': 'application/json' }
    });
    assert.deepStrictEqual(result, {
      trackedInstant: null,
      value: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]
    });
  });

  it('should manage query error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    let callCount = 0;
    httpRequestExports.HTTPRequest = mock.fn(async () => {
      callCount++;
      if (callCount === 1) return createMockResponse(400, 'bad request');
      return createMockResponse(500);
    });

    await assert.rejects(
      south.queryRemoteAgentData(configuration.items[0], startTime, endTime),
      new Error('Error occurred when querying remote agent with status 400: bad request')
    );
    assert.ok(
      logger.error.mock.calls.some((c: { arguments: Array<unknown> }) =>
        (c.arguments[0] as string).includes('Error occurred when querying remote agent with status 400: bad request')
      )
    );

    await assert.rejects(
      south.queryRemoteAgentData(configuration.items[0], startTime, endTime),
      new Error('Error occurred when querying remote agent with status 500')
    );
    assert.ok(
      logger.error.mock.calls.some((c: { arguments: Array<unknown> }) =>
        (c.arguments[0] as string).includes('Error occurred when querying remote agent with status 500')
      )
    );
  });

  it('should test item', async () => {
    const queryRemoteAgentDataMock = mock.method(
      south,
      'queryRemoteAgentData',
      mock.fn(async () => [
        { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
        { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
      ])
    );

    await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    assert.deepStrictEqual(queryRemoteAgentDataMock.mock.calls[0].arguments, [configuration.items[0], startTime, endTime, true]);
  });

  it('should test item without datetimeFields', async () => {
    const queryRemoteAgentDataMock = mock.method(
      south,
      'queryRemoteAgentData',
      mock.fn(async () => [
        { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
        { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
      ])
    );

    await south.testItem(configuration.items[1], testData.south.itemTestingSettings);
    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    assert.deepStrictEqual(queryRemoteAgentDataMock.mock.calls[0].arguments, [configuration.items[1], startTime, endTime, true]);
  });

  it('QueryRemoteAgentData in case of item test', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    let callCount = 0;
    httpRequestExports.HTTPRequest = mock.fn(async () => {
      callCount++;
      if (callCount === 1)
        return createMockResponse(200, {
          recordCount: 2,
          content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
          maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
        });
      return createMockResponse(200, { recordCount: 0, content: [], maxInstantRetrieved: '2020-03-01T00:00:00.000Z' });
    });

    await south.queryRemoteAgentData(configuration.items[0], startTime, endTime, true);

    assert.strictEqual((utilsExports.logQuery as ReturnType<typeof mock.fn>).mock.calls.length, 1);
    assertContains(httpRequestExports.HTTPRequest.mock.calls[0].arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/ole/${configuration.id}/read`
    });
    assert.deepStrictEqual(httpRequestExports.HTTPRequest.mock.calls[0].arguments[1], {
      method: 'PUT',
      body: JSON.stringify({
        connectionString: connectionStringWithPassword,
        sql: 'query1',
        readTimeout: 1000,
        timeColumn: 'timestamp',
        datasourceTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
        datasourceTimezone: 'Europe/Paris',
        delimiter: 'COMMA',
        outputTimestampFormat: configuration.items[0].settings.serialization.outputTimestampFormat,
        outputTimezone: configuration.items[0].settings.serialization.outputTimezone
      }),
      headers: { 'Content-Type': 'application/json' }
    });
  });

  it('should test connection successfully', async () => {
    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200));
    await assert.doesNotReject(south.testConnection());
    assert.ok(
      logger.info.mock.calls.some((c: { arguments: Array<unknown> }) =>
        (c.arguments[0] as string).includes('Testing OLE OIBus Agent connection')
      )
    );
  });

  it('should test connection fail', async () => {
    let callCount = 0;
    httpRequestExports.HTTPRequest = mock.fn(async () => {
      callCount++;
      if (callCount === 1) return createMockResponse(400, 'bad request');
      return createMockResponse(500, 'another error');
    });

    await assert.rejects(
      south.testConnection(),
      new Error('Error occurred when sending connect command to remote agent with status 400: bad request')
    );
    await assert.rejects(south.testConnection(), new Error('Error occurred when sending connect command to remote agent with status 500'));
  });

  it('should disconnect without fetch when not connected', async () => {
    await south.disconnect();
    assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 0);
  });
});
