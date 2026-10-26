import { ChangeDetectionStrategy, Component, computed, DestroyRef, forwardRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { NgbActiveModal, NgbDropdown, NgbDropdownAnchor, NgbDropdownItem, NgbDropdownMenu, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { ValidationErrorsComponent } from 'ngx-valdemort';
import { Observable } from 'rxjs';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import {
  ItemLightDTO,
  SouthConnectorDTO,
  SouthConnectorItemDTO,
  SouthConnectorLightDTO,
  SouthItemGroupLightDTO
} from '@oibus/shared/api/south-connector.model';
import { SourceOriginSouthDTO, TransformerDTO, TransformerDTOWithOptions, TransformerSourceDTO } from '@oibus/shared/api/transformer.model';
import { OIBusObjectAttribute } from '@oibus/shared/connector/form.model';
import { InputType } from '@oibus/shared/connector/transformer-manifest.model';
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
import { getAssociatedInputType, isTransformerApplicable } from '../../../shared/utils/utils';
import { findDefaultTransformer, resolveItemRouting, RoutedTransformer } from '../transformer-routing';
import { NorthTransformerTestComponent, TransformerTestItemSource } from '../transformer-test/transformer-test.component';

/** The source (and, for a south, the scope) a transformer is created for */
export interface TransformerSourcePreset {
  dataSourceType: DataSourceType;
  south?: SouthConnectorLightDTO;
  group?: SouthItemGroupLightDTO;
  items?: Array<ItemLightDTO>;
}

/** What a transformer being configured would send of the items of its south */
export interface TransformerImpact {
  /** The items it would send */
  sent: number;
  /** Among them, the ones currently dropped */
  newlySent: number;
  /** Among them, the ones currently sent through another transformer */
  takenOver: number;
  /** The items of its scope another transformer applying first still sends */
  kept: number;
}

/** The id of the transformer being created, to tell how the items of its south would be routed */
const NEW_TRANSFORMER_ID = '\0new';

const toItemLight = (item: ItemLightDTO): ItemLightDTO => ({
  id: item.id,
  name: item.name,
  enabled: item.enabled,
  createdBy: item.createdBy,
  updatedBy: item.updatedBy,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

interface TransformerSourceOption {
  dataSourceType: DataSourceType | null;
  south: SouthConnectorLightDTO | null;
}

@Component({
  selector: 'oib-edit-north-transformer-modal',
  templateUrl: './edit-north-transformer-modal.component.html',
  styleUrls: ['./edit-north-transformer-modal.component.scss', '../routing-rows.scss'],
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
    NgbTooltip,
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
  /** The type of the data of the selected source (`null` when none is selected). */
  readonly sourceDataType = signal<InputType | null>(null);
  /** The south the transformer is configured for (`null` for the other sources) */
  readonly selectedSouth = signal<SouthConnectorLightDTO | null>(null);
  readonly manifest = signal<OIBusObjectAttribute | null>(null);
  readonly scanModes = signal<Array<ScanModeDTO>>([]);
  readonly certificates = signal<Array<CertificateDTO>>([]);
  readonly southConnectors = signal<Array<SouthConnectorLightDTO>>([]);
  private existingTransformerWithOptions: TransformerDTOWithOptions | null = null;

  readonly selectedItems = signal<Array<ItemLightDTO>>([]);
  readonly selectionType = signal<'all' | 'group' | 'items'>('all');
  /** Whether the selected items are left out of a transformer applying to all the items (of the south or of the group) */
  readonly excludeItems = signal(false);
  readonly searchResults = signal<Array<ItemLightDTO>>([]);
  readonly filteredItems = signal<Array<ItemLightDTO>>([]);
  readonly totalSearchResults = signal(0);
  readonly itemSearchText = signal('');
  readonly searchInteracted = signal(false);
  readonly availableGroups = signal<Array<SouthItemGroupLightDTO>>([]);
  readonly selectedGroup = signal<SouthItemGroupLightDTO | null>(null);
  /** Whether the source is set by the line it is configured from (or by the edited transformer): it is shown, not chosen */
  readonly presetSource = signal(false);
  /** The transformers of the North, to tell which items the configured one would send */
  readonly existingTransformers = signal<Array<TransformerDTOWithOptions>>([]);
  /** The selected south, with its groups and items */
  readonly southConnector = signal<SouthConnectorDTO | null>(null);
  /** Shown when specific items are chosen without any */
  readonly itemsRequired = signal(false);

  /** What the transformer would send of the items of its south, given the transformers of the North and their order */
  readonly impact = computed<TransformerImpact | null>(() => {
    const southConnector = this.southConnector();
    const source = this.southSource();
    if (!southConnector || !source || (this.selectionType() === 'items' && this.selectedItems().length === 0)) return null;
    const id = this.existingTransformerWithOptions?.id ?? NEW_TRANSFORMER_ID;
    const existing: Array<RoutedTransformer> = this.existingTransformers();
    const candidate: RoutedTransformer = { id, source };
    // An edited transformer keeps its place in the list, a new one comes last
    const transformers = existing.some(transformer => transformer.id === id)
      ? existing.map(transformer => (transformer.id === id ? candidate : transformer))
      : [...existing, candidate];
    const impact: TransformerImpact = { sent: 0, newlySent: 0, takenOver: 0, kept: 0 };
    for (const item of southConnector.items) {
      const itemRef = { id: item.id, groupId: item.group?.id ?? null };
      if (resolveItemRouting(transformers, southConnector.id, itemRef)?.transformer.id === id) {
        impact.sent++;
        const before = resolveItemRouting(existing, southConnector.id, itemRef);
        if (!before) {
          impact.newlySent++;
        } else if (before.transformer.id !== id) {
          impact.takenOver++;
        }
      } else if (this.inScope(source, item)) {
        impact.kept++;
      }
    }
    return impact;
  });

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
    supportedOutputTypes: Array<string>,
    preset: TransformerSourcePreset | null = null
  ) {
    this.mode.set('create');
    this.southConnectors.set(southConnectors);
    this.scanModes.set(scanModes);
    this.certificates.set(certificates);
    this.allTransformers = transformers;
    this.supportedOutputTypes.set(supportedOutputTypes);
    this.buildForm();
    if (preset) {
      this.presetSource.set(true);
      this.form.controls.source.setValue({ dataSourceType: preset.dataSourceType, south: preset.south ?? null });
      if (preset.group) {
        this.selectionType.set('group');
        this.selectedGroup.set(preset.group);
      } else if (preset.items?.length) {
        this.selectionType.set('items');
        this.selectedItems.set(preset.items);
      }
    }
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
    this.presetSource.set(true);
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
      this.selectedSouth.set(transformerWithOptionsToEdit.source.south);
      this.loadSouth(transformerWithOptionsToEdit.source.south.id);
      this.selectedItems.set(transformerWithOptionsToEdit.source.items);
      const excludedItems = transformerWithOptionsToEdit.source.excludedItems ?? [];
      if (transformerWithOptionsToEdit.source.items.length === 0 && excludedItems.length > 0) {
        this.excludeItems.set(true);
        this.selectedItems.set(excludedItems);
      }
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
        apiDataSourceId:
          transformerWithOptionsToEdit.source.type === 'oibus-api' ? (transformerWithOptionsToEdit.source.dataSourceId ?? null) : null,
        transformer: transformerWithOptionsToEdit.transformer,
        options: transformerWithOptionsToEdit.options
      },
      { emitEvent: false }
    );
    this.form.controls.source.disable({ emitEvent: false });
  }

  buildForm() {
    this.form.controls.source.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(source => {
      this.updateSelectableOutput(source);
      // In 'from-north'/'from-history' mode the transformer/options come from the copy-picker, not from the Output
      // select below, so changing the source shouldn't wipe them out. Otherwise, the obvious transformer for the data of
      // the source is proposed.
      if (this.creationMode() === 'new') {
        this.form.patchValue({
          transformer: findDefaultTransformer(this.selectableOutputs(), this.sourceDataType(), this.supportedOutputTypes()),
          options: {}
        });
      }
      this.selectionType.set('all');
      this.excludeItems.set(false);
      this.selectedItems.set([]);
      this.selectedGroup.set(null);
      this.availableGroups.set([]);
      this.southConnector.set(null);
      if (source.south) {
        this.filterItems();
        this.loadSouth(source.south.id);
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
    if (this.form.value.source?.south || this.existingTransformerWithOptions?.source.type === 'south') {
      // A transformer without item would apply to all the items of the south
      this.itemsRequired.set(this.selectionType() === 'items' && this.selectedItems().length === 0);
    }
    if (!this.form.valid || this.itemsRequired()) {
      return;
    }

    const sourceType: DataSourceType = (
      this.existingTransformerWithOptions ? this.existingTransformerWithOptions.source.type : this.form.value.source!.dataSourceType!
    ) as DataSourceType;
    let source: TransformerSourceDTO;
    if (sourceType === 'south') {
      source = this.southSource()!;
    } else if (sourceType === 'oibus-api') {
      // Without data source, the transformer applies to every data source
      source = { type: 'oibus-api', dataSourceId: this.form.value.apiDataSourceId || undefined };
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

  /** The south source of the transformer, as configured */
  southSource(): SourceOriginSouthDTO | null {
    const south = this.selectedSouth();
    if (!south) return null;
    const selectedGroup = this.selectedGroup();
    return {
      type: 'south',
      south,
      group: this.selectionType() === 'group' && selectedGroup ? { id: selectedGroup.id, name: selectedGroup.name } : undefined,
      items: this.selectionType() === 'items' ? this.selectedItems().map(toItemLight) : [],
      excludedItems: this.selectionType() !== 'items' && this.excludeItems() ? this.selectedItems().map(toItemLight) : []
    };
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

    this.selectedSouth.set(source.south);
    const dataType = this.getSourceDataType(source);
    this.sourceDataType.set(dataType);
    this.selectableOutputs.set(
      this.allTransformers.filter(element => isTransformerApplicable(element, dataType, this.supportedOutputTypes()))
    );
  }

  /** Loads the groups and items of the south, to choose the scope of the transformer and to tell which items it would send */
  private loadSouth(southId: string) {
    this.southConnectorService.findById(southId).subscribe(southConnector => {
      // The source may have changed in the meantime
      if (this.selectedSouth()?.id !== southId) return;
      this.southConnector.set(southConnector);
      this.availableGroups.set(southConnector.groups.map(group => ({ id: group.id, name: group.standardSettings.name })));
    });
  }

  /** Whether an item is in the scope of a south source: listed, in its group, or not left out of all the items */
  private inScope(source: SourceOriginSouthDTO, item: SouthConnectorItemDTO): boolean {
    if (source.items.length > 0) return source.items.some(element => element.id === item.id);
    if ((source.excludedItems ?? []).some(element => element.id === item.id)) return false;
    return !source.group || item.group?.id === source.group.id;
  }

  /** The type of the data the source sends, `null` when no source is selected. */
  private getSourceDataType(source: TransformerSourceOption): InputType | null {
    switch (source.dataSourceType) {
      case 'south':
        return source.south ? getAssociatedInputType(source.south.type) : null;
      case 'oianalytics-setpoint':
        return 'setpoint';
      case 'oibus-api':
        return 'any';
      default:
        return null;
    }
  }

  toggleItem(item: ItemLightDTO) {
    this.itemsRequired.set(false);
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
    this.itemsRequired.set(false);
    this.excludeItems.set(false);
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

  /** Leaves (or no longer leaves) some items out of the transformer applying to all the items */
  setExcludeItems(exclude: boolean) {
    this.excludeItems.set(exclude);
    this.selectedItems.set([]);
    this.searchInteracted.set(false);
    if (exclude) {
      this.filterItems();
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
