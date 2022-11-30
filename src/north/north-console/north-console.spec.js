import fs from 'node:fs/promises'

import Console from './north-console.js'

// Spy on console table and info
jest.spyOn(global.console, 'table').mockImplementation(() => {})
jest.spyOn(process.stdout, 'write').mockImplementation(() => {})

// Mock fs
jest.mock('node:fs/promises')

// Mock services
jest.mock('../../service/database.service')
jest.mock('../../service/status.service')
jest.mock('../../service/certificate.service')
jest.mock('../../service/encryption.service', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))
jest.mock('../../service/cache/value-cache.service')
jest.mock('../../service/cache/file-cache.service')
jest.mock('../../service/cache/archive.service')

// Mock logger
const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
}

const nowDateString = '2020-02-02T02:02:02.222Z'
let configuration = null
let north = null

describe('North Console', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    configuration = {
      settings: { verbose: false },
      caching: {
        sendInterval: 1000,
        retryInterval: 5000,
        groupCount: 10000,
        maxSendCount: 10000,
        archive: {
          enabled: true,
          retentionDuration: 720,
        },
      },
    }
    north = new Console(configuration, [], logger)
    await north.start('baseFolder', 'oibusName')
  })

  it('should be properly initialized', () => {
    expect(north.canHandleFiles).toBeTruthy()
    expect(north.canHandleValues).toBeTruthy()
    expect(north.verbose).toBeFalsy()
  })

  it('should properly handle values in non verbose mode', async () => {
    await north.start('baseFolder', 'oibusName', {})
    const values = [
      {
        pointId: 'pointId',
        timestamp: nowDateString,
        data: { value: 666, quality: 'good' },
      },
    ]
    await north.handleValues(values)

    expect(process.stdout.write).toHaveBeenCalledWith('North Console sent 1 values.\r\n')
    expect(console.table).not.toHaveBeenCalled()
  })

  it('should properly handle values in verbose mode', async () => {
    north.verbose = true
    const values = [
      {
        pointId: 'pointId',
        timestamp: nowDateString,
        data: { value: 666, quality: 'good' },
      },
    ]
    await north.handleValues(values)

    expect(console.table).toHaveBeenCalledWith(values, ['pointId', 'timestamp', 'data'])
    expect(process.stdout.write).not.toHaveBeenCalled()
  })

  it('should properly handle file', async () => {
    const filePath = '/path/to/file/example.file'

    await north.handleFile(filePath)

    expect(fs.stat).toHaveBeenCalledTimes(1)
    expect(process.stdout.write).toHaveBeenCalledWith('North Console sent 1 file.\r\n')
    expect(console.table).not.toHaveBeenCalled()
  })

  it('should properly handle values in verbose mode', async () => {
    north.verbose = true

    const filePath = '/path/to/file/example.file'
    jest.spyOn(fs, 'stat').mockImplementation(() => Promise.resolve({ size: 666 }))

    await north.handleFile(filePath)

    expect(console.table).toHaveBeenCalledWith([{ filePath, fileSize: 666 }])
    expect(process.stdout.write).not.toHaveBeenCalled()
  })
})
