import { CsvCharacter } from '../../../../../backend/shared/model/types';

export const convertCsvDelimiter = (delimiter: CsvCharacter): string => {
  switch (delimiter) {
    case 'DOT':
      return '.';
    case 'SEMI_COLON':
      return ';';
    case 'COLON':
      return ':';
    case 'COMMA':
      return ',';
    case 'SLASH':
      return '/';
    case 'TAB':
      return '  ';
    case 'NON_BREAKING_SPACE':
      return ' ';
    case 'PIPE':
      return '|';
  }
};
