const Opcua = require('node-opcua')

const OPCUA = require('./OPCUA.class')
const config = require('../../config/defaultConfig.json')
const databaseService = require('../../services/database.service')

// Mock node-opcua
jest.mock('node-opcua', () => ({
  OPCUAClient: { create: jest.fn() },
  MessageSecurityMode: { None: 1 },
  SecurityPolicy: { None: 'http://opcfoundation.org/UA/SecurityPolicy#None' },
}))

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
  jest.useFakeTimers()
})

describe('OPCUA south', () => {
  const opcuaConfig = {
    dataSourceId: 'OPC-UA',
    protocol: 'OPCUA',
    enabled: true,
    startTime: '2020-02-02 02:02:02',
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
    const opcuaSouth = new OPCUA(opcuaConfig, engine)

    expect(opcuaSouth.url).toEqual(opcuaConfig.OPCUA.url)
    expect(opcuaSouth.retryInterval).toEqual(opcuaConfig.OPCUA.retryInterval)
    expect(opcuaSouth.maxReturnValues).toEqual(opcuaConfig.OPCUA.maxReturnValues)
    expect(opcuaSouth.maxReadInterval).toEqual(opcuaConfig.OPCUA.maxReadInterval)
    expect(opcuaSouth.scanGroups).toEqual(opcuaScanGroups)
    expect(Object.keys(opcuaSouth.lastCompletedAt)).toEqual([opcuaConfig.OPCUA.scanGroups[0].scanMode])
    expect(Object.keys(opcuaSouth.ongoingReads)).toEqual([opcuaConfig.OPCUA.scanGroups[0].scanMode])
    expect(opcuaSouth.reconnectTimeout).toBeNull()
  })

  it('should properly connect and set lastCompletedAt from database', async () => {
    databaseService.getConfig.mockReturnValue('1587640141001.0')

    const opcuaSouth = new OPCUA(opcuaConfig, engine)
    opcuaSouth.connectToOpcuaServer = jest.fn()
    await opcuaSouth.connect()

    expect(databaseService.createConfigDatabase).toBeCalledWith(`${config.engine.caching.cacheFolder}/${opcuaConfig.dataSourceId}.db`)
    expect(databaseService.getConfig).toHaveBeenCalledTimes(1)
    expect(opcuaSouth.lastCompletedAt.every10Second).toEqual(1587640141001)
    expect(opcuaSouth.connectToOpcuaServer).toHaveBeenCalledTimes(1)
  })

  it('should properly connect and set lastCompletedAt from config file', async () => {
    databaseService.getConfig.mockReturnValue(null)

    const opcuaSouth = new OPCUA(opcuaConfig, engine)
    opcuaSouth.connectToOpcuaServer = jest.fn()
    await opcuaSouth.connect()

    expect(databaseService.createConfigDatabase).toBeCalledWith(`${config.engine.caching.cacheFolder}/${opcuaConfig.dataSourceId}.db`)
    expect(databaseService.getConfig).toHaveBeenCalledTimes(1)
    expect(opcuaSouth.lastCompletedAt.every10Second).toEqual(new Date(opcuaConfig.startTime).getTime())
    expect(opcuaSouth.connectToOpcuaServer).toHaveBeenCalledTimes(1)
  })

  it('should properly connect and set lastCompletedAt now', async () => {
    databaseService.getConfig.mockReturnValue(null)
    opcuaConfig.originalStartTime = opcuaConfig.startTime
    delete opcuaConfig.startTime

    const opcuaSouth = new OPCUA(opcuaConfig, engine)
    opcuaSouth.connectToOpcuaServer = jest.fn()
    await opcuaSouth.connect()

    expect(databaseService.createConfigDatabase).toBeCalledWith(`${config.engine.caching.cacheFolder}/${opcuaConfig.dataSourceId}.db`)
    expect(databaseService.getConfig).toHaveBeenCalledTimes(1)
    expect(opcuaSouth.lastCompletedAt.every10Second).not.toEqual(new Date(opcuaConfig.originalStartTime).getTime())
    expect(opcuaSouth.connectToOpcuaServer).toHaveBeenCalledTimes(1)
  })

  it('should properly connect to OPC UA server', async () => {
    const expectedOptions = {
      applicationName: 'OIBus',
      connectionStrategy: {
        initialDelay: 1000,
        maxRetry: 1,
      },
      securityMode: Opcua.MessageSecurityMode.None,
      securityPolicy: Opcua.SecurityPolicy.None,
      endpoint_must_exist: false,
    }
    Opcua.OPCUAClient.create.mockReturnValue({
      connect: jest.fn(),
      createSession: jest.fn(),
    })

    const opcuaSouth = new OPCUA(opcuaConfig, engine)
    await opcuaSouth.connect()

    expect(Opcua.OPCUAClient.create).toBeCalledWith(expectedOptions)
    expect(opcuaSouth.client.connect).toBeCalledWith(opcuaConfig.OPCUA.url)
    expect(opcuaSouth.client.createSession).toBeCalledTimes(1)
    expect(opcuaSouth.connected).toBeTruthy()
    expect(setTimeout).not.toBeCalled()
  })

  it('should properly retry connection to OPC UA server', async () => {
    const expectedOptions = {
      applicationName: 'OIBus',
      connectionStrategy: {
        initialDelay: 1000,
        maxRetry: 1,
      },
      securityMode: Opcua.MessageSecurityMode.None,
      securityPolicy: Opcua.SecurityPolicy.None,
      endpoint_must_exist: false,
    }
    Opcua.OPCUAClient.create.mockReturnValue({
      connect: jest.fn(() => Promise.reject()),
      createSession: jest.fn(),
    })

    const opcuaSouth = new OPCUA(opcuaConfig, engine)
    await opcuaSouth.connect()

    expect(Opcua.OPCUAClient.create).toBeCalledWith(expectedOptions)
    expect(opcuaSouth.client.connect).toBeCalledWith(opcuaConfig.OPCUA.url)
    expect(opcuaSouth.client.createSession).not.toBeCalled()
    expect(opcuaSouth.connected).toBeFalsy()
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), opcuaConfig.OPCUA.retryInterval)
  })

  it('should properly handle onScan', async () => {

  })

  it('should properly disconnect when trying to connect', async () => {
    Opcua.OPCUAClient.create.mockReturnValue({
      connect: jest.fn(),
      createSession: jest.fn(),
      disconnect: jest.fn(),
    })

    const opcuaSouth = new OPCUA(opcuaConfig, engine)
    await opcuaSouth.connect()
    opcuaSouth.reconnectTimeout = true
    opcuaSouth.connected = false
    opcuaSouth.session = { close: jest.fn() }
    await opcuaSouth.disconnect()

    expect(clearTimeout).toBeCalled()
    expect(opcuaSouth.session.close).not.toBeCalled()
    expect(opcuaSouth.client.disconnect).not.toBeCalled()
  })

  it('should properly disconnect when connected', async () => {
    Opcua.OPCUAClient.create.mockReturnValue({
      connect: jest.fn(),
      createSession: jest.fn(),
      disconnect: jest.fn(),
    })

    const opcuaSouth = new OPCUA(opcuaConfig, engine)
    await opcuaSouth.connect()
    opcuaSouth.reconnectTimeout = false
    opcuaSouth.connected = true
    opcuaSouth.session = { close: jest.fn() }
    await opcuaSouth.disconnect()

    expect(clearTimeout).not.toBeCalled()
    expect(opcuaSouth.session.close).toBeCalled()
    expect(opcuaSouth.client.disconnect).toBeCalled()
  })
})
