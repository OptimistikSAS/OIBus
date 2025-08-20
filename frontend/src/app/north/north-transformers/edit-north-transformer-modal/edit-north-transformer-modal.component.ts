import { Component, forwardRef, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, of, switchMap } from 'rxjs';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TransformerDTO, TransformerDTOWithOptions } from '../../../../../../backend/shared/model/transformer.model';
import { TransformerService } from '../../../services/transformer.service';
import { addAttributeToForm, addEnablingConditions } from '../../../shared/form/dynamic-form.builder';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { OIBusObjectAttribute } from '../../../../../../backend/shared/model/form.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { CertificateDTO } from '../../../../../../backend/shared/model/certificate.model';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { OIBUS_FORM_MODE } from '../../../shared/form/oibus-form-mode.token';
import { OibusInputDataTypeEnumPipe } from '../../../shared/oibus-input-data-type-enum.pipe';

@Component({
  selector: 'oib-edit-north-transformer-modal',
  templateUrl: './edit-north-transformer-modal.component.html',
  styleUrl: './edit-north-transformer-modal.component.scss',
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    SaveButtonComponent,
    TranslatePipe,
    OIBusObjectFormControlComponent,
    OibusInputDataTypeEnumPipe
  ],
  viewProviders: [
    {
      provide: OIBUS_FORM_MODE,
      useFactory: (component: EditNorthTransformerModalComponent) => () => component.mode,
      deps: [forwardRef(() => EditNorthTransformerModalComponent)]
    }
  ]
})
export class EditNorthTransformerModalComponent {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);
  private transformerService = inject(TransformerService);

  state = new ObservableState();
  mode: 'create' | 'edit' = 'create';
  form: FormGroup<{
    transformerId: FormControl<string | null>;
    options: FormGroup;
  }> | null = null;
  inputTypeControl: FormControl<string | null> | null = null;
  allTransformers: Array<TransformerDTO> = [];
  selectableTransformers: Array<TransformerDTO> = [];
  selectableInputs: Array<string> = [];
  supportedOutputTypes: Array<string> = [];
  manifest: OIBusObjectAttribute | null = null;
  scanModes: Array<ScanModeDTO> = [];
  certificates: Array<CertificateDTO> = [];

  prepareForCreation(
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    selectableInputs: Array<string>,
    transformers: Array<TransformerDTO>,
    supportedOutputTypes: Array<string>
  ) {
    this.mode = 'create';
    this.scanModes = scanModes;
    this.certificates = certificates;
    this.selectableInputs = selectableInputs;
    this.allTransformers = transformers;
    this.supportedOutputTypes = supportedOutputTypes;
    this.inputTypeControl = this.fb.control<string | null>(null as string | null, Validators.required);
    this.inputTypeControl.valueChanges.subscribe(inputType => {
      this.form!.setValue({
        transformerId: null,
        options: {}
      });
      this.selectableTransformers = this.allTransformers.filter(
        element =>
          ((element.type === 'standard' && element.functionName === 'ignore') ||
            (element.type === 'standard' && element.functionName === 'iso' && this.supportedOutputTypes.includes(element.inputType)) ||
            element.inputType === inputType) &&
          this.supportedOutputTypes.includes(element.outputType)
      );
    });
    this.buildForm();
  }

  prepareForEdition(
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    transformerWithOptionsToEdit: TransformerDTOWithOptions,
    transformers: Array<TransformerDTO>,
    supportedOutputTypes: Array<string>
  ) {
    this.mode = 'edit';
    this.scanModes = scanModes;
    this.certificates = certificates;
    this.supportedOutputTypes = supportedOutputTypes;
    this.selectableTransformers = transformers.filter(
      element =>
        (element.inputType === transformerWithOptionsToEdit.inputType ||
          (element.type === 'standard' && ['ignore', 'iso'].includes(element.functionName))) &&
        this.supportedOutputTypes.includes(element.outputType)
    );
    this.buildForm();
    this.createOptionsForm(transformerWithOptionsToEdit.transformer);
    // trigger rebuild of options form
    this.form!.patchValue(
      { transformerId: transformerWithOptionsToEdit.transformer.id, options: transformerWithOptionsToEdit.options },
      { emitEvent: false }
    );
  }

  buildForm() {
    this.form = this.fb.group({
      transformerId: this.fb.control<string | null>(null),
      options: this.fb.group({})
    });
    this.form!.controls.transformerId.valueChanges.pipe(
      switchMap(transformerId => (transformerId ? this.transformerService.findById(transformerId) : of(null)))
    ).subscribe(newTransformer => {
      if (newTransformer) {
        this.createOptionsForm(newTransformer);
      } else {
        this.form!.setControl('options', this.fb.group({}));
      }
    });
  }

  createOptionsForm(newTransformer: TransformerDTO) {
    this.manifest = newTransformer.manifest;
    this.form!.setControl('options', this.fb.group({}));
    for (const attribute of this.manifest.attributes) {
      addAttributeToForm(this.fb, this.form!.controls.options, attribute);
    }
    addEnablingConditions(this.form!.controls.options, this.manifest.enablingConditions);
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
    if (!this.form!.valid) {
      return;
    }

    const transformer = this.selectableTransformers.find(transformer => transformer.id === this.form!.value.transformerId)!;
    const inputType = this.inputTypeControl ? this.inputTypeControl.getRawValue()! : transformer.inputType;

    if (!transformer || !inputType) {
      return;
    }

    this.modal.close({
      transformer,
      options: this.form!.value.options,
      inputType
    });
  }
}
