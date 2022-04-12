/**
 * Parse data from SLIMS Result table
 * @param {object} httpResult - the data resulting of a SLIMS Result table API call
 * @return {{httpResults: *[], latestDateRetrieved: string}} - the formatted results flattened for easier access
 * (into csv files for example) and the latestDateRetrieved in ISO String format
 */
const format = (httpResult) => {
  if (!httpResult?.entities || !Array.isArray(httpResult.entities)) {
    throw Error('Bad data: expect OIAnalytics time values to be an array')
  }
  const formattedData = []
  let latestDateRetrieved = new Date(0)
  httpResult.entities.forEach((element) => {
    const rsltCfPid = element.columns.find((column) => column.name === 'rslt_cf_pid')
    if (!rsltCfPid?.value) {
      throw Error('Bad data: expect rslt_cf_pid to have a value')
    }
    const testName = element.columns.find((column) => column.name === 'test_name')
    if (!rsltCfPid?.value) {
      throw Error('Bad data: expect test_name to have a value')
    }
    const rsltValue = element.columns.find((column) => column.name === 'rslt_value')
    if (rsltValue && rsltValue.value === null) {
      throw Error('Bad data: expect rslt_value to have a unit and a value')
    }
    const rsltCfSamplingDateAndTime = element.columns.find((column) => column.name === 'rslt_cf_samplingDateAndTime')
    if (!rsltCfSamplingDateAndTime?.value) {
      throw Error('Bad data: expect rslt_cf_samplingDateAndTime to have a value')
    }
    formattedData.push({
      pointId: `${rsltCfPid.value}-${testName.value}`,
      unit: rsltValue.unit,
      timestamp: new Date(rsltCfSamplingDateAndTime.value).toISOString(),
      value: rsltValue.value,
    })
    if (new Date(rsltCfSamplingDateAndTime.value) > latestDateRetrieved) {
      latestDateRetrieved = new Date(rsltCfSamplingDateAndTime.value)
    }
  })
  return { httpResults: formattedData, latestDateRetrieved: latestDateRetrieved.toISOString() }
}

module.exports = format
