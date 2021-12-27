/**
 * check data from OIAnalytics time values API
 * Expected data are :
 * [
 *  {
 *     'dataReference': 'SP_003_X',
 *     'unit': 'g/L',
 *     'values': [{
 *       'timestamp': '2021-01-01T00:00:00Z',
 *       'value': 28.80793967358669
 *     }, {
 *       'timestamp': '2021-01-01T08:00:00Z',
 *       'value': 29.249495526681248
 *     },]
 *   }
 *  ]
 * @param {object} data - the data resulting of an OIAnalytics time series API call
 * @return {void}
 */
const checkDataFormat = (data) => {
  if (!Array.isArray(data)) {
    throw Error('Bad data: expect OIAnalytics time values to be an array')
  }
  if (data.length > 0) {
    const firstData = data[0]
    if (!firstData.dataReference) {
      throw Error('Bad data: expect dataReference field')
    }
    if (!firstData.unit) {
      throw Error('Bad data: expect unit field')
    }
    if (!Array.isArray(firstData.values)) {
      throw Error('Bad data: expect values to be an array')
    }
    if (firstData.values.length > 0) {
      const firstValue = firstData.values[0]
      if (!firstValue.timestamp) {
        throw Error('Bad data: expect value to have a timestamp')
      }
      if (!firstValue.value) {
        throw Error('Bad data: expect value to have a value')
      }
    }
  }
}

/**
 * Parse data from OIAnalytics time values API
 * @param {object} data - the data resulting of an OIAnalytics time series API call
 * @return {object} formattedData - the data flattened for easier access (into csv files for example)
 */
const format = (data) => {
  checkDataFormat(data)
  const formattedData = []
  data.forEach((currentData) => {
    currentData.values.forEach((currentValue) => {
      formattedData.push({
        pointId: currentData.dataReference,
        unit: currentData.unit,
        timestamp: currentValue.timestamp,
        value: currentValue.value,
      })
    })
  })
  return formattedData
}

module.exports = format
