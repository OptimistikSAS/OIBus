import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, Validators } from '@angular/forms';
import { Observable, switchMap } from 'rxjs';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { ExternalSourceCommandDTO, ExternalSourceDTO } from '../../../../../shared/model/external-sources.model';
import { ExternalSourceService } from '../../services/external-source.service';
import { formDirectives } from '../../shared/form-directives';

@Component({
  selector: 'oib-edit-external-source-modal',
  templateUrl: './edit-external-source-modal.component.html',
  styleUrls: ['./edit-external-source-modal.component.scss'],
  imports: [...formDirectives, TranslateModule, SaveButtonComponent],
  standalone: true
})
export class EditExternalSourceModalComponent {
  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();
  externalSource: ExternalSourceDTO | null = null;
  form = this.fb.group({
    reference: ['', Validators.required],
    description: ''
  });

  constructor(private modal: NgbActiveModal, private fb: FormBuilder, private externalSourceService: ExternalSourceService) {}

  /**
   * Prepares the component for creation.
   */
  prepareForCreation() {
    this.mode = 'create';
  }

  /**
   * Prepares the component for edition.
   */
  prepareForEdition(externalSource: ExternalSourceDTO) {
    this.mode = 'edit';
    this.externalSource = externalSource;

    this.form.patchValue({
      reference: externalSource.reference,
      description: externalSource.description
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

    const command: ExternalSourceCommandDTO = {
      reference: formValue.reference!,
      description: formValue.description!
    };

    let obs: Observable<ExternalSourceDTO>;
    if (this.mode === 'create') {
      obs = this.externalSourceService.createExternalSource(command);
    } else {
      obs = this.externalSourceService
        .updateExternalSource(this.externalSource!.id, command)
        .pipe(switchMap(() => this.externalSourceService.getExternalSource(this.externalSource!.id)));
    }
    obs.pipe(this.state.pendingUntilFinalization()).subscribe(externalSource => {
      this.modal.close(externalSource);
    });
  }
}
