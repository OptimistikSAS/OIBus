import { ComponentTester } from 'ngx-speculoos';
import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { OibArrayComponent } from './oib-array.component';
import { TestBed } from '@angular/core/testing';
import { EditElementComponent } from './edit-element/edit-element.component';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { formDirectives } from '../../form-directives';
import { OibFormControl } from '../../../../../../backend/shared/model/form.model';

@Component({
  template: '<oib-array [parentForm]="parentForm" [formDescription]="formDescription" [formControl]="control" />',
  imports: [OibArrayComponent, ...formDirectives]
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
  parentForm = new FormGroup({});
  control = new FormControl<Array<any>>([
    {
      fieldName: 'field1',
      useAsReference: false,
      type: 'unix-epoch-ms',
      timezone: null,
      format: null,
      locale: null
    },
    {
      fieldName: 'field2',
      useAsReference: true,
      type: 'string',
      timezone: 'Europe/Paris',
      format: 'yyyy-MM-dd HH:mm:ss.SSS',
      locale: 'en-US'
    }
  ]);
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get addField() {
    return this.button('.add-button')!;
  }

  get editComponent(): EditElementComponent {
    return this.component(EditElementComponent)!;
  }

  get displayFields() {
    return this.elements('.field-display');
  }

  get editButtons() {
    return this.elements<HTMLButtonElement>('.edit-button');
  }

  get deleteButtons() {
    return this.elements<HTMLButtonElement>('.delete-button');
  }

  get validationErrors() {
    return this.componentInstance.control.errors;
  }
}

describe('ArrayComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new TestComponentTester();
    tester.detectChanges();
  });

  it('should display fields', () => {
    expect(tester.displayFields.length).toBe(2);
    expect(tester.editComponent).toBeNull();
    expect(tester.editButtons.length).toBe(2);
    expect(tester.deleteButtons.length).toBe(2);

    expect(tester.displayFields[0]).toContainText('field1');
    expect(tester.displayFields[0]).toContainText('false');
    expect(tester.displayFields[0]).toContainText('UNIX epoch (ms)');
    expect(tester.validationErrors).toEqual(null);
  });

  it('should edit component', () => {
    tester.editButtons[0].click();
    expect(tester.displayFields.length).toBe(1);
    expect(tester.editComponent).not.toBeNull();
    expect(tester.validationErrors).toEqual({ resolvePendingChanges: true });
  });

  it('should delete component', () => {
    tester.deleteButtons[0].click();
    expect(tester.displayFields.length).toBe(1);
    expect(tester.validationErrors).toEqual(null);
  });

  it('should add a field', () => {
    tester.addField.click();

    expect(tester.displayFields.length).toBe(2);
    expect(tester.editComponent).not.toBeNull();
    [tester.addField, tester.editButtons, tester.deleteButtons].flat().forEach(b => {
      expect(b.disabled).toBeTrue();
    });

    expect(tester.editComponent.element()).toEqual({
      fieldName: '',
      useAsReference: false,
      type: 'string',
      timezone: 'UTC',
      format: 'yyyy-MM-dd HH:mm:ss.SSS',
      locale: 'en-En'
    });

    tester.editComponent.saved.emit({
      field: 'field1',
      useAsReference: false,
      datetimeFormat: {
        type: 'unix-epoch-ms'
      }
    });
    tester.detectChanges();

    expect(tester.displayFields.length).toBe(3);
    expect(tester.editComponent).toBeNull();
    expect(tester.validationErrors).toEqual(null);
  });

  it('should not be valid with pending changes', () => {
    tester.addField.click();

    expect(tester.displayFields.length).toBe(2);
    expect(tester.editComponent).not.toBeNull();
    [tester.addField, tester.editButtons, tester.deleteButtons].flat().forEach(b => {
      expect(b.disabled).toBeTrue();
    });

    expect(tester.editComponent.element()).toEqual({
      fieldName: '',
      useAsReference: false,
      type: 'string',
      timezone: 'UTC',
      format: 'yyyy-MM-dd HH:mm:ss.SSS',
      locale: 'en-En'
    });

    tester.detectChanges();

    expect(tester.displayFields.length).toBe(2);
    expect(tester.editComponent).not.toBeNull();
    expect(tester.validationErrors).toEqual({ resolvePendingChanges: true });
  });
});
