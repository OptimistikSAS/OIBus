import { Component, inject } from '@angular/core';
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
  SouthConnectorManifest,
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
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES, SaveButtonComponent]
})
export class EditSouthItemGroupModalComponent {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);

  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();
  scanModes: Array<ScanModeDTO> = [];
  manifest!: SouthConnectorManifest;
  group: SouthItemGroupDTO | SouthItemGroupCommandDTO | null = null;
  existingGroups: Array<SouthItemGroupDTO | SouthItemGroupCommandDTO> = [];

  form: FormGroup<{
    name: FormControl<string>;
    scanModeId: FormControl<string | null>;
    overlap: FormControl<number>;
    maxReadInterval: FormControl<number>;
    readDelay: FormControl<number>;
  }> | null = null;

  get hasHistorianCapabilities(): boolean {
    return this.manifest?.modes?.history;
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
      overlap: [0, [Validators.min(0)]],
      maxReadInterval: [3600, [Validators.min(0)]],
      readDelay: [200, [Validators.required, Validators.min(0)]]
    });

    if (this.group) {
      this.form.patchValue({
        name: this.group.standardSettings.name,
        scanModeId:
          (this.group as SouthItemGroupCommandDTO).standardSettings.scanModeId ||
          (this.group as SouthItemGroupDTO).standardSettings.scanMode.id,
        overlap: this.group.historySettings.overlap!,
        maxReadInterval: this.group.historySettings.maxReadInterval!,
        readDelay: this.group.historySettings.readDelay!
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
        overlap: formValue.overlap! ?? null,
        maxReadInterval: formValue.maxReadInterval! ?? null,
        readDelay: formValue.readDelay! ?? null
      }
    };
    this.modal.close({ mode: this.mode, group: command });
  }
}
