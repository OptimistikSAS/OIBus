import { jest } from '@jest/globals'

import mqtt from 'mqtt'
import WATSYConnect from './WATSYConnect.class.js'
import { defaultConfig } from '../../../tests/testConfig.js'
import EncryptionService from '../../services/EncryptionService.class.js'

// Mock logger
jest.mock('../../engine/logger/Logger.class')

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock engine
const engine = jest.mock('../../engine/OIBusEngine.class')
engine.configService = { getConfig: () => ({ engineConfig: defaultConfig.engine }) }
engine.decryptPassword = (password) => password
engine.eventEmitters = {}

let WATSYNorth = null
const WATSYConfig = {
  id: 'north-watsy',
  name: 'WATSYConnect',
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
  },
  subscribedTo: [],
}
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

describe('WATSYConnect', () => {
  // Begin of test functions
  it('should properly connect', () => {
    jest.spyOn(mqtt, 'connect').mockImplementation(() => ({ on: jest.fn() }))

    WATSYNorth.connect()

    const expectedOptions = {
      port: WATSYNorth.port,
      username: WATSYConfig.WATSYConnect.username,
      password: WATSYConfig.WATSYConnect.password,
    }
    expect(mqtt.connect).toBeCalledWith(WATSYNorth.url, expectedOptions)
    expect(WATSYNorth.client.on).toHaveBeenCalledTimes(2)
    expect(WATSYNorth.client.on).toHaveBeenCalledWith('error', expect.any(Function))
    expect(WATSYNorth.client.on).toHaveBeenCalledWith('connect', expect.any(Function))
  })

  it('should properly handle values and publish them', async () => {
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

  it('should properly not handle unexpected values ', async () => {
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

  it('should properly split message in  WATSY messages', () => {
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

  it('should send an empty array an received an empty array ', () => {
    let expectedResult = null
    let expectedError = null

    try {
      expectedResult = WATSYNorth.splitMessages([])
    } catch (error) {
      expectedError = error
    }

    expect(expectedResult?.length).toEqual(0) // No message receive
    expect(expectedError).toBeNull()
  })

  it('should send only message in the same sendInterval ', () => {
    let expectedResult = null
    let expectedError = null

    try {
      expectedResult = WATSYNorth.splitMessages(values.slice(0, 3))
    } catch (error) {
      expectedError = error
    }

    expect(expectedResult?.length).toEqual(1) // Only one message receive
    expect(expectedError).toBeNull()
  })

  it('should properly disconnect', () => {
    WATSYNorth.client = { end: jest.fn() }

    WATSYNorth.disconnect()

    expect(WATSYNorth.client.end).toBeCalledWith(true)
  })
})
