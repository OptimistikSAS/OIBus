import { createProxyAgent, ProxyConfig } from './proxy.service';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

jest.mock('http-proxy-agent', () => {
  return { HttpProxyAgent: jest.fn().mockImplementation(() => ({ host: 'http://localhost:8080' })) };
});

jest.mock('https-proxy-agent', () => {
  return { HttpsProxyAgent: jest.fn().mockImplementation(() => ({ host: 'https://localhost:8080' })) };
});

describe('proxy service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create proxy agent with HTTP', async () => {
    const proxyConfig: ProxyConfig = {
      url: 'http://localhost:8080',
      username: 'my user',
      password: 'my password'
    };
    const agent = await createProxyAgent(proxyConfig);
    expect(HttpProxyAgent).toHaveBeenCalledWith('http://localhost:8080');
    expect(agent).toEqual({ host: 'http://localhost:8080' });
  });

  it('should create proxy agent with HTTPS', async () => {
    const proxyConfig: ProxyConfig = {
      url: 'https://localhost:8080',
      username: null,
      password: null
    };
    const agent = await createProxyAgent(proxyConfig, true);
    expect(HttpsProxyAgent).toHaveBeenCalledWith('https://localhost:8080', {
      rejectUnauthorized: false
    });
    expect(agent).toEqual({ host: 'https://localhost:8080' });
  });

  it('should throw error if bad url', async () => {
    const proxyConfig: ProxyConfig = {
      url: 'ws://localhost:8080',
      username: null,
      password: null
    };
    let error;
    try {
      await createProxyAgent(proxyConfig);
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error(`Proxy URL ${proxyConfig.url} should start with http:// or https://`));
  });
});
