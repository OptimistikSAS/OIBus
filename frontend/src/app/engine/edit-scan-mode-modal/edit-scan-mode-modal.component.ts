import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { AsyncValidatorFn, NonNullableFormBuilder, Validators } from '@angular/forms';
import { map, Observable, of, switchMap } from 'rxjs';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { ScanModeService } from '../../services/scan-mode.service';
import { ScanModeCommandDTO, ScanModeDTO, ValidatedCronExpression } from '../../../../../backend/shared/model/scan-mode.model';
import { formDirectives } from '../../shared/form-directives';

import { DatetimePipe } from '../../shared/datetime.pipe';

@Component({
  selector: 'oib-edit-scan-mode-modal',
  templateUrl: './edit-scan-mode-modal.component.html',
  styleUrl: './edit-scan-mode-modal.component.scss',
  imports: [...formDirectives, TranslateModule, SaveButtonComponent, DatetimePipe],
  standalone: true
})
export class EditScanModeModalComponent {
  private modal = inject(NgbActiveModal);
  private scanModeService = inject(ScanModeService);
  private fb = inject(NonNullableFormBuilder);

  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();
  scanMode: ScanModeDTO | null = null;

  /**
   * Custom validator for the cron field.
   */
  private cronValidator: AsyncValidatorFn = control => {
    const cron: string = control.value;
    if (!cron) {
      return of(null);
    } else {
      return this.scanModeService.verifyCron(control.value).pipe(
        map(validatedCronExpression => {
          if (validatedCronExpression.isValid) {
            this.cronValidationResponse = validatedCronExpression;
            return null;
          } else {
            this.cronValidationResponse = null;
            return { cronErrorMessage: validatedCronExpression.errorMessage };
          }
        })
      );
    }
  };

  form = inject(NonNullableFormBuilder).group({
    name: ['', Validators.required],
    description: '',
    cron: this.fb.control('', {
      validators: Validators.required,
      asyncValidators: this.cronValidator,
      updateOn: 'change'
    })
  });
  cronValidationResponse: ValidatedCronExpression | null = null;

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
}
