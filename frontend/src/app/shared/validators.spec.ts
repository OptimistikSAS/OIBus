import { FormControl } from '@angular/forms';
import { uniqueFieldNamesValidator, singleTrueValidator } from './validators';

describe('Custom Validators', () => {
  describe('uniqueFieldNamesValidator', () => {
    it('should return null for empty array', () => {
      const validator = uniqueFieldNamesValidator('fieldName');
      const control = new FormControl([]);

      expect(validator(control)).toBeNull();
    });

    it('should return null for null value', () => {
      const validator = uniqueFieldNamesValidator('fieldName');
      const control = new FormControl(null);

      expect(validator(control)).toBeNull();
    });

    it('should return null for non-array value', () => {
      const validator = uniqueFieldNamesValidator('fieldName');
      const control = new FormControl('not an array');

      expect(validator(control)).toBeNull();
    });

    it('should return null when all field names are unique', () => {
      const validator = uniqueFieldNamesValidator('fieldName');
      const control = new FormControl([
        { fieldName: 'field1', type: 'string' },
        { fieldName: 'field2', type: 'string' },
        { fieldName: 'field3', type: 'string' }
      ]);

      expect(validator(control)).toBeNull();
    });

    it('should return error when field names are duplicated', () => {
      const validator = uniqueFieldNamesValidator('fieldName');
      const control = new FormControl([
        { fieldName: 'field1', type: 'string' },
        { fieldName: 'field2', type: 'string' },
        { fieldName: 'field1', type: 'string' }
      ]);

      expect(validator(control)).toEqual({ duplicateFieldNames: true });
    });

    it('should ignore empty/falsy field names', () => {
      const validator = uniqueFieldNamesValidator('fieldName');
      const control = new FormControl([
        { fieldName: 'field1', type: 'string' },
        { fieldName: '', type: 'string' },
        { fieldName: null, type: 'string' },
        { fieldName: 'field2', type: 'string' }
      ]);

      expect(validator(control)).toBeNull();
    });

    it('should work with different field keys', () => {
      const validator = uniqueFieldNamesValidator('customKey');
      const control = new FormControl([
        { customKey: 'value1', other: 'data' },
        { customKey: 'value2', other: 'data' },
        { customKey: 'value1', other: 'data' }
      ]);

      expect(validator(control)).toEqual({ duplicateFieldNames: true });
    });
  });

  describe('singleTrueValidator', () => {
    it('should return null for empty array', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl([]);

      expect(validator(control)).toBeNull();
    });

    it('should return null for null value', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl(null);

      expect(validator(control)).toBeNull();
    });

    it('should return null for non-array value', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl('not an array');

      expect(validator(control)).toBeNull();
    });

    it('should return null when no items have true value', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl([
        { fieldName: 'field1', useAsReference: false },
        { fieldName: 'field2', useAsReference: false },
        { fieldName: 'field3', useAsReference: false }
      ]);

      expect(validator(control)).toBeNull();
    });

    it('should return null when exactly one item has true value', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl([
        { fieldName: 'field1', useAsReference: false },
        { fieldName: 'field2', useAsReference: true },
        { fieldName: 'field3', useAsReference: false }
      ]);

      expect(validator(control)).toBeNull();
    });

    it('should return error when multiple items have true value', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl([
        { fieldName: 'field1', useAsReference: true },
        { fieldName: 'field2', useAsReference: true },
        { fieldName: 'field3', useAsReference: false }
      ]);

      expect(validator(control)).toEqual({ onlyOneReference: true });
    });

    it('should return error when all items have true value', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl([
        { fieldName: 'field1', useAsReference: true },
        { fieldName: 'field2', useAsReference: true },
        { fieldName: 'field3', useAsReference: true }
      ]);

      expect(validator(control)).toEqual({ onlyOneReference: true });
    });

    it('should work with different field keys', () => {
      const validator = singleTrueValidator('isActive');
      const control = new FormControl([
        { name: 'item1', isActive: true },
        { name: 'item2', isActive: true },
        { name: 'item3', isActive: false }
      ]);

      expect(validator(control)).toEqual({ onlyOneReference: true });
    });

    it('should handle mixed boolean values correctly', () => {
      const validator = singleTrueValidator('useAsReference');
      const control = new FormControl([
        { fieldName: 'field1', useAsReference: 'true' },
        { fieldName: 'field2', useAsReference: 1 },
        { fieldName: 'field3', useAsReference: true },
        { fieldName: 'field4', useAsReference: false }
      ]);

      expect(validator(control)).toBeNull();
    });
  });

  describe('Integration tests', () => {
    it('should work together when both validators are applied', () => {
      const uniqueValidator = uniqueFieldNamesValidator('fieldName');
      const singleTrueValidator_ = singleTrueValidator('useAsReference');

      // Valid case: unique names and single true
      const validControl = new FormControl([
        { fieldName: 'field1', useAsReference: true },
        { fieldName: 'field2', useAsReference: false },
        { fieldName: 'field3', useAsReference: false }
      ]);

      expect(uniqueValidator(validControl)).toBeNull();
      expect(singleTrueValidator_(validControl)).toBeNull();

      // Invalid case: duplicate names
      const duplicateNamesControl = new FormControl([
        { fieldName: 'field1', useAsReference: true },
        { fieldName: 'field1', useAsReference: false }
      ]);

      expect(uniqueValidator(duplicateNamesControl)).toEqual({ duplicateFieldNames: true });
      expect(singleTrueValidator_(duplicateNamesControl)).toBeNull();

      // Invalid case: multiple true values
      const multipleTrueControl = new FormControl([
        { fieldName: 'field1', useAsReference: true },
        { fieldName: 'field2', useAsReference: true }
      ]);

      expect(uniqueValidator(multipleTrueControl)).toBeNull();
      expect(singleTrueValidator_(multipleTrueControl)).toEqual({ onlyOneReference: true });
    });
  });
});
