import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { OIBusObjectAttribute } from '@oibus/shared/connector/form.model';

import testData from '../../../../../../../backend/src/tests/utils/test-data';
import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../../../test/vitest-create-mock';
import { OIBusEditArrayElementModalComponent } from './oibus-edit-array-element-modal.component';

class OIBusEditArrayElementModalComponentTester {
  readonly fixture = TestBed.createComponent(OIBusEditArrayElementModalComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly title = this.root.getByRole('heading', { level: 3 });
  readonly save = this.root.getByCss('#save-button');
  readonly cancel = this.root.getByCss('#cancel-button');
  readonly settings = this.root.getByCss('oib-oibus-object-form-control');
}

describe('OIBusEditArrayElementModalComponent', () => {
  let tester: OIBusEditArrayElementModalComponentTester;
  let fakeActiveModal: MockObject<NgbActiveModal>;
  const form = new FormGroup({ settings: new FormGroup({}) });
  const objectAttribute: OIBusObjectAttribute = {
    type: 'object',
    key: 'item',
    translationKey: 'configuration.oibus.manifest.transformers.title',
    validators: [],
    attributes: [],
    enablingConditions: [],
    displayProperties: {
      visible: true,
      wrapInBox: false
    }
  };
  const scanModes = testData.scanMode.list as unknown as Array<ScanModeDTO>;
  const certificates = testData.certificates.list as unknown as Array<CertificateDTO>;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });

    tester = new OIBusEditArrayElementModalComponentTester();
    tester.fixture.detectChanges();
  });

  test('should cancel', async () => {
    await tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });

  test('should create an element', async () => {
    tester.component.prepareForCreation(scanModes, certificates, form, objectAttribute);
    tester.fixture.detectChanges();
    await expect.element(tester.title).toMatchTextContent('Create an element');
    await expect.element(tester.settings).toBeInTheDocument();
    await tester.save.click();
    expect(fakeActiveModal.close).toHaveBeenCalledWith(undefined);
  });

  test('should edit an element', async () => {
    tester.component.prepareForEdition(scanModes, certificates, form, {}, objectAttribute);
    tester.fixture.detectChanges();
    await expect.element(tester.title).toMatchTextContent('Edit an element');
    await expect.element(tester.settings).toBeInTheDocument();
    await tester.save.click();
    expect(fakeActiveModal.close).toHaveBeenCalledWith(undefined);
  });

  test('should copy an element', async () => {
    tester.component.prepareForCopy(scanModes, certificates, form, {}, objectAttribute);
    tester.fixture.detectChanges();
    await expect.element(tester.title).toMatchTextContent('Create an element');
    await expect.element(tester.settings).toBeInTheDocument();
    await tester.save.click();
    expect(fakeActiveModal.close).toHaveBeenCalledWith(undefined);
  });
});
