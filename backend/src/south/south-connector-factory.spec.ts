import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { mockModule, reloadModule } from '../tests/utils/test-utils';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import type { SouthConnectorEntity } from '../model/south-connector.model';
import type { OIBusContent } from '../../shared/model/engine.model';
import type { Instant } from '../../shared/model/types';
import type { SouthConnectorItemEntity } from '../model/south-connector.model';
import type SouthCacheRepository from '../repository/cache/south-cache.repository';
import type CertificateRepository from '../repository/config/certificate.repository';
import type OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import type {
  SouthADSItemSettings,
  SouthADSSettings,
  SouthFolderScannerItemSettings,
  SouthFolderScannerSettings,
  SouthFTPItemSettings,
  SouthFTPSettings,
  SouthItemSettings,
  SouthModbusItemSettings,
  SouthModbusSettings,
  SouthMQTTItemSettings,
  SouthMQTTSettings,
  SouthMSSQLItemSettings,
  SouthMSSQLSettings,
  SouthMySQLItemSettings,
  SouthMySQLSettings,
  SouthODBCItemSettings,
  SouthODBCSettings,
  SouthOIAnalyticsItemSettings,
  SouthOIAnalyticsSettings,
  SouthOLEDBItemSettings,
  SouthOLEDBSettings,
  SouthOPCItemSettings,
  SouthOPCSettings,
  SouthOPCUAItemSettings,
  SouthOPCUASettings,
  SouthOracleItemSettings,
  SouthOracleSettings,
  SouthPIItemSettings,
  SouthPISettings,
  SouthPostgreSQLItemSettings,
  SouthPostgreSQLSettings,
  SouthRestItemSettings,
  SouthRestSettings,
  SouthSettings,
  SouthSFTPItemSettings,
  SouthSFTPSettings,
  SouthSQLiteItemSettings,
  SouthSQLiteSettings
} from '../../shared/model/south-settings.model';
import type {
  buildSouth as BuildSouthFn,
  deleteSouthCache as DeleteSouthCacheFn,
  initSouthCache as InitSouthCacheFn
} from './south-connector-factory';

const nodeRequire = createRequire(import.meta.url);

