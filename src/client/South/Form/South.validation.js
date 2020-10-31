import objectPath from 'object-path'

const validation = {
  protocol: {
    isValidName: (val, excludedList) => {
      let error = null
      if (excludedList.includes(val)) {
        error = 'Id already exists'
      }
      if (!error) {
        error = (((typeof val === 'string' || val instanceof String) && val !== '') ? null : 'value must not be empty')
      }
      return error
    },
  },
  scanMode: {
    isSelectedOnce: (val, name, config) => {
      const path = `${name.substr(0, name.indexOf('scanGroups'))}scanGroups`
      const existingScanGroups = objectPath.get(config, path)
      let error = null
      if (Array.isArray(existingScanGroups)) {
        const excludedList = existingScanGroups.map((scanGroup) => scanGroup.scanMode).filter((scanMode) => scanMode !== '')
        const currentIndex = excludedList.findIndex((e) => e === val)
        excludedList.splice(currentIndex, 1)
        if (excludedList.includes(val)) {
          error = 'Scan mode already selected'
        }
      }
      return error
    },
  },
}

export default validation
