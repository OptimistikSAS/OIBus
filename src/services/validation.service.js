// check if it is a number or a string not empty
const notEmpty = (name = 'Value') => (val) => ((!Number.isNaN(parseFloat(val)) || (val && val.length > 0)) ? null : `${name} should not be empty`)
const minValue = (min, name = 'Value') => (val) => (val >= min ? null : `${name} should not greater than ${min}`)
const maxValue = (max, name = 'Value') => (val) => (val >= max ? null : `${name} should not lower than ${max}`)
const inRange = (min, max, name = 'Value') => (val) => (val >= min && val <= max ? null : `${name} should be between ${min} and ${max}`)
const minLength = (min, name = 'Value') => (val) => (val && val.length > min ? null : `${name} length should be at least ${min}`)
const length = (_length, name = 'Value') => (val) => (val && val.length === _length ? null : `${name} length should be ${_length}`)
const isBoolean = (name = 'Value') => (val) => (val === true || val === false ? null : `${name} must be a boolean`)
export { notEmpty, inRange, minLength, length, minValue, maxValue, isBoolean }
