const mqtt = require('mqtt')

const MQTT = require('./MQTT.class')

const { defaultConfig: config } = require('../../../tests/testConfig')

// Mock mqtt
jest.mock('mqtt', () => ({ connect: jest.fn() }))

// Mock OIBusEngine
const engine = {
  configService: { getConfig: () => ({ engineConfig: config.engine }) },
  requestService: { httpSend: jest.fn() },
  getCacheFolder: jest.fn(),
}

// Mock services
jest.mock('../../services/database.service')
jest.mock('../../engine/logger/Logger.class')
jest.mock('../../services/status.service.class')
jest.mock('../../services/EncryptionService.class', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))
jest.mock('../../engine/cache/ValueCache.class')
jest.mock('../../engine/cache/FileCache.class')

// Mock certificate service
const CertificateService = jest.mock('../../services/CertificateService.class')

let settings = null
let north = null

describe('North MQTT', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers()

    settings = {
      id: 'northId',
      name: 'mqtt',
      api: 'MQTT',
      enabled: true,
      MQTT: {
        password: 'anypass',
        url: 'mqtt://hostname:1883',
        username: 'anyuser',
        qos: 1,
        regExp: '(.*)/',
        topic: '%1$s',
        keyFile: '',
        certFile: '',
        caFile: '',
        rejectUnauthorized: false,
        useDataKeyValue: false,
        keyParentValue: '',
      },
      caching: {
        sendInterval: 10000,
        retryInterval: 5000,
        groupCount: 1000,
        maxSendCount: 10000,
      },
      subscribedTo: [],
    }
    north = new MQTT(settings, engine)
    await north.init()
  })

  it('should properly connect', async () => {
    mqtt.connect.mockReturnValue({ on: jest.fn() })
    await north.connect()

    const expectedOptions = {
      clientId: `${engine.engineName}-${settings.id}`,
      username: settings.MQTT.username,
      password: Buffer.from(settings.MQTT.password),
      key: null,
      cert: null,
      ca: null,
      rejectUnauthorized: false,
    }
    expect(mqtt.connect).toBeCalledWith(settings.MQTT.url, expectedOptions)
    expect(north.client.on).toHaveBeenCalledTimes(2)
    expect(north.client.on).toHaveBeenCalledWith('error', expect.any(Function))
    expect(north.client.on).toHaveBeenCalledWith('connect', expect.any(Function))

    expect(north.logger.info).toHaveBeenCalledWith('Connecting North "mqtt" to "mqtt://hostname:1883".')

    await north.onConnect()
    expect(north.logger.info).toBeCalledWith('North connector "mqtt" of type MQTT started with url: "mqtt://hostname:1883".')

    await north.onError('test')
    expect(north.logger.error).toBeCalledWith('test')
  })

  it('should properly connect with cert files', async () => {
    mqtt.connect.mockReturnValue({ on: jest.fn() })

    CertificateService.privateKey = 'fileContent'
    CertificateService.cert = 'fileContent'
    CertificateService.ca = 'fileContent'

    const testMqttConfigWithFiles = {
      ...settings,
      MQTT: {
        ...settings.MQTT,
        password: '',
        caFile: 'myCaFile',
        keyFile: 'myKeyFile',
        certFile: 'myCertFile',
        rejectUnauthorized: true,
      },
    }

    const mqttNorthCert = new MQTT(testMqttConfigWithFiles, engine)
    await mqttNorthCert.init()
    mqttNorthCert.certificate = CertificateService
    await mqttNorthCert.connect()

    const expectedOptionsWithFiles = {
      clientId: `${engine.engineName}-${settings.id}`,
      username: settings.MQTT.username,
      password: '',
      key: 'fileContent',
      cert: 'fileContent',
      ca: 'fileContent',
      rejectUnauthorized: true,
    }
    expect(mqtt.connect).toBeCalledWith(testMqttConfigWithFiles.MQTT.url, expectedOptionsWithFiles)
  })

  it('should properly handle values and publish them', async () => {
    north.client = { publish: jest.fn().mockImplementation((topic, data, params, callback) => callback()) }
    const values = [{
      pointId: 'paris/sensor1',
      data: { value: 666 },
    }]

    await north.handleValues(values)

    expect(north.client.publish).toBeCalledWith('paris', JSON.stringify(values[0].data), { qos: 1 }, expect.any(Function))
  })

  it('should properly handle values with publish error', async () => {
    north.client = { publish: jest.fn().mockImplementation(async (topic, data, params, callback) => callback(new Error('publishError'))) }
    const values = [{
      pointId: 'paris/sensor1',
      data: { value: 666 },
    }]

    await expect(north.handleValues(values)).rejects.toThrowError('publishError')

    expect(north.client.publish).toBeCalledWith('paris', JSON.stringify(values[0].data), { qos: 1 }, expect.any(Function))
  })

  it('should properly disconnect', async () => {
    north.client = { end: jest.fn() }

    await north.disconnect()

    expect(north.client.end).toBeCalledWith(true)
  })

  it('should properly handle values with useDataKeyValue', async () => {
    const timestamp = new Date('2020-02-29T12:12:12Z').toISOString()
    mqtt.connect.mockReturnValue({ on: jest.fn(), publish: jest.fn((topic, data, opts, callback) => callback()) })
    await north.connect()

    north.useDataKeyValue = true
    north.keyParentValue = 'level'
    await north.handleValues([{
      pointId: 'ANA/BL1RCP05',
      timestamp,
      data: {
        value: { level: { value: 666 } },
        quality: 'good',
      },
    }])
  })
})
