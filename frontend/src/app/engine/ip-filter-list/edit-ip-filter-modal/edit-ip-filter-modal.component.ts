import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, switchMap } from 'rxjs';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateDirective } from '@ngx-translate/core';
import { IPFilterCommandDTO, IPFilterDTO } from '../../../../../../backend/shared/model/ip-filter.model';
import { IpFilterService } from '../../../services/ip-filter.service';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';

@Component({
  selector: 'oib-edit-ip-filter-modal',
  templateUrl: './edit-ip-filter-modal.component.html',
  styleUrl: './edit-ip-filter-modal.component.scss',
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES, SaveButtonComponent]
})
export class EditIpFilterModalComponent {
  private modal = inject(NgbActiveModal);
  private ipFilterService = inject(IpFilterService);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);

  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();
  ipFilter: IPFilterDTO | null = null;
  form = inject(NonNullableFormBuilder).group({
    address: ['', Validators.required],
    description: ''
  });

  /**
   * Prepares the component for creation.
   */
  prepareForCreation() {
    this.mode = 'create';
  }

  /**
   * Prepares the component for edition.
   */
  prepareForEdition(ipFilter: IPFilterDTO) {
    this.mode = 'edit';
    this.ipFilter = ipFilter;

    this.form.patchValue({
      address: ipFilter.address,
      description: ipFilter.description
    });
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
    if (!this.form.valid) {
      return;
    }

    const formValue = this.form.value;

    const command: IPFilterCommandDTO = {
      address: formValue.address!,
      description: formValue.description!
    };

    let obs: Observable<IPFilterDTO>;
    if (this.mode === 'create') {
      obs = this.ipFilterService.create(command);
    } else {
      obs = this.ipFilterService.update(this.ipFilter!.id, command).pipe(switchMap(() => this.ipFilterService.get(this.ipFilter!.id)));
    }
    obs.pipe(this.state.pendingUntilFinalization()).subscribe(ipFilter => {
      this.modal.close(ipFilter);
    });
  }
}
