import { jest } from '@jest/globals'

import nodeOPCUA from 'node-opcua-client'

import OPCUA_HA from './OPCUA_HA.class.js'

import { defaultConfig } from '../../../../tests/testConfig.js'

import databaseService from '../../../services/database.service.js'
import EncryptionService from '../../../services/EncryptionService.class.js'

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

// Mock database service
jest.mock('../../../services/database.service', () => ({
  createConfigDatabase: jest.fn(() => 'configDatabase'),
  getConfig: jest.fn((_database, _key) => '1587640141001.0'),
  upsertConfig: jest.fn(),
}))

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock logger
jest.mock('../../../engine/logger/Logger.class')

// Mock engine
const engine = jest.mock('../../../engine/OIBusEngine.class')
engine.configService = { getConfig: () => ({ engineConfig: defaultConfig.engine }) }
engine.getCacheFolder = () => defaultConfig.engine.caching.cacheFolder
engine.eventEmitters = {}
engine.engineName = 'Test OPCUA_DA'

const CertificateService = jest.mock('../../../services/CertificateService.class')
CertificateService.init = jest.fn()
CertificateService.logger = engine.logger

let opcuaSouth = null
const opcuaConfig = {
  id: 'myConnectorId',
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
const opcuaScanGroups = [{
  name: 'every10Second',
  aggregate: 'Raw',
  resampling: 'None',
  scanMode: 'every10Second',
  points: [{ pointId: 'Random', nodeId: 'ns=3;s=Random', scanMode: 'every10Second' }],
}]

beforeEach(async () => {
  jest.resetAllMocks()
  jest.useFakeTimers()
  opcuaSouth = new OPCUA_HA(opcuaConfig, engine)
  await opcuaSouth.init()
})

describe('OPCUA-HA south', () => {
  it('should be properly initialized', () => {
    expect(opcuaSouth.url).toEqual(opcuaConfig.OPCUA_HA.url)
    expect(opcuaSouth.retryInterval).toEqual(opcuaConfig.OPCUA_HA.retryInterval)
    expect(opcuaSouth.maxReadInterval).toEqual(opcuaConfig.OPCUA_HA.maxReadInterval)
    expect(opcuaSouth.reconnectTimeout).toBeNull()
  })

  it('should properly connect and set lastCompletedAt from database', async () => {
    databaseService.getConfig.mockReturnValue('2020-04-23T11:09:01.001Z')
    opcuaSouth.connectToOpcuaServer = jest.fn()
    await opcuaSouth.connect()

    expect(opcuaSouth.scanGroups).toEqual(opcuaScanGroups)
    expect(Object.keys(opcuaSouth.lastCompletedAt)).toEqual([opcuaConfig.OPCUA_HA.scanGroups[0].scanMode])
    expect(Object.keys(opcuaSouth.ongoingReads)).toEqual([opcuaConfig.OPCUA_HA.scanGroups[0].scanMode])

    expect(databaseService.createConfigDatabase).toBeCalledWith(`${defaultConfig.engine.caching.cacheFolder}/${opcuaConfig.id}.db`)
    expect(databaseService.getConfig).toHaveBeenCalledTimes(2)
    expect(opcuaSouth.lastCompletedAt.every10Second).toEqual(new Date('2020-04-23T11:09:01.001Z'))
    expect(opcuaSouth.connectToOpcuaServer).toHaveBeenCalledTimes(1)
  })

  it('should properly connect and set lastCompletedAt from config file', async () => {
    databaseService.getConfig.mockReturnValue(null)
    opcuaSouth.connectToOpcuaServer = jest.fn()
    await opcuaSouth.connect()

    expect(databaseService.createConfigDatabase).toBeCalledWith(`${defaultConfig.engine.caching.cacheFolder}/${opcuaConfig.id}.db`)
    expect(databaseService.getConfig).toHaveBeenCalledTimes(2)
    expect(opcuaSouth.lastCompletedAt.every10Second).toEqual(new Date(opcuaConfig.startTime))
    expect(opcuaSouth.connectToOpcuaServer).toHaveBeenCalledTimes(1)
  })

  it('should properly connect and set lastCompletedAt now', async () => {
    databaseService.getConfig.mockReturnValue(null)
    opcuaConfig.originalStartTime = opcuaConfig.startTime
    delete opcuaConfig.startTime

    const opcuaSouthWithoutStartTime = new OPCUA_HA(opcuaConfig, engine)
    await opcuaSouthWithoutStartTime.init()
    opcuaSouthWithoutStartTime.connectToOpcuaServer = jest.fn()
    await opcuaSouthWithoutStartTime.connect()

    expect(databaseService.createConfigDatabase).toBeCalledWith(`${defaultConfig.engine.caching.cacheFolder}/${opcuaConfig.id}.db`)
    expect(databaseService.getConfig).toHaveBeenCalledTimes(2)
    expect(opcuaSouthWithoutStartTime.lastCompletedAt.every10Second).not.toEqual(new Date(opcuaConfig.originalStartTime).getTime())
    expect(opcuaSouthWithoutStartTime.connectToOpcuaServer).toHaveBeenCalledTimes(1)
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
      securityMode: nodeOPCUA.MessageSecurityMode.None,
      securityPolicy: nodeOPCUA.SecurityPolicy.None,
      endpointMustExist: false,
      keepSessionAlive: false,
      keepPendingSessionsOnDisconnect: false,
      clientCertificateManager: { state: 2 },
    }
    const expectedUserIdentity = { type: 0 }

    await opcuaSouth.connect()

    expect(opcuaSouth.connected).toBeTruthy()
    expect(Opcua.OPCUAClient.createSession).toBeCalledWith(opcuaSouth.url, expectedUserIdentity, expectedOptions)
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
      securityMode: nodeOPCUA.MessageSecurityMode.None,
      securityPolicy: nodeOPCUA.SecurityPolicy.None,
      endpointMustExist: false,
      keepSessionAlive: false,
      keepPendingSessionsOnDisconnect: false,
      clientCertificateManager: { state: 2 },
    }
    opcuaSouth.username = 'username'
    opcuaSouth.password = 'password'

    await opcuaSouth.connect()

    delete opcuaConfig.OPCUA_HA.username
    delete opcuaConfig.OPCUA_HA.password
    const expectedUserIdentity = {
      type: 1,
      userName: 'username',
      password: 'password',
    }
    expect(nodeOPCUA.OPCUAClient.createSession).toBeCalledWith(opcuaSouth.url, expectedUserIdentity, expectedOptions)
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
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), opcuaConfig.OPCUA_HA.retryInterval)
  })

  it('should quit onScan if not connected', async () => {
    databaseService.getConfig.mockReturnValue('2020-04-23T11:09:01.001Z')

    await opcuaSouth.connect()
    await opcuaSouth.disconnect()
    opcuaSouth.session = { readHistoryValue: jest.fn() }
    await opcuaSouth.historyQueryHandler(opcuaConfig.OPCUA_HA.scanGroups[0].scanMode)

    expect(opcuaSouth.session.readHistoryValue).not.toBeCalled()
  })

  it('should quit onScan if previous read did not complete', async () => {
    databaseService.getConfig.mockReturnValue('2020-04-23T11:09:01.001Z')

    await opcuaSouth.connect()
    opcuaSouth.connected = true
    opcuaSouth.ongoingReads[opcuaConfig.OPCUA_HA.scanGroups[0].scanMode] = true
    opcuaSouth.session = { readHistoryValue: jest.fn() }
    await opcuaSouth.historyQueryHandler(opcuaConfig.OPCUA_HA.scanGroups[0].scanMode)

    expect(opcuaSouth.session.readHistoryValue).not.toBeCalled()
  })

  it('should quit onScan if scan group has no points to read', async () => {
    databaseService.getConfig.mockReturnValue('2020-04-23T11:09:01.001Z')
    const testOpcuaConfig = {
      ...opcuaConfig,
      points: [{
        pointId: 'ns=3;s=Random',
        scanMode: 'every1minute',
      }],
    }
    const opcuaSouthWithoutPointsScanMode = new OPCUA_HA(testOpcuaConfig, engine)
    await opcuaSouthWithoutPointsScanMode.init()
    await opcuaSouthWithoutPointsScanMode.connect()
    opcuaSouthWithoutPointsScanMode.connected = true
    opcuaSouthWithoutPointsScanMode.ongoingReads[opcuaConfig.OPCUA_HA.scanGroups[0].scanMode] = false
    opcuaSouthWithoutPointsScanMode.session = { readHistoryValue: jest.fn() }
    await opcuaSouthWithoutPointsScanMode.historyQueryHandler(opcuaConfig.OPCUA_HA.scanGroups[0].scanMode)

    expect(opcuaSouthWithoutPointsScanMode.session.readHistoryValue).not.toBeCalled()
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

    databaseService.getConfig.mockReturnValue(startDate.toISOString())
    databaseService.createConfigDatabase.mockReturnValue('configDatabase')
    await opcuaSouth.connect()

    opcuaSouth.maxReadInterval = 24 * 60 * 60
    opcuaSouth.maxReturnValues = 1000
    opcuaSouth.readTimeout = 600000
    opcuaSouth.connected = true
    opcuaSouth.ongoingReads[opcuaConfig.OPCUA_HA.scanGroups[0].scanMode] = false
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
    await opcuaSouth.historyQueryHandler(opcuaConfig.OPCUA_HA.scanGroups[0].scanMode)
    global.Date = RealDate

    const expectedValue = {
      pointId: opcuaConfig.points[0].pointId,
      timestamp: sampleDate.toISOString(),
      data: {
        value: sampleValue,
        quality: '{"value":0}',
      },
    }
    expect(opcuaSouth.readHistoryValue).toBeCalledTimes(1)
    expect(opcuaSouth.readHistoryValue).toBeCalledWith([opcuaConfig.points[0]], startDate, nowDate, { numValuesPerNode: 1000, timeout: 600000 })
    expect(opcuaSouth.addValues).toBeCalledTimes(1)
    expect(opcuaSouth.addValues).toBeCalledWith([expectedValue])
    expect(databaseService.upsertConfig).toBeCalledWith(
      'configDatabase',
      `lastCompletedAt-${opcuaConfig.OPCUA_HA.scanGroups[0].scanMode}`,
      new Date(sampleDate.getTime() + 1).toISOString(),
    )
    expect(opcuaSouth.ongoingReads[opcuaConfig.OPCUA_HA.scanGroups[0].scanMode]).toBeFalsy()
    expect(opcuaSouth.delay).not.toBeCalled()
  })

  it('should in onScan call readHistoryValue multiple times if maxReadInterval is smaller than the read interval', async () => {
    const startDate = new Date()
    startDate.setTime(startDate.getTime() - (8000 * 1000))

    databaseService.getConfig.mockReturnValue(startDate.toISOString())
    await opcuaSouth.connect()

    opcuaSouth.maxReadInterval = 3600
    opcuaSouth.readIntervalDelay = 200
    opcuaSouth.connected = true
    opcuaSouth.ongoingReads[opcuaConfig.OPCUA_HA.scanGroups[0].scanMode] = false
    opcuaSouth.readHistoryValue = jest.fn()
    opcuaSouth.readHistoryValue.mockReturnValue(Promise.resolve([]))
    opcuaSouth.addValues = jest.fn()
    opcuaSouth.delay = jest.fn().mockReturnValue(Promise.resolve())

    await opcuaSouth.historyQueryHandler(opcuaConfig.OPCUA_HA.scanGroups[0].scanMode)

    expect(opcuaSouth.readHistoryValue).toBeCalledTimes(3)
    expect(opcuaSouth.delay).toBeCalledTimes(2)
    expect(opcuaSouth.delay.mock.calls).toEqual([[200], [200]])
  })

  it('should in onScan call check if readHistoryValue returns the requested number of node IDs', async () => {
    databaseService.getConfig.mockReturnValue('2020-02-02T02:02:02.222Z')
    databaseService.createConfigDatabase.mockReturnValue('configDatabase')
    await opcuaSouth.connect()

    opcuaSouth.maxReadInterval = 24 * 60 * 60 * 1000
    opcuaSouth.connected = true
    opcuaSouth.ongoingReads[opcuaConfig.OPCUA_HA.scanGroups[0].scanMode] = false
    opcuaSouth.readHistoryValue = jest.fn()
    opcuaSouth.readHistoryValue.mockReturnValue(Promise.resolve([]))
    opcuaSouth.addValues = jest.fn()

    await opcuaSouth.historyQueryHandler(opcuaConfig.OPCUA_HA.scanGroups[0].scanMode)

    expect(opcuaSouth.readHistoryValue).toBeCalledTimes(1)
    expect(opcuaSouth.logger.error).toHaveBeenCalledWith('Received 0 data values, requested 1 nodes')
  })

  it('should onScan catch errors', async () => {
    await opcuaSouth.connect()
    opcuaSouth.connected = true
    opcuaSouth.ongoingReads[opcuaConfig.OPCUA_HA.scanGroups[0].scanMode] = false
    opcuaSouth.readHistoryValue = jest.fn()
    opcuaSouth.readHistoryValue.mockReturnValue(Promise.reject(new Error('fail')))
    opcuaSouth.session = { close: jest.fn() }
    await opcuaSouth.historyQueryHandler(opcuaConfig.OPCUA_HA.scanGroups[0].scanMode)

    expect(opcuaSouth.readHistoryValue).toBeCalled()
    expect(opcuaSouth.logger.error).toHaveBeenCalled()
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
