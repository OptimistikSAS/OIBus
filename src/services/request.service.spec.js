const fetch = require('node-fetch')
const axios = require('axios').default

const requestService = require('./request.service')

// Mock libraries
jest.mock('axios')
jest.mock('axios', () => ({
  default: {
    CancelToken: { source: () => ({ token: 'token' }) },
    create: jest.fn(),
  },
}))
jest.mock('request')
jest.mock('node-fetch')
const { Response } = jest.requireActual('node-fetch')

// Mock logger
jest.mock('../engine/Logger.class', () => (function logger() {
  return {
    info: jest.fn(),
    error: jest.fn(),
    silly: jest.fn(),
  }
}))

// Mock engine
const engine = jest.fn()
engine.decryptPassword = (password) => password

beforeEach(() => {
  jest.resetAllMocks()
})

describe('Request service', () => {
  const requestUrl = 'https://example.com'
  const postMethod = 'POST'
  const proxy = {
    name: 'proxy_name',
    protocol: 'http',
    host: 'proxy.host',
    port: 666,
    username: 'proxy_user',
    password: 'proxy_pass',
  }
  const authentication = {
    type: 'Basic',
    username: 'username',
    password: 'password',
  }

  it('should call axios when stack is axios', async () => {
    const body = JSON.stringify({ status: 'status' })
    const headers = { 'Content-Type': 'application/json' }
    const stack = 'axios'
    const timeout = 30
    const engineConfig = {
      proxies: [proxy],
      httpRequest: {
        stack,
        timeout,
      },
    }
    engine.configService = { getConfig: () => ({ engineConfig }) }
    axios.create.mockReturnValue(() => jest.fn())

    await requestService.sendRequest(engine, requestUrl, postMethod, authentication, proxy, body, headers)

    expect(axios.create).toHaveBeenCalled()
    expect(fetch).not.toBeCalled()
  })

  it('should call node-fetch when stack is fetch', async () => {
    const body = JSON.stringify({ status: 'status' })
    const headers = { 'Content-Type': 'application/json' }
    const stack = 'fetch'
    const timeout = 30
    const engineConfig = {
      proxies: [proxy],
      httpRequest: {
        stack,
        timeout,
      },
    }
    engine.configService = { getConfig: () => ({ engineConfig }) }
    fetch.mockReturnValue(Promise.resolve(new Response('Ok')))

    await requestService.sendRequest(engine, requestUrl, postMethod, authentication, proxy, body, headers)

    expect(axios.create).not.toBeCalled()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
