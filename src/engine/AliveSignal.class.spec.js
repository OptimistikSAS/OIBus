const fetch = require('node-fetch')

const AliveSignal = require('./AliveSignal.class')

// Mock fetch
jest.mock('node-fetch')
const { Response } = jest.requireActual('node-fetch')

// Mock logger
jest.mock('./Logger.class', () => (function logger() {
  return {
    info: jest.fn(),
    error: jest.fn(),
  }
}))

// Mock engine
const engine = jest.genMockFromModule('./Engine.class')

beforeEach(() => {
  jest.resetAllMocks()
  jest.useFakeTimers()
})

describe('AliveSignal', () => {
  const proxy = {
    name: 'proxy_name',
    protocol: 'http',
    host: 'proxy.host',
    port: 666,
    username: 'proxy_user',
    password: 'proxy_pass',
  }
  const aliveSignalConfig = {
    enabled: true,
    host: 'https://example.com',
    endpoint: '/endpoint/info',
    authentication: {
      type: 'Basic',
      username: 'username',
      password: 'password',
    },
    id: 'id',
    frequency: 300,
    proxy: 'proxy_name',
  }
  const engineConfig = {
    aliveSignal: aliveSignalConfig,
    proxies: [proxy],
  }
  engine.configService = { getConfig: () => ({ engineConfig }) }
  engine.decryptPassword = (password) => password
  engine.getStatus = jest.fn()

  it('should be properly initialized', () => {
    const aliveSignal = new AliveSignal(engine)

    expect(aliveSignal.enabled).toBe(aliveSignalConfig.enabled)
    expect(aliveSignal.host).toBe(`${aliveSignalConfig.host}${aliveSignalConfig.endpoint}`)
    expect(aliveSignal.authentication).toBe(aliveSignalConfig.authentication)
    expect(aliveSignal.id).toBe(aliveSignalConfig.id)
    expect(aliveSignal.frequency).toBe(1000 * aliveSignalConfig.frequency)
    expect(aliveSignal.proxy).toBe(proxy)
    expect(aliveSignal.timer).toBeNull()
  })

  it('should properly start when enabled', () => {
    const aliveSignal = new AliveSignal(engine)
    aliveSignal.enabled = true
    aliveSignal.start()

    expect(setTimeout).toHaveBeenCalledTimes(1)
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 1000 * aliveSignalConfig.frequency)
  })

  it('should properly start when disabled', () => {
    const aliveSignal = new AliveSignal(engine)
    aliveSignal.enabled = false
    aliveSignal.start()

    expect(setTimeout).not.toBeCalled()
  })

  it('should properly generate headers when authentication is Basic', () => {
    const aliveSignal = new AliveSignal(engine)
    const headers = aliveSignal.generateHeaders(aliveSignalConfig.authentication)

    expect(headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=',
    })
  })

  it('should properly generate headers when authentication is not Basic', () => {
    const aliveSignal = new AliveSignal(engine)
    const headers = aliveSignal.generateHeaders({
      type: 'NonBasic',
      username: 'username',
      password: 'password',
    })

    expect(headers).toMatchObject({ 'Content-Type': 'application/json' })
  })

  it('should properly configure proxy agent when proxy is enabled', () => {
    const aliveSignal = new AliveSignal(engine)
    const agent = aliveSignal.configureProxyAgent(null)

    expect(agent).toBeNull()
  })

  it('should properly configure proxy agent when proxy is disabled', () => {
    const aliveSignal = new AliveSignal(engine)
    const agent = aliveSignal.configureProxyAgent(proxy)

    expect(typeof agent).toBe('object')
  })

  it('should call the callback function after the scheduled interval', () => {
    const aliveSignal = new AliveSignal(engine)
    const callback = jest.spyOn(aliveSignal, 'pingCallback').mockImplementation(() => ({ }))
    engine.getStatus.mockReturnValue({ status: 'status' })
    aliveSignal.start()

    jest.advanceTimersByTime(1000 * aliveSignalConfig.frequency)

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should send the proper request', async () => {
    const status = { status: 'status' }
    const headers = { 'Content-Type': 'application/json' }
    const agent = {}

    const host = `${aliveSignalConfig.host}${aliveSignalConfig.endpoint}`
    const fetchOptions = {
      method: 'POST',
      body: JSON.stringify({
        status: 'status',
        id: aliveSignalConfig.id,
      }),
      headers,
      agent,
    }

    const aliveSignal = new AliveSignal(engine)

    const generateHeaders = jest.spyOn(aliveSignal, 'generateHeaders').mockReturnValue(headers)
    const configureProxyAgent = jest.spyOn(aliveSignal, 'configureProxyAgent').mockReturnValue(agent)
    engine.getStatus.mockReturnValue(status)
    fetch.mockReturnValue(Promise.resolve(new Response('Ok')))

    await aliveSignal.pingCallback()

    expect(generateHeaders).toBeCalledWith(aliveSignalConfig.authentication)
    expect(configureProxyAgent).toBeCalledWith(proxy)
    expect(engine.getStatus).toBeCalled()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toBeCalledWith(host, fetchOptions)
    expect(aliveSignal.logger.info).toBeCalledWith('Alive signal successful')
    expect(setTimeout).toHaveBeenCalledTimes(1)
  })

  it('should properly stop when enabled', () => {
    const aliveSignal = new AliveSignal(engine)
    aliveSignal.enabled = true
    aliveSignal.start()
    aliveSignal.stop()

    expect(clearTimeout).toHaveBeenCalledTimes(1)
  })

  it('should properly stop when disabled', () => {
    const aliveSignal = new AliveSignal(engine)
    aliveSignal.enabled = false
    aliveSignal.start()
    aliveSignal.stop()

    expect(clearTimeout).not.toBeCalled()
  })
})
