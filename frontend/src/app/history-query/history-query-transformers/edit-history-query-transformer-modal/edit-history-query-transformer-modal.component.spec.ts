import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { firstValueFrom, Observable, of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { ItemLightDTO } from '@oibus/shared/api/south-connector.model';
import { HistoryTransformerDTOWithOptions, TransformerDTO } from '@oibus/shared/api/transformer.model';
import { OIBusObjectAttribute } from '@oibus/shared/connector/form.model';

import { provideI18nTesting } from '../../../../i18n/mock-i18n';
import testData from '../../../../test/test-data';
import { createMock, MockObject } from '../../../../test/vitest-create-mock';
import { EngineService } from '../../../services/engine.service';
import { HistoryQueryService } from '../../../services/history-query.service';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { TransformerService } from '../../../services/transformer.service';
import { DefaultValidationErrorsComponent } from '../../../shared/default-validation-errors/default-validation-errors.component';
import { SelectExistingTransformerComponent } from '../../../shared/transformer/select-existing-transformer/select-existing-transformer.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { EditHistoryQueryTransformerModalComponent } from './edit-history-query-transformer-modal.component';

class EditHistoryQueryTransformerModalComponentTester {
  readonly fixture = TestBed.createComponent(EditHistoryQueryTransformerModalComponent);
  readonly modal = this.fixture.componentInstance;
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly newMode = this.root.getByRole('radio', { name: 'New' });
  readonly fromHistoryMode = this.root.getByRole('radio', { name: 'From a History query' });
  readonly output = this.root.getByRole('combobox', { name: 'Output' });
  readonly allItems = this.root.getByRole('radio', { name: 'All items' });
  readonly specificItems = this.root.getByRole('radio', { name: 'Specific items' });
  readonly itemSearch = this.root.getByPlaceholder('Search items...');
  readonly itemOptions = page.getByCss('.item-dropdown-menu button');
  readonly selectedItems = this.root.getByCss('oib-pill');
  readonly selectAllResults = this.root.getByRole('button', { name: 'Select all results' });
  readonly removeAll = this.root.getByRole('button', { name: 'Remove all' });
  readonly saveButton = this.root.getByRole('button', { name: 'Save' });
  readonly cancelButton = this.root.getByRole('button', { name: 'Cancel' });

  /** Emits a transformer picked by the "copy from existing" picker */
  pickExistingTransformer(transformer: TransformerDTO, options: Record<string, unknown>) {
    this.fixture.debugElement.query(By.directive(SelectExistingTransformerComponent)).triggerEventHandler('transformerPicked', {
      transformer,
      options
    });
  }
}

const customTransformer = testData.transformers.customList[0];
const delimiterManifest: OIBusObjectAttribute = {
  type: 'object',
  key: 'transformers.options',
  translationKey: '',
  attributes: [
    {
      type: 'string',
      key: 'delimiter',
      translationKey: '',
      defaultValue: ',',
      validators: [],
      displayProperties: { row: 0, columns: 4, displayInViewMode: true }
    }
  ],
  enablingConditions: [],
  validators: [],
  displayProperties: { visible: true, wrapInBox: false }
};
const transformerWithOptions: TransformerDTO = { ...testData.transformers.customList[1], manifest: delimiterManifest };
const items: Array<ItemLightDTO> = testData.historyQueries.list[0].items;

describe('EditHistoryQueryTransformerModalComponent', () => {
  let activeModal: MockObject<NgbActiveModal>;
  let unsavedChangesConfirmation: MockObject<UnsavedChangesConfirmationService>;

  beforeEach(() => {
    activeModal = createMock(NgbActiveModal);
    unsavedChangesConfirmation = createMock(UnsavedChangesConfirmationService);

    // Services used by the embedded transformer-test panel (rendered once a transformer is selected).
    const transformerService = createMock(TransformerService);
    transformerService.getInputTemplate.mockReturnValue(of({ type: 'time-values', data: '[]', description: '' }));
    const southConnectorService = createMock(SouthConnectorService);
    southConnectorService.getSouthManifest.mockReturnValue(of({ ...testData.south.manifest, modes: { ...testData.south.manifest.modes } }));

    // Services used by the "copy from existing" picker (rendered once the user leaves the 'new' creation mode).
    const northConnectorService = createMock(NorthConnectorService);
    const historyQueryService = createMock(HistoryQueryService);
    northConnectorService.list.mockReturnValue(of([]));
    historyQueryService.list.mockReturnValue(of([]));

    const engineService = createMock(EngineService);
    engineService.getInfo.mockReturnValue(of(testData.engine.oIBusInfo));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: EngineService, useValue: engineService },
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: TransformerService, useValue: transformerService },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: UnsavedChangesConfirmationService, useValue: unsavedChangesConfirmation }
      ]
    });

    // registers the default validation error messages
    TestBed.createComponent(DefaultValidationErrorsComponent);
  });

  function createTester(): EditHistoryQueryTransformerModalComponentTester {
    const tester = new EditHistoryQueryTransformerModalComponentTester();
    tester.modal.prepareForCreation('opcua', [], [], [customTransformer, transformerWithOptions], ['any'], items);
    return tester;
  }

  function editTester(transformer: HistoryTransformerDTOWithOptions): EditHistoryQueryTransformerModalComponentTester {
    const tester = new EditHistoryQueryTransformerModalComponentTester();
    tester.modal.prepareForEdition('opcua', [], [], [customTransformer, transformerWithOptions], ['any'], items, transformer);
    return tester;
  }

  test('should dismiss on cancel', async () => {
    const tester = createTester();

    await tester.cancelButton.click();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  test('should not save in create mode when no transformer is selected', async () => {
    const tester = createTester();
    await expect.element(tester.newMode).toBeChecked();

    await tester.saveButton.click();

    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should only offer the transformers compatible with the North and the South', async () => {
    const tester = new EditHistoryQueryTransformerModalComponentTester();
    // time-values input is not compatible with a folder scanner, which produces files
    tester.modal.prepareForCreation('folder-scanner', [], [], [customTransformer, transformerWithOptions], ['any'], items);

    await expect.element(tester.output.getByRole('option')).toHaveLength(2);
    await expect.element(tester.output.getByRole('option', { name: 'my transformer 2' })).toBeInTheDocument();
  });

  test('should create a transformer applied to all items', async () => {
    const tester = createTester();

    await tester.output.selectOptions('my transformer 1');
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith({
      id: expect.stringMatching(/^temp_/),
      transformer: customTransformer,
      options: {},
      items: []
    });
  });

  test('should create a transformer applied to selected items', async () => {
    const tester = createTester();
    await tester.output.selectOptions('my transformer 1');

    await tester.specificItems.click();
    await tester.itemSearch.click();
    await tester.itemSearch.fill('item2');
    await expect.element(tester.itemOptions).toHaveLength(1);
    await tester.itemOptions.nth(0).click();
    await expect.element(tester.selectedItems).toHaveLength(1);
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining({ id: items[1].id })] }));
  });

  test('should select all the search results and remove them all', async () => {
    const tester = createTester();
    await tester.specificItems.click();
    await tester.itemSearch.click();

    await tester.selectAllResults.click();
    await expect.element(tester.selectedItems).toHaveLength(2);
    await expect.element(tester.selectAllResults).not.toBeInTheDocument();

    await tester.removeAll.click();
    await expect.element(tester.selectedItems).not.toBeInTheDocument();
    await expect.element(tester.selectAllResults).toBeInTheDocument();
  });

  test('should save in edit mode', async () => {
    const tester = editTester({ id: 'historyTransformerId1', transformer: customTransformer, options: {}, items: [] });
    await expect.element(tester.allItems).toBeChecked();
    await expect.element(tester.newMode).not.toBeInTheDocument();

    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith({ id: 'historyTransformerId1', transformer: customTransformer, options: {}, items: [] });
  });

  test('should edit the selected items without changing the edited transformer', async () => {
    const editedTransformer: HistoryTransformerDTOWithOptions = {
      id: 'historyTransformerId1',
      transformer: customTransformer,
      options: {},
      items: [items[0]]
    };
    const tester = editTester(editedTransformer);
    await expect.element(tester.specificItems).toBeChecked();
    await expect.element(tester.selectedItems).toHaveLength(1);

    // unselect the item from the search dropdown, then select the other one
    await tester.itemSearch.click();
    await tester.itemOptions.nth(0).click();
    await expect.element(tester.selectedItems).not.toBeInTheDocument();
    await tester.itemOptions.nth(1).click();
    await expect.element(tester.selectedItems).toHaveLength(1);
    expect(editedTransformer.items).toEqual([items[0]]);

    await tester.selectedItems.nth(0).getByRole('button', { name: 'Remove' }).click();
    await expect.element(tester.selectedItems).not.toBeInTheDocument();

    await tester.saveButton.click();
    expect(activeModal.close).toHaveBeenCalledWith(expect.objectContaining({ id: 'historyTransformerId1', items: [] }));
  });

  test('should copy the transformer and its options from an existing attachment', async () => {
    const tester = createTester();

    await tester.fromHistoryMode.click();
    await expect.element(tester.output).not.toBeInTheDocument();
    tester.pickExistingTransformer(transformerWithOptions, { delimiter: ';' });
    await tester.saveButton.click();

    expect(activeModal.close).toHaveBeenCalledWith(
      expect.objectContaining({ transformer: transformerWithOptions, options: { delimiter: ';' } })
    );
  });

  test('should reset the copied transformer when switching back to the new creation mode', async () => {
    const tester = createTester();
    await tester.fromHistoryMode.click();
    tester.pickExistingTransformer(customTransformer, {});

    await tester.newMode.click();
    await expect.element(tester.output).toHaveValue('0: null');
    await tester.saveButton.click();

    expect(activeModal.close).not.toHaveBeenCalled();
  });

  test('should ask for confirmation before dismissing unsaved changes', async () => {
    unsavedChangesConfirmation.confirmUnsavedChanges.mockReturnValue(of(true));
    const tester = createTester();
    expect(tester.modal.canDismiss()).toBe(true);

    await tester.output.selectOptions('my transformer 1');

    await expect(firstValueFrom(tester.modal.canDismiss() as Observable<boolean>)).resolves.toBe(true);
    expect(unsavedChangesConfirmation.confirmUnsavedChanges).toHaveBeenCalled();
  });
});
