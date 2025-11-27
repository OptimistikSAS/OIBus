import { Component, forwardRef, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { AbstractControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslateDirective } from '@ngx-translate/core';
import { OIBusObjectFormControlComponent } from '../../oibus-object-form-control/oibus-object-form-control.component';
import { OIBusObjectAttribute } from '../../../../../../../backend/shared/model/form.model';
import { ScanModeDTO } from '../../../../../../../backend/shared/model/scan-mode.model';
import { CertificateDTO } from '../../../../../../../backend/shared/model/certificate.model';
import { addAttributeToForm } from '../../dynamic-form.builder';
import { OIBUS_FORM_MODE } from '../../oibus-form-mode.token';

@Component({
  selector: 'oib-oibus-edit-array-element-modal',
  templateUrl: './oibus-edit-array-element-modal.component.html',
  styleUrl: './oibus-edit-array-element-modal.component.scss',
  // Remove circular dependencies between OIBusObjectFormControlComponent and OIBusEditArrayElementModalComponent with forwardRef
  imports: [ReactiveFormsModule, TranslateDirective, forwardRef(() => OIBusObjectFormControlComponent)],
  viewProviders: [
    {
      provide: OIBUS_FORM_MODE,
      useFactory: (component: OIBusEditArrayElementModalComponent) => () => component.mode,
      deps: [forwardRef(() => OIBusEditArrayElementModalComponent)]
    }
  ]
})
export class OIBusEditArrayElementModalComponent {
  private activeModal = inject(NgbActiveModal);

  mode: 'create' | 'edit' = 'create';
  scanModes: Array<ScanModeDTO> = [];
  certificates: Array<CertificateDTO> = [];
  parentGroup: FormGroup<any> | null = null;

  elementManifest: OIBusObjectAttribute | null = null;

  private readonly fb = inject(NonNullableFormBuilder);

  form = this.fb.group<any>({});

  prepareForCreation(
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    parentGroup: FormGroup,
    elementManifest: OIBusObjectAttribute
  ) {
    this.elementManifest = elementManifest;
    this.scanModes = scanModes;
    this.certificates = certificates;
    this.parentGroup = parentGroup;
    this.buildForm();
  }

  prepareForCopy(
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    parentGroup: FormGroup<any>,
    value: any,
    elementManifest: OIBusObjectAttribute
  ) {
    this.mode = 'create';
    this.elementManifest = elementManifest;
    this.scanModes = scanModes;
    this.certificates = certificates;
    this.parentGroup = parentGroup;
    this.buildForm();
    // we have to wrap the value into the root attribute
    const formValue: any = {};
    formValue[this.elementManifest.key] = value;
    this.form.patchValue(formValue);
  }

  prepareForEdition(
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    parentGroup: FormGroup<any>,
    value: any,
    elementManifest: OIBusObjectAttribute
  ) {
    this.mode = 'edit';
    this.elementManifest = elementManifest;
    this.scanModes = scanModes;
    this.certificates = certificates;
    this.parentGroup = parentGroup;
    this.buildForm();
    // we have to wrap the value into the root attribute
    const formValue: any = {};
    formValue[this.elementManifest.key] = value;
    this.form.patchValue(formValue);
  }

  buildForm() {
    addAttributeToForm(this.fb, this.form, this.elementManifest!);
  }

  asFormGroup(abstractControl: AbstractControl): FormGroup {
    return abstractControl as FormGroup;
  }

  dismiss() {
    this.activeModal.dismiss();
  }

  submit() {
    if (this.form.valid) {
      this.activeModal.close(this.form.value[this.elementManifest!.key]);
    }
  }
}
