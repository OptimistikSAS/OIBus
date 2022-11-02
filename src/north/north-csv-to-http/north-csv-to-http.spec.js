const CsvToHttp = require('./north-csv-to-http')

const utils = require('./utils')
const serviceUtils = require('../../service/utils')

// Mock utils class
jest.mock('./utils', () => ({
  convertCSVRowIntoHttpBody: jest.fn(),
  isHeaderValid: jest.fn(),
}))

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

let configuration = null
let north = null

describe('NorthCsvToHttp', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers()

    utils.isHeaderValid.mockReturnValue(true)

    configuration = {
      id: 'northId',
      name: 'CsvToHttp',
      type: 'CsvToHttp',
      enabled: false,
      settings: {
        applicativeHostUrl: 'https://localhost.com',
        requestMethod: 'POST',
        proxy: '',
        mapping: [
          {
            csvField: 'Id',
            httpField: 'Identification',
            type: 'integer',
          },
          {
            csvField: 'Begin',
            httpField: 'date',
            type: 'short date (yyyy-mm-dd)',
          },
        ],
        authentication: {
          type: 'API Key',
          secretKey: 'anytoken',
          key: 'anyvalue',
        },
        acceptUnconvertedRows: false,
        bodyMaxLength: 100,
        csvDelimiter: ';',
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
      subscribedTo: [],
    }
    north = new CsvToHttp(configuration, [])
  })

  it('should be properly initialized', async () => {
    await north.start('baseFolder', 'oibusName', {})

    expect(north.canHandleValues).toBeFalsy()
    expect(north.canHandleFiles).toBeTruthy()
  })

  it('should properly reject file if type is other than csv', async () => {
    await north.start('baseFolder', 'oibusName', {})

    await expect(north.handleFile('filePath')).rejects
      .toThrowError('Invalid file format: .csv file expected. File "filePath" skipped.')
  })

  it('should properly handle csv files', async () => {
    utils.convertCSVRowIntoHttpBody.mockReturnValue({
      value: 'value',
      error: null,
    })
    north.parseCsvFile = jest.fn()
    north.parseCsvFile.mockReturnValue([
      ['Id', 'Begin'],
      ['1', '2020-12-17 01:00'],
      ['2', '2020-12-17 02:00'],
      ['3', '2020-12-17 03:00'],
      ['4', '2020-12-17 04:00'],
      ['5', '2020-12-17 05:00'],
    ])

    await north.start('baseFolder', 'oibusName', {})

    await north.handleFile('csvToHttpTest.csv')

    expect(serviceUtils.httpSend).toHaveBeenCalledTimes(1)
  })

  it('should properly test validity of header', async () => {
    await north.start('baseFolder', 'oibusName', {})

    const jsonObject = {}

    north.mapping.forEach((mapping) => {
      jsonObject[mapping.csvField] = 'testValue'
    })

    const mappingValues = north.getOnlyValidMappingValue(jsonObject)

    expect(north.mapping.length).toEqual(mappingValues.length)
  })

  it('should properly send data (body.length > bodyMaxLength)', async () => {
    const httpBody = []
    for (let i = 0; i < north.bodyMaxLength + 1; i += 1) {
      httpBody.push({ test: 'test' })
    }

    await north.sendData(httpBody)

    expect(serviceUtils.httpSend).toHaveBeenCalledTimes(2)
  })

  it('should properly send data (body.length <= bodyMaxLength)', async () => {
    await north.start('baseFolder', 'oibusName', {})

    const httpBody = []
    for (let i = 0; i < north.bodyMaxLength - 1; i += 1) {
      httpBody.push({ test: 'test' })
    }

    await north.sendData(httpBody)

    const expectedUrl = configuration.settings.applicativeHostUrl
    const expectedRequestMethod = configuration.settings.requestMethod
    const expectedBody = JSON.stringify(httpBody)
    const expectedHeaders = { 'Content-Type': 'application/json' }
    expect(serviceUtils.httpSend).toHaveBeenCalledWith(
      expectedUrl,
      expectedRequestMethod,
      expectedHeaders,
      expectedBody,
      configuration.caching.timeout,
      null,
    )
    expect(serviceUtils.httpSend).toHaveBeenCalledTimes(1)
  })
})
