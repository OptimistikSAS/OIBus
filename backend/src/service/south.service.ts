import { encryptionService } from './encryption.service';

// South imports
import {
  ItemLightDTO,
  OIBusSouthType,
  SouthConnectorCommandDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemSearchParam,
  SouthConnectorItemTestingSettings,
  SouthConnectorItemTypedDTO,
  SouthConnectorLightDTO,
  SouthConnectorManifest,
  SouthConnectorTypedDTO,
  SouthItemGroupCommandDTO,
  SouthItemGroupDTO,
  SouthItemLastValue
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
import restManifest from '../south/south-rest/manifest';
import { OIBusConnectionTestResult, OIBusContent } from '../../shared/model/engine.model';
import {
  SouthConnectorEntity,
  SouthConnectorEntityLight,
  SouthConnectorItemEntity,
  SouthConnectorItemEntityLight,
  SouthItemGroupCommand,
  SouthItemGroupEntity,
  SouthItemGroupEntityLight
} from '../model/south-connector.model';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import LogRepository from '../repository/logs/log.repository';
import SouthConnectorMetricsRepository from '../repository/metrics/south-connector-metrics.repository';
import { GetUserInfo, Page } from '../../shared/model/types';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import SouthItemGroupRepository from '../repository/config/south-item-group.repository';
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
  restManifest,
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
    private readonly engine: DataStreamEngine,
    private readonly southItemGroupRepository: SouthItemGroupRepository
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
    retrieveSecretsFromSouth: string | null,
    createdBy: string
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

    // Create a minimal south entity first to get the ID, then create groups
    const southEntity = {} as SouthConnectorEntity<SouthSettings, SouthItemSettings>;
    southEntity.name = command.name;
    southEntity.type = command.type;
    southEntity.description = command.description;
    southEntity.enabled = command.enabled;
    southEntity.settings = await encryptionService.encryptConnectorSecrets(command.settings, null, manifest.settings);
    southEntity.items = [];

    // Save to get the ID
    this.southConnectorRepository.saveSouth(southEntity);

    // Create groups for unique groupNames
    const scanModes = this.scanModeRepository.findAll();
    const groupNameToIdMap = new Map<string, string>();
    const uniqueGroupNames = new Set<string>();

    for (const item of command.items) {
      if (item.groupName && item.groupName.trim()) {
        uniqueGroupNames.add(item.groupName.trim());
      }
    }

    // Create or find groups for each unique group name
    for (const groupName of uniqueGroupNames) {
      let group = this.southItemGroupRepository.findByNameAndSouthId(groupName, southEntity.id);
      if (!group) {
        // Find the scan mode to use - use the first item's scan mode that has this group
        const itemWithGroup = command.items.find(item => item.groupName === groupName);
        if (!itemWithGroup) continue;

        const scanMode = checkScanMode(scanModes, itemWithGroup.scanModeId, itemWithGroup.scanModeName);
        const groupEntity: SouthItemGroupCommand = {
          name: groupName,
          southId: southEntity.id,
          scanMode,
          overlap: null,
          maxReadInterval: null,
          readDelay: 0
        };
        group = this.southItemGroupRepository.create(groupEntity, createdBy);
      }
      groupNameToIdMap.set(groupName, group.id);
    }

    // Update item commands to use groupId instead of groupName
    const updatedCommand = {
      ...command,
      items: command.items.map(item => {
        if (item.groupName && groupNameToIdMap.has(item.groupName)) {
          return {
            ...item,
            groupId: groupNameToIdMap.get(item.groupName)!,
            groupName: null
          };
        }
        return item;
      })
    } as SouthConnectorCommandDTO;

    // Now process items with groups
    await copySouthConnectorCommandToSouthEntity(
      southEntity,
      updatedCommand,
      this.retrieveSecretsFromSouth(retrieveSecretsFromSouth, manifest),
      scanModes,
      !!retrieveSecretsFromSouth,
      this.southItemGroupRepository,
      southEntity.id,
      createdBy
    );
    southEntity.createdBy = createdBy;
    southEntity.updatedBy = createdBy;
    for (const item of southEntity.items) {
      item.createdBy = createdBy;
      item.updatedBy = createdBy;
    }

    // Save again with items and groups
    this.southConnectorRepository.saveSouth(southEntity);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.createSouth(southEntity.id);
    if (southEntity.enabled) {
      await this.engine.startSouth(southEntity.id);
    }
    return this.findById(southEntity.id);
  }

  async update(southId: string, command: SouthConnectorCommandDTO, updatedBy: string) {
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
    await copySouthConnectorCommandToSouthEntity(
      southEntity,
      command,
      previousSettings,
      this.scanModeRepository.findAll(),
      false,
      this.southItemGroupRepository,
      southId,
      updatedBy
    );
    southEntity.createdBy = previousSettings.createdBy;
    southEntity.updatedBy = updatedBy;
    for (const item of southEntity.items) {
      if (!item.id) {
        item.createdBy = updatedBy;
      }
      item.updatedBy = updatedBy;
    }
    this.southConnectorRepository.saveSouth(southEntity);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouth(southEntity);
  }

  async delete(southId: string): Promise<void> {
    const southConnector = this.findById(southId);
    await this.engine.deleteSouth(southConnector);
    this.southConnectorRepository.deleteSouth(southConnector.id);
    this.logRepository.deleteLogsByScopeId('south', southConnector.id);
    this.southMetricsRepository.removeMetrics(southConnector.id);
    this.southCacheRepository.dropItemValueTable(southConnector.id);
    this.engine.updateNorthTransformerBySouth(southConnector.id); // Do this once it has been removed from the database to properly reload the subscription list
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
    return this.engine.getSouthSSE(southId);
  }

  async testSouth(southId: string, southType: OIBusSouthType, settingsToTest: SouthSettings): Promise<OIBusConnectionTestResult> {
    let southConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> | null = null;
    if (southId !== 'create' && southId !== 'history') {
      southConnector = this.findById(southId);
    }
    const manifest = this.getManifest(southType);
    await this.validator.validateSettings(manifest.settings, settingsToTest);

    const testToRun: SouthConnectorEntity<SouthSettings, SouthItemSettings> = {
      id: 'test',
      type: southType,
      description: '',
      enabled: false,
      settings: await encryptionService.encryptConnectorSecrets(settingsToTest, southConnector?.settings || null, manifest.settings),
      name: southConnector ? southConnector.name : `${southType}:test-connection`,
      items: [] as Array<SouthConnectorItemEntity<SouthItemSettings>>,
      groups: [] as Array<SouthItemGroupEntityLight>,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
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
          scopeName: `${southType}:test-connection`
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
      group: null,
      syncWithGroup: false,
      scanMode: {
        id: '',
        name: '',
        description: '',
        cron: '',
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      },
      settings: await encryptionService.encryptConnectorSecrets(itemSettings, null, itemSettingsManifest),
      maxReadInterval: null,
      readDelay: 0,
      overlap: null,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    const testConnectorToRun: SouthConnectorEntity<SouthSettings, SouthItemSettings> = {
      id: 'test',
      type: southType,
      enabled: false,
      description: '',
      settings: await encryptionService.encryptConnectorSecrets(southSettings, southConnector?.settings || null, manifest.settings),
      name: `${southType}:test-connection`,
      items: [testItemToRun],
      groups: [] as Array<SouthItemGroupEntityLight>,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
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
          scopeName: `${southType}:test-connection`
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

  getItemLastValue(southId: string, itemId: string): SouthItemLastValue {
    // Verify south connector and item exist
    this.findById(southId);
    const item = this.findItemById(southId, itemId);

    // Get the last value from the cache
    const lastValue = this.southCacheRepository.getItemLastValue(southId, item.group?.id || null, itemId);

    return {
      groupId: item.group?.id || null,
      itemId,
      itemName: item.name,
      groupName: item.group?.name || '',
      queryTime: lastValue?.queryTime || null,
      value: lastValue?.value || null,
      trackedInstant: lastValue?.trackedInstant || null
    };
  }

  async createItem(
    southId: string,
    command: SouthConnectorItemCommandDTO,
    createdBy: string
  ): Promise<SouthConnectorItemEntity<SouthItemSettings>> {
    const southConnector = this.findById(southId);
    const manifest = this.getManifest(southConnector.type);
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    await this.validator.validateSettings(itemSettingsManifest, command.settings);

    const southItemEntity = {} as SouthConnectorItemEntity<SouthItemSettings>;
    await copySouthItemCommandToSouthItemEntity(
      southItemEntity,
      command,
      null,
      southConnector.type,
      this.scanModeRepository.findAll(),
      false,
      this.southItemGroupRepository,
      southId,
      createdBy
    );
    southItemEntity.createdBy = createdBy;
    southItemEntity.updatedBy = createdBy;
    this.southConnectorRepository.saveItem(southConnector.id, southItemEntity);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouthItems(southConnector);
    return southItemEntity;
  }

  async updateItem(southId: string, itemId: string, command: SouthConnectorItemCommandDTO, updatedBy: string): Promise<void> {
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
      this.scanModeRepository.findAll(),
      false,
      this.southItemGroupRepository,
      southId,
      updatedBy
    );
    southItemEntity.createdBy = existingItem.createdBy;
    southItemEntity.updatedBy = updatedBy;
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
    this.southConnectorRepository.deleteItem(southConnector.id, southItem.id);
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
      this.southConnectorRepository.deleteItem(southConnector.id, southItem.id);
    }
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouthItems(southConnector);
  }

  async deleteAllItems(southId: string): Promise<void> {
    const southConnector = this.findById(southId)!;
    this.southConnectorRepository.deleteAllItemsBySouth(southId);
    this.southCacheRepository.dropItemValueTable(southId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouthItems(southConnector);
  }

  async checkImportItems(
    southType: string,
    fileContent: string,
    delimiter: string,
    existingItems: Array<{ name: string }>
  ): Promise<{
    items: Array<SouthConnectorItemDTO>;
    errors: Array<{ item: Record<string, string>; error: string }>;
  }> {
    const manifest = this.getManifest(southType);
    const csvContent = csv.parse<Record<string, string>>(fileContent, { header: true, delimiter, skipEmptyLines: true });
    if (csvContent.meta.delimiter !== delimiter) {
      throw new OIBusValidationError(
        `The entered delimiter "${delimiter}" does not correspond to the file delimiter "${csvContent.meta.delimiter}"`
      );
    }
    const scanModes = this.scanModeRepository.findAll();

    const validItems: Array<SouthConnectorItemDTO> = [];
    const errors: Array<{ item: Record<string, string>; error: string }> = [];
    for (const data of csvContent.data) {
      const foundScanMode = scanModes.find(scanMode => scanMode.name === data.scanMode);
      if (!foundScanMode) {
        errors.push({
          item: data,
          error: `Scan mode "${data.scanMode}" not found for item "${data.name}"`
        });
        continue;
      }
      const scanMode = toScanModeDTO(foundScanMode, id => ({ id: id, friendlyName: '' }));

      const item: SouthConnectorItemDTO = {
        id: '',
        name: data.name,
        enabled: stringToBoolean(data.enabled),
        scanMode,
        settings: {} as SouthItemSettings,
        group: data.group ? ({ id: '', name: data.group } as SouthItemGroupDTO) : null,
        syncWithGroup: stringToBoolean(data.syncWithGroup),
        maxReadInterval: Number(data.maxReadInterval || '0'),
        readDelay: Number(data.readDelay || '0'),
        overlap: Number(data.overlap || '0')
      } as SouthConnectorItemDTO;

      if (existingItems.find(existingItem => existingItem.name === item.name)) {
        errors.push({
          item: data,
          error: `Item name "${data.name}" already used`
        });
        continue;
      }

      let hasSettingsError = false;
      const settings: Record<string, string | object | boolean | undefined> = {};
      const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
        attribute => attribute.key === 'settings'
      )! as OIBusObjectAttribute;
      for (const [key, value] of Object.entries(data)) {
        if (key.startsWith('settings_')) {
          const settingsKey = key.replace('settings_', '');
          const manifestSettings = itemSettingsManifest.attributes.find(settings => settings.key === settingsKey);
          if (!manifestSettings) {
            hasSettingsError = true;
            errors.push({
              item: data,
              error: `Settings "${settingsKey}" not accepted in manifest`
            });
            break;
          }
          if ((manifestSettings.type === 'array' || manifestSettings.type === 'object') && value) {
            settings[settingsKey] = JSON.parse(value);
          } else if (manifestSettings.type === 'boolean') {
            settings[settingsKey] = stringToBoolean(value);
          } else {
            settings[settingsKey] = value || undefined;
          }
        }
      }
      if (hasSettingsError) continue;
      item.settings = settings as unknown as SouthItemSettings;

      try {
        await this.validator.validateSettings(itemSettingsManifest, item.settings);
        validItems.push(item);
      } catch (itemError: unknown) {
        errors.push({ item: data, error: (itemError as Error).message });
      }
    }
    return { items: validItems, errors };
  }

  async importItems(southId: string, items: Array<SouthConnectorItemCommandDTO>, user: string, deleteItemsNotPresent = false) {
    const southConnector = this.findById(southId);
    const manifest = this.getManifest(southConnector.type);
    const itemsToAdd: Array<SouthConnectorItemEntity<SouthItemSettings>> = [];
    const scanModes = this.scanModeRepository.findAll();
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;

    // Collect unique group names and create/find groups
    const groupNameToIdMap = new Map<string, string>();
    const uniqueGroupNames = new Set<string>();

    for (const itemCommand of items) {
      if (itemCommand.groupName && itemCommand.groupName.trim()) {
        uniqueGroupNames.add(itemCommand.groupName.trim());
      }
    }

    // Create or find groups for each unique group name
    for (const groupName of uniqueGroupNames) {
      let group = this.southItemGroupRepository.findByNameAndSouthId(groupName, southId);
      if (!group) {
        // Find the scan mode to use - use the first item's scan mode that has this group
        const itemWithGroup = items.find(item => item.groupName === groupName);
        if (!itemWithGroup) continue;

        const scanMode = checkScanMode(scanModes, itemWithGroup.scanModeId, itemWithGroup.scanModeName);
        const groupEntity: SouthItemGroupCommand = {
          name: groupName,
          southId: southConnector.id,
          scanMode,
          overlap: null,
          maxReadInterval: null,
          readDelay: 0
        };
        group = this.southItemGroupRepository.create(groupEntity, user);
      }
      groupNameToIdMap.set(groupName, group.id);
    }

    // Update item commands to use groupId instead of groupName
    const updatedItems = items.map(itemCommand => {
      if (itemCommand.groupName && groupNameToIdMap.has(itemCommand.groupName)) {
        return {
          ...itemCommand,
          groupId: groupNameToIdMap.get(itemCommand.groupName)!,
          groupName: null
        };
      }
      return itemCommand;
    });

    for (const itemCommand of updatedItems) {
      await this.validator.validateSettings(itemSettingsManifest, itemCommand.settings);
      const southItemEntity = {} as SouthConnectorItemEntity<SouthItemSettings>;
      await copySouthItemCommandToSouthItemEntity(
        southItemEntity,
        itemCommand,
        null,
        southConnector.type,
        scanModes,
        false,
        this.southItemGroupRepository,
        null,
        user
      );
      southItemEntity.createdBy = user;
      southItemEntity.updatedBy = user;
      itemsToAdd.push(southItemEntity);
    }

    this.southConnectorRepository.saveAllItems(southConnector.id, itemsToAdd, deleteItemsNotPresent);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouthItems(southConnector);
  }

  getGroups(southId: string): Array<SouthItemGroupEntity> {
    this.findById(southId); // Verify south connector exists
    return this.southItemGroupRepository.findBySouthId(southId);
  }

  getGroup(southId: string, groupId: string): SouthItemGroupEntity {
    this.findById(southId); // Verify south connector exists
    const group = this.southItemGroupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError(`South item group "${groupId}" not found`);
    }
    if (group.southId !== southId) {
      throw new NotFoundError(`South item group "${groupId}" does not belong to south connector "${southId}"`);
    }
    return group;
  }

  createGroup(southId: string, command: SouthItemGroupCommandDTO, user: string): SouthItemGroupEntity {
    this.findById(southId); // Verify south connector exists
    const scanModes = this.scanModeRepository.findAll();
    const scanMode = checkScanMode(scanModes, command.scanModeId, null);

    // Check for duplicate name
    const existingGroups = this.southItemGroupRepository.findBySouthId(southId);
    if (existingGroups.some(g => g.name === command.name)) {
      throw new OIBusValidationError(`A group with name "${command.name}" already exists for this south connector`);
    }

    const southConnector = this.findById(southId);

    const groupEntity: SouthItemGroupCommand = {
      name: command.name,
      southId: southConnector.id,
      scanMode,
      overlap: command.overlap,
      maxReadInterval: command.maxReadInterval,
      readDelay: command.readDelay
    };
    return this.southItemGroupRepository.create(groupEntity, user);
  }

  updateGroup(southId: string, groupId: string, user: string, command: SouthItemGroupCommandDTO): SouthItemGroupEntity {
    this.findById(southId); // Verify south connector exists
    const existingGroup = this.southItemGroupRepository.findById(groupId);
    if (!existingGroup) {
      throw new NotFoundError(`South item group "${groupId}" not found`);
    }
    if (existingGroup.southId !== southId) {
      throw new NotFoundError(`South item group "${groupId}" does not belong to south connector "${southId}"`);
    }

    const scanModes = this.scanModeRepository.findAll();
    const scanMode = checkScanMode(scanModes, command.scanModeId, null);

    // Check for duplicate name (excluding current group)
    const existingGroups = this.southItemGroupRepository.findBySouthId(southId);
    if (existingGroups.some(g => g.name === command.name && g.id !== groupId)) {
      throw new OIBusValidationError(`A group with name "${command.name}" already exists for this south connector`);
    }

    const overlap = command.overlap != null ? command.overlap : null;
    const maxReadInterval = command.maxReadInterval != null ? command.maxReadInterval : null;
    const readDelay = command.readDelay != null ? command.readDelay : 0;
    const groupEntity: Omit<SouthItemGroupCommand, 'southId'> = {
      name: command.name,
      scanMode,
      overlap,
      maxReadInterval,
      readDelay
    };
    this.southItemGroupRepository.update(groupId, groupEntity, user);
    const updated = this.southItemGroupRepository.findById(groupId);
    if (!updated) {
      throw new NotFoundError(`Failed to update south item group "${groupId}"`);
    }
    return updated;
  }

  async deleteGroup(southId: string, groupId: string): Promise<void> {
    const southConnector = this.findById(southId);
    const group = this.southItemGroupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError(`South item group "${groupId}" not found`);
    }
    if (group.southId !== southId) {
      throw new NotFoundError(`South item group "${groupId}" does not belong to south connector "${southId}"`);
    }
    this.southItemGroupRepository.delete(groupId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    await this.engine.reloadSouthItems(southConnector);
  }

  async moveItemsToGroup(southId: string, itemIds: Array<string>, groupId: string | null): Promise<void> {
    const southConnector = this.findById(southId);

    if (groupId !== null) {
      const group = this.southItemGroupRepository.findById(groupId);
      if (!group) {
        throw new NotFoundError(`South item group "${groupId}" not found`);
      }
      if (group.southId !== southId) {
        throw new NotFoundError(`South item group "${groupId}" does not belong to south connector "${southId}"`);
      }
    }

    // Verify all items belong to this south connector
    for (const itemId of itemIds) {
      const item = this.southConnectorRepository.findItemById(southId, itemId);
      if (!item) {
        throw new NotFoundError(`South item "${itemId}" not found`);
      }
    }

    this.southConnectorRepository.moveItemsToGroup(itemIds, groupId);
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
  retrieveSecretsFromSouth: boolean,
  southItemGroupRepository: SouthItemGroupRepository,
  southId: string | null,
  user: string
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
        retrieveSecretsFromSouth,
        southItemGroupRepository,
        southId,
        user
      );
      return itemEntity;
    })
  );
};

