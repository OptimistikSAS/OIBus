import fs from 'node:fs/promises';
import { delay, downloadFile, getNetworkSettingsFromRegistration, getOIBusInfo, unzip } from '../utils';
import EncryptionService from '../encryption.service';
import pino from 'pino';
import { DateTime } from 'luxon';
import path from 'node:path';
import { version } from '../../../package.json';
import SouthConnectorConfigService from '../south-connector-config.service';
import ScanModeService from '../scan-mode.service';
import NorthConnectorConfigService from '../north-connector-config.service';
import OIAnalyticsRegistrationRepository from '../../repository/oianalytics-registration.repository';
import fetch from 'node-fetch';
import OIAnalyticsCommandRepository from '../../repository/oianalytics-command.repository';
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
import { OIAnalyticsFetchCommandDTO } from './oianalytics.model';
import { CommandSearchParam, OIBusCommandDTO } from '../../../../shared/model/command.model';
import { Page } from '../../../../shared/model/types';

const DOWNLOAD_TIMEOUT = 600_000;
const OIANALYTICS_TIMEOUT = 10_000;
const CHECK_OIANALYTICS_COMMANDS_INTERVAL = 1_000;
const EXECUTE_OIANALYTICS_COMMANDS_INTERVAL = 1_000;

export default class OIAnalyticsCommandService {
  private retrieveCommandsInterval: NodeJS.Timeout | null = null;
  private ongoingRetrieveCommands = false;
  private executeCommandInterval: NodeJS.Timeout | null = null;
  private ongoingExecuteCommand = false;

  constructor(
    private oIAnalyticsCommandRepository: OIAnalyticsCommandRepository,
    private oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository,
    private encryptionService: EncryptionService,
    private oIBusService: OIBusService,
    private scanModeService: ScanModeService,
    private southConnectorConfigService: SouthConnectorConfigService,
    private northConnectorConfigService: NorthConnectorConfigService,
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
      if (engineSettings.version !== version) {
        this.oIBusService.updateOIBusVersion(version);
        this.oIAnalyticsCommandRepository.markAsCompleted(
          currentUpgradeCommand[0].id,
          DateTime.now().toUTC().toISO(),
          `OIBus updated to version ${version}`
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

    const endpoint = `/api/oianalytics/oibus/commands/status`;
    const connectionSettings = await getNetworkSettingsFromRegistration(registration, endpoint, this.encryptionService);
    let response;
    const url = `${connectionSettings.host}${endpoint}`;
    try {
      response = await fetch(url, {
        method: 'PUT',
        body: JSON.stringify(commandsToAck),
        headers: { ...connectionSettings.headers, 'Content-Type': 'application/json' },
        timeout: OIANALYTICS_TIMEOUT,
        agent: connectionSettings.agent
      });
      for (const command of commandsToAck) {
        this.oIAnalyticsCommandRepository.markAsAcknowledged(command.id);
      }
      if (!response.ok) {
        this.logger.error(
          `Error ${response.status} while acknowledging ${commandsToAck.length} commands on ${url}: ${response.statusText}`
        );
        return;
      }
      this.logger.trace(`${commandsToAck.length} commands acknowledged`);
    } catch (fetchError) {
      this.logger.error(`Error while acknowledging ${commandsToAck.length} commands on ${url}. ${fetchError}`);
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

    let endpoint = `/api/oianalytics/oibus/commands/list-by-ids?`;
    for (const command of pendingCommands) {
      endpoint += `ids=${command.id}&`;
    }
    endpoint = endpoint.slice(0, endpoint.length - 1);
    const connectionSettings = await getNetworkSettingsFromRegistration(registration, endpoint, this.encryptionService);
    let response;
    const url = `${connectionSettings.host}${endpoint}`;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: connectionSettings.headers,
        timeout: OIANALYTICS_TIMEOUT,
        agent: connectionSettings.agent
      });
      if (!response.ok) {
        this.logger.error(`Error ${response.status} while checking PENDING commands status on ${url}: ${response.statusText}`);
        return;
      }
      const commandsToCancel: Array<OIAnalyticsFetchCommandDTO> = await response.json();
      this.logger.trace(`${commandsToCancel.length} commands cancelled among the ${pendingCommands.length} pending commands`);
      for (const command of commandsToCancel) {
        this.oIAnalyticsCommandRepository.cancel(command.id);
      }
    } catch (fetchError) {
      this.logger.error(`Error while checking PENDING commands status on ${url}: ${fetchError}`);
    }
  }

