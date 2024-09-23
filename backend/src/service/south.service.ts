import EncryptionService from './encryption.service';
import pino from 'pino';

// South imports
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemSearchParam,
  SouthConnectorLightDTO,
  SouthConnectorManifest,
  SouthConnectorWithoutItemsCommandDTO
} from '../../../shared/model/south-connector.model';
import SouthConnector from '../south/south-connector';

import oianalyticsManifest from '../south/south-oianalytics/manifest';
import slimsManifest from '../south/south-slims/manifest';
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
import opchdaManifest from '../south/south-opchda/manifest';
import oledbManifest from '../south/south-oledb/manifest';
import piManifest from '../south/south-pi/manifest';
import sftpManifest from '../south/south-sftp/manifest';
import ConnectionService from './connection.service';
import { OIBusContent } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorEntityLight, SouthConnectorItemEntity } from '../model/south-connector.model';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import LogRepository from '../repository/logs/log.repository';
import SouthConnectorMetricsRepository from '../repository/logs/south-connector-metrics.repository';
import { Page } from '../../../shared/model/types';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import { checkScanMode } from './utils';
import { ScanMode } from '../model/scan-mode.model';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import fs from 'node:fs/promises';
import csv from 'papaparse';
import multer from '@koa/multer';
import {
  SouthADSItemSettings,
  SouthADSSettings,
  SouthFolderScannerItemSettings,
  SouthFolderScannerSettings,
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
  SouthOPCHDAItemSettings,
  SouthOPCHDASettings,
  SouthOPCUAItemSettings,
  SouthOPCUASettings,
  SouthOracleItemSettings,
  SouthOracleSettings,
  SouthPIItemSettings,
  SouthPISettings,
  SouthPostgreSQLItemSettings,
  SouthPostgreSQLSettings,
  SouthSettings,
  SouthSFTPItemSettings,
  SouthSFTPSettings,
  SouthSlimsItemSettings,
  SouthSlimsSettings,
  SouthSQLiteItemSettings,
  SouthSQLiteSettings
} from '../../../shared/model/south-settings.model';
import SouthADS from '../south/south-ads/south-ads';
import SouthFolderScanner from '../south/south-folder-scanner/south-folder-scanner';
import SouthModbus from '../south/south-modbus/south-modbus';
import SouthMQTT from '../south/south-mqtt/south-mqtt';
import SouthMSSQL from '../south/south-mssql/south-mssql';
import SouthMySQL from '../south/south-mysql/south-mysql';
import SouthODBC from '../south/south-odbc/south-odbc';
import SouthOIAnalytics from '../south/south-oianalytics/south-oianalytics';
import SouthOLEDB from '../south/south-oledb/south-oledb';
import SouthOPCHDA from '../south/south-opchda/south-opchda';
import SouthOPCUA from '../south/south-opcua/south-opcua';
import SouthOracle from '../south/south-oracle/south-oracle';
import SouthPI from '../south/south-pi/south-pi';
import SouthPostgreSQL from '../south/south-postgresql/south-postgresql';
import SouthSFTP from '../south/south-sftp/south-sftp';
import SouthSlims from '../south/south-slims/south-slims';
import SouthSQLite from '../south/south-sqlite/south-sqlite';
import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import CertificateRepository from '../repository/config/certificate.repository';

