import { generateRandomId } from '../utils';
import EncryptionService from '../encryption.service';
import fetch from 'node-fetch';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import { OIBusCommand } from '../../model/oianalytics-command.model';
import { OIAnalyticsFetchCommandDTO } from './oianalytics.model';
import { OIBusInfo, RegistrationSettingsCommandDTO } from '../../../../shared/model/engine.model';
import { Instant } from '../../../../shared/model/types';
import fs from 'node:fs/promises';
import { RequestOptions } from 'http';
import { createProxyAgent } from '../proxy-agent';

const OIANALYTICS_TIMEOUT = 10_000;
const OIANALYTICS_DOWNLOAD_TIMEOUT = 900_000; // 15 minutes
const COMMAND_STATUS_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/commands/status`;
const RETRIEVE_CANCELLED_COMMANDS_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/commands/list-by-ids`;
const RETRIEVE_PENDING_COMMANDS_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/commands/pending`;
const REGISTRATION_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/registration`;
const SEND_CONFIGURATION_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/configuration`;
const DOWNLOAD_UPDATE_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/upgrade/asset`;

export default class OIAnalyticsClient {
  constructor(private readonly encryptionService: EncryptionService) {}

  async updateCommandStatus(registration: OIAnalyticsRegistration, payload: string): Promise<void> {
    const connectionSettings = await this.getNetworkSettingsFromRegistration(registration, COMMAND_STATUS_OIANALYTICS_ENDPOINT);
    const url = `${connectionSettings.host}${COMMAND_STATUS_OIANALYTICS_ENDPOINT}`;
    const response = await fetch(url, {
      method: 'PUT',
      body: payload,
      headers: {
        authorization: `Bearer ${await this.encryptionService.decryptText(registration.token!)}`,
        'Content-Type': 'application/json'
      },
      timeout: OIANALYTICS_TIMEOUT,
      agent: connectionSettings.agent
    });
    if (!response.ok) {
      throw new Error(`${response.status} - ${response.statusText}`);
    }
  }

