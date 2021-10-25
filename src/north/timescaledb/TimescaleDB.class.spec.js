const { Client } = require('pg')

const ApiHandler = require('../ApiHandler.class')
const TimescaleDB = require('./TimescaleDB.class')
const config = require('../../../tests/testConfig').default
const EncryptionService = require('../../services/EncryptionService.class')

// Mock logger
jest.mock('../../engine/logger/Logger.class')

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock engine
const engine = jest.mock('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.logger = { error: jest.fn(), info: jest.fn(), silly: jest.fn() }
engine.eventEmitters = {}

jest.mock('pg', () => ({ Client: jest.fn() }))

const timescaleDbConfig = config.north.applications[4]
const timestamp = new Date('2020-02-29T12:12:12Z').toISOString()
const values = [
  {
    pointId: 'ANA/BL1RCP05',
    timestamp,
    data: { value: 666, quality: 'good' },
  },
]
beforeEach(() => {
  jest.resetAllMocks()
  jest.useFakeTimers()
  jest.restoreAllMocks()
})

describe('TimescaleDB north', () => {
  it('should be properly initialized', () => {
    const timescaleDbNorth = new TimescaleDB(timescaleDbConfig, engine)
    expect(timescaleDbNorth.canHandleValues).toBeTruthy()
    expect(timescaleDbNorth.canHandleFiles).toBeFalsy()
  })

  it('should properly handle values and publish them', async () => {
    const timescaleDbNorth = new TimescaleDB(timescaleDbConfig, engine)
    const client = {
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
    }
    Client.mockReturnValue(client)

    let expectedResult = null
    let expectedError = null
    try {
      expectedResult = await timescaleDbNorth.handleValues(values)
    } catch (error) {
      expectedError = error
    }
    const expectedUrl = `postgres://${timescaleDbConfig.TimescaleDB.user}:${timescaleDbConfig.TimescaleDB.password}`
      + `@${timescaleDbConfig.TimescaleDB.host}/${timescaleDbConfig.TimescaleDB.db}`
    const expectedQuery = 'BEGIN;'
      + 'insert into oibus_test(BL1RCP05,value,quality,created_at) values(\'BL1RCP05\',\'666\',\'good\',\'2020-02-29T12:12:12.000Z\');'
      + 'COMMIT'

    expect(Client).toBeCalledWith(expectedUrl)
    expect(expectedResult).toEqual(values.length)
    expect(expectedError).toBeNull()
    expect(client.connect).toBeCalledTimes(1)
    expect(client.query).toBeCalledWith(expectedQuery)
    expect(client.end).toBeCalledTimes(1)
  })

  it('should properly handle values with publish error', async () => {
    const timescaleDbNorth = new TimescaleDB(timescaleDbConfig, engine)
    const client = {
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
    }
    client.connect.mockImplementation(() => {
      throw new Error()
    })
    Client.mockReturnValue(client)

    let expectedResult = null
    let expectedError = null
    try {
      expectedResult = await timescaleDbNorth.handleValues(values)
    } catch (error) {
      expectedError = error
    }

    expect(expectedResult).toBeNull()
    expect(expectedError).toEqual(ApiHandler.STATUS.COMMUNICATION_ERROR)
  })
})
