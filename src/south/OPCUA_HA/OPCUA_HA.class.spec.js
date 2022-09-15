const nodeOPCUAClient = require('node-opcua-client')

const OPCUA_HA = require('./OPCUA_HA.class')

const databaseService = require('../../services/database.service')

const { defaultConfig: config } = require('../../../tests/testConfig')

// Mock node-opcua-client
jest.mock('node-opcua-client', () => ({
  OPCUAClient: { createSession: jest.fn() },
  MessageSecurityMode: { None: 1 },
  StatusCodes: { Good: 0 },
  SecurityPolicy: { None: 'http://opcfoundation.org/UA/SecurityPolicy#None' },
  UserTokenType: { Anonymous: 0, UserName: 1, Certificate: 2 },
  TimestampsToReturn: { Both: 2 },
  ReadRawModifiedDetails: jest.fn(() => ({})),
  HistoryReadRequest: jest.fn(() => ({ requestHeader: {} })),
  ReadProcessedDetails: jest.fn(() => ({})),
}))
jest.mock('node-opcua-certificate-manager', () => ({ OPCUACertificateManager: jest.fn(() => ({})) }))

// Mock fs
jest.mock('node:fs/promises')

// Mock opcua service
jest.mock('../../services/opcua.service', () => ({ initOpcuaCertificateFolders: jest.fn() }))

// Mock certificate service
jest.mock('../../services/CertificateService.class')

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

