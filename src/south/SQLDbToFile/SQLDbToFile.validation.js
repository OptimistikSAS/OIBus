import type from '../../client/helpers/validation'

const validation = {
  SQLDbToFile: {
    host: (val) => ((val && val.length > 2) ? null : 'Length should be greater than 2'),
    port: (val) => (val >= 1 && val <= 65535 ? null : 'Value should be between 1 and 65535'),
    username: (val) => ((val && val.length > 0) ? null : 'Username should not be empty'),
    password: (val) => ((val && val.length > 0) ? null : 'Password should not be empty'),
    database: (val) => ((val && val.length > 0) ? null : 'Database should not be empty'),
    query: (val) => ((val && val.length > 0) ? null : 'Query should not be empty'),
    connectionTimeout: (val) => (val > 0 ? null : 'Connection timeout should be greater than 0'),
    requestTimeout: (val) => (val >= 1000 ? null : 'Retry interval should be greater or equal to 1000'),
    delimiter: (val) => ((val && val.length === 1) ? null : 'Length should be 1'),
    filename: (val) => ((val && val.length > 0) ? null : 'Filename should not be empty'),
    timeColumn: (val) => ((val && val.length > 0) ? null : 'Time Column should not be empty'),
    timezone: type.timezone,
    dateFormat: (val) => ((val && val.length > 0) ? null : 'Date Format should not be empty'),
  },
}

export default validation
