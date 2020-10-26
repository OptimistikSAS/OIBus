const mqtt = require('mqtt')
const ApiHandler = require('../ApiHandler.class')

/**
 * Expected caching parameters:
 * Send Interval (ms): [1000, 3000]
 * Retry Interval (ms): 5000
 * Group count : 10000
 * Max Group Count : 10000
 * with the condition: Group Count <= Max Group Count
 */


/**
 * Class WATSYConnect - generates and sends MQTT messages for WATSY
 * The MQTT message sent will have the format:
 * {
      'timestamp' : $timestamp in ns
      'tags'    : {
          'tag1'  : $tag_value_1
          'tag2'  : $tag_value_2  
          ...                  
      }
      'fields'    : {
          'field1'  : $field_value_1
          'field2'  : $field_value_2  
          ...                  
      }
      'host'      : $host (can't be null)
      'token'     : $token (can't be null)
  }
 */

class WATSYConnect extends ApiHandler {
  /**
   * Constructor for WATSYConnect
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)

    const { MQTTUrl, port, username, password, applicativeHostUrl, secretKey } = this.application.WATSYConnect
    this.url = MQTTUrl + ':' + port
    this.username = username
    this.password = Buffer.from(this.decryptPassword(password))
    this.qos = 1
    this.host = applicativeHostUrl
    this.token = Buffer.from(this.decryptPassword(secretKey))  

    this.splitMessageTimeout = this.application.caching.sendInterval //in ms
    this.OIBUSName = this.engine.configService.getConfig().engineConfig.engineName
    this.initMQTTTopic()

    this.successCount = 0

    this.canHandleValues = true
  }
  
  /**
   * Init the Mqqt Topic from 
   * @return {void}
   */
  initMQTTTopic(){
    // Declare local var which will be used to construct the topic
    let mqttTopic
    let regex = /^https?:\/\// // clean $host in mqtt topic construction
    
    // Construct the topic
    mqttTopic = 'data/' + this.host.replace(regex, '') + '/' + this.OIBUSName 
    // Replace all . by _ in the topic
    mqttTopic = mqttTopic.split('.').join('_')
    this.mqttTopic = mqttTopic
  }

  /**
   * Connection to Broker MQTT
   * TODO: Change the parameters (url) with port number
   * @return {void}
   */
  connect() {
    super.connect()
    this.logger.info(`Connecting WATSYConnect North MQTT Connector to ${this.url}...`)
    this.client = mqtt.connect(this.url, { username: this.username, password: this.password })
    this.client.on('error', (error) => {
      this.logger.error(error)
    })

    this.client.on('connect', () => {
      this.logger.info(`Connection WATSYConnect North MQTT Connector to ${this.url}`)
    })
  }

  /**
   * Disconnection from MQTT Broker
   * @return {void}
   */
  disconnect() {
    this.logger.info(`Disconnecting WATSYConnect North MQTT Connector from ${this.url}`)
    this.client.end(true)
  }

  /**
   * Handle messages by sending them to WATSYConnect North.
   * @param {object[]} messages - The messages
   * @return {Promise} - The handle status
   */
  async handleValues(messages) {
    this.logger.silly(`Link handleValues() call with ${messages.length} messages`)
    const successCount = await this.publishOIBusMessages(messages)
    if (successCount === 0) {
      throw ApiHandler.STATUS.COMMUNICATION_ERROR
    }
    return successCount
  }
  
  /**
   * Makes an MQTT publish message with the parameters in the Object arg.
   * @param {Object[]} messages - The message from the event
   * @returns {Promise} - The request status
   */
  async publishOIBusMessages(messages) {
    // Only for Debug
    console.table(messages, ['id', 'pointId', 'timestamp', 'data'])
    
    // Intit succesCount to 0 when we handle new messages
    this.successCount = 0

    try {
      if (messages.length > 0){
        let allWATSYMessages = this.splitMessages(messages)
        for (const index in allWATSYMessages){
          await this.publishWATSYMQTTMessage(allWATSYMessages[index])
        }
      }
    } 
    catch (error) {
      this.logger.error(error)
    }

    return this.successCount
  }

  /**
   * Publish MQTT message.
   *
   * @param {object} message - The message to publish
   * @returns {Promise} - The publish status
   */
  publishWATSYMQTTMessage(message) {
    return new Promise((resolve, reject) => {
      this.client.publish(this.mqttTopic, JSON.stringify(message), { qos: this.qos }, (error) => {
        if (error) {
          this.logger.error(error)
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Convert the message into WATSY format
   *
   * @param {object[]} messages - The message to publish
   * @return {object[]} - The publish value
   */
  splitMessages(messages){
    
    let allWATSYMessages = this.recursiveSplitMessages([], messages)
    return allWATSYMessages
  }

  /**
   * Convert the message into WATSY format
   * @param {object[]} allWATSYMessages
   * @param {object[]} messages - The message to publish
   * @return {object[]} - The publish value
   */
  recursiveSplitMessages(allWATSYMessages, messages){
    // Check if messages is not null
    if (messages.length > 1){
      // Declare all local var for the split logic
      let splitTimestamp = Date.parse(messages[messages.length - 1]['timestamp']) // Convert to timestamp
    
      let i = messages.length - 1
      while( i > 0 ){
        // Check if the the message is in the splitTimestamp delta time

        if ( Date.parse(messages[i]['timestamp']) < splitTimestamp - this.splitMessageTimeout ) {
          // Get all the message which are not in less than splitTImestamp than the last message
          let splitMessage = messages.slice(0, i)
          
          // Add the message which respect the splitTimestamp
          allWATSYMessages = this.recursiveSplitMessages(allWATSYMessages, splitMessage)
          allWATSYMessages.push(this.convertIntoWATSYFormat(messages.slice(i)))

          this.successCount += messages.slice(i).length
          return allWATSYMessages
        }
        i--
      }

      // All the message are in the sendMessage Interval ([1, 3] sec)
      allWATSYMessages.push(this.convertIntoWATSYFormat(messages))
      this.successCount += messages.length
      return allWATSYMessages
    }
    else{
      // End of the recursive function
      if (messages.length == 1){
        allWATSYMessages.push(this.convertIntoWATSYFormat(messages))
        this.successCount += 1
      }
      return allWATSYMessages
    }
  }

  /**
   * Convert the message into WATSY format
   *
   * @param {object[]} message - The message to publish
   * @return {Object} - The publish status
   */
  convertIntoWATSYFormat(message){
    let tags = {}
    let fields = {}

    // Construct fields and tags choosing the latest state for each PointId
    for (let i = message.length -1; i >= 0; i--){
      // Add the current fields (datpointID) if it's not in JSON fields
      if (!fields.hasOwnProperty(message[i]['pointId'])){
        fields[message[i]['pointId']] = message[i]['data']['value']
      }
    }

    // TODO: Add all tags

    return {
      'timestamp' : Date.parse(message[message.length -1]['timestamp'])*1000*1000, //from ms to ns 
      'tags'      : tags,
      'fields'    : fields,
      'host'      : this.host,
      'token'     : this.token
    }
  }
}

module.exports = WATSYConnect