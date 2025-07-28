import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { OIBusSharableConnectorAttribute } from '../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../../../backend/src/tests/utils/test-data';
import { OibusSharedConnectionFormControlComponent } from './oibus-shared-connection-form-control.component';

@Component({
  template: `
    <form [formGroup]="formGroup">
      <ng-container formGroupName="testGroup">
        <oib-oibus-shared-connection-form-control
          [southConnectors]="southConnectors"
          [currentConnector]="currentConnector"
          [northConnectors]="[]"
          [sharedConnectionAttribute]="sharedConnectionAttribute"
        />
      </ng-container>
    </form>
  `,
  imports: [ReactiveFormsModule, TranslateModule, OibusSharedConnectionFormControlComponent]
})
class TestComponent {
  sharedConnectionAttribute: OIBusSharableConnectorAttribute = {
    type: 'sharable-connector',
    key: 'testKey',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.date-time-fields.field-name'
  } as OIBusSharableConnectorAttribute;
  currentConnector = { connectorType: 'north' as 'north' | 'south', id: undefined as string | undefined, type: 'opcua' };
  southConnectors = testData.south.list;
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

describe('OibusSharedConnectionFormControlComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new TestComponentTester();
    tester.detectChanges();
  });

  it('should create the component', () => {
    expect(tester.componentInstance).toBeDefined();
  });

  it('should display a label with the correct translation key', () => {
    expect(tester.label).toBeDefined();
    expect(tester.label).toContainText('Field name');
  });

  it('should display a select with the correct form control name', () => {
    expect(tester.field).toBeDefined();
    tester.field.selectLabel('South 3 - South');
    expect(tester.field).toHaveSelectedLabel('South 3 - South');
  });

  it('should display options for each selectable value', () => {
    expect(tester.options.length).toBe(2); // One for the null option and one for each value
    expect(tester.options[0]).toContainText('No');
    expect(tester.options[1]).toContainText('South 3 - South');
  });
});
