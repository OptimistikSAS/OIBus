import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProxyService } from '../../services/proxy.service';
import { ProxyCommandDTO, ProxyDTO } from '../../model/proxy.model';
import { Observable, switchMap } from 'rxjs';
import { ObservableState, SaveButtonComponent } from '../../components/shared/save-button/save-button.component';
import { ValidationErrorsComponent } from 'ngx-valdemort';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'oib-edit-proxy-modal',
  templateUrl: './edit-proxy-modal.component.html',
  styleUrls: ['./edit-proxy-modal.component.scss'],
  imports: [ReactiveFormsModule, TranslateModule, ValidationErrorsComponent, SaveButtonComponent],
  standalone: true
})
export class EditProxyModalComponent {
  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();
  proxy: ProxyDTO | null = null;
  form = this.fb.group({
    name: ['', Validators.required],
    description: '',
    address: ['', [Validators.required, Validators.pattern(/http.*/)]],
    username: '',
    password: ''
  });

  constructor(private modal: NgbActiveModal, private fb: FormBuilder, private proxyService: ProxyService) {}

  /**
   * Prepares the component for creation.
   */
  prepareForCreation() {
    this.mode = 'create';
  }

  /**
   * Prepares the component for edition.
   */
  prepareForEdition(proxy: ProxyDTO) {
    this.mode = 'edit';
    this.proxy = proxy;

    this.form.patchValue({
      name: proxy.name,
      description: proxy.description,
      address: proxy.address,
      username: proxy.username,
      password: proxy.password
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

    const command: ProxyCommandDTO = {
      name: formValue.name!,
      description: formValue.description!,
      address: formValue.address!,
      username: formValue.username!,
      password: formValue.password!
    };

    let obs: Observable<ProxyDTO>;
    if (this.mode === 'create') {
      obs = this.proxyService.createProxy(command);
    } else {
      obs = this.proxyService.updateProxy(this.proxy!.id, command).pipe(switchMap(() => this.proxyService.getProxy(this.proxy!.id)));
    }
    obs.pipe(this.state.pendingUntilFinalization()).subscribe(proxy => {
      this.modal.close(proxy);
    });
  }
}
