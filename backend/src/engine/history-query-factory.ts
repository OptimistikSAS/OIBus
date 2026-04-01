import pino from 'pino';
import { OIBusContent } from '../../shared/model/engine.model';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from 'src/repository/config/oianalytics-registration.repository';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { Instant } from '../model/types';
import { NorthSettings } from '../../shared/model/north-settings.model';
import { createFolder } from '../service/utils';
import path from 'node:path';
import HistoryQuery from './history-query';
import { HistoryQueryEntity, HistoryQueryItemEntity } from '../model/histor-query.model';
import { buildNorth } from '../north/north-connector-factory';
import { buildSouth } from '../south/south-connector-factory';
import CacheService from '../service/cache/cache.service';
import { OIBusSouthType } from '../../shared/model/south-connector.model';
import { OIBusNorthType } from '../../shared/model/north-connector.model';
import fs from 'node:fs/promises';
import { CONTENT_FOLDER, METADATA_FOLDER } from '../model/engine.model';
import { SouthConnectorItemEntity } from '../model/south-connector.model';

export const buildHistoryQuery = (
  settings: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>,
  addContent: (
    southId: string,
    data: OIBusContent,
    queryTime: Instant,
    items: Array<HistoryQueryItemEntity<SouthItemSettings>>
  ) => Promise<void>,
  logger: pino.Logger,
  baseFolderPath: string,
  southCacheRepository: SouthCacheRepository,
  certificateRepository: CertificateRepository,
  oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository,
  orchestrator: CacheService
): HistoryQuery => {
  const north = buildNorth(
    {
      id: settings.id,
      name: settings.name,
      description: settings.description,
      enabled: settings.status === 'RUNNING',
      type: settings.northType,
      settings: settings.northSettings,
      caching: settings.caching,
      transformers: settings.northTransformers.map(element => ({
        id: element.id,
        transformer: element.transformer,
        options: element.options,
        items: element.items,
        source: {
          type: 'south',
          south: {
            id: settings.id,
            name: settings.name,
            type: settings.southType,
            description: settings.description,
            enabled: settings.status === 'RUNNING',
            createdBy: settings.createdBy,
            updatedBy: settings.updatedBy,
            createdAt: settings.createdAt,
            updatedAt: settings.updatedAt
          },
          items: element.items,
          group: undefined
        }
      })),
      createdBy: settings.createdBy,
      updatedBy: settings.updatedBy,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt
    },
    logger,
    certificateRepository,
    oIAnalyticsRegistrationRepository,
    orchestrator
  );
  const south = buildSouth(
    {
      id: settings.id,
      name: settings.name,
      description: settings.description,
      enabled: settings.status === 'RUNNING',
      type: settings.southType,
      settings: settings.southSettings,
      items: [],
      createdBy: settings.createdBy,
      updatedBy: settings.updatedBy,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt
    },
    async (historyId: string, data: OIBusContent, queryTime: Instant, items: Array<SouthConnectorItemEntity<SouthItemSettings>>) =>
      await north.cacheContent(data, { source: 'south', southId: settings.id, queryTime, items }),
    logger,
    path.join(baseFolderPath, 'cache', `history-${settings.id}`, 'south'),
    southCacheRepository,
    certificateRepository,
    oIAnalyticsRegistrationRepository
  );

  return new HistoryQuery(settings, north, south, logger);
};

export const initHistoryQueryCache = async (id: string, northType: OIBusNorthType, southType: OIBusSouthType, baseFolder: string) => {
  await createFolder(path.join(baseFolder, 'cache', `history-${id}`, 'north'));
  await createFolder(path.join(baseFolder, 'cache', `history-${id}`, 'north', METADATA_FOLDER));
  await createFolder(path.join(baseFolder, 'cache', `history-${id}`, 'north', CONTENT_FOLDER));
  await createFolder(path.join(baseFolder, 'cache', `history-${id}`, 'north', 'tmp'));
  if (northType === 'opcua') {
    await createFolder(path.join(baseFolder, 'cache', `history-${id}`, 'north', 'opcua'));
  }

  await createFolder(path.join(baseFolder, 'error', `history-${id}`, 'north'));
  await createFolder(path.join(baseFolder, 'error', `history-${id}`, 'north', METADATA_FOLDER));
  await createFolder(path.join(baseFolder, 'error', `history-${id}`, 'north', CONTENT_FOLDER));

  await createFolder(path.join(baseFolder, 'archive', `history-${id}`, 'north'));
  await createFolder(path.join(baseFolder, 'archive', `history-${id}`, 'north', METADATA_FOLDER));
  await createFolder(path.join(baseFolder, 'archive', `history-${id}`, 'north', CONTENT_FOLDER));

  await createFolder(path.join(baseFolder, 'cache', `history-${id}`, 'south'));
  await createFolder(path.join(baseFolder, 'cache', `history-${id}`, 'south', 'tmp'));
  if (southType === 'opcua') {
    await createFolder(path.join(baseFolder, 'cache', `history-${id}`, 'south', 'opcua'));
  }
};

export const createHistoryQueryOrchestrator = (baseFolder: string, historyId: string, logger: pino.Logger): CacheService => {
  return new CacheService(
    logger,
    path.join(baseFolder, 'cache', `history-${historyId}`, 'north'),
    path.join(baseFolder, 'error', `history-${historyId}`, 'north'),
    path.join(baseFolder, 'archive', `history-${historyId}`, 'north')
  );
};

export const deleteHistoryQueryCache = async (id: string, baseFolder: string) => {
  await fs.rm(path.join(baseFolder, 'cache', `history-${id}`), { recursive: true, force: true });
  await fs.rm(path.join(baseFolder, 'error', `history-${id}`), { recursive: true, force: true });
  await fs.rm(path.join(baseFolder, 'archive', `history-${id}`), { recursive: true, force: true });
};
