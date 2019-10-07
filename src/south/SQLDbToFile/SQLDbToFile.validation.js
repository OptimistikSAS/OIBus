import type from '../../client/helpers/validation'

const validation = {
  SQLDbToFile: {
    host: (val) => ((val && val.length > 2) ? null : 'Length should be greater than 2'),
    port: (val) => (val >= 1 && val <= 65535 ? null : 'Value should be between 1 and 65535'),
    username: (val) => ((val && val.length > 0) ? null : 'Username should not be empty'),
    password: (val) => ((val && val.length > 0) ? null : 'Password should not be empty'),
    database: type.string,
    query: type.string,
    connectionTimeout: type.number,
    requestTimeout: type.number,
    delimiter: type.string,
    filename: type.string,
    timeColumn: type.string,
    timezone: type.timezone,
    dateFormat: type.string,
  },
}

export default validation
