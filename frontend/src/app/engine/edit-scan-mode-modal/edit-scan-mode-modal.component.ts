import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { Observable, firstValueFrom, switchMap } from 'rxjs';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { ScanModeService } from '../../services/scan-mode.service';
import { ScanModeCommandDTO, ScanModeDTO, ValidatedCronExpression } from '../../../../../shared/model/scan-mode.model';
import { formDirectives } from '../../shared/form-directives';
import { NgFor, NgIf } from '@angular/common';
import { DatetimePipe } from '../../shared/datetime.pipe';

@Component({
  selector: 'oib-edit-scan-mode-modal',
  templateUrl: './edit-scan-mode-modal.component.html',
  styleUrl: './edit-scan-mode-modal.component.scss',
  imports: [...formDirectives, TranslateModule, SaveButtonComponent, NgIf, NgFor, DatetimePipe],
  standalone: true
})
export class EditScanModeModalComponent {
  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();
  scanMode: ScanModeDTO | null = null;
  form = this.fb.group({
    name: ['', Validators.required],
    description: '',
    cron: ['', Validators.required, this.cronValidator()]
  });
  cronValidationResponse: ValidatedCronExpression | undefined;

  constructor(
    private modal: NgbActiveModal,
    private fb: FormBuilder,
    private scanModeService: ScanModeService
  ) {}

  /**
   * Prepares the component for creation.
   */
  prepareForCreation() {
    this.mode = 'create';
  }

  /**
   * Prepares the component for edition.
   */
  prepareForEdition(scanMode: ScanModeDTO) {
    this.mode = 'edit';
    this.scanMode = scanMode;

    this.form.patchValue({
      name: scanMode.name,
      description: scanMode.description,
      cron: scanMode.cron
    });
  }

  cancel() {
    this.modal.dismiss();
  }

  save() {
    if (!this.form.valid) {
      return;
    }

    const formValue = this.form.value;

    const command: ScanModeCommandDTO = {
      name: formValue.name!,
      description: formValue.description!,
      cron: formValue.cron!
    };

    let obs: Observable<ScanModeDTO>;
    if (this.mode === 'create') {
      obs = this.scanModeService.create(command);
    } else {
      obs = this.scanModeService.update(this.scanMode!.id, command).pipe(switchMap(() => this.scanModeService.get(this.scanMode!.id)));
    }
    obs.pipe(this.state.pendingUntilFinalization()).subscribe(scanMode => {
      this.modal.close(scanMode);
    });
  }

  /**
   * Returns the human-readable version of the cron expression.
   */
  get humanReadableCron() {
    return this.cronValidationResponse?.humanReadableForm ?? '';
  }

  /**
   * Returns the next 3 cron executions.
   */
  get nextCronExecutions() {
    return this.cronValidationResponse?.nextExecutions ?? [];
  }

  /**
   * Custom validator for the cron field.
   */
  cronValidator() {
    return async (control: AbstractControl): Promise<ValidationErrors | null> => {
      try {
        const response = await firstValueFrom(this.scanModeService.verifyCron(control.value));
        this.cronValidationResponse = response;
        return null;
      } catch (error: any) {
        this.cronValidationResponse = undefined;
        return { cronErrorMessage: error.error.message };
      }
    };
  }
}
