const dynamicSort = (property) => {
  let prop = property
  let sortOrder = 1
  if (prop[0] === '-') {
    sortOrder = -1
    prop = prop.substr(1)
  }
  return (a, b) => {
    let result
    if (a[prop] < b[prop]) {
      result = -1
    } else if (a[prop] > b[prop]) {
      result = 1
    } else {
      result = 0
    }
    return result * sortOrder
  }
}

export default { dynamicSort }
