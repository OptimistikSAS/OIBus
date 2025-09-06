import { encryptionService } from './encryption.service';
import pino from 'pino';

// South imports
import {
  OIBusSouthType,
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemSearchParam,
  SouthConnectorItemTestingSettings,
  SouthConnectorLightDTO,
  SouthConnectorManifest
} from '../../shared/model/south-connector.model';

import oianalyticsManifest from '../south/south-oianalytics/manifest';
import opcuaManifest from '../south/south-opcua/manifest';
import mqttManifest from '../south/south-mqtt/manifest';
import modbusManifest from '../south/south-modbus/manifest';
import folderScannerManifest from '../south/south-folder-scanner/manifest';
import adsManifest from '../south/south-ads/manifest';
import mssqlManifest from '../south/south-mssql/manifest';
import mysqlManifest from '../south/south-mysql/manifest';
import postgresqlManifest from '../south/south-postgresql/manifest';
import oracleManifest from '../south/south-oracle/manifest';
import odbcManifest from '../south/south-odbc/manifest';
import sqliteManifest from '../south/south-sqlite/manifest';
import opcManifest from '../south/south-opc/manifest';
import oledbManifest from '../south/south-oledb/manifest';
import piManifest from '../south/south-pi/manifest';
import sftpManifest from '../south/south-sftp/manifest';
import ftpManifest from '../south/south-ftp/manifest';
import { OIBusContent } from '../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorEntityLight, SouthConnectorItemEntity } from '../model/south-connector.model';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import LogRepository from '../repository/logs/log.repository';
import SouthConnectorMetricsRepository from '../repository/metrics/south-connector-metrics.repository';
import { Page } from '../../shared/model/types';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import { checkScanMode, stringToBoolean } from './utils';
import { ScanMode } from '../model/scan-mode.model';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import fs from 'node:fs/promises';
import csv from 'papaparse';
import multer from '@koa/multer';

import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import CertificateRepository from '../repository/config/certificate.repository';
import DataStreamEngine from '../engine/data-stream-engine';
import { PassThrough } from 'node:stream';
import { OIBusObjectAttribute } from '../../shared/model/form.model';
import { toScanModeDTO } from './scan-mode.service';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { buildSouth } from '../south/south-connector-factory';

export const southManifestList: Array<SouthConnectorManifest> = [
  folderScannerManifest,
  mqttManifest,
  opcuaManifest,
  opcManifest,
  mssqlManifest,
  mysqlManifest,
  odbcManifest,
  oledbManifest,
  oracleManifest,
  postgresqlManifest,
  sqliteManifest,
  adsManifest,
  modbusManifest,
  oianalyticsManifest,
  piManifest,
  sftpManifest,
  ftpManifest
];

export default class SouthService {
  constructor(
    private readonly validator: JoiValidator,
    private readonly southConnectorRepository: SouthConnectorRepository,
    private readonly logRepository: LogRepository,
    private readonly southMetricsRepository: SouthConnectorMetricsRepository,
    private readonly southCacheRepository: SouthCacheRepository,
    private readonly scanModeRepository: ScanModeRepository,
    private readonly oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository,
    private readonly certificateRepository: CertificateRepository,
    private readonly oIAnalyticsMessageService: OIAnalyticsMessageService,
    private readonly engine: DataStreamEngine
  ) {}

  async testSouth(id: string, southType: OIBusSouthType, settingsToTest: SouthSettings, logger: pino.Logger): Promise<void> {
    let southConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> | null = null;
    if (id !== 'create') {
      southConnector = this.southConnectorRepository.findSouthById(id);
      if (!southConnector) {
        throw new Error(`South connector "${id}" not found`);
      }
    }
    const manifest = this.getInstalledSouthManifests().find(southManifest => southManifest.id === southType);
    if (!manifest) {
      throw new Error(`South manifest "${southType}" not found`);
    }
    await this.validator.validateSettings(manifest.settings, settingsToTest);

    const testToRun: SouthConnectorEntity<SouthSettings, SouthItemSettings> = {
      id: southConnector?.id || 'test',
      type: southType,
      description: '',
      enabled: false,
      settings: await encryptionService.encryptConnectorSecrets(settingsToTest, southConnector?.settings || null, manifest.settings),
      name: southConnector ? southConnector.name : `${southType}:test-connection`,
      items: []
    };

    /* istanbul ignore next */
    const mockedAddContent = async (_southId: string, _content: OIBusContent): Promise<void> => Promise.resolve();
    const south = buildSouth(
      testToRun,
      mockedAddContent,
      logger,
      '',
      this.southCacheRepository,
      this.certificateRepository,
      this.oIAnalyticsRegistrationRepository
    );
    return await south.testConnection();
  }

