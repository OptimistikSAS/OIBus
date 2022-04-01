import * as Papa from 'papaparse'
import timexe from 'timexe'

const formatValue = (value) => {
  if (typeof value === 'string') {
    if (Number.isNaN(Date.parse(value))) {
      return value
    }
    return new Date(value).toLocaleString()
  }
  return value
}

const readFileContent = async (file) => new Promise((resolve) => {
  const reader = new FileReader()
  reader.readAsText(file)
  reader.onload = () => {
    resolve(reader.result)
  }
})

function jsonCopy(src) {
  return JSON.parse(JSON.stringify(src))
}

const parseCSV = async (csvContent, options = { header: true }) => new Promise((resolve, reject) => {
  const result = Papa.parse(csvContent, options)
  const { data, errors } = result
  if (errors.length) {
    reject(errors[0])
  } else resolve(data)
})

const createCSV = (array) => {
  const options = { header: true }
  return Papa.unparse(array, options)
}

const replaceValuesHelper = (obj, keys, value) => {
  if (!obj) return
  if (obj instanceof Array) {
    obj.forEach((e) => {
      replaceValuesHelper(e, keys, value)
    })
    return
  }
  keys.forEach((key) => {
    if (obj[key]) obj[key] = value
  })

  if (typeof obj === 'object') {
    const children = Object.keys(obj)
    if (children.length > 0) {
      for (let i = 0; i < children.length; i += 1) {
        replaceValuesHelper(obj[children[i]], keys, value)
      }
    }
  }
}

const replaceValuesDiffHelper = (obj, keys, value) => {
  if (!obj) return
  if (obj instanceof Array) {
    obj.forEach((i) => {
      if (typeof obj[i] === 'string' || obj[i] instanceof String) {
        replaceValuesDiffHelper(obj[i], keys, value)
      } else {
        replaceValuesHelper(i, keys, value)
      }
    })
    return
  }
  keys.forEach((key) => {
    if (obj[key]) obj[key] = [value, value]
  })

  if (typeof obj === 'object') {
    const children = Object.keys(obj)
    if (children.length > 0) {
      for (let i = 0; i < children.length; i += 1) {
        replaceValuesDiffHelper(obj[children[i]], keys, value)
      }
    }
  }
}

const replaceValues = (obj, keys, value, isDiff = false) => {
  if (isDiff) {
    replaceValuesDiffHelper(obj, keys, value)
  } else {
    replaceValuesHelper(obj, keys, value)
  }
}

const convertMillisecToReadable = (millisec) => {
  const seconds = (millisec / 1000).toFixed(1)
  const minutes = (millisec / (1000 * 60)).toFixed(1)
  const hours = (millisec / (1000 * 60 * 60)).toFixed(1)
  const days = (millisec / (1000 * 60 * 60 * 24)).toFixed(1)

  if (millisec < 1000) {
    return `${millisec} Milliseconds`
  }
  if (seconds < 60) {
    return `${seconds} Seconds`
  }
  if (minutes < 60) {
    return `${minutes} Minutes`
  }
  if (hours < 24) {
    return `${hours} Hours`
  }
  return `${days} Days`
}

const nextTime = (value) => {
  if (value !== null && value.length) {
    const nextTimeData = timexe.nextTime(value)
    const nextTimestamp = nextTimeData.time * 1000
    const currentTimestamp = Date.now()
    // check if timexe can interpret time
    const diff = nextTimestamp - currentTimestamp
    if (nextTimeData.time > 0 && diff > 0) {
      const nextDate = new Date(nextTimestamp)
      const localeString = nextDate.toLocaleString()
      return `Next occurrence in: ${convertMillisecToReadable(diff)} at: ${localeString}`
    }
  }
  return ''
}

export default { readFileContent, jsonCopy, parseCSV, createCSV, replaceValues, nextTime, formatValue }
