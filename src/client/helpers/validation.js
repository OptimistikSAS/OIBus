const type = {
  string: (val) => ((typeof val === 'string' || val instanceof String) ? null : 'value should be a string'),
  number: (val) => ((typeof val === 'number' || val instanceof Number) ? null : 'value should be a number'),
  stringOrNumber: (val) => ((typeof val === 'number' || val instanceof Number)
                        || (typeof val === 'string' || val instanceof String) ? null : 'value should be a number'),
}

export default type
