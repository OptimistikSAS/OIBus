import type from '../../client/helpers/validation'

const validation = {
  InfluxDB: {
    user: type.string,
    password: type.string,
    db: type.string,
    host: type.string,
    precision: type.string,
  },
}

export default validation
