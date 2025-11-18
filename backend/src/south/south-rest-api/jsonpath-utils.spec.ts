import objectPath from 'object-path';
import { extractDateTimeFields, parseJsonPath } from './jsonpath-utils';

describe('parseJsonPath', () => {
  const payload = {
    timestamp: '2024-01-01T00:00:00Z',
    nested: { sensor: { id: 'A1', value: 42 } },
    array: [{ name: 'first' }, { name: 'second' }]
  };

  it('reads properties using JSONPath with root prefix', () => {
    expect(parseJsonPath(payload, '$.timestamp')).toBe('2024-01-01T00:00:00Z');
    expect(parseJsonPath(payload, '$.nested.sensor.id')).toBe('A1');
    expect(parseJsonPath(payload, '$.array.1.name')).toBe('second');
  });

  it('returns undefined when the path does not exist', () => {
    expect(parseJsonPath(payload, '$.nested.sensor.missing')).toBeUndefined();
  });

  it('falls back to undefined when object-path throws', () => {
    const spy = jest.spyOn(objectPath, 'get').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(parseJsonPath(payload, '$.timestamp')).toBeUndefined();
    spy.mockRestore();
  });

  it('extracts values with extractDateTimeFields helper', () => {
    const series = [{ timestamp: '2024-01-01T00:00:00Z' }, { timestamp: null }, { timestamp: '2024-01-01T01:00:00Z' }];
    expect(extractDateTimeFields(series, '$.timestamp')).toEqual(['2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z']);
  });
});
