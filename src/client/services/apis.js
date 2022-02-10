const createErrorMessage = (response) => (
  `${response.status}${response.statusText ? ` - ${response.statusText}` : ''}`
)

const getRequest = async (uri) => {
  let text = ''
  try {
    const response = await fetch(uri, { method: 'GET' })
    if (response.status !== 200) {
      throw new Error(createErrorMessage(response))
    }
    text = await response.text()
    return JSON.parse(text)
  } catch (error) {
    console.error(`Request error for ${uri}:${error}`, text)
    throw new Error(error)
  }
}

const putRequest = async (uri, body) => {
  try {
    const response = await fetch(uri, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (response.status !== 200) {
      throw new Error(createErrorMessage(response))
    }
    return response
  } catch (error) {
    throw new Error(error)
  }
}

const getSouthProtocols = () => getRequest('/config/schemas/south')
const getNorthApis = () => getRequest('/config/schemas/north')
const getConfig = () => getRequest('/config')
const updateConfig = (body) => putRequest('/config', body)
const activateConfig = () => putRequest('/config/activate')

const getHistoryConfig = () => getRequest('/history-query/config')
const updateHistoryConfig = (body) => putRequest('/history-query/config', body)
const activateHistoryConfig = () => putRequest('/history-query/config/activate')
const getLastCompletedForHistoryQuery = async (id) => getRequest(`/history-query/${id}/status`)

const getLogs = (fromDate, toDate, verbosity) => getRequest(`/logs?fromDate=${fromDate || ''}&toDate=${toDate || ''}&verbosity=[${verbosity}]`)
const getStatus = () => getRequest('/status')
const getSouthStatus = (id) => getRequest(`/status/south/${id}`)
const getNorthStatus = (id) => getRequest(`/status/north/${id}`)

const reload = () => getRequest('/reload')
const shutdown = () => getRequest('/shutdown')

export default {
  getSouthProtocols,
  getNorthApis,
  getConfig,
  activateConfig,
  updateConfig,
  getHistoryConfig,
  updateHistoryConfig,
  activateHistoryConfig,
  getLastCompletedForHistoryQuery,
  getLogs,
  getStatus,
  getSouthStatus,
  getNorthStatus,
  reload,
  shutdown,
}
