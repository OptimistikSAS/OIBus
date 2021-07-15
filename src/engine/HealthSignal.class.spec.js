const HealthSignal = require('./HealthSignal.class')
const Logger = require('./Logger.class')

// Mock logger
jest.mock('./Logger.class')
Logger.getDefaultLogger = () => new Logger()

// Mock engine
const engine = jest.genMockFromModule('./Engine.class')

beforeEach(() => {
  jest.resetAllMocks()
  jest.useFakeTimers()
})

describe('HealthSignal', () => {
  const proxy = {
    name: 'proxy_name',
    protocol: 'http',
    host: 'proxy.host',
    port: 666,
    username: 'proxy_user',
    password: 'proxy_pass',
  }

  const healthSignalConfig = {
    logging: {
      enabled: true,
      frequency: 3600,
      id: 'OIBus',
    },
    http: {
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
    },
  }
  const engineConfig = {
    healthSignal: healthSignalConfig,
    proxies: [proxy],
  }
  engine.configService = { getConfig: () => ({ engineConfig }) }
  engine.getStatus = jest.fn()
  engine.getVersion = jest.fn()
  engine.requestService = { httpSend: jest.fn() }

  it('should be properly initialized', () => {
    const healthSignal = new HealthSignal(engine)

    expect(healthSignal.http.enabled).toBe(healthSignalConfig.http.enabled)
    expect(healthSignal.http.host).toBe(healthSignalConfig.http.host)
    expect(healthSignal.http.endpoint).toBe(healthSignalConfig.http.endpoint)
    expect(healthSignal.http.authentication).toBe(healthSignalConfig.http.authentication)
    expect(healthSignal.http.id).toBe(healthSignalConfig.http.id)
    expect(healthSignal.http.frequency).toBe(healthSignalConfig.http.frequency)
    expect(healthSignal.http.proxy).toBe(proxy)
    expect(healthSignal.httpTimer).toBeNull()
  })

  it('should also initialize if proxy is not configured', () => {
    delete engineConfig.proxies
    const healthSignal = new HealthSignal(engine)
    expect(healthSignal.http.enabled).toBe(healthSignalConfig.http.enabled)
    expect(healthSignal.http.host).toBe(healthSignalConfig.http.host)
    expect(healthSignal.http.endpoint).toBe(healthSignalConfig.http.endpoint)
    expect(healthSignal.http.authentication).toBe(healthSignalConfig.http.authentication)
    expect(healthSignal.http.id).toBe(healthSignalConfig.http.id)
    expect(healthSignal.http.frequency).toBe(healthSignalConfig.http.frequency)
    expect(healthSignal.http.proxy).toBe(false)
    expect(healthSignal.httpTimer).toBeNull()
    // restore
    engineConfig.proxies = [proxy]
  })

  it('should properly start when http enabled', () => {
    const healthSignal = new HealthSignal(engine)
    healthSignal.http.enabled = true
    healthSignal.logging.enabled = true
    healthSignal.start()

    expect(setTimeout).toHaveBeenCalledTimes(2)
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 1000 * healthSignalConfig.logging.frequency)
  })

  it('should properly start when disabled', () => {
    const healthSignal = new HealthSignal(engine)
    healthSignal.http.enabled = false
    healthSignal.logging.enabled = false
    healthSignal.start()

    expect(setTimeout).not.toBeCalled()
  })

  it('should call the http callback function after the scheduled interval', () => {
    const healthSignal = new HealthSignal(engine)
    healthSignal.http.enabled = true
    healthSignal.logging.enabled = false
    const callback = jest.spyOn(healthSignal, 'sendHttpSignal').mockImplementation(() => ({ }))
    engine.getStatus.mockReturnValue({ status: 'status' })
    healthSignal.start()

    jest.advanceTimersByTime(1000 * healthSignalConfig.http.frequency)

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should prepare simple status info when verbose is not enabled', async () => {
    const healthSignal = new HealthSignal(engine)
    engine.getVersion.mockReturnValue('version')

    const status = await healthSignal.prepareStatus(false, healthSignal.http.id)

    expect(engine.getVersion).toHaveBeenCalledTimes(1)
    expect(engine.getStatus).not.toHaveBeenCalled()
    expect(status).toEqual({ version: 'version' })
  })

  it('should prepare full status info when verbose is enabled', async () => {
    const healthSignal = new HealthSignal(engine)
    engine.getVersion.mockReturnValue('ver')
    engine.getStatus.mockReturnValue({ status: 'status', version: 'version' })

    const status = await healthSignal.prepareStatus(true, healthSignal.http.id)

    expect(engine.getVersion).toHaveBeenCalledTimes(1)
    expect(engine.getStatus).toHaveBeenCalledTimes(1)
    expect(status).toEqual({ status: 'status', version: 'version' })
  })

  it('should call RequestService httpSend()', async () => {
    const status = { status: 'status' }

    const healthSignal = new HealthSignal(engine)

    healthSignal.prepareStatus = jest.fn()
    healthSignal.prepareStatus.mockReturnValue(status)

    await healthSignal.sendHttpSignal()

    expect(healthSignal.logger.silly).toBeCalledWith('sendHttpSignal')
    expect(healthSignal.prepareStatus).toBeCalled()
    const calledStatus = JSON.stringify({ ...status })
    const headers = { 'Content-Type': 'application/json' }
    expect(engine.requestService.httpSend).toHaveBeenCalledWith(
      `${healthSignal.http.host}${healthSignal.http.endpoint}`,
      'POST',
      healthSignal.http.authentication,
      healthSignal.http.proxy,
      calledStatus,
      headers,
    )
    expect(healthSignal.logger.debug).toBeCalledWith('Health signal successful')
    expect(setTimeout).toHaveBeenCalledTimes(1)
  })

  it('should properly stop when enabled', () => {
    const healthSignal = new HealthSignal(engine)
    healthSignal.http.enabled = true
    healthSignal.start()
    healthSignal.stop()

    expect(clearTimeout).toHaveBeenCalledTimes(1)
  })

  it('should properly stop when disabled', () => {
    const healthSignal = new HealthSignal(engine)
    healthSignal.http.enabled = false
    healthSignal.start()
    healthSignal.stop()

    expect(clearTimeout).not.toBeCalled()
  })
})
