const pino = require('pino')
const path = require('node:path')
const LoggerService = require('./logger.service')

jest.mock('pino')
jest.mock('./file-cleanup.service')

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
    pino.stdTimeFunctions = { isoTime: jest.fn() }
  })

  it('should be properly initialized', async () => {
    logger = new LoggerService()
    logger.setEncryptionService(encryptionService)

    const expectedTargets = [
      { target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: settings.logParameters.consoleLog.level },
      {
        target: 'pino-roll',
        options: {
          file: settings.logParameters.fileLog.fileName,
          size: 10,
        },
        level: settings.logParameters.fileLog.level,
      },
      {
        target: path.join(__dirname, 'sqlite-transport.js'),
        options: {
          fileName: settings.logParameters.sqliteLog.fileName,
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

    await logger.start(settings.name, settings.logParameters)
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

  it('should be properly initialized with loki error and standard file names', async () => {
    jest.spyOn(console, 'error').mockImplementationOnce(() => {})
    logger = new LoggerService('specific-logger')
    const badEncryptionService = { decryptText: jest.fn(() => { throw new Error('decrypt-error') }) }
    logger.setEncryptionService(badEncryptionService)

    settings.logParameters.fileLog.fileName = undefined
    settings.logParameters.sqliteLog.fileName = undefined
    await logger.start(settings.name, settings.logParameters)

    expect(console.error).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalledWith(new Error('decrypt-error'))
  })

  it('should properly get additional parameter from mixin', () => {
    logger = new LoggerService('specific-logger')
    logger.getSource = jest.fn(() => 'my file source')

    const mixinResults = logger.pinoMixin()

    expect(mixinResults).toEqual({ source: 'my file source' })
  })

  it('should properly get source', () => {
    logger = new LoggerService()
    const result = logger.getSource()

    expect(result).toEqual(expect.stringContaining('logger.service.spec'))
  })
})
