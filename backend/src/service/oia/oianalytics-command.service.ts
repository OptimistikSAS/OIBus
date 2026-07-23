import fs from 'node:fs/promises';
import { encryptionService } from '../encryption.service';
import { DateTime } from 'luxon';
import path from 'node:path';
import { version } from '../../../package.json';
import type { ScanModeCommandDTO } from '../../../shared/model/scan-mode.model';
import type { ScanMode } from '../../model/scan-mode.model';
import OIAnalyticsCommandRepository from '../../repository/config/oianalytics-command.repository';
import { OIAnalyticsRegistration, OIAnalyticsRegistrationEditCommand } from '../../model/oianalytics-registration.model';
import type {
  CacheContentUpdateCommand,
  CacheSearchParam,
  CacheSearchResult,
  DataFolderType,
  EngineSettingsCommandDTO,
  EngineSettingsUpdateResultDTO,
  FileCacheContent
} from '../../../shared/model/engine.model';
import type { EngineSettings } from '../../model/engine.model';
import {
  OIBusCommand,
  OIBusCreateCertificateCommand,
  OIBusCreateCustomTransformerCommand,
  OIBusCreateHistoryQueryCommand,
  OIBusCreateIPFilterCommand,
  OIBusCreateNorthConnectorCommand,
  OIBusCreateOrUpdateHistoryQuerySouthItemsFromCSVCommand,
  OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand,
  OIBusCreateScanModeCommand,
  OIBusCreateSouthConnectorCommand,
  OIBusDeleteCertificateCommand,
  OIBusDeleteCustomTransformerCommand,
  OIBusDeleteHistoryQueryCommand,
  OIBusDeleteIPFilterCommand,
  OIBusDeleteNorthConnectorCommand,
  OIBusDeleteScanModeCommand,
  OIBusDeleteSouthConnectorCommand,
  OIBusGetHistoryCacheFileContentCommand,
  OIBusGetNorthCacheFileContentCommand,
  OIBusRegenerateCipherKeysCommand,
  OIBusRestartEngineCommand,
  OIBusSearchHistoryCacheContentCommand,
  OIBusSearchNorthCacheContentCommand,
  OIBusSetpointCommand,
  OIBusTestCustomTransformerCommand,
  OIBusTestHistoryQueryNorthConnectionCommand,
  OIBusTestHistoryQuerySouthConnectionCommand,
  OIBusTestHistoryQuerySouthItemCommand,
  OIBusTestNorthConnectorCommand,
  OIBusTestSouthConnectorCommand,
  OIBusTestSouthConnectorItemCommand,
  OIBusUpdateCertificateCommand,
  OIBusUpdateCustomTransformerCommand,
  OIBusUpdateEngineSettingsCommand,
  OIBusUpdateHistoryCacheContentCommand,
  OIBusUpdateHistoryQueryCommand,
  OIBusUpdateHistoryQueryStatusCommand,
  OIBusUpdateIPFilterCommand,
  OIBusUpdateNorthCacheContentCommand,
  OIBusUpdateNorthConnectorCommand,
  OIBusUpdateRegistrationSettingsCommand,
  OIBusUpdateScanModeCommand,
  OIBusUpdateSouthConnectorCommand,
  OIBusUpdateVersionCommand
} from '../../model/oianalytics-command.model';
import { CommandSearchParam, OIBusCommandDTO } from '../../../shared/model/command.model';
import { Page } from '../../../shared/model/types';
import { toSouthConnectorItemDTO } from '../south-connector-dto.utils';
import OIAnalyticsClient from './oianalytics-client.service';
import os from 'node:os';
import crypto from 'node:crypto';
import type { IOIAnalyticsMessageService } from '../../model/oianalytics-message.model';
import OIAnalyticsRegistrationService from './oianalytics-registration.service';
import { EventEmitter } from 'node:events';
import type { IPFilterCommandDTO } from '../../../shared/model/ip-filter.model';
import type { IPFilter } from '../../model/ip-filter.model';
import type { CertificateCommandDTO } from '../../../shared/model/certificate.model';
import { toHistoryQueryItemDTO } from '../history-query-item-dto.utils';
import { HistoryQueryCommandDTO, HistoryQueryItemCommandDTO, HistoryQueryItemDTO } from '../../../shared/model/history-query.model';
import { OIBusObjectAttribute } from '../../../shared/model/form.model';
import { OIBusConnectionTestResult, OIBusContent } from '../../../shared/model/engine.model';
import { NotFoundError } from '../../model/types';
import {
  OIBusSouthType,
  SouthConnectorCommandDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemTestingSettings,
  SouthConnectorItemTestResult,
  SouthConnectorManifest
} from '../../../shared/model/south-connector.model';
import type { SouthConnectorEntity } from '../../model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthConnectorCommandDTO, NorthConnectorManifest, OIBusNorthType } from '../../../shared/model/north-connector.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import type { HistoryQueryEntity } from '../../model/histor-query.model';
import { CustomTransformerCommandDTO, TransformerTestRequest, TransformerTestResponse } from '../../../shared/model/transformer.model';
import type { ILogger } from '../../model/logger.model';
import { delay, getOIBusInfo, unzip, getErrorMessage } from '../utils';

interface ICertificateService {
  create(command: CertificateCommandDTO, createdBy: string): Promise<unknown>;
  update(certificateId: string, command: CertificateCommandDTO, updatedBy: string): Promise<void>;
  delete(certificateId: string): void;
}

interface IIPFilterService {
  create(command: IPFilterCommandDTO, createdBy: string): Promise<IPFilter>;
  update(ipFilterId: string, command: IPFilterCommandDTO, updatedBy: string): Promise<void>;
  delete(ipFilterId: string): void;
}

interface IScanModeService {
  create(command: ScanModeCommandDTO, createdBy: string): Promise<ScanMode>;
  update(scanModeId: string, command: ScanModeCommandDTO, updatedBy: string): Promise<void>;
  delete(scanModeId: string): void;
}

interface IOIBusService {
  getEngineSettings(): EngineSettings;
  updateOIBusVersion(version: string, launcherVersion: string): void;
  loggerEvent: EventEmitter;
  updateEngineSettings(command: EngineSettingsCommandDTO, updatedBy: string): Promise<EngineSettingsUpdateResultDTO>;
  searchCacheContent(type: 'north' | 'history', id: string, searchParams: CacheSearchParam): Promise<CacheSearchResult>;
  getFileFromCache(type: 'north' | 'history', id: string, folder: DataFolderType, filename: string): Promise<FileCacheContent>;
  updateCacheContent(type: 'north' | 'history', id: string, updateCommand: CacheContentUpdateCommand): Promise<void>;
}

