import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { OIBusCertificateAttribute } from '../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../../../backend/src/tests/utils/test-data';
import { CertificateDTO } from '../../../../../../backend/shared/model/certificate.model';
import { OibusCertificateFormControlComponent } from './oibus-certificate-form-control.component';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

@Component({
  selector: 'oib-test-oibus-certificate-form-control-component',
  template: `
    <form [formGroup]="formGroup">
      <ng-container formGroupName="testGroup">
        <oib-oibus-certificate-form-control [certificates]="allCertificates" [certificateAttribute]="certificateAttribute" />
      </ng-container>
    </form>
  `,
  imports: [ReactiveFormsModule, TranslateModule, OibusCertificateFormControlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestComponent {
  certificateAttribute: OIBusCertificateAttribute = {
    type: 'certificate',
    key: 'testKey',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.date-time-fields.field-name'
  } as OIBusCertificateAttribute;

  allCertificates = testData.certificates.list as unknown as Array<CertificateDTO>;
  formGroup = new FormGroup({
    testGroup: new FormGroup({
      testKey: new FormControl('')
    })
  });
}

class TestComponentTester {
  readonly fixture = TestBed.createComponent(TestComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly label = this.root.getByText('Field name');
  readonly field = this.root.getByCss('select');
  readonly options = this.root.getByCss('option');
}

describe('OIBusCertificateFormControlComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new TestComponentTester();
    tester.fixture.detectChanges();
  });

  test('should display a label with the correct translation key', async () => {
    await expect.element(tester.label).toBeInTheDocument();
  });

  test('should display a select with the correct form control name', async () => {
    await tester.field.selectOptions('certificate1');
    await expect.element(tester.field).toHaveValue('certificate1');
    await expect.element(tester.options.nth(1)).toHaveTextContent('Certificate 1');
  });

  test('should display options for each selectable value', async () => {
    await expect.element(tester.options).toHaveLength(3); // One for the null option and one for each value
    await expect.element(tester.options.nth(1)).toHaveTextContent('Certificate 1');
    await expect.element(tester.options.nth(2)).toHaveTextContent('Certificate 2');
  });
});
