// check if it is a number or a string not empty
const notEmpty = (name = 'Value') => (val) => ((!Number.isNaN(parseFloat(val)) || (val && val.length > 0)) ? null : `${name} should not be empty`)
const minValue = (min, name = 'Value') => (val) => (val >= min ? null : `${name} should not greater than ${min}`)
const maxValue = (max, name = 'Value') => (val) => (val >= max ? null : `${name} should not lower than ${max}`)
const inRange = (min, max, name = 'Value') => (val) => (val >= min && val <= max ? null : `${name} should be between ${min} and ${max}`)
const minLength = (min, name = 'Value') => (val) => (val && val.length > min ? null : `${name} length should be at least ${min}`)
const length = (_length, name = 'Value') => (val) => (val && val.length === _length ? null : `${name} length should be ${_length}`)
const notEndsWith = (test, name = 'Value') => (val) => (!val || !val.endsWith(test) ? null : `${name} should not end with ${test}`)
const startsWith = (test, name = 'Value') => (val) => (val && val.startsWith(test) ? null : `${name} should start with ${test}`)
const combinedValidations = (array) => (val) => {
  let returnValue = null
  array.forEach((valid) => {
    returnValue = returnValue || valid(val)
  })
  return returnValue
}

export { notEmpty, inRange, minLength, length, minValue, maxValue, notEndsWith, startsWith, combinedValidations }
