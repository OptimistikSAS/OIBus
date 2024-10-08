import { LogLevelsEnumPipe } from './log-levels-enum.pipe';
import { testEnumPipe } from './base-enum-pipe.spec';

describe('LogLevelsEnumPipe', () => {
  it('should translate log levels', () => {
    testEnumPipe(LogLevelsEnumPipe, {
      silent: 'Silent',
      error: 'Error',
      warn: 'Warning',
      info: 'Info',
      debug: 'Debug',
      trace: 'Trace'
    });
  });
});