export const copySouthItemCommandToSouthItemEntity = async (
  southItemEntity: SouthConnectorItemEntity<SouthItemSettings>,
  command: SouthConnectorItemCommandDTO,
  currentSettings: SouthConnectorItemEntity<SouthItemSettings> | null,
  southType: string,
  scanModes: Array<ScanMode>,
  retrieveSecretsFromSouth = false,
  southItemGroupRepository: SouthItemGroupRepository,
  southId: string | null,
  user: string
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
  southItemEntity.syncWithGroup = command.syncWithGroup ?? false;
  southItemEntity.maxReadInterval = command.maxReadInterval != null ? command.maxReadInterval : null;
  southItemEntity.readDelay = command.readDelay != null ? command.readDelay : null;
  southItemEntity.overlap = command.overlap != null ? command.overlap : null;
  // Handle group assignment
  if (southItemGroupRepository && southId) {
    if (command.groupId) {
      southItemEntity.group = southItemGroupRepository.findById(command.groupId);
    } else if (command.groupName && command.groupName.trim()) {
      // Find or create group by name
      let group = southItemGroupRepository.findByNameAndSouthId(command.groupName.trim(), southId);
      if (!group) {
        // Create group with item's scan mode as default
        const scanMode = checkScanMode(scanModes, command.scanModeId, command.scanModeName);
        const groupEntity: SouthItemGroupCommand = {
          name: command.groupName.trim(),
          southId,
          scanMode,
          overlap: null,
          maxReadInterval: null,
          readDelay: 0
        };
        group = southItemGroupRepository.create(groupEntity, user);
      }
      southItemEntity.group = group;
    } else {
      southItemEntity.group = null;
    }
  } else if (southItemGroupRepository) {
    // Legacy support: only groupId when southId is not available
    if (command.groupId) {
      southItemEntity.group = southItemGroupRepository.findById(command.groupId);
    } else {
      southItemEntity.group = null;
    }
  }
};

