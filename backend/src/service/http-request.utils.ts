import { request, ProxyAgent, Agent } from 'undici';
import { encryptionService } from './encryption.service';
import { version } from '../../package.json';

export type ReqURL = Parameters<typeof request>['0'];
/**
 * Extended request type.
 * For original type check {@link request}'s options parameter
 */
export type ReqOptions = Parameters<typeof request>['1'] & {
  /** Timeout in ms */
  timeout?: number;
  /**
   * Request authorization options.
   * Token based options will be provided with the 'Authorization' header.
   * Note: These options override the 'Authorization' header if provided.
   */
  auth?: ReqAuthOptions;
  proxy?: ReqProxyOptions;
  acceptUnauthorized?: boolean;
};

export interface ReqProxyOptions {
  url: string;
  /**
   * Proxy authorization options.
   * Token based options will be provided with the 'Proxy-Authorization' header.
   */
  auth?: ReqAuthOptions;
}

export type ReqAuthOptions =
  | {
      /** Basic [base64 encoded username:password] */
      type: 'basic';
      username: string;
      /** Encrypted password */
      password?: string | null;
    }
  | {
      /** Bearer [token] */
      type: 'bearer';
      /** Encrypted token */
      token: string;
    }
  | {
      /** [username:password]@url */
      type: 'url';
      username: string;
      /** Encrypted password */
      password?: string | null;
    };

/**
 * Extended request response type.
 * For original type check {@link Dispatcher.ResponseData}
 */
export type ReqResponse = Awaited<ReturnType<typeof request>> & {
  ok: boolean;
};

export async function HTTPRequest(url: ReqURL, options: ReqOptions = {}): Promise<ReqResponse> {
  if (!options.headers) {
    options.headers = {};
  }

  if (!('User-Agent' in options.headers)) {
    options.headers = { ...options.headers, 'User-Agent': `OIBus/${version} (https://oibus.optimistik.com/)` };
  }
  // Remove potential user provided non-capitalized user-agent header to not have the header twice
  if ('user-agent' in options.headers!) {
    delete options.headers['user-agent'];
  }

  if (options.auth) {
    const { token, url: authUrl } = await getAuthorization(options.auth, url.toString());
    url = authUrl;

    if (token) {
      // Remove potential user provided non-capitalized authorization header to not have the header twice
      if ('authorization' in options.headers!) {
        delete options.headers.authorization;
      }

      options.headers = { ...options.headers, Authorization: token };
    }

    delete options.auth; // remove non-standard option
  }

  if (options.proxy) {
    options.dispatcher = await createProxy(options.proxy, options.acceptUnauthorized || false);
    delete options.proxy; // remove non-standard option
    delete options.acceptUnauthorized;
  } else if (options.acceptUnauthorized) {
    options.dispatcher = new Agent({
      connect: {
        rejectUnauthorized: false
      }
    });
    delete options.acceptUnauthorized;
  }

  if (options.timeout) {
    options.signal = AbortSignal.timeout(options.timeout);
    delete options.timeout; // remove non-standard option
  }

  const response = (await request(url, options)) as ReqResponse;
  // As per https://github.com/nodejs/undici/blob/main/lib/web/fetch/response.js#L199
  response.ok = response.statusCode >= 200 && response.statusCode <= 299;

  return response;
}

/**
 * HTTP Status codes which can be retried
 */
export const retryableHttpStatusCodes = [
  // Only retry the request if the status code is one of the following
  // Source: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
  401, // Unauthorized
  403, // Forbidden
  404, // Not Found
  407, // Proxy Authentication Required
  408, // Request Timeout
  429, // Too Many Requests
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
  511 //  Network Authentication Required
];

/**
 * Helper function to get correct authorization data.
 *
 * URL is always returned, and is left unchanged when the auth type is not 'url'
 */
async function getAuthorization(options: ReqAuthOptions, url: string) {
  const auth: { token?: string; url: string } = { url };

  switch (options.type) {
    case 'basic': {
      const username = options.username;
      const password = await encryptionService.decryptText(options.password);

      auth.token = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
      break;
    }
    case 'bearer': {
      let token = await encryptionService.decryptText(options.token);

      // Make sure to include "Bearer " in front of the token, if the token provided does not have it
      if (!token.startsWith('Bearer ')) {
        token = `Bearer ${token}`;
      }

      auth.token = token;
      break;
    }

    case 'url': {
      const urlObj = new URL(url);
      urlObj.username = options.username;
      urlObj.password = await encryptionService.decryptText(options.password);
      auth.url = urlObj.toString();
      break;
    }
  }

  return auth;
}

async function createProxy(options: NonNullable<ReqOptions['proxy']>, acceptUnauthorized: boolean) {
  const proxyOptions: ProxyAgent.Options = {
    uri: options.url
  };

  if (acceptUnauthorized) {
    proxyOptions.requestTls = {
      rejectUnauthorized: false
    };
  }

  if (!options.auth) {
    return new ProxyAgent(proxyOptions);
  }

  const { token, url } = await getAuthorization(options.auth, options.url);
  proxyOptions.token = token;
  proxyOptions.uri = url;

  return new ProxyAgent(proxyOptions);
}
