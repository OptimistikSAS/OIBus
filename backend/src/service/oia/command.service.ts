import fs from 'node:fs/promises';
import { delay, downloadFile, getNetworkSettingsFromRegistration, getOIBusInfo, unzip } from '../utils';
import RepositoryService from '../repository.service';
import EncryptionService from '../encryption.service';
import pino from 'pino';
import { OIBusCommandDTO } from '../../../../shared/model/command.model';
import { EventEmitter } from 'node:events';
import DeferredPromise from '../deferred-promise';
import { DateTime } from 'luxon';
import { RegistrationSettingsDTO } from '../../../../shared/model/engine.model';
import path from 'node:path';

const DOWNLOAD_TIMEOUT = 600_000;
const STOP_TIMEOUT = 30_000;

export default class CommandService {
  private commandsQueue: Array<OIBusCommandDTO> = [];
  private registration: RegistrationSettingsDTO | null = null;
  private triggerRun: EventEmitter = new EventEmitter();
  private runProgress$: DeferredPromise | null = null;
  private stopTimeout: NodeJS.Timeout | null = null;

  constructor(
    private repositoryService: RepositoryService,
    private encryptionService: EncryptionService,
    private logger: pino.Logger,
    private binaryFolder: string
  ) {
    const currentUpgradeCommand = this.repositoryService.commandRepository.searchCommandsList({ status: ['RUNNING'], types: ['UPGRADE'] });
    if (currentUpgradeCommand.length > 0) {
      const engineSettings = this.repositoryService.engineRepository.getEngineSettings()!;
      const info = getOIBusInfo(engineSettings);
      this.repositoryService.commandRepository.markAsCompleted(
        currentUpgradeCommand[0].id,
        DateTime.now().toUTC().toISO(),
        `OIBus updated to version ${info.version}`
      );
    }
  }

  start(): void {
    this.registration = this.repositoryService.registrationRepository.getRegistrationSettings()!;
    if (this.registration.status !== 'REGISTERED') {
      this.logger.debug(`Command service not started: OIAnalytics not registered`);
      return;
    }
    this.commandsQueue = this.repositoryService.commandRepository.searchCommandsList({ status: ['RETRIEVED', 'RUNNING'], types: [] });

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
    this.repositoryService.commandRepository.markAsRunning(command.id);

    try {
      await this.executeCommand(command);
    } catch (error: any) {
      this.logger.error(
        `Error while executing command ${command.id} (retrieved ${command.retrievedDate}) of type ${command.type}. ${error.toString()}`
      );
      this.repositoryService.commandRepository.markAsErrored(command.id, error.toString());
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
  addCommandToQueue(command: OIBusCommandDTO): void {
    this.commandsQueue.push(command);
    this.triggerRun.emit('next');
  }

  async executeCommand(command: OIBusCommandDTO): Promise<void> {
    const runStart = DateTime.now();
    const engineSettings = this.repositoryService.engineRepository.getEngineSettings()!;
    const oibusInfo = getOIBusInfo(engineSettings);
    const endpoint = `/api/oianalytics/oibus/upgrade/asset?assetId=${command.assetId}`;

    this.logger.info(
      `Upgrading OIBus from ${oibusInfo.version} to ${command.version} for platform ${oibusInfo.platform} and architecture ${oibusInfo.architecture}...`
    );
    const registrationSettings = this.repositoryService.registrationRepository.getRegistrationSettings();
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
}
