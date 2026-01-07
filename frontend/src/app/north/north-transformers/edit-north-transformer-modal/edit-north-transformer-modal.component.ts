import { Component, forwardRef, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import {
  INPUT_TYPES,
  InputType,
  TransformerDTO,
  TransformerDTOWithOptions
} from '../../../../../../backend/shared/model/transformer.model';
import { addAttributeToForm, addEnablingConditions } from '../../../shared/form/dynamic-form.builder';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { OIBusObjectAttribute } from '../../../../../../backend/shared/model/form.model';
import { ScanModeDTO } from '../../../../../../backend/shared/model/scan-mode.model';
import { CertificateDTO } from '../../../../../../backend/shared/model/certificate.model';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { OIBUS_FORM_MODE } from '../../../shared/form/oibus-form-mode.token';
import { SouthConnectorLightDTO } from '../../../../../../backend/shared/model/south-connector.model';
import { OIBusSouthTypeEnumPipe } from '../../../shared/oibus-south-type-enum.pipe';
import { getAssociatedInputType } from '../../../shared/utils/utils';

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
    OIBusSouthTypeEnumPipe
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

  state = new ObservableState();
  mode: 'create' | 'edit' = 'create';
  form: FormGroup<{
    source: FormControl<{ inputType: InputType | null; south: SouthConnectorLightDTO | null }>;
    transformer: FormControl<TransformerDTO | null>;
    options: FormGroup;
  }> = this.fb.group({
    source: this.fb.control<{
      inputType: InputType | null;
      south: SouthConnectorLightDTO | null;
    }>({ inputType: null, south: null }, Validators.required),
    transformer: this.fb.control<TransformerDTO | null>(null, Validators.required),
    options: this.fb.group({})
  });
  allTransformers: Array<TransformerDTO> = [];
  selectableOutputs: Array<TransformerDTO> = [];
  selectedInputs: Array<{ inputType: InputType | null; south: string | null }> = [];
  supportedOutputTypes: Array<string> = [];
  manifest: OIBusObjectAttribute | null = null;
  scanModes: Array<ScanModeDTO> = [];
  certificates: Array<CertificateDTO> = [];
  southConnectors: Array<SouthConnectorLightDTO> = [];
  existingTransformerWithOptions: TransformerDTOWithOptions | null = null;
  inputTypes = INPUT_TYPES;

  prepareForCreation(
    southConnectors: Array<SouthConnectorLightDTO>,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    selectedInputs: Array<{ inputType: InputType; south: string | null }>,
    transformers: Array<TransformerDTO>,
    supportedOutputTypes: Array<string>
  ) {
    this.mode = 'create';
    this.southConnectors = southConnectors;
    this.scanModes = scanModes;
    this.certificates = certificates;
    this.selectedInputs = selectedInputs;
    this.allTransformers = transformers;
    this.supportedOutputTypes = supportedOutputTypes;
    this.buildForm();
  }

  prepareForEdition(
    southConnectors: Array<SouthConnectorLightDTO>,
    scanModes: Array<ScanModeDTO>,
    certificates: Array<CertificateDTO>,
    transformerWithOptionsToEdit: TransformerDTOWithOptions,
    transformers: Array<TransformerDTO>,
    supportedOutputTypes: Array<string>
  ) {
    this.mode = 'edit';
    this.southConnectors = southConnectors;
    this.scanModes = scanModes;
    this.certificates = certificates;
    this.existingTransformerWithOptions = transformerWithOptionsToEdit;
    this.allTransformers = transformers;
    this.supportedOutputTypes = supportedOutputTypes;

    const sourceValue = {
      inputType: transformerWithOptionsToEdit.inputType,
      south: transformerWithOptionsToEdit.south || null
    };
    this.buildForm();
    this.updateSelectableOutput(sourceValue);
    this.createOptionsForm(transformerWithOptionsToEdit.transformer);

    // trigger rebuild of options form
    this.form.patchValue(
      {
        source: sourceValue,
        transformer: transformerWithOptionsToEdit.transformer,
        options: transformerWithOptionsToEdit.options
      },
      { emitEvent: false }
    );
    this.form.controls.source.disable({ emitEvent: false });
  }

  buildForm() {
    this.form.controls.source.valueChanges.subscribe(source => {
      this.form.patchValue({
        transformer: null,
        options: {}
      });
      this.updateSelectableOutput(source);
    });

    this.form.controls.transformer.valueChanges.subscribe(newTransformer => {
      if (newTransformer) {
        this.createOptionsForm(newTransformer);
      } else {
        this.form.setControl('options', this.fb.group({}));
      }
    });
  }

  createOptionsForm(newTransformer: TransformerDTO) {
    this.manifest = newTransformer.manifest;
    this.form.setControl('options', this.fb.group({}));
    for (const attribute of this.manifest.attributes) {
      addAttributeToForm(this.fb, this.form.controls.options, attribute);
    }
    addEnablingConditions(this.form.controls.options, this.manifest.enablingConditions);
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

    let south: string | null = null;
    if (this.existingTransformerWithOptions) {
      south = this.existingTransformerWithOptions.south?.id || null;
    } else {
      south = this.form.value.source?.south?.id || null;
    }
    this.modal.close({
      id: this.existingTransformerWithOptions ? this.existingTransformerWithOptions.id : '',
      transformer: this.form.value.transformer,
      options: this.form.value.options,
      south: south,
      inputType: this.existingTransformerWithOptions ? this.existingTransformerWithOptions.inputType : this.form.value.source!.inputType,
      items: [] // TODO
    });
  }

  southIsSelected(southId: string) {
    return this.selectedInputs.map(input => input.south).includes(southId);
  }

  inputTypeIsSelected(inputType: string) {
    return this.selectedInputs.map(input => input.inputType).includes(inputType);
  }

  compareSource(o1: any, o2: any): boolean {
    if (!o1 || !o2) return o1 === o2;
    // Compare Input Types
    if (o1.inputType !== o2.inputType) return false;
    // Compare South Connectors (handle objects or nulls)
    const southId1 = o1.south?.id || o1.south; // handle if south is just ID or full object
    const southId2 = o2.south?.id || o2.south;
    return southId1 === southId2;
  }

  compareTransformers(t1: TransformerDTO | null, t2: TransformerDTO | null): boolean {
    return t1 && t2 ? t1.id === t2.id : t1 === t2;
  }

  private updateSelectableOutput(source: { inputType: InputType | null; south: SouthConnectorLightDTO | null }) {
    this.selectableOutputs = this.allTransformers.filter(element => {
      if (!this.supportedOutputTypes.includes(element.outputType)) {
        return false;
      }

      if (element.type === 'standard' && element.functionName === 'ignore') return true;
      if (element.type === 'standard' && element.functionName === 'iso' && this.supportedOutputTypes.includes(element.inputType))
        return true;

      if (source.inputType) {
        return element.inputType === source.inputType;
      } else if (source.south) {
        return element.inputType === getAssociatedInputType(source.south.type);
      }

      return true;
    });
  }
}
