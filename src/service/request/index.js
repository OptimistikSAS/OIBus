const AxiosRequest = require('./axios-request')
const FetchRequest = require('./fetch-request')

const createRequestService = (engine) => {
  const { engineConfig: { httpRequest } } = engine.configService.getConfig()

  if (httpRequest.stack === 'axios') {
    return new AxiosRequest(engine)
  }
  return new FetchRequest(engine)
}

module.exports = { createRequestService }
