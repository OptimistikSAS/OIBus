const BaseRequest = require('./BaseRequest.class')

const { defaultConfig: config } = require('../../../tests/testConfig')

// Mock utils class
jest.mock('../utils', () => ({ generateFormDataBodyFromFile: jest.fn() }))

// Mock OIBusEngine
const engine = {
  configService: { getConfig: () => ({ engineConfig: config.engine }) },
  getCacheFolder: () => config.engine.caching.cacheFolder,
  addValues: jest.fn(),
  addFile: jest.fn(),
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), trace: jest.fn() },
  encryptionService: { decryptText: (password) => password },
}

let baseRequest = null

describe('BaseRequest', () => {
  beforeEach(() => {
    jest.resetAllMocks()

    baseRequest = new BaseRequest(engine)
  })

  it('should properly generate basic authentication header', async () => {
    baseRequest.sendImplementation = jest.fn()

    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const authentication = {
      type: 'Basic',
      username: 'username',
      password: 'password',
    }
    const proxy = null
    const data = ''

    await baseRequest.httpSend(requestUrl, method, authentication, proxy, data)

    const expectedAuthorizationHeader = Buffer.from('username:password').toString('base64')
    const expectedHeader = { Authorization: `Basic ${expectedAuthorizationHeader}` }
    expect(baseRequest.sendImplementation).toHaveBeenCalledTimes(1)
    expect(baseRequest.sendImplementation).toHaveBeenCalledWith(requestUrl, method, expectedHeader, proxy, data, 30 * 1000)
  })

  it('should properly generate API key authentication header', async () => {
    baseRequest.sendImplementation = jest.fn()

    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const authentication = {
      type: 'API Key',
      key: 'key',
      secretKey: 'secretKey',
    }
    const proxy = null
    const data = ''

    await baseRequest.httpSend(requestUrl, method, authentication, proxy, data)

    const expectedHeader = { key: 'secretKey' }
    expect(baseRequest.sendImplementation).toHaveBeenCalledTimes(1)
    expect(baseRequest.sendImplementation).toHaveBeenCalledWith(requestUrl, method, expectedHeader, proxy, data, 30 * 1000)
  })

  it('should properly generate Bearer token authentication header', async () => {
    baseRequest.sendImplementation = jest.fn()

    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const authentication = {
      type: 'Bearer',
      token: 'token',
    }
    const proxy = null
    const data = ''

    await baseRequest.httpSend(requestUrl, method, authentication, proxy, data)

    const expectedHeader = { Authorization: 'Bearer token' }
    expect(baseRequest.sendImplementation).toHaveBeenCalledTimes(1)
    expect(baseRequest.sendImplementation).toHaveBeenCalledWith(requestUrl, method, expectedHeader, proxy, data, 30 * 1000)
  })

  it('should throw error on invalid authentication type', async () => {
    baseRequest.sendImplementation = jest.fn()

    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const authentication = { type: 'invalid' }
    const proxy = null
    const data = ''

    await expect(baseRequest.httpSend(
      requestUrl,
      method,
      authentication,
      proxy,
      data,
    )).rejects.toThrowError('Unrecognized authentication type: "invalid".')

    expect(baseRequest.sendImplementation).not.toBeCalled()
  })

  it('should properly retry sending', async () => {
    baseRequest.sendImplementation = jest.fn().mockImplementation(() => {
      // eslint-disable-next-line no-throw-literal
      throw { responseError: 'error', statusCode: 400 }
    })

    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const authentication = {
      type: 'Basic',
      username: 'username',
      password: 'password',
    }
    const proxy = null
    const data = ''

    await expect(baseRequest.httpSend(
      requestUrl,
      method,
      authentication,
      proxy,
      data,
    )).rejects.toThrowError('Fail to send HTTP request after too many attempt (3).')

    // One call and 3 retry (from the config)
    expect(baseRequest.sendImplementation).toHaveBeenCalledTimes(4)
  })

  it('should properly throw communication error', async () => {
    baseRequest.sendImplementation = jest.fn().mockImplementation(() => {
      throw new Error('http error')
    })

    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const authentication = {
      type: 'Basic',
      username: 'username',
      password: 'password',
    }
    const proxy = null
    const data = ''

    await expect(baseRequest.httpSend(
      requestUrl,
      method,
      authentication,
      proxy,
      data,
    )).rejects.toThrowError('HTTP request failed: Error: http error.')

    expect(baseRequest.sendImplementation).toHaveBeenCalledTimes(1)
  })

  it('should properly return success', async () => {
    baseRequest.sendImplementation = jest.fn()

    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const authentication = {
      type: 'Basic',
      username: 'username',
      password: 'password',
    }
    const proxy = null
    const data = ''

    await baseRequest.httpSend(requestUrl, method, authentication, proxy, data)

    expect(baseRequest.sendImplementation).toHaveBeenCalledTimes(1)
  })
})
