import { testEnumPipe } from './base-enum-pipe.spec';
import { OibusCommandStatusEnumPipe } from './oibus-command-status-enum.pipe';

describe('OibusCommandStatusEnumPipe', () => {
  it('should translate OIBus command status', () => {
    testEnumPipe(ts => new OibusCommandStatusEnumPipe(ts), {
      RETRIEVED: 'Pending',
      ERRORED: 'Errored',
      CANCELLED: 'Cancelled',
      COMPLETED: 'Completed'
    });
  });
});
