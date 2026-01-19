import { Component, forwardRef, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
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
import { TranslateDirective } from '@ngx-translate/core';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorManifest,
  SouthItemGroupDTO
} from '../../../../../../backend/shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import SouthItemTestComponent from '../south-item-test/south-item-test.component';
import { OIBusObjectAttribute, OIBusScanModeAttribute } from '../../../../../../backend/shared/model/form.model';
import { addAttributeToForm, createMqttValidator } from '../../../shared/form/dynamic-form.builder';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { CertificateDTO } from '../../../../../../backend/shared/model/certificate.model';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { Observable } from 'rxjs';
import { OIBUS_FORM_MODE } from '../../../shared/form/oibus-form-mode.token';
import { SouthConnectorService } from '../../../services/south-connector.service';
import { ModalService } from '../../../shared/modal.service';
import { EditSouthItemGroupModalComponent } from '../edit-south-item-group-modal/edit-south-item-group-modal.component';
import { ConfirmationService } from '../../../shared/confirmation.service';
import { NotificationService } from '../../../shared/notification.service';

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
    OIBusObjectFormControlComponent
  ],
  viewProviders: [
    {
      provide: OIBUS_FORM_MODE,
      useFactory: (component: EditSouthItemModalComponent) => () => (component.mode === 'edit' ? 'edit' : 'create'),
      deps: [forwardRef(() => EditSouthItemModalComponent)]
    }
  ]
})
export class EditSouthItemModalComponent {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);
  private southConnectorService = inject(SouthConnectorService);
  private modalService = inject(ModalService);
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);

  mode: 'create' | 'edit' | 'copy' = 'create';
  state = new ObservableState();
  scanModes: Array<ScanModeDTO> = [];
  certificates: Array<CertificateDTO> = [];
  southId!: string;
  southConnectorCommand!: SouthConnectorCommandDTO;
  manifest!: SouthConnectorManifest;
  item: SouthConnectorItemDTO | null = null;
  itemList: Array<SouthConnectorItemDTO> = [];
  groups: Array<SouthItemGroupDTO> = [];
  private previousGroupId: string | null = null;

  /** Not every item passed will have an id, but we still need to check for uniqueness.
   * This ensures that we have a backup identifier for the currently edited item.
   * In 'copy' and 'create' cases, we always check all items' names
   */
  tableIndex: number | null = null;

  form: FormGroup<{
    name: FormControl<string>;
    groupId: FormControl<string | null>;
    scanMode: FormControl<ScanModeDTO | null>;
    enabled: FormControl<boolean>;
    settings: FormGroup;
  }> | null = null;

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

  /**
   * Prepares the component for creation.
   */
  prepareForCreation(
    itemList: Array<SouthConnectorItemDTO>,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    southId: string,
    southConnectorCommand: SouthConnectorCommandDTO,
    manifest: SouthConnectorManifest
  ) {
    this.mode = 'create';
    this.manifest = manifest;
    this.southId = southId;
    this.southConnectorCommand = southConnectorCommand;
    this.itemList = itemList;
    this.scanModes = this.setScanModes(scanModes, this.getScanModeAttribute());
    this.certificates = certificates;
    this.loadGroups();
    this.buildForm();
  }

  /**
   * Prepares the component to edit.
   * tableIndex is an additional identifier when item ids are not available. This indexes the given itemList param
   */
  prepareForEdition(
    itemList: Array<SouthConnectorItemDTO>,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    southItem: SouthConnectorItemDTO,
    southId: string,
    southConnectorCommand: SouthConnectorCommandDTO,
    manifest: SouthConnectorManifest,
    tableIndex: number
  ) {
    this.mode = 'edit';
    this.manifest = manifest;
    this.southId = southId;
    this.southConnectorCommand = southConnectorCommand;
    this.itemList = itemList;
    this.item = southItem; // used to check uniqueness
    this.scanModes = this.setScanModes(scanModes, this.getScanModeAttribute());
    this.certificates = certificates;
    this.tableIndex = tableIndex;
    this.loadGroups();
    this.buildForm();
  }

  /**
   * Prepares the component to edit
   */
  prepareForCopy(
    itemList: Array<SouthConnectorItemDTO>,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    item: SouthConnectorItemDTO,
    southId: string,
    southConnectorCommand: SouthConnectorCommandDTO,
    manifest: SouthConnectorManifest
  ) {
    this.mode = 'copy';
    this.manifest = manifest;
    this.southId = southId;
    this.southConnectorCommand = southConnectorCommand;
    this.itemList = itemList;
    this.loadGroups();
    this.scanModes = this.setScanModes(scanModes, this.getScanModeAttribute());
    this.certificates = certificates;
    // used to check uniqueness
    this.item = JSON.parse(JSON.stringify(item)) as SouthConnectorItemDTO;
    this.item.name = `${item.name}-copy`;
    this.item.id = '';
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

  get formItem(): SouthConnectorItemDTO {
    const formValue = this.form!.value;

    const scanModeAttribute = this.getScanModeAttribute();
    const group = formValue.groupId ? this.groups.find(g => g.id === formValue.groupId) : null;
    return {
      id: this.item?.id || '',
      enabled: formValue.enabled!,
      name: formValue.name!,
      scanMode:
        scanModeAttribute.acceptableType === 'SUBSCRIPTION'
          ? { id: 'subscription', name: 'subscription', description: '', cron: '' }
          : formValue.scanMode!,
      settings: formValue.settings!,
      group: group || null
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

  private loadGroups() {
    if (this.southId !== 'create') {
      this.southConnectorService.getGroups(this.southId).subscribe(groups => {
        this.groups = groups;
      });
    } else {
      this.groups = [];
    }
  }

  private buildForm() {
    this.form = this.fb.group({
      name: ['', [Validators.required, this.checkUniqueness()]],
      groupId: [null as string | null],
      enabled: [true, Validators.required],
      scanMode: this.fb.control<ScanModeDTO | null>(null, Validators.required),
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

    const scanModeAttribute = this.getScanModeAttribute();
    if (scanModeAttribute.acceptableType === 'SUBSCRIPTION') {
      this.form.controls.scanMode.disable();
    } else {
      this.form.controls.scanMode.enable();
    }

    // if we have an item, we initialize the values
    if (this.item) {
      this.item.scanMode = this.scanModes.find(element => element.id === this.item!.scanMode.id)!; // used to have the same ref
      this.previousGroupId = this.item.group?.id || null;
      this.form.patchValue({
        ...this.item,
        groupId: this.item.group?.id || null
      });
    } else {
      this.form.setValue(this.form.getRawValue());
    }
  }

  onEditGroup(group: SouthItemGroupDTO, event: Event) {
    event.stopPropagation();
    const modalRef = this.modalService.open(EditSouthItemGroupModalComponent, { backdrop: 'static' });
    const component: EditSouthItemGroupModalComponent = modalRef.componentInstance;
    component.prepareForEdition(this.southId, this.scanModes, this.manifest, group, this.groups);

    modalRef.result.subscribe((updatedGroup: SouthItemGroupDTO) => {
      if (updatedGroup) {
        const index = this.groups.findIndex(g => g.id === updatedGroup.id);
        if (index >= 0) {
          this.groups[index] = updatedGroup;
        }
        if (this.form!.controls.groupId.value === updatedGroup.id) {
          // Refresh the form if the current group was updated
          this.form!.controls.groupId.setValue(updatedGroup.id);
        }
      }
    });
  }

  onDeleteGroup(group: SouthItemGroupDTO, event: Event) {
    event.stopPropagation();
    this.confirmationService
      .confirm({
        messageKey: 'south.groups.confirm-deletion',
        interpolateParams: { name: group.name }
      })
      .subscribe(() => {
        this.southConnectorService.deleteGroup(this.southId, group.id).subscribe({
          next: () => {
            this.groups = this.groups.filter(g => g.id !== group.id);
            if (this.form!.controls.groupId.value === group.id) {
              this.form!.controls.groupId.setValue(null);
            }
            this.notificationService.success('south.groups.deleted');
          },
          error: error => {
            this.notificationService.error('south.groups.delete-error', { error: error.message });
          }
        });
      });
  }

  onGroupChange(_event: Event) {
    const currentValue = this.form!.controls.groupId.value;
    if (currentValue === '__create_new__') {
      // Reset to previous value first
      const previousValue = this.previousGroupId || null;
      this.form!.controls.groupId.setValue(previousValue, { emitEvent: false });

      // Open the create group modal
      const modalRef = this.modalService.open(EditSouthItemGroupModalComponent, { backdrop: 'static' });
      const component: EditSouthItemGroupModalComponent = modalRef.componentInstance;
      component.prepareForCreation(this.southId, this.scanModes, this.manifest, this.groups);

      modalRef.result.subscribe({
        next: (group: SouthItemGroupDTO) => {
          if (group) {
            this.groups.push(group);
            this.form!.controls.groupId.setValue(group.id);
            this.previousGroupId = group.id;
          }
        },
        error: () => {
          // Modal was dismissed, do nothing - value is already reset
        }
      });
    } else {
      // Store the current value as previous for next time
      this.previousGroupId = currentValue;
    }
  }

  getScanModeAttribute(): OIBusScanModeAttribute {
    return this.manifest!.items.rootAttribute.attributes.find(element => element.key === 'scanMode')! as OIBusScanModeAttribute;
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

  getItemSettingsAttribute(): OIBusObjectAttribute {
    return this.manifest.items.rootAttribute.attributes.find(element => element.key === 'settings')! as OIBusObjectAttribute;
  }
}
