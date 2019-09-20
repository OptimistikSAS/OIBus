const isValidName = (val, otherDataSources) => {
  let error = null
  otherDataSources.forEach((dataSource) => {
    if (dataSource === val) {
      error = 'Data source id already exists'
    }
  })
  if (!error) {
    error = (((typeof val === 'string' || val instanceof String) && val !== '') ? null : 'value must not be empty')
  }
  return error
}

const validation = { dataSourceId: isValidName }

export default validation
