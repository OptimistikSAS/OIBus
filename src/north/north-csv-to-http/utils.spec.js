const utils = require('./utils')

describe('North CsvToHttp utils', () => {
  it('should properly convert one row (from a json)', async () => {
    const jsonObject = {}
    const mappingValues = []

    const mappingSettings = [
      {
        csvField: 'Id',
        httpField: 'Identification',
        type: 'integer',
      },
      {
        csvField: 'Begin',
        httpField: 'date',
        type: 'short date (yyyy-mm-dd)',
      },
    ]
    mappingSettings.forEach((mapping) => {
      jsonObject[mapping.csvField] = 'testValue'
      mappingValues.push(mapping)
    })

    const response = utils.convertCSVRowIntoHttpBody(jsonObject, mappingValues)

    mappingSettings.forEach((mapping) => {
      expect(response.value[mapping.httpField]).toEqual('testValue')
    })
  })
})
