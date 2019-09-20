import type from '../../client/helpers/validation'

const validation = {
  OIConnect: {
    host: type.string,
    endpoint: type.string,
    authentication: {
      username: type.string,
      password: type.string,
    },
    timeout: type.number,
  },
}

export default validation
