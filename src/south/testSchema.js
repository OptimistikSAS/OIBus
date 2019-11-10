const controls = [
  'OIbTitle',
  'OIbSelect',
  'OIbTable',
  'OIbText',
  'OIbCheckBox',
  'OIbScanMode',
  'OIbAuthentication',
  'OIbInteger',
  'OIbPassword',
  'OIbTextArea',
]

const testSchema = (schema) => {
  describe('schema', () => {
    Object.entries(schema.form).forEach(([field, parameters]) => {
      const keys = Object.keys(parameters)
      it(`${field} should be valid'`, () => {
        expect(keys.includes('type')).toBe(true)
        expect(keys.includes('newRow')).toBe(true)
        expect(keys.includes('md')).toBe(true)
        expect(controls.includes(parameters.type)).toBe(true)
      })
      it('type key should be known', () => {
        expect(controls.includes(parameters.type)).toBe(true)
      })
      if (['OIbText', 'OIbInteger', 'OIbPassword', 'OIbTextArea'].includes(parameters.type)) {
        it('valid key should be a function', () => {
          expect(typeof parameters.valid).toBe('function')
        })
      }
    })
  })
}

export default testSchema
