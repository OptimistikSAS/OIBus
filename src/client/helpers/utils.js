import * as csv from 'fast-csv'
import timexe from 'timexe'

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

const parseCSV = async (csvContent, options = { headers: true, strictColumnHandling: true }) => new Promise((resolve, reject) => {
  const points = []
  csv
    .parseString(csvContent, options)
    .on('error', (error) => reject(error))
    .on('data', (csvObjects) => {
      points.push(csvObjects)
    })
    .on('end', () => {
      resolve(points)
    })
})

const createCSV = (array) => {
  const options = { headers: true }
  return csv.writeToString(array, options)
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

  if ((typeof obj === 'object') && (obj !== null)) {
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

  if ((typeof obj === 'object') && (obj !== null)) {
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

const nextTime = (value) => {
  if (value !== null && value.length) {
    const nextTimeData = timexe.nextTime(value)
    // check if timexe can interpret time
    if (nextTimeData.time > 0) {
      const localeString = new Date(nextTimeData.time * 1000).toLocaleString()
      const timeDate = `Next occurrence: ${localeString}`
      return timeDate
    }
  }
  return ''
}

export default { readFileContent, jsonCopy, parseCSV, createCSV, replaceValues, nextTime }
