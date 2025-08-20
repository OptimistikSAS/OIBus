import { testEnumPipe } from './base-enum-pipe.spec';
import { OIBusTransformerLanguageEnumPipe } from './oibus-transformer-language-enum.pipe';

describe('OIBusTransformerLanguageEnumPipe', () => {
  it('should translate transformer language', () => {
    testEnumPipe(OIBusTransformerLanguageEnumPipe, {
      javascript: 'JavaScript',
      typescript: 'TypeScript',
      python: 'Python'
    });
  });
});
