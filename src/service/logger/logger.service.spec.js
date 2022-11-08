const pino = require('pino')
const path = require('node:path')
const LoggerService = require('./logger.service')

jest.mock('pino')

// mock EncryptionService
const encryptionService = { decryptText: (textToDecipher) => textToDecipher }
let logger = null
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
          maxSize: 1000000,
          numberOfFiles: 5,
          tailable: true,
        },
        sqliteLog: {
          level: 'info',
          fileName: 'test-journal.db',
          maxSize: 1234,

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
    pino.stdTimeFunctions = { isoTime: jest.fn() }
  })

  it('should be properly initialized', async () => {
    logger = new LoggerService()
    logger.setEncryptionService(encryptionService)

    const expectedTargets = [
      { target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: settings.logParameters.consoleLog.level },
      {
        target: 'pino/file',
        options: {
          destination: settings.logParameters.fileLog.fileName,
          mkdir: true,
        },
        level: settings.logParameters.fileLog.level,
      },
      {
        target: path.join(__dirname, 'sqlite-transport.js'),
        options: {
          fileName: settings.logParameters.sqliteLog.fileName,
          maxFileSize: settings.logParameters.sqliteLog.maxSize,
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

    await logger.changeParameters(settings.name, settings.logParameters)
    expect(logger.scope).toEqual('main')

    expect(pino).toHaveBeenCalledTimes(1)
    expect(pino).toHaveBeenCalledWith({
      mixin: expect.any(Function),
      base: undefined,
      level: 'trace',
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: { targets: expectedTargets },
    })
  })

  it('should be properly initialized', async () => {
    logger = new LoggerService()
    logger.setEncryptionService(encryptionService)

    await logger.changeParameters(settings.name, {
      consoleLog: { level: 'none' },
      fileLog: { level: 'none' },
      sqliteLog: { level: 'none' },
      lokiLog: { level: 'none' },
    })

    expect(pino).not.toHaveBeenCalled()
  })

  it('should be properly initialized with overwritten settings', async () => {
    logger = new LoggerService('specific-logger')
    logger.setEncryptionService(encryptionService)

    const specificParameters = {
      consoleLevel: 'trace',
      fileLevel: 'trace',
      sqliteLevel: 'trace',
      lokiLevel: 'trace',
    }
    const expectedTargets = [
      { target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: specificParameters.consoleLevel },
      {
        target: 'pino/file',
        options: {
          destination: settings.logParameters.fileLog.fileName,
          mkdir: true,
        },
        level: specificParameters.fileLevel,
      },
      {
        target: path.join(__dirname, 'sqlite-transport.js'),
        options: {
          fileName: settings.logParameters.sqliteLog.fileName,
          maxFileSize: settings.logParameters.sqliteLog.maxSize,
        },
        level: specificParameters.sqliteLevel,
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
        level: specificParameters.lokiLevel,
      },
    ]

    await logger.changeParameters(settings.name, settings.logParameters, specificParameters)
    expect(logger.scope).toEqual('specific-logger')

    expect(pino).toHaveBeenCalledTimes(1)
    expect(pino).toHaveBeenCalledWith({
      mixin: expect.any(Function),
      base: undefined,
      level: 'trace',
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: { targets: expectedTargets },
    })
  })

  it('should be properly initialized with loki error and standard file names', async () => {
    jest.spyOn(console, 'error').mockImplementationOnce(() => {})
    logger = new LoggerService('specific-logger')
    const badEncryptionService = { decryptText: jest.fn(() => { throw new Error('decrypt-error') }) }
    logger.setEncryptionService(badEncryptionService)

    settings.logParameters.fileLog.fileName = undefined
    settings.logParameters.sqliteLog.fileName = undefined
    await logger.changeParameters(settings.name, settings.logParameters)

    expect(console.error).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalledWith(new Error('decrypt-error'))
  })

  it('should properly log messages', async () => {
    logger = new LoggerService()
    logger.logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
    }

    logger.error('error')
    logger.warn('warn')
    logger.info('info')
    logger.debug('debug')
    logger.trace('trace')

    expect(logger.logger.error).toHaveBeenCalledTimes(1)
    expect(logger.logger.error).toHaveBeenCalledWith('error')
    expect(logger.logger.warn).toHaveBeenCalledTimes(1)
    expect(logger.logger.warn).toHaveBeenCalledWith('warn')
    expect(logger.logger.info).toHaveBeenCalledTimes(1)
    expect(logger.logger.info).toHaveBeenCalledWith('info')
    expect(logger.logger.debug).toHaveBeenCalledTimes(1)
    expect(logger.logger.debug).toHaveBeenCalledWith('debug')
    expect(logger.logger.trace).toHaveBeenCalledTimes(1)
    expect(logger.logger.trace).toHaveBeenCalledWith('trace')

    logger.error({ stack: 'stack message' })
    expect(logger.logger.error).toHaveBeenCalledTimes(2)
    expect(logger.logger.error).toHaveBeenCalledWith('stack message')
  })

  it('should properly get additional parameter from mixin', () => {
    logger = new LoggerService('specific-logger')
    logger.getSource = jest.fn(() => 'my file source')

    const mixinResults = logger.pinoMixin()

    expect(mixinResults).toEqual({
      scope: 'specific-logger',
      source: 'my file source',
    })
  })

  it('should properly get source', () => {
    logger = new LoggerService()
    const result = logger.getSource()

    expect(result).toEqual(expect.stringContaining('logger.service.spec'))
  })
})
