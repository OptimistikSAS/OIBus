const axios = require('axios').default
const tunnel = require('tunnel')

const AxiosRequest = require('./AxiosRequest.class')

// Mock axios
jest.mock('axios', () => ({
  default: {
    CancelToken: { source: () => ({ token: 'token' }) },
    create: jest.fn(),
  },
}))

// Mock ProxyAgent
jest.mock('proxy-agent')

// Mock engine
const engine = jest.mock('../../engine/OIBusEngine.class')
engine.configService = { getConfig: () => ({ engineConfig: { httpRequest: { timeout: 10000, retryCount: 2 } } }) }
engine.encryptionService = { decryptText: (password) => password }
engine.logger = { trace: jest.fn(), error: jest.fn() }

beforeEach(() => {
  jest.resetAllMocks()
  jest.clearAllMocks()
  jest.useFakeTimers()
})

describe('RequestFactory', () => {
  it('should properly call axios without proxy for JSON data', async () => {
    const axiosRequest = new AxiosRequest(engine)
    axiosRequest.generateFormDataBody = jest.fn()
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

    const result = await axiosRequest.sendImplementation(requestUrl, method, headers, null, data, timeout)

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
    expect(axiosRequest.generateFormDataBody).not.toBeCalled()
    expect(mockAxios).toBeCalledWith(expectedAxiosOptions)
    expect(result).toBeTruthy()
  })

  it('should properly call axios with proxy for JSON data', async () => {
    const axiosRequest = new AxiosRequest(engine)
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
    jest.spyOn(axiosRequest, 'generateFormDataBody').mockImplementation(() => {})
    const result = await axiosRequest.sendImplementation(requestUrl, method, headers, proxy, data, timeout)

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
    expect(axiosRequest.generateFormDataBody).not.toBeCalled()
    expect(mockAxios).toBeCalledWith(expectedAxiosOptions)
    expect(result).toBeTruthy()
  })

  it('should properly call axios without proxy for form-data', async () => {
    const axiosRequest = new AxiosRequest(engine)
    const mockedBody = { getHeaders: () => ({ formDataHeader: 'formDataHeader' }) }
    axiosRequest.generateFormDataBody = jest.fn().mockImplementation(() => mockedBody)
    const requestUrl = 'https://www.example.com'
    const method = 'POST'
    const headers = { Authorization: 'Basic kdvdkfsdfdsf' }
    const data = 'data'
    const timeout = 1000 * 10000
    const mockAxios = jest.fn().mockReturnValue(Promise.resolve())
    axios.create.mockReturnValue(mockAxios)

    const result = await axiosRequest.sendImplementation(requestUrl, method, headers, null, data, timeout)

    const expectedAxiosOptions = {
      method,
      url: requestUrl,
      headers,
      data: mockedBody,
    }

    expect(axiosRequest.generateFormDataBody).toBeCalledWith(data)
    expect(mockAxios).toBeCalledWith(expectedAxiosOptions)
    expect(result).toBeTruthy()
  })

  it('should properly handle axios error', async () => {
    const axiosRequest = new AxiosRequest(engine)
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

    const expectedResult = {
      error: { response: { status: 400 } },
      responseError: true,
      statusCode: 400,
    }
    expect(result).toEqual(expectedResult)
  })
})
