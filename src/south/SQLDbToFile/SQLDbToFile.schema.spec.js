const schema = require('./SQLDbToFile.schema.jsx').default
const testSchema = require('../../services/testSchema.js').default

testSchema(schema)
