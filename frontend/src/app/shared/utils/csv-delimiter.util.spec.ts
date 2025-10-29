import { convertCsvDelimiter } from './csv-delimiter.util';

describe('convertCsvDelimiter', () => {
  it('should convert CSV characters to their delimiter counterpart', () => {
    expect(convertCsvDelimiter('DOT')).toBe('.');
    expect(convertCsvDelimiter('SEMI_COLON')).toBe(';');
    expect(convertCsvDelimiter('COLON')).toBe(':');
    expect(convertCsvDelimiter('COMMA')).toBe(',');
    expect(convertCsvDelimiter('NON_BREAKING_SPACE')).toBe(' ');
    expect(convertCsvDelimiter('SLASH')).toBe('/');
    expect(convertCsvDelimiter('TAB')).toBe('  ');
    expect(convertCsvDelimiter('PIPE')).toBe('|');
  });
});
