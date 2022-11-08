const nodeOPCUAClient = require('node-opcua-client')

const { HistoryReadRequest, TimestampsToReturn, ReadProcessedDetails, AggregateFunction, StatusCodes } = require('node-opcua-client')
const OPCUA_HA = require('./south-opcua-ha')

const databaseService = require('../../service/database.service')

// Mock node-opcua-client
jest.mock('node-opcua-client', () => ({
  OPCUAClient: { createSession: jest.fn() },
  MessageSecurityMode: { None: 1 },
  StatusCodes: jest.requireActual('node-opcua-client').StatusCodes,
  SecurityPolicy: jest.requireActual('node-opcua-client').SecurityPolicy,
  UserTokenType: jest.requireActual('node-opcua-client').UserTokenType,
  TimestampsToReturn: jest.requireActual('node-opcua-client').TimestampsToReturn,
  AggregateFunction: jest.requireActual('node-opcua-client').AggregateFunction,
  ReadRawModifiedDetails: jest.fn(() => ({})),
  HistoryReadRequest: jest.requireActual('node-opcua-client').HistoryReadRequest,
  ReadProcessedDetails: jest.fn(() => ({})),
}))
jest.mock('node-opcua-certificate-manager', () => ({ OPCUACertificateManager: jest.fn(() => ({})) }))

// Mock fs
jest.mock('node:fs/promises')

// Mock opcua service
jest.mock('../../service/opcua.service')

// Mock certificate service
jest.mock('../../service/certificate.service')

const addValues = jest.fn()
const addFiles = jest.fn()

// Mock services
jest.mock('../../service/database.service')
jest.mock('../../service/logger/logger.service')
jest.mock('../../service/status.service')
jest.mock('../../service/encryption.service', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))

let configuration = null
let south = null

