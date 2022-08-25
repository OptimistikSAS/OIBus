const child = require('node:child_process')
const Stream = require('node:stream')
const OPCHDA = require('./OPCHDA.class')
const tcpServer = require('./TcpServer')
const deferredPromise = require('./DeferredPromise')

const { defaultConfig: config } = require('../../../tests/testConfig')

const mockSpawnChild = new Stream()
mockSpawnChild.stdout = new Stream()
mockSpawnChild.stderr = new Stream()
mockSpawnChild.kill = jest.fn()

jest.mock('node:child_process')
jest.mock('./TcpServer')
jest.mock('./DeferredPromise')

// Mock OIBusEngine
const engine = {
  configService: { getConfig: () => ({ engineConfig: config.engine }) },
  getCacheFolder: () => config.engine.caching.cacheFolder,
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

const originalPlatform = process.platform

describe('South OPCHDA', () => {
  beforeAll(() => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
  })

  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers()

    child.spawn.mockImplementation(() => mockSpawnChild)
    tcpServer.mockImplementation(() => ({
      start: jest.fn((callback) => { callback() }),
      stop: jest.fn(),
      sendMessage: jest.fn(),
    }))

    deferredPromise.mockImplementation(() => ({
      promise: {
        resolve: jest.fn(),
        reject: jest.fn(() => {
          throw new Error('promise error')
        }),
      },
    }))

    settings = {
      id: 'southId',
      name: 'OPCHDA',
      protocol: 'OPCHDA',
      enabled: true,
      OPCHDA: {
        tcpPort: '2224',
        retryInterval: 10000,
        maxReadInterval: 3600,
        readIntervalDelay: 200,
        maxReturnValues: 0,
        readTimeout: 60,
        agentFilename: './HdaAgent/HdaAgent.exe',
        logLevel: 'trace',
        host: '1.2.3.4',
        serverName: 'MyOPCServer',
        scanGroups: [{
          aggregate: 'Raw',
          resampling: 'None',
          scanMode: 'every10Second',
        }],
      },
      points: [{
        pointId: 'myPointId',
        nodeId: 'myNodeId',
        scanMode: 'every10Second',
      }],
    }
    south = new OPCHDA(settings, engine)
    await south.init()
  })

  afterAll(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('should log error if the connector is run on the wrong platform', async () => {
    Object.defineProperty(process, 'platform', { value: 'notWin32' })
    await south.connect()
    expect(south.logger.error).toHaveBeenCalledWith('OIBus OPCHDA Agent only supported on Windows: notWin32.')
    Object.defineProperty(process, 'platform', { value: 'win32' })
  })

  it('should properly connect', async () => {
    south.runTcpServer = jest.fn()
    south.connection$ = { promise: jest.fn() }
    await south.connect()
    expect(south.runTcpServer).toHaveBeenCalledTimes(1)
  })

  it('should properly run tcp server', async () => {
    south.launchAgent = jest.fn()
    await south.runTcpServer()

    expect(south.launchAgent).toHaveBeenCalledWith(settings.OPCHDA.agentFilename, settings.OPCHDA.tcpPort, settings.OPCHDA.logLevel)
  })

  it('should reject on launch Agent error', async () => {
    south.launchAgent = jest.fn(() => {
      throw new Error('launch agent error')
    })
    try {
      await south.runTcpServer()
    } catch (err) {
      expect(err).toEqual(new Error('launch agent error'))
    }
  })

  it('should properly run history query', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

    south.sendReadMessage = jest.fn()
    const startTime = new Date('2020-01-01T00:00:00.000Z')
    const endTime = new Date('2021-01-01T00:00:00.000Z')

    await south.historyQuery('myScanMode', startTime, endTime)
    expect(south.sendReadMessage).toHaveBeenCalledWith('myScanMode', startTime, endTime)

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
  })

  it('should reject after timeout when running history query', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

    south.sendReadMessage = jest.fn()
    const startTime = new Date('2020-01-01T00:00:00.000Z')
    const endTime = new Date('2021-01-01T00:00:00.000Z')

    deferredPromise.mockImplementation(() => ({
      promise: new Promise((resolve) => {
        setTimeout(resolve, settings.OPCHDA.readTimeout * 1000 + 1)
      }),
      reject: (err) => {
        throw err
      },
    }))

    south.historyQuery('myScanMode', startTime, endTime)
    await expect(
      Promise.resolve().then(() => jest.advanceTimersByTime(settings.OPCHDA.readTimeout * 1000)),
    ).rejects.toThrowError('History query has not succeeded in the requested readTimeout: 60s.')
    expect(south.sendReadMessage).toHaveBeenCalledWith('myScanMode', startTime, endTime)

    expect(clearTimeoutSpy).not.toHaveBeenCalled()
  })

  it('should properly launch agent', async () => {
    south.launchAgent('hdaPath', 1234, 'debug')

    mockSpawnChild.emit('close', 'closeCode')
    expect(south.logger.info).toHaveBeenCalledWith('HDA agent exited with code closeCode.')

    mockSpawnChild.emit('error', { message: 'errorMessage' })
    expect(south.logger.error).toHaveBeenCalledWith('Failed to start HDA agent: "errorMessage".')

    mockSpawnChild.stderr.emit('data', 'stderrErrorMessage')
    expect(south.logger.error).toHaveBeenCalledWith('HDA agent stderr: "stderrErrorMessage".')

    south.handleHdaAgentLog = jest.fn()
    mockSpawnChild.stdout.emit('data', 'stdOutMessage')
    expect(south.handleHdaAgentLog).toHaveBeenCalledWith('stdOutMessage')
  })

  it('should properly handle HDA Agent logs', () => {
    south.logMessage = jest.fn()

    south.handleHdaAgentLog('myMessage')
    south.handleHdaAgentLog(' and mySecondMessage\r\n in several\r\n\r\npart')
    // 'part' is not logged since it will be part of the next (and for now incomplete) message
    // it should also ignore empty lines
    expect(south.logMessage).toHaveBeenCalledTimes(2)
    expect(south.logMessage).toHaveBeenCalledWith('myMessage and mySecondMessage')
    expect(south.logMessage).toHaveBeenCalledWith('in several')
  })

  it('should properly log HDA Agent messages', () => {
    south.logMessage('{ "Message": "my error message", "Level": "error" }')
    expect(south.logger.error).toHaveBeenCalledWith('HDA Agent stdout: my error message')

    south.logMessage('{ "Message": "my warn message", "Level": "warn" }')
    expect(south.logger.warn).toHaveBeenCalledWith('HDA Agent stdout: my warn message')

    south.logMessage('{ "Message": "my info message", "Level": "info" }')
    expect(south.logger.info).toHaveBeenCalledWith('HDA Agent stdout: my info message')

    south.logMessage('{ "Message": "my debug message", "Level": "debug" }')
    expect(south.logger.debug).toHaveBeenCalledWith('HDA Agent stdout: my debug message')

    south.logMessage('{ "Message": "my trace message", "Level": "trace" }')
    expect(south.logger.trace).toHaveBeenCalledWith('HDA Agent stdout: my trace message')

    south.logMessage('{ "Message": "my wrongLevel message", "Level": "wrongLevel" }')
    expect(south.logger.debug).toHaveBeenCalledWith('HDA Agent stdout: my wrongLevel message')

    south.logMessage('not a json')
    expect(south.logger.error).toHaveBeenCalledWith('The error "SyntaxError: Unexpected token o in JSON at position 1" '
        + 'occurred when parsing HDA Agent log "not a json".')
  })

  it('should generate a transaction id', () => {
    south.generateTransactionId()
    expect(south.transactionId).toEqual(1)
  })

  it('should send connect message', async () => {
    south.sendTCPMessageToHdaAgent = jest.fn()
    south.generateTransactionId = jest.fn(() => 1234)

    await south.sendConnectMessage()

    expect(south.sendTCPMessageToHdaAgent).toHaveBeenCalledWith({
      Request: 'Connect',
      TransactionId: 1234,
      Content: {
        host: settings.OPCHDA.host,
        serverName: settings.OPCHDA.serverName,
      },
    })
  })

  it('should properly disconnect when already disconnected', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    await south.disconnect()
    expect(clearTimeoutSpy).not.toHaveBeenCalled()
  })

  it('should properly disconnect when connected', async () => {
    await south.init()
    await south.runTcpServer()
    south.agentConnected = true

    south.reconnectTimeout = jest.fn()
    south.historyReadTimeout = jest.fn()
    south.disconnectionTimeout = jest.fn()
    south.sendStopMessage = jest.fn()
    south.disconnection$ = { promise: jest.fn() }

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    await south.disconnect()
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(3)
    expect(south.sendStopMessage).toHaveBeenCalledTimes(1)
    expect(mockSpawnChild.kill).toHaveBeenCalledTimes(1)
  })

  it('should send init message', async () => {
    await south.init()
    south.sendTCPMessageToHdaAgent = jest.fn()
    south.generateTransactionId = jest.fn(() => 1234)

    await south.sendInitializeMessage()

    expect(south.sendTCPMessageToHdaAgent).toHaveBeenCalledWith({
      Request: 'Initialize',
      TransactionId: 1234,
      Content: {
        Groups: south.scanGroups.map((scanGroup) => ({
          name: scanGroup.name,
          aggregate: scanGroup.aggregate,
          resampling: scanGroup.resampling,
          scanMode: scanGroup.scanMode,
          points: scanGroup.points.map((point) => point.nodeId),
        })),
        MaxReturnValues: settings.OPCHDA.maxReturnValues,
        MaxReadInterval: settings.OPCHDA.maxReadInterval,
        ReadIntervalDelay: settings.OPCHDA.readIntervalDelay,
      },
    })
  })

  it('should send read message', async () => {
    await south.init()
    south.sendTCPMessageToHdaAgent = jest.fn()
    south.generateTransactionId = jest.fn(() => 1234)

    const startTime = new Date('2020-01-01T00:00:00.000Z')
    const endTime = new Date('2021-01-01T00:00:00.000Z')

    await south.sendReadMessage('myScanMode', startTime, endTime)

    expect(south.sendTCPMessageToHdaAgent).toHaveBeenCalledWith({
      Request: 'Read',
      TransactionId: 1234,
      Content: {
        Group: 'myScanMode',
        StartTime: startTime.getTime(),
        EndTime: endTime.getTime(),
      },
    })
  })

  it('should send stop message', async () => {
    await south.init()
    south.sendTCPMessageToHdaAgent = jest.fn()
    south.generateTransactionId = jest.fn(() => 1234)

    await south.sendStopMessage()

    expect(south.sendTCPMessageToHdaAgent).toHaveBeenCalledWith({
      Request: 'Stop',
      TransactionId: 1234,
    })

    south.disconnection$.resolve = jest.fn()

    jest.advanceTimersToNextTimer()

    expect(south.disconnection$.resolve).toHaveBeenCalledTimes(1)
  })

  it('should send TCP message', async () => {
    await south.init()

    south.agentConnected = true
    south.tcpServer = { sendMessage: jest.fn() }

    await south.sendTCPMessageToHdaAgent({ message: 'myMessage' })

    expect(south.tcpServer.sendMessage).toHaveBeenCalledWith(JSON.stringify({ message: 'myMessage' }))
  })

  it('should not send TCP message and try to reconnect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    await south.init()

    south.disconnect = jest.fn()
    south.connect = jest.fn()
    south.agentConnected = false
    south.tcpServer = { sendMessage: jest.fn() }

    await south.sendTCPMessageToHdaAgent({ message: 'myMessage' })

    expect(south.tcpServer.sendMessage).not.toHaveBeenCalled()
    expect(south.disconnect).toHaveBeenCalledTimes(1)
    expect(south.connect).not.toHaveBeenCalled()
    expect(clearTimeoutSpy).not.toHaveBeenCalled()

    await south.sendTCPMessageToHdaAgent({ message: 'myMessage' })

    expect(south.tcpServer.sendMessage).not.toHaveBeenCalled()
    expect(south.disconnect).toHaveBeenCalledTimes(2)
    expect(south.connect).not.toHaveBeenCalled()
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(settings.OPCHDA.retryInterval)
    expect(south.connect).toHaveBeenCalledTimes(1)
  })

  it('should handle bad message', async () => {
    const receivedMessage = 'not a json message'
    south.sendConnectMessage = jest.fn()
    await south.handleTcpHdaAgentMessages(receivedMessage)
    expect(south.logger.error).toHaveBeenCalledWith('Can\'t handle message "not a json message".')
  })

  it('should handle Alive message', async () => {
    const receivedMessage = { Reply: 'Alive' }
    south.sendConnectMessage = jest.fn()
    await south.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage))
    expect(south.agentConnected).toBeTruthy()
    expect(south.sendConnectMessage).toHaveBeenCalledTimes(1)
  })

  it('should handle Connect message when the connection succeeds', async () => {
    const receivedMessage = { Reply: 'Connect', Content: { Connected: true } }
    south.sendInitializeMessage = jest.fn()
    await south.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage))
    expect(south.sendInitializeMessage).toHaveBeenCalledTimes(1)
  })

  it('should handle Connect message when the connection fails', async () => {
    const receivedMessage = { Reply: 'Connect', Content: { Connected: false, Error: 'connection error' } }
    south.disconnect = jest.fn()
    south.connect = jest.fn()
    await south.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage))
    expect(south.logger.error).toHaveBeenCalledWith(`Unable to connect to "${settings.OPCHDA.serverName}" on `
        + `${settings.OPCHDA.host}: ${receivedMessage.Content.Error}, retrying in ${settings.OPCHDA.retryInterval}ms`)

    expect(south.disconnect).toHaveBeenCalledTimes(1)
    expect(south.connect).not.toHaveBeenCalled()
    jest.advanceTimersToNextTimer(settings.OPCHDA.retryInterval)
    expect(south.connect).toHaveBeenCalledTimes(1)
  })

  it('should handle Initialize message', async () => {
    const receivedMessage = { Reply: 'Initialize' }
    south.connection$ = { resolve: jest.fn() }
    await south.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage))
    expect(south.logger.info).toHaveBeenCalledWith('HDA Agent initialized.')
    expect(south.connection$.resolve).toHaveBeenCalledTimes(1)
  })

  it('should handle Read message when the read request fails', async () => {
    const receivedMessage = { Reply: 'Read', Content: { Error: 'read error', Disconnected: false } }
    south.historyRead$ = { reject: jest.fn() }
    await south.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage))

    expect(south.historyRead$.reject).toHaveBeenCalledWith(new Error(receivedMessage.Content.Error))
  })

  it('should handle Read message when the HDA Agent has disconnected from the server', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

    const receivedMessage = { Reply: 'Read', Content: { Error: 'read error', Disconnected: true } }
    south.historyRead$ = { reject: jest.fn() }
    south.sendConnectMessage = jest.fn()
    await south.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage))

    expect(south.logger.error).toHaveBeenCalledWith('Agent disconnected from OPC HDA server.')
    expect(south.connected).toBeFalsy()
    expect(clearTimeoutSpy).not.toHaveBeenCalled()
    expect(south.historyRead$.reject).toHaveBeenCalledWith(new Error(receivedMessage.Content.Error))

    await south.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage))
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
    expect(south.sendConnectMessage).not.toHaveBeenCalled()

    jest.advanceTimersByTime(settings.OPCHDA.retryInterval)
    expect(south.sendConnectMessage).toHaveBeenCalledTimes(1)
  })

  it('should handle Read message when the read request return empty Points', async () => {
    const receivedMessage = { Reply: 'Read', Content: { Group: 'myScanMode' } }
    south.historyRead$ = { reject: jest.fn(), resolve: jest.fn() }

    await south.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage))
    expect(south.historyRead$.reject).toHaveBeenCalledWith(new Error('Missing points entry in response for scan mode "myScanMode".'))

    receivedMessage.Content.Points = []
    await south.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage))
    expect(south.logger.debug).toHaveBeenCalledWith('Empty points response for scan mode "myScanMode".')
    expect(south.historyRead$.resolve).toHaveBeenCalledTimes(1)
  })

  it('should handle Read message when the scan group is not found', async () => {
    await south.init()
    const receivedMessage = { Reply: 'Read', Content: { Group: 'myScanMode', Points: [{}] } }
    south.historyRead$ = { reject: jest.fn() }

    await south.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage))
    expect(south.historyRead$.reject).toHaveBeenCalledWith(new Error('Scan group "myScanMode" not found.'))
  })

  it('should handle Read message and cache values', async () => {
    await south.init()
    const receivedMessage = {
      Reply: 'Read',
      Content: {
        Group: 'every10Second',
        Points: [
          {
            Timestamp: '2020-01-01T00:00:00.000Z',
            Value: 0,
            ItemId: 'myNodeId',
            Quality: 192,
          },
          {
            Timestamp: '2021-01-01T00:00:00.000Z',
            Value: 0,
            ItemId: 'anotherNodeId',
            Quality: 192,
          },
          {
            Timestamp: '2022-01-01T00:00:00.000Z',
            Value: 0,
            ItemId: 'myPointId',
            Quality: 192,
          },
          {
            ItemId: 'badPoint',
            Quality: 192,
          },
        ],
      },
    }
    south.historyRead$ = { resolve: jest.fn() }
    south.addValues = jest.fn()
    south.setConfig = jest.fn()

    await south.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage))

    expect(south.logger.trace).toHaveBeenCalledWith(`Received ${receivedMessage.Content.Points.length} values `
        + `for scan mode "${receivedMessage.Content.Group}".`)
    expect(south.logger.error).toHaveBeenCalledTimes(1)
    expect(south.logger.error).toHaveBeenCalledWith(`Point: "badPoint" is invalid: ${JSON.stringify({
      ItemId: 'badPoint',
      Quality: 192,
    })}`)

    expect(south.addValues).toHaveBeenCalledWith([{
      timestamp: '2020-01-01T00:00:00.000Z',
      pointId: 'myPointId',
      data: {
        value: '0',
        quality: '192',
      },
    },
    {
      timestamp: '2021-01-01T00:00:00.000Z',
      pointId: 'anotherNodeId',
      data: {
        value: '0',
        quality: '192',
      },
    },
    {
      timestamp: '2022-01-01T00:00:00.000Z',
      pointId: 'myPointId',
      data: {
        value: '0',
        quality: '192',
      },
    }])
    expect(south.setConfig).toHaveBeenCalledWith('lastCompletedAt-every10Second', new Date('2022-01-01T00:00:00.001Z').toISOString())
    expect(south.historyRead$.resolve).toHaveBeenCalledTimes(1)
  })

  it('should handle Stop message', async () => {
    const receivedMessage = { Reply: 'Stop' }
    south.disconnection$ = { resolve: jest.fn() }
    south.connected = true
    await south.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage))
    expect(south.logger.info).toHaveBeenCalledWith('HDA Agent stopping...')

    expect(south.disconnection$.resolve).not.toHaveBeenCalled()

    south.connected = false
    await south.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage))
    expect(south.disconnection$.resolve).toHaveBeenCalledTimes(1)
  })

  it('should handle Disconnect message', async () => {
    const receivedMessage = { Reply: 'Disconnect' }
    south.disconnection$ = { resolve: jest.fn() }
    await south.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage))
    expect(south.logger.info).toHaveBeenCalledWith('HDA Agent disconnected.')

    expect(south.disconnection$.resolve).toHaveBeenCalledTimes(1)
  })

  it('should handle BadReply message', async () => {
    const receivedMessage = { Reply: 'BadReply' }
    await south.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage))
    expect(south.logger.error).toHaveBeenCalledWith('Unknown HDA Agent reply: "BadReply".')
  })
})
