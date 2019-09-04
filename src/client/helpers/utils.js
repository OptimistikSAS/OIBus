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

export default { dynamicSort, parseCSV }
