const Papa = require('papaparse')
const fs = require('fs')

const ApiHandler = require('../ApiHandler.class')

const ERROR_PRINT_SIZE = 5
/**
 * Class CsvToHttp - convert a csv file into http request such as POST/PUT/PACTH
 */
class CsvToHttp extends ApiHandler {
  /**
   * Constructor for CsvToHttp
   * @constructor
   * @param {Object} applicationParameters - The application parameters
   * @param {Engine} engine - The Engine
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
   * @return {Promise} - The send status
   */
  async handleFile(filePath) {
    // Verify that the file receive is a csv one
    const regexExp = RegExp('.csv$')

    if (!regexExp.test(filePath)) {
      this.logger.error(`Invalid file format (.csv file expected), file (${filePath} skipped`)
      return ApiHandler.STATUS.LOGIC_ERROR
    }

    const csvDataParsed = await this.parseCsvFile(filePath)

    if (csvDataParsed.length === 0) {
      this.logger.debug('The parsed file is empty')
      return ApiHandler.STATUS.LOGIC_ERROR
    }

    // The csv parsing is a success so we begin to map the content
    // Initialize the body to an empty array
    const { httpBody, convertionErrorBuffer } = this.convertToHttpBody(csvDataParsed)

    if (httpBody.length !== 0) {
      if (!await this.sendData(httpBody)) {
        this.logger.error('Impossible to send data')
        return ApiHandler.STATUS.LOGIC_ERROR
      }
    }
    console.log('there')
    // Logs all the erros
    if (convertionErrorBuffer.length > 0) {
      this.logger.error(`${convertionErrorBuffer.length} convertions error`)

      if (convertionErrorBuffer.length > ERROR_PRINT_SIZE) {
        for (let i = 0; i < ERROR_PRINT_SIZE; i += 1) {
          this.logger.error(`${convertionErrorBuffer[i]}`)
        }
      } else {
        convertionErrorBuffer.forEach((error) => {
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
      // Initialize array wich will be filled at each step
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
          this.logger.silly(`File ${filePath} parsed`)
          resolve(csvDataParsed)
        },
      })
    })
  }

  /**
   * @param {Object} csvFileInJson - json object of the csv file
   * @return {void}
   */
  convertToHttpBody(csvFileInJson) {
    const httpBody = []
    // Reset the buffer for error
    const convertionErrorBuffer = []

    // Log all headers in the csv file and log the value ine the mapping not present in headers
    this.logger.silly(`All available headers are: ${Object.keys(csvFileInJson[0])}`)

    this.mapping.forEach((mapping) => {
      if (csvFileInJson[0][mapping.csvField] === undefined) {
        this.logger.warn(`The header: '${mapping.csvField}' is not present in the csv file`)
      }
    })

    // Start the mapping for each row
    csvFileInJson.forEach((csvRowInJson, index) => {
      const { value, error } = this.convertCSVRowIntoHttpBody(csvRowInJson)

      // Test the result of the mapping/convertion before add it in the httpBody
      // Add if we accept error convertion or if everything is fine
      if ((!error && value) || (error && value && this.acceptUnconvertedRows)) {
        httpBody.push(value)
      }

      // Add all the errors catched into the buffer
      if (error) {
        error.forEach((err) => {
          convertionErrorBuffer.push(`Line ${index + 1} in csv file: ${err}`)
        })
      }
    })
    return { httpBody, convertionErrorBuffer }
  }

  /**
   * @param {Object} csvRowInJson - json object of a csv row
   * @return {Object} - Object mapped for one row
   */
  convertCSVRowIntoHttpBody(csvRowInJson) {
    const object = { value: {}, error: [] }

    this.mapping.forEach((mapping) => {
      if (!(csvRowInJson[mapping.csvField] === undefined)) {
        const field = mapping.httpField
        const response = CsvToHttp.convertToCorrectType(csvRowInJson[mapping.csvField], mapping.type)

        if (response.error) {
          object.error.push(`Header "${mapping.httpField}": ${response.error}`)
        }
        object.value[field] = response.value
      }
    })

    return object
  }

  /**
   * Convert the value in the selected type (string by default)
   * @param {Mixed} valueToConvert - valueToConvert
   * @param {string} type - type
   * @return {Mixed} - The converted value
   */
  static convertToCorrectType(valueToConvert, type) {
    switch (type) {
      case 'integer':
        if (parseInt(valueToConvert, 10)) {
          return { value: parseInt(valueToConvert, 10) }
        }
        return { value: valueToConvert, error: `Fail To convert "${valueToConvert}" into ${type} ` }
      case 'float':
        if (parseFloat(valueToConvert, 10)) {
          return { value: parseFloat(valueToConvert, 10) }
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

  /**
   * @param {Array} httpBody - Body to send
   * @return {Promise} - Promise
   */
  sendData(httpBody) {
    return new Promise((resolve, reject) => {
      try {
        if (httpBody.length > this.bodyMaxLength) {
          // Divide the current body in array of maximun maxLength elements
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
      await this.engine.sendRequest(this.request.host, this.request.method, this.request.authenticationField, this.proxy, JSON.stringify(body),
        baseHeaders)
    } catch (error) {
      this.logger.error(error)
    }
  }
}

module.exports = CsvToHttp
