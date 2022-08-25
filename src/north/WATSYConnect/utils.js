/**
 * Generate the MQTT Topic
 * @param {String} oibusName - The name to add at the end of the topic
 * @param {String} host - The host
 * @return {String} - The generated topic
 */
const initMQTTTopic = (oibusName, host) => {
  // Declare local var which will be used to construct the topic
  let mqttTopic
  let regex = /^https?:\/\// // Clean $host in mqtt topic construction
  let regexHost = host.replace(regex, '')
  regex = /.com$|.fr$/
  regexHost = regexHost.replace(regex, '')

  // Construct the topic
  mqttTopic = `data/${regexHost}/${oibusName}`
  // Replace all . and - by _ in the topic
  mqttTopic = mqttTopic.split('.').join('_')
  mqttTopic = mqttTopic.split('-').join('_')
  return mqttTopic
}

/**
 * Convert the message into WATSY format
 * @param {Object[]} message - The message to publish
 * @param {String} host - The associated host
 * @param {String} token - The associated token
 * @return {Object} - The object in WATSY format
 */
const convertIntoWATSYFormat = (message, host, token) => {
  const tagsVar = {}
  const fieldsVar = {}

  // Construct fields and tags choosing the latest state for each PointId
  for (let i = message.length - 1; i >= 0; i -= 1) {
    // Add the current fields (pointId) if it's not in JSON fields
    if (!Object.prototype.hasOwnProperty.call(fieldsVar, message[i].pointId)) {
      fieldsVar[message[i].pointId] = message[i].data.value
    }
  }

  // TODO: Add all tags
  return {
    timestamp: Date.parse(message[message.length - 1].timestamp) * 1000 * 1000, // from ms to ns
    tags: tagsVar,
    fields: fieldsVar,
    host,
    token,
  }
}

/**
 * Convert the message into WATSY format
 * @param {Object[]} allWATSYMessages - All messages which will be returned
 * @param {Object[]} messages - The message to publish
 * @param {String} host - The associated host
 * @param {String} token - The associated token
 * @param {Number} splitMessageTimeout - The timeout used to split messages
 * @return {Object[]} - The values to publish
 */
const recursiveSplitMessages = (allWATSYMessages, messages, host, token, splitMessageTimeout) => {
  // Check if messages is not null
  if (messages.length > 1) {
    // Declare all local var for the split logic
    const splitTimestamp = Date.parse(messages[messages.length - 1].timestamp)

    let i = messages.length - 1

    while (i > 0) {
      // Check if the message is in the splitTimestamp delta time

      if (Date.parse(messages[i].timestamp) < splitTimestamp - splitMessageTimeout) {
        // Get all the message which are not in less than splitTimestamp than the last message
        const splitMessage = messages.slice(0, i + 1)

        // Add the message which respect the splitTimestamp
        const allWATSYMessagesVar = recursiveSplitMessages(allWATSYMessages, splitMessage, host, token, splitMessageTimeout)

        const pushMessages = messages.filter((x) => !splitMessage.includes(x))
        allWATSYMessagesVar.push(convertIntoWATSYFormat(pushMessages, host, token))

        return allWATSYMessagesVar
      }
      i -= 1
    }

    // All the message are in the sendMessage Interval ([1, 3] sec)
    allWATSYMessages.push(convertIntoWATSYFormat(messages, host, token))
    return allWATSYMessages
  }
  // End of the recursive function
  if (messages.length === 1) {
    allWATSYMessages.push(convertIntoWATSYFormat(messages, host, token))
  }
  return allWATSYMessages
}

module.exports = { initMQTTTopic, recursiveSplitMessages }
