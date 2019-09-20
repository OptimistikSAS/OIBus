import type from '../../client/helpers/validation'

const validation = {
  OIAnalyticsFile: {
    host: type.string,
    endpoint: type.string,
    authentication: {
      username: type.string,
      password: type.string,
    },
  },
}

export default validation
