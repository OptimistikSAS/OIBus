const mqtt = require('mqtt')

const MQTT = require('./MQTT.class')
const config = require('../../config/defaultConfig.json')
const EncryptionService = require('../../services/EncryptionService.class')

// Mock mqtt
jest.mock('mqtt', () => ({ connect: jest.fn() }))

// Mock logger
jest.mock('../../engine/Logger.class')

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock engine
const engine = jest.createMockFromModule('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }

// Mock database service
jest.mock('../../services/database.service', () => ({
  createConfigDatabase: jest.fn(() => 'configDatabase'),
  getConfig: jest.fn((_database, _key) => '1587640141001.0'),
  upsertConfig: jest.fn(),
}))

beforeEach(() => {
  jest.resetAllMocks()
  jest.clearAllMocks()
})

describe('MQTT south', () => {
  const mqttConfig = {
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
      nodeIdPath: 'name',
      qualityPath: 'quality',
      valuePath: 'value',
      timestampOrigin: 'oibus',
      timestampPath: 'timestamp',
      timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
      timestampTimezone: 'Europe/Paris',
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

    expect(mqttSouth.url)
      .toEqual(mqttConfig.MQTT.url)
    expect(mqttSouth.qos)
      .toEqual(mqttConfig.MQTT.qos)
    expect(mqttSouth.persistent)
      .toEqual(mqttConfig.MQTT.persistent)
    expect(mqttSouth.clientId)
      .toEqual(mqttConfig.MQTT.clientId)
    expect(mqttSouth.username)
      .toEqual(mqttConfig.MQTT.username)
    expect(mqttSouth.password)
      .toEqual(Buffer.from(mqttConfig.MQTT.password))
    expect(mqttSouth.timestampOrigin)
      .toEqual(mqttConfig.MQTT.timestampOrigin)
    expect(mqttSouth.timestampPath)
      .toEqual(mqttConfig.MQTT.timestampPath)
    expect(mqttSouth.timestampFormat)
      .toEqual(mqttConfig.MQTT.timestampFormat)
    expect(mqttSouth.timezone)
      .toEqual(mqttConfig.MQTT.timestampTimezone)
    expect(mqttSouth.client)
      .toBeUndefined()
  })

  it('should be properly initialized with invalid timezone', () => {
    const testMqttConfig = {
      ...mqttConfig,
      MQTT: {
        ...mqttConfig.MQTT,
        timestampTimezone: 'invalid',
      },
    }
    const mqttSouth = new MQTT(testMqttConfig, engine)

    expect(mqttSouth.url)
      .toEqual(testMqttConfig.MQTT.url)
    expect(mqttSouth.qos)
      .toEqual(testMqttConfig.MQTT.qos)
    expect(mqttSouth.persistent)
      .toEqual(mqttConfig.MQTT.persistent)
    expect(mqttSouth.clientId)
      .toEqual(mqttConfig.MQTT.clientId)
    expect(mqttSouth.username)
      .toEqual(testMqttConfig.MQTT.username)
    expect(mqttSouth.password)
      .toEqual(Buffer.from(testMqttConfig.MQTT.password))
    expect(mqttSouth.timestampOrigin)
      .toEqual(testMqttConfig.MQTT.timestampOrigin)
    expect(mqttSouth.timestampPath)
      .toEqual(testMqttConfig.MQTT.timestampPath)
    expect(mqttSouth.timestampFormat)
      .toEqual(testMqttConfig.MQTT.timestampFormat)
    expect(mqttSouth.timezone)
      .toBeUndefined()
    expect(mqttSouth.logger.error)
      .toBeCalledWith(`Invalid timezone supplied: ${testMqttConfig.MQTT.timestampTimezone}`)
    expect(mqttSouth.client)
      .toBeUndefined()
  })

  it('should properly connect', async () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    mqtt.connect.mockReturnValue({ on: jest.fn() })

    await mqttSouth.connect()

    const expectedOptions = {
      clean: !mqttConfig.MQTT.persistent,
      clientId: mqttConfig.MQTT.clientId,
      username: mqttConfig.MQTT.username,
      password: Buffer.from(mqttConfig.MQTT.password),
    }
    expect(mqtt.connect)
      .toBeCalledWith(mqttConfig.MQTT.url, expectedOptions)
    expect(mqttSouth.client.on)
      .toHaveBeenCalledTimes(2)
    expect(mqttSouth.client.on)
      .toHaveBeenCalledWith('error', expect.any(Function))
    expect(mqttSouth.client.on)
      .toHaveBeenCalledWith('connect', expect.any(Function))
  })

  it('should properly handle the connect error event', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    const error = new Error('test')

    mqttSouth.handleConnectError(error)

    expect(mqttSouth.logger.error)
      .toBeCalledWith(error)
  })

  it('should properly handle the connect success event', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    mqttSouth.client = {
      on: jest.fn(),
      subscribe: jest.fn(),
    }

    mqttSouth.handleConnectEvent()

    expect(mqttSouth.logger.info)
      .toBeCalledWith(`Connected to ${mqttConfig.MQTT.url}`)
    expect(mqttSouth.client.subscribe)
      .toHaveBeenCalledTimes(2)
    expect(mqttSouth.client.subscribe)
      .toHaveBeenCalledWith(mqttConfig.points[0].topic, { qos: mqttConfig.MQTT.qos }, expect.any(Function))
    expect(mqttSouth.client.subscribe)
      .toHaveBeenCalledWith(mqttConfig.points[1].topic, { qos: mqttConfig.MQTT.qos }, expect.any(Function))
    expect(mqttSouth.client.on)
      .toHaveBeenCalledTimes(1)
    expect(mqttSouth.client.on)
      .toHaveBeenCalledWith('message', expect.any(Function))
  })

  it('should not log error in subscribe callback when successfully subscribed', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)

    mqttSouth.subscribeCallback(null)

    expect(mqttSouth.logger.error)
      .not
      .toBeCalled()
  })

  it('should properly log error in subscribe callback', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    const error = new Error('test')

    mqttSouth.subscribeCallback({ pointId: 'point Id' }, error)

    expect(mqttSouth.logger.error)
      .toHaveBeenCalledTimes(2)
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
    const data = {
      value: 666.666,
      quality: true,
    }
    const packet = { dup: 0 }

    mqttSouth.handleMessageEvent(topic, Buffer.from(JSON.stringify(data)), packet)

    expect(mqttSouth.addValues)
      .toBeCalledWith([{
        pointId,
        timestamp,
        data,
      }])
  })

  it('should properly handle message and call addValues for several values', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    mqttSouth.dataArrayPath = 'metrics'
    mqttSouth.nodeIdPath = 'customName'
    mqttSouth.timeStampOrigin = 'payload'
    mqttSouth.timeStampPath = 'customTimestamp'
    mqttSouth.timeStampFormat = 'YYYY-MM-DD HH:mm:ss'
    mqttSouth.valuePath = 'customValue'
    mqttSouth.qualityPath = 'customQuality'

    mqttSouth.addValues = jest.fn()

    const topic = 'topic'
    const data = {
      metrics: [
        {
          customName: 'point1',
          customValue: 666.666,
          customTimestamp: '2020-02-02 02:02:02',
          customQuality: true,
        },
        {
          customName: 'point2',
          customValue: 777.777,
          customTimestamp: '2020-03-03 02:02:02',
          customQuality: true,
        },
      ],
    }
    const packet = { dup: 0 }

    mqttSouth.handleMessageEvent(topic, Buffer.from(JSON.stringify(data)), packet)

    expect(mqttSouth.addValues)
      .toBeCalledWith([
        {
          timestamp: '2020-02-02T01:02:02.000Z',
          pointId: 'point1',
          data: {
            value: 666.666,
            quality: true,
          },
        },
        {
          timestamp: '2020-03-03T01:02:02.000Z',
          pointId: 'point2',
          data: {
            value: 777.777,
            quality: true,
          },
        },
      ])
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

    expect(mqttSouth.logger.silly)
      .toBeCalled()
    expect(mqttSouth.getTimestamp)
      .not
      .toBeCalled()
    expect(mqttSouth.getPointId)
      .not
      .toBeCalled()
    expect(mqttSouth.addValues)
      .not
      .toBeCalled()
    expect(mqttSouth.logger.error)
      .toBeCalled()
  })

  it('should properly disconnect', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    mqttSouth.client = { end: jest.fn() }

    mqttSouth.disconnect()

    expect(mqttSouth.client.end)
      .toBeCalledWith(true)
  })

  it('should properly return timestamp when timeStampOrigin is oibus', () => {
    const nowDateString = '2020-02-02T02:02:02.222Z'
    const RealDate = Date
    global.Date = jest.fn(() => new RealDate(nowDateString))

    const mqttSouth = new MQTT(mqttConfig, engine)

    mqttSouth.timeStampOrigin = 'oibus'
    const mockGenerateDateWithTimezone = jest.spyOn(MQTT, 'generateDateWithTimezone')

    const timestamp = mqttSouth.getTimestamp({
      value: 666.666,
      quality: true,
      timestamp: '2020-02-02 02:02:02',
    })

    expect(mockGenerateDateWithTimezone)
      .not
      .toBeCalled()
    expect(mqttSouth.logger.error)
      .not
      .toBeCalled()
    expect(timestamp)
      .toEqual(nowDateString)

    mockGenerateDateWithTimezone.mockRestore()
    global.Date = RealDate
  })

  it('should properly return timestamp when timeStampOrigin is payload and timestamp field is present', () => {
    const timestamp = '2020-02-02 02:02:02'

    const mqttSouth = new MQTT(mqttConfig, engine)

    mqttSouth.timeStampOrigin = 'payload'
    const mockGenerateDateWithTimezone = jest.spyOn(MQTT, 'generateDateWithTimezone')
    const data = {
      value: 666.666,
      quality: true,
      timestamp,
    }

    mqttSouth.getTimestamp(timestamp)

    expect(mockGenerateDateWithTimezone)
      .toBeCalledWith(data.timestamp, mqttSouth.timezone, mqttSouth.timeStampFormat)
    expect(mqttSouth.logger.error)
      .not
      .toBeCalled()

    mockGenerateDateWithTimezone.mockRestore()
  })

  it('should properly return timestamp when timeStampOrigin is payload but timezone is not properly set', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)

    mqttSouth.timeStampOrigin = 'payload'
    mqttSouth.timezone = undefined
    const mockGenerateDateWithTimezone = jest.spyOn(MQTT, 'generateDateWithTimezone')
    mqttSouth.getTimestamp('2020-02-02 02:02:02')

    expect(mockGenerateDateWithTimezone)
      .not
      .toBeCalled()
    expect(mqttSouth.logger.error)
      .toBeCalledWith('Invalid timezone specified or the timestamp key is missing in the payload')

    mockGenerateDateWithTimezone.mockRestore()
  })

  it('should properly return timestamp when timeStampOrigin is payload but the timestamp field is missing', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)

    mqttSouth.timeStampOrigin = 'payload'
    const mockGenerateDateWithTimezone = jest.spyOn(MQTT, 'generateDateWithTimezone')
    mqttSouth.getTimestamp(null)

    expect(mockGenerateDateWithTimezone)
      .not
      .toBeCalled()
    expect(mqttSouth.logger.error)
      .toBeCalledWith('Invalid timezone specified or the timestamp key is missing in the payload')

    mockGenerateDateWithTimezone.mockRestore()
  })

  it('should properly get pointId without wildcards', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    mqttSouth.nodeIdPath = null
    mqttSouth.dataSource.points = [{
      topic: 't1/t2/t3',
      pointId: 'p1/p2/p3',
    }]

    const pointId = mqttSouth.getPointId('t1/t2/t3')

    expect(pointId)
      .toBe('p1/p2/p3')
  })

  it('should properly get pointId with +', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    mqttSouth.nodeIdPath = null
    mqttSouth.dataSource.points = [{
      topic: 't1/+/t3',
      pointId: 'p1/+/p3',
    }]

    const pointId = mqttSouth.getPointId('t1/t2/t3')

    expect(pointId)
      .toBe('p1/t2/p3')
  })

  it('should properly get pointId with #', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    mqttSouth.nodeIdPath = null
    mqttSouth.dataSource.points = [{
      topic: 't1/#',
      pointId: 'p1/#',
    }]

    const pointId = mqttSouth.getPointId('t1/t2/t3')

    expect(pointId)
      .toBe('p1/t2/t3')
  })

  it('should properly get pointId with + and #', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    mqttSouth.nodeIdPath = null
    mqttSouth.dataSource.points = [{
      topic: 't1/+/#',
      pointId: 'p1/+/#',
    }]

    const pointId = mqttSouth.getPointId('t1/t2/t3/t4')
    expect(pointId)
      .toBe('p1/t2/t3/t4')
  })

  it('should properly get null as pointId without wildcards', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    mqttSouth.nodeIdPath = null
    mqttSouth.dataSource.points = [{
      topic: 't1/t2/t3',
      pointId: 'p1/p2/p3',
    }]

    const pointId = mqttSouth.getPointId('t1/t2/t3/')

    expect(pointId)
      .toBeNull()
  })

  it('should properly get null as pointId with +', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    mqttSouth.nodeIdPath = null
    mqttSouth.dataSource.points = [{
      topic: 't1/t2/t3',
      pointId: 'p1/+/p3',
    }]

    const pointId = mqttSouth.getPointId('t1/t2/t3')

    expect(pointId)
      .toBeNull()
    expect(mqttSouth.logger.error)
      .toBeCalledWith(`Invalid point configuration: ${JSON.stringify(mqttSouth.dataSource.points[0])}`)
  })

  it('should properly get null as pointId with +', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    mqttSouth.nodeIdPath = null
    mqttSouth.dataSource.points = [{
      topic: 't1/+/t3',
      pointId: 'p1/p2/p3',
    }]

    const pointId = mqttSouth.getPointId('t1/t2/t3')

    expect(pointId)
      .toBeNull()
    expect(mqttSouth.logger.error)
      .toBeCalledWith(`Invalid point configuration: ${JSON.stringify(mqttSouth.dataSource.points[0])}`)
  })

  it('should properly get null as pointId with #', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    mqttSouth.nodeIdPath = null
    mqttSouth.dataSource.points = [{
      topic: 't1/#',
      pointId: 'p1/p2/p3',
    }]

    const pointId = mqttSouth.getPointId('t1/t2/t3')

    expect(pointId)
      .toBeNull()
    expect(mqttSouth.logger.error)
      .toBeCalledWith(`Invalid point configuration: ${JSON.stringify(mqttSouth.dataSource.points[0])}`)
  })

  it('should properly get null as pointId with #', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    mqttSouth.nodeIdPath = null
    mqttSouth.dataSource.points = [{
      topic: 't1/t2/t3',
      pointId: 'p1/#',
    }]

    const pointId = mqttSouth.getPointId('t1/t2/t3')

    expect(pointId)
      .toBeNull()
    expect(mqttSouth.logger.error)
      .toBeCalledWith(`Invalid point configuration: ${JSON.stringify(mqttSouth.dataSource.points[0])}`)
  })

  it('should properly get null as pointId with + and #', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    mqttSouth.nodeIdPath = null
    mqttSouth.dataSource.points = [{
      topic: 't1/+/+/#',
      pointId: 'p1/+/#',
    }]

    const pointId = mqttSouth.getPointId('t1/t2/t3/t4')

    expect(pointId)
      .toBeNull()
    expect(mqttSouth.logger.error)
      .toBeCalledWith(`Invalid point configuration: ${JSON.stringify(mqttSouth.dataSource.points[0])}`)
  })

  it('should properly get null as pointId with + and #', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    mqttSouth.nodeIdPath = null
    mqttSouth.dataSource.points = [{
      topic: 't1/+/#',
      pointId: 'p1/+/+/#',
    }]

    const pointId = mqttSouth.getPointId('t1/t2/t3/t4')

    expect(pointId)
      .toBeNull()
    expect(mqttSouth.logger.error)
      .toBeCalledWith(`Invalid point configuration: ${JSON.stringify(mqttSouth.dataSource.points[0])}`)
  })

  it('should properly get null as pointId and detect duplicate point matching', () => {
    const mqttSouth = new MQTT(mqttConfig, engine)
    mqttSouth.nodeIdPath = null
    mqttSouth.dataSource.points = [
      {
        topic: 't1/+/t3',
        pointId: 'p1/+/p3',
      },
      {
        topic: 't1/#',
        pointId: 'p1/#',
      },
    ]

    const pointId = mqttSouth.getPointId('t1/t2/t3')

    expect(pointId)
      .toBeNull()
    expect(mqttSouth.logger.error)
      .toBeCalledWith(
        `t1/t2/t3 should be subscribed only once but it has the following subscriptions: ${JSON.stringify(mqttSouth.dataSource.points)}`,
      )
  })

  it('should format date properly', () => {
    const actual = MQTT.generateDateWithTimezone(
      '2020-02-22 22:22:22.666',
      'Europe/Paris',
      'YYYY-MM-DD HH:mm:ss.SSS',
    )
    const expected = '2020-02-22T21:22:22.666Z'
    expect(actual)
      .toBe(expected)
  })
})
