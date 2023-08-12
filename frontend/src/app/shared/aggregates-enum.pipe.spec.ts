import { testEnumPipe } from './base-enum-pipe.spec';
import { AggregatesEnumPipe } from './aggregates-enum.pipe';

describe('AggregatesEnumPipe', () => {
  it('should translate aggregate', () => {
    testEnumPipe(ts => new AggregatesEnumPipe(ts), {
      raw: 'Raw',
      maximum: 'Maximum',
      minimum: 'Minimum',
      count: 'Count',
      average: 'Average'
    });
  });
});
