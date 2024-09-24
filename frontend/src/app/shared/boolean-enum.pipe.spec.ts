import { testEnumPipe } from './base-enum-pipe.spec';
import { BooleanEnumPipe } from './boolean-enum.pipe';

describe('BooleanEnumPipe', () => {
  it('should translate booleans', () => {
    // TS is getting lost with boolean -> 'true'|'false', so we cast as any
    testEnumPipe(() => new BooleanEnumPipe() as any, {
      true: 'Yes',
      false: 'No'
    });
  });
});
