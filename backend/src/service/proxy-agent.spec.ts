import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import https from 'node:https';
import { createProxyAgent, ProxyConfig } from './proxy-agent';

jest.mock('http-proxy-agent', () => {
  // Match the object returned by the class
  return { HttpProxyAgent: jest.fn().mockImplementation(host => ({ proxy: new URL(host) })) };
});

jest.mock('https-proxy-agent', () => {
  // Match the object returned by the class
  return { HttpsProxyAgent: jest.fn().mockImplementation(host => ({ proxy: new URL(host) })) };
});

jest.mock('node:https', () => {
  return { Agent: jest.fn().mockImplementation(() => ({ rejectUnauthorized: false })) };
});

describe('proxy service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create HTTP proxy agent with HTTP target and user', () => {
    const proxyConfig: ProxyConfig = {
      url: 'http://localhost:8080',
      username: 'user',
      password: 'password'
    };
    const agent = createProxyAgent(true, 'http://target-url', proxyConfig);
    expect(HttpProxyAgent).toHaveBeenCalledWith('http://user:password@localhost:8080');
    expect((agent as HttpProxyAgent<any>).proxy.origin).toEqual('http://localhost:8080');
  });

  it('should create HTTP proxy agent with HTTP target and without user', () => {
    const proxyConfig: ProxyConfig = {
      url: 'http://localhost:8080',
      username: null,
      password: null
    };
    const agent = createProxyAgent(true, 'http://target-url', proxyConfig);
    expect(HttpProxyAgent).toHaveBeenCalledWith('http://localhost:8080');
    expect((agent as HttpProxyAgent<any>).proxy.origin).toEqual('http://localhost:8080');
  });

  it('should create HTTP proxy agent with HTTPS target and user', () => {
    const proxyConfig: ProxyConfig = {
      url: 'http://localhost:8080',
      username: 'user',
      password: 'password'
    };
    const agent = createProxyAgent(true, 'https://target-url', proxyConfig);
    expect(HttpsProxyAgent).toHaveBeenCalledWith('http://user:password@localhost:8080', { rejectUnauthorized: true });
    expect((agent as HttpsProxyAgent<any>).proxy.origin).toEqual('http://localhost:8080');
  });

  it('should create HTTP proxy agent with HTTPS target and without user', () => {
    const proxyConfig: ProxyConfig = {
      url: 'http://localhost:8080',
      username: null,
      password: null
    };
    const agent = createProxyAgent(true, 'https://target-url', proxyConfig);
    expect(HttpsProxyAgent).toHaveBeenCalledWith('http://localhost:8080', { rejectUnauthorized: true });
    expect((agent as HttpsProxyAgent<any>).proxy.origin).toEqual('http://localhost:8080');
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

  it('should create HTTPS proxy agent with HTTP target and user', () => {
    const proxyConfig: ProxyConfig = {
      url: 'https://localhost:8080',
      username: 'user',
      password: 'password'
    };
    const agent = createProxyAgent(true, 'http://target-url', proxyConfig, true);
    expect(HttpProxyAgent).toHaveBeenCalledWith('https://user:password@localhost:8080');
    expect((agent as HttpProxyAgent<any>).proxy.origin).toEqual('https://localhost:8080');
  });

  it('should create HTTPS proxy agent with HTTP target and without user', () => {
    const proxyConfig: ProxyConfig = {
      url: 'https://localhost:8080',
      username: null,
      password: null
    };
    const agent = createProxyAgent(true, 'http://target-url', proxyConfig, true);
    expect(HttpProxyAgent).toHaveBeenCalledWith('https://localhost:8080');
    expect((agent as HttpProxyAgent<any>).proxy.origin).toEqual('https://localhost:8080');
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
