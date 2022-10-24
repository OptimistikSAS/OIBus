const path = require('path')
const fsSync = require('node:fs')

const fetch = require('node-fetch')
const ProxyAgent = require('proxy-agent')

const FetchRequest = require('./fetch-request')
const utils = require('../utils')

const { defaultConfig: config } = require('../../../tests/test-config')

jest.mock('node:fs')

// Mock utils class
jest.mock('../utils', () => ({ generateFormDataBodyFromFile: jest.fn() }))

// Mock node-fetch
jest.mock('node-fetch')
const { Response } = jest.requireActual('node-fetch')

// Mock ProxyAgent
jest.mock('proxy-agent')

// Mock OIBusEngine
const engine = {
  configService: { getConfig: () => ({ engineConfig: config.engine }) },
  addValues: jest.fn(),
  addFile: jest.fn(),
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), trace: jest.fn() },
  encryptionService: { decryptText: (password) => password },
}

let fetchRequest = null

describe('FetchRequest', () => {
  beforeEach(() => {
    jest.resetAllMocks()

    fetchRequest = new FetchRequest(engine)
  })

  it('should properly call node-fetch without proxy for JSON data', async () => {
    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const headers = {
      Authorization: 'Basic kdvdkfsdfdsf',
      'Content-Type': 'application/json',
    }
    const data = 'data'
    const timeout = 1000 * 10000
    fetch.mockReturnValue(Promise.resolve(new Response('Ok')))

    await fetchRequest.sendImplementation(requestUrl, method, headers, null, data, timeout)

    const expectedFetchOptions = {
      method,
      headers,
      body: data,
      agent: null,
      timeout,
    }

    expect(fetch).toBeCalledWith(requestUrl, expectedFetchOptions)
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

    await fetchRequest.sendImplementation(requestUrl, method, headers, proxy, data, timeout)

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
  })

  it('should properly call node-fetch with proxy without auth for JSON data', async () => {
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
    }
    const data = 'data'
    const timeout = 1000 * 10000
    fetch.mockReturnValue(Promise.resolve(new Response('Ok')))

    await fetchRequest.sendImplementation(requestUrl, method, headers, proxy, data, timeout)

    const expectedProxyOptions = {
      auth: null,
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
  })

  it('should properly call node-fetch without proxy for form-data', async () => {
    const mockedBody = { getHeaders: () => ({ formDataHeader: 'formDataHeader' }) }
    utils.generateFormDataBodyFromFile.mockReturnValue(mockedBody)
    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const headers = { Authorization: 'Basic kdvdkfsdfdsf' }
    const data = 'data'
    const timeout = 1000 * 10000
    fetch.mockReturnValue(Promise.resolve(new Response('Ok')))

    const myReadStream = {
      pipe: jest.fn().mockReturnThis(),
      on: jest.fn().mockImplementation((event, handler) => {
        handler()
        return this
      }),
      pause: jest.fn(),
      close: jest.fn(),
    }
    fsSync.createReadStream.mockReturnValueOnce(myReadStream)

    await fetchRequest.sendImplementation(requestUrl, method, headers, null, data, timeout)

    const expectedFetchOptions = {
      method,
      headers,
      body: mockedBody,
      agent: null,
      timeout,
    }

    expect(utils.generateFormDataBodyFromFile).toBeCalledWith(path.parse(data), myReadStream)
    expect(myReadStream.close).toHaveBeenCalledTimes(1)
    expect(fetch).toBeCalledWith(requestUrl, expectedFetchOptions)
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
      await fetchRequest.sendImplementation(requestUrl, method, headers, null, data, timeout)
    } catch (response) {
      result = response
    }

    const expectedResult = new Error('statusText')
    expectedResult.responseError = true
    expectedResult.statusCode = 400
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
      await fetchRequest.sendImplementation(requestUrl, method, headers, null, data, timeout)
    } catch (response) {
      result = response
    }

    const expectedResult = new Error('error')
    expectedResult.responseError = false
    expect(result).toEqual(expectedResult)
  })
})
