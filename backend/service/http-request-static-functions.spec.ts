import fsSync from 'node:fs';
import fetch from 'node-fetch';
import * as httpRequestStaticFunctions from './http-request-static-functions';
import { FetchError } from './http-request-static-functions';

import { Authentication } from '../../shared/model/engine.model';
import EncryptionService from './encryption.service';
import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';

jest.mock('node:fs');

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');

// Mock node-fetch
jest.mock('node-fetch');
const { Response } = jest.requireActual('node-fetch');

describe('HTTP request static functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should add basic authorization header', async () => {
    const headers = {};
    const basicAuth: Authentication = { type: 'basic', username: 'username', password: 'password' };
    await httpRequestStaticFunctions.addAuthenticationToHeaders(headers, basicAuth, encryptionService);

    expect(headers).toEqual({ Authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=' });
  });

  it('should add api key header', async () => {
    const headers = {};
    const apiKeyAuth: Authentication = { type: 'api-key', key: 'myKey', secret: 'mySecret' };
    await httpRequestStaticFunctions.addAuthenticationToHeaders(headers, apiKeyAuth, encryptionService);

    expect(headers).toEqual({ myKey: 'mySecret' });
  });

  it('should add bearer authorization header', async () => {
    const headers = {};
    const bearerAuth: Authentication = { type: 'bearer', token: 'token' };

    await httpRequestStaticFunctions.addAuthenticationToHeaders(headers, bearerAuth, encryptionService);

    expect(headers).toEqual({ Authorization: 'Bearer token' });
  });

  it('should throw an error if bad authentication type', async () => {
    const headers = {};
    const noAuth: Authentication = { type: 'none' };
    await httpRequestStaticFunctions.addAuthenticationToHeaders(headers, noAuth, encryptionService);

    expect(headers).toEqual({});
  });

  it('should properly call node-fetch without proxy for JSON data', async () => {
    const requestUrl = 'https://www.example.com';
    const method = 'POST';
    const headers = {
      Authorization: 'Basic kdvdkfsdfdsf',
      'Content-Type': 'application/json'
    };
    const data = 'data';
    const timeout = 1000;
    (fetch as unknown as jest.Mock).mockReturnValue(Promise.resolve(new Response('Ok')));

    await httpRequestStaticFunctions.httpSend(requestUrl, method, headers, data, timeout, null);

    const expectedFetchOptions = {
      method,
      headers,
      body: data,
      timeout: timeout * 1000
    };

    expect(fetch).toHaveBeenCalledWith(requestUrl, expectedFetchOptions);
  });

  it('should properly call node-fetch with proxy for JSON data', async () => {
    const requestUrl = 'https://www.example.com';
    const method = 'POST';
    const headers = {
      Authorization: 'Basic kdvdkfsdfdsf',
      'Content-Type': 'application/json'
    };
    const proxy = {
      protocol: 'https',
      host: 'www.example.com',
      port: 80,
      username: 'username',
      password: 'password'
    };
    const data = 'data';
    const timeout = 1000;
    (fetch as unknown as jest.Mock).mockReturnValue(Promise.resolve(new Response('Ok')));

    await httpRequestStaticFunctions.httpSend(requestUrl, method, headers, data, timeout, proxy);

    const expectedFetchOptions = {
      method,
      headers,
      body: data,
      agent: proxy,
      timeout: timeout * 1000
    };

    expect(fetch).toHaveBeenCalledWith(requestUrl, expectedFetchOptions);
  });

  it('should properly call node-fetch with proxy without auth for JSON data', async () => {
    const requestUrl = 'https://www.example.com';
    const method = 'POST';
    const headers = {
      Authorization: 'Basic kdvdkfsdfdsf',
      'Content-Type': 'application/json'
    };
    const proxy = {
      protocol: 'https',
      host: 'www.example.com',
      port: 80
    };
    const data = 'data';
    const timeout = 1000;
    (fetch as unknown as jest.Mock).mockReturnValue(Promise.resolve(new Response('Ok')));

    await httpRequestStaticFunctions.httpSend(requestUrl, method, headers, data, timeout, proxy);

    const expectedFetchOptions = {
      method,
      headers,
      body: data,
      agent: proxy,
      timeout: timeout * 1000
    };

    expect(fetch).toHaveBeenCalledWith(requestUrl, expectedFetchOptions);
  });

  it('should properly call node-fetch without proxy for form-data', async () => {
    (fsSync.createReadStream as jest.Mock).mockImplementation(() => ({
      pipe: jest.fn().mockReturnThis(),
      on: jest.fn().mockImplementation((event, handler) => {
        handler();
        return this;
      }),
      pause: jest.fn()
    }));

    const requestUrl = 'https://www.example.com';
    const method = 'POST';
    const headers = { Authorization: 'Basic kdvdkfsdfdsf' };
    const data = 'data';
    const timeout = 1000;
    (fetch as unknown as jest.Mock).mockReturnValue(Promise.resolve(new Response('Ok')));

    const myReadStream = {
      pipe: jest.fn().mockReturnThis(),
      on: jest.fn().mockImplementation((event, handler) => {
        handler();
        return this;
      }),
      pause: jest.fn(),
      close: jest.fn()
    };
    (fsSync.createReadStream as jest.Mock).mockReturnValueOnce(myReadStream);

    await httpRequestStaticFunctions.httpSend(requestUrl, method, headers, data, timeout, null);

    const expectedFetchOptions = {
      method,
      headers,
      body: expect.anything(),
      timeout: timeout * 1000
    };

    expect(fsSync.createReadStream).toHaveBeenCalledWith(data);
    expect(myReadStream.close).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(requestUrl, expectedFetchOptions);
  });

  it('should properly handle fetch response error', async () => {
    const requestUrl = 'https://www.example.com';
    const method = 'POST';
    const headers = {
      Authorization: 'Basic kdvdkfsdfdsf',
      'Content-Type': 'application/json'
    };
    const data = 'data';
    const timeout = 1000;
    (fetch as unknown as jest.Mock).mockReturnValue(Promise.resolve({ ok: false, status: 400, statusText: 'statusText' }));

    let result;
    try {
      await httpRequestStaticFunctions.httpSend(requestUrl, method, headers, data, timeout, null);
    } catch (response) {
      result = response;
    }

    const expectedResult: FetchError = new Error('statusText');
    expectedResult.responseError = true;
    expectedResult.statusCode = 400;
    expect(result).toEqual(expectedResult);
  });

  it('should properly handle fetch connect error', async () => {
    const requestUrl = 'https://www.example.com';
    const method = 'POST';
    const headers = {
      Authorization: 'Basic kdvdkfsdfdsf',
      'Content-Type': 'application/json'
    };
    const data = 'data';
    const timeout = 1000;
    (fetch as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('error');
    });

    let result;
    try {
      await httpRequestStaticFunctions.httpSend(requestUrl, method, headers, data, timeout, null);
    } catch (response) {
      result = response;
    }

    const expectedResult: FetchError = new Error('error');
    expectedResult.responseError = false;
    expect(result).toEqual(expectedResult);
  });
});
