import { replaceVariablesInJsonBody } from './utils';

describe('replaceVariablesInJsonBody', () => {
  const start = '2024-01-01T00:00:00.000Z';
  const end = '2024-01-02T00:00:00.000Z';

  it('replaces placeholders inside JSON structures', () => {
    const body = JSON.stringify({
      range: { from: '@StartTime', to: '@EndTime' },
      nested: [{ when: '@StartTime' }, { literal: 'keep' }],
      note: 'between-@StartTime-and-@EndTime'
    });

    const result = replaceVariablesInJsonBody(body, start, end, [
      {
        useAsReference: true,
        type: 'iso-string',
        timezone: 'UTC',
        format: "yyyy-MM-dd'T'HH:mm:ss'Z'",
        locale: 'en'
      }
    ]);

    const parsed = JSON.parse(result);
    expect(parsed.range.from).toBe(start);
    expect(parsed.range.to).toBe(end);
    expect(parsed.nested[0].when).toBe(start);
    expect(parsed.nested[1]).toEqual({ literal: 'keep' });
    expect(parsed.note).toBe(`between-${start}-and-${end}`);
  });

  it('replaces placeholders in plain string bodies', () => {
    const body = 'from=@StartTime&to=@EndTime&raw=true';
    const result = replaceVariablesInJsonBody(body, start, end, []);
    expect(result).toBe(`from="${start}"&to="${end}"&raw=true`);
  });

  it('leaves non-string primitive values untouched', () => {
    const body = JSON.stringify({ value: 42, flag: true });
    const result = replaceVariablesInJsonBody(body, start, end, []);
    expect(result).toBe(body);
  });

  it('replaces placeholders in string bodies using numeric formatting', () => {
    const earlyStart = '1970-01-01T00:00:01.000Z';
    const earlyEnd = '1970-01-01T00:00:02.000Z';
    const body = 'start=@StartTime;end=@EndTime';
    const result = replaceVariablesInJsonBody(body, earlyStart, earlyEnd, [
      {
        useAsReference: true,
        type: 'unix-epoch',
        timezone: 'UTC'
      }
    ]);
    expect(result).toBe('start=1;end=2');
  });

  it('returns the original body when no placeholders are present', () => {
    const body = 'no placeholders here';
    const result = replaceVariablesInJsonBody(body, start, end, []);
    expect(result).toBe(body);
  });
});
