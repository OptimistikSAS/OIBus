const mqtt = require('mqtt')

const WATSYConnect = require('./WATSYConnect.class')

const utils = require('./utils')

const { defaultConfig: config } = require('../../../tests/testConfig')

// Mock mqtt
jest.mock('mqtt', () => ({ connect: jest.fn() }))

// Mock utils class
jest.mock('./utils', () => ({
  recursiveSplitMessages: jest.fn(),
  initMQTTTopic: jest.fn(),
}))

// Mock fs
jest.mock('node:fs/promises')

// Mock OIBusEngine
const engine = {
  configService: { getConfig: () => ({ engineConfig: config.engine }) },
  cacheFolder: './cache',
  requestService: { httpSend: jest.fn() },
}

// Mock services
jest.mock('../../services/database.service')
jest.mock('../../engine/logger/Logger.class')
jest.mock('../../services/status.service.class')
jest.mock('../../services/EncryptionService.class', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))
jest.mock('../../engine/cache/ValueCache.class')
jest.mock('../../engine/cache/FileCache.class')

let settings = null
let north = null

describe('North WATSYConnect', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers()

    utils.initMQTTTopic.mockReturnValue('myMqttTopic')

    settings = {
      id: 'northId',
      name: 'watsy',
      api: 'WATSYConnect',
      enabled: false,
      WATSYConnect: {
        MQTTUrl: 'mqtt://hostname',
        port: 1883,
        username: 'anyuser',
        password: 'anypass',
        applicativeHostUrl: 'https://localhost.com', // Random path
        secretKey: 'anytoken',
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
    north = new WATSYConnect(settings, engine)
    await north.init()
  })

  it('should properly connect', async () => {
    jest.spyOn(mqtt, 'connect').mockImplementation(() => ({ on: jest.fn() }))

    await north.connect()

    const expectedOptions = {
      port: north.port,
      username: settings.WATSYConnect.username,
      password: Buffer.from(settings.WATSYConnect.password),
    }
    expect(mqtt.connect).toBeCalledWith(north.url, expectedOptions)
    expect(north.client.on).toHaveBeenCalledTimes(2)
    expect(north.client.on).toHaveBeenCalledWith('error', expect.any(Function))
    expect(north.client.on).toHaveBeenCalledWith('connect', expect.any(Function))
  })

  it('should properly handle values and publish them', async () => {
    mqtt.connect.mockReturnValue({ on: jest.fn(), publish: jest.fn().mockImplementation((topic, data, params, callback) => callback()) })
    const expectedPublishedValues = [{ data: 'myData1' }, { data: 'myData2' }]
    utils.recursiveSplitMessages.mockReturnValue(expectedPublishedValues)

    await north.connect()
    await north.handleValues([
      {
        timestamp: '1998-07-12T21:00:00.000Z',
        pointId: 'atipik-solutions/WATSY/protocol',
        data: { value: 'web' },
      },
      {
        timestamp: '1998-07-12T21:00:00.000Z',
        pointId: 'atipik-solutions/WATSY/device_model',
        data: { value: 'oibusWATSYConnect' },
      },
      {
        timestamp: '1998-07-12T21:00:00.000Z',
        pointId: 'atipik-solutions/WATSY/device_id',
        data: { value: 'demo-capteur' },
      },
      {
        timestamp: '1998-07-12T23:45:00.000Z',
        pointId: 'atipik-solutions/WATSY/protocol',
        data: { value: 'web' },
      },
      {
        timestamp: '1998-07-12T23:45:00.000Z',
        pointId: 'atipik-solutions/WATSY/device_model',
        data: { value: 'oibusWATSYConnect' },
      },
      {
        timestamp: '1998-07-12T23:45:00.000Z',
        pointId: 'atipik-solutions/WATSY/device_id',
        data: { value: 'demo-capteur' },
      },
      {
        timestamp: '2018-07-15T20:00:00.000Z',
        pointId: 'atipik-solutions/WATSY/device_id',
        data: { value: 'demo-capteur' },
      },
    ])

    expect(north.client.publish).toBeCalledWith(
      north.mqttTopic,
      JSON.stringify(expectedPublishedValues[0]),
      { qos: north.qos },
      expect.any(Function),
    )
    expect(north.client.publish).toBeCalledWith(
      north.mqttTopic,
      JSON.stringify(expectedPublishedValues[1]),
      { qos: north.qos },
      expect.any(Function),
    )
  })

  it('should properly disconnect', () => {
    north.client = { end: jest.fn() }

    north.disconnect()

    expect(north.client.end).toBeCalledWith(true)
  })
})
