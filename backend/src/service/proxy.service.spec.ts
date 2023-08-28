import { createProxyAgent, ProxyConfig } from './proxy.service';
import { ProxyAgent } from 'proxy-agent';
import url from 'node:url';

jest.mock('proxy-agent', () => {
  return { ProxyAgent: jest.fn().mockImplementation(() => ({ host: 'localhost:8080' })) };
});

describe('proxy service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create proxy agent with a user', async () => {
    const proxyConfig: ProxyConfig = {
      url: 'http://localhost:8080',
      username: 'my user',
      password: 'my password'
    };
    const agent = await createProxyAgent(proxyConfig);
    expect(ProxyAgent).toHaveBeenCalledWith({
      ...url.parse('http://localhost:8080'),
      auth: `my user:my password`,
      rejectUnauthorized: true
    });
    expect(agent).toEqual({ host: 'localhost:8080' });
  });

  it('should create proxy agent without user', async () => {
    const proxyConfig: ProxyConfig = {
      url: 'http://localhost:8080',
      username: null,
      password: null
    };
    const agent = await createProxyAgent(proxyConfig, true);
    expect(ProxyAgent).toHaveBeenCalledWith({
      ...url.parse('http://localhost:8080'),
      rejectUnauthorized: false
    });
    expect(agent).toEqual({ host: 'localhost:8080' });
  });
});
