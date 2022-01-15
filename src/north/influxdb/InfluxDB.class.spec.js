const InfluxDB = require('./InfluxDB.class')
const config = require('../../config/defaultConfig.json')
const EncryptionService = require('../../services/EncryptionService.class')

// Mock logger
jest.mock('../../engine/logger/Logger.class')

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock engine
const engine = jest.mock('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.requestService = { httpSend: jest.fn() }
engine.eventEmitters = {}

const timestamp = new Date('2020-02-29T12:12:12Z').toISOString()
const influxDbConfig = {
  password: 'password',
  user: 'user',
  host: 'http://localhost:8086',
  db: 'database',
  precision: 's',
  regExp: '(.*)/(.{2})(.)(.*)',
  measurement: '%1$s',
  tags: 'site=%2$s,unit=%3$s,sensor=%4$s',
  useDataKeyValue: false,
  keyParentValue: '',
}
const values = [
  {
    pointId: 'ANA/BL1RCP05',
    timestamp,
    data: {
      value: 666,
      quality: 'good',
    },
  },
]

beforeEach(async () => {
  jest.resetAllMocks()
  jest.useFakeTimers()
  jest.restoreAllMocks()
})

describe('InfluxDB north', () => {
  it('should call makeRequest from handleValues', async () => {
    const influxDbNorth = new InfluxDB({ InfluxDB: influxDbConfig }, engine)
    await influxDbNorth.init()

    expect(influxDbNorth.canHandleValues)
      .toBeTruthy()
    expect(influxDbNorth.canHandleFiles)
      .toBeFalsy()

    influxDbNorth.makeRequest = jest.fn()

    influxDbNorth.handleValues(values)

    expect(influxDbNorth.makeRequest)
      .toHaveBeenNthCalledWith(1, values)
  })

  it('should call RequestService httpSend() with the proper parameters', async () => {
    const influxDbNorth = new InfluxDB({ InfluxDB: influxDbConfig }, engine)
    await influxDbNorth.init()

    expect(influxDbNorth.canHandleValues)
      .toBeTruthy()
    expect(influxDbNorth.canHandleFiles)
      .toBeFalsy()

    await influxDbNorth.handleValues(values)
  })

  it('should call makeRequest and manage error', async () => {
    const influxDbNorth = new InfluxDB({ InfluxDB: influxDbConfig }, engine)
    await influxDbNorth.init()

    engine.requestService.httpSend = jest.fn(() => Promise.reject(new Error('http error')))

    try {
      await influxDbNorth.handleValues(values)
    } catch {
      expect(influxDbNorth.logger.error).toHaveBeenCalledWith(new Error('http error'))
    }
  })

  it('should log error when there are not enough groups for placeholders in measurement', async () => {
    const testInfluxDbConfig = {
      ...influxDbConfig,
      measurement: '%5$s',
    }
    const influxDbNorth = new InfluxDB({ InfluxDB: testInfluxDbConfig }, engine)
    await influxDbNorth.init()
    await influxDbNorth.handleValues(values)

    const expectedErrorMessage = 'RegExp returned by (.*)/(.{2})(.)(.*) for ANA/BL1RCP05 doesn\'t have enough groups for measurement'
    expect(influxDbNorth.logger.error)
      .toHaveBeenCalledWith(expectedErrorMessage)
  })

  it('should log error when there are not enough groups for placeholders in tags', async () => {
    const testInfluxDbConfig = {
      ...influxDbConfig,
      tags: 'site=%2$s,unit=%3$s,sensor=%5$s',
    }
    const influxDbNorth = new InfluxDB({ InfluxDB: testInfluxDbConfig }, engine)
    await influxDbNorth.init()
    await influxDbNorth.handleValues(values)

    const expectedErrorMessage = 'RegExp returned by (.*)/(.{2})(.)(.*) for ANA/BL1RCP05 doesn\'t have enough groups for tags'
    expect(influxDbNorth.logger.error)
      .toHaveBeenCalledWith(expectedErrorMessage)
  })

  it('should properly handle values with useDataKeyValue', async () => {
    const influxDbNorth = new InfluxDB({ InfluxDB: influxDbConfig }, engine)
    await influxDbNorth.init()

    const valueWithDataLevel = [{
      pointId: 'ANA/BL1RCP05',
      timestamp,
      data: {
        value: { level: { value: 666 } },
        quality: 'good',
      },
    }]

    influxDbNorth.useDataKeyValue = true
    influxDbNorth.keyParentValue = 'level'
    const expectedResult = await influxDbNorth.handleValues(valueWithDataLevel)
    expect(influxDbNorth.engine.requestService.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=s',
      'POST',
      null,
      null,
      'ANA,site=BL,unit=1,sensor=RCP05 value=666 1582978332\n',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
    )
    expect(expectedResult).toBe(1)

    influxDbNorth.precision = 'ns'
    await influxDbNorth.handleValues(valueWithDataLevel)
    expect(influxDbNorth.engine.requestService.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=ns',
      'POST',
      null,
      null,
      'ANA,site=BL,unit=1,sensor=RCP05 value=666 1582978332000000000\n',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
    )

    influxDbNorth.precision = 'u'
    await influxDbNorth.handleValues(valueWithDataLevel)
    expect(influxDbNorth.engine.requestService.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=u',
      'POST',
      null,
      null,
      'ANA,site=BL,unit=1,sensor=RCP05 value=666 1582978332000000\n',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
    )

    influxDbNorth.precision = 'ms'
    await influxDbNorth.handleValues(valueWithDataLevel)
    expect(influxDbNorth.engine.requestService.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=ms',
      'POST',
      null,
      null,
      'ANA,site=BL,unit=1,sensor=RCP05 value=666 1582978332000\n',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
    )

    influxDbNorth.precision = 'm'
    await influxDbNorth.handleValues(valueWithDataLevel)
    expect(influxDbNorth.engine.requestService.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=m',
      'POST',
      null,
      null,
      'ANA,site=BL,unit=1,sensor=RCP05 value=666 26382972\n',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
    )

    influxDbNorth.precision = 'h'
    await influxDbNorth.handleValues(valueWithDataLevel)
    expect(influxDbNorth.engine.requestService.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=h',
      'POST',
      null,
      null,
      'ANA,site=BL,unit=1,sensor=RCP05 value=666 439716\n',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
    )

    influxDbNorth.precision = 'bad'
    await influxDbNorth.handleValues(valueWithDataLevel)
  })
})
