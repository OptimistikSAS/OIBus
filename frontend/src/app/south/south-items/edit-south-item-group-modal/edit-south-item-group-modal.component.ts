import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
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
  IOT_FAMILY_SOUTH_TYPES,
  SouthCachingStrategy,
  SouthConnectorManifest,
  SouthHistoryRecoveryStrategy,
  SouthItemGroupCommandDTO,
  SouthItemGroupDTO
} from '../../../../../../backend/shared/model/south-connector.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { Observable } from 'rxjs';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';

@Component({
  selector: 'oib-edit-south-item-group-modal',
  templateUrl: './edit-south-item-group-modal.component.html',
  styleUrl: './edit-south-item-group-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES, SaveButtonComponent]
})
export class EditSouthItemGroupModalComponent {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);

  mode: 'create' | 'edit' = 'create';
  /** True when opened from south-detail (saves directly to API); false when opened from edit-south (changes are applied in-memory). */
  directSave = true;
  state = new ObservableState();
  scanModes: Array<ScanModeDTO> = [];
  manifest!: SouthConnectorManifest;
  group: SouthItemGroupDTO | SouthItemGroupCommandDTO | null = null;
  existingGroups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO> = [];

  readonly recoveryStrategies: Array<{ value: SouthHistoryRecoveryStrategy; labelKey: string }> = [
    { value: 'oldest', labelKey: 'south.groups.recovery-strategy-oldest' },
    { value: 'newest', labelKey: 'south.groups.recovery-strategy-newest' }
  ];

  readonly cachingStrategies: Array<{ value: SouthCachingStrategy; labelKey: string }> = [
    { value: 'allValues', labelKey: 'south.groups.caching-strategy-all-values' },
    { value: 'onChange', labelKey: 'south.groups.caching-strategy-on-change' },
    { value: 'threshold', labelKey: 'south.groups.caching-strategy-threshold' }
  ];

  form: FormGroup<{
    name: FormControl<string>;
    scanModeId: FormControl<string | null>;
    startTimeOffset: FormControl<number | null>;
    endTimeOffset: FormControl<number | null>;
    maxReadInterval: FormControl<number>;
    readDelay: FormControl<number>;
    recoveryStrategy: FormControl<SouthHistoryRecoveryStrategy>;
    cachingStrategy: FormControl<SouthCachingStrategy>;
  }> | null = null;

  get hasHistorianCapabilities(): boolean {
    return this.manifest?.modes?.history;
  }

  /**
   * True for the six "IoT family" south types (OPC UA, Modbus, ADS, OPC classic, S7, MQTT). There is no
   * manifest capability flag for this family, so it's checked directly against the connector type string.
   */
  get isIotFamilySouthType(): boolean {
    return IOT_FAMILY_SOUTH_TYPES.includes(this.manifest?.id as (typeof IOT_FAMILY_SOUTH_TYPES)[number]);
  }

  prepareForCreation(
    scanModes: Array<ScanModeDTO>,
    existingGroups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO>,
    manifest: SouthConnectorManifest
  ) {
    this.mode = 'create';
    this.scanModes = scanModes;
    this.manifest = manifest;
    this.existingGroups = existingGroups;
    this.group = null;
    this.buildForm();
  }

  prepareForEdition(
    scanModes: Array<ScanModeDTO>,
    existingGroups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO>,
    manifest: SouthConnectorManifest,
    group: SouthItemGroupDTO | SouthItemGroupCommandDTO
  ) {
    this.mode = 'edit';
    this.scanModes = scanModes;
    this.existingGroups = existingGroups;
    this.manifest = manifest;
    this.group = group;
    this.buildForm();
  }

  private checkUniqueness(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value || !this.existingGroups) {
        return null;
      }
      const isDuplicate = this.existingGroups.some(
        g => g.standardSettings.name.toLowerCase() === control.value.toLowerCase() && g.id !== this.group?.id
      );
      return isDuplicate ? { mustBeUnique: true } : null;
    };
  }

  private buildForm() {
    this.form = this.fb.group({
      name: ['', [Validators.required, this.checkUniqueness()]],
      scanModeId: this.fb.control<string | null>(null, [Validators.required]),
      startTimeOffset: this.fb.control<number | null>(0, [Validators.min(-2147483648), Validators.max(2147483647)]),
      endTimeOffset: this.fb.control<number | null>(0, [Validators.min(-2147483648), Validators.max(2147483647)]),
      maxReadInterval: [3600, [Validators.min(0)]],
      readDelay: [200, [Validators.required, Validators.min(0)]],
      recoveryStrategy: this.fb.control<SouthHistoryRecoveryStrategy>('oldest'),
      cachingStrategy: this.fb.control<SouthCachingStrategy>('allValues')
    });

    if (this.group) {
      this.form.patchValue({
        name: this.group.standardSettings.name,
        scanModeId:
          (this.group as SouthItemGroupCommandDTO).standardSettings.scanModeId ||
          (this.group as SouthItemGroupDTO).standardSettings.scanMode.id,
        startTimeOffset: this.group.historySettings.startTimeOffset ?? 0,
        endTimeOffset: this.group.historySettings.endTimeOffset ?? 0,
        maxReadInterval: this.group.historySettings.maxReadInterval ?? 3600,
        readDelay: this.group.historySettings.readDelay ?? 200,
        recoveryStrategy: this.group.historySettings.recoveryStrategy ?? 'oldest',
        cachingStrategy: this.group.historySettings.cachingStrategy ?? 'allValues'
      });
    }
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
    if (!this.form || !this.form.valid) {
      return;
    }

    const formValue = this.form.getRawValue();
    const command: SouthItemGroupCommandDTO = {
      id: this.group?.id || '',
      standardSettings: {
        name: formValue.name!,
        scanModeId: formValue.scanModeId!
      },
      historySettings: {
        startTimeOffset: formValue.startTimeOffset ?? null,
        endTimeOffset: formValue.endTimeOffset ?? null,
        maxReadInterval: formValue.maxReadInterval! ?? null,
        readDelay: formValue.readDelay! ?? null,
        recoveryStrategy: formValue.recoveryStrategy! ?? null,
        cachingStrategy: formValue.cachingStrategy! ?? null
      }
    };
    this.modal.close({ mode: this.mode, group: command });
  }
}
