import type from '../../client/helpers/validation'

const validation = {
  SQLDbToFile: {
    host: type.string,
    port: type.number,
    username: type.string,
    password: type.string,
    database: type.string,
    query: type.string,
    connectionTimeout: type.number,
    requestTimeout: type.number,
    delimiter: type.string,
    filename: type.string,
    timeColumn: type.string,
  },
}

export default validation
