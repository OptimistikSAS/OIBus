import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { OIBusCertificateAttribute } from '@oibus/shared/connector/form.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { CertificateCreator } from '../../../engine/certificate-list/certificate-creator.service';
import { OIBusFormControlTester, renderOIBusFormControl } from '../oibus-form-control.testing';
import { chooseSelectOrCreateEntry, selectOrCreateEntryNames } from '../select-or-create/select-or-create.testing';
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

  let certificateCreator: MockObject<CertificateCreator>;

  beforeEach(async () => {
    certificateCreator = createMock(CertificateCreator, { createLabel: 'engine.certificate.create-new', created: signal([]) });
    TestBed.configureTestingModule({ providers: [provideI18nTesting(), { provide: CertificateCreator, useValue: certificateCreator }] });
    control = new FormControl<string | null>(null);
    tester = await renderOIBusFormControl(
      OibusCertificateFormControlComponent,
      { certificateAttribute, certificates: testData.certificates.list },
      'fieldName',
      control
    );
  });

  test('should offer no certificate, each certificate, and to create one', async () => {
    expect(await selectOrCreateEntryNames(tester.root.getByLabelText('Field name'))).toEqual([
      'No certificate',
      'Certificate 1',
      'Certificate 2',
      'Create a new certificate...'
    ]);
  });

  test('should update the control with the id of the selected certificate', async () => {
    await chooseSelectOrCreateEntry(tester.root.getByLabelText('Field name'), 'Certificate 2');

    expect(control.value).toBe(testData.certificates.list[1].id);
  });

  test('should select a created certificate', async () => {
    const created: CertificateDTO = { ...testData.certificates.list[0], id: 'created', name: 'Created certificate' };
    certificateCreator.create.mockReturnValue(of(created));

    await chooseSelectOrCreateEntry(tester.root.getByLabelText('Field name'), 'Create a new certificate...');

    expect(control.value).toBe('created');
  });

  test('should display a value patched from outside', async () => {
    control.setValue(testData.certificates.list[0].id);

    await expect.element(tester.root.getByLabelText('Field name')).toHaveTextContent('Certificate 1');
  });
});
