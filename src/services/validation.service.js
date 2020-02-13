import path from 'path'

// regular expressions to validate
// eslint-disable-next-line max-len
const ipv4 = /^\s*((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))\s*$/
// eslint-disable-next-line max-len
const ipv6 = /^\s*[[]{0,1}\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*[\]]{0,1}\s*$/
const hostname = /^(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9]*[a-zA-Z0-9])\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9]*[A-Za-z0-9])$/

const combinedValidations = (array) => (val) => {
  let returnValue = null
  array.forEach((valid) => {
    returnValue = returnValue || valid(val)
  })
  return returnValue
}
// check if it is a number or a string not empty
const notEmpty = (name = 'Value') => (val) => (
  !Number.isNaN(parseFloat(val)) || (val && val.length > 0) ? null : `${name} should not be empty`
)
const isPath = (name = 'Value') => (val) => (path.basename(val) === val ? null : `${name} should be a valid path`)
const isHost = (name = 'Value') => (val) => (
  (ipv4.test(val) || ipv6.test(val) || hostname.test(val)) ? null : `${name} should be a valid hostname or ip`
)
const isIp = (name = 'Value') => (val) => (
  (ipv4.test(val) || ipv6.test(val)) ? null : `${name} should be a valid ip`
)
const minValue = (min, name = 'Value') => (val) => (val >= min ? null : `${name} should not greater than ${min}`)
const maxValue = (max, name = 'Value') => (val) => (val >= max ? null : `${name} should not lower than ${max}`)
const inRange = (min, max, name = 'Value') => (val) => (
  val >= min && val <= max ? null : `${name} should be between ${min} and ${max}`
)
const minLength = (min, name = 'Value') => (val) => (
  val && val.length >= min ? null : `${name} length should be at least ${min}`
)
const maxLength = (max, name = 'Value') => (val) => (
  val && val.length <= max ? null : `${name} length should be below ${max}`
)
const hasLengthBetween = (min, max, name = 'Value') => (val) => combinedValidations([minLength(min, name), maxLength(max, name)])(val)

const length = (_length, name = 'Value') => (val) => (
  val && val.length === _length ? null : `${name} length should be ${_length}`
)
const notEndsWith = (test, name = 'Value') => (val) => (
  !val || !val.endsWith(test) ? null : `${name} should not end with ${test}`
)
const startsWith = (test, name = 'Value') => (val) => (
  val && startsWith(test) ? null : `${name} should start with ${test}`
)

// always return null (ie. no validation)
const optional = () => () => null

export {
  notEmpty,
  isPath,
  isIp,
  isHost,
  inRange,
  minLength,
  maxLength,
  hasLengthBetween,
  length,
  minValue,
  maxValue,
  notEndsWith,
  startsWith,
  combinedValidations,
  optional,
}