interface ICommandSouthService {
  listManifest(): Array<SouthConnectorManifest>;
  findById(southId: string): SouthConnectorEntity<SouthSettings, SouthItemSettings> | null;
  create(command: SouthConnectorCommandDTO, retrieveSecretsFromSouth: string | null, createdBy: string): Promise<unknown>;
  update(southId: string, command: SouthConnectorCommandDTO, updatedBy: string): Promise<void>;
  delete(southId: string): Promise<void>;
  checkImportItems(
    southType: string,
    fileContent: string,
    delimiter: string,
    existingItems: Array<{ name: string }>
  ): Promise<{ items: Array<SouthConnectorItemDTO>; errors: Array<{ item: Record<string, string>; error: string }> }>;
  importItems(southId: string, items: Array<SouthConnectorItemCommandDTO>, user: string, deleteItemsNotPresent?: boolean): Promise<void>;
  testSouth(southId: string, southType: OIBusSouthType, settingsToTest: SouthSettings): Promise<OIBusConnectionTestResult>;
  testItem(
    southId: string,
    southType: OIBusSouthType,
    itemName: string,
    southSettings: SouthSettings,
    itemSettings: SouthItemSettings,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemTestResult>;
}

interface ICommandNorthService {
  listManifest(): Array<NorthConnectorManifest>;
  create(command: NorthConnectorCommandDTO, retrieveSecretsFromNorth: string | null, createdBy: string): Promise<unknown>;
  update(northId: string, command: NorthConnectorCommandDTO, updatedBy: string): Promise<void>;
  delete(northId: string): Promise<void>;
  testNorth(northId: string, northType: OIBusNorthType, settingsToTest: NorthSettings): Promise<OIBusConnectionTestResult>;
  executeSetpoint(
    northConnectorId: string,
    commandContent: Array<{ reference: string; value: string }>,
    callback: (result: string) => void
  ): Promise<void>;
}

interface ICommandHistoryQueryService {
  findById(historyId: string): HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> | null;
  create(
    command: HistoryQueryCommandDTO,
    retrieveSecretsFromSouth: string | undefined,
    retrieveSecretsFromNorth: string | undefined,
    retrieveSecretsFromHistoryQuery: string | undefined,
    createdBy: string
  ): Promise<unknown>;
  update(historyId: string, command: HistoryQueryCommandDTO, resetCache: boolean, updatedBy: string): Promise<void>;
  delete(historyId: string): Promise<void>;
  checkImportItems(
    southType: string,
    fileContent: string,
    delimiter: string,
    existingItems: Array<Omit<HistoryQueryItemDTO, 'createdBy' | 'updatedBy'>>
  ): Promise<{ items: Array<HistoryQueryItemDTO>; errors: Array<{ item: Record<string, string>; error: string }> }>;
  importItems(historyId: string, items: Array<HistoryQueryItemCommandDTO>, user: string, deleteItemsNotPresent?: boolean): Promise<void>;
  testNorth(
    historyId: string,
    northType: OIBusNorthType,
    retrieveSecretsFromNorth: string | undefined,
    settingsToTest: NorthSettings
  ): Promise<OIBusConnectionTestResult>;
  testSouth(
    historyId: string,
    southType: OIBusSouthType,
    retrieveSecretsFromSouth: string | undefined,
    settingsToTest: SouthSettings
  ): Promise<OIBusConnectionTestResult>;
  testItem(
    historyId: string,
    southType: OIBusSouthType,
    itemName: string,
    retrieveSecretsFromSouth: string | undefined,
    southSettings: SouthSettings,
    itemSettings: SouthItemSettings,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemTestResult>;
  start(historyId: string): Promise<void>;
  pause(historyId: string): Promise<void>;
}

interface ICommandTransformerService {
  create(command: CustomTransformerCommandDTO, createdBy: string): Promise<unknown>;
  update(transformerId: string, command: CustomTransformerCommandDTO, updatedBy: string): Promise<void>;
  delete(transformerId: string): Promise<void>;
  test(command: CustomTransformerCommandDTO, testRequest: TransformerTestRequest): Promise<TransformerTestResponse>;
}

const UPDATE_SETTINGS_FILE = 'update.json';

// Test commands open real connections whose timeouts are controlled by the remote
// system, not by OIBus. Without a deadline here, a hung connection keeps
// `isExecutingCommand` true forever, blocking every subsequent command.
const TEST_COMMAND_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Races `promise` against a rejection after `ms` milliseconds.
 * Does NOT cancel the underlying operation — Node has no universal cancellation
 * primitive — but it does unblock the caller so the command lock is released.
 *
 * The silent `.catch()` on `promise` ensures that if the underlying operation
 * eventually rejects *after* the timeout has already won the race, that
 * rejection is handled and does not become an UnhandledPromiseRejection (which
 * would terminate the process in Node v24+).
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      // Attach a no-op rejection handler only now that the timeout has won the
      // race. Any rejection that `promise` emits later would otherwise be
      // unhandled (the settled Promise.race no longer consumes it).
      promise.catch(() => {
        /* empty */
      });
      reject(new Error(`${label} timed out after ${ms / 1000}s`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

export default class OIAnalyticsCommandService {
  private isRetrievingCommands = false;
  private isExecutingCommand = false;
  private isAckFlushInProgress = false;
  private readonly ackQueue = new Map<string, OIBusCommand>();
  private refreshCommandsTimeout: NodeJS.Timeout | null = null;
  private ackRetryTimeout: NodeJS.Timeout | null = null;
  private stopped = false;
  public commandEvent: EventEmitter = new EventEmitter(); // Used to trigger command execution

  constructor(
    private oIAnalyticsCommandRepository: OIAnalyticsCommandRepository,
    private oIAnalyticsRegistrationService: OIAnalyticsRegistrationService,
    private oIAnalyticsMessageService: IOIAnalyticsMessageService,
    private oIAnalyticsClient: OIAnalyticsClient,
    private oIBusService: IOIBusService,
    private scanModeService: IScanModeService,
    private ipFilterService: IIPFilterService,
    private certificateService: ICertificateService,
    private southService: ICommandSouthService,
    private northService: ICommandNorthService,
    private historyQueryService: ICommandHistoryQueryService,
    private transformerService: ICommandTransformerService,
    private logger: ILogger,
    private binaryFolder: string,
    private ignoreRemoteUpdate: boolean,
    launcherVersion: string
  ) {
    const engineSettings = this.oIBusService.getEngineSettings();
    const currentUpgradeCommand = this.oIAnalyticsCommandRepository.list({
      status: ['RUNNING'],
      types: ['update-version'],
      ack: undefined,
      start: undefined,
      end: undefined
    });
    if (currentUpgradeCommand.length > 0) {
      const updateVersion = (currentUpgradeCommand[0] as OIBusUpdateVersionCommand).commandContent.version.startsWith('v')
        ? (currentUpgradeCommand[0] as OIBusUpdateVersionCommand).commandContent.version.slice(1)
        : (currentUpgradeCommand[0] as OIBusUpdateVersionCommand).commandContent.version;
      if (engineSettings.version !== updateVersion || engineSettings.launcherVersion !== launcherVersion) {
        this.oIBusService.updateOIBusVersion(updateVersion, launcherVersion);
        this.oIAnalyticsCommandRepository.markAsCompleted(
          currentUpgradeCommand[0].id,
          DateTime.now().toUTC().toISO(),
          `OIBus updated to version ${updateVersion}, launcher updated to version ${launcherVersion}`
        );
        this.logger.info(`OIBus updated to version ${version}, launcher updated to version ${launcherVersion}`);
      } else {
        this.oIAnalyticsCommandRepository.markAsErrored(
          currentUpgradeCommand[0].id,
          `OIBus has not been updated. Rollback to version ${version}`
        );
      }
    } else if (engineSettings.version !== version || engineSettings.launcherVersion !== launcherVersion) {
      this.oIBusService.updateOIBusVersion(version, launcherVersion);
      this.logger.info(`OIBus updated to version ${version}, launcher updated to version ${launcherVersion}`);
    }
  }

  async start(): Promise<void> {
    this.oIBusService.loggerEvent.on('updated', (logger: ILogger) => {
      this.logger = logger;
    });

    this.oIAnalyticsRegistrationService.registrationEvent.on('updated', async () => {
      if (this.stopped) return;
      if (this.refreshCommandsTimeout) {
        clearTimeout(this.refreshCommandsTimeout);
        this.refreshCommandsTimeout = null;
      }
      await this.refreshCommands();
    });

    this.commandEvent.on('next', async () => {
      await this.processNextCommand();
    });
    this.commandEvent.emit('next');

    await this.refreshCommands();
  }

  search(searchParams: CommandSearchParam): Page<OIBusCommand> {
    return this.oIAnalyticsCommandRepository.search(searchParams);
  }

  findById(commandId: string): OIBusCommand {
    const command = this.oIAnalyticsCommandRepository.findById(commandId);
    if (!command) {
      throw new NotFoundError(`OIAnalytics command "${commandId}" not found`);
    }
    return command;
  }

  delete(commandId: string): void {
    const command = this.findById(commandId);
    return this.oIAnalyticsCommandRepository.delete(command.id);
  }

  async refreshCommands(): Promise<void> {
    if (this.stopped) return;
    const registration = this.oIAnalyticsRegistrationService.getRegistrationSettings()!;
    if (registration.status !== 'REGISTERED') {
      this.logger.trace(`OIAnalytics not registered. OIBus won't retrieve commands`);
      return;
    }

    if (this.isRetrievingCommands) {
      this.logger.warn(
        `OIBus is already retrieving commands from OIAnalytics. Increase refresh interval (currently ${registration.commandRefreshInterval} seconds)`
      );
      this.refreshCommandsTimeout = setTimeout(this.refreshCommands.bind(this), registration.commandRefreshInterval * 1000);
      return;
    }
    this.isRetrievingCommands = true;

    try {
      // First, check if the commands already retrieved have been canceled
      await this.checkForCancelledCommands(registration);
      // Second, retrieve commands from OIAnalytics
      await this.fetchNewCommands(registration);
      // Third, acknowledge commands whose execution has completed
      await this.acknowledgeCommands(registration);
    } catch (error: unknown) {
      this.isRetrievingCommands = false;
      this.logger.error(getErrorMessage(error));
      this.refreshCommandsTimeout = setTimeout(this.refreshCommands.bind(this), registration.commandRetryInterval * 1000);
      return;
    }

    this.isRetrievingCommands = false;
    this.refreshCommandsTimeout = setTimeout(this.refreshCommands.bind(this), registration.commandRefreshInterval * 1000);
    this.commandEvent.emit('next');
  }

  async acknowledgeCommands(registration: OIAnalyticsRegistration): Promise<void> {
    const commandsToAck = this.oIAnalyticsCommandRepository.list({
      status: [],
      types: [],
      ack: false,
      start: undefined,
      end: undefined
    });
    if (commandsToAck.length === 0) {
      this.logger.trace('No command to ack');
      return;
    }

    for (const command of commandsToAck) {
      try {
        await this.oIAnalyticsClient.updateCommandStatus(registration, JSON.stringify([command]));
        this.oIAnalyticsCommandRepository.markAsAcknowledged(command.id);
        this.logger.trace(`Command ${command.id} of type ${command.type} acknowledged`);
      } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        this.logger.error(`Error while acknowledging command ${command.id} of type ${command.type}: ${errorMessage}`);
        if (errorMessage.startsWith('404 - ')) {
          this.oIAnalyticsCommandRepository.markAsAcknowledged(command.id);
        }
      }
    }
  }

  /**
   * Check if retrieved commands have been canceled on OIAnalytics before running them
   */
  async checkForCancelledCommands(registration: OIAnalyticsRegistration): Promise<void> {
    const pendingCommands = this.oIAnalyticsCommandRepository.list({
      status: ['RETRIEVED'],
      types: [],
      ack: undefined,
      start: undefined,
      end: undefined
    });
    if (pendingCommands.length === 0) {
      this.logger.trace('No command retrieved to check');
      return;
    }
    try {
      const commandsToCancel = await this.oIAnalyticsClient.retrieveCancelledCommands(registration, pendingCommands);
      if (commandsToCancel.length > 0) {
        this.logger.trace(`${commandsToCancel.length} commands cancelled among the ${pendingCommands.length} pending commands`);
        for (const command of commandsToCancel) {
          this.oIAnalyticsCommandRepository.cancel(command.id);
        }
      }
    } catch (error: unknown) {
      throw new Error(`Error while checking PENDING commands status: ${getErrorMessage(error)}`);
    }
  }

  async fetchNewCommands(registration: OIAnalyticsRegistration): Promise<void> {
    try {
      const newCommands = await this.oIAnalyticsClient.retrievePendingCommands(registration);
      if (newCommands.length > 0) {
        this.logger.trace(`${newCommands.length} commands to add`);
        for (const command of newCommands) {
          this.oIAnalyticsCommandRepository.create(command);
        }
      }
    } catch (error: unknown) {
      throw new Error(`Error while retrieving commands: ${getErrorMessage(error)}`);
    }
  }

  async processNextCommand(): Promise<void> {
    if (this.stopped) return;
    if (this.isExecutingCommand) {
      this.logger.trace(`A command is already being executed`);
      return;
    }

    const registration = this.oIAnalyticsRegistrationService.getRegistrationSettings()!;
    if (registration.status !== 'REGISTERED') {
      this.logger.trace(`OIAnalytics not registered. OIBus won't retrieve commands`);
      return;
    }

    const command = this.oIAnalyticsCommandRepository.findFirstToExecute();
    if (!command) {
      this.logger.trace(`No command to execute`);
      return;
    }

    const engineSettings = this.oIBusService.getEngineSettings();
    if (command.targetVersion !== engineSettings.version) {
      this.oIAnalyticsCommandRepository.markAsErrored(
        command.id,
        `Wrong target version: ${command.targetVersion} for OIBus version ${engineSettings.version}`
      );
      this.commandEvent.emit('next');
      return;
    }

    if (!this.checkCommandPermission(command, registration)) {
      this.oIAnalyticsCommandRepository.markAsErrored(command.id, `Command ${command.id} of type ${command.type} is not authorized`);
      this.commandEvent.emit('next');
      return;
    }

    this.isExecutingCommand = true;
    this.oIAnalyticsCommandRepository.markAsRunning(command.id);
    this.logger.info(`Executing command ${command.type} (${command.id})`);
    try {
      switch (command.type) {
        case 'update-version':
          await this.executeUpdateVersionCommand(command, registration);
          break;
        case 'restart-engine':
          await this.executeRestartCommand(command);
          break;
        case 'regenerate-cipher-keys':
          await this.executeRegenerateCipherKeysCommand(command);
          break;
        case 'update-engine-settings':
          {
            const privateKey = await encryptionService.decryptText(registration.privateCipherKey!);
            await this.executeUpdateEngineSettingsCommand(command, privateKey);
          }
          break;
        case 'update-registration-settings':
          await this.executeUpdateRegistrationSettingsCommand(command, registration);
          break;
        case 'create-scan-mode':
          await this.executeCreateScanModeCommand(command);
          break;
        case 'update-scan-mode':
          await this.executeUpdateScanModeCommand(command);
          break;
        case 'delete-scan-mode':
          await this.executeDeleteScanModeCommand(command);
          break;
        case 'create-ip-filter':
          await this.executeCreateIPFilterCommand(command);
          break;
        case 'update-ip-filter':
          await this.executeUpdateIPFilterCommand(command);
          break;
        case 'delete-ip-filter':
          await this.executeDeleteIPFilterCommand(command);
          break;
        case 'create-certificate':
          await this.executeCreateCertificateCommand(command);
          break;
        case 'update-certificate':
          await this.executeUpdateCertificateCommand(command);
          break;
        case 'delete-certificate':
          await this.executeDeleteCertificateCommand(command);
          break;
        case 'create-south':
          {
            const privateKey = await encryptionService.decryptText(registration.privateCipherKey!);
            await this.executeCreateSouthCommand(command, privateKey);
          }
          break;
        case 'update-south':
          {
            const privateKey = await encryptionService.decryptText(registration.privateCipherKey!);
            await this.executeUpdateSouthCommand(command, privateKey);
          }
          break;
        case 'delete-south':
          await this.executeDeleteSouthCommand(command);
          break;
        case 'create-or-update-south-items-from-csv':
          await this.executeCreateOrUpdateSouthConnectorItemsFromCSVCommand(command);
          break;
        case 'test-south-connection':
          {
            const privateKey = encryptionService.decryptText(registration.privateCipherKey!);
            await withTimeout(this.executeTestSouthConnectionCommand(command, privateKey), TEST_COMMAND_TIMEOUT_MS, command.type);
          }
          break;
        case 'test-south-item':
          {
            const privateKey = encryptionService.decryptText(registration.privateCipherKey!);
            await withTimeout(this.executeTestSouthItemCommand(command, privateKey), TEST_COMMAND_TIMEOUT_MS, command.type);
          }
          break;
        case 'create-north':
          {
            const privateKey = encryptionService.decryptText(registration.privateCipherKey!);
            await this.executeCreateNorthCommand(command, privateKey);
          }
          break;
        case 'update-north':
          {
            const privateKey = encryptionService.decryptText(registration.privateCipherKey!);
            await this.executeUpdateNorthCommand(command, privateKey);
          }
          break;
        case 'delete-north':
          await this.executeDeleteNorthCommand(command);
          break;
        case 'test-north-connection':
          {
            const privateKey = encryptionService.decryptText(registration.privateCipherKey!);
            await withTimeout(this.executeTestNorthConnectionCommand(command, privateKey), TEST_COMMAND_TIMEOUT_MS, command.type);
          }
          break;
        case 'create-history-query':
          {
            const privateKey = encryptionService.decryptText(registration.privateCipherKey!);
            await this.executeCreateHistoryQueryCommand(command, privateKey);
          }
          break;
        case 'update-history-query':
          {
            const privateKey = encryptionService.decryptText(registration.privateCipherKey!);
            await this.executeUpdateHistoryQueryCommand(command, privateKey);
          }
          break;
        case 'delete-history-query':
          await this.executeDeleteHistoryQueryCommand(command);
          break;
        case 'create-or-update-history-query-south-items-from-csv':
          await this.executeCreateOrUpdateHistoryQuerySouthItemsFromCSVCommand(command);
          break;
        case 'test-history-query-north-connection':
          {
            const privateKey = encryptionService.decryptText(registration.privateCipherKey!);
            await withTimeout(
              this.executeTestHistoryQueryNorthConnectionCommand(command, privateKey),
              TEST_COMMAND_TIMEOUT_MS,
              command.type
            );
          }
          break;
        case 'test-history-query-south-connection':
          {
            const privateKey = encryptionService.decryptText(registration.privateCipherKey!);
            await withTimeout(
              this.executeTestHistoryQuerySouthConnectionCommand(command, privateKey),
              TEST_COMMAND_TIMEOUT_MS,
              command.type
            );
          }
          break;
        case 'test-history-query-south-item':
          {
            const privateKey = encryptionService.decryptText(registration.privateCipherKey!);
            await withTimeout(this.executeTestHistoryQuerySouthItemCommand(command, privateKey), TEST_COMMAND_TIMEOUT_MS, command.type);
          }
          break;
        case 'update-history-query-status':
          await this.executeUpdateHistoryQueryStatusCommand(command);
          break;
        case 'setpoint':
          await this.executeSetpointCommand(command);
          break;
        case 'search-north-cache-content':
          await this.executeSearchNorthCacheContentCommand(command);
          break;
        case 'search-history-cache-content':
          await this.executeSearchHistoryCacheContentCommand(command);
          break;
        case 'get-north-cache-file-content':
          await this.executeGetNorthCacheFileContentCommand(command);
          break;
        case 'get-history-cache-file-content':
          await this.executeGetHistoryCacheFileContentCommand(command);
          break;
        case 'update-north-cache-content':
          await this.executeUpdateNorthCacheContentCommand(command);
          break;
        case 'update-history-cache-content':
          await this.executeUpdateHistoryCacheContentCommand(command);
          break;
        case 'create-custom-transformer':
          await this.executeCreateCustomTransformerCommand(command);
          break;
        case 'update-custom-transformer':
          await this.executeUpdateCustomTransformerCommand(command);
          break;
        case 'delete-custom-transformer':
          await this.executeDeleteCustomTransformerCommand(command);
          break;
        case 'test-custom-transformer':
          await withTimeout(this.executeTestCustomTransformerConnectionCommand(command), TEST_COMMAND_TIMEOUT_MS, command.type);
          break;
      }
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(
        `Error while executing command ${command.id} (retrieved ${command.retrievedDate}) of type ${command.type}. Error: ${errorMessage}`
      );
      this.oIAnalyticsCommandRepository.markAsErrored(command.id, errorMessage);
    }
    this.isExecutingCommand = false;

    this.commandEvent.emit('next');
    await this.enqueueAck(command);
  }

  /**
   * Stop services and timer
   */
  stop(): void {
    this.logger.debug(`Stopping OIAnalytics command service...`);
    this.stopped = true;
    this.commandEvent.removeAllListeners();
    if (this.refreshCommandsTimeout) {
      clearTimeout(this.refreshCommandsTimeout);
      this.refreshCommandsTimeout = null;
    }
    if (this.ackRetryTimeout) {
      clearTimeout(this.ackRetryTimeout);
      this.ackRetryTimeout = null;
    }
    this.logger.debug(`OIAnalytics command service stopped`);
  }

  private async executeUpdateVersionCommand(command: OIBusUpdateVersionCommand, registration: OIAnalyticsRegistration) {
    if (this.ignoreRemoteUpdate) {
      throw new Error(`OIBus is not set up to execute remote update`);
    }

    const runStart = DateTime.now();
    const engineSettings = this.oIBusService.getEngineSettings()!;
    const oibusInfo = getOIBusInfo(engineSettings);

    this.logger.info(
      `Upgrading OIBus from ${oibusInfo.version} to ${command.commandContent.version} for platform ${oibusInfo.platform} and architecture ${oibusInfo.architecture}...`
    );
    const filename = path.resolve(this.binaryFolder, '..', `oibus-${oibusInfo.platform}_${oibusInfo.architecture}.zip`);
    const updateDir = path.resolve(this.binaryFolder, '..', 'update');

    await this.oIAnalyticsClient.downloadFile(registration, command.commandContent.assetId, filename);
    this.logger.trace(`File ${filename} downloaded`);
    try {
      await unzip(filename, updateDir);
      this.logger.trace(`File ${filename} unzipped`);
    } finally {
      await fs.unlink(filename).catch(err => this.logger.error(`Could not delete zip file ${filename}: ${(err as Error).message}`));
    }
    this.logger.trace(`File ${filename} removed`);

    const duration = DateTime.now().toMillis() - runStart.toMillis();
    try {
      if (command.commandContent.updateLauncher) {
        this.logger.info(`Updating OIBus launcher`);
        const extension = os.type() === 'Windows_NT' ? '.exe' : '';
        const launcherPath = path.resolve(this.binaryFolder, '..', `oibus-launcher${extension}`);
        const launcherBackupPath = path.resolve(this.binaryFolder, '..', `oibus-launcher_backup${extension}`);
        await fs.rename(launcherPath, launcherBackupPath);
        try {
          await fs.rename(path.resolve(updateDir, `oibus-launcher${extension}`), launcherPath);
        } catch (err) {
          await fs
            .rename(launcherBackupPath, launcherPath)
            .catch(restoreErr => this.logger.error(`Could not restore launcher backup: ${(restoreErr as Error).message}`));
          throw err;
        }
      }
      await fs.writeFile(path.resolve(this.binaryFolder, '..', UPDATE_SETTINGS_FILE), JSON.stringify(command.commandContent));
    } catch (err) {
      await fs
        .rm(updateDir, { recursive: true, force: true })
        .catch(rmErr => this.logger.error(`Could not clean update directory: ${(rmErr as Error).message}`));
      throw err;
    }

    this.logger.info(
      `OIBus version ${command.commandContent.version} downloaded after ${duration} ms of execution. Restarting OIBus to upgrade...`
    );
    await delay(1500);
    if (command.commandContent.updateLauncher) {
      process.kill(process.ppid, 'SIGTERM'); // or 'SIGKILL' for forceful termination
    } else {
      process.exit();
    }
  }

  private async executeRegenerateCipherKeysCommand(command: OIBusRegenerateCipherKeysCommand) {
    this.logger.info(`Reloading OIAnalytics keys...`);

    // Generate RSA key pair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: 'spki', // Recommended format for public key
        format: 'pem' // Output format for the key
      },
      privateKeyEncoding: {
        type: 'pkcs8', // Recommended format for private key
        format: 'pem' // Output format for the key
      }
    });
    await this.oIAnalyticsRegistrationService.updateKeys(privateKey, publicKey);
    this.oIAnalyticsMessageService.createFullConfigMessageIfNotPending();
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'OIAnalytics keys reloaded');
  }

  private async executeRestartCommand(command: OIBusRestartEngineCommand) {
    this.logger.info(`Restarting OIBus...`);
    await delay(1500);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), `OIBus restarted`);
    process.exit();
  }

  private async executeUpdateEngineSettingsCommand(command: OIBusUpdateEngineSettingsCommand, privateKey: string) {
    command.commandContent.logParameters.loki.password = command.commandContent.logParameters.loki.password
      ? await encryptionService.decryptTextWithPrivateKey(command.commandContent.logParameters.loki.password, privateKey)
      : '';
    await this.oIBusService.updateEngineSettings(command.commandContent, 'oianalytics');
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'Engine settings updated successfully');
  }

  private async executeUpdateRegistrationSettingsCommand(
    command: OIBusUpdateRegistrationSettingsCommand,
    registration: OIAnalyticsRegistration
  ) {
    const registrationCommand: OIAnalyticsRegistrationEditCommand = {
      host: registration.host,
      useProxy: registration.useProxy,
      proxyUrl: registration.proxyUrl,
      proxyUsername: registration.proxyUsername,
      proxyPassword: '', // Won't update password in editConnectionSettings method
      useApiGateway: registration.useApiGateway,
      apiGatewayHeaderKey: registration.apiGatewayHeaderKey,
      apiGatewayHeaderValue: '', // Won't update secret in editConnectionSettings method
      apiGatewayBaseEndpoint: registration.apiGatewayBaseEndpoint,
      acceptUnauthorized: registration.acceptUnauthorized,
      commandRefreshInterval: command.commandContent.commandRefreshInterval,
      commandRetryInterval: command.commandContent.commandRetryInterval,
      messageRetryInterval: command.commandContent.messageRetryInterval,
      commandPermissions: {
        // only update permissions if enabled, otherwise, it can only be enabled from OIBus
        updateVersion: registration.commandPermissions.updateVersion
          ? command.commandContent.commandPermissions.updateVersion
          : registration.commandPermissions.updateVersion,
        restartEngine: registration.commandPermissions.restartEngine
          ? command.commandContent.commandPermissions.restartEngine
          : registration.commandPermissions.restartEngine,
        regenerateCipherKeys: registration.commandPermissions.regenerateCipherKeys
          ? command.commandContent.commandPermissions.regenerateCipherKeys
          : registration.commandPermissions.regenerateCipherKeys,
        updateEngineSettings: registration.commandPermissions.updateEngineSettings
          ? command.commandContent.commandPermissions.updateEngineSettings
          : registration.commandPermissions.updateEngineSettings,
        updateRegistrationSettings: registration.commandPermissions.updateRegistrationSettings
          ? command.commandContent.commandPermissions.updateRegistrationSettings
          : registration.commandPermissions.updateRegistrationSettings,
        createScanMode: registration.commandPermissions.createScanMode
          ? command.commandContent.commandPermissions.createScanMode
          : registration.commandPermissions.createScanMode,
        updateScanMode: registration.commandPermissions.updateScanMode
          ? command.commandContent.commandPermissions.updateScanMode
          : registration.commandPermissions.updateScanMode,
        deleteScanMode: registration.commandPermissions.deleteScanMode
          ? command.commandContent.commandPermissions.deleteScanMode
          : registration.commandPermissions.deleteScanMode,
        createIpFilter: registration.commandPermissions.createIpFilter
          ? command.commandContent.commandPermissions.createIpFilter
          : registration.commandPermissions.createIpFilter,
        updateIpFilter: registration.commandPermissions.updateIpFilter
          ? command.commandContent.commandPermissions.updateIpFilter
          : registration.commandPermissions.updateIpFilter,
        deleteIpFilter: registration.commandPermissions.deleteIpFilter
          ? command.commandContent.commandPermissions.deleteIpFilter
          : registration.commandPermissions.deleteIpFilter,
        createCertificate: registration.commandPermissions.createCertificate
          ? command.commandContent.commandPermissions.createCertificate
          : registration.commandPermissions.createCertificate,
        updateCertificate: registration.commandPermissions.updateCertificate
          ? command.commandContent.commandPermissions.updateCertificate
          : registration.commandPermissions.updateCertificate,
        deleteCertificate: registration.commandPermissions.deleteCertificate
          ? command.commandContent.commandPermissions.deleteCertificate
          : registration.commandPermissions.deleteCertificate,
        createHistoryQuery: registration.commandPermissions.createHistoryQuery
          ? command.commandContent.commandPermissions.createHistoryQuery
          : registration.commandPermissions.createHistoryQuery,
        updateHistoryQuery: registration.commandPermissions.updateHistoryQuery
          ? command.commandContent.commandPermissions.updateHistoryQuery
          : registration.commandPermissions.updateHistoryQuery,
        deleteHistoryQuery: registration.commandPermissions.deleteHistoryQuery
          ? command.commandContent.commandPermissions.deleteHistoryQuery
          : registration.commandPermissions.deleteHistoryQuery,
        createOrUpdateHistoryItemsFromCsv: registration.commandPermissions.createOrUpdateHistoryItemsFromCsv
          ? command.commandContent.commandPermissions.createOrUpdateHistoryItemsFromCsv
          : registration.commandPermissions.createOrUpdateHistoryItemsFromCsv,
        testHistoryNorthConnection: registration.commandPermissions.testHistoryNorthConnection
          ? command.commandContent.commandPermissions.testHistoryNorthConnection
          : registration.commandPermissions.testHistoryNorthConnection,
        testHistorySouthConnection: registration.commandPermissions.testHistorySouthConnection
          ? command.commandContent.commandPermissions.testHistorySouthConnection
          : registration.commandPermissions.testHistorySouthConnection,
        testHistorySouthItem: registration.commandPermissions.testHistorySouthItem
          ? command.commandContent.commandPermissions.testHistorySouthItem
          : registration.commandPermissions.testHistorySouthItem,
        createSouth: registration.commandPermissions.createSouth
          ? command.commandContent.commandPermissions.createSouth
          : registration.commandPermissions.createSouth,
        updateSouth: registration.commandPermissions.updateSouth
          ? command.commandContent.commandPermissions.updateSouth
          : registration.commandPermissions.updateSouth,
        deleteSouth: registration.commandPermissions.deleteSouth
          ? command.commandContent.commandPermissions.deleteSouth
          : registration.commandPermissions.deleteSouth,
        createOrUpdateSouthItemsFromCsv: registration.commandPermissions.createOrUpdateSouthItemsFromCsv
          ? command.commandContent.commandPermissions.createOrUpdateSouthItemsFromCsv
          : registration.commandPermissions.createOrUpdateSouthItemsFromCsv,
        testSouthConnection: registration.commandPermissions.testSouthConnection
          ? command.commandContent.commandPermissions.testSouthConnection
          : registration.commandPermissions.testSouthConnection,
        testSouthItem: registration.commandPermissions.testSouthItem
          ? command.commandContent.commandPermissions.testSouthItem
          : registration.commandPermissions.testSouthItem,
        createNorth: registration.commandPermissions.createNorth
          ? command.commandContent.commandPermissions.createNorth
          : registration.commandPermissions.createNorth,
        updateNorth: registration.commandPermissions.updateNorth
          ? command.commandContent.commandPermissions.updateNorth
          : registration.commandPermissions.updateNorth,
        deleteNorth: registration.commandPermissions.deleteNorth
          ? command.commandContent.commandPermissions.deleteNorth
          : registration.commandPermissions.deleteNorth,
        testNorthConnection: registration.commandPermissions.testNorthConnection
          ? command.commandContent.commandPermissions.testNorthConnection
          : registration.commandPermissions.testNorthConnection,
        setpoint: registration.commandPermissions.setpoint
          ? command.commandContent.commandPermissions.setpoint
          : registration.commandPermissions.setpoint,
        searchNorthCacheContent: registration.commandPermissions.searchNorthCacheContent
          ? command.commandContent.commandPermissions.searchNorthCacheContent
          : registration.commandPermissions.searchNorthCacheContent,
        getNorthCacheFileContent: registration.commandPermissions.getNorthCacheFileContent
          ? command.commandContent.commandPermissions.getNorthCacheFileContent
          : registration.commandPermissions.getNorthCacheFileContent,
        updateNorthCacheContent: registration.commandPermissions.updateNorthCacheContent
          ? command.commandContent.commandPermissions.updateNorthCacheContent
          : registration.commandPermissions.updateNorthCacheContent,
        searchHistoryCacheContent: registration.commandPermissions.searchHistoryCacheContent
          ? command.commandContent.commandPermissions.searchHistoryCacheContent
          : registration.commandPermissions.searchHistoryCacheContent,
        getHistoryCacheFileContent: registration.commandPermissions.getHistoryCacheFileContent
          ? command.commandContent.commandPermissions.getHistoryCacheFileContent
          : registration.commandPermissions.getHistoryCacheFileContent,
        updateHistoryCacheContent: registration.commandPermissions.updateHistoryCacheContent
          ? command.commandContent.commandPermissions.updateHistoryCacheContent
          : registration.commandPermissions.updateHistoryCacheContent,
        createCustomTransformer: registration.commandPermissions.createCustomTransformer
          ? command.commandContent.commandPermissions.createCustomTransformer
          : registration.commandPermissions.createCustomTransformer,
        updateCustomTransformer: registration.commandPermissions.updateCustomTransformer
          ? command.commandContent.commandPermissions.updateCustomTransformer
          : registration.commandPermissions.updateCustomTransformer,
        deleteCustomTransformer: registration.commandPermissions.deleteCustomTransformer
          ? command.commandContent.commandPermissions.deleteCustomTransformer
          : registration.commandPermissions.deleteCustomTransformer,
        testCustomTransformer: registration.commandPermissions.testCustomTransformer
          ? command.commandContent.commandPermissions.testCustomTransformer
          : registration.commandPermissions.testCustomTransformer
      }
    };
    await this.oIAnalyticsRegistrationService.editRegistrationSettings(registrationCommand, 'oianalytics');

    this.oIAnalyticsCommandRepository.markAsCompleted(
      command.id,
      DateTime.now().toUTC().toISO(),
      'Registration settings updated successfully'
    );
  }

  private async executeCreateScanModeCommand(command: OIBusCreateScanModeCommand) {
    await this.scanModeService.create(command.commandContent, 'oianalytics');
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'Scan mode created successfully');
  }

  private async executeUpdateScanModeCommand(command: OIBusUpdateScanModeCommand) {
    await this.scanModeService.update(command.scanModeId, command.commandContent, 'oianalytics');
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'Scan mode updated successfully');
  }

  private async executeDeleteScanModeCommand(command: OIBusDeleteScanModeCommand) {
    await this.scanModeService.delete(command.scanModeId);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'Scan mode deleted successfully');
  }

  private async executeCreateIPFilterCommand(command: OIBusCreateIPFilterCommand) {
    await this.ipFilterService.create(command.commandContent, 'oianalytics');
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'IP Filter created successfully');
  }

  private async executeUpdateIPFilterCommand(command: OIBusUpdateIPFilterCommand) {
    await this.ipFilterService.update(command.ipFilterId, command.commandContent, 'oianalytics');
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'IP Filter updated successfully');
  }

  private async executeDeleteIPFilterCommand(command: OIBusDeleteIPFilterCommand) {
    await this.ipFilterService.delete(command.ipFilterId);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'IP Filter deleted successfully');
  }

  private async executeCreateCertificateCommand(command: OIBusCreateCertificateCommand) {
    await this.certificateService.create(command.commandContent, 'oianalytics');
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'Certificate created successfully');
  }

  private async executeUpdateCertificateCommand(command: OIBusUpdateCertificateCommand) {
    await this.certificateService.update(command.certificateId, command.commandContent, 'oianalytics');
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'Certificate updated successfully');
  }

  private async executeDeleteCertificateCommand(command: OIBusDeleteCertificateCommand) {
    await this.certificateService.delete(command.certificateId);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'Certificate deleted successfully');
  }

  private async decryptSouthSettings(
    command: OIBusCreateSouthConnectorCommand | OIBusUpdateSouthConnectorCommand | OIBusTestSouthConnectorCommand,
    privateKey: string
  ) {
    const manifest = this.southService.listManifest().find(element => element.id === command.commandContent.type)!;
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    command.commandContent.settings = await encryptionService.decryptSecretsWithPrivateKey(
      command.commandContent.settings,
      manifest.settings,
      privateKey
    );
    // Type assertion is safe because we know the items match the connector type at runtime
    command.commandContent.items = (await Promise.all(
      command.commandContent.items.map(async item => ({
        id: item.id,
        enabled: item.enabled,
        name: item.name,
        settings: await encryptionService.decryptSecretsWithPrivateKey(item.settings, itemSettingsManifest, privateKey),
        scanModeId: item.scanModeId,
        scanModeName: item.scanModeName,
        groupId: item.groupId,
        groupName: item.groupName,
        syncWithGroup: item.syncWithGroup,
        maxReadInterval: item.maxReadInterval,
        readDelay: item.readDelay,
        startTimeOffset: item.startTimeOffset,
        endTimeOffset: item.endTimeOffset
      }))
    )) as typeof command.commandContent.items;
  }

  private async decryptSouthItemSettings(command: OIBusTestSouthConnectorItemCommand, privateKey: string) {
    const manifest = this.southService.listManifest().find(element => element.id === command.commandContent.southCommand.type)!;
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    command.commandContent.southCommand.settings = await encryptionService.decryptSecretsWithPrivateKey(
      command.commandContent.southCommand.settings,
      manifest.settings,
      privateKey
    );
    command.commandContent.itemCommand.settings = await encryptionService.decryptSecretsWithPrivateKey(
      command.commandContent.itemCommand.settings,
      itemSettingsManifest,
      privateKey
    );
  }

  private async executeCreateSouthCommand(command: OIBusCreateSouthConnectorCommand, privateKey: string) {
    await this.decryptSouthSettings(command, privateKey);
    await this.southService.create(command.commandContent, command.southConnectorId, 'oianalytics');
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'South connector created successfully');
  }

  private async executeUpdateSouthCommand(command: OIBusUpdateSouthConnectorCommand, privateKey: string) {
    await this.decryptSouthSettings(command, privateKey);
    await this.southService.update(command.southConnectorId, command.commandContent, 'oianalytics');
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'South connector updated successfully');
  }

  private async executeDeleteSouthCommand(command: OIBusDeleteSouthConnectorCommand) {
    await this.southService.delete(command.southConnectorId);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'South connector deleted successfully');
  }

  private async executeCreateOrUpdateSouthConnectorItemsFromCSVCommand(command: OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand) {
    const southConnector = this.southService.findById(command.southConnectorId);
    if (!southConnector) {
      throw new Error(`South connector ${command.southConnectorId} not found`);
    }

    const { items, errors } = await this.southService.checkImportItems(
      southConnector.type,
      command.commandContent.csvContent,
      command.commandContent.delimiter,
      command.commandContent.deleteItemsNotPresent
        ? []
        : southConnector.items.map(i => toSouthConnectorItemDTO(i, southConnector.type, (id: string) => ({ id, friendlyName: id })))
    );

    if (errors.length > 0) {
      let stringError = 'Error when checking csv items:';
      for (const error of errors) {
        stringError += `\n${error.item.name}: ${error.error}`;
      }
      throw new Error(stringError);
    }
    // Type assertion is safe because items come from checkImportItems which validates the type
    await this.southService.importItems(
      southConnector.id,
      items.map(item => ({
        id: item.id,
        enabled: item.enabled,
        name: item.name,
        settings: item.settings,
        scanModeId: item.scanMode?.id || null,
        scanModeName: null
      })) as Array<SouthConnectorItemCommandDTO>,
      'oianalytics',
      command.commandContent.deleteItemsNotPresent
    );
    this.oIAnalyticsCommandRepository.markAsCompleted(
      command.id,
      DateTime.now().toUTC().toISO(),
      `${items.length} items imported on South connector ${southConnector.name}`
    );
  }

  private async executeTestSouthConnectionCommand(command: OIBusTestSouthConnectorCommand, privateKey: string) {
    await this.decryptSouthSettings(command, privateKey);
    const result = await this.southService.testSouth(
      command.southConnectorId,
      command.commandContent.type,
      command.commandContent.settings
    );
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), JSON.stringify(result));
  }

  private async executeTestSouthItemCommand(command: OIBusTestSouthConnectorItemCommand, privateKey: string) {
    await this.decryptSouthItemSettings(command, privateKey);

    const result = await this.southService.testItem(
      command.southConnectorId,
      command.commandContent.southCommand.type,
      command.commandContent.itemCommand.name,
      command.commandContent.southCommand.settings,
      command.commandContent.itemCommand.settings,
      command.commandContent.testingSettings
    );
    this.completeTestItemCommand(command, result.transformed ?? result.raw);
  }

  private async decryptNorthSettings(
    command: OIBusCreateNorthConnectorCommand | OIBusUpdateNorthConnectorCommand | OIBusTestNorthConnectorCommand,
    privateKey: string
  ) {
    const manifest = this.northService.listManifest().find(element => element.id === command.commandContent.type)!;
    command.commandContent.settings = await encryptionService.decryptSecretsWithPrivateKey(
      command.commandContent.settings,
      manifest.settings,
      privateKey
    );
  }

  private async executeCreateNorthCommand(command: OIBusCreateNorthConnectorCommand, privateKey: string) {
    await this.decryptNorthSettings(command, privateKey);
    await this.northService.create(command.commandContent, command.northConnectorId, 'oianalytics');
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'North connector created successfully');
  }

  private async executeUpdateNorthCommand(command: OIBusUpdateNorthConnectorCommand, privateKey: string) {
    await this.decryptNorthSettings(command, privateKey);
    await this.northService.update(command.northConnectorId, command.commandContent, 'oianalytics');
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'North connector updated successfully');
  }

  private async executeDeleteNorthCommand(command: OIBusDeleteNorthConnectorCommand) {
    await this.northService.delete(command.northConnectorId);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'North connector deleted successfully');
  }

  private async executeTestNorthConnectionCommand(command: OIBusTestNorthConnectorCommand, privateKey: string) {
    await this.decryptNorthSettings(command, privateKey);
    const result = await this.northService.testNorth(
      command.northConnectorId,
      command.commandContent.type,
      command.commandContent.settings
    );
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), JSON.stringify(result));
  }

  private async decryptHistoryQuerySettings(command: HistoryQueryCommandDTO, privateKey: string) {
    const northManifest = this.northService.listManifest().find(element => element.id === command.northType)!;
    const southManifest = this.southService.listManifest().find(element => element.id === command.southType)!;
    const itemSettingsManifest = southManifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    command.northSettings = await encryptionService.decryptSecretsWithPrivateKey(command.northSettings, northManifest.settings, privateKey);
    command.southSettings = await encryptionService.decryptSecretsWithPrivateKey(command.southSettings, southManifest.settings, privateKey);
    // Type assertion is safe because we know the items match the history query type at runtime
    command.items = (await Promise.all(
      command.items.map(async item => ({
        id: item.id,
        enabled: item.enabled,
        name: item.name,
        settings: await encryptionService.decryptSecretsWithPrivateKey(item.settings, itemSettingsManifest, privateKey)
      }))
    )) as typeof command.items;
  }

  private async decryptHistoryQuerySouthItemSettings(command: OIBusTestHistoryQuerySouthItemCommand, privateKey: string) {
    const manifest = this.southService.listManifest().find(element => element.id === command.commandContent.historyCommand.southType)!;
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    command.commandContent.historyCommand.southSettings = await encryptionService.decryptSecretsWithPrivateKey(
      command.commandContent.historyCommand.southSettings,
      manifest.settings,
      privateKey
    );
    command.commandContent.itemCommand.settings = await encryptionService.decryptSecretsWithPrivateKey(
      command.commandContent.itemCommand.settings,
      itemSettingsManifest,
      privateKey
    );
  }

  private async executeCreateHistoryQueryCommand(command: OIBusCreateHistoryQueryCommand, privateKey: string) {
    await this.decryptHistoryQuerySettings(command.commandContent, privateKey);
    await this.historyQueryService.create(
      command.commandContent,
      command.southConnectorId,
      command.northConnectorId,
      command.historyQueryId,
      'oianalytics'
    );
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'History query created successfully');
  }

  private async executeUpdateHistoryQueryCommand(command: OIBusUpdateHistoryQueryCommand, privateKey: string) {
    await this.decryptHistoryQuerySettings(command.commandContent.historyQuery, privateKey);
    await this.historyQueryService.update(
      command.historyQueryId,
      command.commandContent.historyQuery,
      command.commandContent.resetCache,
      'oianalytics'
    );
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'History query updated successfully');
  }

  private async executeDeleteHistoryQueryCommand(command: OIBusDeleteHistoryQueryCommand) {
    await this.historyQueryService.delete(command.historyQueryId);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'History query deleted successfully');
  }

  private async executeCreateOrUpdateHistoryQuerySouthItemsFromCSVCommand(
    command: OIBusCreateOrUpdateHistoryQuerySouthItemsFromCSVCommand
  ) {
    const historyQuery = this.historyQueryService.findById(command.historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query ${command.historyQueryId} not found`);
    }

    const { items, errors } = await this.historyQueryService.checkImportItems(
      historyQuery.southType,
      command.commandContent.csvContent,
      command.commandContent.delimiter,
      // Type assertion is safe because checkImportItems accepts the union type
      command.commandContent.deleteItemsNotPresent
        ? []
        : historyQuery.items.map(item => toHistoryQueryItemDTO(item, historyQuery.southType, (id: string) => ({ id, friendlyName: id })))
    );

    if (errors.length > 0) {
      let stringError = 'Error when checking csv items:';
      for (const error of errors) {
        stringError += `\n${error.item.name}: ${error.error}`;
      }
      throw new Error(stringError);
    }
    await this.historyQueryService.importItems(historyQuery.id, items, 'oianalytics', command.commandContent.deleteItemsNotPresent);
    this.oIAnalyticsCommandRepository.markAsCompleted(
      command.id,
      DateTime.now().toUTC().toISO(),
      `${items.length} items imported on History query ${historyQuery.name}`
    );
  }

  private async executeTestHistoryQueryNorthConnectionCommand(command: OIBusTestHistoryQueryNorthConnectionCommand, privateKey: string) {
    await this.decryptHistoryQuerySettings(command.commandContent, privateKey);
    const result = await this.historyQueryService.testNorth(
      command.historyQueryId,
      command.commandContent.northType,
      command.northConnectorId,
      command.commandContent.northSettings
    );
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), JSON.stringify(result));
  }

  private async executeTestHistoryQuerySouthConnectionCommand(command: OIBusTestHistoryQuerySouthConnectionCommand, privateKey: string) {
    await this.decryptHistoryQuerySettings(command.commandContent, privateKey);
    const result = await this.historyQueryService.testSouth(
      command.historyQueryId,
      command.commandContent.southType,
      command.southConnectorId,
      command.commandContent.southSettings
    );
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), JSON.stringify(result));
  }

  private async executeTestHistoryQuerySouthItemCommand(command: OIBusTestHistoryQuerySouthItemCommand, privateKey: string) {
    await this.decryptHistoryQuerySouthItemSettings(command, privateKey);

    const result = await this.historyQueryService.testItem(
      command.historyQueryId,
      command.commandContent.historyCommand.southType,
      command.commandContent.itemCommand.name,
      command.southConnectorId,
      command.commandContent.historyCommand.southSettings,
      command.commandContent.itemCommand.settings,
      command.commandContent.testingSettings
    );
    this.completeTestItemCommand(command, result.transformed ?? result.raw);
  }

  private async executeUpdateHistoryQueryStatusCommand(command: OIBusUpdateHistoryQueryStatusCommand) {
    switch (command.commandContent.historyQueryStatus) {
      case 'RUNNING':
        await this.historyQueryService.start(command.historyQueryId);
        this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'History query started');
        break;
      case 'PAUSED':
        await this.historyQueryService.pause(command.historyQueryId);
        this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'History query paused');
        break;
      case 'ERRORED':
      case 'FINISHED':
      case 'PENDING':
        throw new Error(
          `History query status of ${command.historyQueryId} can not be updated to ${command.commandContent.historyQueryStatus}`
        );
    }
  }

  private async executeSetpointCommand(command: OIBusSetpointCommand) {
    await this.northService.executeSetpoint(command.northConnectorId, command.commandContent, result => {
      this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), result);
    });
  }

  private async executeCreateCustomTransformerCommand(command: OIBusCreateCustomTransformerCommand) {
    await this.transformerService.create(command.commandContent, 'oianalytics');
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'Transformer created successfully');
  }

  private async executeUpdateCustomTransformerCommand(command: OIBusUpdateCustomTransformerCommand) {
    await this.transformerService.update(command.transformerId, command.commandContent, 'oianalytics');
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'Transformer updated successfully');
  }

  private async executeDeleteCustomTransformerCommand(command: OIBusDeleteCustomTransformerCommand) {
    await this.transformerService.delete(command.transformerId);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'Transformer deleted successfully');
  }

  private async executeTestCustomTransformerConnectionCommand(command: OIBusTestCustomTransformerCommand) {
    const result = await this.transformerService.test(command.commandContent.command, command.commandContent.testRequest);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), JSON.stringify(result));
  }

  private completeTestItemCommand(
    command: OIBusTestSouthConnectorItemCommand | OIBusTestHistoryQuerySouthItemCommand,
    result: OIBusContent
  ) {
    let truncated = false;
    let totalSize = 0;
    switch (result.type) {
      case 'time-values':
      case 'setpoint':
        totalSize = result.content.length;
        if (result.content.length > 1000) {
          // Only retrieve the first 1000 elements
          truncated = true;
          result.content = result.content.slice(0, 1000);
        }
        break;
      case 'any':
        if (result.content) {
          totalSize = result.content.length;
          if (result.content.length > 1024 * 500) {
            // limit content size to the first 500 KBytes
            truncated = true;
            result.content = result.content.slice(0, 1024 * 500);
          }
        }
        break;
    }
    this.oIAnalyticsCommandRepository.markAsCompleted(
      command.id,
      DateTime.now().toUTC().toISO(),
      JSON.stringify({ ...result, truncated, totalSize })
    );
  }

  async executeSearchNorthCacheContentCommand(command: OIBusSearchNorthCacheContentCommand): Promise<void> {
    const result = await this.oIBusService.searchCacheContent('north', command.northConnectorId, command.commandContent);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), JSON.stringify(result));
  }

  async executeSearchHistoryCacheContentCommand(command: OIBusSearchHistoryCacheContentCommand): Promise<void> {
    const result = await this.oIBusService.searchCacheContent('history', command.historyQueryId, command.commandContent);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), JSON.stringify(result));
  }

  async executeGetNorthCacheFileContentCommand(command: OIBusGetNorthCacheFileContentCommand): Promise<void> {
    const result = await this.oIBusService.getFileFromCache(
      'north',
      command.northConnectorId,
      command.commandContent.folder,
      command.commandContent.filename
    );
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), JSON.stringify(result));
  }

  async executeGetHistoryCacheFileContentCommand(command: OIBusGetHistoryCacheFileContentCommand): Promise<void> {
    const result = await this.oIBusService.getFileFromCache(
      'history',
      command.historyQueryId,
      command.commandContent.folder,
      command.commandContent.filename
    );
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), JSON.stringify(result));
  }

  async executeUpdateNorthCacheContentCommand(command: OIBusUpdateNorthCacheContentCommand): Promise<void> {
    await this.oIBusService.updateCacheContent('north', command.northConnectorId, command.commandContent);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'Cache updated successfully');
  }

  async executeUpdateHistoryCacheContentCommand(command: OIBusUpdateHistoryCacheContentCommand): Promise<void> {
    await this.oIBusService.updateCacheContent('history', command.historyQueryId, command.commandContent);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'Cache updated successfully');
  }

  /**
   * Add a command to the pending ack queue and trigger an immediate flush attempt.
   * If a flush is already in progress or a retry is already scheduled, the new entry
   * will be picked up when that flush runs (either directly or via the retry).
   *
   * NOTE: restart-engine and update-version terminate the process before this is called.
   * Their acks are sent on the next boot by acknowledgeCommands inside refreshCommands.
   */
  private async enqueueAck(command: OIBusCommand): Promise<void> {
    this.ackQueue.set(command.id, command);
    await this.sendPendingAcks();
  }

  /**
   * Send all queued commands to OIAnalytics in a single request.
   *
   * On success: marks each command as acknowledged and removes it from the queue.
   * On 404: treats all as acknowledged (server has already dropped them).
   * On network failure: leaves commands in the queue and schedules a background retry
   *   via setTimeout — the function returns immediately so the process can exit freely.
   *   Commands added to the queue while a retry is pending are sent together on the next flush.
   */
  private async sendPendingAcks(): Promise<void> {
    if (this.stopped) return;
    if (this.ackRetryTimeout) {
      clearTimeout(this.ackRetryTimeout);
      this.ackRetryTimeout = null;
    }

    if (this.ackQueue.size === 0) return;

    const registration = this.oIAnalyticsRegistrationService.getRegistrationSettings()!;
    if (registration.status !== 'REGISTERED') {
      this.logger.trace(`OIAnalytics not registered. OIBus won't ack commands`);
      return;
    }

    this.isAckFlushInProgress = true;

    // Snapshot the current queue and fetch up-to-date statuses from the repository
    const commandIds = [...this.ackQueue.keys()];
    const freshCommands = commandIds.map(id => this.oIAnalyticsCommandRepository.findById(id)).filter((c): c is OIBusCommand => c != null);

    // Drop IDs that no longer exist locally
    for (const id of commandIds) {
      if (!freshCommands.some(c => c.id === id)) {
        this.ackQueue.delete(id);
      }
    }

    if (freshCommands.length === 0) {
      this.isAckFlushInProgress = false;
      return;
    }

    try {
      await this.oIAnalyticsClient.updateCommandStatus(registration, JSON.stringify(freshCommands));
      for (const cmd of freshCommands) {
        this.oIAnalyticsCommandRepository.markAsAcknowledged(cmd.id);
        this.ackQueue.delete(cmd.id);
      }
      this.logger.trace(`${freshCommands.length} command(s) acknowledged`);
      this.isAckFlushInProgress = false;
    } catch (error: unknown) {
      this.isAckFlushInProgress = false;
      const message = getErrorMessage(error);
      if (message.startsWith('404 - ')) {
        for (const cmd of freshCommands) {
          this.oIAnalyticsCommandRepository.markAsAcknowledged(cmd.id);
          this.ackQueue.delete(cmd.id);
        }
        this.logger.trace(`${freshCommands.length} command(s) acknowledged (404 - already removed on server)`);
        return;
      }
      // Network failure: do not mark as acknowledged; keep commands in queue for the retry
      const freshRegistration = this.oIAnalyticsRegistrationService.getRegistrationSettings()!;
      this.logger.error(
        `Error while acknowledging ${freshCommands.length} command(s): ${message}. ` +
          `Retrying in ${freshRegistration.commandRetryInterval}s`
      );
      this.ackRetryTimeout = setTimeout(
        () => this.sendPendingAcks().catch(err => this.logger.error(`Unexpected error in ack flush: ${getErrorMessage(err)}`)),
        freshRegistration.commandRetryInterval * 1000
      );
    }
  }

  private checkCommandPermission(command: OIBusCommand, registration: OIAnalyticsRegistration) {
    switch (command.type) {
      case 'update-version':
        return registration.commandPermissions.updateVersion;
      case 'restart-engine':
        return registration.commandPermissions.restartEngine;
      case 'regenerate-cipher-keys':
        return registration.commandPermissions.regenerateCipherKeys;
      case 'update-engine-settings':
        return registration.commandPermissions.updateEngineSettings;
      case 'update-registration-settings':
        return registration.commandPermissions.updateRegistrationSettings;
      case 'create-scan-mode':
        return registration.commandPermissions.createScanMode;
      case 'update-scan-mode':
        return registration.commandPermissions.updateScanMode;
      case 'delete-scan-mode':
        return registration.commandPermissions.deleteScanMode;
      case 'create-ip-filter':
        return registration.commandPermissions.createIpFilter;
      case 'update-ip-filter':
        return registration.commandPermissions.updateIpFilter;
      case 'delete-ip-filter':
        return registration.commandPermissions.deleteIpFilter;
      case 'create-certificate':
        return registration.commandPermissions.createCertificate;
      case 'update-certificate':
        return registration.commandPermissions.updateCertificate;
      case 'delete-certificate':
        return registration.commandPermissions.deleteCertificate;
      case 'create-north':
        return registration.commandPermissions.createNorth;
      case 'update-north':
        return registration.commandPermissions.updateNorth;
      case 'delete-north':
        return registration.commandPermissions.deleteNorth;
      case 'test-north-connection':
        return registration.commandPermissions.testNorthConnection;
      case 'create-south':
        return registration.commandPermissions.createSouth;
      case 'update-south':
        return registration.commandPermissions.updateSouth;
      case 'delete-south':
        return registration.commandPermissions.deleteSouth;
      case 'test-south-connection':
        return registration.commandPermissions.testSouthConnection;
      case 'test-south-item':
        return registration.commandPermissions.testSouthItem;
      case 'create-or-update-south-items-from-csv':
        return registration.commandPermissions.createOrUpdateSouthItemsFromCsv;
      case 'create-history-query':
        return registration.commandPermissions.createHistoryQuery;
      case 'update-history-query':
        return registration.commandPermissions.updateHistoryQuery;
      case 'delete-history-query':
        return registration.commandPermissions.deleteHistoryQuery;
      case 'test-history-query-north-connection':
        return registration.commandPermissions.testHistoryNorthConnection;
      case 'test-history-query-south-connection':
        return registration.commandPermissions.testHistorySouthConnection;
      case 'test-history-query-south-item':
        return registration.commandPermissions.testHistorySouthItem;
      case 'create-or-update-history-query-south-items-from-csv':
        return registration.commandPermissions.createOrUpdateHistoryItemsFromCsv;
      case 'update-history-query-status':
        return registration.commandPermissions.updateHistoryQuery;
      case 'setpoint':
        return registration.commandPermissions.setpoint;
      case 'search-north-cache-content':
        return registration.commandPermissions.searchNorthCacheContent;
      case 'search-history-cache-content':
        return registration.commandPermissions.searchHistoryCacheContent;
      case 'get-north-cache-file-content':
        return registration.commandPermissions.getNorthCacheFileContent;
      case 'get-history-cache-file-content':
        return registration.commandPermissions.getHistoryCacheFileContent;
      case 'update-north-cache-content':
        return registration.commandPermissions.updateNorthCacheContent;
      case 'update-history-cache-content':
        return registration.commandPermissions.updateHistoryCacheContent;
      case 'create-custom-transformer':
        return registration.commandPermissions.createCustomTransformer;
      case 'update-custom-transformer':
        return registration.commandPermissions.updateCustomTransformer;
      case 'delete-custom-transformer':
        return registration.commandPermissions.deleteCustomTransformer;
      case 'test-custom-transformer':
        return registration.commandPermissions.testCustomTransformer;
    }
  }
}

