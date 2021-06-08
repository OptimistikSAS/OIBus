const FormData = require('form-data')

const BaseRequest = require('./BaseRequest.class')
const ApiHandler = require('../../north/ApiHandler.class')
const Logger = require('../../engine/Logger.class')

// Mock logger
jest.mock('../../engine/Logger.class')
Logger.getDefaultLogger = () => new Logger()

// Mock engine
const engine = jest.genMockFromModule('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: { httpRequest: { timeout: 10000, retryCount: 2 } } }) }
engine.encryptionService = { decryptText: (password) => password }

beforeEach(() => {
  jest.resetAllMocks()
  jest.clearAllMocks()
})

describe('RequestFactory', () => {
  const baseRequest = new BaseRequest(engine)

  it('should properly get filename without timestamp', () => {
    const filepath = '/path/to/note-1610983920007.txt'

    const filename = baseRequest.getFilenameWithoutTimestamp(filepath)

    expect(filename).toEqual('note.txt')
  })

  it('should properly generate form-data body', () => {
    const filepath = '/path/to/note-1610983920007.txt'

    const formData = baseRequest.generateFormDataBody(filepath)

    expect(formData).toBeInstanceOf(FormData)
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

    const result = await baseRequest.httpSend(requestUrl, method, authentication, proxy, data)

    const expectedAuthorizationHeader = Buffer.from('username:password').toString('base64')
    const expectedHeader = { Authorization: `Basic ${expectedAuthorizationHeader}` }
    expect(result).toEqual(ApiHandler.STATUS.SUCCESS)
    expect(baseRequest.sendImplementation).toHaveBeenCalledTimes(1)
    expect(baseRequest.sendImplementation).toHaveBeenCalledWith(requestUrl, method, expectedHeader, proxy, data, 1000 * 10000)
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

    const result = await baseRequest.httpSend(requestUrl, method, authentication, proxy, data)

    const expectedHeader = { key: 'secretKey' }
    expect(result).toEqual(ApiHandler.STATUS.SUCCESS)
    expect(baseRequest.sendImplementation).toHaveBeenCalledTimes(1)
    expect(baseRequest.sendImplementation).toHaveBeenCalledWith(requestUrl, method, expectedHeader, proxy, data, 1000 * 10000)
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

    const result = await baseRequest.httpSend(requestUrl, method, authentication, proxy, data)

    const expectedHeader = { Authorization: 'Bearer token' }
    expect(result).toEqual(ApiHandler.STATUS.SUCCESS)
    expect(baseRequest.sendImplementation).toHaveBeenCalledTimes(1)
    expect(baseRequest.sendImplementation).toHaveBeenCalledWith(requestUrl, method, expectedHeader, proxy, data, 1000 * 10000)
  })

  it('should throw error on invalid authentication type', async () => {
    baseRequest.sendImplementation = jest.fn()

    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const authentication = { type: 'invalid' }
    const proxy = null
    const data = ''

    let result
    try {
      result = await baseRequest.httpSend(requestUrl, method, authentication, proxy, data)
    } catch (response) {
      result = response
    }

    expect(result).toEqual(ApiHandler.STATUS.LOGIC_ERROR)
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

    let result
    try {
      result = await baseRequest.httpSend(requestUrl, method, authentication, proxy, data)
    } catch (response) {
      result = response
    }

    expect(result).toEqual(ApiHandler.STATUS.LOGIC_ERROR)
    expect(baseRequest.sendImplementation).toHaveBeenCalledTimes(3)
  })

  it('should properly throw communication error', async () => {
    baseRequest.sendImplementation = jest.fn().mockImplementation(() => {
      // eslint-disable-next-line no-throw-literal
      throw {}
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

    let result
    try {
      result = await baseRequest.httpSend(requestUrl, method, authentication, proxy, data)
    } catch (response) {
      result = response
    }

    expect(result).toEqual(ApiHandler.STATUS.COMMUNICATION_ERROR)
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

    const result = await baseRequest.httpSend(requestUrl, method, authentication, proxy, data)

    expect(result).toEqual(ApiHandler.STATUS.SUCCESS)
    expect(baseRequest.sendImplementation).toHaveBeenCalledTimes(1)
  })
})
