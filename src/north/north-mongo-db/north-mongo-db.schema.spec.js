const schema = require('./north-mongo-db.schema.jsx').default
const testSchema = require('../../../tests/test-schema').default

testSchema(schema)
