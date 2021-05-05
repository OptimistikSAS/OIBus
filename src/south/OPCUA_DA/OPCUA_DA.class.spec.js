const Opcua = require('node-opcua')

const OPCUA_DA = require('./OPCUA_DA.class')
const config = require('../../config/defaultConfig.json')
const EncryptionService = require('../../services/EncryptionService.class')

// Mock node-opcua
jest.mock('node-opcua', () => ({
  OPCUAClient: { create: jest.fn() },
  MessageSecurityMode: { None: 1 },
  SecurityPolicy: { None: 'http://opcfoundation.org/UA/SecurityPolicy#None' },
  UserTokenType: { UserName: 1 },
}))

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock logger
jest.mock('../../engine/Logger.class')

// Mock engine
const engine = jest.genMockFromModule('../../engine/OIBusEngine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }

beforeEach(() => {
  jest.resetAllMocks()
  jest.useFakeTimers()
})

describe('OPCUA-DA south', () => {
  const opcuaConfig = {
    dataSourceId: 'OPCUA-DA',
    protocol: 'OPCUA_DA',
    enabled: true,
    startTime: '2020-02-02 02:02:02',
    OPCUA_DA: {
      maxAge: 10,
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      timeOrigin: 'server',
      maxReadInterval: 3600,
    },
    points: [{
      nodeId: 'ns=3;s=Random',
      scanMode: 'every10Second',
    }],
  }

  it('should be properly initialized', () => {
    const opcuaSouth = new OPCUA_DA(opcuaConfig, engine)

    expect(opcuaSouth.url)
      .toEqual(opcuaConfig.OPCUA_DA.url)
    expect(opcuaSouth.retryInterval)
      .toEqual(opcuaConfig.OPCUA_DA.retryInterval)
  })

  it('should properly connect and set lastCompletedAt from database', async () => {
    const opcuaSouth = new OPCUA_DA(opcuaConfig, engine)
    opcuaSouth.connectToOpcuaServer = jest.fn()
    await opcuaSouth.connect()

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

    const opcuaSouth = new OPCUA_DA(opcuaConfig, engine)
    await opcuaSouth.connect()

    expect(Opcua.OPCUAClient.create)
      .toBeCalledWith(expectedOptions)
    expect(opcuaSouth.client.connect)
      .toBeCalledWith(opcuaConfig.OPCUA_DA.url)
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
    opcuaConfig.OPCUA_DA.username = 'username'
    opcuaConfig.OPCUA_DA.password = 'password'

    const opcuaSouth = new OPCUA_DA(opcuaConfig, engine)
    await opcuaSouth.connect()

    delete opcuaConfig.OPCUA_DA.username
    delete opcuaConfig.OPCUA_DA.password
    const expectedUserIdentity = {
      type: 1,
      userName: 'username',
      password: 'password',
    }
    expect(Opcua.OPCUAClient.create)
      .toBeCalledWith(expectedOptions)
    expect(opcuaSouth.client.connect)
      .toBeCalledWith(opcuaConfig.OPCUA_DA.url)
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

    const opcuaSouth = new OPCUA_DA(opcuaConfig, engine)
    await opcuaSouth.connect()

    expect(Opcua.OPCUAClient.create)
      .toBeCalledWith(expectedOptions)
    expect(opcuaSouth.client.connect)
      .toBeCalledWith(opcuaConfig.OPCUA_DA.url)
    expect(opcuaSouth.client.createSession)
      .not
      .toBeCalled()
    expect(opcuaSouth.connected)
      .toBeFalsy()
    expect(setTimeout)
      .toHaveBeenLastCalledWith(expect.any(Function), opcuaConfig.OPCUA_DA.retryInterval)
  })

  it('should quit onScan if not connected', async () => {
    const opcuaSouth = new OPCUA_DA(opcuaConfig, engine)
    await opcuaSouth.connect()
    await opcuaSouth.disconnect()
    opcuaSouth.session = { readHistoryValue: jest.fn() }
    await opcuaSouth.onScan(opcuaConfig.points[0].scanMode)

    expect(opcuaSouth.session.readHistoryValue)
      .not
      .toBeCalled()
  })

  it('should quit onScan if scanMode has no points to read', async () => {
    const testOpcuaConfig = {
      ...opcuaConfig,
      points: [{
        nodeId: 'ns=3;s=Random',
        scanMode: 'every1minute',
      }],
    }
    const opcuaSouth = new OPCUA_DA(testOpcuaConfig, engine)
    await opcuaSouth.connect()
    opcuaSouth.connected = true
    opcuaSouth.session = { readVariableValue: jest.fn() }
    await opcuaSouth.onScan(opcuaConfig.points[0].scanMode)

    expect(opcuaSouth.session.readVariableValue)
      .not
      .toBeCalled()
  })

  it('should properly call readVariableValue() and addValues()', async () => {
    const nowDateString = '2020-02-02T02:02:02.222Z'
    const RealDate = Date
    global.Date = jest.fn(() => new RealDate(nowDateString))

    const opcuaSouth = new OPCUA_DA(opcuaConfig, engine)
    opcuaSouth.connected = true
    opcuaSouth.session = {
      readVariableValue: jest.fn()
        .mockReturnValue([{
          value: { value: 666 },
          statusCode: { value: 0 },
        }]),
    }
    opcuaSouth.addValues = jest.fn()
    await opcuaSouth.onScan(opcuaConfig.points[0].scanMode)

    expect(opcuaSouth.session.readVariableValue)
      .toBeCalledWith(['ns=3;s=Random'])
    expect(opcuaSouth.addValues)
      .toBeCalledWith([
        {
          data: {
            quality: JSON.stringify({ value: 0 }),
            value: 666,
          },
          pointId: 'ns=3;s=Random',
          timestamp: new Date(nowDateString).toISOString(),
        },
      ])

    global.Date = RealDate
  })

  it('should properly disconnect when trying to connect', async () => {
    Opcua.OPCUAClient.create.mockReturnValue({
      connect: jest.fn(),
      createSession: jest.fn(),
      disconnect: jest.fn(),
    })

    const opcuaSouth = new OPCUA_DA(opcuaConfig, engine)
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

    const opcuaSouth = new OPCUA_DA(opcuaConfig, engine)
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
