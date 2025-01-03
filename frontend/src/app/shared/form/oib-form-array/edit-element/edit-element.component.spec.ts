import { fakeAsync, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { formDirectives } from '../../../form-directives';
import { EditElementComponent } from './edit-element.component';
import { DefaultValidationErrorsComponent } from '../../../default-validation-errors/default-validation-errors.component';
import { OibFormControl } from '../../../../../../../backend/shared/model/form.model';

@Component({
  template: ` <form [formGroup]="form">
    <oib-edit-element
      [parentForm]="form"
      [element]="element"
      [formDescription]="formDescription"
      [existingElements]="existingElements"
      (saved)="savedInput = $event"
      (cancelled)="cancelled = true"
    />
  </form>`,
  imports: [EditElementComponent, ...formDirectives]
})
class TestComponent {
  formDescription: Array<OibFormControl> = [
    {
      key: 'fieldName',
      translationKey: 'south.items.postgresql.date-time-fields.field-name',
      type: 'OibText',
      defaultValue: '',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'useAsReference',
      translationKey: 'south.items.postgresql.date-time-fields.use-as-reference',
      type: 'OibCheckbox',
      defaultValue: false,
      displayInViewMode: true,
      validators: [{ key: 'required' }]
    },
    {
      key: 'type',
      translationKey: 'south.items.postgresql.date-time-fields.type',
      type: 'OibSelect',
      defaultValue: 'string',
      options: ['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms', 'timestamp', 'timestamptz'],
      displayInViewMode: true,
      validators: [{ key: 'required' }]
    },
    {
      key: 'timezone',
      translationKey: 'south.items.postgresql.date-time-fields.timezone',
      type: 'OibTimezone',
      defaultValue: 'UTC',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true,
      conditionalDisplay: { field: 'type', values: ['string', 'timestamp', 'DateTime', 'DateTime2', 'SmallDateTime', 'Date'] }
    },
    {
      key: 'format',
      translationKey: 'south.items.postgresql.date-time-fields.format',
      type: 'OibText',
      defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
      validators: [{ key: 'required' }],
      conditionalDisplay: { field: 'type', values: ['string'] }
    },
    {
      key: 'locale',
      translationKey: 'south.items.postgresql.date-time-fields.locale',
      defaultValue: 'en-En',
      type: 'OibText',
      validators: [{ key: 'required' }],
      conditionalDisplay: { field: 'type', values: ['string'] }
    }
  ];

  element = {
    fieldName: 'field1',
    useAsReference: false,
    type: 'unix-epoch-ms',
    timezone: null,
    format: null,
    locale: null
  };
  existingElements = [
    {
      fieldName: 'field2',
      useAsReference: false,
      type: 'unix-epoch',
      timezone: null,
      format: null,
      locale: null
    }
  ];
  form = new FormGroup({
    fieldName: new FormControl(null as string | null, Validators.required),
    useAsReference: new FormControl(false as boolean | null),
    type: new FormControl('unix-epoch-ms'),
    timezone: new FormControl(),
    format: new FormControl(),
    locale: new FormControl()
  });
  savedInput: any | null = null;
  cancelled = false;
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get field() {
    return this.input('#OibText-fieldName')!;
  }

  get type() {
    return this.select('#OibSelect-type')!;
  }

  get useAsReference() {
    return this.input('#OibCheckbox-useAsReference')!;
  }

  get timezone() {
    return this.input('#OibTimezone-timezone')!;
  }

  get format() {
    return this.input('#OibText-format')!;
  }

  get locale() {
    return this.input('#OibText-locale')!;
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

describe('EditElementComponent', () => {
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
  }));

  it('should save if valid', () => {
    tester.field.fillWith('Field 2');

    tester.ok.click();

    expect(tester.componentInstance.savedInput).toEqual({
      fieldName: 'Field 2',
      useAsReference: false,
      type: 'unix-epoch-ms'
    });
  });

  it('should cancel', () => {
    tester.cancel.click();
    expect(tester.componentInstance.cancelled).toBeTrue();
  });
});
