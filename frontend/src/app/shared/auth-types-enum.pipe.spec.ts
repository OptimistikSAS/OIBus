import { testEnumPipe } from './base-enum-pipe.spec';
import { AuthTypesEnumPipe } from './auth-types-enum.pipe';

describe('AuthTypesEnumPipe', () => {
  it('should translate authentication type', () => {
    testEnumPipe(ts => new AuthTypesEnumPipe(ts), {
      none: 'None',
      basic: 'Basic auth',
      bearer: 'Bearer',
      password: 'Password',
      'api-key': 'API key',
      cert: 'Certificate',
      aad: 'Application Active Directory',
      accessKey: 'Access key',
      'private-key': 'Private key',
      sasToken: 'Shared Access Signature token',
      external: 'External'
    });
  });
});
