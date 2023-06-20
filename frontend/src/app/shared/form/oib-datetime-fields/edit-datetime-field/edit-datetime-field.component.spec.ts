import { fakeAsync, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { DateTimeFormat, DateTimeField } from '../../../../../../../shared/model/types';
import { OibDatetimeFormatComponent } from '../../oib-datetime-format/oib-datetime-format.component';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { formDirectives } from '../../../form-directives';
import { EditDatetimeFieldComponent } from './edit-datetime-field.component';
import { DefaultValidationErrorsComponent } from '../../../default-validation-errors/default-validation-errors.component';

@Component({
  template: ` <form [formGroup]="form">
    <oib-edit-datetime-field
      [dateTimeField]="dateTimeField"
      [dateObjectTypes]="dateObjectTypes"
      [existingDateTimeFields]="existingDateTimeFields"
      (saved)="savedInput = $event"
      (cancelled)="cancelled = true"
    >
    </oib-edit-datetime-field>
  </form>`,
  standalone: true,
  imports: [EditDatetimeFieldComponent, ...formDirectives]
})
class TestComponent {
  dateTimeField: DateTimeField = {
    field: 'field1',
    useAsReference: false,
    datetimeFormat: {
      type: 'unix-epoch-ms'
    }
  };
  existingDateTimeFields: Array<DateTimeField> = [
    {
      field: 'existing',
      useAsReference: false,
      datetimeFormat: {
        type: 'unix-epoch-ms'
      }
    }
  ];
  dateObjectTypes: Array<string> = [];
  form = new FormGroup({
    field: new FormControl(null as string | null, Validators.required),
    useAsReference: new FormControl(false as boolean | null),
    datetimeFormat: new FormControl({ type: 'unix-epoch-ms' } as DateTimeFormat)
  });
  savedInput: DateTimeField | null = null;
  cancelled = false;
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get field() {
    return this.input('#field')!;
  }

  get useAsReference() {
    return this.input('#use-as-reference')!;
  }

  get dateTimeFormat() {
    return this.component(OibDatetimeFormatComponent)!;
  }

  get ok() {
    return this.button('#input-ok')!;
  }

  get cancel() {
    return this.button('#input-cancel')!;
  }

  get errors() {
    return this.elements('val-errors div');
  }
}

describe('EditDatetimeFieldComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new TestComponentTester();
    tester.detectChanges();
  });

  it('should display a filled form', () => {
    expect(tester.field).toHaveValue('field1');
    expect(tester.useAsReference).not.toBeChecked();
  });

  it('should not save if invalid', fakeAsync(() => {
    tester.field.fillWith('');

    tester.ok.click();

    expect(tester.componentInstance.savedInput).toBeNull();
    // field is required
    expect(tester.errors.length).toBe(1);

    tester.field.fillWith('existing');
    // field must be unique
    expect(tester.errors.length).toBe(1);
  }));

  it('should save if valid', fakeAsync(() => {
    tester.field.fillWith('Field 2');

    tester.ok.click();

    expect(tester.componentInstance.savedInput).toEqual({
      field: 'Field 2',
      useAsReference: false,
      datetimeFormat: {
        type: 'unix-epoch-ms'
      }
    });
  }));

  it('should cancel', () => {
    tester.cancel.click();
    expect(tester.componentInstance.cancelled).toBeTrue();
  });
});
