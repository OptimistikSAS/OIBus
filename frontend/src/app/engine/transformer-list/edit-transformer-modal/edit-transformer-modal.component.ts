import { Component, computed, inject, ViewChild, OnInit } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';

import { OibCodeBlockComponent } from '../../../shared/form/oib-code-block/oib-code-block.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import {
  CUSTOM_TRANSFORMER_LANGUAGES,
  CustomTransformerCommandDTO,
  CustomTransformerDTO,
  INPUT_TYPES,
  InputType,
  OUTPUT_TYPES,
  OutputType,
  TransformerDTO,
  TransformerLanguage
} from '../../../../../../backend/shared/model/transformer.model';
import { Observable, startWith, switchMap } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import { TransformerService } from '../../../services/transformer.service';
import { ConfirmationService } from '../../../shared/confirmation.service';
import { OibusInputDataTypeEnumPipe } from '../../../shared/oibus-input-data-type-enum.pipe';
import { OibusOutputDataTypeEnumPipe } from '../../../shared/oibus-output-data-type-enum.pipe';
import { OIBusTransformerLanguageEnumPipe } from '../../../shared/oibus-transformer-language-enum.pipe';
import { OIBusAttribute } from '../../../../../../backend/shared/model/form.model';
import { ManifestAttributesArrayComponent } from '../../../shared/form/manifest-builder/manifest-attributes-array/manifest-attributes-array.component';
import { TransformerTestComponent } from '../transformer-test/transformer-test.component';

@Component({
  selector: 'oib-edit-transformer-modal',
  templateUrl: './edit-transformer-modal.component.html',
  styleUrl: './edit-transformer-modal.component.scss',
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    OI_FORM_VALIDATION_DIRECTIVES,
    OibCodeBlockComponent,
    SaveButtonComponent,
    OibusInputDataTypeEnumPipe,
    OibusOutputDataTypeEnumPipe,
    OIBusTransformerLanguageEnumPipe,
    ManifestAttributesArrayComponent,
    TranslatePipe,
    TransformerTestComponent
  ]
})
export class EditTransformerModalComponent implements OnInit {
  private modal = inject(NgbActiveModal);
  private transformerService = inject(TransformerService);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);
  private confirmationService = inject(ConfirmationService);
  private fb = inject(NonNullableFormBuilder);

  @ViewChild(OibCodeBlockComponent) editor: OibCodeBlockComponent | null = null;
  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();

  customTransformer: CustomTransformerDTO | null = null;

  inputTypes = INPUT_TYPES;
  outputTypes = OUTPUT_TYPES;
  languages = CUSTOM_TRANSFORMER_LANGUAGES;

  form = this.fb.group({
    name: ['', Validators.required],
    description: '',
    inputType: [null as InputType | null, Validators.required],
    outputType: [null as OutputType | null, Validators.required],
    timeout: [2000, [Validators.required, Validators.min(100)]],
    language: [null as TransformerLanguage | null, Validators.required],
    customCode: ['', Validators.required],
    attributes: this.fb.control([] as Array<OIBusAttribute>)
  });

  private readonly formValue = toSignal(this.form.valueChanges.pipe(startWith(this.form.value)));
  private readonly formValid = toSignal(this.form.statusChanges.pipe(startWith(this.form.status)));

  readonly transformerCommand = computed<CustomTransformerCommandDTO | null>(() => {
    if (this.formValid() !== 'VALID') return null;
    if (this.mode === 'edit' && !this.customTransformer) return null;
    const formValue = this.formValue()!;
    return {
      type: 'custom',
      inputType: formValue.inputType!,
      outputType: formValue.outputType!,
      language: formValue.language!,
      name: formValue.name!,
      description: formValue.description!,
      timeout: formValue.timeout!,
      customCode: formValue.customCode!,
      customManifest: {
        type: 'object',
        key: 'options',
        translationKey: 'configuration.oibus.manifest.transformers.choose-transformer-modal.options',
        attributes: formValue.attributes!,
        enablingConditions: [],
        validators: [],
        displayProperties: {
          visible: true,
          wrapInBox: false
        }
      }
    };
  });

  ngOnInit() {
    this.form.controls.language.valueChanges.subscribe(() => {
      if (this.mode === 'create') {
        this.generateCodeTemplate();
      }
    });
  }

  prepareForCreation() {
    this.mode = 'create';
    this.generateCodeTemplate();
  }

  private generateCodeTemplate() {
    const template = this.getCodeTemplate();
    this.form.patchValue({ customCode: template });
  }

  private getCodeTemplate(): string {
    const language = this.form.controls.language.value || 'javascript';
    if (language === 'typescript') {
      return `// Custom transformer function
// This function will be called for each input data
function transform(inputData: string, source: string, filename: string, options: any): { data: any; filename: string; numberOfElement?: number } {
  // Parse the input data
  let data = inputData;
  try {
    data = JSON.parse(inputData);
  } catch (e) {
    data = inputData;
  }

  // Your transformation logic here
  // data: the parsed input data to transform
  // options: the transformer options configured by the user
  // Return the transformed data in the expected format

  return {
    data: data,
    filename: filename,
    numberOfElement: Array.isArray(data) ? data.length : 1
  };
}`;
    } else {
      return `// Custom transformer function
// This function will be called for each input data
function transform(inputData, source, filename, options) {
  let data = inputData;
  // Parse the input data
  try {
    data = JSON.parse(inputData);
  } catch (e) {
    data = inputData;
  }

  // Your transformation logic here
  // data: the parsed input data to transform
  // options: the transformer options configured by the user
  // Return the transformed data in the expected format

  return {
    data: data,
    filename: filename,
    numberOfElement: Array.isArray(data) ? data.length : 1
  };
}`;
    }
  }

  prepareForEdition(transformer: CustomTransformerDTO) {
    this.mode = 'edit';
    this.customTransformer = transformer;
    this.form.patchValue({
      name: transformer.name,
      description: transformer.description,
      timeout: transformer.timeout,
      customCode: transformer.customCode,
      attributes: transformer.manifest.attributes,
      inputType: transformer.inputType,
      outputType: transformer.outputType,
      language: transformer.language
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
    const command = this.transformerCommand();
    if (!command) return;

    let obs: Observable<TransformerDTO>;
    if (this.mode === 'create') {
      obs = this.transformerService.create(command);
    } else {
      obs = this.confirmationService
        .confirm({
          messageKey: 'configuration.oibus.manifest.transformers.confirm-edit',
          interpolateParams: { name: this.customTransformer!.name }
        })
        .pipe(
          switchMap(() => this.transformerService.update(this.customTransformer!.id, command)),
          switchMap(() => this.transformerService.findById(this.customTransformer!.id))
        );
    }
    obs.pipe(this.state.pendingUntilFinalization()).subscribe(transformer => {
      this.modal.close(transformer);
    });
  }
}
