import mqttWildcard from 'mqtt-wildcard'
import { vsprintf } from 'sprintf-js'
import { generateDateWithTimezone } from '../../service/utils.js'

/**
 * Get pointId.
 * @param {String} topic - The topic
 * @param {Object} currentData - The data being parsed
 * @param {String} pointIdPath - The pointId path
 * @param {Object[]} pointsList - The list of all points
 * @return {String | null} - The pointId
 */
const getPointId = (topic, currentData, pointIdPath, pointsList) => {
  if (pointIdPath) { // if the pointId is in the data
    if (!currentData[pointIdPath]) {
      throw new Error(`Could node find pointId in path "${pointIdPath}" for data: ${JSON.stringify(currentData)}`)
    }
    return currentData[pointIdPath]
  }

  // else, the pointId is in the topic
  let pointId = null
  const matchedPoints = []

  pointsList.forEach((point) => {
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
    throw new Error(`Topic "${topic}" should be subscribed only once but it has the `
     + `following subscriptions: ${JSON.stringify(matchedPoints)}`)
  } else if (!pointId) {
    throw new Error(`PointId can't be determined. The following value ${JSON.stringify(currentData)} is not saved.`)
  }

  return pointId
}

/**
 * Get timestamp.
 * @param {String} elementTimestamp - The element timestamp
 * @param {'payload'|'oibus'} timestampOrigin - The timestamp origin
 * @param {String} timestampFormat - The timestamp format
 * @param {String} timezone - The timezone
 * @return {String} - The formatted timestamp
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
 * @param {Object} data - The data to format
 * @param {String} topic - The mqtt topic received. It can differ from the pointsList topic which can have a wildcard
 * @param {Object} formatOptions - The formatting options
 * @param {Object[]} pointsList - The list of all topics
 * @returns {{pointId: String, data: {value: any, quality: any}, timestamp: String}|null} - the formatted data
 */
const formatValue = (data, topic, formatOptions, pointsList) => {
  const {
    timestampPath,
    timestampOrigin,
    timestampFormat,
    timezone,
    valuePath,
    pointIdPath,
    qualityPath,
  } = formatOptions
  const dataPointId = getPointId(topic, data, pointIdPath, pointsList)

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

export default formatValue
