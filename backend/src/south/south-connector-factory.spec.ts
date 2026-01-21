// south-connector-factory.test.ts
import pino from 'pino';
import { buildSouth } from './south-connector-factory';
import { SouthConnectorEntity } from '../model/south-connector.model';
import { OIBusContent } from '../../shared/model/engine.model';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from 'src/repository/config/oianalytics-registration.repository';
import SouthADS from '../south/south-ads/south-ads';
import SouthFolderScanner from '../south/south-folder-scanner/south-folder-scanner';
import SouthModbus from '../south/south-modbus/south-modbus';
import SouthMQTT from '../south/south-mqtt/south-mqtt';
import SouthMSSQL from '../south/south-mssql/south-mssql';
import SouthMySQL from '../south/south-mysql/south-mysql';
import SouthODBC from '../south/south-odbc/south-odbc';
import SouthOIAnalytics from '../south/south-oianalytics/south-oianalytics';
import SouthOLEDB from '../south/south-oledb/south-oledb';
import SouthOPC from '../south/south-opc/south-opc';
import SouthOPCUA from '../south/south-opcua/south-opcua';
import SouthOracle from '../south/south-oracle/south-oracle';
import SouthPI from '../south/south-pi/south-pi';
import SouthPostgreSQL from '../south/south-postgresql/south-postgresql';
import SouthRestAPI from '../south/south-rest/south-rest';
import SouthSFTP from '../south/south-sftp/south-sftp';
import SouthFTP from '../south/south-ftp/south-ftp';
import SouthSQLite from '../south/south-sqlite/south-sqlite';
import {
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

// Mock all dependencies
jest.mock('pino');
jest.mock('../south/south-ads/south-ads');
jest.mock('../south/south-folder-scanner/south-folder-scanner');
jest.mock('../south/south-modbus/south-modbus');
jest.mock('../south/south-mqtt/south-mqtt');
jest.mock('../south/south-mssql/south-mssql');
jest.mock('../south/south-mysql/south-mysql');
jest.mock('../south/south-odbc/south-odbc');
jest.mock('../south/south-oianalytics/south-oianalytics');
jest.mock('../south/south-oledb/south-oledb');
jest.mock('../south/south-opc/south-opc');
jest.mock('../south/south-opcua/south-opcua');
jest.mock('../south/south-oracle/south-oracle');
jest.mock('../south/south-pi/south-pi');
jest.mock('../south/south-postgresql/south-postgresql');
jest.mock('../south/south-sftp/south-sftp');
jest.mock('../south/south-ftp/south-ftp');
jest.mock('../south/south-sqlite/south-sqlite');
jest.mock('../south/south-rest/south-rest');

describe('buildSouth', () => {
  const mockLogger = {} as pino.Logger;
  const mockAddContent = jest.fn() as (southId: string, data: OIBusContent) => Promise<void>;
  const mockSouthCacheFolder = '/tmp/cache';
  const mockSouthCacheRepository = {} as SouthCacheRepository;
  const mockCertificateRepository = {} as CertificateRepository;
  const mockOIAnalyticsRegistrationRepository = {} as OIAnalyticsRegistrationRepository;

  const baseSettings = {
    id: 'test-id',
    name: 'test-name',
    description: 'test-description',
    enabled: true,
    items: []
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create SouthADS for type "ads"', () => {
    const settings: SouthConnectorEntity<SouthADSSettings, SouthADSItemSettings> = {
      ...baseSettings,
      type: 'ads',
      settings: {} as SouthADSSettings
    };
    const result = buildSouth(
      settings,
      mockAddContent,
      mockLogger,
      mockSouthCacheFolder,
      mockSouthCacheRepository,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(SouthADS).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(SouthADS);
  });

  it('should create SouthFolderScanner for type "folder-scanner"', () => {
    const settings: SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings> = {
      ...baseSettings,
      type: 'folder-scanner',
      settings: {} as SouthFolderScannerSettings
    };
    const result = buildSouth(
      settings,
      mockAddContent,
      mockLogger,
      mockSouthCacheFolder,
      mockSouthCacheRepository,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(SouthFolderScanner).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(SouthFolderScanner);
  });

  it('should create SouthModbus for type "modbus"', () => {
    const settings: SouthConnectorEntity<SouthModbusSettings, SouthModbusItemSettings> = {
      ...baseSettings,
      type: 'modbus',
      settings: {} as SouthModbusSettings
    };
    const result = buildSouth(
      settings,
      mockAddContent,
      mockLogger,
      mockSouthCacheFolder,
      mockSouthCacheRepository,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(SouthModbus).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(SouthModbus);
  });

  it('should create SouthMQTT for type "mqtt"', () => {
    const settings: SouthConnectorEntity<SouthMQTTSettings, SouthMQTTItemSettings> = {
      ...baseSettings,
      type: 'mqtt',
      settings: {} as SouthMQTTSettings
    };
    const result = buildSouth(
      settings,
      mockAddContent,
      mockLogger,
      mockSouthCacheFolder,
      mockSouthCacheRepository,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(SouthMQTT).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(SouthMQTT);
  });

  it('should create SouthMSSQL for type "mssql"', () => {
    const settings: SouthConnectorEntity<SouthMSSQLSettings, SouthMSSQLItemSettings> = {
      ...baseSettings,
      type: 'mssql',
      settings: {} as SouthMSSQLSettings
    };
    const result = buildSouth(
      settings,
      mockAddContent,
      mockLogger,
      mockSouthCacheFolder,
      mockSouthCacheRepository,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(SouthMSSQL).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(SouthMSSQL);
  });

  it('should create SouthMySQL for type "mysql"', () => {
    const settings: SouthConnectorEntity<SouthMySQLSettings, SouthMySQLItemSettings> = {
      ...baseSettings,
      type: 'mysql',
      settings: {} as SouthMySQLSettings
    };
    const result = buildSouth(
      settings,
      mockAddContent,
      mockLogger,
      mockSouthCacheFolder,
      mockSouthCacheRepository,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(SouthMySQL).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(SouthMySQL);
  });

  it('should create SouthODBC for type "odbc"', () => {
    const settings: SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings> = {
      ...baseSettings,
      type: 'odbc',
      settings: {} as SouthODBCSettings
    };
    const result = buildSouth(
      settings,
      mockAddContent,
      mockLogger,
      mockSouthCacheFolder,
      mockSouthCacheRepository,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(SouthODBC).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(SouthODBC);
  });

  it('should create SouthOIAnalytics for type "oianalytics"', () => {
    const settings: SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings> = {
      ...baseSettings,
      type: 'oianalytics',
      settings: {} as SouthOIAnalyticsSettings
    };
    const result = buildSouth(
      settings,
      mockAddContent,
      mockLogger,
      mockSouthCacheFolder,
      mockSouthCacheRepository,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(SouthOIAnalytics).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(SouthOIAnalytics);
  });

  it('should create SouthOLEDB for type "oledb"', () => {
    const settings: SouthConnectorEntity<SouthOLEDBSettings, SouthOLEDBItemSettings> = {
      ...baseSettings,
      type: 'oledb',
      settings: {} as SouthOLEDBSettings
    };
    const result = buildSouth(
      settings,
      mockAddContent,
      mockLogger,
      mockSouthCacheFolder,
      mockSouthCacheRepository,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(SouthOLEDB).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(SouthOLEDB);
  });

  it('should create SouthOPC for type "opc"', () => {
    const settings: SouthConnectorEntity<SouthOPCSettings, SouthOPCItemSettings> = {
      ...baseSettings,
      type: 'opc',
      settings: {} as SouthOPCSettings
    };
    const result = buildSouth(
      settings,
      mockAddContent,
      mockLogger,
      mockSouthCacheFolder,
      mockSouthCacheRepository,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(SouthOPC).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(SouthOPC);
  });

  it('should create SouthOPCUA for type "opcua"', () => {
    const settings: SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings> = {
      ...baseSettings,
      type: 'opcua',
      settings: {} as SouthOPCUASettings
    };
    const result = buildSouth(
      settings,
      mockAddContent,
      mockLogger,
      mockSouthCacheFolder,
      mockSouthCacheRepository,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(SouthOPCUA).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(SouthOPCUA);
  });

  it('should create SouthOracle for type "oracle"', () => {
    const settings: SouthConnectorEntity<SouthOracleSettings, SouthOracleItemSettings> = {
      ...baseSettings,
      type: 'oracle',
      settings: {} as SouthOracleSettings
    };
    const result = buildSouth(
      settings,
      mockAddContent,
      mockLogger,
      mockSouthCacheFolder,
      mockSouthCacheRepository,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(SouthOracle).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(SouthOracle);
  });

  it('should create SouthPI for type "osisoft-pi"', () => {
    const settings: SouthConnectorEntity<SouthPISettings, SouthPIItemSettings> = {
      ...baseSettings,
      type: 'osisoft-pi',
      settings: {} as SouthPISettings
    };
    const result = buildSouth(
      settings,
      mockAddContent,
      mockLogger,
      mockSouthCacheFolder,
      mockSouthCacheRepository,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(SouthPI).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(SouthPI);
  });

  it('should create SouthPostgreSQL for type "postgresql"', () => {
    const settings: SouthConnectorEntity<SouthPostgreSQLSettings, SouthPostgreSQLItemSettings> = {
      ...baseSettings,
      type: 'postgresql',
      settings: {} as SouthPostgreSQLSettings
    };
    const result = buildSouth(
      settings,
      mockAddContent,
      mockLogger,
      mockSouthCacheFolder,
      mockSouthCacheRepository,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(SouthPostgreSQL).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(SouthPostgreSQL);
  });

  it('should create SouthRestAPI for type "rest-api"', () => {
    const settings: SouthConnectorEntity<SouthRestSettings, SouthRestItemSettings> = {
      ...baseSettings,
      type: 'rest',
      settings: {} as SouthRestSettings
    };
    const result = buildSouth(
      settings,
      mockAddContent,
      mockLogger,
      mockSouthCacheFolder,
      mockSouthCacheRepository,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(SouthRestAPI).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(SouthRestAPI);
  });

  it('should create SouthSFTP for type "sftp"', () => {
    const settings: SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings> = {
      ...baseSettings,
      type: 'sftp',
      settings: {} as SouthSFTPSettings
    };
    const result = buildSouth(
      settings,
      mockAddContent,
      mockLogger,
      mockSouthCacheFolder,
      mockSouthCacheRepository,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(SouthSFTP).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(SouthSFTP);
  });

  it('should create SouthFTP for type "ftp"', () => {
    const settings: SouthConnectorEntity<SouthFTPSettings, SouthFTPItemSettings> = {
      ...baseSettings,
      type: 'ftp',
      settings: {} as SouthFTPSettings
    };
    const result = buildSouth(
      settings,
      mockAddContent,
      mockLogger,
      mockSouthCacheFolder,
      mockSouthCacheRepository,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(SouthFTP).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(SouthFTP);
  });

  it('should create SouthSQLite for type "sqlite"', () => {
    const settings: SouthConnectorEntity<SouthSQLiteSettings, SouthSQLiteItemSettings> = {
      ...baseSettings,
      type: 'sqlite',
      settings: {} as SouthSQLiteSettings
    };
    const result = buildSouth(
      settings,
      mockAddContent,
      mockLogger,
      mockSouthCacheFolder,
      mockSouthCacheRepository,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(SouthSQLite).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(SouthSQLite);
  });

  it('should throw an error for unknown type', () => {
    const settings = {
      ...baseSettings,
      type: 'unknown' as const,
      settings: {}
    } as unknown as SouthConnectorEntity<SouthSettings, SouthItemSettings>;
    expect(() =>
      buildSouth(
        settings,
        mockAddContent,
        mockLogger,
        mockSouthCacheFolder,
        mockSouthCacheRepository,
        mockCertificateRepository,
        mockOIAnalyticsRegistrationRepository
      )
    ).toThrow(`South connector of type "unknown" not installed`);
  });
});
