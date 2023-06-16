import { testEnumPipe } from './base-enum-pipe.spec';
import { SerializationsEnumPipe } from './serialization-types-enum.pipe';

describe('SerializationsEnumPipe', () => {
  it('should translate serialization type', () => {
    testEnumPipe(ts => new SerializationsEnumPipe(ts), {
      file: 'File'
    });
  });
});
