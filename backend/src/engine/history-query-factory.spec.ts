import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import type { NorthSettings } from '../../shared/model/connector/north-settings.model';

import { CONTENT_FOLDER, METADATA_FOLDER } from '../model/engine.model';
import type NorthConnector from '../north/north-connector';
import type SouthCacheRepository from '../repository/cache/south-cache.repository';
import type CertificateRepository from '../repository/config/certificate.repository';
import type OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import type CacheService from '../service/cache/cache.service';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import testData from '../tests/utils/test-data';
import { assertContains, createMock, type Mocked, mockModule, reloadModule } from '../tests/utils/test-utils';
import type * as HistoryQueryFactory from './history-query-factory';

const nodeRequire = createRequire(import.meta.url);

type SouthCallback = (
  southId: string,
  data: unknown,
  queryTime: string,
  items: Array<unknown>,
  queryStartTime?: string | null,
  queryEndTime?: string | null
) => Promise<void>;

describe('HistoryQueryFactory', () => {
  const baseFolder = '/tmp/oibus';
  const id = 'hq-1';
  const historyPath = `history-${id}`;

  let factory: typeof HistoryQueryFactory;
  let southCacheRepository: SouthCacheRepository;
  let certificateRepository: CertificateRepository;
  let oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository;
  let orchestrator: CacheService;

  // The SUT keeps references to these exports objects: their functions are replaced in place in beforeEach
  const createFactoryMocks = () => ({
    utils: { createFolder: mock.fn(async (_path: string) => undefined) },
    north: { buildNorth: mock.fn((..._args: Array<unknown>): unknown => null) },
    south: { buildSouth: mock.fn((..._args: Array<unknown>): unknown => null) }
  });
  const mocks = createFactoryMocks();

  // Constructor tracking for CacheService and HistoryQuery
  let cacheServiceCtorArgs: Array<unknown> | null;
  let historyQueryCtorCalls: Array<Array<unknown>>;
  class MockHistoryQuery {
    constructor(...args: Array<unknown>) {
      historyQueryCtorCalls.push(args);
    }
  }

  before(() => {
    mockModule(nodeRequire, '../service/utils', mocks.utils);
    mockModule(nodeRequire, '../service/cache/cache.service', {
      __esModule: true,
      default: function MockCacheService(...args: Array<unknown>) {
        cacheServiceCtorArgs = args;
      }
    });
    mockModule(nodeRequire, './history-query', { __esModule: true, default: MockHistoryQuery });
    mockModule(nodeRequire, '../north/north-connector-factory', mocks.north);
    mockModule(nodeRequire, '../south/south-connector-factory', mocks.south);
    mockModule(nodeRequire, '../service/logger/logger.service', {
      loggerService: { createChildLogger: () => new PinoLogger() },
      default: class {}
    });

    factory = reloadModule<typeof HistoryQueryFactory>(nodeRequire, './history-query-factory');
  });

  beforeEach(() => {
    cacheServiceCtorArgs = null;
    historyQueryCtorCalls = [];
    const fresh = createFactoryMocks();
    Object.assign(mocks.utils, fresh.utils);
    Object.assign(mocks.north, fresh.north);
    Object.assign(mocks.south, fresh.south);
    southCacheRepository = createMock<SouthCacheRepository>();
    certificateRepository = createMock<CertificateRepository>();
    oIAnalyticsRegistrationRepository = createMock<OIAnalyticsRegistrationRepository>();
    orchestrator = createMock<CacheService>();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('buildHistoryQuery', () => {
    const settings = { ...testData.historyQueries.list[0], id };
    const southConnector = {};
    let northConnector: Mocked<NorthConnector<NorthSettings>>;

    const build = () =>
      factory.buildHistoryQuery(
        settings,
        mock.fn(async () => undefined),
        baseFolder,
        southCacheRepository,
        certificateRepository,
        oIAnalyticsRegistrationRepository,
        orchestrator
      );

    beforeEach(() => {
      northConnector = createMock<NorthConnector<NorthSettings>>();
      mocks.north.buildNorth.mock.mockImplementation(() => northConnector);
      mocks.south.buildSouth.mock.mockImplementation(() => southConnector);
    });

    it('should build north and south connectors and return HistoryQuery instance', () => {
      const result = build();

      // Verify buildNorth args
      assert.strictEqual(mocks.north.buildNorth.mock.calls.length, 1);
      const [northArg, ...northRepositories] = mocks.north.buildNorth.mock.calls[0].arguments;
      assertContains(northArg as Record<string, unknown>, {
        id: settings.id,
        name: settings.name,
        enabled: true,
        type: settings.northType,
        settings: settings.northSettings,
        caching: settings.caching
      });
      assert.ok(
        (northArg as { transformers: Array<{ id: string }> }).transformers.some(t => t.id === settings.northTransformers[0].id),
        'transformers should contain the history query transformer'
      );
      assert.deepStrictEqual(northRepositories, [certificateRepository, oIAnalyticsRegistrationRepository, orchestrator]);

      // Verify buildSouth args
      assert.strictEqual(mocks.south.buildSouth.mock.calls.length, 1);
      const [southArg, callback, southCachePath, ...southRepositories] = mocks.south.buildSouth.mock.calls[0].arguments;
      assertContains(southArg as Record<string, unknown>, {
        id: settings.id,
        name: settings.name,
        enabled: true,
        type: settings.southType,
        settings: settings.southSettings,
        items: []
      });
      assert.strictEqual(typeof callback, 'function', 'second arg to buildSouth should be addContent callback');
      assert.strictEqual(southCachePath, path.join(baseFolder, 'cache', historyPath, 'south'));
      assert.deepStrictEqual(southRepositories, [southCacheRepository, certificateRepository, oIAnalyticsRegistrationRepository]);

      // Verify HistoryQuery constructor call and result type
      assert.deepStrictEqual(historyQueryCtorCalls, [[settings, northConnector, southConnector]]);
      assert.ok(result instanceof MockHistoryQuery);
    });

    it('should handle north caching callback inside south connector', async () => {
      build();

      const southCallback = mocks.south.buildSouth.mock.calls[0].arguments[1] as SouthCallback;
      await southCallback('southId', { type: 'data' }, '2023-01-01', ['item1']);

      assert.strictEqual(northConnector.cacheContent.mock.calls.length, 1);
      assert.deepStrictEqual(northConnector.cacheContent.mock.calls[0].arguments, [
        { type: 'data' },
        {
          source: 'south',
          southId: settings.id,
          southName: settings.name,
          queryTime: '2023-01-01',
          queryStartTime: undefined,
          queryEndTime: undefined,
          items: ['item1']
        }
      ]);
    });

    it('should forward the queried interval bounds to the north caching callback', async () => {
      build();

      const southCallback = mocks.south.buildSouth.mock.calls[0].arguments[1] as SouthCallback;
      await southCallback('southId', { type: 'data' }, '2023-01-01', ['item1'], '2023-01-01T00:00:00.000Z', '2023-01-01T01:00:00.000Z');

      assert.deepStrictEqual(northConnector.cacheContent.mock.calls[0].arguments, [
        { type: 'data' },
        {
          source: 'south',
          southId: settings.id,
          southName: settings.name,
          queryTime: '2023-01-01',
          queryStartTime: '2023-01-01T00:00:00.000Z',
          queryEndTime: '2023-01-01T01:00:00.000Z',
          items: ['item1']
        }
      ]);
    });
  });

  describe('initHistoryQueryCache', () => {
    const createdFolders = () => mocks.utils.createFolder.mock.calls.map(c => c.arguments[0]);

    it('should create all necessary folders for standard types', async () => {
      await factory.initHistoryQueryCache(id, 'file-writer', 'modbus', baseFolder);

      const calledPaths = createdFolders();

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
      await factory.initHistoryQueryCache(id, 'opcua', 'opcua', baseFolder);

      const calledPaths = createdFolders();
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', historyPath, 'north', 'opcua')));
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', historyPath, 'south', 'opcua')));
    });
  });

  describe('createHistoryQueryOrchestrator', () => {
    it('should instantiate CacheService with correct paths', () => {
      factory.createHistoryQueryOrchestrator(baseFolder, id, 'test-name');

      assert.ok(cacheServiceCtorArgs !== null, 'CacheService constructor should have been called');
      const [, cachePath, errorPath, archivePath] = cacheServiceCtorArgs;
      assert.strictEqual(cachePath, path.join(baseFolder, 'cache', historyPath, 'north'));
      assert.strictEqual(errorPath, path.join(baseFolder, 'error', historyPath, 'north'));
      assert.strictEqual(archivePath, path.join(baseFolder, 'archive', historyPath, 'north'));
    });
  });

  describe('deleteHistoryQueryCache', () => {
    it('should remove all history cache folders', async () => {
      const rmMock = mock.method(fs, 'rm', async () => undefined);
      await factory.deleteHistoryQueryCache(id, baseFolder);

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
