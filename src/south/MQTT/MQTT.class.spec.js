const mqtt = require('mqtt')

const MQTT = require('./MQTT.class')
const config = require('../../config/defaultConfig.json')

// Mock mqtt
jest.mock('mqtt', () => ({ connect: jest.fn() }))

// Mock logger
jest.mock('../../engine/Logger.class', () => (function logger() {
  return {
    silly: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  }
}))

// Mock engine
const engine = jest.genMockFromModule('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.decryptPassword = (password) => password

beforeEach(() => {
  jest.resetAllMocks()
  jest.clearAllMocks()
})

describe('MQTT south', () => {
  const mqttConfig = {
    dataSourceId: 'MQTTServer',
    enabled: true,
    protocol: MQTT,
    MQTT: {
      url: 'mqtt://localhost:1883',
      qos: 1,
      username: 'bai',
      password: 'password',
      timeStampOrigin: 'oibus',
      timeStampKey: 'timestamp',
      timeStampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
      timeStampTimezone: 'Europe/Paris',
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

  it('should be properly initialized with correct timezone', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)

    expect(mqttSouth.url).toEqual(mqttConfig.MQTT.url)
    expect(mqttSouth.qos).toEqual(mqttConfig.MQTT.qos)
    expect(mqttSouth.username).toEqual(mqttConfig.MQTT.username)
    expect(mqttSouth.password).toEqual(Buffer.from(mqttConfig.MQTT.password))
    expect(mqttSouth.timeStampOrigin).toEqual(mqttConfig.MQTT.timeStampOrigin)
    expect(mqttSouth.timeStampKey).toEqual(mqttConfig.MQTT.timeStampKey)
    expect(mqttSouth.timeStampFormat).toEqual(mqttConfig.MQTT.timeStampFormat)
    expect(mqttSouth.timezone).toEqual(mqttConfig.MQTT.timeStampTimezone)
    expect(mqttSouth.client).toBeUndefined()
  })

  it('should be properly initialized with invalid timezone', () => {
    const testMqttConfig = {
      ...mqttConfig,
      MQTT: {
        ...mqttConfig.MQTT,
        timeStampTimezone: 'invalid',
      },
    }
    const mqttSouth = new MQTT(testMqttConfig, engine)

    expect(mqttSouth.url).toEqual(testMqttConfig.MQTT.url)
    expect(mqttSouth.qos).toEqual(testMqttConfig.MQTT.qos)
    expect(mqttSouth.username).toEqual(testMqttConfig.MQTT.username)
    expect(mqttSouth.password).toEqual(Buffer.from(testMqttConfig.MQTT.password))
    expect(mqttSouth.timeStampOrigin).toEqual(testMqttConfig.MQTT.timeStampOrigin)
    expect(mqttSouth.timeStampKey).toEqual(testMqttConfig.MQTT.timeStampKey)
    expect(mqttSouth.timeStampFormat).toEqual(testMqttConfig.MQTT.timeStampFormat)
    expect(mqttSouth.timezone).toBeUndefined()
    expect(mqttSouth.logger.error).toBeCalledWith(`Invalid timezone supplied: ${testMqttConfig.MQTT.timeStampTimezone}`)
    expect(mqttSouth.client).toBeUndefined()
  })

  it('should properly connect', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    mqtt.connect.mockReturnValue({ on: jest.fn() })

    mqttSouth.connect()

    const expectedOptions = { username: mqttConfig.MQTT.username, password: Buffer.from(mqttConfig.MQTT.password) }
    expect(mqtt.connect).toBeCalledWith(mqttConfig.MQTT.url, expectedOptions)
    expect(mqttSouth.client.on).toHaveBeenCalledTimes(2)
    expect(mqttSouth.client.on).toHaveBeenCalledWith('error', expect.any(Function))
    expect(mqttSouth.client.on).toHaveBeenCalledWith('connect', expect.any(Function))
  })

  it('should properly handle the connect error event', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    const error = new Error('test')

    mqttSouth.handleConnectError(error)

    expect(mqttSouth.logger.error).toBeCalledWith(error)
  })

  it('should properly handle the connect success event', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    mqttSouth.client = {
      on: jest.fn(),
      subscribe: jest.fn(),
    }

    mqttSouth.handleConnectEvent()

    expect(mqttSouth.logger.info).toBeCalledWith(`Connected to ${mqttConfig.MQTT.url}`)
    expect(mqttSouth.client.subscribe).toHaveBeenCalledTimes(2)
    expect(mqttSouth.client.subscribe).toHaveBeenCalledWith(mqttConfig.points[0].topic, { qos: mqttConfig.MQTT.qos}, expect.any(Function))
    expect(mqttSouth.client.subscribe).toHaveBeenCalledWith(mqttConfig.points[1].topic, { qos: mqttConfig.MQTT.qos}, expect.any(Function))
    expect(mqttSouth.client.on).toHaveBeenCalledTimes(1)
    expect(mqttSouth.client.on).toHaveBeenCalledWith('message', expect.any(Function))
  })

  it('should not log error in subscribe callback when successfully subscribed', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)

    mqttSouth.subscribeCallback(null)

    expect(mqttSouth.logger.error).not.toBeCalled()
  })

  it('should properly log error in subscribe callback', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    const error = new Error('test')

    mqttSouth.subscribeCallback(error)

    expect(mqttSouth.logger.error).toBeCalledWith(error)
  })

  it('should properly handle message and call addValues if point ID was found', () => {
    const pointId = 'pointId'
    const timestamp = 'timestamp'

    const mqttSouth = new MQTT(mqttConfig, engine)
    mqttSouth.getTimestamp = jest.fn()
    mqttSouth.getTimestamp.mockReturnValue(timestamp)
    mqttSouth.getPointId = jest.fn()
    mqttSouth.getPointId.mockReturnValue(pointId)
    mqttSouth.addValues = jest.fn()

    const topic = 'topic'
    const data = { value: 666.666, quality: true }
    const packet = { dup: 0 }

    mqttSouth.handleMessageEvent(topic, Buffer.from(JSON.stringify(data)), packet)

    expect(mqttSouth.logger.silly).toBeCalled()
    expect(mqttSouth.getTimestamp).toBeCalledWith(data)
    expect(mqttSouth.getPointId).toBeCalledWith(topic)
    expect(mqttSouth.addValues).toBeCalledWith([{ pointId, timestamp, data }])
  })

  it('should properly handle message but not call addValues if point ID was not found', () => {
    const pointId = null
    const timestamp = 'timestamp'

    const mqttSouth = new MQTT(mqttConfig, engine)
    mqttSouth.getTimestamp = jest.fn()
    mqttSouth.getTimestamp.mockReturnValue(timestamp)
    mqttSouth.getPointId = jest.fn()
    mqttSouth.getPointId.mockReturnValue(pointId)
    mqttSouth.addValues = jest.fn()

    const topic = 'topic'
    const data = { value: 666.666, quality: true }
    const packet = { dup: 0 }

    mqttSouth.handleMessageEvent(topic, Buffer.from(JSON.stringify(data)), packet)

    expect(mqttSouth.logger.silly).toBeCalled()
    expect(mqttSouth.getTimestamp).toBeCalledWith(data)
    expect(mqttSouth.getPointId).toBeCalledWith(topic)
    expect(mqttSouth.addValues).not.toBeCalled()
    expect(mqttSouth.logger.error).toBeCalledWith('PointId can\'t be determined. The value is not saved. Configuration needs to be changed')
  })

  it('should properly handle message parsing error', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    mqttSouth.getTimestamp = jest.fn()
    mqttSouth.getPointId = jest.fn()
    mqttSouth.addValues = jest.fn()

    const topic = 'Paris/something/sensor666'
    const data = 'invalid'
    const packet = { dup: 0 }

    mqttSouth.handleMessageEvent(topic, Buffer.from(data), packet)

    expect(mqttSouth.logger.silly).toBeCalled()
    expect(mqttSouth.getTimestamp).not.toBeCalled()
    expect(mqttSouth.getPointId).not.toBeCalled()
    expect(mqttSouth.addValues).not.toBeCalled()
    expect(mqttSouth.logger.error).toBeCalled()
  })

  it('should properly disconnect', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    mqttSouth.client = { end: jest.fn() }

    mqttSouth.disconnect()

    expect(mqttSouth.client.end).toBeCalledWith(true)
  })

  it('should properly return timestamp when timeStampOrigin is oibus', () => {
    const nowDateString = '2020-02-02T02:02:02.222Z'
    const RealDate = Date
    global.Date = jest.fn(() => new RealDate(nowDateString))

    const mqttSouth = new MQTT(mqttConfig, engine)

    mqttSouth.timeStampOrigin = 'oibus'
    const mockGenerateDateWithTimezone = jest.spyOn(MQTT, 'generateDateWithTimezone')

    const timestamp = mqttSouth.getTimestamp({ value: 666.666, quality: true, timestamp: '2020-02-02 02:02:02' })

    expect(mockGenerateDateWithTimezone).not.toBeCalled()
    expect(mqttSouth.logger.error).not.toBeCalled()
    expect(timestamp).toEqual(nowDateString)

    mockGenerateDateWithTimezone.mockRestore()
    global.Date = RealDate
  })

  it('should properly return timestamp when timeStampOrigin is payload and timestamp field is present', () => {
    const timestamp = '2020-02-02 02:02:02'

    const mqttSouth = new MQTT(mqttConfig, engine)

    mqttSouth.timeStampOrigin = 'payload'
    const mockGenerateDateWithTimezone = jest.spyOn(MQTT, 'generateDateWithTimezone')
    const data = { value: 666.666, quality: true, timestamp }

    mqttSouth.getTimestamp(data)

    expect(mockGenerateDateWithTimezone).toBeCalledWith(data.timestamp, mqttSouth.timezone, mqttSouth.timeStampFormat)
    expect(mqttSouth.logger.error).not.toBeCalled()

    mockGenerateDateWithTimezone.mockRestore()
  })

  it('should properly return timestamp when timeStampOrigin is payload but timezone is not properly set', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)

    mqttSouth.timeStampOrigin = 'payload'
    mqttSouth.timezone = undefined
    const mockGenerateDateWithTimezone = jest.spyOn(MQTT, 'generateDateWithTimezone')
    mqttSouth.getTimestamp({ value: 666.666, quality: true, timestamp: '2020-02-02 02:02:02' })

    expect(mockGenerateDateWithTimezone).not.toBeCalled()
    expect(mqttSouth.logger.error).toBeCalledWith('Invalid timezone specified or the timezone key is missing in the payload')

    mockGenerateDateWithTimezone.mockRestore()
  })

  it('should properly return timestamp when timeStampOrigin is payload but the timestamp field is missing', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)

    mqttSouth.timeStampOrigin = 'payload'
    const mockGenerateDateWithTimezone = jest.spyOn(MQTT, 'generateDateWithTimezone')
    mqttSouth.getTimestamp({ value: 666.666, quality: true, timestampp: '2020-02-02 02:02:02' })

    expect(mockGenerateDateWithTimezone).not.toBeCalled()
    expect(mqttSouth.logger.error).toBeCalledWith('Invalid timezone specified or the timezone key is missing in the payload')

    mockGenerateDateWithTimezone.mockRestore()
  })

  it('should format date properly', () => {
    const actual = MQTT.generateDateWithTimezone(
      '2020-02-22 22:22:22.666',
      'Europe/Paris',
      'YYYY-MM-DD HH:mm:ss.SSS',
    )
    const expected = '2020-02-22T21:22:22.666Z'
    expect(actual).toBe(expected)
  })
})
