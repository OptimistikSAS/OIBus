import { ComponentTester } from 'ngx-speculoos';
import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { OibArrayComponent } from './oib-array.component';
import { TestBed } from '@angular/core/testing';
import { EditElementComponent } from './edit-element/edit-element.component';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { formDirectives } from '../../form-directives';
import { buildDateTimeFieldsFormControl } from '../../../../../../backend/shared/model/manifest-factory';

@Component({
  template: '<oib-array [formDescription]="formDescription" [formControl]="control" />',
  standalone: true,
  imports: [OibArrayComponent, ...formDirectives]
})
class TestComponent {
  formDescription = buildDateTimeFieldsFormControl([]).content;

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

  get DatetimeFieldsComponent(): OibArrayComponent {
    return this.component(OibArrayComponent);
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
    expect(tester.displayFields[0]).toContainText('UNIX Epoch (ms)');
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

    expect(tester.editComponent.element).toEqual({
      fieldName: '',
      useAsReference: false,
      type: 'string',
      timezone: 'UTC',
      format: 'yyyy-MM-dd HH:mm:ss',
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

    expect(tester.editComponent.element).toEqual({
      fieldName: '',
      useAsReference: false,
      type: 'string',
      timezone: 'UTC',
      format: 'yyyy-MM-dd HH:mm:ss',
      locale: 'en-En'
    });

    tester.detectChanges();

    expect(tester.displayFields.length).toBe(2);
    expect(tester.editComponent).not.toBeNull();
    expect(tester.validationErrors).toEqual({ resolvePendingChanges: true });
  });
});
