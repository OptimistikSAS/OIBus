import type from '../../client/helpers/validation'

const validation = {
  AliveSignal: {
    host: type.string,
    authentication: {
      username: type.string,
      password: type.string,
    },
    id: type.string,
    frequency: type.number,
  },
}

export default validation
