const schema = require('./InfluxDB.schema').default
const testSchema = require('../../services/testSchema').default

testSchema(schema)
