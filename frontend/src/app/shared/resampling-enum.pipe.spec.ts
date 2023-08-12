import { testEnumPipe } from './base-enum-pipe.spec';
import { ResamplingEnumPipe } from './resampling-enum.pipe';

describe('ResamplingEnumPipe', () => {
  it('should translate resampling', () => {
    testEnumPipe(ts => new ResamplingEnumPipe(ts), {
      none: 'None',
      second: '1 second',
      '10Seconds': '10 seconds',
      '30Seconds': '30 seconds',
      minute: '1 minute',
      hour: '1 hour',
      day: '1 day'
    });
  });
});
