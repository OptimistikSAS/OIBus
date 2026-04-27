import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs/promises';
import testData from '../tests/utils/test-data';
import { mockModule, reloadModule, assertContains } from '../tests/utils/test-utils';
import { CONTENT_FOLDER, METADATA_FOLDER } from '../model/engine.model';
import type pino from 'pino';
import type SouthCacheRepository from '../repository/cache/south-cache.repository';
import type CertificateRepository from '../repository/config/certificate.repository';
import type OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import type CacheServiceType from '../service/cache/cache.service';
import type { NorthFileWriterSettings, NorthSettings } from '../../shared/model/north-settings.model';
import type { SouthItemSettings, SouthModbusSettings, SouthSettings } from '../../shared/model/south-settings.model';
import type { HistoryQueryEntity } from '../model/histor-query.model';
import type { Transformer } from '../model/transformer.model';
import type {
  buildHistoryQuery as BuildHistoryQueryFn,
  initHistoryQueryCache as InitHistoryQueryCacheFn,
  createHistoryQueryOrchestrator as CreateHistoryQueryOrchestratorFn,
  deleteHistoryQueryCache as DeleteHistoryQueryCacheFn
} from './history-query-factory';

const nodeRequire = createRequire(import.meta.url);

describe('HistoryQueryFactory', () => {
  // Type-only placeholders — passed to mocked factory functions that are never actually invoked
  const mockLogger = {} as pino.Logger;
  const mockSouthCacheRepository = {} as SouthCacheRepository;
  const mockCertificateRepository = {} as CertificateRepository;
  const mockOIAnalyticsRegistrationRepository = {} as OIAnalyticsRegistrationRepository;
  const mockOrchestrator = {} as CacheServiceType;
  const baseFolder = '/tmp/oibus';

  let buildHistoryQuery: typeof BuildHistoryQueryFn;
  let initHistoryQueryCache: typeof InitHistoryQueryCacheFn;
  let createHistoryQueryOrchestrator: typeof CreateHistoryQueryOrchestratorFn;
  let deleteHistoryQueryCache: typeof DeleteHistoryQueryCacheFn;

  // Mutable exports objects — SUT holds references to these objects, so property mutation is picked up
  const utilsExports = { createFolder: mock.fn(async () => undefined) };
  const northFactoryExports: Record<string, unknown> = {
    buildNorth: mock.fn(() => null),
    initNorthCache: mock.fn(async () => undefined),
    deleteNorthCache: mock.fn(async () => undefined),
    createNorthOrchestrator: mock.fn(() => null)
  };
  const southFactoryExports: Record<string, unknown> = {
    buildSouth: mock.fn(() => null),
    initSouthCache: mock.fn(async () => undefined),
    deleteSouthCache: mock.fn(async () => undefined)
  };

  // Constructor tracking for CacheService and HistoryQuery
  let cacheServiceCtorArgs: Array<unknown> | null = null;
  let historyQueryCtorCalls: Array<Array<unknown>> = [];
  let MockHistoryQuery: new (...args: Array<unknown>) => object;

  before(() => {
    mockModule(nodeRequire, '../service/utils', utilsExports);

    const cacheServiceExports = {
      __esModule: true,
      default: function MockCacheService(...args: Array<unknown>) {
        cacheServiceCtorArgs = [...args];
      }
    };
    mockModule(nodeRequire, '../service/cache/cache.service', cacheServiceExports);

    MockHistoryQuery = class {
      constructor(...args: Array<unknown>) {
        historyQueryCtorCalls.push([...args]);
      }
    };
    mockModule(nodeRequire, './history-query', { __esModule: true, default: MockHistoryQuery });
    mockModule(nodeRequire, '../north/north-connector-factory', northFactoryExports);
    mockModule(nodeRequire, '../south/south-connector-factory', southFactoryExports);

    const factory = reloadModule<{
      buildHistoryQuery: typeof BuildHistoryQueryFn;
      initHistoryQueryCache: typeof InitHistoryQueryCacheFn;
      createHistoryQueryOrchestrator: typeof CreateHistoryQueryOrchestratorFn;
      deleteHistoryQueryCache: typeof DeleteHistoryQueryCacheFn;
    }>(nodeRequire, './history-query-factory');
    buildHistoryQuery = factory.buildHistoryQuery;
    initHistoryQueryCache = factory.initHistoryQueryCache;
    createHistoryQueryOrchestrator = factory.createHistoryQueryOrchestrator;
    deleteHistoryQueryCache = factory.deleteHistoryQueryCache;
  });

  beforeEach(() => {
    cacheServiceCtorArgs = null;
    historyQueryCtorCalls = [];
    utilsExports.createFolder.mock.resetCalls();
    (northFactoryExports.buildNorth as { mock: { resetCalls(): void } }).mock.resetCalls();
    (northFactoryExports.initNorthCache as { mock: { resetCalls(): void } }).mock.resetCalls();
    (northFactoryExports.deleteNorthCache as { mock: { resetCalls(): void } }).mock.resetCalls();
    (southFactoryExports.buildSouth as { mock: { resetCalls(): void } }).mock.resetCalls();
    (southFactoryExports.initSouthCache as { mock: { resetCalls(): void } }).mock.resetCalls();
    (southFactoryExports.deleteSouthCache as { mock: { resetCalls(): void } }).mock.resetCalls();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('buildHistoryQuery', () => {
    const mockSettings = {
      id: 'hq-1',
      name: 'History Query 1',
      description: 'Test HQ',
      status: 'RUNNING',
      queryTimeRange: {
        startTime: testData.constants.dates.DATE_1,
        endTime: testData.constants.dates.DATE_2,
        maxReadInterval: 3600,
        readDelay: 200
      },
      southType: 'modbus',
      southSettings: { someSouthSetting: true } as unknown as SouthModbusSettings,
      northType: 'file-writer',
      northSettings: { someNorthSetting: true } as unknown as NorthFileWriterSettings,
      throttling: { maxReadInterval: 0, readDelay: 0 },
      caching: {
        trigger: {
          scanMode: { id: 'manual', name: 'Manual', description: '', cron: '' },
          numberOfElements: 100,
          numberOfFiles: 10
        },
        throttling: { runMinDelay: 1000, maxSize: 1000, maxNumberOfElements: 1000 },
        error: { retryInterval: 5000, retryCount: 3, retentionDuration: 86400 },
        archive: { enabled: true, retentionDuration: 604800 }
      },
      items: [],
      northTransformers: [{ id: 't1', transformer: {} as Transformer, options: {}, inputType: 'time-values', items: [] }]
    } as unknown as HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>;

    const mockNorthConnector = { cacheContent: mock.fn() };
    const mockSouthConnector = {};

    beforeEach(() => {
      northFactoryExports.buildNorth = mock.fn(() => mockNorthConnector);
      southFactoryExports.buildSouth = mock.fn(() => mockSouthConnector);
      mockNorthConnector.cacheContent = mock.fn();
    });

    it('should build north and south connectors and return HistoryQuery instance', () => {
      const mockAddContent = mock.fn();
      const result = buildHistoryQuery(
        mockSettings,
        mockAddContent,
        mockLogger,
        baseFolder,
        mockSouthCacheRepository,
        mockCertificateRepository,
        mockOIAnalyticsRegistrationRepository,
        mockOrchestrator
      );

      // Verify buildNorth args
      const buildNorthMock = northFactoryExports.buildNorth as { mock: { calls: Array<{ arguments: Array<unknown> }> } };
      assert.strictEqual(buildNorthMock.mock.calls.length, 1);
      const northArg = buildNorthMock.mock.calls[0].arguments[0] as Record<string, unknown>;
      assertContains(northArg, {
        id: mockSettings.id,
        name: mockSettings.name,
        enabled: true,
        type: mockSettings.northType,
        settings: mockSettings.northSettings,
        caching: mockSettings.caching
      });
      assert.ok(
        (northArg.transformers as Array<{ id: string }>).some(t => t.id === 't1'),
        'transformers should contain entry with id "t1"'
      );
      assert.strictEqual(buildNorthMock.mock.calls[0].arguments[1], mockLogger);
      assert.strictEqual(buildNorthMock.mock.calls[0].arguments[2], mockCertificateRepository);
      assert.strictEqual(buildNorthMock.mock.calls[0].arguments[3], mockOIAnalyticsRegistrationRepository);
      assert.strictEqual(buildNorthMock.mock.calls[0].arguments[4], mockOrchestrator);

      // Verify buildSouth args
      const buildSouthMock = southFactoryExports.buildSouth as { mock: { calls: Array<{ arguments: Array<unknown> }> } };
      assert.strictEqual(buildSouthMock.mock.calls.length, 1);
      const southArg = buildSouthMock.mock.calls[0].arguments[0] as Record<string, unknown>;
      assertContains(southArg, {
        id: mockSettings.id,
        name: mockSettings.name,
        enabled: true,
        type: mockSettings.southType,
        settings: mockSettings.southSettings,
        items: []
      });
      assert.strictEqual(
        typeof buildSouthMock.mock.calls[0].arguments[1],
        'function',
        'second arg to buildSouth should be addContent callback'
      );
      assert.strictEqual(buildSouthMock.mock.calls[0].arguments[2], mockLogger);
      assert.deepStrictEqual(
        buildSouthMock.mock.calls[0].arguments[3],
        path.join(baseFolder, 'cache', `history-${mockSettings.id}`, 'south')
      );
      assert.strictEqual(buildSouthMock.mock.calls[0].arguments[4], mockSouthCacheRepository);
      assert.strictEqual(buildSouthMock.mock.calls[0].arguments[5], mockCertificateRepository);
      assert.strictEqual(buildSouthMock.mock.calls[0].arguments[6], mockOIAnalyticsRegistrationRepository);

      // Verify HistoryQuery constructor call and result type
      assert.strictEqual(historyQueryCtorCalls.length, 1);
      assert.deepStrictEqual(historyQueryCtorCalls[0], [mockSettings, mockNorthConnector, mockSouthConnector, mockLogger]);
      assert.ok(result instanceof MockHistoryQuery);
    });

    it('should handle north caching callback inside south connector', async () => {
      const mockAddContent = mock.fn();
      buildHistoryQuery(
        mockSettings,
        mockAddContent,
        mockLogger,
        baseFolder,
        mockSouthCacheRepository,
        mockCertificateRepository,
        mockOIAnalyticsRegistrationRepository,
        mockOrchestrator
      );

      const buildSouthMock = southFactoryExports.buildSouth as { mock: { calls: Array<{ arguments: Array<unknown> }> } };
      const southCallback = buildSouthMock.mock.calls[0].arguments[1] as (
        southId: string,
        data: unknown,
        queryTime: string,
        itemIds: Array<unknown>
      ) => Promise<void>;
      assert.strictEqual(typeof southCallback, 'function');

      const mockData = { type: 'data' };
      const mockQueryTime = '2023-01-01';
      const mockItemIds = ['item1'];

      await southCallback('southId', mockData, mockQueryTime, mockItemIds);

      assert.strictEqual(mockNorthConnector.cacheContent.mock.calls.length, 1);
      assert.deepStrictEqual(mockNorthConnector.cacheContent.mock.calls[0].arguments, [
        mockData,
        { source: 'south', southId: mockSettings.id, queryTime: mockQueryTime, items: mockItemIds }
      ]);
    });
  });

  describe('initHistoryQueryCache', () => {
    const id = 'hq-1';

    it('should create all necessary folders for standard types', async () => {
      await initHistoryQueryCache(id, 'file-writer', 'modbus', baseFolder);

      const historyPath = `history-${id}`;
      const calledPaths = utilsExports.createFolder.mock.calls.map(c => c.arguments[0] as string);

      // North cache folders
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', historyPath, 'north')));
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', historyPath, 'north', METADATA_FOLDER)));
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', historyPath, 'north', CONTENT_FOLDER)));
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', historyPath, 'north', 'tmp')));

      // North error folders
      assert.ok(calledPaths.includes(path.join(baseFolder, 'error', historyPath, 'north')));
      assert.ok(calledPaths.includes(path.join(baseFolder, 'error', historyPath, 'north', METADATA_FOLDER)));
      assert.ok(calledPaths.includes(path.join(baseFolder, 'error', historyPath, 'north', CONTENT_FOLDER)));

      // North archive folders
      assert.ok(calledPaths.includes(path.join(baseFolder, 'archive', historyPath, 'north')));
      assert.ok(calledPaths.includes(path.join(baseFolder, 'archive', historyPath, 'north', METADATA_FOLDER)));
      assert.ok(calledPaths.includes(path.join(baseFolder, 'archive', historyPath, 'north', CONTENT_FOLDER)));

      // South cache folders
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', historyPath, 'south')));
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', historyPath, 'south', 'tmp')));

      // OPCUA-specific folders must NOT be created for non-opcua types
      assert.ok(!calledPaths.includes(path.join(baseFolder, 'cache', historyPath, 'north', 'opcua')));
      assert.ok(!calledPaths.includes(path.join(baseFolder, 'cache', historyPath, 'south', 'opcua')));
    });

    it('should create opcua specific folders if types are opcua', async () => {
      await initHistoryQueryCache(id, 'opcua', 'opcua', baseFolder);

      const historyPath = `history-${id}`;
      const calledPaths = utilsExports.createFolder.mock.calls.map(c => c.arguments[0] as string);

      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', historyPath, 'north', 'opcua')));
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', historyPath, 'south', 'opcua')));
    });
  });

  describe('createHistoryQueryOrchestrator', () => {
    it('should instantiate CacheService with correct paths', () => {
      const id = 'hq-1';
      createHistoryQueryOrchestrator(baseFolder, id, mockLogger);

      const historyPath = `history-${id}`;
      assert.ok(cacheServiceCtorArgs !== null, 'CacheService constructor should have been called');
      assert.deepStrictEqual(cacheServiceCtorArgs, [
        mockLogger,
        path.join(baseFolder, 'cache', historyPath, 'north'),
        path.join(baseFolder, 'error', historyPath, 'north'),
        path.join(baseFolder, 'archive', historyPath, 'north')
      ]);
    });
  });

  describe('deleteHistoryQueryCache', () => {
    it('should remove all history cache folders', async () => {
      const rmMock = mock.method(
        fs,
        'rm',
        mock.fn(async () => undefined)
      );
      const id = 'hq-1';
      await deleteHistoryQueryCache(id, baseFolder);

      const historyPath = `history-${id}`;
      assert.strictEqual(rmMock.mock.calls.length, 3);
      assert.deepStrictEqual(
        rmMock.mock.calls.map(c => [c.arguments[0], c.arguments[1]]),
        [
          [path.join(baseFolder, 'cache', historyPath), { recursive: true, force: true }],
          [path.join(baseFolder, 'error', historyPath), { recursive: true, force: true }],
          [path.join(baseFolder, 'archive', historyPath), { recursive: true, force: true }]
        ]
      );
    });
  });
});
