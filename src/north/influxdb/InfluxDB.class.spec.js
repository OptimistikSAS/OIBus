const fetch = require('node-fetch')
const InfluxDB = require('./InfluxDB.class')
const config = require('../../config/defaultConfig.json')

// Mock node-fetch
jest.mock('node-fetch')
const { Response } = jest.requireActual('node-fetch')

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
    fetch.mockReturnValue(Promise.resolve(new Response('Ok')))

    const values = [
      {
        pointId: 'ANA/BL1RCP05',
        timestamp,
        data: { value: 666, quality: 'good' },
      },
    ]
    await influxDbNorth.handleValues(values)

    expect(fetch).toHaveBeenCalledTimes(1)
    const expectedUrl = 'http://localhost:8086/write?u=user&p=password&db=database&precision=s'
    const expectedOptions = {
      body: 'ANA,site=BL,unit=1,sensor=RCP05 value=666,quality=good 1582978332\n',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    }
    expect(fetch).toHaveBeenCalledWith(expectedUrl, expectedOptions)
  })
})