  async retrieveCancelledCommands(
    registration: OIAnalyticsRegistration,
    commands: Array<OIBusCommand>
  ): Promise<Array<OIAnalyticsFetchCommandDTO>> {
    let endpoint = `${RETRIEVE_CANCELLED_COMMANDS_OIANALYTICS_ENDPOINT}?`;
    for (const command of commands) {
      endpoint += `ids=${encodeURIComponent(command.id)}&`;
    }
    endpoint = endpoint.slice(0, endpoint.length - 1);
    const connectionSettings = await this.getNetworkSettingsFromRegistration(registration, endpoint);
    const url = `${connectionSettings.host}${endpoint}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${await this.encryptionService.decryptText(registration.token!)}`
      },
      timeout: OIANALYTICS_TIMEOUT,
      agent: connectionSettings.agent
    });
    if (!response.ok) {
      throw new Error(`${response.status} - ${response.statusText}`);
    }
    return (await response.json()) as Array<OIAnalyticsFetchCommandDTO>;
  }

  async retrievePendingCommands(registration: OIAnalyticsRegistration): Promise<Array<OIAnalyticsFetchCommandDTO>> {
    const connectionSettings = await this.getNetworkSettingsFromRegistration(registration, RETRIEVE_PENDING_COMMANDS_OIANALYTICS_ENDPOINT);
    const url = `${connectionSettings.host}${RETRIEVE_PENDING_COMMANDS_OIANALYTICS_ENDPOINT}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${await this.encryptionService.decryptText(registration.token!)}`
      },
      timeout: OIANALYTICS_TIMEOUT,
      agent: connectionSettings.agent
    });
    if (!response.ok) {
      throw new Error(`${response.status} - ${response.statusText}`);
    }
    return (await response.json()) as Array<OIAnalyticsFetchCommandDTO>;
  }

  async register(
    registration: RegistrationSettingsCommandDTO,
    oibusInfo: OIBusInfo,
    publicKey: string
  ): Promise<{ redirectUrl: string; expirationDate: Instant; activationCode: string }> {
    const activationCode = generateRandomId(6);
    const body = {
      activationCode,
      oibusVersion: oibusInfo.version,
      oibusArch: oibusInfo.architecture,
      oibusOs: oibusInfo.operatingSystem,
      oibusId: oibusInfo.oibusId,
      oibusName: oibusInfo.oibusName,
      publicKey
    };

    const connectionSettings = await this.getNetworkSettingsFromRegistration(registration, REGISTRATION_OIANALYTICS_ENDPOINT);
    const url = `${connectionSettings.host}${REGISTRATION_OIANALYTICS_ENDPOINT}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      timeout: OIANALYTICS_TIMEOUT,
      agent: connectionSettings.agent
    });
    if (!response.ok) {
      throw new Error(`${response.status} - ${response.statusText}`);
    }

    return (await response.json()) as { redirectUrl: string; expirationDate: Instant; activationCode: string };
  }

  async checkRegistration(registration: OIAnalyticsRegistration): Promise<{ status: string; expired: boolean; accessToken: string }> {
    const connectionSettings = await this.getNetworkSettingsFromRegistration(registration, REGISTRATION_OIANALYTICS_ENDPOINT);
    const url = `${connectionSettings.host}${REGISTRATION_OIANALYTICS_ENDPOINT}`;

    const response = await fetch(url, {
      method: 'GET',
      timeout: OIANALYTICS_TIMEOUT,
      agent: connectionSettings.agent
    });
    if (!response.ok) {
      throw new Error(`${response.status} - ${response.statusText}`);
    }

    return (await response.json()) as { status: string; expired: boolean; accessToken: string };
  }

  async sendConfiguration(registration: OIAnalyticsRegistration, payload: string): Promise<void> {
    const connectionSettings = await this.getNetworkSettingsFromRegistration(registration, SEND_CONFIGURATION_OIANALYTICS_ENDPOINT);
    const url = `${connectionSettings.host}${SEND_CONFIGURATION_OIANALYTICS_ENDPOINT}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${await this.encryptionService.decryptText(registration.token!)}`,
        'Content-Type': 'application/json'
      },
      body: payload,
      timeout: OIANALYTICS_TIMEOUT,
      agent: connectionSettings.agent
    });
    if (!response.ok) {
      throw new Error(`${response.status} - ${response.statusText}`);
    }
  }

  async downloadFile(registration: OIAnalyticsRegistration, assetId: string, filename: string): Promise<void> {
    const endpoint = `${DOWNLOAD_UPDATE_OIANALYTICS_ENDPOINT}?assetId=${assetId}`;

    const connectionSettings = await this.getNetworkSettingsFromRegistration(registration, endpoint);

    const response = await fetch(`${connectionSettings.host}${endpoint}`, {
      method: 'GET',
      timeout: OIANALYTICS_DOWNLOAD_TIMEOUT,
      agent: connectionSettings.agent,
      headers: {
        authorization: `Bearer ${await this.encryptionService.decryptText(registration.token!)}`
      }
    });
    if (!response.ok) {
      throw new Error(`${response.status} - ${response.statusText}`);
    }
    const buffer = await response.buffer();
    await fs.writeFile(filename, buffer);
  }

  private async getNetworkSettingsFromRegistration(
    registrationSettings: RegistrationSettingsCommandDTO,
    endpoint: string
  ): Promise<{ host: string; agent: RequestOptions['agent'] | undefined }> {
    if (registrationSettings.host.endsWith('/')) {
      registrationSettings.host = registrationSettings.host.slice(0, registrationSettings.host.length - 1);
    }
    const agent = createProxyAgent(
      registrationSettings.useProxy,
      `${registrationSettings.host}${endpoint}`,
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

    return {
      host: registrationSettings.host,
      agent
    };
  }
}
