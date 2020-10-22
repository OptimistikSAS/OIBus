const mqtt = require('mqtt')

const ApiHandler = require('../ApiHandler.class')

/**
 * Class WATSYConnect - generates and sends MQTT messages for WATSY
 * The MQTT message sent will have the format:
* {
      'timestamp' : $timestamp
      'tags'    : {
          'tag1'  : $tag1
          'tag2'  : $tag2  
          ...                  
      }
      'fields'    : {
          'field1'  : $field1
          'field2'  : $field2  
          ...                  
      }
      'host'      : $host (can't be null)
      'token'     : $token (can't be null)
  }
*/
class WATSYConnect extends ApiHandler {
    /**
   * Constructor for MQTT
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {Engine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)

    const { url, qos, username, password, host, token, topic } = this.application.WATSYConnect

    this.url = url
    this.username = username
    this.password = Buffer.from(this.decryptPassword(password))
    this.qos = qos
    this.host = host
    this.token = token
    this.topic = topic
    

    this.canHandleValues = true
  }

  /**
   * Handle messages by sending them to WATSYConnect North.
   * @param {object[]} messages - The messages
   * @return {Promise} - The handle status
   */
  async handleValues(messages) {
    this.logger.silly(`Link handleValues() call with ${messages.length} messages`)
    const successCount = await this.publishValues(messages)
    if (successCount === 0) {
      throw ApiHandler.STATUS.COMMUNICATION_ERROR
    }
    return successCount
  }

  /**
   * Connection to Broker MQTT
   * TODO: Change the parameters (url)
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
   * Convert the message into WATSY format
   *
   * @param {object[]} message - The message to publish
   * @returns {Promise} - The publish status
   */
  convertIntoWATSYFormat(message){
    let tags = {}
    let fields = {}

    // Construct fields and tags choosing the latest state for each PointId
    for (i = message.length -1; i > 0; i--){
      // Add the current fields (datpointID) if it's not in JSON fields
      if (fields.hasOwnProperty(message[i]['pointId'])){
        fields[message[i]['pointId']] = message[i]['data']['value']
      }
    }
    
    // TODO: Add all tags

    return {
      'timestamp' : Date.parse(message['timestamp']) * 1000, // from ms to ns
      'tags'      : tags,
      'fields'    : fields,
      'host'      : this.host,
      'token'     : this.token
    }
  }


  /**
   * Publish MQTT message.
   *
   * @param {object[]} message - The message to publish
   * @returns {Promise} - The publish status
   */
  publishValue(message) {
    return new Promise((resolve, reject) => {
      this.client.publish(topicValue, JSON.stringify(this.convertIntoWATSYFormat(message)), { qos: this.qos }, (error) => {
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
   * @param {Object[]} messages - The message from the event
   * @return {Promise} - The request status
   */
  async publishValues(messages) {
    let successCount = 0
    
    try {
      if (messages.length > 0){
        // Check if messages is not null
        // Declare all local var for the split logic
        let splitTimeMessage = this.application.caching.sendInterval //in ms
        let lastmessagesIndexSend = 0
        let splitTimestamp = Date.parse(messages[0]['timestamp']) // Convert to timestamp
    
        for (let i = 0; i < messages.length; i++){
          // Check if the the 
          if ( Date.parse(messages[i]['timestamp']) >= splitTimestamp + splitTimeMessage ) {
            await this.publishValue(messages.slice(lastmessagesIndexSend, i))
            splitTimestamp = Date.parse(messages[i]['timestamp'])
            lastmessagesIndexSend = i
            successCount += 1
          }
        }
        // Publish the last message of the array
        if (lastmessagesIndexSend !== messages.length ){
          await this.publishValue(messages[messages.length - 1])
          successCount +=1
        }
      }
    } catch (error) {
      this.logger.error(error)
    }

    return successCount
  }
}

module.exports = WATSYConnect