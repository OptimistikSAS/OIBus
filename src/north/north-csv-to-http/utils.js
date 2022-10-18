const REGEX_CONTAIN_VARIABLE_STRING = /\${[^}]*}/ // match if the string contains ${...}
const REGEX_SPLIT_TEMPLATE_STRING = /(\${[^}]*}|[^${^}*]*)/ // split the input into an array of string: "test ${value}" => [ "test ", ${value}]
const REGEX_MATCH_VARIABLE_STRING = /^\${[^}]*}$/ // match if the string starts with: ${...}
const REGEX_GET_VARIABLE = /[^${}]+/ // Get the value inside ${}

/**
 * Test if the field is valid thanks to all headers
 * @param {Object} allHeaders - Available headers in the CSV file
 * @param {Object} field - Field to test if it matches with the available headers
 * @return {Boolean} - Return a bool
 */
const isHeaderValid = (allHeaders, field) => {
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
 * It returns the concatenation of value with the previous object
 * If the object is empty it return the value sent
 * @param {Object} currentJsonValue - currentJsonValue
 * @param {Object} valueToAdd - valueToAdd
 * @return {Object} - The converted value
 */
const insertValueInObject = (currentJsonValue, valueToAdd) => {
  if (currentJsonValue) {
    return `${currentJsonValue}${valueToAdd}`
  }
  return valueToAdd
}

/**
 * Convert the value in the selected type (string by default)
 * @param {Object} valueToConvert - valueToConvert
 * @param {String} type - type
 * @return {Object} - The converted value
 */
const convertToCorrectType = (valueToConvert, type) => {
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

/**
 * @param {Object} csvRowInJson - JSON object of a CSV row
 * @param {Object[]} mappingValues - Array of valid mapping field
 * @return {Object} - Object mapped for one row
 */
const convertCSVRowIntoHttpBody = (csvRowInJson, mappingValues) => {
  const object = { value: {}, error: [] }

  mappingValues.forEach((mapping) => {
    if (!(csvRowInJson[mapping.csvField] === undefined)) {
      const field = mapping.httpField
      const response = convertToCorrectType(csvRowInJson[mapping.csvField], mapping.type)

      if (response.error) {
        object.error.push(`Header "${mapping.httpField}": ${response.error}`)
      }
      object.value[field] = response.value
    } else if (mapping.csvField.match(REGEX_CONTAIN_VARIABLE_STRING)) {
      // split the input into an array of string
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
            const response = convertToCorrectType(csvRowInJson[headerToGet], 'string')
            if (response.error) {
              object.error.push(`Header "${mapping.httpField}": ${response.error}`)
            }
            if (response.value) {
              object.value[field] = insertValueInObject(object.value[field], response.value)
            }
          }
        } else {
          object.value[field] = insertValueInObject(object.value[field], element)
        }
      })
    }
  })

  return object
}

module.exports = { convertCSVRowIntoHttpBody, isHeaderValid }
