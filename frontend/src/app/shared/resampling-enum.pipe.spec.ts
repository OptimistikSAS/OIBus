import { testEnumPipe } from './base-enum-pipe.spec';
import { ResamplingEnumPipe } from './resampling-enum.pipe';

describe('ResamplingEnumPipe', () => {
  it('should translate resampling', () => {
    testEnumPipe(ResamplingEnumPipe, {
      none: 'None',
      '1s': '1 second',
      '10s': '10 seconds',
      '30s': '30 seconds',
      '1min': '1 minute',
      '1h': '1 hour',
      '1d': '1 day'
    });
  });
});
