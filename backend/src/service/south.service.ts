import { encryptionService } from './encryption.service';

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
import restApiManifest from '../south/south-rest-api/manifest';
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
import csv from 'papaparse';

import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import CertificateRepository from '../repository/config/certificate.repository';
import DataStreamEngine from '../engine/data-stream-engine';
import { PassThrough } from 'node:stream';
import { OIBusObjectAttribute } from '../../shared/model/form.model';
import { toScanModeDTO } from './scan-mode.service';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { buildSouth } from '../south/south-connector-factory';
import { NotFoundError, OIBusValidationError } from '../model/types';

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
  restApiManifest,
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

  listManifest(): Array<SouthConnectorManifest> {
    return southManifestList;
  }

  getManifest(type: string): SouthConnectorManifest {
    const manifest = southManifestList.find(element => element.id === type);
    if (!manifest) {
      throw new NotFoundError(`South manifest "${type}" not found`);
    }
    return manifest;
  }

  list(): Array<SouthConnectorEntityLight> {
    return this.southConnectorRepository.findAllSouth();
  }

  findById(southId: string): SouthConnectorEntity<SouthSettings, SouthItemSettings> {
    const south = this.southConnectorRepository.findSouthById(southId);
    if (!south) {
      throw new NotFoundError(`South "${southId}" not found`);
    }
    return south;
  }

  async create(
    command: SouthConnectorCommandDTO,
    retrieveSecretsFromSouth: string | null
  ): Promise<SouthConnectorEntity<SouthSettings, SouthItemSettings>> {
    const manifest = this.getManifest(command.type);
    await this.validator.validateSettings(manifest.settings, command.settings);

    // Check for unique name
    const existingSouths = this.southConnectorRepository.findAllSouth();
    if (existingSouths.some(south => south.name === command.name)) {
      throw new OIBusValidationError(`South connector name "${command.name}" already exists`);
    }

    // Check if item settings match the item schema, throw an error otherwise
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    for (const item of command.items) {
      await this.validator.validateSettings(itemSettingsManifest, item.settings);
      item.id = null;
    }

    const southEntity = {} as SouthConnectorEntity<SouthSettings, SouthItemSettings>;
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

  async update(southId: string, command: SouthConnectorCommandDTO) {
    const previousSettings = this.findById(southId);
    const manifest = this.getManifest(command.type);
    await this.validator.validateSettings(manifest.settings, command.settings);

    // Check for unique name (excluding current entity)
    if (command.name !== previousSettings.name) {
      const existingSouths = this.southConnectorRepository.findAllSouth();
      if (existingSouths.some(south => south.id !== southId && south.name === command.name)) {
        throw new OIBusValidationError(`South connector name "${command.name}" already exists`);
      }
    }

    // Check if item settings match the item schema, throw an error otherwise
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    for (const item of command.items) {
      await this.validator.validateSettings(itemSettingsManifest, item.settings);
    }

    const southEntity = { id: previousSettings.id } as SouthConnectorEntity<SouthSettings, SouthItemSettings>;
    await copySouthConnectorCommandToSouthEntity(southEntity, command, previousSettings, this.scanModeRepository.findAll());
    this.southConnectorRepository.saveSouthConnector(southEntity);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouth(southEntity);
  }

  async delete(southId: string): Promise<void> {
    const southConnector = this.findById(southId);
    await this.engine.deleteSouth(southConnector);
    this.southConnectorRepository.deleteSouth(southConnector.id);
    this.logRepository.deleteLogsByScopeId('south', southConnector.id);
    this.southMetricsRepository.removeMetrics(southConnector.id);
    this.southCacheRepository.deleteAllBySouthConnector(southConnector.id);
    this.engine.updateNorthSubscriptions(southConnector.id); // Do this once it has been removed from the database to properly reload the subscription list
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();

    this.engine.logger.info(`Deleted South connector "${southConnector.name}" (${southConnector.id})`);
  }

  async start(southId: string): Promise<void> {
    const southConnector = this.findById(southId);
    this.southConnectorRepository.start(southConnector.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.startSouth(southConnector.id);
  }

  async stop(southId: string): Promise<void> {
    const southConnector = this.findById(southId);
    this.southConnectorRepository.stop(southConnector.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.stopSouth(southConnector.id);
  }

  getSouthDataStream(southId: string): PassThrough | null {
    return this.engine.getSouthDataStream(southId);
  }

  async testSouth(southId: string, southType: OIBusSouthType, settingsToTest: SouthSettings): Promise<void> {
    let southConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> | null = null;
    if (southId !== 'create' && southId !== 'history') {
      southConnector = this.findById(southId);
    }
    const manifest = this.getManifest(southType);
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
      this.engine.logger.child(
        {
          scopeType: 'south',
          scopeId: 'test',
          scopeName: 'test'
        },
        { level: 'silent' }
      ),
      '',
      this.southCacheRepository,
      this.certificateRepository,
      this.oIAnalyticsRegistrationRepository
    );
    return await south.testConnection();
  }

  async testItem(
    southId: string,
    southType: OIBusSouthType,
    itemName: string,
    southSettings: SouthSettings,
    itemSettings: SouthItemSettings,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<OIBusContent> {
    let southConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> | null = null;
    if (southId !== 'create' && southId !== 'history') {
      southConnector = this.findById(southId);
    }
    const manifest = this.getManifest(southType);
    await this.validator.validateSettings(manifest.settings, southSettings);
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    await this.validator.validateSettings(itemSettingsManifest, itemSettings);

    const testItemToRun: SouthConnectorItemEntity<SouthItemSettings> = {
      id: 'test',
      enabled: false,
      name: itemName,
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
      this.engine.logger.child(
        {
          scopeType: 'south',
          scopeId: 'test',
          scopeName: 'test'
        },
        { level: 'silent' }
      ),
      '',
      this.southCacheRepository,
      this.certificateRepository,
      this.oIAnalyticsRegistrationRepository
    );
    return await south.testItem(testItemToRun, testingSettings);
  }

  listItems(southId: string): Array<SouthConnectorItemEntity<SouthItemSettings>> {
    return this.southConnectorRepository.findAllItemsForSouth(southId);
  }

  searchItems(southId: string, searchParams: SouthConnectorItemSearchParam): Page<SouthConnectorItemEntity<SouthItemSettings>> {
    return this.southConnectorRepository.searchItems(southId, searchParams);
  }

  findItemById(southId: string, itemId: string): SouthConnectorItemEntity<SouthItemSettings> {
    const item = this.southConnectorRepository.findItemById(southId, itemId);
    if (!item) {
      throw new NotFoundError(`Item "${itemId}" not found`);
    }
    return item;
  }

  async createItem(southId: string, command: SouthConnectorItemCommandDTO): Promise<SouthConnectorItemEntity<SouthItemSettings>> {
    const southConnector = this.findById(southId);
    const manifest = this.getManifest(southConnector.type);
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

  async updateItem(southId: string, itemId: string, command: SouthConnectorItemCommandDTO): Promise<void> {
    const southConnector = this.findById(southId)!;
    const existingItem = this.findItemById(southId, itemId);
    const manifest = this.getManifest(southConnector.type);
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    await this.validator.validateSettings(itemSettingsManifest, command.settings);

    const southItemEntity = { id: existingItem.id } as SouthConnectorItemEntity<SouthItemSettings>;
    await copySouthItemCommandToSouthItemEntity(
      southItemEntity,
      command,
      existingItem,
      southConnector.type,
      this.scanModeRepository.findAll()
    );
    this.southConnectorRepository.saveItem(southId, southItemEntity);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouthItems(southConnector);
  }

  async enableItem(southId: string, itemId: string): Promise<void> {
    const southConnector = this.findById(southId)!;
    const southItem = this.findItemById(southId, itemId);
    this.southConnectorRepository.enableItem(southItem.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouthItems(southConnector);
  }

  async disableItem(southId: string, itemId: string): Promise<void> {
    const southConnector = this.findById(southId)!;
    const southItem = this.findItemById(southId, itemId);
    this.southConnectorRepository.disableItem(southItem.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouthItems(southConnector);
  }

  async enableItems(southId: string, itemIds: Array<string>): Promise<void> {
    const southConnector = this.findById(southId);
    for (const itemId of itemIds) {
      const southItem = this.findItemById(southId, itemId);
      this.southConnectorRepository.enableItem(southItem.id);
    }
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouthItems(southConnector);
  }

  async deleteItem(southId: string, itemId: string): Promise<void> {
    const southConnector = this.findById(southId)!;
    const southItem = this.findItemById(southId, itemId);
    this.southConnectorRepository.deleteItem(southItem.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouthItems(southConnector);
  }

  async disableItems(southId: string, itemIds: Array<string>): Promise<void> {
    const southConnector = this.findById(southId);

    for (const itemId of itemIds) {
      const southItem = this.findItemById(southId, itemId);
      this.southConnectorRepository.disableItem(southItem.id);
    }
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouthItems(southConnector);
  }

  async deleteItems(southId: string, itemIds: Array<string>): Promise<void> {
    const southConnector = this.findById(southId);
    for (const itemId of itemIds) {
      const southItem = this.findItemById(southId, itemId);
      this.southConnectorRepository.deleteItem(southItem.id);
    }
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouthItems(southConnector);
  }

  async deleteAllItems(southId: string): Promise<void> {
    const southConnector = this.findById(southId)!;
    this.southConnectorRepository.deleteAllItemsBySouth(southId);
    this.southCacheRepository.deleteAllBySouthConnector(southId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouthItems(southConnector);
  }

  async checkImportItems(
    southType: string,
    fileContent: string,
    delimiter: string,
    existingItems: Array<SouthConnectorItemDTO>
  ): Promise<{
    items: Array<SouthConnectorItemDTO>;
    errors: Array<{ item: Record<string, string>; error: string }>;
  }> {
    const manifest = this.getManifest(southType);
    const csvContent = csv.parse(fileContent, { header: true, delimiter, skipEmptyLines: true });
    if (csvContent.meta.delimiter !== delimiter) {
      throw new OIBusValidationError(
        `The entered delimiter "${delimiter}" does not correspond to the file delimiter "${csvContent.meta.delimiter}"`
      );
    }
    const scanModes = this.scanModeRepository.findAll();

    const validItems: Array<SouthConnectorItemDTO> = [];
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
      const item = {
        id: '',
        name: (data as Record<string, string>).name,
        enabled: stringToBoolean((data as Record<string, string>).enabled),
        scanMode: foundScanMode,
        settings: {} as SouthItemSettings
      } as SouthConnectorItemDTO;
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

  async importItems(southId: string, items: Array<SouthConnectorItemCommandDTO>, deleteItemsNotPresent = false) {
    const southConnector = this.findById(southId);
    const manifest = this.getManifest(southConnector.type);
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
    if (!retrieveSecretsFromSouth) {
      return null;
    }
    const source = this.findById(retrieveSecretsFromSouth);
    if (source.type !== manifest.id) {
      throw new OIBusValidationError(
        `South connector "${retrieveSecretsFromSouth}" (type "${source.type}") must be of the type "${manifest.id}"`
      );
    }
    return source;
  }
}

const copySouthConnectorCommandToSouthEntity = async (
  southEntity: SouthConnectorEntity<SouthSettings, SouthItemSettings>,
  command: SouthConnectorCommandDTO,
  currentSettings: SouthConnectorEntity<SouthSettings, SouthItemSettings> | null,
  scanModes: Array<ScanMode>,
  retrieveSecretsFromSouth = false
): Promise<void> => {
  const manifest = southManifestList.find(element => element.id === command.type)!;
  southEntity.name = command.name;
  southEntity.type = command.type;
  southEntity.description = command.description;
  southEntity.enabled = command.enabled;
  southEntity.settings = await encryptionService.encryptConnectorSecrets(
    command.settings,
    currentSettings?.settings || null,
    manifest.settings
  );
  southEntity.items = await Promise.all(
    command.items.map(async itemCommand => {
      const itemEntity = {} as SouthConnectorItemEntity<SouthItemSettings>;
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

const copySouthItemCommandToSouthItemEntity = async (
  southItemEntity: SouthConnectorItemEntity<SouthItemSettings>,
  command: SouthConnectorItemCommandDTO,
  currentSettings: SouthConnectorItemEntity<SouthItemSettings> | null,
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
  southItemEntity.settings = await encryptionService.encryptConnectorSecrets(
    command.settings,
    currentSettings?.settings || null,
    itemSettingsManifest
  );
};

export const toSouthConnectorLightDTO = (entity: SouthConnectorEntityLight): SouthConnectorLightDTO => {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    description: entity.description,
    enabled: entity.enabled
  };
};

export const toSouthConnectorDTO = (southEntity: SouthConnectorEntity<SouthSettings, SouthItemSettings>): SouthConnectorDTO => {
  const manifest = southManifestList.find(element => element.id === southEntity.type)!;
  const items = southEntity.items.map(item => toSouthConnectorItemDTO(item, southEntity.type));
  const baseDTO = {
    id: southEntity.id,
    name: southEntity.name,
    type: southEntity.type,
    description: southEntity.description,
    enabled: southEntity.enabled,
    settings: encryptionService.filterSecrets(southEntity.settings, manifest.settings),
    items
  };
  // Type assertion is safe because we know the type field matches the settings and items at runtime
  return baseDTO as SouthConnectorDTO;
};

export const toSouthConnectorItemDTO = (entity: SouthConnectorItemEntity<SouthItemSettings>, southType: string): SouthConnectorItemDTO => {
  const manifest = southManifestList.find(element => element.id === southType)!;
  const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
    attribute => attribute.key === 'settings'
  )! as OIBusObjectAttribute;
  return {
    id: entity.id,
    name: entity.name,
    enabled: entity.enabled,
    scanMode: toScanModeDTO(entity.scanMode),
    settings: encryptionService.filterSecrets(entity.settings, itemSettingsManifest)
  } as SouthConnectorItemDTO;
};
