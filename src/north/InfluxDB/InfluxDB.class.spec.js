const InfluxDB = require('./InfluxDB.class')

const { defaultConfig: config } = require('../../../tests/testConfig')

// Mock OIBusEngine
const engine = {
  configService: { getConfig: () => ({ engineConfig: config.engine }) },
  requestService: { httpSend: jest.fn() },
  getCacheFolder: jest.fn(),
}

// Mock services
jest.mock('../../services/database.service')
jest.mock('../../engine/logger/Logger.class')
jest.mock('../../services/status.service.class')
jest.mock('../../services/EncryptionService.class', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))
jest.mock('../../engine/cache/ValueCache.class')
jest.mock('../../engine/cache/FileCache.class')

const nowDateString = '2020-02-02T02:02:02.222Z'
const values = [
  {
    pointId: 'ANA/BL1RCP05',
    timestamp: new Date(nowDateString),
    data: {
      value: 666,
      quality: 'good',
    },
  },
]
let settings = null
let north = null

describe('North InfluxDB', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    settings = {
      id: 'northId',
      name: 'influx',
      InfluxDB: {
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
        timestampPathInDataValue: '',
      },
      caching: { sendInterval: 1000 },
    }
    north = new InfluxDB(settings, engine)
  })

  it('should call makeRequest and manage error', async () => {
    await north.init()

    engine.requestService.httpSend = jest.fn(() => Promise.reject(new Error('http error')))

    await expect(north.handleValues(values)).rejects.toThrowError('http error')
  })

  it('should log error when there are not enough groups for placeholders in measurement', async () => {
    await north.init()
    north.measurement = '%5$s'

    await north.handleValues(values)
    const expectedErrorMessage = 'RegExp returned by (.*)/(.{2})(.)(.*) for ANA/BL1RCP05 doesn\'t have enough groups for the measurement.'
    await expect(north.logger.error).toHaveBeenCalledWith(expectedErrorMessage)
  })

  it('should log error when there are not enough groups for placeholders in tags', async () => {
    await north.init()
    north.tags = 'site=%2$s,unit=%3$s,sensor=%5$s'
    await north.handleValues(values)
    const expectedErrorMessage = 'RegExp returned by (.*)/(.{2})(.)(.*) for ANA/BL1RCP05 doesn\'t have enough groups for tags.'
    expect(north.logger.error).toHaveBeenCalledWith(expectedErrorMessage)
  })

  it('should properly handle values with useDataKeyValue', async () => {
    await north.init()

    const valueWithDataLevel = [{
      pointId: 'ANA/BL1RCP05',
      timestamp: new Date(nowDateString),
      data: {
        value: { level: { value: 666 } },
        quality: 'good',
      },
    }]

    north.useDataKeyValue = true
    north.keyParentValue = 'level'
    await north.handleValues(valueWithDataLevel)
    expect(north.engine.requestService.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=s',
      'POST',
      null,
      null,
      'ANA,site=BL,unit=1,sensor=RCP05 value=666 1580608922\n',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
    )

    north.precision = 'ns'
    await north.handleValues(valueWithDataLevel)
    expect(north.engine.requestService.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=ns',
      'POST',
      null,
      null,
      'ANA,site=BL,unit=1,sensor=RCP05 value=666 1580608922222000000\n',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
    )

    north.precision = 'u'
    await north.handleValues(valueWithDataLevel)
    expect(north.engine.requestService.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=u',
      'POST',
      null,
      null,
      'ANA,site=BL,unit=1,sensor=RCP05 value=666 1580608922222000\n',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
    )

    north.precision = 'ms'
    await north.handleValues(valueWithDataLevel)
    expect(north.engine.requestService.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=ms',
      'POST',
      null,
      null,
      'ANA,site=BL,unit=1,sensor=RCP05 value=666 1580608922222\n',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
    )

    north.precision = 'm'
    await north.handleValues(valueWithDataLevel)
    expect(north.engine.requestService.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=m',
      'POST',
      null,
      null,
      'ANA,site=BL,unit=1,sensor=RCP05 value=666 26343482\n',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
    )

    north.precision = 'h'
    await north.handleValues(valueWithDataLevel)
    expect(north.engine.requestService.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=h',
      'POST',
      null,
      null,
      'ANA,site=BL,unit=1,sensor=RCP05 value=666 439058\n',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
    )

    north.precision = 'bad'
    await north.handleValues(valueWithDataLevel)
  })

  it('should properly retrieve timestamp with timestampPathInDataValue', async () => {
    await north.init()

    north.timestampPathInDataValue = 'associatedTimestamp.timestamp'
    north.useDataKeyValue = true

    const valuesWithTimestamp = [
      {
        pointId: 'ANA/BL1RCP05',
        data: {
          value: { numericValue: 555, anotherNumericValue: 444, associatedTimestamp: { timestamp: new Date(nowDateString) } },
          quality: 'good',
        },
      },
      {
        pointId: 'ANA/BL1RCP06',
        data: {
          value: { numericValue: '666', associatedTimestamp: { timestamp: new Date(nowDateString) } },
          quality: 'good',
        },
      },
      {
        pointId: 'ANA/BL1RCP07',
        data: {
          value: { numericValue: '777', associatedTimestamp: { timestamp: new Date(nowDateString) } },
          quality: 'good',
        },
      },
      {
        pointId: 'ANA/BL1RCP08',
        data: {
          value: { numericValue: 888, associatedTimestamp: { timestamp: new Date(nowDateString) } },
          quality: 'good',
        },
      },
    ]

    await north.handleValues(valuesWithTimestamp)

    expect(engine.requestService.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=s',
      'POST',
      null,
      null,
      'ANA,site=BL,unit=1,sensor=RCP05 numericValue=555,anotherNumericValue=444 1580608922\n'
        + 'ANA,site=BL,unit=1,sensor=RCP06 numericValue="666" 1580608922\n'
        + 'ANA,site=BL,unit=1,sensor=RCP07 numericValue="777" 1580608922\n'
        + 'ANA,site=BL,unit=1,sensor=RCP08 numericValue=888 1580608922\n',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
    )

    const valuesWithTimestamp2 = [
      {
        pointId: 'ANA/BL1RCP06',
        data: {
          value: { numericValue: '666', associatedTimestamp: { timestamp: new Date(nowDateString) } },
          quality: 'good',
        },
      },
      {
        pointId: 'ANA/BL1RCP05',
        data: {
          value: { numericValue: 555, unit: 'unit2', associatedTimestamp: { timestamp: new Date(nowDateString) } },
          quality: 'good',
        },
      },
      {
        pointId: 'ANA/BL1RCP07',
        data: {
          value: { numericValue: '777', unit: 'unit2', associatedTimestamp: { timestamp: new Date(nowDateString) } },
          quality: 'good',
        },
      },
      {
        pointId: 'ANA/BL1RCP08',
        data: {
          value: { numericValue: 888, unit: 'unit2', associatedTimestamp: { timestamp: new Date(nowDateString) } },
          quality: 'good',
        },
      },
    ]

    // unit should be ignored
    await north.handleValues(valuesWithTimestamp2)

    expect(engine.requestService.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=s',
      'POST',
      null,
      null,
      'ANA,site=BL,unit=1,sensor=RCP06 numericValue="666" 1580608922\n'
        + 'ANA,site=BL,unit=1,sensor=RCP05 numericValue=555 1580608922\n'
        + 'ANA,site=BL,unit=1,sensor=RCP07 numericValue="777" 1580608922\n'
        + 'ANA,site=BL,unit=1,sensor=RCP08 numericValue=888 1580608922\n',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
    )
  })
})
