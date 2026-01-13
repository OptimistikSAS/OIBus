import { generateRandomId } from '../utils';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import { OIBusCommand } from '../../model/oianalytics-command.model';
import { OIAnalyticsFetchCommandDTO } from './oianalytics.model';
import { OIBusInfo, RegistrationSettingsCommandDTO } from '../../../shared/model/engine.model';
import { Instant } from '../../../shared/model/types';
import fs from 'node:fs/promises';
import { HTTPRequest, ReqOptions } from '../http-request.utils';
import { buildHttpOptions, getHeaders, getProxyOptions } from '../utils-oianalytics';

const OIANALYTICS_TIMEOUT = 30_000;
const OIANALYTICS_DOWNLOAD_TIMEOUT = 900_000; // 15 minutes
const COMMAND_STATUS_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/commands/status`;
const RETRIEVE_CANCELLED_COMMANDS_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/commands/list-by-ids`;
const RETRIEVE_PENDING_COMMANDS_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/commands/pending`;
const REGISTRATION_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/registration`;
const SEND_CONFIGURATION_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/configuration`;
const HISTORY_QUERY_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/configuration/history-query`;
const DOWNLOAD_UPDATE_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/upgrade/asset`;

export default class OIAnalyticsClient {
  async updateCommandStatus(registrationSettings: OIAnalyticsRegistration, payload: string): Promise<void> {
    const url = new URL(COMMAND_STATUS_OIANALYTICS_ENDPOINT, registrationSettings.host);
    const httpOptions = await buildHttpOptions('PUT', true, registrationSettings, null, OIANALYTICS_TIMEOUT, null);
    (httpOptions.headers! as Record<string, string>)['Content-Type'] = 'application/json';
    httpOptions.body = payload;

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
  }

  async retrieveCancelledCommands(
    registrationSettings: OIAnalyticsRegistration,
    commands: Array<OIBusCommand>
  ): Promise<Array<OIAnalyticsFetchCommandDTO>> {
    const url = new URL(RETRIEVE_CANCELLED_COMMANDS_OIANALYTICS_ENDPOINT, registrationSettings.host);
    const httpOptions = await buildHttpOptions('GET', true, registrationSettings, null, OIANALYTICS_TIMEOUT, null);
    httpOptions.query = { ids: commands.map(command => command.id) };

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
    return (await response.body.json()) as Array<OIAnalyticsFetchCommandDTO>;
  }

  async retrievePendingCommands(registrationSettings: OIAnalyticsRegistration): Promise<Array<OIAnalyticsFetchCommandDTO>> {
    const url = new URL(RETRIEVE_PENDING_COMMANDS_OIANALYTICS_ENDPOINT, registrationSettings.host);
    const httpOptions = await buildHttpOptions('GET', true, registrationSettings, null, OIANALYTICS_TIMEOUT, null);

    const response = await HTTPRequest(url, httpOptions);
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
    const url = new URL(REGISTRATION_OIANALYTICS_ENDPOINT, registration.host);
    const headers = await getHeaders(true, registration as OIAnalyticsRegistration);
    headers['Content-Type'] = 'application/json';
    const { proxy, acceptUnauthorized } = getProxyOptions(true, registration as OIAnalyticsRegistration, null);
    const httpOptions: ReqOptions = {
      method: 'POST',
      headers,
      body: JSON.stringify({
        activationCode: activationCode,
        oibusId: oibusInfo.oibusId,
        oibusName: oibusInfo.oibusName,
        oibusVersion: oibusInfo.version,
        oibusOs: oibusInfo.operatingSystem,
        oibusArch: oibusInfo.architecture,
        publicKey
      }),
      acceptUnauthorized,
      proxy,
      timeout: OIANALYTICS_TIMEOUT
    };

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }

    return { ...((await response.body.json()) as object), activationCode } as {
      redirectUrl: string;
      expirationDate: Instant;
      activationCode: string;
    };
  }

  async checkRegistration(
    registrationSettings: OIAnalyticsRegistration
  ): Promise<{ status: string; expired: boolean; accessToken: string }> {
    if (registrationSettings.checkUrl === null) {
      throw new Error('No check url specified');
    }
    const url = new URL(registrationSettings.checkUrl, registrationSettings.host);
    const headers = await getHeaders(true, registrationSettings);
    headers['Content-Type'] = 'application/json';
    const { proxy, acceptUnauthorized } = getProxyOptions(true, registrationSettings, null);
    const httpOptions: ReqOptions = {
      method: 'GET',
      headers,
      acceptUnauthorized,
      proxy,
      timeout: OIANALYTICS_TIMEOUT
    };

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }

    return (await response.body.json()) as { status: string; expired: boolean; accessToken: string };
  }

  async sendConfiguration(registrationSettings: OIAnalyticsRegistration, payload: string): Promise<void> {
    const url = new URL(SEND_CONFIGURATION_OIANALYTICS_ENDPOINT, registrationSettings.host);
    const httpOptions = await buildHttpOptions('PUT', true, registrationSettings, null, OIANALYTICS_TIMEOUT, null);
    (httpOptions.headers! as Record<string, string>)['Content-Type'] = 'application/json';
    httpOptions.body = payload;

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
  }

  async sendHistoryQuery(registrationSettings: OIAnalyticsRegistration, payload: string): Promise<void> {
    const url = new URL(HISTORY_QUERY_OIANALYTICS_ENDPOINT, registrationSettings.host);
    const httpOptions = await buildHttpOptions('PUT', true, registrationSettings, null, OIANALYTICS_TIMEOUT, null);
    (httpOptions.headers! as Record<string, string>)['Content-Type'] = 'application/json';
    httpOptions.body = payload;

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
  }

  async deleteHistoryQuery(registrationSettings: OIAnalyticsRegistration, historyId: string): Promise<void> {
    const url = new URL(HISTORY_QUERY_OIANALYTICS_ENDPOINT, registrationSettings.host);
    const httpOptions = await buildHttpOptions('DELETE', true, registrationSettings, null, OIANALYTICS_TIMEOUT, null);
    httpOptions.query = { historyId };

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
  }

  async downloadFile(registrationSettings: OIAnalyticsRegistration, assetId: string, filename: string): Promise<void> {
    const url = new URL(DOWNLOAD_UPDATE_OIANALYTICS_ENDPOINT, registrationSettings.host);
    const httpOptions = await buildHttpOptions('GET', true, registrationSettings, null, OIANALYTICS_DOWNLOAD_TIMEOUT, null);
    httpOptions.query = { assetId };

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
    const buffer = Buffer.from(await response.body.arrayBuffer());
    await fs.writeFile(filename, buffer);
  }
}
