const schema = require('./MongoDB.schema').default
const testSchema = require('../../services/testSchema').default

testSchema(schema)
