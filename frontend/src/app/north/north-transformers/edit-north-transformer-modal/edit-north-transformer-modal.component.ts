import { ChangeDetectionStrategy, Component, DestroyRef, forwardRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { NgbActiveModal, NgbDropdown, NgbDropdownAnchor, NgbDropdownItem, NgbDropdownMenu } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { ValidationErrorsComponent } from 'ngx-valdemort';
import { Observable } from 'rxjs';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { ItemLightDTO, SouthConnectorLightDTO, SouthItemGroupLightDTO } from '@oibus/shared/api/south-connector.model';
import { SourceOriginSouthDTO, TransformerDTO, TransformerDTOWithOptions, TransformerSourceDTO } from '@oibus/shared/api/transformer.model';
import { OIBusObjectAttribute } from '@oibus/shared/connector/form.model';
import { DataSourceType } from '@oibus/shared/domain/transformer.model';

import { SouthConnectorService } from '../../../services/south-connector.service';
import { addAttributeToForm, addEnablingConditions } from '../../../shared/form/dynamic-form.builder';
import { FormControlValidationDirective } from '../../../shared/form/form-control-validation.directive';
import { OIBUS_FORM_MODE } from '../../../shared/form/oibus-form-mode.token';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { ValErrorDelayDirective } from '../../../shared/form/val-error-delay.directive';
import { OIBusSouthTypeEnumPipe } from '../../../shared/oibus-south-type-enum.pipe';
import { PillComponent } from '../../../shared/pill/pill.component';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { SelectExistingTransformerComponent } from '../../../shared/transformer/select-existing-transformer/select-existing-transformer.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { getAssociatedInputType } from '../../../shared/utils/utils';
import { NorthTransformerTestComponent, TransformerTestItemSource } from '../transformer-test/transformer-test.component';

interface TransformerSourceOption {
  dataSourceType: DataSourceType | null;
  south: SouthConnectorLightDTO | null;
}

@Component({
  selector: 'oib-edit-north-transformer-modal',
  templateUrl: './edit-north-transformer-modal.component.html',
  styleUrl: './edit-north-transformer-modal.component.scss',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    TranslateDirective,
    SaveButtonComponent,
    TranslatePipe,
    OIBusObjectFormControlComponent,
    OIBusSouthTypeEnumPipe,
    FormControlValidationDirective,
    NgbDropdown,
    NgbDropdownAnchor,
    NgbDropdownMenu,
    NgbDropdownItem,
    PillComponent,
    ValErrorDelayDirective,
    ValidationErrorsComponent,
    NorthTransformerTestComponent,
    SelectExistingTransformerComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    {
      provide: OIBUS_FORM_MODE,
      useFactory: (component: EditNorthTransformerModalComponent) => () => component.mode(),
      deps: [forwardRef(() => EditNorthTransformerModalComponent)]
    }
  ]
})
export class EditNorthTransformerModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);
  private readonly southConnectorService = inject(SouthConnectorService);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = new ObservableState();
  readonly mode = signal<'create' | 'edit'>('create');
  /** Whether the transformer is configured from scratch or copied from an existing North/History attachment (create mode only). */
  readonly creationMode = signal<'new' | 'from-north' | 'from-history'>('new');
  /** Stable source descriptor for the embedded transformer-test panel (updated on source change). */
  readonly transformerTestSource = signal<TransformerTestItemSource>({ kind: 'none' });
  /** True when opened from north-detail (saves directly to API); false when opened from edit-north (changes are applied in-memory). */
  readonly directSave = signal(true);
  readonly form: FormGroup<{
    source: FormControl<TransformerSourceOption>;
    apiDataSourceId: FormControl<string | null>;
    transformer: FormControl<TransformerDTO | null>;
    options: FormGroup;
  }> = this.fb.group({
    source: this.fb.control<TransformerSourceOption>(
      {
        dataSourceType: null,
        south: null
      },
      Validators.required
    ),
    apiDataSourceId: this.fb.control<string | null>(null),
    transformer: this.fb.control<TransformerDTO | null>(null, Validators.required),
    options: this.fb.group({})
  });
  private allTransformers: Array<TransformerDTO> = [];
  readonly selectableOutputs = signal<Array<TransformerDTO>>([]);
  readonly supportedOutputTypes = signal<Array<string>>([]);
  readonly manifest = signal<OIBusObjectAttribute | null>(null);
  readonly scanModes = signal<Array<ScanModeDTO>>([]);
  readonly certificates = signal<Array<CertificateDTO>>([]);
  readonly southConnectors = signal<Array<SouthConnectorLightDTO>>([]);
  private existingTransformerWithOptions: TransformerDTOWithOptions | null = null;

  readonly selectedItems = signal<Array<ItemLightDTO>>([]);
  readonly selectionType = signal<'all' | 'group' | 'items'>('all');
  readonly searchResults = signal<Array<ItemLightDTO>>([]);
  readonly filteredItems = signal<Array<ItemLightDTO>>([]);
  readonly totalSearchResults = signal(0);
  readonly itemSearchText = signal('');
  readonly searchInteracted = signal(false);
  readonly availableGroups = signal<Array<SouthItemGroupLightDTO>>([]);
  readonly selectedGroup = signal<SouthItemGroupLightDTO | null>(null);

  filterItems() {
    const southId = this.form.controls.source.value.south?.id;
    if (!southId) {
      this.filteredItems.set([]);
      this.searchResults.set([]);
      this.totalSearchResults.set(0);
      return;
    }

    this.southConnectorService.searchItems(southId, { name: this.itemSearchText(), page: 0 }).subscribe(items => {
      const allItems = items.content;
      const selectedItems = this.selectedItems();
      const searchResults = allItems.filter(item => !selectedItems.some(element => element.id === item.id));
      this.searchResults.set(searchResults);
      this.totalSearchResults.set(searchResults.length);
      this.filteredItems.set(allItems.slice(0, 10));
    });
  }

  onDropdownOpenChange(isOpen: boolean) {
    if (isOpen) {
      // Items should already be pre-loaded, but just in case
      if (this.filteredItems().length === 0) {
        this.filterItems();
      }
    }
  }

  prepareForCreation(
    southConnectors: Array<SouthConnectorLightDTO>,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    transformers: Array<TransformerDTO>,
    supportedOutputTypes: Array<string>
  ) {
    this.mode.set('create');
    this.southConnectors.set(southConnectors);
    this.scanModes.set(scanModes);
    this.certificates.set(certificates);
    this.allTransformers = transformers;
    this.supportedOutputTypes.set(supportedOutputTypes);
    this.buildForm();
  }

  prepareForEdition(
    southConnectors: Array<SouthConnectorLightDTO>,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    transformers: Array<TransformerDTO>,
    supportedOutputTypes: Array<string>,
    transformerWithOptionsToEdit: TransformerDTOWithOptions
  ) {
    this.mode.set('edit');
    this.southConnectors.set(southConnectors);
    this.scanModes.set(scanModes);
    this.certificates.set(certificates);
    this.allTransformers = transformers;
    this.supportedOutputTypes.set(supportedOutputTypes);
    this.existingTransformerWithOptions = transformerWithOptionsToEdit;
    this.selectedItems.set([]);
    if (transformerWithOptionsToEdit.source.type === 'south') {
      this.filterItems();
      // Pre-load items and groups if editing with a south connector
      this.southConnectorService.getGroups(transformerWithOptionsToEdit.source.south.id).subscribe(groups => {
        this.availableGroups.set(groups.map(group => ({ id: group.id, name: group.standardSettings.name })));
      });
      this.selectedItems.set(transformerWithOptionsToEdit.source.items);
      if (transformerWithOptionsToEdit.source.group) {
        this.selectionType.set('group');
        this.selectedGroup.set(transformerWithOptionsToEdit.source.group);
      } else if (this.selectedItems().length > 0) {
        this.selectionType.set('items');
      } else {
        this.selectionType.set('all');
      }
    }

    const sourceValue = {
      dataSourceType: transformerWithOptionsToEdit.source.type,
      south: transformerWithOptionsToEdit.source.type === 'south' ? (transformerWithOptionsToEdit.source.south ?? null) : null
    };
    this.buildForm();
    this.updateSelectableOutput(sourceValue);
    this.createOptionsForm(transformerWithOptionsToEdit.transformer);

    // trigger rebuild of options form
    this.form.patchValue(
      {
        source: sourceValue,
        apiDataSourceId: transformerWithOptionsToEdit.source.type === 'oibus-api' ? transformerWithOptionsToEdit.source.dataSourceId : null,
        transformer: transformerWithOptionsToEdit.transformer,
        options: transformerWithOptionsToEdit.options
      },
      { emitEvent: false }
    );
    this.form.controls.source.disable({ emitEvent: false });
  }

  buildForm() {
    this.form.controls.source.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(source => {
      // In 'from-north'/'from-history' mode the transformer/options come from the copy-picker, not from the Output
      // select below, so changing the source shouldn't wipe them out.
      if (this.creationMode() === 'new') {
        this.form.patchValue({
          transformer: null,
          options: {}
        });
      }
      this.updateSelectableOutput(source);
      this.selectionType.set('all');
      this.selectedGroup.set(null);
      this.availableGroups.set([]);
      if (source.south) {
        this.filterItems();
        this.southConnectorService.getGroups(source.south.id).subscribe(groups => {
          this.availableGroups.set(groups.map(group => ({ id: group.id, name: group.standardSettings.name })));
        });
      } else {
        this.filteredItems.set([]);
        this.searchResults.set([]);
        this.totalSearchResults.set(0);
      }
    });

    this.form.controls.transformer.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(newTransformer => {
      if (newTransformer) {
        this.createOptionsForm(newTransformer);
      } else {
        this.form.setControl('options', this.fb.group({}));
      }
    });
  }

  createOptionsForm(newTransformer: TransformerDTO) {
    const manifest = newTransformer.manifest;
    this.manifest.set(manifest);
    this.form.setControl('options', this.fb.group({}));
    for (const attribute of manifest.attributes) {
      addAttributeToForm(this.fb, this.form.controls.options, attribute);
    }
    addEnablingConditions(this.form.controls.options, manifest.enablingConditions);
  }

  setCreationMode(mode: 'new' | 'from-north' | 'from-history') {
    this.creationMode.set(mode);
    this.form.patchValue({ transformer: null, options: {} });
  }

  /** Called when the user picks an already-configured transformer attachment to copy as a starting point. */
  applyExistingTransformer(selection: { transformer: TransformerDTO; options: Record<string, unknown> }) {
    this.createOptionsForm(selection.transformer);
    this.form.patchValue({ transformer: selection.transformer, options: selection.options }, { emitEvent: false });
  }

  canDismiss(): Observable<boolean> | boolean {
    if (this.form?.dirty) {
      return this.unsavedChangesConfirmation.confirmUnsavedChanges();
    }
    return true;
  }

  cancel() {
    this.modal.dismiss();
  }

  save() {
    if (!this.form.valid) {
      return;
    }

    const sourceType: DataSourceType = (
      this.existingTransformerWithOptions ? this.existingTransformerWithOptions.source.type : this.form.value.source!.dataSourceType!
    ) as DataSourceType;
    let source: TransformerSourceDTO;
    if (sourceType === 'south') {
      const selectedGroup = this.selectedGroup();
      source = {
        type: 'south',
        south: this.existingTransformerWithOptions
          ? (this.existingTransformerWithOptions.source as SourceOriginSouthDTO).south
          : this.form.value.source!.south!,
        group:
          this.selectionType() === 'group' && selectedGroup
            ? {
                id: selectedGroup.id,
                name: selectedGroup.name
              }
            : undefined,
        items:
          this.selectionType() === 'items'
            ? this.selectedItems().map(item => ({
                id: item.id,
                name: item.name,
                enabled: item.enabled,
                createdBy: item.createdBy,
                updatedBy: item.updatedBy,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt
              }))
            : []
      };
    } else if (sourceType === 'oibus-api') {
      source = { type: 'oibus-api', dataSourceId: this.form.value.apiDataSourceId! };
    } else {
      source = { type: 'oianalytics-setpoint' };
    }

    this.modal.close({
      id: this.existingTransformerWithOptions ? this.existingTransformerWithOptions.id : `temp_${Date.now()}`,
      source,
      transformer: this.form.value.transformer,
      options: this.form.value.options
    });
  }

  compareSource(o1: TransformerSourceOption | null, o2: TransformerSourceOption | null): boolean {
    if (!o1 || !o2) return o1 === o2;
    // Compare Input Types
    if (o1.dataSourceType !== o2.dataSourceType) return false;
    // Compare South Connectors (handle objects or nulls)
    return (o1.south?.id ?? null) === (o2.south?.id ?? null);
  }

  compareTransformers(t1: TransformerDTO | null, t2: TransformerDTO | null): boolean {
    return t1 && t2 ? t1.id === t2.id : t1 === t2;
  }

  compareGroups(g1: SouthItemGroupLightDTO | null, g2: SouthItemGroupLightDTO | null): boolean {
    return g1 && g2 ? g1.id === g2.id : g1 === g2;
  }

  private updateSelectableOutput(source: TransformerSourceOption) {
    // Keep the embedded test panel's source in sync (only south sources can run an item).
    this.transformerTestSource.set(source.south ? { kind: 'south', id: source.south.id, southType: source.south.type } : { kind: 'none' });

    this.selectableOutputs.set(
      this.allTransformers.filter(element => {
        if (!this.supportedOutputTypes().includes(element.outputType)) {
          return false;
        }

        if (element.type === 'standard' && element.functionName === 'ignore') return true;
        if (element.type === 'standard' && element.functionName === 'iso' && this.supportedOutputTypes().includes(element.inputType))
          return true;

        if (source.dataSourceType === 'oianalytics-setpoint') {
          return element.inputType === 'setpoint';
        }

        if (source.dataSourceType === 'south' && source.south) {
          return (
            (element.inputType === 'any-content' && getAssociatedInputType(source.south.type) === 'any') ||
            element.inputType === getAssociatedInputType(source.south.type)
          );
        }

        if (source.dataSourceType === 'oibus-api') {
          return element.inputType === 'any-content' || element.inputType === 'any';
        }
        return true;
      })
    );
  }

  toggleItem(item: ItemLightDTO) {
    if (this.isItemSelected(item)) {
      this.selectedItems.update(selectedItems => selectedItems.filter(i => i.id !== item.id));
      if (item.name.toLowerCase().includes(this.itemSearchText().toLowerCase())) {
        this.searchResults.update(searchResults => [...searchResults, item]);
      }
    } else {
      this.selectedItems.update(selectedItems => [...selectedItems, item]);
      this.searchResults.update(searchResults => searchResults.filter(i => i.id !== item.id));
    }
  }

  isItemSelected(item: ItemLightDTO): boolean {
    return this.selectedItems().some(i => i.id === item.id);
  }

  removeItem(itemToRemove: ItemLightDTO) {
    this.selectedItems.update(selectedItems => selectedItems.filter(item => item.id !== itemToRemove.id));
  }

  setSelectionType(type: 'all' | 'group' | 'items') {
    this.selectionType.set(type);
    if (type !== 'items') {
      this.selectedItems.set([]);
      this.searchInteracted.set(false);
      this.searchResults.set([]);
      this.filteredItems.set([]);
      this.totalSearchResults.set(0);
    } else {
      this.filterItems();
    }
    if (type !== 'group') {
      this.selectedGroup.set(null);
    }
  }

  selectAllResults() {
    const selectedItems = [...this.selectedItems()];
    for (const item of this.searchResults()) {
      if (!selectedItems.some(selected => selected.id === item.id)) {
        selectedItems.push(item);
      }
    }
    this.selectedItems.set(selectedItems);
    // Clear search results since all items are now selected
    this.searchResults.set([]);
    this.totalSearchResults.set(0);
  }

  removeAllItems() {
    this.selectedItems.set([]);
    // Refresh search results to include previously selected items
    this.filterItems();
  }
}
