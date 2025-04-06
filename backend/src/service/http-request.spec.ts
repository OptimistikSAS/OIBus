import { request, ProxyAgent } from 'undici';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import { encryptionService } from './encryption.service';
import { HTTPRequest, ReqOptions, ReqResponse } from './http-request.utils';

jest.mock('undici', () => ({
  request: jest.fn(),
  ProxyAgent: jest.fn().mockImplementation(options => ({
    // Mock the constructor
    options, // Store options for potential assertion
    isMockProxyAgent: true // Add a flag for easy identification in tests
  }))
}));

jest.mock('./encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

/**
 * Helper to create a mock Undici response
 */
function createMockResponse(statusCode: number, body?: Record<string, unknown>, headers: Record<string, string> = {}): ReqResponse {
  return {
    statusCode,
    headers,
    body: {
      json: jest.fn().mockResolvedValue(body),
      text: jest.fn().mockResolvedValue(JSON.stringify(body))
    }
  } as unknown as ReqResponse;
}

describe('HTTPRequest Service', () => {
  let mockUndiciRequest: jest.Mock;
  let mockUndiciProxyAgent: jest.Mock;
  let mockDecryptText: jest.Mock;
  let mockAbortSignalTimeout: jest.SpyInstance;
  const mockAbortSignal = 'mock-abort-signal' as unknown as AbortSignal;

  const testUrl = 'http://example.com/api';
  const testProxyUrl = 'http://proxy.example.com:8080';

  beforeEach(() => {
    jest.clearAllMocks();

    mockUndiciRequest = request as jest.Mock;
    mockUndiciProxyAgent = ProxyAgent as unknown as jest.Mock;
    mockDecryptText = encryptionService.decryptText as jest.Mock;

    mockUndiciRequest.mockResolvedValue(createMockResponse(200, { success: true }));
    mockDecryptText.mockImplementation(async text => (text ? `${text}-decrypted` : ''));
    mockAbortSignalTimeout = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(mockAbortSignal);
  });

  it('should make a basic request without options', async () => {
    const response = await HTTPRequest(testUrl);

    expect(mockUndiciRequest).toHaveBeenCalledTimes(1);
    // Expect the default empty options object '{}' when no options are passed
    expect(mockUndiciRequest).toHaveBeenCalledWith(testUrl, {});
    expect(response.statusCode).toBe(200);
    expect(response.ok).toBe(true);
    expect(mockDecryptText).not.toHaveBeenCalled();
    expect(mockUndiciProxyAgent).not.toHaveBeenCalled();
    expect(mockAbortSignalTimeout).not.toHaveBeenCalled();
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

    expect(mockUndiciRequest).toHaveBeenCalledTimes(1);
    expect(mockUndiciRequest).toHaveBeenCalledWith(testUrl, options);
    expect(response.ok).toBe(true);
  });

  it('should handle non 2xx status codes and set ok to alse', async () => {
    mockUndiciRequest.mockResolvedValueOnce(createMockResponse(404, { error: 'Not Found' }));
    const response = await HTTPRequest(testUrl);

    expect(response.statusCode).toBe(404);
    expect(response.ok).toBe(false);
  });

  it('should set AbortSignal for timeout', async () => {
    const options: ReqOptions = { timeout: 5000 };
    await HTTPRequest(testUrl, options);

    expect(mockAbortSignalTimeout).toHaveBeenCalledTimes(1);
    expect(mockAbortSignalTimeout).toHaveBeenCalledWith(5000);
    expect(mockUndiciRequest).toHaveBeenCalledWith(testUrl, {
      signal: mockAbortSignal
    });
  });

  describe('Authorization', () => {
    it('should handle Basic Auth', async () => {
      const options: ReqOptions = {
        auth: {
          type: 'basic',
          username: 'user',
          password: 'encrypted-pass'
        },
        headers: { 'X-Other': 'value' } // Ensure other headers are kept
      };
      const expectedToken = 'Basic ' + Buffer.from('user:encrypted-pass-decrypted').toString('base64');

      await HTTPRequest(testUrl, options);

      expect(mockDecryptText).toHaveBeenCalledTimes(1);
      expect(mockDecryptText).toHaveBeenCalledWith('encrypted-pass');
      expect(mockUndiciRequest).toHaveBeenCalledWith(testUrl, {
        headers: {
          'X-Other': 'value', // Existing header
          Authorization: expectedToken // Added header
        }
      });
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

      expect(mockDecryptText).toHaveBeenCalledTimes(1);
      expect(mockDecryptText).toHaveBeenCalledWith(null);
      expect(mockUndiciRequest).toHaveBeenCalledWith(testUrl, {
        headers: {
          Authorization: expectedToken
        }
      });
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

      expect(mockDecryptText).toHaveBeenCalledTimes(1);
      expect(mockDecryptText).toHaveBeenCalledWith('encrypted-token');
      expect(mockUndiciRequest).toHaveBeenCalledWith(testUrl, {
        headers: {
          Authorization: expectedToken
        }
      });
    });

    it('should handle Bearer Auth (with existing Bearer prefix)', async () => {
      const encryptedTokenWithPrefix = 'Bearer encrypted-token';
      const options: ReqOptions = {
        auth: {
          type: 'bearer',
          token: encryptedTokenWithPrefix
        }
      };
      // Decrypt mock already returns "Bearer ..."
      const expectedToken = `${encryptedTokenWithPrefix}-decrypted`;

      await HTTPRequest(testUrl, options);

      expect(mockDecryptText).toHaveBeenCalledTimes(1);
      expect(mockDecryptText).toHaveBeenCalledWith(encryptedTokenWithPrefix);
      expect(mockUndiciRequest).toHaveBeenCalledWith(testUrl, {
        headers: {
          Authorization: expectedToken
        }
      });
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

      expect(mockDecryptText).toHaveBeenCalledTimes(1);
      expect(mockDecryptText).toHaveBeenCalledWith('encrypted-urlpass');
      // URL is modified, check it matches the standard URL serialization
      expect(mockUndiciRequest).toHaveBeenCalledWith(expectedUrl, {});
      // Explicitly check that Authorization header is not be present
      const actualOptionsPassed = mockUndiciRequest.mock.calls[0][1];
      expect(actualOptionsPassed).not.toHaveProperty('Authorization');
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

      expect(mockDecryptText).toHaveBeenCalledTimes(1);
      expect(mockDecryptText).toHaveBeenCalledWith(null);
      // URL is modified, check it matches the standard URL serialization
      expect(mockUndiciRequest).toHaveBeenCalledWith(expectedUrl, {});
      // Explicitly check that Authorization header is not be present
      const actualOptionsPassed = mockUndiciRequest.mock.calls[0][1];
      expect(actualOptionsPassed).not.toHaveProperty('Authorization');
    });

    it('should prioritize options.auth over lowercase authorization header', async () => {
      const options: ReqOptions = {
        auth: {
          type: 'basic',
          username: 'user',
          password: 'encrypted-pass'
        },
        headers: {
          authorization: 'some-other-token' // Lowercase header
        }
      };
      const expectedToken = 'Basic ' + Buffer.from('user:encrypted-pass-decrypted').toString('base64');

      await HTTPRequest(testUrl, options);

      expect(mockUndiciRequest).toHaveBeenCalledWith(testUrl, {
        headers: {
          // lowercase 'authorization' should be ignored, and uppercase 'Authorization' set by auth logic
          Authorization: expectedToken
        }
      });
      // Explicitly check that the lowercase header is not present
      const actualHeaders = mockUndiciRequest.mock.calls[0][1].headers;
      expect(actualHeaders).not.toHaveProperty('authorization');
      expect(actualHeaders).toHaveProperty('Authorization', expectedToken);
    });

    it('should keep existing uppercase Authorization header if no options.auth provided', async () => {
      const options: ReqOptions = {
        headers: {
          Authorization: 'Bearer existing-token'
        }
      };

      await HTTPRequest(testUrl, options);

      expect(mockDecryptText).not.toHaveBeenCalled();
      expect(mockUndiciRequest).toHaveBeenCalledWith(testUrl, {
        headers: {
          Authorization: 'Bearer existing-token'
        }
      });
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

      expect(mockUndiciProxyAgent).toHaveBeenCalledTimes(1);
      expect(mockUndiciProxyAgent).toHaveBeenCalledWith({ uri: testProxyUrl });
      expect(mockUndiciRequest).toHaveBeenCalledWith(testUrl, {
        dispatcher: expect.objectContaining({ isMockProxyAgent: true }) // Check if our mock instance was passed
      });
      expect(mockDecryptText).not.toHaveBeenCalled(); // No auth decryption needed
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

      expect(mockDecryptText).toHaveBeenCalledTimes(1);
      expect(mockDecryptText).toHaveBeenCalledWith('encrypted-proxypass');
      expect(mockUndiciProxyAgent).toHaveBeenCalledTimes(1);
      expect(mockUndiciProxyAgent).toHaveBeenCalledWith({
        uri: testProxyUrl, // URI remains the same for basic proxy auth
        token: expectedToken
      });
      expect(mockUndiciRequest).toHaveBeenCalledWith(testUrl, {
        dispatcher: expect.objectContaining({ isMockProxyAgent: true })
      });
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

      expect(mockDecryptText).toHaveBeenCalledTimes(1);
      expect(mockDecryptText).toHaveBeenCalledWith('encrypted-proxytoken');
      expect(mockUndiciProxyAgent).toHaveBeenCalledTimes(1);
      expect(mockUndiciProxyAgent).toHaveBeenCalledWith({
        uri: testProxyUrl, // URI remains the same for basic proxy auth
        token: expectedToken
      });
      expect(mockUndiciRequest).toHaveBeenCalledWith(testUrl, {
        dispatcher: expect.objectContaining({ isMockProxyAgent: true })
      });
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

      // URL.toString() adds a trailing slash if the path is implied root
      const expectedProxyAgentUri = 'http://proxyurluser:encrypted-proxyurlpass-decrypted@proxy.internal:9090/';

      await HTTPRequest(testUrl, options);

      expect(mockDecryptText).toHaveBeenCalledTimes(1);
      expect(mockDecryptText).toHaveBeenCalledWith('encrypted-proxyurlpass');
      expect(mockUndiciProxyAgent).toHaveBeenCalledTimes(1);
      // For URL auth on proxy, the URI itself is modified, and token is NOT set in options
      expect(mockUndiciProxyAgent).toHaveBeenCalledWith({
        uri: expectedProxyAgentUri, // Check the corrected URI with trailing slash
        token: undefined // No separate token for URL auth
      });
      expect(mockUndiciRequest).toHaveBeenCalledWith(testUrl, {
        dispatcher: expect.objectContaining({ isMockProxyAgent: true })
      });
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

      // URL.toString() adds a trailing slash if the path is implied root
      const expectedProxyAgentUri = 'http://proxyurluser:encrypted-proxyurlpass-decrypted@proxy.internal:9090/';

      await HTTPRequest(testUrl, options);

      expect(mockDecryptText).toHaveBeenCalledTimes(1);
      expect(mockDecryptText).toHaveBeenCalledWith('encrypted-proxyurlpass');
      expect(mockUndiciProxyAgent).toHaveBeenCalledTimes(1);
      // For URL auth on proxy, the URI itself is modified, and token is NOT set in options
      expect(mockUndiciProxyAgent).toHaveBeenCalledWith({
        uri: expectedProxyAgentUri, // Check the corrected URI with trailing slash
        token: undefined // No separate token for URL auth
      });
      expect(mockUndiciRequest).toHaveBeenCalledWith(testUrl, {
        dispatcher: expect.objectContaining({ isMockProxyAgent: true })
      });
    });
  });
});
