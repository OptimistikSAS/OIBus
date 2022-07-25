const schema = require('./AmazonS3.schema').default
const testSchema = require('../../services/testSchema').default

testSchema(schema)
