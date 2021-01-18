const RequestFactory = require('./RequestFactory.class')
const AxiosRequest = require('./AxiosRequest.class')
const FetchRequest = require('./FetchRequest.class')

const config = require('../../config/defaultConfig.json')

// Mock engine
const engine = jest.genMockFromModule('../../engine/Engine.class')

beforeEach(() => {
  jest.resetAllMocks()
})

describe('RequestFactory', () => {
  it('should initialize AxiosRequest when stack is axios', () => {
    config.engine.httpRequest.stack = 'axios'
    engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }

    const request = RequestFactory.create(engine)

    expect(request).toBeInstanceOf(AxiosRequest)
  })

  it('should initialize FetchRequest when stack is fetch', () => {
    config.engine.httpRequest.stack = 'fetch'
    engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }

    const request = RequestFactory.create(engine)

    expect(request).toBeInstanceOf(FetchRequest)
  })
})
