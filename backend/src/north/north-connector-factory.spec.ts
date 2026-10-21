import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import type { OIBusNorthType } from '../../shared/model/connector/north-manifest.model';
import type { NorthSettings } from '../../shared/model/connector/north-settings.model';

import type { NorthConnectorEntity } from '../model/north-connector.model';
import type CertificateRepository from '../repository/config/certificate.repository';
import type OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import type * as Utils from '../service/utils';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import { buildNorthEntity, createMock, mockModule, reloadModule } from '../tests/utils/test-utils';
import type * as NorthConnectorFactory from './north-connector-factory';

const nodeRequire = createRequire(import.meta.url);

describe('North Connector Factory', () => {
  const certificateRepository = createMock<CertificateRepository>();
  const oIAnalyticsRegistrationRepository = createMock<OIAnalyticsRegistrationRepository>();

  let factory: typeof NorthConnectorFactory;

  const ctorCalls: Record<string, Array<Array<unknown>>> = {};
  const makeMock = (key: string) =>
    class {
      constructor(...args: Array<unknown>) {
        if (!ctorCalls[key]) ctorCalls[key] = [];
        ctorCalls[key].push(args);
      }
    };

  const MockNorthAzureDataExplorer = makeMock('azure-data-explorer');
  const MockNorthOIAnalytics = makeMock('oianalytics');
  const MockCacheService = makeMock('cache-service');
  // Connectors only built from their configuration and orchestrator: [type, class name, module path, mock]
  const simpleNorths: Array<[OIBusNorthType, string, string, ReturnType<typeof makeMock>]> = [
    ['aws-s3', 'NorthAmazonS3', './north-amazon-s3/north-amazon-s3', makeMock('aws-s3')],
    ['azure-blob', 'NorthAzureBlob', './north-azure-blob/north-azure-blob', makeMock('azure-blob')],
    ['console', 'NorthConsole', './north-console/north-console', makeMock('console')],
    ['file-writer', 'NorthFileWriter', './north-file-writer/north-file-writer', makeMock('file-writer')],
    ['modbus', 'NorthModbus', './north-modbus/north-modbus', makeMock('modbus')],
    ['mqtt', 'NorthMQTT', './north-mqtt/north-mqtt', makeMock('mqtt')],
    ['opcua', 'NorthOPCUA', './north-opcua/north-opcua', makeMock('opcua')],
    ['rest', 'NorthREST', './north-rest/north-rest', makeMock('rest')],
    ['sftp', 'NorthSFTP', './north-sftp/north-sftp', makeMock('sftp')]
  ];

  const realUtils: typeof Utils = nodeRequire('../service/utils');
  const createUtilsMocks = () => ({ createFolder: mock.fn(async (_path: string) => undefined) });
  const utilsExports = { ...realUtils, ...createUtilsMocks() };

  before(() => {
    mockModule(nodeRequire, '../service/utils', utilsExports);
    mockModule(nodeRequire, '../service/cache/cache.service', { __esModule: true, default: MockCacheService });
    for (const [, , modulePath, NorthMock] of simpleNorths) {
      mockModule(nodeRequire, modulePath, { __esModule: true, default: NorthMock });
    }
    mockModule(nodeRequire, './north-azure-data-explorer/north-azure-data-explorer', {
      __esModule: true,
      default: MockNorthAzureDataExplorer
    });
    mockModule(nodeRequire, './north-oianalytics/north-oianalytics', { __esModule: true, default: MockNorthOIAnalytics });
    mockModule(nodeRequire, '../service/logger/logger.service', {
      loggerService: { createChildLogger: () => new PinoLogger() },
      default: class {}
    });

    factory = reloadModule<typeof NorthConnectorFactory>(nodeRequire, './north-connector-factory');
  });

  beforeEach(() => {
    for (const key of Object.keys(ctorCalls)) delete ctorCalls[key];
    Object.assign(utilsExports, createUtilsMocks());
  });

  afterEach(() => {
    mock.restoreAll();
  });

  const callBuildNorth = (settings: NorthConnectorEntity<NorthSettings>) =>
    factory.buildNorth(settings, certificateRepository, oIAnalyticsRegistrationRepository, {} as never);

  describe('buildNorth', () => {
    for (const [type, className, , NorthMock] of simpleNorths) {
      it(`should create ${className} for type "${type}"`, () => {
        const result = callBuildNorth(buildNorthEntity(type, {} as NorthSettings));
        assert.strictEqual(ctorCalls[type]?.length, 1);
        assert.ok(result instanceof NorthMock);
      });
    }

    it('should create NorthAzureDataExplorer for type "azure-data-explorer"', () => {
      const result = callBuildNorth(buildNorthEntity('azure-data-explorer', {} as NorthSettings));
      assert.strictEqual(ctorCalls['azure-data-explorer']?.length, 1);
      const args = ctorCalls['azure-data-explorer'][0];
      assert.deepStrictEqual(args[1], {}); // orchestrator
      assert.strictEqual(args[2], certificateRepository);
      assert.ok(result instanceof MockNorthAzureDataExplorer);
    });

    it('should create NorthOIAnalytics for type "oianalytics"', () => {
      const result = callBuildNorth(buildNorthEntity('oianalytics', {} as NorthSettings));
      assert.strictEqual(ctorCalls['oianalytics']?.length, 1);
      const args = ctorCalls['oianalytics'][0];
      assert.deepStrictEqual(args[1], {}); // orchestrator
      assert.strictEqual(args[2], certificateRepository);
      assert.strictEqual(args[3], oIAnalyticsRegistrationRepository);
      assert.ok(result instanceof MockNorthOIAnalytics);
    });

    it('should throw an error for unknown type', () => {
      // intentionally invalid type to test the error branch
      const settings = buildNorthEntity('unknown' as OIBusNorthType, {} as NorthSettings);
      assert.throws(() => callBuildNorth(settings), new Error('North connector of type "unknown" not installed'));
    });
  });

  describe('initNorthCache', () => {
    const baseFolder = '/base';
    const id = 'connector-id';

    it('should create necessary folders for standard connector', async () => {
      await factory.initNorthCache(id, 'file-writer', baseFolder);

      const calledPaths = utilsExports.createFolder.mock.calls.map(c => c.arguments[0]);
      for (const folder of ['cache', 'error', 'archive']) {
        assert.ok(calledPaths.includes(path.join(baseFolder, folder, `north-${id}`)));
        assert.ok(calledPaths.includes(path.join(baseFolder, folder, `north-${id}`, 'metadata')));
        assert.ok(calledPaths.includes(path.join(baseFolder, folder, `north-${id}`, 'content')));
      }
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', `north-${id}`, 'tmp')));
      // Should NOT create opcua folder
      assert.ok(!calledPaths.includes(path.join(baseFolder, 'cache', `north-${id}`, 'opcua')));
    });

    it('should create additional folder for opcua connector', async () => {
      await factory.initNorthCache(id, 'opcua', baseFolder);

      const calledPaths = utilsExports.createFolder.mock.calls.map(c => c.arguments[0]);
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', `north-${id}`, 'opcua')));
    });
  });

  describe('deleteNorthCache', () => {
    const baseFolder = '/base';
    const id = 'connector-id';

    it('should remove cache, error and archive folders', async () => {
      const rmMock = mock.method(fs, 'rm', async () => undefined);
      await factory.deleteNorthCache(id, baseFolder);
      assert.strictEqual(rmMock.mock.calls.length, 3);
      assert.deepStrictEqual(rmMock.mock.calls[0].arguments, [
        path.join(baseFolder, 'cache', `north-${id}`),
        { recursive: true, force: true }
      ]);
      assert.deepStrictEqual(rmMock.mock.calls[1].arguments, [
        path.join(baseFolder, 'error', `north-${id}`),
        { recursive: true, force: true }
      ]);
      assert.deepStrictEqual(rmMock.mock.calls[2].arguments, [
        path.join(baseFolder, 'archive', `north-${id}`),
        { recursive: true, force: true }
      ]);
    });
  });

  describe('createNorthOrchestrator', () => {
    it('should create CacheService with correct paths', () => {
      const baseFolder = '/base';
      const id = 'test-id';

      const result = factory.createNorthOrchestrator(baseFolder, id, 'test-name');

      assert.strictEqual(ctorCalls['cache-service']?.length, 1);
      const args = ctorCalls['cache-service'][0];
      assert.strictEqual(args[1], path.join(baseFolder, 'cache', `north-${id}`));
      assert.strictEqual(args[2], path.join(baseFolder, 'error', `north-${id}`));
      assert.strictEqual(args[3], path.join(baseFolder, 'archive', `north-${id}`));
      assert.ok(result instanceof MockCacheService);
    });
  });
});
