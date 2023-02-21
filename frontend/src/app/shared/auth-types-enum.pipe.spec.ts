import { testEnumPipe } from './base-enum-pipe.spec';
import { AuthTypesEnumPipe } from './auth-types-enum.pipe';

describe('AuthTypesEnumPipe', () => {
  it('should translate authentication type', () => {
    testEnumPipe(ts => new AuthTypesEnumPipe(ts), {
      none: 'None',
      basic: 'Basic auth',
      bearer: 'Bearer',
      'api-key': 'API key'
    });
  });
});
