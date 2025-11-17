import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import SouthRestAPI from './south-rest-api';
import { SouthRestAPIItemSettings, SouthRestAPISettings } from '../../../shared/model/south-settings.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import pino from 'pino';
import testData from '../../tests/utils/test-data';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import fs from 'node:fs/promises';
import type { Stats } from 'node:fs';
import { HTTPRequest, ReqOptions } from '../../service/http-request.utils';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import * as utils from '../../service/utils';

jest.mock('../../service/utils', () => {
  const actualUtils = jest.requireActual('../../service/utils');
  return {
    ...actualUtils,
    formatInstant: jest.fn((instant: string) => instant)
  };
});
jest.mock('../../service/http-request.utils');
jest.mock('node:fs/promises');

const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const southCacheService = new SouthCacheServiceMock();

jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return southCacheService;
    }
);
jest.mock('../../service/encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

const logger: pino.Logger = new PinoLogger();
const addContentCallback = jest.fn();
const fsMock = jest.mocked(fs, { shallow: false });
const httpRequestMock = HTTPRequest as jest.MockedFunction<typeof HTTPRequest>;
const formatInstantMock = utils.formatInstant as jest.Mock;

const baseConfiguration: SouthConnectorEntity<SouthRestAPISettings, SouthRestAPIItemSettings> = {
  id: 'south-rest',
  name: 'REST',
  type: 'rest-api',
  description: 'Rest connector',
  enabled: true,
  settings: {
    throttling: {
      maxReadInterval: 900,
      readDelay: 5,
      overlap: 10
    },
    host: 'https://api.example.com/',
    acceptUnauthorized: true,
    authentication: 'basic',
    username: 'rest-user',
    password: 'rest-password',
    token: 'bearer-token',
    test: {
      endpoint: '/health',
      method: 'GET',
      successCode: 200
    },
    timeout: 15,
    useProxy: true,
    proxyUrl: 'http://proxy.local:8080',
    proxyUsername: 'proxy-user',
    proxyPassword: 'proxy-pass'
  },
  items: [
    {
      id: 'body-item',
      name: 'Body item',
      enabled: true,
      scanMode: testData.scanMode.list[0],
      settings: {
        method: 'POST',
        endpoint: '/data',
        queryParams: [
          { key: 'from', value: '@StartTime' },
          { key: 'size', value: '10' }
        ],
        body: '{"range":{"from":"@StartTime","to":"@EndTime"}}',
        headers: [{ key: 'X-Window', value: 'from:@StartTime,to:@EndTime' }],
        returnType: 'body',
        dateTimeFields: [
          {
            jsonPath: 'timestamp',
            fieldName: 'ts',
            useAsReference: true,
            type: 'iso-string',
            timezone: 'UTC',
            format: 'yyyy-MM-dd HH:mm:ss.SSS',
            locale: 'en'
          }
        ],
        serialization: {
          type: 'csv',
          filename: 'rest-@CurrentDate.csv',
          delimiter: 'COMMA',
          compression: false,
          outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
          outputTimezone: 'UTC'
        }
      }
    },
    {
      id: 'file-item',
      name: 'File item',
      enabled: true,
      scanMode: testData.scanMode.list[0],
      settings: {
        method: 'GET',
        endpoint: '/export',
        queryParams: null,
        body: null,
        headers: null,
        returnType: 'file',
        dateTimeFields: null,
        serialization: {
          type: 'csv',
          filename: 'unused.csv',
          delimiter: 'COMMA',
          compression: false,
          outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
          outputTimezone: 'UTC'
        }
      }
    }
  ]
};

const createConfiguration = (): SouthConnectorEntity<SouthRestAPISettings, SouthRestAPIItemSettings> => structuredClone(baseConfiguration);

const getRequestOptions = (index: number): ReqOptions => {
  const call = httpRequestMock.mock.calls[index];
  if (!call) {
    throw new Error(`Missing HTTP request call at index ${index}`);
  }
  return call[1] as ReqOptions;
};

describe('SouthRestAPI connector', () => {
  let south: SouthRestAPI;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    formatInstantMock.mockImplementation((instant: string) => instant);
    fsMock.writeFile.mockResolvedValue();
    fsMock.stat.mockResolvedValue({ size: 42 } as unknown as Stats);
    southCacheService.getSouthCache.mockReturnValue({
      southId: 'south-rest',
      scanModeId: testData.scanMode.list[0].id,
      maxInstant: null
    });

    const configuration = createConfiguration();
    south = new SouthRestAPI(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const bodyItem = (): SouthConnectorItemEntity<SouthRestAPIItemSettings> => structuredClone(south['connector'].items[0]);
  const fileItem = (): SouthConnectorItemEntity<SouthRestAPIItemSettings> => structuredClone(south['connector'].items[1]);

  it('should expose throttling metadata', () => {
    const settings = south['connector'].settings;
    expect(south.getThrottlingSettings(settings)).toEqual({
      maxReadInterval: settings.throttling.maxReadInterval,
      readDelay: settings.throttling.readDelay
    });
    expect(south.getMaxInstantPerItem(settings)).toBe(true);
    expect(south.getOverlap(settings)).toBe(settings.throttling.overlap);
  });

  it('should test connection and propagate HTTP failures', async () => {
    httpRequestMock
      .mockResolvedValueOnce(createMockResponse(200, {}, { 'content-type': 'application/json' }))
      .mockResolvedValueOnce(createMockResponse(500, 'fatal', { 'content-type': 'text/plain' }));

    await expect(south.testConnection()).resolves.not.toThrow();
    const firstOptions = getRequestOptions(0);
    expect((httpRequestMock.mock.calls[0][0] as URL).toString()).toBe('https://api.example.com/health');
    expect(firstOptions).toMatchObject({
      method: 'GET',
      proxy: { url: 'http://proxy.local:8080', auth: { type: 'url', username: 'proxy-user', password: 'proxy-pass' } },
      acceptUnauthorized: true,
      timeout: 15000,
      auth: { type: 'basic', username: 'rest-user', password: 'rest-password' }
    });

    await expect(south.testConnection()).rejects.toThrow('HTTP request failed with status code 500, expected 200. Message: "fatal"');
  });

  it('should fall back to default test settings when optional fields are missing', async () => {
    const configuration = createConfiguration();
    configuration.settings.test.endpoint = '';
    configuration.settings.test.method = undefined as unknown as 'GET';
    configuration.settings.test.successCode = 0;
    configuration.settings.authentication = 'none';
    const instance = new SouthRestAPI(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, {}, { 'content-type': 'application/json' }));

    await expect(instance.testConnection()).resolves.not.toThrow();
    const [url, options] = httpRequestMock.mock.calls[0];
    expect((url as URL).toString()).toBe('https://api.example.com/');
    expect((options as ReqOptions).method).toBe('GET');
  });

  it('should surface fetch errors during test connection', async () => {
    httpRequestMock.mockRejectedValueOnce(new Error('network'));
    await expect(south.testConnection()).rejects.toThrow('Fetch error Error: network');
  });

  it('should reject when proxy configuration is incomplete', async () => {
    const configuration = createConfiguration();
    configuration.settings.useProxy = true;
    configuration.settings.proxyUrl = undefined;
    const instance = new SouthRestAPI(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    await expect(instance.testConnection()).rejects.toThrow('Proxy URL not specified');
  });

  it('should include body when testing POST or PUT methods', async () => {
    const configuration = createConfiguration();
    configuration.settings.test.method = 'POST';
    configuration.settings.test.body = '{"test": "data"}';
    const instance = new SouthRestAPI(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, {}, { 'content-type': 'application/json' }));

    await expect(instance.testConnection()).resolves.not.toThrow();
    const [url, options] = httpRequestMock.mock.calls[0];
    expect((url as URL).toString()).toBe('https://api.example.com/health');
    expect((options as ReqOptions).method).toBe('POST');
    expect((options as ReqOptions).body).toBe('{"test": "data"}');
  });

  it('should return formatted results when testing a body item', async () => {
    const item = bodyItem();
    const parsed = [{ pointId: 'p1', timestamp: '2024-01-01T00:00:00.000Z', data: { value: 1 } }];
    const parseSpy = jest.spyOn(south, 'parseData').mockReturnValue({ formattedResult: parsed, maxInstant: '2024-01-02T00:00:00.000Z' });
    const querySpy = jest.spyOn(south, 'queryData').mockResolvedValue([{ foo: 'bar' }]);

    const testingSettings = { history: { startTime: '2024-01-01T00:00:00.000Z', endTime: '2024-01-02T00:00:00.000Z' } } as const;
    await expect(south.testItem(item, testingSettings)).resolves.toEqual({ type: 'time-values', content: parsed });
    expect(querySpy).toHaveBeenCalledWith(item, testingSettings.history.startTime, testingSettings.history.endTime);
    expect(parseSpy).toHaveBeenCalledWith(item, [{ foo: 'bar' }]);
  });

  it('should return file metadata when testing a file item', async () => {
    const item = fileItem();
    jest.spyOn(south, 'queryData').mockResolvedValue('/tmp/export.csv');
    const testingSettings = { history: { startTime: '2024-01-01T00:00:00Z', endTime: '2024-01-02T00:00:00Z' } } as const;
    await expect(south.testItem(item, testingSettings)).resolves.toEqual({ type: 'any', filePath: '/tmp/export.csv' });
  });

  it('should run history queries for body and file items', async () => {
    const formatted = [{ pointId: 'sensor', timestamp: '2024-01-02T00:00:00.000Z', data: { value: 10 } }];
    const parseSpy = jest
      .spyOn(south, 'parseData')
      .mockReturnValueOnce({ formattedResult: formatted, maxInstant: '2024-01-02T00:00:00.000Z' });

    jest
      .spyOn(south, 'queryData')
      .mockResolvedValueOnce([{ timestamp: '2024-01-02T00:00:00.000Z', value: 10 }])
      .mockResolvedValueOnce('/tmp/report.csv');

    const updated = await south.historyQuery(south['connector'].items, '2024-01-01T00:00:00.000Z', '2024-01-03T00:00:00.000Z');

    expect(parseSpy).toHaveBeenCalled();
    expect(addContentCallback).toHaveBeenCalledWith('south-rest', { type: 'time-values', content: formatted });
    expect(addContentCallback).toHaveBeenCalledWith('south-rest', { type: 'any', filePath: '/tmp/report.csv' });
    expect(updated).toBe('2024-01-02T00:00:00.000Z');
  });

  it('should keep previous maxInstant when the next item has none', async () => {
    const items: Array<SouthConnectorItemEntity<SouthRestAPIItemSettings>> = [bodyItem(), bodyItem()];
    items[1].id = 'no-dates';
    items[1].settings.dateTimeFields = null;

    jest
      .spyOn(south, 'queryData')
      .mockResolvedValueOnce([{ timestamp: '2024-01-05T08:00:00.000Z', value: 10 }])
      .mockResolvedValueOnce([{ id: '2', value: 7 }]);

    const result = await south.historyQuery(items, '2024-01-01T00:00:00.000Z', '2024-01-03T00:00:00.000Z');
    expect(result).toBe('2024-01-05T08:00:00.000Z');
    expect(addContentCallback).toHaveBeenCalledTimes(2);
  });

  it('should not update maxInstant when the next item is older', async () => {
    const items: Array<SouthConnectorItemEntity<SouthRestAPIItemSettings>> = [bodyItem(), bodyItem()];
    items[1].id = 'older';

    jest
      .spyOn(south, 'queryData')
      .mockResolvedValueOnce([{ timestamp: '2024-01-05T10:00:00.000Z', value: 10 }])
      .mockResolvedValueOnce([{ timestamp: '2024-01-04T10:00:00.000Z', value: 5 }]);

    const result = await south.historyQuery(items, '2024-01-01T00:00:00.000Z', '2024-01-03T00:00:00.000Z');
    expect(result).toBe('2024-01-05T10:00:00.000Z');
  });

  it('should skip empty downloaded files during history query', async () => {
    fsMock.stat.mockResolvedValueOnce({ size: 0 } as unknown as Stats);
    jest.spyOn(south, 'queryData').mockResolvedValue('/tmp/empty.csv');
    addContentCallback.mockReset();

    await south.historyQuery([fileItem()], '2024-01-01T00:00:00Z', '2024-01-02T00:00:00Z');
    expect(addContentCallback).not.toHaveBeenCalled();
  });

  it('logs when no formatted result is produced during history query', async () => {
    const loggerMock = logger as jest.Mocked<pino.Logger>;
    jest.spyOn(south, 'queryData').mockResolvedValue([]);
    await south.historyQuery([bodyItem()], '2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
    expect(loggerMock.debug).toHaveBeenCalledWith(expect.stringContaining('No result found for item'));
  });

  it('should parse entries without date time fields', () => {
    const item = bodyItem();
    item.settings.dateTimeFields = null;
    const results = [{ id: 'device-A', value: 5, extra: 'foo' }];

    const parsed = south.parseData(item, results);
    expect(parsed.maxInstant).toBeNull();
    expect(parsed.formattedResult).toHaveLength(1);
    expect(parsed.formattedResult[0].pointId).toBe('device-A');
    expect(parsed.formattedResult[0].data.value).toBe(5);
    expect(parsed.formattedResult[0].data.extra).toBe('foo');
  });

  it('stores the first numeric value when no date time fields are configured', () => {
    const item = bodyItem();
    item.settings.dateTimeFields = null;
    const results = [{ measurement: 12, label: 'ignored' }];

    const parsed = south.parseData(item, results);
    expect(parsed.formattedResult[0].data.value).toBe(12);
  });

  it('uses a generated pointId when entries are empty', () => {
    const item = bodyItem();
    item.settings.dateTimeFields = null;
    const parsed = south.parseData(item, [{}]);
    expect(parsed.formattedResult[0].pointId).toBe(`${item.name}-0`);
  });

  it('should parse entries with date time fields and track max instant', () => {
    const item = bodyItem();
    const payload = [
      {
        timestamp: '2024-01-05T10:00:00+02:00',
        nested: { sensor: 'A1' },
        value: 42
      }
    ];

    const parsed = south.parseData(item, payload);
    expect(parsed.maxInstant).toBe('2024-01-05T08:00:00.000Z');
    expect(parsed.formattedResult[0].data.ts).toBe('2024-01-05T08:00:00.000Z');
    expect(parsed.formattedResult[0].data.value).toBe('A1');
    expect(parsed.formattedResult[0].data['value']).toBe('A1');
  });

  it('flattens nested payloads and preserves numeric values', () => {
    const item = bodyItem();
    const payload = [
      {
        timestamp: '2024-01-05T10:00:00+02:00',
        nested: { metrics: { reading: 12 } }
      }
    ];

    const parsed = south.parseData(item, payload);
    expect(parsed.formattedResult[0].data.reading).toBe(12);
    expect(parsed.formattedResult[0].data.value).toBe(12);
  });

  it('handles array values during flattening', () => {
    const item = bodyItem();
    const payload = [
      {
        timestamp: '2024-01-05T10:00:00.000Z',
        readings: [1, 2, 3]
      }
    ];

    const parsed = south.parseData(item, payload);
    expect(Array.isArray(parsed.formattedResult[0].data.readings)).toBe(true);
  });

  it('does not override pointId when ID field is present alongside date fields', () => {
    const item = bodyItem();
    const payload = [
      {
        timestamp: '2024-01-05T10:00:00.000Z',
        id: 'custom',
        value: 5
      }
    ];

    const parsed = south.parseData(item, payload);
    expect(parsed.formattedResult[0].pointId).toBe(item.name);
  });

  it('retains numeric value when subsequent string fields are encountered', () => {
    const item = bodyItem();
    const payload = [
      {
        timestamp: '2024-01-05T10:00:00.000Z',
        reading: 10,
        description: 'text'
      }
    ];

    const parsed = south.parseData(item, payload);
    expect(parsed.formattedResult[0].data.value).toBe(10);
    expect(parsed.formattedResult[0].data.description).toBe('text');
  });

  it('keeps maxInstant when subsequent reference timestamp decreases', () => {
    const item = bodyItem();
    const payload = [
      { timestamp: '2024-01-05T10:00:00.000Z', value: 1 },
      { timestamp: '2024-01-05T09:00:00.000Z', value: 2 }
    ];

    const parsed = south.parseData(item, payload);
    expect(parsed.maxInstant).toBe('2024-01-05T10:00:00.000Z');
  });

  it('updates maxInstant when encountering newer reference timestamps', () => {
    const item = bodyItem();
    const payload = [
      { timestamp: '2024-01-05T08:00:00.000Z', value: 1 },
      { timestamp: '2024-01-05T11:00:00.000Z', value: 2 }
    ];

    const parsed = south.parseData(item, payload);
    expect(parsed.maxInstant).toBe('2024-01-05T11:00:00.000Z');
  });

  it('skips missing date time fields while keeping flattened data', () => {
    const item = bodyItem();
    item.settings.dateTimeFields = [
      {
        jsonPath: 'missing.field',
        fieldName: 'missing',
        useAsReference: false,
        type: 'iso-string'
      }
    ];
    const payload = [{ nested: { reading: 5 } }];
    const parsed = south.parseData(item, payload);
    expect(parsed.formattedResult[0].data.reading).toBe(5);
    expect(parsed.formattedResult[0].data.missing).toBeUndefined();
  });

  it('does not duplicate fields already processed as date time entries', () => {
    const item = bodyItem();
    item.settings.dateTimeFields = [
      {
        jsonPath: 'nested.sensor.ts',
        fieldName: 'ts',
        useAsReference: true,
        type: 'iso-string',
        timezone: 'UTC',
        format: 'yyyy-MM-dd HH:mm:ss',
        locale: 'en'
      }
    ];
    const payload = [{ nested: { sensor: { ts: '2024-01-05T10:00:00Z', reading: 12 } } }];
    const parsed = south.parseData(item, payload);
    expect(parsed.formattedResult[0].data.ts).toBe('2024-01-05T10:00:00.000Z');
    expect(parsed.formattedResult[0].data.reading).toBe(12);
  });

  it('formats date time fields when not used as reference and without field names', () => {
    const item = bodyItem();
    item.settings.dateTimeFields = [
      {
        jsonPath: 'nested.ts',
        fieldName: null,
        useAsReference: false,
        type: 'iso-string',
        timezone: 'UTC',
        format: 'yyyy-MM-dd HH:mm:ss'
      }
    ];
    const payload = [{ nested: { ts: '2024-01-05T12:00:00Z' } }];
    const parsed = south.parseData(item, payload);
    expect(parsed.maxInstant).toBeNull();
    expect(parsed.formattedResult[0].data.ts).toBe('2024-01-05T12:00:00.000Z');
  });

  it('falls back to string values when numeric data is not available', () => {
    const item = bodyItem();
    const payload = [{ timestamp: '2024-01-05T10:00:00.000Z', description: 'string-value' }];
    const parsed = south.parseData(item, payload);
    expect(parsed.formattedResult[0].data.value).toBe('string-value');
  });

  it('should query JSON, XML, plain text and file responses with token replacements', async () => {
    const item = bodyItem();
    const start = '2024-01-01T00:00:00.000Z';
    const end = '2024-01-01T01:00:00.000Z';

    const jsonResponse = createMockResponse(200, [{ foo: 'bar' }], { 'content-type': 'application/json' });
    const xmlResponse = createMockResponse(200, '<root>ok</root>', { 'content-type': 'application/xml' });
    (xmlResponse.body.text as jest.Mock).mockResolvedValue('<root>ok</root>');
    const textResponse = createMockResponse(200, 'plain', { 'content-type': 'text/plain' });
    (textResponse.body.text as jest.Mock).mockResolvedValue('plain-text');
    const fileArrayBuffer = Uint8Array.from(Buffer.from('file-content')).buffer;
    const fileResponse = createMockResponse(200, fileArrayBuffer, {
      'content-type': 'application/octet-stream',
      'content-disposition': 'attachment; filename="export.json"'
    });

    httpRequestMock
      .mockResolvedValueOnce(jsonResponse)
      .mockResolvedValueOnce(xmlResponse)
      .mockResolvedValueOnce(textResponse)
      .mockResolvedValueOnce(fileResponse);

    const json = await south.queryData(item, start, end);
    expect(json).toEqual([{ foo: 'bar' }]);
    const firstOptions = getRequestOptions(0);
    expect(firstOptions.method).toBe('POST');
    expect(firstOptions.query).toEqual({ from: start, size: '10' });
    expect(firstOptions.body).toContain(start);
    const requestHeaders = firstOptions.headers as Record<string, string>;
    expect(requestHeaders['X-Window']).toBe(`from:${start},to:${end}`);
    expect(firstOptions.auth).toEqual({ type: 'basic', username: 'rest-user', password: 'rest-password' });

    const xml = await south.queryData(item, start, end);
    expect(xml).toEqual([{ xml: '<root>ok</root>' }]);

    const text = await south.queryData(item, start, end);
    expect(text).toEqual([{ text: 'plain-text' }]);

    const fileItemSettings = fileItem();
    const filePath = await south.queryData(fileItemSettings, start, end);
    expect(filePath).toContain('cacheFolder');
    expect(fsMock.writeFile).toHaveBeenCalledWith(filePath, Buffer.from(fileArrayBuffer));
  });

  it('falls back to default filename when content-disposition lacks filename', async () => {
    const item = fileItem();
    const fileArrayBuffer = new ArrayBuffer(8);
    const response = createMockResponse(200, fileArrayBuffer, {
      'content-type': 'application/octet-stream',
      'content-disposition': 'attachment'
    });
    httpRequestMock.mockResolvedValueOnce(response);

    const filePath = await south.queryData(item, '2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
    expect(filePath).toContain(`rest-api-${item.id}`);
  });

  it('normalizes singular JSON payloads and parses JSON from text responses', async () => {
    const item = bodyItem();
    const start = '2024-01-01T00:00:00.000Z';
    const end = '2024-01-01T01:00:00.000Z';

    const singleObjectResponse = createMockResponse(200, { foo: 'bar' }, { 'content-type': 'application/json' });
    const primitiveResponse = createMockResponse(200, 'value', { 'content-type': 'application/json' });
    const textJsonObjectResponse = createMockResponse(200, { nested: true }, { 'content-type': 'text/json' });
    const textJsonArrayResponse = createMockResponse(200, [{ nested: false }], { 'content-type': 'text/plain' });
    const textPlainObjectResponse = createMockResponse(200, { fromText: true }, { 'content-type': 'text/plain' });
    const textJsonPrimitiveResponse = createMockResponse(200, 'raw', { 'content-type': 'text/plain' });

    httpRequestMock
      .mockResolvedValueOnce(singleObjectResponse)
      .mockResolvedValueOnce(primitiveResponse)
      .mockResolvedValueOnce(textJsonObjectResponse)
      .mockResolvedValueOnce(textJsonArrayResponse)
      .mockResolvedValueOnce(textPlainObjectResponse)
      .mockResolvedValueOnce(textJsonPrimitiveResponse);

    const single = await south.queryData(item, start, end);
    expect(single).toEqual([{ foo: 'bar' }]);

    const primitive = await south.queryData(item, start, end);
    expect(primitive).toEqual([{ value: 'value' }]);

    const parsedObject = await south.queryData(item, start, end);
    expect(parsedObject).toEqual([{ nested: true }]);

    const parsedArray = await south.queryData(item, start, end);
    expect(parsedArray).toEqual([{ nested: false }]);

    const parsedPlainObject = await south.queryData(item, start, end);
    expect(parsedPlainObject).toEqual([{ fromText: true }]);

    const parsedPrimitive = await south.queryData(item, start, end);
    expect(parsedPrimitive).toEqual([{ value: 'raw' }]);
  });

  it('treats text/json content type as JSON', async () => {
    const item = bodyItem();
    const response = createMockResponse(200, [{ special: true }], { 'content-type': 'text/json' });
    httpRequestMock.mockResolvedValueOnce(response);

    const result = await south.queryData(item, '2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
    expect(result).toEqual([{ special: true }]);
  });

  it('handles responses without a content-type header', async () => {
    const item = bodyItem();
    const response = createMockResponse(200, 'plain-text');
    httpRequestMock.mockResolvedValueOnce(response);

    const result = await south.queryData(item, '2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
    expect(result).toEqual([{ value: 'plain-text' }]);
  });

  it('replaces headers when no reference timestamp field is configured', async () => {
    const item = bodyItem();
    item.settings.headers = [
      { key: 'X-Test', value: 'window:@StartTime-@EndTime' },
      { key: 'X-End', value: 'end:@EndTime' }
    ];
    item.settings.dateTimeFields = null;
    const response = createMockResponse(200, [], { 'content-type': 'application/json' });
    httpRequestMock.mockResolvedValueOnce(response);

    await south.queryData(item, '2024-01-01T00:00:00.000Z', '2024-01-01T01:00:00.000Z');
    const options = getRequestOptions(httpRequestMock.mock.calls.length - 1);
    expect((options.headers as Record<string, string>)['X-Test']).toBe('window:2024-01-01T00:00:00.000Z-2024-01-01T01:00:00.000Z');
    expect((options.headers as Record<string, string>)['X-End']).toBe('end:2024-01-01T01:00:00.000Z');
  });

  it('keeps headers unchanged when no placeholders are present', async () => {
    const item = bodyItem();
    item.settings.headers = [{ key: 'X-Static', value: 'static' }];
    const response = createMockResponse(200, [], { 'content-type': 'application/json' });
    httpRequestMock.mockResolvedValueOnce(response);

    await south.queryData(item, '2024-01-01T00:00:00.000Z', '2024-01-01T01:00:00.000Z');
    const options = getRequestOptions(httpRequestMock.mock.calls.length - 1);
    expect((options.headers as Record<string, string>)['X-Static']).toBe('static');
  });

  it('defaults to GET when item method is not set', async () => {
    const item = bodyItem();
    delete (item.settings as Partial<SouthRestAPIItemSettings>).method;
    const response = createMockResponse(200, [], { 'content-type': 'application/json' });
    httpRequestMock.mockResolvedValueOnce(response);

    await south.queryData(item, '2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
    const options = getRequestOptions(httpRequestMock.mock.calls.length - 1);
    expect(options.method).toBe('GET');
  });

  it('handles file downloads without a content-disposition header', async () => {
    const item = fileItem();
    const fileArrayBuffer = new ArrayBuffer(8);
    const response = createMockResponse(200, fileArrayBuffer, { 'content-type': 'application/octet-stream' });
    httpRequestMock.mockResolvedValueOnce(response);

    const filePath = await south.queryData(item, '2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
    const writeCallPath = fsMock.writeFile.mock.calls.at(-1)?.[0] as string;
    expect(writeCallPath).toContain(`rest-api-${item.id}`);
    expect(filePath).toBe(writeCallPath);
  });

  it('should throw when HTTP request fails', async () => {
    httpRequestMock.mockResolvedValueOnce(createMockResponse(503, 'oops', { 'content-type': 'text/plain' }));
    await expect(south.queryData(bodyItem(), '2024-01-01T00:00:00Z', '2024-01-01T02:00:00Z')).rejects.toThrow(
      'HTTP request failed with status code 503 and message: "oops"'
    );
  });

  it('should support bearer authentication', async () => {
    south['connector'].settings.authentication = 'bearer';
    const response = createMockResponse(200, [], { 'content-type': 'application/json' });
    httpRequestMock.mockResolvedValueOnce(response);

    await south.queryData(bodyItem(), '2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
    const options = getRequestOptions(httpRequestMock.mock.calls.length - 1);
    expect(options.auth).toEqual({ type: 'bearer', token: 'bearer-token' });
  });

  it('omits basic authentication when username is missing', async () => {
    const configuration = createConfiguration();
    configuration.settings.authentication = 'basic';
    configuration.settings.username = undefined;
    const instance = new SouthRestAPI(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    const response = createMockResponse(200, [], { 'content-type': 'application/json' });
    httpRequestMock.mockResolvedValueOnce(response);

    await instance.queryData(instance['connector'].items[0], '2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
    const options = getRequestOptions(httpRequestMock.mock.calls.length - 1);
    expect(options.auth).toBeUndefined();
  });

  it('omits bearer authentication when token is missing', async () => {
    const configuration = createConfiguration();
    configuration.settings.authentication = 'bearer';
    configuration.settings.token = undefined;
    const instance = new SouthRestAPI(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    const response = createMockResponse(200, [], { 'content-type': 'application/json' });
    httpRequestMock.mockResolvedValueOnce(response);

    await instance.queryData(instance['connector'].items[0], '2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
    const options = getRequestOptions(httpRequestMock.mock.calls.length - 1);
    expect(options.auth).toBeUndefined();
  });

  it('should omit proxy and auth when disabled', async () => {
    south['connector'].settings.useProxy = false;
    south['connector'].settings.authentication = 'none';
    const response = createMockResponse(200, [], { 'content-type': 'application/json' });
    httpRequestMock.mockResolvedValueOnce(response);

    await south.queryData(bodyItem(), '2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
    const options = getRequestOptions(httpRequestMock.mock.calls.length - 1);
    expect(options.proxy).toBeUndefined();
    expect(options.auth).toBeUndefined();
  });

  it('omits proxy credentials when only the URL is provided', async () => {
    south['connector'].settings.useProxy = true;
    south['connector'].settings.proxyUsername = undefined;
    south['connector'].settings.proxyPassword = undefined;
    const response = createMockResponse(200, [], { 'content-type': 'application/json' });
    httpRequestMock.mockResolvedValueOnce(response);

    await south.queryData(bodyItem(), '2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z');
    const options = getRequestOptions(httpRequestMock.mock.calls.length - 1);
    expect(options.proxy).toEqual({ url: 'http://proxy.local:8080' });
  });
});
