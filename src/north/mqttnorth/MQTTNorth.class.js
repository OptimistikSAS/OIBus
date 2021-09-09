const { vsprintf } = require('sprintf-js')
const fs = require('fs/promises')
const mqtt = require('mqtt')

const ApiHandler = require('../ApiHandler.class')

/**
 * function return the content of value, that could be a Json object with path keys given by string value
 * without using eval function
 * @param {*} value - simple value (integer or float or string, ...) or Json object
 * @param {*} pathValue - The string path of value we want to retrieve in the Json Object
 * @return {*} The content of value depending on value type (object or simple value)
 */
const getJsonValueByStringPath = (value, pathValue) => {
  let tmpValue = value

  if (typeof value === 'object') {
    if (pathValue !== '') {
      const arrValue = pathValue.split('.')
      arrValue.forEach((k) => { tmpValue = tmpValue[k] })
    }
  }
  return tmpValue
}

/**
 * Class MQTT - generates and sends MQTT messages
 */
class MQTTNorth extends ApiHandler {
  static category = 'IoT'

  /**
   * Constructor for MQTT
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)

    // eslint-disable-next-line max-len
    const {
      url,
      qos,
      clientId,
      username,
      password,
      keyFile,
      certFile,
      caFile,
      rejectUnauthorized,
      regExp,
      topic,
      useDataKeyValue,
      keyParentValue
    } = this.application.MQTTNorth

    this.url = url
    this.qos = qos
    this.clientId = clientId || `OIBus-${Math.random().toString(16).substr(2, 8)}`
    this.username = username
    this.password = Buffer.from(this.encryptionService.decryptText(password))
    this.keyFile = keyFile
    this.certFile = certFile
    this.caFile = caFile
    this.rejectUnauthorized = rejectUnauthorized
    this.regExp = regExp
    this.topic = topic
    this.useDataKeyValue = useDataKeyValue
    this.keyParentValue = keyParentValue

    this.canHandleValues = true
  }

  /**
   * Handle values by sending them to MQTT North.
   * @param {object[]} values - The values
   * @return {Promise} - The handle status
   */
  async handleValues(values) {
    this.logger.silly(`Link handleValues() call with ${values.length} values`)
    const successCount = await this.publishValues(values)
    if (successCount === 0) {
      throw ApiHandler.STATUS.COMMUNICATION_ERROR
    }
    this.statusData['Last handled values at'] = new Date().toISOString()
    this.statusData['Number of values sent since OIBus has started'] += values.length
    this.statusData['Last added point id (value)'] = `${values[values.length - 1].pointId} (${values[values.length - 1].data.value})`
    this.updateStatusDataStream()
    return successCount
  }

  /**
   * Connection to Broker MQTT
   * @return {void}
   */
  async connect() {
    super.connect()
    this.logger.info(`Connecting North MQTT Connector to ${this.url}...`)
    let keyFileContent = ''
    let certFileContent = ''
    let caFileContent = ''

    if (this.keyFile) {
      try {
        if (await fs.exists(this.keyFile)) {
          keyFileContent = await fs.readFile(this.keyFile)
        } else {
          this.logger.error(`Key file ${this.keyFile} does not exist`)
        }
      } catch (error) {
        this.logger.error(`Error reading key file ${this.keyFile}: ${error}`)
        return
      }
    }
    if (this.certFile) {
      try {
        if (await fs.exists(this.certFile)) {
          certFileContent = await fs.readFile(this.certFile)
        } else {
          this.logger.error(`Cert file ${this.certFile} does not exist`)
        }
      } catch (error) {
        this.logger.error(`Error reading cert file ${this.certFile}: ${error}`)
        return
      }
    }
    if (this.caFile) {
      try {
        if (await fs.exists(this.caFile)) {
          caFileContent = await fs.readFile(this.caFile)
        } else {
          this.logger.error(`CA file ${this.caFile} does not exist`)
        }
      } catch (error) {
        this.logger.error(`Error reading ca file ${this.caFile}: ${error}`)
        return
      }
    }

    const options = {
      username: this.username,
      password: this.password,
      clientId: this.clientId,
      key: keyFileContent,
      cert: certFileContent,
      ca: caFileContent,
      rejectUnauthorized: this.rejectUnauthorized ? this.rejectUnauthorized : false,
    }
    this.client = mqtt.connect(this.url, options)

    this.client.on('connect', this.handleConnectEvent.bind(this))
    this.client.on('error', this.handleConnectError.bind(this))
  }

  /**
   * Handle successful connection event.
   * @return {void}
   */
  handleConnectEvent() {
    this.logger.info(`North MQTT Connector connected to ${this.url}`)
    this.statusData['Connected at'] = new Date().toISOString()
    this.updateStatusDataStream()
  }

  /**
   * Handle connection error event.
   * @param {object} error - The error
   * @return {void}
   */
  handleConnectError(error) {
    this.logger.error(error)
  }

  /**
   * Disconnection from MQTT Broker
   * @return {void}
   */
  disconnect() {
    this.logger.info(`Disconnecting North MQTT Connector from ${this.url}`)
    this.client.end(true)
    this.statusData['Connected at'] = 'Not connected'
    this.updateStatusDataStream()
    super.disconnect()
  }

  /**
   * Publish MQTT message.
   *
   * @param {object} entry - The entry to publish
   * @returns {Promise} - The publish status
   */
  publishValue(entry) {
    return new Promise((resolve, reject) => {
      const { pointId, data } = entry

      const mainRegExp = new RegExp(this.regExp)
      const groups = mainRegExp.exec(pointId)
      // Remove the first element, which is the matched string, because we only need the groups
      groups.shift()

      const topicValue = vsprintf(this.topic, groups)

      // Determinate the value to process depending on useDataKeyValue and keyParentValue parameters
      let dataValue = null
      if (this.useDataKeyValue) {
        // data to use is value key of Json object data (data.value)
        // this data.value could be a Json object or simple value (i.e. integer or float or string, ...)
        // If it's a json the function return data where "adress" is given by keyParentValue parametrer
        dataValue = getJsonValueByStringPath(data.value, this.keyParentValue)
      } else {
        // data to use is Json object data
        dataValue = data
      }

      this.client.publish(topicValue, JSON.stringify(dataValue), { qos: this.qos }, (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Makes an MQTT publish message with the parameters in the Object arg.
   * @param {Object[]} entries - The entry from the event
   * @return {Promise} - The request status
   */
  async publishValues(entries) {
    let successCount = 0
    try {
      // Disable ESLint check because we need for..of loop to support async calls
      // eslint-disable-next-line no-restricted-syntax
      for (const entry of entries) {
        // Disable ESLint check because we want to publish values one by one
        // eslint-disable-next-line no-await-in-loop
        await this.publishValue(entry)
        successCount += 1
      }
    } catch (error) {
      this.logger.error(error)
    }

    return successCount
  }
}

module.exports = MQTTNorth
