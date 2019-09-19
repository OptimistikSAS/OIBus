module.exports = {
  '0.3.12': (config) => {
    // Rename filename => logFilename
    console.info('config.engine.logParameters.filename => config.engine.logParameters.logFilename')
    config.engine.logParameters.logFilename = config.engine.logParameters.filename
    delete config.engine.logParameters.filename
  },
  '0.3.13': (config) => {
    // Rename logFilename => filename
    console.info('config.engine.logParameters.logFilename => config.engine.logParameters.filename')
    config.engine.logParameters.filename = config.engine.logParameters.logFilename
    delete config.engine.logParameters.logFilename

    // Rename FolderScanner => RawFile
    console.info('FolderScanner => RawFile')
    config.south.dataSources.forEach((dataSource) => {
      if (dataSource.protocol === 'FolderScanner') {
        dataSource.protocol = 'RawFile'
        dataSource.RawFile = dataSource.FolderScanner
        delete dataSource.FolderScanner
      }
    })
  },
  '0.4.6': (config) => {
    // Rename RawFile => FolderScanner
    console.info('RawFile => FolderScanner')
    config.south.dataSources.forEach((dataSource) => {
      if (dataSource.protocol === 'RawFile') {
        dataSource.protocol = 'FolderScanner'
        dataSource.FolderScanner = dataSource.RawFile
        delete dataSource.RawFile
      }
    })
  },
}
