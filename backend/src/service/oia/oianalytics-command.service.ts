import fs from 'node:fs/promises';
import { delay, getOIBusInfo, unzip } from '../utils';
import EncryptionService from '../encryption.service';
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
  OIBusCreateNorthConnectorCommand,
  OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand,
  OIBusCreateScanModeCommand,
  OIBusCreateSouthConnectorCommand,
  OIBusDeleteNorthConnectorCommand,
  OIBusDeleteScanModeCommand,
  OIBusDeleteSouthConnectorCommand,
  OIBusRegenerateCipherKeysCommand,
  OIBusRestartEngineCommand,
  OIBusUpdateEngineSettingsCommand,
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
    private encryptionService: EncryptionService,
    private oIAnalyticsClient: OIAnalyticsClient,
    private oIBusService: OIBusService,
    private scanModeService: ScanModeService,
    private southService: SouthService,
    private northService: NorthService,
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
    if (this.ignoreRemoteUpdate) {
      this.logger.error(`OIBus is not set up to execute remote`);
      return;
    }

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
            const privateKey = await this.encryptionService.decryptText(registration.privateCipherKey!);
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
        case 'create-south':
          {
            const privateKey = await this.encryptionService.decryptText(registration.privateCipherKey!);
            await this.executeCreateSouthCommand(command, privateKey);
          }
          break;
        case 'update-south':
          {
            const privateKey = await this.encryptionService.decryptText(registration.privateCipherKey!);
            await this.executeUpdateSouthCommand(command, privateKey);
          }
          break;
        case 'delete-south':
          await this.executeDeleteSouthCommand(command);
          break;
        case 'create-north':
          {
            const privateKey = await this.encryptionService.decryptText(registration.privateCipherKey!);
            await this.executeCreateNorthCommand(command, privateKey);
          }
          break;
        case 'update-north':
          {
            const privateKey = await this.encryptionService.decryptText(registration.privateCipherKey!);
            await this.executeUpdateNorthCommand(command, privateKey);
          }
          break;
        case 'delete-north':
          await this.executeDeleteNorthCommand(command);
          break;
        case 'create-or-update-south-items-from-csv':
          await this.executeCreateOrUpdateSouthConnectorItemsFromCSVCommand(command);
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

  setLogger(logger: pino.Logger) {
    this.logger = logger;
  }

  private async executeUpdateVersionCommand(command: OIBusUpdateVersionCommand, registration: OIAnalyticsRegistration) {
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
      ? await this.encryptionService.decryptTextWithPrivateKey(command.commandContent.logParameters.loki.password, privateKey)
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
      commandPermissions: registration.commandPermissions
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

  private async decryptSouthSettings(command: OIBusCreateSouthConnectorCommand | OIBusUpdateSouthConnectorCommand, privateKey: string) {
    const manifest = this.southService.getInstalledSouthManifests().find(element => element.id === command.commandContent.type)!;
    command.commandContent.settings = await this.encryptionService.decryptSecretsWithPrivateKey(
      command.commandContent.settings,
      manifest.settings,
      privateKey
    );
    command.commandContent.items = await Promise.all(
      command.commandContent.items.map(async item => ({
        id: item.id,
        enabled: item.enabled,
        name: item.name,
        settings: await this.encryptionService.decryptSecretsWithPrivateKey(item.settings, manifest.items.settings, privateKey),
        scanModeId: item.scanModeId,
        scanModeName: item.scanModeName
      }))
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

  private async decryptNorthSettings(command: OIBusCreateNorthConnectorCommand | OIBusUpdateNorthConnectorCommand, privateKey: string) {
    const manifest = this.northService.getInstalledNorthManifests().find(element => element.id === command.commandContent.type)!;
    command.commandContent.settings = await this.encryptionService.decryptSecretsWithPrivateKey(
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
      case 'create-north':
        return registration.commandPermissions.createNorth;
      case 'create-south':
        return registration.commandPermissions.createSouth;
      case 'create-scan-mode':
        return registration.commandPermissions.createScanMode;
      case 'update-scan-mode':
        return registration.commandPermissions.updateScanMode;
      case 'update-north':
        return registration.commandPermissions.updateNorth;
      case 'update-south':
        return registration.commandPermissions.updateSouth;
      case 'delete-scan-mode':
        return registration.commandPermissions.deleteScanMode;
      case 'delete-south':
        return registration.commandPermissions.deleteSouth;
      case 'delete-north':
        return registration.commandPermissions.deleteNorth;
      case 'create-or-update-south-items-from-csv':
        return registration.commandPermissions.createOrUpdateSouthItemsFromCsv;
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
    case 'create-north':
    case 'create-south':
    case 'create-scan-mode':
    case 'update-scan-mode':
    case 'update-north':
    case 'update-south':
    case 'delete-scan-mode':
    case 'delete-south':
    case 'delete-north':
    case 'create-or-update-south-items-from-csv':
      return command;
  }
};
