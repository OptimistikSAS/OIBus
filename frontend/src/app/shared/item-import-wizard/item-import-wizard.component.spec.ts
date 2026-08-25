import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { of } from 'rxjs';
import { ExistingItemForMatch, ItemImportWizardComponent, WizardCheckFn, WizardCheckResult } from './item-import-wizard.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { createMock, MockObject } from '../../../test/vitest-create-mock';
import { SouthConnectorExploreEntry, SouthConnectorManifest } from '../../../../../backend/shared/model/south-connector.model';
import { deriveItemImportFields } from '../form/item-import-fields.util';

function noopCheckFn(): WizardCheckFn {
  return () => of({ items: [], errors: [] });
}

function prepareWizard(
  component: ItemImportWizardComponent,
  nodes: Array<SouthConnectorExploreEntry>,
  existingItems: Array<ExistingItemForMatch>,
  checkFn: WizardCheckFn
) {
  const manifest = buildManifest();
  const { expectedHeaders, optionalHeaders } = deriveItemImportFields(manifest);
  component.prepare(manifest, expectedHeaders, optionalHeaders, nodes, existingItems, checkFn);
}

function displayProps(row = 0, columns = 4) {
  return { row, columns, displayInViewMode: true };
}

function buildManifest(): SouthConnectorManifest {
  return {
    items: {
      rootAttribute: {
        attributes: [
          {
            type: 'string',
            key: 'name',
            translationKey: 'common.yes',
            defaultValue: null,
            validators: [],
            displayProperties: displayProps()
          },
          {
            type: 'boolean',
            key: 'enabled',
            translationKey: 'common.yes',
            defaultValue: true,
            validators: [],
            displayProperties: displayProps()
          },
          {
            type: 'scan-mode',
            key: 'scanMode',
            acceptableType: 'POLL',
            translationKey: 'common.yes',
            validators: [],
            displayProperties: displayProps()
          },
          {
            type: 'object',
            key: 'settings',
            translationKey: 'common.yes',
            displayProperties: { visible: true, wrapInBox: true },
            enablingConditions: [{ targetPathFromRoot: 'maxAge', referralPathFromRoot: 'mode', values: ['HA'], operator: 'EQUALS' }],
            validators: [],
            attributes: [
              {
                type: 'string',
                key: 'nodeId',
                translationKey: 'common.yes',
                defaultValue: null,
                validators: [],
                displayProperties: displayProps()
              },
              {
                type: 'boolean',
                key: 'preserveFiles',
                translationKey: 'common.yes',
                defaultValue: false,
                validators: [],
                displayProperties: displayProps()
              },
              {
                type: 'string-select',
                key: 'mode',
                translationKey: 'configuration.oibus.manifest.south.items.mssql.tracking-instant.date-time-input.type',
                selectableValues: ['iso-string', 'unix-epoch'],
                defaultValue: 'iso-string',
                validators: [],
                displayProperties: displayProps()
              },
              {
                type: 'number',
                key: 'maxAge',
                translationKey: 'common.yes',
                defaultValue: 0,
                unit: null,
                validators: [],
                displayProperties: displayProps()
              }
            ]
          }
        ]
      }
    }
  } as unknown as SouthConnectorManifest;
}

const nodes: Array<SouthConnectorExploreEntry> = [
  { id: 'n1', name: 'Node1', metadata: { nodeId: 'ns=1;s=A', dataType: 'Float' }, hasChildren: false },
  { id: 'n2', name: 'Node2', metadata: { nodeId: 'ns=1;s=B', dataType: 'Int' }, hasChildren: false }
];

class ItemImportWizardComponentTester {
  readonly fixture = TestBed.createComponent(ItemImportWizardComponent);
  readonly component = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
}