describe('SouthOPCUAHA', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers()

    configuration = {
      id: 'southId',
      name: 'OPCUA-HA',
      type: 'OPCUA_HA',
      enabled: true,
      startTime: '2020-02-02 02:02:02',
      settings: {
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
    south = new OPCUA_HA(configuration, addValues, addFiles)
  })

  it('should be properly initialized', async () => {
    await south.start('baseFolder', 'oibusName', {})
    expect(south.url).toEqual(configuration.settings.url)
    expect(south.retryInterval).toEqual(configuration.settings.retryInterval)
    expect(south.maxReadInterval).toEqual(configuration.settings.maxReadInterval)
    expect(south.reconnectTimeout).toBeNull()
    expect(south.clientCertificateManager.state).toEqual(2)

    // Test no new certificate manager creation
    south.clientCertificateManager.state = -1
    await south.start('baseFolder', 'oibusName', {})
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

    await south.start('baseFolder', 'oibusName', {})
    await south.connectToOpcuaServer()

    expect(south.connected).toBeTruthy()
    expect(nodeOPCUAClient.OPCUAClient.createSession).toBeCalledWith(south.url, expectedUserIdentity, expectedOptions)
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

    await south.start('baseFolder', 'oibusName', {})
    await south.connect()

    delete configuration.settings.username
    delete configuration.settings.password
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
    await south.start('baseFolder', 'oibusName', {})
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

    delete configuration.settings.username
    delete configuration.settings.password
    const expectedUserIdentity = {
      type: 2,
      certificateData: 'myCert',
      privateKey: Buffer.from('myPrivateKey', 'utf-8').toString(),
    }
    expect(nodeOPCUAClient.OPCUAClient.createSession).toBeCalledWith(south.url, expectedUserIdentity, expectedOptions)
    expect(south.connected).toBeTruthy()
    expect(setTimeoutSpy).not.toBeCalled()
  })

  it('should properly manage connection error', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
    nodeOPCUAClient.OPCUAClient.createSession.mockImplementation(() => {
      throw new Error('connection error')
    })

    await south.start('baseFolder', 'oibusName', {})
    await south.connectToOpcuaServer()

    expect(south.connected).toBeFalsy()
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), configuration.settings.retryInterval)
    expect(south.logger.error).toHaveBeenCalledWith(new Error('connection error'))
  })

  it('should properly format and sent values', async () => {
    await south.start('baseFolder', 'oibusName', {})
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

  it('should log a message when zero value is received', async () => {
    await south.start('baseFolder', 'oibusName', {})

    const nodesToRead = [
      { pointId: 'point1' },
      { pointId: 'point2' },
    ]

    await south.formatAndSendValues([], nodesToRead, new Date(), 'myScanMode')

    expect(south.logger.debug).toHaveBeenCalledWith('No value retrieved for "myScanMode".')
  })

  it('should properly read history value with response error', async () => {
    await south.start('baseFolder', 'oibusName', {})
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

  it('should properly read history value with aggregateFn option', async () => {
    await south.start('baseFolder', 'oibusName', {})
    const isNot = jest.fn(() => true)
    south.session = {
      performMessageTransaction: jest.fn(() => ({
        responseHeader: { serviceResult: { isNot, description: 'my description' } },
        results: [{
          historyData: { dataValues: [] },
          statusCode: { value: StatusCodes.Good, description: 'Good' },
          continuationPoint: undefined,
        },
        {
          historyData: { dataValues: [] },
          statusCode: { value: StatusCodes.Good, description: 'Good' },
          continuationPoint: undefined,
        },
        {
          historyData: { dataValues: [] },
          statusCode: { value: StatusCodes.Bad, description: 'Bad' },
          continuationPoint: undefined,
        },
        {
          historyData: { dataValues: [] },
          statusCode: { value: StatusCodes.Bad, description: 'Bad' },
          continuationPoint: undefined,
        },
        ],
      })),
    }
    const nodesToRead = [
      { nodeId: 'ns=1;s=point1' },
      { nodeId: 'ns=1;s=point2' },
      { nodeId: 'ns=1;s=point3' },
      { nodeId: 'ns=1;s=point4' },
    ]
    const startTime = new Date('2020-01-01T00:00:00.000Z')
    const endTime = new Date('2021-01-01T00:00:00.000Z')
    const options = { aggregateFn: 'myAggregate', processingInterval: 'myProcessingInterval', timeout: 1000 }
    await south.readHistoryValue(nodesToRead, startTime, endTime, options)
    expect(south.session.performMessageTransaction).toHaveBeenCalledTimes(2)
    const historyReadDetails = new ReadProcessedDetails({
      startTime,
      endTime,
      aggregateType: [options.aggregateFn, options.aggregateFn, options.aggregateFn],
      processingInterval: options.processingInterval,
    })
    const expectedHistoryReadRequest = new HistoryReadRequest({
      historyReadDetails,
      nodesToRead,
      releaseContinuationPoints: false,
      timestampsToReturn: TimestampsToReturn.Both,
    })
    expectedHistoryReadRequest.requestHeader.timeoutHint = 1000
    expect(south.session.performMessageTransaction).toHaveBeenCalledWith(expectedHistoryReadRequest)
    expect(south.logger.error).toHaveBeenCalledWith('Error while reading history: my description')
    expect(south.logger.error).toHaveBeenCalledWith('Error while releasing continuation points: my description')
    options.processingInterval = undefined
    await south.readHistoryValue(nodesToRead, startTime, endTime, options)
    expect(south.logger.error).toHaveBeenCalledWith('Option aggregateFn "myAggregate" without processingInterval.')
  })

  it('should properly read history value with response success', async () => {
    await south.start('baseFolder', 'oibusName', {})
    const isNot = jest.fn(() => false)
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
          historyData: { },
          statusCode: { value: 1, description: 'Bad' },
          continuationPoint: undefined,
        },
        ],
      })),
    }
    const nodesToRead = [
      { nodeId: 'ns=1;s=point1' },
      { nodeId: 'ns=1;s=point2' },
      { nodeId: 'ns=1;s=point3' },
    ]
    const startTime = new Date('2020-01-01T00:00:00.000Z')
    const endTime = new Date('2021-01-01T00:00:00.000Z')

    await south.readHistoryValue(nodesToRead, startTime, endTime, {})
    expect(south.session.performMessageTransaction).toHaveBeenCalledTimes(2)
    expect(isNot).toHaveBeenCalledTimes(2)
    expect(south.logger.debug).toHaveBeenCalledWith('Received a response of 3 nodes.')
    expect(south.logger.debug).toHaveBeenCalledWith('Bad with status code 1: [ns=1;s=point2,ns=1;s=point3]')
  })

  it('should properly read history value of many points with response success', async () => {
    await south.start('baseFolder', 'oibusName', {})
    const isNot = jest.fn(() => true)
    const badHistoryResult = {
      historyData: { dataValues: [] },
      statusCode: { value: 1, description: 'Bad' },
      continuationPoint: undefined,
    }
    south.session = {
      performMessageTransaction: jest.fn(() => ({
        responseHeader: { serviceResult: { isNot } },
        results: [{
          historyData: { dataValues: [] },
          statusCode: { value: 0, description: 'Good' },
          continuationPoint: undefined,
        },
        badHistoryResult,
        badHistoryResult,
        badHistoryResult,
        badHistoryResult,
        badHistoryResult,
        badHistoryResult,
        badHistoryResult,
        badHistoryResult,
        badHistoryResult,
        badHistoryResult,
        badHistoryResult,
        ],
      })),
    }
    const nodesToRead = [
      { nodeId: 'ns=1;s=point1' },
      { nodeId: 'ns=1;s=point2' },
      { nodeId: 'ns=1;s=point3' },
      { nodeId: 'ns=1;s=point4' },
      { nodeId: 'ns=1;s=point5' },
      { nodeId: 'ns=1;s=point6' },
      { nodeId: 'ns=1;s=point7' },
      { nodeId: 'ns=1;s=point8' },
      { nodeId: 'ns=1;s=point9' },
      { nodeId: 'ns=1;s=point10' },
      { nodeId: 'ns=1;s=point11' },
      { nodeId: 'ns=1;s=point12' },
    ]
    const startTime = new Date('2020-01-01T00:00:00.000Z')
    const endTime = new Date('2021-01-01T00:00:00.000Z')

    await south.readHistoryValue(nodesToRead, startTime, endTime, {})
    expect(south.session.performMessageTransaction).toHaveBeenCalledTimes(2)
    expect(isNot).toHaveBeenCalledTimes(2)
    expect(south.logger.debug).toHaveBeenCalledWith('Received a response of 12 nodes.')
    expect(south.logger.debug).toHaveBeenCalledWith('Good with status code 0: [ns=1;s=point1]')
    expect(south.logger.debug).toHaveBeenCalledWith('Bad with status code 1: [ns=1;s=point2..ns=1;s=point12]')
  })

  it('should returns the requested number of node IDs after historyQuery', async () => {
    databaseService.getConfig.mockReturnValue('2020-02-02T02:02:02.222Z')
    databaseService.createConfigDatabase.mockReturnValue('configDatabase')
    await south.start('baseFolder', 'oibusName', {})
    await south.connect()

    south.maxReadInterval = 24 * 60 * 60 * 1000
    south.connected = true
    south.currentlyOnScan[configuration.settings.scanGroups[0].scanMode] = 0
    south.readHistoryValue = jest.fn()
    south.readHistoryValue.mockReturnValue(Promise.resolve([]))
    south.addValues = jest.fn()
    south.formatAndSendValues = jest.fn()

    await south.historyQuery(configuration.settings.scanGroups[0].scanMode, new Date(), new Date())

    const expectedOptions = {
      timeout: configuration.settings.readTimeout,
      numValuesPerNode: configuration.settings.maxReturnValues,
    }
    const expectedNodes = [{ nodeId: 'ns=3;s=Random', pointId: 'Random', scanMode: 'every10Second' }]

    expect(south.readHistoryValue).toBeCalledTimes(1)
    expect(south.readHistoryValue).toHaveBeenCalledWith(expectedNodes, new Date(), new Date(), expectedOptions)
    expect(south.logger.error).toHaveBeenCalledWith('Received 0 data values, requested 1 nodes.')

    south.readHistoryValue.mockReturnValue(Promise.resolve([{}]))
    south.scanGroups[0].resampling = 'Second'
    south.scanGroups[0].aggregate = 'Average'
    expectedOptions.aggregateFn = AggregateFunction.Average
    expectedOptions.processingInterval = 1000
    await south.historyQuery(configuration.settings.scanGroups[0].scanMode, new Date(), new Date())
    expect(south.readHistoryValue).toHaveBeenCalledWith(expectedNodes, new Date(), new Date(), expectedOptions)

    south.scanGroups[0].resampling = '10 Seconds'
    south.scanGroups[0].aggregate = 'Minimum'
    expectedOptions.aggregateFn = AggregateFunction.Minimum
    expectedOptions.processingInterval = 1000 * 10
    await south.historyQuery(configuration.settings.scanGroups[0].scanMode, new Date(), new Date())
    expect(south.readHistoryValue).toHaveBeenCalledWith(expectedNodes, new Date(), new Date(), expectedOptions)

    south.scanGroups[0].resampling = '30 Seconds'
    south.scanGroups[0].aggregate = 'Maximum'
    expectedOptions.aggregateFn = AggregateFunction.Maximum
    expectedOptions.processingInterval = 1000 * 30
    await south.historyQuery(configuration.settings.scanGroups[0].scanMode, new Date(), new Date())
    expect(south.readHistoryValue).toHaveBeenCalledWith(expectedNodes, new Date(), new Date(), expectedOptions)

    south.scanGroups[0].resampling = 'Minute'
    south.scanGroups[0].aggregate = 'Count'
    expectedOptions.aggregateFn = AggregateFunction.Count
    expectedOptions.processingInterval = 1000 * 60
    await south.historyQuery(configuration.settings.scanGroups[0].scanMode, new Date(), new Date())
    expect(south.readHistoryValue).toHaveBeenCalledWith(expectedNodes, new Date(), new Date(), expectedOptions)

    south.scanGroups[0].resampling = 'Hour'
    south.scanGroups[0].aggregate = 'Count'
    expectedOptions.aggregateFn = AggregateFunction.Count
    expectedOptions.processingInterval = 1000 * 3600
    await south.historyQuery(configuration.settings.scanGroups[0].scanMode, new Date(), new Date())
    expect(south.readHistoryValue).toHaveBeenCalledWith(expectedNodes, new Date(), new Date(), expectedOptions)

    south.scanGroups[0].resampling = 'Day'
    south.scanGroups[0].aggregate = 'Count'
    expectedOptions.aggregateFn = AggregateFunction.Count
    expectedOptions.processingInterval = 1000 * 3600 * 24
    await south.historyQuery(configuration.settings.scanGroups[0].scanMode, new Date(), new Date())
    expect(south.readHistoryValue).toHaveBeenCalledWith(expectedNodes, new Date(), new Date(), expectedOptions)

    south.scanGroups[0].resampling = 'Bad resampling'
    south.scanGroups[0].aggregate = 'Bad aggregate'
    expectedOptions.aggregateFn = undefined
    expectedOptions.processingInterval = undefined
    await south.historyQuery(configuration.settings.scanGroups[0].scanMode, new Date(), new Date())
    expect(south.readHistoryValue).toHaveBeenCalledWith(expectedNodes, new Date(), new Date(), expectedOptions)
    expect(south.logger.error).toHaveBeenCalledWith('Unsupported resampling: "Bad resampling".')
    expect(south.logger.error).toHaveBeenCalledWith('Unsupported aggregate: "Bad aggregate".')
  })

  it('should catch historyQuery errors', async () => {
    await south.start('baseFolder', 'oibusName', {})
    await south.connect()
    south.connected = true
    south.currentlyOnScan[configuration.settings.scanGroups[0].scanMode] = 0
    south.readHistoryValue = jest.fn()
    south.readHistoryValue.mockReturnValue(Promise.reject(new Error('fail')))
    south.session = { close: jest.fn() }
    await expect(south.historyQueryHandler(configuration.settings.scanGroups[0].scanMode, new Date(), new Date())).rejects.toThrowError('fail')
  })

  it('should call internalDisconnect on historyQuery errors', async () => {
    await south.start('baseFolder', 'oibusName', {})
    await south.connect()
    south.connected = true
    south.currentlyOnScan[configuration.settings.scanGroups[0].scanMode] = 0
    south.readHistoryValue = jest.fn()
    south.readHistoryValue.mockReturnValue(Promise.reject(new Error('fail')))
    south.session = { close: jest.fn() }
    south.internalDisconnect = jest.fn()
    await expect(south.historyQueryHandler(configuration.settings.scanGroups[0].scanMode, new Date(), new Date())).rejects.toThrowError('fail')
    expect(south.internalDisconnect).toHaveBeenCalled()
  })

  it('should nat call internalDisconnect on historyQuery errors when disconnecting', async () => {
    await south.start('baseFolder', 'oibusName', {})
    await south.connect()
    south.connected = true
    south.currentlyOnScan[configuration.settings.scanGroups[0].scanMode] = 0
    south.readHistoryValue = jest.fn()
    south.readHistoryValue.mockReturnValue(Promise.reject(new Error('fail')))
    south.session = { close: jest.fn() }
    south.internalDisconnect = jest.fn()
    south.disconnecting = true
    await expect(south.historyQueryHandler(configuration.settings.scanGroups[0].scanMode, new Date(), new Date())).rejects.toThrowError('fail')
    expect(south.internalDisconnect).not.toHaveBeenCalled()
  })

  it('should properly disconnect when trying to connect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

    await south.start('baseFolder', 'oibusName', {})
    await south.connect()
    south.reconnectTimeout = true
    south.connected = false
    const close = jest.fn()
    south.session = { close }
    await south.disconnect()

    expect(clearTimeoutSpy).toBeCalled()
    expect(close).not.toBeCalled()
    expect(south.disconnecting).toBeTruthy()
  })

  it('should properly disconnect when connected', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

    await south.start('baseFolder', 'oibusName', {})
    await south.connect()
    south.reconnectTimeout = false
    south.connected = true
    const close = jest.fn()
    south.session = { close }
    await south.disconnect()

    expect(clearTimeoutSpy).not.toBeCalled()
    expect(close).toBeCalled()
    expect(south.disconnecting).toBeTruthy()
  })
})
