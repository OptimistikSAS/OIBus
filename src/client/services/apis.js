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

const downloadFileRequest = async (uri) => {
  const link = document.createElement('a')
  link.href = uri
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
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
    return response
  } catch (error) {
    throw new Error(error)
  }
}

const postTextRequest = async (uri, body) => {
  try {
    const response = await fetch(uri, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'text/plain',
      },
      body,
    })
    if (response.status !== 200) {
      throw new Error(createErrorMessage(response))
    }
    return handleResponse(response)
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

const deleteRequest = async (uri) => {
  try {
    const response = await fetch(`${uri}`, {
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

const getSouthProtocols = () => getRequest('/config/schemas/south')
const getNorthApis = () => getRequest('/config/schemas/north')
const getConfig = () => getRequest('config')
const getActiveConfig = () => getRequest('config/active')
const updateActiveConfig = () => putRequest('/config/activate')
const resetModifiedConfig = () => putRequest('/config/reset')
const getSouthProtocolSchema = (protocol) => getRequest(`/config/schemas/south/${protocol}`)
const getNorthApiSchema = (api) => getRequest(`/config/schemas/north/${api}`)
const addNorth = (body) => postRequest('/config/north', body)
const updateNorth = (applicationId, body) => putRequest(`/config/north/${applicationId}`, body)
const deleteNorth = (applicationId) => deleteRequest(`/config/north/${applicationId}`)
const addSouth = (body) => postRequest('/config/south', body)
const updateSouth = (dataSourceId, body) => putRequest(`/config/south/${dataSourceId}`, body)
const deleteSouth = (dataSourceId) => deleteRequest(`/config/south/${dataSourceId}`)
const updateEngine = (body) => putRequest('/config/engine', body)
const getLogs = (fromDate, toDate, verbosity) => getRequest(`logs?fromDate=${fromDate || ''}&toDate=${toDate || ''}&verbosity=[${verbosity}]`)
const getPoints = (dataSourceId) => getRequest(`/config/south/${dataSourceId}/points`)
const addPoint = (dataSourceId, body) => postRequest(`/config/south/${dataSourceId}/points`, body)
const updatePoint = (dataSourceId, pointId, body) => putRequest(`/config/south/${dataSourceId}/points/${encodeURIComponent(pointId)}`, body)
const deletePoint = (dataSourceId, pointId) => deleteRequest(`/config/south/${dataSourceId}/points/${encodeURIComponent(pointId)}`)
const deleteAllPoints = (dataSourceId) => deleteRequest(`/config/south/${dataSourceId}/points`)
const exportAllPoints = (dataSourceId) => downloadFileRequest(`/config/south/${dataSourceId}/points/export`)
const importPoints = (dataSourceId, body) => postTextRequest(`/config/south/${dataSourceId}/points/import`, body)
const getStatus = () => getRequest('status')

export default {
  getSouthProtocols,
  getNorthApis,
  getConfig,
  getActiveConfig,
  updateActiveConfig,
  resetModifiedConfig,
  getSouthProtocolSchema,
  getNorthApiSchema,
  addNorth,
  updateNorth,
  deleteNorth,
  addSouth,
  updateSouth,
  deleteSouth,
  updateEngine,
  getLogs,
  getPoints,
  addPoint,
  updatePoint,
  deletePoint,
  deleteAllPoints,
  exportAllPoints,
  importPoints,
  getStatus,
}
