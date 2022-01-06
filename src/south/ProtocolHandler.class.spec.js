const config = require('../config/defaultConfig.json')
const ProtocolHandler = require('./ProtocolHandler.class')

jest.mock('../engine/logger/Logger.class')

const engine = jest.genMockFromModule('../engine/OIBusEngine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.addValues = jest.fn()
engine.addFile = jest.fn()
engine.eventEmitters = {}
engine.logger = {
  error: jest.fn(),
  silly: jest.fn(),
}

beforeEach(() => {
  jest.resetAllMocks()
  jest.clearAllMocks()
  jest.restoreAllMocks()
})

describe('ProtocolHandler', () => {
  it('should properly handle addValues call', async () => {
    const mockDate = new Date('2020-02-02T02:02:02.222Z')
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate)

    const south = new ProtocolHandler({ id: 'id' }, engine, {})

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
  })

  it('should properly handle addFile call', async () => {
    const mockDate = new Date('2020-02-02T02:02:02.222Z')
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate)

    const south = new ProtocolHandler({ id: 'id' }, engine, {})

    const filePath = 'path'
    const preserveFiles = true
    await south.addFile(filePath, preserveFiles)

    expect(engine.addFile).toBeCalledWith('id', filePath, preserveFiles)
  })

  it('should format date properly', () => {
    const actual = ProtocolHandler.generateDateWithTimezone(
      '2020-02-22 22:22:22.666',
      'Europe/Paris',
      'YYYY-MM-DD HH:mm:ss.SSS',
    )
    const expected = '2020-02-22T21:22:22.666Z'
    expect(actual).toBe(expected)
  })

  it('should properly return timestamp when timestampOrigin is oibus', () => {
    const mockDate = new Date('2020-02-02T02:02:02.222Z')
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate)

    const south = new ProtocolHandler({}, engine)
    const mockGenerateDateWithTimezone = jest.spyOn(ProtocolHandler, 'generateDateWithTimezone')

    const timestampOrigin = 'oibus'
    const timestampElement = 'timestamp'
    const timestampFormat = 'YYYY-MM-DD HH:mm:ss.SSS'
    const timestampTimezone = 'Europe/Paris'
    const actual = south.getTimestamp(timestampElement, timestampOrigin, timestampFormat, timestampTimezone)

    expect(mockGenerateDateWithTimezone).not.toBeCalled()
    expect(south.logger.error).not.toBeCalled()
    expect(actual).toEqual('2020-02-02T02:02:02.222Z')
  })

  it('should properly return timestamp when timestampOrigin is payload and timestamp field is present', () => {
    const south = new ProtocolHandler({}, engine)
    const mockGenerateDateWithTimezone = jest.spyOn(ProtocolHandler, 'generateDateWithTimezone')

    const timestampOrigin = 'payload'
    const timestampElement = '2020-02-02 02:02:02'
    const timestampFormat = 'YYYY-MM-DD HH:mm:ss.SSS'
    const timestampTimezone = 'Europe/Paris'
    south.getTimestamp(timestampElement, timestampOrigin, timestampFormat, timestampTimezone)

    expect(mockGenerateDateWithTimezone).toBeCalledWith(timestampElement, timestampTimezone, timestampFormat)
    expect(south.logger.error).not.toBeCalled()
  })

  it('should properly return timestamp when timestampOrigin is payload but timezone is not properly set', () => {
    const south = new ProtocolHandler({}, engine)
    const mockGenerateDateWithTimezone = jest.spyOn(ProtocolHandler, 'generateDateWithTimezone')

    const timestampOrigin = 'payload'
    const timestampElement = '2020-02-02 02:02:02'
    const timestampFormat = 'YYYY-MM-DD HH:mm:ss.SSS'
    const timestampTimezone = undefined
    south.getTimestamp(timestampElement, timestampOrigin, timestampFormat, timestampTimezone)

    expect(mockGenerateDateWithTimezone).not.toBeCalled()
    expect(south.logger.error).toBeCalledWith('Invalid timezone specified or the timestamp key is missing in the payload')
  })

  it('should properly return timestamp when timestampOrigin is payload but the timestamp field is missing', () => {
    const south = new ProtocolHandler({}, engine)
    const mockGenerateDateWithTimezone = jest.spyOn(ProtocolHandler, 'generateDateWithTimezone')

    const timestampElement = null
    const timestampOrigin = 'payload'
    const timestampFormat = 'YYYY-MM-DD HH:mm:ss.SSS'
    const timestampTimezone = undefined
    south.getTimestamp(timestampElement, timestampOrigin, timestampFormat, timestampTimezone)

    expect(mockGenerateDateWithTimezone).not.toBeCalled()
    expect(south.logger.error).toBeCalledWith('Invalid timezone specified or the timestamp key is missing in the payload')
  })
})
