import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { OIBusObjectFormControlComponent } from '../../oibus-object-form-control/oibus-object-form-control.component';
import { OIBusEditArrayElementModalComponent } from './oibus-edit-array-element-modal.component';
import { FormGroup } from '@angular/forms';
import testData from '../../../../../../../backend/src/tests/utils/test-data';
import { OIBusObjectAttribute } from '../../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { DefaultValidationErrorsComponent } from '../../../default-validation-errors/default-validation-errors.component';

class OIBusEditArrayElementModalComponentTester extends ComponentTester<OIBusEditArrayElementModalComponent> {
  constructor() {
    super(OIBusEditArrayElementModalComponent);
  }

  get title() {
    return this.element('h3');
  }

  get settings() {
    return this.debugElement.query(By.directive(OIBusObjectFormControlComponent))!;
  }

  get save() {
    return this.button('#save-button')!;
  }

  get cancel() {
    return this.button('#cancel-button')!;
  }
}

describe('OIBusEditArrayElementModalComponent', () => {
  let tester: OIBusEditArrayElementModalComponentTester;
  let fakeActiveModal: NgbActiveModal;
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
  const scanModes = testData.scanMode.list;
  const certificates = testData.certificates.list;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: fakeActiveModal }]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new OIBusEditArrayElementModalComponentTester();
  });

  it('should cancel', () => {
    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });

  it('should create an element', async () => {
    tester.componentInstance.prepareForCreation(scanModes, certificates, form, objectAttribute);
    await tester.change();
    expect(tester.title).toContainText('Create an element');
    expect(tester.settings).toBeDefined();
    tester.save.click();
    expect(fakeActiveModal.close).toHaveBeenCalledWith({});
  });

  it('should edit an element', async () => {
    tester.componentInstance.prepareForEdition(scanModes, certificates, form, {}, objectAttribute);
    await tester.change();
    expect(tester.title).toContainText('Edit an element');
    expect(tester.settings).toBeDefined();
    tester.save.click();
    expect(fakeActiveModal.close).toHaveBeenCalledWith({});
  });

  it('should copy an element', async () => {
    tester.componentInstance.prepareForCopy(scanModes, certificates, form, {}, objectAttribute);
    await tester.change();
    expect(tester.title).toContainText('Create an element');
    expect(tester.settings).toBeDefined();
    tester.save.click();
    expect(fakeActiveModal.close).toHaveBeenCalledWith({});
  });
});
