import pino from 'pino';
import { buildNorth, createNorthOrchestrator, deleteNorthCache, initNorthCache } from './north-connector-factory';
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from 'src/repository/config/oianalytics-registration.repository';
import CacheService from '../service/cache/cache.service';
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
import fs from 'node:fs/promises';
import { createFolder } from '../service/utils';
import path from 'node:path';
import { CONTENT_FOLDER, METADATA_FOLDER } from '../model/engine.model';

// Mock all dependencies
jest.mock('node:fs/promises');
jest.mock('../service/utils');
jest.mock('../service/cache/cache.service');
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

describe('North Connector Factory', () => {
  const mockLogger = {} as pino.Logger;
  const mockCertificateRepository = {} as CertificateRepository;
  const mockOIAnalyticsRegistrationRepository = {} as OIAnalyticsRegistrationRepository;
  const mockOrchestrator = {} as CacheService;

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

  describe('buildNorth', () => {
    it('should create NorthAmazonS3 for type "aws-s3"', () => {
      const settings: NorthConnectorEntity<NorthAmazonS3Settings> = {
        ...baseSettings,
        type: 'aws-s3',
        settings: {} as NorthAmazonS3Settings
      };
      const result = buildNorth(settings, mockLogger, mockCertificateRepository, mockOIAnalyticsRegistrationRepository, mockOrchestrator);
      expect(NorthAmazonS3).toHaveBeenCalledWith(settings, mockLogger, mockOrchestrator);
      expect(result).toBeInstanceOf(NorthAmazonS3);
    });

    it('should create NorthAzureBlob for type "azure-blob"', () => {
      const settings: NorthConnectorEntity<NorthAzureBlobSettings> = {
        ...baseSettings,
        type: 'azure-blob',
        settings: {} as NorthAzureBlobSettings
      };
      const result = buildNorth(settings, mockLogger, mockCertificateRepository, mockOIAnalyticsRegistrationRepository, mockOrchestrator);
      expect(NorthAzureBlob).toHaveBeenCalledWith(settings, mockLogger, mockOrchestrator);
      expect(result).toBeInstanceOf(NorthAzureBlob);
    });

    it('should create NorthConsole for type "console"', () => {
      const settings: NorthConnectorEntity<NorthConsoleSettings> = {
        ...baseSettings,
        type: 'console',
        settings: {} as NorthConsoleSettings
      };
      const result = buildNorth(settings, mockLogger, mockCertificateRepository, mockOIAnalyticsRegistrationRepository, mockOrchestrator);
      expect(NorthConsole).toHaveBeenCalledWith(settings, mockLogger, mockOrchestrator);
      expect(result).toBeInstanceOf(NorthConsole);
    });

    it('should create NorthFileWriter for type "file-writer"', () => {
      const settings: NorthConnectorEntity<NorthFileWriterSettings> = {
        ...baseSettings,
        type: 'file-writer',
        settings: {} as NorthFileWriterSettings
      };
      const result = buildNorth(settings, mockLogger, mockCertificateRepository, mockOIAnalyticsRegistrationRepository, mockOrchestrator);
      expect(NorthFileWriter).toHaveBeenCalledWith(settings, mockLogger, mockOrchestrator);
      expect(result).toBeInstanceOf(NorthFileWriter);
    });

    it('should create NorthModbus for type "modbus"', () => {
      const settings: NorthConnectorEntity<NorthModbusSettings> = {
        ...baseSettings,
        type: 'modbus',
        settings: {} as NorthModbusSettings
      };
      const result = buildNorth(settings, mockLogger, mockCertificateRepository, mockOIAnalyticsRegistrationRepository, mockOrchestrator);
      expect(NorthModbus).toHaveBeenCalledWith(settings, mockLogger, mockOrchestrator);
      expect(result).toBeInstanceOf(NorthModbus);
    });

    it('should create NorthMQTT for type "mqtt"', () => {
      const settings: NorthConnectorEntity<NorthMQTTSettings> = {
        ...baseSettings,
        type: 'mqtt',
        settings: {} as NorthMQTTSettings
      };
      const result = buildNorth(settings, mockLogger, mockCertificateRepository, mockOIAnalyticsRegistrationRepository, mockOrchestrator);
      expect(NorthMQTT).toHaveBeenCalledWith(settings, mockLogger, mockOrchestrator);
      expect(result).toBeInstanceOf(NorthMQTT);
    });

    it('should create NorthOIAnalytics for type "oianalytics"', () => {
      const settings: NorthConnectorEntity<NorthOIAnalyticsSettings> = {
        ...baseSettings,
        type: 'oianalytics',
        settings: {} as NorthOIAnalyticsSettings
      };
      const result = buildNorth(settings, mockLogger, mockCertificateRepository, mockOIAnalyticsRegistrationRepository, mockOrchestrator);
      expect(NorthOIAnalytics).toHaveBeenCalledWith(
        settings,
        mockLogger,
        mockOrchestrator,
        mockCertificateRepository,
        mockOIAnalyticsRegistrationRepository
      );
      expect(result).toBeInstanceOf(NorthOIAnalytics);
    });

    it('should create NorthOPCUA for type "opcua"', () => {
      const settings: NorthConnectorEntity<NorthOPCUASettings> = {
        ...baseSettings,
        type: 'opcua',
        settings: {} as NorthOPCUASettings
      };
      const result = buildNorth(settings, mockLogger, mockCertificateRepository, mockOIAnalyticsRegistrationRepository, mockOrchestrator);
      expect(NorthOPCUA).toHaveBeenCalledWith(settings, mockLogger, mockOrchestrator);
      expect(result).toBeInstanceOf(NorthOPCUA);
    });

    it('should create NorthREST for type "rest"', () => {
      const settings: NorthConnectorEntity<NorthRESTSettings> = {
        ...baseSettings,
        type: 'rest',
        settings: {} as NorthRESTSettings
      };
      const result = buildNorth(settings, mockLogger, mockCertificateRepository, mockOIAnalyticsRegistrationRepository, mockOrchestrator);
      expect(NorthREST).toHaveBeenCalledWith(settings, mockLogger, mockOrchestrator);
      expect(result).toBeInstanceOf(NorthREST);
    });

    it('should create NorthSFTP for type "sftp"', () => {
      const settings: NorthConnectorEntity<NorthSFTPSettings> = {
        ...baseSettings,
        type: 'sftp',
        settings: {} as NorthSFTPSettings
      };
      const result = buildNorth(settings, mockLogger, mockCertificateRepository, mockOIAnalyticsRegistrationRepository, mockOrchestrator);
      expect(NorthSFTP).toHaveBeenCalledWith(settings, mockLogger, mockOrchestrator);
      expect(result).toBeInstanceOf(NorthSFTP);
    });

    it('should throw an error for unknown type', () => {
      const settings = {
        ...baseSettings,
        type: 'unknown' as const,
        settings: {}
      } as unknown as NorthConnectorEntity<NorthSettings>;
      expect(() =>
        buildNorth(settings, mockLogger, mockCertificateRepository, mockOIAnalyticsRegistrationRepository, mockOrchestrator)
      ).toThrow(`North connector of type "unknown" not installed`);
    });
  });

  describe('initNorthCache', () => {
    const baseFolder = '/base';
    const id = 'connector-id';

    it('should create necessary folders for standard connector', async () => {
      await initNorthCache(id, 'file-writer', baseFolder);

      // Cache
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'cache', `north-${id}`));
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'cache', `north-${id}`, METADATA_FOLDER));
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'cache', `north-${id}`, CONTENT_FOLDER));
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'cache', `north-${id}`, 'tmp'));

      // Error
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'error', `north-${id}`));
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'error', `north-${id}`, METADATA_FOLDER));
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'error', `north-${id}`, CONTENT_FOLDER));

      // Archive
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'archive', `north-${id}`));
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'archive', `north-${id}`, METADATA_FOLDER));
      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'archive', `north-${id}`, CONTENT_FOLDER));

      // Should NOT create opcua folder
      expect(createFolder).not.toHaveBeenCalledWith(path.join(baseFolder, 'cache', `north-${id}`, 'opcua'));
    });

    it('should create additional folder for opcua connector', async () => {
      await initNorthCache(id, 'opcua', baseFolder);

      expect(createFolder).toHaveBeenCalledWith(path.join(baseFolder, 'cache', `north-${id}`, 'opcua'));
    });
  });

  describe('deleteNorthCache', () => {
    const baseFolder = '/base';
    const id = 'connector-id';

    it('should remove cache, error and archive folders', async () => {
      await deleteNorthCache(id, baseFolder);

      expect(fs.rm).toHaveBeenCalledTimes(3);
      expect(fs.rm).toHaveBeenCalledWith(path.join(baseFolder, 'cache', `north-${id}`), { recursive: true, force: true });
      expect(fs.rm).toHaveBeenCalledWith(path.join(baseFolder, 'error', `north-${id}`), { recursive: true, force: true });
      expect(fs.rm).toHaveBeenCalledWith(path.join(baseFolder, 'archive', `north-${id}`), { recursive: true, force: true });
    });
  });

  describe('createNorthOrchestrator', () => {
    it('should create CacheService with correct paths', () => {
      const baseFolder = '/base';
      const id = 'test-id';

      const result = createNorthOrchestrator(baseFolder, id, mockLogger);

      expect(CacheService).toHaveBeenCalledWith(
        mockLogger,
        path.join(baseFolder, 'cache', `north-${id}`),
        path.join(baseFolder, 'error', `north-${id}`),
        path.join(baseFolder, 'archive', `north-${id}`)
      );
      expect(result).toBeInstanceOf(CacheService);
    });
  });
});
