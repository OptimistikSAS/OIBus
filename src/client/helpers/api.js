const HOST = ''

const log = type => console.warn.bind(console, type)

const Api = {
  async handleResponse(response) {
    try {
      const json = await response.json()
      return json
    } catch (error) {
      log('Error parsing JSON', error)
    }

    return null
  },

  async getRequest(uri) {
    const response = await fetch(HOST + uri, { method: 'GET' })
    return Api.handleResponse(response)
  },
}

export default Api
