import { jest } from '@jest/globals'

import fs from 'node:fs/promises'

import OIConnect from './OIConnect.class.js'
import { defaultConfig } from '../../../tests/testConfig.js'

// Mock logger
jest.mock('../../engine/logger/Logger.class')

// Mock engine
const engine = jest.mock('../../engine/OIBusEngine.class')
engine.configService = { getConfig: () => ({ engineConfig: defaultConfig.engine }) }
engine.requestService = { httpSend: jest.fn() }
engine.eventEmitters = {}

let oiConnect = null
const oiConnectConfig = {
  id: 'north-oiconnect',
  name: 'monoiconnect',
  api: 'OIConnect',
  enabled: false,
  OIConnect: {
    authentication: { password: '', type: 'Basic', username: '' },
    timeout: 180000,
    host: 'http://hostname:2223',
    valuesEndpoint: '/addValues',
    fileEndpoint: '/addFile',
    proxy: '',
    stack: 'fetch',
  },
  caching: { sendInterval: 10000, retryInterval: 5000, groupCount: 1000, maxSendCount: 10000 },
  subscribedTo: [],
}
const timestamp = new Date().toISOString()

beforeEach(async () => {
  jest.resetAllMocks()
  jest.clearAllMocks()
  oiConnect = new OIConnect(oiConnectConfig, engine)
  await oiConnect.init()
})

describe('OIConnect', () => {
  it('should be properly initialized', () => {
    expect(oiConnect.canHandleFiles).toBeTruthy()
    expect(oiConnect.canHandleFiles).toBeTruthy()
  })

  it('should properly handle values in non verbose mode', async () => {
    const values = [
      {
        pointId: 'pointId',
        timestamp,
        data: { value: 666, quality: 'good' },
      },
    ]
    await oiConnect.handleValues(values)

    const expectedUrl = 'http://hostname:2223/addValues?name=OIBus:monoiconnect'
    const expectedAuthentication = oiConnectConfig.OIConnect.authentication
    const expectedBody = JSON.stringify(values)
    const expectedHeaders = { 'Content-Type': 'application/json' }

    expect(engine.requestService.httpSend).toHaveBeenCalledWith(expectedUrl, 'POST', expectedAuthentication, null, expectedBody, expectedHeaders)
  })

  it('should properly handle file', async () => {
    const filePath = '/path/to/file/example.file'
    jest.spyOn(fs, 'stat').mockImplementation(() => ({ size: 666 }))

    await oiConnect.handleFile(filePath)

    const expectedUrl = 'http://hostname:2223/addFile?name=OIBus:monoiconnect'
    const expectedAuthentication = oiConnectConfig.OIConnect.authentication
    expect(engine.requestService.httpSend).toHaveBeenCalledWith(expectedUrl, 'POST', expectedAuthentication, null, filePath)
  })
})
