import path from 'node:path'

import pino from 'pino'

import LoggerService from './logger.service.js'

jest.mock('pino')
jest.mock('./file-cleanup.service')
jest.mock('../utils')

// mock EncryptionService
const encryptionService = { decryptText: (textToDecipher) => textToDecipher }
let service = null
let settings = null

describe('Logger', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.useFakeTimers()
    settings = {
      name: 'OIBus-test',
      logParameters: {
        consoleLog: { level: 'error' },
        fileLog: {
          level: 'warn',
          fileName: 'test-journal.log',
          maxSize: 10,
          numberOfFiles: 5,
        },
        sqliteLog: {
          level: 'info',
          fileName: 'test-journal.db',
          maxNumberOfLogs: 1234,

        },
        lokiLog: {
          level: 'debug',
          username: 'user',
          password: 'loki-pass',
          tokenAddress: 'token-url',
          lokiAddress: 'loki-url',
          interval: 60,
        },
      },
    }
  })

  it('should be properly initialized', async () => {
    service = new LoggerService()
    service.createChildLogger = jest.fn()

    service.setEncryptionService(encryptionService)

    const expectedTargets = [
      { target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: settings.logParameters.consoleLog.level },
      {
        target: 'pino-roll',
        options: {
          file: path.resolve('logs', settings.logParameters.fileLog.fileName),
          size: 10,
        },
        level: settings.logParameters.fileLog.level,
      },
      {
        target: path.join(__dirname, 'sqlite-transport.js'),
        options: {
          fileName: path.resolve('logs', settings.logParameters.sqliteLog.fileName),
          maxNumberOfLogs: settings.logParameters.sqliteLog.maxNumberOfLogs,
        },
        level: settings.logParameters.sqliteLog.level,
      },
      {
        target: path.join(__dirname, 'loki-transport.js'),
        options: {
          username: settings.logParameters.lokiLog.username,
          password: settings.logParameters.lokiLog.password,
          tokenAddress: settings.logParameters.lokiLog.tokenAddress,
          lokiAddress: settings.logParameters.lokiLog.lokiAddress,
          oibusName: settings.name,
          interval: settings.logParameters.lokiLog.interval,
        },
        level: settings.logParameters.lokiLog.level,
      },
    ]

    await service.start(settings.name, settings.logParameters)

    expect(pino).toHaveBeenCalledTimes(1)
    expect(pino).toHaveBeenCalledWith({
      base: undefined,
      level: 'trace',
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: { targets: expectedTargets },
    })
    expect(service.fileCleanUpService.start).toHaveBeenCalledTimes(1)
    expect(service.createChildLogger).toHaveBeenCalledWith('logger-service')
  })

  it('should be properly initialized with loki error and standard file names', async () => {
    jest.spyOn(console, 'error').mockImplementationOnce(() => {})
    service = new LoggerService()

    service.createChildLogger = jest.fn()

    const badEncryptionService = { decryptText: jest.fn(() => { throw new Error('decrypt-error') }) }
    service.setEncryptionService(badEncryptionService)

    settings.logParameters.fileLog.fileName = undefined
    settings.logParameters.sqliteLog.fileName = undefined
    await service.start(settings.name, settings.logParameters)

    expect(console.error).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalledWith(new Error('decrypt-error'))
  })

  it('should be properly initialized without loki password and without sqliteLog', async () => {
    jest.spyOn(console, 'error').mockImplementationOnce(() => {})
    service = new LoggerService()

    service.createChildLogger = jest.fn()

    settings.logParameters.sqliteLog = null
    settings.logParameters.lokiLog.password = ''
    const expectedTargets = [
      { target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: settings.logParameters.consoleLog.level },
      {
        target: 'pino-roll',
        options: {
          file: path.resolve('logs', settings.logParameters.fileLog.fileName),
          size: 10,
        },
        level: settings.logParameters.fileLog.level,
      },
      {
        target: path.join(__dirname, 'loki-transport.js'),
        options: {
          username: settings.logParameters.lokiLog.username,
          password: settings.logParameters.lokiLog.password,
          tokenAddress: settings.logParameters.lokiLog.tokenAddress,
          lokiAddress: settings.logParameters.lokiLog.lokiAddress,
          oibusName: settings.name,
          interval: settings.logParameters.lokiLog.interval,
        },
        level: settings.logParameters.lokiLog.level,
      },
    ]

    await service.start(settings.name, settings.logParameters)

    expect(pino).toHaveBeenCalledTimes(1)
    expect(pino).toHaveBeenCalledWith({
      base: undefined,
      level: 'trace',
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: { targets: expectedTargets },
    })
    expect(service.createChildLogger).toHaveBeenCalledWith('logger-service')
  })

  it('should be properly initialized without lokiLog nor sqliteLog', async () => {
    jest.spyOn(console, 'error').mockImplementationOnce(() => {})
    service = new LoggerService()

    service.createChildLogger = jest.fn()

    settings.logParameters.sqliteLog = null
    settings.logParameters.lokiLog = null
    const expectedTargets = [
      { target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: settings.logParameters.consoleLog.level },
      {
        target: 'pino-roll',
        options: {
          file: path.resolve('logs', settings.logParameters.fileLog.fileName),
          size: 10,
        },
        level: settings.logParameters.fileLog.level,
      },
    ]

    await service.start(settings.name, settings.logParameters)

    expect(pino).toHaveBeenCalledTimes(1)
    expect(pino).toHaveBeenCalledWith({
      base: undefined,
      level: 'trace',
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: { targets: expectedTargets },
    })
    expect(service.createChildLogger).toHaveBeenCalledWith('logger-service')
  })

  it('should properly create child logger', () => {
    service = new LoggerService()
    const childFunction = jest.fn()
    service.logger = { child: childFunction }
    service.createChildLogger('myScope')
    expect(childFunction).toHaveBeenCalledWith({ scope: 'myScope' })
  })

  it('should properly stop logger', () => {
    service = new LoggerService()
    const fileCleanUpStopFunction = jest.fn()

    service.fileCleanUpService = { stop: fileCleanUpStopFunction }
    service.stop()
    expect(fileCleanUpStopFunction).toHaveBeenCalledTimes(1)
  })
})
