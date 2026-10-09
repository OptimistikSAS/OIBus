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
import type { ArrayElement } from '../oibus-array-form-control.component';

@Component({
  selector: 'oib-oibus-edit-array-element-modal',
  templateUrl: './oibus-edit-array-element-modal.component.html',
  styleUrl: './oibus-edit-array-element-modal.component.scss',
  // Remove circular dependencies between OIBusObjectFormControlComponent and OIBusEditArrayElementModalComponent with forwardRef
  imports: [ReactiveFormsModule, TranslateDirective, forwardRef(() => OIBusObjectFormControlComponent)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    {
      provide: OIBUS_FORM_MODE,
      useFactory: (component: OIBusEditArrayElementModalComponent) => () => component.mode(),
      deps: [forwardRef(() => OIBusEditArrayElementModalComponent)]
    }
  ]
})
export class OIBusEditArrayElementModalComponent {
  private readonly activeModal = inject(NgbActiveModal);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly mode = signal<'create' | 'edit'>('create');
  readonly scanModes = signal<Array<ScanModeDTO>>([]);
  readonly certificates = signal<Array<CertificateDTO>>([]);
  parentGroup: FormGroup | null = null;

  readonly elementManifest = signal<OIBusObjectAttribute | null>(null);

  readonly form = this.fb.group<Record<string, AbstractControl>>({});

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
    parentGroup: FormGroup,
    value: ArrayElement,
    elementManifest: OIBusObjectAttribute
  ) {
    this.mode.set('create');
    this.elementManifest.set(elementManifest);
    this.scanModes.set(scanModes);
    this.certificates.set(certificates);
    this.parentGroup = parentGroup;
    this.buildForm();
    // we have to wrap the value into the root attribute
    this.form.patchValue({ [elementManifest.key]: value });
  }

  prepareForEdition(
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    parentGroup: FormGroup,
    value: ArrayElement,
    elementManifest: OIBusObjectAttribute
  ) {
    this.mode.set('edit');
    this.elementManifest.set(elementManifest);
    this.scanModes.set(scanModes);
    this.certificates.set(certificates);
    this.parentGroup = parentGroup;
    this.buildForm();
    // we have to wrap the value into the root attribute
    this.form.patchValue({ [elementManifest.key]: value });
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
