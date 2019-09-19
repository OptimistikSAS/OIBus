const type = {
  string: (val) => ((typeof val === 'string' || val instanceof String) ? null : 'value should be a string'),
  number: (val) => ((typeof val === 'number' || val instanceof Number) ? null : 'value should be a number'),
  stringOrNumber: (val) => (type.string(val) || type.number(val) ? null : 'value should be a string or number'),
}

export default type