describe('ItemImportWizardComponent', () => {
  let tester: ItemImportWizardComponentTester;
  let activeModal: MockObject<NgbActiveModal>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    TestBed.configureTestingModule({
      providers: [provideI18nTesting(), { provide: NgbActiveModal, useValue: activeModal }]
    });
    tester = new ItemImportWizardComponentTester();
  });

  test('the name field defaults to mapping the node own name from metadata', () => {
    prepareWizard(tester.component, nodes, [], noopCheckFn());

    const nameMapping = tester.component.mappings.find(mapping => mapping.field === 'name')!;

    expect(nameMapping.source).toBe('metadata');
    expect(nameMapping.metadataKey).toBe('name');
  });

  test('required vs optional headers are reflected on the mappings', () => {
    prepareWizard(tester.component, nodes, [], noopCheckFn());

    const required = tester.component.mappings.filter(mapping => mapping.required).map(mapping => mapping.field);
    const optional = tester.component.mappings.filter(mapping => !mapping.required).map(mapping => mapping.field);

    expect(required).toEqual(['name', 'enabled', 'settings_nodeId', 'settings_preserveFiles', 'settings_mode']);
    expect(optional).toEqual(['settings_maxAge']);
  });

  test('buildRows resolves metadata-sourced and constant-sourced fields per node', () => {
    prepareWizard(tester.component, nodes, [], noopCheckFn());

    const nodeIdMapping = tester.component.mappings.find(mapping => mapping.field === 'settings_nodeId')!;
    nodeIdMapping.source = 'metadata';
    nodeIdMapping.metadataKey = 'nodeId';

    const preserveFilesMapping = tester.component.mappings.find(mapping => mapping.field === 'settings_preserveFiles')!;
    preserveFilesMapping.constantValue = true;

    const rows = tester.component.buildRows();

    expect(rows).toEqual([
      {
        name: 'Node1',
        enabled: 'true',
        settings_nodeId: 'ns=1;s=A',
        settings_preserveFiles: 'true',
        settings_mode: 'iso-string',
        settings_maxAge: '0'
      },
      {
        name: 'Node2',
        enabled: 'true',
        settings_nodeId: 'ns=1;s=B',
        settings_preserveFiles: 'true',
        settings_mode: 'iso-string',
        settings_maxAge: '0'
      }
    ]);
  });

  test('buildRows falls back to an empty string when a metadata field has no key selected', () => {
    prepareWizard(tester.component, nodes, [], noopCheckFn());

    const nodeIdMapping = tester.component.mappings.find(mapping => mapping.field === 'settings_nodeId')!;
    nodeIdMapping.source = 'metadata';
    nodeIdMapping.metadataKey = null;

    const rows = tester.component.buildRows();

    expect(rows[0]['settings_nodeId']).toBe('');
  });

  test('buildRows resolves the synthetic id metadata key to the node id', () => {
    prepareWizard(tester.component, nodes, [], noopCheckFn());

    const nodeIdMapping = tester.component.mappings.find(mapping => mapping.field === 'settings_nodeId')!;
    nodeIdMapping.source = 'metadata';
    nodeIdMapping.metadataKey = 'id';

    const rows = tester.component.buildRows();

    expect(rows[0]['settings_nodeId']).toBe('n1');
    expect(rows[1]['settings_nodeId']).toBe('n2');
  });

  test('matchKeyOptions only includes settings fields that are currently mapped', () => {
    prepareWizard(tester.component, nodes, [], noopCheckFn());

    // settings_nodeId switched to metadata but no key chosen yet -> not usable as a match key
    const nodeIdMapping = tester.component.mappings.find(mapping => mapping.field === 'settings_nodeId')!;
    nodeIdMapping.source = 'metadata';
    nodeIdMapping.metadataKey = null;

    // settings_preserveFiles and settings_mode stay constant-mapped by default -> usable
    const options = tester.component.matchKeyOptions;

    expect(options).toContain('name');
    expect(options).toContain('settings_preserveFiles');
    expect(options).toContain('settings_mode');
    expect(options).toContain('settings_maxAge');
    expect(options).not.toContain('settings_nodeId');
  });

  test('matchKeyOptions includes a metadata-mapped field once a key is chosen', () => {
    prepareWizard(tester.component, nodes, [], noopCheckFn());

    const nodeIdMapping = tester.component.mappings.find(mapping => mapping.field === 'settings_nodeId')!;
    nodeIdMapping.source = 'metadata';
    nodeIdMapping.metadataKey = 'nodeId';

    expect(tester.component.matchKeyOptions).toContain('settings_nodeId');
  });

  test('setSource switches a mapping to metadata and picks a default key', () => {
    prepareWizard(tester.component, nodes, [], noopCheckFn());

    const preserveFilesMapping = tester.component.mappings.find(mapping => mapping.field === 'settings_preserveFiles')!;
    expect(preserveFilesMapping.metadataKey).toBeNull();

    tester.component.setSource(preserveFilesMapping, 'metadata');

    expect(preserveFilesMapping.source).toBe('metadata');
    expect(preserveFilesMapping.metadataKey).not.toBeNull();
  });

  test('renders a boolean control for a boolean settings attribute', async () => {
    prepareWizard(tester.component, nodes, [], noopCheckFn());
    tester.fixture.detectChanges();

    await expect
      .element(tester.root.getByCss('.field-mapping-row[data-field="settings_preserveFiles"] oib-oibus-boolean-form-control'))
      .toBeInTheDocument();
  });

  test('renders a string-select control for a string-select settings attribute', async () => {
    prepareWizard(tester.component, nodes, [], noopCheckFn());
    tester.fixture.detectChanges();

    await expect
      .element(tester.root.getByCss('.field-mapping-row[data-field="settings_mode"] oib-oibus-string-select-form-control'))
      .toBeInTheDocument();
  });

  test('renders a string control for a string settings attribute', async () => {
    prepareWizard(tester.component, nodes, [], noopCheckFn());
    tester.fixture.detectChanges();

    await expect
      .element(tester.root.getByCss('.field-mapping-row[data-field="settings_nodeId"] oib-oibus-string-form-control'))
      .toBeInTheDocument();
  });

  test('getWizardResult exposes mappings, matchKey, and built rows', () => {
    prepareWizard(tester.component, nodes, [], noopCheckFn());
    tester.component.matchKey = 'name';

    const result = tester.component.getWizardResult();

    expect(result.matchKey).toBe('name');
    expect(result.mappings).toBe(tester.component.mappings);
    expect(result.rows.length).toBe(2);
  });

  test('cancel dismisses the modal', () => {
    prepareWizard(tester.component, nodes, [], noopCheckFn());

    tester.component.cancel();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  describe('step 3 (preview/check)', () => {
    function matchedResult(): WizardCheckResult {
      return {
        items: [
          { id: 'existing-1', name: 'Node1', settings: {} },
          { id: '', name: 'Node2', settings: {} }
        ],
        errors: []
      };
    }

    test('entering step 3 triggers the check call with the built rows and match key', () => {
      const checkFn = vi.fn().mockReturnValue(of({ items: [], errors: [] }));
      prepareWizard(tester.component, nodes, [], checkFn);
      tester.component.matchKey = 'name';

      tester.component.goNext();
      tester.component.goNext();

      expect(tester.component.currentStep).toBe(3);
      expect(checkFn).toHaveBeenCalledWith(tester.component.rows, 'name');
      expect(tester.component.rows.length).toBe(2);
    });

    test('toggleRowEditing sets the editing row index and toggles it back off', () => {
      const checkFn = vi.fn().mockReturnValue(of({ items: [], errors: [] }));
      prepareWizard(tester.component, nodes, [], checkFn);
      tester.component.goNext();
      tester.component.goNext();

      expect(tester.component.editingRowIndex).toBeNull();

      tester.component.toggleRowEditing(1);
      expect(tester.component.editingRowIndex).toBe(1);

      tester.component.toggleRowEditing(1);
      expect(tester.component.editingRowIndex).toBeNull();

      tester.component.toggleRowEditing(1);
      tester.component.toggleRowEditing(0);
      expect(tester.component.editingRowIndex).toBe(0);
    });

    test('renders the preview table in step 3', async () => {
      const checkFn = vi.fn().mockReturnValue(of({ items: [], errors: [] }));
      prepareWizard(tester.component, nodes, [], checkFn);
      tester.component.goNext();
      tester.component.goNext();
      tester.fixture.detectChanges();

      await expect.element(tester.root.getByCss('#preview-table')).toBeInTheDocument();
    });

    test('the edit toggle gates inputs on its own row only, not on a shared column index', async () => {
      const checkFn = vi.fn().mockReturnValue(of({ items: [], errors: [] }));
      prepareWizard(tester.component, nodes, [], checkFn);
      tester.component.goNext();
      tester.component.goNext();
      tester.fixture.detectChanges();

      const rows = tester.root.getByCss('.preview-row');
      const secondRowEditButton = rows.nth(1).getByCss('.fa-pencil');
      await secondRowEditButton.click();
      tester.fixture.detectChanges();

      const firstRowInputs = rows.nth(0).getByCss('.preview-cell-input');
      const secondRowInputs = rows.nth(1).getByCss('.preview-cell-input');
      expect(firstRowInputs.elements().length).toBe(0);
      expect(secondRowInputs.elements().length).toBe(tester.component.mappings.length);
    });

    test('editing a cell updates the row and re-triggers the check call', () => {
      const checkFn = vi.fn().mockReturnValue(of({ items: [], errors: [] }));
      prepareWizard(tester.component, nodes, [], checkFn);
      tester.component.goNext();
      tester.component.goNext();
      checkFn.mockClear();

      tester.component.onCellInput(0, 'name', { target: { value: 'RenamedNode' } } as unknown as Event);

      expect(tester.component.rows[0]['name']).toBe('RenamedNode');
      expect(checkFn).toHaveBeenCalledTimes(1);
    });

    test('add row appends a blank row and re-triggers the check call', () => {
      const checkFn = vi.fn().mockReturnValue(of({ items: [], errors: [] }));
      prepareWizard(tester.component, nodes, [], checkFn);
      tester.component.goNext();
      tester.component.goNext();
      checkFn.mockClear();

      tester.component.addRow();

      expect(tester.component.rows.length).toBe(3);
      expect(tester.component.rows[2]['name']).toBe('');
      expect(checkFn).toHaveBeenCalledTimes(1);
    });

    test('remove row removes it and re-triggers the check call', () => {
      const checkFn = vi.fn().mockReturnValue(of({ items: [], errors: [] }));
      prepareWizard(tester.component, nodes, [], checkFn);
      tester.component.goNext();
      tester.component.goNext();
      checkFn.mockClear();

      tester.component.removeRow(0);

      expect(tester.component.rows.length).toBe(1);
      expect(tester.component.rows[0]['name']).toBe('Node2');
      expect(checkFn).toHaveBeenCalledTimes(1);
    });

    test('a matched row defaults its resolution to update, and the global toggle pre-fills matched rows', () => {
      const checkFn = vi.fn().mockReturnValue(of(matchedResult()));
      prepareWizard(tester.component, nodes, [], checkFn);
      tester.component.goNext();
      tester.component.goNext();

      expect(tester.component.isMatchedRow(tester.component.rows[0])).toBe(true);
      expect(tester.component.isMatchedRow(tester.component.rows[1])).toBe(false);
      expect(tester.component.resolutionForRow(0)).toBe('update');

      tester.component.setGlobalResolution('skip');

      expect(tester.component.resolutionForRow(0)).toBe('skip');

      tester.component.setRowResolution(0, 'update');

      expect(tester.component.resolutionForRow(0)).toBe('update');
    });

    test('errorForRow surfaces the check error matching a row by name', () => {
      const checkFn = vi.fn().mockReturnValue(of({ items: [], errors: [{ item: { name: 'Node1' }, error: 'boom' }] }));
      prepareWizard(tester.component, nodes, [], checkFn);
      tester.component.goNext();
      tester.component.goNext();

      expect(tester.component.errorForRow(tester.component.rows[0])).toBe('boom');
      expect(tester.component.errorForRow(tester.component.rows[1])).toBeNull();
    });

    test('submit drops skipped matched rows, keeps the id for updated matches, and includes unmatched rows as creates', () => {
      const checkFn = vi.fn().mockReturnValue(of(matchedResult()));
      prepareWizard(tester.component, nodes, [], checkFn);
      tester.component.matchKey = 'name';
      tester.component.goNext();
      tester.component.goNext();
      tester.component.setRowResolution(0, 'skip');

      tester.component.submit();

      expect(activeModal.close).toHaveBeenCalledWith({
        items: [{ id: '', name: 'Node2', settings: {} }],
        matchKey: 'name'
      });
    });

    test('submit keeps a matched row resolved to update', () => {
      const checkFn = vi.fn().mockReturnValue(of(matchedResult()));
      prepareWizard(tester.component, nodes, [], checkFn);
      tester.component.goNext();
      tester.component.goNext();

      tester.component.submit();

      expect(activeModal.close).toHaveBeenCalledWith({
        items: [
          { id: 'existing-1', name: 'Node1', settings: {} },
          { id: '', name: 'Node2', settings: {} }
        ],
        matchKey: null
      });
    });
  });
});
