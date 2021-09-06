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

const getLogs = (fromDate, toDate, verbosity) => getRequest(`/logs?fromDate=${fromDate || ''}&toDate=${toDate || ''}&verbosity=[${verbosity}]`)
const getStatus = () => getRequest('/status')
const getSouthStatus = (id) => getRequest(`/status/south/${id}`)

const reload = () => getRequest('/reload')
const shutdown = () => getRequest('/shutdown')

export default {
  getSouthProtocols,
  getNorthApis,
  getConfig,
  activateConfig,
  updateConfig,
  getLogs,
  getStatus,
  getSouthStatus,
  reload,
  shutdown,
}
