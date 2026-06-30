import { Component, forwardRef, inject, ChangeDetectionStrategy } from '@angular/core';
import { NgbActiveModal, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
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
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateDirective, TranslateService } from '@ngx-translate/core';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorManifest,
  SouthHistoryRecoveryStrategy,
  SouthItemGroupCommandDTO,
  SouthItemGroupDTO
} from '../../../../../../backend/shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import SouthItemTestComponent from '../south-item-test/south-item-test.component';
import { OIBusObjectAttribute, OIBusScanModeAttribute } from '../../../../../../backend/shared/model/form.model';
import { addAttributeToForm, createMqttValidator, extractFormValue } from '../../../shared/form/dynamic-form.builder';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { CertificateDTO } from '../../../../../../backend/shared/model/certificate.model';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { Observable, switchMap } from 'rxjs';
import { OIBUS_FORM_MODE } from '../../../shared/form/oibus-form-mode.token';
import { ModalService } from '../../../shared/modal.service';
import { EditSouthItemGroupModalComponent } from '../edit-south-item-group-modal/edit-south-item-group-modal.component';

@Component({
  selector: 'oib-edit-south-item-modal',
  templateUrl: './edit-south-item-modal.component.html',
  styleUrl: './edit-south-item-modal.component.scss',
  imports: [
    TranslateDirective,
    SaveButtonComponent,
    SouthItemTestComponent,
    ReactiveFormsModule,
    OI_FORM_VALIDATION_DIRECTIVES,
    OIBusObjectFormControlComponent,
    NgbDropdownModule
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  viewProviders: [
    {
      provide: OIBUS_FORM_MODE,
      useFactory: (component: EditSouthItemModalComponent) => () => (component.mode === 'edit' ? 'edit' : 'create'),
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

  mode: 'create' | 'edit' | 'copy' = 'create';
  /** True when opened from south-detail (saves directly to API); false when opened from edit-south (changes are applied in-memory). */
  directSave = true;
  state = new ObservableState();
  scanModes: Array<ScanModeDTO> = [];
  certificates: Array<CertificateDTO> = [];
  southId!: string;
  southConnectorCommand!: SouthConnectorCommandDTO;
  manifest!: SouthConnectorManifest;
  item: SouthConnectorItemDTO | SouthConnectorItemCommandDTO | null = null;
  itemList: Array<SouthConnectorItemDTO | SouthConnectorItemCommandDTO> = [];
  groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO> = [];
  addOrEditGroup!: (command: {
    mode: 'create' | 'edit';
    group: SouthItemGroupCommandDTO;
  }) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>;
  deleteGroup!: (group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => Observable<void>;
  private previousGroupId: string | null = null;

  /** Not every item passed will have an id, but we still need to check for uniqueness.
   * This ensures that we have a backup identifier for the currently edited item.
   * In 'copy' and 'create' cases, we always check all items' names
   */
  tableIndex: number | null = null;

  readonly recoveryStrategies: Array<{ value: SouthHistoryRecoveryStrategy; labelKey: string }> = [
    { value: 'newest', labelKey: 'south.items.recovery-strategy-newest' }
  ];

  form: FormGroup<{
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
    settings: FormGroup;
  }> | null = null;

  get hasHistorianCapabilities(): boolean {
    return this.manifest?.modes?.history;
  }

  private getExistingMqttTopics(): Array<string> {
    let existingTopics: Array<string> = [];

    switch (this.mode) {
      case 'copy':
      case 'create':
        existingTopics = this.itemList
          .map(item => (item.settings as any)?.topic)
          .filter(topic => topic && typeof topic === 'string' && topic.trim());
        break;
      case 'edit':
        if (this.item?.id) {
          existingTopics = this.itemList
            .filter(item => item.id && item.id !== this.item?.id)
            .map(item => (item.settings as any)?.topic)
            .filter(topic => topic && typeof topic === 'string' && topic.trim());
        } else {
          existingTopics = this.itemList
            .filter((_, index) => index !== this.tableIndex)
            .map(item => (item.settings as any)?.topic)
            .filter(topic => topic && typeof topic === 'string' && topic.trim());
        }
        break;
    }

    return existingTopics;
  }

  prepareForCreation(
    itemList: Array<SouthConnectorItemDTO | SouthConnectorItemCommandDTO>,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    groups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO>,
    manifest: SouthConnectorManifest,
    southId: string,
    southConnectorCommand: SouthConnectorCommandDTO,
    addOrEditGroup: (command: {
      mode: 'create' | 'edit';
      group: SouthItemGroupCommandDTO;
    }) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>,
    deleteGroup: (group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => Observable<void>
  ) {
    this.mode = 'create';
    this.itemList = itemList;
    this.scanModes = this.setScanModes(scanModes, this.getScanModeAttribute(manifest));
    this.certificates = certificates;
    this.groups = groups;
    this.manifest = manifest;
    this.southId = southId;
    this.southConnectorCommand = southConnectorCommand;
    this.addOrEditGroup = addOrEditGroup;
    this.deleteGroup = deleteGroup;
    this.buildForm();
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
    addOrEditGroup: (command: {
      mode: 'create' | 'edit';
      group: SouthItemGroupCommandDTO;
    }) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>,
    deleteGroup: (group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => Observable<void>
  ) {
    this.mode = 'copy';
    this.itemList = itemList;
    this.scanModes = this.setScanModes(scanModes, this.getScanModeAttribute(manifest));
    this.certificates = certificates;
    this.groups = groups;
    this.manifest = manifest;
    this.item = JSON.parse(JSON.stringify(item)) as SouthConnectorItemDTO;
    this.item.name = `${item.name}-copy`;
    this.item.id = '';
    this.southId = southId;
    this.southConnectorCommand = southConnectorCommand;
    this.addOrEditGroup = addOrEditGroup;
    this.deleteGroup = deleteGroup;
    this.buildForm();
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
    addOrEditGroup: (command: {
      mode: 'create' | 'edit';
      group: SouthItemGroupCommandDTO;
    }) => Observable<SouthItemGroupDTO | SouthItemGroupCommandDTO>,
    deleteGroup: (group: SouthItemGroupDTO | SouthItemGroupCommandDTO) => Observable<void>
  ) {
    this.mode = 'edit';
    this.itemList = itemList;
    this.scanModes = this.setScanModes(scanModes, this.getScanModeAttribute(manifest));
    this.certificates = certificates;
    this.groups = groups;
    this.manifest = manifest;
    this.item = item;
    this.southId = southId;
    this.southConnectorCommand = southConnectorCommand;
    this.tableIndex = tableIndex;
    this.addOrEditGroup = addOrEditGroup;
    this.deleteGroup = deleteGroup;
    this.buildForm();
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
    if (!this.form!.valid) {
      return;
    }
    this.modal.close(this.formItem);
  }

  get formItem(): SouthConnectorItemCommandDTO {
    const formValue = this.form!.value;
    // Get raw values for historian fields to include disabled controls
    const rawHistorianValues = {
      maxReadInterval: this.form!.controls.maxReadInterval.value,
      readDelay: this.form!.controls.readDelay.value,
      startTimeOffset: this.form!.controls.startTimeOffset.value,
      endTimeOffset: this.form!.controls.endTimeOffset.value,
      recoveryStrategy: this.form!.controls.recoveryStrategy.value,
      syncWithGroup: this.form!.controls.syncWithGroup.value
    };

    const scanModeAttribute = this.getScanModeAttribute(this.manifest!);

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
          : this.scanModes.find(scanMode => scanMode.id === formValue.scanModeId!)!.name,
      settings: extractFormValue(formValue.settings)!,
      groupId: formValue.groupId!,
      groupName: formValue.groupId! ? this.groups.find(group => group.id === formValue.groupId!)!.standardSettings.name : null,
      syncWithGroup,
      maxReadInterval: syncWithGroup ? null : (rawHistorianValues.maxReadInterval ?? null),
      readDelay: syncWithGroup ? null : (rawHistorianValues.readDelay ?? null),
      startTimeOffset: syncWithGroup ? null : (rawHistorianValues.startTimeOffset ?? null),
      endTimeOffset: syncWithGroup ? null : (rawHistorianValues.endTimeOffset ?? null),
      recoveryStrategy: syncWithGroup ? null : (rawHistorianValues.recoveryStrategy ?? null)
    };
  }

  private checkUniqueness(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      let names!: Array<string>;

      switch (this.mode) {
        case 'copy':
        case 'create':
          names = this.itemList.map(item => item.name);
          break;
        case 'edit':
          if (this.item!.id) {
            names = this.itemList.filter(item => item.id && item.id !== this.item?.id).map(item => item.name);
          }
          names = this.itemList.filter((_, index) => index !== this.tableIndex).map(item => item.name);
          break;
      }

      return names.includes(control.value) ? { mustBeUnique: true } : null;
    };
  }

  // Groups are now passed from parent component

  private buildForm() {
    this.form = this.fb.group({
      name: ['', [Validators.required, this.checkUniqueness()]],
      groupId: [null as string | null],
      enabled: [true, Validators.required],
      scanModeId: [null as string | null, Validators.required],
      syncWithGroup: [false], // Default to false; will be set to true when group is selected
      maxReadInterval: [null as number | null, [Validators.min(0)]],
      readDelay: [null as number | null, [Validators.min(0)]],
      startTimeOffset: [null as number | null, [Validators.min(-2147483648), Validators.max(2147483647)]],
      endTimeOffset: [null as number | null, [Validators.min(-2147483648), Validators.max(2147483647)]],
      recoveryStrategy: [null as SouthHistoryRecoveryStrategy | null],
      settings: this.fb.group({})
    });
    this.previousGroupId = null;

    const settingsAttribute = this.manifest.items.rootAttribute.attributes.find(
      element => element.key === 'settings'
    )! as OIBusObjectAttribute;
    for (const attribute of settingsAttribute.attributes) {
      addAttributeToForm(this.fb, this.form.controls.settings, attribute);
    }
    if (this.manifest.id === 'mqtt') {
      createMqttValidator(this.form.controls.settings, this.getExistingMqttTopics());
    }

    const scanModeAttribute = this.getScanModeAttribute(this.manifest!);
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
        maxReadInterval: this.item.maxReadInterval ?? null,
        readDelay: this.item.readDelay ?? null,
        startTimeOffset: this.item.startTimeOffset ?? null,
        endTimeOffset: this.item.endTimeOffset ?? null,
        recoveryStrategy: this.item.recoveryStrategy ?? null,
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
    this.form!.controls.groupId.setValue(groupId);
    this.previousGroupId = groupId;

    if (groupId === null) {
      // When deselecting group, enable historian fields and set sync to false
      this.form!.controls.syncWithGroup.setValue(false);
      this.form!.controls.maxReadInterval.enable();
      this.form!.controls.readDelay.enable();
      this.form!.controls.startTimeOffset.enable();
      this.form!.controls.endTimeOffset.enable();
      this.form!.controls.recoveryStrategy.enable();
    } else {
      const selectedGroup = this.groups.find(g => g.id === groupId)!;
      this.applySyncLogicWhenSelectingGroup(selectedGroup, wasUnassigned);
    }
  }

  onAddGroup() {
    const modalRef = this.modalService.open(EditSouthItemGroupModalComponent, { backdrop: 'static' });
    const component: EditSouthItemGroupModalComponent = modalRef.componentInstance;
    component.directSave = this.directSave;
    component.prepareForCreation(this.scanModes, this.groups, this.manifest);
    modalRef.result
      .pipe(
        switchMap(result => {
          return this.addOrEditGroup(result);
        })
      )
      .subscribe((groupResult: SouthItemGroupDTO | SouthItemGroupCommandDTO) => {
        const wasUnassigned = this.previousGroupId === null;
        this.groups.push(groupResult);
        this.form!.controls.groupId.setValue(groupResult.id);
        this.previousGroupId = groupResult.id;
        this.applySyncLogicWhenSelectingGroup(groupResult, wasUnassigned);
      });
  }

  onEditGroup(group: SouthItemGroupDTO | SouthItemGroupCommandDTO, event: Event) {
    event.stopPropagation();
    const modalRef = this.modalService.open(EditSouthItemGroupModalComponent, { backdrop: 'static' });
    const component: EditSouthItemGroupModalComponent = modalRef.componentInstance;
    component.directSave = this.directSave;
    component.prepareForEdition(this.scanModes, this.groups, this.manifest, group);

    modalRef.result
      .pipe(
        switchMap(result => {
          return this.addOrEditGroup(result);
        })
      )
      .subscribe((groupResult: SouthItemGroupDTO | SouthItemGroupCommandDTO) => {
        const index = this.groups.findIndex(g => g.id === groupResult.id);
        if (index >= 0) {
          this.groups[index] = groupResult;
        } else {
          this.groups.push(groupResult);
        }
        if (this.form!.controls.groupId.value === groupResult.id) {
          // The group itself was edited (not reselected) — reflect its new scan mode / historian
          // values without touching the item's current sync-with-group setting.
          this.applySyncLogicWhenSelectingGroup(groupResult, false);
        }
      });
  }

  onDeleteGroup(group: SouthItemGroupDTO | SouthItemGroupCommandDTO, event: Event) {
    event.stopPropagation();
    this.deleteGroup(group).subscribe(() => {
      this.groups = this.groups.filter(g => g.id !== group.id);
      if (this.form!.controls.groupId.value === group.id) {
        this.form!.controls.groupId.setValue(null);
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
    const groupScanMode = this.scanModes.find(
      s =>
        s.id ===
        ((group as SouthItemGroupCommandDTO).standardSettings.scanModeId || (group as SouthItemGroupDTO).standardSettings.scanMode.id)
    );
    if (groupScanMode) {
      this.form!.controls.scanModeId.setValue(groupScanMode.id);
    }

    if (wasUnassigned) {
      this.form!.controls.syncWithGroup.setValue(true);
    }
    this.onSyncWithGroupChange();
  }

  onSyncWithGroupChange() {
    const syncWithGroup = this.form!.controls.syncWithGroup.value;
    const groupId = this.form!.controls.groupId.value;

    if (!groupId) {
      // No group selected, enable all fields
      this.form!.controls.maxReadInterval.enable();
      this.form!.controls.readDelay.enable();
      this.form!.controls.startTimeOffset.enable();
      this.form!.controls.endTimeOffset.enable();
      this.form!.controls.recoveryStrategy.enable();
      return;
    }

    if (syncWithGroup) {
      // Sync enabled: disable fields and show group values
      const groupValues = this.getSelectedGroupValues();
      this.form!.controls.maxReadInterval.disable();
      this.form!.controls.readDelay.disable();
      this.form!.controls.startTimeOffset.disable();
      this.form!.controls.endTimeOffset.disable();
      this.form!.controls.recoveryStrategy.disable();
      this.form!.patchValue(
        {
          maxReadInterval: groupValues.maxReadInterval,
          readDelay: groupValues.readDelay,
          startTimeOffset: groupValues.startTimeOffset,
          endTimeOffset: groupValues.endTimeOffset,
          recoveryStrategy: groupValues.recoveryStrategy
        },
        { emitEvent: false }
      );
    } else {
      // Sync disabled: enable fields for manual override
      this.form!.controls.maxReadInterval.enable();
      this.form!.controls.readDelay.enable();
      this.form!.controls.startTimeOffset.enable();
      this.form!.controls.endTimeOffset.enable();
      this.form!.controls.recoveryStrategy.enable();
      // Don't patch values here - keep user's values
    }
  }

  private getSelectedGroupValues(): {
    maxReadInterval: number | null;
    readDelay: number | null;
    startTimeOffset: number | null;
    endTimeOffset: number | null;
    recoveryStrategy: SouthHistoryRecoveryStrategy | null;
  } {
    const groupId = this.form?.controls.groupId.value;
    const group = groupId ? this.groups.find(g => g.id === groupId) : null;
    return {
      maxReadInterval: group?.historySettings.maxReadInterval ?? null,
      readDelay: group?.historySettings.readDelay ?? null,
      startTimeOffset: group?.historySettings.startTimeOffset ?? null,
      endTimeOffset: group?.historySettings.endTimeOffset ?? null,
      recoveryStrategy: group?.historySettings.recoveryStrategy ?? null
    };
  }

  getSelectedGroupName(): string {
    const groupId = this.form?.controls.groupId.value;
    if (!groupId) return this.translateService.instant('south.items.group-none');
    return this.groups.find(g => g.id === groupId)!.standardSettings.name;
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
