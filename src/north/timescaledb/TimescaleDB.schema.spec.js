const schema = require('./TimescaleDB.schema.jsx').default
const testSchema = require('../../services/testSchema.js').default

testSchema(schema)
