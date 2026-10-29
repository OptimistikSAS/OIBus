import { ChangeDetectionStrategy, Component, computed, forwardRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';

import { NgbActiveModal, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthItemGroupCommandDTO,
  SouthItemGroupDTO,
  SouthItemNorthTransformerCommandDTO
} from '@oibus/shared/api/south-connector.model';
import { OIBusScanModeAttribute } from '@oibus/shared/connector/form.model';
import { IOT_FAMILY_SOUTH_TYPES, SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthCachingStrategy, SouthCachingThresholdType, SouthHistoryRecoveryStrategy } from '@oibus/shared/domain/south-connector.model';

import { addAttributeToForm, createMqttValidator, extractFormValue } from '../../../shared/form/dynamic-form.builder';
import { EnabledSelectorComponent } from '../../../shared/form/enabled-selector/enabled-selector.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { OIBUS_FORM_MODE } from '../../../shared/form/oibus-form-mode.token';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { OIBusSettingsSummaryComponent } from '../../../shared/form/oibus-settings-summary/oibus-settings-summary.component';
import { ModalService } from '../../../shared/modal.service';
import { ModalStepsComponent } from '../../../shared/modal-steps/modal-steps.component';
import { submitsOnEnter } from '../../../shared/modal-steps/wizard-steps';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { openExploreWizard } from '../../south-workflows/edit-workflow-modal/edit-workflow-modal.component';
import { countItemChanges, ITEM_MODAL_STEPS, ItemModalStep, ItemModalSteps, ItemSummary } from '../item-modal-steps';
import { openGroupModal, SouthItemGroup, SouthItemGroups } from '../south-item-groups';
import { SouthItemNorthsComponent } from '../south-item-norths/south-item-norths.component';
import {
  CACHING_STRATEGIES,
  getItemSettingsAttribute,
  getScanModeAttribute,
  RECOVERY_STRATEGIES,
  summarizeSouthItem,
  THRESHOLD_TYPES
} from '../south-item-summary';
import SouthItemTestComponent from '../south-item-test/south-item-test.component';

@Component({
  selector: 'oib-edit-south-item-modal',
  templateUrl: './edit-south-item-modal.component.html',
  styleUrl: './edit-south-item-modal.component.scss',
  imports: [
    EnabledSelectorComponent,
    TranslateDirective,
    TranslatePipe,
    SaveButtonComponent,
    SouthItemTestComponent,
    ReactiveFormsModule,
    OI_FORM_VALIDATION_DIRECTIVES,
    OIBusObjectFormControlComponent,
    NgbDropdownModule,
    ModalStepsComponent,
    OIBusSettingsSummaryComponent,
    SouthItemNorthsComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    {
      provide: OIBUS_FORM_MODE,
      useFactory: (component: EditSouthItemModalComponent) => () => (component.mode() === 'edit' ? 'edit' : 'create'),
      deps: [forwardRef(() => EditSouthItemModalComponent)]
    }
  ]
})
class EditSouthItemModalComponent {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);
  private modalService = inject(ModalService);
  private translateService = inject(TranslateService);

  readonly mode = signal<'create' | 'edit' | 'copy'>('create');
  /**
   * True when opened from south-detail (saves directly to API); false when opened from edit-south (changes are applied in-memory).
   * Set by the opener right after opening the modal, before its first change detection.
   */
  directSave = true;
  /**
   * Set when a new item is saved with "save and add another": the opener then opens the modal again for the next item,
   * from the one just saved (see prepareForCreation).
   */
  addAnother = false;
  readonly state = new ObservableState();
  readonly scanModes = signal<Array<ScanModeDTO>>([]);
  readonly certificates = signal<Array<CertificateDTO>>([]);
  readonly southId = signal('');
  readonly southConnectorCommand = signal<SouthConnectorCommandDTO | null>(null);
  readonly manifest = signal<SouthConnectorManifest | null>(null);
  private item: SouthConnectorItemDTO | SouthConnectorItemCommandDTO | null = null;
  /** The item added just before, in a row of new items: the new one starts with its group, schedule and history settings */
  private previousItem: SouthConnectorItemCommandDTO | null = null;
  private itemList: Array<SouthConnectorItemDTO | SouthConnectorItemCommandDTO> = [];
  /** The items of the south, to tell where their data goes in the North step */
  readonly southItems = signal<Array<SouthConnectorItemDTO | SouthConnectorItemCommandDTO>>([]);
  /** The groups of the page, changed through it only */
  private readonly groupStore = signal<SouthItemGroups | null>(null);
  readonly groups = computed(() => this.groupStore()?.list() ?? []);
  private previousGroupId: string | null = null;
  /**
   * The transformers to attach to Norths when the item is saved (with it, or with its south from edit-south): those chosen
   * in the North step, and, for an item edited in memory, the ones chosen before
   */
  readonly northTransformers = signal<Array<SouthItemNorthTransformerCommandDTO>>([]);
  private savedNorthTransformers: Array<SouthItemNorthTransformerCommandDTO> = [];
  readonly norths = viewChild(SouthItemNorthsComponent);

  /** Not every item passed will have an id, but we still need to check for uniqueness.
   * This ensures that we have a backup identifier for the currently edited item.
   * In 'copy' and 'create' cases, we always check all items' names
   */
  private tableIndex: number | null = null;

  readonly recoveryStrategies = RECOVERY_STRATEGIES;
  readonly cachingStrategies = CACHING_STRATEGIES;
  readonly thresholdTypes = THRESHOLD_TYPES;

  /** The item settings controls are added when the modal is prepared, from the connector manifest. */
  readonly form: FormGroup<{
    name: FormControl<string>;
    groupId: FormControl<string | null>;
    scanModeId: FormControl<string | null>;
    enabled: FormControl<boolean>;
    syncWithGroup: FormControl<boolean>;
    maxReadInterval: FormControl<number | null>;
    readDelay: FormControl<number | null>;
    startTimeOffset: FormControl<number | null>;
    endTimeOffset: FormControl<number | null>;
    recoveryStrategy: FormControl<SouthHistoryRecoveryStrategy | null>;
    cachingStrategy: FormControl<SouthCachingStrategy | null>;
    thresholdType: FormControl<SouthCachingThresholdType | null>;
    threshold: FormControl<number | null>;
    rangeLow: FormControl<number | null>;
    rangeHigh: FormControl<number | null>;
    maxCachingInterval: FormControl<number | null>;
    settings: FormGroup;
  }> = this.fb.group({
    name: ['', [Validators.required, this.checkUniqueness()]],
    groupId: [null as string | null],
    enabled: [true, Validators.required],
    scanModeId: [null as string | null, Validators.required],
    syncWithGroup: [false], // Default to false; will be set to true when group is selected
    maxReadInterval: [3600 as number | null, [Validators.min(0)]],
    readDelay: [200 as number | null, [Validators.min(0)]],
    startTimeOffset: [0 as number | null, [Validators.min(-2147483648), Validators.max(2147483647)]],
    endTimeOffset: [0 as number | null, [Validators.min(-2147483648), Validators.max(2147483647)]],
    recoveryStrategy: ['oldest' as SouthHistoryRecoveryStrategy | null],
    cachingStrategy: ['allValues' as SouthCachingStrategy | null],
    thresholdType: [null as SouthCachingThresholdType | null],
    threshold: [null as number | null],
    rangeLow: [null as number | null],
    rangeHigh: [null as number | null],
    maxCachingInterval: [null as number | null, [Validators.min(0)]],
    settings: this.fb.group({})
  });

  /**
   * Emits on every change of the form (value, status...), including the programmatic ones (e.g. after a group modal
   * closes): the computed signals below read the form through it, so that they are re-evaluated on each change.
   */
  private readonly formEvents = toSignal(this.form.events);
  readonly groupId = computed(() => {
    this.formEvents();
    return this.form.controls.groupId.value;
  });
  readonly scanModeEnabled = computed(() => {
    this.formEvents();
    return this.form.controls.scanModeId.enabled;
  });
  readonly cachingStrategy = computed(() => {
    this.formEvents();
    return this.form.controls.cachingStrategy.value;
  });
  readonly thresholdType = computed(() => {
    this.formEvents();
    return this.form.controls.thresholdType.value;
  });
  /** Name of the selected group, null when the item has no group. */
  readonly selectedGroupName = computed(() => {
    const groupId = this.groupId();
    return groupId ? (this.groups().find(group => group.id === groupId)?.standardSettings.name ?? null) : null;
  });
  /** The item as currently edited, sent on save and used to test the item. */
  readonly formItem = computed(() => {
    this.formEvents();
    return this.buildFormItem();
  });
  /** Name of the schedule of the item: its own, or its group's while it has one */
  readonly scanModeName = computed(() => this.scanModes().find(scanMode => scanMode.id === this.formItem().scanModeId)?.name ?? null);

  readonly steps = new ItemModalSteps(ITEM_MODAL_STEPS, step => this.stepControls(step), this.formEvents);
  /** A new item is saved from the last step, an edited or copied one from any step */
  readonly canSave = computed(() => this.mode() !== 'create' || this.steps.isLast());

  /**
   * The item as summed up in the Review step. Its history and caching settings are read from the controls, which hold the
   * group's values while the item is synced with it.
   */
  readonly reviewSummary = computed(() => {
    this.formEvents();
    return this.summarizeItem();
  });
  /** The item as it was when opened for edition, to show what changed in the Review step: null for a new item */
  readonly savedSummary = signal<ItemSummary | null>(null);
  /** How many settings changed since the item was saved: null for a new item */
  readonly changeCount = computed(() => {
    const saved = this.savedSummary();
    return saved ? countItemChanges(this.reviewSummary(), saved) + this.northTransformerChanges() : null;
  });

  readonly itemSettingsAttribute = computed(() => {
    const manifest = this.manifest();
    return manifest ? getItemSettingsAttribute(manifest) : null;
  });

  readonly hasHistorianCapabilities = computed(() => this.manifest()?.modes.history ?? false);

  /**
   * True for the six "IoT family" south types (OPC UA, Modbus, ADS, OPC classic, S7, MQTT). There is no
   * manifest capability flag for this family, so it's checked directly against the connector type string.
   */
  readonly isIotFamilySouthType = computed(() => {
    const manifest = this.manifest();
    return !!manifest && IOT_FAMILY_SOUTH_TYPES.includes(manifest.id);
  });

  /**
   * True for IoT-family types minus MQTT, which does not support the 'threshold' caching strategy (MQTT
   * payloads aren't guaranteed numeric).
   */
  readonly isThresholdAvailable = computed(() => this.isIotFamilySouthType() && this.manifest()?.id !== 'mqtt');

  constructor() {
    // threshold/rangeLow/rangeHigh are only meaningful (and only shown, see the template) once
    // 'threshold' / 'percentage' is selected, but they still need real validators for those cases —
    // otherwise a user can save a 'threshold' strategy with a null threshold, or a 'percentage'
    // threshold type with rangeLow/rangeHigh both null, which silently degrades the percentage-span
    // comparison to `diff > 0` (span defaults to 0) instead of surfacing a validation error.
    this.form.controls.cachingStrategy.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.updateThresholdValidators());
    this.form.controls.thresholdType.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.updateThresholdValidators());
  }

  private getExistingMqttTopics(): Array<string> {
    let otherItems: Array<SouthConnectorItemDTO | SouthConnectorItemCommandDTO>;
    switch (this.mode()) {
      case 'copy':
      case 'create':
        otherItems = this.itemList;
        break;
      case 'edit':
        otherItems = this.item?.id
          ? this.itemList.filter(item => item.id && item.id !== this.item?.id)
          : this.itemList.filter((_, index) => index !== this.tableIndex);
        break;
    }
    return otherItems
      .map(item => ('topic' in item.settings ? item.settings.topic : null))
      .filter((topic): topic is string => typeof topic === 'string' && !!topic.trim());
  }

  /**
   * @param itemList the items of the connector, the one added just before included
   * @param previousItem the item added just before with "save and add another", whose shared settings the new one starts with
   */
  prepareForCreation(
    itemList: Array<SouthConnectorItemDTO | SouthConnectorItemCommandDTO>,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    groups: SouthItemGroups,
    manifest: SouthConnectorManifest,
    southId: string,
    southConnectorCommand: SouthConnectorCommandDTO,
    previousItem: SouthConnectorItemCommandDTO | null = null,
    prefill: SouthConnectorItemCommandDTO | null = null
  ) {
    this.previousItem = previousItem;
    // a new item may start from the one the tables of a database give, which the user completes
    this.prepare('create', itemList, scanModes, certificates, groups, manifest, prefill, southId, southConnectorCommand, null);
  }

  prepareForCopy(
    itemList: Array<SouthConnectorItemDTO | SouthConnectorItemCommandDTO>,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    groups: SouthItemGroups,
    manifest: SouthConnectorManifest,
    item: SouthConnectorItemDTO | SouthConnectorItemCommandDTO,
    southId: string,
    southConnectorCommand: SouthConnectorCommandDTO
  ) {
    const copy = { ...structuredClone(item), name: `${item.name}-copy`, id: '' };
    this.prepare('copy', itemList, scanModes, certificates, groups, manifest, copy, southId, southConnectorCommand, null);
  }

  /**
   * tableIndex is an additional identifier when item ids are not available. This indexes the given itemList param
   */
  prepareForEdition(
    itemList: Array<SouthConnectorItemDTO | SouthConnectorItemCommandDTO>,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    groups: SouthItemGroups,
    manifest: SouthConnectorManifest,
    item: SouthConnectorItemDTO | SouthConnectorItemCommandDTO,
    southId: string,
    southConnectorCommand: SouthConnectorCommandDTO,
    tableIndex: number
  ) {
    this.prepare('edit', itemList, scanModes, certificates, groups, manifest, item, southId, southConnectorCommand, tableIndex);
  }

  private prepare(
    mode: 'create' | 'edit' | 'copy',
    itemList: Array<SouthConnectorItemDTO | SouthConnectorItemCommandDTO>,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    groups: SouthItemGroups,
    manifest: SouthConnectorManifest,
    item: SouthConnectorItemDTO | SouthConnectorItemCommandDTO | null,
    southId: string,
    southConnectorCommand: SouthConnectorCommandDTO,
    tableIndex: number | null
  ) {
    this.mode.set(mode);
    this.itemList = itemList;
    this.southItems.set(itemList);
    this.scanModes.set(this.setScanModes(scanModes, getScanModeAttribute(manifest)));
    this.certificates.set(certificates);
    this.groupStore.set(groups);
    this.manifest.set(manifest);
    this.item = item;
    // an item edited in memory keeps the transformers chosen before, a copy starts without any
    this.savedNorthTransformers = (mode === 'edit' && item && 'northTransformers' in item ? item.northTransformers : undefined) ?? [];
    this.northTransformers.set(this.savedNorthTransformers);
    this.southId.set(southId);
    this.southConnectorCommand.set(southConnectorCommand);
    this.tableIndex = tableIndex;
    this.initForm(manifest);
  }

  /** Whether the connector is a SQL database that can be browsed: the tables and columns help to write the query of the item */
  readonly canBrowseTables = computed(() => {
    const manifest = this.manifest();
    return !!manifest?.explore && manifest.discovery?.kind === 'query';
  });

  /** Browses the tables and columns of the database, nothing more: to copy a name or a query, then come back to the item */
  browseTables() {
    const manifest = this.manifest()!;
    openExploreWizard(this.modalService, {
      southId: this.southId(),
      exploreConnectorId: this.southId() === 'create' ? null : this.southId(),
      southSettings: this.southConnectorCommand()!.settings,
      manifest,
      existingItems: [],
      readOnly: true
    }).subscribe();
  }

  canDismiss(): Observable<boolean> | boolean {
    if (this.form?.dirty || this.northTransformers() !== this.savedNorthTransformers) {
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

  /** Submitting the form (e.g. pressing Enter) saves the item once it can be, and opens the next step before. */
  submit() {
    if (this.canSave()) {
      this.save();
    } else {
      this.steps.next();
    }
  }

  /** @param addAnother true to open the modal again for a new item once this one is saved */
  save(addAnother = false) {
    if (!this.form.valid) {
      this.steps.showFirstInvalid();
      return;
    }
    this.addAnother = addAnother;
    this.modal.close(this.formItem());
  }

  /** The controls edited in each step: the manifest settings in the Settings step, all the others in the General one. */
  private stepControls(step: ItemModalStep): Array<AbstractControl> {
    const { settings, ...generalControls } = this.form.controls;
    switch (step) {
      case 'general':
        return Object.values(generalControls);
      case 'settings':
        return [settings];
      case 'north':
      case 'review':
        return [];
    }
  }

  private buildFormItem(): SouthConnectorItemCommandDTO {
    const formValue = this.form.value;
    // Get raw values for historian fields to include disabled controls
    const rawHistorianValues = {
      maxReadInterval: this.form.controls.maxReadInterval.value,
      readDelay: this.form.controls.readDelay.value,
      startTimeOffset: this.form.controls.startTimeOffset.value,
      endTimeOffset: this.form.controls.endTimeOffset.value,
      recoveryStrategy: this.form.controls.recoveryStrategy.value,
      syncWithGroup: this.form.controls.syncWithGroup.value
    };
    // Caching strategy params (thresholdType/threshold/rangeLow/rangeHigh/maxCachingInterval) are always
    // item-local, so their raw values are read separately below and never nulled/disabled by group sync.

    const scanModeAttribute = getScanModeAttribute(this.manifest()!);

    // When synced with group, use null values to inherit from group
    const syncWithGroup = rawHistorianValues.syncWithGroup && formValue.groupId !== null;

    return {
      id: this.item?.id || '',
      enabled: formValue.enabled!,
      name: formValue.name!,
      scanModeId: scanModeAttribute.acceptableType === 'SUBSCRIPTION' ? 'subscription' : formValue.scanModeId!,
      scanModeName:
        !formValue.scanModeId || scanModeAttribute.acceptableType === 'SUBSCRIPTION'
          ? ''
          : this.scanModes().find(scanMode => scanMode.id === formValue.scanModeId!)!.name,
      settings: extractFormValue(formValue.settings)!,
      groupId: formValue.groupId!,
      groupName: formValue.groupId! ? this.groups().find(group => group.id === formValue.groupId!)!.standardSettings.name : null,
      syncWithGroup,
      maxReadInterval: syncWithGroup ? null : (rawHistorianValues.maxReadInterval ?? null),
      readDelay: syncWithGroup ? null : (rawHistorianValues.readDelay ?? null),
      startTimeOffset: syncWithGroup ? null : (rawHistorianValues.startTimeOffset ?? null),
      endTimeOffset: syncWithGroup ? null : (rawHistorianValues.endTimeOffset ?? null),
      recoveryStrategy: syncWithGroup ? null : (rawHistorianValues.recoveryStrategy ?? null),
      // cachingStrategy follows the same inherit-from-group-when-synced rule as the other historian fields.
      cachingStrategy: syncWithGroup ? null : (this.form.controls.cachingStrategy.value ?? null),
      // Deliberate deviation: unlike the historian fields above, the caching-strategy params are never
      // group-shareable (there is no group source for them), so they are always sent from the form's own
      // current value regardless of syncWithGroup, and are never nulled out or disabled by group sync.
      thresholdType: this.form.controls.thresholdType.value,
      threshold: this.form.controls.threshold.value,
      rangeLow: this.form.controls.rangeLow.value,
      rangeHigh: this.form.controls.rangeHigh.value,
      maxCachingInterval: this.form.controls.maxCachingInterval.value,
      northTransformers: this.northTransformers()
    };
  }

  private mqttCachingStrategyValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      return control.value === 'threshold' ? { mqttThresholdNotAvailable: true } : null;
    };
  }

  /** rangeHigh must be strictly greater than rangeLow, or a percentage-threshold span of 0 (or negative) silently disables the comparison. */
  private rangeHighAboveRangeLowValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const rangeLow = this.form?.controls.rangeLow.value;
      if (control.value === null || rangeLow === null || rangeLow === undefined) return null;
      return control.value <= rangeLow ? { rangeHighNotAboveRangeLow: true } : null;
    };
  }

  /**
   * threshold/rangeLow/rangeHigh are only relevant once 'threshold' (and, for the range fields,
   * 'percentage') is selected, but need real `required` validators in those cases — otherwise the
   * form can be saved with a 'threshold' strategy that has no actual threshold configured.
   */
  private updateThresholdValidators(): void {
    const strategy = this.form.controls.cachingStrategy.value;
    const thresholdType = this.form.controls.thresholdType.value;

    if (strategy === 'threshold') {
      this.form.controls.threshold.setValidators([Validators.required]);
      if (thresholdType === 'percentage') {
        this.form.controls.rangeLow.setValidators([Validators.required]);
        this.form.controls.rangeHigh.setValidators([Validators.required, this.rangeHighAboveRangeLowValidator()]);
      } else {
        this.form.controls.rangeLow.clearValidators();
        this.form.controls.rangeHigh.clearValidators();
      }
    } else {
      this.form.controls.threshold.clearValidators();
      this.form.controls.rangeLow.clearValidators();
      this.form.controls.rangeHigh.clearValidators();
    }
    this.form.controls.threshold.updateValueAndValidity({ emitEvent: false });
    this.form.controls.rangeLow.updateValueAndValidity({ emitEvent: false });
    this.form.controls.rangeHigh.updateValueAndValidity({ emitEvent: false });
  }

  private checkUniqueness(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      let names!: Array<string>;

      switch (this.mode()) {
        case 'copy':
        case 'create':
          names = this.itemList.map(item => item.name);
          break;
        case 'edit':
          // Saved items are identified by id; unsaved (in-memory) ones only by their position in itemList
          if (this.item!.id) {
            names = this.itemList.filter(item => item.id !== this.item!.id).map(item => item.name);
          } else {
            names = this.itemList.filter((_, index) => index !== this.tableIndex).map(item => item.name);
          }
          break;
      }

      return names.includes(control.value) ? { mustBeUnique: true } : null;
    };
  }

  private initForm(manifest: SouthConnectorManifest) {
    this.previousGroupId = null;

    const settingsAttribute = getItemSettingsAttribute(manifest);
    for (const attribute of settingsAttribute.attributes) {
      addAttributeToForm(this.fb, this.form.controls.settings, attribute);
    }
    if (manifest.id === 'mqtt') {
      createMqttValidator(this.form.controls.settings, this.getExistingMqttTopics());
      // Defense in depth alongside hiding the 'threshold' option in the template for MQTT items.
      this.form.controls.cachingStrategy.addValidators(this.mqttCachingStrategyValidator());
    }
    this.updateThresholdValidators();

    const scanModeAttribute = getScanModeAttribute(manifest);
    if (scanModeAttribute.acceptableType === 'SUBSCRIPTION') {
      this.form.controls.scanModeId.disable();
    } else {
      this.form.controls.scanModeId.enable();
    }

    // An item added after another one starts with its settings shared by the items added in a row, but neither its
    // name nor its connector settings, which tell the items apart
    const source = this.item ?? this.previousItem;
    if (source) {
      this.previousGroupId = this.getGroupId(source);

      this.form.patchValue({
        name: this.item?.name ?? '',
        groupId: this.previousGroupId,
        scanModeId: this.getScanModeId(source),
        enabled: source.enabled,
        syncWithGroup: source.syncWithGroup ?? false,
        maxReadInterval: source.maxReadInterval ?? 3600,
        readDelay: source.readDelay ?? 200,
        startTimeOffset: source.startTimeOffset ?? 0,
        endTimeOffset: source.endTimeOffset ?? 0,
        recoveryStrategy: source.recoveryStrategy ?? 'oldest',
        cachingStrategy: source.cachingStrategy ?? 'allValues',
        thresholdType: source.thresholdType ?? null,
        threshold: source.threshold ?? null,
        rangeLow: source.rangeLow ?? null,
        rangeHigh: source.rangeHigh ?? null,
        maxCachingInterval: source.maxCachingInterval ?? null,
        settings: this.item?.settings ?? this.form.controls.settings.getRawValue()
      });

      // Apply sync behavior to update field states
      if (this.previousGroupId) {
        this.onSyncWithGroupChange();
      }
    } else {
      this.form.setValue(this.form.getRawValue());
    }
    this.savedSummary.set(this.mode() === 'edit' ? this.summarizeItem() : null);
  }

  /** The item as currently edited, summed up: see `reviewSummary` */
  private summarizeItem(): ItemSummary {
    // the history and caching settings are read from the controls, which hold the group's values while the item is synced with it
    const controls = this.form.controls;
    const item = this.formItem();
    return summarizeSouthItem(
      {
        name: item.name,
        enabled: item.enabled,
        groupName: item.groupName,
        scanModeName: this.scanModeName(),
        syncWithGroup: controls.syncWithGroup.value,
        maxReadInterval: controls.maxReadInterval.value,
        readDelay: controls.readDelay.value,
        recoveryStrategy: controls.recoveryStrategy.value,
        startTimeOffset: controls.startTimeOffset.value,
        endTimeOffset: controls.endTimeOffset.value,
        cachingStrategy: controls.cachingStrategy.value,
        thresholdType: controls.thresholdType.value,
        threshold: controls.threshold.value,
        rangeLow: controls.rangeLow.value,
        rangeHigh: controls.rangeHigh.value,
        maxCachingInterval: controls.maxCachingInterval.value,
        settings: item.settings
      },
      this.manifest()!,
      {
        translateService: this.translateService,
        scanModes: this.scanModes(),
        certificates: this.certificates(),
        isInvalid: path => this.form.get(path)?.invalid ?? false
      }
    );
  }

  getGroupId(item: SouthConnectorItemCommandDTO | SouthConnectorItemDTO): string | null {
    return (item as SouthConnectorItemCommandDTO).groupId || (item as SouthConnectorItemDTO).group?.id || null;
  }

  getScanModeId(item: SouthConnectorItemCommandDTO | SouthConnectorItemDTO): string | null {
    return (item as SouthConnectorItemCommandDTO).scanModeId || (item as SouthConnectorItemDTO).scanMode?.id || null;
  }

  onSelectGroup(groupId: string | null) {
    const wasUnassigned = this.previousGroupId === null;
    this.form.controls.groupId.setValue(groupId);
    this.previousGroupId = groupId;

    if (groupId === null) {
      this.dropGroupTransformers();
      // When deselecting group, enable historian fields and set sync to false
      this.form.controls.syncWithGroup.setValue(false);
      this.form.controls.maxReadInterval.enable();
      this.form.controls.readDelay.enable();
      this.form.controls.startTimeOffset.enable();
      this.form.controls.endTimeOffset.enable();
      this.form.controls.recoveryStrategy.enable();
      this.form.controls.cachingStrategy.enable();
    } else {
      const selectedGroup = this.groups().find(g => g.id === groupId)!;
      this.applySyncLogicWhenSelectingGroup(selectedGroup, wasUnassigned);
    }
  }

  /** How many Norths are given another transformer to attach since the item was opened */
  private northTransformerChanges(): number {
    const current = this.northTransformers();
    const northIds = new Set([...current, ...this.savedNorthTransformers].map(northTransformer => northTransformer.northId));
    const find = (list: Array<SouthItemNorthTransformerCommandDTO>, northId: string) =>
      JSON.stringify(list.find(northTransformer => northTransformer.northId === northId) ?? null);
    return [...northIds].filter(northId => find(current, northId) !== find(this.savedNorthTransformers, northId)).length;
  }

  /** A transformer attached to the group of the item no longer has one to apply to once the item leaves its group */
  private dropGroupTransformers() {
    if (this.northTransformers().some(northTransformer => northTransformer.scope === 'group')) {
      this.northTransformers.update(northTransformers => northTransformers.filter(northTransformer => northTransformer.scope !== 'group'));
    }
  }

  onAddGroup() {
    this.openGroupModal().subscribe(groupResult => {
      const wasUnassigned = this.previousGroupId === null;
      this.form.controls.groupId.setValue(groupResult.id);
      this.previousGroupId = groupResult.id;
      this.applySyncLogicWhenSelectingGroup(groupResult, wasUnassigned);
    });
  }

  onEditGroup(group: SouthItemGroup, event: Event) {
    event.stopPropagation();
    this.openGroupModal(group).subscribe(groupResult => {
      if (this.form.controls.groupId.value === groupResult.id) {
        // The group itself was edited (not reselected) — reflect its new scan mode / historian
        // values without touching the item's current sync-with-group setting.
        this.applySyncLogicWhenSelectingGroup(groupResult, false);
      }
    });
  }

  private openGroupModal(group?: SouthItemGroup) {
    return openGroupModal(this.modalService, this.groupStore()!, {
      scanModes: this.scanModes(),
      manifest: this.manifest()!,
      directSave: this.directSave,
      group
    });
  }

  onDeleteGroup(group: SouthItemGroup, event: Event) {
    event.stopPropagation();
    this.groupStore()!
      .delete(group)
      .subscribe(() => {
        if (this.form.controls.groupId.value === group.id) {
          // the item no longer has a group: its own historian settings apply again
          this.onSelectGroup(null);
        }
      });
  }

  /**
   * Applies the group's scan mode to the form (the scan mode field is hidden and always mirrors
   * the group's schedule while a group is assigned). Sync-with-group is only forced on when the
   * item previously had no group at all; switching from one group to another keeps whatever
   * sync-with-group setting the item already had.
   */
  private applySyncLogicWhenSelectingGroup(group: SouthItemGroupDTO | SouthItemGroupCommandDTO, wasUnassigned: boolean) {
    const groupScanMode = this.scanModes().find(
      s =>
        s.id ===
        ((group as SouthItemGroupCommandDTO).standardSettings.scanModeId || (group as SouthItemGroupDTO).standardSettings.scanMode.id)
    );
    if (groupScanMode) {
      this.form.controls.scanModeId.setValue(groupScanMode.id);
    }

    if (wasUnassigned) {
      this.form.controls.syncWithGroup.setValue(true);
    }
    this.onSyncWithGroupChange();
  }

  onSyncWithGroupChange() {
    const syncWithGroup = this.form.controls.syncWithGroup.value;
    const groupId = this.form.controls.groupId.value;

    if (!groupId) {
      // No group selected, enable all fields
      this.form.controls.maxReadInterval.enable();
      this.form.controls.readDelay.enable();
      this.form.controls.startTimeOffset.enable();
      this.form.controls.endTimeOffset.enable();
      this.form.controls.recoveryStrategy.enable();
      this.form.controls.cachingStrategy.enable();
      return;
    }

    if (syncWithGroup) {
      // Sync enabled: disable fields and show group values.
      // Note: only cachingStrategy is disabled/patched from the group here. The five caching-strategy
      // params (thresholdType/threshold/rangeLow/rangeHigh/maxCachingInterval) have no group-shared
      // counterpart, so they are deliberately left enabled and user-editable at all times, even while
      // cachingStrategy itself is synced with the group.
      const groupValues = this.getSelectedGroupValues();
      this.form.controls.maxReadInterval.disable();
      this.form.controls.readDelay.disable();
      this.form.controls.startTimeOffset.disable();
      this.form.controls.endTimeOffset.disable();
      this.form.controls.recoveryStrategy.disable();
      this.form.controls.cachingStrategy.disable();
      this.form.patchValue(
        {
          maxReadInterval: groupValues.maxReadInterval,
          readDelay: groupValues.readDelay,
          startTimeOffset: groupValues.startTimeOffset,
          endTimeOffset: groupValues.endTimeOffset,
          recoveryStrategy: groupValues.recoveryStrategy,
          cachingStrategy: groupValues.cachingStrategy
        },
        { emitEvent: false }
      );
    } else {
      // Sync disabled: enable fields for manual override
      this.form.controls.maxReadInterval.enable();
      this.form.controls.readDelay.enable();
      this.form.controls.startTimeOffset.enable();
      this.form.controls.endTimeOffset.enable();
      this.form.controls.recoveryStrategy.enable();
      this.form.controls.cachingStrategy.enable();
      // Don't patch values here - keep user's values
    }
  }

  private getSelectedGroupValues(): {
    maxReadInterval: number | null;
    readDelay: number | null;
    startTimeOffset: number | null;
    endTimeOffset: number | null;
    recoveryStrategy: SouthHistoryRecoveryStrategy | null;
    cachingStrategy: SouthCachingStrategy | null;
  } {
    const groupId = this.form.controls.groupId.value;
    const group = groupId ? this.groups().find(g => g.id === groupId) : null;
    return {
      maxReadInterval: group?.historySettings.maxReadInterval ?? 3600,
      readDelay: group?.historySettings.readDelay ?? 200,
      startTimeOffset: group?.historySettings.startTimeOffset ?? 0,
      endTimeOffset: group?.historySettings.endTimeOffset ?? 0,
      recoveryStrategy: group?.historySettings.recoveryStrategy ?? 'oldest',
      // No group source for the caching-strategy params: only cachingStrategy itself is group-fallback.
      cachingStrategy: group?.historySettings.cachingStrategy ?? 'allValues'
    };
  }

  setScanModes(scanModes: Array<ScanModeDTO>, scanModeAttribute: OIBusScanModeAttribute): Array<ScanModeDTO> {
    if (scanModeAttribute.acceptableType === 'SUBSCRIPTION') {
      return scanModes.filter(scanMode => scanMode.id === 'subscription');
    } else if (scanModeAttribute.acceptableType === 'POLL') {
      return scanModes.filter(scanMode => scanMode.id !== 'subscription');
    } else {
      return scanModes;
    }
  }
}

export default EditSouthItemModalComponent;
