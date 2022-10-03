const utils = require('./utils')

const mockedLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
}

describe('South connector Modbus utils', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.useFakeTimers()
  })

  it('should get empty optimized scan modes', () => {
    const result = utils.getOptimizedScanModes([], 'Modbus', mockedLogger)

    expect(result).toEqual({})
  })

  it('should read coil value', () => {
    const modbusResponse = {
      body: {
        constructor: { name: 'ReadCoilsResponseBody' },
        valuesAsArray: [0, 1, 2, 3, 4],
      },
    }
    const result = utils.readRegisterValue(modbusResponse, {}, 2, {})
    expect(result).toEqual(2)
  })

  it('should read discrete input', () => {
    const modbusResponse = {
      body: {
        constructor: { name: 'ReadDiscreteInputsResponseBody' },
        valuesAsArray: [0, 1, 2, 3, 4],
      },
    }
    const result = utils.readRegisterValue(modbusResponse, {}, 2, {})
    expect(result).toEqual(2)
  })
})
