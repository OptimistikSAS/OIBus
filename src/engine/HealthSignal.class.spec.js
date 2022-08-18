import { jest } from '@jest/globals'

import HealthSignal from './HealthSignal.class.js'

// Mocked config
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
    frequency: 300,
    proxy: 'proxy_name',
  },
}
const engineConfig = {
  healthSignal: healthSignalConfig,
  proxies: [proxy],
}

// Mock engine
const engine = jest.mock('./OIBusEngine.class.js')
engine.logger = { error: jest.fn(), debug: jest.fn(), info: jest.fn(), trace: jest.fn() }

beforeEach(() => {
  jest.useFakeTimers()
  engine.configService = { getConfig: () => ({ engineConfig }) }
  engine.getOIBusInfo = jest.fn()
  engine.requestService = { httpSend: jest.fn() }
})

describe('HealthSignal', () => {
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

  it('should properly start when http enabled and call callback function', () => {
    const healthSignal = new HealthSignal(engine)
    const callback = jest.spyOn(healthSignal, 'sendHttpSignal').mockImplementation(() => ({ }))
    healthSignal.http.enabled = true
    healthSignal.logging.enabled = true
    healthSignal.start()

    jest.advanceTimersByTime(1000 * healthSignalConfig.http.frequency)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should properly start when disabled', () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
    const healthSignal = new HealthSignal(engine)
    healthSignal.http.enabled = false
    healthSignal.logging.enabled = false
    healthSignal.start()

    expect(setTimeoutSpy).not.toBeCalled()
  })

  it('should prepare simple status info when verbose is not enabled', async () => {
    const healthSignal = new HealthSignal(engine)
    engine.getOIBusInfo.mockReturnValue({ version: 'version' })
    engine.statusData = { randomStatusData: 'test' }

    const status = await healthSignal.prepareStatus(false)

    expect(engine.getOIBusInfo).toHaveBeenCalledTimes(1)
    expect(status).toEqual({ version: 'version' })
  })

  it('should prepare full status info when verbose is enabled', async () => {
    const healthSignal = new HealthSignal(engine)
    engine.getOIBusInfo.mockReturnValue({ status: 'status', version: 'version' })
    engine.statusData = { randomStatusData: 'test' }

    const status = await healthSignal.prepareStatus(true)

    expect(engine.getOIBusInfo).toHaveBeenCalledTimes(1)
    expect(status).toEqual({ status: 'status', version: 'version', randomStatusData: 'test' })
  })

  it('should call RequestService httpSend()', async () => {
    const status = { status: 'status' }

    const healthSignal = new HealthSignal(engine)

    healthSignal.prepareStatus = jest.fn()
    healthSignal.prepareStatus.mockReturnValue(status)

    await healthSignal.sendHttpSignal()

    expect(healthSignal.logger.trace).toBeCalledWith('sendHttpSignal')
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
  })

  it('should properly stop when enabled', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval')
    const healthSignal = new HealthSignal(engine)
    healthSignal.http.enabled = true
    healthSignal.start()
    healthSignal.httpTimer = () => {}
    healthSignal.stop()

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1)
  })

  it('should properly stop when disabled', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval')
    const healthSignal = new HealthSignal(engine)
    healthSignal.http.enabled = false
    healthSignal.start()
    healthSignal.stop()

    expect(clearIntervalSpy).not.toBeCalled()
  })
})
