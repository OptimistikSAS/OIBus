import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, switchMap } from 'rxjs';
import { ObservableState, SaveButtonComponent } from '../../components/shared/save-button/save-button.component';
import { ValidationErrorsComponent } from 'ngx-valdemort';
import { TranslateModule } from '@ngx-translate/core';
import { IpFilterCommandDTO, IpFilterDTO } from '../../model/ip-filter.model';
import { IpFilterService } from '../../services/ip-filter.service';

@Component({
  selector: 'oib-edit-ip-filter-modal',
  templateUrl: './edit-ip-filter-modal.component.html',
  styleUrls: ['./edit-ip-filter-modal.component.scss'],
  imports: [ReactiveFormsModule, TranslateModule, ValidationErrorsComponent, SaveButtonComponent],
  standalone: true
})
export class EditIpFilterModalComponent {
  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();
  ipFilter: IpFilterDTO | null = null;
  form = this.fb.group({
    address: ['', Validators.required],
    description: ''
  });

  constructor(private modal: NgbActiveModal, private fb: FormBuilder, private ipFilterService: IpFilterService) {}

  /**
   * Prepares the component for creation.
   */
  prepareForCreation() {
    this.mode = 'create';
  }

  /**
   * Prepares the component for edition.
   */
  prepareForEdition(ipFilter: IpFilterDTO) {
    this.mode = 'edit';
    this.ipFilter = ipFilter;

    this.form.patchValue({
      address: ipFilter.address,
      description: ipFilter.description
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

    const command: IpFilterCommandDTO = {
      address: formValue.address!,
      description: formValue.description!
    };

    let obs: Observable<IpFilterDTO>;
    if (this.mode === 'create') {
      obs = this.ipFilterService.createIpFilter(command);
    } else {
      obs = this.ipFilterService
        .updateIpFilter(this.ipFilter!.id, command)
        .pipe(switchMap(() => this.ipFilterService.getIpFilter(this.ipFilter!.id)));
    }
    obs.pipe(this.state.pendingUntilFinalization()).subscribe(ipFilter => {
      this.modal.close(ipFilter);
    });
  }
}
