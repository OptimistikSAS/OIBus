import { Component } from '@angular/core';
import { ComponentTester } from 'ngx-speculoos';
import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ReactiveFormsModule } from '@angular/forms';
import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { ManifestNestedAttributesModalComponent } from './manifest-nested-attributes-modal.component';
import { ScanModeDTO } from '../../../../../../../backend/shared/model/scan-mode.model';
import { CertificateDTO } from '../../../../../../../backend/shared/model/certificate.model';

@Component({
  template: `<oib-manifest-nested-attributes-modal />`,
  imports: [ManifestNestedAttributesModalComponent]
})
class TestComponent {}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get modalComponent(): ManifestNestedAttributesModalComponent {
    return this.component(ManifestNestedAttributesModalComponent);
  }

  get typeSelect() {
    return this.select('select[formControlName="type"]')!;
  }

  get keyInput() {
    return this.input('input[formControlName="key"]')!;
  }

  get translationKeyInput() {
    return this.input('input[formControlName="translationKey"]')!;
  }

  get saveButton() {
    return this.button('[oib-save-button]')!;
  }

  get cancelButton() {
    return this.button('#cancel-button')!;
  }
}

describe('ManifestNestedAttributesModalComponent', () => {
  let tester: TestComponentTester;
  let mockActiveModal: jasmine.SpyObj<NgbActiveModal>;

  const mockScanModes: Array<ScanModeDTO> = [];
  const mockCertificates: Array<CertificateDTO> = [];

  beforeEach(() => {
    mockActiveModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, ManifestNestedAttributesModalComponent],
      providers: [{ provide: NgbActiveModal, useValue: mockActiveModal }, provideI18nTesting()]
    });

    tester = new TestComponentTester();
    tester.detectChanges();
  });

  it('should create', () => {
    expect(tester.modalComponent).toBeTruthy();
  });

  describe('Recursion Depth', () => {
    it('should show recursion depth indicator when depth > 0', () => {
      tester.modalComponent.prepareForCreation(mockScanModes, mockCertificates, ['parent', 'child'], 2);
      tester.detectChanges();

      expect(tester.modalComponent.recursionDepth).toBe(2);
    });

    it('should not show recursion depth indicator when depth = 0', () => {
      tester.modalComponent.prepareForCreation(mockScanModes, mockCertificates, [], 0);
      tester.detectChanges();

      expect(tester.modalComponent.recursionDepth).toBe(0);
    });
  });

  describe('Context Path', () => {
    it('should set context path correctly', () => {
      const contextPath = ['parent', 'child', 'grandchild'];
      tester.modalComponent.prepareForCreation(mockScanModes, mockCertificates, contextPath, 1);
      tester.detectChanges();

      expect(tester.modalComponent.nestedAttributesContext).toEqual([...contextPath, '']);
    });

    it('should include current attribute key in context path', () => {
      const contextPath = ['parent', 'child'];
      tester.modalComponent.prepareForCreation(mockScanModes, mockCertificates, contextPath, 1);
      tester.keyInput.fillWith('testKey');
      tester.detectChanges();

      expect(tester.modalComponent.nestedAttributesContext).toEqual([...contextPath, 'testKey']);
    });
  });

  describe('Modal Actions', () => {
    beforeEach(() => {
      tester.modalComponent.prepareForCreation(mockScanModes, mockCertificates);
      tester.detectChanges();
    });

    it('should dismiss modal when cancel button is clicked', () => {
      tester.cancelButton.click();

      expect(mockActiveModal.dismiss).toHaveBeenCalled();
    });

    it('should close modal with attribute when form is valid and submitted', () => {
      tester.keyInput.fillWith('testKey');
      tester.translationKeyInput.fillWith('test.translation.key');
      tester.detectChanges();

      tester.modalComponent.submit();

      expect(mockActiveModal.close).toHaveBeenCalled();
      const closedAttribute = mockActiveModal.close.calls.mostRecent().args[0];
      expect(closedAttribute.type).toBe('string');
      expect(closedAttribute.key).toBe('testKey');
    });

    it('should not close modal when form is invalid', () => {
      // Leave required fields empty
      tester.keyInput.fillWith('');
      tester.detectChanges();

      tester.modalComponent.submit();

      expect(mockActiveModal.close).not.toHaveBeenCalled();
    });
  });
});
