const config = require('../config/defaultConfig.json')
const ProtocolHandler = require('./ProtocolHandler.class')

jest.mock('../engine/logger/Logger.class')

const engine = jest.genMockFromModule('../engine/OIBusEngine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.addValues = jest.fn()
engine.addFile = jest.fn()
engine.eventEmitters = {}

const nowDateString = '2020-02-02T02:02:02.222Z'

beforeEach(() => {
  jest.resetAllMocks()
  jest.clearAllMocks()
  jest.restoreAllMocks()
})

describe('ProtocolHandler', () => {
  it('should properly handle addValues call', async () => {
    const RealDate = Date
    global.Date = jest.fn(() => new RealDate(nowDateString))

    const south = new ProtocolHandler({ id: 'id' }, engine, {})
    await south.init()
    const values = [{
      timestamp: '2020-02-02T01:02:02.000Z',
      pointId: 'point1',
      data: {
        value: 666.666,
        quality: true,
      },
    }]
    await south.addValues(values)
    await south.flush()

    expect(engine.addValues).toBeCalledWith('id', values)
    global.Date = RealDate
  })

  it('should properly handle addFile call', async () => {
    const RealDate = Date
    global.Date = jest.fn(() => new RealDate(nowDateString))

    const south = new ProtocolHandler({ id: 'id' }, engine, {})
    await south.init()

    const filePath = 'path'
    const preserveFiles = true
    await south.addFile(filePath, preserveFiles)

    expect(engine.addFile).toBeCalledWith('id', filePath, preserveFiles)
    global.Date = RealDate
  })

  it('should format date properly', () => {
    const test1 = ProtocolHandler.generateDateWithTimezone(
      '2020-02-22 22:22:22.666',
      'Europe/Paris',
      'yyyy-MM-dd HH:mm:ss.SSS',
    )
    const expectedResult1 = '2020-02-22T21:22:22.666Z'
    expect(test1)
      .toBe(expectedResult1)

    const test2 = ProtocolHandler.generateDateWithTimezone(
      '2020-02-22T22:22:22.666Z',
      'Europe/Paris',
      'yyyy-MM-dd HH:mm:ss.SSS',
    )
    const expectedResult2 = '2020-02-22T22:22:22.666Z'
    expect(test2)
      .toBe(expectedResult2)
  })

  it('should properly return timestamp when timestampOrigin is oibus', async () => {
    const RealDate = Date
    global.Date = jest.fn(() => new RealDate(nowDateString))

    const south = new ProtocolHandler({}, engine)
    await south.init()
    const mockGenerateDateWithTimezone = jest.spyOn(ProtocolHandler, 'generateDateWithTimezone')

    const timestampOrigin = 'oibus'
    const timestampElement = 'timestamp'
    const timestampFormat = 'YYYY-MM-DD HH:mm:ss.SSS'
    const timestampTimezone = 'Europe/Paris'
    const actual = south.getTimestamp(timestampElement, timestampOrigin, timestampFormat, timestampTimezone)

    expect(mockGenerateDateWithTimezone).not.toBeCalled()
    expect(south.logger.error).not.toBeCalled()
    expect(actual).toEqual(nowDateString)
    global.Date = RealDate
  })

  it('should properly return timestamp when timestampOrigin is payload and timestamp field is present', async () => {
    const south = new ProtocolHandler({}, engine)
    await south.init()
    const mockGenerateDateWithTimezone = jest.spyOn(ProtocolHandler, 'generateDateWithTimezone')

    const timestampOrigin = 'payload'
    const timestampElement = '2020-02-02 02:02:02.222'
    const timestampFormat = 'yyyy-MM-dd HH:mm:ss.SSS'
    const timestampTimezone = 'Europe/Paris'
    south.getTimestamp(timestampElement, timestampOrigin, timestampFormat, timestampTimezone)

    expect(mockGenerateDateWithTimezone).toBeCalledWith(timestampElement, timestampTimezone, timestampFormat)
    expect(south.logger.error).not.toBeCalled()
  })

  it('should properly return timestamp when timestampOrigin is payload but timezone is not properly set', async () => {
    const south = new ProtocolHandler({}, engine)
    await south.init()
    const mockGenerateDateWithTimezone = jest.spyOn(ProtocolHandler, 'generateDateWithTimezone')

    const timestampOrigin = 'payload'
    const timestampElement = '2020-02-02 02:02:02'
    const timestampFormat = 'yyyy-MM-dd HH:mm:ss.SSS'
    const timestampTimezone = undefined
    south.getTimestamp(timestampElement, timestampOrigin, timestampFormat, timestampTimezone)

    expect(mockGenerateDateWithTimezone).not.toBeCalled()
    expect(south.logger.error).toBeCalledWith('Invalid timezone specified or the timestamp key is missing in the payload')
  })

  it('should properly return timestamp when timestampOrigin is payload but the timestamp field is missing', async () => {
    const south = new ProtocolHandler({}, engine)
    await south.init()
    const mockGenerateDateWithTimezone = jest.spyOn(ProtocolHandler, 'generateDateWithTimezone')

    const timestampElement = null
    const timestampOrigin = 'payload'
    const timestampFormat = 'yyyy-MM-dd HH:mm:ss.SSS'
    const timestampTimezone = undefined
    south.getTimestamp(timestampElement, timestampOrigin, timestampFormat, timestampTimezone)

    expect(mockGenerateDateWithTimezone).not.toBeCalled()
    expect(south.logger.error).toBeCalledWith('Invalid timezone specified or the timestamp key is missing in the payload')
  })
})
