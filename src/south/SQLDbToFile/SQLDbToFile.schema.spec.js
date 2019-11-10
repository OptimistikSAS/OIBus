const schema = require('./SQLDbToFile.schema.jsx').default
const testSchema = require('../testSchema.js').default

testSchema(schema)
