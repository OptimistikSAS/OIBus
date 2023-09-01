import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import https from 'node:https';

export interface ProxyConfig {
  url: string;
  username: string | null;
  password: string | null;
}

export function createProxyAgent(useProxy: boolean, targetUrl: string, proxyConfig: ProxyConfig | null, acceptUnauthorized = false) {
  if (!useProxy && acceptUnauthorized && targetUrl.startsWith('https://')) {
    return new https.Agent({ rejectUnauthorized: false });
  } else if (!useProxy || !proxyConfig) {
    return undefined;
  } else if (proxyConfig!.url.startsWith('http://')) {
    return new HttpProxyAgent(proxyConfig!.url);
  } else if (proxyConfig!.url.startsWith('https://')) {
    return new HttpsProxyAgent(proxyConfig!.url, { rejectUnauthorized: !acceptUnauthorized });
  } else {
    throw new Error(`Proxy URL ${proxyConfig!.url} should start with http:// or https://`);
  }
}
