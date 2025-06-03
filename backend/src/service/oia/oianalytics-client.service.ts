import { generateRandomId } from '../utils';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import { OIBusCommand } from '../../model/oianalytics-command.model';
import { OIAnalyticsFetchCommandDTO } from './oianalytics.model';
import { OIBusInfo, RegistrationSettingsCommandDTO } from '../../../shared/model/engine.model';
import { Instant } from '../../../shared/model/types';
import fs from 'node:fs/promises';
import { HTTPRequest, ReqProxyOptions } from '../http-request.utils';

const OIANALYTICS_TIMEOUT = 10_000;
const OIANALYTICS_DOWNLOAD_TIMEOUT = 900_000; // 15 minutes
const COMMAND_STATUS_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/commands/status`;
const RETRIEVE_CANCELLED_COMMANDS_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/commands/list-by-ids`;
const RETRIEVE_PENDING_COMMANDS_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/commands/pending`;
const REGISTRATION_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/registration`;
const SEND_CONFIGURATION_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/configuration`;
const HISTORY_QUERY_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/configuration/history-query`;
const DOWNLOAD_UPDATE_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/upgrade/asset`;

export default class OIAnalyticsClient {
  async updateCommandStatus(registration: OIAnalyticsRegistration, payload: string): Promise<void> {
    const url = new URL(COMMAND_STATUS_OIANALYTICS_ENDPOINT, registration.host);

    if (registration.token === null) {
      throw new Error('No registration token');
    }

    const { proxy, acceptUnauthorized } = this.getProxyOptions(registration);
    const response = await HTTPRequest(url, {
      method: 'PUT',
      body: payload,
      headers: { 'Content-Type': 'application/json' },
      auth: { type: 'bearer', token: registration.token },
      proxy,
      timeout: OIANALYTICS_TIMEOUT,
      acceptUnauthorized
    });
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
  }

  async retrieveCancelledCommands(
    registration: OIAnalyticsRegistration,
    commands: Array<OIBusCommand>
  ): Promise<Array<OIAnalyticsFetchCommandDTO>> {
    const url = new URL(RETRIEVE_CANCELLED_COMMANDS_OIANALYTICS_ENDPOINT, registration.host);

    if (registration.token === null) {
      throw new Error('No registration token');
    }

    const { proxy, acceptUnauthorized } = this.getProxyOptions(registration);
    const response = await HTTPRequest(url, {
      method: 'GET',
      query: { ids: commands.map(command => command.id) },
      auth: { type: 'bearer', token: registration.token },
      proxy,
      timeout: OIANALYTICS_TIMEOUT,
      acceptUnauthorized
    });
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
    return (await response.body.json()) as Array<OIAnalyticsFetchCommandDTO>;
  }

  async retrievePendingCommands(registration: OIAnalyticsRegistration): Promise<Array<OIAnalyticsFetchCommandDTO>> {
    const url = new URL(RETRIEVE_PENDING_COMMANDS_OIANALYTICS_ENDPOINT, registration.host);

    if (registration.token === null) {
      throw new Error('No registration token');
    }

    const { proxy, acceptUnauthorized } = this.getProxyOptions(registration);
    const response = await HTTPRequest(url, {
      method: 'GET',
      auth: { type: 'bearer', token: registration.token },
      proxy,
      timeout: OIANALYTICS_TIMEOUT,
      acceptUnauthorized
    });
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
    return (await response.body.json()) as Array<OIAnalyticsFetchCommandDTO>;
  }

  async register(
    registration: RegistrationSettingsCommandDTO,
    oibusInfo: OIBusInfo,
    publicKey: string
  ): Promise<{ redirectUrl: string; expirationDate: Instant; activationCode: string }> {
    const activationCode = generateRandomId(6);
    const body = {
      activationCode,
      oibusId: oibusInfo.oibusId,
      oibusName: oibusInfo.oibusName,
      oibusVersion: oibusInfo.version,
      oibusOs: oibusInfo.operatingSystem,
      oibusArch: oibusInfo.architecture,
      publicKey
    };

    const url = new URL(REGISTRATION_OIANALYTICS_ENDPOINT, registration.host);

    const { proxy, acceptUnauthorized } = this.getProxyOptions(registration);
    const response = await HTTPRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      proxy,
      timeout: OIANALYTICS_TIMEOUT,
      acceptUnauthorized
    });
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }

    return { ...((await response.body.json()) as object), activationCode } as {
      redirectUrl: string;
      expirationDate: Instant;
      activationCode: string;
    };
  }

  async checkRegistration(registration: OIAnalyticsRegistration): Promise<{ status: string; expired: boolean; accessToken: string }> {
    if (registration.checkUrl === null) {
      throw new Error('No check url specified');
    }

    const url = new URL(registration.checkUrl, registration.host);

    const { proxy, acceptUnauthorized } = this.getProxyOptions(registration);
    const response = await HTTPRequest(url, {
      method: 'GET',
      proxy,
      timeout: OIANALYTICS_TIMEOUT,
      acceptUnauthorized
    });
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }

    return (await response.body.json()) as { status: string; expired: boolean; accessToken: string };
  }

  async sendConfiguration(registration: OIAnalyticsRegistration, payload: string): Promise<void> {
    const url = new URL(SEND_CONFIGURATION_OIANALYTICS_ENDPOINT, registration.host);

    if (registration.token === null) {
      throw new Error('No registration token');
    }

    const { proxy, acceptUnauthorized } = this.getProxyOptions(registration);
    const response = await HTTPRequest(url, {
      method: 'PUT',
      body: payload,
      headers: { 'Content-Type': 'application/json' },
      auth: { type: 'bearer', token: registration.token },
      proxy,
      timeout: OIANALYTICS_TIMEOUT,
      acceptUnauthorized
    });
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
  }

  async sendHistoryQuery(registration: OIAnalyticsRegistration, payload: string): Promise<void> {
    const url = new URL(HISTORY_QUERY_OIANALYTICS_ENDPOINT, registration.host);

    if (registration.token === null) {
      throw new Error('No registration token');
    }

    const { proxy, acceptUnauthorized } = this.getProxyOptions(registration);
    const response = await HTTPRequest(url, {
      method: 'PUT',
      body: payload,
      headers: { 'Content-Type': 'application/json' },
      auth: { type: 'bearer', token: registration.token },
      proxy,
      timeout: OIANALYTICS_TIMEOUT,
      acceptUnauthorized
    });
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
  }

  async deleteHistoryQuery(registration: OIAnalyticsRegistration, historyId: string): Promise<void> {
    const url = new URL(HISTORY_QUERY_OIANALYTICS_ENDPOINT, registration.host);

    if (registration.token === null) {
      throw new Error('No registration token');
    }

    const { proxy, acceptUnauthorized } = this.getProxyOptions(registration);
    const response = await HTTPRequest(url, {
      method: 'DELETE',
      query: { historyId },
      headers: { 'Content-Type': 'application/json' },
      auth: { type: 'bearer', token: registration.token },
      proxy,
      timeout: OIANALYTICS_TIMEOUT,
      acceptUnauthorized
    });
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
  }

  async downloadFile(registration: OIAnalyticsRegistration, assetId: string, filename: string): Promise<void> {
    const url = new URL(DOWNLOAD_UPDATE_OIANALYTICS_ENDPOINT, registration.host);

    if (registration.token === null) {
      throw new Error('No registration token');
    }

    const { proxy, acceptUnauthorized } = this.getProxyOptions(registration);
    const response = await HTTPRequest(url, {
      method: 'GET',
      query: { assetId },
      auth: { type: 'bearer', token: registration.token },
      proxy,
      timeout: OIANALYTICS_DOWNLOAD_TIMEOUT,
      acceptUnauthorized
    });
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
    const buffer = Buffer.from(await response.body.arrayBuffer());
    await fs.writeFile(filename, buffer);
  }

  private getProxyOptions(registrationSettings: RegistrationSettingsCommandDTO): {
    proxy: ReqProxyOptions | undefined;
    acceptUnauthorized: boolean;
  } {
    if (!registrationSettings.useProxy) {
      return { proxy: undefined, acceptUnauthorized: registrationSettings.acceptUnauthorized };
    }
    if (!registrationSettings.proxyUrl) {
      throw new Error('Proxy URL not specified');
    }

    const options: ReqProxyOptions = {
      url: registrationSettings.proxyUrl
    };

    if (registrationSettings.proxyUsername) {
      options.auth = {
        type: 'url',
        username: registrationSettings.proxyUsername,
        password: registrationSettings.proxyPassword
      };
    }

    return { proxy: options, acceptUnauthorized: registrationSettings.acceptUnauthorized };
  }
}
