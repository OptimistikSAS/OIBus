import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { OIBusStringSelectFormControlComponent } from './oibus-string-select-form-control.component';
import { OIBusStringSelectAttribute } from '../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';

@Component({
  selector: 'test-oibus-string-select-form-control-component',
  template: `
    <form [formGroup]="formGroup">
      <ng-container formGroupName="testGroup">
        <oib-oibus-string-select-form-control [stringSelectAttribute]="stringSelectAttribute" />
      </ng-container>
    </form>
  `,
  imports: [ReactiveFormsModule, TranslateModule, OIBusStringSelectFormControlComponent]
})
class TestComponent {
  stringSelectAttribute: OIBusStringSelectAttribute = {
    type: 'string-select',
    key: 'testKey',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.date-time-fields.type',
    selectableValues: ['iso-string', 'unix-epoch']
  } as OIBusStringSelectAttribute;

  formGroup = new FormGroup({
    testGroup: new FormGroup({
      testKey: new FormControl('')
    })
  });
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get label() {
    return this.element('label')!;
  }

  get field() {
    return this.select('select')!;
  }

  get options() {
    return this.elements('option')!;
  }
}

describe('OIBusStringSelectFormControlComponent', () => {
  let tester: TestComponentTester;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new TestComponentTester();
    await tester.change();
  });

  it('should create the component', () => {
    expect(tester.componentInstance).toBeDefined();
  });

  it('should display a label with the correct translation key', () => {
    expect(tester.label).toBeDefined();
    expect(tester.label).toContainText('Type');
  });

  it('should display a select with the correct form control name', () => {
    expect(tester.field).toBeDefined();
    tester.field.selectValue('iso-string');
    expect(tester.field).toHaveSelectedLabel('ISO String');
    expect(tester.field).toHaveSelectedValue('iso-string');
  });

  it('should display options for each selectable value', () => {
    expect(tester.options.length).toBe(3); // One for the null option and one for each value
    expect(tester.options[1]).toContainText('ISO String');
    expect(tester.options[2]).toContainText('UNIX epoch (s)');
  });
});
