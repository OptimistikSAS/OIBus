import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';
import { Observable, switchMap } from 'rxjs';

import { IPFilterCommandDTO, IPFilterDTO } from '@oibus/shared/api/ip-filter.model';

import { IpFilterService } from '../../../services/ip-filter.service';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';

@Component({
  selector: 'oib-edit-ip-filter-modal',
  templateUrl: './edit-ip-filter-modal.component.html',
  styleUrl: './edit-ip-filter-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateDirective, OI_FORM_VALIDATION_DIRECTIVES, SaveButtonComponent]
})
export class EditIpFilterModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly ipFilterService = inject(IpFilterService);
  private readonly unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly mode = signal<'create' | 'edit'>('create');
  readonly state = new ObservableState();
  private ipFilter: IPFilterDTO | null = null;
  readonly form = this.fb.group({
    address: ['', Validators.required],
    description: ''
  });

  /**
   * Prepares the component for creation.
   */
  prepareForCreation() {
    this.mode.set('create');
  }

  /**
   * Prepares the component for edition.
   */
  prepareForEdition(ipFilter: IPFilterDTO) {
    this.mode.set('edit');
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
    if (this.mode() === 'create') {
      obs = this.ipFilterService.create(command);
    } else {
      obs = this.ipFilterService.update(this.ipFilter!.id, command).pipe(switchMap(() => this.ipFilterService.findById(this.ipFilter!.id)));
    }
    obs.pipe(this.state.pendingUntilFinalization()).subscribe(ipFilter => {
      this.modal.close(ipFilter);
    });
  }
}
