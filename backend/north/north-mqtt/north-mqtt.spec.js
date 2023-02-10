import mqtt from 'mqtt'

import MQTT from './north-mqtt.js'

// Mock mqtt
jest.mock('mqtt', () => ({ connect: jest.fn() }))

// Mock fs
jest.mock('node:fs/promises')

// Mock services
jest.mock('../../service/database.service')
jest.mock('../../service/status.service')
jest.mock('../../service/encryption.service', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))
jest.mock('../../service/cache/value-cache.service')
jest.mock('../../service/cache/file-cache.service')
jest.mock('../../service/cache/archive.service')

// Mock logger
const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
}

// Mock certificate service
const CertificateService = jest.mock('../../service/certificate.service')

let configuration = null
let north = null

describe('NorthMQTT', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers()

    configuration = {
      id: 'northId',
      name: 'mqtt',
      type: 'MQTT',
      enabled: true,
      settings: {
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
        sendInterval: 1000,
        retryInterval: 5000,
        groupCount: 10000,
        maxSendCount: 10000,
        archive: {
          enabled: true,
          retentionDuration: 720,
        },
      },
      subscribedTo: [],
    }
    north = new MQTT(configuration, {}, logger)
    await north.start()
  })

  it('should properly connect', async () => {
    mqtt.connect.mockReturnValue({ on: jest.fn() })
    await north.connect()

    const expectedOptions = {
      clientId: `oibusName-${configuration.id}`,
      username: configuration.settings.username,
      password: Buffer.from(configuration.settings.password),
      key: null,
      cert: null,
      ca: null,
      rejectUnauthorized: false,
    }
    expect(mqtt.connect).toBeCalledWith(configuration.settings.url, expectedOptions)
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
      ...configuration,
      settings: {
        ...configuration.settings,
        password: '',
        caFile: 'myCaFile',
        keyFile: 'myKeyFile',
        certFile: 'myCertFile',
        rejectUnauthorized: true,
      },
    }

    const mqttNorthCert = new MQTT(testMqttConfigWithFiles, [], logger)
    await mqttNorthCert.start()
      mqttNorthCert.certificate = CertificateService
    await mqttNorthCert.connect()

    const expectedOptionsWithFiles = {
      clientId: `oibusName-${configuration.id}`,
      username: configuration.settings.username,
      password: '',
      key: 'fileContent',
      cert: 'fileContent',
      ca: 'fileContent',
      rejectUnauthorized: true,
    }
    expect(mqtt.connect).toBeCalledWith(testMqttConfigWithFiles.settings.url, expectedOptionsWithFiles)
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