  async testSouthItem(
    id: string,
    southType: OIBusSouthType,
    southSettings: SouthSettings,
    itemSettings: SouthItemSettings,
    testingSettings: SouthConnectorItemTestingSettings,
    callback: (data: OIBusContent) => void,
    logger: pino.Logger
  ): Promise<void> {
    let southConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> | null = null;
    if (id !== 'create') {
      southConnector = this.southConnectorRepository.findSouthById(id);
      if (!southConnector) {
        throw new Error(`South connector "${id}" not found`);
      }
    }
    const manifest = this.getInstalledSouthManifests().find(southManifest => southManifest.id === southType);
    if (!manifest) {
      throw new Error(`South manifest "${southType}" not found`);
    }
    await this.validator.validateSettings(manifest.settings, southSettings);
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    await this.validator.validateSettings(itemSettingsManifest, itemSettings);

    const testItemToRun: SouthConnectorItemEntity<SouthItemSettings> = {
      id: 'test',
      enabled: false,
      name: 'testing',
      scanMode: {
        id: '',
        name: '',
        description: '',
        cron: ''
      },
      settings: await encryptionService.encryptConnectorSecrets(itemSettings, null, itemSettingsManifest)
    };
    const testConnectorToRun: SouthConnectorEntity<SouthSettings, SouthItemSettings> = {
      id: southConnector?.id || 'test',
      type: southType,
      enabled: false,
      description: '',
      settings: await encryptionService.encryptConnectorSecrets(southSettings, southConnector?.settings || null, manifest.settings),
      name: southConnector ? southConnector.name : `${southType}:test-connection`,
      items: [testItemToRun]
    };

    /* istanbul ignore next */
    const mockedAddContent = async (_southId: string, _content: OIBusContent): Promise<void> => Promise.resolve();
    const south = buildSouth(
      testConnectorToRun,
      mockedAddContent,
      logger,
      '',
      this.southCacheRepository,
      this.certificateRepository,
      this.oIAnalyticsRegistrationRepository
    );
    return await south.testItem(testItemToRun, testingSettings, callback);
  }

  findById<S extends SouthSettings, I extends SouthItemSettings>(southId: string): SouthConnectorEntity<S, I> | null {
    return this.southConnectorRepository.findSouthById(southId);
  }

  findAll(): Array<SouthConnectorEntityLight> {
    return this.southConnectorRepository.findAllSouth();
  }

  getInstalledSouthManifests(): Array<SouthConnectorManifest> {
    return southManifestList;
  }

  async createSouth<S extends SouthSettings, I extends SouthItemSettings>(
    command: SouthConnectorCommandDTO<S, I>,
    retrieveSecretsFromSouth: string | null
  ): Promise<SouthConnectorEntity<S, I>> {
    const manifest = this.getInstalledSouthManifests().find(southManifest => southManifest.id === command.type);
    if (!manifest) {
      throw new Error(`South manifest does not exist for type "${command.type}"`);
    }
    await this.validator.validateSettings(manifest.settings, command.settings);
    // Check if item settings match the item schema, throw an error otherwise
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    for (const item of command.items) {
      await this.validator.validateSettings(itemSettingsManifest, item.settings);
    }

    const southEntity = {} as SouthConnectorEntity<S, I>;
    await copySouthConnectorCommandToSouthEntity(
      southEntity,
      command,
      this.retrieveSecretsFromSouth(retrieveSecretsFromSouth, manifest),
      this.scanModeRepository.findAll(),
      !!retrieveSecretsFromSouth
    );
    this.southConnectorRepository.saveSouthConnector(southEntity);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.createSouth(southEntity.id);
    if (southEntity.enabled) {
      await this.engine.startSouth(southEntity.id);
    }
    return southEntity;
  }

