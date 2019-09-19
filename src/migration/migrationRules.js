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
module.exports = { }
