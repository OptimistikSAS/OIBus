import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { mockModule, reloadModule } from '../tests/utils/test-utils';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import type CertificateRepository from '../repository/config/certificate.repository';
import type OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import type {
  NorthAmazonS3Settings,
  NorthAzureBlobSettings,
  NorthConsoleSettings,
  NorthFileWriterSettings,
  NorthModbusSettings,
  NorthMQTTSettings,
  NorthOIAnalyticsSettings,
  NorthOPCUASettings,
  NorthRESTSettings,
  NorthSettings,
  NorthSFTPSettings
} from '../../shared/model/north-settings.model';
import type { NorthConnectorEntity } from '../model/north-connector.model';
import type { CONTENT_FOLDER, METADATA_FOLDER } from '../model/engine.model';
import type {
  buildNorth as BuildNorthFn,
  createNorthOrchestrator as CreateNorthOrchestratorFn,
  deleteNorthCache as DeleteNorthCacheFn,
  initNorthCache as InitNorthCacheFn
} from './north-connector-factory';

const nodeRequire = createRequire(import.meta.url);

describe('North Connector Factory', () => {
  const mockLogger = new PinoLogger();
  const mockCertificateRepository = {} as CertificateRepository;
  const mockOIAnalyticsRegistrationRepository = {} as OIAnalyticsRegistrationRepository;

  let buildNorth: typeof BuildNorthFn;
  let initNorthCache: typeof InitNorthCacheFn;
  let deleteNorthCache: typeof DeleteNorthCacheFn;
  let createNorthOrchestrator: typeof CreateNorthOrchestratorFn;

  const ctorCalls: Record<string, Array<Array<unknown>>> = {};
  const makeMock = (key: string) =>
    class {
      constructor(...args: Array<unknown>) {
        if (!ctorCalls[key]) ctorCalls[key] = [];
        ctorCalls[key].push(args);
      }
    };

  const MockNorthAmazonS3 = makeMock('aws-s3');
  const MockNorthAzureBlob = makeMock('azure-blob');
  const MockNorthConsole = makeMock('console');
  const MockNorthFileWriter = makeMock('file-writer');
  const MockNorthModbus = makeMock('modbus');
  const MockNorthMQTT = makeMock('mqtt');
  const MockNorthOIAnalytics = makeMock('oianalytics');
  const MockNorthREST = makeMock('rest');
  const MockNorthOPCUA = makeMock('opcua');
  const MockNorthSFTP = makeMock('sftp');
  const MockCacheService = makeMock('cache-service');

  const utilsExports = { createFolder: mock.fn(async (_path: string) => undefined) };

  before(() => {
    mockModule(nodeRequire, '../service/utils', utilsExports);
    mockModule(nodeRequire, '../service/cache/cache.service', { __esModule: true, default: MockCacheService });
    mockModule(nodeRequire, '../north/north-amazon-s3/north-amazon-s3', { __esModule: true, default: MockNorthAmazonS3 });
    mockModule(nodeRequire, '../north/north-azure-blob/north-azure-blob', { __esModule: true, default: MockNorthAzureBlob });
    mockModule(nodeRequire, '../north/north-console/north-console', { __esModule: true, default: MockNorthConsole });
    mockModule(nodeRequire, '../north/north-file-writer/north-file-writer', { __esModule: true, default: MockNorthFileWriter });
    mockModule(nodeRequire, '../north/north-modbus/north-modbus', { __esModule: true, default: MockNorthModbus });
    mockModule(nodeRequire, '../north/north-mqtt/north-mqtt', { __esModule: true, default: MockNorthMQTT });
    mockModule(nodeRequire, '../north/north-oianalytics/north-oianalytics', { __esModule: true, default: MockNorthOIAnalytics });
    mockModule(nodeRequire, '../north/north-rest/north-rest', { __esModule: true, default: MockNorthREST });
    mockModule(nodeRequire, '../north/north-opcua/north-opcua', { __esModule: true, default: MockNorthOPCUA });
    mockModule(nodeRequire, '../north/north-sftp/north-sftp', { __esModule: true, default: MockNorthSFTP });

    const factory = reloadModule<{
      buildNorth: typeof BuildNorthFn;
      initNorthCache: typeof InitNorthCacheFn;
      deleteNorthCache: typeof DeleteNorthCacheFn;
      createNorthOrchestrator: typeof CreateNorthOrchestratorFn;
    }>(nodeRequire, './north-connector-factory');
    buildNorth = factory.buildNorth;
    initNorthCache = factory.initNorthCache;
    deleteNorthCache = factory.deleteNorthCache;
    createNorthOrchestrator = factory.createNorthOrchestrator;
  });

  const baseSettings = {
    id: 'test-id',
    name: 'test-name',
    description: 'test-description',
    enabled: true,
    createdBy: '',
    updatedBy: '',
    createdAt: '',
    updatedAt: '',
    caching: {
      trigger: {
        scanMode: { id: 'manual', name: 'Manual', description: '', cron: '', createdBy: '', updatedBy: '', createdAt: '', updatedAt: '' },
        numberOfElements: 100,
        numberOfFiles: 10
      },
      throttling: {
        runMinDelay: 1000,
        maxSize: 1000,
        maxNumberOfElements: 1000
      },
      error: {
        retryInterval: 5000,
        retryCount: 3,
        retentionDuration: 86400
      },
      archive: {
        enabled: true,
        retentionDuration: 604800
      }
    },
    transformers: []
  };

  beforeEach(() => {
    for (const key of Object.keys(ctorCalls)) delete ctorCalls[key];
    utilsExports.createFolder = mock.fn(async (_path: string) => undefined);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  const callBuildNorth = (settings: NorthConnectorEntity<NorthSettings>) =>
    buildNorth(settings, mockLogger, mockCertificateRepository, mockOIAnalyticsRegistrationRepository, {} as never);

  describe('buildNorth', () => {
    it('should create NorthAmazonS3 for type "aws-s3"', () => {
      const settings: NorthConnectorEntity<NorthAmazonS3Settings> = {
        ...baseSettings,
        type: 'aws-s3',
        settings: {} as NorthAmazonS3Settings
      };
      const result = callBuildNorth(settings);
      assert.strictEqual(ctorCalls['aws-s3']?.length, 1);
      assert.ok(result instanceof MockNorthAmazonS3);
    });

    it('should create NorthAzureBlob for type "azure-blob"', () => {
      const settings: NorthConnectorEntity<NorthAzureBlobSettings> = {
        ...baseSettings,
        type: 'azure-blob',
        settings: {} as NorthAzureBlobSettings
      };
      const result = callBuildNorth(settings);
      assert.strictEqual(ctorCalls['azure-blob']?.length, 1);
      assert.ok(result instanceof MockNorthAzureBlob);
    });

    it('should create NorthConsole for type "console"', () => {
      const settings: NorthConnectorEntity<NorthConsoleSettings> = {
        ...baseSettings,
        type: 'console',
        settings: {} as NorthConsoleSettings
      };
      const result = callBuildNorth(settings);
      assert.strictEqual(ctorCalls['console']?.length, 1);
      assert.ok(result instanceof MockNorthConsole);
    });

    it('should create NorthFileWriter for type "file-writer"', () => {
      const settings: NorthConnectorEntity<NorthFileWriterSettings> = {
        ...baseSettings,
        type: 'file-writer',
        settings: {} as NorthFileWriterSettings
      };
      const result = callBuildNorth(settings);
      assert.strictEqual(ctorCalls['file-writer']?.length, 1);
      assert.ok(result instanceof MockNorthFileWriter);
    });

    it('should create NorthModbus for type "modbus"', () => {
      const settings: NorthConnectorEntity<NorthModbusSettings> = {
        ...baseSettings,
        type: 'modbus',
        settings: {} as NorthModbusSettings
      };
      const result = callBuildNorth(settings);
      assert.strictEqual(ctorCalls['modbus']?.length, 1);
      assert.ok(result instanceof MockNorthModbus);
    });

    it('should create NorthMQTT for type "mqtt"', () => {
      const settings: NorthConnectorEntity<NorthMQTTSettings> = {
        ...baseSettings,
        type: 'mqtt',
        settings: {} as NorthMQTTSettings
      };
      const result = callBuildNorth(settings);
      assert.strictEqual(ctorCalls['mqtt']?.length, 1);
      assert.ok(result instanceof MockNorthMQTT);
    });

    it('should create NorthOIAnalytics for type "oianalytics"', () => {
      const settings: NorthConnectorEntity<NorthOIAnalyticsSettings> = {
        ...baseSettings,
        type: 'oianalytics',
        settings: {} as NorthOIAnalyticsSettings
      };
      const result = callBuildNorth(settings);
      assert.strictEqual(ctorCalls['oianalytics']?.length, 1);
      const args = ctorCalls['oianalytics'][0];
      assert.deepStrictEqual(args[2], {}); // orchestrator
      assert.strictEqual(args[3], mockCertificateRepository);
      assert.strictEqual(args[4], mockOIAnalyticsRegistrationRepository);
      assert.ok(result instanceof MockNorthOIAnalytics);
    });

    it('should create NorthOPCUA for type "opcua"', () => {
      const settings: NorthConnectorEntity<NorthOPCUASettings> = {
        ...baseSettings,
        type: 'opcua',
        settings: {} as NorthOPCUASettings
      };
      const result = callBuildNorth(settings);
      assert.strictEqual(ctorCalls['opcua']?.length, 1);
      assert.ok(result instanceof MockNorthOPCUA);
    });

    it('should create NorthREST for type "rest"', () => {
      const settings: NorthConnectorEntity<NorthRESTSettings> = {
        ...baseSettings,
        type: 'rest',
        settings: {} as NorthRESTSettings
      };
      const result = callBuildNorth(settings);
      assert.strictEqual(ctorCalls['rest']?.length, 1);
      assert.ok(result instanceof MockNorthREST);
    });

    it('should create NorthSFTP for type "sftp"', () => {
      const settings: NorthConnectorEntity<NorthSFTPSettings> = {
        ...baseSettings,
        type: 'sftp',
        settings: {} as NorthSFTPSettings
      };
      const result = callBuildNorth(settings);
      assert.strictEqual(ctorCalls['sftp']?.length, 1);
      assert.ok(result instanceof MockNorthSFTP);
    });

    it('should throw an error for unknown type', () => {
      const settings = {
        ...baseSettings,
        type: 'unknown' as const,
        settings: {}
      } as unknown as NorthConnectorEntity<NorthSettings>; // intentionally invalid type to test the error branch
      assert.throws(() => callBuildNorth(settings), new Error('North connector of type "unknown" not installed'));
    });
  });

  describe('initNorthCache', () => {
    const baseFolder = '/base';
    const id = 'connector-id';

    it('should create necessary folders for standard connector', async () => {
      await initNorthCache(id, 'file-writer', baseFolder);

      const calledPaths = utilsExports.createFolder.mock.calls.map(c => c.arguments[0] as string);
      // Cache
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', `north-${id}`)));
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', `north-${id}`, 'metadata' as typeof METADATA_FOLDER)));
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', `north-${id}`, 'content' as typeof CONTENT_FOLDER)));
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', `north-${id}`, 'tmp')));
      // Error
      assert.ok(calledPaths.includes(path.join(baseFolder, 'error', `north-${id}`)));
      assert.ok(calledPaths.includes(path.join(baseFolder, 'error', `north-${id}`, 'metadata' as typeof METADATA_FOLDER)));
      assert.ok(calledPaths.includes(path.join(baseFolder, 'error', `north-${id}`, 'content' as typeof CONTENT_FOLDER)));
      // Archive
      assert.ok(calledPaths.includes(path.join(baseFolder, 'archive', `north-${id}`)));
      assert.ok(calledPaths.includes(path.join(baseFolder, 'archive', `north-${id}`, 'metadata' as typeof METADATA_FOLDER)));
      assert.ok(calledPaths.includes(path.join(baseFolder, 'archive', `north-${id}`, 'content' as typeof CONTENT_FOLDER)));
      // Should NOT create opcua folder
      assert.ok(!calledPaths.includes(path.join(baseFolder, 'cache', `north-${id}`, 'opcua')));
    });

    it('should create additional folder for opcua connector', async () => {
      await initNorthCache(id, 'opcua', baseFolder);

      const calledPaths = utilsExports.createFolder.mock.calls.map(c => c.arguments[0] as string);
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', `north-${id}`, 'opcua')));
    });
  });

  describe('deleteNorthCache', () => {
    const baseFolder = '/base';
    const id = 'connector-id';

    it('should remove cache, error and archive folders', async () => {
      const rmMock = mock.method(
        fs,
        'rm',
        mock.fn(async () => undefined)
      );
      await deleteNorthCache(id, baseFolder);
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

      const result = createNorthOrchestrator(baseFolder, id, mockLogger);

      assert.strictEqual(ctorCalls['cache-service']?.length, 1);
      const args = ctorCalls['cache-service'][0];
      assert.strictEqual(args[0], mockLogger);
      assert.strictEqual(args[1], path.join(baseFolder, 'cache', `north-${id}`));
      assert.strictEqual(args[2], path.join(baseFolder, 'error', `north-${id}`));
      assert.strictEqual(args[3], path.join(baseFolder, 'archive', `north-${id}`));
      assert.ok(result instanceof MockCacheService);
    });
  });
});
