const schema = require('./MongoDB.schema.jsx').default
const testSchema = require('../../services/testSchema.js').default

testSchema(schema)
