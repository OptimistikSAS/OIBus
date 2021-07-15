const Logger = require('./Logger.class')

jest.mock('winston', () => {
  const mColorize = () => ({ colorize: () => 'colorized:' })
  const mFormat = {
    combine: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn(),
    colorize: mColorize,
  }
  const mTransports = {
    Console: jest.fn(),
    File: jest.fn(),
  }
  const mLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    silly: jest.fn(),
  }
  return {
    format: mFormat,
    transports: mTransports,
    createLogger: jest.fn().mockImplementation(() => mLogger),
  }
})

// eslint-disable-next-line import/order
const { createLogger, format, transports } = require('winston')

beforeEach(() => {
  jest.resetAllMocks()
})

// const logParameters = {
//   consoleLog: { level: 'debug' },
//   fileLog: {
//     level: 'debug',
//     fileName: './logs/journal.log',
//     maxSize: 1000000,
//     numberOfFiles: 5,
//     tailable: true,
//   },
//   sqliteLog: {
//     level: 'debug',
//     fileName: './logs/journal.db',
//     maxSize: 50000000,
//   },
//   lokiLog: {
//     level: 'none',
//     host: '',
//     interval: 60,
//     identifier: 'oibus',
//   },
// }

// TODO: improve tests
describe('Logger', () => {
  it('should create a new logger if no default logger is set already', () => {
    Logger.getDefaultLogger()
    expect(createLogger).toBeCalledTimes(1)
  })
  it('should be properly initialized', () => {
    const templateFunctions = []
    format.printf.mockImplementation((templateFn) => {
      templateFunctions.push(templateFn)
    })

    const info = {
      source: 'oibus',
      timestamp: 123,
      level: 'info',
      message: 'test',
    }

    const logger = new Logger()

    const tFn1 = templateFunctions.shift()
    expect(tFn1(info)).toBe(`${info.source} - ${info.timestamp} ${info.level}: ${info.message}`)
    const tFn2 = templateFunctions.shift()
    expect(tFn2(info)).toBe(`colorized: ${info.message}`)
    expect(format.combine).toBeCalledTimes(2)
    expect(format.timestamp).toBeCalledTimes(2)
    expect(format.printf).toBeCalledWith(expect.any(Function))
    expect(transports.Console).toBeCalledTimes(1)
    // expect(transports.File).toBeCalledWith({ filename: 'filename' })
    expect(createLogger).toBeCalledTimes(1)

    expect(Logger.getDefaultLogger()).toEqual(logger)
    // expect(logger.logger.level).toBe('info')
  })
})
