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
}

export default validation
