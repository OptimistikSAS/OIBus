const schema = require('./north-influx-db.schema.jsx').default
const testSchema = require('../../../tests/test-schema').default

testSchema(schema)