  async retrieveCommands(registration: OIAnalyticsRegistration): Promise<void> {
    const endpoint = `/api/oianalytics/oibus/commands/pending`;
    const connectionSettings = await getNetworkSettingsFromRegistration(registration, endpoint, this.encryptionService);
    let response;
    const url = `${connectionSettings.host}${endpoint}`;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: connectionSettings.headers,
        timeout: OIANALYTICS_TIMEOUT,
        agent: connectionSettings.agent
      });
      if (!response.ok) {
        this.logger.error(`Error ${response.status} while retrieving commands on ${url}: ${response.statusText}`);
        return;
      }
      const newCommands: Array<OIAnalyticsFetchCommandDTO> = await response.json();
      this.logger.trace(`${newCommands.length} commands to add`);
      for (const command of newCommands) {
        this.oIAnalyticsCommandRepository.create(command);
      }
    } catch (fetchError) {
      this.logger.error(`Error while retrieving commands on ${url}. ${fetchError}`);
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
    const command = commandsToExecute[0];
    this.ongoingExecuteCommand = true;
    try {
      switch (command.type) {
        case 'update-version':
          await this.executeUpdateVersionCommand(command);
          break;
        case 'restart-engine':
          await this.executeRestartCommand(command);
          break;
        case 'update-engine-settings':
          await this.executeUpdateEngineSettingsCommand(command);
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
          await this.executeCreateSouthCommand(command);
          break;
        case 'update-south':
          await this.executeUpdateSouthCommand(command);
          break;
        case 'delete-south':
          await this.executeDeleteSouthCommand(command);
          break;
        case 'create-north':
          await this.executeCreateNorthCommand(command);
          break;
        case 'update-north':
          await this.executeUpdateNorthCommand(command);
          break;
        case 'delete-north':
          await this.executeDeleteNorthCommand(command);
          break;
      }
    } catch (error: any) {
      this.logger.error(
        `Error while executing command ${command.id} (retrieved ${command.retrievedDate}) of type ${command.type}. ${error.toString()}`
      );
      this.oIAnalyticsCommandRepository.markAsErrored(command.id, error.toString());
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

  private async executeUpdateVersionCommand(command: OIBusUpdateVersionCommand) {
    const runStart = DateTime.now();
    const engineSettings = this.oIBusService.getEngineSettings()!;
    const oibusInfo = getOIBusInfo(engineSettings);
    const endpoint = `/api/oianalytics/oibus/upgrade/asset?assetId=${command.assetId}`;

    this.logger.info(
      `Upgrading OIBus from ${oibusInfo.version} to ${command.version} for platform ${oibusInfo.platform} and architecture ${oibusInfo.architecture}...`
    );
    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    const connectionSettings = await getNetworkSettingsFromRegistration(registrationSettings, endpoint, this.encryptionService);
    const filename = `oibus-${oibusInfo.platform}_${oibusInfo.architecture}.zip`;
    await downloadFile(connectionSettings, endpoint, filename, DOWNLOAD_TIMEOUT);
    this.logger.trace(`File ${filename} downloaded`);
    unzip(filename, path.resolve(this.binaryFolder, '..', 'update'));
    this.logger.trace(`File ${filename} unzipped`);
    await fs.unlink(filename);
    this.logger.trace(`File ${filename} removed`);

    const duration = DateTime.now().toMillis() - runStart.toMillis();
    this.logger.info(`OIBus version ${command.version} downloaded after ${duration} ms of execution. Restarting OIBus to upgrade...`);
    await delay(1500);
    process.exit();
  }

  private async executeRestartCommand(command: OIBusRestartEngineCommand) {
    this.logger.info(`Restarting OIBus...`);
    await delay(1500);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), `OIBus restarted`);
    process.exit();
  }

  private async executeUpdateEngineSettingsCommand(command: OIBusUpdateEngineSettingsCommand) {
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

  private async executeCreateSouthCommand(command: OIBusCreateSouthConnectorCommand) {
    await this.southConnectorConfigService.create(command.commandContent);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'South connector created successfully');
  }

  private async executeUpdateSouthCommand(command: OIBusUpdateSouthConnectorCommand) {
    await this.southConnectorConfigService.update(command.southConnectorId, command.commandContent);
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'South connector updated successfully');
  }

  private async executeDeleteSouthCommand(command: OIBusDeleteSouthConnectorCommand) {
    await this.southConnectorConfigService.delete(command.southConnectorId); // TODO: remove
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'South connector deleted successfully');
  }

  private async executeCreateNorthCommand(command: OIBusCreateNorthConnectorCommand) {
    await this.northConnectorConfigService.create(command.commandContent); // TODO: remove
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'North connector created successfully');
  }

  private async executeUpdateNorthCommand(command: OIBusUpdateNorthConnectorCommand) {
    await this.northConnectorConfigService.update(command.northConnectorId, command.commandContent); // TODO: remove
    this.oIAnalyticsCommandRepository.markAsCompleted(command.id, DateTime.now().toUTC().toISO(), 'North connector updated successfully');
  }

  private async executeDeleteNorthCommand(command: OIBusDeleteNorthConnectorCommand) {
    await this.northConnectorConfigService.delete(command.northConnectorId);
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
