const path = require('node:path')
const fsSync = require('node:fs')

const axios = require('axios').default
const tunnel = require('tunnel')
const AxiosRequest = require('./axios-request')

const utils = require('../utils')

const { defaultConfig: config } = require('../../../tests/test-config')

jest.mock('node:fs')

// Mock utils class
jest.mock('../utils', () => ({ generateFormDataBodyFromFile: jest.fn() }))

// Mock axios
jest.mock('axios', () => ({
  default: {
    CancelToken: { source: () => ({ token: 'token', cancel: jest.fn() }) },
    create: jest.fn(),
  },
}))

// Mock OIBusEngine
const engine = {
  configService: { getConfig: () => ({ engineConfig: config.engine }) },
  addValues: jest.fn(),
  addFile: jest.fn(),
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), trace: jest.fn() },
  encryptionService: { decryptText: (password) => password },
}

let axiosRequest = null

describe('AxiosRequest', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.useFakeTimers()

    axiosRequest = new AxiosRequest(engine)
  })

  it('should properly call axios without proxy for JSON data', async () => {
    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const headers = {
      Authorization: 'Basic kdvdkfsdfdsf',
      'Content-Type': 'application/json',
    }
    const data = 'data'
    const timeout = 1000 * 10000
    const mockAxios = jest.fn().mockReturnValue(Promise.resolve())
    axios.create.mockReturnValue(mockAxios)

    const myCancelToken = { token: 'token', cancel: jest.fn() }
    axios.CancelToken = { source: () => myCancelToken }

    await axiosRequest.sendImplementation(requestUrl, method, headers, null, data, timeout)

    const expectedAxiosCreateOptions = {
      cancelToken: 'token',
      timeout: 1000 * 10000,
    }
    const expectedAxiosOptions = {
      method,
      url: requestUrl,
      headers,
      data,
    }

    expect(axios.create).toBeCalledTimes(1)
    expect(axios.create).toBeCalledWith(expectedAxiosCreateOptions)
    expect(mockAxios).toBeCalledWith(expectedAxiosOptions)
  })

  it('should properly call axios with proxy for JSON data', async () => {
    tunnel.httpsOverHttps = jest.fn().mockReturnValue({})
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
    const mockAxios = jest.fn().mockReturnValue(Promise.resolve())
    axios.create.mockReturnValue(mockAxios)
    await axiosRequest.sendImplementation(requestUrl, method, headers, proxy, data, timeout)
    const expectedAxiosCreateOptions1 = {
      cancelToken: 'token',
      timeout: 1000 * 10000,
    }
    const expectedAxiosCreateOptions2 = {
      cancelToken: 'token',
      timeout: 1000 * 10000,
      proxy: false,
      httpsAgent: {},
    }
    const expectedAxiosOptions = {
      method,
      url: requestUrl,
      headers,
      data,
    }
    const expectedAxiosProxy = {
      host: 'www.example.com',
      port: 80,
      proxyAuth: 'username:password',
    }

    expect(axios.create).toHaveBeenCalledTimes(2)
    expect(axios.create.mock.calls).toEqual([
      [expectedAxiosCreateOptions1],
      [expectedAxiosCreateOptions2],
    ])
    expect(tunnel.httpsOverHttps).toHaveBeenCalledWith({ axiosProxy: expectedAxiosProxy })
    expect(mockAxios).toHaveBeenCalledWith(expectedAxiosOptions)
  })

  it('should properly call axios with proxy for JSON data', async () => {
    tunnel.httpsOverHttp = jest.fn().mockReturnValue({})
    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const headers = {
      Authorization: 'Basic kdvdkfsdfdsf',
      'Content-Type': 'application/json',
    }
    const proxy = {
      protocol: 'http',
      host: 'www.example.com',
      port: 80,
    }
    const data = 'data'
    const timeout = 1000 * 10000
    const mockAxios = jest.fn().mockReturnValue(Promise.resolve())
    axios.create.mockReturnValue(mockAxios)
    await axiosRequest.sendImplementation(requestUrl, method, headers, proxy, data, timeout)
    const expectedAxiosCreateOptions1 = {
      cancelToken: 'token',
      timeout: 1000 * 10000,
    }
    const expectedAxiosCreateOptions2 = {
      cancelToken: 'token',
      timeout: 1000 * 10000,
      proxy: false,
      httpsAgent: {},
    }
    const expectedAxiosOptions = {
      method,
      url: requestUrl,
      headers,
      data,
    }
    const expectedAxiosProxy = {
      host: 'www.example.com',
      port: 80,
    }

    expect(axios.create).toHaveBeenCalledTimes(2)
    expect(axios.create.mock.calls).toEqual([
      [expectedAxiosCreateOptions1],
      [expectedAxiosCreateOptions2],
    ])
    expect(tunnel.httpsOverHttp).toHaveBeenCalledWith({ axiosProxy: expectedAxiosProxy })
    expect(mockAxios).toHaveBeenCalledWith(expectedAxiosOptions)
  })

  it('should properly call axios without proxy for form-data', async () => {
    const mockedBody = { getHeaders: () => ({ formDataHeader: 'formDataHeader' }) }
    utils.generateFormDataBodyFromFile.mockReturnValue(mockedBody)
    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const headers = { Authorization: 'Basic kdvdkfsdfdsf' }
    const data = 'data'
    const timeout = 1000 * 10000
    const mockAxios = jest.fn().mockReturnValue(Promise.resolve())
    axios.create.mockReturnValue(mockAxios)

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

    await axiosRequest.sendImplementation(requestUrl, method, headers, null, data, timeout)

    const expectedAxiosOptions = {
      method,
      url: requestUrl,
      headers,
      data: mockedBody,
    }

    expect(myReadStream.close).toHaveBeenCalledTimes(1)
    expect(utils.generateFormDataBodyFromFile).toBeCalledWith(path.parse(data), myReadStream)
    expect(mockAxios).toBeCalledWith(expectedAxiosOptions)
  })

  it('should properly handle axios response error', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const headers = {
      Authorization: 'Basic kdvdkfsdfdsf',
      'Content-Type': 'application/json',
    }
    const data = 'data'
    const timeout = 1000 * 10000

    // eslint-disable-next-line prefer-promise-reject-errors
    const mockAxios = jest.fn().mockReturnValue(Promise.reject({ response: { status: 400 } }))
    axios.create.mockReturnValue(mockAxios)

    let result
    try {
      result = await axiosRequest.sendImplementation(requestUrl, method, headers, null, data, timeout)
    } catch (response) {
      result = response
    }

    const expectedResult = new Error('Axios response error: 400')
    expectedResult.responseError = true
    expectedResult.statusCode = 400

    expect(result).toEqual(expectedResult)
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
  })

  it('should properly handle axios request error', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const headers = {
      Authorization: 'Basic kdvdkfsdfdsf',
      'Content-Type': 'application/json',
    }
    const data = 'data'
    const timeout = 1000 * 10000

    // eslint-disable-next-line prefer-promise-reject-errors
    const mockAxios = jest.fn().mockReturnValue(Promise.reject({ request: {}, message: 'request error' }))
    axios.create.mockReturnValue(mockAxios)

    let result
    try {
      result = await axiosRequest.sendImplementation(requestUrl, method, headers, null, data, timeout)
    } catch (response) {
      result = response
    }

    const expectedResult = new Error('request error')
    expectedResult.responseError = false

    expect(result).toEqual(expectedResult)
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
  })

  it('should properly handle axios other error', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const headers = {
      Authorization: 'Basic kdvdkfsdfdsf',
      'Content-Type': 'application/json',
    }
    const data = 'data'
    const timeout = 1000 * 10000

    // eslint-disable-next-line prefer-promise-reject-errors
    const mockAxios = jest.fn().mockReturnValue(Promise.reject({ message: 'other error' }))
    axios.create.mockReturnValue(mockAxios)

    let result
    try {
      result = await axiosRequest.sendImplementation(requestUrl, method, headers, null, data, timeout)
    } catch (response) {
      result = response
    }

    const expectedResult = new Error('other error')
    expectedResult.responseError = false

    expect(result).toEqual(expectedResult)
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
  })
})
