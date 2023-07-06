/**
 * Parse data from SLIMS Result table
 * @param {Object} httpResult - The data resulting of a SLIMS Result table API call
 * @return {{httpResults: Object[], latestDateRetrieved: Date}} - The formatted results flattened for easier access
 * (into csv files for example) and the latestDateRetrieved in ISO String format
 */
const format = (httpResult) => {
  if (!httpResult?.entities || !Array.isArray(httpResult.entities)) {
    throw new Error('Bad data: expect SLIMS values to be an array.')
  }
  const formattedData = []
  let latestDateRetrieved = new Date(0)
  httpResult.entities.forEach((element) => {
    const rsltCfPid = element.columns.find((column) => column.name === 'rslt_cf_pid')
    if (!rsltCfPid?.value) {
      throw new Error('Bad data: expect rslt_cf_pid to have a value.')
    }
    const testName = element.columns.find((column) => column.name === 'test_name')
    if (!testName?.value) {
      throw Error('Bad data: expect test_name to have a value.')
    }
    const rsltValue = element.columns.find((column) => column.name === 'rslt_value')
    if (!rsltValue || (rsltValue && rsltValue.value === null)) {
      throw new Error('Bad data: expect rslt_value to have a unit and a value.')
    }
    const rsltModifiedOn = element.columns.find((column) => column.name === 'rslt_modifiedOn')
    if (!rsltModifiedOn?.value) {
      throw new Error('Bad data: expect rslt_modifiedOn to have a value.')
    }
    const rsltCfSamplingDateAndTime = element.columns.find((column) => column.name === 'rslt_cf_samplingDateAndTime')
    if (!rsltCfSamplingDateAndTime?.value) {
      throw new Error('Bad data: expect rslt_cf_samplingDateAndTime to have a value.')
    }
    formattedData.push({
      pointId: `${rsltCfPid.value}-${testName.value}`,
      unit: rsltValue.unit || 'Ø',
      timestamp: new Date(rsltCfSamplingDateAndTime.value).toISOString(),
      value: rsltValue.value,
    })
    if (new Date(rsltModifiedOn.value) > latestDateRetrieved) {
      latestDateRetrieved = new Date(rsltModifiedOn.value)
    }
  })
  // increment the latest date retrieved to avoid loop in history query from slims
  return { httpResults: formattedData, latestDateRetrieved: new Date(latestDateRetrieved.getTime() + 1) }
}

export default format
