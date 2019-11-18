const schema = require('./CSV.schema.jsx').default
const testSchema = require('../../services/testSchema.js').default

testSchema(schema)
