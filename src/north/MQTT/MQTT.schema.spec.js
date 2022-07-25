const schema = require('./MQTT.schema').default
const testSchema = require('../../services/testSchema').default

testSchema(schema)
