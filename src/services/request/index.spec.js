import { jest } from '@jest/globals'

import createRequestService from './index.js'
import AxiosRequest from './AxiosRequest.class.js'
import FetchRequest from './FetchRequest.class.js'

import { defaultConfig } from '../../../tests/testConfig.js'

// Mock engine
const engine = jest.mock('../../engine/OIBusEngine.class')

beforeEach(() => {
  jest.resetAllMocks()
})

describe('RequestFactory', () => {
  it('should initialize AxiosRequest when stack is axios', () => {
    defaultConfig.engine.httpRequest.stack = 'axios'
    engine.configService = { getConfig: () => ({ engineConfig: defaultConfig.engine }) }

    const request = createRequestService(engine)

    expect(request).toBeInstanceOf(AxiosRequest)
  })

  it('should initialize FetchRequest when stack is fetch', () => {
    defaultConfig.engine.httpRequest.stack = 'fetch'
    engine.configService = { getConfig: () => ({ engineConfig: defaultConfig.engine }) }

    const request = createRequestService(engine)

    expect(request).toBeInstanceOf(FetchRequest)
  })
})
