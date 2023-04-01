import csv from 'papaparse';

import * as utils from './utils';

jest.mock('papaparse', () => ({ unparse: jest.fn() }));

describe('South connector SQL utils', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should call csv unparse with correctly formatted dates', () => {
    const entryList = [
      {
        value: 'val1',
        timestamp: new Date('2020-01-01T00:00:00.000Z')
      },
      {
        value: 'val2',
        timestamp: '2021-01-01 00:00:00.000'
      },
      {
        value: 'val3',
        timestamp: new Date('2020-01-01T00:00:00.000Z').getTime()
      },
      {
        value: 'val4',
        timestamp: undefined
      }
    ];

    utils.generateCSV(entryList, 'Europe/Paris', 'yyyy-MM-dd HH:mm:ss.SSS', ';');

    const expectedEntryList = [
      {
        value: 'val1',
        timestamp: '2020-01-01 00:00:00.000' // Date has been formatted
      },
      {
        value: 'val2',
        timestamp: '2021-01-01 00:00:00.000'
      },
      {
        value: 'val3',
        timestamp: new Date('2020-01-01T00:00:00.000Z').getTime()
      },
      {
        value: 'val4',
        timestamp: undefined
      }
    ];

    expect(csv.unparse).toHaveBeenCalledWith(expectedEntryList, { header: true, delimiter: ';' });
  });

  it('should get most recent date with Date of SQL string type', () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const entryList = [
      {
        value: 'val1',
        timestamp: '2020-01-01 00:00:00.000'
      },
      {
        value: 'val2',
        timestamp: '2021-01-01 00:00:00.000'
      },
      {
        value: 'val3',
        timestamp: '2020-02-01 00:00:00.000'
      }
    ];

    const mostRecentDate = utils.getMostRecentDate(entryList, startTime, 'timestamp', 'Europe/Paris');
    expect(mostRecentDate).toEqual('2020-12-31T23:00:00.001Z');
  });

  it('should get most recent date with Date of Date type', () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const entryList = [
      {
        value: 'val1',
        timestamp: new Date('2020-01-01T00:00:00.000Z')
      },
      {
        value: 'val2',
        timestamp: new Date('2022-01-01T00:00:00.000Z')
      },
      {
        value: 'val3',
        timestamp: new Date('2021-01-01T00:00:00.000Z')
      }
    ];

    const mostRecentDate = utils.getMostRecentDate(
      entryList,
      startTime,
      'timestamp',
      'Europe/Paris' // timezone is ignored in case of Date type
    );
    expect(mostRecentDate).toEqual('2022-01-01T00:00:00.001Z');
  });

  it('should get most recent date with Date of number type', () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const entryList = [
      {
        value: 'val1',
        timestamp: new Date('2020-01-01T00:00:00.000Z').getTime()
      },
      {
        value: 'val2',
        timestamp: new Date('2022-01-01T00:00:00.000Z').getTime()
      },
      {
        value: 'val3',
        timestamp: new Date('2021-01-01T00:00:00.000Z').getTime()
      }
    ];

    const mostRecentDate = utils.getMostRecentDate(
      entryList,
      startTime,
      'timestamp',
      'Europe/Paris' // timezone is ignored in case of Date type
    );
    expect(mostRecentDate).toEqual('2022-01-01T00:00:00.001Z');
  });

  it('should get most recent date with Date of ISO string type', () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const entryList = [
      {
        value: 'val1',
        timestamp: '2020-01-01T00:00:00.000+06:00'
      },
      {
        value: 'val2',
        timestamp: '2022-01-01T00:00:00.000+06:00'
      },
      {
        value: 'val3',
        timestamp: '2021-01-01T00:00:00.000+06:00'
      }
    ];

    const mostRecentDate = utils.getMostRecentDate(
      entryList,
      startTime,
      'timestamp',
      'Europe/Paris' // timezone is ignored in case of ISO string type
    );
    expect(mostRecentDate).toEqual('2021-12-31T18:00:00.001Z');
  });

  it('should keep startTime as most recent date if no timeColumn', () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const entryList = [
      {
        value: 'val1',
        timestamp: '2020-01-01 00:00:00.000'
      },
      {
        value: 'val2',
        timestamp: '2021-01-01 00:00:00.000'
      },
      {
        value: 'val3',
        timestamp: '2020-02-01 00:00:00.000'
      }
    ];

    const mostRecentDate = utils.getMostRecentDate(entryList, startTime, 'anotherTimeColumn', 'Europe/Paris');
    expect(mostRecentDate).toEqual(startTime);
  });

  it('should not parse Date if not in correct type', () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const entryList = [
      {
        value: 'val1',
        timestamp: undefined
      },
      {
        value: 'val2',
        timestamp: 'abc'
      }
    ];

    const mostRecentDate = utils.getMostRecentDate(entryList, startTime, 'timestamp', 'Europe/Paris');
    expect(mostRecentDate).toEqual(startTime);
  });

  it('should generate replacement parameters', () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2021-01-01T00:00:00.000Z';
    const query = 'SELECT * FROM table WHERE timestamp > @StartTime && timestamp < @EndTime && @StartTime > timestamp';

    const expectedResult = [startTime, endTime, startTime];
    const result = utils.generateReplacementParameters(query, startTime, endTime);
    expect(result).toEqual(expectedResult);
  });
});
