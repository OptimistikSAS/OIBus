const net = require('node:net')
const path = require('node:path')
const Stream = require('node:stream')

const Modbus = require('./south-modbus')

const databaseService = require('../../service/database.service')
const utils = require('./utils')

// Mock jsmobdus
jest.mock('jsmodbus', () => ({ client: { TCP: jest.fn() } }))

// Mock net library used for Socket
jest.mock('node:net')

// Mock fs
jest.mock('node:fs/promises')

// Mock utils class
jest.mock('./utils')

const addValues = jest.fn()
const addFiles = jest.fn()

// Mock services
jest.mock('../../service/database.service')
jest.mock('../../service/logger/logger.service')
jest.mock('../../service/status.service')
jest.mock('../../service/encryption.service', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))

// Method used to flush promises called in setTimeout
const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate)
let configuration = null
let south = null

describe('SouthModbus', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers()

    // Mock node:net Socket constructor and the used function
    net.Socket.mockReturnValue({
      connect(_connectionObject, callback) {
        callback()
      },
      on() {
        jest.fn()
      },
    })

    utils.getNumberOfWords.mockReturnValue(1)

    configuration = {
      id: 'southId',
      name: 'Modbus Test',
      type: 'Modbus',
      enabled: true,
      settings: {
        port: 502,
        host: '127.0.0.1',
        slaveId: 1,
        addressOffset: 'Modbus',
        endianness: 'Big Endian',
        swapBytesInWords: false,
        swapWordsInDWords: false,
        retryInterval: 10000,
      },
      points: [
        {
          pointId: 'HoldingRegister',
          modbusType: 'holdingRegister',
          dataType: 'UInt16',
          address: '0x4E80',
          multiplierCoefficient: 1,
          scanMode: 'every10Seconds',
        },
        {
          pointId: 'HoldingRegister2',
          modbusType: 'holdingRegister',
          dataType: 'UInt16',
          address: '20097',
          multiplierCoefficient: 1,
          scanMode: 'every10Seconds',
        },
        {
          pointId: 'InputRegister',
          modbusType: 'inputRegister',
          dataType: 'UInt16',
          scanMode: 'every10Seconds',
          address: '0x3E81',
          multiplierCoefficient: 1,
        },
        {
          pointId: 'DiscreteInput',
          modbusType: 'discreteInput',
          dataType: 'UInt16',
          scanMode: 'every10Seconds',
          address: '0x1E82',
          multiplierCoefficient: 1,
        },
        {
          pointId: 'Coil',
          modbusType: 'coil',
          dataType: 'UInt16',
          scanMode: 'every10Seconds',
          address: '0x0E83',
          multiplierCoefficient: 1,
        },
      ],
    }
    south = new Modbus(configuration, addValues, addFiles)
    await south.init('baseFolder', 'oibusName', {})
  })

  it('should be properly initialized', () => {
    expect(south.url).toEqual(configuration.settings.url)
    expect(south.slaveId).toEqual(configuration.settings.slaveId)
  })

  it('should properly connect', async () => {
    await south.connect()
    expect(databaseService.createConfigDatabase).toBeCalledWith(path.resolve(`baseFolder/south-${configuration.id}/cache.db`))
    expect(south.connected).toBeTruthy()
  })

  it('should fail to connect and try again', async () => {
    const mockedEmitter = new Stream()

    mockedEmitter.connect = (_connectionObject, callback) => {
      callback()
    }
    // Mock node:net Socket constructor and the used function
    net.Socket.mockImplementation(() => mockedEmitter)
    south.disconnect = jest.fn()
    await south.connect()
    expect(net.Socket).toHaveBeenCalledTimes(1)
    mockedEmitter.emit('error', 'connect error')
    await flushPromises()
    expect(south.disconnect).toHaveBeenCalledTimes(1)
    expect(south.logger.error).toHaveBeenCalledWith('connect error')
    jest.advanceTimersByTime(configuration.settings.retryInterval)

    expect(net.Socket).toHaveBeenCalledTimes(2)
  })

  it('should properly query last points value', async () => {
    await south.connect()
    south.client = {
      readHoldingRegisters: jest.fn().mockReturnValue({ response: { body: { valuesAsBuffer: Buffer.from([1, 2, 3, 4]) } } }),
      readInputRegisters: jest.fn().mockReturnValue({ response: { body: { valuesAsBuffer: Buffer.from([1, 2, 3, 4]) } } }),
      readDiscreteInputs: jest.fn().mockReturnValue({ response: { body: { valuesAsArray: [123] } } }),
      readCoils: jest.fn().mockReturnValue({ response: { body: { valuesAsArray: [123] } } }),
    }
    await south.lastPointQuery('every10Seconds')

    expect(south.client.readHoldingRegisters).toHaveBeenCalledWith(20096, 1)
    expect(south.client.readHoldingRegisters).toHaveBeenCalledWith(20097, 1)
    expect(south.client.readHoldingRegisters).toHaveBeenCalledTimes(2) // addresses are in the same group, so it makes one call
  })

  it('should properly query last points value with JBus offset', async () => {
    await south.connect()
    south.addressOffset = 'JBus'
    south.client = {
      readHoldingRegisters: jest.fn().mockReturnValue({ response: { body: { valuesAsBuffer: Buffer.from([1, 2, 3, 4]) } } }),
      readInputRegisters: jest.fn().mockReturnValue({ response: { body: { valuesAsBuffer: Buffer.from([1, 2, 3, 4]) } } }),
      readDiscreteInputs: jest.fn().mockReturnValue({ response: { body: { valuesAsArray: [123] } } }),
      readCoils: jest.fn().mockReturnValue({ response: { body: { valuesAsArray: [123] } } }),
    }
    await south.lastPointQuery('every10Seconds')

    expect(south.client.readHoldingRegisters).toHaveBeenCalledWith(20095, 1)
    expect(south.client.readHoldingRegisters).toHaveBeenCalledWith(20096, 1)
    expect(south.client.readHoldingRegisters).toHaveBeenCalledTimes(2) // addresses are in the same group, so it makes one call
  })

  it('should properly disconnect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    south.connected = true
    const end = jest.fn()
    south.socket = { end }
    south.reconnectTimeout = 1

    await south.disconnect()
    expect(end).toHaveBeenCalled()
    expect(south.connected).toBeFalsy()
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)

    jest.clearAllMocks()
    south.connected = false
    south.reconnectTimeout = null
    south.socket = { end }
    await south.disconnect()

    expect(clearTimeoutSpy).not.toHaveBeenCalled()
    expect(end).not.toHaveBeenCalled()
  })

  it('should throw error if modbus function is not defined', async () => {
    await south.connect()

    const badPoint = {
      pointId: 'badPoint',
      modbusType: 'badModbusType',
      dataType: 'UInt16',
      scanMode: 'every10Seconds',
      address: '0x1E82',
      multiplierCoefficient: 1,
    }
    let modbusError
    try {
      await south.modbusFunction(badPoint)
    } catch (error) {
      modbusError = error
    }
    expect(modbusError).toEqual(new Error(`Wrong Modbus type "badModbusType" for point ${JSON.stringify(badPoint)}`))
  })

  it('should throw error if modbus function throws an error', async () => {
    await south.connect()
    south.client.readHoldingRegisters = jest.fn().mockImplementation(() => {
      const rejectError = new Error()
      rejectError.err = 'modbus error'
      throw rejectError
    })
    let modbusError
    try {
      await south.lastPointQuery('every10Seconds')
    } catch (error) {
      modbusError = error
    }
    expect(modbusError).toEqual(new Error('modbus error'))
  })

  it('should reconnect if modbus function throws a connection error', async () => {
    south.disconnect = jest.fn()
    south.createModbusClient = jest.fn()
    await south.connect()
    south.client = {
      readHoldingRegisters: jest.fn().mockImplementation(() => {
        const error = new Error()
        error.err = 'Offline'
        throw error
      }),
    }

    await south.lastPointQuery('every10Seconds')
    expect(south.logger.error).toHaveBeenCalledWith('Modbus server offline.')
    expect(net.Socket).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(configuration.settings.retryInterval)
    expect(net.Socket).toHaveBeenCalledTimes(2)
  })

  it('should get value from buffer with UInt16', () => {
    south.swapBytesInWords = false
    south.endianness = 'Big Endian'
    expect(south.getValueFromBuffer(Buffer.from([64, 64]), 1, 'UInt16')).toEqual(16448)
    south.swapBytesInWords = true
    expect(south.getValueFromBuffer(Buffer.from([0, 1]), 1, 'UInt16')).toEqual(256)
    expect(south.getValueFromBuffer(Buffer.from([1, 0]), 1, 'UInt16')).toEqual(1)
    south.endianness = 'Little Endian'
    expect(south.getValueFromBuffer(Buffer.from([0, 1]), 1, 'UInt16')).toEqual(1)
    expect(south.getValueFromBuffer(Buffer.from([1, 0]), 1, 'UInt16')).toEqual(256)
  })

  it('should get value from buffer with Float', () => {
    south.swapWordsInDWords = false
    south.swapBytesInWords = false
    south.endianness = 'Big Endian'
    expect(south.getValueFromBuffer(Buffer.from([0, 0, 64, 64]), 1, 'Float')).toEqual(3)
    expect(south.getValueFromBuffer(Buffer.from([81, 236, 65, 122]), 10, 'Float')).toEqual(156.45)
  })

  it('should get value from buffer with UInt32', () => {
    south.swapWordsInDWords = true
    south.endianness = 'Big Endian'
    expect(south.getValueFromBuffer(Buffer.from([0, 0, 64, 64]), 1, 'UInt32')).toEqual(16448)
    south.swapBytesInWords = true
    expect(south.getValueFromBuffer(Buffer.from([0, 0, 64, 64]), 1, 'UInt32')).toEqual(16448)
    expect(south.getValueFromBuffer(Buffer.from([0, 0, 1, 0]), 1, 'UInt32')).toEqual(1)
    south.swapBytesInWords = false
    expect(south.getValueFromBuffer(Buffer.from([0, 0, 1, 0]), 1, 'UInt32')).toEqual(256)
  })
})
