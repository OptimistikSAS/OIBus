const nodeOPCUAClient = require('node-opcua-client')

const OPCUA_DA = require('./OPCUA_DA.class')

const { defaultConfig: config } = require('../../../tests/testConfig')

// Mock node-opcua-client
jest.mock('node-opcua-client', () => ({
  OPCUAClient: { createSession: jest.fn() },
  MessageSecurityMode: { None: 1 },
  SecurityPolicy: { None: 'http://opcfoundation.org/UA/SecurityPolicy#None' },
  UserTokenType: { Anonymous: 0, UserName: 1, Certificate: 2 },
}))
jest.mock('node-opcua-certificate-manager', () => ({ OPCUACertificateManager: jest.fn(() => ({})) }))

// Mock opcua service
jest.mock('../../services/opcua.service', () => ({ initOpcuaCertificateFolders: jest.fn() }))

// Mock certificate service
jest.mock('../../services/CertificateService.class')

// Mock fs
jest.mock('node:fs/promises')

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

const nowDateString = '2020-02-02T02:02:02.222Z'
let settings = null
let south = null

describe('South OPCUA-DA', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    settings = {
      id: 'southId',
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
    south = new OPCUA_DA(settings, engine)
    await south.init()
  })

  it('should be properly initialized', () => {
    expect(south.url).toEqual(settings.OPCUA_DA.url)
    expect(south.retryInterval).toEqual(settings.OPCUA_DA.retryInterval)
  })

  it('should properly connect to OPCUA server without password', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
    const expectedOptions = {
      applicationName: 'OIBus',
      clientName: 'southId',
      connectionStrategy: {
        initialDelay: 1000,
        maxRetry: 1,
      },
      securityMode: nodeOPCUAClient.MessageSecurityMode.None,
      securityPolicy: nodeOPCUAClient.SecurityPolicy.None,
      endpointMustExist: false,
      keepSessionAlive: false,
      keepPendingSessionsOnDisconnect: false,
      clientCertificateManager: { state: 2 },
    }
    const expectedUserIdentity = { type: 0 }
    await south.connect()

    expect(nodeOPCUAClient.OPCUAClient.createSession).toBeCalledTimes(1)
    expect(nodeOPCUAClient.OPCUAClient.createSession).toBeCalledWith(south.url, expectedUserIdentity, expectedOptions)
    expect(south.connected).toBeTruthy()
    expect(setTimeoutSpy).not.toBeCalled()
  })

  it('should properly connect to OPCUA server with password', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
    const expectedOptions = {
      applicationName: 'OIBus',
      clientName: 'southId',
      connectionStrategy: {
        initialDelay: 1000,
        maxRetry: 1,
      },
      securityMode: nodeOPCUAClient.MessageSecurityMode.None,
      securityPolicy: nodeOPCUAClient.SecurityPolicy.None,
      endpointMustExist: false,
      keepSessionAlive: false,
      keepPendingSessionsOnDisconnect: false,
      clientCertificateManager: { state: 2 },
    }
    south.username = 'username'
    south.password = 'password'

    await south.connect()

    delete settings.OPCUA_DA.username
    delete settings.OPCUA_DA.password
    const expectedUserIdentity = {
      type: 1,
      userName: 'username',
      password: 'password',
    }
    expect(nodeOPCUAClient.OPCUAClient.createSession).toBeCalledWith(south.url, expectedUserIdentity, expectedOptions)
    expect(south.connected).toBeTruthy()
    expect(setTimeoutSpy).not.toBeCalled()
  })

  it('should properly connect to OPCUA server with certificate', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
    await south.init()
    const expectedOptions = {
      applicationName: 'OIBus',
      clientName: 'southId',
      connectionStrategy: {
        initialDelay: 1000,
        maxRetry: 1,
      },
      securityMode: nodeOPCUAClient.MessageSecurityMode.None,
      securityPolicy: nodeOPCUAClient.SecurityPolicy.None,
      endpointMustExist: false,
      keepSessionAlive: false,
      keepPendingSessionsOnDisconnect: false,
      clientCertificateManager: { state: 2 },
    }
    south.certificate = {
      privateKey: 'myPrivateKey',
      cert: 'myCert',
    }

    await south.connect()

    delete settings.OPCUA_DA.username
    delete settings.OPCUA_DA.password
    const expectedUserIdentity = {
      type: 2,
      certificateData: 'myCert',
      privateKey: Buffer.from('myPrivateKey', 'utf-8').toString(),
    }
    expect(nodeOPCUAClient.OPCUAClient.createSession).toBeCalledWith(south.url, expectedUserIdentity, expectedOptions)
    expect(south.connected).toBeTruthy()
    expect(setTimeoutSpy).not.toBeCalled()
  })

  it('should properly retry connection to OPCUA server', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout')

    nodeOPCUAClient.OPCUAClient.createSession.mockReturnValue(new Promise((resolve, reject) => {
      reject(new Error('test'))
    }))
    await south.connect()

    expect(south.connected).toBeFalsy()
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), settings.OPCUA_DA.retryInterval)
  })

  it('should quit lastPointQuery if scanMode has no points to read', async () => {
    const testOpcuaConfig = {
      ...settings,
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
    opcuaSouthTest.session = { readVariableValue: jest.fn(), close: jest.fn() }

    await expect(opcuaSouthTest.lastPointQuery('every10Second'))
      .rejects.toThrowError('No points to read for scanMode: "every10Second".')

    expect(opcuaSouthTest.session.readVariableValue).not.toBeCalled()
  })

  it('should properly call readVariableValue() and addValues()', async () => {
    south.connected = true
    south.session = {
      readVariableValue: jest.fn().mockReturnValue([{
        value: { value: 666 },
        statusCode: { value: 0 },
      }]),
    }
    south.addValues = jest.fn()
    await south.lastPointQuery(settings.points[0].scanMode)

    expect(south.session.readVariableValue).toBeCalledWith(['ns=3;s=Random'])
    expect(south.addValues).toBeCalledWith([
      {
        data: {
          quality: JSON.stringify({ value: 0 }),
          value: 666,
        },
        pointId: 'Random',
        timestamp: new Date(nowDateString).toISOString(),
      },
    ])
  })

  it('should properly manage read error', async () => {
    south.connected = true
    south.session = {
      readVariableValue: jest.fn(() => {
        throw new Error('read error')
      }),
      close: jest.fn(),
    }
    south.formatAndSendValues = jest.fn()
    await expect(south.lastPointQuery(settings.points[0].scanMode)).rejects.toThrowError('read error')
  })

  it('should log a message if different number of values and requested nodes', async () => {
    south.connected = true
    south.formatAndSendValues = jest.fn()
    south.session = {
      readVariableValue: jest.fn().mockReturnValue([{
        value: { value: 666 },
        statusCode: { value: 0 },
      },
      {
        value: { value: 666 },
        statusCode: { value: 0 },
      }]),
    }
    await south.lastPointQuery(settings.points[0].scanMode)

    expect(south.session.readVariableValue).toBeCalledWith(['ns=3;s=Random'])
    expect(south.logger.error).toHaveBeenCalledWith('Received 2 data values, requested 1 nodes.')
  })

  it('should properly disconnect when trying to connect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

    await south.connect()
    south.reconnectTimeout = true
    south.connected = false
    const close = jest.fn()
    south.session = { close }
    await south.disconnect()

    expect(clearTimeoutSpy).toBeCalled()
    expect(close).not.toBeCalled()
  })

  it('should properly disconnect when connected', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

    await south.connect()
    south.reconnectTimeout = false
    south.connected = true
    const close = jest.fn()
    south.session = { close }
    await south.disconnect()

    expect(clearTimeoutSpy).not.toBeCalled()
    expect(close).toBeCalled()
  })
})