export const toOIBusCommandDTO = (command: OIBusCommand): OIBusCommandDTO => {
  switch (command.type) {
    case 'update-version':
    case 'restart-engine':
    case 'regenerate-cipher-keys':
    case 'update-engine-settings':
    case 'update-registration-settings':
    case 'create-south':
    case 'update-south':
    case 'delete-south':
    case 'test-south-connection':
    case 'test-south-item':
    case 'create-scan-mode':
    case 'update-scan-mode':
    case 'delete-scan-mode':
    case 'create-ip-filter':
    case 'update-ip-filter':
    case 'delete-ip-filter':
    case 'create-certificate':
    case 'update-certificate':
    case 'delete-certificate':
    case 'create-north':
    case 'update-north':
    case 'delete-north':
    case 'test-north-connection':
    case 'create-or-update-south-items-from-csv':
    case 'create-history-query':
    case 'update-history-query':
    case 'delete-history-query':
    case 'test-history-query-north-connection':
    case 'test-history-query-south-connection':
    case 'test-history-query-south-item':
    case 'create-or-update-history-query-south-items-from-csv':
    case 'update-history-query-status':
    case 'setpoint':
    case 'search-north-cache-content':
    case 'search-history-cache-content':
    case 'get-north-cache-file-content':
    case 'get-history-cache-file-content':
    case 'update-north-cache-content':
    case 'update-history-cache-content':
    case 'create-custom-transformer':
    case 'update-custom-transformer':
    case 'delete-custom-transformer':
    case 'test-custom-transformer':
      return command;
  }
};
