import fs from 'node:fs/promises';
import path from 'node:path';

import { OIBusNorthType } from '../../shared/model/connector/north-manifest.model';
import {
  NorthAmazonS3Settings,
  NorthAzureBlobSettings,
  NorthAzureDataExplorerSettings,
  NorthConsoleSettings,
  NorthFileWriterSettings,
  NorthModbusSettings,
  NorthMQTTSettings,
  NorthOIAnalyticsSettings,
  NorthOPCUASettings,
  NorthRESTSettings,
  NorthSettings,
  NorthSFTPSettings
} from '../../shared/model/connector/north-settings.model';

import type { ICacheService } from '../model/cache.service.model';
import { CONTENT_FOLDER, METADATA_FOLDER } from '../model/engine.model';
import { NorthConnectorEntity } from '../model/north-connector.model';
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import CacheService from '../service/cache/cache.service';
import { loggerService } from '../service/logger/logger.service';
import { createFolder } from '../service/utils';
import NorthAmazonS3 from './north-amazon-s3/north-amazon-s3';
import NorthAzureBlob from './north-azure-blob/north-azure-blob';
import NorthAzureDataExplorer from './north-azure-data-explorer/north-azure-data-explorer';
import NorthConnector from './north-connector';
import NorthConsole from './north-console/north-console';
import NorthFileWriter from './north-file-writer/north-file-writer';
import NorthModbus from './north-modbus/north-modbus';
import NorthMQTT from './north-mqtt/north-mqtt';
import NorthOIAnalytics from './north-oianalytics/north-oianalytics';
import NorthOPCUA from './north-opcua/north-opcua';
import NorthREST from './north-rest/north-rest';
import NorthSFTP from './north-sftp/north-sftp';

export const buildNorth = (
  settings: NorthConnectorEntity<NorthSettings>,
  certificateRepository: CertificateRepository,
  oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository,
  orchestrator: ICacheService
): NorthConnector<NorthSettings> => {
  switch (settings.type) {
    case 'aws-s3':
      return new NorthAmazonS3(settings as NorthConnectorEntity<NorthAmazonS3Settings>, orchestrator);
    case 'azure-blob':
      return new NorthAzureBlob(settings as NorthConnectorEntity<NorthAzureBlobSettings>, orchestrator);
    case 'azure-data-explorer':
      return new NorthAzureDataExplorer(
        settings as NorthConnectorEntity<NorthAzureDataExplorerSettings>,
        orchestrator,
        certificateRepository
      );
    case 'console':
      return new NorthConsole(settings as NorthConnectorEntity<NorthConsoleSettings>, orchestrator);
    case 'file-writer':
      return new NorthFileWriter(settings as NorthConnectorEntity<NorthFileWriterSettings>, orchestrator);
    case 'modbus':
      return new NorthModbus(settings as NorthConnectorEntity<NorthModbusSettings>, orchestrator);
    case 'mqtt':
      return new NorthMQTT(settings as NorthConnectorEntity<NorthMQTTSettings>, orchestrator);
    case 'oianalytics':
      return new NorthOIAnalytics(
        settings as NorthConnectorEntity<NorthOIAnalyticsSettings>,
        orchestrator,
        certificateRepository,
        oIAnalyticsRegistrationRepository
      );
    case 'opcua':
      return new NorthOPCUA(settings as NorthConnectorEntity<NorthOPCUASettings>, orchestrator);
    case 'rest':
      return new NorthREST(settings as NorthConnectorEntity<NorthRESTSettings>, orchestrator);
    case 'sftp':
      return new NorthSFTP(settings as NorthConnectorEntity<NorthSFTPSettings>, orchestrator);
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

export const createNorthOrchestrator = (baseFolder: string, id: string, name: string): ICacheService => {
  const logger = loggerService.createChildLogger('north', id, name);
  return new CacheService(
    logger,
    path.join(baseFolder, 'cache', `north-${id}`),
    path.join(baseFolder, 'error', `north-${id}`),
    path.join(baseFolder, 'archive', `north-${id}`)
  );
};
