import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { of, switchMap } from 'rxjs';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TransformerDTO, TransformerDTOWithOptions } from '../../../../../../backend/shared/model/transformer.model';
import { TransformerService } from '../../../services/transformer.service';
import { addAttributeToForm, addEnablingConditions } from '../../../shared/form/dynamic-form.builder';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { OIBusObjectAttribute } from '../../../../../../backend/shared/model/form.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { CertificateDTO } from '../../../../../../backend/shared/model/certificate.model';
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
  ]
})
export class EditNorthTransformerModalComponent {
  private modal = inject(NgbActiveModal);
  private fb = inject(NonNullableFormBuilder);
  private transformerService = inject(TransformerService);

  state = new ObservableState();
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
    transformerWithOptions: TransformerDTOWithOptions,
    transformers: Array<TransformerDTO>,
    supportedOutputTypes: Array<string>
  ) {
    this.scanModes = scanModes;
    this.certificates = certificates;
    this.supportedOutputTypes = supportedOutputTypes;
    this.selectableTransformers = transformers.filter(
      element =>
        (element.inputType === transformerWithOptions.inputType ||
          (element.type === 'standard' && ['ignore', 'iso'].includes(element.functionName))) &&
        this.supportedOutputTypes.includes(element.outputType)
    );
    this.buildForm();
    this.createOptionsForm(transformerWithOptions.transformer);
    // trigger rebuild of options form
    this.form!.setValue(
      { transformerId: transformerWithOptions.transformer.id, options: transformerWithOptions.options },
      { emitEvent: false }
    );
  }

  buildForm() {
    this.form = this.fb.group({
      transformerId: this.fb.control<string | null>(null),
      options: this.fb.group({})
    });
    this.form!.controls.transformerId.valueChanges.pipe(
      switchMap(transformerId => (transformerId ? this.transformerService.get(transformerId) : of(null)))
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
