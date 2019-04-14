const Api = {
  async handleResponse(response) {
    try {
      const json = await response.json()
      return json
    } catch (error) {
      console.error('Error parsing JSON', error)
    }
    return null
  },

  async getRequest(uri) {
    const response = await fetch(uri, { method: 'GET' })
    return Api.handleResponse(response)
  },
}

export default Api