  getSouthDataStream(southConnectorId: string): PassThrough | null {
    return this.engine.getSouthDataStream(southConnectorId);
  }

  async updateSouth<S extends SouthSettings, I extends SouthItemSettings>(
    southConnectorId: string,
    command: SouthConnectorCommandDTO<S, I>
  ) {
    const previousSettings = this.southConnectorRepository.findSouthById<S, I>(southConnectorId);
    if (!previousSettings) {
      throw new Error(`South connector ${southConnectorId} does not exist`);
    }
    const manifest = this.getInstalledSouthManifests().find(southManifest => southManifest.id === command.type);
    if (!manifest) {
      throw new Error(`South manifest does not exist for type ${command.type}`);
    }
    await this.validator.validateSettings(manifest.settings, command.settings);

    const southEntity = { id: previousSettings.id } as SouthConnectorEntity<S, I>;
    await copySouthConnectorCommandToSouthEntity(southEntity, command, previousSettings, this.scanModeRepository.findAll());
    this.southConnectorRepository.saveSouthConnector(southEntity);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouth(southEntity);
  }

  async deleteSouth(southConnectorId: string): Promise<void> {
    const southConnector = this.southConnectorRepository.findSouthById(southConnectorId);
    if (!southConnector) {
      throw new Error(`South connector ${southConnectorId} does not exist`);
    }

    await this.engine.deleteSouth(southConnector);
    this.southConnectorRepository.deleteSouth(southConnector.id);
    this.logRepository.deleteLogsByScopeId('south', southConnector.id);
    this.southMetricsRepository.removeMetrics(southConnector.id);
    this.southCacheRepository.deleteAllBySouthConnector(southConnector.id);

    this.engine.updateNorthSubscriptions(southConnector.id); // Do this once it has been removed from the database to properly reload the subscription list
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();

    this.engine.logger.info(`Deleted South connector "${southConnector.name}" (${southConnector.id})`);
  }

