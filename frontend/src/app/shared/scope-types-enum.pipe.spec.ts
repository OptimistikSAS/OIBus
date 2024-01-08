import { testEnumPipe } from './base-enum-pipe.spec';
import { ScopeTypesEnumPipe } from './scope-types-enum.pipe';

describe('ScopeTypesEnumPipe', () => {
  it('should translate scope types', () => {
    testEnumPipe(ts => new ScopeTypesEnumPipe(ts), {
      south: 'South',
      north: 'North',
      'history-query': 'History query',
      internal: 'Internal',
      'web-server': 'Web server'
    });
  });
});
