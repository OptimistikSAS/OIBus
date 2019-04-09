import Api from '../helpers/api'
import ApiConfig from '../config/api'

const { requests } = ApiConfig

const ConfigService = {
  getSouthProtocols() {
    return Api.getRequest(requests.south)
  },
  getNorthApis() {
    return Api.getRequest(requests.north)
  },
  getConfig() {
    return Api.getRequest(requests.config)
  },
  getSouthProtocolSchema(protocol) {
    return Api.getRequest(`${requests.south}/${protocol}`)
  },
  getNorthApiSchema(api) {
    return Api.getRequest(`${requests.north}/${api}`)
  },
}

export default ConfigService
