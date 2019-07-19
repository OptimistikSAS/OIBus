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

const removeSubmitButtonFromForm = () => {
  const buttons = document.getElementsByClassName('btn-info')
  if (buttons.length) {
    buttons[buttons.length - 1].style.display = 'none'
  }
}

export default { dynamicSort, removeSubmitButtonFromForm }
