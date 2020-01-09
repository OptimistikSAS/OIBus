const fs = require('fs')
const Console = require('./Console.class')
const config = require('../../config/defaultConfig.json')

// Mock nodejs fs api
jest.mock('fs')

// Spy on console table
jest.spyOn(global.console, 'table').mockImplementation(() => {})

// Mock database service
jest.mock('../../services/database.service', () => {})

// Mock logger
jest.mock('../../engine/Logger.class', () => (function logger() {
  return { silly: () => jest.fn() }
}))

// Mock engine
const engine = jest.genMockFromModule('../../engine/Engine.class')
engine.configService = { getConfig: () => config.engine }

beforeEach(() => {
  jest.resetAllMocks()
})

describe('Console north', () => {
  const consoleNorth = new Console({}, engine)
  const timestamp = new Date().toISOString()

  it('should be properly initialized', () => {
    expect(consoleNorth.canHandleFiles).toBeTruthy()
    expect(consoleNorth.canHandleFiles).toBeTruthy()
  })

  it('should properly handle values', () => {
    const values = [
      {
        pointId: 'pointId',
        timestamp,
        data: { value: 666, quality: 'good' },
      },
    ]
    consoleNorth.handleValues(values)

    expect(console.table).toBeCalledWith(values, ['pointId', 'timestamp', 'data'])
  })

  it('should properly handle file', () => {
    const filePath = '/path/to/file/example.file'

    fs.statSync.mockReturnValue({ size: 666 })

    consoleNorth.handleFile(filePath)

    expect(console.table).toBeCalledWith([{ filePath, fileSize: 666 }])
  })
})
