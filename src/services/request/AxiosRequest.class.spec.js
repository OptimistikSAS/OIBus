const axios = require('axios').default
const tunnel = require('tunnel')

const AxiosRequest = require('./AxiosRequest.class')
const utils = require('../utils')

const { defaultConfig: config } = require('../../../tests/testConfig')

// Mock utils class
jest.mock('../utils', () => ({ generateFormDataBodyFromFile: jest.fn() }))

// Mock axios
jest.mock('axios', () => ({
  default: {
    CancelToken: { source: () => ({ token: 'token' }) },
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

    expect(axios.create).toBeCalledTimes(2)
    expect(axios.create.mock.calls).toEqual([
      [expectedAxiosCreateOptions1],
      [expectedAxiosCreateOptions2],
    ])
    expect(tunnel.httpsOverHttps).toBeCalledWith({ axiosProxy: expectedAxiosProxy })
    expect(mockAxios).toBeCalledWith(expectedAxiosOptions)
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

    await axiosRequest.sendImplementation(requestUrl, method, headers, null, data, timeout)

    const expectedAxiosOptions = {
      method,
      url: requestUrl,
      headers,
      data: mockedBody,
    }

    expect(utils.generateFormDataBodyFromFile).toBeCalledWith(data)
    expect(mockAxios).toBeCalledWith(expectedAxiosOptions)
  })

  it('should properly handle axios error', async () => {
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
  })
})
