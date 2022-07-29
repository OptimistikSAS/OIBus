const controls = [
  'OIbTitle',
  'OIbSelect',
  'OIbTable',
  'OIbText',
  'OIbLink',
  'OIbCheckBox',
  'OIbScanMode',
  'OIbAuthentication',
  'OIbInteger',
  'OIbPassword',
  'OIbTextArea',
  'OIbProxy',
  'OIbAuthentication',
  'OIbTimezone',
]

const testSchema = (schema) => {
  describe('a valid schema', () => {
    it('should have a name, category, etc...', () => {
      expect(typeof schema.name).toBe('string')
      expect(typeof schema.category).toBe('string')
      expect(typeof schema.supportListen).toBe('boolean')
      expect(typeof schema.supportLastPoint).toBe('boolean')
      expect(typeof schema.supportFiles).toBe('boolean')
      expect(typeof schema.supportHistory).toBe('boolean')
      expect(typeof schema.supportPoints).toBe('boolean')
    })
    Object.entries(schema.form).forEach(([field, parameters]) => {
      const keys = Object.keys(parameters)
      it(`${field} should be valid'`, () => {
        expect(keys.includes('type')).toBe(true)
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
