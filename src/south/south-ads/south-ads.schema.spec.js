const schema = require('./south-ads.schema.jsx').default
const testSchema = require('../../../tests/test-schema').default

testSchema(schema)

describe('ADS schema', () => {
  it('isAdsNetId should correctly validate', () => {
    expect(schema.form.netId.valid('127.0.0.1')).toBe('Value should be a valid ads net ip')
    expect(schema.form.netId.valid('127.0.0.1.1.1')).toBe(null)
  })
})
