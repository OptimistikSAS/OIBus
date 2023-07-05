import { fakeAsync, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { formDirectives } from '../../../form-directives';
import { EditElementComponent } from './edit-element.component';
import { DefaultValidationErrorsComponent } from '../../../default-validation-errors/default-validation-errors.component';
import { buildDateTimeFieldsFormControl } from '../../../../../../../shared/model/manifest-factory';

@Component({
  template: ` <form [formGroup]="form">
    <oib-edit-element
      [element]="element"
      [formDescription]="formDescription"
      [existingElements]="existingElements"
      (saved)="savedInput = $event"
      (cancelled)="cancelled = true"
    >
    </oib-edit-element>
  </form>`,
  standalone: true,
  imports: [EditElementComponent, ...formDirectives]
})
class TestComponent {
  formDescription = buildDateTimeFieldsFormControl([]).content;

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

  it('should save if valid', fakeAsync(() => {
    tester.field.fillWith('Field 2');

    tester.ok.click();

    expect(tester.componentInstance.savedInput).toEqual({
      fieldName: 'Field 2',
      useAsReference: false,
      type: 'unix-epoch-ms'
    });
  }));

  it('should cancel', () => {
    tester.cancel.click();
    expect(tester.componentInstance.cancelled).toBeTrue();
  });
});
