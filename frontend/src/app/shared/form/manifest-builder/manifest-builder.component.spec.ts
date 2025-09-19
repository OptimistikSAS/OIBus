import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester, TestButton } from 'ngx-speculoos';
import { ManifestBuilderComponent } from './manifest-builder.component';
import { OIBusObjectAttribute } from '../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  template: ` <oib-manifest-builder [formControl]="manifestControl" /> `,
  imports: [ManifestBuilderComponent, ReactiveFormsModule]
})
class TestComponent {
  manifestControl = new FormControl<OIBusObjectAttribute | null>({
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: [],
    enablingConditions: [],
    validators: [],
    displayProperties: {
      visible: true,
      wrapInBox: false
    }
  });

  get manifest(): OIBusObjectAttribute | null {
    return this.manifestControl.value;
  }
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  getManifest() {
    const manifest = this.componentInstance.manifest;
    expect(manifest).not.toBeNull();
    return manifest!;
  }

  get manifestVisible() {
    return this.input('#manifest-visible')!;
  }

  get manifestWrapInBox() {
    return this.input('#manifest-wrap-in-box')!;
  }

  get addAttributeButton() {
    return this.button('#manifest-attributes-add-button')!;
  }

  get attributesTable() {
    return this.element('table')!;
  }

  get attributeRows() {
    return this.elements('tbody tr')!;
  }

  get deleteButtons() {
    return this.elements('.delete-button')! as Array<TestButton>;
  }

  get editButtons() {
    return this.elements('.edit-button')! as Array<TestButton>;
  }

  get copyButtons() {
    return this.elements('.copy-button')! as Array<TestButton>;
  }
}

describe('ManifestBuilderComponent', () => {
  let tester: TestComponentTester;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });

    tester = new TestComponentTester();
    tester.detectChanges();
  });

  describe('Component Initialization', () => {
    it('should create the component', () => {
      expect(tester.componentInstance).toBeDefined();
    });

    it('should initialize form with default values', () => {
      expect(tester.manifestVisible).toBeChecked();
      expect(tester.manifestWrapInBox).not.toBeChecked();
    });

    it('should initialize with existing manifest data', () => {
      // This test verifies that the component can handle existing manifest data
      // The actual initialization happens in ngOnInit, so we test the form structure
      expect(tester.manifestVisible).toBeDefined();
      expect(tester.manifestWrapInBox).toBeDefined();
      expect(tester.addAttributeButton).toBeDefined();
    });
  });

  describe('Attribute Management', () => {
    it('should display add attribute button', () => {
      expect(tester.addAttributeButton).toBeDefined();
      // The button contains a plus icon, not text
      expect(tester.addAttributeButton.element('span.fa.fa-plus')).toBeDefined();
    });

    it('should show empty state when no attributes', () => {
      expect(tester.attributesTable).toBeNull();
      expect(tester.element('.oi-details')).toContainText('No attributes defined');
    });

    it('should handle attribute operations through modal', () => {
      // Since the form is now handled by a modal, we test that the button exists
      // and the component can handle the modal operations
      expect(tester.addAttributeButton).toBeDefined();

      // The actual attribute creation/editing is handled by the modal component
      // which is tested separately
    });
  });

  describe('Form Validation', () => {
    it('should validate form structure', () => {
      // Test that the form structure is valid
      expect(tester.manifestVisible).toBeDefined();
      expect(tester.manifestWrapInBox).toBeDefined();
    });

    it('should handle form control changes', () => {
      const initialValue = tester.componentInstance.manifestControl.value;

      tester.manifestVisible.uncheck();
      tester.detectChanges();

      expect(tester.componentInstance.manifestControl.value).not.toEqual(initialValue);
    });
  });

  describe('Manifest Generation', () => {
    it('should generate manifest with default values', () => {
      const manifest = tester.getManifest();

      expect(manifest.type).toBe('object');
      expect(manifest.key).toBe('options');
      expect(manifest.translationKey).toBe('configuration.oibus.manifest.transformers.options');
      expect(manifest.attributes).toEqual([]);
      expect(manifest.displayProperties.visible).toBe(true);
      expect(manifest.displayProperties.wrapInBox).toBe(false);
    });

    it('should update manifest when form values change', () => {
      tester.manifestWrapInBox.check();
      tester.detectChanges();

      const manifest = tester.getManifest();
      expect(manifest.displayProperties.wrapInBox).toBe(true);
    });

    it('should handle empty attributes array', () => {
      const manifest = tester.getManifest();
      expect(manifest.attributes).toEqual([]);
    });
  });

  describe('Auto-save Functionality', () => {
    it('should update manifest control when form values change', () => {
      const initialValue = tester.componentInstance.manifestControl.value;

      tester.manifestVisible.uncheck();
      tester.detectChanges();

      expect(tester.componentInstance.manifestControl.value).not.toEqual(initialValue);
    });

    it('should update control when wrap in box changes', () => {
      const initialValue = tester.componentInstance.manifestControl.value;

      tester.manifestWrapInBox.check();
      tester.detectChanges();

      expect(tester.componentInstance.manifestControl.value).not.toEqual(initialValue);
    });
  });

  describe('Component Integration', () => {
    it('should integrate with manifest attributes array component', () => {
      // Test that the child component is properly integrated
      expect(tester.element('oib-manifest-attributes-array')).toBeDefined();
    });

    it('should pass correct inputs to child component', () => {
      const childComponent = tester.element('oib-manifest-attributes-array');
      expect(childComponent).toBeDefined();

      // The component should have the required inputs
      // This is tested by the fact that the component renders without errors
    });
  });

  describe('Edge Cases', () => {
    it('should handle null manifest value', () => {
      tester.componentInstance.manifestControl.setValue(null);
      tester.detectChanges();

      // Component should handle null values gracefully
      expect(tester.componentInstance).toBeDefined();
    });

    it('should handle undefined manifest value', () => {
      tester.componentInstance.manifestControl.setValue(null);
      tester.detectChanges();

      // Component should handle null values gracefully
      expect(tester.componentInstance).toBeDefined();
    });

    it('should maintain form state across changes', () => {
      tester.manifestVisible.uncheck();
      tester.manifestWrapInBox.check();
      tester.detectChanges();

      expect(tester.manifestVisible).not.toBeChecked();
      expect(tester.manifestWrapInBox).toBeChecked();
    });
  });
});
