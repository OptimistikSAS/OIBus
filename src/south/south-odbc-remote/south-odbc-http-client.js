import fetch from 'node-fetch'

export default class SouthOdbcHttpClient {
  /**
     * Create SouthOdbcHttpClient
     * @param {String} id - The id of the connector
     * @param {String} url - The url to connect to the remote agent
     * @param {Object} logger - The logger to use, associated to the South Odbc remote Connector
     */
  constructor(id, url, logger) {
    this.id = id
    this.url = url
    this.logger = logger
  }

  async connect(connectionString, connectionTimeout) {
    const fetchOptions = {
      method: 'PUT',
      body: JSON.stringify({
        connectionString,
        connectionTimeout,
      }),
      headers: {},
    }
    fetchOptions.headers['Content-Type'] = 'application/json'
    return fetch(`${this.url}/api/odbc/${this.id}/connect`, fetchOptions)
  }

  async status() {
    const fetchOptions = { method: 'GET' }
    return fetch(`${this.url}/api/odbc/${this.id}/status`, fetchOptions)
  }

  async read(
    connectionString,
    sql,
    readTimeout,
    timeColumn,
    datasourceTimestampFormat,
    datasourceTimezone,
    delimiter,
    outputTimestampFormat,
    outputTimezone,
  ) {
    const fetchOptions = {
      method: 'PUT',
      body: JSON.stringify({
        connectionString,
        sql,
        readTimeout,
        timeColumn,
        datasourceTimestampFormat,
        datasourceTimezone,
        delimiter,
        outputTimestampFormat,
        outputTimezone,
      }),
      headers: {},
    }
    fetchOptions.headers['Content-Type'] = 'application/json'
    return fetch(`${this.url}/api/odbc/${this.id}/read`, fetchOptions)
  }

  async disconnect() {
    const fetchOptions = { method: 'DELETE' }
    return fetch(`${this.url}/api/odbc/${this.id}/disconnect`, fetchOptions)
  }
}
