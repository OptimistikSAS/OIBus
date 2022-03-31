const schema = require('./SQL.schema.jsx').default
const testSchema = require('../../services/testSchema').default

testSchema(schema)
