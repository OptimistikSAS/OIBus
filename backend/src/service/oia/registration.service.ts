import { generateRandomId, getNetworkSettingsFromRegistration, getOIBusInfo } from '../utils';
import RepositoryService from '../repository.service';
import EncryptionService from '../encryption.service';
import pino from 'pino';
import { OIBusCommandDTO } from '../../../../shared/model/command.model';
import { DateTime } from 'luxon';
import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../../shared/model/engine.model';
import { createProxyAgent } from '../proxy-agent';
import fetch from 'node-fetch';
import { Instant } from '../../../../shared/model/types';
import CommandService from './command.service';
import ReloadService from '../reload.service';
import OIAnalyticsMessageService from './message.service';

const CHECK_TIMEOUT = 10_000;
export default class RegistrationService {
  private intervalCheckRegistration: NodeJS.Timeout | null = null;
  private intervalCheckCommands: NodeJS.Timeout | null = null;
  private ongoingCheckRegistration = false;
  private ongoingCheckCommands = false;

  constructor(
    private repositoryService: RepositoryService,
    private encryptionService: EncryptionService,
    private commandService: CommandService,
    private oianalyticsMessageService: OIAnalyticsMessageService,
    private reloadService: ReloadService,
    private logger: pino.Logger
  ) {}

  start() {
    const registrationSettings = this.repositoryService.registrationRepository.getRegistrationSettings();
    if (registrationSettings && registrationSettings.checkUrl && registrationSettings.status === 'PENDING') {
      this.intervalCheckRegistration = setInterval(this.checkRegistration.bind(this), CHECK_TIMEOUT);
    }
    if (registrationSettings && registrationSettings.status === 'REGISTERED') {
      this.intervalCheckCommands = setInterval(this.checkCommands.bind(this), CHECK_TIMEOUT);
    }
  }

  getRegistrationSettings(): RegistrationSettingsDTO | null {
    return this.repositoryService.registrationRepository.getRegistrationSettings();
  }

