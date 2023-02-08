import fsSync from 'node:fs';
import fetch from 'node-fetch';
import * as httpRequestStaticFunctions from './http-request-static-functions';
import { FetchError } from './http-request-static-functions';

jest.mock('node:fs');

// Mock node-fetch
jest.mock('node-fetch');
const { Response } = jest.requireActual('node-fetch');

describe('HTTP request static functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should add basic authorization header', async () => {
    const headers = {};
    httpRequestStaticFunctions.addAuthenticationToHeaders(headers, 'Basic', 'username', 'password');

    expect(headers).toEqual({ Authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=' });
  });

  it('should add api key header', async () => {
    const headers = {};
    httpRequestStaticFunctions.addAuthenticationToHeaders(headers, 'API Key', 'myKey', 'mySecret');

    expect(headers).toEqual({ myKey: 'mySecret' });
  });

  it('should add bearer authorization header', async () => {
    const headers = {};
    httpRequestStaticFunctions.addAuthenticationToHeaders(headers, 'Bearer', 'unused', 'token');

    expect(headers).toEqual({ Authorization: 'Bearer token' });
  });

  it('should throw an error if bad authentication type', async () => {
    const headers = {};
    let error;
    try {
      httpRequestStaticFunctions.addAuthenticationToHeaders(headers, 'Bad', null, null);
    } catch (err) {
      error = err;
    }

    expect(error).toEqual(new Error('Unrecognized authentication type: "Bad".'));
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
