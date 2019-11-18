const dynamicSort = (property) => {
  let prop = property
  let sortOrder = 1
  if (prop[0] === '-') {
    sortOrder = -1
    prop = prop.substr(1)
  }
  return (a, b) => {
    let result
    const valueA = a[prop].toString()
    const valueB = b[prop].toString()
    if (valueA < valueB) {
      result = -1
    } else if (valueA > valueB) {
      result = 1
    } else {
      result = 0
    }
    return result * sortOrder
  }
}

function jsonCopy(src) {
  return JSON.parse(JSON.stringify(src))
}

const parseCSV = (csv, delimiter) => {
  const lines = csv.split('\n')
  const result = []
  const headers = lines[0].split(delimiter)

  for (let i = 1; i < lines.length; i += 1) {
    const obj = {}
    const currentline = lines[i].split(delimiter)
    for (let j = 0; j < headers.length; j += 1) {
      obj[headers[j]] = currentline[j]
    }
    result.push(obj)
  }
  return result
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

export default { dynamicSort, jsonCopy, parseCSV, replaceValues }
