const handleResponse = async (response) => {
  try {
    const json = await response.json()
    return json
  } catch (error) {
    console.error('Error parsing JSON', error)
  }
  return null
}

const getRequest = async (uri) => {
  try {
    const response = await fetch(uri, { method: 'GET' })
    return handleResponse(response)
  } catch (error) {
    console.error('Request error', error)
    return new Error(error)
  }
}

const getSouthProtocols = () => getRequest('/config/schemas/south')
const getNorthApis = () => getRequest('/config/schemas/north')
const getConfig = () => getRequest('config')
const getSouthProtocolSchema = protocol => getRequest(`/config/schemas/south/${protocol}`)
const getNorthApiSchema = api => getRequest(`/config/schemas/north/${api}`)

export default { getSouthProtocols, getNorthApis, getConfig, getSouthProtocolSchema, getNorthApiSchema }
