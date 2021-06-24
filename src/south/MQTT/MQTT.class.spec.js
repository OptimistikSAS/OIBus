const mqtt = require('mqtt')

const MQTT = require('./MQTT.class')
const config = require('../../config/defaultConfig.json')
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
engine.eventEmitters = {}
engine.engineName = 'Test MQTT'
engine.logger = { error: jest.fn() }

const CertificateService = jest.mock('../../services/CertificateService.class')
CertificateService.init = jest.fn()
CertificateService.logger = engine.logger

// Mock database service
jest.mock('../../services/database.service', () => ({
  createConfigDatabase: jest.fn(() => 'configDatabase'),
  getConfig: jest.fn((_database, _key) => '1587640141001.0'),
  upsertConfig: jest.fn(),
}))

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
let mqttSouth = null

beforeEach(async () => {
  jest.resetAllMocks()
  jest.clearAllMocks()
  mqttSouth = new MQTT(mqttConfig, engine)
  await mqttSouth.init()
})

describe('MQTT south', () => {
  it('should be properly initialized with correct timezone', () => {
    expect(mqttSouth.url)
      .toEqual(mqttConfig.MQTT.url)
    expect(mqttSouth.qos)
      .toEqual(mqttConfig.MQTT.qos)
    expect(mqttSouth.persistent)
      .toEqual(mqttConfig.MQTT.persistent)
    expect(mqttSouth.clientId)
      .toEqual(engine.engineName)
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
    const mqttInvalidSouth = new MQTT(testMqttConfig, engine)

    expect(mqttInvalidSouth.url)
      .toEqual(testMqttConfig.MQTT.url)
    expect(mqttInvalidSouth.qos)
      .toEqual(testMqttConfig.MQTT.qos)
    expect(mqttInvalidSouth.persistent)
      .toEqual(mqttConfig.MQTT.persistent)
    expect(mqttInvalidSouth.clientId)
      .toEqual(engine.engineName)
    expect(mqttInvalidSouth.username)
      .toEqual(testMqttConfig.MQTT.username)
    expect(mqttInvalidSouth.password)
      .toEqual(Buffer.from(testMqttConfig.MQTT.password))
    expect(mqttInvalidSouth.timestampOrigin)
      .toEqual(testMqttConfig.MQTT.timestampOrigin)
    expect(mqttInvalidSouth.timestampPath)
      .toEqual(testMqttConfig.MQTT.timestampPath)
    expect(mqttInvalidSouth.timestampFormat)
      .toEqual(testMqttConfig.MQTT.timestampFormat)
    expect(mqttInvalidSouth.timezone)
      .toBeUndefined()
    expect(mqttInvalidSouth.logger.error)
      .toBeCalledWith(`Invalid timezone supplied: ${testMqttConfig.MQTT.timestampTimezone}`)
    expect(mqttInvalidSouth.client)
      .toBeUndefined()
  })

  it('should properly connect', async () => {
    mqtt.connect.mockReturnValue({ on: jest.fn() })
    await mqttSouth.connect()
    const expectedOptions = {
      clean: !mqttConfig.MQTT.persistent,
      clientId: engine.engineName,
      username: mqttConfig.MQTT.username,
      password: Buffer.from(mqttConfig.MQTT.password),
      rejectUnauthorized: false,
      connectTimeout: 1000,
      keepalive: true,
      reconnectPeriod: 1000,
      ca: null,
      cert: null,
      key: null,
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

  it('should properly connect with cert files', async () => {
    CertificateService.privateKey = 'fileContent'
    CertificateService.cert = 'fileContent'
    CertificateService.ca = 'fileContent'

    mqtt.connect.mockReturnValue({ on: jest.fn() })
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

    const mqttSouthWithFiles = new MQTT(testMqttConfigWithFiles, engine)
    await mqttSouthWithFiles.init()
    mqttSouthWithFiles.certificate = CertificateService
    await mqttSouthWithFiles.connect()

    const expectedOptionsWithFiles = {
      clean: !mqttConfig.MQTT.persistent,
      clientId: engine.engineName,
      username: mqttConfig.MQTT.username,
      password: Buffer.from(mqttConfig.MQTT.password),
      key: 'fileContent',
      cert: 'fileContent',
      ca: 'fileContent',
      rejectUnauthorized: true,
      connectTimeout: 1000,
      keepalive: true,
      reconnectPeriod: 1000,
    }
    expect(mqtt.connect)
      .toBeCalledWith(testMqttConfigWithFiles.MQTT.url, expectedOptionsWithFiles)
  })

  it('should properly handle the connect error event', async () => {
    const error = new Error('test')
    mqtt.connect.mockReturnValue({ on: jest.fn() })

    mqttSouth.handleConnectError(error)

    expect(mqttSouth.logger.error)
      .toBeCalledWith(error)
  })

  it('should properly handle the connect success event', () => {
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
    mqttSouth.subscribeCallback(null)
    expect(mqttSouth.logger.error)
      .not
      .toBeCalled()
  })

  it('should properly log error in subscribe callback', () => {
    const error = new Error('test')
    mqttSouth.subscribeCallback({ pointId: 'point Id' }, error)

    expect(mqttSouth.logger.error)
      .toHaveBeenCalledTimes(2)
  })

  it('should properly handle message and call addValues if point ID was found', () => {
    const pointId = 'pointId'
    const timestamp = 'timestamp'

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
    mqttSouth.dataArrayPath = 'metrics'
    mqttSouth.pointIdPath = 'customName'
    mqttSouth.timestampOrigin = 'payload'
    mqttSouth.timestampPath = 'customTimestamp'
    mqttSouth.timestampFormat = 'yyyy-MM-dd HH:mm:ss'
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

  it('should properly handle error when data array is not found', () => {
    mqttSouth.dataArrayPath = 'badArray'
    mqttSouth.pointIdPath = 'customName'
    mqttSouth.timestampOrigin = 'payload'
    mqttSouth.timestampPath = 'customTimestamp'
    mqttSouth.timestampFormat = 'yyyy-MM-dd HH:mm:ss'
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

    expect(mqttSouth.addValues).not.toBeCalled()
    expect(mqttSouth.logger.error).toHaveBeenCalledWith(`Could not find the dataArrayPath "badArray" in message ${JSON.stringify(data)}`)
  })

  it('should properly handle error when pointIdPath is not found', () => {
    mqttSouth.pointIdPath = 'badPointId'
    mqttSouth.timestampOrigin = 'payload'
    mqttSouth.timestampPath = 'customTimestamp'
    mqttSouth.timestampFormat = 'yyyy-MM-dd HH:mm:ss'
    mqttSouth.valuePath = 'customValue'
    mqttSouth.qualityPath = 'customQuality'

    const data = {
      customName: 'point1',
      customValue: 666.666,
      customTimestamp: '2020-02-02 02:02:02',
      customQuality: true,
    }

    const pointId = mqttSouth.getPointId('t1/t2/t3', data)
    expect(pointId).toBeNull()
    expect(mqttSouth.logger.error)
      .toBeCalledWith(`Could node find pointId in path badPointId for data: ${JSON.stringify(data)}`)

    const formattedValue = mqttSouth.formatValue(data, 't1/t2/t3')
    expect(formattedValue)
      .toBeNull()
    expect(mqttSouth.logger.error)
      .toBeCalledWith(`PointId cant be determined. The following value ${JSON.stringify(data)} is not saved. Configuration needs to be changed`)
  })
  it('should properly handle message parsing error', () => {
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
    mqttSouth.client = { end: jest.fn() }

    mqttSouth.disconnect()

    expect(mqttSouth.client.end)
      .toBeCalledWith(true)
  })

  it('should properly get pointId without wildcards', () => {
    mqttSouth.pointIdPath = null
    mqttSouth.dataSource.points = [{
      topic: 't1/t2/t3',
      pointId: 'p1/p2/p3',
    }]

    const pointId = mqttSouth.getPointId('t1/t2/t3')

    expect(pointId)
      .toBe('p1/p2/p3')
  })

  it('should properly get pointId with +', () => {
    mqttSouth.pointIdPath = null
    mqttSouth.dataSource.points = [{
      topic: 't1/+/t3',
      pointId: 'p1/+/p3',
    }]

    const pointId = mqttSouth.getPointId('t1/t2/t3')

    expect(pointId)
      .toBe('p1/t2/p3')
  })

  it('should properly get pointId with #', () => {
    mqttSouth.pointIdPath = null
    mqttSouth.dataSource.points = [{
      topic: 't1/#',
      pointId: 'p1/#',
    }]

    const pointId = mqttSouth.getPointId('t1/t2/t3')

    expect(pointId)
      .toBe('p1/t2/t3')
  })

  it('should properly get pointId with + and #', () => {
    mqttSouth.pointIdPath = null
    mqttSouth.dataSource.points = [{
      topic: 't1/+/#',
      pointId: 'p1/+/#',
    }]

    const pointId = mqttSouth.getPointId('t1/t2/t3/t4')
    expect(pointId)
      .toBe('p1/t2/t3/t4')
  })

  it('should properly get null as pointId without wildcards', () => {
    mqttSouth.pointIdPath = null
    mqttSouth.dataSource.points = [{
      topic: 't1/t2/t3',
      pointId: 'p1/p2/p3',
    }]

    const pointId = mqttSouth.getPointId('t1/t2/t3/')

    expect(pointId)
      .toBeNull()
  })

  it('should properly get null as pointId with +', () => {
    mqttSouth.pointIdPath = null
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
    mqttSouth.pointIdPath = null
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
    mqttSouth.pointIdPath = null
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
    mqttSouth.pointIdPath = null
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
    mqttSouth.pointIdPath = null
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
    mqttSouth.pointIdPath = null
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
    mqttSouth.pointIdPath = null
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
})
