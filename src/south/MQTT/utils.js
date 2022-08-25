const mqttWildcard = require('mqtt-wildcard')
const { vsprintf } = require('sprintf-js')
const { generateDateWithTimezone } = require('../../services/utils')

/**
 * Get pointId.
 * @param {string} topic - The topic
 * @param {object} currentData - The data being parsed
 * @param {string} pointIdPath - The pointId path
 * @param {array} topicList - The list of all topics
 * @return {string | null} - The pointId
 */
const getPointId = (topic, currentData, pointIdPath, topicList) => {
  if (pointIdPath) { // if the pointId is in the data
    if (!currentData[pointIdPath]) {
      throw new Error(`Could node find pointId in path ${pointIdPath} for data: ${JSON.stringify(currentData)}`)
    }
    return currentData[pointIdPath]
  }

  // else, the pointId is in the topic
  let pointId = null
  const matchedPoints = []

  topicList.forEach((point) => {
    const matchList = mqttWildcard(topic, point.topic)
    if (Array.isArray(matchList)) {
      if (!pointId) {
        const nrWildcards = (point.pointId.match(/[+#]/g) || []).length
        if (nrWildcards === matchList.length) {
          const normalizedPointId = point.pointId.replace(/[+#]/g, '%s')
          pointId = vsprintf(normalizedPointId, matchList)
          matchedPoints.push(point)
        } else {
          throw new Error(`Invalid point configuration: ${JSON.stringify(point)}`)
        }
      } else {
        matchedPoints.push(point)
      }
    }
  })

  if (matchedPoints.length > 1) {
    throw new Error(`${topic} should be subscribed only once but it has the
     following subscriptions: ${JSON.stringify(matchedPoints)}`)
  }

  return pointId
}

/**
 * Get timestamp.
 * @param {string} elementTimestamp - The element timestamp
 * @param {string} timestampOrigin - The timestamp origin
 * @param {string} timestampFormat - The timestamp format
 * @param {string} timezone - The timezone
 * @return {string} - The formatted timestamp
 */
const getTimestamp = (elementTimestamp, timestampOrigin, timestampFormat, timezone) => {
  let timestamp = new Date().toISOString()

  if (timestampOrigin === 'payload') {
    if (timezone && elementTimestamp) {
      timestamp = generateDateWithTimezone(elementTimestamp, timezone, timestampFormat)
    }
  }
  return timestamp
}

/**
 *
 * @param {object} data - The data to format
 * @param {string} topic - The mqtt topic
 * @param {object} formatOptions - The formatting options
 * @param {array} topicList - The list of all topics
 * @returns {{pointId: string, data: {value: *, quality: *}, timestamp: string}|null} - the formatted data
 */
const formatValue = (data, topic, formatOptions, topicList) => {
  const {
    timestampPath,
    timestampOrigin,
    timestampFormat,
    timezone,
    valuePath,
    pointIdPath,
    qualityPath,
  } = formatOptions
  const dataPointId = getPointId(topic, data, pointIdPath, topicList)
  if (dataPointId) {
    const dataTimestamp = getTimestamp(
      data[timestampPath],
      timestampOrigin,
      timestampFormat,
      timezone,
    )
    const dataValue = data[valuePath]
    const dataQuality = data[qualityPath]
    // delete fields to avoid duplicates in the returned object
    delete data[timestampPath]
    delete data[valuePath]
    delete data[pointIdPath]
    delete data[qualityPath]
    return {
      pointId: dataPointId,
      timestamp: dataTimestamp,
      data: {
        ...data,
        value: dataValue,
        quality: dataQuality,
      },
    }
  }
  throw new Error('PointId can\'t be determined. '
        + `The following value ${JSON.stringify(data)} is not saved.`)
}

module.exports = { formatValue }
