import { jest } from '@jest/globals'

import fetch, { Response } from 'node-fetch'
import ProxyAgent from 'proxy-agent'

import FetchRequest from './FetchRequest.class.js'

// Mock node-fetch
jest.mock('node-fetch')

// Mock ProxyAgent
jest.mock('proxy-agent')

// Mock engine
const engine = jest.mock('../../engine/OIBusEngine.class.js')
engine.configService = { getConfig: () => ({ engineConfig: { httpRequest: { timeout: 10000, retryCount: 2 } } }) }
engine.encryptionService = { decryptText: (password) => password }
engine.logger = { trace: jest.fn(), error: jest.fn() }

let fetchRequest
beforeEach(() => {
  fetchRequest = new FetchRequest(engine)
})

describe('RequestFactory', () => {
  it('should properly call node-fetch without proxy for JSON data', async () => {
    fetchRequest.generateFormDataBody = jest.fn()
    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const headers = {
      Authorization: 'Basic kdvdkfsdfdsf',
      'Content-Type': 'application/json',
    }
    const data = 'data'
    const timeout = 1000 * 10000
    fetch.mockReturnValue(Promise.resolve(new Response('Ok')))

    const result = await fetchRequest.sendImplementation(requestUrl, method, headers, null, data, timeout)

    const expectedFetchOptions = {
      method,
      headers,
      body: data,
      agent: null,
      timeout,
    }

    expect(fetchRequest.generateFormDataBody).not.toBeCalled()
    expect(fetch).toBeCalledWith(requestUrl, expectedFetchOptions)
    expect(result).toBeTruthy()
  })

  it('should properly call node-fetch with proxy for JSON data', async () => {
    ProxyAgent.mockReturnValue({})
    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const headers = {
      Authorization: 'Basic kdvdkfsdfdsf',
      'Content-Type': 'application/json',
    }
    const proxy = {
      protocol: 'https',
      host: 'www.example.com',
      port: 80,
      username: 'username',
      password: 'password',
    }
    const data = 'data'
    const timeout = 1000 * 10000
    fetch.mockReturnValue(Promise.resolve(new Response('Ok')))

    const result = await fetchRequest.sendImplementation(requestUrl, method, headers, proxy, data, timeout)

    const expectedProxyOptions = {
      auth: 'username:password',
      hash: null,
      host: 'www.example.com:80',
      hostname: 'www.example.com',
      href: 'https://www.example.com:80/',
      path: '/',
      pathname: '/',
      port: '80',
      protocol: 'https:',
      query: null,
      search: null,
      slashes: true,
    }
    const expectedFetchOptions = {
      method,
      headers,
      body: data,
      agent: {},
      timeout,
    }

    expect(ProxyAgent).toBeCalledWith(expectedProxyOptions)
    expect(fetch).toBeCalledWith(requestUrl, expectedFetchOptions)
    expect(result).toBeTruthy()
  })

  it('should properly call node-fetch without proxy for form-data', async () => {
    const mockedBody = { getHeaders: () => ({ formDataHeader: 'formDataHeader' }) }
    fetchRequest.generateFormDataBody = jest.fn().mockImplementation(() => mockedBody)
    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const headers = { Authorization: 'Basic kdvdkfsdfdsf' }
    const data = 'data'
    const timeout = 1000 * 10000
    fetch.mockReturnValue(Promise.resolve(new Response('Ok')))

    const result = await fetchRequest.sendImplementation(requestUrl, method, headers, null, data, timeout)

    const expectedFetchOptions = {
      method,
      headers,
      body: mockedBody,
      agent: null,
      timeout,
    }

    expect(fetchRequest.generateFormDataBody).toBeCalledWith(data)
    expect(fetch).toBeCalledWith(requestUrl, expectedFetchOptions)
    expect(result).toBeTruthy()
  })

  it('should properly handle fetch response error', async () => {
    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const headers = {
      Authorization: 'Basic kdvdkfsdfdsf',
      'Content-Type': 'application/json',
    }
    const data = 'data'
    const timeout = 1000 * 10000
    fetch.mockReturnValue(Promise.resolve({ ok: false, status: 400, statusText: 'statusText' }))

    let result
    try {
      result = await fetchRequest.sendImplementation(requestUrl, method, headers, null, data, timeout)
    } catch (response) {
      result = response
    }

    const expectedResult = {
      error: new Error('statusText'),
      responseError: true,
      statusCode: 400,
    }
    expect(result).toEqual(expectedResult)
  })

  it('should properly handle fetch connect error', async () => {
    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const headers = {
      Authorization: 'Basic kdvdkfsdfdsf',
      'Content-Type': 'application/json',
    }
    const data = 'data'
    const timeout = 1000 * 10000
    fetch.mockReturnValue(Promise.reject(new Error('error')))

    let result
    try {
      result = await fetchRequest.sendImplementation(requestUrl, method, headers, null, data, timeout)
    } catch (response) {
      result = response
    }

    const expectedResult = {
      error: new Error('error'),
      responseError: false,
    }
    expect(result).toEqual(expectedResult)
  })
})
