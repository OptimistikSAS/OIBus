const fs = require('fs')
const Console = require('./Console.class')
const config = require('../../config/defaultConfig.json')

// Spy on console table and info
jest.spyOn(global.console, 'table').mockImplementation(() => {})
jest.spyOn(process.stdout, 'write').mockImplementation(() => {})

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
  const timestamp = new Date().toISOString()

  it('should be properly initialized', () => {
    const consoleNorth = new Console({ Console: {} }, engine)

    expect(consoleNorth.canHandleFiles).toBeTruthy()
    expect(consoleNorth.canHandleFiles).toBeTruthy()
    expect(consoleNorth.verbose).toBeFalsy()
  })

  it('should properly handle values in non verbose mode', () => {
    const consoleNorth = new Console({ Console: { verbose: false } }, engine)
    const values = [
      {
        pointId: 'pointId',
        timestamp,
        data: { value: 666, quality: 'good' },
      },
    ]
    consoleNorth.handleValues(values)

    expect(process.stdout.write).toBeCalledWith('(1)')
    expect(console.table).not.toHaveBeenCalled()
  })

  it('should properly handle values in verbose mode', () => {
    const consoleNorth = new Console({ Console: { verbose: true } }, engine)
    const values = [
      {
        pointId: 'pointId',
        timestamp,
        data: { value: 666, quality: 'good' },
      },
    ]
    consoleNorth.handleValues(values)

    expect(console.table).toBeCalledWith(values, ['pointId', 'timestamp', 'data'])
    expect(process.stdout.write).not.toHaveBeenCalled()
  })

  it('should properly handle file', () => {
    const consoleNorth = new Console({ Console: {} }, engine)
    const filePath = '/path/to/file/example.file'
    jest.spyOn(fs, 'statSync').mockImplementation(() => ({ size: 666 }))

    consoleNorth.handleFile(filePath)

    expect(console.table).toBeCalledWith([{ filePath, fileSize: 666 }])
  })
})
