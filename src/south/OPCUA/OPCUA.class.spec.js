const Opcua = require('node-opcua')

const OPCUA = require('./OPCUA.class')
const config = require('../../config/defaultConfig.json')
const databaseService = require('../../services/database.service')
const EncryptionService = require('../../services/EncryptionService.class')

// Mock node-opcua
jest.mock('node-opcua', () => ({
  OPCUAClient: { create: jest.fn() },
  MessageSecurityMode: { None: 1 },
  SecurityPolicy: { None: 'http://opcfoundation.org/UA/SecurityPolicy#None' },
  UserTokenType: { UserName: 1 },
}))

// Mock database service
jest.mock('../../services/database.service', () => ({
  createConfigDatabase: jest.fn(() => 'configDatabase'),
  getConfig: jest.fn((_database, _key) => '1587640141001.0'),
  upsertConfig: jest.fn(),
}))

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock logger
jest.mock('../../engine/Logger.class')

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

    expect(opcuaSouth.url)
      .toEqual(opcuaConfig.OPCUA.url)
    expect(opcuaSouth.retryInterval)
      .toEqual(opcuaConfig.OPCUA.retryInterval)
    expect(opcuaSouth.maxReadInterval)
      .toEqual(opcuaConfig.OPCUA.maxReadInterval)
    expect(opcuaSouth.reconnectTimeout)
      .toBeNull()
  })

  it('should properly connect and set lastCompletedAt from database', async () => {
    databaseService.getConfig.mockReturnValue('1587640141001.0')

    const opcuaSouth = new OPCUA(opcuaConfig, engine)
    opcuaSouth.connectToOpcuaServer = jest.fn()
    await opcuaSouth.connect()

    expect(opcuaSouth.scanGroups)
      .toEqual(opcuaScanGroups)
    expect(Object.keys(opcuaSouth.lastCompletedAt))
      .toEqual([opcuaConfig.OPCUA.scanGroups[0].scanMode])
    expect(Object.keys(opcuaSouth.ongoingReads))
      .toEqual([opcuaConfig.OPCUA.scanGroups[0].scanMode])

    expect(databaseService.createConfigDatabase)
      .toBeCalledWith(`${config.engine.caching.cacheFolder}/${opcuaConfig.dataSourceId}.db`)
    expect(databaseService.getConfig)
      .toHaveBeenCalledTimes(1)
    expect(opcuaSouth.lastCompletedAt.every10Second)
      .toEqual(1587640141001)
    expect(opcuaSouth.connectToOpcuaServer)
      .toHaveBeenCalledTimes(1)
  })

  it('should properly connect and set lastCompletedAt from config file', async () => {
    databaseService.getConfig.mockReturnValue(null)

    const opcuaSouth = new OPCUA(opcuaConfig, engine)
    opcuaSouth.connectToOpcuaServer = jest.fn()
    await opcuaSouth.connect()

    expect(databaseService.createConfigDatabase)
      .toBeCalledWith(`${config.engine.caching.cacheFolder}/${opcuaConfig.dataSourceId}.db`)
    expect(databaseService.getConfig)
      .toHaveBeenCalledTimes(1)
    expect(opcuaSouth.lastCompletedAt.every10Second)
      .toEqual(new Date(opcuaConfig.startTime).getTime())
    expect(opcuaSouth.connectToOpcuaServer)
      .toHaveBeenCalledTimes(1)
  })

  it('should properly connect and set lastCompletedAt now', async () => {
    databaseService.getConfig.mockReturnValue(null)
    opcuaConfig.originalStartTime = opcuaConfig.startTime
    delete opcuaConfig.startTime

    const opcuaSouth = new OPCUA(opcuaConfig, engine)
    opcuaSouth.connectToOpcuaServer = jest.fn()
    await opcuaSouth.connect()

    expect(databaseService.createConfigDatabase)
      .toBeCalledWith(`${config.engine.caching.cacheFolder}/${opcuaConfig.dataSourceId}.db`)
    expect(databaseService.getConfig)
      .toHaveBeenCalledTimes(1)
    expect(opcuaSouth.lastCompletedAt.every10Second)
      .not
      .toEqual(new Date(opcuaConfig.originalStartTime).getTime())
    expect(opcuaSouth.connectToOpcuaServer)
      .toHaveBeenCalledTimes(1)
  })

  it('should properly connect to OPC UA server without password', async () => {
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

    expect(Opcua.OPCUAClient.create)
      .toBeCalledWith(expectedOptions)
    expect(opcuaSouth.client.connect)
      .toBeCalledWith(opcuaConfig.OPCUA.url)
    expect(opcuaSouth.client.createSession)
      .toBeCalledTimes(1)
    expect(opcuaSouth.connected)
      .toBeTruthy()
    expect(setTimeout)
      .not
      .toBeCalled()
  })

  it('should properly connect to OPC UA server with password', async () => {
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
    opcuaConfig.OPCUA.username = 'username'
    opcuaConfig.OPCUA.password = 'password'

    const opcuaSouth = new OPCUA(opcuaConfig, engine)
    await opcuaSouth.connect()

    delete opcuaConfig.OPCUA.username
    delete opcuaConfig.OPCUA.password
    const expectedUserIdentity = {
      type: 1,
      userName: 'username',
      password: 'password',
    }
    expect(Opcua.OPCUAClient.create)
      .toBeCalledWith(expectedOptions)
    expect(opcuaSouth.client.connect)
      .toBeCalledWith(opcuaConfig.OPCUA.url)
    expect(opcuaSouth.client.createSession)
      .toBeCalledWith(expectedUserIdentity)
    expect(opcuaSouth.connected)
      .toBeTruthy()
    expect(setTimeout)
      .not
      .toBeCalled()
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

    expect(Opcua.OPCUAClient.create)
      .toBeCalledWith(expectedOptions)
    expect(opcuaSouth.client.connect)
      .toBeCalledWith(opcuaConfig.OPCUA.url)
    expect(opcuaSouth.client.createSession)
      .not
      .toBeCalled()
    expect(opcuaSouth.connected)
      .toBeFalsy()
    expect(setTimeout)
      .toHaveBeenLastCalledWith(expect.any(Function), opcuaConfig.OPCUA.retryInterval)
  })

  it('should quit onScan if not connected', async () => {
    databaseService.getConfig.mockReturnValue('1587640141001.0')

    const opcuaSouth = new OPCUA(opcuaConfig, engine)
    await opcuaSouth.connect()
    await opcuaSouth.disconnect()
    opcuaSouth.session = { readHistoryValue: jest.fn() }
    await opcuaSouth.onScan(opcuaConfig.OPCUA.scanGroups[0].scanMode)

    expect(opcuaSouth.session.readHistoryValue)
      .not
      .toBeCalled()
  })

  it('should quit onScan if previous read did not complete', async () => {
    databaseService.getConfig.mockReturnValue('1587640141001.0')

    const opcuaSouth = new OPCUA(opcuaConfig, engine)
    await opcuaSouth.connect()
    opcuaSouth.connected = true
    opcuaSouth.ongoingReads[opcuaConfig.OPCUA.scanGroups[0].scanMode] = true
    opcuaSouth.session = { readHistoryValue: jest.fn() }
    await opcuaSouth.onScan(opcuaConfig.OPCUA.scanGroups[0].scanMode)

    expect(opcuaSouth.session.readHistoryValue)
      .not
      .toBeCalled()
  })

  it('should quit onScan if scan group has no points to read', async () => {
    databaseService.getConfig.mockReturnValue('1587640141001.0')
    const testOpcuaConfig = {
      ...opcuaConfig,
      points: [{
        nodeId: 'ns=3;s=Random',
        scanMode: 'every1minute',
      }],
    }
    const opcuaSouth = new OPCUA(testOpcuaConfig, engine)
    await opcuaSouth.connect()
    opcuaSouth.connected = true
    opcuaSouth.ongoingReads[opcuaConfig.OPCUA.scanGroups[0].scanMode] = false
    opcuaSouth.session = { readHistoryValue: jest.fn() }
    await opcuaSouth.onScan(opcuaConfig.OPCUA.scanGroups[0].scanMode)

    expect(opcuaSouth.session.readHistoryValue)
      .not
      .toBeCalled()
  })

  it('should in onScan call readHistoryValue once if maxReadInterval is bigger than the read interval', async () => {
    const startDate = new Date('2020-02-02T02:02:02.222Z')
    const nowDate = new Date('2020-02-03T02:02:02.222Z')
    const sampleDate = new Date('2020-02-12T02:02:02.222Z')
    const sampleValue = 666.666
    const dataValues = [[{
      serverTimestamp: sampleDate,
      value: { value: sampleValue },
      statusCode: { value: 0 },
    }]]

    databaseService.getConfig.mockReturnValue(`${startDate.getTime()}.0`)
    databaseService.createConfigDatabase.mockReturnValue('configDatabase')
    const opcuaSouth = new OPCUA(opcuaConfig, engine)
    await opcuaSouth.connect()

    opcuaSouth.maxReadInterval = 24 * 60 * 60
    opcuaSouth.maxReturnValues = 1000
    opcuaSouth.readTimeout = 600000
    opcuaSouth.connected = true
    opcuaSouth.ongoingReads[opcuaConfig.OPCUA.scanGroups[0].scanMode] = false
    opcuaSouth.readHistoryValue = jest.fn().mockReturnValue(Promise.resolve(dataValues))
    opcuaSouth.addValues = jest.fn()
    opcuaSouth.delay = jest.fn()

    const RealDate = Date
    global.Date = jest.fn((dateParam) => {
      if (dateParam) {
        return new RealDate(dateParam)
      }
      return nowDate
    })
    global.Date.getTime = jest.fn(() => RealDate.getTime)
    await opcuaSouth.onScan(opcuaConfig.OPCUA.scanGroups[0].scanMode)
    global.Date = RealDate

    const expectedValue = {
      pointId: opcuaConfig.points[0].nodeId,
      timestamp: sampleDate.toISOString(),
      data: {
        value: sampleValue,
        quality: '{"value":0}',
      },
    }
    expect(opcuaSouth.readHistoryValue)
      .toBeCalledTimes(1)
    expect(opcuaSouth.readHistoryValue)
      .toBeCalledWith([opcuaConfig.points[0].nodeId], startDate, nowDate, { numValuesPerNode: 1000, timeout: 600000 })
    expect(opcuaSouth.addValues)
      .toBeCalledTimes(1)
    expect(opcuaSouth.addValues)
      .toBeCalledWith([expectedValue])
    expect(databaseService.upsertConfig)
      .toBeCalledWith(
        'configDatabase',
        `lastCompletedAt-${opcuaConfig.OPCUA.scanGroups[0].scanMode}`,
        sampleDate.getTime() + 1,
      )
    expect(opcuaSouth.ongoingReads[opcuaConfig.OPCUA.scanGroups[0].scanMode])
      .toBeFalsy()
    expect(opcuaSouth.delay).not.toBeCalled()
  })

  it('should in onScan call readHistoryValue multiple times if maxReadInterval is smaller than the read interval', async () => {
    const startDate = new Date()
    startDate.setTime(startDate.getTime() - (8000 * 1000))

    databaseService.getConfig.mockReturnValue(`${startDate.getTime()}.0`)
    const opcuaSouth = new OPCUA(opcuaConfig, engine)
    await opcuaSouth.connect()

    opcuaSouth.maxReadInterval = 3600
    opcuaSouth.readIntervalDelay = 200
    opcuaSouth.connected = true
    opcuaSouth.ongoingReads[opcuaConfig.OPCUA.scanGroups[0].scanMode] = false
    opcuaSouth.readHistoryValue = jest.fn()
    opcuaSouth.readHistoryValue.mockReturnValue(Promise.resolve([]))
    opcuaSouth.addValues = jest.fn()
    opcuaSouth.delay = jest.fn().mockReturnValue(Promise.resolve())

    await opcuaSouth.onScan(opcuaConfig.OPCUA.scanGroups[0].scanMode)

    expect(opcuaSouth.readHistoryValue)
      .toBeCalledTimes(3)
    expect(opcuaSouth.delay).toBeCalledTimes(2)
    expect(opcuaSouth.delay.mock.calls).toEqual([[200], [200]])
  })

  it('should in onScan call check if readHistoryValue returns the requested number of node IDs', async () => {
    const startDate = new Date('2020-02-02T02:02:02.222Z')

    databaseService.getConfig.mockReturnValue(`${startDate.getTime()}.0`)
    databaseService.createConfigDatabase.mockReturnValue('configDatabase')
    const opcuaSouth = new OPCUA(opcuaConfig, engine)
    await opcuaSouth.connect()

    opcuaSouth.maxReadInterval = 24 * 60 * 60 * 1000
    opcuaSouth.connected = true
    opcuaSouth.ongoingReads[opcuaConfig.OPCUA.scanGroups[0].scanMode] = false
    opcuaSouth.readHistoryValue = jest.fn()
    opcuaSouth.readHistoryValue.mockReturnValue(Promise.resolve([]))
    opcuaSouth.addValues = jest.fn()

    await opcuaSouth.onScan(opcuaConfig.OPCUA.scanGroups[0].scanMode)

    expect(opcuaSouth.readHistoryValue)
      .toBeCalledTimes(1)
    expect(opcuaSouth.logger.error)
      .toHaveBeenCalledWith('received 0, requested 1')
  })

  it('should onScan catch errors', async () => {
    const opcuaSouth = new OPCUA(opcuaConfig, engine)
    await opcuaSouth.connect()
    opcuaSouth.connected = true
    opcuaSouth.ongoingReads[opcuaConfig.OPCUA.scanGroups[0].scanMode] = false
    opcuaSouth.readHistoryValue = jest.fn()
    opcuaSouth.readHistoryValue.mockReturnValue(Promise.reject(new Error('fail')))
    await opcuaSouth.onScan(opcuaConfig.OPCUA.scanGroups[0].scanMode)

    expect(opcuaSouth.readHistoryValue)
      .toBeCalled()
    expect(opcuaSouth.logger.error)
      .toHaveBeenCalled()
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

    expect(clearTimeout)
      .toBeCalled()
    expect(opcuaSouth.session.close)
      .not
      .toBeCalled()
    expect(opcuaSouth.client.disconnect)
      .not
      .toBeCalled()
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

    expect(clearTimeout)
      .not
      .toBeCalled()
    expect(opcuaSouth.session.close)
      .toBeCalled()
    expect(opcuaSouth.client.disconnect)
      .toBeCalled()
  })
})
