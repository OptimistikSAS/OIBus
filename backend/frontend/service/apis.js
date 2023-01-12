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

const postRequest = async (uri, body) => {
  try {
    const response = await fetch(uri, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (response.status !== 200) {
      throw new Error(createErrorMessage(response))
    }
    return JSON.parse(await response.text())
  } catch (error) {
    throw new Error(error)
  }
}

const deleteRequest = async (uri) => {
  try {
    const response = await fetch(uri, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })
    if (response.status !== 200) {
      throw new Error(createErrorMessage(response))
    }
    return response
  } catch (error) {
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

const getConfig = () => getRequest('/config')
const updateConfig = (body) => putRequest('/config', body)
const activateConfig = () => putRequest('/config/activate')

const createHistoryQuery = async (body) => postRequest('/history-queries', body)
const getHistoryQueries = async () => getRequest('/history-queries')
const getHistoryQueryById = async (id) => getRequest(`/history-queries/${id}`)
const updateHistoryQuery = async (id, body) => putRequest(`/history-queries/${id}`, body)
const enableHistoryQuery = async (id, body) => putRequest(`/history-queries/${id}/enable`, body)
const orderHistoryQuery = async (id, body) => putRequest(`/history-queries/${id}/order`, body)
const deleteHistoryQuery = async (id, position) => deleteRequest(`/history-queries/${id}?position=${position}`)
const getLastCompletedForHistoryQuery = async (id) => getRequest(`/history-queries/${id}/status`)

const getLogs = (fromDate, toDate, verbosity) => getRequest(`/logs?fromDate=${fromDate || ''}&toDate=${toDate || ''}&verbosity=[${verbosity}]`)
const getOIBusInfo = () => getRequest('/info')
const getSouthTypes = () => getRequest('/legacy/installed-south')
const getNorthTypes = () => getRequest('/legacy/installed-north')
const getSouth = async (id) => getRequest(`/legacy/south/${id}`)
const getNorth = async (id) => getRequest(`/legacy/north/${id}`)
const getSouthStatus = (id) => getRequest(`/south/${id}/status`)
const getNorthStatus = (id) => getRequest(`/north/${id}/status`)
const reload = () => getRequest('/reload')
const shutdown = () => getRequest('/shutdown')

export default {
  getSouthTypes,
  getNorthTypes,
  getConfig,
  activateConfig,
  updateConfig,
  getHistoryQueries,
  getHistoryQueryById,
  createHistoryQuery,
  updateHistoryQuery,
  enableHistoryQuery,
  orderHistoryQuery,
  deleteHistoryQuery,
  getLastCompletedForHistoryQuery,
  getLogs,
  getOIBusInfo,
  getSouthStatus,
  getSouth,
  getNorthStatus,
  getNorth,
  reload,
  shutdown,
}
