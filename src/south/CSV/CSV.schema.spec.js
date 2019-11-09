const schema = require('./CSV.schema.jsx').default

describe('schema', () => {
  Object.entries(schema.form).forEach(([field, parameters]) => {
    const keys = Object.keys(parameters)
    it(`${field} should be valid'`, () => {
      expect(keys.includes('type')).toBe(true)
      expect(keys.includes('newRow')).toBe(true)
      expect(keys.includes('md')).toBe(true)
    })
  })
})
