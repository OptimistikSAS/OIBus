import { ComponentTester } from 'ngx-speculoos';
import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DatetimeFieldsSerializationComponent } from './datetime-fields-serialization.component';
import { TestBed } from '@angular/core/testing';
import { DateTimeSerialization } from '../../../../../../../shared/model/types';
import { EditDatetimeSerializationComponent } from '../edit-datetime-serialization/edit-datetime-serialization.component';
import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { formDirectives } from '../../../form-directives';

@Component({
  template: '<oib-datetime-fields-serialization [formControl]="control"></oib-datetime-fields-serialization>',
  standalone: true,
  imports: [DatetimeFieldsSerializationComponent, ...formDirectives]
})
class TestComponent {
  control = new FormControl<Array<DateTimeSerialization>>([
    {
      field: 'field1',
      useAsReference: false,
      datetimeFormat: {
        type: 'unix-epoch-ms'
      }
    },
    {
      field: 'field2',
      useAsReference: true,
      datetimeFormat: {
        type: 'specific-string',
        timezone: 'Europe/Paris',
        format: 'yyyy-MM-dd HH:mm:ss.SSS',
        locale: 'en-US'
      }
    }
  ]);
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get addField() {
    return this.button('.add-field-button')!;
  }

  get editComponent(): EditDatetimeSerializationComponent {
    return this.component(EditDatetimeSerializationComponent)!;
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

  get DatetimeFieldsSerializationComponent(): DatetimeFieldsSerializationComponent {
    return this.component(DatetimeFieldsSerializationComponent);
  }
}

describe('DatetimeFieldsSerializationComponent', () => {
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
  });

  it('should edit component', () => {
    tester.editButtons[0].click();
    expect(tester.displayFields.length).toBe(1);
    expect(tester.editComponent).not.toBeNull();
  });

  it('should delete component', () => {
    tester.deleteButtons[0].click();
    expect(tester.displayFields.length).toBe(1);
  });

  it('should add a field', () => {
    tester.addField.click();

    expect(tester.displayFields.length).toBe(2);
    expect(tester.editComponent).not.toBeNull();
    [tester.addField, tester.editButtons, tester.deleteButtons].flat().forEach(b => {
      expect(b.disabled).toBeTrue();
    });

    expect(tester.editComponent.dateTimeSerialization).toEqual({
      field: '',
      useAsReference: false,
      datetimeFormat: {
        type: 'specific-string',
        timezone: 'Europe/Paris',
        format: 'yyyy-MM-dd HH:mm:ss.SSS',
        locale: 'en-US'
      }
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
  });
});
