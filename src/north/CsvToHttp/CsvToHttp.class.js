import fs from 'node:fs'

import Papa from 'papaparse'

import ApiHandler from '../ApiHandler.class.js'

const ERROR_PRINT_SIZE = 5
const REGEX_CONTAIN_VARIABLE_STRING = /\${[^}]*}/ // match if the string contains ${...}
const REGEX_SPLIT_TEMPLATE_STRING = /(\${[^}]*}|[^${^}*]*)/ // split the input into an array of string: "test ${value}" => [ "test ", ${value}]
const REGEX_MATCH_VARIABLE_STRING = /^\${[^}]*}$/ // match if the string starts with: ${...}
const REGEX_GET_VARIABLE = /[^${}]+/ // Get the value inside ${}

/**
 * Class CsvToHttp - convert a csv file into http request such as POST/PUT/PATCH
 */
export default class CsvToHttp extends ApiHandler {
  static category = 'API'

  /**
   * Constructor for CsvToHttp
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {BaseEngine} engine - The Engine
   * @return {void}
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)

    const {
      applicativeHostUrl, requestMethod, bodyMaxLength, acceptUnconvertedRows,
      authentication, csvDelimiter, mapping, proxy = null,
    } = applicationParameters.CsvToHttp

    // Creation of an entity request with is composed of all necessaries informations
    this.request = {
      host: applicativeHostUrl,
      method: requestMethod,
      authenticationField: authentication,
    }

    this.bodyMaxLength = bodyMaxLength
    this.acceptUnconvertedRows = acceptUnconvertedRows

    this.mapping = mapping || {}
    this.csvDelimiter = csvDelimiter
    this.proxy = this.getProxy(proxy)

    this.canHandleFiles = true
    this.canHandleValues = false
  }

  /**
   * Send the file.
   * @param {String} filePath - The path of the file
   * @return {Promise} - The status after sending a file
   */
  async handleFile(filePath) {
    // Verify that the file receive is a csv one
    const regexExp = /.csv$/

    if (!regexExp.test(filePath)) {
      this.logger.error(`Invalid file format (.csv file expected), file (${filePath} skipped`)
      return ApiHandler.STATUS.LOGIC_ERROR
    }

    const csvDataParsed = await this.parseCsvFile(filePath)

    if (csvDataParsed.length === 0) {
      this.logger.debug('The parsed file is empty')
      return ApiHandler.STATUS.LOGIC_ERROR
    }

    // The csv parsing is a success, so we begin to map the content
    // Initialize the body to an empty array
    const { httpBody, conversionErrorBuffer } = this.convertToHttpBody(csvDataParsed)

    if (httpBody.length !== 0) {
      if (!await this.sendData(httpBody)) {
        this.logger.error('Impossible to send data')
        return ApiHandler.STATUS.LOGIC_ERROR
      }
    }
    // Logs all the errors
    if (conversionErrorBuffer.length > 0) {
      this.logger.error(`${conversionErrorBuffer.length} conversions error`)

      if (conversionErrorBuffer.length > ERROR_PRINT_SIZE) {
        for (let i = 0; i < ERROR_PRINT_SIZE; i += 1) {
          this.logger.error(`${conversionErrorBuffer[i]}`)
        }
      } else {
        conversionErrorBuffer.forEach((error) => {
          this.logger.error(`${error}`)
        })
      }
    }
    return ApiHandler.STATUS.SUCCESS
  }

  /**
   * @param {string} filePath - Path of the file to parse
   * @return {Promise} - the parsed content of the file
   */
  parseCsvFile(filePath) {
    return new Promise((resolve, reject) => {
      // Initialize array which will be filled at each step
      const csvDataParsed = []
      const csvFile = fs.createReadStream(filePath)

      // Parse the csv file into a json object
      Papa.parse(csvFile, {
        delimiter: this.csvDelimiter,
        header: true,
        dynamicTyping: true,
        error: (error) => {
          this.logger.error(error)
          reject()
        },
        step: (step) => {
          csvDataParsed.push(step.data)
        },
        complete: () => {
          this.logger.trace(`File ${filePath} parsed`)
          this.updateStatusDataStream({
            'Last Parsed file': filePath,
            'Number of files sent since OIBus has started': this.statusData['Number of files sent since OIBus has started'] + 1,
            'Last Parsed file at': new Date().toISOString(),
          })
          resolve(csvDataParsed)
        },
      })
    })
  }

