import { createReadStream, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { OIBusInfo, RegistrationSettingsCommandDTO } from '../../../shared/model/api/engine.model';
import { Instant } from '../../../shared/model/common/types';
import {
  OIBusInteractiveSessionRequestCompletionDTO,
  OIBusInteractiveSessionRequestDTO
} from '../../../shared/model/oia/interactive-session.model';

import { OIBusCommand } from '../../model/oianalytics-command.model';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import { encryptionService } from '../encryption.service';
import { HTTPRequest, ReqOptions, ReqResponse } from '../http-request.utils';
import { generateRandomId } from '../utils';
import { buildHttpOptions, getHeaders, getProxyOptions, getUrl } from '../utils-oianalytics';
import { OIAnalyticsCheckRegistrationDTO, OIAnalyticsFetchCommandDTO, OIAnalyticsTokensDTO } from './oianalytics.model';

const OIANALYTICS_TIMEOUT = 30_000;
const OIANALYTICS_DOWNLOAD_TIMEOUT = 900_000; // 15 minutes
const COMMAND_STATUS_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/commands/status`;
const RETRIEVE_CANCELLED_COMMANDS_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/commands/list-by-ids`;
const RETRIEVE_PENDING_COMMANDS_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/commands/pending`;
const REGISTRATION_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/registration`;
const REFRESH_TOKEN_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/registration/token`;
const EXCHANGE_TOKEN_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/token/exchange`;
const SEND_CONFIGURATION_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/configuration`;
const HISTORY_QUERY_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/configuration/history-query`;
const SYNC_METADATA_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/sync-metadata`;
const DOWNLOAD_UPDATE_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/upgrade/asset`;
const CONFIGURATION_FILE_OIANALYTICS_ENDPOINT = `/api/oianalytics/oibus/commands/configuration-file`;
const COMMAND_FILE_OIANALYTICS_ENDPOINT = (commandId: string) => `/api/oianalytics/oibus/commands/${encodeURIComponent(commandId)}/file`;
const SESSION_OIANALYTICS_ENDPOINT = (sessionId: string) => `/api/oianalytics/oibus/sessions/${encodeURIComponent(sessionId)}`;
const SESSION_REQUEST_OIANALYTICS_ENDPOINT = (sessionId: string, requestId: string) =>
  `${SESSION_OIANALYTICS_ENDPOINT(sessionId)}/requests/${encodeURIComponent(requestId)}`;

async function* multipartStream(boundary: string, filename: string, dataStream: AsyncIterable<Buffer>, contentType = 'application/zip') {
  yield Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`
  );
  for await (const chunk of dataStream) {
    yield chunk;
  }
  yield Buffer.from(`\r\n--${boundary}--\r\n`);
}

/**
 * Thrown when OIAnalytics refuses to issue new tokens (refresh token unknown, expired or revoked): OIBus must be
 * registered again.
 */
export class OIAnalyticsInvalidGrantError extends Error {}

/**
 * Thrown when the OIAnalytics instance doesn't know the token endpoints yet (it has not been upgraded): OIBus keeps
 * using its long-lived token.
 */
export class OIAnalyticsTokenRefreshUnsupportedError extends Error {}

/**
 * Turn a failed token request into an error, telling apart the refusal of the grant from a transient failure
 */
async function tokenRequestError(response: ReqResponse): Promise<Error> {
  const text = await response.body.text();
  if (response.statusCode === 404) {
    return new OIAnalyticsTokenRefreshUnsupportedError(`${response.statusCode} - ${text}`);
  }
  if (response.statusCode === 401) {
    try {
      if ((JSON.parse(text) as { error?: string }).error === 'invalid_grant') {
        return new OIAnalyticsInvalidGrantError(`${response.statusCode} - ${text}`);
      }
    } catch {
      // not a JSON body: a transient failure (an API gateway refusing the request for example)
    }
  }
  return new Error(`${response.statusCode} - ${text}`);
}

export default class OIAnalyticsClient {
  async updateCommandStatus(registrationSettings: OIAnalyticsRegistration, payload: string): Promise<void> {
    const httpOptions = await buildHttpOptions('PUT', true, registrationSettings, null, OIANALYTICS_TIMEOUT, null);
    const url = getUrl(COMMAND_STATUS_OIANALYTICS_ENDPOINT, registrationSettings.host, {
      useApiGateway: registrationSettings.useApiGateway,
      apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint
    });
    (httpOptions.headers! as Record<string, string>)['Content-Type'] = 'application/json';
    httpOptions.body = payload;

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
    // Drain the response body so undici can return the connection to its pool.
    await response.body.dump();
  }

  async retrieveCancelledCommands(
    registrationSettings: OIAnalyticsRegistration,
    commands: Array<OIBusCommand>
  ): Promise<Array<OIAnalyticsFetchCommandDTO>> {
    const url = getUrl(RETRIEVE_CANCELLED_COMMANDS_OIANALYTICS_ENDPOINT, registrationSettings.host, {
      useApiGateway: registrationSettings.useApiGateway,
      apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint
    });
    const httpOptions = await buildHttpOptions('GET', true, registrationSettings, null, OIANALYTICS_TIMEOUT, null);
    httpOptions.query = { ids: commands.map(command => command.id) };

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
    return (await response.body.json()) as Array<OIAnalyticsFetchCommandDTO>;
  }

  async retrievePendingCommands(registrationSettings: OIAnalyticsRegistration): Promise<Array<OIAnalyticsFetchCommandDTO>> {
    const url = getUrl(RETRIEVE_PENDING_COMMANDS_OIANALYTICS_ENDPOINT, registrationSettings.host, {
      useApiGateway: registrationSettings.useApiGateway,
      apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint
    });
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
    const url = getUrl(REGISTRATION_OIANALYTICS_ENDPOINT, registration.host, {
      useApiGateway: registration.useApiGateway,
      apiGatewayBaseEndpoint: registration.apiGatewayBaseEndpoint
    });

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
        publicKey,
        tokenRefresh: true
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

  async checkRegistration(registrationSettings: OIAnalyticsRegistration): Promise<OIAnalyticsCheckRegistrationDTO> {
    if (registrationSettings.checkUrl === null) {
      throw new Error('No check url specified');
    }
    const url = getUrl(registrationSettings.checkUrl, registrationSettings.host, {
      useApiGateway: registrationSettings.useApiGateway,
      apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint
    });
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

    return (await response.body.json()) as OIAnalyticsCheckRegistrationDTO;
  }

  /**
   * Get a new access token (and a new refresh token, the current one becoming invalid) with the refresh token
   * @throws OIAnalyticsInvalidGrantError when OIAnalytics refuses the refresh token
   */
  async refreshToken(registrationSettings: OIAnalyticsRegistration): Promise<OIAnalyticsTokensDTO> {
    const url = getUrl(REFRESH_TOKEN_OIANALYTICS_ENDPOINT, registrationSettings.host, {
      useApiGateway: registrationSettings.useApiGateway,
      apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint
    });
    const headers = await getHeaders(true, registrationSettings);
    headers['Content-Type'] = 'application/json';
    const { proxy, acceptUnauthorized } = getProxyOptions(true, registrationSettings, null);
    const httpOptions: ReqOptions = {
      method: 'POST',
      headers,
      // the current public key is sent with each refresh, so that OIAnalytics gets the new one after a key rotation
      body: JSON.stringify({
        refreshToken: await encryptionService.decryptText(registrationSettings.refreshToken!),
        publicKey: registrationSettings.publicCipherKey
      }),
      acceptUnauthorized,
      proxy,
      timeout: OIANALYTICS_TIMEOUT
    };

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw await tokenRequestError(response);
    }
    return (await response.body.json()) as OIAnalyticsTokensDTO;
  }

  /**
   * Exchange the long-lived token of a registration made before the tokens could be refreshed for an access token and
   * a refresh token. OIAnalytics refuses the long-lived token afterward.
   * @throws OIAnalyticsInvalidGrantError when OIAnalytics refuses the long-lived token
   */
  async exchangeToken(registrationSettings: OIAnalyticsRegistration): Promise<OIAnalyticsTokensDTO> {
    const url = getUrl(EXCHANGE_TOKEN_OIANALYTICS_ENDPOINT, registrationSettings.host, {
      useApiGateway: registrationSettings.useApiGateway,
      apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint
    });
    const httpOptions = await buildHttpOptions('POST', true, registrationSettings, null, OIANALYTICS_TIMEOUT, null);

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw await tokenRequestError(response);
    }
    return (await response.body.json()) as OIAnalyticsTokensDTO;
  }

  async sendConfiguration(registrationSettings: OIAnalyticsRegistration, payload: string): Promise<void> {
    const url = getUrl(SEND_CONFIGURATION_OIANALYTICS_ENDPOINT, registrationSettings.host, {
      useApiGateway: registrationSettings.useApiGateway,
      apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint
    });
    const httpOptions = await buildHttpOptions('PUT', true, registrationSettings, null, OIANALYTICS_TIMEOUT, null);
    (httpOptions.headers! as Record<string, string>)['Content-Type'] = 'application/json';
    httpOptions.body = payload;

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
    // Drain the response body so undici can return the connection to its pool.
    await response.body.dump();
  }

  async sendHistoryQuery(registrationSettings: OIAnalyticsRegistration, payload: string): Promise<void> {
    const url = getUrl(HISTORY_QUERY_OIANALYTICS_ENDPOINT, registrationSettings.host, {
      useApiGateway: registrationSettings.useApiGateway,
      apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint
    });
    const httpOptions = await buildHttpOptions('PUT', true, registrationSettings, null, OIANALYTICS_TIMEOUT, null);
    (httpOptions.headers! as Record<string, string>)['Content-Type'] = 'application/json';
    httpOptions.body = payload;

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
    // Drain the response body so undici can return the connection to its pool.
    await response.body.dump();
  }

  async sendSyncMetadata(registrationSettings: OIAnalyticsRegistration, payload: string): Promise<void> {
    const url = getUrl(SYNC_METADATA_OIANALYTICS_ENDPOINT, registrationSettings.host, {
      useApiGateway: registrationSettings.useApiGateway,
      apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint
    });
    const httpOptions = await buildHttpOptions('PUT', true, registrationSettings, null, OIANALYTICS_TIMEOUT, null);
    (httpOptions.headers! as Record<string, string>)['Content-Type'] = 'application/json';
    httpOptions.body = payload;

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
    // Drain the response body so undici can return the connection to its pool.
    await response.body.dump();
  }

  async deleteHistoryQuery(registrationSettings: OIAnalyticsRegistration, historyId: string): Promise<void> {
    const url = getUrl(HISTORY_QUERY_OIANALYTICS_ENDPOINT, registrationSettings.host, {
      useApiGateway: registrationSettings.useApiGateway,
      apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint
    });
    const httpOptions = await buildHttpOptions('DELETE', true, registrationSettings, null, OIANALYTICS_TIMEOUT, null);
    httpOptions.query = { historyId };

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
    // Drain the response body so undici can return the connection to its pool.
    await response.body.dump();
  }

  async downloadFile(registrationSettings: OIAnalyticsRegistration, assetId: string, filename: string): Promise<void> {
    const url = getUrl(DOWNLOAD_UPDATE_OIANALYTICS_ENDPOINT, registrationSettings.host, {
      useApiGateway: registrationSettings.useApiGateway,
      apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint
    });
    const httpOptions = await buildHttpOptions('GET', true, registrationSettings, null, OIANALYTICS_DOWNLOAD_TIMEOUT, null);
    httpOptions.query = { assetId };

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
    await pipeline(response.body, createWriteStream(filename));
  }

  /**
   * Retrieves the content of a configuration file to import, stored in OIAnalytics.
   */
  async retrieveConfigurationFile(registrationSettings: OIAnalyticsRegistration, fileId: string): Promise<string> {
    const url = getUrl(CONFIGURATION_FILE_OIANALYTICS_ENDPOINT, registrationSettings.host, {
      useApiGateway: registrationSettings.useApiGateway,
      apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint
    });
    const httpOptions = await buildHttpOptions('GET', true, registrationSettings, null, OIANALYTICS_DOWNLOAD_TIMEOUT, null);
    httpOptions.query = { fileId };

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
    return response.body.text();
  }

  /**
   * Uploads the file produced by a command (memory dump, logs database...) to OIAnalytics, and returns its identifier there.
   */
  async uploadCommandFile(
    registrationSettings: OIAnalyticsRegistration,
    commandId: string,
    filePath: string,
    filename: string
  ): Promise<string> {
    const url = getUrl(COMMAND_FILE_OIANALYTICS_ENDPOINT(commandId), registrationSettings.host, {
      useApiGateway: registrationSettings.useApiGateway,
      apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint
    });
    const httpOptions = await buildHttpOptions('POST', true, registrationSettings, null, OIANALYTICS_DOWNLOAD_TIMEOUT, null);
    const boundary = `OIBusBoundary${Date.now()}`;
    httpOptions.body = Readable.from(multipartStream(boundary, filename, createReadStream(filePath)));
    httpOptions.headers = { ...httpOptions.headers, 'content-type': `multipart/form-data; boundary=${boundary}` };

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
    const { fileId } = (await response.body.json()) as { fileId: string };
    return fileId;
  }

  /**
   * Retrieves the requests of an interactive session not retrieved yet. A session closed or expired in OIAnalytics answers
   * a 404 error: OIBus must then stop polling it.
   */
  async retrieveSessionRequests(
    registrationSettings: OIAnalyticsRegistration,
    sessionId: string
  ): Promise<Array<OIBusInteractiveSessionRequestDTO>> {
    const url = getUrl(`${SESSION_OIANALYTICS_ENDPOINT(sessionId)}/requests`, registrationSettings.host, {
      useApiGateway: registrationSettings.useApiGateway,
      apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint
    });
    const httpOptions = await buildHttpOptions('GET', true, registrationSettings, null, OIANALYTICS_TIMEOUT, null);

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
    return (await response.body.json()) as Array<OIBusInteractiveSessionRequestDTO>;
  }

  /**
   * Sends the result of a request of an interactive session.
   */
  async completeSessionRequest(
    registrationSettings: OIAnalyticsRegistration,
    sessionId: string,
    requestId: string,
    completion: OIBusInteractiveSessionRequestCompletionDTO
  ): Promise<void> {
    const url = getUrl(SESSION_REQUEST_OIANALYTICS_ENDPOINT(sessionId, requestId), registrationSettings.host, {
      useApiGateway: registrationSettings.useApiGateway,
      apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint
    });
    const httpOptions = await buildHttpOptions('PUT', true, registrationSettings, null, OIANALYTICS_TIMEOUT, null);
    (httpOptions.headers! as Record<string, string>)['Content-Type'] = 'application/json';
    httpOptions.body = JSON.stringify(completion);

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
    await response.body.dump();
  }

  /**
   * Uploads the file holding a result of a request of an interactive session too large to be sent inline, before the
   * request is completed.
   */
  async uploadSessionRequestFile(
    registrationSettings: OIAnalyticsRegistration,
    sessionId: string,
    requestId: string,
    filePath: string,
    filename: string
  ): Promise<void> {
    const url = getUrl(`${SESSION_REQUEST_OIANALYTICS_ENDPOINT(sessionId, requestId)}/file`, registrationSettings.host, {
      useApiGateway: registrationSettings.useApiGateway,
      apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint
    });
    const httpOptions = await buildHttpOptions('POST', true, registrationSettings, null, OIANALYTICS_DOWNLOAD_TIMEOUT, null);
    const boundary = `OIBusBoundary${Date.now()}`;
    httpOptions.body = Readable.from(multipartStream(boundary, filename, createReadStream(filePath), 'application/json'));
    httpOptions.headers = { ...httpOptions.headers, 'content-type': `multipart/form-data; boundary=${boundary}` };

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
    await response.body.dump();
  }

  /**
   * Closes an interactive session from OIBus (when it stops).
   */
  async closeSession(registrationSettings: OIAnalyticsRegistration, sessionId: string): Promise<void> {
    const url = getUrl(SESSION_OIANALYTICS_ENDPOINT(sessionId), registrationSettings.host, {
      useApiGateway: registrationSettings.useApiGateway,
      apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint
    });
    const httpOptions = await buildHttpOptions('DELETE', true, registrationSettings, null, OIANALYTICS_TIMEOUT, null);

    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`${response.statusCode} - ${await response.body.text()}`);
    }
    await response.body.dump();
  }
}
