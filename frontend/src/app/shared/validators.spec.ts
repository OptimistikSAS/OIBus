import { FormControl, ValidationErrors } from '@angular/forms';
import { uniqueFieldNamesValidator, singleTrueValidator, headerMatches, simpleHeaderValidator, CsvValidationError } from './validators';
import { Observable } from 'rxjs';

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

  describe('headerMatches', () => {
    it('matches identical headers ignoring case', () => {
      expect(headerMatches('Foo', 'foo')).toBeTrue();
      expect(headerMatches('bar', 'BAR')).toBeTrue();
    });

    it('matches when actual has settings_ prefix', () => {
      expect(headerMatches('field', 'settings_field')).toBeTrue();
    });

    it('matches when expected has settings_ prefix', () => {
      expect(headerMatches('settings_field', 'field')).toBeTrue();
    });

    it('does not match unrelated headers', () => {
      expect(headerMatches('foo', 'bar')).toBeFalse();
      expect(headerMatches('settings_foo', 'settings_bar')).toBeFalse();
    });
  });

  describe('simpleHeaderValidator', () => {
    let originalFileReader: any;

    beforeAll(() => {
      originalFileReader = (window as any).FileReader;
    });

    afterAll(() => {
      (window as any).FileReader = originalFileReader;
    });

    beforeEach(() => {
      // stub out FileReader to synchronously emit fakeFileContent
      (window as any).fakeFileContent = '';
      (window as any).FileReader = class {
        public onload!: (e: any) => void;
        public onerror!: () => void;
        public result: string = (window as any).fakeFileContent;
        readAsText(_f: any) {
          // immediately fire onload
          this.onload({ target: { result: this.result } });
        }
      };
    });

    const expected = ['col1', 'col2'];
    const delimiter = ',';
    const validator = simpleHeaderValidator(expected, delimiter);

    it('returns null when control value is null', done => {
      const control = new FormControl(null);
      // force the return‐type to Observable<ValidationErrors|null>
      const result$ = validator(control) as Observable<ValidationErrors | null>;

      result$.subscribe((result: ValidationErrors | null) => {
        expect(result).toBeNull();
        done();
      });
    });

    it('returns null when value is not a File instance', done => {
      const control = new FormControl({ name: 'not a file' } as any);
      const result$ = validator(control) as Observable<ValidationErrors | null>;

      result$.subscribe((result: ValidationErrors | null) => {
        expect(result).toBeNull();
        done();
      });
    });

    it('passes when headers exactly match', done => {
      (window as any).fakeFileContent = 'col1,col2\n1,2';
      const file = new File([''], 'test.csv', { type: 'text/csv' });
      const control = new FormControl(file);
      const result$ = validator(control) as Observable<ValidationErrors | null>;

      result$.subscribe((result: ValidationErrors | null) => {
        expect(result).toBeNull();
        done();
      });
    });

    it('errors when a header is missing', done => {
      (window as any).fakeFileContent = 'col1\n1';
      const file = new File([''], 'test.csv', { type: 'text/csv' });
      const control = new FormControl(file);
      const result$ = validator(control) as Observable<ValidationErrors | null>;

      result$.subscribe((result: ValidationErrors | null) => {
        expect(result).toEqual({
          csvFormatError: {
            missingHeaders: ['col2'],
            extraHeaders: [],
            expectedHeaders: expected,
            actualHeaders: ['col1']
          } as CsvValidationError
        });
        done();
      });
    });

    it('errors when there are missing and extra headers', done => {
      (window as any).fakeFileContent = 'col1,foo\n1,2';
      const file = new File([''], 'test.csv', { type: 'text/csv' });
      const control = new FormControl(file);

      (validator(control) as Observable<ValidationErrors | null>).subscribe(result => {
        expect(result).toEqual({
          csvFormatError: {
            missingHeaders: ['col2'],
            extraHeaders: ['foo'],
            expectedHeaders: expected,
            actualHeaders: ['col1', 'foo']
          } as CsvValidationError
        });
        done();
      });
    });

    it('ignores extra common headers when none are missing', done => {
      (window as any).fakeFileContent = 'col1,id,createdAt,scanModeName,col2\n1,2,3,4,5';
      const file = new File([''], 'test.csv', { type: 'text/csv' });
      const control = new FormControl(file);

      const result$ = validator(control) as Observable<ValidationErrors | null>;
      result$.subscribe(result => {
        expect(result).toBeNull();
        done();
      });
    });

    it('accepts headers with settings_ prefix', done => {
      (window as any).fakeFileContent = 'settings_col1,settings_col2\n1,2';
      const file = new File([''], 'test.csv', { type: 'text/csv' });
      const control = new FormControl(file);

      (validator(control) as Observable<ValidationErrors | null>).subscribe(result => {
        expect(result).toBeNull();
        done();
      });
    });

    it('accepts expected settings_ prefix headers when actual has no prefix', done => {
      const customExpected = ['settings_col'];
      const customVal = simpleHeaderValidator(customExpected, delimiter);
      (window as any).fakeFileContent = 'col\n1';
      const file = new File([''], 'file.csv', { type: 'text/csv' });
      const control = new FormControl(file);

      const result$ = customVal(control) as Observable<ValidationErrors | null>;
      result$.subscribe(result => {
        expect(result).toBeNull();
        done();
      });
    });
  });
});
