const schema = require('./Console.schema').default
const testSchema = require('../../services/testSchema').default

testSchema(schema)