export const toSouthConnectorLightDTO = (entity: SouthConnectorEntityLight, getUserInfo: GetUserInfo): SouthConnectorLightDTO => {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    description: entity.description,
    enabled: entity.enabled,
    createdBy: getUserInfo(entity.createdBy),
    updatedBy: getUserInfo(entity.updatedBy),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  };
};

export const toSouthConnectorDTO = (
  southEntity: SouthConnectorEntity<SouthSettings, SouthItemSettings>,
  getUserInfo: GetUserInfo
): SouthConnectorTypedDTO<OIBusSouthType, SouthSettings, SouthItemSettings> => {
  const manifest = southManifestList.find(element => element.id === southEntity.type)!;
  const items = southEntity.items.map(item => toSouthConnectorItemDTO(item, southEntity.type, getUserInfo));
  return {
    id: southEntity.id,
    name: southEntity.name,
    type: southEntity.type,
    description: southEntity.description,
    enabled: southEntity.enabled,
    settings: encryptionService.filterSecrets(southEntity.settings, manifest.settings),
    items,
    groups: southEntity.groups.map(group => ({
      id: group.id,
      name: group.name,
      scanMode: toScanModeDTO(group.scanMode, getUserInfo),
      maxReadInterval: group.maxReadInterval,
      readDelay: group.readDelay,
      overlap: group.overlap,
      createdBy: getUserInfo(group.createdBy),
      updatedBy: getUserInfo(group.updatedBy),
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    })),
    createdBy: getUserInfo(southEntity.createdBy),
    updatedBy: getUserInfo(southEntity.updatedBy),
    createdAt: southEntity.createdAt,
    updatedAt: southEntity.updatedAt
  };
};

