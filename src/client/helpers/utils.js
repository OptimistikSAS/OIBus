import * as csv from 'fast-csv'

function jsonCopy(src) {
  return JSON.parse(JSON.stringify(src))
}

const parseCSV = async (csvContent) => new Promise((resolve, reject) => {
  const points = []
  const options = {
    headers: true,
    strictColumnHandling: true,
  }
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
      // replaceValuesDiffHelper(obj[i], keys, value)
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

export default { jsonCopy, parseCSV, createCSV, replaceValues }
