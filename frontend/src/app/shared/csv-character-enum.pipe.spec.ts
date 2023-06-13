import { CsvCharacterEnumPipe } from './csv-character-enum.pipe';
import { testEnumPipe } from './base-enum-pipe.spec';

describe('CsvCharacterEnumPipe', () => {
  it('should translate csv character', () => {
    testEnumPipe(ts => new CsvCharacterEnumPipe(ts), {
      TAB: 'Tab',
      NON_BREAKING_SPACE: 'Space',
      COMMA: 'Comma ,',
      COLON: 'Colon :',
      SEMI_COLON: 'Semi colon ;',
      SLASH: 'Slash /',
      DOT: 'Dot .',
      PIPE: 'Pipe |'
    });
  });
});
