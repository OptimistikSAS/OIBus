const host = 'http://localhost:2223'

const ApiConfig = {
  url: host,
  requests: {
    config: `${host}/config`,
    south: `${host}/config/schemas/south`,
    north: `${host}/config/schemas/north`,
  },
}

export default ApiConfig
