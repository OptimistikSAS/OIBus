const mqtt = require('mqtt')

const ApiHandler = require('../ApiHandler.class')
const MQTTNorth = require('./MQTTNorth.class')
const config = require('../../../tests/testConfig').default
const EncryptionService = require('../../services/EncryptionService.class')

// Mock logger
jest.mock('../../engine/Logger.class')

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock engine
const engine = jest.genMockFromModule('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }

beforeEach(() => {
  jest.resetAllMocks()
  jest.clearAllMocks()
})

describe('MQTTNorth north', () => {
  const mqttConfig = config.north.applications[3]
  const mqttNorth = new MQTTNorth(mqttConfig, engine)

  it('should properly connect', () => {
    jest.spyOn(mqtt, 'connect').mockImplementation(() => ({ on: jest.fn() }))
    // mqtt.connect.mockReturnValue({ on: jest.fn() })

    mqttNorth.connect()

    const expectedOptions = { username: mqttConfig.MQTTNorth.username, password: Buffer.from(mqttConfig.MQTTNorth.password) }
    expect(mqtt.connect).toBeCalledWith(mqttConfig.MQTTNorth.url, expectedOptions)
    expect(mqttNorth.client.on).toHaveBeenCalledTimes(2)
    expect(mqttNorth.client.on).toHaveBeenCalledWith('error', expect.any(Function))
    expect(mqttNorth.client.on).toHaveBeenCalledWith('connect', expect.any(Function))
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
    expect(expectedError).toEqual(ApiHandler.STATUS.COMMUNICATION_ERROR)
  })

  it('should properly disconnect', () => {
    mqttNorth.client = { end: jest.fn() }

    mqttNorth.disconnect()

    expect(mqttNorth.client.end).toBeCalledWith(true)
  })
})
