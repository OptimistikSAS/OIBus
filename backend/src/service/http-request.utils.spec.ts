import { beforeEach, afterEach, describe, it, mock, type Mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { encryptionService } from './encryption.service';
import { clearProxyAgentCache, HTTPRequest, ReqOptions } from './http-request.utils';
import { createMockResponse } from '../tests/__mocks__/undici.mock';
import { version } from '../../package.json';

const nodeRequire = createRequire(import.meta.url);
const undiciModule = nodeRequire('undici');

interface UndiciRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
  dispatcher?: { isMockProxyAgent?: boolean; isMockAgent?: boolean };
}

describe('HTTPRequest Service', () => {
  const testUrl = 'http://example.com/api';
  const testProxyUrl = 'http://proxy.example.com:8080';
  const mockAbortSignal = 'mock-abort-signal' as unknown as AbortSignal;

  let proxyAgentInstances: Array<{ isMockProxyAgent: boolean; options?: unknown }>;
  let agentInstances: Array<{ isMockAgent: boolean; options?: unknown }>;
  let decryptTextMock: ReturnType<typeof mock.fn>;
  let abortSignalTimeoutMock: ReturnType<typeof mock.fn>;
  let requestMock: Mock<(url: string | URL, options?: UndiciRequestOptions) => Promise<unknown>>;

  beforeEach(() => {
    clearProxyAgentCache();
    proxyAgentInstances = [];
    agentInstances = [];

    decryptTextMock = mock.method(encryptionService, 'decryptText', async (text: unknown) => (text ? `${text}-decrypted` : ''));
    abortSignalTimeoutMock = mock.method(AbortSignal, 'timeout', (_ms: number) => mockAbortSignal);

    requestMock = mock.method(undiciModule, 'request', async () => createMockResponse(200, { success: true })) as typeof requestMock;

    const instances = proxyAgentInstances;
    mock.method(
      undiciModule,
      'ProxyAgent',
      function (this: { isMockProxyAgent: boolean; options?: unknown; destroy: () => void }, options: unknown) {
        this.isMockProxyAgent = true;
        this.options = options;
        this.destroy = () => undefined;
        instances.push(this);
      }
    );

    const agentInst = agentInstances;
    mock.method(undiciModule, 'Agent', function (this: { isMockAgent: boolean; options?: unknown }, options: unknown) {
      this.isMockAgent = true;
      this.options = options;
      agentInst.push(this);
    });
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should make a basic request without options', async () => {
    const response = await HTTPRequest(testUrl);

    assert.strictEqual(requestMock.mock.calls.length, 1);
    assert.deepStrictEqual(requestMock.mock.calls[0].arguments, [
      testUrl,
      {
        headers: {
          'User-Agent': `OIBus/${version} (https://oibus.optimistik.com/)`
        }
      }
    ]);
    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.ok, true);
    assert.strictEqual(decryptTextMock.mock.calls.length, 0);
    assert.strictEqual(proxyAgentInstances.length, 0);
    assert.strictEqual(agentInstances.length, 0);
    assert.strictEqual(abortSignalTimeoutMock.mock.calls.length, 0);
  });

  it('should make a request with custom headers', async () => {
    const options: ReqOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'value123'
      },
      body: JSON.stringify({ data: 'test' })
    };
    const response = await HTTPRequest(testUrl, options);

    assert.strictEqual(requestMock.mock.calls.length, 1);
    assert.deepStrictEqual(requestMock.mock.calls[0].arguments, [testUrl, options]);
    assert.strictEqual(response.ok, true);
  });

  it('should make a request with accept unauthorized', async () => {
    const options: ReqOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'a custom user agent',
        'X-Custom-Header': 'value123'
      },
      body: JSON.stringify({ data: 'test' }),
      acceptUnauthorized: true
    };
    const response = await HTTPRequest(testUrl, options);

    assert.strictEqual(agentInstances.length, 1);
    assert.deepStrictEqual((undiciModule.Agent as ReturnType<typeof mock.fn>).mock.calls[0].arguments, [
      {
        connect: {
          rejectUnauthorized: false
        }
      }
    ]);
    assert.strictEqual(requestMock.mock.calls.length, 1);
    const calledWith = requestMock.mock.calls[0].arguments[1];
    assert.ok(calledWith);
    assert.deepStrictEqual(calledWith.method, 'POST');
    assert.deepStrictEqual(calledWith.headers, {
      'Content-Type': 'application/json',
      'X-Custom-Header': 'value123',
      'User-Agent': 'a custom user agent'
    });
    assert.ok(calledWith.dispatcher?.isMockAgent);
    assert.strictEqual(response.ok, true);
  });

  it('should handle non 2xx status codes and set ok to false', async () => {
    requestMock.mock.mockImplementation(async () => createMockResponse(404, { error: 'Not Found' }));
    const response = await HTTPRequest(testUrl);

    assert.strictEqual(response.statusCode, 404);
    assert.strictEqual(response.ok, false);
  });

  it('should set AbortSignal for timeout', async () => {
    const options: ReqOptions = { timeout: 5000 };
    await HTTPRequest(testUrl, options);

    assert.strictEqual(abortSignalTimeoutMock.mock.calls.length, 1);
    assert.deepStrictEqual(abortSignalTimeoutMock.mock.calls[0].arguments, [5000]);
    assert.deepStrictEqual(requestMock.mock.calls[0].arguments, [
      testUrl,
      {
        headers: {
          'User-Agent': `OIBus/${version} (https://oibus.optimistik.com/)`
        },
        signal: mockAbortSignal
      }
    ]);
  });

  describe('Authorization', () => {
    it('should handle Basic Auth', async () => {
      const options: ReqOptions = {
        auth: {
          type: 'basic',
          username: 'user',
          password: 'encrypted-pass'
        },
        headers: { 'X-Other': 'value', 'user-agent': 'a user agent' }
      };
      const expectedToken = 'Basic ' + Buffer.from('user:encrypted-pass-decrypted').toString('base64');

      await HTTPRequest(testUrl, options);

      assert.strictEqual(decryptTextMock.mock.calls.length, 1);
      assert.deepStrictEqual(decryptTextMock.mock.calls[0].arguments, ['encrypted-pass']);
      assert.deepStrictEqual(requestMock.mock.calls[0].arguments, [
        testUrl,
        {
          headers: {
            'User-Agent': `OIBus/${version} (https://oibus.optimistik.com/)`,
            'X-Other': 'value',
            Authorization: expectedToken
          }
        }
      ]);
    });

    it('should handle Basic Auth with null/undefined password', async () => {
      const options: ReqOptions = {
        auth: {
          type: 'basic',
          username: 'user',
          password: null
        }
      };
      const expectedToken = 'Basic ' + Buffer.from('user:').toString('base64');

      await HTTPRequest(testUrl, options);

      assert.strictEqual(decryptTextMock.mock.calls.length, 1);
      assert.deepStrictEqual(decryptTextMock.mock.calls[0].arguments, [null]);
      assert.deepStrictEqual(requestMock.mock.calls[0].arguments, [
        testUrl,
        {
          headers: {
            'User-Agent': `OIBus/${version} (https://oibus.optimistik.com/)`,
            Authorization: expectedToken
          }
        }
      ]);
    });

    it('should handle Bearer Auth (adding Bearer prefix)', async () => {
      const options: ReqOptions = {
        auth: {
          type: 'bearer',
          token: 'encrypted-token'
        }
      };
      const expectedToken = 'Bearer encrypted-token-decrypted';

      await HTTPRequest(testUrl, options);

      assert.strictEqual(decryptTextMock.mock.calls.length, 1);
      assert.deepStrictEqual(decryptTextMock.mock.calls[0].arguments, ['encrypted-token']);
      assert.deepStrictEqual(requestMock.mock.calls[0].arguments, [
        testUrl,
        {
          headers: {
            'User-Agent': `OIBus/${version} (https://oibus.optimistik.com/)`,
            Authorization: expectedToken
          }
        }
      ]);
    });

    it('should handle Bearer Auth (with existing Bearer prefix)', async () => {
      const encryptedTokenWithPrefix = 'Bearer encrypted-token';
      const options: ReqOptions = {
        auth: {
          type: 'bearer',
          token: encryptedTokenWithPrefix
        }
      };
      const expectedToken = `${encryptedTokenWithPrefix}-decrypted`;

      await HTTPRequest(testUrl, options);

      assert.strictEqual(decryptTextMock.mock.calls.length, 1);
      assert.deepStrictEqual(decryptTextMock.mock.calls[0].arguments, [encryptedTokenWithPrefix]);
      assert.deepStrictEqual(requestMock.mock.calls[0].arguments, [
        testUrl,
        {
          headers: {
            'User-Agent': `OIBus/${version} (https://oibus.optimistik.com/)`,
            Authorization: expectedToken
          }
        }
      ]);
    });

    it('should handle URL Auth', async () => {
      const originalUrl = 'http://example.com/path';
      const options: ReqOptions = {
        auth: {
          type: 'url',
          username: 'urluser',
          password: 'encrypted-urlpass'
        }
      };
      const expectedUrl = 'http://urluser:encrypted-urlpass-decrypted@example.com/path';

      await HTTPRequest(originalUrl, options);

      assert.strictEqual(decryptTextMock.mock.calls.length, 1);
      assert.deepStrictEqual(decryptTextMock.mock.calls[0].arguments, ['encrypted-urlpass']);
      assert.deepStrictEqual(requestMock.mock.calls[0].arguments, [
        expectedUrl,
        {
          headers: {
            'User-Agent': `OIBus/${version} (https://oibus.optimistik.com/)`
          }
        }
      ]);
      const actualHeaders = requestMock.mock.calls[0].arguments[1]?.headers ?? {};
      assert.ok(!('Authorization' in actualHeaders));
    });

    it('should handle URL Auth with null/undefined password', async () => {
      const originalUrl = 'http://example.com/path';
      const options: ReqOptions = {
        auth: {
          type: 'url',
          username: 'urluser',
          password: null
        }
      };
      const expectedUrl = `http://urluser@example.com/path`;

      await HTTPRequest(originalUrl, options);

      assert.strictEqual(decryptTextMock.mock.calls.length, 1);
      assert.deepStrictEqual(decryptTextMock.mock.calls[0].arguments, [null]);
      assert.deepStrictEqual(requestMock.mock.calls[0].arguments, [
        expectedUrl,
        {
          headers: {
            'User-Agent': `OIBus/${version} (https://oibus.optimistik.com/)`
          }
        }
      ]);
      const actualHeaders = requestMock.mock.calls[0].arguments[1]?.headers ?? {};
      assert.ok(!('Authorization' in actualHeaders));
    });

    it('should prioritize options.auth over lowercase authorization header', async () => {
      const options: ReqOptions = {
        auth: {
          type: 'basic',
          username: 'user',
          password: 'encrypted-pass'
        },
        headers: {
          authorization: 'some-other-token'
        }
      };
      const expectedToken = 'Basic ' + Buffer.from('user:encrypted-pass-decrypted').toString('base64');

      await HTTPRequest(testUrl, options);

      const actualHeaders = requestMock.mock.calls[0].arguments[1]?.headers ?? {};
      assert.ok(!('authorization' in actualHeaders));
      assert.strictEqual(actualHeaders.Authorization, expectedToken);
    });

    it('should keep existing uppercase Authorization header if no options.auth provided', async () => {
      const options: ReqOptions = {
        headers: {
          Authorization: 'Bearer existing-token'
        }
      };

      await HTTPRequest(testUrl, options);

      assert.strictEqual(decryptTextMock.mock.calls.length, 0);
      assert.deepStrictEqual(requestMock.mock.calls[0].arguments, [
        testUrl,
        {
          headers: {
            'User-Agent': `OIBus/${version} (https://oibus.optimistik.com/)`,
            Authorization: 'Bearer existing-token'
          }
        }
      ]);
    });
  });

  describe('Proxy', () => {
    it('should configure ProxyAgent without auth', async () => {
      const options: ReqOptions = {
        proxy: {
          url: testProxyUrl
        }
      };

      await HTTPRequest(testUrl, options);

      assert.strictEqual((undiciModule.ProxyAgent as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual((undiciModule.ProxyAgent as ReturnType<typeof mock.fn>).mock.calls[0].arguments, [{ uri: testProxyUrl }]);
      const dispatcher = requestMock.mock.calls[0].arguments[1]?.dispatcher;
      assert.ok(dispatcher?.isMockProxyAgent);
      assert.deepStrictEqual(requestMock.mock.calls[0].arguments, [
        testUrl,
        {
          headers: {
            'User-Agent': `OIBus/${version} (https://oibus.optimistik.com/)`
          },
          dispatcher
        }
      ]);
      assert.strictEqual(decryptTextMock.mock.calls.length, 0);
    });

    it('should configure ProxyAgent without auth and accept unauthorized', async () => {
      const options: ReqOptions = {
        proxy: {
          url: testProxyUrl
        },
        acceptUnauthorized: true
      };

      await HTTPRequest(testUrl, options);

      assert.strictEqual((undiciModule.ProxyAgent as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual((undiciModule.ProxyAgent as ReturnType<typeof mock.fn>).mock.calls[0].arguments, [
        {
          uri: testProxyUrl,
          requestTls: {
            rejectUnauthorized: false
          }
        }
      ]);
      const dispatcher = requestMock.mock.calls[0].arguments[1]?.dispatcher;
      assert.ok(dispatcher?.isMockProxyAgent);
      assert.strictEqual(decryptTextMock.mock.calls.length, 0);
    });

    it('should configure ProxyAgent with Basic auth', async () => {
      const options: ReqOptions = {
        proxy: {
          url: testProxyUrl,
          auth: {
            type: 'basic',
            username: 'proxyuser',
            password: 'encrypted-proxypass'
          }
        }
      };
      const expectedToken = 'Basic ' + Buffer.from('proxyuser:encrypted-proxypass-decrypted').toString('base64');

      await HTTPRequest(testUrl, options);

      assert.strictEqual(decryptTextMock.mock.calls.length, 1);
      assert.deepStrictEqual(decryptTextMock.mock.calls[0].arguments, ['encrypted-proxypass']);
      assert.strictEqual((undiciModule.ProxyAgent as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual((undiciModule.ProxyAgent as ReturnType<typeof mock.fn>).mock.calls[0].arguments, [
        { uri: testProxyUrl, token: expectedToken }
      ]);
      const dispatcher = requestMock.mock.calls[0].arguments[1]?.dispatcher;
      assert.ok(dispatcher?.isMockProxyAgent);
    });

    it('should configure ProxyAgent with Bearer auth', async () => {
      const options: ReqOptions = {
        proxy: {
          url: testProxyUrl,
          auth: {
            type: 'bearer',
            token: 'encrypted-proxytoken'
          }
        }
      };
      const expectedToken = 'Bearer encrypted-proxytoken-decrypted';

      await HTTPRequest(testUrl, options);

      assert.strictEqual(decryptTextMock.mock.calls.length, 1);
      assert.deepStrictEqual(decryptTextMock.mock.calls[0].arguments, ['encrypted-proxytoken']);
      assert.strictEqual((undiciModule.ProxyAgent as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual((undiciModule.ProxyAgent as ReturnType<typeof mock.fn>).mock.calls[0].arguments, [
        { uri: testProxyUrl, token: expectedToken }
      ]);
      const dispatcher = requestMock.mock.calls[0].arguments[1]?.dispatcher;
      assert.ok(dispatcher?.isMockProxyAgent);
    });

    it('should configure ProxyAgent with URL auth', async () => {
      const options: ReqOptions = {
        proxy: {
          url: 'http://proxy.internal:9090',
          auth: {
            type: 'url',
            username: 'proxyurluser',
            password: 'encrypted-proxyurlpass'
          }
        }
      };

      const expectedProxyAgentUri = 'http://proxyurluser:encrypted-proxyurlpass-decrypted@proxy.internal:9090/';

      await HTTPRequest(testUrl, options);

      assert.strictEqual(decryptTextMock.mock.calls.length, 1);
      assert.deepStrictEqual(decryptTextMock.mock.calls[0].arguments, ['encrypted-proxyurlpass']);
      assert.strictEqual((undiciModule.ProxyAgent as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual((undiciModule.ProxyAgent as ReturnType<typeof mock.fn>).mock.calls[0].arguments, [
        { uri: expectedProxyAgentUri, token: undefined }
      ]);
    });

    it('should reuse ProxyAgent instance for the same proxy config', async () => {
      const options: ReqOptions = { proxy: { url: testProxyUrl } };

      await HTTPRequest(testUrl, options);
      await HTTPRequest(testUrl, options);

      assert.strictEqual((undiciModule.ProxyAgent as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.strictEqual(requestMock.mock.calls.length, 2);
    });

    it('should create separate ProxyAgent instances for different proxy configs', async () => {
      const optionsA: ReqOptions = { proxy: { url: testProxyUrl } };
      const optionsB: ReqOptions = { proxy: { url: 'http://other-proxy.example.com:3128' } };

      await HTTPRequest(testUrl, optionsA);
      await HTTPRequest(testUrl, optionsB);

      assert.strictEqual((undiciModule.ProxyAgent as ReturnType<typeof mock.fn>).mock.calls.length, 2);
    });

    it('should configure ProxyAgent with URL auth even if URL has auth', async () => {
      const options: ReqOptions = {
        proxy: {
          url: 'http://user:pass@proxy.internal:9090',
          auth: {
            type: 'url',
            username: 'proxyurluser',
            password: 'encrypted-proxyurlpass'
          }
        }
      };

      const expectedProxyAgentUri = 'http://proxyurluser:encrypted-proxyurlpass-decrypted@proxy.internal:9090/';

      await HTTPRequest(testUrl, options);

      assert.strictEqual(decryptTextMock.mock.calls.length, 1);
      assert.deepStrictEqual(decryptTextMock.mock.calls[0].arguments, ['encrypted-proxyurlpass']);
      assert.strictEqual((undiciModule.ProxyAgent as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual((undiciModule.ProxyAgent as ReturnType<typeof mock.fn>).mock.calls[0].arguments, [
        { uri: expectedProxyAgentUri, token: undefined }
      ]);
    });
  });
});
