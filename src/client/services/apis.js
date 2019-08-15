const handleResponse = async (response) => {
  try {
    const json = await response.json()
    return json
  } catch (error) {
    console.error('Error parsing JSON', error)
  }
  return null
}

const createErrorMessage = (response) => (
  `${response.status}${response.statusText ? ` - ${response.statusText}` : ''}`
)

const getRequest = async (uri) => {
  try {
    const response = await fetch(uri, { method: 'GET' })
    if (response.status !== 200) {
      throw new Error(createErrorMessage(response))
    }
    return handleResponse(response)
  } catch (error) {
    console.error('Request error', error)
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
const getConfig = () => getRequest('config')
const updateConfig = (body) => putRequest('config', body)
const getActiveConfig = () => getRequest('config/active')
const updateActiveConfig = () => putRequest('/config/activate')
const resetModifiedConfig = () => putRequest('/config/reset')

const getLogs = (fromDate, toDate, verbosity) => getRequest(`logs?fromDate=${fromDate || ''}&toDate=${toDate || ''}&verbosity=[${verbosity}]`)
const getStatus = () => getRequest('status')

export default {
  getSouthProtocols,
  getNorthApis,
  getConfig,
  getActiveConfig,
  updateActiveConfig,
  resetModifiedConfig,
  updateConfig,
  getLogs,
  getStatus,
}
