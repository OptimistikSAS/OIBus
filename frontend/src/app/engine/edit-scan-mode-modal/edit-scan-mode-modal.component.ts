import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, Validators } from '@angular/forms';
import { Observable, switchMap } from 'rxjs';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { ScanModeService } from '../../services/scan-mode.service';
import { ScanModeCommandDTO, ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { formDirectives } from '../../shared/form-directives';

@Component({
  selector: 'oib-edit-scan-mode-modal',
  templateUrl: './edit-scan-mode-modal.component.html',
  styleUrl: './edit-scan-mode-modal.component.scss',
  imports: [...formDirectives, TranslateModule, SaveButtonComponent],
  standalone: true
})
export class EditScanModeModalComponent {
  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();
  scanMode: ScanModeDTO | null = null;
  form = this.fb.group({
    name: ['', Validators.required],
    description: '',
    cron: ['', Validators.required]
  });

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
}
