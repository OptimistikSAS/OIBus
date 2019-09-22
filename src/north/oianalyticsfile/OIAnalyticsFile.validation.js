import type from '../../client/helpers/validation'

const validation = {
  OIAnalyticsFile: {
    host: type.string,
    endpoint: type.string,
    authentication: {
      username: (val) => ((val && val.length > 0) ? null : 'user should not be empty'),
      password: (val) => ((val && val.length > 0) ? null : 'password should not be empty'),
    },
  },
}

export default validation