  /**
   * @param {Object} csvFileInJson - json object of the csv file
   * @return {Object} - the http body and associated errors
   */
  convertToHttpBody(csvFileInJson) {
    const httpBody = []
    // Reset the buffer for error
    const conversionErrorBuffer = []

    // Log all headers in the csv file and log the value ine the mapping not present in headers
    this.logger.trace(`All available headers are: ${Object.keys(csvFileInJson[0])}`)

    const onlyValidMappingValue = this.getOnlyValidMappingValue(csvFileInJson[0])

    // Start the mapping for each row
    csvFileInJson.forEach((csvRowInJson, index) => {
      const { value, error } = CsvToHttp.convertCSVRowIntoHttpBody(csvRowInJson, onlyValidMappingValue)

      // Test the result of the mapping/conversion before add it in the httpBody
      // Add if we accept error conversion or if everything is fine
      if ((!error && value) || (error && value && this.acceptUnconvertedRows)) {
        httpBody.push(value)
      }

      // Add all the errors caught into the buffer
      if (error) {
        error.forEach((err) => {
          conversionErrorBuffer.push(`Line ${index + 1} in csv file: ${err}`)
        })
      }
    })
    return { httpBody, conversionErrorBuffer }
  }

  /**
   * Get only the valid mapping fields
   * @param {object} allHeaders - available headers in the csvFile
   * @return {Array} - Return a bool
   */
  getOnlyValidMappingValue(allHeaders) {
    const onlyValidMappingValue = []
    this.mapping.forEach((mapping) => {
      if (!CsvToHttp.isHeaderValid(allHeaders, mapping.csvField)) {
        this.logger.warn(`The header: '${mapping.csvField}' is not present in the csv file`)
      } else {
        onlyValidMappingValue.push(mapping)
      }
    })
    return onlyValidMappingValue
  }

  /**
   * @param {Array} httpBody - Body to send
   * @return {Promise} - Promise
   */
  sendData(httpBody) {
    return new Promise((resolve, reject) => {
      try {
        if (httpBody.length > this.bodyMaxLength) {
          // Divide the current body in array of maximum maxLength elements
          let i = 0
          for (i; i < httpBody.length; i += this.bodyMaxLength) {
            this.sendRequest(httpBody.slice(i, i + this.bodyMaxLength - 1))
          }
        } else {
          this.sendRequest(httpBody)
        }
        resolve(true)
      } catch (error) {
        this.logger.error(error)
        reject()
      }
    })
  }

  /**
   * Send Request(s) to the selected host
   * @param {Array} body - Body to send
   * @return {void}
   */
  async sendRequest(body) {
    // Create a base header in order not to send a request with a file but a content
    const baseHeaders = { 'Content-Type': 'application/json' }
    try {
      await this.engine.requestService.httpSend(
        this.request.host,
        this.request.method,
        this.request.authenticationField,
        this.proxy,
        JSON.stringify(body),
        baseHeaders,
      )
    } catch (error) {
      this.logger.error(error)
    }
  }

  /**
   * Test if the field is valid thanks to all headers
   * @param {object} allHeaders - available headers in the csvFile
   * @param {object} field - field to test if it matches with the available headers
   * @return {Boolean} - Return a bool
   */
  static isHeaderValid(allHeaders, field) {
    if (field.match(REGEX_CONTAIN_VARIABLE_STRING)) {
      const csvFieldSplit = field.split(REGEX_SPLIT_TEMPLATE_STRING).filter(Boolean)
      return csvFieldSplit.every((element) => {
        if (element.match(REGEX_MATCH_VARIABLE_STRING)) {
          const headerToGet = element.match(REGEX_GET_VARIABLE)
          // The regex must match with only one value and return an array with one element
          if (headerToGet.length !== 1) {
            return false
          }
          // Check if the headerToGet is in the CSV file
          if (allHeaders[headerToGet[0]] !== undefined) {
            return true
          }
        }
        return true
      })
    }

    return allHeaders[field] !== undefined
  }

