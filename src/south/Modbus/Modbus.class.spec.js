const net = require('node:net')

const path = require('node:path')
const Modbus = require('./Modbus.class')

const databaseService = require('../../services/database.service')
const utils = require('./utils')

const { defaultConfig: config } = require('../../../tests/testConfig')

// Mock jsmobdus
jest.mock('jsmodbus', () => ({ client: { TCP: jest.fn() } }))

// Mock net library used for Socket
jest.mock('node:net')

// Mock fs
jest.mock('node:fs/promises')

// Mock utils class
jest.mock('./utils', () => ({
  getOptimizedScanModes: jest.fn(),
  readRegisterValue: jest.fn(),
}))

// Mock OIBusEngine
const engine = {
  configService: { getConfig: () => ({ engineConfig: config.engine }) },
  cacheFolder: './cache',
  addValues: jest.fn(),
  addFile: jest.fn(),
}

// Mock services
jest.mock('../../services/database.service')
jest.mock('../../engine/logger/Logger.class')
jest.mock('../../services/status.service.class')
jest.mock('../../services/EncryptionService.class', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))

let settings = null
let south = null

describe('South Modbus', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers()

    // Mock utils method getOptimizedScanModes
    utils.getOptimizedScanModes.mockReturnValue({
      every10Seconds: {
        coil: {
          '3712-3728': [
            {
              address: 3715,
              dataType: 'UInt16',
              multiplierCoefficient: 1,
              pointId: 'Coil',
              type: 'boolean',
            },
          ],
        },
        discreteInput: {
          '7808-7824': [
            {
              address: 7810,
              dataType: 'UInt16',
              multiplierCoefficient: 1,
              pointId: 'DiscreteInput',
              type: 'number',
            },
          ],
        },
        holdingRegister: {
          '20080-20112': [
            {
              address: 20096,
              dataType: 'UInt16',
              multiplierCoefficient: 1,
              pointId: 'HoldingRegister',
              type: 'number',
            },
            {
              address: 20097,
              dataType: 'UInt16',
              multiplierCoefficient: 1,
              pointId: 'HoldingRegister2',
              type: 'number',
            },
          ],
        },
        inputRegister: {
          '16000-16016': [
            {
              address: 16001,
              dataType: 'UInt16',
              multiplierCoefficient: 1,
              pointId: 'InputRegister',
              type: 'number',
            },
          ],
        },

      },
    })

    // Mock node:net Socket constructor and the used function
    net.Socket.mockReturnValue({
      connect(_connectionObject, callback) {
        callback()
      },
      on() {
        jest.fn()
      },
    })

    settings = {
      id: 'southId',
      name: 'Modbus Test',
      protocol: 'Modbus',
      enabled: true,
      Modbus: {
        port: 502,
        host: '127.0.0.1',
        slaveId: 1,
        addressOffset: 'Modbus',
        endianness: 'Big Endian',
        swapBytesInWords: false,
        swapWordsInDWords: false,
      },
      points: [
        {
          pointId: 'HoldingRegister',
          modbusType: 'holdingRegister',
          dataType: 'UInt16',
          address: '0x4E80',
          multiplierCoefficient: 1,
          type: 'number',
          scanMode: 'every10Seconds',
        },
        {
          pointId: 'HoldingRegister2',
          modbusType: 'holdingRegister',
          dataType: 'UInt16',
          address: '0x4E81',
          multiplierCoefficient: 1,
          type: 'number',
          scanMode: 'every10Seconds',
        },
        {
          pointId: 'InputRegister',
          modbusType: 'inputRegister',
          dataType: 'UInt16',
          scanMode: 'every10Seconds',
          address: '0x3E81',
          multiplierCoefficient: 1,
          type: 'number',
        },
        {
          pointId: 'DiscreteInput',
          modbusType: 'discreteInput',
          dataType: 'UInt16',
          scanMode: 'every10Seconds',
          address: '0x1E82',
          multiplierCoefficient: 1,
          type: 'number',
        },
        {
          pointId: 'Coil',
          modbusType: 'coil',
          dataType: 'UInt16',
          scanMode: 'every10Seconds',
          address: '0x0E83',
          multiplierCoefficient: 1,
          type: 'number',
        },
      ],
    }
    south = new Modbus(settings, engine)
    await south.init()
  })

  it('should be properly initialized', () => {
    expect(south.url).toEqual(settings.Modbus.url)
    expect(south.settings.Modbus.slaveId).toEqual(settings.Modbus.slaveId)
    expect(utils.getOptimizedScanModes).toHaveBeenCalledWith(settings.points, settings.Modbus.addressOffset, undefined)
  })

  it('should properly connect', async () => {
    await south.connect()
    expect(databaseService.createConfigDatabase).toBeCalledWith(path.resolve(`./cache/south-${settings.id}/cache.db`))
    expect(south.connected).toBeTruthy()
  })

  it('should properly query last points value', async () => {
    await south.connect()
    south.client = {
      readHoldingRegisters: jest.fn().mockReturnValue({ response: 'value' }),
      readInputRegisters: jest.fn().mockReturnValue({ response: 'value' }),
      readDiscreteInputs: jest.fn().mockReturnValue({ response: 'value' }),
      readCoils: jest.fn().mockReturnValue({ response: 'value' }),
    }
    await south.lastPointQuery('every10Seconds')

    expect(south.client.readHoldingRegisters).toBeCalledWith(20080, 32) // see the optimizedScanModes to get the startAddress and range
    expect(south.client.readHoldingRegisters).toBeCalledTimes(1) // addresses are in the same group, so it makes one call
  })

  it('should properly disconnect', async () => {
    south.connected = true
    const end = jest.fn()
    south.socket = { end }
    south.modbusFunction = jest.fn()

    south.reconnectTimeout = setTimeout(() => {}, 1000)

    await south.disconnect()
    expect(end).toBeCalled()
    expect(south.connected).toBeFalsy()
  })
})
