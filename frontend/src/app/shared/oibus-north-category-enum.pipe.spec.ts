import { OIBusNorthCategoryEnumPipe } from './oibus-north-category-enum.pipe';
import { testEnumPipe } from './base-enum-pipe.spec';

describe('OIBusNorthCategoryEnumPipe', () => {
  it('should translate north category', () => {
    testEnumPipe(OIBusNorthCategoryEnumPipe, {
      file: 'File',
      api: 'API'
    });
  });
});
