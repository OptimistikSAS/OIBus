const Modbus = require('./Modbus.class')
const config = require('../../config/defaultConfig.json')
const databaseService = require('../../services/database.service')

// Mock jsmobdus
jest.mock('jsmodbus', () => ({ client: { TCP: jest.fn() } }))

// Mock database service
jest.mock('../../services/database.service', () => ({
  createConfigDatabase: jest.fn(() => 'configDatabase'),
  getConfig: jest.fn((_database, _key) => '1587640141001.0'),
  upsertConfig: jest.fn(),
}))

jest.mock('net', () => {
  class Socket {
    // eslint-disable-next-line class-methods-use-this
    connect(_connectionObject, callback) {
      callback()
    }

    // eslint-disable-next-line class-methods-use-this
    on() {
      jest.fn()
    }

    // eslint-disable-next-line class-methods-use-this
    emit(err) {
      jest.fn(() => err)
    }
  }

  return { Socket }
})

// Mock logger
jest.mock('../../engine/Logger.class')

// Mock engine
const engine = jest.mock('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }

beforeEach(() => {
  jest.resetAllMocks()
  jest.useFakeTimers()
})

describe('Modbus south', () => {
  const modbusConfig = {
    dataSourceId: 'Modbus',
    protocol: 'Modbus',
    enabled: true,
    Modbus: {
      port: 502,
      host: '127.0.0.1',
      slaveId: 1,
      addressOffset: 'Modbus',
      endianness: 'Big Endian',
      swapBytesinWords: false,
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

  const optimizedScanModes = {
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
  }

  const modbusConfigAddressOffset = {
    dataSourceId: 'Modbus',
    protocol: 'Modbus',
    enabled: true,
    Modbus: {
      port: 502,
      host: '127.0.0.1',
      slaveId: 1,
      addressOffset: 'JBus',
      endianness: 'Big Endian',
      swapBytesinWords: false,
      swapWordsInDWords: false,
    },
    points: [
      {
        pointId: 'EtatBB2T0',
        modbusType: 'holdingRegister',
        dataType: 'UInt16',
        address: '0x3E80',
        multiplierCoefficient: 1,
        type: 'number',
        scanMode: 'every10Seconds',
      },
      {
        pointId: 'EtatBB2T1',
        modbusType: 'holdingRegister',
        dataType: 'UInt16',
        scanMode: 'every10Seconds',
        address: '0x3E81',
        multiplierCoefficient: 1,
        type: 'number',
      },
    ],
  }

  const optimizedScanModesAddressOffset = {
    every10Seconds: {
      holdingRegister: {
        '15984-16016': [
          {
            pointId: 'EtatBB2T0',
            dataType: 'UInt16',
            address: 15999,
            multiplierCoefficient: 1,
            type: 'number',
          },
          {
            pointId: 'EtatBB2T1',
            dataType: 'UInt16',
            address: 16000,
            multiplierCoefficient: 1,
            type: 'number',
          },
        ],
      },
    },
  }

  it('should be properly initialized', () => {
    const modbusSouth = new Modbus(modbusConfig, engine)
    expect(modbusSouth.url)
      .toEqual(modbusConfig.Modbus.url)
    expect(modbusSouth.optimizedScanModes)
      .toEqual(optimizedScanModes)
    expect(modbusSouth.dataSource.Modbus.slaveId)
      .toEqual(modbusConfig.Modbus.slaveId)
  })

  it('should be properly initialized with addressOffset', () => {
    const modbusSouth = new Modbus(modbusConfigAddressOffset, engine)
    expect(modbusSouth.optimizedScanModes)
      .toEqual(optimizedScanModesAddressOffset)
  })

  it('should properly connect', async () => {
    databaseService.getConfig.mockReturnValue('1587640141001.0')

    const modbusSouth = new Modbus(modbusConfig, engine)

    await modbusSouth.connect()

    expect(databaseService.createConfigDatabase)
      .toBeCalledWith(`${config.engine.caching.cacheFolder}/${modbusConfig.dataSourceId}.db`)

    expect(modbusSouth.connected)
      .toBeTruthy()
  })

  it('should properly onScan', async () => {
    const modbusSouth = new Modbus(modbusConfig, engine)

    await modbusSouth.connect()
    modbusSouth.modbusClient = {
      readHoldingRegisters: jest.fn(),
      readInputRegisters: jest.fn(),
      readDiscreteInputs: jest.fn(),
      readCoils: jest.fn(),
    }
    modbusSouth.modbusClient.readHoldingRegisters.mockReturnValue(Promise.resolve([]))
    modbusSouth.modbusClient.readInputRegisters.mockReturnValue(Promise.resolve([]))
    modbusSouth.modbusClient.readDiscreteInputs.mockReturnValue(Promise.resolve([]))
    modbusSouth.modbusClient.readCoils.mockReturnValue(Promise.resolve([]))
    await modbusSouth.onScanImplementation('every10Seconds')

    expect(modbusSouth.modbusClient.readHoldingRegisters)
      .toBeCalledWith(20080, 32) // see the optimizedScanModes to get the startAddress and range
    expect(modbusSouth.modbusClient.readHoldingRegisters)
      .toBeCalledTimes(1) // addresses are in the same group, so it makes one call
  })

  it('should properly disconnect', async () => {
    const modbusSouth = new Modbus(modbusConfig, engine)

    // activate flag connect
    modbusSouth.connected = true
    modbusSouth.socket = { end: jest.fn() }
    modbusSouth.modbusFunction = jest.fn()

    modbusSouth.reconnectTimeout = setTimeout(() => {}, 1000)

    await modbusSouth.disconnect()
    expect(modbusSouth.socket.end)
      .toBeCalled()
    expect(modbusSouth.connected)
      .toBeFalsy()

    await modbusSouth.onScanImplementation()

    expect(modbusSouth.modbusFunction)
      .not
      .toBeCalled()
  })
})
