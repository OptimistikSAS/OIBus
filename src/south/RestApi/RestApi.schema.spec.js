const schema = require('./RestApi.schema').default
const testSchema = require('../../services/testSchema').default

testSchema(schema)
