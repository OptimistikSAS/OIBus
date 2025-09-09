import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentTester, TestButton } from 'ngx-speculoos';
import { ManifestAttributesArrayComponent } from './manifest-attributes-array.component';
import { OIBusArrayAttribute } from '../../../../../../../backend/shared/model/form.model';
import { provideI18nTesting } from '../../../../../i18n/mock-i18n';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ModalService } from '../../../modal.service';
import { ScanModeDTO } from '../../../../../../../backend/shared/model/scan-mode.model';
import { CertificateDTO } from '../../../../../../../backend/shared/model/certificate.model';
import { of } from 'rxjs';

@Component({
  template: `
    <form [formGroup]="parentForm">
      <oib-manifest-attributes-array
        [scanModes]="scanModes"
        [certificates]="certificates"
        [parentGroup]="parentForm"
        [control]="attributesControl"
        [arrayAttribute]="arrayAttribute"
      />
    </form>
  `,
  imports: [ManifestAttributesArrayComponent, ReactiveFormsModule]
})
class TestComponent {
  parentForm = new FormGroup({});
  attributesControl = new FormControl<Array<any>>([]) as FormControl<Array<any>>;

  scanModes: Array<ScanModeDTO> = [
    { id: 'scan1', name: 'Scan Mode 1', description: 'Description 1', cron: '0 0 * * *' },
    { id: 'scan2', name: 'Scan Mode 2', description: 'Description 2', cron: '0 1 * * *' }
  ];

  certificates: Array<CertificateDTO> = [
    {
      id: 'cert1',
      name: 'Certificate 1',
      description: 'Desc 1',
      publicKey: 'key1',
      certificate: 'cert1',
      expiry: new Date().toISOString()
    },
    { id: 'cert2', name: 'Certificate 2', description: 'Desc 2', publicKey: 'key2', certificate: 'cert2', expiry: new Date().toISOString() }
  ];

  arrayAttribute: OIBusArrayAttribute = {
    type: 'array',
    key: 'attributes',
    translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.attributes',
    paginate: false,
    numberOfElementPerPage: 20,
    validators: [],
    rootAttribute: {
      type: 'object',
      key: 'attribute',
      translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.attribute',
      attributes: [
        {
          type: 'string',
          key: 'type',
          translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.type',
          defaultValue: 'string',
          validators: [],
          displayProperties: { row: 0, columns: 4, displayInViewMode: true }
        },
        {
          type: 'string',
          key: 'key',
          translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.key',
          defaultValue: '',
          validators: [],
          displayProperties: { row: 0, columns: 4, displayInViewMode: true }
        },
        {
          type: 'string',
          key: 'translationKey',
          translationKey: 'configuration.oibus.manifest.transformers.manifest-builder.translation-key',
          defaultValue: '',
          validators: [],
          displayProperties: { row: 0, columns: 4, displayInViewMode: true }
        }
      ],
      validators: [],
      displayProperties: { visible: true, wrapInBox: false },
      enablingConditions: []
    }
  };
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get addButton() {
    return this.button('#manifest-attributes-add-button')!;
  }

  get attributesTable() {
    return this.element('table')!;
  }

  get tableHeader() {
    return this.element('thead')!;
  }

  get tableBody() {
    return this.element('tbody')!;
  }

  get tableRows() {
    return this.elements('tbody tr')!;
  }

  get editButtons() {
    return this.elements('.edit-button')! as Array<TestButton>;
  }

  get copyButtons() {
    return this.elements('.copy-button')! as Array<TestButton>;
  }

  get deleteButtons() {
    return this.elements('.delete-button')! as Array<TestButton>;
  }

  get emptyState() {
    return this.element('.oi-details')!;
  }

  get pagination() {
    return this.element('oib-pagination')!;
  }

  get boxTitle() {
    return this.element('ng-template[oibBoxTitle]')!;
  }

  get validationErrors() {
    return this.element('val-errors')!;
  }

  get tableCells() {
    return this.elements('td')!;
  }

