import type from '../../helpers/validation'

const isValidName = (val, otherApplications) => {
  let error = null
  otherApplications.forEach((application) => {
    if (application === val) {
      error = 'Application id already exists'
    }
  })
  if (!error) {
    error = (((typeof val === 'string' || val instanceof String) && val !== '') ? null : 'value must not be empty')
  }
  return error
}

const validation = {
  applicationId: isValidName,
  caching: {
    sendInterval: type.number,
    retryInterval: type.number,
    groupCount: type.number,
    maxSendCount: type.number,
  },
}

export default validation
