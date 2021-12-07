const mqtt = require('mqtt')
const WATSYConnect = require('./WATSYConnect.class')
const config = require('../../../tests/testConfig').default
const Logger = require('../../engine/Logger.class')
const EncryptionService = require('../../services/EncryptionService.class')

// Mock logger
jest.mock('../../engine/Logger.class')
Logger.getDefaultLogger = () => new Logger()

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock engine
const engine = jest.mock('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.decryptPassword = (password) => password
engine.eventEmitters = {}

let WATSYNorth = null
const WATSYConfig = config.north.applications[5]
// Data for tests
const values = [
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
]

const allWATSYMessages = [
  {
    timestamp: 900277200000000000,
    tags: {},
    fields: {
      'atipik-solutions/WATSY/device_id': 'demo-capteur',
      'atipik-solutions/WATSY/device_model': 'oibusWATSYConnect',
      'atipik-solutions/WATSY/protocol': 'web',
    },
    host: WATSYConfig.WATSYConnect.applicativeHostUrl,
    token: WATSYConfig.WATSYConnect.secretKey,
  },
  {
    timestamp: 900287100000000000,
    tags: {},
    fields: {
      'atipik-solutions/WATSY/device_id': 'demo-capteur',
      'atipik-solutions/WATSY/device_model': 'oibusWATSYConnect',
      'atipik-solutions/WATSY/protocol': 'web',
    },
    host: WATSYConfig.WATSYConnect.applicativeHostUrl,
    token: WATSYConfig.WATSYConnect.secretKey,
  },
  {
    timestamp: 1531684800000000000,
    tags: {},
    fields: { 'atipik-solutions/WATSY/device_id': 'demo-capteur' },
    host: WATSYConfig.WATSYConnect.applicativeHostUrl,
    token: WATSYConfig.WATSYConnect.secretKey,
  },
]

beforeEach(async () => {
  jest.resetAllMocks()
  jest.clearAllMocks()
  WATSYNorth = new WATSYConnect(WATSYConfig, engine)
  await WATSYNorth.init()
})

describe('WATSY Connect', () => {
  // Begin of test functions
  it('Should properly connect', () => {
    jest.spyOn(mqtt, 'connect').mockImplementation(() => ({ on: jest.fn() }))

    WATSYNorth.connect()

    const expectedOptions = { username: WATSYConfig.WATSYConnect.username, password: Buffer.from(WATSYConfig.WATSYConnect.password) }
    expect(mqtt.connect).toBeCalledWith(WATSYNorth.url, expectedOptions)
    expect(WATSYNorth.client.on).toHaveBeenCalledTimes(2)
    expect(WATSYNorth.client.on).toHaveBeenCalledWith('error', expect.any(Function))
    expect(WATSYNorth.client.on).toHaveBeenCalledWith('connect', expect.any(Function))
  })

  it('Should properly handle values and publish them', async () => {
    WATSYNorth.client = { publish: jest.fn() }

    let expectedResult = null
    let expectedError = null
    try {
      expectedResult = await WATSYNorth.handleValues(values)
    } catch (error) {
      expectedError = error
    }

    expect(WATSYNorth.client.publish).toBeCalledWith(
      WATSYNorth.mqttTopic,
      JSON.stringify(allWATSYMessages[0]),
      { qos: WATSYNorth.qos },
      expect.any(Function),
    )
    expect(expectedResult).toEqual(values.length)
    expect(expectedError).toBeNull()
  })

  it('Should properly not handle unexpected values ', async () => {
    WATSYNorth.client = { publish: jest.fn().mockImplementation((callback) => callback()) }

    let expectedResult = null
    let expectedError = null
    try {
      expectedResult = await WATSYNorth.handleValues(values.data)
    } catch (error) {
      expectedError = error
    }

    expect(expectedResult).toBeNull()
    expect(expectedError).not.toBeNull()
  })

  it('Should properly split message in  WATSY messages', () => {
    let expectedResult = null
    let expectedError = null

    try {
      expectedResult = WATSYNorth.splitMessages(values)
    } catch (error) {
      expectedError = error
    }

    expect(expectedResult).toEqual(allWATSYMessages)
    expect(expectedError).toBeNull()
  })

  it('Send an empty array an received an empty array ', () => {
    let expectedResult = null
    let expectedError = null

    try {
      expectedResult = WATSYNorth.splitMessages([])
    } catch (error) {
      expectedError = error
    }

    expect(expectedResult.length).toEqual(0) // No message receive
    expect(expectedError).toBeNull()
  })

  it('Send only message in the same sendInterval ', () => {
    let expectedResult = null
    let expectedError = null

    try {
      expectedResult = WATSYNorth.splitMessages(values.slice(0, 3))
    } catch (error) {
      expectedError = error
    }

    expect(expectedResult.length).toEqual(1) // Only one message receive
    expect(expectedError).toBeNull()
  })

  it('Should properly disconnect', () => {
    WATSYNorth.client = { end: jest.fn() }

    WATSYNorth.disconnect()

    expect(WATSYNorth.client.end).toBeCalledWith(true)
  })
})