  async startSouth(southConnectorId: string): Promise<void> {
    const southConnector = this.southConnectorRepository.findSouthById(southConnectorId);
    if (!southConnector) {
      throw new Error(`South connector "${southConnectorId}" does not exist`);
    }

    this.southConnectorRepository.start(southConnector.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.startSouth(southConnector.id);
  }

  async stopSouth(southConnectorId: string): Promise<void> {
    const southConnector = this.southConnectorRepository.findSouthById(southConnectorId);
    if (!southConnector) {
      throw new Error(`South connector "${southConnectorId}" does not exist`);
    }

    this.southConnectorRepository.stop(southConnector.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.stopSouth(southConnector.id);
  }

  getSouthItems(southId: string): Array<SouthConnectorItemEntity<SouthItemSettings>> {
    return this.southConnectorRepository.findAllItemsForSouth(southId);
  }

  searchSouthItems(southId: string, searchParams: SouthConnectorItemSearchParam): Page<SouthConnectorItemEntity<SouthItemSettings>> {
    return this.southConnectorRepository.searchItems(southId, searchParams);
  }

  findSouthConnectorItemById(southConnectorId: string, itemId: string): SouthConnectorItemEntity<SouthItemSettings> | null {
    return this.southConnectorRepository.findItemById(southConnectorId, itemId);
  }

  async createItem(
    southConnectorId: string,
    command: SouthConnectorItemCommandDTO<SouthItemSettings>
  ): Promise<SouthConnectorItemEntity<SouthItemSettings>> {
    const southConnector = this.southConnectorRepository.findSouthById(southConnectorId);
    if (!southConnector) {
      throw new Error(`South connector "${southConnectorId}" does not exist`);
    }
    const manifest = this.getInstalledSouthManifests().find(southManifest => southManifest.id === southConnector.type);
    if (!manifest) {
      throw new Error(`South manifest does not exist for type "${southConnector.type}"`);
    }
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    await this.validator.validateSettings(itemSettingsManifest, command.settings);

    const southItemEntity = {} as SouthConnectorItemEntity<SouthItemSettings>;
    await copySouthItemCommandToSouthItemEntity(southItemEntity, command, null, southConnector.type, this.scanModeRepository.findAll());
    this.southConnectorRepository.saveItem(southConnector.id, southItemEntity);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouthItems(southConnector);
    return southItemEntity;
  }

  async updateItem(southConnectorId: string, itemId: string, command: SouthConnectorItemCommandDTO<SouthItemSettings>): Promise<void> {
    const previousSettings = this.southConnectorRepository.findItemById(southConnectorId, itemId);
    if (!previousSettings) {
      throw new Error(`South item with ID "${itemId}" does not exist`);
    }
    const southConnector = this.southConnectorRepository.findSouthById(southConnectorId)!;
    const manifest = this.getInstalledSouthManifests().find(southManifest => southManifest.id === southConnector.type);
    if (!manifest) {
      throw new Error(`South manifest does not exist for type "${southConnector.type}"`);
    }

    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    await this.validator.validateSettings(itemSettingsManifest, command.settings);

    const southItemEntity = { id: previousSettings.id } as SouthConnectorItemEntity<SouthItemSettings>;
    await copySouthItemCommandToSouthItemEntity(
      southItemEntity,
      command,
      previousSettings,
      southConnector.type,
      this.scanModeRepository.findAll()
    );
    this.southConnectorRepository.saveItem(southConnectorId, southItemEntity);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouthItems(southConnector);
  }

  async deleteItem(southConnectorId: string, itemId: string): Promise<void> {
    const southConnector = this.southConnectorRepository.findSouthById(southConnectorId);
    if (!southConnector) {
      throw new Error(`South connector "${southConnectorId}" does not exist`);
    }
    const southItem = this.southConnectorRepository.findItemById(southConnectorId, itemId);
    if (!southItem) throw new Error(`South item "${itemId}" not found`);
    this.southConnectorRepository.deleteItem(southItem.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouthItems(southConnector);
  }

  async deleteAllItemsForSouthConnector(southConnectorId: string): Promise<void> {
    const southConnector = this.southConnectorRepository.findSouthById(southConnectorId);
    if (!southConnector) {
      throw new Error(`South connector "${southConnectorId}" does not exist`);
    }
    this.southConnectorRepository.deleteAllItemsBySouth(southConnectorId);
    this.southCacheRepository.deleteAllBySouthConnector(southConnectorId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouthItems(southConnector);
  }

  async enableItem(southConnectorId: string, itemId: string): Promise<void> {
    const southConnector = this.southConnectorRepository.findSouthById(southConnectorId);
    if (!southConnector) {
      throw new Error(`South connector "${southConnectorId}" does not exist`);
    }
    const southItem = this.southConnectorRepository.findItemById(southConnectorId, itemId);
    if (!southItem) {
      throw new Error(`South item "${itemId}" not found`);
    }
    this.southConnectorRepository.enableItem(southItem.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouthItems(southConnector);
  }

  async disableItem(southConnectorId: string, itemId: string): Promise<void> {
    const southConnector = this.southConnectorRepository.findSouthById(southConnectorId);
    if (!southConnector) {
      throw new Error(`South connector "${southConnectorId}" does not exist`);
    }
    const southItem = this.southConnectorRepository.findItemById(southConnectorId, itemId);
    if (!southItem) {
      throw new Error(`South item "${itemId}" not found`);
    }
    this.southConnectorRepository.disableItem(southItem.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();

    await this.engine.reloadSouthItems(southConnector);
  }

  async checkCsvFileImport(
    southType: string,
    file: multer.File,
    delimiter: string,
    existingItems: multer.File
  ): Promise<{
    items: Array<SouthConnectorItemDTO<SouthItemSettings>>;
    errors: Array<{ item: Record<string, string>; error: string }>;
  }> {
    const fileContent = await fs.readFile(file.path);
    const existingItemsContent: Array<SouthConnectorItemDTO<SouthItemSettings>> = JSON.parse(
      (await fs.readFile(existingItems.path)).toString('utf8')
    );
    return await this.checkCsvContentImport(southType, fileContent.toString('utf8'), delimiter, existingItemsContent);
  }

  async checkCsvContentImport(
    southType: string,
    fileContent: string,
    delimiter: string,
    existingItems: Array<SouthConnectorItemDTO<SouthItemSettings>>
  ): Promise<{
    items: Array<SouthConnectorItemDTO<SouthItemSettings>>;
    errors: Array<{ item: Record<string, string>; error: string }>;
  }> {
    const manifest = this.getInstalledSouthManifests().find(southManifest => southManifest.id === southType);
    if (!manifest) {
      throw new Error(`South manifest does not exist for type "${southType}"`);
    }

    const csvContent = csv.parse(fileContent, { header: true, delimiter, skipEmptyLines: true });
    if (csvContent.meta.delimiter !== delimiter) {
      throw new Error(`The entered delimiter "${delimiter}" does not correspond to the file delimiter "${csvContent.meta.delimiter}"`);
    }
    const scanModes = this.scanModeRepository.findAll();

    const validItems: Array<SouthConnectorItemDTO<SouthItemSettings>> = [];
    const errors: Array<{ item: Record<string, string>; error: string }> = [];
    for (const data of csvContent.data) {
      const foundScanMode = scanModes.find(scanMode => scanMode.name === (data as Record<string, string>).scanMode);
      if (!foundScanMode) {
        errors.push({
          item: data as Record<string, string>,
          error: `Scan mode "${(data as Record<string, string>).scanMode}" not found for item "${(data as Record<string, string>).name}"`
        });
        continue;
      }
      const item: SouthConnectorItemDTO<SouthItemSettings> = {
        id: '',
        name: (data as Record<string, string>).name,
        enabled: stringToBoolean((data as Record<string, string>).enabled),
        scanMode: foundScanMode,
        settings: {} as SouthItemSettings
      };
      if (existingItems.find(existingItem => existingItem.name === item.name)) {
        errors.push({
          item: data as Record<string, string>,
          error: `Item name "${(data as unknown as Record<string, string>).name}" already used`
        });
        continue;
      }

      let hasSettingsError = false;
      const settings: Record<string, string | object | boolean> = {};
      const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
        attribute => attribute.key === 'settings'
      )! as OIBusObjectAttribute;
      for (const [key, value] of Object.entries(data as unknown as Record<string, string>)) {
        if (key.startsWith('settings_')) {
          const settingsKey = key.replace('settings_', '');
          const manifestSettings = itemSettingsManifest.attributes.find(settings => settings.key === settingsKey);
          if (!manifestSettings) {
            hasSettingsError = true;
            errors.push({
              item: data as Record<string, string>,
              error: `Settings "${settingsKey}" not accepted in manifest`
            });
            break;
          }
          if ((manifestSettings.type === 'array' || manifestSettings.type === 'object') && value) {
            settings[settingsKey] = JSON.parse(value as string);
          } else if (manifestSettings.type === 'boolean') {
            settings[settingsKey] = stringToBoolean(value);
          } else {
            settings[settingsKey] = value;
          }
        }
      }
      if (hasSettingsError) continue;
      item.settings = settings as unknown as SouthItemSettings;

      try {
        await this.validator.validateSettings(itemSettingsManifest, item.settings);
        validItems.push(item);
      } catch (itemError: unknown) {
        errors.push({ item: data as Record<string, string>, error: (itemError as Error).message });
      }
    }
    return { items: validItems, errors };
  }

  async importItems(
    southConnectorId: string,
    items: Array<SouthConnectorItemCommandDTO<SouthItemSettings>>,
    deleteItemsNotPresent = false
  ) {
    const southConnector = this.southConnectorRepository.findSouthById(southConnectorId);
    if (!southConnector) {
      throw new Error(`South connector "${southConnectorId}" does not exist`);
    }
    const manifest = this.getInstalledSouthManifests().find(southManifest => southManifest.id === southConnector.type)!;
    const itemsToAdd: Array<SouthConnectorItemEntity<SouthItemSettings>> = [];
    const scanModes = this.scanModeRepository.findAll();
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    for (const itemCommand of items) {
      await this.validator.validateSettings(itemSettingsManifest, itemCommand.settings);
      const southItemEntity = {} as SouthConnectorItemEntity<SouthItemSettings>;
      await copySouthItemCommandToSouthItemEntity(southItemEntity, itemCommand, null, southConnector.type, scanModes);
      itemsToAdd.push(southItemEntity);
    }

    this.southConnectorRepository.saveAllItems(southConnector.id, itemsToAdd, deleteItemsNotPresent);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouthItems(southConnector);
  }

  retrieveSecretsFromSouth(
    retrieveSecretsFromSouth: string | null,
    manifest: SouthConnectorManifest
  ): SouthConnectorEntity<SouthSettings, SouthItemSettings> | null {
    if (!retrieveSecretsFromSouth) return null;
    const source = this.southConnectorRepository.findSouthById(retrieveSecretsFromSouth);
    if (!source) {
      throw new Error(`Could not find South connector "${retrieveSecretsFromSouth}" to retrieve secrets from`);
    }
    if (source.type !== manifest.id) {
      throw new Error(`South connector "${retrieveSecretsFromSouth}" (type "${source.type}") must be of the type "${manifest.id}"`);
    }
    return source;
  }
}

export const toSouthConnectorLightDTO = (entity: SouthConnectorEntityLight): SouthConnectorLightDTO => {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    description: entity.description,
    enabled: entity.enabled
  };
};

const copySouthConnectorCommandToSouthEntity = async <S extends SouthSettings, I extends SouthItemSettings>(
  southEntity: SouthConnectorEntity<S, I>,
  command: SouthConnectorCommandDTO<S, I>,
  currentSettings: SouthConnectorEntity<S, I> | null,
  scanModes: Array<ScanMode>,
  retrieveSecretsFromSouth = false
): Promise<void> => {
  const manifest = southManifestList.find(element => element.id === command.type)!;
  southEntity.name = command.name;
  southEntity.type = command.type;
  southEntity.description = command.description;
  southEntity.enabled = command.enabled;
  southEntity.settings = await encryptionService.encryptConnectorSecrets<S>(
    command.settings,
    currentSettings?.settings || null,
    manifest.settings
  );
  southEntity.items = await Promise.all(
    command.items.map(async itemCommand => {
      const itemEntity = {} as SouthConnectorItemEntity<I>;
      await copySouthItemCommandToSouthItemEntity(
        itemEntity,
        itemCommand,
        currentSettings?.items.find(element => element.id === itemCommand.id) || null,
        southEntity.type,
        scanModes,
        retrieveSecretsFromSouth
      );
      return itemEntity;
    })
  );
};

const copySouthItemCommandToSouthItemEntity = async <I extends SouthItemSettings>(
  southItemEntity: SouthConnectorItemEntity<I>,
  command: SouthConnectorItemCommandDTO<I>,
  currentSettings: SouthConnectorItemEntity<I> | null,
  southType: string,
  scanModes: Array<ScanMode>,
  retrieveSecretsFromSouth = false
): Promise<void> => {
  const manifest = southManifestList.find(element => element.id === southType)!;
  const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
    attribute => attribute.key === 'settings'
  )! as OIBusObjectAttribute;
  southItemEntity.id = retrieveSecretsFromSouth ? '' : command.id || ''; // reset id if it is a copy from another connector
  southItemEntity.name = command.name;
  southItemEntity.enabled = command.enabled;
  southItemEntity.scanMode = checkScanMode(scanModes, command.scanModeId, command.scanModeName);
  southItemEntity.settings = await encryptionService.encryptConnectorSecrets<I>(
    command.settings,
    currentSettings?.settings || null,
    itemSettingsManifest
  );
};

export const toSouthConnectorDTO = <S extends SouthSettings, I extends SouthItemSettings>(
  southEntity: SouthConnectorEntity<S, I>
): SouthConnectorDTO<S, I> => {
  const manifest = southManifestList.find(element => element.id === southEntity.type)!;
  return {
    id: southEntity.id,
    name: southEntity.name,
    type: southEntity.type,
    description: southEntity.description,
    enabled: southEntity.enabled,
    settings: encryptionService.filterSecrets<S>(southEntity.settings, manifest.settings),
    items: southEntity.items.map(item => toSouthConnectorItemDTO<I>(item, southEntity.type))
  };
};

export const toSouthConnectorItemDTO = <I extends SouthItemSettings>(
  entity: SouthConnectorItemEntity<I>,
  southType: string
): SouthConnectorItemDTO<I> => {
  const manifest = southManifestList.find(element => element.id === southType)!;
  const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
    attribute => attribute.key === 'settings'
  )! as OIBusObjectAttribute;
  return {
    id: entity.id,
    name: entity.name,
    enabled: entity.enabled,
    scanMode: toScanModeDTO(entity.scanMode),
    settings: encryptionService.filterSecrets<I>(entity.settings, itemSettingsManifest)
  };
};
