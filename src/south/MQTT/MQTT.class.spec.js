const mqtt = require('mqtt')

const MQTT = require('./MQTT.class')

const utils = require('./utils')

const { defaultConfig: config } = require('../../../tests/testConfig')

// Mock mqtt
jest.mock('mqtt', () => ({ connect: jest.fn() }))

// Mock utils class
jest.mock('./utils', () => ({ formatValue: jest.fn() }))

// Mock certificate service
const CertificateService = jest.mock('../../services/CertificateService.class')

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

describe('South MQTT', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers()

    mqtt.connect.mockReturnValue({ on: jest.fn(), subscribe: jest.fn() })

    settings = {
      id: 'southId',
      name: 'MQTTServer',
      enabled: true,
      protocol: 'MQTT',
      MQTT: {
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
    south = new MQTT(settings, engine)
    await south.init()
  })

  it('should be properly initialized with correct timezone', () => {
    expect(south.url).toEqual(settings.MQTT.url)
    expect(south.qos).toEqual(settings.MQTT.qos)
    expect(south.persistent).toEqual(settings.MQTT.persistent)
    expect(south.clientId).toEqual(`${engine.engineName}-${settings.id}`)
    expect(south.username).toEqual(settings.MQTT.username)
    expect(south.password).toEqual(settings.MQTT.password)
    expect(south.timestampOrigin).toEqual(settings.MQTT.timestampOrigin)
    expect(south.timestampPath).toEqual(settings.MQTT.timestampPath)
    expect(south.timestampFormat).toEqual(settings.MQTT.timestampFormat)
    expect(south.timezone).toEqual(settings.MQTT.timestampTimezone)
    expect(south.client).toBeNull()
  })

  it('should be properly initialized with invalid timezone', async () => {
    const testMqttConfig = {
      ...settings,
      MQTT: {
        ...settings.MQTT,
        timestampTimezone: 'invalid',
      },
    }
    const mqttInvalidSouth = new MQTT(testMqttConfig, engine)
    await mqttInvalidSouth.init()

    expect(mqttInvalidSouth.url).toEqual(testMqttConfig.MQTT.url)
    expect(mqttInvalidSouth.qos).toEqual(testMqttConfig.MQTT.qos)
    expect(mqttInvalidSouth.persistent).toEqual(settings.MQTT.persistent)
    expect(mqttInvalidSouth.clientId).toEqual(`${engine.engineName}-${settings.id}`)
    expect(mqttInvalidSouth.username).toEqual(testMqttConfig.MQTT.username)
    expect(mqttInvalidSouth.password).toEqual(testMqttConfig.MQTT.password)
    expect(mqttInvalidSouth.timestampOrigin).toEqual(testMqttConfig.MQTT.timestampOrigin)
    expect(mqttInvalidSouth.timestampPath).toEqual(testMqttConfig.MQTT.timestampPath)
    expect(mqttInvalidSouth.timestampFormat).toEqual(testMqttConfig.MQTT.timestampFormat)
    expect(mqttInvalidSouth.timezone).toBeNull()
    expect(mqttInvalidSouth.logger.error).toBeCalledWith(`Invalid timezone supplied: ${testMqttConfig.MQTT.timestampTimezone}`)
    expect(mqttInvalidSouth.client).toBeNull()
  })

  it('should properly connect', async () => {
    await south.connect()
    const expectedOptions = {
      clean: !settings.MQTT.persistent,
      clientId: `${engine.engineName}-${settings.id}`,
      username: settings.MQTT.username,
      password: Buffer.from(settings.MQTT.password),
      rejectUnauthorized: false,
      connectTimeout: 1000,
      keepalive: true,
      reconnectPeriod: 1000,
      ca: null,
      cert: null,
      key: null,
    }
    expect(mqtt.connect).toBeCalledWith(settings.MQTT.url, expectedOptions)
    expect(south.client.on).toHaveBeenCalledTimes(3)
    expect(south.client.on).toHaveBeenCalledWith('error', expect.any(Function))
    expect(south.client.on).toHaveBeenCalledWith('connect', expect.any(Function))
    expect(south.client.on).toHaveBeenCalledWith('message', expect.any(Function))
  })

  it('should properly connect with cert files', async () => {
    CertificateService.privateKey = 'fileContent'
    CertificateService.cert = 'fileContent'
    CertificateService.ca = 'fileContent'

    mqtt.connect.mockReturnValue({ on: jest.fn() })
    const testMqttConfigWithFiles = {
      ...settings,
      MQTT: {
        ...settings.MQTT,
        caFile: 'myCaFile',
        keyFile: 'myKeyFile',
        certFile: 'myCertFile',
        rejectUnauthorized: true,
      },
    }

    const mqttSouthWithFiles = new MQTT(testMqttConfigWithFiles, engine)
    await mqttSouthWithFiles.init()
    mqttSouthWithFiles.certificate = CertificateService
    await mqttSouthWithFiles.connect()

    const expectedOptionsWithFiles = {
      clean: !settings.MQTT.persistent,
      clientId: `${engine.engineName}-${settings.id}`,
      username: settings.MQTT.username,
      password: Buffer.from(settings.MQTT.password),
      key: 'fileContent',
      cert: 'fileContent',
      ca: 'fileContent',
      rejectUnauthorized: true,
      connectTimeout: 1000,
      keepalive: true,
      reconnectPeriod: 1000,
    }
    expect(mqtt.connect).toBeCalledWith(testMqttConfigWithFiles.MQTT.url, expectedOptionsWithFiles)
  })

  it('should properly listen', async () => {
    await south.connect()
    await south.listen()

    expect(south.client.subscribe).toHaveBeenCalledTimes(2)
    expect(south.client.subscribe).toHaveBeenCalledWith(
      settings.points[0].topic,
      { qos: settings.MQTT.qos },
      expect.any(Function),
    )
    expect(south.client.subscribe).toHaveBeenCalledWith(
      settings.points[1].topic,
      { qos: settings.MQTT.qos },
      expect.any(Function),
    )
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

    expect(south.engine.addValues).toBeCalledWith(settings.id, [{
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
    expect(south.engine.addValues).not.toBeCalled()
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
