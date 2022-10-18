const schema = require('./north-timescale-db.schema.jsx').default
const testSchema = require('../../../tests/test-schema').default

testSchema(schema)
