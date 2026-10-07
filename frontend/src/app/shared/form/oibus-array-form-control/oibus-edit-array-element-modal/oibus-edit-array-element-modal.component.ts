import { ChangeDetectionStrategy, Component, forwardRef, inject, signal } from '@angular/core';
import { AbstractControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { OIBusObjectAttribute } from '@oibus/shared/connector/form.model';

import { addAttributeToForm, extractFormValue } from '../../dynamic-form.builder';
import { OIBUS_FORM_MODE } from '../../oibus-form-mode.token';
import { OIBusObjectFormControlComponent } from '../../oibus-object-form-control/oibus-object-form-control.component';

@Component({
  selector: 'oib-oibus-edit-array-element-modal',
  templateUrl: './oibus-edit-array-element-modal.component.html',
  styleUrl: './oibus-edit-array-element-modal.component.scss',
  // Remove circular dependencies between OIBusObjectFormControlComponent and OIBusEditArrayElementModalComponent with forwardRef
  imports: [ReactiveFormsModule, TranslateDirective, forwardRef(() => OIBusObjectFormControlComponent)],
  changeDetection: ChangeDetectionStrategy.Eager,
  viewProviders: [
    {
      provide: OIBUS_FORM_MODE,
      useFactory: (component: OIBusEditArrayElementModalComponent) => () => component.mode(),
      deps: [forwardRef(() => OIBusEditArrayElementModalComponent)]
    }
  ]
})
export class OIBusEditArrayElementModalComponent {
  private activeModal = inject(NgbActiveModal);

  readonly mode = signal<'create' | 'edit'>('create');
  readonly scanModes = signal<Array<ScanModeDTO>>([]);
  readonly certificates = signal<Array<CertificateDTO>>([]);
  parentGroup: FormGroup<any> | null = null;

  readonly elementManifest = signal<OIBusObjectAttribute | null>(null);

  private readonly fb = inject(NonNullableFormBuilder);

  form = this.fb.group<any>({});

  prepareForCreation(
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    parentGroup: FormGroup,
    elementManifest: OIBusObjectAttribute
  ) {
    this.elementManifest.set(elementManifest);
    this.scanModes.set(scanModes);
    this.certificates.set(certificates);
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
    this.mode.set('create');
    this.elementManifest.set(elementManifest);
    this.scanModes.set(scanModes);
    this.certificates.set(certificates);
    this.parentGroup = parentGroup;
    this.buildForm();
    // we have to wrap the value into the root attribute
    const formValue: any = {};
    formValue[elementManifest.key] = value;
    this.form.patchValue(formValue);
  }

  prepareForEdition(
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    parentGroup: FormGroup<any>,
    value: any,
    elementManifest: OIBusObjectAttribute
  ) {
    this.mode.set('edit');
    this.elementManifest.set(elementManifest);
    this.scanModes.set(scanModes);
    this.certificates.set(certificates);
    this.parentGroup = parentGroup;
    this.buildForm();
    // we have to wrap the value into the root attribute
    const formValue: any = {};
    formValue[elementManifest.key] = value;
    this.form.patchValue(formValue);
  }

  buildForm() {
    addAttributeToForm(this.fb, this.form, this.elementManifest()!);
  }

  asFormGroup(abstractControl: AbstractControl): FormGroup {
    return abstractControl as FormGroup;
  }

  dismiss() {
    this.activeModal.dismiss();
  }

  submit() {
    if (this.form.valid) {
      this.activeModal.close(extractFormValue(this.form.value[this.elementManifest()!.key]));
    }
  }
}
