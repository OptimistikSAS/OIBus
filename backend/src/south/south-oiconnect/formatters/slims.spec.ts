import slims from './slims';
import { DateTime } from 'luxon';
import { SouthConnectorItemDTO } from '../../../../../shared/model/south-connector.model';

const item: SouthConnectorItemDTO = {
  id: 'id1',
  name: 'item1',
  enabled: true,
  connectorId: 'southId',
  settings: {
    payloadParser: 'raw'
  },
  scanModeId: 'scanModeId1'
};

describe('slims formatter', () => {
  it('should reject if no entries', () => {
    try {
      slims(item, null as any);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect SLIMS values to be an array.'));
    }
    try {
      slims(item, {} as any);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect SLIMS values to be an array.'));
    }
    try {
      slims(item, { entities: 1 } as any);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect SLIMS values to be an array.'));
    }
  });

  it('should format SLIMS results', () => {
    const slimsResults = {
      entities: [
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'myPid'
            },
            {
              name: 'test_name',
              value: 'myName'
            },
            {
              name: 'rslt_value',
              value: 123,
              unit: 'g/L'
            },
            {
              name: 'rslt_cf_samplingDateAndTime',
              value: DateTime.fromISO('2020-01-01T00:00:00.000Z').toMillis()
            }
          ]
        },
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'myOtherPid'
            },
            {
              name: 'test_name',
              value: 'myOtherName'
            },
            {
              name: 'rslt_value',
              value: 0
            },
            {
              name: 'rslt_cf_samplingDateAndTime',
              value: DateTime.fromISO('2021-01-01T00:00:00.000Z').toMillis()
            }
          ]
        },
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'anotherPid'
            },
            {
              name: 'test_name',
              value: 'anotherName'
            },
            {
              name: 'rslt_value',
              value: 0
            },
            {
              name: 'rslt_cf_samplingDateAndTime',
              value: DateTime.fromISO('2020-06-01T00:00:00.000Z').toMillis()
            }
          ]
        }
      ]
    };

    const expectedResult = [
      {
        pointId: 'myPid-myName',
        unit: 'g/L',
        timestamp: DateTime.fromISO('2020-01-01T00:00:00.000Z').toUTC().toISO(),
        value: 123
      },
      {
        pointId: 'myOtherPid-myOtherName',
        unit: 'Ø',
        timestamp: DateTime.fromISO('2021-01-01T00:00:00.000Z').toUTC().toISO(),
        value: 0
      },
      {
        pointId: 'anotherPid-anotherName',
        unit: 'Ø',
        timestamp: DateTime.fromISO('2020-06-01T00:00:00.000Z').toUTC().toISO(),
        value: 0
      }
    ];

    const result = slims(item, slimsResults);
    expect(result).toEqual({ formattedResult: expectedResult, maxInstant: '2021-01-01T00:00:00.000Z' });
  });

  it('should throw error on parsing', () => {
    const slimsResultsWithoutPid = {
      entities: [{ columns: [] }]
    };
    try {
      slims(item, slimsResultsWithoutPid);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect rslt_cf_pid to have a value.'));
    }

    const slimsResultsWithoutPidValue = {
      entities: [
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: null
            }
          ]
        }
      ]
    };
    try {
      slims(item, slimsResultsWithoutPidValue);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect rslt_cf_pid to have a value.'));
    }

    const slimsResultsWithoutTestName = {
      entities: [
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'myPid'
            }
          ]
        }
      ]
    };
    try {
      slims(item, slimsResultsWithoutTestName);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect test_name to have a value.'));
    }

    const slimsResultsWithoutTestNameValue = {
      entities: [
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'myPid'
            },
            {
              name: 'test_name',
              value: null
            }
          ]
        }
      ]
    };
    try {
      slims(item, slimsResultsWithoutTestNameValue);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect test_name to have a value.'));
    }

    const slimsResultsWithoutTestValue = {
      entities: [
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'myPid'
            },
            {
              name: 'test_name',
              value: 'myName'
            }
          ]
        }
      ]
    };
    try {
      slims(item, slimsResultsWithoutTestValue);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect rslt_value to have a unit and a value.'));
    }

    const slimsResultsWithEmptyTestValue = {
      entities: [
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'myPid'
            },
            {
              name: 'test_name',
              value: 'myName'
            },
            {
              name: 'rslt_value',
              value: null,
              unit: 'g/L'
            }
          ]
        }
      ]
    };
    try {
      slims(item, slimsResultsWithEmptyTestValue);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect rslt_value to have a unit and a value.'));
    }

    const slimsResultsWithoutSamplingDateAndTime = {
      entities: [
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'myPid'
            },
            {
              name: 'test_name',
              value: 'myName'
            },
            {
              name: 'rslt_value',
              value: 123,
              unit: 'g/L'
            }
          ]
        }
      ]
    };
    try {
      slims(item, slimsResultsWithoutSamplingDateAndTime);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect rslt_cf_samplingDateAndTime to have a value.'));
    }

    const slimsResultsWithoutSamplingDateAndTimeValue = {
      entities: [
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'myPid'
            },
            {
              name: 'test_name',
              value: 'myName'
            },
            {
              name: 'rslt_value',
              value: 123,
              unit: 'g/L'
            },
            {
              name: 'rslt_cf_samplingDateAndTime',
              value: null
            }
          ]
        }
      ]
    };
    try {
      slims(item, slimsResultsWithoutSamplingDateAndTimeValue);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect rslt_cf_samplingDateAndTime to have a value.'));
    }
  });
});
