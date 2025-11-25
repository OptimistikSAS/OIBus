import { testOIAnalyticsConnection } from './oianalytics.utils';
import * as HTTPRequestUtils from '../../service/http-request.utils';

describe('OIAnalytics Test Connection Utils', () => {
  let httpRequestSpy: jest.SpyInstance;

  beforeEach(() => {
    httpRequestSpy = jest.spyOn(HTTPRequestUtils, 'HTTPRequest');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should test connection successfully without proxy', async () => {
    httpRequestSpy.mockResolvedValue({ ok: true, statusCode: 200 });

    await testOIAnalyticsConnection({
      host: 'http://localhost',
      timeout: 10,
      acceptUnauthorized: false,
      useProxy: false
    });

    expect(httpRequestSpy).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'http://localhost/api/optimistik/oibus/status' }),
      expect.objectContaining({
        method: 'GET',
        timeout: 10000,
        acceptUnauthorized: false
      })
    );
  });

  it('should test connection successfully with proxy', async () => {
    httpRequestSpy.mockResolvedValue({ ok: true, statusCode: 200 });

    await testOIAnalyticsConnection({
      host: 'http://localhost',
      timeout: 10,
      acceptUnauthorized: false,
      useProxy: true,
      proxyUrl: 'http://proxy:8080',
      proxyUsername: 'user',
      proxyPassword: 'password'
    });

    expect(httpRequestSpy).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'http://localhost/api/optimistik/oibus/status' }),
      expect.objectContaining({
        proxy: {
          url: 'http://proxy:8080',
          auth: {
            type: 'url',
            username: 'user',
            password: 'password'
          }
        }
      })
    );
  });

  it('should test connection successfully with proxy but without username', async () => {
    httpRequestSpy.mockResolvedValue({ ok: true, statusCode: 200 });

    await testOIAnalyticsConnection({
      host: 'http://localhost',
      timeout: 10,
      acceptUnauthorized: false,
      useProxy: true,
      proxyUrl: 'http://proxy:8080'
    });

    expect(httpRequestSpy).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'http://localhost/api/optimistik/oibus/status' }),
      expect.objectContaining({
        proxy: {
          url: 'http://proxy:8080'
        }
      })
    );
  });

  it('should throw error if proxy URL is missing when useProxy is true', async () => {
    await expect(
      testOIAnalyticsConnection({
        host: 'http://localhost',
        timeout: 10,
        acceptUnauthorized: false,
        useProxy: true,
        proxyUrl: null
      })
    ).rejects.toThrow('Proxy URL not specified');
  });

  it('should throw error if HTTP request fails', async () => {
    httpRequestSpy.mockRejectedValue(new Error('Network error'));

    await expect(
      testOIAnalyticsConnection({
        host: 'http://localhost',
        timeout: 10,
        acceptUnauthorized: false,
        useProxy: false
      })
    ).rejects.toThrow('Fetch error Error: Network error');
  });

  it('should treat 401 as success if accept401AsSuccess is true', async () => {
    httpRequestSpy.mockResolvedValue({
      ok: false,
      statusCode: 401,
      body: { text: () => Promise.resolve('Unauthorized') }
    });

    await expect(
      testOIAnalyticsConnection({
        host: 'http://localhost',
        timeout: 10,
        acceptUnauthorized: false,
        useProxy: false,
        accept401AsSuccess: true
      })
    ).resolves.not.toThrow();
  });

  it('should throw error on 401 if accept401AsSuccess is false', async () => {
    httpRequestSpy.mockResolvedValue({
      ok: false,
      statusCode: 401,
      body: { text: () => Promise.resolve('Unauthorized') }
    });

    await expect(
      testOIAnalyticsConnection({
        host: 'http://localhost',
        timeout: 10,
        acceptUnauthorized: false,
        useProxy: false,
        accept401AsSuccess: false
      })
    ).rejects.toThrow('HTTP request failed with status code 401 and message: Unauthorized');
  });

  it('should throw error if response is not OK', async () => {
    httpRequestSpy.mockResolvedValue({
      ok: false,
      statusCode: 500,
      body: { text: () => Promise.resolve('Internal Server Error') }
    });

    await expect(
      testOIAnalyticsConnection({
        host: 'http://localhost',
        timeout: 10,
        acceptUnauthorized: false,
        useProxy: false
      })
    ).rejects.toThrow('HTTP request failed with status code 500 and message: Internal Server Error');
  });
});
