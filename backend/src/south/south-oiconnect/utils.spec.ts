import http from 'node:http';
import https from 'node:https';
import Stream from 'node:stream';

import * as utils from './utils';
import { SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';

jest.mock('node:http', () => ({ request: jest.fn() }));
jest.mock('node:https', () => ({ request: jest.fn() }));

const nowDateString = '2020-02-02T02:02:02.222Z';
const item: SouthConnectorItemDTO = {
  id: 'id1',
  name: 'item1',
  enabled: true,
  connectorId: 'southId',
  settings: {
    payloadParser: 'raw',
    serialization: {
      dateTimeOutputFormat: { type: 'iso-8601-string' }
    }
  },
  scanModeId: 'scanModeId1'
};

describe('South OIConnect utils', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
  });

  it('should correctly return void string when there is no query params', () => {
    const result = utils.formatQueryParams('2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z', []);
    expect(result).toEqual('');
  });

  it('should correctly format query params with ISO date string', () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2021-01-01T00:00:00.000Z';
    const queryParams = [
      { queryParamKey: 'start', queryParamValue: '@StartTime' },
      { queryParamKey: 'end', queryParamValue: '@EndTime' },
      { queryParamKey: 'anotherParam', queryParamValue: 'anotherQueryParam' }
    ];

    const result = utils.formatQueryParams(startTime, endTime, queryParams);
    expect(result).toEqual('?start=2020-01-01T00%3A00%3A00.000Z&end=2021-01-01T00%3A00%3A00.000Z&' + 'anotherParam=anotherQueryParam');
  });

  it('should correctly create a body with GET HTTP', async () => {
    const streamStream = new Stream();
    const onMock = jest.fn();
    const writeMock = jest.fn();
    const endMock = jest.fn();
    (http.request as jest.Mock).mockImplementation((options, callback) => {
      callback(streamStream);
      streamStream.emit('data', '{ "data": "myValue" }');
      streamStream.emit('end'); // this will trigger the promise resolve

      return {
        on: onMock,
        write: writeMock,
        end: endMock
      };
    });
    const expectedResult = { data: 'myValue' };
    const result = await utils.httpGetWithBody('body', { protocol: 'http:' });
    expect(result).toEqual(expectedResult);
    expect(onMock).toHaveBeenCalledTimes(1);
    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(writeMock).toHaveBeenCalledWith('body');
    expect(endMock).toHaveBeenCalledTimes(1);
  });

  it('should correctly create a body with GET HTTPS', async () => {
    const streamStream = new Stream();
    const onMock = jest.fn();
    const writeMock = jest.fn();
    const endMock = jest.fn();
    (https.request as jest.Mock).mockImplementation((options, callback) => {
      callback(streamStream);
      streamStream.emit('data', '{ "data": "myValue" }');
      streamStream.emit('end'); // this will trigger the promise resolve

      return {
        on: onMock,
        write: writeMock,
        end: endMock
      };
    });
    const expectedResult = { data: 'myValue' };
    const result = await utils.httpGetWithBody('body', { protocol: 'https:' });
    expect(result).toEqual(expectedResult);
    expect(onMock).toHaveBeenCalledTimes(1);
    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(writeMock).toHaveBeenCalledWith('body');
    expect(endMock).toHaveBeenCalledTimes(1);
  });

  it('should throw an error when HTTP req throws an error', async () => {
    const streamStream = new Stream();
    const onMock = jest.fn((type, callback) => {
      callback(new Error('an error'));
    });
    const writeMock = jest.fn(() => {
      streamStream.emit('error', new Error('an error'));
    });

    (https.request as jest.Mock).mockImplementation((options, callback) => {
      callback(streamStream);

      return {
        on: onMock,
        write: writeMock,
        end: jest.fn()
      };
    });
    await expect(utils.httpGetWithBody('body', { protocol: 'https:' })).rejects.toThrowError('an error');
  });

  it('should throw an error when parsing received data', async () => {
    const streamStream = new Stream();
    (https.request as jest.Mock).mockImplementation((options, callback) => {
      callback(streamStream);
      streamStream.emit('data', 'some data');
      streamStream.emit('data', 'but not a');
      streamStream.emit('data', 'json');
      streamStream.emit('end'); // this will trigger the promise resolve
      return {
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn()
      };
    });
    await expect(utils.httpGetWithBody('body', { protocol: 'https:' })).rejects.toThrowError('Unexpected token s in JSON at position 0');
  });

  it('should call raw parser', () => {
    const expectedResults = { formattedResult: [{ someData: 'someValue' }], maxInstant: nowDateString };
    const results = utils.parsers.get('raw')!(item, [{ someData: 'someValue' }]);
    expect(results).toEqual(expectedResults);
  });
});
