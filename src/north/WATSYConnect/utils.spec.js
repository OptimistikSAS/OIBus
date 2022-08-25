const utils = require('./utils')

const values = [
  {
    timestamp: '1998-07-12T21:00:00.000Z',
    pointId: 'atipik-solutions/WATSY/protocol',
    data: { value: 'web' },
  },
  {
    timestamp: '1998-07-12T21:00:00.000Z',
    pointId: 'atipik-solutions/WATSY/device_model',
    data: { value: 'oibusWATSYConnect' },
  },
  {
    timestamp: '1998-07-12T21:00:00.000Z',
    pointId: 'atipik-solutions/WATSY/device_id',
    data: { value: 'demo-capteur' },
  },
  {
    timestamp: '1998-07-12T23:45:00.000Z',
    pointId: 'atipik-solutions/WATSY/protocol',
    data: { value: 'web' },
  },
  {
    timestamp: '1998-07-12T23:45:00.000Z',
    pointId: 'atipik-solutions/WATSY/device_model',
    data: { value: 'oibusWATSYConnect' },
  },
  {
    timestamp: '1998-07-12T23:45:00.000Z',
    pointId: 'atipik-solutions/WATSY/device_id',
    data: { value: 'demo-capteur' },
  },
  {
    timestamp: '2018-07-15T20:00:00.000Z',
    pointId: 'atipik-solutions/WATSY/device_id',
    data: { value: 'demo-capteur' },
  },
]

describe('North WATSYConnect utils', () => {
  it('should properly split message in  WATSYConnect messages', () => {
    const expectedResults = [
      {
        timestamp: 900277200000000000,
        tags: {},
        fields: {
          'atipik-solutions/WATSY/device_id': 'demo-capteur',
          'atipik-solutions/WATSY/device_model': 'oibusWATSYConnect',
          'atipik-solutions/WATSY/protocol': 'web',
        },
        host: 'host',
        token: 'token',
      },
      {
        timestamp: 900287100000000000,
        tags: {},
        fields: {
          'atipik-solutions/WATSY/device_id': 'demo-capteur',
          'atipik-solutions/WATSY/device_model': 'oibusWATSYConnect',
          'atipik-solutions/WATSY/protocol': 'web',
        },
        host: 'host',
        token: 'token',
      },
      {
        timestamp: 1531684800000000000,
        tags: {},
        fields: { 'atipik-solutions/WATSY/device_id': 'demo-capteur' },
        host: 'host',
        token: 'token',
      },
    ]

    const result = utils.recursiveSplitMessages(
      [],
      values,
      'host',
      'token',
      10000,
    )

    expect(result).toEqual(expectedResults)
  })

  it('should send an empty array if received an empty array ', () => {
    const results = utils.recursiveSplitMessages(
      [],
      [],
      'host',
      'token',
      10000,
    )

    expect(results.length).toEqual(0)
  })

  it('should only send messages in the same sendInterval ', () => {
    const results = utils.recursiveSplitMessages(
      [],
      values.slice(0, 3),
      'host',
      'token',
      1000,
    )

    expect(results.length).toEqual(1)
  })
})
