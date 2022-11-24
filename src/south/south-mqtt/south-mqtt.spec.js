const Stream = require('node:stream')

const mqtt = require('mqtt')

const MQTT = require('./south-mqtt')

const utils = require('./utils')

// Mock mqtt
jest.mock('mqtt')

// Mock fs
jest.mock('node:fs/promises')

// Mock utils class
jest.mock('./utils', () => ({ formatValue: jest.fn() }))

// Mock certificate service
const CertificateService = jest.mock('../../service/certificate.service')

const addValues = jest.fn()
const addFiles = jest.fn()

// Mock services
jest.mock('../../service/database.service')
jest.mock('../../service/status.service')
jest.mock('../../service/encryption.service', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))

// Mock logger
const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
}

const mqttStream = new Stream()
mqttStream.subscribe = jest.fn()
let configuration = null
let south = null

describe('SouthMQTT', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers()

    mqtt.connect.mockImplementation(() => mqttStream)

    configuration = {
      id: 'southId',
      name: 'MQTTServer',
      enabled: true,
      type: 'MQTT',
      settings: {
        url: 'mqtt://localhost:1883',
        qos: 1,
        persistent: true,
        clientId: 'OIBus-s57fvl9',
        username: 'bai',
        password: 'password',
        dataArrayPath: null,
        pointIdPath: 'name',
        qualityPath: 'quality',
        valuePath: 'value',
        timestampOrigin: 'oibus',
        timestampPath: 'timestamp',
        timestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
        timestampTimezone: 'Europe/Paris',
        connectTimeout: 1000,
        keepalive: true,
        reconnectPeriod: 1000,
        keyFile: '',
        certFile: '',
        caFile: '',
        rejectUnauthorized: false,
      },
      points: [
        {
          pointId: 'France/+/temperatureTank1',
          scanMode: 'listen',
          topic: 'France/+/temperatureTank1',
        },
        {
          pointId: 'France/#',
          scanMode: 'listen',
          topic: 'France/#',
        },
      ],
    }
    south = new MQTT(configuration, addValues, addFiles, logger)
    await south.start('baseFolder', 'oibusName')
  })

  it('should be properly initialized with correct timezone', () => {
    expect(south.url).toEqual(configuration.settings.url)
    expect(south.qos).toEqual(configuration.settings.qos)
    expect(south.persistent).toEqual(configuration.settings.persistent)
    expect(south.clientId).toEqual(`oibusName-${configuration.id}`)
    expect(south.username).toEqual(configuration.settings.username)
    expect(south.password).toEqual(configuration.settings.password)
    expect(south.timestampOrigin).toEqual(configuration.settings.timestampOrigin)
    expect(south.timestampPath).toEqual(configuration.settings.timestampPath)
    expect(south.timestampFormat).toEqual(configuration.settings.timestampFormat)
    expect(south.timezone).toEqual(configuration.settings.timestampTimezone)
    expect(south.client).toBeNull()
  })

  it('should be properly initialized with invalid timezone', async () => {
    const testMqttConfig = {
      ...configuration,
      settings: {
        ...configuration.settings,
        timestampTimezone: 'invalid',
      },
    }
    const mqttInvalidSouth = new MQTT(testMqttConfig, addValues, addFiles, logger)
    await mqttInvalidSouth.start('baseFolder', 'oibusName')

    expect(mqttInvalidSouth.url).toEqual(testMqttConfig.settings.url)
    expect(mqttInvalidSouth.qos).toEqual(testMqttConfig.settings.qos)
    expect(mqttInvalidSouth.persistent).toEqual(configuration.settings.persistent)
    expect(mqttInvalidSouth.clientId).toEqual(`oibusName-${configuration.id}`)
    expect(mqttInvalidSouth.username).toEqual(testMqttConfig.settings.username)
    expect(mqttInvalidSouth.password).toEqual(testMqttConfig.settings.password)
    expect(mqttInvalidSouth.timestampOrigin).toEqual(testMqttConfig.settings.timestampOrigin)
    expect(mqttInvalidSouth.timestampPath).toEqual(testMqttConfig.settings.timestampPath)
    expect(mqttInvalidSouth.timestampFormat).toEqual(testMqttConfig.settings.timestampFormat)
    expect(mqttInvalidSouth.timezone).toBeNull()
    expect(mqttInvalidSouth.logger.error).toBeCalledWith(`Invalid timezone supplied: ${testMqttConfig.settings.timestampTimezone}`)
    expect(mqttInvalidSouth.client).toBeNull()
  })

  it('should properly connect', async () => {
    south.listen = jest.fn()
    south.handleMessage = jest.fn()
    await south.connect()
    const expectedOptions = {
      clean: !configuration.settings.persistent,
      clientId: `oibusName-${configuration.id}`,
      username: configuration.settings.username,
      password: Buffer.from(configuration.settings.password),
      rejectUnauthorized: false,
      connectTimeout: 1000,
      keepalive: true,
      reconnectPeriod: 1000,
      ca: null,
      cert: null,
      key: null,
    }
    expect(mqtt.connect).toHaveBeenCalledWith(configuration.settings.url, expectedOptions)
    mqttStream.emit('connect')
    expect(south.listen).toHaveBeenCalledTimes(1)
    mqttStream.emit('error', 'error')
    expect(south.logger.error).toHaveBeenCalledWith('error')
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false })
    expect(south.logger.trace).toHaveBeenCalledWith('mqtt myTopic:myMessage, dup:false')
    expect(south.handleMessage).toHaveBeenCalledTimes(1)
    expect(south.handleMessage).toHaveBeenCalledWith('myTopic', 'myMessage')
  })

  it('should properly connect without password', async () => {
    south.password = ''
    south.listen = jest.fn()
    south.handleMessage = jest.fn()
    await south.connect()
    const expectedOptions = {
      clean: !configuration.settings.persistent,
      clientId: `oibusName-${configuration.id}`,
      username: configuration.settings.username,
      password: '',
      rejectUnauthorized: false,
      connectTimeout: 1000,
      keepalive: true,
      reconnectPeriod: 1000,
      ca: null,
      cert: null,
      key: null,
    }
    expect(mqtt.connect).toHaveBeenCalledWith(configuration.settings.url, expectedOptions)
  })

  it('should properly connect with cert files', async () => {
    CertificateService.privateKey = 'fileContent'
    CertificateService.cert = 'fileContent'
    CertificateService.ca = 'fileContent'

    mqtt.connect.mockReturnValue({ on: jest.fn() })
    const testMqttConfigWithFiles = {
      ...configuration,
      settings: {
        ...configuration.settings,
        caFile: 'myCaFile',
        keyFile: 'myKeyFile',
        certFile: 'myCertFile',
        rejectUnauthorized: true,
      },
    }

    const mqttSouthWithFiles = new MQTT(testMqttConfigWithFiles, addValues, addFiles, logger)
    await mqttSouthWithFiles.start('baseFolder', 'oibusName')
    mqttSouthWithFiles.certificate = CertificateService
    await mqttSouthWithFiles.connect()

    const expectedOptionsWithFiles = {
      clean: !configuration.settings.persistent,
      clientId: `oibusName-${configuration.id}`,
      username: configuration.settings.username,
      password: Buffer.from(configuration.settings.password),
      key: 'fileContent',
      cert: 'fileContent',
      ca: 'fileContent',
      rejectUnauthorized: true,
      connectTimeout: 1000,
      keepalive: true,
      reconnectPeriod: 1000,
    }
    expect(mqtt.connect).toBeCalledWith(testMqttConfigWithFiles.settings.url, expectedOptionsWithFiles)
  })

  it('should properly listen', async () => {
    await south.connect()
    await south.listen()

    expect(south.client.subscribe).toHaveBeenCalledTimes(2)
    expect(south.client.subscribe).toHaveBeenCalledWith(
      configuration.points[0].topic,
      { qos: configuration.settings.qos },
      expect.any(Function),
    )
    expect(south.client.subscribe).toHaveBeenCalledWith(
      configuration.points[1].topic,
      { qos: configuration.settings.qos },
      expect.any(Function),
    )

    south.client.subscribe = jest.fn((_topic, _option, callback) => { callback('error') })
    await south.listen()
    expect(south.logger.error).toHaveBeenCalledWith(`Error in subscription for topic ${configuration.points[0].topic}: `
        + 'error')

    south.client.subscribe = jest.fn((_topic, _option, callback) => { callback() })
    south.logger.error.mockClear()
    await south.listen()
    expect(south.logger.error).not.toHaveBeenCalled()
  })

  it('should properly handle message and call addValues if point ID was found', async () => {
    const pointId = 'pointId'
    const timestamp = 'timestamp'
    const topic = 'topic'
    const data = {
      value: 666.666,
      quality: true,
    }
    utils.formatValue.mockReturnValue({
      pointId,
      timestamp,
      data,
    })

    await south.handleMessage(topic, Buffer.from(JSON.stringify(data)))
    jest.runOnlyPendingTimers()

    expect(addValues).toBeCalledWith(configuration.id, [{
      pointId,
      timestamp,
      data,
    }])
  })

  it('should properly handle message and call addValues with dataArrayPath', async () => {
    south.dataArrayPath = 'myArray'
    const pointId = 'pointId'
    const timestamp = 'timestamp'
    const topic = 'topic'
    const data = {
      value: 666.666,
      quality: true,
    }

    utils.formatValue.mockReturnValue({
      pointId,
      timestamp,
      data,
    })

    await south.handleMessage(topic, Buffer.from(JSON.stringify({
      myArray: [{
        pointId,
        timestamp,
        data,
      }],
    })))
    jest.runOnlyPendingTimers()

    expect(addValues).toBeCalledWith(configuration.id, [{
      pointId,
      timestamp,
      data,
    }])
  })

  it('should properly handle message parsing error', async () => {
    utils.formatValue.mockImplementationOnce(() => {
      throw new Error('test')
    })

    const topic = 'topic'
    const data = {
      value: 666.666,
      quality: true,
    }
    await south.handleMessage(topic, Buffer.from(JSON.stringify(data)))

    expect(south.logger.error).toBeCalledWith(new Error('test'))
    expect(addValues).not.toBeCalled()
  })

  it('should properly handle message parsing error with dataArrayPath', async () => {
    south.dataArrayPath = 'myArray'
    const pointId = 'pointId'
    const timestamp = 'timestamp'
    const topic = 'topic'
    const data = {
      value: 666.666,
      quality: true,
    }

    const mqttMessage = {
      myOtherArray: [{
        pointId,
        timestamp,
        data,
      }],
    }
    await south.handleMessage(topic, Buffer.from(JSON.stringify(mqttMessage)))

    expect(south.logger.error).toHaveBeenCalledWith('Could not find the dataArrayPath "myArray" '
        + `in message "${JSON.stringify(mqttMessage)}".`)
    expect(addValues).not.toHaveBeenCalled()

    south.dataArrayPath = 'myOtherArray'
    utils.formatValue.mockImplementationOnce(() => {
      throw new Error('test')
    })

    await south.handleMessage(topic, Buffer.from(JSON.stringify(mqttMessage)))
    expect(south.logger.error).toHaveBeenCalledWith(new Error('test'))
  })

  it('should catch error when message is not a json', async () => {
    await south.handleMessage('myTopic', 'myMessage')
    expect(south.logger.error).toHaveBeenCalledWith('Could not parse message "myMessage" for topic "myTopic". '
        + 'SyntaxError: Unexpected token m in JSON at position 0')
  })

  it('should properly disconnect', () => {
    south.client = null
    south.disconnect()

    expect(south.logger.info).not.toHaveBeenCalledWith('Disconnecting from mqtt://localhost:1883...')

    south.client = { end: jest.fn() }

    south.disconnect()

    expect(south.client.end).toBeCalledWith(true)
    expect(south.logger.info).toHaveBeenCalledWith('Disconnecting from mqtt://localhost:1883...')
  })
})
