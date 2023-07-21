import { testEnumPipe } from './base-enum-pipe.spec';
import { ScopeTypesEnumPipe } from './scope-types-enum.pipe';

describe('ScopeTypesEnumPipe', () => {
  it('should translate scope types', () => {
    testEnumPipe(ts => new ScopeTypesEnumPipe(ts), {
      south: 'South',
      north: 'North',
      'data-stream': 'Data stream engine',
      'history-engine': 'History engine',
      'history-query': 'History query',
      'web-server': 'Web server',
      'logger-service': 'Logger service'
    });
  });
});