export const toSouthConnectorItemDTO = (
  entity: SouthConnectorItemEntity<SouthItemSettings>,
  southType: string,
  getUserInfo: GetUserInfo
): SouthConnectorItemTypedDTO<SouthItemSettings> => {
  const manifest = southManifestList.find(element => element.id === southType)!;
  const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
    attribute => attribute.key === 'settings'
  )! as OIBusObjectAttribute;
  return {
    id: entity.id,
    name: entity.name,
    enabled: entity.enabled,
    scanMode: toScanModeDTO(entity.scanMode, getUserInfo),
    settings: encryptionService.filterSecrets(entity.settings, itemSettingsManifest),
    createdBy: getUserInfo(entity.createdBy),
    updatedBy: getUserInfo(entity.updatedBy),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    group: entity.group ? toSouthItemGroupDTO(entity.group, getUserInfo) : null,
    syncWithGroup: entity.syncWithGroup,
    maxReadInterval: entity.maxReadInterval,
    readDelay: entity.readDelay,
    overlap: entity.overlap
  };
};

export const toSouthItemGroupDTO = (entity: SouthItemGroupEntityLight, getUserInfo: GetUserInfo): SouthItemGroupDTO => {
  return {
    id: entity.id,
    name: entity.name,
    scanMode: toScanModeDTO(entity.scanMode, getUserInfo),
    overlap: entity.overlap,
    maxReadInterval: entity.maxReadInterval,
    readDelay: entity.readDelay,
    createdBy: getUserInfo(entity.createdBy),
    updatedBy: getUserInfo(entity.updatedBy),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  };
};

export const toSouthItemLightDTO = (entity: SouthConnectorItemEntityLight, getUserInfo: GetUserInfo): ItemLightDTO => {
  return {
    id: entity.id,
    name: entity.name,
    enabled: entity.enabled,
    createdBy: getUserInfo(entity.createdBy),
    updatedBy: getUserInfo(entity.updatedBy),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  };
};
