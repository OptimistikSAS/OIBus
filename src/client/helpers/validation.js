const moment = require('moment-timezone')

const type = {
  string: (val) => ((typeof val === 'string' || val instanceof String) ? null : 'value should be a string'),
  number: (val) => ((typeof val === 'number' || val instanceof Number) ? null : 'value should be a number'),
  stringOrNumber: (val) => (type.string(val) || type.number(val) ? null : 'value should be a string or number'),
  timezone: (val) => (moment.tz.zone(val) ? null : 'value should be a valid timezone'),
}

export default type
