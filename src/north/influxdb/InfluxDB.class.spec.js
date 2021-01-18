const InfluxDB = require('./InfluxDB.class')
const config = require('../../config/defaultConfig.json')
const EncryptionService = require('../../services/EncryptionService.class')

// Mock logger
jest.mock('../../engine/Logger.class')

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock engine
const engine = jest.genMockFromModule('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.requestService = { send: jest.fn() }

beforeEach(() => {
  jest.resetAllMocks()
})

describe('InfluxDB north', () => {
  const timestamp = new Date('2020-02-29 12:12:12').toISOString()
  const influxDbConfig = {
    password: 'password',
    user: 'user',
    host: 'http://localhost:8086',
    db: 'database',
    precision: 's',
    regExp: '(.*)/(.{2})(.)(.*)',
    measurement: '%1$s',
    tags: 'site=%2$s,unit=%3$s,sensor=%4$s',
  }
  const values = [
    {
      pointId: 'ANA/BL1RCP05',
      timestamp,
      data: { value: 666, quality: 'good' },
    },
  ]

  it('should be properly initialized', () => {
    const influxDbNorth = new InfluxDB({ InfluxDB: influxDbConfig }, engine)

    expect(influxDbNorth.canHandleValues).toBeTruthy()
    expect(influxDbNorth.canHandleFiles).toBeFalsy()
  })

  it('should call makeRequest from handleValues', () => {
    const influxDbNorth = new InfluxDB({ InfluxDB: influxDbConfig }, engine)
    influxDbNorth.makeRequest = jest.fn()

    influxDbNorth.handleValues(values)

    expect(influxDbNorth.makeRequest).toHaveBeenNthCalledWith(1, values)
  })

  it('should call Engine\'s sendRequest() with the proper parameters', async () => {
    const influxDbNorth = new InfluxDB({ InfluxDB: influxDbConfig }, engine)

    await influxDbNorth.handleValues(values)

    const expectedUrl = 'http://localhost:8086/write?u=user&p=password&db=database&precision=s'
    const expectedHeaders = { 'Content-Type': 'application/x-www-form-urlencoded' }
    const expectedBody = 'ANA,site=BL,unit=1,sensor=RCP05 value=666,quality="good" 1582978332\n'
    const expectedMethod = 'POST'
    expect(engine.requestService.send).toHaveBeenCalledTimes(1)
    expect(engine.requestService.send).toHaveBeenCalledWith(expectedUrl, expectedMethod, null, null, expectedBody, expectedHeaders)
  })

  it('should log error when there are not enough groups for placeholders in measurement', async () => {
    const testInfluxDbConfig = {
      ...influxDbConfig,
      measurement: '%5$s',
    }
    const influxDbNorth = new InfluxDB({ InfluxDB: testInfluxDbConfig }, engine)

    await influxDbNorth.handleValues(values)

    const expectedErrorMessage = 'RegExp returned by (.*)/(.{2})(.)(.*) for ANA/BL1RCP05 doesn\'t have enough groups for measurement'
    expect(influxDbNorth.logger.error).toHaveBeenCalledWith(expectedErrorMessage)
  })

  it('should log error when there are not enough groups for placeholders in tags', async () => {
    const testInfluxDbConfig = {
      ...influxDbConfig,
      tags: 'site=%2$s,unit=%3$s,sensor=%5$s',
    }
    const influxDbNorth = new InfluxDB({ InfluxDB: testInfluxDbConfig }, engine)

    await influxDbNorth.handleValues(values)

    const expectedErrorMessage = 'RegExp returned by (.*)/(.{2})(.)(.*) for ANA/BL1RCP05 doesn\'t have enough groups for tags'
    expect(influxDbNorth.logger.error).toHaveBeenCalledWith(expectedErrorMessage)
  })
})
