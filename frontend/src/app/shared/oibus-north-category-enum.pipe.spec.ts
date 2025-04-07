import { OIBusNorthCategoryEnumPipe } from './oibus-north-category-enum.pipe';
import { testEnumPipe } from './base-enum-pipe.spec';

describe('OIBusNorthCategoryEnumPipe', () => {
  it('should translate north category', () => {
    testEnumPipe(OIBusNorthCategoryEnumPipe, {
      debug: 'Debug',
      file: 'File',
      api: 'API',
      iot: 'IoT'
    });
  });
});
