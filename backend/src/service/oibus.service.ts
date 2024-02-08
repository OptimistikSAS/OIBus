import fetch from 'node-fetch';
import OIBusEngine from '../engine/oibus-engine';
import HistoryQueryEngine from '../engine/history-query-engine';
import { generateRandomId, getNetworkSettingsFromRegistration, getOIBusInfo } from './utils';
import RepositoryService from './repository.service';
import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../shared/model/engine.model';
import EncryptionService from './encryption.service';
import pino from 'pino';
import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { createProxyAgent } from './proxy.service';
import { OIBusCommand, OIBusCommandDTO } from '../../../shared/model/command.model';

const CHECK_TIMEOUT = 10_000;

export default class OIBusService {
  private intervalCheckRegistration: NodeJS.Timeout | null = null;
  private intervalCheckCommands: NodeJS.Timeout | null = null;
  private ongoingCheckRegistration = false;
  private ongoingCheckCommands = false;

  constructor(
    private engine: OIBusEngine,
    private historyEngine: HistoryQueryEngine,
    private repositoryService: RepositoryService,
    private encryptionService: EncryptionService,
    private logger: pino.Logger
  ) {
    const registrationSettings = this.repositoryService.registrationRepository.getRegistrationSettings();
    if (registrationSettings && registrationSettings.checkUrl && registrationSettings.status === 'PENDING') {
      this.intervalCheckRegistration = setInterval(this.checkRegistration.bind(this), CHECK_TIMEOUT);
    }
    if (registrationSettings && registrationSettings.status === 'REGISTERED') {
      this.intervalCheckCommands = setInterval(this.checkCommands.bind(this), CHECK_TIMEOUT);
    }
  }

  async restartOIBus(): Promise<void> {
    await this.engine.stop();
    await this.historyEngine.stop();
    await this.engine.start();
    await this.historyEngine.start();
  }

  async stopOIBus(): Promise<void> {
    await this.engine.stop();
    await this.historyEngine.stop();
    if (this.intervalCheckRegistration) {
      clearInterval(this.intervalCheckRegistration);
      this.intervalCheckRegistration = null;
    }

    if (this.intervalCheckCommands) {
      clearInterval(this.intervalCheckCommands);
      this.intervalCheckCommands = null;
    }
  }

  async addValues(externalSourceId: string | null, values: Array<any>): Promise<void> {
    await this.engine.addExternalValues(externalSourceId, values);
  }

  async addFile(externalSourceId: string | null, filePath: string): Promise<void> {
    await this.engine.addExternalFile(externalSourceId, filePath);
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

    const oibusInfo = getOIBusInfo();
    const body = {
      activationCode,
      oibusVersion: oibusInfo.version,
      oibusArch: oibusInfo.architecture,
      oibusOs: oibusInfo.operatingSystem,
      oibusId: engineSettings.id,
      oibusName: engineSettings.name
    };
    let response;
    try {
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
    const engineSettings = this.repositoryService.engineRepository.getEngineSettings()!;

    await this.sendAckCommands(engineSettings.id);
    await this.checkPendingCommands(engineSettings.id);
    await this.retrieveCommands(engineSettings.id);
    this.ongoingCheckCommands = false;
  }

  async sendAckCommands(oibusId: string): Promise<void> {
    const commandsToAck = this.repositoryService.commandRepository.searchCommandsList({
      status: ['COMPLETED', 'ERRORED', 'CANCELLED'],
      types: [],
      ack: false
    });
    if (commandsToAck.length === 0) {
      return;
    }

    const endpoint = `/api/oianalytics/oibus-commands/${oibusId}/ack`;
    const registrationSettings = this.getRegistrationSettings();
    const connectionSettings = await getNetworkSettingsFromRegistration(registrationSettings, endpoint, this.encryptionService);
    let response;
    const url = `${connectionSettings.host}${endpoint}`;
    try {
      response = await fetch(url, {
        method: 'PUT',
        body: JSON.stringify(commandsToAck),
        headers: connectionSettings.headers,
        timeout: CHECK_TIMEOUT,
        agent: connectionSettings.agent
      });
      if (!response.ok) {
        this.logger.error(
          `Error ${response.status} while acknowledging ${commandsToAck.length} commands on ${url}: ${response.statusText}`
        );
        return;
      }
      for (const command of commandsToAck) {
        this.repositoryService.commandRepository.markAsAcknowledged(command.id);
      }
      this.logger.trace(`${commandsToAck.length} commands acknowledged`);
    } catch (fetchError) {
      this.logger.error(`Error while acknowledging ${commandsToAck.length} commands on ${url}. ${fetchError}`);
    }
  }

  async checkPendingCommands(oibusId: string): Promise<void> {
    const pendingCommands = this.repositoryService.commandRepository.searchCommandsList({ status: ['PENDING'], types: [] });
    if (pendingCommands.length === 0) {
      return;
    }

    let endpoint = `/api/oianalytics/oibus-commands/${oibusId}/check?`;
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
        // TODO: remove from queue
        this.repositoryService.commandRepository.cancel(command.id);
      }
    } catch (fetchError) {
      this.logger.error(`Error while checking PENDING commands status on ${url}. ${fetchError}`);
    }
  }

  async retrieveCommands(oibusId: string): Promise<void> {
    const endpoint = `/api/oianalytics/oibus-commands/${oibusId}/retrieve-commands`;
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
        this.logger.trace(`No command to create`);
        return;
      }
      this.logger.trace(`${newCommands.length} commands to add`);
      for (const command of newCommands) {
        // TODO: add to queue
        const creationCommand: OIBusCommand = {
          type: command.type,
          version: command.version,
          assetId: command.assetId
        };
        this.repositoryService.commandRepository.create(command.id, creationCommand);
      }
    } catch (fetchError) {
      this.logger.error(`Error while retrieving commands on ${url}. ${fetchError}`);
    }
  }
}
