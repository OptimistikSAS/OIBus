const schema = require('./InfluxDB.schema.jsx').default
const testSchema = require('../../services/testSchema.js').default

testSchema(schema)
