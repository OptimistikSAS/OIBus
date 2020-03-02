const InfluxDB = require('./InfluxDB.class')
const config = require('../../config/defaultConfig.json')

// Mock logger
jest.mock('../../engine/Logger.class', () => (function logger() {
  return {
    silly: () => jest.fn(),
    debug: () => jest.fn(),
    info: () => jest.fn(),
    error: () => jest.fn(),
  }
}))

// Mock engine
const engine = jest.genMockFromModule('../../engine/Engine.class')
engine.configService = { getConfig: () => config.engine }
engine.decryptPassword = (password) => password
engine.sendRequest = jest.fn()

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
    measurement: '%1',
    tags: 'site=%2,unit=%3,sensor=%4',
  }

  it('should be properly initialized', () => {
    const influxDbNorth = new InfluxDB({ InfluxDB: influxDbConfig }, engine)

    expect(influxDbNorth.canHandleValues).toBeTruthy()
    expect(influxDbNorth.canHandleFiles).toBeFalsy()
  })

  it('should call makeRequest from handleValues', () => {
    const influxDbNorth = new InfluxDB({ InfluxDB: influxDbConfig }, engine)
    influxDbNorth.makeRequest = jest.fn()

    const values = [
      {
        pointId: 'ANA/BL1RCP05`',
        timestamp,
        data: { value: 666, quality: 'good' },
      },
    ]
    influxDbNorth.handleValues(values)

    expect(influxDbNorth.makeRequest).toHaveBeenNthCalledWith(1, values)
  })

  it('should call fetch from makeRequest with the proper parameters', async () => {
    const influxDbNorth = new InfluxDB({ InfluxDB: influxDbConfig }, engine)

    const values = [
      {
        pointId: 'ANA/BL1RCP05',
        timestamp,
        data: { value: 666, quality: 'good' },
      },
    ]
    await influxDbNorth.handleValues(values)

    const expectedUrl = 'http://localhost:8086/write?u=user&p=password&db=database&precision=s'
    const expectedHeaders = { 'Content-Type': 'application/x-www-form-urlencoded' }
    const expectedBody = 'ANA,site=BL,unit=1,sensor=RCP05 value=666,quality=good 1582978332\n'
    const expectedMethod = 'POST'
    expect(engine.sendRequest).toHaveBeenCalledTimes(1)
    expect(engine.sendRequest).toHaveBeenCalledWith(expectedUrl, expectedMethod, null, null, expectedBody, expectedHeaders)
  })
})