  async updateRegistrationSettings(command: RegistrationSettingsCommandDTO): Promise<void> {
    const activationCode = generateRandomId(6);
    const registrationSettings = this.repositoryService.registrationRepository.getRegistrationSettings()!;
    if (!registrationSettings) {
      throw new Error(`Registration settings not found`);
    }

    if (!command.proxyPassword) {
      command.proxyPassword = registrationSettings.proxyPassword;
    } else {
      command.proxyPassword = await this.encryptionService.encryptText(command.proxyPassword);
    }

    const engineSettings = this.repositoryService.engineRepository.getEngineSettings()!;

    const oibusInfo = getOIBusInfo(engineSettings);
    const body = {
      activationCode,
      oibusVersion: oibusInfo.version,
      oibusArch: oibusInfo.architecture,
      oibusOs: oibusInfo.operatingSystem,
      oibusId: oibusInfo.oibusId,
      oibusName: oibusInfo.oibusName
    };
    let response;
    try {
      if (command.host.endsWith('/')) {
        command.host = command.host.slice(0, command.host.length - 1);
      }
      const url = `${command.host}/api/oianalytics/oibus/registration`;
      const agent = createProxyAgent(
        command.useProxy,
        url,
        command.useProxy
          ? {
              url: command.proxyUrl!,
              username: command.proxyUsername!,
              password: command.proxyPassword ? await this.encryptionService.decryptText(command.proxyPassword) : null
            }
          : null,
        command.acceptUnauthorized
      );
      response = await fetch(url, {
        method: 'POST',
        timeout: CHECK_TIMEOUT,
        agent,
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (fetchError) {
      throw new Error(`Registration failed: ${fetchError}`);
    }

    if (!response.ok) {
      throw new Error(`Registration failed with status code ${response.status} and message: ${response.statusText}`);
    }

    const result: { redirectUrl: string; expirationDate: Instant } = await response.json();
    this.repositoryService.registrationRepository.updateRegistration(command, activationCode, result.redirectUrl, result.expirationDate);
    if (!this.intervalCheckRegistration) {
      this.intervalCheckRegistration = setInterval(this.checkRegistration.bind(this), CHECK_TIMEOUT);
    }

    if (engineSettings.logParameters.oia.level !== 'silent') {
      await this.reloadService.restartLogger(engineSettings);
    }
  }

  async activateRegistration(activationDate: string, accessToken: string): Promise<void> {
    const encryptedToken = await this.encryptionService.encryptText(accessToken);
    this.repositoryService.registrationRepository.activateRegistration(activationDate, encryptedToken);
    if (this.intervalCheckRegistration) {
      clearInterval(this.intervalCheckRegistration);
      this.intervalCheckRegistration = null;
    }

    if (this.intervalCheckCommands) {
      clearInterval(this.intervalCheckCommands);
      this.intervalCheckCommands = null;
    }
    this.intervalCheckCommands = setInterval(this.checkCommands.bind(this), CHECK_TIMEOUT);
  }

  unregister() {
    this.repositoryService.registrationRepository.unregister();
    if (this.intervalCheckRegistration) {
      clearInterval(this.intervalCheckRegistration);
      this.intervalCheckRegistration = null;
    }

    if (this.intervalCheckCommands) {
      clearInterval(this.intervalCheckCommands);
      this.intervalCheckCommands = null;
    }
  }

  async checkRegistration(): Promise<void> {
    if (this.ongoingCheckRegistration) {
      this.logger.trace(`On going registration check`);
      return;
    }
    this.logger.trace(`Registration check`);
    const registrationSettings = this.repositoryService.registrationRepository.getRegistrationSettings();
    if (!registrationSettings || !registrationSettings.checkUrl) {
      this.logger.error(`Error while checking registration status: Could not retrieve check URL`);
      return;
    }
    let response;
    const url = `${registrationSettings.host}${registrationSettings.checkUrl}`;
    try {
      this.ongoingCheckRegistration = true;
      const agent = createProxyAgent(
        registrationSettings.useProxy,
        url,
        registrationSettings.useProxy
          ? {
              url: registrationSettings.proxyUrl!,
              username: registrationSettings.proxyUsername!,
              password: registrationSettings.proxyPassword
                ? await this.encryptionService.decryptText(registrationSettings.proxyPassword)
                : null
            }
          : null,
        registrationSettings.acceptUnauthorized
      );
      response = await fetch(url, {
        method: 'GET',
        timeout: CHECK_TIMEOUT,
        agent
      });
      if (!response.ok) {
        this.logger.error(`Error ${response.status} while checking registration status on ${url}: ${response.statusText}`);
        this.ongoingCheckRegistration = false;
        return;
      }

      const responseData: { status: string; expired: boolean; accessToken: string } = await response.json();
      if (responseData.status !== 'COMPLETED') {
        this.logger.warn(`Registration not completed. Status: ${responseData.status}`);
      } else {
        await this.activateRegistration(DateTime.now().toUTC().toISO()!, responseData.accessToken);
        this.logger.info(`OIBus registered on ${registrationSettings.host}`);
        await this.commandService.stop();
        this.commandService.start();
        await this.oianalyticsMessageService.stop();
        this.oianalyticsMessageService.start();
        const engineSettings = this.repositoryService.engineRepository.getEngineSettings()!;
        if (engineSettings.logParameters.oia.level !== 'silent') {
          await this.reloadService.restartLogger(engineSettings);
          this.logger = this.reloadService.loggerService.createChildLogger('internal');
        }
      }
    } catch (fetchError) {
      this.logger.error(`Error while checking registration status on ${url}. ${fetchError}`);
    }
    this.ongoingCheckRegistration = false;
  }

  async checkCommands(): Promise<void> {
    if (this.ongoingCheckCommands) {
      this.logger.trace(`On going commands check`);
      return;
    }
    this.ongoingCheckCommands = true;

    await this.sendAckCommands();
    await this.checkRetrievedCommands();
    await this.retrieveCommands();
    this.ongoingCheckCommands = false;
  }

  async sendAckCommands(): Promise<void> {
    const commandsToAck = this.repositoryService.commandRepository.searchCommandsList({
      status: [],
      types: [],
      ack: false
    });
    if (commandsToAck.length === 0) {
      return;
    }

    const endpoint = `/api/oianalytics/oibus/commands/status`;
    const registrationSettings = this.getRegistrationSettings();
    const connectionSettings = await getNetworkSettingsFromRegistration(registrationSettings, endpoint, this.encryptionService);
    let response;
    const url = `${connectionSettings.host}${endpoint}`;
    try {
      response = await fetch(url, {
        method: 'PUT',
        body: JSON.stringify(commandsToAck),
        headers: { ...connectionSettings.headers, 'Content-Type': 'application/json' },
        timeout: CHECK_TIMEOUT,
        agent: connectionSettings.agent
      });
      for (const command of commandsToAck) {
        this.repositoryService.commandRepository.markAsAcknowledged(command.id);
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
  async checkRetrievedCommands(): Promise<void> {
    const pendingCommands = this.repositoryService.commandRepository.searchCommandsList({ status: ['RETRIEVED'], types: [] });
    if (pendingCommands.length === 0) {
      return;
    }

    let endpoint = `/api/oianalytics/oibus/commands/list-by-ids?`;
    for (const command of pendingCommands) {
      endpoint += `ids=${command.id}&`;
    }
    endpoint = endpoint.slice(0, endpoint.length - 1);
    const registrationSettings = this.getRegistrationSettings();
    const connectionSettings = await getNetworkSettingsFromRegistration(registrationSettings, endpoint, this.encryptionService);
    let response;
    const url = `${connectionSettings.host}${endpoint}`;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: connectionSettings.headers,
        timeout: CHECK_TIMEOUT,
        agent: connectionSettings.agent
      });
      if (!response.ok) {
        this.logger.error(`Error ${response.status} while checking PENDING commands status on ${url}: ${response.statusText}`);
        return;
      }
      const commandsToCancel: Array<OIBusCommandDTO> = await response.json();
      if (commandsToCancel.length === 0) {
        this.logger.trace(`No command cancelled among the ${pendingCommands.length} commands`);
        return;
      }
      this.logger.trace(`${commandsToCancel.length} commands cancelled among the ${pendingCommands.length} pending commands`);
      for (const command of commandsToCancel) {
        this.commandService.removeCommandFromQueue(command.id);
        this.repositoryService.commandRepository.cancel(command.id);
      }
    } catch (fetchError) {
      this.logger.error(`Error while checking PENDING commands status on ${url}. ${fetchError}`);
    }
  }

  async retrieveCommands(): Promise<void> {
    const endpoint = `/api/oianalytics/oibus/commands/pending`;
    const registrationSettings = this.getRegistrationSettings();
    const connectionSettings = await getNetworkSettingsFromRegistration(registrationSettings, endpoint, this.encryptionService);
    let response;
    const url = `${connectionSettings.host}${endpoint}`;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: connectionSettings.headers,
        timeout: CHECK_TIMEOUT,
        agent: connectionSettings.agent
      });
      if (!response.ok) {
        this.logger.error(`Error ${response.status} while retrieving commands on ${url}: ${response.statusText}`);
        return;
      }
      const newCommands: Array<OIBusCommandDTO> = await response.json();
      if (newCommands.length === 0) {
        return;
      }
      this.logger.trace(`${newCommands.length} commands to add`);
      for (const command of newCommands) {
        const newCommand = this.repositoryService.commandRepository.create(command.id, command);
        this.commandService.addCommandToQueue(newCommand);
      }
      await this.sendAckCommands();
    } catch (fetchError) {
      this.logger.debug(`Error while retrieving commands on ${url}. ${fetchError}`);
    }
  }

  stop() {
    if (this.intervalCheckRegistration) {
      clearInterval(this.intervalCheckRegistration);
      this.intervalCheckRegistration = null;
    }

    if (this.intervalCheckCommands) {
      clearInterval(this.intervalCheckCommands);
      this.intervalCheckCommands = null;
    }
  }

  async onUnregister() {
    this.unregister();
    const engineSettings = this.repositoryService.engineRepository.getEngineSettings()!;
    if (engineSettings.logParameters.oia.level !== 'silent') {
      await this.reloadService.restartLogger(engineSettings);
    }
  }
}
