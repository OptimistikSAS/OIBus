import fs from 'node:fs/promises';
import { delay, downloadFile, getNetworkSettingsFromRegistration, getOIBusInfo, unzip } from '../utils';
import RepositoryService from '../repository.service';
import EncryptionService from '../encryption.service';
import pino from 'pino';
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
} from '../../../../shared/model/command.model';
import { EventEmitter } from 'node:events';
import DeferredPromise from '../deferred-promise';
import { DateTime } from 'luxon';
import { RegistrationSettingsDTO } from '../../../../shared/model/engine.model';
import path from 'node:path';
import { version } from '../../../package.json';
import OIAnalyticsMessageService from './oianalytics-message.service';
import { OIAnalyticsMessageInfoCommandDTO } from '../../../../shared/model/oianalytics-message.model';
import ReloadService from '../reload.service';
import SouthConnectorConfigService from '../south-connector-config.service';
import { SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import OIAnalyticsCommandClient from './oianalytics-command.client';
import ScanModeConfigService from '../scan-mode-config.service';
import NorthConnectorConfigService from '../north-connector-config.service';

const DOWNLOAD_TIMEOUT = 600_000;
const STOP_TIMEOUT = 30_000;

export default class OIAnalyticsCommandService {
  private commandsQueue: Array<OIBusCommand> = [];
  private registration: RegistrationSettingsDTO | null = null;
  private triggerRun: EventEmitter = new EventEmitter();
  private runProgress$: DeferredPromise | null = null;
  private stopTimeout: NodeJS.Timeout | null = null;

  constructor(
    private repositoryService: RepositoryService,
    private reloadService: ReloadService,
    private encryptionService: EncryptionService,
    private oianalyticsMessageService: OIAnalyticsMessageService,
    private scanModeConfigService: ScanModeConfigService,
    private southConnectorConfigService: SouthConnectorConfigService,
    private northConnectorConfigService: NorthConnectorConfigService,
    private oianalyticsCommandClient: OIAnalyticsCommandClient,
    private logger: pino.Logger,
    private binaryFolder: string
  ) {
    const engineSettings = this.repositoryService.engineRepository.get()!;
    const currentUpgradeCommand = this.repositoryService.oianalyticsCommandRepository.list({
      status: ['RUNNING'],
      types: ['UPGRADE', 'update-version']
    });
    if (currentUpgradeCommand.length > 0) {
      if (engineSettings.version !== version) {
        this.repositoryService.engineRepository.updateVersion(version);
        this.repositoryService.oianalyticsCommandRepository.markAsCompleted(
          currentUpgradeCommand[0].id,
          DateTime.now().toUTC().toISO(),
          `OIBus updated to version ${version}`
        );
        engineSettings.version = version;

        const message: OIAnalyticsMessageInfoCommandDTO = {
          type: 'info',
          ...getOIBusInfo(engineSettings)
        };
        const createdMessage = this.repositoryService.oianalyticsMessageRepository.create(message);
        this.oianalyticsMessageService.addMessageToQueue(createdMessage);
      } else {
        this.repositoryService.oianalyticsCommandRepository.markAsErrored(
          currentUpgradeCommand[0].id,
          `OIBus has not been updated. Rollback to version ${version}`
        );
      }
    } else if (engineSettings.version !== version) {
      this.repositoryService.engineRepository.updateVersion(version);
    }
  }

  start(): void {
    this.registration = this.repositoryService.oianalyticsRegistrationRepository.get()!;
    if (this.registration.status !== 'REGISTERED') {
      this.logger.debug(`Command service not started: OIAnalytics not registered`);
      return;
    }
    this.commandsQueue = this.repositoryService.oianalyticsCommandRepository.list({
      status: ['RETRIEVED', 'RUNNING'],
      types: []
    });

    this.triggerRun.on('next', async () => {
      if (!this.runProgress$) {
        if (this.commandsQueue.length > 0) {
          await this.run();
        }
      }
    });
    this.triggerRun.emit('next');
  }

  async run(): Promise<void> {
    this.runProgress$ = new DeferredPromise();
    const [command] = this.commandsQueue;
    this.repositoryService.oianalyticsCommandRepository.markAsRunning(command.id);

    try {
      await this.executeCommand(command);
    } catch (error: any) {
      this.logger.error(
        `Error while executing command ${command.id} (retrieved ${command.retrievedDate}) of type ${command.type}. ${error.toString()}`
      );
      this.repositoryService.oianalyticsCommandRepository.markAsErrored(command.id, error.toString());
    }

    this.runProgress$.resolve();
    this.runProgress$ = null;
    this.removeCommandFromQueue(command.id);
    this.triggerRun.emit('next');
  }

  /**
   * Removes commands from the queue.
   * If no command ID is given, the first element is removed
   * @param commandId
   * @returns
   */
  removeCommandFromQueue(commandId: string): void {
    const idx = this.commandsQueue.findIndex(command => command.id === commandId);
    if (idx === -1) return;

    this.commandsQueue.splice(idx, 1);
  }

  /**
   * Add a command to the command queue and trigger the next run if no command is running
   * @param command - The command to add
   */
  addCommandToQueue(command: OIBusCommand): void {
    this.commandsQueue.push(command);
    this.triggerRun.emit('next');
  }

  async executeCommand(command: OIBusCommand): Promise<void> {
    switch (command.type) {
      case 'update-version':
        return await this.executeUpdateVersionCommand(command);
      case 'restart-engine':
        return await this.executeRestartCommand(command);
      case 'update-engine-settings':
        return await this.executeUpdateEngineSettingsCommand(command);
      case 'create-scan-mode':
        return await this.executeCreateScanModeCommand(command);
      case 'update-scan-mode':
        return await this.executeUpdateScanModeCommand(command);
      case 'delete-scan-mode':
        return await this.executeDeleteScanModeCommand(command);
      case 'create-south':
        return await this.executeCreateSouthCommand(command);
      case 'update-south':
        return await this.executeUpdateSouthCommand(command);
      case 'delete-south':
        return await this.executeDeleteSouthCommand(command);
      case 'create-north':
        return await this.executeCreateNorthCommand(command);
      case 'update-north':
        return await this.executeUpdateNorthCommand(command);
      case 'delete-north':
        return await this.executeDeleteNorthCommand(command);
    }
  }

  /**
   * Stop services and timer
   */
  async stop(): Promise<void> {
    this.logger.debug(`Stopping command service...`);

    this.triggerRun.removeAllListeners();
    if (this.runProgress$) {
      if (!this.stopTimeout) {
        this.stopTimeout = setTimeout(() => {
          this.runProgress$!.resolve();
        }, STOP_TIMEOUT);
      }
      this.logger.debug('Waiting for command to finish');
      await this.runProgress$.promise;
      clearTimeout(this.stopTimeout);
    }
    this.logger.debug(`Command service stopped`);
  }

  setLogger(logger: pino.Logger) {
    this.logger = logger;
  }

  private async executeUpdateVersionCommand(command: OIBusUpdateVersionCommand) {
    const runStart = DateTime.now();
    const engineSettings = this.repositoryService.engineRepository.get()!;
    const oibusInfo = getOIBusInfo(engineSettings);
    const endpoint = `/api/oianalytics/oibus/upgrade/asset?assetId=${command.assetId}`;

    this.logger.info(
      `Upgrading OIBus from ${oibusInfo.version} to ${command.version} for platform ${oibusInfo.platform} and architecture ${oibusInfo.architecture}...`
    );
    const registrationSettings = this.repositoryService.oianalyticsRegistrationRepository.get();
    const connectionSettings = await getNetworkSettingsFromRegistration(registrationSettings, endpoint, this.encryptionService);
    const filename = `oibus-${oibusInfo.platform}_${oibusInfo.architecture}.zip`;
    await downloadFile(connectionSettings, endpoint, filename, DOWNLOAD_TIMEOUT);
    this.logger.debug(`File ${filename} downloaded`);
    unzip(filename, path.resolve(this.binaryFolder, '..', 'update'));
    this.logger.debug(`File ${filename} unzipped`);
    await fs.unlink(filename);
    this.logger.debug(`File ${filename} removed`);

    const duration = DateTime.now().toMillis() - runStart.toMillis();
    this.logger.debug(
      `Command ${command.id} (retrieved ${command.retrievedDate}) of type ${command.type} after ${duration} ms of execution`
    );

    this.logger.info(`OIBus ${oibusInfo.version}. Restarting OIBus to upgrade...`);
    await delay(1500);
    process.exit();
  }

  private async executeRestartCommand(command: OIBusRestartEngineCommand) {
    this.logger.info(`Restart OIBus...`);
    await delay(1500);
    this.repositoryService.oianalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), `OIBus restarted`);
    process.exit();
  }

  private async executeUpdateEngineSettingsCommand(command: OIBusUpdateEngineSettingsCommand) {
    const oldEngineSettings = this.repositoryService.engineRepository.get()!;
    this.repositoryService.engineRepository.update(command.commandContent);
    const newEngineSettings = this.repositoryService.engineRepository.get();
    await this.reloadService.onUpdateOIBusSettings(oldEngineSettings, newEngineSettings!);
    await this.completeCommand(command.id, 'Engine settings updated successfully');
  }

  private async executeCreateScanModeCommand(command: OIBusCreateScanModeCommand) {
    await this.scanModeConfigService.create(command.commandContent);
    await this.completeCommand(command.id, 'Scan mode created successfully');
  }

  private async executeUpdateScanModeCommand(command: OIBusUpdateScanModeCommand) {
    await this.scanModeConfigService.update(command.scanModeId, command.commandContent);
    await this.completeCommand(command.id, 'Scan mode updated successfully');
  }

  private async executeDeleteScanModeCommand(command: OIBusDeleteScanModeCommand) {
    await this.scanModeConfigService.delete(command.scanModeId);
    await this.completeCommand(command.id, 'Scan mode deleted successfully');
  }

  private async executeCreateSouthCommand(command: OIBusCreateSouthConnectorCommand) {
    await this.southConnectorConfigService.create({
      south: command.commandContent as SouthConnectorDTO,
      items: command.commandContent.items,
      itemIdsToDelete: []
    });
    await this.completeCommand(command.id, 'South connector created successfully');
  }

  private async executeUpdateSouthCommand(command: OIBusUpdateSouthConnectorCommand) {
    await this.southConnectorConfigService.update(command.southConnectorId, {
      south: command.commandContent as SouthConnectorDTO,
      items: command.commandContent.items,
      itemIdsToDelete: []
    });
    await this.completeCommand(command.id, 'South connector updated successfully');
  }

  private async executeDeleteSouthCommand(command: OIBusDeleteSouthConnectorCommand) {
    await this.southConnectorConfigService.delete(command.southConnectorId);
    await this.completeCommand(command.id, 'South connector deleted successfully');
  }

  private async executeCreateNorthCommand(command: OIBusCreateNorthConnectorCommand) {
    await this.northConnectorConfigService.create(command.commandContent);
    await this.completeCommand(command.id, 'North connector created successfully');
  }

  private async executeUpdateNorthCommand(command: OIBusUpdateNorthConnectorCommand) {
    await this.northConnectorConfigService.update(command.northConnectorId, command.commandContent);
    await this.completeCommand(command.id, 'North connector updated successfully');
  }

  private async executeDeleteNorthCommand(command: OIBusDeleteNorthConnectorCommand) {
    await this.northConnectorConfigService.delete(command.northConnectorId);
    await this.completeCommand(command.id, 'North connector deleted successfully');
  }

  private async completeCommand(commandId: string, message: string) {
    this.repositoryService.oianalyticsCommandRepository.markAsCompleted(commandId, DateTime.now().toUTC().toISO(), message);
    this.removeCommandFromQueue(commandId);
    await delay(150);
    await this.oianalyticsCommandClient.completeCommand(commandId, 'COMPLETED', message);
  }
}
