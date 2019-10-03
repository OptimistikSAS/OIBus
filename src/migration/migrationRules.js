/*
 * An example entry how to migrate to version 2
 *
 * 2: (config) => {
 *   // Rename logFilename => filename
 *   console.info('config.engine.logParameters.logFilename => config.engine.logParameters.filename')
 *   config.engine.logParameters.filename = config.engine.logParameters.logFilename
 *   delete config.engine.logParameters.logFilename
 *
 *   // Rename FolderScanner => RawFile
 *   console.info('FolderScanner => RawFile')
 *   config.south.dataSources.forEach((dataSource) => {
 *     if (dataSource.protocol === 'FolderScanner') {
 *       dataSource.protocol = 'RawFile'
 *       dataSource.RawFile = dataSource.FolderScanner
 *       delete dataSource.FolderScanner
 *     }
 *   })
 * }
 */
module.exports = {
  2: (config) => {
    console.info('Move protocol dependent parameters under a sub object of the protocol')
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

    console.info('Move api dependent parameters under a sub object of the api')
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