  /**
   * @param {Object} csvRowInJson - json object of a csv row
   * @param {Array} mappingValues - array of valid mapping field
   * @return {Object} - Object mapped for one row
   */
  static convertCSVRowIntoHttpBody(csvRowInJson, mappingValues) {
    const object = { value: {}, error: [] }

    mappingValues.forEach((mapping) => {
      if (!(csvRowInJson[mapping.csvField] === undefined)) {
        const field = mapping.httpField
        const response = CsvToHttp.convertToCorrectType(csvRowInJson[mapping.csvField], mapping.type)

        if (response.error) {
          object.error.push(`Header "${mapping.httpField}": ${response.error}`)
        }
        object.value[field] = response.value
      } else if (mapping.csvField.match(REGEX_CONTAIN_VARIABLE_STRING)) {
        // split the input into a array of string
        // "test ${value}" => [ "test ", ${value}]
        const csvFieldSplit = mapping.csvField.split(REGEX_SPLIT_TEMPLATE_STRING).filter(Boolean)
        const field = mapping.httpField
        csvFieldSplit.forEach((element) => {
          // match if the string starts with: ${...}
          if (element.match(REGEX_MATCH_VARIABLE_STRING)) {
            const headerToGet = element.match(REGEX_GET_VARIABLE)
            // The regex must match with only one value and return an array with one element
            if (headerToGet.length !== 1) {
              object.error.push(`Regex doesn't match only with one value (tried element: ${element})`)
            } else if (csvRowInJson[headerToGet[0]] !== undefined) {
              // Check if the headerToGet is in the CSV file
              const response = CsvToHttp.convertToCorrectType(csvRowInJson[headerToGet], 'string')
              if (response.error) {
                object.error.push(`Header "${mapping.httpField}": ${response.error}`)
              }
              if (response.value) {
                object.value[field] = CsvToHttp.insertValueInObject(object.value[field], response.value)
              }
            }
          } else {
            object.value[field] = CsvToHttp.insertValueInObject(object.value[field], element)
          }
        })
      }
    })

    return object
  }

  /**
   * It returns the concatenation of value with the previous object
   * If the object is empty it return the value sent
   * @param {object} currentJsonValue - currentJsonValue
   * @param {object} valueToAdd - valueToAdd
   * @return {object} - The converted value
   */
  static insertValueInObject(currentJsonValue, valueToAdd) {
    if (currentJsonValue) {
      return `${currentJsonValue}${valueToAdd}`
    }
    return valueToAdd
  }

  /**
   * Convert the value in the selected type (string by default)
   * @param {*} valueToConvert - valueToConvert
   * @param {string} type - type
   * @return {object} - The converted value
   */
  static convertToCorrectType(valueToConvert, type) {
    switch (type) {
      case 'integer':
        if (parseInt(valueToConvert, 10)) {
          return { value: parseInt(valueToConvert, 10) }
        }
        return { value: valueToConvert, error: `Fail To convert "${valueToConvert}" into ${type} ` }
      case 'float':
        if (parseFloat(valueToConvert)) {
          return { value: parseFloat(valueToConvert) }
        }
        return { value: valueToConvert, error: `Fail To convert ${valueToConvert} into ${type} ` }
      case 'timestamp':
        if (parseInt(valueToConvert, 10)) {
          return { value: parseInt(valueToConvert, 10) }
        }
        return { value: valueToConvert, error: `Fail To convert ${valueToConvert} into ${type}` }
      case 'date (ISO)': {
        if (valueToConvert !== null) {
          const valueConverted = new Date(valueToConvert)
          if (valueConverted.toString() !== 'Invalid Date') {
            return { value: valueConverted }
          }
        }
        return { value: valueToConvert, error: `Fail To convert ${valueToConvert} into ${type}` }
      }
      case 'short date (yyyy-mm-dd)': {
        if (valueToConvert !== null) {
          const valueConverted = new Date(valueToConvert)
          if (valueConverted.toString() !== 'Invalid Date') {
            const date = (`0${valueConverted.getDate()}`).slice(-2)
            const month = (`0${valueConverted.getMonth() + 1}`).slice(-2)
            const year = valueConverted.getFullYear()
            return { value: `${year}-${month}-${date}` }
          }
        }
        return { value: valueToConvert, error: `Fail To convert ${valueToConvert} into ${type}` }
      }
      default: return { value: valueToConvert }
    }
  }
}
