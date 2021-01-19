const FileWriter = require('./FileWriter.class')
// const config = require('../../config/defaultConfig.json')
const config = require('../../../tests/testConfig').default

// Mock database service
jest.mock('../../services/database.service', () => {})

// Mock logger
jest.mock('../../engine/Logger.class')

// Mock engine
const engine = jest.genMockFromModule('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }

beforeEach(() => {
  jest.resetAllMocks()
})

describe('FileWriter north', () => {
  it('should be properly initialized', () => {
    const fileWriterNorth = new FileWriter(config.north.applications[7], engine)

    expect(fileWriterNorth.canHandleFiles).toBeTruthy()
    expect(fileWriterNorth.canHandleValues).toBeTruthy()
    expect(fileWriterNorth.prefixFileName).toBe('')
    expect(fileWriterNorth.suffixFileName).toBe('')
  })
})
