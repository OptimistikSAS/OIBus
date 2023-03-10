/**
 * Retrieve the number of Words in Modbus associated to each data type
 * @param {String} dataType - The data type in the buffer
 * @returns {Number} - The number of words to request
 */
const getNumberOfWords = (dataType) => {
  if (['Int16', 'UInt16'].includes(dataType)) {
    return 1
  } if (['UInt32', 'Int32', 'Float'].includes(dataType)) {
    return 2
  } if (['BigUInt64', 'BigInt64', 'Double'].includes(dataType)) {
    return 4
  }
  return 1
}

export default getNumberOfWords
