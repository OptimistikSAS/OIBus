import crypto from 'node:crypto';

import { Agent, ProxyAgent, request } from 'undici';

import { version } from '../../package.json';
import { BoundedCache } from './bounded-cache';
import { encryptionService } from './encryption.service';
import type { TlsTrust } from './utils-tls';

// Bounded well above any realistic number of distinct proxy configs in use at once, so eviction
// only ever kicks in for genuinely stale entries left behind by connector reconfiguration.
const MAX_CACHED_PROXY_AGENTS = 50;
const proxyAgentCache = new BoundedCache<string, ProxyAgent>(MAX_CACHED_PROXY_AGENTS, agent => void agent.destroy?.());
let noTlsVerifyAgent: Agent | null = null;
const tlsTrustAgentCache = new BoundedCache<string, Agent>(MAX_CACHED_PROXY_AGENTS, agent => void agent.destroy?.());

export function clearProxyAgentCache(): void {
  proxyAgentCache.clear();
  tlsTrustAgentCache.clear();
  if (noTlsVerifyAgent) {
    void noTlsVerifyAgent.destroy?.();
    noTlsVerifyAgent = null;
  }
}

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
  /**
   * How the certificate of the server is validated (see `toTlsTrust`): with the standard validation of Node.js when
   * omitted or empty
   */
  tls?: TlsTrust;
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
    const { token, url: authUrl } = getAuthorization(options.auth, url.toString());
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

  const tlsTrust = options.tls && Object.keys(options.tls).length > 0 ? options.tls : null;
  delete options.tls; // remove non-standard option
  if (options.proxy) {
    options.dispatcher = createProxy(options.proxy, options.acceptUnauthorized || false, tlsTrust);
    delete options.proxy; // remove non-standard option
    delete options.acceptUnauthorized;
  } else if (tlsTrust) {
    options.dispatcher = tlsTrustAgent(tlsTrust);
    delete options.acceptUnauthorized;
  } else if (options.acceptUnauthorized) {
    if (!noTlsVerifyAgent) {
      noTlsVerifyAgent = new Agent({ connect: { rejectUnauthorized: false } });
    }
    options.dispatcher = noTlsVerifyAgent;
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
  500, // Server error
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
function getAuthorization(options: ReqAuthOptions, url: string) {
  const auth: { token?: string; url: string } = { url };

  switch (options.type) {
    case 'basic': {
      const username = options.username;
      const password = encryptionService.decryptText(options.password);

      auth.token = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
      break;
    }
    case 'bearer': {
      let token = encryptionService.decryptText(options.token);

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
      urlObj.password = encryptionService.decryptText(options.password);
      auth.url = urlObj.toString();
      break;
    }
  }

  return auth;
}

/**
 * The key of the agents validating the certificate of the server with these TLS options: the trusted certificates, a
 * certificate of a server being checked by its fingerprint (see `toTlsTrust`)
 */
function tlsTrustKey(trust: TlsTrust): string {
  const certificates = crypto
    .createHash('sha256')
    .update((trust.ca ?? []).join(''))
    .digest('hex');
  return `${certificates}|${trust.allowPartialTrustChain ?? false}|${trust.checkServerIdentity ? 'pinned' : 'ca'}`;
}

function tlsTrustAgent(trust: TlsTrust): Agent {
  const cacheKey = tlsTrustKey(trust);
  const cached = tlsTrustAgentCache.get(cacheKey);
  if (cached) return cached;
  const agent = new Agent({ connect: { ...trust } });
  tlsTrustAgentCache.set(cacheKey, agent);
  return agent;
}

function createProxy(options: NonNullable<ReqOptions['proxy']>, acceptUnauthorized: boolean, tlsTrust: TlsTrust | null = null): ProxyAgent {
  const proxyOptions: ProxyAgent.Options = { uri: options.url };

  if (tlsTrust) {
    proxyOptions.requestTls = { ...tlsTrust };
  } else if (acceptUnauthorized) {
    proxyOptions.requestTls = { rejectUnauthorized: false };
  }

  if (options.auth) {
    const { token, url } = getAuthorization(options.auth, options.url);
    proxyOptions.token = token;
    proxyOptions.uri = url;
  }

  const cacheKey = `${proxyOptions.uri}|${acceptUnauthorized}|${proxyOptions.token ?? ''}|${tlsTrust ? tlsTrustKey(tlsTrust) : ''}`;
  const cached = proxyAgentCache.get(cacheKey);
  if (cached) return cached;

  const agent = new ProxyAgent(proxyOptions);
  proxyAgentCache.set(cacheKey, agent);
  return agent;
}
