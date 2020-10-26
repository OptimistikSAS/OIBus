const mqtt = require('mqtt')
const ApiHandler = require('../ApiHandler.class')
const WATSYConnect = require('./WATSYConnect.class')
const config = require('../../../tests/testConfig').default

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
engine.sendRequest = jest.fn()

beforeEach(() => {
  jest.resetAllMocks(),
  jest.clearAllMocks()
})

describe('WATSY Connect', () => {
  const WATSYConfig = config.north.applications[5]
  const WATSYNorth = new WATSYConnect(WATSYConfig, engine)

  const values = [
    {
      timestamp: '1998-06-12T21:00:00.000Z',
      pointId: 'atipik-solutions/WATSY/protocol',
      data: { value: "web" },
    },
    {
      timestamp: '1998-06-12T21:00:00.000Z',
      pointId: 'atipik-solutions/WATSY/device_model',
      data: { value: "oibusWATSYConnect" },
    },
    {
      timestamp: '1998-06-12T21:00:00.000Z',
      pointId: 'atipik-solutions/WATSY/device_id',
      data: { value: "demo-capteur" },
    },
    {
      timestamp: '1998-06-12T23:45:00.000Z',
      pointId: 'atipik-solutions/WATSY/protocol',
      data: { value: "web" },
    },
    {
      timestamp: '1998-06-12T23:45:00.000Z',
      pointId: 'atipik-solutions/WATSY/device_model',
      data: { value: "oibusWATSYConnect" },
    },
    {
      timestamp: '1998-06-12T23:45:00.000Z',
      pointId: 'atipik-solutions/WATSY/device_id',
      data: { value: "demo-capteur" },
    }
  ]

  it('Should properly connect', () => {
    jest.spyOn(mqtt, 'connect').mockImplementation(() => ({ on: jest.fn() }))

    WATSYNorth.connect()

    const expectedOptions = { username: mqttConfig.WATSYNorth.username, password: Buffer.from(mqttConfig.WATSYNorth.password) }
    expect(mqtt.connect).toBeCalledWith(mqttConfig.WATSYNorth.url, expectedOptions)
    expect(WATSYNorth.client.on).toHaveBeenCalledTimes(2)
    expect(WATSYNorth.client.on).toHaveBeenCalledWith('error', expect.any(Function))
    expect(WATSYNorth.client.on).toHaveBeenCalledWith('connect', expect.any(Function))
  })

  it('Should properly handle values and publish them', async () => {
    WATSYNorth.client = { publish: jest.fn().mockImplementation(( callback ) => callback()) }

    let expectedResult = null
    let expectedError = null
    try {
      expectedResult = await WATSYNorth.handleValues(values)
    } catch (error) {
      expectedError = error
    }

    expect(WATSYNorth.client.publish).toBeCalledWith(WATSYNorth.mqttTopic, JSON.stringify(values[0].data), { qos: WATSYNorth.qos }, expect.any(Function))
    expect(expectedResult).toEqual(2)
    expect(expectedError).toBeNull()
  })

  it('Should properly handle values with publish error', async () => {
    WATSYNorth.client = { publish: jest.fn().mockImplementation(( callback ) => callback(true)) }

    let expectedResult = null
    let expectedError = null
    try {
      expectedResult = await WATSYNorth.handleValues(values)
    } catch (error) {
      expectedError = error
    }

    expect(WATSYNorth.client.publish).toBeCalledWith(WATSYConnect.mqttTopic, JSON.stringify(values[0].data), { qos: WATSYNorth.qos }, expect.any(Function))
    expect(expectedResult).toBeNull()
    expect(expectedError).toEqual(ApiHandler.STATUS.COMMUNICATION_ERROR)
  })

  it('Should properly disconnect', () => {
    WATSYNorth.client = { end: jest.fn() }

    WATSYNorth.disconnect()

    expect(WATSYNorth.client.end).toBeCalledWith(true)
  })

})