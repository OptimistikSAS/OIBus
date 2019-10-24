const LOG_SOURCE = 'migration'

module.exports = {
  2: (config) => {
    config.south.dataSources.forEach((dataSource) => {
      if (dataSource.protocol === 'RawFile') {
        logger.info('Rename RawFile to FolderScanner', LOG_SOURCE)
        dataSource.protocol = 'FolderScanner'
        if (Object.prototype.hasOwnProperty.call(dataSource, 'RawFile')) {
          dataSource.FolderScanner = dataSource.RawFile
          delete dataSource.RawFile
        }
      }

      if (dataSource.protocol === 'SQLFile') {
        logger.info('Rename SQLFile to SQLDbToFile', LOG_SOURCE)
        dataSource.protocol = 'SQLDbToFile'
        if (Object.prototype.hasOwnProperty.call(dataSource, 'SQLFile')) {
          dataSource.SQLDbToFile = dataSource.SQLFile
          delete dataSource.SQLFile
        }
      }
    })

    config.north.applications.forEach((application) => {
      if (application.api === 'Link') {
        logger.info('Rename Link to OIConnect', LOG_SOURCE)
        application.api = 'OIConnect'
        if (Object.prototype.hasOwnProperty.call(application, 'Link')) {
          application.OIConnect = application.Link
          delete application.Link
        }
      }

      if (application.api === 'RawFileSender') {
        logger.info('Rename RawFileSender to OIAnalyticsFile', LOG_SOURCE)
        application.api = 'OIAnalyticsFile'
        if (Object.prototype.hasOwnProperty.call(application, 'RawFileSender')) {
          application.OIAnalyticsFile = application.RawFileSender
          delete application.RawFileSender
        }
      }
    })

    logger.info('Move protocol dependent parameters under a sub object of the protocol', LOG_SOURCE)
    const engineRelatedDataSourceFields = ['dataSourceId', 'enabled', 'protocol', 'scanMode', 'points', 'scanGroups']
    config.south.dataSources.forEach((dataSource) => {
      if (!Object.prototype.hasOwnProperty.call(dataSource, dataSource.protocol)) {
        const dataSourceRelatedFields = {}
        Object.entries(dataSource).forEach(([key, value]) => {
          if (!engineRelatedDataSourceFields.includes(key)) {
            dataSourceRelatedFields[key] = value
            delete dataSource[key]
          }
        })
        dataSource[dataSource.protocol] = dataSourceRelatedFields
      }
    })

    logger.info('Move api dependent parameters under a sub object of the api', LOG_SOURCE)
    const engineRelatedApplicationFields = ['applicationId', 'enabled', 'api', 'caching', 'subscribedTo']
    config.north.applications.forEach((application) => {
      if (!Object.prototype.hasOwnProperty.call(application, application.api)) {
        const applicationRelatedFields = {}
        Object.entries(application).forEach(([key, value]) => {
          if (!engineRelatedApplicationFields.includes(key)) {
            applicationRelatedFields[key] = value
            delete application[key]
          }
        })
        application[application.api] = applicationRelatedFields
      }
    })
  },
}
