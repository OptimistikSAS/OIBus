import fs from 'node:fs/promises'
import path from 'node:path'

import FileWriter from './north-file-writer.js'

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

describe('NorthFileWriter', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    configuration = {
      id: 'northId',
      name: 'filewriter',
      type: 'FileWriter',
      enabled: true,
      settings: {
        outputFolder: './output',
        prefixFileName: '',
        suffixFileName: '',
      },
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
      subscribedTo: [],
    }
    north = new FileWriter(configuration, [], logger)
    await north.start('baseFolder', 'oibusName')
  })

  it('should be properly initialized', () => {
    expect(north.canHandleFiles).toBeTruthy()
    expect(north.canHandleValues).toBeTruthy()
    expect(north.prefixFileName).toBe('')
    expect(north.suffixFileName).toBe('')
    expect(north.outputFolder).toEqual(path.resolve(configuration.settings.outputFolder))
  })

  it('should properly handle values', async () => {
    const values = [
      {
        timestamp: '2021-07-29T12:13:31.883Z',
        data: { value: 666, quality: 'good' },
        pointId: 'pointId',
      },
    ]
    jest.spyOn(fs, 'writeFile').mockImplementation(() => true)
    await north.handleValues(values)
    const expectedData = JSON.stringify(values)
    const expectedFileName = `${north.prefixFileName}${new Date().getTime()}${north.suffixFileName}.json`
    const expectedOutputFolder = path.resolve(north.outputFolder)
    const expectedPath = path.join(expectedOutputFolder, expectedFileName)
    expect(fs.writeFile).toBeCalledWith(expectedPath, expectedData)
  })

  it('should properly catch handle values error', async () => {
    const values = [
      {
        timestamp: '2021-07-29T12:13:31.883Z',
        data: { value: 666, quality: 'good' },
        pointId: 'pointId',
      },
    ]
    jest.spyOn(fs, 'writeFile').mockImplementationOnce(() => {
      throw new Error('Error handling values')
    })
    await expect(north.handleValues(values)).rejects.toThrowError('Error handling values')
  })

  it('should properly handle files', async () => {
    jest.spyOn(fs, 'stat').mockImplementation(() => ({ size: 666 }))
    jest.spyOn(fs, 'copyFile').mockImplementation(() => true)
    const filePath = '/path/to/file/example.file'
    const extension = path.extname(filePath)
    let expectedFileName = path.basename(filePath, extension)
    expectedFileName = `${north.prefixFileName}${expectedFileName}${north.suffixFileName}${extension}`
    const expectedOutputFolder = path.resolve(north.outputFolder)
    await north.handleFile(filePath)
    expect(fs.copyFile).toBeCalledWith(filePath, path.join(expectedOutputFolder, expectedFileName))
  })

  it('should properly catch handle file error', async () => {
    jest.spyOn(fs, 'stat').mockImplementation(() => ({ size: 666 }))
    jest.spyOn(fs, 'copyFile').mockImplementationOnce(() => {
      throw new Error('Error handling files')
    })
    const filePath = '/path/to/file/example.file'
    await expect(north.handleFile(filePath)).rejects.toThrowError('Error handling files')
  })
})
