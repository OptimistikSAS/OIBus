import { testEnumPipe } from './base-enum-pipe.spec';
import { OibusCommandTypeEnumPipe } from './oibus-command-type-enum.pipe';

describe('OibusCommandTypeEnumPipe', () => {
  it('should translate OIBus command type', () => {
    testEnumPipe(OibusCommandTypeEnumPipe, {
      'update-version': 'Upgrade version',
      'restart-engine': 'Restart',
      'regenerate-cipher-keys': 'Regenerate cipher keys',
      'update-engine-settings': 'Update engine settings',
      'create-scan-mode': 'Create scan mode',
      'update-scan-mode': 'Update scan mode',
      'delete-scan-mode': 'Delete scan mode',
      'create-south': 'Create south connector',
      'update-south': 'Update south connector',
      'delete-south': 'Delete south connector',
      'create-or-update-south-items-from-csv': 'Load south items from CSV',
      'create-north': 'Create north connector',
      'update-north': 'Update north connector',
      'delete-north': 'Delete north connector'
    });
  });
});
