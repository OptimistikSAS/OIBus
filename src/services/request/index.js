const AxiosRequest = require('./AxiosRequest.class')
const FetchRequest = require('./FetchRequest.class')

const createRequestService = (engine) => {
  const { engineConfig: { httpRequest } } = engine.configService.getConfig()

  if (httpRequest.stack === 'axios') {
    return new AxiosRequest(engine)
  }
  return new FetchRequest(engine)
}

module.exports = { createRequestService }
