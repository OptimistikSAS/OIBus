import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import https from 'node:https';
import { createProxyAgent, ProxyConfig } from './proxy-agent';

jest.mock('http-proxy-agent', () => {
  return { HttpProxyAgent: jest.fn().mockImplementation(() => ({ host: 'http://localhost:8080' })) };
});

jest.mock('https-proxy-agent', () => {
  return { HttpsProxyAgent: jest.fn().mockImplementation(() => ({ host: 'https://localhost:8080' })) };
});

jest.mock('node:https', () => {
  return { Agent: jest.fn().mockImplementation(() => ({ rejectUnauthorized: false })) };
});

describe('proxy service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create proxy agent with HTTP and user', () => {
    const proxyConfig: ProxyConfig = {
      url: 'http://localhost:8080',
      username: 'user',
      password: 'password'
    };
    const agent = createProxyAgent(true, 'http://target-url', proxyConfig);
    expect(HttpProxyAgent).toHaveBeenCalledWith('http://user:password@localhost:8080');
    expect(agent).toEqual({ host: 'http://localhost:8080' });
  });

  it('should create proxy agent with HTTP and without user', () => {
    const proxyConfig: ProxyConfig = {
      url: 'http://localhost:8080',
      username: null,
      password: null
    };
    const agent = createProxyAgent(true, 'http://target-url', proxyConfig);
    expect(HttpProxyAgent).toHaveBeenCalledWith('http://localhost:8080');
    expect(agent).toEqual({ host: 'http://localhost:8080' });
  });

  it('should return undefined if no proxy to use', () => {
    const agent = createProxyAgent(false, 'http://target-url', null, true);
    expect(agent).toBeUndefined();
  });

  it('should return https Agent if no proxyConfig but accept unauthorized', () => {
    const agent = createProxyAgent(false, 'https://target-url', null, true);
    expect(https.Agent).toHaveBeenCalledWith({ rejectUnauthorized: false });
    expect(agent).toEqual({ rejectUnauthorized: false });
  });

  it('should create proxy agent with HTTPS and with user', () => {
    const proxyConfig: ProxyConfig = {
      url: 'https://localhost:8080',
      username: 'user',
      password: 'password'
    };
    const agent = createProxyAgent(true, 'http://target-url', proxyConfig, true);
    expect(HttpsProxyAgent).toHaveBeenCalledWith('https://user:password@localhost:8080', {
      rejectUnauthorized: false
    });
    expect(agent).toEqual({ host: 'https://localhost:8080' });
  });

  it('should create proxy agent with HTTPS and without user', () => {
    const proxyConfig: ProxyConfig = {
      url: 'https://localhost:8080',
      username: null,
      password: null
    };
    const agent = createProxyAgent(true, 'http://target-url', proxyConfig, true);
    expect(HttpsProxyAgent).toHaveBeenCalledWith('https://localhost:8080', {
      rejectUnauthorized: false
    });
    expect(agent).toEqual({ host: 'https://localhost:8080' });
  });

  it('should throw error if bad url', () => {
    const proxyConfig: ProxyConfig = {
      url: 'ws://localhost:8080',
      username: null,
      password: null
    };
    let error;
    try {
      createProxyAgent(true, 'http://target-url', proxyConfig, true);
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error(`Proxy URL ${proxyConfig.url} should start with http:// or https://`));
  });
});
