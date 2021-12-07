const path = require('path')
const CsvToHttp = require('./CsvToHttp.class')
const ApiHandler = require('../ApiHandler.class')
const config = require('../../../tests/testConfig').default
const Logger = require('../../engine/Logger.class')
const EncryptionService = require('../../services/EncryptionService.class')

// Mock logger
jest.mock('../../engine/Logger.class')
Logger.getDefaultLogger = () => new Logger()

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock engine
const engine = jest.mock('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.requestService = { httpSend: jest.fn() }
engine.decryptPassword = (password) => password
engine.eventEmitters = {}

// Define the CsvToHttp North
const csvToHttpConfig = config.north.applications[6]
let csvToHttpNorth = null

beforeEach(async () => {
  jest.resetAllMocks()
  jest.clearAllMocks()
  csvToHttpNorth = new CsvToHttp(csvToHttpConfig, engine)
  await csvToHttpNorth.init()
})

describe('CsvToHttp', () => {
  it('should be properly initialized', () => {
    expect(csvToHttpNorth.canHandleValues).toBeFalsy()
    expect(csvToHttpNorth.canHandleFiles).toBeTruthy()
  })

  it('should properly reject file if type is other than csv', async () => {
    const response = await csvToHttpNorth.handleFile('../../../tests/csvToHttpTest')

    expect(response).toEqual(ApiHandler.STATUS.LOGIC_ERROR)
  })

  it('should properly handle csv files', async () => {
    const response = await csvToHttpNorth.handleFile(path.resolve('./tests/csvToHttpTest.csv'))

    expect(response).toEqual(ApiHandler.STATUS.SUCCESS)
  })

  it('should properly test validity of header', async () => {
    const jsonObject = {}

    csvToHttpNorth.mapping.forEach((mapping) => {
      jsonObject[mapping.csvField] = 'testValue'
    })

    let mappingValues = csvToHttpNorth.getOnlyValidMappingValue(jsonObject)

    expect(csvToHttpNorth.mapping.length).toEqual(mappingValues.length)

    csvToHttpNorth.mapping.push(
      {
        csvField: 'unvalid header',
        httpField: 'IdentificationBy template',
        type: 'string',
      },
    )

    csvToHttpNorth.mapping.push(
      {
        // eslint-disable-next-line no-template-curly-in-string
        csvField: '${unvalid header}',
        httpField: 'IdentificationBy template',
        type: 'string',
      },
    )

    mappingValues = csvToHttpNorth.getOnlyValidMappingValue(jsonObject)

    expect(csvToHttpNorth.mapping.length).toBeGreaterThan(mappingValues.length)
  })

  it('should properly handle csv files with template string', async () => {
    csvToHttpNorth.mapping.push({
      // eslint-disable-next-line no-template-curly-in-string
      csvField: '${id}',
      httpField: 'IdentificationBy template',
      type: 'string',
    })
    const response = await csvToHttpNorth.handleFile(path.resolve('./tests/csvToHttpTest.csv'))

    expect(response).toEqual(ApiHandler.STATUS.SUCCESS)
    csvToHttpNorth.mapping.pop()
  })

  it('should properly convert values', async () => {
    let response = CsvToHttp.convertToCorrectType('test', 'string')
    let expectedType = 'string'
    expect(typeof response.value).toEqual(expectedType)

    response = CsvToHttp.convertToCorrectType('1', 'integer')
    expectedType = 'number'
    expect(typeof response.value).toEqual(expectedType)

    response = CsvToHttp.convertToCorrectType('1', 'float')
    expectedType = 'number'
    expect(typeof response.value).toEqual(expectedType)

    response = CsvToHttp.convertToCorrectType('900277200000000000', 'timestamp')
    expectedType = 'number'
    expect(typeof response.value).toEqual(expectedType)

    response = CsvToHttp.convertToCorrectType('1998-07-12', 'date (ISO)')
    expectedType = 'object'
    expect(typeof response.value).toEqual(expectedType)
    expect(response.value).toEqual(new Date('1998-07-12T00:00:00.000Z'))

    response = CsvToHttp.convertToCorrectType('1998-07-12T21:00:00Z', 'date (ISO)')
    expectedType = 'object'
    expect(typeof response.value).toEqual(expectedType)
    expect(response.value).toEqual(new Date('1998-07-12T21:00:00.000Z'))

    response = CsvToHttp.convertToCorrectType('1998-07-12T21:00:00.000Z', 'short date (yyyy-mm-dd)')
    expectedType = 'string'
    expect(typeof response.value).toEqual(expectedType)
    expect(response.value).toEqual('1998-07-12')
  })

  it('should fail to convert wrong values', async () => {
    let response = CsvToHttp.convertToCorrectType('testValue', 'integer')
    expect(response.value).toEqual('testValue')
    expect(response.error.length).toBeGreaterThan(0)

    response = CsvToHttp.convertToCorrectType(null, 'integer')
    expect(response.value).toEqual(null)
    expect(response.error.length).toBeGreaterThan(0)

    response = CsvToHttp.convertToCorrectType('testValue', 'float')
    expect(response.value).toEqual('testValue')
    expect(response.error.length).toBeGreaterThan(0)

    response = CsvToHttp.convertToCorrectType(null, 'float')
    expect(response.value).toEqual(null)
    expect(response.error.length).toBeGreaterThan(0)

    response = CsvToHttp.convertToCorrectType('testValue', 'timestamp')
    expect(response.value).toEqual('testValue')
    expect(response.error.length).toBeGreaterThan(0)

    response = CsvToHttp.convertToCorrectType(null, 'timestamp')
    expect(response.value).toEqual(null)
    expect(response.error.length).toBeGreaterThan(0)

    response = CsvToHttp.convertToCorrectType('testValue', 'date (ISO)')
    expect(response.value).toEqual('testValue')
    expect(response.error.length).toBeGreaterThan(0)

    response = CsvToHttp.convertToCorrectType(null, 'date (ISO)')
    expect(response.value).toEqual(null)
    expect(response.error.length).toBeGreaterThan(0)

    response = CsvToHttp.convertToCorrectType('testValue', 'short date (yyyy-mm-dd)')
    expect(response.value).toEqual('testValue')
    expect(response.error.length).toBeGreaterThan(0)

    response = CsvToHttp.convertToCorrectType(null, 'short date (yyyy-mm-dd)')
    expect(response.value).toEqual(null)
    expect(response.error.length).toBeGreaterThan(0)
  })

  it('should properly convert one row (from a json)', async () => {
    const jsonObject = {}
    const mappingValues = []

    csvToHttpNorth.mapping.forEach((mapping) => {
      jsonObject[mapping.csvField] = 'testValue'
      mappingValues.push(mapping)
    })

    const response = await CsvToHttp.convertCSVRowIntoHttpBody(jsonObject, mappingValues)

    csvToHttpNorth.mapping.forEach((mapping) => {
      expect(response.value[mapping.httpField]).toEqual('testValue')
    })
  })

  it('should properly send data (body.length > bodyMaxLength)', async () => {
    const httpBody = []
    for (let i = 0; i < csvToHttpNorth.bodyMaxLength + 1; i += 1) {
      httpBody.push({ test: 'test' })
    }

    await csvToHttpNorth.sendData(httpBody)

    expect(engine.requestService.httpSend).toHaveBeenCalledTimes(2)
  })

  it('should properly send data (body.length <= bodyMaxLength)', async () => {
    const httpBody = []
    for (let i = 0; i < csvToHttpNorth.bodyMaxLength - 1; i += 1) {
      httpBody.push({ test: 'test' })
    }

    await csvToHttpNorth.sendData(httpBody)

    const expectedUrl = csvToHttpConfig.CsvToHttp.applicativeHostUrl
    const expectedRequestMethod = csvToHttpConfig.CsvToHttp.requestMethod
    const expectedbody = JSON.stringify(httpBody)
    const expectedAuthentication = csvToHttpConfig.CsvToHttp.authentication
    const expectedHeaders = { 'Content-Type': 'application/json' }
    expect(engine.requestService.httpSend).toHaveBeenCalledWith(
      expectedUrl,
      expectedRequestMethod,
      expectedAuthentication,
      null,
      expectedbody,
      expectedHeaders,
    )
    expect(engine.requestService.httpSend).toHaveBeenCalledTimes(1)
  })
})
