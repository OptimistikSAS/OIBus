const BaseRequest = require('./base-request')

const { defaultConfig: config } = require('../../../tests/test-config')

// Mock utils class
jest.mock('../utils', () => ({ generateFormDataBodyFromFile: jest.fn() }))

// Mock OIBusEngine
const engine = {
  configService: { getConfig: () => ({ engineConfig: config.engine }) },
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
    )).rejects.toThrowError('http error')

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

    expect(baseRequest.sendImplementation).toHaveBeenCalledWith(
      'https://www.example.com',
      'POST',
      { Authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=' },
      null,
      '',
      30000,
    )
  })

  it('should properly return success without auth', async () => {
    baseRequest.sendImplementation = jest.fn()

    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const proxy = null
    const data = ''

    await baseRequest.httpSend(requestUrl, method, null, proxy, data)

    expect(baseRequest.sendImplementation).toHaveBeenCalledWith(
      'https://www.example.com',
      'POST',
      {},
      null,
      '',
      30000,
    )
  })

  it('should log a warning if sendImplementation is not implemented', async () => {
    await baseRequest.sendImplementation('requestUrl', 'GET', {}, null, 'data', 1000)
    expect(engine.logger.warn).toHaveBeenCalledWith('sendImplementation() should be surchargedFunction called '
        + 'with GET requestUrl and headers "{}", proxy "null", data "data" and timeout 1000.')
  })
})