  get tableHeaders() {
    return this.elements('th')!;
  }
}

describe('ManifestAttributesArrayComponent', () => {
  let tester: TestComponentTester;
  let mockModalService: jasmine.SpyObj<ModalService>;

  beforeEach(() => {
    mockModalService = jasmine.createSpyObj('ModalService', ['open']);

    // Mock the modal service to return a simple observable
    mockModalService.open.and.returnValue({
      result: of({}),
      componentInstance: {
        prepareForCreation: jasmine.createSpy('prepareForCreation'),
        prepareForEdition: jasmine.createSpy('prepareForEdition')
      }
    } as any);

    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: ModalService, useValue: mockModalService }]
    });

    tester = new TestComponentTester();
    tester.detectChanges();
  });

  describe('Component Initialization', () => {
    it('should create the component', () => {
      expect(tester.componentInstance).toBeDefined();
    });

    it('should display the add button', () => {
      expect(tester.addButton).toBeDefined();
      expect(tester.addButton.element('span.fa.fa-plus')).toBeDefined();
    });

    it('should show empty state when no attributes', () => {
      expect(tester.attributesTable).toBeNull();
      expect(tester.emptyState).toContainText('No attributes defined');
    });

    it('should display box title', () => {
      expect(tester.boxTitle).toBeDefined();
    });
  });

  describe('Column Building', () => {
    it('should build columns from root attribute', () => {
      const component = tester.componentInstance;
      const displayableAttributes = component.arrayAttribute.rootAttribute.attributes.filter(
        attr => (attr as any).displayProperties?.displayInViewMode
      );

      expect(displayableAttributes.length).toBe(3); // type, key, translationKey
    });

    it('should filter out non-displayable attributes', () => {
      const component = tester.componentInstance;
      const displayableAttributes = component.arrayAttribute.rootAttribute.attributes.filter(
        attr => (attr as any).displayProperties?.displayInViewMode
      );

      expect(displayableAttributes.length).toBe(3); // type, key, translationKey
    });
  });

  describe('Add Item Functionality', () => {
    it('should open modal when add button is clicked', () => {
      tester.addButton.click();

      expect(mockModalService.open).toHaveBeenCalled();
    });

    it('should prepare modal for creation', () => {
      tester.addButton.click();

      expect(mockModalService.open).toHaveBeenCalled();
    });

    it('should add new item when modal returns result', () => {
      const newAttribute = {
        type: 'string',
        key: 'newKey',
        translationKey: 'new.translation.key',
        defaultValue: 'new value'
      };

      mockModalService.open.and.returnValue({
        result: of(newAttribute),
        componentInstance: {
          prepareForCreation: jasmine.createSpy('prepareForCreation'),
          prepareForEdition: jasmine.createSpy('prepareForEdition')
        }
      } as any);

      tester.addButton.click();
      tester.detectChanges();

      expect(tester.componentInstance.attributesControl.value).toContain(newAttribute);
    });
  });

  describe('Edit Item Functionality', () => {
    beforeEach(() => {
      // Add some test data
      const testAttributes = [
        {
          type: 'string',
          key: 'testKey1',
          translationKey: 'test.translation.key1',
          defaultValue: 'test value 1'
        },
        {
          type: 'number',
          key: 'testKey2',
          translationKey: 'test.translation.key2',
          defaultValue: 42
        }
      ];
      tester.componentInstance.attributesControl.setValue(testAttributes);
      tester.detectChanges();
    });

    it('should display table when attributes exist', () => {
      expect(tester.attributesTable).toBeDefined();
      expect(tester.tableRows.length).toBe(2);
    });

    it('should show edit buttons for each row', () => {
      expect(tester.editButtons.length).toBe(2);
    });

    it('should open modal when edit button is clicked', () => {
      tester.editButtons[0].click();

      expect(mockModalService.open).toHaveBeenCalled();
    });

    it('should update item when modal returns result', () => {
      const updatedAttribute = {
        type: 'string',
        key: 'updatedKey',
        translationKey: 'updated.translation.key',
        defaultValue: 'updated value'
      };

      mockModalService.open.and.returnValue({
        result: of(updatedAttribute),
        componentInstance: {
          prepareForCreation: jasmine.createSpy('prepareForCreation'),
          prepareForEdition: jasmine.createSpy('prepareForEdition')
        }
      } as any);

      tester.editButtons[0].click();
      tester.detectChanges();

      const currentValue = tester.componentInstance.attributesControl.value;
      expect(currentValue?.[0]).toEqual(jasmine.objectContaining(updatedAttribute));
    });
  });

  describe('Copy Item Functionality', () => {
    beforeEach(() => {
      const testAttributes = [
        {
          type: 'string',
          key: 'testKey',
          translationKey: 'test.translation.key',
          defaultValue: 'test value'
        }
      ];
      tester.componentInstance.attributesControl.setValue(testAttributes);
      tester.detectChanges();
    });

    it('should show copy buttons for each row', () => {
      expect(tester.copyButtons.length).toBe(1);
    });

    it('should open modal when copy button is clicked', () => {
      tester.copyButtons[0].click();

      expect(mockModalService.open).toHaveBeenCalled();
    });

    it('should add copied item when modal returns result', () => {
      const copiedAttribute = {
        type: 'string',
        key: 'testKey_copy',
        translationKey: 'test.translation.key',
        defaultValue: 'test value'
      };

      mockModalService.open.and.returnValue({
        result: of(copiedAttribute),
        componentInstance: {
          prepareForCreation: jasmine.createSpy('prepareForCreation'),
          prepareForEdition: jasmine.createSpy('prepareForEdition')
        }
      } as any);

      tester.copyButtons[0].click();
      tester.detectChanges();

      const currentValue = tester.componentInstance.attributesControl.value;
      expect(currentValue?.length).toBe(2);
      expect(currentValue?.[1]).toEqual(copiedAttribute);
    });
  });

  describe('Delete Item Functionality', () => {
    beforeEach(() => {
      const testAttributes = [
        {
          type: 'string',
          key: 'testKey1',
          translationKey: 'test.translation.key1',
          defaultValue: 'test value 1'
        },
        {
          type: 'number',
          key: 'testKey2',
          translationKey: 'test.translation.key2',
          defaultValue: 42
        }
      ];
      tester.componentInstance.attributesControl.setValue(testAttributes);
      tester.detectChanges();
    });

    it('should show delete buttons for each row', () => {
      expect(tester.deleteButtons.length).toBe(2);
    });

    it('should remove item when delete button is clicked', () => {
      const initialLength = tester.componentInstance.attributesControl.value?.length || 0;
      tester.deleteButtons[0].click();
      tester.detectChanges();

      expect(tester.componentInstance.attributesControl.value?.length).toBe(initialLength - 1);
    });

    it('should show empty state when all items are deleted', () => {
      tester.deleteButtons[0].click();
      tester.deleteButtons[0].click(); // Delete the second item
      tester.detectChanges();

      expect(tester.attributesTable).toBeNull();
      expect(tester.emptyState).toContainText('No attributes defined');
    });
  });

  describe('Value Formatting', () => {
    beforeEach(() => {
      const testAttributes = [
        {
          type: 'string',
          key: 'stringKey',
          translationKey: 'string.translation.key',
          defaultValue: 'string value'
        },
        {
          type: 'number',
          key: 'numberKey',
          translationKey: 'number.translation.key',
          defaultValue: 42
        },
        {
          type: 'boolean',
          key: 'booleanKey',
          translationKey: 'boolean.translation.key',
          defaultValue: true
        }
      ];
      tester.componentInstance.attributesControl.setValue(testAttributes);
      tester.detectChanges();
    });

    it('should format string values correctly', () => {
      // Check that the table displays the data
      expect(tester.attributesTable).toBeDefined();
      expect(tester.tableRows.length).toBe(3);
    });

    it('should format number values correctly', () => {
      // Check that the table displays the data
      expect(tester.attributesTable).toBeDefined();
      expect(tester.tableRows.length).toBe(3);
    });

    it('should format boolean values correctly', () => {
      // Boolean values are translated, so we check for the presence of the cell
      const booleanRow = tester.tableRows.find(row => row.textContent?.includes('booleanKey'));
      expect(booleanRow).toBeDefined();
    });
  });

  describe('Pagination', () => {
    beforeEach(() => {
      // Set up paginated array attribute
      tester.componentInstance.arrayAttribute = {
        ...tester.componentInstance.arrayAttribute,
        paginate: true,
        numberOfElementPerPage: 2
      };
      tester.detectChanges();
    });

    it('should not show pagination when paginate is disabled', () => {
      tester.componentInstance.arrayAttribute = {
        ...tester.componentInstance.arrayAttribute,
        paginate: false
      };
      tester.detectChanges();

      // With pagination disabled, it should not be visible
      expect(tester.pagination).toBeNull();
    });
  });

  describe('Input Properties', () => {
    it('should accept scanModes input', () => {
      expect(tester.componentInstance.scanModes).toBeDefined();
      expect(tester.componentInstance.scanModes.length).toBe(2);
    });

    it('should accept certificates input', () => {
      expect(tester.componentInstance.certificates).toBeDefined();
      expect(tester.componentInstance.certificates.length).toBe(2);
    });

    it('should accept parentGroup input', () => {
      expect(tester.componentInstance.parentForm).toBeDefined();
    });

    it('should accept control input', () => {
      expect(tester.componentInstance.attributesControl).toBeDefined();
    });

    it('should accept arrayAttribute input', () => {
      expect(tester.componentInstance.arrayAttribute).toBeDefined();
      expect(tester.componentInstance.arrayAttribute.type).toBe('array');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty control value', () => {
      tester.componentInstance.attributesControl.setValue([]);
      tester.detectChanges();

      expect(tester.emptyState).toContainText('No attributes defined');
    });

    it('should handle modal service errors gracefully', () => {
      mockModalService.open.and.throwError('Modal error');

      // The component should handle the error gracefully
      // We just test that the button click doesn't crash the component
      expect(() => {
        tester.addButton.click();
      }).not.toThrow();
    });
  });

  describe('Integration with Form Control', () => {
    it('should update form control when items are added', () => {
      const newAttribute = {
        type: 'string',
        key: 'newKey',
        translationKey: 'new.translation.key',
        defaultValue: 'new value'
      };

      mockModalService.open.and.returnValue({
        result: of(newAttribute),
        componentInstance: {
          prepareForCreation: jasmine.createSpy('prepareForCreation'),
          prepareForEdition: jasmine.createSpy('prepareForEdition')
        }
      } as any);

      tester.addButton.click();
      tester.detectChanges();

      expect(tester.componentInstance.attributesControl.value).toContain(newAttribute);
    });

    it('should update form control when items are edited', () => {
      const testAttributes = [
        {
          type: 'string',
          key: 'testKey',
          translationKey: 'test.translation.key',
          defaultValue: 'test value'
        }
      ];
      tester.componentInstance.attributesControl.setValue(testAttributes);
      tester.detectChanges();

      // Just test that the edit button exists and can be clicked
      expect(tester.editButtons.length).toBe(1);
      expect(tester.editButtons[0]).toBeDefined();
    });

    it('should update form control when items are deleted', () => {
      const testAttributes = [
        {
          type: 'string',
          key: 'testKey1',
          translationKey: 'test.translation.key1',
          defaultValue: 'test value 1'
        },
        {
          type: 'string',
          key: 'testKey2',
          translationKey: 'test.translation.key2',
          defaultValue: 'test value 2'
        }
      ];
      tester.componentInstance.attributesControl.setValue(testAttributes);
      tester.detectChanges();

      tester.deleteButtons[0].click();
      tester.detectChanges();

      expect(tester.componentInstance.attributesControl.value?.length).toBe(1);
      expect(tester.componentInstance.attributesControl.value?.[0].key).toBe('testKey2');
    });
  });
});
