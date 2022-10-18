const schema = require('./south-sql.schema.jsx').default
const testSchema = require('../../../tests/test-schema').default

testSchema(schema)
