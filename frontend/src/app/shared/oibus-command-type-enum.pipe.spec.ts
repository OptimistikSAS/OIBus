import { testEnumPipe } from './base-enum-pipe.spec';
import { OibusCommandTypeEnumPipe } from './oibus-command-type-enum.pipe';

describe('OibusCommandTypeEnumPipe', () => {
  it('should translate OIBus command type', () => {
    testEnumPipe(OibusCommandTypeEnumPipe, {
      UPGRADE: 'Upgrade'
    });
  });
});
