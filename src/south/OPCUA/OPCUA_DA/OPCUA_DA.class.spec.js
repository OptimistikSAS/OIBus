const Opcua = require('node-opcua-client')
const OPCUA_DA = require('./OPCUA_DA.class')
const { defaultConfig: config } = require('../../../../tests/testConfig')
const EncryptionService = require('../../../services/EncryptionService.class')

// Mock node-opcua
jest.mock('node-opcua-client', () => ({
  OPCUAClient: { createSession: jest.fn() },
  MessageSecurityMode: { None: 1 },
  SecurityPolicy: { None: 'http://opcfoundation.org/UA/SecurityPolicy#None' },
  UserTokenType: { Anonymous: 0, UserName: 1, Certificate: 2 },
}))
jest.mock('node-opcua-certificate-manager', () => ({ OPCUACertificateManager: jest.fn(() => ({})) }))

// Mock opcua service
jest.mock('../opcua.service', () => ({ initOpcuaCertificateFolders: jest.fn() }))

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock logger
jest.mock('../../../engine/logger/Logger.class')

// Mock engine
const engine = jest.mock('../../../engine/OIBusEngine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.getCacheFolder = () => config.engine.caching.cacheFolder
engine.logger = { error: jest.fn(), info: jest.fn(), trace: jest.fn() }
engine.eventEmitters = {}
engine.engineName = 'Test OPCUA_DA'

// Mock database service used in super constructor
jest.mock('../../../services/database.service', () => ({
  createConfigDatabase: jest.fn(() => 'configDatabase'),
  getConfig: jest.fn((_database, _key) => '2020-08-07T06:48:12.852Z'),
  upsertConfig: jest.fn(),
}))

let opcuaSouth = null
const opcuaConfig = {
  id: 'myConnectorId',
  name: 'OPCUA-DA',
  protocol: 'OPCUA_DA',
  enabled: true,
  startTime: '2020-02-02 02:02:02',
  OPCUA_DA: {
    url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
    retryInterval: 10000,
    username: '',
    password: '',
    securityMode: 'None',
    securityPolicy: 'None',
    keepSessionAlive: false,
    certFile: '',
    keyFile: '',
  },
  points: [{
    pointId: 'Random',
    nodeId: 'ns=3;s=Random',
    scanMode: 'every10Second',
  }],
}

beforeEach(async () => {
  jest.resetAllMocks()
  jest.useFakeTimers()
  opcuaSouth = new OPCUA_DA(opcuaConfig, engine)
  await opcuaSouth.init()
})

describe('OPCUA-DA south', () => {
  it('should be properly initialized', () => {
    expect(opcuaSouth.url).toEqual(opcuaConfig.OPCUA_DA.url)
    expect(opcuaSouth.retryInterval).toEqual(opcuaConfig.OPCUA_DA.retryInterval)
  })

  it('should properly connect to OPC UA server without password', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
    const expectedOptions = {
      applicationName: 'OIBus',
      clientName: 'myConnectorId',
      connectionStrategy: {
        initialDelay: 1000,
        maxRetry: 1,
      },
      securityMode: Opcua.MessageSecurityMode.None,
      securityPolicy: Opcua.SecurityPolicy.None,
      endpointMustExist: false,
      keepSessionAlive: false,
      keepPendingSessionsOnDisconnect: false,
      clientCertificateManager: { state: 2 },
    }
    const expectedUserIdentity = { type: 0 }
    await opcuaSouth.connect()

    expect(Opcua.OPCUAClient.createSession).toBeCalledTimes(1)
    expect(Opcua.OPCUAClient.createSession).toBeCalledWith(opcuaSouth.url, expectedUserIdentity, expectedOptions)
    expect(opcuaSouth.connected).toBeTruthy()
    expect(setTimeoutSpy).not.toBeCalled()
  })

  it('should properly connect to OPC UA server with password', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
    const expectedOptions = {
      applicationName: 'OIBus',
      clientName: 'myConnectorId',
      connectionStrategy: {
        initialDelay: 1000,
        maxRetry: 1,
      },
      securityMode: Opcua.MessageSecurityMode.None,
      securityPolicy: Opcua.SecurityPolicy.None,
      endpointMustExist: false,
      keepSessionAlive: false,
      keepPendingSessionsOnDisconnect: false,
      clientCertificateManager: { state: 2 },
    }
    opcuaSouth.username = 'username'
    opcuaSouth.password = 'password'

    await opcuaSouth.connect()

    delete opcuaConfig.OPCUA_DA.username
    delete opcuaConfig.OPCUA_DA.password
    const expectedUserIdentity = {
      type: 1,
      userName: 'username',
      password: 'password',
    }
    expect(Opcua.OPCUAClient.createSession).toBeCalledWith(opcuaSouth.url, expectedUserIdentity, expectedOptions)
    expect(opcuaSouth.connected).toBeTruthy()
    expect(setTimeoutSpy).not.toBeCalled()
  })

  it('should properly retry connection to OPC UA server', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout')

    Opcua.OPCUAClient.createSession.mockReturnValue(new Promise((resolve, reject) => {
      reject(new Error('test'))
    }))
    await opcuaSouth.connect()

    expect(opcuaSouth.connected).toBeFalsy()
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), opcuaConfig.OPCUA_DA.retryInterval)
  })

  it('should quit onScan if not connected', async () => {
    await opcuaSouth.connect()
    await opcuaSouth.disconnect()
    opcuaSouth.session = { readHistoryValue: jest.fn() }
    await opcuaSouth.lastPointQuery(opcuaConfig.points[0].scanMode)

    expect(opcuaSouth.session.readHistoryValue).not.toBeCalled()
  })

  it('should quit onScan if scanMode has no points to read', async () => {
    const testOpcuaConfig = {
      ...opcuaConfig,
      points: [{
        pointId: 'Random',
        nodeId: 'ns=3;s=Random',
        scanMode: 'every1minute',
      }],
    }

    const opcuaSouthTest = new OPCUA_DA(testOpcuaConfig, engine)
    await opcuaSouthTest.init()
    await opcuaSouthTest.connect()
    opcuaSouthTest.connected = true
    opcuaSouthTest.session = { readVariableValue: jest.fn() }
    await opcuaSouthTest.lastPointQuery(opcuaConfig.points[0].scanMode)

    expect(opcuaSouthTest.session.readVariableValue).not.toBeCalled()
  })

  it('should properly call readVariableValue() and addValues()', async () => {
    const nowDateString = '2020-02-02T02:02:02.222Z'
    const RealDate = Date
    global.Date = jest.fn(() => new RealDate(nowDateString))

    opcuaSouth.connected = true
    opcuaSouth.session = {
      readVariableValue: jest.fn()
        .mockReturnValue([{
          value: { value: 666 },
          statusCode: { value: 0 },
        }]),
    }
    opcuaSouth.addValues = jest.fn()
    await opcuaSouth.lastPointQuery(opcuaConfig.points[0].scanMode)

    expect(opcuaSouth.session.readVariableValue).toBeCalledWith(['ns=3;s=Random'])
    expect(opcuaSouth.addValues).toBeCalledWith([
      {
        data: {
          quality: JSON.stringify({ value: 0 }),
          value: 666,
        },
        pointId: 'Random',
        timestamp: new Date(nowDateString).toISOString(),
      },
    ])

    global.Date = RealDate
  })

  it('should properly disconnect when trying to connect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

    await opcuaSouth.connect()
    opcuaSouth.reconnectTimeout = true
    opcuaSouth.connected = false
    const close = jest.fn()
    opcuaSouth.session = { close }
    await opcuaSouth.disconnect()

    expect(clearTimeoutSpy).toBeCalled()
    expect(close).not.toBeCalled()
  })

  it('should properly disconnect when connected', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

    await opcuaSouth.connect()
    opcuaSouth.reconnectTimeout = false
    opcuaSouth.connected = true
    const close = jest.fn()
    opcuaSouth.session = { close }
    await opcuaSouth.disconnect()

    expect(clearTimeoutSpy).not.toBeCalled()
    expect(close).toBeCalled()
  })
})
