const validation = {
  caching: {
    sendInterval: (val) => (val >= 1000 ? null : 'Send interval should be greater or equal to 1000'),
    retryInterval: (val) => (val >= 1000 ? null : 'Retry interval should be greater or equal to 1000'),
    groupCount: (val) => (val > 0 ? null : 'Group count should be greater than 0'),
    maxSendCount: (val) => (val > 0 ? null : 'Max group count should be greater than 0'),
  },
  application: {
    isValidName: (val, excludedList) => {
      let error = null
      if (excludedList.includes(val)) {
        error = 'Name already exists'
      }
      if (!error) {
        error = (((typeof val === 'string' || val instanceof String)) ? null : 'value must not be empty')
      }
      return error
    },
  },
}

export default validation
