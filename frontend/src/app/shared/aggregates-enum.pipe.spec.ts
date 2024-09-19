import { testEnumPipe } from './base-enum-pipe.spec';
import { AggregatesEnumPipe } from './aggregates-enum.pipe';

describe('AggregatesEnumPipe', () => {
  it('should translate aggregate', () => {
    testEnumPipe(ts => new AggregatesEnumPipe(ts), {
      raw: 'Raw',
      interpolative: 'Interpolate',
      total: 'Total',
      average: 'Average',
      'time-average': 'Time average',
      count: 'Count',
      stdev: 'Standard deviation',
      'minimum-actual-time': 'Minimum actual time',
      minimum: 'Minimum',
      'maximum-actual-time': 'Maximum actual time',
      maximum: 'Maximum',
      start: 'Start',
      end: 'End',
      delta: 'Delta',
      'reg-slope': 'Reg slope',
      'reg-const': 'Reg const',
      'reg-dev': 'Reg dev',
      variance: 'Variance',
      range: 'Range',
      'duration-good': 'Duration good',
      'duration-bad': 'Duration bad',
      'percent-good': 'Percent good',
      'percent-bad': 'Percent bad',
      'worst-quality': 'Worst quality',
      annotations: 'Annotations'
    });
  });
});
