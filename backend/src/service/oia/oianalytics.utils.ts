import { HTTPRequest, ReqAuthOptions, ReqOptions, ReqProxyOptions, ReqResponse } from '../http-request.utils';

export interface OIAnalyticsTestConnectionSettings {
  host: string;
  timeout: number;
  acceptUnauthorized: boolean;
  useProxy: boolean;
  proxyUrl?: string | null;
  proxyUsername?: string | null;
  proxyPassword?: string | null;
  auth?: ReqAuthOptions;
  /**
   * If true, accept 401 Unauthorized as a successful response
   * This is useful during initial registration when the token hasn't been retrieved yet
   */
  accept401AsSuccess?: boolean;
}

/**
 * Test connection to OIAnalytics by calling the status endpoint
 * This function is shared between North/South OIAnalytics connectors and the registration service
 * @param settings - Connection settings including host, proxy, auth, and timeout
 * @throws Error if the connection fails
 */
export async function testOIAnalyticsConnection(settings: OIAnalyticsTestConnectionSettings): Promise<void> {
  const requestUrl = new URL('/api/optimistik/oibus/status', settings.host);

  let response: ReqResponse;
  try {
    const proxy = getProxyOptions(settings);
    const fetchOptions: ReqOptions = {
      method: 'GET',
      auth: settings.auth,
      proxy,
      timeout: settings.timeout * 1000,
      acceptUnauthorized: settings.acceptUnauthorized
    };
    response = await HTTPRequest(requestUrl, fetchOptions);
  } catch (error) {
    throw new Error(`Fetch error ${error}`);
  }

  // During initial registration, a 401 response is expected and considered successful
  // because the token hasn't been retrieved yet
  if (settings.accept401AsSuccess && response.statusCode === 401) {
    return;
  }

  if (!response.ok) {
    throw new Error(`HTTP request failed with status code ${response.statusCode} and message: ${await response.body.text()}`);
  }
}

/**
 * Get proxy options from settings
 * @param settings - Connection settings
 * @returns Proxy options or undefined if proxy is not enabled
 */
function getProxyOptions(settings: OIAnalyticsTestConnectionSettings): ReqProxyOptions | undefined {
  if (!settings.useProxy) {
    return undefined;
  }
  if (!settings.proxyUrl) {
    throw new Error('Proxy URL not specified');
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

  return options;
}
