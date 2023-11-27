import fs from 'node:fs/promises';
import fetch from 'node-fetch';
import OIBusEngine from '../engine/oibus-engine';
import HistoryQueryEngine from '../engine/history-query-engine';
import { OibusUpdateCheckResponse, OibusUpdateDTO } from '../../../shared/model/update.model';
import { downloadFile, generateRandomId, getOIBusInfo, unzip } from './utils';
import RepositoryService from './repository.service';
import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../shared/model/engine.model';
import EncryptionService from './encryption.service';
import pino from 'pino';
import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';

const CHECK_TIMEOUT = 10_000;

export default class OIBusService {
  private static UPDATE_URL = 'http://localhost:3333/api/update';
  private static DOWNLOAD_URL = 'http://localhost:3333/api/oibus';
  private static DOWNLOAD_TIMEOUT = 60000;
  private interval: NodeJS.Timeout | null = null;
  private ongoingCheckRegistration = false;

  constructor(
    private engine: OIBusEngine,
    private historyEngine: HistoryQueryEngine,
    private repositoryService: RepositoryService,
    private encryptionService: EncryptionService,
    private logger: pino.Logger
  ) {
    const registrationSettings = this.repositoryService.registrationRepository.getRegistrationSettings();
    if (registrationSettings && registrationSettings.checkUrl && registrationSettings.status === 'PENDING') {
      this.interval = setInterval(this.checkRegistration.bind(this), CHECK_TIMEOUT);
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
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
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
    const registrationSettings = this.repositoryService.registrationRepository.getRegistrationSettings();
    const engineSettings = this.repositoryService.engineRepository.getEngineSettings()!;
    if (!registrationSettings) {
      throw new Error(`Registration settings not found`);
    }
    const oibusInfo = getOIBusInfo();
    const body = {
      activationCode,
      oibusVersion: oibusInfo.version,
      oibusId: engineSettings.id,
      oibusName: engineSettings.name
    };
    let response;
    try {
      const url = `${command.host}/api/oianalytics/oibus/registration`;
      response = await fetch(url, {
        method: 'POST',
        timeout: CHECK_TIMEOUT,
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
    if (!this.interval) {
      this.interval = setInterval(this.checkRegistration.bind(this), CHECK_TIMEOUT);
    }
  }

  async activateRegistration(activationDate: string, accessToken: string): Promise<void> {
    const encryptedToken = await this.encryptionService.encryptText(accessToken);
    this.repositoryService.registrationRepository.activateRegistration(activationDate, encryptedToken);
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  unregister() {
    this.repositoryService.registrationRepository.unregister();
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
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
      response = await fetch(url, {
        method: 'GET',
        timeout: CHECK_TIMEOUT
      });
      if (!response.ok) {
        this.logger.error(`Error ${response.status} while checking registration status on ${url}: ${response.statusText}`);
        this.ongoingCheckRegistration = false;
        return;
      }

      const responseData: { status: string; expired: boolean; accessToken: string } = await response.json();
      if (responseData.status !== 'COMPLETED') {
        this.logger.error(`Registration not completed. Status: ${responseData.status}`);
      } else {
        await this.activateRegistration(DateTime.now().toUTC().toISO()!, responseData.accessToken);
        this.logger.info(`OIBus registered on ${registrationSettings.host}`);
      }
    } catch (fetchError) {
      this.logger.error(`Error while checking registration status on ${url}. ${fetchError}`);
    }
    this.ongoingCheckRegistration = false;
  }

  async checkForUpdate(): Promise<OibusUpdateDTO> {
    const oibusInfo = getOIBusInfo();
    let response;

    try {
      const url = `${OIBusService.UPDATE_URL}?platform=${oibusInfo.platform}&architecture=${oibusInfo.architecture}`;
      response = await fetch(url, {
        timeout: CHECK_TIMEOUT
      });
    } catch (fetchError) {
      throw new Error(`Update check failed: ${fetchError}`);
    }

    if (!response.ok) {
      throw new Error(`Update check failed with status code ${response.status} and message: ${response.statusText}`);
    }

    const responseData = (await response.json()) as OibusUpdateCheckResponse;
    return {
      hasAvailableUpdate: responseData.latestVersion !== oibusInfo.version,
      actualVersion: oibusInfo.version,
      latestVersion: responseData.latestVersion,
      changelog: responseData.changelog
    };
  }

  async downloadUpdate(): Promise<void> {
    const oibusInfo = getOIBusInfo();
    const url = `${OIBusService.DOWNLOAD_URL}?platform=${oibusInfo.platform}&architecture=${oibusInfo.architecture}`;
    const filename = `oibus-${oibusInfo.platform}_${oibusInfo.architecture}.zip`;

    await downloadFile(url, filename, OIBusService.DOWNLOAD_TIMEOUT);
    await unzip(filename, '.');
    await fs.unlink(filename);
  }
}
