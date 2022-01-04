const oiaTimeValues = require('./oia-time-values')

describe('oia time values formatter', () => {
  it('should reject bad data', () => {
    try {
      oiaTimeValues({})
    } catch (error) {
      expect(error)
        .toEqual(Error('Bad data: expect OIAnalytics time values to be an array'))
    }

    try {
      oiaTimeValues([{}])
    } catch (error) {
      expect(error)
        .toEqual(Error('Bad data: expect dataReference field'))
    }

    try {
      oiaTimeValues([{ dataReference: 'dataReference' }])
    } catch (error) {
      expect(error)
        .toEqual(Error('Bad data: expect unit field'))
    }

    try {
      oiaTimeValues([{
        dataReference: 'dataReference',
        unit: 'g/L',
      }])
    } catch (error) {
      expect(error)
        .toEqual(Error('Bad data: expect values to be an array'))
    }

    try {
      oiaTimeValues([{
        dataReference: 'dataReference',
        unit: 'g/L',
        values: [{}],
      }])
    } catch (error) {
      expect(error)
        .toEqual(Error('Bad data: expect value to have a timestamp'))
    }

    try {
      oiaTimeValues([{
        dataReference: 'dataReference',
        unit: 'g/L',
        values: [{ timestamp: '2020-01-01T00:00:00Z' }],
      }])
    } catch (error) {
      expect(error)
        .toEqual(Error('Bad data: expect value to have a value'))
    }
  })

  it('should correctly parse accepted data', () => {
    const oiaData = [{
      dataReference: 'dataReference',
      unit: 'g/L',
      values: [{
        timestamp: '2020-01-01T00:00:00Z',
        value: 1,
      }, {
        timestamp: '2020-01-02T00:00:00Z',
        value: 2,
      }],
    }]

    expect(oiaTimeValues(oiaData))
      .toEqual([{
        pointId: 'dataReference',
        timestamp: '2020-01-01T00:00:00Z',
        unit: 'g/L',
        value: 1,
      },
      {
        pointId: 'dataReference',
        timestamp: '2020-01-02T00:00:00Z',
        unit: 'g/L',
        value: 2,
      }])

    expect(oiaTimeValues([]))
      .toEqual([])
    expect(oiaTimeValues([{
      dataReference: 'dataReference',
      unit: 'g/L',
      values: [],
    }]))
      .toEqual([])
  })
})
