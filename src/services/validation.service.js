const notEmpty = (name = 'Value') => (val) => (val && val.length > 0 ? null : `${name} should not be empty`)
const inRange = (min, max, name = 'Value') => (val) => (val >= min && val <= max ? null : `${name} should be between ${min} and ${max}`)
const minLength = (min, name = 'Value') => (val) => (val && val.length > min ? null : `${name} length should be at least ${min}`)
const length = (_length, name = 'Value') => (val) => (val && val.length === _length ? null : `${name} length should be ${_length}`)
export { notEmpty, inRange, minLength, length }
