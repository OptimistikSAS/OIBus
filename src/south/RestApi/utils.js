const https = require('node:https')
const http = require('node:http')

const csv = require('papaparse')

const oiaTimeValues = require('./formatters/oia-time-values')
const slims = require('./formatters/slims')

const parsers = {
  Raw: (httpResults) => ({ httpResults, latestDateRetrieved: new Date().toISOString() }),
  'OIAnalytics time values': oiaTimeValues,
  SLIMS: slims,
}

/**
 * Some API such as SLIMS uses a body with GET. It's not standard and requires a specific implementation
 * @param {String} body - The body to append to the HTTP GET query
 * @param {Object} options - HTTP options
 * @returns {Promise<Object>} - The HTTP response
 */
const httpGetWithBody = (body, options) => new Promise((resolve, reject) => {
  const callback = (response) => {
    let str = ''
    response.on('data', (chunk) => {
      str += chunk
    })
    response.on('end', () => {
      try {
        const parsedResult = JSON.parse(str)
        resolve(parsedResult)
      } catch (error) {
        reject(error)
      }
    })
  }

  const req = (options.protocol === 'https:' ? https : http).request(options, callback)
  req.on('error', (e) => {
    reject(e)
  })
  req.write(body)
  req.end()
})

/**
 * @param {Date} startTime - The start time
 * @param {Date} endTime - The end time
 * @param {Object[]} queryParams - The list of query params to format with variables
 * @param {'ISO'|'number'} variableDateFormat - How to format the date variables in the query params
 * @returns {String} - The query params in string format with variables' value
 */
const formatQueryParams = (startTime, endTime, queryParams, variableDateFormat) => {
  if (queryParams.length === 0) {
    return ''
  }
  let queryParamsString = '?'
  queryParams.forEach((queryParam, index) => {
    let value
    switch (queryParam.queryParamValue) {
      case '@StartTime':
        value = variableDateFormat === 'ISO'
          ? new Date(startTime).toISOString() : new Date(startTime).getTime()
        break
      case '@EndTime':
        value = variableDateFormat === 'ISO'
          ? new Date(endTime).toISOString() : new Date(endTime).getTime()
        break
      default:
        value = queryParam.queryParamValue
    }
    queryParamsString += `${encodeURIComponent(queryParam.queryParamKey)}=${encodeURIComponent(value)}`
    if (index < queryParams.length - 1) {
      queryParamsString += '&'
    }
  })
  return queryParamsString
}

/**
 * Generate CSV file from the values.
 * @param {Object[]} results - The HTTP query result
 * @param {String} delimiter - The delimiter to use for the CSV
 * @returns {String} - The CSV content
 */
const generateCSV = (results, delimiter) => {
  const options = {
    header: true,
    delimiter,
  }
  return csv.unparse(results, options)
}

module.exports = { parsers, httpGetWithBody, formatQueryParams, generateCSV }
