const OPCUA = require('./OPCUA.class')
const config = require('../../config/defaultConfig.json')
const databaseService = require('../../services/database.service')

// Mock database service
jest.mock('../../services/database.service', () => ({
  createConfigDatabase: jest.fn(() => 'configDatabase'),
  getConfig: jest.fn((_database, _key) => '1587640141001.0'),
}))

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
const engine = jest.genMockFromModule('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }

beforeEach(() => {
  jest.resetAllMocks()
})

describe('OPCUA south', () => {
  const opcuaConfig = {
    dataSourceId: 'OPC-UA',
    protocol: 'OPCUA',
    enabled: true,
    OPCUA: {
      maxAge: 10,
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      timeOrigin: 'server',
      maxReturnValues: 10,
      maxReadInterval: 3600,
      scanGroups: [{
        Aggregate: 'Raw',
        resampling: 'None',
        scanMode: 'every10Second',
      }],
    },
    points: [{
      nodeId: 'ns=3;s=Random',
      scanMode: 'every10Second',
    }],
  }

  const opcuaScanGroups = [{
    name: 'every10Second',
    Aggregate: 'Raw',
    resampling: 'None',
    scanMode: 'every10Second',
    points: ['ns=3;s=Random'],
  }]

  it('should be properly initialized', () => {
    const opcua = new OPCUA(opcuaConfig, engine)

    expect(opcua.url).toEqual(opcuaConfig.OPCUA.url)
    expect(opcua.retryInterval).toEqual(opcuaConfig.OPCUA.retryInterval)
    expect(opcua.maxReturnValues).toEqual(opcuaConfig.OPCUA.maxReturnValues)
    expect(opcua.maxReadInterval).toEqual(opcuaConfig.OPCUA.maxReadInterval)
    expect(opcua.scanGroups).toEqual(opcuaScanGroups)
    expect(Object.keys(opcua.lastCompletedAt)).toEqual([opcuaConfig.OPCUA.scanGroups[0].scanMode])
    expect(Object.keys(opcua.ongoingReads)).toEqual([opcuaConfig.OPCUA.scanGroups[0].scanMode])
    expect(opcua.reconnectTimeout).toBeNull()
  })

  it('should properly connect', async () => {
    databaseService.getConfig.mockReturnValue('1587640141001.0')

    const opcua = new OPCUA(opcuaConfig, engine)
    opcua.connectToOpcuaServer = jest.fn()
    await opcua.connect()

    expect(databaseService.createConfigDatabase).toBeCalledWith(`${config.engine.caching.cacheFolder}/${opcuaConfig.dataSourceId}.db`)
    expect(databaseService.getConfig).toHaveBeenCalledTimes(1)
    expect(opcua.lastCompletedAt.every10Second).toEqual(1587640141001)
    expect(opcua.connectToOpcuaServer).toHaveBeenCalledTimes(1)
  })
})
