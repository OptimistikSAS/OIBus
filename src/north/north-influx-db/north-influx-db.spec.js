const InfluxDB = require('./north-influx-db')

const httpRequestStaticFunctions = require('../../service/http-request-static-functions')
// Mock fs
jest.mock('node:fs/promises')

// Mock services
jest.mock('../../service/database.service')
jest.mock('../../service/logger/logger.service')
jest.mock('../../service/status.service')
jest.mock('../../service/certificate.service')
jest.mock('../../service/encryption.service', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))
jest.mock('../../engine/cache/value-cache')
jest.mock('../../engine/cache/file-cache')
jest.mock('../../service/utils')
jest.mock('../../service/http-request-static-functions')

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
let configuration = null
let north = null

describe('North InfluxDB', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    configuration = {
      id: 'northId',
      name: 'influx',
      settings: {
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
      caching: {
        sendInterval: 1000,
        retryInterval: 5000,
        groupCount: 10000,
        maxSendCount: 10000,
        timeout: 10,
        archive: {
          enabled: true,
          retentionDuration: 720,
        },
      },
    }
    north = new InfluxDB(configuration, [])
  })

  it('should call makeRequest and manage error', async () => {
    await north.start('baseFolder', 'oibusName', {})

    httpRequestStaticFunctions.httpSend.mockImplementation(() => {
      throw new Error('http error')
    })

    let error
    try {
      await north.handleValues(values)
    } catch (err) {
      error = err
    }
    expect(error).toEqual(new Error('http error'))
  })

  it('should log error when there are not enough groups for placeholders in measurement', async () => {
    await north.start('baseFolder', 'oibusName', {})

    north.measurement = '%5$s'

    await north.handleValues(values)
    const expectedErrorMessage = 'RegExp returned by (.*)/(.{2})(.)(.*) for ANA/BL1RCP05 doesn\'t have enough groups for the measurement.'
    await expect(north.logger.error).toHaveBeenCalledWith(expectedErrorMessage)
  })

  it('should log error when there are not enough groups for placeholders in tags', async () => {
    await north.start('baseFolder', 'oibusName', {})

    north.tags = 'site=%2$s,unit=%3$s,sensor=%5$s'
    await north.handleValues(values)
    const expectedErrorMessage = 'RegExp returned by (.*)/(.{2})(.)(.*) for ANA/BL1RCP05 doesn\'t have enough groups for tags.'
    expect(north.logger.error).toHaveBeenCalledWith(expectedErrorMessage)
  })

  it('should properly handle values with useDataKeyValue', async () => {
    await north.start('baseFolder', 'oibusName', {})

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
    expect(httpRequestStaticFunctions.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=s',
      'POST',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      'ANA,site=BL,unit=1,sensor=RCP05 value=666 1580608922\n',
      10,
      null,
    )

    north.precision = 'ns'
    await north.handleValues(valueWithDataLevel)
    expect(httpRequestStaticFunctions.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=ns',
      'POST',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      'ANA,site=BL,unit=1,sensor=RCP05 value=666 1580608922222000000\n',
      10,
      null,
    )

    north.precision = 'u'
    await north.handleValues(valueWithDataLevel)
    expect(httpRequestStaticFunctions.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=u',
      'POST',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      'ANA,site=BL,unit=1,sensor=RCP05 value=666 1580608922222000\n',
      10,
      null,
    )

    north.precision = 'ms'
    await north.handleValues(valueWithDataLevel)
    expect(httpRequestStaticFunctions.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=ms',
      'POST',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      'ANA,site=BL,unit=1,sensor=RCP05 value=666 1580608922222\n',
      10,
      null,
    )

    north.precision = 'm'
    await north.handleValues(valueWithDataLevel)
    expect(httpRequestStaticFunctions.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=m',
      'POST',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      'ANA,site=BL,unit=1,sensor=RCP05 value=666 26343482\n',
      10,
      null,
    )

    north.precision = 'h'
    await north.handleValues(valueWithDataLevel)
    expect(httpRequestStaticFunctions.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=h',
      'POST',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      'ANA,site=BL,unit=1,sensor=RCP05 value=666 439058\n',
      10,
      null,
    )

    north.precision = 'bad'
    await north.handleValues(valueWithDataLevel)
  })

  it('should properly retrieve timestamp with timestampPathInDataValue', async () => {
    await north.start('baseFolder', 'oibusName', {})

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

    expect(httpRequestStaticFunctions.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=s',
      'POST',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      'ANA,site=BL,unit=1,sensor=RCP05 numericValue=555,anotherNumericValue=444 1580608922\n'
        + 'ANA,site=BL,unit=1,sensor=RCP06 numericValue="666" 1580608922\n'
        + 'ANA,site=BL,unit=1,sensor=RCP07 numericValue="777" 1580608922\n'
        + 'ANA,site=BL,unit=1,sensor=RCP08 numericValue=888 1580608922\n',
      10,
      null,
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

    expect(httpRequestStaticFunctions.httpSend).toHaveBeenCalledWith(
      'http://localhost:8086/write?u=user&p=password&db=database&precision=s',
      'POST',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      'ANA,site=BL,unit=1,sensor=RCP06 numericValue="666" 1580608922\n'
        + 'ANA,site=BL,unit=1,sensor=RCP05 numericValue=555 1580608922\n'
        + 'ANA,site=BL,unit=1,sensor=RCP07 numericValue="777" 1580608922\n'
        + 'ANA,site=BL,unit=1,sensor=RCP08 numericValue=888 1580608922\n',
      10,
      null,
    )
  })
})
