import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';

import { beforeEach, describe, expect, test } from 'vitest';

import { OIBusCertificateAttribute } from '@oibus/shared/connector/form.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { OIBusFormControlTester, renderOIBusFormControl } from '../oibus-form-control.testing';
import { OibusCertificateFormControlComponent } from './oibus-certificate-form-control.component';

describe('OibusCertificateFormControlComponent', () => {
  const certificateAttribute: OIBusCertificateAttribute = {
    type: 'certificate',
    key: 'fieldName',
    translationKey: 'configuration.oibus.manifest.south.items.mssql.tracking-instant.field-name',
    validators: [],
    displayProperties: { row: 0, columns: 4, displayInViewMode: true }
  };
  let control: FormControl<string | null>;
  let tester: OIBusFormControlTester<OibusCertificateFormControlComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideI18nTesting()] });
    control = new FormControl<string | null>(null);
    tester = await renderOIBusFormControl(
      OibusCertificateFormControlComponent,
      { certificateAttribute, certificates: testData.certificates.list },
      'fieldName',
      control
    );
  });

  test('should display an empty option and an option for each certificate', async () => {
    const options = tester.root.getByRole('option');
    await expect.element(options).toHaveLength(3);
    await expect.element(options.nth(1)).toHaveTextContent('Certificate 1');
    await expect.element(options.nth(2)).toHaveTextContent('Certificate 2');
  });

  test('should update the control with the id of the selected certificate', async () => {
    await tester.root.getByLabelText('Field name').selectOptions('Certificate 2');

    expect(control.value).toBe(testData.certificates.list[1].id);
  });

  test('should display a value patched from outside', async () => {
    control.setValue(testData.certificates.list[0].id);

    await expect.element(tester.root.getByLabelText('Field name')).toHaveDisplayValue('Certificate 1');
  });
});
