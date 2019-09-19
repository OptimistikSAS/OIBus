module.exports = {
  2: (config) => {
    // Rename filename => logFilename
    console.info('config.engine.logParameters.filename => config.engine.logParameters.logFilename')
    config.engine.logParameters.logFilename = config.engine.logParameters.filename
    delete config.engine.logParameters.filename
  },
  3: (config) => {
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
  4: (config) => {
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
