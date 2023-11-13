import fs from 'node:fs/promises';
import fetch from 'node-fetch';
import OIBusEngine from '../engine/oibus-engine';
import HistoryQueryEngine from '../engine/history-query-engine';
import { OibusUpdateCheckResponse, OibusUpdateDTO } from '../../../shared/model/update.model';
import { downloadFile, generateRandomId, getOIBusInfo, unzip } from './utils';
import RepositoryService from './repository.service';
import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';

export default class OIBusService {
  private static UPDATE_URL = 'http://localhost:3333/api/update';
  private static DOWNLOAD_URL = 'http://localhost:3333/api/oibus';
  private static CHECK_TIMEOUT = 10000;
  private static DOWNLOAD_TIMEOUT = 60000;

  constructor(
    private engine: OIBusEngine,
    private historyEngine: HistoryQueryEngine,
    private repositoryService: RepositoryService
  ) {}

  async restartOIBus(): Promise<void> {
    await this.engine.stop();
    await this.historyEngine.stop();
    await this.engine.start();
    await this.historyEngine.start();
  }

  async stopOIBus(): Promise<void> {
    await this.engine.stop();
    await this.historyEngine.stop();
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

  updateRegistrationSettings(command: RegistrationSettingsCommandDTO): void {
    this.repositoryService.registrationRepository.updateRegistrationSettings(command);
  }

  createActivationCode(): void {
    const activationCode = generateRandomId(6);
    this.repositoryService.registrationRepository.createActivationCode(
      activationCode,
      DateTime.now()
        .toUTC()
        .plus(60000 * 10)
        .toISO()!
    );
  }

  activateRegistration(activationDate: string): void {
    this.repositoryService.registrationRepository.activateRegistration(activationDate);
  }

  async checkForUpdate(): Promise<OibusUpdateDTO> {
    const oibusInfo = getOIBusInfo();
    let response;

    try {
      const url = `${OIBusService.UPDATE_URL}?platform=${oibusInfo.platform}&architecture=${oibusInfo.architecture}`;
      response = await fetch(url, {
        timeout: OIBusService.CHECK_TIMEOUT
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
