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
  }

  return { Socket }
})

// Mock logger
jest.mock('../../engine/Logger.class')

// Mock engine
const engine = jest.createMockFromModule('../../engine/Engine.class')
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
        pointId: 'EtatBB2T0',
        modbusType: 'holdingRegister',
        dataType: 'UInt16',
        address: '0x3E80',
        type: 'number',
        scanMode: 'every10Seconds',
      },
      {
        pointId: 'EtatBB2T1',
        modbusType: 'holdingRegister',
        dataType: 'UInt16',
        scanMode: 'every10Seconds',
        address: '0x3E81',
        type: 'number',
      },
    ],
  }

  const optimizedScanModes = {
    every10Seconds: {
      holdingRegister: {
        '15984-16016': [
          {
            pointId: 'EtatBB2T0',
            dataType: 'UInt16',
            address: 16000,
            type: 'number',
          },
          {
            pointId: 'EtatBB2T1',
            dataType: 'UInt16',
            address: 16001,
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
        type: 'number',
        scanMode: 'every10Seconds',
      },
      {
        pointId: 'EtatBB2T1',
        modbusType: 'holdingRegister',
        dataType: 'UInt16',
        scanMode: 'every10Seconds',
        address: '0x3E81',
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
            type: 'number',
          },
          {
            pointId: 'EtatBB2T1',
            dataType: 'UInt16',
            address: 16000,
            type: 'number',
          },
        ],
      },
    },
  }

  const modbusConfigAddressSwapDataAll = {
    dataSourceId: 'Modbus',
    protocol: 'Modbus',
    enabled: true,
    Modbus: {
      port: 502,
      host: '127.0.0.1',
      slaveId: 1,
      addressOffset: 'JBus',
      endianness: 'Big Endian',
      swapBytesinWords: true,
      swapWordsInDWords: true,
    },
    points: [
      {
        pointId: 'EtatBB2T0',
        modbusType: 'holdingRegister',
        dataType: 'Int32',
        address: '0x72',
        type: 'number',
        scanMode: 'every10Seconds',
      },
    ],
  }

  const modbusConfigAddressSwapData16 = {
    dataSourceId: 'Modbus',
    protocol: 'Modbus',
    enabled: true,
    Modbus: {
      port: 502,
      host: '127.0.0.1',
      slaveId: 1,
      addressOffset: 'JBus',
      endianness: 'Big Endian',
      swapBytesinWords: true,
      swapWordsInDWords: false,
    },
    points: [
      {
        pointId: 'EtatBB2T0',
        modbusType: 'holdingRegister',
        dataType: 'Int32',
        address: '0x72',
        type: 'number',
        scanMode: 'every10Seconds',
      },
    ],
  }

  const modbusConfigAddressSwapData32 = {
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
      swapWordsInDWords: true,
    },
    points: [
      {
        pointId: 'EtatBB2T0',
        modbusType: 'holdingRegister',
        dataType: 'Int32',
        address: '0x72',
        type: 'number',
        scanMode: 'every10Seconds',
      },
    ],
  }

  const modbusConfigAddressSwapDataNo = {
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
        dataType: 'Int32',
        address: '0x72',
        type: 'number',
        scanMode: 'every10Seconds',
      },
    ],
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
    modbusSouth.modbusClient = { readHoldingRegisters: jest.fn() }
    modbusSouth.modbusClient.readHoldingRegisters.mockReturnValue(Promise.resolve([]))
    await modbusSouth.onScan('every10Seconds')

    expect(modbusSouth.modbusClient.readHoldingRegisters)
      .toBeCalledWith(15984, 32) // see the optimizedScanModes to get the startAddress and range
    expect(modbusSouth.modbusClient.readHoldingRegisters)
      .toBeCalledTimes(1) // addresses are in the same group, so it makes one call
  })

  it('should properly swap data', async () => {
    let modbusSouth = new Modbus(modbusConfigAddressSwapDataAll, engine)
    await modbusSouth.connect()
    let data = modbusSouth.swapData(432406529)
    expect(data).toEqual(16827929)

    modbusSouth = new Modbus(modbusConfigAddressSwapData16, engine)
    await modbusSouth.connect()
    data = modbusSouth.swapData(432406529)
    expect(data).toEqual(-971439872)

    modbusSouth = new Modbus(modbusConfigAddressSwapData32, engine)
    await modbusSouth.connect()
    data = modbusSouth.swapData(432406529)
    expect(data).toEqual(72134)

    modbusSouth = new Modbus(modbusConfigAddressSwapDataNo, engine)
    await modbusSouth.connect()
    data = modbusSouth.swapData(432406529)
    expect(data).toEqual(432406529)
  })

  it('should properly disconnect', async () => {
    const modbusSouth = new Modbus(modbusConfig, engine)

    // activate flag connect
    modbusSouth.connected = true
    modbusSouth.socket = { end: jest.fn() }
    modbusSouth.modbusFunction = jest.fn()

    await modbusSouth.disconnect()
    expect(modbusSouth.socket.end)
      .toBeCalled()
    expect(modbusSouth.connected)
      .toBeFalsy()

    await modbusSouth.onScan()

    expect(modbusSouth.modbusFunction)
      .not
      .toBeCalled()
  })
})
