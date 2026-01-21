import { SouthOIAnalyticsSettingsSpecificSettings } from 'shared/model/south-settings.model';
import { OIAnalyticsRegistration } from '../model/oianalytics-registration.model';
import { NorthOIAnalyticsSettingsSpecificSettings } from '../../shared/model/north-settings.model';
import { HTTPRequest, ReqAuthOptions, ReqOptions, ReqProxyOptions, ReqResponse } from './http-request.utils';
import { ClientCertificateCredential, ClientSecretCredential } from '@azure/identity';
import { encryptionService } from './encryption.service';
import { OIBusTimeValue } from '../../shared/model/engine.model';
import { DateTime } from 'luxon';
import { Instant } from '../model/types';
import CertificateRepository from '../repository/config/certificate.repository';

export interface OIATimeValues {
  type: string;
  data?: {
    id: string;
    dataType: string;
    reference: string;
    description: string;
  };
  unit?: {
    id: string;
    label: string;
  };
  values: Array<string | number>;
  timestamps: Array<Instant>;
}

/**
 * Get authorization options from settings
 */
export const getAuthorizationOptions = async (
  useOIAnalyticsRegistration: boolean,
  registrationSettings: OIAnalyticsRegistration,
  specificSettings: SouthOIAnalyticsSettingsSpecificSettings | NorthOIAnalyticsSettingsSpecificSettings | undefined | null,
  certificateRepository: CertificateRepository
): Promise<ReqAuthOptions | undefined> => {
  if (useOIAnalyticsRegistration) {
    return {
      type: 'bearer',
      token: registrationSettings.token!
    };
  }

  switch (specificSettings!.authentication) {
    case 'basic': {
      if (!specificSettings!.accessKey) return;

      return {
        type: 'basic',
        username: specificSettings!.accessKey,
        password: specificSettings!.secretKey
      };
    }

    case 'aad-client-secret': {
      const clientSecretCredential = new ClientSecretCredential(
        specificSettings!.tenantId!,
        specificSettings!.clientId!,
        await encryptionService.decryptText(specificSettings!.clientSecret!)
      );
      const result = await clientSecretCredential.getToken(specificSettings!.scope!);
      // Note: token needs to be encrypted when adding it to proxy options
      const token = await encryptionService.encryptText(`Bearer ${Buffer.from(result.token)}`);
      return {
        type: 'bearer',
        token
      };
    }

    case 'aad-certificate': {
      const certificate = certificateRepository.findById(specificSettings!.certificateId!);
      if (certificate === null) return;

      const decryptedPrivateKey = await encryptionService.decryptText(certificate.privateKey);
      const clientCertificateCredential = new ClientCertificateCredential(specificSettings!.tenantId!, specificSettings!.clientId!, {
        certificate: `${certificate.certificate}\n${decryptedPrivateKey}`
      });
      const result = await clientCertificateCredential.getToken(specificSettings!.scope!);
      // Note: token needs to be encrypted when adding it to proxy options
      const token = await encryptionService.encryptText(`Bearer ${Buffer.from(result.token)}`);
      return {
        type: 'bearer',
        token
      };
    }
  }
};

export const getHost = (
  useOIAnalyticsRegistration: boolean,
  registrationSettings: OIAnalyticsRegistration,
  specificSettings: SouthOIAnalyticsSettingsSpecificSettings | NorthOIAnalyticsSettingsSpecificSettings | undefined | null
) => {
  let host: string;
  if (useOIAnalyticsRegistration) {
    host = registrationSettings.host;
  } else {
    host = specificSettings!.host;
  }
  return host;
};

export const getHeaders = async (
  useOIAnalyticsRegistration: boolean,
  registrationSettings: OIAnalyticsRegistration
): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {};

  if (useOIAnalyticsRegistration && registrationSettings.useApiGateway) {
    headers[registrationSettings.apiGatewayHeaderKey!] = await encryptionService.decryptText(registrationSettings.apiGatewayHeaderValue!);
  }
  return headers;
};

/**
 * Get proxy options if proxy is enabled
 * @throws Error if no proxy url is specified in settings
 */
export const getProxyOptions = (
  useOIAnalyticsRegistration: boolean,
  registrationSettings: OIAnalyticsRegistration,
  specificSettings: SouthOIAnalyticsSettingsSpecificSettings | NorthOIAnalyticsSettingsSpecificSettings | undefined | null
): { proxy: ReqProxyOptions | undefined; acceptUnauthorized: boolean } => {
  let settings: {
    useProxy: boolean;
    proxyUrl?: string | null;
    proxyUsername?: string | null;
    proxyPassword?: string | null;
    acceptUnauthorized: boolean;
  };
  let scope: string;

  // OIAnalytics module
  if (useOIAnalyticsRegistration) {
    settings = {
      useProxy: registrationSettings.useProxy,
      proxyUrl: registrationSettings.proxyUrl,
      proxyUsername: registrationSettings.proxyUsername,
      proxyPassword: registrationSettings.proxyPassword,
      acceptUnauthorized: registrationSettings.acceptUnauthorized
    };
    scope = 'registered OIAnalytics module';
  }
  // Specific settings
  else {
    settings = {
      useProxy: specificSettings!.useProxy,
      proxyUrl: specificSettings!.proxyUrl,
      proxyUsername: specificSettings!.proxyUsername,
      proxyPassword: specificSettings!.proxyPassword,
      acceptUnauthorized: specificSettings!.acceptUnauthorized
    };
    scope = 'specific settings';
  }

  if (!settings.useProxy) {
    return { proxy: undefined, acceptUnauthorized: settings.acceptUnauthorized };
  }
  if (!settings.proxyUrl) {
    throw new Error(`Proxy URL not specified using ${scope}`);
  }

  const options: ReqProxyOptions = {
    url: settings.proxyUrl
  };

  if (settings.proxyUsername) {
    options.auth = {
      type: 'url',
      username: settings.proxyUsername,
      password: settings.proxyPassword
    };
  }

  return { proxy: options, acceptUnauthorized: settings.acceptUnauthorized };
};