describe('South OPCUA-HA', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers()

    settings = {
      id: 'southId',
      name: 'OPCUA-HA',
      protocol: 'OPCUA_HA',
      enabled: true,
      startTime: '2020-02-02 02:02:02',
      OPCUA_HA: {
        url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
        retryInterval: 10000,
        maxReadInterval: 3600,
        readIntervalDelay: 200,
        maxReturnValues: 1000,
        readTimeout: 180000,
        username: '',
        password: '',
        securityMode: 'None',
        securityPolicy: 'None',
        keepSessionAlive: false,
        certFile: '',
        keyFile: '',
        scanGroups: [{
          aggregate: 'Raw',
          resampling: 'None',
          scanMode: 'every10Second',
        }],
      },
      points: [{
        pointId: 'Random',
        nodeId: 'ns=3;s=Random',
        scanMode: 'every10Second',
      }],
    }
    south = new OPCUA_HA(settings, engine)
  })

  it('should be properly initialized', async () => {
    await south.init()
    expect(south.url).toEqual(settings.OPCUA_HA.url)
    expect(south.retryInterval).toEqual(settings.OPCUA_HA.retryInterval)
    expect(south.maxReadInterval).toEqual(settings.OPCUA_HA.maxReadInterval)
    expect(south.reconnectTimeout).toBeNull()
    expect(south.clientCertificateManager.state).toEqual(2)

    // Test no new certificate manager creation
    south.clientCertificateManager.state = -1
    await south.init()
    expect(south.clientCertificateManager.state).toEqual(-1)
  })

  it('should properly connect', async () => {
    south.connectToOpcuaServer = jest.fn()
    const close = jest.fn()
    south.session = { close }

    await south.connect()

    expect(south.connectToOpcuaServer).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)

    close.mockClear()
    south.session = null
    await south.connect()
    expect(close).toHaveBeenCalledTimes(0)
  })

  it('should properly connect to OPC UA server without password', async () => {
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

    await south.init()
    await south.connectToOpcuaServer()

    expect(south.connected).toBeTruthy()
    expect(nodeOPCUAClient.OPCUAClient.createSession).toBeCalledWith(south.url, expectedUserIdentity, expectedOptions)
    expect(setTimeoutSpy).not.toBeCalled()
  })

  it('should properly connect to OPC UA server with password', async () => {
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

    await south.init()
    await south.connect()

    delete settings.OPCUA_HA.username
    delete settings.OPCUA_HA.password
    const expectedUserIdentity = {
      type: 1,
      userName: 'username',
      password: 'password',
    }
    expect(nodeOPCUAClient.OPCUAClient.createSession).toBeCalledWith(south.url, expectedUserIdentity, expectedOptions)
    expect(south.connected).toBeTruthy()
    expect(setTimeoutSpy).not.toBeCalled()
  })

  it('should properly connect to OPC UA server with certificate', async () => {
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

    delete settings.OPCUA_HA.username
    delete settings.OPCUA_HA.password
    const expectedUserIdentity = {
      type: 2,
      certificateData: 'myCert',
      privateKey: Buffer.from('myPrivateKey', 'utf-8').toString(),
    }
    expect(nodeOPCUAClient.OPCUAClient.createSession).toBeCalledWith(south.url, expectedUserIdentity, expectedOptions)
    expect(south.connected).toBeTruthy()
    expect(setTimeoutSpy).not.toBeCalled()
  })

  it('should properly format and sent values', async () => {
    await south.init()
    south.addValues = jest.fn()
    const startTime = new Date('2020-01-01T00:00:00.000Z')

    const nodesToRead = [
      { pointId: 'point1' },
      { pointId: 'point2' },
    ]
    const valuesToFormat = [
      [{
        sourceTimestamp: new Date('2020-01-01T00:00:00.000Z'),
        value: { value: 1 },
        statusCode: 0,
      },
      {
        sourceTimestamp: new Date('2022-01-01T00:00:00.000Z'),
        value: { value: 2 },
        statusCode: 0,
      },
      {
        sourceTimestamp: new Date('2021-01-01T00:00:00.000Z'),
        value: { value: 3 },
        statusCode: 0,
      }],
      [
        {
          serverTimestamp: new Date('2019-01-01T00:00:00.000Z'),
          value: { value: 0 },
          statusCode: 0,
        },
        {
          serverTimestamp: new Date('2020-01-01T00:00:00.000Z'),
          value: { value: 1 },
          statusCode: 0,
        },
        {
          serverTimestamp: new Date('2022-01-01T00:00:00.000Z'),
          value: { value: 2 },
          statusCode: 0,
        },
        {
          serverTimestamp: new Date('2021-01-01T00:00:00.000Z'),
          value: { value: 3 },
          statusCode: 0,
        }],
    ]

    const expectValues = [
      {
        pointId: 'point1',
        timestamp: new Date('2020-01-01T00:00:00.000Z').toISOString(),
        data: {
          value: 1,
          quality: '0',
        },
      },
      {
        pointId: 'point1',
        timestamp: new Date('2022-01-01T00:00:00.000Z').toISOString(),
        data: {
          value: 2,
          quality: '0',
        },
      },
      {
        pointId: 'point1',
        timestamp: new Date('2021-01-01T00:00:00.000Z').toISOString(),
        data: {
          value: 3,
          quality: '0',
        },
      },
      {
        pointId: 'point2',
        timestamp: new Date('2020-01-01T00:00:00.000Z').toISOString(),
        data: {
          value: 1,
          quality: '0',
        },
      },
      {
        pointId: 'point2',
        timestamp: new Date('2022-01-01T00:00:00.000Z').toISOString(),
        data: {
          value: 2,
          quality: '0',
        },
      },
      {
        pointId: 'point2',
        timestamp: new Date('2021-01-01T00:00:00.000Z').toISOString(),
        data: {
          value: 3,
          quality: '0',
        },
      },
    ]
    await south.formatAndSendValues(valuesToFormat, nodesToRead, startTime, 'myScanMode')

    expect(south.logger.debug).toHaveBeenCalledWith('Received 3 new values for point2 among 4 values retrieved.')

    expect(south.addValues).toHaveBeenCalledWith(expectValues)
    expect(south.logger.debug).toHaveBeenCalledWith('Updated lastCompletedAt for "myScanMode" to 2022-01-01T00:00:00.001Z.')
  })

  it('should properly read history value with response error', async () => {
    await south.init()
    const isNot = jest.fn(() => true)
    south.session = {
      performMessageTransaction: jest.fn(() => ({
        responseHeader: {
          serviceResult: {
            isNot,
            description: 'message transaction error',
          },
        },
      })),
    }
    const nodesToRead = []
    const startTime = new Date('2020-01-01T00:00:00.000Z')
    const endTime = new Date('2021-01-01T00:00:00.000Z')

    await south.readHistoryValue(nodesToRead, startTime, endTime, {})
    expect(south.session.performMessageTransaction).toHaveBeenCalledTimes(2)
    expect(isNot).toHaveBeenCalledTimes(2)
    expect(south.logger.error).toHaveBeenCalledWith('No result found in response.')
    expect(south.logger.error).toHaveBeenCalledWith('Error while reading history: message transaction error')
    expect(south.logger.error).toHaveBeenCalledWith('Error while releasing continuation points: message transaction error')
  })

  it('should properly read history value with response success', async () => {
    await south.init()
    const isNot = jest.fn(() => true)
    south.session = {
      performMessageTransaction: jest.fn(() => ({
        responseHeader: { serviceResult: { isNot } },
        results: [{
          historyData: { dataValues: [] },
          statusCode: { value: 0, description: 'Good' },
          continuationPoint: undefined,
        },
        {
          historyData: { dataValues: [] },
          statusCode: { value: 1, description: 'Bad' },
          continuationPoint: undefined,
        },
        {
          historyData: { dataValues: [] },
          statusCode: { value: 1, description: 'Bad' },
          continuationPoint: undefined,
        },
        ],
      })),
    }
    const nodesToRead = [
      { nodeId: 'point1' },
      { nodeId: 'point2' },
      { nodeId: 'point3' },
    ]
    const startTime = new Date('2020-01-01T00:00:00.000Z')
    const endTime = new Date('2021-01-01T00:00:00.000Z')

    await south.readHistoryValue(nodesToRead, startTime, endTime, {})
    expect(south.session.performMessageTransaction).toHaveBeenCalledTimes(2)
    expect(isNot).toHaveBeenCalledTimes(2)
    expect(south.logger.debug).toHaveBeenCalledWith('Received a response of 3 nodes.')
    expect(south.logger.debug).toHaveBeenCalledWith('Bad with status code 1: [point2,point3]')
  })

  it('should returns the requested number of node IDs after historyQuery', async () => {
    databaseService.getConfig.mockReturnValue('2020-02-02T02:02:02.222Z')
    databaseService.createConfigDatabase.mockReturnValue('configDatabase')
    await south.init()
    await south.connect()

    south.maxReadInterval = 24 * 60 * 60 * 1000
    south.connected = true
    south.currentlyOnScan[settings.OPCUA_HA.scanGroups[0].scanMode] = 0
    south.readHistoryValue = jest.fn()
    south.readHistoryValue.mockReturnValue(Promise.resolve([]))
    south.addValues = jest.fn()

    await south.historyQuery(settings.OPCUA_HA.scanGroups[0].scanMode, new Date(), new Date())

    expect(south.readHistoryValue).toBeCalledTimes(1)
    expect(south.logger.error).toHaveBeenCalledWith('Received 0 data values, requested 1 nodes.')
  })

  it('should catch historyQuery errors', async () => {
    await south.init()
    await south.connect()
    south.connected = true
    south.currentlyOnScan[settings.OPCUA_HA.scanGroups[0].scanMode] = 0
    south.readHistoryValue = jest.fn()
    south.readHistoryValue.mockReturnValue(Promise.reject(new Error('fail')))
    south.session = { close: jest.fn() }
    await expect(south.historyQueryHandler(settings.OPCUA_HA.scanGroups[0].scanMode, new Date(), new Date())).rejects.toThrowError('fail')
  })

  it('should properly disconnect when trying to connect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

    await south.init()
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

    await south.init()
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
