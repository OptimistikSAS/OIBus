import type from '../../client/helpers/validation'

const validation = {
  TimescaleDB: {
    user: (val) => ((val && val.length > 0) ? null : 'User should not be empty'),
    password: (val) => ((val && val.length > 0) ? null : 'Password should not be empty'),
    db: type.string,
    host: (val) => ((val && val.length > 2) ? null : 'Length should be greater than 2'),
  },
}

export default validation
