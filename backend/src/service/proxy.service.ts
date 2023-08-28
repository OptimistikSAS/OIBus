import url from 'node:url';
import { ProxyAgent } from 'proxy-agent';
import { AgentOptions } from 'agent-base';

export interface ProxyConfig {
  url: string;
  username: string | null;
  password: string | null;
}

export function createProxyAgent(proxyConfig: ProxyConfig, acceptUnauthorized = false) {
  const proxyOptions = url.parse(proxyConfig.url);

  // @ts-ignore
  proxyOptions.rejectUnauthorized = !acceptUnauthorized;

  if (proxyConfig.username && proxyConfig.password) {
    proxyOptions.auth = `${proxyConfig.username}:${proxyConfig.password}`;
  }

  return new ProxyAgent(proxyOptions as AgentOptions);
}