describe('South Connector Factory', () => {
  const mockLogger = new PinoLogger();
  const mockAddContent = mock.fn(
    async (_southId: string, _data: OIBusContent, _queryTime: Instant, _items: Array<SouthConnectorItemEntity<SouthItemSettings>>) =>
      undefined
  );
  const mockSouthCacheFolder = '/tmp/cache';
  const mockSouthCacheRepository = {} as SouthCacheRepository;
  const mockCertificateRepository = {} as CertificateRepository;
  const mockOIAnalyticsRegistrationRepository = {} as OIAnalyticsRegistrationRepository;

  let buildSouth: typeof BuildSouthFn;
  let deleteSouthCache: typeof DeleteSouthCacheFn;
  let initSouthCache: typeof InitSouthCacheFn;

  const ctorCalls: Record<string, number> = {};
  const makeMock = (key: string) =>
    class {
      constructor() {
        ctorCalls[key] = (ctorCalls[key] ?? 0) + 1;
      }
    };

  const MockSouthADS = makeMock('ads');
  const MockSouthFolderScanner = makeMock('folder-scanner');
  const MockSouthModbus = makeMock('modbus');
  const MockSouthMQTT = makeMock('mqtt');
  const MockSouthMSSQL = makeMock('mssql');
  const MockSouthMySQL = makeMock('mysql');
  const MockSouthODBC = makeMock('odbc');
  const MockSouthOIAnalytics = makeMock('oianalytics');
  const MockSouthOLEDB = makeMock('oledb');
  const MockSouthOPC = makeMock('opc');
  const MockSouthOPCUA = makeMock('opcua');
  const MockSouthOracle = makeMock('oracle');
  const MockSouthPI = makeMock('osisoft-pi');
  const MockSouthPostgreSQL = makeMock('postgresql');
  const MockSouthRest = makeMock('rest');
  const MockSouthSFTP = makeMock('sftp');
  const MockSouthFTP = makeMock('ftp');
  const MockSouthSQLite = makeMock('sqlite');

  const utilsExports = { createFolder: mock.fn(async (_path: string) => undefined) };

  before(() => {
    mockModule(nodeRequire, '../service/utils', utilsExports);
    mockModule(nodeRequire, '../south/south-ads/south-ads', { __esModule: true, default: MockSouthADS });
    mockModule(nodeRequire, '../south/south-folder-scanner/south-folder-scanner', { __esModule: true, default: MockSouthFolderScanner });
    mockModule(nodeRequire, '../south/south-modbus/south-modbus', { __esModule: true, default: MockSouthModbus });
    mockModule(nodeRequire, '../south/south-mqtt/south-mqtt', { __esModule: true, default: MockSouthMQTT });
    mockModule(nodeRequire, '../south/south-mssql/south-mssql', { __esModule: true, default: MockSouthMSSQL });
    mockModule(nodeRequire, '../south/south-mysql/south-mysql', { __esModule: true, default: MockSouthMySQL });
    mockModule(nodeRequire, '../south/south-odbc/south-odbc', { __esModule: true, default: MockSouthODBC });
    mockModule(nodeRequire, '../south/south-oianalytics/south-oianalytics', { __esModule: true, default: MockSouthOIAnalytics });
    mockModule(nodeRequire, '../south/south-oledb/south-oledb', { __esModule: true, default: MockSouthOLEDB });
    mockModule(nodeRequire, '../south/south-opc/south-opc', { __esModule: true, default: MockSouthOPC });
    mockModule(nodeRequire, '../south/south-opcua/south-opcua', { __esModule: true, default: MockSouthOPCUA });
    mockModule(nodeRequire, '../south/south-oracle/south-oracle', { __esModule: true, default: MockSouthOracle });
    mockModule(nodeRequire, '../south/south-pi/south-pi', { __esModule: true, default: MockSouthPI });
    mockModule(nodeRequire, '../south/south-postgresql/south-postgresql', { __esModule: true, default: MockSouthPostgreSQL });
    mockModule(nodeRequire, '../south/south-rest/south-rest', { __esModule: true, default: MockSouthRest });
    mockModule(nodeRequire, '../south/south-sftp/south-sftp', { __esModule: true, default: MockSouthSFTP });
    mockModule(nodeRequire, '../south/south-ftp/south-ftp', { __esModule: true, default: MockSouthFTP });
    mockModule(nodeRequire, '../south/south-sqlite/south-sqlite', { __esModule: true, default: MockSouthSQLite });

    const factory = reloadModule<{
      buildSouth: typeof BuildSouthFn;
      deleteSouthCache: typeof DeleteSouthCacheFn;
      initSouthCache: typeof InitSouthCacheFn;
    }>(nodeRequire, './south-connector-factory');
    buildSouth = factory.buildSouth;
    deleteSouthCache = factory.deleteSouthCache;
    initSouthCache = factory.initSouthCache;
  });

  const baseSettings = {
    id: 'test-id',
    name: 'test-name',
    description: 'test-description',
    enabled: true,
    items: [],
    groups: [],
    createdBy: '',
    updatedBy: '',
    createdAt: '',
    updatedAt: ''
  };

  beforeEach(() => {
    for (const key of Object.keys(ctorCalls)) delete ctorCalls[key];
    utilsExports.createFolder = mock.fn(async (_path: string) => undefined);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  const callBuildSouth = (settings: SouthConnectorEntity<SouthSettings, SouthItemSettings>) =>
    buildSouth(
      settings,
      mockAddContent,
      mockLogger,
      mockSouthCacheFolder,
      mockSouthCacheRepository,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );

  describe('buildSouth', () => {
    it('should create SouthADS for type "ads"', () => {
      const settings: SouthConnectorEntity<SouthADSSettings, SouthADSItemSettings> = {
        ...baseSettings,
        type: 'ads',
        settings: {} as SouthADSSettings
      };
      const result = callBuildSouth(settings);
      assert.strictEqual(ctorCalls['ads'], 1);
      assert.ok(result instanceof MockSouthADS);
    });

    it('should create SouthFolderScanner for type "folder-scanner"', () => {
      const result = callBuildSouth({
        ...baseSettings,
        type: 'folder-scanner',
        settings: {} as SouthFolderScannerSettings
      } as SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings>);
      assert.strictEqual(ctorCalls['folder-scanner'], 1);
      assert.ok(result instanceof MockSouthFolderScanner);
    });

    it('should create SouthModbus for type "modbus"', () => {
      const result = callBuildSouth({ ...baseSettings, type: 'modbus', settings: {} as SouthModbusSettings } as SouthConnectorEntity<
        SouthModbusSettings,
        SouthModbusItemSettings
      >);
      assert.strictEqual(ctorCalls['modbus'], 1);
      assert.ok(result instanceof MockSouthModbus);
    });

    it('should create SouthMQTT for type "mqtt"', () => {
      const result = callBuildSouth({ ...baseSettings, type: 'mqtt', settings: {} as SouthMQTTSettings } as SouthConnectorEntity<
        SouthMQTTSettings,
        SouthMQTTItemSettings
      >);
      assert.strictEqual(ctorCalls['mqtt'], 1);
      assert.ok(result instanceof MockSouthMQTT);
    });

    it('should create SouthMSSQL for type "mssql"', () => {
      const result = callBuildSouth({ ...baseSettings, type: 'mssql', settings: {} as SouthMSSQLSettings } as SouthConnectorEntity<
        SouthMSSQLSettings,
        SouthMSSQLItemSettings
      >);
      assert.strictEqual(ctorCalls['mssql'], 1);
      assert.ok(result instanceof MockSouthMSSQL);
    });

    it('should create SouthMySQL for type "mysql"', () => {
      const result = callBuildSouth({ ...baseSettings, type: 'mysql', settings: {} as SouthMySQLSettings } as SouthConnectorEntity<
        SouthMySQLSettings,
        SouthMySQLItemSettings
      >);
      assert.strictEqual(ctorCalls['mysql'], 1);
      assert.ok(result instanceof MockSouthMySQL);
    });

    it('should create SouthODBC for type "odbc"', () => {
      const result = callBuildSouth({ ...baseSettings, type: 'odbc', settings: {} as SouthODBCSettings } as SouthConnectorEntity<
        SouthODBCSettings,
        SouthODBCItemSettings
      >);
      assert.strictEqual(ctorCalls['odbc'], 1);
      assert.ok(result instanceof MockSouthODBC);
    });

    it('should create SouthOIAnalytics for type "oianalytics"', () => {
      const result = callBuildSouth({
        ...baseSettings,
        type: 'oianalytics',
        settings: {} as SouthOIAnalyticsSettings
      } as SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings>);
      assert.strictEqual(ctorCalls['oianalytics'], 1);
      assert.ok(result instanceof MockSouthOIAnalytics);
    });

    it('should create SouthOLEDB for type "oledb"', () => {
      const result = callBuildSouth({ ...baseSettings, type: 'oledb', settings: {} as SouthOLEDBSettings } as SouthConnectorEntity<
        SouthOLEDBSettings,
        SouthOLEDBItemSettings
      >);
      assert.strictEqual(ctorCalls['oledb'], 1);
      assert.ok(result instanceof MockSouthOLEDB);
    });

    it('should create SouthOPC for type "opc"', () => {
      const result = callBuildSouth({ ...baseSettings, type: 'opc', settings: {} as SouthOPCSettings } as SouthConnectorEntity<
        SouthOPCSettings,
        SouthOPCItemSettings
      >);
      assert.strictEqual(ctorCalls['opc'], 1);
      assert.ok(result instanceof MockSouthOPC);
    });

    it('should create SouthOPCUA for type "opcua"', () => {
      const result = callBuildSouth({ ...baseSettings, type: 'opcua', settings: {} as SouthOPCUASettings } as SouthConnectorEntity<
        SouthOPCUASettings,
        SouthOPCUAItemSettings
      >);
      assert.strictEqual(ctorCalls['opcua'], 1);
      assert.ok(result instanceof MockSouthOPCUA);
    });

    it('should create SouthOracle for type "oracle"', () => {
      const result = callBuildSouth({ ...baseSettings, type: 'oracle', settings: {} as SouthOracleSettings } as SouthConnectorEntity<
        SouthOracleSettings,
        SouthOracleItemSettings
      >);
      assert.strictEqual(ctorCalls['oracle'], 1);
      assert.ok(result instanceof MockSouthOracle);
    });

    it('should create SouthPI for type "osisoft-pi"', () => {
      const result = callBuildSouth({ ...baseSettings, type: 'osisoft-pi', settings: {} as SouthPISettings } as SouthConnectorEntity<
        SouthPISettings,
        SouthPIItemSettings
      >);
      assert.strictEqual(ctorCalls['osisoft-pi'], 1);
      assert.ok(result instanceof MockSouthPI);
    });

    it('should create SouthPostgreSQL for type "postgresql"', () => {
      const result = callBuildSouth({
        ...baseSettings,
        type: 'postgresql',
        settings: {} as SouthPostgreSQLSettings
      } as SouthConnectorEntity<SouthPostgreSQLSettings, SouthPostgreSQLItemSettings>);
      assert.strictEqual(ctorCalls['postgresql'], 1);
      assert.ok(result instanceof MockSouthPostgreSQL);
    });

    it('should create SouthRestAPI for type "rest"', () => {
      const result = callBuildSouth({ ...baseSettings, type: 'rest', settings: {} as SouthRestSettings } as SouthConnectorEntity<
        SouthRestSettings,
        SouthRestItemSettings
      >);
      assert.strictEqual(ctorCalls['rest'], 1);
      assert.ok(result instanceof MockSouthRest);
    });

    it('should create SouthSFTP for type "sftp"', () => {
      const result = callBuildSouth({ ...baseSettings, type: 'sftp', settings: {} as SouthSFTPSettings } as SouthConnectorEntity<
        SouthSFTPSettings,
        SouthSFTPItemSettings
      >);
      assert.strictEqual(ctorCalls['sftp'], 1);
      assert.ok(result instanceof MockSouthSFTP);
    });

    it('should create SouthFTP for type "ftp"', () => {
      const result = callBuildSouth({ ...baseSettings, type: 'ftp', settings: {} as SouthFTPSettings } as SouthConnectorEntity<
        SouthFTPSettings,
        SouthFTPItemSettings
      >);
      assert.strictEqual(ctorCalls['ftp'], 1);
      assert.ok(result instanceof MockSouthFTP);
    });

    it('should create SouthSQLite for type "sqlite"', () => {
      const result = callBuildSouth({ ...baseSettings, type: 'sqlite', settings: {} as SouthSQLiteSettings } as SouthConnectorEntity<
        SouthSQLiteSettings,
        SouthSQLiteItemSettings
      >);
      assert.strictEqual(ctorCalls['sqlite'], 1);
      assert.ok(result instanceof MockSouthSQLite);
    });

    it('should throw an error for unknown type', () => {
      const settings = {
        ...baseSettings,
        type: 'unknown' as const,
        settings: {}
      } as unknown as SouthConnectorEntity<SouthSettings, SouthItemSettings>; // intentionally invalid type to test the error branch
      assert.throws(() => callBuildSouth(settings), new Error('South connector of type "unknown" not installed'));
    });
  });

  describe('initSouthCache', () => {
    const baseFolder = '/base';
    const id = 'connector-id';

    it('should create necessary folders for standard connector', async () => {
      await initSouthCache(id, 'modbus', baseFolder);

      const calledPaths = utilsExports.createFolder.mock.calls.map(c => c.arguments[0] as string);
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', `south-${id}`)));
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', `south-${id}`, 'tmp')));
      assert.ok(!calledPaths.includes(path.join(baseFolder, 'cache', `south-${id}`, 'opcua')));
    });

    it('should create additional folder for opcua connector', async () => {
      await initSouthCache(id, 'opcua', baseFolder);

      const calledPaths = utilsExports.createFolder.mock.calls.map(c => c.arguments[0] as string);
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', `south-${id}`)));
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', `south-${id}`, 'tmp')));
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', `south-${id}`, 'opcua')));
    });
  });

  describe('deleteSouthCache', () => {
    const baseFolder = '/base';
    const id = 'connector-id';

    it('should remove south cache folder', async () => {
      const rmMock = mock.method(
        fs,
        'rm',
        mock.fn(async () => undefined)
      );
      await deleteSouthCache(id, baseFolder);
      assert.strictEqual(rmMock.mock.calls.length, 1);
      assert.deepStrictEqual(rmMock.mock.calls[0].arguments, [
        path.join(baseFolder, 'cache', `south-${id}`),
        { recursive: true, force: true }
      ]);
    });
  });
});
