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
    connect(_connectionObject, callback) { callback() }

    // eslint-disable-next-line class-methods-use-this
    on() { jest.fn() }
  }
  return { Socket }
})
// jest.mock('net')

// Mock logger
jest.mock('../../engine/Logger.class', () => (function logger() {
  return {
    silly: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  }
}))

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
    },
    points: [
      {
        pointId: 'EtatBB2T0',
        address: '0x43E81', // 278145
        type: 'number',
        scanMode: 'every10Seconds',
      },
      {
        pointId: 'EtatBB2T1',
        scanMode: 'every10Seconds',
        address: '278144', // 0x43E80
        type: 'number',
      },
    ],
  }

  const optimizedScanModes = {
    every10Seconds: {
      holdingRegister: {
        '15984-16016': [
          {
            pointId: 'EtatBB2T1',
            address: 16000,
            type: 'number',
          },
          {
            pointId: 'EtatBB2T0',
            address: 16001,
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
  })

  it('should properly connect', async () => {
    databaseService.getConfig.mockReturnValue('1587640141001.0')

    const modbusSouth = new Modbus(modbusConfig, engine)

    await modbusSouth.connect()

    expect(databaseService.createConfigDatabase)
      .toBeCalledWith(`${config.engine.caching.cacheFolder}/${modbusConfig.dataSourceId}.db`)

    expect(modbusSouth.connected).toBeTruthy()
  })

  it('should properly onScan', async () => {
    const modbusSouth = new Modbus(modbusConfig, engine)

    // activate flag connect
    modbusSouth.connected = true
    modbusSouth.socket = { end: jest.fn() }
    modbusSouth.modbusFunction = jest.fn()

    await modbusSouth.onScan('every10Seconds')
    expect(modbusSouth.modbusFunction)
      // eslint-disable-next-line max-len
      .toBeCalledWith('readHoldingRegisters', { rangeSize: 32, startAddress: 15984 }, [{ address: 16000, pointId: 'EtatBB2T1', type: 'number' }, { address: 16001, pointId: 'EtatBB2T0', type: 'number' }])
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