export const buildHttpOptions = async (
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  useOIAnalyticsRegistration: boolean,
  registrationSettings: OIAnalyticsRegistration,
  specificSettings: SouthOIAnalyticsSettingsSpecificSettings | NorthOIAnalyticsSettingsSpecificSettings | undefined | null,
  timeout: number,
  certificateRepository: CertificateRepository | null
): Promise<ReqOptions> => {
  if (useOIAnalyticsRegistration && registrationSettings.status !== 'REGISTERED') {
    throw new Error('OIBus not registered in OIAnalytics');
  }

  const headers = await getHeaders(useOIAnalyticsRegistration, registrationSettings);
  const auth = await getAuthorizationOptions(useOIAnalyticsRegistration, registrationSettings, specificSettings, certificateRepository!);
  const { proxy, acceptUnauthorized } = getProxyOptions(useOIAnalyticsRegistration, registrationSettings, specificSettings);
  return {
    method,
    headers,
    auth,
    proxy,
    timeout,
    acceptUnauthorized
  };
};

/**
 * Parse data from OIAnalytics time values API
 * check data from OIAnalytics API for result of
 * For now, only 'time-values' type is accepted
 * Expected data are : [
 *   {
 *     type: 'time-values',
 *     unit: { id: '2', label: '%' },
 *     data: {
 *       dataType: 'RAW_TIME_DATA',
 *       id: 'D4',
 *       reference: 'DCS_CONC_O2_MCT',
 *       description: 'Concentration O2 fermentation'
 *     },
 *     timestamps: ['2022-01-01T00:00:00Z', '2022-01-01T00:10:00Z'],
 *     values: [63.6414804414747,  87.2277880675425]
 *   },
 *   {
 *     type: 'time-values',
 *     unit: { id: '180', label: 'pH' },
 *     data: {
 *       dataType: 'RAW_TIME_DATA',
 *       id: 'D5',
 *       reference: 'DCS_PH_MCT',
 *       description: 'pH fermentation'
 *     },
 *     timestamps: ['2022-01-01T00:00:00Z', '2022-01-01T00:10:00Z'],
 *     values: [7.51604342731906,  7.5292481205665]
 *   }
 * ]
 * Return the formatted results flattened for easier access
 * (into csv files for example) and the latestDateRetrieved in ISO String format
 */
export const parseData = (httpResult: Array<OIATimeValues>): { formattedResult: Array<OIBusTimeValue>; maxInstant: Instant } => {
  const formattedData: Array<OIBusTimeValue> = [];
  let maxInstant = DateTime.fromMillis(0).toUTC().toISO()!;
  for (const element of httpResult) {
    element.values.forEach((currentValue: string | number, index: number) => {
      const resultInstant = DateTime.fromISO(element.timestamps[index]).toUTC().toISO()!;

      formattedData.push({
        pointId: element.data!.reference,
        timestamp: resultInstant,
        data: { value: currentValue, unit: element.unit!.label }
      });
      if (resultInstant > maxInstant) {
        maxInstant = resultInstant;
      }
    });
  }
  return { formattedResult: formattedData, maxInstant };
};

/**
 * Test connection to OIAnalytics by calling the status endpoint
 * This function is shared between North/South OIAnalytics connectors and the registration service
 */
export const testOIAnalyticsConnection = async (
  useOIAnalyticsRegistration: boolean,
  registrationSettings: OIAnalyticsRegistration,
  specificSettings: SouthOIAnalyticsSettingsSpecificSettings | NorthOIAnalyticsSettingsSpecificSettings | undefined | null,
  timeout: number,
  certificateRepository: CertificateRepository | null,
  accept401AsSuccess: boolean
): Promise<void> => {
  const httpOptions = await buildHttpOptions('GET', useOIAnalyticsRegistration, registrationSettings, specificSettings, 30000, null);

  const requestUrl = new URL(
    '/api/optimistik/oibus/status',
    useOIAnalyticsRegistration ? registrationSettings.host : specificSettings!.host
  );

  let response: ReqResponse;
  try {
    response = await HTTPRequest(requestUrl, httpOptions);
  } catch (error) {
    throw new Error(`Fetch error ${error}`);
  }

  // During initial registration, a 401 response is expected and considered successful
  // because the token hasn't been retrieved yet
  if (accept401AsSuccess && response.statusCode === 401) {
    return;
  }

  if (!response.ok) {
    throw new Error(`HTTP request failed with status code ${response.statusCode} and message: ${await response.body.text()}`);
  }
};
