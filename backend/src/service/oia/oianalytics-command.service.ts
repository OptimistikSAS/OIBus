import fs from 'node:fs/promises';
import { delay, getOIBusInfo, unzip } from '../utils';
import { encryptionService } from '../encryption.service';
import pino from 'pino';
import { DateTime } from 'luxon';
import path from 'node:path';
import { version } from '../../../package.json';
import ScanModeService from '../scan-mode.service';
import OIAnalyticsCommandRepository from '../../repository/config/oianalytics-command.repository';
import { OIAnalyticsRegistration, OIAnalyticsRegistrationEditCommand } from '../../model/oianalytics-registration.model';
import OIBusService from '../oibus.service';
import {
  OIBusCommand,
  OIBusCreateCertificateCommand,
  OIBusCreateHistoryQueryCommand,
  OIBusCreateIPFilterCommand,
  OIBusCreateNorthConnectorCommand,
  OIBusCreateOrUpdateHistoryQuerySouthItemsFromCSVCommand,
  OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand,
  OIBusCreateScanModeCommand,
  OIBusCreateSouthConnectorCommand,
  OIBusDeleteCertificateCommand,
  OIBusDeleteHistoryQueryCommand,
  OIBusDeleteIPFilterCommand,
  OIBusDeleteNorthConnectorCommand,
  OIBusDeleteScanModeCommand,
  OIBusDeleteSouthConnectorCommand,
  OIBusRegenerateCipherKeysCommand,
  OIBusRestartEngineCommand,
  OIBusTestHistoryQueryNorthConnectionCommand,
  OIBusTestHistoryQuerySouthConnectionCommand,
  OIBusTestHistoryQuerySouthItemConnectionCommand,
  OIBusTestNorthConnectorCommand,
  OIBusTestSouthConnectorCommand,
  OIBusTestSouthConnectorItemCommand,
  OIBusUpdateCertificateCommand,
  OIBusUpdateEngineSettingsCommand,
  OIBusUpdateHistoryQueryCommand,
  OIBusUpdateHistoryQueryStatusCommand,
  OIBusUpdateIPFilterCommand,
  OIBusUpdateNorthConnectorCommand,
  OIBusUpdateRegistrationSettingsCommand,
  OIBusUpdateScanModeCommand,
  OIBusUpdateSouthConnectorCommand,
  OIBusUpdateVersionCommand
} from '../../model/oianalytics-command.model';
import { CommandSearchParam, OIBusCommandDTO } from '../../../shared/model/command.model';
import { Page } from '../../../shared/model/types';
import SouthService from '../south.service';
import NorthService from '../north.service';
import OIAnalyticsClient from './oianalytics-client.service';
import os from 'node:os';
import crypto from 'node:crypto';
import OIAnalyticsMessageService from './oianalytics-message.service';
import OIAnalyticsRegistrationService from './oianalytics-registration.service';
import { EventEmitter } from 'node:events';
import IPFilterService from '../ip-filter.service';
import CertificateService from '../certificate.service';
import HistoryQueryService from '../history-query.service';
import { HistoryQueryCommandDTO } from '../../../shared/model/history-query.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';

const UPDATE_SETTINGS_FILE = 'update.json';

export default class OIAnalyticsCommandService {
  private retrieveCommandsInterval: NodeJS.Timeout | undefined = undefined;
  private ongoingRetrieveCommands = false;
  private ongoingExecuteCommand = false;
  public commandEvent: EventEmitter = new EventEmitter(); // Used to trigger command execution

