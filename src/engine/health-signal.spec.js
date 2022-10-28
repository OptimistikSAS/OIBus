const HealthSignal = require('./health-signal')
const utils = require('../service/utils')

// Mock engine
const engine = {
  logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn(), info: jest.fn(), trace: jest.fn() },
  configService: { getConfig: jest.fn() },
  getOIBusInfo: jest.fn(),
  encryptionService: { decryptText: (textToDecipher) => textToDecipher },
}

jest.mock('../service/utils')

const proxy = {
  name: 'proxy_name',
  protocol: 'http',
  host: 'proxy.host',
  port: 666,
  username: 'proxy_user',
  password: 'proxy_pass',
}
let healthSignalSettings = null
let healthSignal = null

describe('HealthSignal', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.useFakeTimers()

    healthSignalSettings = {
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
          key: 'username',
          secret: 'password',
        },
        frequency: 300,
        proxy: 'proxy_name',
      },
    }
    const engineConfig = {
      engineName: 'OIBus',
      healthSignal: healthSignalSettings,
      proxies: [proxy],
    }
    engine.configService.getConfig.mockReturnValue({ engineConfig })
    healthSignal = new HealthSignal(engine)
  })

  it('should be properly initialized', () => {
    expect(healthSignal.http.enabled).toBe(healthSignalSettings.http.enabled)
    expect(healthSignal.http.host).toBe(healthSignalSettings.http.host)
    expect(healthSignal.http.endpoint).toBe(healthSignalSettings.http.endpoint)
    expect(healthSignal.http.authentication).toBe(healthSignalSettings.http.authentication)
    expect(healthSignal.http.id).toBe(healthSignalSettings.http.id)
    expect(healthSignal.http.frequency).toBe(healthSignalSettings.http.frequency)
    expect(healthSignal.http.proxy).toBe(proxy)
    expect(healthSignal.httpTimer).toBeNull()
  })

  it('should also initialize if proxy is not configured', () => {
    engine.configService.getConfig.mockReturnValue({
      engineConfig:
          {
            engineName: 'OIBus',
            healthSignal: healthSignalSettings,
          },
    })

    const healthSignalWithoutProxy = new HealthSignal(engine)
    expect(healthSignalWithoutProxy.http.enabled).toBe(healthSignalSettings.http.enabled)
    expect(healthSignalWithoutProxy.http.host).toBe(healthSignalSettings.http.host)
    expect(healthSignalWithoutProxy.http.endpoint).toBe(healthSignalSettings.http.endpoint)
    expect(healthSignalWithoutProxy.http.authentication).toBe(healthSignalSettings.http.authentication)
    expect(healthSignalWithoutProxy.http.id).toBe(healthSignalSettings.http.id)
    expect(healthSignalWithoutProxy.http.frequency).toBe(healthSignalSettings.http.frequency)
    expect(healthSignalWithoutProxy.http.proxy).toBe(null)
    expect(healthSignalWithoutProxy.httpTimer).toBeNull()
  })

  it('should properly start when http enabled and call callback function', () => {
    const callback = jest.spyOn(healthSignal, 'sendHttpSignal').mockImplementation(() => ({ }))
    healthSignal.http.enabled = true
    healthSignal.logging.enabled = true
    healthSignal.start()

    jest.advanceTimersByTime(1000 * healthSignalSettings.http.frequency)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should properly start when disabled', () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
    healthSignal.http.enabled = false
    healthSignal.logging.enabled = false
    healthSignal.start()

    expect(setTimeoutSpy).not.toHaveBeenCalled()
  })

  it('should prepare simple status info when verbose is not enabled', async () => {
    engine.getOIBusInfo.mockReturnValue({ version: 'version' })
    engine.statusData = { randomStatusData: 'test' }

    const status = await healthSignal.prepareStatus(false)

    expect(engine.getOIBusInfo).toHaveBeenCalledTimes(1)
    expect(status).toEqual({ version: 'version' })
  })

  it('should prepare full status info when verbose is enabled', async () => {
    engine.getOIBusInfo.mockReturnValue({ status: 'status', version: 'version' })
    engine.statusData = { randomStatusData: 'test' }

    const status = await healthSignal.prepareStatus(true)

    expect(engine.getOIBusInfo).toHaveBeenCalledTimes(1)
    expect(status).toEqual({ status: 'status', version: 'version', randomStatusData: 'test' })
  })

  it('should call send http signal', async () => {
    const status = { status: 'status' }

    utils.createProxyAgent.mockImplementation(() => ({ proxyAgent: 'an agent' }))
    healthSignal.prepareStatus = jest.fn()
    healthSignal.prepareStatus.mockReturnValue(status)

    await healthSignal.sendHttpSignal()

    expect(healthSignal.prepareStatus).toBeCalled()
    const calledStatus = JSON.stringify({ ...status })
    const headers = { 'Content-Type': 'application/json' }
    expect(utils.httpSend).toHaveBeenCalledWith(
      `${healthSignal.http.host}${healthSignal.http.endpoint}`,
      'POST',
      headers,
      calledStatus,
      10,
      { proxyAgent: 'an agent' },
    )
    expect(utils.createProxyAgent).toHaveBeenCalledWith('http', 'proxy.host', 666, 'proxy_user', 'proxy_pass')
    expect(healthSignal.logger.debug).toBeCalledWith('HTTP health signal sent successfully.')
  })

  it('should log error if http signal fails', async () => {
    const status = { status: 'status' }

    healthSignal.prepareStatus = jest.fn()
    healthSignal.prepareStatus.mockReturnValue(status)

    utils.httpSend.mockImplementation(() => {
      throw new Error('http error')
    })
    await healthSignal.sendHttpSignal()

    expect(healthSignal.logger.error).toBeCalledWith(new Error('http error'))
  })

  it('should properly stop health signal', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

    healthSignal.stop()
    expect(clearIntervalSpy).not.toHaveBeenCalled()

    healthSignal.httpTimer = () => {}
    healthSignal.loggingTimer = () => {}
    healthSignal.stop()

    expect(clearIntervalSpy).toHaveBeenCalledTimes(2)
  })

  it('should log health signal', () => {
    healthSignal.prepareStatus = jest.fn(() => ({ status: 'status' }))
    healthSignal.sendLoggingSignal()
    expect(healthSignal.logger.info).toHaveBeenCalledWith(JSON.stringify({ status: 'status' }))
    expect(healthSignal.prepareStatus).toHaveBeenCalledTimes(1)
  })

  it('should not forward health signal', async () => {
    const data = { status: 'status' }
    healthSignal.http.enabled = false
    await healthSignal.forwardRequest(data)
    expect(healthSignal.logger.warn).toHaveBeenCalledWith('HTTP health signal is disabled. Cannot forward payload.')
    expect(healthSignal.logger.info).toHaveBeenCalledWith(JSON.stringify(data))
  })

  it('should forward health signal', async () => {
    const data = { status: 'status' }
    healthSignal.http.enabled = true
    await healthSignal.forwardRequest(data)
    expect(healthSignal.logger.trace).toHaveBeenCalledWith(`Forwarding health signal to "${healthSignalSettings.http.host}".`)
    expect(healthSignal.logger.trace).toHaveBeenCalledWith(`Health signal successfully forwarded to "${healthSignalSettings.http.host}".`)
    expect(utils.httpSend).toHaveBeenCalledWith(
      `${healthSignalSettings.http.host}${healthSignalSettings.http.endpoint}`,
      'POST',
      { 'Content-Type': 'application/json' },
      JSON.stringify(data),
      10,
      null,
    )
  })
})
