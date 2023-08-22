import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, Validators } from '@angular/forms';
import { Observable, switchMap } from 'rxjs';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import { CertificateCommandDTO, CertificateDTO } from '../../../../../shared/model/certificate.model';
import { CertificateService } from '../../services/certificate.service';
import { NgIf } from '@angular/common';

@Component({
  selector: 'oib-edit-certificate-modal',
  templateUrl: './edit-certificate-modal.component.html',
  styleUrls: ['./edit-certificate-modal.component.scss'],
  imports: [...formDirectives, TranslateModule, SaveButtonComponent, NgIf],
  standalone: true
})
export class EditCertificateModalComponent {
  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();
  certificate: CertificateDTO | null = null;
  form = this.fb.group({
    name: ['', Validators.required],
    description: '',
    regenerateCertificate: true,
    certificateOptions: this.fb.group({
      commonName: ['', Validators.required],
      countryName: ['', Validators.required],
      stateOrProvinceName: ['', Validators.required],
      localityName: ['', Validators.required],
      organizationName: ['', Validators.required],
      keySize: [4096, Validators.required],
      daysBeforeExpiry: [3650, Validators.required]
    })
  });

  constructor(
    private modal: NgbActiveModal,
    private fb: FormBuilder,
    private certificateService: CertificateService
  ) {
    this.form.controls.regenerateCertificate.valueChanges.subscribe(next => {
      if (next) {
        this.form.controls.certificateOptions.enable();
      } else {
        this.form.controls.certificateOptions.disable();
      }
    });
  }

  prepareForCreation() {
    this.mode = 'create';
  }

  prepareForEdition(certificate: CertificateDTO) {
    this.mode = 'edit';
    this.certificate = certificate;

    this.form.patchValue({
      name: certificate.name,
      description: certificate.description,
      regenerateCertificate: false
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

    const command: CertificateCommandDTO = {
      name: formValue.name!,
      description: formValue.description!,
      regenerateCertificate: formValue.regenerateCertificate!,
      options:
        formValue.certificateOptions == null
          ? null
          : {
              commonName: formValue.certificateOptions.commonName!,
              countryName: formValue.certificateOptions.countryName!,
              stateOrProvinceName: formValue.certificateOptions.stateOrProvinceName!,
              localityName: formValue.certificateOptions.localityName!,
              organizationName: formValue.certificateOptions.organizationName!,
              keySize: formValue.certificateOptions.keySize!,
              daysBeforeExpiry: formValue.certificateOptions.daysBeforeExpiry!
            }
    };

    let obs: Observable<CertificateDTO>;
    if (this.mode === 'create') {
      obs = this.certificateService.create(command);
    } else {
      obs = this.certificateService
        .update(this.certificate!.id, command)
        .pipe(switchMap(() => this.certificateService.findById(this.certificate!.id)));
    }
    obs.pipe(this.state.pendingUntilFinalization()).subscribe(certificate => {
      this.modal.close(certificate);
    });
  }
}
