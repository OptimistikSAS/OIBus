import type from '../../client/helpers/validation'

const validation = {
  AliveSignal: {
    host: (val) => ((val && val.length > 2) ? null : 'Length should be greater than 2'),
    authentication: {
      username: (val) => ((val && val.length > 0) ? null : 'Username should not be empty'),
      password: (val) => ((val && val.length > 0) ? null : 'Password should not be empty'),
    },
    id: type.string,
    frequency: type.number,
  },
}

export default validation
