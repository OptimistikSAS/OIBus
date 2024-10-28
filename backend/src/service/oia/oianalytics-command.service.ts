import fs from 'node:fs/promises';
import { delay, getOIBusInfo, unzip } from '../utils';
import EncryptionService from '../encryption.service';
import pino from 'pino';
import { DateTime } from 'luxon';
import path from 'node:path';
import { version } from '../../../package.json';
import ScanModeService from '../scan-mode.service';
import OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import OIAnalyticsCommandRepository from '../../repository/config/oianalytics-command.repository';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import OIBusService from '../oibus.service';
import {
  OIBusCommand,
  OIBusCreateNorthConnectorCommand,
  OIBusCreateScanModeCommand,
  OIBusCreateSouthConnectorCommand,
  OIBusDeleteNorthConnectorCommand,
  OIBusDeleteScanModeCommand,
  OIBusDeleteSouthConnectorCommand,
  OIBusRestartEngineCommand,
  OIBusUpdateEngineSettingsCommand,
  OIBusUpdateNorthConnectorCommand,
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

const CHECK_OIANALYTICS_COMMANDS_INTERVAL = 1_000;
const EXECUTE_OIANALYTICS_COMMANDS_INTERVAL = 1_000;
const UPDATE_SETTINGS_FILE = 'update.json';

export default class OIAnalyticsCommandService {
  private retrieveCommandsInterval: NodeJS.Timeout | null = null;
  private ongoingRetrieveCommands = false;
  private executeCommandInterval: NodeJS.Timeout | null = null;
  private ongoingExecuteCommand = false;

  constructor(
    private oIAnalyticsCommandRepository: OIAnalyticsCommandRepository,
    private oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository,
    private encryptionService: EncryptionService,
    private oIAnalyticsClient: OIAnalyticsClient,
    private oIBusService: OIBusService,
    private scanModeService: ScanModeService,
    private southService: SouthService,
    private northService: NorthService,
    private logger: pino.Logger,
    private binaryFolder: string,
    private ignoreRemoteUpdate: boolean
  ) {
    const engineSettings = this.oIBusService.getEngineSettings();
    const currentUpgradeCommand = this.oIAnalyticsCommandRepository.list({
      status: ['RUNNING'],
      types: ['UPGRADE', 'update-version']
    });
    if (currentUpgradeCommand.length > 0) {
      const updateVersion = (currentUpgradeCommand[0] as OIBusUpdateVersionCommand).commandContent.version;
      if (engineSettings.version !== updateVersion) {
        this.oIBusService.updateOIBusVersion(updateVersion);
        this.oIAnalyticsCommandRepository.markAsCompleted(
          currentUpgradeCommand[0].id,
          DateTime.now().toUTC().toISO(),
          `OIBus updated to version ${updateVersion}`
        );
      } else {
        this.oIAnalyticsCommandRepository.markAsErrored(
          currentUpgradeCommand[0].id,
          `OIBus has not been updated. Rollback to version ${version}`
        );
      }
    } else if (engineSettings.version !== version) {
      this.oIBusService.updateOIBusVersion(version);
    }
  }

  start(): void {
    this.retrieveCommandsInterval = setInterval(this.checkCommands.bind(this), CHECK_OIANALYTICS_COMMANDS_INTERVAL);
    this.executeCommandInterval = setInterval(this.executeCommand.bind(this), EXECUTE_OIANALYTICS_COMMANDS_INTERVAL);
  }

  search(searchParams: CommandSearchParam, page: number): Page<OIBusCommand> {
    return this.oIAnalyticsCommandRepository.search(searchParams, page);
  }

  async checkCommands(): Promise<void> {
    const registration = this.oIAnalyticsRegistrationRepository.get()!;
    if (registration.status !== 'REGISTERED') {
      this.logger.trace(`OIAnalytics not registered. OIBus won't retrieve commands`);
      return;
    }

    if (this.ongoingRetrieveCommands) {
      this.logger.trace(`OIBus is already retrieving commands from OIAnalytics`);
      return;
    }
    this.ongoingRetrieveCommands = true;

    // First, send ack first to update OIAnalytics command before retrieving them
    await this.sendAckCommands(registration);
    // Second, check if the commands already retrieved have been cancelled
    await this.checkRetrievedCommands(registration);
    // Third, retrieve commands from OIAnalytics
    await this.retrieveCommands(registration);
    // Last, update commands to OIAnalytics to declare we have retrieved them
    await this.sendAckCommands(registration);
    this.ongoingRetrieveCommands = false;
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
      this.logger.error(`Error while acknowledging ${commandsToAck.length} commands: ${(error as Error).message}`);
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
      this.logger.trace(`${commandsToCancel.length} commands cancelled among the ${pendingCommands.length} pending commands`);
      for (const command of commandsToCancel) {
        this.oIAnalyticsCommandRepository.cancel(command.id);
      }
    } catch (error: unknown) {
      this.logger.error(`Error while checking PENDING commands status: ${(error as Error).message}`);
    }
  }

  async retrieveCommands(registration: OIAnalyticsRegistration): Promise<void> {
    try {
      const newCommands = await this.oIAnalyticsClient.retrievePendingCommands(registration);
      this.logger.trace(`${newCommands.length} commands to add`);
      for (const command of newCommands) {
        this.oIAnalyticsCommandRepository.create(command);
      }
    } catch (error: unknown) {
      this.logger.error(`Error while retrieving commands: ${(error as Error).message}`);
    }
  }

  async executeCommand(): Promise<void> {
    if (this.ignoreRemoteUpdate) {
      this.logger.error(`OIBus is not set up to execute remote`);
      return;
    }

    const registration = this.oIAnalyticsRegistrationRepository.get()!;
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
      return;
    }
    this.ongoingExecuteCommand = true;
    try {
      switch (command.type) {
        case 'update-version':
          await this.executeUpdateVersionCommand(command, registration);
          break;
        case 'restart-engine':
          await this.executeRestartCommand(command);
          break;
        case 'update-engine-settings':
          {
            const privateKey = await this.encryptionService.decryptText(registration.privateCipherKey!);
            await this.executeUpdateEngineSettingsCommand(command, privateKey);
          }
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
      }
    } catch (error: unknown) {
      this.logger.error(
        `Error while executing command ${command.id} (retrieved ${command.retrievedDate}) of type ${command.type}. Error: ${(error as Error).message}`
      );
      this.oIAnalyticsCommandRepository.markAsErrored(command.id, (error as Error).message);
      this.ongoingExecuteCommand = false;
      return;
    }
    this.ongoingExecuteCommand = false;
  }

  /**
   * Stop services and timer
   */
  async stop(): Promise<void> {
    this.logger.debug(`Stopping OIAnalytics command service...`);

    if (this.retrieveCommandsInterval) {
      clearInterval(this.retrieveCommandsInterval);
      this.retrieveCommandsInterval = null;
    }

    if (this.executeCommandInterval) {
      clearInterval(this.executeCommandInterval);
      this.executeCommandInterval = null;
    }
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
    const filename = `oibus-${oibusInfo.platform}_${oibusInfo.architecture}.zip`;

    await this.oIAnalyticsClient.downloadFile(registration, command.commandContent.assetId, filename);
    this.logger.trace(`File ${filename} downloaded`);
    unzip(filename, path.resolve(this.binaryFolder, '..', 'update'));
    this.logger.trace(`File ${filename} unzipped`);
    await fs.unlink(filename);
    this.logger.trace(`File ${filename} removed`);
    const duration = DateTime.now().toMillis() - runStart.toMillis();
    if (command.commandContent.updateLauncher) {
      const extension = os.type() === 'Windows_NT' ? '.exe' : '';
      await fs.rename(`../oibus-launcher${extension}`, `../oibus-launcher_backup${extension}`);
      await fs.rename(
        path.resolve(this.binaryFolder, '..', 'update', `oibus-launcher${extension}`),
        path.resolve(this.binaryFolder, `oibus-launcher${extension}`)
      );
    }
    await fs.writeFile(`../${UPDATE_SETTINGS_FILE}`, JSON.stringify(command.commandContent));
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
    await this.southService.createSouth(command.commandContent);
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
    await this.northService.createNorth(command.commandContent);
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
}

export const toOIBusCommandDTO = (command: OIBusCommand): OIBusCommandDTO => {
  switch (command.type) {
    case 'update-version':
    case 'restart-engine':
    case 'update-engine-settings':
    case 'create-north':
    case 'create-south':
    case 'create-scan-mode':
    case 'update-scan-mode':
    case 'update-north':
    case 'update-south':
    case 'delete-scan-mode':
    case 'delete-south':
    case 'delete-north':
      return command;
  }
};
