import pino from 'pino';
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from 'src/repository/config/oianalytics-registration.repository';
import CacheService from '../service/cache/cache.service';
import NorthAmazonS3 from './north-amazon-s3/north-amazon-s3';
import { NorthConnectorEntity } from 'src/model/north-connector.model';
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
import NorthConnector from './north-connector';

export const buildNorth = (
  settings: NorthConnectorEntity<NorthSettings>,
  logger: pino.Logger,
  cacheFolder: string,
  errorFolder: string,
  archiveFolder: string,
  certificateRepository: CertificateRepository,
  oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository
): NorthConnector<NorthSettings> => {
  const cacheService = new CacheService(logger, cacheFolder, errorFolder, archiveFolder);
  switch (settings.type) {
    case 'aws-s3':
      return new NorthAmazonS3(settings as NorthConnectorEntity<NorthAmazonS3Settings>, logger, cacheFolder, cacheService);
    case 'azure-blob':
      return new NorthAzureBlob(settings as NorthConnectorEntity<NorthAzureBlobSettings>, logger, cacheFolder, cacheService);
    case 'console':
      return new NorthConsole(settings as NorthConnectorEntity<NorthConsoleSettings>, logger, cacheFolder, cacheService);
    case 'file-writer':
      return new NorthFileWriter(settings as NorthConnectorEntity<NorthFileWriterSettings>, logger, cacheFolder, cacheService);
    case 'modbus':
      return new NorthModbus(settings as NorthConnectorEntity<NorthModbusSettings>, logger, cacheFolder, cacheService);
    case 'mqtt':
      return new NorthMQTT(settings as NorthConnectorEntity<NorthMQTTSettings>, logger, cacheFolder, cacheService);
    case 'oianalytics':
      return new NorthOIAnalytics(
        settings as NorthConnectorEntity<NorthOIAnalyticsSettings>,
        logger,
        cacheFolder,
        cacheService,
        certificateRepository,
        oIAnalyticsRegistrationRepository
      );
    case 'opcua':
      return new NorthOPCUA(settings as NorthConnectorEntity<NorthOPCUASettings>, logger, cacheFolder, cacheService);
    case 'rest':
      return new NorthREST(settings as NorthConnectorEntity<NorthRESTSettings>, logger, cacheFolder, cacheService);
    case 'sftp':
      return new NorthSFTP(settings as NorthConnectorEntity<NorthSFTPSettings>, logger, cacheFolder, cacheService);
    default:
      throw Error(`North connector of type "${settings.type}" not installed`);
  }
};
