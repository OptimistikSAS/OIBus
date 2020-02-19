const AliveSignal = require('./AliveSignal.class')

// Mock logger
jest.mock('./Logger.class', () => (function logger() {
  return {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    silly: jest.fn(),
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
  engine.sendRequest = jest.fn()

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

  it('should also initialize if proxy is not configured', () => {
    delete engineConfig.proxies
    const aliveSignal = new AliveSignal(engine)
    expect(aliveSignal.enabled).toBe(aliveSignalConfig.enabled)
    expect(aliveSignal.host).toBe(`${aliveSignalConfig.host}${aliveSignalConfig.endpoint}`)
    expect(aliveSignal.authentication).toBe(aliveSignalConfig.authentication)
    expect(aliveSignal.id).toBe(aliveSignalConfig.id)
    expect(aliveSignal.frequency).toBe(1000 * aliveSignalConfig.frequency)
    expect(aliveSignal.proxy).toBe(false)
    expect(aliveSignal.timer).toBeNull()
    // restore
    engineConfig.proxies = [proxy]
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

  it('should call the callback function after the scheduled interval', () => {
    const aliveSignal = new AliveSignal(engine)
    const callback = jest.spyOn(aliveSignal, 'pingCallback').mockImplementation(() => ({ }))
    engine.getStatus.mockReturnValue({ status: 'status' })
    aliveSignal.start()

    jest.advanceTimersByTime(1000 * aliveSignalConfig.frequency)

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should call Engine sendRequest()', async () => {
    const status = { status: 'status' }

    const aliveSignal = new AliveSignal(engine)

    engine.getStatus.mockReturnValue(status)

    await aliveSignal.pingCallback()

    expect(aliveSignal.logger.silly).toBeCalledWith('pingCallback')
    expect(engine.getStatus).toBeCalled()
    const calledStatus = {
      ...status,
      id: aliveSignal.id,
    }
    expect(engine.sendRequest).toBeCalledWith(aliveSignal.host, 'POST', aliveSignal.authentication, aliveSignal.proxy, calledStatus)
    expect(aliveSignal.logger.debug).toBeCalledWith('Alive signal successful')
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
