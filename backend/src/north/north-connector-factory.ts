import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from 'src/repository/config/oianalytics-registration.repository';
import CacheService from '../service/cache/cache.service';
import type { ICacheService } from '../model/cache.service.model';
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
import { createFolder } from '../service/utils';
import path from 'node:path';
import fs from 'node:fs/promises';
import { OIBusNorthType } from '../../shared/model/north-connector.model';
import { CONTENT_FOLDER, METADATA_FOLDER } from '../model/engine.model';
import type { ILogger } from '../model/logger.model';

export const buildNorth = (
  settings: NorthConnectorEntity<NorthSettings>,
  logger: ILogger,
  certificateRepository: CertificateRepository,
  oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository,
  orchestrator: ICacheService
): NorthConnector<NorthSettings> => {
  switch (settings.type) {
    case 'aws-s3':
      return new NorthAmazonS3(settings as NorthConnectorEntity<NorthAmazonS3Settings>, logger, orchestrator);
    case 'azure-blob':
      return new NorthAzureBlob(settings as NorthConnectorEntity<NorthAzureBlobSettings>, logger, orchestrator);
    case 'console':
      return new NorthConsole(settings as NorthConnectorEntity<NorthConsoleSettings>, logger, orchestrator);
    case 'file-writer':
      return new NorthFileWriter(settings as NorthConnectorEntity<NorthFileWriterSettings>, logger, orchestrator);
    case 'modbus':
      return new NorthModbus(settings as NorthConnectorEntity<NorthModbusSettings>, logger, orchestrator);
    case 'mqtt':
      return new NorthMQTT(settings as NorthConnectorEntity<NorthMQTTSettings>, logger, orchestrator);
    case 'oianalytics':
      return new NorthOIAnalytics(
        settings as NorthConnectorEntity<NorthOIAnalyticsSettings>,
        logger,
        orchestrator,
        certificateRepository,
        oIAnalyticsRegistrationRepository
      );
    case 'opcua':
      return new NorthOPCUA(settings as NorthConnectorEntity<NorthOPCUASettings>, logger, orchestrator);
    case 'rest':
      return new NorthREST(settings as NorthConnectorEntity<NorthRESTSettings>, logger, orchestrator);
    case 'sftp':
      return new NorthSFTP(settings as NorthConnectorEntity<NorthSFTPSettings>, logger, orchestrator);
    default:
      throw Error(`North connector of type "${settings.type}" not installed`);
  }
};

export const initNorthCache = async (id: string, type: OIBusNorthType, baseFolder: string) => {
  await createFolder(path.join(baseFolder, 'cache', `north-${id}`));
  await createFolder(path.join(baseFolder, 'cache', `north-${id}`, METADATA_FOLDER));
  await createFolder(path.join(baseFolder, 'cache', `north-${id}`, CONTENT_FOLDER));
  await createFolder(path.join(baseFolder, 'cache', `north-${id}`, 'tmp'));
  if (type === 'opcua') {
    await createFolder(path.join(baseFolder, 'cache', `north-${id}`, 'opcua'));
  }

  await createFolder(path.join(baseFolder, 'error', `north-${id}`));
  await createFolder(path.join(baseFolder, 'error', `north-${id}`, METADATA_FOLDER));
  await createFolder(path.join(baseFolder, 'error', `north-${id}`, CONTENT_FOLDER));

  await createFolder(path.join(baseFolder, 'archive', `north-${id}`));
  await createFolder(path.join(baseFolder, 'archive', `north-${id}`, METADATA_FOLDER));
  await createFolder(path.join(baseFolder, 'archive', `north-${id}`, CONTENT_FOLDER));
};

export const deleteNorthCache = async (id: string, baseFolder: string) => {
  await fs.rm(path.join(baseFolder, 'cache', `north-${id}`), { recursive: true, force: true });
  await fs.rm(path.join(baseFolder, 'error', `north-${id}`), { recursive: true, force: true });
  await fs.rm(path.join(baseFolder, 'archive', `north-${id}`), { recursive: true, force: true });
};

export const createNorthOrchestrator = (baseFolder: string, id: string, logger: ILogger): ICacheService => {
  return new CacheService(
    logger,
    path.join(baseFolder, 'cache', `north-${id}`),
    path.join(baseFolder, 'error', `north-${id}`),
    path.join(baseFolder, 'archive', `north-${id}`)
  );
};
