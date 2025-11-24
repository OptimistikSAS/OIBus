import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { OIBusCertificateAttribute } from '../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../../../backend/src/tests/utils/test-data';
import { OibusCertificateFormControlComponent } from './oibus-certificate-form-control.component';

@Component({
  selector: 'oib-test-oibus-certificate-form-control-component',
  template: `
    <form [formGroup]="formGroup">
      <ng-container formGroupName="testGroup">
        <oib-oibus-certificate-form-control [certificates]="allCertificates" [certificateAttribute]="certificateAttribute" />
      </ng-container>
    </form>
  `,
  imports: [ReactiveFormsModule, TranslateModule, OibusCertificateFormControlComponent]
})
class TestComponent {
  certificateAttribute: OIBusCertificateAttribute = {
    type: 'certificate',
    key: 'testKey',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.date-time-fields.field-name'
  } as OIBusCertificateAttribute;

  allCertificates = testData.certificates.list;
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

describe('OIBusCertificateFormControlComponent', () => {
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
    expect(tester.label).toContainText('Field name');
  });

  it('should display a select with the correct form control name', () => {
    expect(tester.field).toBeDefined();
    tester.field.selectValue('certificate1');
    expect(tester.field).toHaveSelectedLabel('Certificate 1');
    expect(tester.field).toHaveSelectedValue('certificate1');
  });

  it('should display options for each selectable value', () => {
    expect(tester.options.length).toBe(3); // One for the null option and one for each value
    expect(tester.options[1]).toContainText('Certificate 1');
    expect(tester.options[2]).toContainText('Certificate 2');
  });
});
