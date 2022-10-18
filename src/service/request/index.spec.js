const { createRequestService } = require('./index')
const AxiosRequest = require('./axios-request')
const FetchRequest = require('./fetch-request')

const config = require('../../config/default-config.json')

// Mock engine
const engine = jest.mock('../../engine/oibus-engine')

beforeEach(() => {
  jest.resetAllMocks()
})

describe('RequestFactory', () => {
  it('should initialize AxiosRequest when stack is axios', () => {
    config.engine.httpRequest.stack = 'axios'
    engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }

    const request = createRequestService(engine)

    expect(request).toBeInstanceOf(AxiosRequest)
  })

  it('should initialize FetchRequest when stack is fetch', () => {
    config.engine.httpRequest.stack = 'fetch'
    engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }

    const request = createRequestService(engine)

    expect(request).toBeInstanceOf(FetchRequest)
  })
})
