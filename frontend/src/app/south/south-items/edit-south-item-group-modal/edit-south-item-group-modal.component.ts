import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthItemGroupCommandDTO, SouthItemGroupDTO } from '@oibus/shared/api/south-connector.model';
import { IOT_FAMILY_SOUTH_TYPES, SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';
import { SouthCachingStrategy, SouthHistoryRecoveryStrategy } from '@oibus/shared/domain/south-connector.model';

import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';

@Component({
  selector: 'oib-edit-south-item-group-modal',
  templateUrl: './edit-south-item-group-modal.component.html',
  styleUrl: './edit-south-item-group-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES, SaveButtonComponent]
})
export class EditSouthItemGroupModalComponent {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);

  readonly mode = signal<'create' | 'edit'>('create');
  /**
   * True when opened from south-detail (saves directly to API); false when opened from edit-south (changes are applied in-memory).
   * Set by the opener right after opening the modal, before its first change detection.
   */
  directSave = true;
  readonly state = new ObservableState();
  readonly scanModes = signal<Array<ScanModeDTO>>([]);
  readonly manifest = signal<SouthConnectorManifest | null>(null);
  private group: SouthItemGroupDTO | SouthItemGroupCommandDTO | null = null;
  private existingGroups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO> = [];

  readonly recoveryStrategies: Array<{ value: SouthHistoryRecoveryStrategy; labelKey: string }> = [
    { value: 'oldest', labelKey: 'south.groups.recovery-strategy-oldest' },
    { value: 'newest', labelKey: 'south.groups.recovery-strategy-newest' }
  ];

  readonly cachingStrategies: Array<{ value: SouthCachingStrategy; labelKey: string }> = [
    { value: 'allValues', labelKey: 'south.groups.caching-strategy-all-values' },
    { value: 'onChange', labelKey: 'south.groups.caching-strategy-on-change' },
    { value: 'threshold', labelKey: 'south.groups.caching-strategy-threshold' }
  ];

  readonly form: FormGroup<{
    name: FormControl<string>;
    scanModeId: FormControl<string | null>;
    startTimeOffset: FormControl<number | null>;
    endTimeOffset: FormControl<number | null>;
    maxReadInterval: FormControl<number>;
    readDelay: FormControl<number>;
    recoveryStrategy: FormControl<SouthHistoryRecoveryStrategy>;
    cachingStrategy: FormControl<SouthCachingStrategy>;
  }> = this.fb.group({
    name: ['', [Validators.required, this.checkUniqueness()]],
    scanModeId: this.fb.control<string | null>(null, [Validators.required]),
    startTimeOffset: this.fb.control<number | null>(0, [Validators.min(-2147483648), Validators.max(2147483647)]),
    endTimeOffset: this.fb.control<number | null>(0, [Validators.min(-2147483648), Validators.max(2147483647)]),
    maxReadInterval: [3600, [Validators.min(0)]],
    readDelay: [200, [Validators.required, Validators.min(0)]],
    recoveryStrategy: this.fb.control<SouthHistoryRecoveryStrategy>('oldest'),
    cachingStrategy: this.fb.control<SouthCachingStrategy>('allValues')
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
   * payloads aren't guaranteed numeric). Mirrors the item modal's `isThresholdAvailable` — a group's
   * cachingStrategy is inherited by every synced item, so MQTT groups must not offer it either.
   */
  readonly isThresholdAvailable = computed(() => this.isIotFamilySouthType() && this.manifest()?.id !== 'mqtt');

  prepareForCreation(
    scanModes: Array<ScanModeDTO>,
    existingGroups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO>,
    manifest: SouthConnectorManifest
  ) {
    this.mode.set('create');
    this.scanModes.set(scanModes);
    this.manifest.set(manifest);
    this.existingGroups = existingGroups;
    this.group = null;
    this.initForm(manifest);
  }

  prepareForEdition(
    scanModes: Array<ScanModeDTO>,
    existingGroups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO>,
    manifest: SouthConnectorManifest,
    group: SouthItemGroupDTO | SouthItemGroupCommandDTO
  ) {
    this.mode.set('edit');
    this.scanModes.set(scanModes);
    this.existingGroups = existingGroups;
    this.manifest.set(manifest);
    this.group = group;
    this.initForm(manifest);
  }

  private checkUniqueness(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }
      const isDuplicate = this.existingGroups.some(
        g => g.standardSettings.name.toLowerCase() === control.value.toLowerCase() && g.id !== this.group?.id
      );
      return isDuplicate ? { mustBeUnique: true } : null;
    };
  }

  private initForm(manifest: SouthConnectorManifest) {
    if (manifest.id === 'mqtt') {
      // Defense in depth alongside hiding the 'threshold' option in the template for MQTT groups —
      // matches the item modal's mqttCachingStrategyValidator.
      this.form.controls.cachingStrategy.addValidators(control =>
        control.value === 'threshold' ? { mqttThresholdNotAvailable: true } : null
      );
      this.form.controls.cachingStrategy.updateValueAndValidity();
    }

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
    if (this.form.dirty) {
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
    this.modal.close({ mode: this.mode(), group: command });
  }
}