export const southManifestList: Array<SouthConnectorManifest> = [
  folderScannerManifest,
  mqttManifest,
  opcuaManifest,
  opchdaManifest,
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
  slimsManifest,
  piManifest,
  sftpManifest
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
    private readonly encryptionService: EncryptionService,
    private readonly _connectionService: ConnectionService
  ) {}

  runSouth<S extends SouthSettings, I extends SouthItemSettings>(
    settings: SouthConnectorEntity<S, I>,
    addContent: (southId: string, data: OIBusContent) => Promise<void>,
    baseFolder: string,
    logger: pino.Logger
  ): SouthConnector<SouthSettings, SouthItemSettings> {
    switch (settings.type) {
      case 'ads':
        return new SouthADS(
          settings as SouthConnectorEntity<SouthADSSettings, SouthADSItemSettings>,
          addContent,
          this.encryptionService,
          this.southConnectorRepository,
          this.southMetricsRepository,
          this.southCacheRepository,
          this.scanModeRepository,
          logger,
          baseFolder
        );
      case 'folder-scanner':
        return new SouthFolderScanner(
          settings as SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings>,
          addContent,
          this.encryptionService,
          this.southConnectorRepository,
          this.southMetricsRepository,
          this.southCacheRepository,
          this.scanModeRepository,
          logger,
          baseFolder
        );
      case 'modbus':
        return new SouthModbus(
          settings as SouthConnectorEntity<SouthModbusSettings, SouthModbusItemSettings>,
          addContent,
          this.encryptionService,
          this.southConnectorRepository,
          this.southMetricsRepository,
          this.southCacheRepository,
          this.scanModeRepository,
          logger,
          baseFolder
        );
      case 'mqtt':
        return new SouthMQTT(
          settings as SouthConnectorEntity<SouthMQTTSettings, SouthMQTTItemSettings>,
          addContent,
          this.encryptionService,
          this.southConnectorRepository,
          this.southMetricsRepository,
          this.southCacheRepository,
          this.scanModeRepository,
          logger,
          baseFolder
        );
      case 'mssql':
        return new SouthMSSQL(
          settings as SouthConnectorEntity<SouthMSSQLSettings, SouthMSSQLItemSettings>,
          addContent,
          this.encryptionService,
          this.southConnectorRepository,
          this.southMetricsRepository,
          this.southCacheRepository,
          this.scanModeRepository,
          logger,
          baseFolder
        );
      case 'mysql':
        return new SouthMySQL(
          settings as SouthConnectorEntity<SouthMySQLSettings, SouthMySQLItemSettings>,
          addContent,
          this.encryptionService,
          this.southConnectorRepository,
          this.southMetricsRepository,
          this.southCacheRepository,
          this.scanModeRepository,
          logger,
          baseFolder
        );
      case 'odbc':
        return new SouthODBC(
          settings as SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings>,
          addContent,
          this.encryptionService,
          this.southConnectorRepository,
          this.southMetricsRepository,
          this.southCacheRepository,
          this.scanModeRepository,
          logger,
          baseFolder
        );
      case 'oianalytics':
        return new SouthOIAnalytics(
          settings as SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings>,
          addContent,
          this.encryptionService,
          this.southConnectorRepository,
          this.southMetricsRepository,
          this.southCacheRepository,
          this.scanModeRepository,
          this.oIAnalyticsRegistrationRepository,
          this.certificateRepository,
          logger,
          baseFolder
        );
      case 'oledb':
        return new SouthOLEDB(
          settings as SouthConnectorEntity<SouthOLEDBSettings, SouthOLEDBItemSettings>,
          addContent,
          this.encryptionService,
          this.southConnectorRepository,
          this.southMetricsRepository,
          this.southCacheRepository,
          this.scanModeRepository,
          logger,
          baseFolder
        );
      case 'opchda':
        return new SouthOPCHDA(
          settings as SouthConnectorEntity<SouthOPCHDASettings, SouthOPCHDAItemSettings>,
          addContent,
          this.encryptionService,
          this.southConnectorRepository,
          this.southMetricsRepository,
          this.southCacheRepository,
          this.scanModeRepository,
          logger,
          baseFolder
        );
      case 'opcua':
        return new SouthOPCUA(
          settings as SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings>,
          addContent,
          this.encryptionService,
          this.southConnectorRepository,
          this.southMetricsRepository,
          this.southCacheRepository,
          this.scanModeRepository,
          logger,
          baseFolder,
          this._connectionService
        );
      case 'oracle':
        return new SouthOracle(
          settings as SouthConnectorEntity<SouthOracleSettings, SouthOracleItemSettings>,
          addContent,
          this.encryptionService,
          this.southConnectorRepository,
          this.southMetricsRepository,
          this.southCacheRepository,
          this.scanModeRepository,
          logger,
          baseFolder
        );
      case 'osisoft-pi':
        return new SouthPI(
          settings as SouthConnectorEntity<SouthPISettings, SouthPIItemSettings>,
          addContent,
          this.encryptionService,
          this.southConnectorRepository,
          this.southMetricsRepository,
          this.southCacheRepository,
          this.scanModeRepository,
          logger,
          baseFolder
        );
      case 'postgresql':
        return new SouthPostgreSQL(
          settings as SouthConnectorEntity<SouthPostgreSQLSettings, SouthPostgreSQLItemSettings>,
          addContent,
          this.encryptionService,
          this.southConnectorRepository,
          this.southMetricsRepository,
          this.southCacheRepository,
          this.scanModeRepository,
          logger,
          baseFolder
        );
      case 'sftp':
        return new SouthSFTP(
          settings as SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings>,
          addContent,
          this.encryptionService,
          this.southConnectorRepository,
          this.southMetricsRepository,
          this.southCacheRepository,
          this.scanModeRepository,
          logger,
          baseFolder
        );
      case 'slims':
        return new SouthSlims(
          settings as SouthConnectorEntity<SouthSlimsSettings, SouthSlimsItemSettings>,
          addContent,
          this.encryptionService,
          this.southConnectorRepository,
          this.southMetricsRepository,
          this.southCacheRepository,
          this.scanModeRepository,
          logger,
          baseFolder
        );
      case 'sqlite':
        return new SouthSQLite(
          settings as SouthConnectorEntity<SouthSQLiteSettings, SouthSQLiteItemSettings>,
          addContent,
          this.encryptionService,
          this.southConnectorRepository,
          this.southMetricsRepository,
          this.southCacheRepository,
          this.scanModeRepository,
          logger,
          baseFolder
        );
      default:
        throw Error(`South connector of type ${settings.type} not installed`);
    }
  }

  async testSouth<S extends SouthSettings, I extends SouthItemSettings>(
    id: string,
    command: SouthConnectorCommandDTO<S, I>,
    logger: pino.Logger
  ): Promise<void> {
    let southConnector: SouthConnectorEntity<S, I> | null = null;
    if (id !== 'create') {
      southConnector = this.southConnectorRepository.findSouthById(id);
      if (!southConnector) {
        throw new Error(`South connector ${id} not found`);
      }
    }
    const manifest = this.getInstalledSouthManifests().find(southManifest => southManifest.id === command.type);
    if (!manifest) {
      throw new Error(`South manifest ${command.type} not found`);
    }
    await this.validator.validateSettings(manifest.settings, command.settings);

    const testToRun: SouthConnectorEntity<SouthSettings, SouthItemSettings> = {
      id: southConnector?.id || 'test',
      ...command,
      settings: await this.encryptionService.encryptConnectorSecrets<S>(
        command.settings,
        southConnector?.settings || null,
        manifest.settings
      ),
      name: southConnector ? southConnector.name : `${command!.type}:test-connection`,
      items: []
    };

    const south = this.runSouth(
      testToRun,
      async (_southId: string, _content: OIBusContent): Promise<void> => Promise.resolve(),
      'baseFolder',
      logger
    );
    return await south.testConnection();
  }

  async testSouthItem<S extends SouthSettings, I extends SouthItemSettings>(
    id: string,
    command: SouthConnectorCommandDTO<S, I>,
    itemCommand: SouthConnectorItemCommandDTO<I>,
    callback: (data: OIBusContent) => void,
    logger: pino.Logger
  ): Promise<void> {
    let southConnector: SouthConnectorEntity<S, I> | null = null;
    if (id !== 'create') {
      southConnector = this.southConnectorRepository.findSouthById(id);
      if (!southConnector) {
        throw new Error(`South connector ${id} not found`);
      }
    }
    const manifest = this.getInstalledSouthManifests().find(southManifest => southManifest.id === command.type);
    if (!manifest) {
      throw new Error(`South manifest ${command.type} not found`);
    }
    await this.validator.validateSettings(manifest.settings, command.settings);
    await this.validator.validateSettings(manifest.items.settings, itemCommand.settings);

    const testItemToRun: SouthConnectorItemEntity<I> = {
      id: 'test',
      enabled: itemCommand.enabled,
      name: itemCommand.name,
      scanModeId: itemCommand.scanModeId!,
      settings: await this.encryptionService.encryptConnectorSecrets(itemCommand.settings, null, manifest.items.settings)
    };
    const testConnectorToRun: SouthConnectorEntity<SouthSettings, SouthItemSettings> = {
      id: southConnector?.id || 'test',
      ...command,
      settings: await this.encryptionService.encryptConnectorSecrets<S>(
        command.settings,
        southConnector?.settings || null,
        manifest.settings
      ),
      name: southConnector ? southConnector.name : `${command!.type}:test-connection`,
      items: [testItemToRun]
    };

    const south = this.runSouth(
      testConnectorToRun,
      async (_southId: string, _content: OIBusContent): Promise<void> => Promise.resolve(),
      'baseFolder',
      logger
    );
    return await south.testItem(testItemToRun, callback);
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
    command: SouthConnectorCommandDTO<S, I>
  ): Promise<SouthConnectorEntity<S, I>> {
    const manifest = this.getInstalledSouthManifests().find(southManifest => southManifest.id === command.type);
    if (!manifest) {
      throw new Error('South manifest does not exist');
    }
    await this.validator.validateSettings(manifest.settings, command.settings);
    // Check if item settings match the item schema, throw an error otherwise
    for (const item of command.items) {
      await this.validator.validateSettings(manifest.items.settings, item.settings);
    }

    const southEntity = {} as SouthConnectorEntity<S, I>;
    await copySouthConnectorCommandToSouthEntity(southEntity, command, null, this.encryptionService, this.scanModeRepository.findAll());
    this.southConnectorRepository.saveSouthConnector(southEntity);
    // TODO: await this.oibusEngine.createSouth(southConnector);

    if (southEntity.enabled) {
      // TODO: await this.reloadService.oibusEngine.startSouth(southConnector.id);
    }
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    return southEntity;
  }

  async updateSouthWithoutItems<S extends SouthSettings, I extends SouthItemSettings>(
    southConnectorId: string,
    command: SouthConnectorWithoutItemsCommandDTO<S>
  ) {
    const previousSettings = this.southConnectorRepository.findSouthById<S, I>(southConnectorId);
    if (!previousSettings) {
      throw new Error(`South connector ${southConnectorId} does not exist`);
    }
    const manifest = this.getInstalledSouthManifests().find(southManifest => southManifest.id === command.type);
    if (!manifest) {
      throw new Error('South manifest does not exist');
    }
    await this.validator.validateSettings(manifest.settings, command.settings);

    const southEntity = { id: previousSettings.id } as SouthConnectorEntity<S, SouthItemSettings>;
    await copySouthConnectorCommandToSouthEntity(
      southEntity,
      { ...command, items: previousSettings.items.map(item => ({ ...item, scanModeName: null })) },
      previousSettings,
      this.encryptionService,
      this.scanModeRepository.findAll()
    );
    this.southConnectorRepository.saveSouthConnector(southEntity);

    if (previousSettings.name !== southEntity.name) {
      // TODO: this.oibusEngine.setLogger(this.oibusEngine.logger);
    }

    // Handle all cases regarding cache changes when max instant per item changes
    this.onSouthMaxInstantPerItemChange(previousSettings, southEntity);

    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
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
      throw new Error('South manifest does not exist');
    }
    await this.validator.validateSettings(manifest.settings, command.settings);

    const southEntity = { id: previousSettings.id } as SouthConnectorEntity<S, I>;
    await copySouthConnectorCommandToSouthEntity(
      southEntity,
      command,
      previousSettings,
      this.encryptionService,
      this.scanModeRepository.findAll()
    );
    this.southConnectorRepository.saveSouthConnector(southEntity);

    if (previousSettings.name !== southEntity.name) {
      // TODO: this.oibusEngine.setLogger(this.oibusEngine.logger);
    }

    if (previousSettings.history.maxInstantPerItem !== southEntity.history.maxInstantPerItem) {
      // Handle all cases regarding cache changes when max instant per item changes
      this.onSouthMaxInstantPerItemChange(previousSettings, southEntity);
    }

    if (southEntity.enabled) {
      this.southConnectorRepository.start(southEntity.id);
      // TODO: await this.oibusEngine.reloadSouth(newSouthConnectorSettings.id);
    } else {
      this.southConnectorRepository.stop(southEntity.id);
      // TODO: await this.oibusEngine.stopSouth(newSouthConnectorSettings.id);
    }

    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async deleteSouth(southConnectorId: string): Promise<void> {
    const southConnector = this.southConnectorRepository.findSouthById(southConnectorId);
    if (!southConnector) {
      throw new Error(`South connector ${southConnectorId} does not exist`);
    }
    // TODO: this.oibusEngine.updateSubscriptions(northId);
    // TODO: await this.oibusEngine.deleteSouth(southConnector.id, southConnector.name);
    this.southConnectorRepository.deleteSouth(southConnector.id);
    this.logRepository.deleteLogsByScopeId('south', southConnector.id);
    this.southMetricsRepository.removeMetrics(southConnector.id);
    this.southCacheRepository.deleteAllBySouthConnector(southConnector.id);

    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async startSouth(southConnectorId: string): Promise<void> {
    const southConnector = this.southConnectorRepository.findSouthById(southConnectorId);
    if (!southConnector) {
      throw new Error(`South connector ${southConnectorId} does not exist`);
    }

    this.southConnectorRepository.start(southConnectorId);
    // TODO: await this.oibusEngine.startSouth(southId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async stopSouth(southConnectorId: string): Promise<void> {
    const southConnector = this.southConnectorRepository.findSouthById(southConnectorId);
    if (!southConnector) {
      throw new Error(`South connector ${southConnectorId} does not exist`);
    }

    this.southConnectorRepository.stop(southConnectorId);
    // TODO await this.oibusEngine.stopSouth(southId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  getSouthItems<I extends SouthItemSettings>(southId: string): Array<SouthConnectorItemEntity<I>> {
    return this.southConnectorRepository.findAllItemsForSouth<I>(southId);
  }

  searchSouthItems<I extends SouthItemSettings>(
    southId: string,
    searchParams: SouthConnectorItemSearchParam
  ): Page<SouthConnectorItemEntity<I>> {
    return this.southConnectorRepository.searchItems<I>(southId, searchParams);
  }

  findAllItemsForSouthConnector<I extends SouthItemSettings>(southConnectorId: string): Array<SouthConnectorItemEntity<I>> {
    return this.southConnectorRepository.findAllItemsForSouth<I>(southConnectorId);
  }

  findSouthConnectorItemById(southConnectorId: string, itemId: string): SouthConnectorItemEntity<SouthItemSettings> | null {
    return this.southConnectorRepository.findItemById(southConnectorId, itemId);
  }

  async createItem<I extends SouthItemSettings>(
    southConnectorId: string,
    command: SouthConnectorItemCommandDTO<I>
  ): Promise<SouthConnectorItemEntity<I>> {
    const southConnector = this.southConnectorRepository.findSouthById(southConnectorId);
    if (!southConnector) {
      throw new Error(`South connector ${southConnectorId} does not exist`);
    }
    const manifest = this.getInstalledSouthManifests().find(southManifest => southManifest.id === southConnector.type);
    if (!manifest) {
      throw new Error('South manifest does not exist');
    }
    await this.validator.validateSettings(manifest.items.settings, command.settings);

    const southItemEntity = {} as SouthConnectorItemEntity<I>;
    await copySouthItemCommandToSouthItemEntity<I>(
      southItemEntity,
      command,
      null,
      southConnector.type,
      this.encryptionService,
      this.scanModeRepository.findAll()
    );
    this.southConnectorRepository.saveItem<I>(southConnector.id, southItemEntity);

    // TODO: await this.oibusEngine.onSouthItemsChange(southId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    return southItemEntity;
  }

  async updateItem<I extends SouthItemSettings>(
    southConnectorId: string,
    itemId: string,
    command: SouthConnectorItemCommandDTO<I>
  ): Promise<void> {
    const previousSettings = this.southConnectorRepository.findItemById<I>(southConnectorId, itemId);
    if (!previousSettings) {
      throw new Error(`South item with Id ${itemId} doesn't exist`);
    }
    const southConnector = this.southConnectorRepository.findSouthById(southConnectorId)!;
    const manifest = this.getInstalledSouthManifests().find(southManifest => southManifest.id === southConnector.type);
    if (!manifest) {
      throw new Error('South manifest does not exist');
    }

    await this.validator.validateSettings(manifest.items.settings, command.settings);

    const southItemEntity = { id: previousSettings.id } as SouthConnectorItemEntity<I>;
    await copySouthItemCommandToSouthItemEntity<I>(
      southItemEntity,
      command,
      previousSettings,
      southConnector.type,
      this.encryptionService,
      this.scanModeRepository.findAll()
    );
    this.southConnectorRepository.saveItem<I>(southConnectorId, southItemEntity);

    this.onSouthItemScanModeChange(southConnector, previousSettings, southItemEntity);
    // TODO: await this.oibusEngine.onSouthItemsChange(southId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async deleteItem(southConnectorId: string, itemId: string): Promise<void> {
    const southConnector = this.southConnectorRepository.findSouthById(southConnectorId);
    if (!southConnector) {
      throw new Error(`South connector ${southConnectorId} does not exist`);
    }
    const southItem = this.southConnectorRepository.findItemById(southConnectorId, itemId);
    if (!southItem) throw new Error('South item not found');
    this.southConnectorRepository.deleteItem(southItem.id);
    this.safeDeleteSouthCacheEntry(southConnector, southItem);
    // TODO await this.oibusEngine.onSouthItemsChange(southConnectorId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async deleteAllItemsForSouthConnector(southConnectorId: string): Promise<void> {
    const southConnector = this.southConnectorRepository.findSouthById(southConnectorId);
    if (!southConnector) {
      throw new Error(`South connector ${southConnectorId} does not exist`);
    }
    this.southConnectorRepository.deleteAllItemsBySouth(southConnectorId);
    this.southCacheRepository.deleteAllBySouthConnector(southConnectorId);
    // TODO await this.oibusEngine.onSouthItemsChange(southId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async enableItem(southConnectorId: string, itemId: string): Promise<void> {
    const southItem = this.southConnectorRepository.findItemById(southConnectorId, itemId);
    if (!southItem) throw new Error('South item not found');
    this.southConnectorRepository.enableItem(itemId);
    // TODO await this.oibusEngine.onSouthItemsChange(southItem.connectorId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async disableItem(southConnectorId: string, itemId: string): Promise<void> {
    const southItem = this.southConnectorRepository.findItemById(southConnectorId, itemId);
    if (!southItem) throw new Error('South item not found');
    this.southConnectorRepository.disableItem(itemId);
    // TODO await this.oibusEngine.onSouthItemsChange(southItem.connectorId);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  async checkCsvImport<I extends SouthItemSettings>(
    southType: string,
    file: multer.File,
    delimiter: string,
    existingItems: Array<SouthConnectorItemDTO<I> | SouthConnectorItemCommandDTO<I>>
  ) {
    const manifest = this.getInstalledSouthManifests().find(southManifest => southManifest.id === southType);
    if (!manifest) {
      throw new Error('South manifest not found');
    }

    const fileContent = await fs.readFile(file.path);
    const csvContent = csv.parse(fileContent.toString('utf8'), { header: true, delimiter });

    if (csvContent.meta.delimiter !== delimiter) {
      throw new Error('The entered delimiter does not correspond to the file delimiter');
    }

    const scanModes = this.scanModeRepository.findAll();

    const validItems: Array<SouthConnectorItemCommandDTO<I>> = [];
    const errors: Array<{ item: SouthConnectorItemCommandDTO<I>; error: string }> = [];
    for (const data of csvContent.data) {
      const item: SouthConnectorItemCommandDTO<I> = {
        id: '',
        name: (data as unknown as Record<string, string>).name,
        enabled: (data as unknown as Record<string, string>).enabled.toLowerCase() === 'true',
        scanModeId: null as string | null,
        scanModeName: null,
        settings: {} as I
      };
      if (existingItems.find(existingItem => existingItem.name === item.name)) {
        errors.push({
          item: item,
          error: `Item name "${(data as unknown as Record<string, string>).name}" already used`
        });
        continue;
      }

      const foundScanMode = scanModes.find(scanMode => scanMode.name === (data as unknown as Record<string, string>).scanMode);
      if (!foundScanMode) {
        errors.push({
          item: item,
          error: `Scan mode "${(data as unknown as Record<string, string>).scanMode}" not found for item ${item.name}`
        });
        continue;
      }
      item.scanModeId = foundScanMode.id;

      let hasSettingsError = false;
      const settings: Record<string, string | object> = {};
      for (const [key, value] of Object.entries(data as unknown as Record<string, string>)) {
        if (key.startsWith('settings_')) {
          const settingsKey = key.replace('settings_', '');
          const manifestSettings = manifest.items.settings.find(settings => settings.key === settingsKey);
          if (!manifestSettings) {
            hasSettingsError = true;
            errors.push({
              item: item,
              error: `Settings "${settingsKey}" not accepted in manifest`
            });
            break;
          }
          if ((manifestSettings.type === 'OibArray' || manifestSettings.type === 'OibFormGroup') && value) {
            settings[settingsKey] = JSON.parse(value as string);
          } else {
            settings[settingsKey] = value;
          }
        }
      }
      if (hasSettingsError) continue;
      item.settings = settings as unknown as I;

      try {
        await this.validator.validateSettings(manifest.items.settings, item.settings);
        validItems.push(item);
      } catch (itemError: unknown) {
        errors.push({ item, error: (itemError as Error).message });
      }
    }

    return { items: validItems, errors };
  }

  async importItems<I extends SouthItemSettings>(southConnectorId: string, items: Array<SouthConnectorItemCommandDTO<I>>) {
    const southConnector = this.southConnectorRepository.findSouthById(southConnectorId);
    if (!southConnector) {
      throw new Error(`South connector ${southConnectorId} does not exist`);
    }
    const manifest = this.getInstalledSouthManifests().find(southManifest => southManifest.id === southConnector.type)!;
    const itemsToAdd: Array<SouthConnectorItemEntity<I>> = [];
    const scanModes = this.scanModeRepository.findAll();

    for (const itemCommand of items) {
      await this.validator.validateSettings(manifest.items.settings, itemCommand.settings);
      const southItemEntity = {} as SouthConnectorItemEntity<I>;
      await copySouthItemCommandToSouthItemEntity(
        southItemEntity,
        itemCommand,
        null,
        southConnector.type,
        this.encryptionService,
        scanModes
      );
      itemsToAdd.push(southItemEntity);
    }

    this.southConnectorRepository.saveAllItems(southConnector.id, itemsToAdd);
    // TODO await ctx.app.reloadService.oibusEngine.onSouthItemsChange(southConnector.id);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
  }

  /**
   * Safely delete the cache entries of a south item, when the south item is deleted
   */
  private safeDeleteSouthCacheEntry(
    southConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings>,
    southItem: SouthConnectorItemEntity<SouthItemSettings>
  ) {
    if (southConnector.history.maxInstantPerItem) {
      this.southCacheRepository.deleteAllBySouthItem(southItem.id);
    } else {
      const isOldScanModeUnused = !southConnector.items.some(item => item.scanModeId === southItem.scanModeId);
      if (isOldScanModeUnused) {
        this.southCacheRepository.delete(southItem.id, southItem.scanModeId, 'all');
      }
    }
  }

  /**
   * Handle the change of a south item's scan mode
   */
  private onSouthItemScanModeChange(
    southConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings>,
    previousItem: SouthConnectorItemEntity<SouthItemSettings>,
    newItem: Omit<SouthConnectorItemEntity<SouthItemSettings>, 'id'>
  ) {
    const oldScanModeId = previousItem.scanModeId;
    const newScanModeId = newItem.scanModeId!;

    if (oldScanModeId === newScanModeId) {
      return;
    }

    const southItemId = southConnector.history.maxInstantPerItem ? previousItem.id : 'all';
    const previousCacheEntry = this.southCacheRepository.getSouthCache(southConnector.id, oldScanModeId, southItemId);
    const newCacheEntry = this.southCacheRepository.getSouthCache(southConnector.id, newScanModeId, southItemId);

    // If the south hasn't been started yet, the previous cache entry won't exist
    if (!previousCacheEntry) {
      return;
    }

    // Max instant per item is enabled
    if (southConnector.history.maxInstantPerItem) {
      // 1. Remove the previous cache entry
      this.safeDeleteSouthCacheEntry(southConnector, previousItem);

      // 2. Create the new cache entry, with the previous max instant
      this.southCacheRepository.save({
        southId: southConnector.id,
        itemId: previousItem.id,
        scanModeId: newScanModeId,
        maxInstant: previousCacheEntry.maxInstant
      });
    }

    // Max instant per item is disabled
    if (!southConnector.history.maxInstantPerItem) {
      // 1. Remove the previous cache entry, if it's not used anymore
      this.safeDeleteSouthCacheEntry(southConnector, previousItem);

      // 2. Create the new cache entry, with the previous max instant, if it's not already created
      if (!newCacheEntry) {
        this.southCacheRepository.save({
          southId: southConnector.id,
          itemId: 'all',
          scanModeId: newScanModeId,
          maxInstant: previousCacheEntry.maxInstant
        });
      }
    }
  }

  /**
   * Handle the change of the max instant per item setting of a south connector
   */
  private onSouthMaxInstantPerItemChange(
    previousSettings: SouthConnectorEntity<SouthSettings, SouthItemSettings>,
    newSettings: SouthConnectorEntity<SouthSettings, SouthItemSettings>
  ) {
    if (previousSettings.history.maxInstantPerItem == newSettings.history.maxInstantPerItem) {
      return;
    }

    const maxInstantsByScanMode = this.southCacheRepository.getLatestMaxInstants(newSettings.id);
    // If the south hasn't been started yet, the cache entries won't exist
    if (!maxInstantsByScanMode) {
      return;
    }

    // 1. Remove all previous cache entries
    this.southCacheRepository.deleteAllBySouthConnector(newSettings.id);

    // Max instant per item is being enabled
    if (newSettings.history.maxInstantPerItem) {
      // 2. Create new cache entries for each item
      // The max instant of these new entries, will be the max instant of the previously removed ones, based on scan mode
      for (const item of previousSettings.items) {
        const maxInstant = maxInstantsByScanMode.get(item.scanModeId);
        if (maxInstant) {
          this.southCacheRepository.save({
            southId: newSettings.id,
            itemId: item.id,
            scanModeId: item.scanModeId,
            maxInstant
          });
        }
      }
    }

    // Max instant per item is being disabled
    if (!newSettings.history.maxInstantPerItem) {
      // 2. Create a single cache entry for all scan modes
      // The max instant of these new entries, will be the *latest* max instant of the previously removed ones
      for (const [scanModeId, maxInstant] of maxInstantsByScanMode) {
        this.southCacheRepository.save({ southId: newSettings.id, itemId: 'all', scanModeId, maxInstant });
      }
    }
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
  encryptionService: EncryptionService,
  scanModes: Array<ScanMode>
): Promise<void> => {
  const manifest = southManifestList.find(element => element.id === southEntity.type)!;

  southEntity.name = command.name;
  southEntity.type = command.type;
  southEntity.description = command.description;
  southEntity.enabled = command.enabled;
  southEntity.settings = await encryptionService.encryptConnectorSecrets<S>(
    command.settings,
    currentSettings?.settings || null,
    manifest.settings
  );
  southEntity.sharedConnection = command.sharedConnection;
  southEntity.history = {
    maxInstantPerItem: manifest.modes.forceMaxInstantPerItem ? true : command.history.maxInstantPerItem,
    maxReadInterval: command.history.maxReadInterval,
    readDelay: command.history.readDelay,
    overlap: command.history.overlap
  };
  southEntity.items = await Promise.all(
    command.items.map(async itemCommand => {
      const itemEntity = {} as SouthConnectorItemEntity<I>;
      await copySouthItemCommandToSouthItemEntity(
        itemEntity,
        itemCommand,
        southEntity.items.find(element => element.id === itemCommand.id) || null,
        southEntity.type,
        encryptionService,
        scanModes
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
  encryptionService: EncryptionService,
  scanModes: Array<ScanMode>
): Promise<void> => {
  const manifest = southManifestList.find(element => element.id === southType)!;
  southItemEntity.id = command.id || '';
  southItemEntity.name = command.name;
  southItemEntity.enabled = command.enabled;
  southItemEntity.scanModeId = checkScanMode(scanModes, command.scanModeId, command.scanModeName);
  southItemEntity.settings = await encryptionService.encryptConnectorSecrets<I>(
    command.settings,
    currentSettings?.settings || null,
    manifest.items.settings
  );
};

export const toSouthConnectorDTO = <S extends SouthSettings, I extends SouthItemSettings>(
  southEntity: SouthConnectorEntity<S, I>,
  encryptionService: EncryptionService
): SouthConnectorDTO<S, I> => {
  const manifest = southManifestList.find(element => element.id === southEntity.type)!;
  return {
    id: southEntity.id,
    name: southEntity.name,
    type: southEntity.type,
    description: southEntity.description,
    enabled: southEntity.enabled,
    sharedConnection: southEntity.sharedConnection,
    settings: encryptionService.filterSecrets<S>(southEntity.settings, manifest.settings),
    history: {
      maxInstantPerItem: southEntity.history.maxInstantPerItem,
      maxReadInterval: southEntity.history.maxReadInterval,
      readDelay: southEntity.history.readDelay,
      overlap: southEntity.history.overlap
    },
    items: southEntity.items.map(item => toSouthConnectorItemDTO<I>(item, southEntity.type, encryptionService))
  };
};

export const toSouthConnectorItemDTO = <I extends SouthItemSettings>(
  entity: SouthConnectorItemEntity<I>,
  southType: string,
  encryptionService: EncryptionService
): SouthConnectorItemDTO<I> => {
  const manifest = southManifestList.find(element => element.id === southType)!;
  return {
    id: entity.id,
    name: entity.name,
    enabled: entity.enabled,
    scanModeId: entity.scanModeId,
    settings: encryptionService.filterSecrets<I>(entity.settings, manifest.items.settings)
  };
};
