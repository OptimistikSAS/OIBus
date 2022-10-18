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
        .toEqual(Error('Bad data: expect data.reference field'))
    }

    try {
      oiaTimeValues([{ data: { reference: 'dataReference' } }])
    } catch (error) {
      expect(error)
        .toEqual(Error('Bad data: expect unit.label field'))
    }

    try {
      oiaTimeValues([{
        data: { reference: 'dataReference' },
        unit: { label: 'g/L' },
      }])
    } catch (error) {
      expect(error)
        .toEqual(Error('Bad data: expect values to be an array'))
    }

    try {
      oiaTimeValues(
        [{
          data: { reference: 'dataReference' },
          unit: { label: 'g/L' },
          values: [],
        }],
      )
    } catch (error) {
      expect(error)
        .toEqual(Error('Bad data: expect timestamps to be an array'))
    }
  })

  it('should correctly parse accepted data', () => {
    const oiaData = [
      {
        type: 'time-values',
        unit: { id: '2', label: '%' },
        data: {
          dataType: 'RAW_TIME_DATA',
          id: 'D4',
          reference: 'ref1',
          description: 'Concentration O2 fermentation',
        },
        timestamps: ['2022-01-01T00:00:00Z', '2022-01-01T00:10:00Z'],
        values: [63, 84],
      },
      {
        type: 'time-values',
        unit: { id: '180', label: 'pH' },
        data: {
          dataType: 'RAW_TIME_DATA',
          id: 'D5',
          reference: 'ref2',
          description: 'pH fermentation',
        },
        timestamps: ['2022-01-01T00:00:00Z', '2022-01-01T00:10:00Z'],
        values: [7, 8],
      },
    ]

    expect(oiaTimeValues(oiaData))
      .toEqual({
        httpResults: [
          {
            pointId: 'ref1',
            timestamp: '2022-01-01T00:00:00Z',
            unit: '%',
            value: 63,
          },
          {
            pointId: 'ref1',
            timestamp: '2022-01-01T00:10:00Z',
            unit: '%',
            value: 84,
          },
          {
            pointId: 'ref2',
            timestamp: '2022-01-01T00:00:00Z',
            unit: 'pH',
            value: 7,
          },
          {
            pointId: 'ref2',
            timestamp: '2022-01-01T00:10:00Z',
            unit: 'pH',
            value: 8,
          }],
        latestDateRetrieved: new Date('2022-01-01T00:10:00.000Z'),
      })

    expect(oiaTimeValues([]))
      .toEqual({ httpResults: [], latestDateRetrieved: new Date('1970-01-01T00:00:00.000Z') })
    expect(oiaTimeValues([
      {
        type: 'time-values',
        unit: { id: '2', label: '%' },
        data: {
          dataType: 'RAW_TIME_DATA',
          id: 'D4',
          reference: 'ref1',
          description: 'Concentration O2 fermentation',
        },
        timestamps: [],
        values: [],
      },
    ]))
      .toEqual({ httpResults: [], latestDateRetrieved: new Date('1970-01-01T00:00:00.000Z') })
  })
})
