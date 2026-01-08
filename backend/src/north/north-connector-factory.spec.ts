import pino from 'pino';
import { buildNorth } from './north-connector-factory';
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from 'src/repository/config/oianalytics-registration.repository';
import NorthAmazonS3 from './north-amazon-s3/north-amazon-s3';
import NorthAzureBlob from './north-azure-blob/north-azure-blob';
import NorthConsole from './north-console/north-console';
import NorthFileWriter from './north-file-writer/north-file-writer';
import NorthModbus from './north-modbus/north-modbus';
import NorthMQTT from './north-mqtt/north-mqtt';
import NorthOIAnalytics from './north-oianalytics/north-oianalytics';
import NorthREST from './north-rest/north-rest';
import NorthOPCUA from './north-opcua/north-opcua';
import NorthSFTP from './north-sftp/north-sftp';
import {
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
import { NorthConnectorEntity } from '../model/north-connector.model';

// Mock all dependencies
jest.mock('pino');
jest.mock('./north-amazon-s3/north-amazon-s3');
jest.mock('./north-azure-blob/north-azure-blob');
jest.mock('./north-console/north-console');
jest.mock('./north-file-writer/north-file-writer');
jest.mock('./north-modbus/north-modbus');
jest.mock('./north-mqtt/north-mqtt');
jest.mock('./north-oianalytics/north-oianalytics');
jest.mock('./north-rest/north-rest');
jest.mock('./north-opcua/north-opcua');
jest.mock('./north-sftp/north-sftp');
jest.mock('../service/cache/cache.service');

describe('buildNorth', () => {
  const mockLogger = {} as pino.Logger;
  const mockCacheFolder = '/tmp/cache';
  const mockErrorFolder = '/tmp/error';
  const mockArchiveFolder = '/tmp/archive';
  const mockCertificateRepository = {} as CertificateRepository;
  const mockOIAnalyticsRegistrationRepository = {} as OIAnalyticsRegistrationRepository;

  const baseSettings = {
    id: 'test-id',
    name: 'test-name',
    type: 'aws-s3' as const,
    description: 'test-description',
    enabled: true,
    settings: {},
    caching: {
      trigger: {
        scanMode: { id: 'manual', name: 'Manual', description: '', cron: '' },
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create NorthAmazonS3 for type "aws-s3"', () => {
    const settings: NorthConnectorEntity<NorthAmazonS3Settings> = {
      ...baseSettings,
      type: 'aws-s3',
      settings: {} as NorthAmazonS3Settings
    };
    const result = buildNorth(
      settings,
      mockLogger,
      mockCacheFolder,
      mockErrorFolder,
      mockArchiveFolder,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(NorthAmazonS3).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(NorthAmazonS3);
  });

  it('should create NorthAzureBlob for type "azure-blob"', () => {
    const settings: NorthConnectorEntity<NorthAzureBlobSettings> = {
      ...baseSettings,
      type: 'azure-blob',
      settings: {} as NorthAzureBlobSettings
    };
    const result = buildNorth(
      settings,
      mockLogger,
      mockCacheFolder,
      mockErrorFolder,
      mockArchiveFolder,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(NorthAzureBlob).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(NorthAzureBlob);
  });

  it('should create NorthConsole for type "console"', () => {
    const settings: NorthConnectorEntity<NorthConsoleSettings> = {
      ...baseSettings,
      type: 'console',
      settings: {} as NorthConsoleSettings
    };
    const result = buildNorth(
      settings,
      mockLogger,
      mockCacheFolder,
      mockErrorFolder,
      mockArchiveFolder,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(NorthConsole).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(NorthConsole);
  });

  it('should create NorthFileWriter for type "file-writer"', () => {
    const settings: NorthConnectorEntity<NorthFileWriterSettings> = {
      ...baseSettings,
      type: 'file-writer',
      settings: {} as NorthFileWriterSettings
    };
    const result = buildNorth(
      settings,
      mockLogger,
      mockCacheFolder,
      mockErrorFolder,
      mockArchiveFolder,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(NorthFileWriter).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(NorthFileWriter);
  });

  it('should create NorthModbus for type "modbus"', () => {
    const settings: NorthConnectorEntity<NorthModbusSettings> = {
      ...baseSettings,
      type: 'modbus',
      settings: {} as NorthModbusSettings
    };
    const result = buildNorth(
      settings,
      mockLogger,
      mockCacheFolder,
      mockErrorFolder,
      mockArchiveFolder,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(NorthModbus).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(NorthModbus);
  });

  it('should create NorthMQTT for type "mqtt"', () => {
    const settings: NorthConnectorEntity<NorthMQTTSettings> = {
      ...baseSettings,
      type: 'mqtt',
      settings: {} as NorthMQTTSettings
    };
    const result = buildNorth(
      settings,
      mockLogger,
      mockCacheFolder,
      mockErrorFolder,
      mockArchiveFolder,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(NorthMQTT).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(NorthMQTT);
  });

  it('should create NorthOIAnalytics for type "oianalytics"', () => {
    const settings: NorthConnectorEntity<NorthOIAnalyticsSettings> = {
      ...baseSettings,
      type: 'oianalytics',
      settings: {} as NorthOIAnalyticsSettings
    };
    const result = buildNorth(
      settings,
      mockLogger,
      mockCacheFolder,
      mockErrorFolder,
      mockArchiveFolder,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(NorthOIAnalytics).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(NorthOIAnalytics);
  });

  it('should create NorthOPCUA for type "opcua"', () => {
    const settings: NorthConnectorEntity<NorthOPCUASettings> = {
      ...baseSettings,
      type: 'opcua',
      settings: {} as NorthOPCUASettings
    };
    const result = buildNorth(
      settings,
      mockLogger,
      mockCacheFolder,
      mockErrorFolder,
      mockArchiveFolder,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(NorthOPCUA).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(NorthOPCUA);
  });

  it('should create NorthREST for type "rest"', () => {
    const settings: NorthConnectorEntity<NorthRESTSettings> = {
      ...baseSettings,
      type: 'rest',
      settings: {} as NorthRESTSettings
    };
    const result = buildNorth(
      settings,
      mockLogger,
      mockCacheFolder,
      mockErrorFolder,
      mockArchiveFolder,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(NorthREST).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(NorthREST);
  });

  it('should create NorthSFTP for type "sftp"', () => {
    const settings: NorthConnectorEntity<NorthSFTPSettings> = {
      ...baseSettings,
      type: 'sftp',
      settings: {} as NorthSFTPSettings
    };
    const result = buildNorth(
      settings,
      mockLogger,
      mockCacheFolder,
      mockErrorFolder,
      mockArchiveFolder,
      mockCertificateRepository,
      mockOIAnalyticsRegistrationRepository
    );
    expect(NorthSFTP).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(NorthSFTP);
  });

  it('should throw an error for unknown type', () => {
    const settings = {
      ...baseSettings,
      type: 'unknown' as const,
      settings: {}
    } as unknown as NorthConnectorEntity<NorthSettings>;
    expect(() =>
      buildNorth(
        settings,
        mockLogger,
        mockCacheFolder,
        mockErrorFolder,
        mockArchiveFolder,
        mockCertificateRepository,
        mockOIAnalyticsRegistrationRepository
      )
    ).toThrow(`North connector of type "unknown" not installed`);
  });
});
