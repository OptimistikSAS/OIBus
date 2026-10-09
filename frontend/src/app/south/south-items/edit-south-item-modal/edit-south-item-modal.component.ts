import { ChangeDetectionStrategy, Component, computed, forwardRef, inject, signal } from '@angular/core';
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
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { Observable, switchMap } from 'rxjs';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthItemGroupCommandDTO,
  SouthItemGroupDTO
} from '@oibus/shared/api/south-connector.model';
import { OIBusObjectAttribute, OIBusScanModeAttribute } from '@oibus/shared/connector/form.model';
import { IOT_FAMILY_SOUTH_TYPES, SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthCachingStrategy, SouthCachingThresholdType, SouthHistoryRecoveryStrategy } from '@oibus/shared/domain/south-connector.model';

import { addAttributeToForm, createMqttValidator, extractFormValue } from '../../../shared/form/dynamic-form.builder';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { OIBUS_FORM_MODE } from '../../../shared/form/oibus-form-mode.token';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { ModalService } from '../../../shared/modal.service';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { EditSouthItemGroupModalComponent } from '../edit-south-item-group-modal/edit-south-item-group-modal.component';
import SouthItemTestComponent from '../south-item-test/south-item-test.component';

type AddOrEditGroup = (command: {
  mode: 'create' | 'edit';
  group: SouthItemGroupCommandDTO;
}) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>;
type DeleteGroup = (group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => Observable<void>;

@Component({
  selector: 'oib-edit-south-item-modal',
  templateUrl: './edit-south-item-modal.component.html',
  styleUrl: './edit-south-item-modal.component.scss',
  imports: [
    TranslateDirective,
    TranslatePipe,
    SaveButtonComponent,
    SouthItemTestComponent,
    ReactiveFormsModule,
    OI_FORM_VALIDATION_DIRECTIVES,
    OIBusObjectFormControlComponent,
    NgbDropdownModule
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

  readonly mode = signal<'create' | 'edit' | 'copy'>('create');
  /**
   * True when opened from south-detail (saves directly to API); false when opened from edit-south (changes are applied in-memory).
   * Set by the opener right after opening the modal, before its first change detection.
   */
  directSave = true;
  readonly state = new ObservableState();
  readonly scanModes = signal<Array<ScanModeDTO>>([]);
  readonly certificates = signal<Array<CertificateDTO>>([]);
  readonly southId = signal('');
  readonly southConnectorCommand = signal<SouthConnectorCommandDTO | null>(null);
  readonly manifest = signal<SouthConnectorManifest | null>(null);
  private item: SouthConnectorItemDTO | SouthConnectorItemCommandDTO | null = null;
  private itemList: Array<SouthConnectorItemDTO | SouthConnectorItemCommandDTO> = [];
  /**
   * The opener's own group list, shared by reference and mutated in place (created groups are pushed, deleted ones
   * spliced): edit-south keeps its in-memory groups in it. The template renders the `groups` snapshot instead, refreshed
   * after every change.
   */
  private sharedGroups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO> = [];
  readonly groups = signal<Array<SouthItemGroupDTO | SouthItemGroupCommandDTO>>([]);
  private addOrEditGroup!: AddOrEditGroup;
  private deleteGroup!: DeleteGroup;
  private previousGroupId: string | null = null;

  /** Not every item passed will have an id, but we still need to check for uniqueness.
   * This ensures that we have a backup identifier for the currently edited item.
   * In 'copy' and 'create' cases, we always check all items' names
   */
  private tableIndex: number | null = null;

  readonly recoveryStrategies: Array<{ value: SouthHistoryRecoveryStrategy; labelKey: string }> = [
    { value: 'newest', labelKey: 'south.items.recovery-strategy-newest' },
    { value: 'oldest', labelKey: 'south.items.recovery-strategy-oldest' }
  ];

  readonly cachingStrategies: Array<{ value: SouthCachingStrategy; labelKey: string }> = [
    { value: 'allValues', labelKey: 'south.items.caching-strategy-all-values' },
    { value: 'onChange', labelKey: 'south.items.caching-strategy-on-change' },
    { value: 'threshold', labelKey: 'south.items.caching-strategy-threshold' }
  ];

  readonly thresholdTypes: Array<{ value: SouthCachingThresholdType; labelKey: string }> = [
    { value: 'absolute', labelKey: 'south.items.threshold-type-absolute' },
    { value: 'percentage', labelKey: 'south.items.threshold-type-percentage' }
  ];

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

  prepareForCreation(
    itemList: Array<SouthConnectorItemDTO | SouthConnectorItemCommandDTO>,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO>,
    manifest: SouthConnectorManifest,
    southId: string,
    southConnectorCommand: SouthConnectorCommandDTO,
    addOrEditGroup: AddOrEditGroup,
    deleteGroup: DeleteGroup
  ) {
    this.prepare(
      'create',
      itemList,
      scanModes,
      certificates,
      groups,
      manifest,
      null,
      southId,
      southConnectorCommand,
      null,
      addOrEditGroup,
      deleteGroup
    );
  }

  prepareForCopy(
    itemList: Array<SouthConnectorItemDTO | SouthConnectorItemCommandDTO>,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO>,
    manifest: SouthConnectorManifest,
    item: SouthConnectorItemDTO | SouthConnectorItemCommandDTO,
    southId: string,
    southConnectorCommand: SouthConnectorCommandDTO,
    addOrEditGroup: AddOrEditGroup,
    deleteGroup: DeleteGroup
  ) {
    const copy = { ...structuredClone(item), name: `${item.name}-copy`, id: '' };
    this.prepare(
      'copy',
      itemList,
      scanModes,
      certificates,
      groups,
      manifest,
      copy,
      southId,
      southConnectorCommand,
      null,
      addOrEditGroup,
      deleteGroup
    );
  }

  /**
   * tableIndex is an additional identifier when item ids are not available. This indexes the given itemList param
   */
  prepareForEdition(
    itemList: Array<SouthConnectorItemDTO | SouthConnectorItemCommandDTO>,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO>,
    manifest: SouthConnectorManifest,
    item: SouthConnectorItemDTO | SouthConnectorItemCommandDTO,
    southId: string,
    southConnectorCommand: SouthConnectorCommandDTO,
    tableIndex: number,
    addOrEditGroup: AddOrEditGroup,
    deleteGroup: DeleteGroup
  ) {
    this.prepare(
      'edit',
      itemList,
      scanModes,
      certificates,
      groups,
      manifest,
      item,
      southId,
      southConnectorCommand,
      tableIndex,
      addOrEditGroup,
      deleteGroup
    );
  }

  private prepare(
    mode: 'create' | 'edit' | 'copy',
    itemList: Array<SouthConnectorItemDTO | SouthConnectorItemCommandDTO>,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO>,
    manifest: SouthConnectorManifest,
    item: SouthConnectorItemDTO | SouthConnectorItemCommandDTO | null,
    southId: string,
    southConnectorCommand: SouthConnectorCommandDTO,
    tableIndex: number | null,
    addOrEditGroup: AddOrEditGroup,
    deleteGroup: DeleteGroup
  ) {
    this.mode.set(mode);
    this.itemList = itemList;
    this.scanModes.set(this.setScanModes(scanModes, this.getScanModeAttribute(manifest)));
    this.certificates.set(certificates);
    this.sharedGroups = groups;
    this.refreshGroups();
    this.manifest.set(manifest);
    this.item = item;
    this.southId.set(southId);
    this.southConnectorCommand.set(southConnectorCommand);
    this.tableIndex = tableIndex;
    this.addOrEditGroup = addOrEditGroup;
    this.deleteGroup = deleteGroup;
    this.initForm(manifest);
  }

  /** Re-renders the opener's group list after it was changed in place. */
  private refreshGroups() {
    this.groups.set([...this.sharedGroups]);
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
    this.modal.close(this.formItem());
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

    const scanModeAttribute = this.getScanModeAttribute(this.manifest()!);

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
      maxCachingInterval: this.form.controls.maxCachingInterval.value
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

    const settingsAttribute = this.getItemSettingsAttribute(manifest);
    for (const attribute of settingsAttribute.attributes) {
      addAttributeToForm(this.fb, this.form.controls.settings, attribute);
    }
    if (manifest.id === 'mqtt') {
      createMqttValidator(this.form.controls.settings, this.getExistingMqttTopics());
      // Defense in depth alongside hiding the 'threshold' option in the template for MQTT items.
      this.form.controls.cachingStrategy.addValidators(this.mqttCachingStrategyValidator());
    }
    this.updateThresholdValidators();

    const scanModeAttribute = this.getScanModeAttribute(manifest);
    if (scanModeAttribute.acceptableType === 'SUBSCRIPTION') {
      this.form.controls.scanModeId.disable();
    } else {
      this.form.controls.scanModeId.enable();
    }

    if (this.item) {
      this.previousGroupId = this.getGroupId(this.item);

      this.form.patchValue({
        name: this.item.name,
        groupId: this.previousGroupId,
        scanModeId: this.getScanModeId(this.item),
        enabled: this.item.enabled,
        syncWithGroup: this.item.syncWithGroup ?? false,
        maxReadInterval: this.item.maxReadInterval ?? 3600,
        readDelay: this.item.readDelay ?? 200,
        startTimeOffset: this.item.startTimeOffset ?? 0,
        endTimeOffset: this.item.endTimeOffset ?? 0,
        recoveryStrategy: this.item.recoveryStrategy ?? 'oldest',
        cachingStrategy: this.item.cachingStrategy ?? 'allValues',
        thresholdType: this.item.thresholdType ?? null,
        threshold: this.item.threshold ?? null,
        rangeLow: this.item.rangeLow ?? null,
        rangeHigh: this.item.rangeHigh ?? null,
        maxCachingInterval: this.item.maxCachingInterval ?? null,
        settings: this.item.settings
      });

      // Apply sync behavior to update field states
      if (this.previousGroupId) {
        this.onSyncWithGroupChange();
      }
    } else {
      this.form.setValue(this.form.getRawValue());
    }
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
      // When deselecting group, enable historian fields and set sync to false
      this.form.controls.syncWithGroup.setValue(false);
      this.form.controls.maxReadInterval.enable();
      this.form.controls.readDelay.enable();
      this.form.controls.startTimeOffset.enable();
      this.form.controls.endTimeOffset.enable();
      this.form.controls.recoveryStrategy.enable();
      this.form.controls.cachingStrategy.enable();
    } else {
      const selectedGroup = this.sharedGroups.find(g => g.id === groupId)!;
      this.applySyncLogicWhenSelectingGroup(selectedGroup, wasUnassigned);
    }
  }

  onAddGroup() {
    const modalRef = this.modalService.open(EditSouthItemGroupModalComponent, { backdrop: 'static' });
    const component: EditSouthItemGroupModalComponent = modalRef.componentInstance;
    component.directSave = this.directSave;
    component.prepareForCreation(this.scanModes(), this.sharedGroups, this.manifest()!);
    modalRef.result
      .pipe(
        switchMap(result => {
          return this.addOrEditGroup(result);
        })
      )
      .subscribe((groupResult: SouthItemGroupDTO | SouthItemGroupCommandDTO) => {
        const wasUnassigned = this.previousGroupId === null;
        this.sharedGroups.push(groupResult);
        this.refreshGroups();
        this.form.controls.groupId.setValue(groupResult.id);
        this.previousGroupId = groupResult.id;
        this.applySyncLogicWhenSelectingGroup(groupResult, wasUnassigned);
      });
  }

  onEditGroup(group: SouthItemGroupDTO | SouthItemGroupCommandDTO, event: Event) {
    event.stopPropagation();
    const modalRef = this.modalService.open(EditSouthItemGroupModalComponent, { backdrop: 'static' });
    const component: EditSouthItemGroupModalComponent = modalRef.componentInstance;
    component.directSave = this.directSave;
    component.prepareForEdition(this.scanModes(), this.sharedGroups, this.manifest()!, group);

    modalRef.result
      .pipe(
        switchMap(result => {
          return this.addOrEditGroup(result);
        })
      )
      .subscribe((groupResult: SouthItemGroupDTO | SouthItemGroupCommandDTO) => {
        const index = this.sharedGroups.findIndex(g => g.id === groupResult.id);
        if (index >= 0) {
          this.sharedGroups[index] = groupResult;
        } else {
          this.sharedGroups.push(groupResult);
        }
        this.refreshGroups();
        if (this.form.controls.groupId.value === groupResult.id) {
          // The group itself was edited (not reselected) — reflect its new scan mode / historian
          // values without touching the item's current sync-with-group setting.
          this.applySyncLogicWhenSelectingGroup(groupResult, false);
        }
      });
  }

  onDeleteGroup(group: SouthItemGroupDTO | SouthItemGroupCommandDTO, event: Event) {
    event.stopPropagation();
    this.deleteGroup(group).subscribe(() => {
      // Removed in place: in edit-south, the shared list is the page's own in-memory groups
      const index = this.sharedGroups.findIndex(g => g.id === group.id);
      if (index >= 0) {
        this.sharedGroups.splice(index, 1);
      }
      this.refreshGroups();
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
    const group = groupId ? this.sharedGroups.find(g => g.id === groupId) : null;
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

  getScanModeAttribute(manifest: SouthConnectorManifest): OIBusScanModeAttribute {
    return manifest.items.rootAttribute.attributes.find(element => element.key === 'scanMode')! as OIBusScanModeAttribute;
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

  getItemSettingsAttribute(manifest: SouthConnectorManifest): OIBusObjectAttribute {
    return manifest.items.rootAttribute.attributes.find(element => element.key === 'settings')! as OIBusObjectAttribute;
  }
}

export default EditSouthItemModalComponent;