  constructor(
    private oIAnalyticsCommandRepository: OIAnalyticsCommandRepository,
    private oIAnalyticsRegistrationService: OIAnalyticsRegistrationService,
    private oIAnalyticsMessageService: OIAnalyticsMessageService,
    private oIAnalyticsClient: OIAnalyticsClient,
    private oIBusService: OIBusService,
    private scanModeService: ScanModeService,
    private ipFilterService: IPFilterService,
    private certificateService: CertificateService,
    private southService: SouthService,
    private northService: NorthService,
    private historyQueryService: HistoryQueryService,
    private logger: pino.Logger,
    private binaryFolder: string,
    private ignoreRemoteUpdate: boolean,
    launcherVersion: string
  ) {
    const engineSettings = this.oIBusService.getEngineSettings();
    const currentUpgradeCommand = this.oIAnalyticsCommandRepository.list({
      status: ['RUNNING'],
      types: ['update-version']
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
    this.retrieveCommandsInterval = setTimeout(
      this.checkCommands.bind(this),
      this.oIAnalyticsRegistrationService.getRegistrationSettings()!.commandRefreshInterval * 1000
    );

    this.oIBusService.loggerEvent.on('updated', (logger: pino.Logger) => {
      this.logger = logger;
    });

    this.oIAnalyticsRegistrationService.registrationEvent.on('updated', () => {
      const registrationSettings = this.oIAnalyticsRegistrationService.getRegistrationSettings()!;
      clearTimeout(this.retrieveCommandsInterval);

      if (registrationSettings.status === 'REGISTERED') {
        this.retrieveCommandsInterval = setTimeout(this.checkCommands.bind(this), registrationSettings.commandRefreshInterval * 1000);
      }
    });

    this.commandEvent.on('next', async () => {
      await this.executeCommand();
    });
    this.commandEvent.emit('next');
  }

  search(searchParams: CommandSearchParam, page: number): Page<OIBusCommand> {
    return this.oIAnalyticsCommandRepository.search(searchParams, page);
  }

  async checkCommands(): Promise<void> {
    const registration = this.oIAnalyticsRegistrationService.getRegistrationSettings()!;
    if (registration.status !== 'REGISTERED') {
      this.logger.trace(`OIAnalytics not registered. OIBus won't retrieve commands`);
      return;
    }

    if (this.ongoingRetrieveCommands) {
      this.logger.trace(`OIBus is already retrieving commands from OIAnalytics`);
      this.retrieveCommandsInterval = setTimeout(this.checkCommands.bind(this), registration.commandRefreshInterval * 1000);
      return;
    }
    this.ongoingRetrieveCommands = true;

    try {
      // First, check if the commands already retrieved have been cancelled
      await this.checkRetrievedCommands(registration);
      // Second, retrieve commands from OIAnalytics
      await this.retrieveCommands(registration);
    } catch (error: unknown) {
      this.ongoingRetrieveCommands = false;
      this.logger.error((error as Error).message);
      this.retrieveCommandsInterval = setTimeout(this.checkCommands.bind(this), registration.commandRetryInterval * 1000);
      return;
    }
    try {
      await this.sendAckCommands(registration);
    } catch (error: unknown) {
      this.logger.error((error as Error).message);
    }
    this.ongoingRetrieveCommands = false;
    this.commandEvent.emit('next');
    this.retrieveCommandsInterval = setTimeout(this.checkCommands.bind(this), registration.commandRefreshInterval * 1000);
  }

  async sendAckCommands(registration: OIAnalyticsRegistration): Promise<void> {
    const commandsToAck = this.oIAnalyticsCommandRepository.list({
      status: [],
      types: [],
      ack: false
    });
    if (commandsToAck.length === 0) {
      this.logger.trace('No command to ack');
      return;
    }

    try {
      await this.oIAnalyticsClient.updateCommandStatus(registration, JSON.stringify(commandsToAck));
      for (const command of commandsToAck) {
        this.oIAnalyticsCommandRepository.markAsAcknowledged(command.id);
      }
      this.logger.trace(`${commandsToAck.length} commands acknowledged`);
    } catch (error: unknown) {
      throw new Error(`Error while acknowledging ${commandsToAck.length} commands: ${(error as Error).message}`);
    }
  }

  /**
   * Check if retrieved commands have been cancelled on OIAnalytics before running them
   */
  async checkRetrievedCommands(registration: OIAnalyticsRegistration): Promise<void> {
    const pendingCommands = this.oIAnalyticsCommandRepository.list({ status: ['RETRIEVED'], types: [] });
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
      throw new Error(`Error while checking PENDING commands status: ${(error as Error).message}`);
    }
  }

  async retrieveCommands(registration: OIAnalyticsRegistration): Promise<void> {
    try {
      const newCommands = await this.oIAnalyticsClient.retrievePendingCommands(registration);
      if (newCommands.length > 0) {
        this.logger.trace(`${newCommands.length} commands to add`);
        for (const command of newCommands) {
          this.oIAnalyticsCommandRepository.create(command);
        }
      }
    } catch (error: unknown) {
      throw new Error(`Error while retrieving commands: ${(error as Error).message}`);
    }
  }

  async executeCommand(): Promise<void> {
    const registration = this.oIAnalyticsRegistrationService.getRegistrationSettings()!;
    if (registration.status !== 'REGISTERED') {
      this.logger.trace(`OIAnalytics not registered. OIBus won't retrieve commands`);
      return;
    }

    if (this.ongoingExecuteCommand) {
      this.logger.trace(`A command is already being executed`);
      return;
    }

    // Retrieve stored commands, already retrieved from OIAnalytics
    const commandsToExecute = this.oIAnalyticsCommandRepository.list({
      status: ['RETRIEVED', 'RUNNING'],
      types: []
    });
    if (commandsToExecute.length === 0) {
      this.logger.trace(`No command to execute`);
      return;
    }
    const engineSettings = this.oIBusService.getEngineSettings();
    const command = commandsToExecute[0];

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
    this.ongoingExecuteCommand = true;
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
            const privateKey = await encryptionService.decryptText(registration.privateCipherKey!);
            await this.executeTestSouthConnectionCommand(command, privateKey);
          }
          break;
        case 'test-south-item':
          {
            const privateKey = await encryptionService.decryptText(registration.privateCipherKey!);
            await this.executeTestSouthItemCommand(command, privateKey);
          }
          break;
        case 'create-north':
          {
            const privateKey = await encryptionService.decryptText(registration.privateCipherKey!);
            await this.executeCreateNorthCommand(command, privateKey);
          }
          break;
        case 'update-north':
          {
            const privateKey = await encryptionService.decryptText(registration.privateCipherKey!);
            await this.executeUpdateNorthCommand(command, privateKey);
          }
          break;
        case 'delete-north':
          await this.executeDeleteNorthCommand(command);
          break;
        case 'test-north-connection':
          {
            const privateKey = await encryptionService.decryptText(registration.privateCipherKey!);
            await this.executeTestNorthConnectionCommand(command, privateKey);
          }
          break;
        case 'create-history-query':
          {
            const privateKey = await encryptionService.decryptText(registration.privateCipherKey!);
            await this.executeCreateHistoryQueryCommand(command, privateKey);
          }
          break;
        case 'update-history-query':
          {
            const privateKey = await encryptionService.decryptText(registration.privateCipherKey!);
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
            const privateKey = await encryptionService.decryptText(registration.privateCipherKey!);
            await this.executeTestHistoryQueryNorthConnectionCommand(command, privateKey);
          }
          break;
        case 'test-history-query-south-connection':
          {
            const privateKey = await encryptionService.decryptText(registration.privateCipherKey!);
            await this.executeTestHistoryQuerySouthConnectionCommand(command, privateKey);
          }
          break;
        case 'test-history-query-south-item':
          {
            const privateKey = await encryptionService.decryptText(registration.privateCipherKey!);
            await this.executeTestHistoryQuerySouthItemCommand(command, privateKey);
          }
          break;
        case 'update-history-query-status':
          await this.executeUpdateHistoryQueryStatusCommand(command);
          break;
      }
    } catch (error: unknown) {
      this.ongoingExecuteCommand = false;
      this.logger.error(
        `Error while executing command ${command.id} (retrieved ${command.retrievedDate}) of type ${command.type}. Error: ${(error as Error).message}`
      );
      this.oIAnalyticsCommandRepository.markAsErrored(command.id, (error as Error).message);
      this.commandEvent.emit('next');
      return;
    }
    this.ongoingExecuteCommand = false;
    this.commandEvent.emit('next');
  }

  /**
   * Stop services and timer
   */
  async stop(): Promise<void> {
    this.logger.debug(`Stopping OIAnalytics command service...`);
    clearTimeout(this.retrieveCommandsInterval);
    this.retrieveCommandsInterval = undefined;
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

    await this.oIAnalyticsClient.downloadFile(registration, command.commandContent.assetId, filename);
    this.logger.trace(`File ${filename} downloaded`);
    unzip(filename, path.resolve(this.binaryFolder, '..', 'update'));
    this.logger.trace(`File ${filename} unzipped`);
    await fs.unlink(filename);
    this.logger.trace(`File ${filename} removed`);
    const duration = DateTime.now().toMillis() - runStart.toMillis();
    if (command.commandContent.updateLauncher) {
      this.logger.info(`Updating OIBus launcher`);
      const extension = os.type() === 'Windows_NT' ? '.exe' : '';
      await fs.rename(
        path.resolve(this.binaryFolder, '..', `oibus-launcher${extension}`),
        path.resolve(this.binaryFolder, '..', `oibus-launcher_backup${extension}`)
      );
      await fs.rename(
        path.resolve(this.binaryFolder, '..', 'update', `oibus-launcher${extension}`),
        path.resolve(this.binaryFolder, '..', `oibus-launcher${extension}`)
      );
    }
    await fs.writeFile(path.resolve(this.binaryFolder, '..', UPDATE_SETTINGS_FILE), JSON.stringify(command.commandContent));
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
    await this.oIBusService.updateEngineSettings(command.commandContent);
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
          : registration.commandPermissions.testNorthConnection
      }
    };
    await this.oIAnalyticsRegistrationService.editConnectionSettings(registrationCommand);

    this.oIAnalyticsCommandRepository.markAsCompleted(
      command.id,
      DateTime.now().toUTC().toISO(),
      'Registration settings updated successfully'
    );
  }

  private async executeCreateScanModeCommand(command: OIBusCreateScanModeCommand) {
    await this.scanModeService.create(command.commandContent);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'Scan mode created successfully');
  }

  private async executeUpdateScanModeCommand(command: OIBusUpdateScanModeCommand) {
    await this.scanModeService.update(command.scanModeId, command.commandContent);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'Scan mode updated successfully');
  }

  private async executeDeleteScanModeCommand(command: OIBusDeleteScanModeCommand) {
    await this.scanModeService.delete(command.scanModeId);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'Scan mode deleted successfully');
  }

  private async executeCreateIPFilterCommand(command: OIBusCreateIPFilterCommand) {
    await this.ipFilterService.create(command.commandContent);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'IP Filter created successfully');
  }

  private async executeUpdateIPFilterCommand(command: OIBusUpdateIPFilterCommand) {
    await this.ipFilterService.update(command.ipFilterId, command.commandContent);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'IP Filter updated successfully');
  }

  private async executeDeleteIPFilterCommand(command: OIBusDeleteIPFilterCommand) {
    await this.ipFilterService.delete(command.ipFilterId);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'IP Filter deleted successfully');
  }

  private async executeCreateCertificateCommand(command: OIBusCreateCertificateCommand) {
    await this.certificateService.create(command.commandContent);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'Certificate created successfully');
  }

  private async executeUpdateCertificateCommand(command: OIBusUpdateCertificateCommand) {
    await this.certificateService.update(command.certificateId, command.commandContent);
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
    const manifest = this.southService.getInstalledSouthManifests().find(element => element.id === command.commandContent.type)!;
    command.commandContent.settings = await encryptionService.decryptSecretsWithPrivateKey(
      command.commandContent.settings,
      manifest.settings,
      privateKey
    );
    command.commandContent.items = await Promise.all(
      command.commandContent.items.map(async item => ({
        id: item.id,
        enabled: item.enabled,
        name: item.name,
        settings: await encryptionService.decryptSecretsWithPrivateKey(item.settings, manifest.items.settings, privateKey),
        scanModeId: item.scanModeId,
        scanModeName: item.scanModeName
      }))
    );
  }

  private async decryptSouthItemSettings(command: OIBusTestSouthConnectorItemCommand, privateKey: string) {
    const manifest = this.southService
      .getInstalledSouthManifests()
      .find(element => element.id === command.commandContent.southCommand.type)!;
    command.commandContent.southCommand.settings = await encryptionService.decryptSecretsWithPrivateKey(
      command.commandContent.southCommand.settings,
      manifest.settings,
      privateKey
    );
    command.commandContent.itemCommand.settings = await encryptionService.decryptSecretsWithPrivateKey(
      command.commandContent.itemCommand.settings,
      manifest.items.settings,
      privateKey
    );
  }

  private async executeCreateSouthCommand(command: OIBusCreateSouthConnectorCommand, privateKey: string) {
    await this.decryptSouthSettings(command, privateKey);
    await this.southService.createSouth(command.commandContent, command.southConnectorId);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'South connector created successfully');
  }

  private async executeUpdateSouthCommand(command: OIBusUpdateSouthConnectorCommand, privateKey: string) {
    await this.decryptSouthSettings(command, privateKey);
    await this.southService.updateSouth(command.southConnectorId, command.commandContent);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'South connector updated successfully');
  }

  private async executeDeleteSouthCommand(command: OIBusDeleteSouthConnectorCommand) {
    await this.southService.deleteSouth(command.southConnectorId);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'South connector deleted successfully');
  }

  private async executeCreateOrUpdateSouthConnectorItemsFromCSVCommand(command: OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand) {
    const southConnector = this.southService.findById(command.southConnectorId);
    if (!southConnector) {
      throw new Error(`South connector ${command.southConnectorId} not found`);
    }

    const { items, errors } = await this.southService.checkCsvContentImport(
      southConnector.type,
      command.commandContent.csvContent,
      command.commandContent.delimiter,
      command.commandContent.deleteItemsNotPresent ? [] : southConnector.items
    );

    if (errors.length > 0) {
      let stringError = 'Error when checking csv items:';
      for (const error of errors) {
        stringError += `\n${error.item.name}: ${error.error}`;
      }
      throw new Error(stringError);
    }
    await this.southService.importItems(southConnector.id, items, command.commandContent.deleteItemsNotPresent);
    this.oIAnalyticsCommandRepository.markAsCompleted(
      command.id,
      DateTime.now().toUTC().toISO(),
      `${items.length} items imported on South connector ${southConnector.name}`
    );
  }

  private async executeTestSouthConnectionCommand(command: OIBusTestSouthConnectorCommand, privateKey: string) {
    await this.decryptSouthSettings(command, privateKey);
    await this.southService.testSouth(command.southConnectorId, command.commandContent, this.logger);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'South connection tested successfully');
  }

  private async executeTestSouthItemCommand(command: OIBusTestSouthConnectorItemCommand, privateKey: string) {
    await this.decryptSouthItemSettings(command, privateKey);

    await this.southService.testSouthItem(
      command.southConnectorId,
      command.commandContent.southCommand,
      command.commandContent.itemCommand,
      command.commandContent.testingSettings,
      result => {
        this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), JSON.stringify(result));
      },
      this.logger
    );
  }

  private async decryptNorthSettings(
    command: OIBusCreateNorthConnectorCommand | OIBusUpdateNorthConnectorCommand | OIBusTestNorthConnectorCommand,
    privateKey: string
  ) {
    const manifest = this.northService.getInstalledNorthManifests().find(element => element.id === command.commandContent.type)!;
    command.commandContent.settings = await encryptionService.decryptSecretsWithPrivateKey(
      command.commandContent.settings,
      manifest.settings,
      privateKey
    );
  }

  private async executeCreateNorthCommand(command: OIBusCreateNorthConnectorCommand, privateKey: string) {
    await this.decryptNorthSettings(command, privateKey);
    await this.northService.createNorth(command.commandContent, command.northConnectorId);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'North connector created successfully');
  }

  private async executeUpdateNorthCommand(command: OIBusUpdateNorthConnectorCommand, privateKey: string) {
    await this.decryptNorthSettings(command, privateKey);
    await this.northService.updateNorth(command.northConnectorId, command.commandContent);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'North connector updated successfully');
  }

  private async executeDeleteNorthCommand(command: OIBusDeleteNorthConnectorCommand) {
    await this.northService.deleteNorth(command.northConnectorId);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'North connector deleted successfully');
  }

  private async executeTestNorthConnectionCommand(command: OIBusTestNorthConnectorCommand, privateKey: string) {
    await this.decryptNorthSettings(command, privateKey);
    await this.northService.testNorth(command.northConnectorId, command.commandContent, this.logger);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'North connection tested successfully');
  }

  private async decryptHistoryQuerySettings(
    command: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings>,
    privateKey: string
  ) {
    const northManifest = this.northService.getInstalledNorthManifests().find(element => element.id === command.northType)!;
    const southManifest = this.southService.getInstalledSouthManifests().find(element => element.id === command.southType)!;
    command.northSettings = await encryptionService.decryptSecretsWithPrivateKey(command.northSettings, northManifest.settings, privateKey);
    command.southSettings = await encryptionService.decryptSecretsWithPrivateKey(command.southSettings, southManifest.settings, privateKey);
    command.items = await Promise.all(
      command.items.map(async item => ({
        id: item.id,
        enabled: item.enabled,
        name: item.name,
        settings: await encryptionService.decryptSecretsWithPrivateKey(item.settings, southManifest.items.settings, privateKey)
      }))
    );
  }

  private async decryptHistoryQuerySouthItemSettings(command: OIBusTestHistoryQuerySouthItemConnectionCommand, privateKey: string) {
    const manifest = this.southService
      .getInstalledSouthManifests()
      .find(element => element.id === command.commandContent.historyCommand.southType)!;
    command.commandContent.historyCommand.southSettings = await encryptionService.decryptSecretsWithPrivateKey(
      command.commandContent.historyCommand.southSettings,
      manifest.settings,
      privateKey
    );
    command.commandContent.itemCommand.settings = await encryptionService.decryptSecretsWithPrivateKey(
      command.commandContent.itemCommand.settings,
      manifest.items.settings,
      privateKey
    );
  }

  private async executeCreateHistoryQueryCommand(command: OIBusCreateHistoryQueryCommand, privateKey: string) {
    await this.decryptHistoryQuerySettings(command.commandContent, privateKey);
    await this.historyQueryService.createHistoryQuery(
      command.commandContent,
      command.southConnectorId,
      command.northConnectorId,
      command.historyQueryId
    );
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'History query created successfully');
  }

  private async executeUpdateHistoryQueryCommand(command: OIBusUpdateHistoryQueryCommand, privateKey: string) {
    await this.decryptHistoryQuerySettings(command.commandContent.historyQuery, privateKey);
    await this.historyQueryService.updateHistoryQuery(
      command.historyQueryId,
      command.commandContent.historyQuery,
      command.commandContent.resetCache
    );
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'History query updated successfully');
  }

  private async executeDeleteHistoryQueryCommand(command: OIBusDeleteHistoryQueryCommand) {
    await this.historyQueryService.deleteHistoryQuery(command.historyQueryId);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'History query deleted successfully');
  }

  private async executeCreateOrUpdateHistoryQuerySouthItemsFromCSVCommand(
    command: OIBusCreateOrUpdateHistoryQuerySouthItemsFromCSVCommand
  ) {
    const historyQuery = this.historyQueryService.findById(command.historyQueryId);
    if (!historyQuery) {
      throw new Error(`History query ${command.historyQueryId} not found`);
    }

    const { items, errors } = await this.historyQueryService.checkCsvContentImport(
      historyQuery.southType,
      command.commandContent.csvContent,
      command.commandContent.delimiter,
      command.commandContent.deleteItemsNotPresent ? [] : historyQuery.items
    );

    if (errors.length > 0) {
      let stringError = 'Error when checking csv items:';
      for (const error of errors) {
        stringError += `\n${error.item.name}: ${error.error}`;
      }
      throw new Error(stringError);
    }
    await this.historyQueryService.importItems(historyQuery.id, items, command.commandContent.deleteItemsNotPresent);
    this.oIAnalyticsCommandRepository.markAsCompleted(
      command.id,
      DateTime.now().toUTC().toISO(),
      `${items.length} items imported on History query ${historyQuery.name}`
    );
  }

  private async executeTestHistoryQueryNorthConnectionCommand(command: OIBusTestHistoryQueryNorthConnectionCommand, privateKey: string) {
    await this.decryptHistoryQuerySettings(command.commandContent, privateKey);
    await this.historyQueryService.testNorth(
      command.historyQueryId,
      command.northConnectorId,
      {
        name: command.commandContent.name,
        type: command.commandContent.northType,
        description: command.commandContent.description,
        enabled: true,
        settings: command.commandContent.northSettings,
        caching: command.commandContent.caching,
        subscriptions: []
      },
      this.logger
    );
    this.oIAnalyticsCommandRepository.markAsCompleted(
      command.id,
      DateTime.now().toUTC().toISO(),
      'History query North connection tested successfully'
    );
  }

  private async executeTestHistoryQuerySouthConnectionCommand(command: OIBusTestHistoryQuerySouthConnectionCommand, privateKey: string) {
    await this.decryptHistoryQuerySettings(command.commandContent, privateKey);
    await this.historyQueryService.testSouth(
      command.historyQueryId,
      command.southConnectorId,
      {
        name: command.commandContent.name,
        type: command.commandContent.southType,
        description: command.commandContent.description,
        enabled: true,
        settings: command.commandContent.southSettings,
        items: []
      },
      this.logger
    );
    this.oIAnalyticsCommandRepository.markAsCompleted(
      command.id,
      DateTime.now().toUTC().toISO(),
      'History query South connection tested successfully'
    );
  }

  private async executeTestHistoryQuerySouthItemCommand(command: OIBusTestHistoryQuerySouthItemConnectionCommand, privateKey: string) {
    await this.decryptHistoryQuerySouthItemSettings(command, privateKey);

    await this.historyQueryService.testSouthItem(
      command.historyQueryId,
      command.southConnectorId,
      {
        name: command.commandContent.historyCommand.name,
        type: command.commandContent.historyCommand.southType,
        description: command.commandContent.historyCommand.description,
        enabled: true,
        settings: command.commandContent.historyCommand.southSettings,
        items: []
      },
      command.commandContent.itemCommand,
      command.commandContent.testingSettings,
      result => {
        this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), JSON.stringify(result));
      },
      this.logger
    );
  }

  private async executeUpdateHistoryQueryStatusCommand(command: OIBusUpdateHistoryQueryStatusCommand) {
    switch (command.commandContent.historyQueryStatus) {
      case 'RUNNING':
        await this.historyQueryService.startHistoryQuery(command.historyQueryId);
        this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'History query started');
        break;
      case 'PAUSED':
        await this.historyQueryService.pauseHistoryQuery(command.historyQueryId);
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
      return command;
  }
};
