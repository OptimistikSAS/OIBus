import { ChangeDetectionStrategy, Component, computed, DestroyRef, forwardRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { NgbActiveModal, NgbDropdown, NgbDropdownAnchor, NgbDropdownItem, NgbDropdownMenu, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
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
import { OIBusSettingsSummaryComponent } from '../../../shared/form/oibus-settings-summary/oibus-settings-summary.component';
import {
  compareSettings,
  countChanges,
  SettingSummary,
  summarizeSettings
} from '../../../shared/form/oibus-settings-summary/settings-summary';
import { ValErrorDelayDirective } from '../../../shared/form/val-error-delay.directive';
import { filterItems } from '../../../shared/item-table/item-table';
import { ModalStepsComponent } from '../../../shared/modal-steps/modal-steps.component';
import { submitsOnEnter, WizardSteps } from '../../../shared/modal-steps/wizard-steps';
import { OIBusSouthTypeEnumPipe } from '../../../shared/oibus-south-type-enum.pipe';
import { PillComponent } from '../../../shared/pill/pill.component';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { SelectExistingTransformerComponent } from '../../../shared/transformer/select-existing-transformer/select-existing-transformer.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { getAssociatedInputType, isTransformerApplicable } from '../../../shared/utils/utils';
import { formatTransformerSource, transformerName } from '../../north-summary';
import { findDefaultTransformer, resolveItemRouting, RoutedTransformer } from '../transformer-routing';
import { NorthTransformerTestComponent, TransformerTestItemSource } from '../transformer-test/transformer-test.component';

/** The source (and, for a south, the scope) a transformer is created for */
export interface TransformerSourcePreset {
  dataSourceType: DataSourceType;
  south?: SouthConnectorLightDTO;
  group?: SouthItemGroupLightDTO;
  items?: Array<ItemLightDTO>;
}

/** The steps of the modal: where the data comes from and the transformer, its options (tried out right away), then a review */
export const TRANSFORMER_MODAL_STEPS = ['source', 'options', 'review'] as const;
export type TransformerModalStep = (typeof TRANSFORMER_MODAL_STEPS)[number];

/** A transformer as summed up in the Review step: its source and the transformer, and its options */
export interface TransformerSummary {
  source: Array<SettingSummary>;
  options: Array<SettingSummary>;
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
    ModalStepsComponent,
    OIBusSettingsSummaryComponent,
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
  private readonly translateService = inject(TranslateService);

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
  /** Emits on every change of the form, so that the steps with errors are kept up to date */
  private readonly formEvents = toSignal(this.form.events);
  readonly steps = new WizardSteps<TransformerModalStep>(TRANSFORMER_MODAL_STEPS, step => this.stepControls(step), this.formEvents);
  /** A new transformer is saved once its source and the transformer are chosen, an edited one from any step */
  readonly canSave = computed(() => this.mode() === 'edit' || this.steps.current() !== 'source');
  /** The transformer as summed up in the Review step */
  readonly reviewSummary = computed(() => {
    this.formEvents();
    return this.summarize();
  });
  /** The transformer as it was when opened for edition, to show what changed in the Review step: null for a new one */
  readonly savedSummary = signal<TransformerSummary | null>(null);
  /** How many settings changed since the transformer was saved: null for a new one */
  readonly changeCount = computed(() => {
    const saved = this.savedSummary();
    if (!saved) return null;
    const summary = this.reviewSummary();
    return countChanges(compareSettings(summary.source, saved.source)) + countChanges(compareSettings(summary.options, saved.options));
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
  readonly itemSearchText = signal('');
  readonly searchInteracted = signal(false);
  // The filters of the items, as in the south items list
  readonly groupFilter = signal<string | null>(null);
  readonly scanModeFilter = signal<string | null>(null);
  readonly statusFilter = signal<'enabled' | 'disabled' | null>(null);
  /** The items of the south matching the search and the filters */
  readonly matchingItems = computed<Array<ItemLightDTO>>(() => {
    const southConnector = this.southConnector();
    if (!southConnector) return [];
    const groupFilter = this.groupFilter();
    const scanModeFilter = this.scanModeFilter();
    const items: ReadonlyArray<SouthConnectorItemDTO> = southConnector.items;
    return filterItems(items, { name: this.itemSearchText(), status: this.statusFilter() })
      .filter(item => {
        if (groupFilter === 'none' && item.group) return false;
        if (groupFilter && groupFilter !== 'none' && item.group?.id !== groupFilter) return false;
        const scanModeId = item.group ? item.group.standardSettings.scanMode.id : item.scanMode?.id;
        return !scanModeFilter || scanModeId === scanModeFilter;
      })
      .map(toItemLight);
  });
  /** The first matching items, listed in the dropdown */
  readonly filteredItems = computed(() => this.matchingItems().slice(0, 10));
  /** The matching items not selected yet */
  readonly searchResults = computed(() => this.matchingItems().filter(item => !this.isItemSelected(item)));
  readonly totalSearchResults = computed(() => this.searchResults().length);
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
    this.savedSummary.set(this.summarize());
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
      this.clearItemFilters();
      if (source.south) {
        this.loadSouth(source.south.id);
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

  /** Pressing Enter in a field submits the form, whether the Save button shows or not */
  onEnter(event: Event) {
    if (submitsOnEnter(event)) {
      event.preventDefault();
      this.submit();
    }
  }

  /** Submitting the form (e.g. pressing Enter) saves the transformer once it can be, and opens the next step before */
  submit() {
    if (this.canSave()) {
      this.save();
    } else {
      this.nextStep();
    }
  }

  /** Opens the next step, once the current one is complete */
  nextStep() {
    if (this.steps.current() === 'source' && !this.checkItems()) {
      return;
    }
    this.steps.next();
  }

  save() {
    if (!this.checkItems()) {
      this.steps.current.set('source');
      return;
    }
    if (!this.form.valid) {
      this.steps.showFirstInvalid();
      return;
    }

    this.modal.close({
      id: this.existingTransformerWithOptions ? this.existingTransformerWithOptions.id : `temp_${Date.now()}`,
      source: this.source(),
      transformer: this.form.value.transformer,
      options: this.form.value.options
    });
  }

  /** The source of the transformer, as configured: `null` until it is chosen */
  private source(): TransformerSourceDTO | null {
    const sourceType = this.existingTransformerWithOptions
      ? this.existingTransformerWithOptions.source.type
      : this.form.controls.source.value.dataSourceType;
    switch (sourceType) {
      case 'south':
        return this.southSource();
      case 'oibus-api':
        // Without data source, the transformer applies to every data source
        return { type: 'oibus-api', dataSourceId: this.form.controls.apiDataSourceId.value || undefined };
      case 'oianalytics-setpoint':
        return { type: 'oianalytics-setpoint' };
      default:
        return null;
    }
  }

  /** The transformer as currently configured, summed up: see `reviewSummary` */
  private summarize(): TransformerSummary {
    const transformer = this.form.controls.transformer.value;
    const source = this.source();
    const manifest = this.manifest();
    return {
      source: [
        {
          kind: 'text',
          labelKey: 'north.transformers.source',
          text: source ? formatTransformerSource({ source }, this.translateService).trim() : null
        },
        {
          kind: 'text',
          labelKey: 'north.transformers.list.transformer',
          text: transformer ? transformerName(transformer, this.translateService) : null
        }
      ],
      options:
        transformer && manifest
          ? summarizeSettings(manifest, this.form.controls.options.value, {
              translateService: this.translateService,
              scanModes: this.scanModes(),
              certificates: this.certificates()
            })
          : []
    };
  }

  /** Whether the chosen items are fine: a transformer for specific items needs one at least, without, it would apply to all */
  private checkItems(): boolean {
    this.itemsRequired.set(!!this.selectedSouth() && this.selectionType() === 'items' && this.selectedItems().length === 0);
    return !this.itemsRequired();
  }

  /** The controls edited in each step */
  private stepControls(step: TransformerModalStep): Array<AbstractControl> {
    switch (step) {
      case 'source':
        return [this.form.controls.source, this.form.controls.apiDataSourceId, this.form.controls.transformer];
      case 'options':
        return [this.form.controls.options];
      default:
        return [];
    }
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
        return 'file';
      default:
        return null;
    }
  }

  toggleItem(item: ItemLightDTO) {
    this.itemsRequired.set(false);
    if (this.isItemSelected(item)) {
      this.selectedItems.update(selectedItems => selectedItems.filter(i => i.id !== item.id));
    } else {
      this.selectedItems.update(selectedItems => [...selectedItems, item]);
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
    }
    this.clearItemFilters();
    if (type !== 'group') {
      this.selectedGroup.set(null);
    }
  }

  /** Leaves (or no longer leaves) some items out of the transformer applying to all the items */
  setExcludeItems(exclude: boolean) {
    this.excludeItems.set(exclude);
    this.selectedItems.set([]);
    this.searchInteracted.set(false);
    this.clearItemFilters();
  }

  private clearItemFilters() {
    this.itemSearchText.set('');
    this.groupFilter.set(null);
    this.scanModeFilter.set(null);
    this.statusFilter.set(null);
  }

  selectAllResults() {
    const selectedItems = [...this.selectedItems()];
    for (const item of this.searchResults()) {
      if (!selectedItems.some(selected => selected.id === item.id)) {
        selectedItems.push(item);
      }
    }
    this.selectedItems.set(selectedItems);
  }

  removeAllItems() {
    this.selectedItems.set([]);
  }
}
