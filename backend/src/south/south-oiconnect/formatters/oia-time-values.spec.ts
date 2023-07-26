import oiaTimeValues from './oia-time-values';
import { SouthConnectorItemDTO } from '../../../../../shared/model/south-connector.model';

const item: SouthConnectorItemDTO = {
  id: 'id1',
  name: 'item1',
  connectorId: 'southId',
  enabled: true,
  settings: {
    payloadParser: 'raw'
  },
  scanModeId: 'scanModeId1'
};

describe('oia time values formatter', () => {
  it('should reject bad data', () => {
    try {
      oiaTimeValues(item, {} as any);
    } catch (error) {
      expect(error).toEqual(Error('Bad data: expect OIAnalytics time values to be an array'));
    }

    try {
      oiaTimeValues(item, [{}] as any);
    } catch (error) {
      expect(error).toEqual(Error('Bad data: expect data.reference field'));
    }

    try {
      oiaTimeValues(item, [{ data: { reference: 'dataReference' } }] as any);
    } catch (error) {
      expect(error).toEqual(Error('Bad data: expect unit.label field'));
    }

    try {
      oiaTimeValues(item, [
        {
          data: { reference: 'dataReference' },
          unit: { label: 'g/L' }
        }
      ] as any);
    } catch (error) {
      expect(error).toEqual(Error('Bad data: expect values to be an array'));
    }

    try {
      oiaTimeValues(item, [
        {
          data: { reference: 'dataReference' },
          unit: { label: 'g/L' },
          values: []
        }
      ] as any);
    } catch (error) {
      expect(error).toEqual(Error('Bad data: expect timestamps to be an array'));
    }
  });

  it('should correctly parse accepted data', () => {
    const oiaData = [
      {
        type: 'time-values',
        unit: { id: '2', label: '%' },
        data: {
          dataType: 'RAW_TIME_DATA',
          id: 'D4',
          reference: 'ref1',
          description: 'Concentration O2 fermentation'
        },
        timestamps: ['2022-01-01T00:00:00Z', '2022-01-01T00:10:00Z'],
        values: [63, 84]
      },
      {
        type: 'time-values',
        unit: { id: '180', label: 'pH' },
        data: {
          dataType: 'RAW_TIME_DATA',
          id: 'D5',
          reference: 'ref2',
          description: 'pH fermentation'
        },
        timestamps: ['2022-01-01T00:00:00Z', '2022-01-01T00:10:00Z'],
        values: [7, 8]
      }
    ];

    expect(oiaTimeValues(item, oiaData)).toEqual({
      formattedResult: [
        {
          pointId: 'ref1',
          timestamp: '2022-01-01T00:00:00.000Z',
          unit: '%',
          value: 63
        },
        {
          pointId: 'ref1',
          timestamp: '2022-01-01T00:10:00.000Z',
          unit: '%',
          value: 84
        },
        {
          pointId: 'ref2',
          timestamp: '2022-01-01T00:00:00.000Z',
          unit: 'pH',
          value: 7
        },
        {
          pointId: 'ref2',
          timestamp: '2022-01-01T00:10:00.000Z',
          unit: 'pH',
          value: 8
        }
      ],
      maxInstant: '2022-01-01T00:10:00.000Z'
    });

    expect(oiaTimeValues(item, [])).toEqual({ formattedResult: [], maxInstant: '1970-01-01T00:00:00.000Z' });
    expect(
      oiaTimeValues(item, [
        {
          type: 'time-values',
          unit: { id: '2', label: '%' },
          data: {
            dataType: 'RAW_TIME_DATA',
            id: 'D4',
            reference: 'ref1',
            description: 'Concentration O2 fermentation'
          },
          timestamps: [],
          values: []
        }
      ])
    ).toEqual({ formattedResult: [], maxInstant: '1970-01-01T00:00:00.000Z' });
  });
});
