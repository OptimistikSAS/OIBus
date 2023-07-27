import { createProxyAgent, ProxyConfig } from './proxy.service';

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
    expect(agent).toEqual({
      proxy: {
        protocol: 'http:',
        slashes: true,
        auth: 'my user:my password',
        host: 'localhost:8080',
        port: '8080',
        hostname: 'localhost',
        hash: null,
        search: null,
        query: null,
        rejectUnauthorized: true,
        pathname: '/',
        path: '/',
        href: 'http://localhost:8080/'
      },
      proxyUri: 'http://my%20user:my%20password@localhost:8080',
      proxyFn: expect.any(Function)
    });
  });

  it('should create proxy agent without user', async () => {
    const proxyConfig: ProxyConfig = {
      url: 'http://localhost:8080',
      username: null,
      password: null
    };
    const agent = await createProxyAgent(proxyConfig, true);
    expect(agent).toEqual({
      proxy: {
        protocol: 'http:',
        slashes: true,
        auth: null,
        host: 'localhost:8080',
        port: '8080',
        hostname: 'localhost',
        hash: null,
        search: null,
        query: null,
        rejectUnauthorized: false,
        pathname: '/',
        path: '/',
        href: 'http://localhost:8080/'
      },
      proxyUri: 'http://localhost:8080',
      proxyFn: expect.any(Function)
    });
  });
});
