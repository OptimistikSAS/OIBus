const fs = require('fs/promises')
const mqtt = require('mqtt')

const ApiHandler = require('../ApiHandler.class')
const MQTTNorth = require('./MQTTNorth.class')
const config = require('../../../tests/testConfig').default
const EncryptionService = require('../../services/EncryptionService.class')

// Mock logger
jest.mock('../../engine/Logger.class')

// Mock fs
jest.mock('fs/promises', () => ({
  exists: jest.fn(() => new Promise((resolve) => {
    resolve(true)
  })),
  readFile: jest.fn(() => new Promise((resolve) => {
    resolve('fileContent')
  })),
}))

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock engine
const engine = jest.mock('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }

beforeEach(() => {
  jest.resetAllMocks()
  jest.clearAllMocks()
})

describe('MQTTNorth north', () => {
  it('should properly connect', () => {
    const mqttConfig = config.north.applications[3]
    const mqttNorth = new MQTTNorth(mqttConfig, engine)
    jest.spyOn(mqtt, 'connect').mockImplementation(() => ({ on: jest.fn() }))
    mqttNorth.connect()

    const expectedOptions = {
      username: mqttConfig.MQTTNorth.username,
      password: Buffer.from(mqttConfig.MQTTNorth.password),
      clientId: 'myClientId',
      key: '',
      cert: '',
      ca: '',
      rejectUnauthorized: false,
    }
    expect(mqtt.connect).toBeCalledWith(mqttConfig.MQTTNorth.url, expectedOptions)
    expect(mqttNorth.client.on).toHaveBeenCalledTimes(2)
    expect(mqttNorth.client.on).toHaveBeenCalledWith('error', expect.any(Function))
    expect(mqttNorth.client.on).toHaveBeenCalledWith('connect', expect.any(Function))

    mqttNorth.handleConnectEvent()
    expect(mqttNorth.logger.info).toHaveBeenCalledWith(`North MQTT Connector connected to ${mqttConfig.MQTTNorth.url}`)
  })

  it('should properly connect when cert files do not exist', async () => {
    const mqttConfig = config.north.applications[3]
    jest.spyOn(mqtt, 'connect').mockImplementation(() => ({ on: jest.fn() }))
    const RealMath = global.Math
    const mockMath = Object.create(global.Math)
    mockMath.random = () => 0.12345
    global.Math = mockMath
    jest.spyOn(fs, 'exists').mockImplementation(() => false)
    const testMqttConfigWithFiles = {
      ...mqttConfig,
      MQTTNorth: {
        ...mqttConfig.MQTTNorth,
        clientId: '',
        caFile: 'myCaFile',
        keyFile: 'myKeyFile',
        certFile: 'myCertFile',
        rejectUnauthorized: true,
      },
    }
    const mqttNorth = new MQTTNorth(testMqttConfigWithFiles, engine)
    await mqttNorth.connect()

    const expectedOptionsWithFiles = {
      clientId: 'OIBus-1f9a6b50',
      username: mqttConfig.MQTTNorth.username,
      password: Buffer.from(mqttConfig.MQTTNorth.password),
      key: '',
      cert: '',
      ca: '',
      rejectUnauthorized: true,
    }
    expect(mqtt.connect)
      .toBeCalledWith(testMqttConfigWithFiles.MQTTNorth.url, expectedOptionsWithFiles)
    expect(mqttNorth.logger.error)
      .toBeCalledWith('Key file myKeyFile does not exist')
    expect(mqttNorth.logger.error)
      .toBeCalledWith('Cert file myCertFile does not exist')
    expect(mqttNorth.logger.error)
      .toBeCalledWith('CA file myCaFile does not exist')
    global.Math = RealMath
  })

  it('should properly connect with cert files', async () => {
    const mqttConfig = config.north.applications[3]

    jest.spyOn(mqtt, 'connect').mockImplementation(() => ({ on: jest.fn() }))
    jest.spyOn(fs, 'exists').mockImplementation(() => true)
    jest.spyOn(fs, 'readFile').mockImplementation(() => 'fileContent')
    const testMqttConfigWithFiles = {
      ...mqttConfig,
      MQTTNorth: {
        ...mqttConfig.MQTTNorth,
        caFile: 'myCaFile',
        keyFile: 'myKeyFile',
        certFile: 'myCertFile',
        rejectUnauthorized: true,
      },
    }

    const mqttNorth = new MQTTNorth(testMqttConfigWithFiles, engine)
    await mqttNorth.connect()

    const expectedOptionsWithFiles = {
      clientId: mqttConfig.MQTTNorth.clientId,
      username: mqttConfig.MQTTNorth.username,
      password: Buffer.from(mqttConfig.MQTTNorth.password),
      key: 'fileContent',
      cert: 'fileContent',
      ca: 'fileContent',
      rejectUnauthorized: true,
    }
    expect(mqtt.connect)
      .toBeCalledWith(testMqttConfigWithFiles.MQTTNorth.url, expectedOptionsWithFiles)
  })

  it('should properly handle the connect error event', async () => {
    const mqttConfig = config.north.applications[3]

    const mqttNorth = new MQTTNorth(mqttConfig, engine)
    const error = new Error('test')

    mqttNorth.handleConnectError(error)

    expect(mqttNorth.logger.error)
      .toBeCalledWith(error)

    jest.spyOn(fs, 'exists').mockImplementation(() => {
      throw new Error('test')
    })

    const testMqttConfigError1 = {
      ...mqttConfig,
      MQTTNorth: {
        ...mqttConfig.MQTTNorth,
        caFile: 'myCaFile',
      },
    }
    const mqttSouthError1 = new MQTTNorth(testMqttConfigError1, engine)

    await mqttSouthError1.connect()

    expect(mqttSouthError1.logger.error)
      .toBeCalledWith('Error reading ca file myCaFile: Error: test')

    const testMqttConfig2 = {
      ...mqttConfig,
      MQTTNorth: {
        ...mqttConfig.MQTTNorth,
        certFile: 'myCertFile',
      },
    }
    const mqttSouthError2 = new MQTTNorth(testMqttConfig2, engine)

    await mqttSouthError2.connect()

    expect(mqttSouthError2.logger.error)
      .toBeCalledWith('Error reading cert file myCertFile: Error: test')

    const testMqttConfig3 = {
      ...mqttConfig,
      MQTTNorth: {
        ...mqttConfig.MQTTNorth,
        keyFile: 'myKeyFile',
      },
    }
    const mqttSouthError3 = new MQTTNorth(testMqttConfig3, engine)

    await mqttSouthError3.connect()

    expect(mqttSouthError3.logger.error)
      .toBeCalledWith('Error reading key file myKeyFile: Error: test')
  })

  it('should properly handle values and publish them', async () => {
    const mqttConfig = config.north.applications[3]
    const mqttNorth = new MQTTNorth(mqttConfig, engine)
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
    const mqttConfig = config.north.applications[3]
    const mqttNorth = new MQTTNorth(mqttConfig, engine)
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
    expect(expectedError).toEqual(ApiHandler.STATUS.COMMUNICATION_ERROR)
  })

  it('should properly disconnect', () => {
    const mqttConfig = config.north.applications[3]
    const mqttNorth = new MQTTNorth(mqttConfig, engine)
    mqttNorth.client = { end: jest.fn() }

    mqttNorth.disconnect()

    expect(mqttNorth.client.end).toBeCalledWith(true)
  })
})
