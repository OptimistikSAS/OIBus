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
import { SouthConnectorService } from '../../../services/south-connector.service';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { Observable, switchMap } from 'rxjs';
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
  private southConnectorService = inject(SouthConnectorService);

  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();
  scanModes: Array<ScanModeDTO> = [];
  southId!: string;
  manifest!: SouthConnectorManifest;
  group: SouthItemGroupDTO | null = null;
  existingGroups: Array<SouthItemGroupDTO> = [];

  form: FormGroup<{
    name: FormControl<string>;
    scanMode: FormControl<string | null>;
    shareTrackedInstant: FormControl<boolean>;
    overlap: FormControl<number | null>;
  }> | null = null;

  get hasHistorianCapabilities(): boolean {
    return this.manifest?.modes?.history === true;
  }

  prepareForCreation(
    southId: string,
    scanModes: Array<ScanModeDTO>,
    manifest: SouthConnectorManifest,
    existingGroups: Array<SouthItemGroupDTO>
  ) {
    this.mode = 'create';
    this.southId = southId;
    this.scanModes = scanModes;
    this.manifest = manifest;
    this.existingGroups = existingGroups;
    this.group = null;
    this.buildForm();
  }

  prepareForEdition(
    southId: string,
    scanModes: Array<ScanModeDTO>,
    manifest: SouthConnectorManifest,
    group: SouthItemGroupDTO,
    existingGroups: Array<SouthItemGroupDTO>
  ) {
    this.mode = 'edit';
    this.southId = southId;
    this.scanModes = scanModes;
    this.manifest = manifest;
    this.group = group;
    this.existingGroups = existingGroups;
    this.buildForm();
  }

  private checkUniqueness(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value || !this.existingGroups) {
        return null;
      }
      const isDuplicate = this.existingGroups.some(g => g.name.toLowerCase() === control.value.toLowerCase() && g.id !== this.group?.id);
      return isDuplicate ? { mustBeUnique: true } : null;
    };
  }

  private buildForm() {
    this.form = this.fb.group({
      name: ['', [Validators.required, this.checkUniqueness()]],
      scanMode: this.fb.control<string | null>(null, [Validators.required]),
      shareTrackedInstant: [false],
      overlap: [null as number | null, [Validators.min(0)]]
    });

    if (this.group) {
      this.form.patchValue({
        name: this.group.name,
        scanMode: this.group.scanMode.id,
        shareTrackedInstant: this.group.shareTrackedInstant,
        overlap: this.group.overlap
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
    if (!this.form) {
      return;
    }

    if (!this.form.valid) {
      // Mark all fields as touched to show validation errors
      const form = this.form;
      Object.keys(form.controls).forEach(key => {
        form.get(key)?.markAsTouched();
      });
      return;
    }

    const formValue = this.form.getRawValue();
    if (!formValue.scanMode) {
      this.form!.controls.scanMode.markAsTouched();
      return;
    }

    const command: SouthItemGroupCommandDTO = {
      name: formValue.name!,
      scanModeId: formValue.scanMode,
      shareTrackedInstant: formValue.shareTrackedInstant ?? false,
      overlap: formValue.overlap ?? null
    };

    let obs: Observable<SouthItemGroupDTO>;
    if (this.mode === 'create') {
      obs = this.southConnectorService.createGroup(this.southId, command);
    } else {
      obs = this.southConnectorService
        .updateGroup(this.southId, this.group!.id, command)
        .pipe(switchMap(() => this.southConnectorService.getGroup(this.southId, this.group!.id)));
    }
    obs.pipe(this.state.pendingUntilFinalization()).subscribe({
      next: group => {
        this.modal.close(group);
      },
      error: () => {
        // Error handling is done by the state observable
      }
    });
  }
}
