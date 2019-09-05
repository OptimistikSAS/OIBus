import type from '../../client/helpers/validation'

const validation = {
  TimescaleDB: {
    user: type.string,
    password: type.string,
    db: type.string,
    host: type.string,
  },
}

export default validation
