const schema = require('./CsvToHttp.schema').default
const testSchema = require('../../services/testSchema').default

testSchema(schema)
