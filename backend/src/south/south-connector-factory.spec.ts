import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import type { OIBusSouthType } from '../../shared/model/connector/south-manifest.model';
import type { SouthItemSettings, SouthSettings } from '../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity } from '../model/south-connector.model';
import type SouthCacheRepository from '../repository/cache/south-cache.repository';
import type CertificateRepository from '../repository/config/certificate.repository';
import type OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import { createMock, mockModule, reloadModule } from '../tests/utils/test-utils';
import type * as SouthConnectorFactory from './south-connector-factory';

const nodeRequire = createRequire(import.meta.url);

// Each connector type, the name of its class and the module the factory loads it from
const CONNECTORS: Array<{ type: OIBusSouthType; className: string; modulePath: string }> = [
  { type: 'ads', className: 'SouthADS', modulePath: './south-ads/south-ads' },
  { type: 'bacnet', className: 'SouthBACnet', modulePath: './south-bacnet/south-bacnet' },
  { type: 'folder-scanner', className: 'SouthFolderScanner', modulePath: './south-folder-scanner/south-folder-scanner' },
  { type: 'modbus', className: 'SouthModbus', modulePath: './south-modbus/south-modbus' },
  { type: 'mongodb', className: 'SouthMongoDB', modulePath: './south-mongodb/south-mongodb' },
  { type: 'mqtt', className: 'SouthMQTT', modulePath: './south-mqtt/south-mqtt' },
  { type: 'mssql', className: 'SouthMSSQL', modulePath: './south-mssql/south-mssql' },
  { type: 'mysql', className: 'SouthMySQL', modulePath: './south-mysql/south-mysql' },
  { type: 'odbc', className: 'SouthODBC', modulePath: './south-odbc/south-odbc' },
  { type: 'oianalytics', className: 'SouthOIAnalytics', modulePath: './south-oianalytics/south-oianalytics' },
  { type: 'oledb', className: 'SouthOLEDB', modulePath: './south-oledb/south-oledb' },
  { type: 'opc', className: 'SouthOPC', modulePath: './south-opc/south-opc' },
  { type: 'opcua', className: 'SouthOPCUA', modulePath: './south-opcua/south-opcua' },
  { type: 'oracle', className: 'SouthOracle', modulePath: './south-oracle/south-oracle' },
  { type: 'osisoft-pi', className: 'SouthPI', modulePath: './south-pi/south-pi' },
  { type: 'postgresql', className: 'SouthPostgreSQL', modulePath: './south-postgresql/south-postgresql' },
  { type: 'rest', className: 'SouthRestAPI', modulePath: './south-rest/south-rest' },
  { type: 's7', className: 'SouthS7', modulePath: './south-s7/south-s7' },
  { type: 'sftp', className: 'SouthSFTP', modulePath: './south-sftp/south-sftp' },
  { type: 'ftp', className: 'SouthFTP', modulePath: './south-ftp/south-ftp' },
  { type: 'influxdb', className: 'SouthInfluxDB', modulePath: './south-influxdb/south-influxdb' },
  { type: 'sqlite', className: 'SouthSQLite', modulePath: './south-sqlite/south-sqlite' }
];

describe('South Connector Factory', () => {
  let factory: typeof SouthConnectorFactory;

  const ctorCalls: Record<string, number> = {};
  const mockClasses = new Map(
    CONNECTORS.map(({ type }) => [
      type,
      class {
        constructor() {
          ctorCalls[type] = (ctorCalls[type] ?? 0) + 1;
        }
      }
    ])
  );

  const utilsExports = { createFolder: mock.fn(async (_path: string) => undefined) };

  before(() => {
    mockModule(nodeRequire, '../service/utils', utilsExports);
    for (const { type, modulePath } of CONNECTORS) {
      mockModule(nodeRequire, modulePath, { __esModule: true, default: mockClasses.get(type) });
    }
    factory = reloadModule<typeof SouthConnectorFactory>(nodeRequire, './south-connector-factory');
  });

  beforeEach(() => {
    for (const key of Object.keys(ctorCalls)) delete ctorCalls[key];
    utilsExports.createFolder = mock.fn(async (_path: string) => undefined);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  const callBuildSouth = (settings: SouthConnectorEntity<SouthSettings, SouthItemSettings>) =>
    factory.buildSouth(
      settings,
      mock.fn(async () => undefined),
      '/tmp/cache',
      createMock<SouthCacheRepository>(),
      createMock<CertificateRepository>(),
      createMock<OIAnalyticsRegistrationRepository>()
    );

  const buildSettings = (type: string) =>
    ({
      id: 'test-id',
      name: 'test-name',
      description: 'test-description',
      type,
      enabled: true,
      settings: {},
      items: [],
      groups: [],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    }) as unknown as SouthConnectorEntity<SouthSettings, SouthItemSettings>;

  describe('buildSouth', () => {
    for (const { type, className } of CONNECTORS) {
      it(`should create ${className} for type "${type}"`, () => {
        const result = callBuildSouth(buildSettings(type));
        assert.strictEqual(ctorCalls[type], 1);
        assert.ok(result instanceof mockClasses.get(type)!);
      });
    }

    it('should throw an error for unknown type', () => {
      // intentionally invalid type to test the error branch
      assert.throws(() => callBuildSouth(buildSettings('unknown')), new Error('South connector of type "unknown" not installed'));
    });
  });

  describe('initSouthCache', () => {
    const baseFolder = '/base';
    const id = 'connector-id';

    it('should create necessary folders for standard connector', async () => {
      await factory.initSouthCache(id, 'modbus', baseFolder);

      const calledPaths = utilsExports.createFolder.mock.calls.map(c => c.arguments[0]);
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', `south-${id}`)));
      assert.ok(calledPaths.includes(path.join(baseFolder, 'cache', `south-${id}`, 'tmp')));
    });
  });

  describe('deleteSouthCache', () => {
    const baseFolder = '/base';
    const id = 'connector-id';

    it('should remove south cache folder', async () => {
      const rmMock = mock.method(fs, 'rm', async () => undefined);
      await factory.deleteSouthCache(id, baseFolder);
      assert.strictEqual(rmMock.mock.calls.length, 1);
      assert.deepStrictEqual(rmMock.mock.calls[0].arguments, [
        path.join(baseFolder, 'cache', `south-${id}`),
        { recursive: true, force: true }
      ]);
    });
  });
});
