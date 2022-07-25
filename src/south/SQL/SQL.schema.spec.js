const schema = require('./SQL.schema').default
const testSchema = require('../../services/testSchema').default

testSchema(schema)
