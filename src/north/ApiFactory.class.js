const apiList = {}
apiList.Console = require('./console/Console.class')
apiList.InfluxDB = require('./influxdb/InfluxDB.class')
apiList.TimescaleDB = require('./timescaledb/TimescaleDB.class')
apiList.OIAnalytics = require('./oianalytics/OIAnalytics.class')
apiList.AmazonS3 = require('./amazon/AmazonS3.class')
apiList.OIConnect = require('./oiconnect/OIConnect.class')
apiList.MongoDB = require('./mongodb/MongoDB.class')
apiList.MQTTNorth = require('./mqttnorth/MQTTNorth.class')
apiList.WATSYConnect = require('./watsyconnect/WATSYConnect.class')
apiList.CsvToHttp = require('./CsvToHttp/CsvToHttp.class')
apiList.FileWriter = require('./filewriter/FileWriter.class')

/**
 * Class ApiFactory: to initiate North instance
 */
class ApiFactory {
  /**
   * Return the South class
   *
   * @param {string} api - The api
   * @param {object} application - The application
   * @param {BaseEngine} engine - The engine
   * @returns {ProtocolHandler|null} - The South
   */
  static create(api, application, engine) {
    const NorthHandler = apiList[api]
    if (NorthHandler) {
      return new NorthHandler(application, engine)
    }
    return null
  }

  /**
   * Return available North applications
   * @return {String[]} - Available North applications
   */
  static getNorthList() {
    return Object.keys(apiList)
  }
}

module.exports = ApiFactory
