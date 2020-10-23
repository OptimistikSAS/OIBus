const mqtt = require('mqtt')

const ApiHandler = require('../ApiHandler.class')
const WATSYConnect = require('./WATSYConnect.class')
const config = require('../../../tests/testConfig').default

// Mock logger
jest.mock('../../engine/Logger.class', () => (function logger() {
  return {
    silly: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  }
}))

// Mock engine
const engine = jest.genMockFromModule('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.sendRequest = jest.fn()

beforeEach(() => {
  jest.resetAllMocks()
})


// TODO: Do tests with Jest

