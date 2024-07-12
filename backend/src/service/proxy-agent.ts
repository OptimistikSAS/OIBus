import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import https from 'node:https';

export interface ProxyConfig {
  url: string;
  username: string | null;
  password: string | null;
}

export function createProxyAgent(useProxy: boolean, targetUrl: string, proxyConfig: ProxyConfig | null, acceptUnauthorized = false) {
  // HTTPS agent without proxy
  if (!useProxy && acceptUnauthorized && targetUrl.startsWith('https://')) {
    return new https.Agent({ rejectUnauthorized: false });
  }
  // No proxying
  else if (!useProxy || !proxyConfig) {
    return undefined;
  }
  // Proxying
  else if (proxyConfig!.url.startsWith('http://') || proxyConfig!.url.startsWith('https://')) {
    const isProxySecure = proxyConfig!.url.startsWith('https://');
    let proxyUrl = proxyConfig!.url;

    if (proxyConfig.username && proxyConfig.password) {
      const protocol = isProxySecure ? 'https://' : 'http://';
      const restOfUrl = proxyConfig.url.slice(protocol.length);
      proxyUrl = `${protocol}${proxyConfig.username}:${proxyConfig.password}@${restOfUrl}`;
    }

    if (targetUrl.startsWith('https://')) {
      return new HttpsProxyAgent(proxyUrl, { rejectUnauthorized: !acceptUnauthorized });
    } else {
      return new HttpProxyAgent(proxyUrl);
    }
  }
  // Wrong proxy url
  else {
    throw new Error(`Proxy URL ${proxyConfig!.url} should start with http:// or https://`);
  }
}
