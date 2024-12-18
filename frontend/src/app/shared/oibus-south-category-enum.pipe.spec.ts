import { testEnumPipe } from './base-enum-pipe.spec';
import { OIBusSouthCategoryEnumPipe } from './oibus-south-category-enum.pipe';

describe('OIBusSouthCategoryEnumPipe', () => {
  it('should translate south category', () => {
    testEnumPipe(OIBusSouthCategoryEnumPipe, {
      file: 'File',
      iot: 'IOT',
      database: 'Database'
    });
  });
});
