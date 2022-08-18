import AxiosRequest from './AxiosRequest.class.js'
import FetchRequest from './FetchRequest.class.js'

const createRequestService = (engine) => {
  const { engineConfig: { httpRequest } } = engine.configService.getConfig()

  if (httpRequest.stack === 'axios') {
    return new AxiosRequest(engine)
  }
  return new FetchRequest(engine)
}

export default createRequestService
