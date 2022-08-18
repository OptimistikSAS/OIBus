import { jest } from '@jest/globals'

import fs from 'node:fs/promises'

import Console from './Console.class.js'
import { defaultConfig } from '../../../tests/testConfig.js'

// Spy on console table and info
jest.spyOn(global.console, 'table').mockImplementation(() => {})
jest.spyOn(process.stdout, 'write').mockImplementation(() => {})

// Mock database service
jest.mock('../../services/database.service', () => {})

// Mock logger
jest.mock('../../engine/logger/Logger.class')

// Mock engine
const engine = jest.mock('../../engine/OIBusEngine.class')
engine.configService = { getConfig: () => ({ engineConfig: defaultConfig.engine }) }
engine.eventEmitters = {}

let consoleNorth = null
const timestamp = new Date().toISOString()

beforeEach(async () => {
  jest.resetAllMocks()
  consoleNorth = new Console({ Console: {} }, engine)
  await consoleNorth.init()
})

describe('Console', () => {
  it('should be properly initialized', () => {
    expect(consoleNorth.canHandleFiles).toBeTruthy()
    expect(consoleNorth.canHandleValues).toBeTruthy()
    expect(consoleNorth.verbose).toBeFalsy()
  })

  it('should properly handle values in non verbose mode', async () => {
    const consoleNorthTest = new Console({ Console: { verbose: false } }, engine)
    await consoleNorthTest.init()
    const values = [
      {
        pointId: 'pointId',
        timestamp,
        data: { value: 666, quality: 'good' },
      },
    ]
    consoleNorthTest.handleValues(values)

    expect(process.stdout.write).toBeCalledWith('(1)')
    expect(console.table).not.toHaveBeenCalled()
  })

  it('should properly handle values in verbose mode', async () => {
    const consoleNorthTest = new Console({ Console: { verbose: true } }, engine)
    await consoleNorthTest.init()
    const values = [
      {
        pointId: 'pointId',
        timestamp,
        data: { value: 666, quality: 'good' },
      },
    ]
    consoleNorthTest.handleValues(values)

    expect(console.table).toBeCalledWith(values, ['pointId', 'timestamp', 'data'])
    expect(process.stdout.write).not.toHaveBeenCalled()
  })

  it('should properly handle file', async () => {
    const filePath = '/path/to/file/example.file'
    jest.spyOn(fs, 'stat').mockImplementation(() => Promise.resolve({ size: 666 }))

    await consoleNorth.handleFile(filePath)

    expect(console.table).toBeCalledWith([{ filePath, fileSize: 666 }])
  })
})
