const mqtt = require('mqtt')

global.NorthHandler = require('../NorthHandler.class')
const MQTT = require('./MQTT.class')
const config = require('../../../tests/testConfig').default
const EncryptionService = require('../../services/EncryptionService.class')

// Mock mqtt
jest.mock('mqtt', () => ({ connect: jest.fn() }))

// Mock logger
jest.mock('../../engine/logger/Logger.class')

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock engine
const engine = jest.mock('../../engine/OIBusEngine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.engineName = 'Test MQTT'
engine.logger = { error: jest.fn(), info: jest.fn(), trace: jest.fn() }
engine.eventEmitters = {}

const CertificateService = jest.mock('../../services/CertificateService.class')
CertificateService.init = jest.fn()
CertificateService.logger = engine.logger

const mqttConfig = config.north.applications[3]
let mqttNorth = null

beforeEach(async () => {
  jest.resetAllMocks()
  jest.clearAllMocks()
  mqttNorth = new MQTT(mqttConfig, engine)
  await mqttNorth.init()
})

describe('MQTT north', () => {
  it('should properly connect', () => {
    mqtt.connect.mockReturnValue({ on: jest.fn() })
    mqttNorth.connect()

    const expectedOptions = {
      clientId: `${engine.engineName}-${mqttConfig.id}`,
      username: mqttConfig.MQTT.username,
      password: Buffer.from(mqttConfig.MQTT.password),
      key: null,
      cert: null,
      ca: null,
      rejectUnauthorized: false,
    }
    expect(mqtt.connect).toBeCalledWith(mqttConfig.MQTT.url, expectedOptions)
    expect(mqttNorth.client.on).toHaveBeenCalledTimes(2)
    expect(mqttNorth.client.on).toHaveBeenCalledWith('error', expect.any(Function))
    expect(mqttNorth.client.on).toHaveBeenCalledWith('connect', expect.any(Function))

    mqttNorth.handleConnectEvent()
    expect(mqttNorth.logger.info).toHaveBeenCalledWith('North API mqtt started with protocol MQTT url: mqtt://hostname:1883')
  })

  it('should properly connect with cert files', async () => {
    mqtt.connect.mockReturnValue({ on: jest.fn() })

    CertificateService.privateKey = 'fileContent'
    CertificateService.cert = 'fileContent'
    CertificateService.ca = 'fileContent'

    const testMqttConfigWithFiles = {
      ...mqttConfig,
      MQTT: {
        ...mqttConfig.MQTT,
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
      clientId: `${engine.engineName}-${mqttConfig.id}`,
      username: mqttConfig.MQTT.username,
      password: Buffer.from(mqttConfig.MQTT.password),
      key: 'fileContent',
      cert: 'fileContent',
      ca: 'fileContent',
      rejectUnauthorized: true,
    }
    expect(mqtt.connect)
      .toBeCalledWith(testMqttConfigWithFiles.MQTT.url, expectedOptionsWithFiles)
  })

  it('should properly handle the connect error event', async () => {
    const error = new Error('test')

    mqttNorth.handleConnectError(error)

    expect(mqttNorth.logger.error)
      .toBeCalledWith(error)
  })

  it('should properly handle values and publish them', async () => {
    mqttNorth.client = { publish: jest.fn().mockImplementation((topic, data, params, callback) => callback()) }
    const values = [{
      pointId: 'paris/sensor1',
      data: { value: 666 },
    }]

    let expectedResult = null
    let expectedError = null
    try {
      expectedResult = await mqttNorth.handleValues(values)
    } catch (error) {
      expectedError = error
    }

    expect(mqttNorth.client.publish).toBeCalledWith('paris', JSON.stringify(values[0].data), { qos: 1 }, expect.any(Function))
    expect(expectedResult).toEqual(values.length)
    expect(expectedError).toBeNull()
  })

  it('should properly handle values with publish error', async () => {
    mqttNorth.client = { publish: jest.fn().mockImplementation((topic, data, params, callback) => callback(true)) }
    const values = [{
      pointId: 'paris/sensor1',
      data: { value: 666 },
    }]

    let expectedResult = null
    let expectedError = null
    try {
      expectedResult = await mqttNorth.handleValues(values)
    } catch (error) {
      expectedError = error
    }

    expect(mqttNorth.client.publish).toBeCalledWith('paris', JSON.stringify(values[0].data), { qos: 1 }, expect.any(Function))
    expect(expectedResult).toBeNull()
    expect(expectedError).toEqual(NorthHandler.STATUS.COMMUNICATION_ERROR)
  })

  it('should properly disconnect', () => {
    mqttNorth.client = { end: jest.fn() }

    mqttNorth.disconnect()

    expect(mqttNorth.client.end).toBeCalledWith(true)
  })

  it('should properly handle values with useDataKeyValue', async () => {
    const timestamp = new Date('2020-02-29T12:12:12Z').toISOString()
    mqtt.connect.mockReturnValue({ on: jest.fn(), publish: jest.fn((topic, data, opts, callback) => callback()) })
    mqttNorth.connect()

    mqttNorth.useDataKeyValue = true
    mqttNorth.keyParentValue = 'level'
    let expectedResult = null
    let expectedError = null
    try {
      expectedResult = await mqttNorth.handleValues([{
        pointId: 'ANA/BL1RCP05',
        timestamp,
        data: {
          value: { level: { value: 666 } },
          quality: 'good',
        },
      }])
    } catch (error) {
      expectedError = error
    }

    expect(expectedResult).toEqual(1)
    expect(expectedError).toBeNull()
  })
})
