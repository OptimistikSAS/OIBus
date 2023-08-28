import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

export interface ProxyConfig {
  url: string;
  username: string | null;
  password: string | null;
}

export function createProxyAgent(proxyConfig: ProxyConfig, acceptUnauthorized = false) {
  let proxyAgent: HttpProxyAgent<string> | HttpsProxyAgent<string>;
  if (proxyConfig.url.startsWith('http://')) {
    proxyAgent = new HttpProxyAgent(proxyConfig.url);
  } else if (proxyConfig.url.startsWith('https://')) {
    proxyAgent = new HttpsProxyAgent(proxyConfig.url, { rejectUnauthorized: !acceptUnauthorized });
  } else {
    throw new Error(`Proxy URL ${proxyConfig.url} should start with http:// or https://`);
  }
  return proxyAgent;
}
