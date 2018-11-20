const fetch = require('node-fetch')
const ApiHandler = require('../ApiHandler.class')

/**
 * Class InfluxDB : generates and sends InfluxDB requests
 */
class InfluxDB extends ApiHandler {
  /**
   * @constructor for InfluxDB
   * @param {Object} engine
   */
  constructor(applicationParameters, engine) {
    super(applicationParameters, engine)
    this.host = applicationParameters.InfluxDB.host
    this.currentObject = {}
    this.start()
  }

  /**
   * Makes a request for every entry revceived from the event.
   * @return {void}
   */
  onUpdate(value) {
    this.makeRequest(value)
  }

  /**
   * Makes an InfluxDB request with the parameters in the Object arg.
   * @param {Object} entry : the entry from the event
   * @return {void}
   */
  makeRequest(entry) {
    const { host, user, password, db } = this.application.InfluxDB
    const { pointId, data, timestamp } = entry
    console.log('Auth succeeded!!')
    const url = `http://${host}/write?u=${user}&p=${password}&db=${db}`
    const measurement = 'temperature'
    let fields
    // The data received from MQTT is type of string, so we need to transform is to Json
    const dataJson = JSON.parse(data)
    Object.entries(dataJson).forEach(([fieldKey, fieldValue]) => {
      if (fields) fields = `${fields},${fieldKey}=${fieldValue}`
      else fields = `${fieldKey}=${fieldValue}`
    })
    const body = `${measurement} ${fields} ${timestamp.getTime()}`
    fetch(url, {
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    })
  }
}

module.exports = InfluxDB
