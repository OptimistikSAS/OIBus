import { request, ProxyAgent } from 'undici';
import { encryptionService } from './encryption.service';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Dispatcher } from 'undici'; // used in jsdoc

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
  if (options.auth) {
    const { token, url: authUrl } = await getAuthorization(options.auth, url.toString());
    options.headers = { ...options.headers, Authorization: token };
    url = authUrl;
  }

  if (options.proxy) {
    options.dispatcher = await createProxy(options.proxy);
  }

  if (options.timeout) {
    options.signal = AbortSignal.timeout(options.timeout);
  }

  const response = (await request(url, options)) as ReqResponse;
  // As per https://github.com/nodejs/undici/blob/main/lib/web/fetch/response.js#L199
  response.ok = response.statusCode >= 200 && response.statusCode <= 299;

  return response;
}

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
      const password = await encryptionService.decryptText(options.password ?? '');

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
      const username = options.username;
      const password = await encryptionService.decryptText(options.password ?? '');

      const urlObj = new URL(url);
      urlObj.username = username;
      urlObj.password = password;
      auth.url = urlObj.toString();
      break;
    }
  }

  return auth;
}

async function createProxy(options: NonNullable<ReqOptions['proxy']>) {
  const proxyOptions: ProxyAgent.Options = {
    uri: options.url
  };

  if (!options.auth) {
    return new ProxyAgent(proxyOptions);
  }

  const { token, url } = await getAuthorization(options.auth, options.url);
  proxyOptions.token = token;
  proxyOptions.uri = url;

  return new ProxyAgent(proxyOptions);
}
